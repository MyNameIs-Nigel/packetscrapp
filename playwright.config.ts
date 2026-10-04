import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:5173", browserName: "chromium" },
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
