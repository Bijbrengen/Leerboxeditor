import assert from "node:assert/strict";
import test from "node:test";
import {
  SCREENSHOT_COMPARISON,
  SCREENSHOT_COMPARISON_SCHEMA_VERSION,
  actionSnapshotSlug,
  screenshotSnapshotName
} from "./visual/screenshot-comparison.mjs";

test("actiescreenshotcontract begrenst antialiasruis en grotere pixelafwijkingen", () => {
  assert.equal(SCREENSHOT_COMPARISON_SCHEMA_VERSION, 1);
  assert.deepEqual(SCREENSHOT_COMPARISON, { threshold: 0.065, maxDiffPixels: 45 });
  assert.ok(Object.isFrozen(SCREENSHOT_COMPARISON));
});

test("actiescreenshotnamen zijn stabiel en veilig", () => {
  assert.equal(screenshotSnapshotName("Node dubbelklik: dialoog"), "node-dubbelklik-dialoog.png");
  assert.equal(actionSnapshotSlug("Node dubbelklik: dialoog"), "node-dubbelklik-dialoog");
  assert.equal(screenshotSnapshotName("  Kabel_route  "), "kabel-route.png");
  assert.throws(() => screenshotSnapshotName("---"), /niet-lege actie-ID/);
});
