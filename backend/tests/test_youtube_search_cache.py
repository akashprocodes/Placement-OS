import pytest
import asyncio
from datetime import datetime, timezone, timedelta
import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.services.youtube_service import (
    search_learning_content,
    normalize_query,
    get_cached_search,
    save_search_cache,
    invalidate_search_cache,
    YouTubeQuotaError,
    YouTubeTimeoutError,
    YouTubeServiceError,
)
from app.schemas.learning import LearningSearchResult, YouTubeVideo, YouTubePlaylist
from app.models.learning_search_cache import LearningSearchCache


class MockResponse:
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code
        self.text = str(json_data)

    def json(self):
        return self.json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://example.com")
            raise httpx.HTTPStatusError("Error", request=request, response=self)


def test_normalize_query():
    assert normalize_query("  Python   FastAPI  ") == "python fastapi"
    assert normalize_query("SYSTEM DESIGN\nInterview\t") == "system design interview"
    assert normalize_query("   ") == ""
    assert normalize_query("") == ""


@pytest.mark.asyncio
async def test_search_cache_hit_and_normalization(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    call_count = {"search": 0, "videos": 0}

    async def mock_get(client, url, *args, **kwargs):
        if "search" in url:
            call_count["search"] += 1
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "vid_norm_1"},
                        "snippet": {
                            "title": "Python Basics",
                            "description": "Learn python",
                            "thumbnails": {"high": {"url": "https://img/vid_norm_1.jpg"}},
                            "channelTitle": "Python Academy",
                            "publishedAt": "2024-01-01T00:00:00Z"
                        }
                    }
                ],
                "nextPageToken": "token_page_2"
            })
        elif "videos" in url:
            call_count["videos"] += 1
            return MockResponse({
                "items": [
                    {
                        "id": "vid_norm_1",
                        "contentDetails": {"duration": "PT10M15S"}
                    }
                ]
            })
        return MockResponse({})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # First call with unnormalized query
    res1 = await search_learning_content("   Python   Basics  ", db=db_session)
    assert call_count["search"] == 1
    assert call_count["videos"] == 1
    assert len(res1.videos) == 1
    assert res1.videos[0].duration == "PT10M15S"
    assert res1.nextPageToken == "token_page_2"

    # Second call with identical normalized query in different casing/spacing
    res2 = await search_learning_content("python basics", db=db_session)
    # Should NOT hit upstream YouTube API (call count stays 1)
    assert call_count["search"] == 1
    assert call_count["videos"] == 1
    assert len(res2.videos) == 1
    assert res2.videos[0].duration == "PT10M15S"
    assert res2.nextPageToken == "token_page_2"


@pytest.mark.asyncio
async def test_search_cache_expiry(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    # Manually insert an expired entry into the database cache
    expired_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
    cached_entry = LearningSearchCache(
        query_normalized="react hooks",
        page_token="",
        response_data={
            "query": "react hooks",
            "videos": [{
                "id": "old_v1",
                "title": "Old React",
                "description": "",
                "thumbnailUrl": "",
                "channelTitle": "",
                "publishedAt": "",
                "duration": "PT5M",
                "url": "https://youtube.com/watch?v=old_v1"
            }],
            "playlists": [],
            "nextPageToken": None
        },
        cached_at=expired_time - timedelta(days=1),
        expires_at=expired_time
    )
    db_session.add(cached_entry)
    await db_session.commit()

    call_count = {"search": 0}

    async def mock_get(client, url, *args, **kwargs):
        if "search" in url:
            call_count["search"] += 1
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "fresh_v1"},
                        "snippet": {
                            "title": "Fresh React",
                            "description": "",
                            "thumbnails": {},
                            "channelTitle": "React Team",
                            "publishedAt": "2024-02-01T00:00:00Z"
                        }
                    }
                ]
            })
        elif "videos" in url:
            return MockResponse({"items": [{"id": "fresh_v1", "contentDetails": {"duration": "PT20M"}}]})
        return MockResponse({})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # Search should notice expired cache and make fresh upstream request
    res = await search_learning_content("React Hooks", db=db_session)
    assert call_count["search"] == 1
    assert res.videos[0].id == "fresh_v1"
    assert res.videos[0].title == "Fresh React"
    assert res.videos[0].duration == "PT20M"


@pytest.mark.asyncio
async def test_concurrent_deduplication_mutex(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    upstream_calls = 0

    async def mock_get(client, url, *args, **kwargs):
        nonlocal upstream_calls
        if "search" in url:
            upstream_calls += 1
            # Simulate real network latency
            await asyncio.sleep(0.05)
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "v_concurrent"},
                        "snippet": {"title": "Concurrent Test", "thumbnails": {}}
                    }
                ]
            })
        return MockResponse({"items": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # Launch 5 concurrent identical queries at the exact same moment
    tasks = [
        search_learning_content("fastapi concurrency", db=db_session)
        for _ in range(5)
    ]
    results = await asyncio.gather(*tasks)

    # In-flight mutex ensures only 1 upstream search API call is dispatched
    assert upstream_calls == 1
    for r in results:
        assert len(r.videos) == 1
        assert r.videos[0].id == "v_concurrent"


@pytest.mark.asyncio
async def test_duration_enrichment_graceful_failure(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    async def mock_get(client, url, *args, **kwargs):
        if "search" in url:
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "v_nofail"},
                        "snippet": {"title": "No Fail", "thumbnails": {}}
                    }
                ]
            })
        elif "videos" in url:
            # Simulate upstream videos.list failure (e.g. 500 or timeout)
            return MockResponse({"error": "server error"}, status_code=500)
        return MockResponse({})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # Search must not fail if duration enrichment has an upstream glitch
    res = await search_learning_content("graceful test", db=db_session)
    assert len(res.videos) == 1
    assert res.videos[0].id == "v_nofail"
    assert res.videos[0].duration is None


