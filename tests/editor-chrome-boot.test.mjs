import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../editor-chrome-boot.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("bootstrap koppelt de geïnjecteerde chrome expliciet via de Engine-SDK", () => {
  assert.match(source, /loader\.load\("editor-chrome"\)/);
  assert.match(source, /loader\.fetchAsset\("editor-chrome", "template\.html"\)/);
  assert.match(source, /chrome\.wire\(node\)/);
  assert.doesNotMatch(source, /\/sdk\/editor-chrome\//);
  assert.doesNotMatch(source, /document\.createElement\("style"\)/);
  assert.doesNotMatch(source, /right:20px|left:14px/);
});

test("bootstrap bevat geen leerboxdata of Engine-beslislogica", () => {
  assert.doesNotMatch(source, /simulator\/datasets|leerbox_twins|fetch\([^)]*captures/);
});

test("bootstrap verbergt SDK-mountfouten niet", () => {
  assert.match(source, /console\.error\("LeerpretSDK editor-chrome kon niet worden gekoppeld\./);
  assert.match(source, /chrome\.wire\(mountedChromeNode\)/);
});

test("editorpagina gebruikt de actuele chrome-bootstrap cacheversie", () => {
  assert.match(indexSource, /editor-chrome-boot\.js\?v=manifest-loader-6/);
});

test("chrome mount uitsluitend na SDK-toestemming", () => {
  assert.match(source, /Promise\.resolve\(window\.LeerboxEditorAuthReady\)/);
  assert.match(source, /decision\.action !== "allow"/);
  assert.match(source, /return mountChrome\(\)/);
});
