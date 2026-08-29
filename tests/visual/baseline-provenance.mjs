import crypto from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const BASELINE_PROVENANCE_SCHEMA_VERSION = 5;
export const BASELINE_SUITES = Object.freeze({
  "editor-screen-parity.spec.mjs": Object.freeze({
    artifactExtensions: Object.freeze([".png"]),
    requiredExtensions: Object.freeze([".png"])
  }),
  "editor-action-parity.spec.mjs": Object.freeze({
    artifactExtensions: Object.freeze([".json", ".png"]),
    requiredExtensions: Object.freeze([".json", ".png"])
  }),
  "editor-agent-bucket-action-parity.spec.mjs": Object.freeze({
    artifactExtensions: Object.freeze([".json", ".png"]),
    requiredExtensions: Object.freeze([".json", ".png"])
  })
});

export function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortObject(value[key])]));
}

export function stableJson(value) {
  return JSON.stringify(sortObject(value));
}

function artifactMetadata(filePath) {
  const bytes = readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const metadata = {
    extension,
    bytes: bytes.length,
    sha256: sha256Hex(bytes)
  };
  if (extension === ".png") {
    if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
      throw new Error(`Ongeldige PNG-golden: ${filePath}`);
    }
    metadata.width = bytes.readUInt32BE(16);
    metadata.height = bytes.readUInt32BE(20);
  } else if (extension === ".json") {
    const parsed = JSON.parse(bytes.toString("utf8"));
    metadata.jsonKind = Array.isArray(parsed) ? "array" : typeof parsed;
    if (Array.isArray(parsed)) metadata.records = parsed.length;
    if (parsed && typeof parsed === "object" && Number.isInteger(parsed.schemaVersion)) {
      metadata.schemaVersion = parsed.schemaVersion;
    }
  }
  return metadata;
}

/** Hash ieder bestand onder het platformgoldenpad, met stabiele POSIX-sleutels. */
export function collectBaselineArtifacts(root) {
  if (!existsSync(root)) return {};
  const files = [];
  const visit = directory => {
    readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (entry.isFile()) files.push(target);
      });
  };
  visit(root);
  return Object.fromEntries(files.map(filePath => [
    path.relative(root, filePath).split(path.sep).join("/"),
    artifactMetadata(filePath)
  ]));
}

export function assertRequiredBaselineArtifacts(artifacts) {
  Object.entries(BASELINE_SUITES).forEach(([suite, contract]) => {
    const suiteArtifacts = Object.keys(artifacts).filter(name => name.startsWith(`${suite}/`));
    if (!suiteArtifacts.length) throw new Error(`${suite} heeft geen gegenereerde goldens.`);
    contract.requiredExtensions.forEach(extension => {
      if (!suiteArtifacts.some(name => path.extname(name).toLowerCase() === extension)) {
        throw new Error(`${suite} heeft geen verplichte ${extension}-golden.`);
      }
    });
  });
}

export function buildContractProvenance({
  actionCatalogSchemaVersion,
  actionCatalog,
  actionCatalogSource,
  outputFingerprintSchemaVersion,
  outputFingerprintCssProperties,
  outputFingerprintSource,
  screenshotComparisonSchemaVersion,
  screenshotComparison,
  screenshotComparisonSource
}) {
  const actionContract = sortObject(actionCatalog);
  const fingerprintContract = {
    cssProperties: [...outputFingerprintCssProperties]
  };
  return {
    actionCatalog: {
      schemaVersion: actionCatalogSchemaVersion,
      sha256: sha256Hex(stableJson(actionContract)),
      sourceSha256: sha256Hex(actionCatalogSource),
      scenarios: Object.keys(actionContract.scenarios || {}).length,
      staticControls: actionContract.staticControls?.length || 0,
      dynamicFamilies: actionContract.dynamicFamilies?.length || 0,
      inboundMessages: actionContract.postMessages?.inbound?.length || 0,
      outboundMessages: actionContract.postMessages?.outbound?.length || 0
    },
    outputFingerprint: {
      schemaVersion: outputFingerprintSchemaVersion,
      sha256: sha256Hex(stableJson(fingerprintContract)),
      sourceSha256: sha256Hex(outputFingerprintSource),
      cssProperties: outputFingerprintCssProperties.length
    },
    screenshotComparison: {
      schemaVersion: screenshotComparisonSchemaVersion,
      algorithm: "playwright-pixelmatch",
      settings: { ...screenshotComparison },
      sourceSha256: sha256Hex(screenshotComparisonSource)
    }
  };
}

export function assertArtifactTreeMatchesProvenance(root, recordedArtifacts) {
  const actual = collectBaselineArtifacts(root);
  const actualNames = Object.keys(actual).sort();
  const recordedNames = Object.keys(recordedArtifacts || {}).sort();
  if (stableJson(actualNames) !== stableJson(recordedNames)) {
    throw new Error("Provenance bevat niet exact alle recursieve baselineartefacten.");
  }
  actualNames.forEach(name => {
    if (!recordedArtifacts[name] || actual[name].sha256 !== recordedArtifacts[name].sha256) {
      throw new Error(`Baselineartefact wijkt af van provenance: ${name}`);
    }
  });
  return actual;
}
