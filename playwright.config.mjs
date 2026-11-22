import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:4173";
const mode = process.env.TIMEANDATE_TEST_MODE === "native" ? "native" : "production";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: origin, browserName: "chromium" },
  webServer: {
    command: `npm run preview -- --mode ${mode} --host 127.0.0.1 --port 4173 --strictPort`,
    url: origin,
  },
});
