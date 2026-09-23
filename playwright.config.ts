import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3317";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3317",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_USE_MOCK_API: "true",
      AI_ENABLED: "false",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
    },
  },
});