@pytest.mark.asyncio
async def test_quota_exhaustion_error_handling(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "secret_key_hidden")

    async def mock_get(client, url, *args, **kwargs):
        return MockResponse({
            "error": {
                "code": 403,
                "message": "The request cannot be completed because you have exceeded your quota.",
                "errors": [{"reason": "quotaExceeded", "message": "Quota Exceeded"}]
            }
        }, status_code=403)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    with pytest.raises(YouTubeQuotaError) as exc_info:
        await search_learning_content("quota test")

    # Verify no API key leaked in exception message
    assert "secret_key_hidden" not in str(exc_info.value)
    assert "quota exceeded" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_pagination_tokens_cached_separately(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    page_requests = []

    async def mock_get(client, url, *args, **kwargs):
        params = kwargs.get("params", {})
        if "search" in url:
            token = params.get("pageToken", "page_1")
            page_requests.append(token)
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": f"v_{token}"},
                        "snippet": {"title": f"Video {token}", "thumbnails": {}}
                    }
                ],
                "nextPageToken": f"token_after_{token}"
            })
        return MockResponse({"items": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # Page 1
    res_p1 = await search_learning_content("paged query", page_token=None, db=db_session)
    assert res_p1.videos[0].id == "v_page_1"
    assert res_p1.nextPageToken == "token_after_page_1"

    # Page 2
    res_p2 = await search_learning_content("paged query", page_token="next_page_token_xyz", db=db_session)
    assert res_p2.videos[0].id == "v_next_page_token_xyz"
    assert res_p2.nextPageToken == "token_after_next_page_token_xyz"

    assert len(page_requests) == 2

    # Repeat Page 1 - should hit cache
    res_p1_repeat = await search_learning_content("paged query", page_token=None, db=db_session)
    assert res_p1_repeat.videos[0].id == "v_page_1"
    assert len(page_requests) == 2


@pytest.mark.asyncio
async def test_cache_invalidation(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_abc123")

    call_count = 0

    async def mock_get(client, url, *args, **kwargs):
        nonlocal call_count
        if "search" in url:
            call_count += 1
            return MockResponse({
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": f"v_inv_{call_count}"},
                        "snippet": {"title": f"Title {call_count}", "thumbnails": {}}
                    }
                ]
            })
        return MockResponse({"items": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res1 = await search_learning_content("invalidation target", db=db_session)
    assert call_count == 1
    assert res1.videos[0].id == "v_inv_1"

    # Invalidate
    deleted_count = await invalidate_search_cache(db_session, "  invalidation target ")
    assert deleted_count >= 1

    # Next call should fetch fresh from upstream
    res2 = await search_learning_content("invalidation target", db=db_session)
    assert call_count == 2
    assert res2.videos[0].id == "v_inv_2"


@pytest.mark.asyncio
async def test_api_endpoint_search_and_caching(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_endpoint")

    upstream_hits = 0
    orig_get = httpx.AsyncClient.get

    async def mock_get(self, url, *args, **kwargs):
        nonlocal upstream_hits
        url_str = str(url)
        if "googleapis.com" in url_str:
            if "search" in url_str:
                upstream_hits += 1
                return MockResponse({
                    "items": [
                        {
                            "id": {"kind": "youtube#video", "videoId": "v_api_test"},
                            "snippet": {
                                "title": "API Test Video",
                                "description": "Test description",
                                "thumbnails": {"high": {"url": "https://img/v_api.jpg"}},
                                "channelTitle": "API Channel",
                                "publishedAt": "2024-03-01T00:00:00Z"
                            }
                        }
                    ],
                    "nextPageToken": "page_token_abc"
                })
            elif "videos" in url_str:
                return MockResponse({
                    "items": [{"id": "v_api_test", "contentDetails": {"duration": "PT12M34S"}}]
                })
            return MockResponse({})
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # First request
    resp1 = await client.get("/api/v1/learning/search?q=Docker+Basics")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["query"] == "Docker Basics"
    assert len(data1["videos"]) == 1
    assert data1["videos"][0]["id"] == "v_api_test"
    assert data1["videos"][0]["duration"] == "PT12M34S"
    assert data1["nextPageToken"] == "page_token_abc"
    assert upstream_hits == 1

    # Second request with different query casing
    resp2 = await client.get("/api/v1/learning/search?q=docker+basics")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["videos"]) == 1
    assert data2["videos"][0]["id"] == "v_api_test"
    # Cached hit: upstream_hits remains 1
    assert upstream_hits == 1


@pytest.mark.asyncio
async def test_api_endpoint_quota_error(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "test_key_endpoint")
    orig_get = httpx.AsyncClient.get

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "googleapis.com" in url_str:
            return MockResponse({
                "error": {
                    "code": 403,
                    "message": "Quota Exceeded",
                    "errors": [{"reason": "quotaExceeded", "message": "Quota Exceeded"}]
                }
            }, status_code=403)
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    resp = await client.get("/api/v1/learning/search?q=exhausted_quota")
    assert resp.status_code == 503
    data = resp.json()
    assert "quota exceeded" in data["detail"].lower()
