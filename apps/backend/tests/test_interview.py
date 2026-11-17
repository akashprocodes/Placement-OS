import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview_session import InterviewSession
from app.models.resume import Resume
from app.services.ai_interview_provider import (
    get_ai_interview_provider,
    InterviewContext,
)


async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── 1. Authentication & Authorization ────────────────────────────────────────

@pytest.mark.asyncio
async def test_interview_endpoints_require_authentication(client: AsyncClient):
    # Unauthenticated GET
    res_list = await client.get("/api/v1/interviews")
    assert res_list.status_code == 401

    # Unauthenticated POST
    res_create = await client.post("/api/v1/interviews", json={
        "target_role": "Backend Engineer",
        "selected_stages": ["technical"]
    })
    assert res_create.status_code == 401

    # Unauthenticated Resume list
    res_resumes = await client.get("/api/v1/interviews/resumes")
    assert res_resumes.status_code == 401


# ─── 2. Session Creation & Validation ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_interview_session_success(client: AsyncClient):
    token, user_id = await register_and_login(client, "interview_user1@test.com")

    payload = {
        "interview_type": "role_based",
        "target_role": "Full Stack Engineer",
        "experience_level": "mid",
        "difficulty": "medium",
        "selected_stages": ["hr", "technical", "project_discussion"],
        "duration_minutes": 45,
    }

    res = await client.post("/api/v1/interviews", json=payload, headers=auth(token))
    assert res.status_code == 201
    data = res.json()
    assert data["target_role"] == "Full Stack Engineer"
    assert data["interview_type"] == "role_based"
    assert data["status"] == "draft"
    assert data["current_stage"] == "hr"
    assert data["difficulty"] == "medium"
    assert data["selected_stages"] == ["hr", "technical", "project_discussion"]
    assert data["duration_minutes"] == 45
    assert "Full Stack Engineer (Mid)" in data["title"]
    assert data["turn_count"] == 0


@pytest.mark.asyncio
async def test_create_interview_session_validation_failures(client: AsyncClient):
    token, _ = await register_and_login(client, "interview_val@test.com")

    # Blank target role -> 422
    res_blank = await client.post("/api/v1/interviews", json={
        "target_role": "   ",
        "selected_stages": ["technical"]
    }, headers=auth(token))
    assert res_blank.status_code == 422

    # Empty selected stages -> 422
    res_empty_stages = await client.post("/api/v1/interviews", json={
        "target_role": "Data Scientist",
        "selected_stages": []
    }, headers=auth(token))
    assert res_empty_stages.status_code == 422

    # Invalid stage enum -> 422
    res_invalid_stage = await client.post("/api/v1/interviews", json={
        "target_role": "Data Scientist",
        "selected_stages": ["unknown_stage"]
    }, headers=auth(token))
    assert res_invalid_stage.status_code == 422

    # Out of bounds duration -> 422 (< 10 min)
    res_short = await client.post("/api/v1/interviews", json={
        "target_role": "Data Scientist",
        "selected_stages": ["technical"],
        "duration_minutes": 5
    }, headers=auth(token))
    assert res_short.status_code == 422


# ─── 3. Session Listing, Detail & Lifecycle ───────────────────────────────────

@pytest.mark.asyncio
async def test_interview_session_lifecycle_and_listing(client: AsyncClient):
    token, _ = await register_and_login(client, "interview_life@test.com")

    # Create two sessions
    create1 = await client.post("/api/v1/interviews", json={
        "target_role": "Frontend Architect",
        "experience_level": "senior",
        "difficulty": "hard",
        "selected_stages": ["technical"],
        "duration_minutes": 60,
    }, headers=auth(token))
    s1_id = create1.json()["id"]

    create2 = await client.post("/api/v1/interviews", json={
        "target_role": "DevOps Engineer",
        "selected_stages": ["hr"],
    }, headers=auth(token))
    s2_id = create2.json()["id"]

    # List all sessions
    list_res = await client.get("/api/v1/interviews", headers=auth(token))
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 2

    # Get single session details
    detail_res = await client.get(f"/api/v1/interviews/{s1_id}", headers=auth(token))
    assert detail_res.status_code == 200
    assert detail_res.json()["target_role"] == "Frontend Architect"

    # Update session to in_progress
    patch_res = await client.patch(f"/api/v1/interviews/{s1_id}", json={
        "status": "in_progress",
        "title": "Custom Specialized Architecture Interview"
    }, headers=auth(token))
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_progress"
    assert patch_res.json()["title"] == "Custom Specialized Architecture Interview"

    # Complete session
    comp_res = await client.patch(f"/api/v1/interviews/{s1_id}", json={
        "status": "completed"
    }, headers=auth(token))
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"
    assert comp_res.json()["completed_at"] is not None

    # Cannot revert completed session back to draft -> 400 Bad Request
    revert_res = await client.patch(f"/api/v1/interviews/{s1_id}", json={
        "status": "draft"
    }, headers=auth(token))
    assert revert_res.status_code == 400

    # Abandon second session
    abandon_res = await client.post(f"/api/v1/interviews/{s2_id}/abandon", headers=auth(token))
    assert abandon_res.status_code == 200
    assert abandon_res.json()["status"] == "abandoned"

    # Filter by status
    filtered = await client.get("/api/v1/interviews?status=completed", headers=auth(token))
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["sessions"][0]["id"] == s1_id


