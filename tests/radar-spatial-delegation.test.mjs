import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("simulatieradar delegeert polaire coördinaten aan lego-spatial", () => {
  assert.match(source, /loader\.load\(\["lego-flow-map", "lego-spatial"\]\)/);
  assert.match(source, /legoSpatial\.radarSeriesPoints\(/);
  assert.doesNotMatch(source, /Math\.(?:cos|sin)\(angle\) \* radius/);
});

test("de Editor houdt alleen labels en SVG-markup lokaal", () => {
  assert.match(source, /\.map\(\(point, index\) => \(\{ \.\.\.point, label: labels\[index\] \}\)\)/);
  assert.match(source, /points\.map\(\(point\) => `<line x1="\$\{center\}"/);
  assert.match(source, /points\.map\(\(point\) => `<text x="\$\{point\.axisX\}"/);
});

test("de simulatieradar houdt de bestaande SVG bytegelijk", () => {
  const start = source.indexOf("  function renderRadarChart(markers) {");
  const end = source.indexOf("\n  function ", start + 3);
  assert.ok(start >= 0 && end > start);
  const functionSource = source.slice(start + 2, end);
  const calls = [];
  const context = {
    legoSpatial: {
      radarSeriesPoints(values, options) {
        calls.push({ values, options });
        const angleStep = Math.PI * 2 / values.length;
        return values.map((value, index) => {
          const angle = -Math.PI / 2 + index * angleStep;
          return {
            x: options.center[0] + Math.cos(angle) * options.radius * value,
            y: options.center[1] + Math.sin(angle) * options.radius * value,
            axisX: options.center[0] + Math.cos(angle) * options.radius,
            axisY: options.center[1] + Math.sin(angle) * options.radius
          };
        });
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(`globalThis.renderRadarChart = ${functionSource};`, context);
  const markup = context.renderRadarChart({ T: 1, A: 0.75, V: 0.4, R: 0.2, S: 0.9 });

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    values: [1, 0.75, 0.4, 0.2, 0.9],
    options: { center: [92, 92], radius: 70 }
  }]);
  assert.equal(Buffer.byteLength(markup), 1366);
  assert.equal(
    crypto.createHash("sha256").update(markup).digest("hex"),
    "ef5ce7f5382489432f8695ec04e999e7205f582e60600ea7df6a544fb9315b37"
  );
});
