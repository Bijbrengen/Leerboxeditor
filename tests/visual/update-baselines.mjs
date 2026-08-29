import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ACTION_CATALOG_SCHEMA_VERSION,
  dynamicControlFamilies,
  postMessageContracts,
  scenarioCatalog,
  staticControlCatalog
} from "./action-catalog.mjs";
import {
  BASELINE_PROVENANCE_SCHEMA_VERSION,
  BASELINE_SUITES,
  assertRequiredBaselineArtifacts,
  buildContractProvenance,
  collectBaselineArtifacts
} from "./baseline-provenance.mjs";
import {
  OUTPUT_FINGERPRINT_CSS_PROPERTIES,
  OUTPUT_FINGERPRINT_SCHEMA_VERSION
} from "./output-fingerprint.mjs";
import {
  SCREENSHOT_COMPARISON,
  SCREENSHOT_COMPARISON_SCHEMA_VERSION
} from "./screenshot-comparison.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const currentUrl = new URL(process.env.LEERBOX_EDITOR_URL || "http://127.0.0.1:47114/");
const legacyValue = process.env.LEERBOX_EDITOR_TEST_URL;
const baselineRef = process.env.LEERBOX_EDITOR_BASELINE_REF || "";

function refuse(message) {
  console.error(`Baseline-update geweigerd: ${message}`);
  process.exit(2);
}

if (process.platform !== "win32") refuse("de vastgelegde goldens zijn Windows/Chromium-specifiek.");
if (process.env.LEERBOX_EDITOR_LEGACY_BASELINE !== "1") {
  refuse("zet LEERBOX_EDITOR_LEGACY_BASELINE=1 voor een historische Editor.");
}
if (process.env.LEERBOX_EDITOR_APPROVE_BASELINE_UPDATE !== "1") {
  refuse("zet LEERBOX_EDITOR_APPROVE_BASELINE_UPDATE=1 als expliciete goedkeuring.");
}
if (!legacyValue) refuse("LEERBOX_EDITOR_TEST_URL ontbreekt.");
const legacyUrl = new URL(legacyValue);
if (legacyUrl.origin === currentUrl.origin) refuse("de historische en huidige Editor-origin mogen niet gelijk zijn.");
if (!/^[0-9a-f]{40}$/i.test(baselineRef)) refuse("LEERBOX_EDITOR_BASELINE_REF moet een volledige Git-commit zijn.");

const resultsDir = path.join(root, "test-results");
const manifestPath = path.join(resultsDir, "baseline-engine-manifest.json");
mkdirSync(resultsDir, { recursive: true });
if (existsSync(manifestPath)) unlinkSync(manifestPath);
const cliPath = path.join(root, "node_modules", "@playwright", "test", "cli.js");
if (!existsSync(cliPath)) refuse("@playwright/test ontbreekt; voer eerst npm install uit.");

const run = spawnSync(process.execPath, [
  cliPath,
  "test",
  "tests/visual/editor-screen-parity.spec.mjs",
  "tests/visual/editor-action-parity.spec.mjs",
  "tests/visual/editor-agent-bucket-action-parity.spec.mjs",
  "--update-snapshots"
], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    LEERBOX_EDITOR_ACTION_SMOKE: "0",
    LEERBOX_EDITOR_BASELINE_MANIFEST_OUT: manifestPath
  }
});
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
if (!existsSync(manifestPath)) refuse("de test heeft geen Engine-manifest voor provenance vastgelegd.");

const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const artifactRoot = path.join(root, "tests", "visual", "__screenshots__", process.platform);
const artifacts = collectBaselineArtifacts(artifactRoot);
try {
  assertRequiredBaselineArtifacts(artifacts);
} catch (error) {
  refuse(error.message);
}
const relevantComponents = [
  "sdk-loader",
  "api-client",
  "auth-client",
  "editor-shell",
  "editor-chrome",
  "lego-flow-map",
  "lego-spatial"
];
const packageLock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const contracts = buildContractProvenance({
  actionCatalogSchemaVersion: ACTION_CATALOG_SCHEMA_VERSION,
  actionCatalog: {
    scenarios: scenarioCatalog,
    staticControls: staticControlCatalog,
    dynamicFamilies: dynamicControlFamilies,
    postMessages: postMessageContracts
  },
  actionCatalogSource: readFileSync(path.join(root, "tests", "visual", "action-catalog.mjs")),
  outputFingerprintSchemaVersion: OUTPUT_FINGERPRINT_SCHEMA_VERSION,
  outputFingerprintCssProperties: OUTPUT_FINGERPRINT_CSS_PROPERTIES,
  outputFingerprintSource: readFileSync(path.join(root, "tests", "visual", "output-fingerprint.mjs")),
  screenshotComparisonSchemaVersion: SCREENSHOT_COMPARISON_SCHEMA_VERSION,
  screenshotComparison: SCREENSHOT_COMPARISON,
  screenshotComparisonSource: readFileSync(path.join(root, "tests", "visual", "screenshot-comparison.mjs"))
});
const provenance = {
  schemaVersion: BASELINE_PROVENANCE_SCHEMA_VERSION,
  capturedAt: new Date().toISOString(),
  platform: process.platform,
  editorCommit: baselineRef.toLowerCase(),
  playwrightVersion: packageLock.packages["node_modules/@playwright/test"].version,
  comparison: {
    screenMaxDiffPixels: SCREENSHOT_COMPARISON.maxDiffPixels,
    pixelThreshold: SCREENSHOT_COMPARISON.threshold,
    normalizedTestFonts: true,
    actionFingerprints: true,
    actionScreenshotSnapshots: true
  },
  suites: BASELINE_SUITES,
  contracts,
  engineManifest: {
    url: `${String(process.env.LEERPRET_API_URL || "http://127.0.0.1:47111/api").replace(/\/+$/, "")}/sdk/manifest.json`,
    version: manifest.version,
    sha256: crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    components: Object.fromEntries(relevantComponents
      .filter(name => manifest.components?.[name])
      .map(name => [name, { integrity: manifest.components[name].integrity || {} }]))
  },
  artifacts
};
writeFileSync(
  path.join(root, "tests", "visual", "baseline-provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
  "utf8"
);
