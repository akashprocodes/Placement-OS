import asyncio
import httpx
import uuid
import subprocess

async def run_e2e():
    print("--- Running Remediation E2E Simulation ---")
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Register and Login
        email = f"e2e_{uuid.uuid4().hex[:6]}@test.com"
        await client.post("/api/v1/auth/register", json={"email": email, "password": "password"})
        res_login = await client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
        token = res_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # User 2
        email2 = f"e2e_{uuid.uuid4().hex[:6]}@test.com"
        await client.post("/api/v1/auth/register", json={"email": email2, "password": "password"})
        res_login2 = await client.post("/api/v1/auth/login", json={"email": email2, "password": "password"})
        token2 = res_login2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        session_id = str(uuid.uuid4())
        content_id = "real_video_123"
        
        # 1. Math Cheat (Should fail)
        print("1. Testing math cheat (300s content on 10s wall clock)...")
        seq1_bad = {
            "session_id": session_id,
            "content_id": content_id,
            "content_type": "video",
            "sequence": 1,
            "position_seconds": 10,
            "playback_rate": 1.0,
            "played_content_seconds": 300,
            "wall_clock_seconds": 10,
            "status": "active"
        }
        r1_bad = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1_bad, headers=headers)
        assert r1_bad.status_code == 422, f"Expected 422, got {r1_bad.status_code}"
        
        # 2. Valid creation
        print("2. Valid session creation...")
        seq1_good = {**seq1_bad, "played_content_seconds": 10}
        r1_good = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1_good, headers=headers)
        assert r1_good.status_code == 200, "Expected 200"
        
        # 3. Ownership Isolation
        print("3. Testing cross-user isolation...")
        seq2_hijack = {**seq1_good, "sequence": 2}
        r2_hijack = await client.post("/api/v1/learning/sessions/heartbeat", json=seq2_hijack, headers=headers2)
        assert r2_hijack.status_code == 403, f"Expected 403, got {r2_hijack.status_code}"
        
        # 4. End Session
        print("4. Ending session...")
        seq3_end = {**seq1_good, "sequence": 2, "played_content_seconds": 0, "wall_clock_seconds": 0, "status": "ended"}
        r3_end = await client.post("/api/v1/learning/sessions/heartbeat", json=seq3_end, headers=headers)
        assert r3_end.status_code == 200, "Expected 200"
        
        # 5. Modify ended session
        print("5. Attempting to modify ended session...")
        seq4_late = {**seq1_good, "sequence": 3, "status": "active"}
        r4_late = await client.post("/api/v1/learning/sessions/heartbeat", json=seq4_late, headers=headers)
        assert r4_late.status_code == 409, f"Expected 409, got {r4_late.status_code}"
        
        # Verify in DB
        print("6. Verifying in DB...")
        cmd = f'docker exec placement-os-postgres psql -U placement_os -d placement_os -t -c "SELECT watched_content_seconds, wall_clock_seconds, status FROM learning_sessions WHERE id = \'{session_id}\';"'
        db_out = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        print(f"DB Output: {db_out}")
        
        parts = db_out.split("|")
        watched = int(parts[0].strip())
        wall = int(parts[1].strip())
        status = parts[2].strip()
        
        assert watched == 10, f"Expected 10 content seconds, got {watched}"
        assert wall == 10, f"Expected 10 wall clock seconds, got {wall}"
        assert status == "ended", f"Expected ended status, got {status}"
        
        print("--- All E2E constraints verified! ---")

asyncio.run(run_e2e())
