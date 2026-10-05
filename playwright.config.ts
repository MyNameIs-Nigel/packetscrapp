import { defineConfig } from "@playwright/test";

// Local Chromium builds that differ from the pinned Playwright revision can be used
// by pointing PACKET_CHROMIUM_EXECUTABLE at them. CI installs the pinned browsers.
const chromiumExecutable = process.env.PACKET_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "tests/e2e",
  // One shared game server serves every test, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: chromiumExecutable
          ? { executablePath: chromiumExecutable }
          : {},
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: [
    {
      command:
        "PACKET_ENV=local PACKET_REGION=local PACKET_HOST=127.0.0.1 PACKET_PORT=2567 node dist/server/server.mjs",
      url: "http://127.0.0.1:2567/health",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js preview --config client/vite.config.ts --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
});
