import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../runtime-config.js", import.meta.url), "utf8");

function configFor(hostname) {
  const context = { window: { location: { hostname } } };
  vm.runInNewContext(source, context);
  return context.window.LEERBOX_EDITOR_CONFIG;
}

test("de Editor kiest per host lokale of productie-endpoints", () => {
  const local = configFor("127.0.0.1");
  assert.equal(local.apiBase, "http://127.0.0.1:47111/api");
  assert.equal(local.editorUrl, "http://127.0.0.1:47114/");

  const production = configFor("bijbrengen.github.io");
  assert.equal(production.apiBase, "https://api.leerpretpark.nl/api");
  assert.equal(production.editorUrl, "https://bijbrengen.github.io/Leerboxeditor/");
  assert.equal(production.dashboardUrl, "https://bijbrengen.github.io/LeerpretDashboard/");
  assert.equal(production.learngameOmUrl, "https://bijbrengen.github.io/Learngame-Operations-Management/");
  assert.doesNotMatch(source, /trycloudflare/i);
});
