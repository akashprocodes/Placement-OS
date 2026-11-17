import pytest
import httpx
from app.services.youtube_service import search_learning_content
from app.core.config import get_settings
from app.schemas.learning import LearningSearchResult

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

@pytest.mark.asyncio
async def test_missing_api_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "")
    with pytest.raises(ValueError, match="YOUTUBE_API_KEY is not configured."):
        await search_learning_content("test")

@pytest.mark.asyncio
async def test_successful_mocked_youtube_response(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "dummy_key")
    
    async def mock_get(*args, **kwargs):
        return MockResponse({
            "items": [
                {
                    "id": {"kind": "youtube#video", "videoId": "v123"},
                    "snippet": {
                        "title": "Test Video",
                        "description": "Test Desc",
                        "thumbnails": {"high": {"url": "http://img.com/v123"}},
                        "channelTitle": "Test Channel",
                        "publishedAt": "2023-01-01T00:00:00Z"
                    }
                },
                {
                    "id": {"kind": "youtube#playlist", "playlistId": "p123"},
                    "snippet": {
                        "title": "Test Playlist",
                        "description": "Test Playlist Desc",
                        "thumbnails": {"default": {"url": "http://img.com/p123"}},
                        "channelTitle": "Test Channel 2",
                        "publishedAt": "2023-01-02T00:00:00Z"
                    }
                }
            ]
        })
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    result = await search_learning_content("test query")
    
    assert isinstance(result, LearningSearchResult)
    assert result.query == "test query"
    assert len(result.videos) == 1
    assert result.videos[0].id == "v123"
    assert result.videos[0].title == "Test Video"
    assert result.videos[0].thumbnailUrl == "http://img.com/v123"
    assert result.videos[0].url == "https://www.youtube.com/watch?v=v123"
    
    assert len(result.playlists) == 1
    assert result.playlists[0].id == "p123"
    assert result.playlists[0].itemCount is None
    assert result.playlists[0].url == "https://www.youtube.com/playlist?list=p123"

@pytest.mark.asyncio
async def test_empty_results(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "dummy_key")
    
    async def mock_get(*args, **kwargs):
        return MockResponse({"items": []})
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    result = await search_learning_content("empty query")
    
    assert len(result.videos) == 0
    assert len(result.playlists) == 0

@pytest.mark.asyncio
async def test_youtube_api_failure(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "dummy_key")
    
    async def mock_get(*args, **kwargs):
        return MockResponse({"error": "Bad request"}, status_code=400)
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    
    with pytest.raises(Exception, match="YouTube API request failed"):
        await search_learning_content("fail query")

@pytest.mark.asyncio
async def test_timeout(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "dummy_key")
    
    async def mock_get(*args, **kwargs):
        raise httpx.RequestError("Timeout", request=httpx.Request("GET", "https://example.com"))
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    
    with pytest.raises(Exception, match="Failed to connect to YouTube API"):
        await search_learning_content("timeout query")

@pytest.mark.asyncio
async def test_malformed_fields(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "dummy_key")
    
    async def mock_get(*args, **kwargs):
        return MockResponse({
            "items": [
                {
                    "id": {"kind": "youtube#video", "videoId": "v123"}
                    # missing snippet entirely
                }
            ]
        })
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    result = await search_learning_content("malformed query")
    
    assert len(result.videos) == 1
    assert result.videos[0].title == ""
    assert result.videos[0].thumbnailUrl == ""
