import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Editor gebruikt de centrale Engine-SDK-favicon", () => {
  assert.match(indexSource, /window\.LEERBOX_EDITOR_CONFIG\?\.apiBase/);
  assert.match(indexSource, /\/sdk\/brand\/favicon\.svg/);
  assert.match(indexSource, /data-leerpret-sdk-favicon/);
});
