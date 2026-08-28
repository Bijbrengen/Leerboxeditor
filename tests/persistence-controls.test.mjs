import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scriptSource = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("herstelpunten zijn standaard uitgeschakeld zonder geselecteerde leerbox", () => {
  assert.match(indexSource, /id="historyButton"[^>]*disabled/);
  assert.doesNotMatch(indexSource, /id="autosaveStatus"/);
  assert.match(scriptSource, /historyButton\.disabled = !hasSelectedLeerbox/);
});

test("geschiedenis wordt nooit zonder leerbox-id opgevraagd", () => {
  assert.match(scriptSource, /if \(!selectedLeerboxId\) \{\s*paneel\.hidden = true;\s*return;/);
  assert.doesNotMatch(scriptSource, /setAutosaveStatus/);
});