# ─── 4. Cross-User Isolation ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_interview_cross_user_isolation(client: AsyncClient):
    token_a, _ = await register_and_login(client, "user_a_interview@test.com")
    token_b, _ = await register_and_login(client, "user_b_interview@test.com")

    # User A creates a session
    s_a = await client.post("/api/v1/interviews", json={
        "target_role": "Machine Learning Engineer",
        "selected_stages": ["technical"]
    }, headers=auth(token_a))
    s_a_id = s_a.json()["id"]

    # User B attempts to access User A's session -> 403 Forbidden
    res_b_get = await client.get(f"/api/v1/interviews/{s_a_id}", headers=auth(token_b))
    assert res_b_get.status_code == 403

    # User B attempts to update User A's session -> 403 Forbidden
    res_b_patch = await client.patch(f"/api/v1/interviews/{s_a_id}", json={
        "status": "abandoned"
    }, headers=auth(token_b))
    assert res_b_patch.status_code == 403

    # User B's list should not include User A's session
    res_b_list = await client.get("/api/v1/interviews", headers=auth(token_b))
    assert res_b_list.status_code == 200
    assert res_b_list.json()["total"] == 0


# ─── 5. Resume Ingestion & Validation ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_resume_upload_and_cross_user_isolation(client: AsyncClient):
    token_a, _ = await register_and_login(client, "resume_user_a@test.com")
    token_b, _ = await register_and_login(client, "resume_user_b@test.com")

    # 1. Valid resume upload with skills detection
    resume_text = """
    Jane Doe - Senior Full Stack Developer
    Experienced with Python, FastAPI, TypeScript, React, and PostgreSQL.
    Architected high-throughput microservices using Docker and AWS.
    """

    res_up = await client.post("/api/v1/interviews/resumes", json={
        "filename": "jane_doe_resume.txt",
        "file_type": "text/plain",
        "raw_text": resume_text,
    }, headers=auth(token_a))
    assert res_up.status_code == 201
    r_data = res_up.json()
    assert r_data["filename"] == "jane_doe_resume.txt"
    assert "Python" in r_data["skills"]
    assert "TypeScript" in r_data["skills"]
    assert "React" in r_data["skills"]
    r_id = r_data["id"]

    # 2. List resumes for User A
    res_list = await client.get("/api/v1/interviews/resumes", headers=auth(token_a))
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # User B cannot see User A's resumes
    res_b_list = await client.get("/api/v1/interviews/resumes", headers=auth(token_b))
    assert res_b_list.status_code == 200
    assert len(res_b_list.json()) == 0

    # 3. User A creates resume-based interview referencing own resume -> Success
    res_plan = await client.post("/api/v1/interviews", json={
        "interview_type": "resume_based",
        "target_role": "Senior Full Stack Developer",
        "selected_stages": ["project_discussion"],
        "resume_id": r_id,
    }, headers=auth(token_a))
    assert res_plan.status_code == 201
    assert res_plan.json()["resume_id"] == r_id

    # 4. User B attempts to create session referencing User A's resume -> 404 Not Found
    res_b_hijack = await client.post("/api/v1/interviews", json={
        "interview_type": "resume_based",
        "target_role": "Senior Full Stack Developer",
        "selected_stages": ["project_discussion"],
        "resume_id": r_id,
    }, headers=auth(token_b))
    assert res_b_hijack.status_code == 404

    # 5. Invalid file extension -> 415 Unsupported Media Type
    res_bad_ext = await client.post("/api/v1/interviews/resumes", json={
        "filename": "malicious.exe",
        "raw_text": "executable binary content",
    }, headers=auth(token_a))
    assert res_bad_ext.status_code == 415

    # 6. Empty content -> 400 Bad Request
    res_empty = await client.post("/api/v1/interviews/resumes", json={
        "filename": "empty.txt",
    }, headers=auth(token_a))
    assert res_empty.status_code == 400


# ─── 6. AI Provider Abstraction Interface ────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_interview_provider_abstraction():
    provider = get_ai_interview_provider()
    context = InterviewContext(
        target_role="Frontend Engineer",
        experience_level="mid",
        difficulty="medium",
        current_stage="technical",
        selected_stages=["technical", "project_discussion"],
    )

    # Opening question
    q = await provider.generate_opening_question(context)
    assert q.question is not None
    assert len(q.question) > 10
    assert q.stage == "technical"

    # Evaluation
    eval_res = await provider.evaluate_answer(
        question=q.question,
        answer="I use CSS container queries and React state hooks for responsive layouts.",
        context=context,
    )
    assert eval_res.score >= 0.0
    assert len(eval_res.strengths) > 0

    # Final report
    report = await provider.generate_final_report(context, [])
    assert report.overall_score >= 0.0
    assert "Frontend Engineer" in report.summary

