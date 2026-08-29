import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../leerpret-sdk.js", import.meta.url), "utf8");

function bootstrap({ search = "", configured = "", stored = "" } = {}) {
  let scriptUrl = "";
  const window = {
    fetch: async () => ({ ok: true }),
    location: { search },
    LEERBOX_EDITOR_CONFIG: { apiBase: configured }
  };
  const context = {
    Headers,
    Promise,
    URLSearchParams,
    document: {
      createElement: () => ({}),
      head: { appendChild: element => { scriptUrl = element.src; } }
    },
    localStorage: { getItem: key => key === "leerbox-editor.apiBase" ? stored : null },
    window
  };
  vm.runInNewContext(source, context);
  return { apiBase: window.LeerpretSDKApiBase, scriptUrl };
}

test("één bootstrap resolveert en normaliseert de Editor-API-base in vaste prioriteit", () => {
  assert.deepEqual(
    bootstrap({
      search: "?api=https%3A%2F%2Fquery.example%2Fengine%2F",
      configured: "https://config.example/api",
      stored: "https://stored.example/api"
    }),
    {
      apiBase: "https://query.example/engine/api",
      scriptUrl: "https://query.example/engine/api/sdk/sdk-loader/loader.js?bypass-tunnel-reminder=true"
    }
  );
  assert.equal(
    bootstrap({ configured: "https://config.example/api/", stored: "https://stored.example/api" }).apiBase,
    "https://config.example/api"
  );
  assert.equal(
    bootstrap({ stored: "https://stored.example/root///" }).apiBase,
    "https://stored.example/root/api"
  );
});

test("alle Editor-consumers gebruiken uitsluitend de gepubliceerde API-base", () => {
  const consumers = ["engine-adapter.js", "editor-auth.js", "editor-chrome-boot.js", "index.html"]
    .map(name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8"))
    .join("\n");
  assert.match(consumers, /window\.LeerpretSDKApiBase/);
  assert.doesNotMatch(consumers, /parameters\.get\(["']api["']\)/);
  assert.doesNotMatch(consumers, /String\(cfg\.apiBase/);
  assert.doesNotMatch(consumers, /\/sdk\/editor-(?:shell|chrome)\/(?:css|template\.html)/);
});
