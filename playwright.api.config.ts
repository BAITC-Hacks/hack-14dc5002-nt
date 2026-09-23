import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/http",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3318" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3318",
    url: "http://127.0.0.1:3318/api/catalog",
    reuseExistingServer: false,
    timeout: 60000,
    env: { NEXT_PUBLIC_USE_MOCK_API: "false", AI_ENABLED: "false", OPENAI_API_KEY: "", OPENAI_MODEL: "" },
  },
});
