import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authSource = readFileSync(new URL("../editor-auth.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Editor-auth gebruikt uitsluitend de centrale SDK-client", () => {
  assert.match(authSource, /window\.LeerpretSDKReady/);
  assert.match(authSource, /const base = window\.LeerpretSDKApiBase/);
  assert.doesNotMatch(authSource, /LeerpretSDK\.create/);
  assert.match(authSource, /completeGoogleLogin\(\{ apiBase: base, sdkClient, shareProfile: true \}\)/);
});

test("Editor laadt de actuele centrale authbootstrap", () => {
  assert.match(indexSource, /editor-auth\.js\?v=manifest-loader-7/);
});

test("Editor vraagt via de SDK expliciet profielverificatie voor de tester-allowlist", () => {
  assert.match(authSource, /shareProfile: true/);
  assert.match(authSource, /bestaande tester- en editorrol/);
  assert.match(authSource, /decision\.action === "login" \|\| decision\.action === "denied"/);
});

test("authbootstrap publiceert de SDK-toegangspoort voor consumers", () => {
  assert.match(authSource, /window\.LeerboxEditorAuthReady = Promise\.all/);
  assert.match(authSource, /loader\.load\(\["api-client", "auth-client"\]\)/);
  assert.doesNotMatch(authSource, /\/sdk\/auth-client\/client\.js/);
  assert.match(authSource, /return decision/);
});

test("een mislukte callback laat geen half-actieve Editor achter", () => {
  assert.match(authSource, /De vorige Google-aanmelding is niet afgerond/);
  assert.match(authSource, /login\.mountLogin\(document\.body/);
  assert.match(authSource, /data-sdk-login-status/);
});
