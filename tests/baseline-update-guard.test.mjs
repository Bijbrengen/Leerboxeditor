import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const updater = fileURLToPath(new URL("visual/update-baselines.mjs", import.meta.url));

test("historische goldens kunnen niet zonder expliciete toestemming worden overschreven", () => {
  const env = { ...process.env };
  delete env.LEERBOX_EDITOR_LEGACY_BASELINE;
  delete env.LEERBOX_EDITOR_TEST_URL;
  delete env.LEERBOX_EDITOR_BASELINE_REF;
  delete env.LEERBOX_EDITOR_APPROVE_BASELINE_UPDATE;
  const result = spawnSync(process.execPath, [updater], { env, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Baseline-update geweigerd/);
});

test("baseline-updater vereist een andere historische origin en volledige commit", {
  skip: process.platform !== "win32" ? "golden-updater is bewust Windows-specifiek" : false
}, () => {
  const common = {
    ...process.env,
    LEERBOX_EDITOR_LEGACY_BASELINE: "1",
    LEERBOX_EDITOR_APPROVE_BASELINE_UPDATE: "1",
    LEERBOX_EDITOR_URL: "http://127.0.0.1:47114/",
    LEERBOX_EDITOR_TEST_URL: "http://127.0.0.1:47114/"
  };
  const sameOrigin = spawnSync(process.execPath, [updater], {
    env: { ...common, LEERBOX_EDITOR_BASELINE_REF: "a".repeat(40) },
    encoding: "utf8"
  });
  assert.equal(sameOrigin.status, 2);
  assert.match(sameOrigin.stderr, /historische en huidige Editor-origin mogen niet gelijk zijn/);

  const invalidRef = spawnSync(process.execPath, [updater], {
    env: {
      ...common,
      LEERBOX_EDITOR_TEST_URL: "http://127.0.0.1:47115/",
      LEERBOX_EDITOR_BASELINE_REF: "niet-een-commit"
    },
    encoding: "utf8"
  });
  assert.equal(invalidRef.status, 2);
  assert.match(invalidRef.stderr, /volledige Git-commit/);
});

test("baseline-updater vernieuwt alle paritysuites en verbiedt action-smokegoldens", () => {
  const source = readFileSync(updater, "utf8");
  assert.match(source, /tests\/visual\/editor-screen-parity\.spec\.mjs/);
  assert.match(source, /tests\/visual\/editor-action-parity\.spec\.mjs/);
  assert.match(source, /tests\/visual\/editor-agent-bucket-action-parity\.spec\.mjs/);
  assert.match(source, /"--update-snapshots"/);
  assert.match(source, /LEERBOX_EDITOR_ACTION_SMOKE:\s*"0"/);
  assert.match(source, /collectBaselineArtifacts\(artifactRoot\)/);
  assert.match(source, /assertRequiredBaselineArtifacts\(artifacts\)/);
});
