import { test, expect } from "@playwright/test";
import { generateTestUser, registerViaUi, enforceZeroLiveYouTubeQuota } from "./helpers";

test.describe("Playlist Continuity & Learning Plan Journey", () => {
  test.beforeEach(async ({ page }) => {
    await enforceZeroLiveYouTubeQuota(page);
  });

  test("Student creates a playlist plan, navigates video queue, and maintains plan context across direct refresh", async ({ page }) => {
    const user = generateTestUser();
    await registerViaUi(page, user);

    // 1. Search for learning content using seeded cache
    await page.goto("/learning?q=playwright%20e2e");
    await page.waitForLoadState("domcontentloaded");

    // Verify search results contain our seeded playlist
    const playlistCard = page.getByRole("heading", { name: "Playwright E2E Masterclass" });
    await expect(playlistCard).toBeVisible();

    // 2. Open the playlist detail page
    await playlistCard.click();
    await page.waitForURL(/\/learning\/playlist\/PL_E2E_PLAYWRIGHT_COURSE/, { timeout: 10000 });

    // Verify playlist details
    await expect(page.getByRole("heading", { name: "Playwright E2E Masterclass", level: 1 })).toBeVisible();
    await expect(page.getByText("Antigravity QA")).toBeVisible();
    await expect(page.getByText("01 - Introduction to E2E Verification")).toBeVisible();
    await expect(page.getByText("02 - Full Regression Testing")).toBeVisible();

    // 3. Create a learning plan for the playlist
    const startPlanBtn = page.getByRole("button", { name: "Start Learning Plan" });
    await expect(startPlanBtn).toBeVisible();
    await startPlanBtn.click();

    // Verify Learning Plan modal opened
    await expect(page.getByRole("heading", { name: "Plan your learning" })).toBeVisible();
    const createPlanSubmit = page.getByRole("button", { name: "Create Learning Plan" });
    await expect(createPlanSubmit).toBeVisible();
    await createPlanSubmit.click();

    // Verify plan creation success and active learning plan widget in sidebar
    await expect(page.getByRole("heading", { name: "Learning Plan", level: 3 })).toBeVisible();
    await expect(page.getByText("Daily Target")).toBeVisible();

    // 4. Navigate into Video 1
    const firstVideoLink = page.getByText("01 - Introduction to E2E Verification");
    await firstVideoLink.click();
    await page.waitForURL(/\/learning\/video\/VID_E2E_P01/, { timeout: 10000 });

    // 5. Verify video detail & playlist plan continuity
    await expect(page.getByRole("heading", { name: "01 - Introduction to E2E Verification", level: 1 })).toBeVisible();
    await expect(page.getByText("Back to Playwright E2E Masterclass")).toBeVisible();
    await expect(page.getByText("Video 1 of 2").first()).toBeVisible();
    await expect(page.getByText("Part of playlist plan:")).toBeVisible();

    // 6. Verify previous/next queue navigation
    const prevBtn = page.getByTestId("playlist-prev-btn");
    const nextBtn = page.getByTestId("playlist-next-btn");

    // Previous should be disabled on first video
    await expect(prevBtn).toBeDisabled();
    // Next should be enabled
    await expect(nextBtn).toBeEnabled();

    // Click Next to navigate to Video 2
    await nextBtn.click();
    await page.waitForURL(/\/learning\/video\/VID_E2E_P02/, { timeout: 10000 });

    // Verify on Video 2
    await expect(page.getByRole("heading", { name: "02 - Full Regression Testing", level: 1 })).toBeVisible();
    await expect(page.getByText("Video 2 of 2").first()).toBeVisible();
    await expect(page.getByText("Part of playlist plan:")).toBeVisible();

    // On last video, Next should be disabled
    const nextBtnV2 = page.getByTestId("playlist-next-btn");
    await expect(nextBtnV2).toBeDisabled();

    // 7. Direct URL refresh continuity
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "02 - Full Regression Testing", level: 1 })).toBeVisible();
    await expect(page.getByText("Back to Playwright E2E Masterclass")).toBeVisible();
    await expect(page.getByText("Video 2 of 2").first()).toBeVisible();
    await expect(page.getByText("Part of playlist plan:")).toBeVisible();
  });
});

