import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scriptSource = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("browsertab gebruikt de korte naam Leereditor", () => {
  assert.match(indexSource, /<title>Leereditor<\/title>/);
  assert.doesNotMatch(indexSource, /<title>Leerpretarchitect Editor<\/title>/);
});

test("simulatiepaneel heeft dezelfde inklapbediening als andere vensters", () => {
  assert.match(indexSource, /id="simulationPanelCloseButton"[^>]*data-workbench-close="build"/);
  assert.match(indexSource, /id="simulationPanelCloseButton"[^>]*>−<\/button>/);
  assert.match(scriptSource, /querySelectorAll\("\[data-workbench-close\]"\)/);
  assert.match(scriptSource, /activateWorkbenchView\(button\.dataset\.workbenchClose\)/);
});
