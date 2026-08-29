import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  dynamicControlFamilies,
  fingerprintHtmlControls,
  postMessageContracts,
  scenarioCatalog,
  staticControlCatalog
} from "./visual/action-catalog.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = path.resolve(process.env.LEERPRET_ENGINE_ROOT || path.join(repoRoot, "..", "LeerpretEngine"));
const indexPath = path.join(repoRoot, "index.html");
const scriptPath = path.join(repoRoot, "script.js");
const chromeTemplatePath = path.join(engineRoot, "app", "sdk", "components", "editor-chrome.template.html");
const chromeScriptPath = path.join(engineRoot, "app", "sdk", "components", "editor-chrome.js");
const libraryScriptPath = path.join(engineRoot, "app", "sdk", "components", "lego-library-browser.mount.js");

function counts(values) {
  const result = new Map();
  values.forEach(value => result.set(value, (result.get(value) || 0) + 1));
  return result;
}

function sortedEntries(map) {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function assertKnownScenarios(record, label) {
  if (record.historicalNoOp) {
    assert.equal(record.scenarioIds, undefined, `${label}: no-op mag niet tegelijk scenarioIds hebben`);
    assert.ok(record.historicalNoOp.length >= 20, `${label}: historische no-op mist een concrete reden`);
    return;
  }
  assert.ok(Array.isArray(record.scenarioIds) && record.scenarioIds.length > 0, `${label}: geen scenario of historische no-op`);
  record.scenarioIds.forEach(id => assert.ok(scenarioCatalog[id], `${label}: onbekend scenario '${id}'`));
}

test("iedere statische index- en Engine-chromecontrol staat gesloten in de actiecatalogus", () => {
  assert.ok(existsSync(chromeTemplatePath),
    `Engine editor-chrome-template ontbreekt; zet LEERPRET_ENGINE_ROOT (gezocht: ${chromeTemplatePath})`);
  const sources = new Map([
    ["index.html", readFileSync(indexPath, "utf8")],
    ["engine:editor-chrome.template.html", readFileSync(chromeTemplatePath, "utf8")]
  ]);

  for (const [source, html] of sources) {
    const actual = counts(fingerprintHtmlControls(html).map(control => control.fingerprint));
    const expectedRecords = staticControlCatalog.filter(control => control.source === source);
    expectedRecords.forEach(control => assertKnownScenarios(control, `${source} ${control.selector}`));
    const expected = counts(expectedRecords.flatMap(control =>
      Array.from({ length: control.expectedCount }, () => control.fingerprint)));
    assert.deepEqual(
      sortedEntries(actual),
      sortedEntries(expected),
      `${source} bevat een nieuwe, verwijderde, dubbele of nog niet aan een scenario gekoppelde control`
    );
  }
});

test("de catalogus bevat geen verweesde of dubbel geregistreerde statische controls", () => {
  const sources = new Set(["index.html", "engine:editor-chrome.template.html"]);
  const seen = new Set();
  staticControlCatalog.forEach(control => {
    assert.ok(sources.has(control.source), `onbekende statische bron ${control.source}`);
    assert.match(control.selector, /\S/, `${control.fingerprint}: lege selector`);
    assert.ok(Number.isInteger(control.expectedCount) && control.expectedCount > 0, `${control.fingerprint}: ongeldige count`);
    assertKnownScenarios(control, `${control.source} ${control.selector}`);
    const key = `${control.source}\0${control.fingerprint}`;
    assert.ok(!seen.has(key), `dubbele catalogusregistratie: ${control.source} ${control.fingerprint}`);
    seen.add(key);
  });
});

test("alle dynamische controlfamilies hebben bronbewijs en scenario-dekking", () => {
  assert.ok(existsSync(chromeScriptPath), `Engine editor-chrome-component ontbreekt: ${chromeScriptPath}`);
  assert.ok(existsSync(libraryScriptPath), `Engine bibliotheekcomponent ontbreekt: ${libraryScriptPath}`);
  const sources = {
    "script.js": readFileSync(scriptPath, "utf8"),
    "editor-chrome.js": readFileSync(chromeScriptPath, "utf8"),
    "lego-library-browser.mount.js": readFileSync(libraryScriptPath, "utf8"),
    "lego-flow-map": readFileSync(scriptPath, "utf8")
  };
  const ids = new Set();
  dynamicControlFamilies.forEach(family => {
    assert.ok(!ids.has(family.id), `dubbele dynamische familie ${family.id}`);
    ids.add(family.id);
    assertKnownScenarios(family, `dynamische familie ${family.id}`);
    assert.match(family.selector, /\S/, `${family.id}: lege selector`);
    assert.ok(sources[family.source]?.includes(family.evidence),
      `${family.id}: bronbewijs '${family.evidence}' ontbreekt in ${family.source}`);
  });

  // Letterlijke dynamische form-controls in script.js zijn een gesloten set.
  // Een nieuw markup-control faalt hier totdat de familie hierboven is toegevoegd.
  const localSource = sources["script.js"];
  const literalMarkers = [...localSource.matchAll(/<(button|input|select|textarea|a)\b[^>]*>/g)]
    .map(match => {
      const markup = match[0];
      return dynamicControlFamilies.some(family => family.source === "script.js" && markup.includes(family.evidence))
        ? "known"
        : markup;
    })
    .filter(marker => marker !== "known");
  assert.deepEqual(literalMarkers, [], `onbekende dynamische HTML-controls in script.js:\n${literalMarkers.join("\n")}`);

  const createdInteractiveTags = [...localSource.matchAll(/document\.createElement\("(button|input|select|textarea)"\)/g)]
    .map(match => match[1]).sort();
  assert.deepEqual(createdInteractiveTags, ["button", "input"],
    "Nieuwe programmatig gemaakte controls moeten als dynamische familie worden gecatalogiseerd");
});

test("de 9 inkomende en 6 uitgaande postMessage-contracten zijn exact gecatalogiseerd", () => {
  const source = readFileSync(scriptPath, "utf8");
  const inboundInCode = [...source.matchAll(/event\.data\?\.type\s*===\s*"([^"]+)"/g)].map(match => match[1]);
  const outboundInCode = [...source.matchAll(/window\.parent\.postMessage\s*\(\s*\{\s*type:\s*"([^"]+)"/g)]
    .map(match => match[1]);
  const uniqueOutbound = [...new Set(outboundInCode)];

  assert.equal(postMessageContracts.inbound.length, 9);
  assert.equal(postMessageContracts.outbound.length, 6);
  postMessageContracts.inbound.forEach(contract => assertKnownScenarios(contract, `inbound ${contract.type}`));
  postMessageContracts.outbound.forEach(contract => assertKnownScenarios(contract, `outbound ${contract.type}`));
  assert.deepEqual(inboundInCode, postMessageContracts.inbound.map(contract => contract.type));
  assert.deepEqual(uniqueOutbound, postMessageContracts.outbound.map(contract => contract.type));
});
