import asyncio
import httpx
import json
import uuid

async def run_e2e():
    print("--- Running Session Tracking E2E Simulation ---")
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Register and Login
        email = "e2e_tracker@test.com"
        await client.post("/api/v1/auth/register", json={"email": email, "password": "password"})
        res_login = await client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
        token = res_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        session_id = str(uuid.uuid4())
        content_id = "real_video_123"
        
        # 1. Playback for 10 seconds at 1x
        print("1. Playing for 10s at 1x...")
        seq1 = {
            "session_id": session_id,
            "content_id": content_id,
            "content_type": "video",
            "sequence": 1,
            "position_seconds": 10,
            "playback_rate": 1.0,
            "played_content_seconds": 10,
            "wall_clock_seconds": 10,
            "status": "active"
        }
        r1 = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1, headers=headers)
        assert r1.status_code == 200
        
        # 2. Seek forward to 500s, then play for 10 seconds at 2x. 
        # (Content consumed should be 20s, wall clock 10s. Ignored skipped time).
        print("2. Seeking forward and playing for 10s at 2x...")
        seq2 = {
            "session_id": session_id,
            "content_id": content_id,
            "content_type": "video",
            "sequence": 2,
            "position_seconds": 510,
            "playback_rate": 2.0,
            "played_content_seconds": 20,
            "wall_clock_seconds": 10,
            "status": "active"
        }
        r2 = await client.post("/api/v1/learning/sessions/heartbeat", json=seq2, headers=headers)
        assert r2.status_code == 200
        
        # 3. Duplicate heartbeat (due to network retry or out of order)
        print("3. Duplicate heartbeat (sequence 2)...")
        r3 = await client.post("/api/v1/learning/sessions/heartbeat", json=seq2, headers=headers)
        assert r3.status_code == 200
        
        # 4. Ended session
        print("4. Ended session...")
        seq4 = {
            "session_id": session_id,
            "content_id": content_id,
            "content_type": "video",
            "sequence": 3,
            "position_seconds": 510,
            "playback_rate": 2.0,
            "played_content_seconds": 0,
            "wall_clock_seconds": 0,
            "status": "ended"
        }
        r4 = await client.post("/api/v1/learning/sessions/heartbeat", json=seq4, headers=headers)
        assert r4.status_code == 200
        
        # Verify in DB
        import subprocess
        print("5. Verifying in DB...")
        cmd = f'docker exec placement-os-postgres psql -U placement_os -d placement_os -t -c "SELECT watched_content_seconds, wall_clock_seconds, status FROM learning_sessions WHERE id = \'{session_id}\';"'
        db_out = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        print(f"DB Output: {db_out}")
        
        parts = db_out.split("|")
        watched = int(parts[0].strip())
        wall = int(parts[1].strip())
        status = parts[2].strip()
        
        assert watched == 30, f"Expected 30 content seconds, got {watched}"
        assert wall == 20, f"Expected 20 wall clock seconds, got {wall}"
        assert status == "ended", f"Expected ended status, got {status}"
        
        print("--- All E2E constraints verified! ---")

asyncio.run(run_e2e())
