import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_note_success(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "note_create@example.com")
    payload = {
        "video_id": "vid_dsa_01",
        "timestamp_seconds": 125,
        "title": "Time Complexity Breakdown",
        "content": "Outer loop runs N times, inner loop runs log N times, yielding O(N log N).",
        "note_type": "note"
    }

    res = await client.post("/api/v1/learning/notes", json=payload, headers=auth(token))
    assert res.status_code == 201
    data = res.json()
    assert data["video_id"] == "vid_dsa_01"
    assert data["timestamp_seconds"] == 125
    assert data["title"] == "Time Complexity Breakdown"
    assert data["content"] == payload["content"]
    assert data["note_type"] == "note"
    assert data["user_id"] == user_id
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_bookmark_success(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "bm_create@example.com")
    payload = {
        "video_id": "vid_dsa_01",
        "timestamp_seconds": 450,
        "title": "Tricky Edge Case",
        "content": "",
        "note_type": "bookmark"
    }

    res = await client.post("/api/v1/learning/notes", json=payload, headers=auth(token))
    assert res.status_code == 201
    data = res.json()
    assert data["timestamp_seconds"] == 450
    assert data["title"] == "Tricky Edge Case"
    assert data["note_type"] == "bookmark"


@pytest.mark.asyncio
async def test_create_bookmark_default_title(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "bm_def@example.com")
    payload = {
        "video_id": "vid_dsa_01",
        "timestamp_seconds": 60,
        "content": "",
        "note_type": "bookmark"
    }

    res = await client.post("/api/v1/learning/notes", json=payload, headers=auth(token))
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Bookmark"


@pytest.mark.asyncio
async def test_create_note_validation(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "note_val@example.com")

    # Negative timestamp
    res1 = await client.post("/api/v1/learning/notes", json={
        "video_id": "vid_01",
        "timestamp_seconds": -5,
        "content": "test"
    }, headers=auth(token))
    assert res1.status_code == 422

    # Empty video_id
    res2 = await client.post("/api/v1/learning/notes", json={
        "video_id": "   ",
        "timestamp_seconds": 10,
        "content": "test"
    }, headers=auth(token))
    assert res2.status_code == 422

    # Empty content for note
    res3 = await client.post("/api/v1/learning/notes", json={
        "video_id": "vid_01",
        "timestamp_seconds": 10,
        "content": "   ",
        "note_type": "note"
    }, headers=auth(token))
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_list_notes_order_and_filter(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "note_list@example.com")
    vid = "vid_sort_test"

    # Insert notes out of chronological order
    await client.post("/api/v1/learning/notes", json={
        "video_id": vid, "timestamp_seconds": 300, "content": "Third moment", "note_type": "note"
    }, headers=auth(token))
    await client.post("/api/v1/learning/notes", json={
        "video_id": vid, "timestamp_seconds": 60, "title": "First bookmark", "note_type": "bookmark"
    }, headers=auth(token))
    await client.post("/api/v1/learning/notes", json={
        "video_id": vid, "timestamp_seconds": 180, "content": "Second moment", "note_type": "note"
    }, headers=auth(token))

    # Fetch all notes
    res_all = await client.get(f"/api/v1/learning/videos/{vid}/notes", headers=auth(token))
    assert res_all.status_code == 200
    items = res_all.json()
    assert len(items) == 3
    # Check ascending order by timestamp
    assert [item["timestamp_seconds"] for item in items] == [60, 180, 300]

    # Filter by bookmarks only
    res_bm = await client.get(f"/api/v1/learning/videos/{vid}/notes?note_type=bookmark", headers=auth(token))
    assert res_bm.status_code == 200
    bm_items = res_bm.json()
    assert len(bm_items) == 1
    assert bm_items[0]["timestamp_seconds"] == 60

    # Filter by notes only
    res_notes = await client.get(f"/api/v1/learning/videos/{vid}/notes?note_type=note", headers=auth(token))
    assert res_notes.status_code == 200
    note_items = res_notes.json()
    assert len(note_items) == 2
    assert [item["timestamp_seconds"] for item in note_items] == [180, 300]


