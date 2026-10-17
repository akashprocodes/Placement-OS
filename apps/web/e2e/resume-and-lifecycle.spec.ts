import { test, expect } from "@playwright/test";
import { generateTestUser, registerViaUi, enforceZeroLiveYouTubeQuota } from "./helpers";

test.describe("Resume & Plan Lifecycle Journey", () => {
  test.beforeEach(async ({ page }) => {
    await enforceZeroLiveYouTubeQuota(page);
  });

  test("Saved playback position powers dashboard Resume CTA with timestamp, and completed course shows retake option", async ({ page }) => {
    const user = generateTestUser();
    await registerViaUi(page, user);

    // 1. Create playlist plan
    await page.goto("/learning/playlist/PL_E2E_PLAYWRIGHT_COURSE");
    await page.waitForLoadState("domcontentloaded");

    const startPlanBtn = page.getByRole("button", { name: "Start Learning Plan" });
    await expect(startPlanBtn).toBeVisible();
    await startPlanBtn.click();

    const createPlanSubmit = page.getByRole("button", { name: "Create Learning Plan" });
    await expect(createPlanSubmit).toBeVisible();
    await createPlanSubmit.click();

    // Verify active plan widget rendered
    await expect(page.getByRole("heading", { name: "Learning Plan", level: 3 })).toBeVisible();

    // 2. Simulate saving playback progress for Video 1 at 150 seconds (2m 30s)
    await page.evaluate(async () => {
      await fetch("http://localhost:8000/api/v1/learning/progress/video/VID_E2E_P01", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content_id: "VID_E2E_P01",
          content_type: "video",
          progress_seconds: 150,
          duration_seconds: 600,
        }),
      });
    });

    // 3. Navigate to Dashboard and inspect Continue Learning
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Verify plan is active on Dashboard
    await expect(page.getByText("Continue Learning")).toBeVisible();
    await expect(page.getByText("Playwright E2E Masterclass")).toBeVisible();
    await expect(page.getByText("Up next:")).toBeVisible();
    await expect(page.getByText("01 - Introduction to E2E Verification")).toBeVisible();
    await expect(page.getByText("(02:30)")).toBeVisible();

    // 4. Click Resume Learning and verify URL contains saved position timestamp parameter
    const resumeBtn = page.getByRole("link", { name: "Resume Learning" });
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    await page.waitForURL(/\/learning\/video\/VID_E2E_P01.*t=150/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "01 - Introduction to E2E Verification", level: 1 })).toBeVisible();

    // 5. Simulate 100% completion of both playlist videos
    await page.evaluate(async () => {
      // Complete Video 1 (600s / 600s)
      await fetch("http://localhost:8000/api/v1/learning/progress/video/VID_E2E_P01", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content_id: "VID_E2E_P01",
          content_type: "video",
          progress_seconds: 600,
          duration_seconds: 600,
        }),
      });
      // Complete Video 2 (1200s / 1200s)
      await fetch("http://localhost:8000/api/v1/learning/progress/video/VID_E2E_P02", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content_id: "VID_E2E_P02",
          content_type: "video",
          progress_seconds: 1200,
          duration_seconds: 1200,
        }),
      });
    });

    // 6. Return to playlist page and verify completion state
    await page.goto("/learning/playlist/PL_E2E_PLAYWRIGHT_COURSE");
    await page.waitForLoadState("domcontentloaded");

    // Verify "All 2 videos completed!"
    await expect(page.getByText("All 2 videos completed!")).toBeVisible();

    // Verify playlist items indicate Completed
    const completedBadges = page.getByText("Completed");
    await expect(completedBadges.first()).toBeVisible();

    // Verify completed plan banner, "Rewatch Course from Beginning", and "Start New Plan" button
    await expect(page.getByText("Playlist course completed")).toBeVisible();
    await expect(page.getByText("Rewatch Course from Beginning")).toBeVisible();
    const retakeBtn = page.getByRole("button", { name: "Start New Plan" });
    await expect(retakeBtn).toBeVisible();

    // 7. Retake course: click Start New Plan, pick date, and submit
    await retakeBtn.click();
    await expect(page.getByRole("heading", { name: "Plan your learning" })).toBeVisible();
    const createRetakePlanSubmit = page.getByRole("button", { name: "Create Learning Plan" });
    await expect(createRetakePlanSubmit).toBeVisible();
    await createRetakePlanSubmit.click();

    // 8. Verify the newly created retake plan is ACTIVE and not prematurely completed
    await expect(page.getByRole("heading", { name: "Learning Plan", level: 3 })).toBeVisible();
    await expect(page.getByText("Daily Target")).toBeVisible();

    // 9. Inspect Dashboard: new plan is active under Continue Learning, while historical completed count is preserved
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Continue Learning")).toBeVisible();
    await expect(page.getByText("Playwright E2E Masterclass")).toBeVisible();
    // Historical completion is preserved in Progress Summary
    await expect(page.getByText("Your Progress")).toBeVisible();
    await expect(page.getByText("Completed Plans")).toBeVisible();

    // 10. Verify Rewatch button on playlist page opens Video 1 cleanly
    await page.goto("/learning/playlist/PL_E2E_PLAYWRIGHT_COURSE");
    await page.waitForLoadState("domcontentloaded");
    const rewatchBtn = page.getByRole("link", { name: "Rewatch Course from Beginning" });
    await expect(rewatchBtn).toBeVisible();
    await rewatchBtn.click();
    await page.waitForURL(/\/learning\/video\/VID_E2E_P01\?playlistId=PL_E2E_PLAYWRIGHT_COURSE/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "01 - Introduction to E2E Verification", level: 1 })).toBeVisible();
  });

  test("Standalone video plan resume CTA correctly formats query string and navigates with timestamp", async ({ page }) => {
    const user = generateTestUser();
    await registerViaUi(page, user);

    // 1. Navigate to standalone video page
    await page.goto("/learning/video/VID_E2E_P01");
    await page.waitForLoadState("domcontentloaded");

    // 2. Create a direct learning plan for this single video
    const startPlanBtn = page.getByRole("button", { name: "Start Learning Plan" });
    await expect(startPlanBtn).toBeVisible();
    await startPlanBtn.click();

    const createPlanSubmit = page.getByRole("button", { name: "Create Learning Plan" });
    await expect(createPlanSubmit).toBeVisible();
    await createPlanSubmit.click();

    // 3. Save progress at 240 seconds without any playlist context
    await page.evaluate(async () => {
      await fetch("http://localhost:8000/api/v1/learning/progress/video/VID_E2E_P01", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content_id: "VID_E2E_P01",
          content_type: "video",
          progress_seconds: 240,
          duration_seconds: 600,
        }),
      });
    });

    // 4. Return to Dashboard and inspect Continue Learning
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Continue Learning")).toBeVisible();
    await expect(page.getByText("Video Plan")).toBeVisible();
    await expect(page.getByText("(04:00)")).toBeVisible();

    // 5. Click Resume Learning and verify the URL is valid with ?t=240 (and NOT broken &t=240)
    const resumeBtn = page.getByRole("link", { name: "Resume Learning" });
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    await page.waitForURL(/\/learning\/video\/VID_E2E_P01\?t=240/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "01 - Introduction to E2E Verification", level: 1 })).toBeVisible();
  });

  test("Search empty state displays clear guidance and allows retrying a search", async ({ page }) => {
    const user = generateTestUser();
    await registerViaUi(page, user);

    // Navigate to learning page with a query that has no results
    await page.goto("/learning?q=nonexistent_topic_xyz_12345");
    await page.waitForLoadState("domcontentloaded");

    // Verify understandable empty state
    await expect(page.getByText("No relevant results found")).toBeVisible();
    await expect(page.getByText("nonexistent_topic_xyz_12345")).toBeVisible();
    await expect(page.getByText("Try a different search term or check your spelling.")).toBeVisible();

    // Search bar is ready for new input
    const searchInput = page.getByPlaceholder("Search for a topic");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("playwright e2e");
    await page.getByRole("button", { name: "Find" }).click();

    await page.waitForURL(/\/learning\?q=playwright%20e2e/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Playwright E2E Masterclass" })).toBeVisible();
  });
});

