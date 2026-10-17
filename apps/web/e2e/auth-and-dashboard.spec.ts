import { test, expect } from "@playwright/test";
import { generateTestUser, registerViaUi, loginViaUi, logoutViaUi, enforceZeroLiveYouTubeQuota } from "./helpers";

test.describe("Authentication & Dashboard Journey", () => {
  test.beforeEach(async ({ page }) => {
    await enforceZeroLiveYouTubeQuota(page);
  });

  test("User can register, see zero-value dashboard state, persist across reload, and log out cleanly", async ({ page }) => {
    const user = generateTestUser();

    // 1. Register a new student
    await registerViaUi(page, user);

    // 2. Dashboard loaded in authenticated state with genuine zero/empty values
    await expect(page).toHaveURL("/");
    
    // Continue Learning empty state
    await expect(page.getByText("Continue Learning")).toBeVisible();
    await expect(page.getByText("No active learning yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start Learning" })).toBeVisible();

    // Learning Summary empty state
    await expect(page.getByText("Learning Summary")).toBeVisible();
    await expect(page.getByText("No active plans")).toBeVisible();

    // Progress Summary zero streak
    await expect(page.getByText("Your Progress")).toBeVisible();
    await expect(page.getByText("0 Days")).toBeVisible();
    await expect(page.getByText("Current Study Streak")).toBeVisible();

    // 3. Page reload persistence (session cookie check)
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("No active learning yet")).toBeVisible();
    await expect(page.getByText("0 Days")).toBeVisible();

    // 4. Logout cleanly
    await logoutViaUi(page);
    await expect(page).toHaveURL(/\/login/);

    // 5. Unauthenticated dashboard inspection
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Sign in to track your learning")).toBeVisible();
    await expect(page.getByText("Sign in to track progress")).toBeVisible();
    await expect(page.getByText("Track streaks & milestones")).toBeVisible();

    // 6. Log back in with registered credentials
    await loginViaUi(page, user);
    await expect(page).toHaveURL("/");
    await expect(page.getByText("No active learning yet")).toBeVisible();
  });

  test("Login form sanitizes callbackUrl to prevent open redirects and honors safe internal paths", async ({ page }) => {
    const user = generateTestUser();
    await registerViaUi(page, user);
    await logoutViaUi(page);

    // 1. Attempt login with malicious open redirect callbackUrl
    await page.goto("/login?callbackUrl=https://malicious-external-site.com/steal-token");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    // Must be sanitized to "/" safely, not redirected to external domain
    await page.waitForURL("/", { timeout: 10000 });
    expect(page.url()).not.toContain("malicious");
    await expect(page).toHaveURL("/");

    // 2. Attempt login with protocol-relative open redirect callbackUrl (//evil.com)
    await logoutViaUi(page);
    await page.goto("/login?callbackUrl=//evil-domain.com/phish");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    await page.waitForURL("/", { timeout: 10000 });
    expect(page.url()).not.toContain("evil-domain");
    await expect(page).toHaveURL("/");

    // 3. Legitimate internal relative callbackUrl is honored
    await logoutViaUi(page);
    await page.goto("/login?callbackUrl=/learning");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    await page.waitForURL("/learning", { timeout: 10000 });
    await expect(page).toHaveURL("/learning");
  });

  test("Registration form sanitizes callbackUrl and honors safe internal paths", async ({ page }) => {
    const user = generateTestUser();

    // 1. Malicious open redirect callbackUrl on register
    await page.goto("/register?callbackUrl=https://attacker-steals-info.com");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#name", user.name);
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.fill("#confirmPassword", user.password);
    await page.click('button[type="submit"]');

    await page.waitForURL("/", { timeout: 10000 });
    expect(page.url()).not.toContain("attacker");
    await expect(page).toHaveURL("/");

    // 2. Legitimate relative callbackUrl on register
    await logoutViaUi(page);
    const user2 = generateTestUser();
    await page.goto("/register?callbackUrl=/learning");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#name", user2.name);
    await page.fill("#email", user2.email);
    await page.fill("#password", user2.password);
    await page.fill("#confirmPassword", user2.password);
    await page.click('button[type="submit"]');

    await page.waitForURL("/learning", { timeout: 10000 });
    await expect(page).toHaveURL("/learning");
  });

  test("Dashboard gracefully handles expired or invalid session cookies without broken error banners", async ({ page, context }) => {
    // Set an invalid/expired session cookie directly in the browser
    await context.addCookies([
      {
        name: "access_token",
        value: "expired.or.invalid.token.signature",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Must NOT show broken red error banners
    await expect(page.getByText("Unable to load summary right now")).not.toBeVisible();
    await expect(page.getByText("Unable to load recent activity")).not.toBeVisible();

    // Renders the clean unauthenticated preview state
    await expect(page.getByText("Sign in to track your learning")).toBeVisible();
    await expect(page.getByText("Sign in to track progress")).toBeVisible();
  });
});