@pytest.mark.asyncio
async def test_update_note(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "note_upd@example.com")
    create_res = await client.post("/api/v1/learning/notes", json={
        "video_id": "vid_upd",
        "timestamp_seconds": 100,
        "title": "Initial Title",
        "content": "Initial Content",
        "note_type": "note"
    }, headers=auth(token))
    note_id = create_res.json()["id"]

    # Update note
    upd_res = await client.put(f"/api/v1/learning/notes/{note_id}", json={
        "title": "Revised Title",
        "content": "Revised Content with deeper explanation.",
        "timestamp_seconds": 105
    }, headers=auth(token))
    assert upd_res.status_code == 200
    updated_data = upd_res.json()
    assert updated_data["title"] == "Revised Title"
    assert updated_data["content"] == "Revised Content with deeper explanation."
    assert updated_data["timestamp_seconds"] == 105


@pytest.mark.asyncio
async def test_delete_note(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "note_del@example.com")
    create_res = await client.post("/api/v1/learning/notes", json={
        "video_id": "vid_del",
        "timestamp_seconds": 90,
        "content": "Will be deleted",
        "note_type": "note"
    }, headers=auth(token))
    note_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/learning/notes/{note_id}", headers=auth(token))
    assert del_res.status_code == 204

    # Verify no longer returned in list
    list_res = await client.get("/api/v1/learning/videos/vid_del/notes", headers=auth(token))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0


@pytest.mark.asyncio
async def test_user_isolation(client: AsyncClient, db_session: AsyncSession):
    uid_a = uuid.uuid4().hex[:6]
    uid_b = uuid.uuid4().hex[:6]
    token_a, user_a_id = await register_and_login(client, f"notes_user_a_{uid_a}@example.com")
    token_b, user_b_id = await register_and_login(client, f"notes_user_b_{uid_b}@example.com")

    # User A creates a note
    create_res = await client.post("/api/v1/learning/notes", json={
        "video_id": "shared_video_101",
        "timestamp_seconds": 250,
        "content": "User A secret notes",
        "note_type": "note"
    }, headers=auth(token_a))
    note_a_id = create_res.json()["id"]

    # User B lists notes for same video — must see 0 notes
    list_b = await client.get("/api/v1/learning/videos/shared_video_101/notes", headers=auth(token_b))
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # User B attempts to update User A's note — must fail with 404
    upd_b = await client.put(f"/api/v1/learning/notes/{note_a_id}", json={
        "content": "Tampered content"
    }, headers=auth(token_b))
    assert upd_b.status_code == 404

    # User B attempts to delete User A's note — must fail with 404
    del_b = await client.delete(f"/api/v1/learning/notes/{note_a_id}", headers=auth(token_b))
    assert del_b.status_code == 404

    # User A's note must still exist intact
    list_a = await client.get("/api/v1/learning/videos/shared_video_101/notes", headers=auth(token_a))
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["content"] == "User A secret notes"


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    fake_uuid = str(uuid.uuid4())
    # No auth header
    res_list = await client.get("/api/v1/learning/videos/any_vid/notes")
    assert res_list.status_code == 401

    res_create = await client.post("/api/v1/learning/notes", json={
        "video_id": "any_vid", "timestamp_seconds": 10, "content": "text"
    })
    assert res_create.status_code == 401

    res_update = await client.put(f"/api/v1/learning/notes/{fake_uuid}", json={"content": "new"})
    assert res_update.status_code == 401

    res_delete = await client.delete(f"/api/v1/learning/notes/{fake_uuid}")
    assert res_delete.status_code == 401


@pytest.mark.asyncio
async def test_nonexistent_note_404(client: AsyncClient, db_session: AsyncSession):
    token, _ = await register_and_login(client, "not_found_user@example.com")
    fake_uuid = str(uuid.uuid4())

    upd_res = await client.put(f"/api/v1/learning/notes/{fake_uuid}", json={
        "content": "Does not exist"
    }, headers=auth(token))
    assert upd_res.status_code == 404

    del_res = await client.delete(f"/api/v1/learning/notes/{fake_uuid}", headers=auth(token))
    assert del_res.status_code == 404

