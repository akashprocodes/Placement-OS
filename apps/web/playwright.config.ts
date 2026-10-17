import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT || "3002";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "cd ../../backend && DATABASE_URL=\"postgresql+asyncpg://placement_os:placement_os_dev@localhost:5434/test_placement_os\" .venv/bin/uvicorn app.main:app --port 8000 --host 127.0.0.1",
      url: "http://127.0.0.1:8000/docs",
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        DATABASE_URL: "postgresql+asyncpg://placement_os:placement_os_dev@localhost:5434/test_placement_os",
      },
    },
    {
      command: `pnpm dev --port ${PORT}`,
      url: `${BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});

