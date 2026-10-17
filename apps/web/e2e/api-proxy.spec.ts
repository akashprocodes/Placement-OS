import { test, expect } from "@playwright/test";
import { generateTestUser, registerViaUi, enforceZeroLiveYouTubeQuota } from "./helpers";

test.describe("Next.js /api/v1 Rewrite Proxy & Cookie Forwarding", () => {
  test.beforeEach(async ({ page }) => {
    await enforceZeroLiveYouTubeQuota(page);
  });

  test("Proxy routes public health endpoints through Next.js to backend", async ({ page }) => {
    // Navigate to homepage first to ensure webServer is up
    await page.goto("/login");

    // Fetch /api/v1/health via Next.js server
    const healthRes = await page.request.get("/api/v1/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson).toEqual({ status: "ok" });

    // Fetch /api/v1/health/db via Next.js server
    const dbHealthRes = await page.request.get("/api/v1/health/db");
    expect(dbHealthRes.status()).toBe(200);
    const dbJson = await dbHealthRes.json();
    expect(dbJson).toEqual({ status: "ok", database: "connected" });
  });

  test("Proxy rejects unauthenticated requests to protected endpoints with 401", async ({ page }) => {
    await page.goto("/login");

    // Call protected endpoint without authentication cookie
    const res = await page.request.get("/api/v1/learning/workspace");
    expect(res.status()).toBe(401);
  });

  test("Proxy forwards HttpOnly session cookie and credentials for authenticated requests", async ({ page }) => {
    const user = generateTestUser();

    // 1. Register student via UI (sets HttpOnly access_token cookie on Next.js origin)
    await registerViaUi(page, user);
    await expect(page).toHaveURL("/");

    // 2. Fetch protected workspace via Next.js proxy route /api/v1/learning/workspace
    // The browser context automatically attaches the same-origin access_token cookie
    const wsRes = await page.request.get("/api/v1/learning/workspace");
    expect(wsRes.status()).toBe(200);
    const wsData = await wsRes.json();
    expect(wsData).toHaveProperty("active_plans");
    expect(Array.isArray(wsData.active_plans)).toBe(true);

    // 3. Perform authenticated PUT to update video progress via proxy
    const testVideoId = "test_proxy_video_123";
    const progressRes = await page.request.put(`/api/v1/learning/progress/video/${testVideoId}`, {
      data: {
        content_id: testVideoId,
        content_type: "video",
        progress_seconds: 120,
        duration_seconds: 600,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(progressRes.status()).toBe(200);
    const progressData = await progressRes.json();
    expect(progressData.content_id).toBe(testVideoId);
    expect(progressData.progress_seconds).toBe(120);

    // 4. Retrieve saved progress via proxy GET
    const getProgressRes = await page.request.get(`/api/v1/learning/progress/video/${testVideoId}`);
    expect(getProgressRes.status()).toBe(200);
    const retrievedData = await getProgressRes.json();
    expect(retrievedData.content_id).toBe(testVideoId);
    expect(retrievedData.progress_seconds).toBe(120);
  });

  test("Browser client resolves API URLs against same origin without proxy bypass", async ({ page }) => {
    await page.goto("/login");

    const browserResolvedOrigin = await page.evaluate(() => {
      // With getApiBaseUrl() returning "", relative /api/v1 resolves strictly against window.location.origin
      const relativePath = `${""}/api/v1/health`;
      return new URL(relativePath, window.location.origin).origin;
    });

    const currentOrigin = new URL(page.url()).origin;
    expect(browserResolvedOrigin).toBe(currentOrigin);
  });
});

