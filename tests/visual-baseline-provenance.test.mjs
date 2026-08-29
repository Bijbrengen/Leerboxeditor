import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ACTION_CATALOG_SCHEMA_VERSION,
  dynamicControlFamilies,
  postMessageContracts,
  scenarioCatalog,
  staticControlCatalog
} from "./visual/action-catalog.mjs";
import {
  BASELINE_PROVENANCE_SCHEMA_VERSION,
  BASELINE_SUITES,
  assertArtifactTreeMatchesProvenance,
  assertRequiredBaselineArtifacts,
  buildContractProvenance,
  collectBaselineArtifacts
} from "./visual/baseline-provenance.mjs";
import {
  OUTPUT_FINGERPRINT_CSS_PROPERTIES,
  OUTPUT_FINGERPRINT_SCHEMA_VERSION
} from "./visual/output-fingerprint.mjs";
import {
  SCREENSHOT_COMPARISON,
  SCREENSHOT_COMPARISON_SCHEMA_VERSION
} from "./visual/screenshot-comparison.mjs";

const visualRoot = new URL("visual/", import.meta.url);
const provenance = JSON.parse(readFileSync(new URL("baseline-provenance.json", visualRoot), "utf8"));
const artifactRoot = fileURLToPath(new URL(`__screenshots__/${provenance.platform}/`, visualRoot));

test("baselineprovenance hasht exact de volledige recursieve goldenboom", () => {
  assert.equal(provenance.schemaVersion, BASELINE_PROVENANCE_SCHEMA_VERSION);
  assert.match(provenance.editorCommit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.comparison.screenMaxDiffPixels, 45);
  assert.equal(provenance.comparison.pixelThreshold, 0.065);
  assert.equal(provenance.comparison.actionFingerprints, true);
  assert.equal(provenance.comparison.actionScreenshotSnapshots, true);
  assert.equal(provenance.platform, "win32");
  assert.deepEqual(provenance.suites, BASELINE_SUITES);

  const actual = assertArtifactTreeMatchesProvenance(artifactRoot, provenance.artifacts);
  assert.deepEqual(actual, provenance.artifacts);
  assert.ok(Object.keys(actual).every(name => name.includes("/")), "artefactsleutels zijn niet relatief aan suites");
  assert.ok(Object.keys(actual).some(name => name.endsWith(".png")), "PNG-goldens ontbreken");
});

test("baselineprovenance koppelt action-catalog en outputfingerprint aan versie en inhoud", () => {
  const expected = buildContractProvenance({
    actionCatalogSchemaVersion: ACTION_CATALOG_SCHEMA_VERSION,
    actionCatalog: {
      scenarios: scenarioCatalog,
      staticControls: staticControlCatalog,
      dynamicFamilies: dynamicControlFamilies,
      postMessages: postMessageContracts
    },
    actionCatalogSource: readFileSync(new URL("action-catalog.mjs", visualRoot)),
    outputFingerprintSchemaVersion: OUTPUT_FINGERPRINT_SCHEMA_VERSION,
    outputFingerprintCssProperties: OUTPUT_FINGERPRINT_CSS_PROPERTIES,
    outputFingerprintSource: readFileSync(new URL("output-fingerprint.mjs", visualRoot)),
    screenshotComparisonSchemaVersion: SCREENSHOT_COMPARISON_SCHEMA_VERSION,
    screenshotComparison: SCREENSHOT_COMPARISON,
    screenshotComparisonSource: readFileSync(new URL("screenshot-comparison.mjs", visualRoot))
  });
  assert.deepEqual(provenance.contracts, expected);
  assert.equal(provenance.contracts.actionCatalog.schemaVersion, 1);
  assert.equal(provenance.contracts.outputFingerprint.schemaVersion, 3);
  assert.equal(provenance.contracts.screenshotComparison.schemaVersion, 1);
  assert.match(provenance.contracts.actionCatalog.sha256, /^[0-9a-f]{64}$/);
  assert.match(provenance.contracts.outputFingerprint.sha256, /^[0-9a-f]{64}$/);
  assert.match(provenance.contracts.screenshotComparison.sourceSha256, /^[0-9a-f]{64}$/);
});

