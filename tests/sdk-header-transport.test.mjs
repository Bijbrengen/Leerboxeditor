import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sdkSource = readFileSync(new URL("../leerpret-sdk.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Editor-transport behoudt Headers van de centrale SDK-client", () => {
  assert.match(sdkSource, /new Headers\(opts\.headers \|\| \{\}\)/);
  assert.match(sdkSource, /headers\.set\("bypass-tunnel-reminder", "true"\)/);
  assert.doesNotMatch(sdkSource, /Object\.assign\(\{ "bypass-tunnel-reminder"/);
});

test("Editor laadt de gecorrigeerde SDK-transportversie", () => {
  assert.match(indexSource, /leerpret-sdk\.js\?v=4/);
});
