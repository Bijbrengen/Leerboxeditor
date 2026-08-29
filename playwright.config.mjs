import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { SCREENSHOT_COMPARISON } from "./tests/visual/screenshot-comparison.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const editorUrl = process.env.LEERBOX_EDITOR_URL || "http://127.0.0.1:47114/";
const testUrl = process.env.LEERBOX_EDITOR_TEST_URL || editorUrl;
const apiBase = (process.env.LEERPRET_API_URL || "http://127.0.0.1:47111/api").replace(/\/+$/, "");
const engineRoot = path.resolve(process.env.LEERPRET_ENGINE_ROOT || path.join(root, "..", "LeerpretEngine"));
const outputDir = path.resolve(root, process.env.LEERBOX_EDITOR_TEST_OUTPUT_DIR || "test-results");
const useExistingEngine = process.env.LEERPRET_USE_EXISTING_ENGINE === "1";
const editorEndpoint = new URL(editorUrl);
const engineEndpoint = new URL(apiBase);

if (process.platform !== "win32") {
  throw new Error("De pixel-exacte LeerboxEditor-goldens zijn voor win32 vastgelegd; voer deze suite op Windows uit.");
}
if (!useExistingEngine && !fs.existsSync(path.join(engineRoot, "app", "main.py"))) {
  throw new Error(`LeerpretEngine ontbreekt onder ${engineRoot}; stel LEERPRET_ENGINE_ROOT in.`);
}
if (!["127.0.0.1", "localhost", "::1"].includes(editorEndpoint.hostname) || !editorEndpoint.port) {
  throw new Error("LEERBOX_EDITOR_URL moet voor lokale Playwrighttests een expliciete localhostpoort bevatten.");
}
if (!["127.0.0.1", "localhost", "::1"].includes(engineEndpoint.hostname) || !engineEndpoint.port) {
  throw new Error("LEERPRET_API_URL moet voor lokale Playwrighttests een expliciete localhostpoort bevatten.");
}

const webServer = [
  {
    command: `python -m http.server ${editorEndpoint.port} --bind ${editorEndpoint.hostname}`,
    cwd: root,
    url: editorUrl,
    reuseExistingServer: false,
    timeout: 15_000
  }
];

if (!useExistingEngine) {
  webServer.unshift({
    command: `python -m uvicorn app.main:app --host ${engineEndpoint.hostname} --port ${engineEndpoint.port}`,
    cwd: engineRoot,
    url: `${engineEndpoint.origin}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      LEERBOX_EDITOR_URL: editorUrl.replace(/\/$/, "")
    }
  });
}

export default defineConfig({
  testDir: "./tests/visual",
  outputDir,
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}",
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      ...SCREENSHOT_COMPARISON,
      scale: "css"
    }
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: testUrl,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
    }
  ],
  webServer
});