test("baselineprovenance bevat het Engine-manifest en SHA-384-componentintegriteit", () => {
  assert.match(provenance.engineManifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(provenance.engineManifest.sha256, /^[0-9a-f]{64}$/);
  ["sdk-loader", "editor-shell", "editor-chrome", "lego-flow-map", "lego-spatial"].forEach(name => {
    const integrities = Object.values(provenance.engineManifest.components[name]?.integrity || {});
    assert.ok(integrities.length > 0, `${name} heeft geen vastgelegde assets`);
    assert.ok(integrities.every(value => /^sha384-/.test(value)), `${name} heeft ongeldige integriteit`);
  });
});

test("recursieve artefactinventaris leest JSON-records en PNG-maatvoering", t => {
  const root = mkdtempSync(path.join(tmpdir(), "leerbox-baseline-provenance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, "editor-action-parity.spec.mjs", "nested");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, "actions.json"), "[{\"action\":\"fixture\"}]\n");
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(320, 16);
  png.writeUInt32BE(200, 20);
  writeFileSync(path.join(nested, "fixture.png"), png);
  writeFileSync(path.join(nested, "extra.bin"), Buffer.from([1, 2, 3]));

  const artifacts = collectBaselineArtifacts(root);
  assert.deepEqual(Object.keys(artifacts), [
    "editor-action-parity.spec.mjs/nested/actions.json",
    "editor-action-parity.spec.mjs/nested/extra.bin",
    "editor-action-parity.spec.mjs/nested/fixture.png"
  ]);
  assert.equal(artifacts["editor-action-parity.spec.mjs/nested/actions.json"].records, 1);
  assert.equal(artifacts["editor-action-parity.spec.mjs/nested/extra.bin"].bytes, 3);
  assert.equal(artifacts["editor-action-parity.spec.mjs/nested/fixture.png"].width, 320);
  assert.equal(artifacts["editor-action-parity.spec.mjs/nested/fixture.png"].height, 200);
});

test("goedgekeurde update vereist screen-PNG en JSON voor beide actionsuites", () => {
  assert.throws(() => assertRequiredBaselineArtifacts({
    "editor-screen-parity.spec.mjs/screen.png": { sha256: "a" },
    "editor-action-parity.spec.mjs/action.png": { sha256: "b" }
  }), /verplichte \.json-golden/);
  assert.throws(() => assertRequiredBaselineArtifacts({
    "editor-screen-parity.spec.mjs/screen.png": { sha256: "a" },
    "editor-action-parity.spec.mjs/actions.json": { sha256: "b" },
    "editor-agent-bucket-action-parity.spec.mjs/action.png": { sha256: "c" }
  }), /editor-agent-bucket-action-parity\.spec\.mjs heeft geen verplichte \.json-golden/);
  assert.throws(() => assertRequiredBaselineArtifacts({
    "editor-screen-parity.spec.mjs/screen.png": { sha256: "a" },
    "editor-action-parity.spec.mjs/actions.json": { sha256: "b" },
    "editor-agent-bucket-action-parity.spec.mjs/actions.json": { sha256: "c" }
  }), /editor-action-parity\.spec\.mjs heeft geen verplichte \.png-golden/);
  assert.doesNotThrow(() => assertRequiredBaselineArtifacts({
    "editor-screen-parity.spec.mjs/screen.png": { sha256: "a" },
    "editor-action-parity.spec.mjs/actions.json": { sha256: "b" },
    "editor-action-parity.spec.mjs/action.png": { sha256: "c" },
    "editor-agent-bucket-action-parity.spec.mjs/actions.json": { sha256: "d" },
    "editor-agent-bucket-action-parity.spec.mjs/action.png": { sha256: "e" }
  }));
});
