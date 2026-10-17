import asyncio
import httpx
import uuid
import datetime

async def run_e2e():
    print("--- Running Cross-Midnight E2E Simulation ---")
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Register and Login
        email = f"e2e_mid_{uuid.uuid4().hex[:6]}@test.com"
        await client.post("/api/v1/auth/register", json={"email": email, "password": "password"})
        res_login = await client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
        token = res_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get User ID
        res_me = await client.get("/api/v1/auth/me", headers=headers)
        user_id = res_me.json()["id"]
        
        content_id = "midnight_e2e"
        
        client_event_at = datetime.datetime.now(datetime.timezone.utc)
        
        print("1. Logging a normal session today...")
        seq1 = {
            "session_id": str(uuid.uuid4()),
            "content_id": content_id,
            "content_type": "video",
            "sequence": 1,
            "position_seconds": 120,
            "playback_rate": 1.0,
            "played_content_seconds": 120,
            "wall_clock_seconds": 120,
            "status": "ended",
            "client_event_at": client_event_at.isoformat()
        }
        res_sess = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1, headers=headers)
        assert res_sess.status_code == 200, res_sess.text
        
        print("2. Verifying LearningDailyActivity exists...")
        import subprocess
        cmd = f'docker exec placement-os-postgres psql -U placement_os -d placement_os -t -c "SELECT watched_content_seconds FROM learning_daily_activity WHERE user_id = \'{user_id}\' AND content_id = \'{content_id}\';"'
        db_out = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        print(f"DB Output: {db_out}")
        
        watched = int(db_out)
        assert watched == 120, f"Expected 120 content seconds, got {watched}"
        
        # Test Duplicate (idempotency doesn't double count)
        print("3. Testing duplicate sequence...")
        res_dup = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1, headers=headers)
        assert res_dup.status_code == 200
        
        db_out2 = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        assert int(db_out2) == 120, "Should remain 120"
        
        print("--- All E2E constraints verified! ---")

asyncio.run(run_e2e())
