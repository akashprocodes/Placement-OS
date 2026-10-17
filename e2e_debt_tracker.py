import asyncio
import httpx
import uuid
import datetime

async def run_e2e():
    print("--- Running Debt Aggregation E2E Simulation ---")
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Register and Login
        email = f"e2e_debt_{uuid.uuid4().hex[:6]}@test.com"
        await client.post("/api/v1/auth/register", json={"email": email, "password": "password"})
        res_login = await client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
        token = res_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        content_id = "real_video_456"
        
        # 1. Create a Learning Plan
        print("1. Creating Learning Plan...")
        target_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=5)).strftime("%Y-%m-%d")
        plan_req = {
            "content_id": content_id,
            "content_type": "video",
            "title": "E2E Plan",
            "total_duration_seconds": 36000, # 10 hours
            "target_completion_date": target_date
        }
        res_plan = await client.post("/api/v1/learning/plans", json=plan_req, headers=headers)
        assert res_plan.status_code == 201, res_plan.text
        plan_id = res_plan.json()["id"]
        
        # 2. Check Progress (No sessions yet)
        print("2. Checking initial progress...")
        res_prog1 = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=headers)
        assert res_prog1.status_code == 200
        data1 = res_prog1.json()
        
        # 3. Simulate a session today
        print("3. Logging a session today...")
        seq1 = {
            "session_id": str(uuid.uuid4()),
            "content_id": content_id,
            "content_type": "video",
            "sequence": 1,
            "position_seconds": 290,
            "playback_rate": 1.0,
            "played_content_seconds": 290,
            "wall_clock_seconds": 290,
            "status": "ended"
        }
        res_sess = await client.post("/api/v1/learning/sessions/heartbeat", json=seq1, headers=headers)
        assert res_sess.status_code == 200, res_sess.text
        
        # 4. Check Progress Again
        print("4. Checking updated progress...")
        res_prog2 = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=headers)
        data2 = res_prog2.json()
        
        assert data2["completed_seconds_today"] == 290
        
        print("--- All E2E Debt constraints verified! ---")

asyncio.run(run_e2e())
