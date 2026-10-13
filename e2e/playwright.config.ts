import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("E2E_BASE_URL is not set (for example http://app:8000).");
}

export default defineConfig({
  testDir: "./tests",
  // Specs share one database; they are written to be non-destructive (see README.md).
  workers: 1,
  fullyParallel: false,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "en-US",
    timezoneId: "America/New_York",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
