import { Page } from "@playwright/test";

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function generateTestUser(): TestUser {
  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return {
    name: `Student QA ${uniqueId}`,
    email: `e2e_student_${uniqueId}@example.com`,
    password: "TestPassword123!",
  };
}

/**
 * Ensures that no browser requests ever leak out to the real YouTube/Google API.
 */
export async function enforceZeroLiveYouTubeQuota(page: Page) {
  await page.route("https://www.googleapis.com/**", (route) => {
    return route.abort();
  });
}

/**
 * Register a user through the UI and verify navigation to dashboard.
 */
export async function registerViaUi(page: Page, user: TestUser) {
  await enforceZeroLiveYouTubeQuota(page);
  await page.goto("/register");
  await page.waitForLoadState("domcontentloaded");

  await page.fill("#name", user.name);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.fill("#confirmPassword", user.password);

  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 10000 });
}

/**
 * Login a user through the UI and verify navigation to dashboard.
 */
export async function loginViaUi(page: Page, user: TestUser) {
  await enforceZeroLiveYouTubeQuota(page);
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill("#email", user.email);
  await page.fill("#password", user.password);

  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 10000 });
}

/**
 * Log out cleanly and verify redirect to /login.
 */
export async function logoutViaUi(page: Page) {
  await page.goto("/logout");
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

