import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSvgDefinitionUsage,
  buildOutputFingerprint,
  canonicalizeContentDom,
  captureOutputFingerprint,
  logicalAssetName,
  normalizeAssetUrl,
  quantizeLayoutGeometry,
  serializeOutputFingerprint,
  sha256Hex,
  stableJsonStringify
} from "./visual/output-fingerprint.mjs";

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

function text(value) {
  return { kind: "text", value };
}

function element(tag, { namespace = HTML, attributes = [], children = [] } = {}) {
  return {
    kind: "element",
    namespace,
    tag,
    attributes: attributes.map(([name, value]) => ({ name, namespace: null, value })),
    children
  };
}

function root(tree, selector = "body") {
  return [{ selector, match: 0, tree }];
}

function findElements(node, tag, result = []) {
  if (node?.kind === "element") {
    if (node.tag.toLowerCase() === tag.toLowerCase()) result.push(node);
    node.children.forEach(child => findElements(child, tag, result));
  }
  return result;
}

function minimalRaw(tree = element("body")) {
  return {
    origins: {
      editorOrigin: "http://127.0.0.1:47114",
      apiOrigin: "http://127.0.0.1:47111",
      apiBase: "http://127.0.0.1:47111/api"
    },
    rootSelectors: ["body"],
    environment: {
      location: "http://127.0.0.1:47114/?api=http://127.0.0.1:47111/api",
      viewport: { width: 1440, height: 1000 },
      devicePixelRatio: 1
    },
    domRoots: root(tree),
    cssNodes: [{ path: "root[0](body)[0]/body", properties: { display: "block" }, pseudo: {} }],
    geometryNodes: [{ path: "root[0](body)[0]/body", rect: { x: 0, y: 0, width: 1440, height: 1000 } }],
    svg: { definitions: [], drawables: [] },
    state: {
      localStorage: { capture: "{\"b\":2,\"a\":1}" },
      sessionStorage: { marker: "ready" },
      controls: [],
      scroll: [],
      activeElement: "root[0](body)[0]/body",
      windowScroll: { x: 0, y: 0 }
    },
    assets: {
      elements: [{
        tag: "script",
        url: "http://127.0.0.1:47111/api/sdk/editor-chrome/chrome.js?v=1787938694278",
        inlineText: null
      }],
      styleSheets: [],
      resources: []
    }
  };
}

test("stabiele JSON sorteert objectkeys maar behoudt arrayvolgorde", () => {
  assert.equal(stableJsonStringify({ z: 1, a: { y: 2, x: 3 }, list: ["b", "a"] }),
    '{"a":{"x":3,"y":2},"list":["b","a"],"z":1}');
  assert.notEqual(
    stableJsonStringify({ list: ["b", "a"] }),
    stableJsonStringify({ list: ["a", "b"] })
  );
  assert.match(sha256Hex("leerpret"), /^[0-9a-f]{64}$/);
});

test("layoutgeometrie volgt Chromiums 1/64-CSS-pixelraster", () => {
  assert.deepEqual(
    quantizeLayoutGeometry({ rect: { x: 10.004, width: 99.999 }, values: [0, -0, 1.031] }),
    { rect: { x: 10, width: 100 }, values: [0, 0, 1.03125] }
  );
  const options = { scenario: "geometry", checkpoint: "stable" };
  const original = minimalRaw();
  original.geometryNodes[0].rect.x = 10;
  const browserNoise = structuredClone(original);
  browserNoise.geometryNodes[0].rect.x = 10.005;
  const visibleShift = structuredClone(original);
  visibleShift.geometryNodes[0].rect.x = 10.03;
  assert.equal(
    buildOutputFingerprint(original, options).geometry.sha256,
    buildOutputFingerprint(browserNoise, options).geometry.sha256
  );
  assert.notEqual(
    buildOutputFingerprint(original, options).geometry.sha256,
    buildOutputFingerprint(visibleShift, options).geometry.sha256
  );
});

test("assetnormalisatie beperkt zich tot origins en legacy timestamp-query", () => {
  const context = {
    editorOrigin: "http://127.0.0.1:47114",
    apiOrigin: "http://127.0.0.1:47111"
  };
  assert.equal(
    normalizeAssetUrl("http://127.0.0.1:47111/api/sdk/editor-chrome/chrome.js?v=1787938694278", context),
    "<API_ORIGIN>/api/sdk/editor-chrome/chrome.js?v=<TIMESTAMP>"
  );
  assert.equal(
    normalizeAssetUrl("http://127.0.0.1:47114/script.js?v=5", context),
    "<EDITOR_ORIGIN>/script.js?v=5"
  );
  assert.equal(
    normalizeAssetUrl("blob:http://127.0.0.1:47114/20c56bb5-3ef4-45ca-934f-9f8ce723d726", context),
    "blob:<EDITOR_ORIGIN>/<BLOB_ID>"
  );
  assert.equal(
    logicalAssetName("http://127.0.0.1:47111/api/sdk/editor-chrome/chrome.js?v=5.20.0&h=abc", context),
    "engine:editor-chrome/chrome.js"
  );
});

test("content-DOM normaliseert alleen attribuut/classvolgorde, assets en veilige SVG-defsvolgorde", () => {
  const left = element("body", {
    attributes: [["data-url", "http://old-editor.test/work"], ["class", "beta alpha"]],
    children: [
      element("script", { children: [text("oude implementatie")] }),
      element("svg", { namespace: SVG, children: [
        element("defs", { namespace: SVG, children: [
          text("\n"),
          element("linearGradient", { namespace: SVG, attributes: [["id", "gradient-b"]] }),
          text("\n"),
          element("linearGradient", { namespace: SVG, attributes: [["id", "gradient-a"]] }),
          text("\n")
        ] }),
        element("path", { namespace: SVG, attributes: [["fill", "url(#gradient-a)"], ["d", "M 0 0 L 1 1"]] })
      ] })
    ]
  });
  const right = element("body", {
    attributes: [["class", "alpha beta"], ["data-url", "http://new-editor.test/work"]],
    children: [
      element("script", { children: [text("nieuwe implementatie")] }),
      element("svg", { namespace: SVG, children: [
        element("defs", { namespace: SVG, children: [
          text("\n"),
          element("linearGradient", { namespace: SVG, attributes: [["id", "gradient-a"]] }),
          text("\n"),
          element("linearGradient", { namespace: SVG, attributes: [["id", "gradient-b"]] }),
          text("\n")
        ] }),
        element("path", { namespace: SVG, attributes: [["d", "M 0 0 L 1 1"], ["fill", "url(#gradient-a)"]] })
      ] })
    ]
  });

  assert.deepEqual(
    canonicalizeContentDom(root(left), { editorOrigin: "http://old-editor.test" }),
    canonicalizeContentDom(root(right), { editorOrigin: "http://new-editor.test" })
  );
});

test("drawable SVG-volgorde en inline-style blijven exact", () => {
  const first = element("body", { children: [
    element("div", { attributes: [["style", "color:red;display:block"]] }),
    element("svg", { namespace: SVG, children: [
      element("path", { namespace: SVG, attributes: [["id", "one"], ["d", "M0 0"]] }),
      element("path", { namespace: SVG, attributes: [["id", "two"], ["d", "M1 1"]] })
    ] })
  ] });
  const reordered = element("body", { children: [
    element("div", { attributes: [["style", "display:block;color:red"]] }),
    element("svg", { namespace: SVG, children: [
      element("path", { namespace: SVG, attributes: [["id", "two"], ["d", "M1 1"]] }),
      element("path", { namespace: SVG, attributes: [["id", "one"], ["d", "M0 0"]] })
    ] })
  ] });
  assert.notDeepEqual(canonicalizeContentDom(root(first)), canonicalizeContentDom(root(reordered)));
});

test("anonieme, dubbelzinnige en potentieel actieve defs blijven exact behouden", () => {
  const anonymous = element("body", { children: [
    element("svg", { namespace: SVG, children: [element("defs", {
      namespace: SVG,
      children: [element("linearGradient", { namespace: SVG })]
    })] })
  ] });
  assert.equal(findElements(canonicalizeContentDom(root(anonymous))[0].tree, "linearGradient").length, 1);

  const duplicate = element("body", { children: [
    element("svg", { namespace: SVG, children: [element("defs", {
      namespace: SVG,
      children: [
        element("style", { namespace: SVG, attributes: [["id", "same"]], children: [text(".x{fill:red}")] }),
        element("filter", { namespace: SVG, attributes: [["id", "same"], ["onload", "activate()"]] })
      ]
    })] })
  ] });
  const usage = analyzeSvgDefinitionUsage(root(duplicate));
  assert.deepEqual([...usage.retained].map(candidate => candidate.tag), ["style", "filter"]);
  // <style> leeft volgens het fingerprintcontract in het aparte assetkanaal;
  // het potentieel actieve filter blijft ook in de content-DOM staan.
  const retained = findElements(canonicalizeContentDom(root(duplicate))[0].tree, "defs")[0].children;
  assert.deepEqual(retained.map(node => node.tag), ["filter"]);
});

test("een werkelijk onopgeloste lokale SVG-referentie faalt hard", () => {
  const unresolved = element("body", { children: [
    element("svg", { namespace: SVG, children: [
      element("path", { namespace: SVG, attributes: [["fill", "url(#missing)"]] })
    ] })
  ] });
  assert.throws(() => canonicalizeContentDom(root(unresolved)), /Onopgeloste lokale/);
});

test("alleen aantoonbaar ongerefereerde directe defs vallen uit DOM en analyse", () => {
  const page = element("body", { children: [
    element("svg", { namespace: SVG, children: [
      element("defs", { namespace: SVG, children: [
        element("linearGradient", { namespace: SVG, attributes: [["id", "unused-random-a"]], children: [
          element("stop", { namespace: SVG, attributes: [["stop-color", "#288b52"]] })
        ] }),
        element("linearGradient", { namespace: SVG, attributes: [["id", "base"]] }),
        element("linearGradient", { namespace: SVG, attributes: [["id", "derived"], ["href", "#base"]] }),
        element("filter", { namespace: SVG, attributes: [["id", "via-filter"]] }),
        element("clipPath", { namespace: SVG, attributes: [["id", "via-href"]] }),
        element("mask", { namespace: SVG, attributes: [["id", "via-xlink"]] }),
        element("marker", { namespace: SVG, attributes: [["id", "via-aria"]] })
      ] }),
      element("path", { namespace: SVG, attributes: [["fill", "url(#derived)"], ["filter", "url(\"#via-filter\")"]] }),
      element("use", { namespace: SVG, attributes: [["href", "#via-href"]] }),
      element("use", { namespace: SVG, attributes: [["xlink:href", "https://editor.invalid/view#via-xlink"]] }),
      element("g", { namespace: SVG, attributes: [["aria-labelledby", "via-aria"]] })
    ] })
  ] });
  const usage = analyzeSvgDefinitionUsage(root(page));
  assert.deepEqual([...usage.omittedIds], ["unused-random-a"]);
  const canonical = canonicalizeContentDom(root(page), {}, { definitionUsage: usage });
  const retainedIds = findElements(canonical[0].tree, "defs")[0].children
    .map(node => node.attributes.find(attribute => attribute.name === "id")?.value);
  assert.deepEqual(retainedIds.sort(), ["base", "derived", "via-aria", "via-filter", "via-href", "via-xlink"]);
});

test("CSS-referenties behouden defs conservatief, maar kleurhexen creëren niets", () => {
  const page = element("body", { children: [
    element("svg", { namespace: SVG, children: [
      element("defs", { namespace: SVG, children: [
        element("filter", { namespace: SVG, attributes: [["id", "css-filter"]] }),
        element("linearGradient", { namespace: SVG, attributes: [["id", "aabbcc"]] }),
        element("linearGradient", { namespace: SVG, attributes: [["id", "truly-unused"]] })
      ] })
    ] })
  ] });
  const usage = analyzeSvgDefinitionUsage(root(page), {
    referenceValues: [".node { filter: url('#css-filter'); color: #aabbcc; }"]
  });
  assert.equal(usage.omittedIds.has("css-filter"), false);
  // Een CSS-selector/hex die exact een bestaande id noemt wordt bij twijfel
  // behouden; dit is bewust conservatief.
  assert.equal(usage.omittedIds.has("aabbcc"), false);
  assert.equal(usage.omittedIds.has("truly-unused"), true);
});

test("willekeurige ongerefereerde gradients leveren dezelfde canonical DOM-hash", () => {
  const scene = (id, color) => element("body", { children: [
    element("svg", { namespace: SVG, children: [
      element("defs", { namespace: SVG, children: [
        element("linearGradient", { namespace: SVG, attributes: [["id", id]], children: [
          element("stop", { namespace: SVG, attributes: [["stop-color", color]] })
        ] }),
        element("linearGradient", { namespace: SVG, attributes: [["id", "used"]] })
      ] }),
      element("path", { namespace: SVG, attributes: [["fill", "url(#used)"], ["d", "M0 0L1 1"]] })
    ] })
  ] });
  const left = canonicalizeContentDom(root(scene("mix-288b52", "#288b52")));
  const right = canonicalizeContentDom(root(scene("mix-2a68cf", "#2a68cf")));
  assert.equal(sha256Hex(left), sha256Hex(right));
});

test("DOM- en SVG-sectiehash negeren alleen ongerefereerde defs en bewaken drawables exact", () => {
  function rawScene(randomId, randomColor, drawablePath = "M0 0L1 1") {
    const unused = element("linearGradient", { namespace: SVG, attributes: [["id", randomId]], children: [
      element("stop", { namespace: SVG, attributes: [["stop-color", randomColor]] })
    ] });
    const used = element("linearGradient", { namespace: SVG, attributes: [["id", "used-gradient"]] });
    const scene = element("body", { children: [
      element("svg", { namespace: SVG, children: [
        element("defs", { namespace: SVG, children: [unused, used] }),
        element("path", { namespace: SVG, attributes: [["fill", "url(#used-gradient)"], ["d", drawablePath]] })
      ] })
    ] });
    const raw = minimalRaw(scene);
    raw.svg = {
      definitions: [
        { path: `root/body/svg[0]/defs[0]/linearGradient[0]`, tag: "linearGradient", id: randomId, tree: unused },
        { path: `root/body/svg[0]/defs[0]/linearGradient[1]`, tag: "linearGradient", id: "used-gradient", tree: used }
      ],
      drawables: [{
        path: "root/body/svg[0]/path[1]",
        tag: "path",
        attributes: [
          { name: "fill", namespace: null, value: "url(#used-gradient)" },
          { name: "d", namespace: null, value: drawablePath }
        ]
      }]
    };
    return raw;
  }
  const options = { scenario: "svg", checkpoint: "rendered" };
  const left = buildOutputFingerprint(rawScene("mix-288b52", "#288b52"), options);
  const right = buildOutputFingerprint(rawScene("mix-2a68cf", "#2a68cf"), options);
  assert.equal(left.dom.sha256, right.dom.sha256);
  assert.equal(left.svg.sha256, right.svg.sha256);
  assert.equal(left.sha256, right.sha256);
  assert.deepEqual(left.svg.definitions.map(definition => definition.id), ["used-gradient"]);

  const changedDrawable = buildOutputFingerprint(rawScene("mix-2a68cf", "#2a68cf", "M0 0L9 9"), options);
  assert.notEqual(left.svg.sha256, changedDrawable.svg.sha256);
  assert.notEqual(left.sha256, changedDrawable.sha256);
});

test("fingerprint bevat deterministische sectiehashes, toestand en assetinventaris", () => {
  const raw = minimalRaw(element("body", { children: [text("zelfde schermoutput")] }));
  const fingerprint = buildOutputFingerprint(raw, {
    scenario: "bootstrap",
    checkpoint: "ready",
    network: [{ method: "GET", url: "http://127.0.0.1:47111/api/sdk/manifest.json", status: 200 }],
    messages: [{ type: "ready" }],
    downloads: []
  });

  assert.equal(fingerprint.schemaVersion, 3);
  [fingerprint.sha256, fingerprint.dom.sha256, fingerprint.css.sha256, fingerprint.geometry.sha256,
    fingerprint.svg.sha256, fingerprint.state.sha256, fingerprint.assets.sha256]
    .forEach(hash => assert.match(hash, /^[0-9a-f]{64}$/));
  assert.equal(fingerprint.environment.location, "<EDITOR_ORIGIN>/?api=<API_ORIGIN>/api");
  assert.deepEqual(fingerprint.state.localStorage.capture.json, { a: 1, b: 2 });
  assert.equal(fingerprint.state.localStorage.capture.raw, '{"b":2,"a":1}');
  assert.equal(fingerprint.assets.elements[0].observedUrl,
    "<API_ORIGIN>/api/sdk/editor-chrome/chrome.js?v=<TIMESTAMP>");
  assert.equal(fingerprint.messages.items[0].type, "ready");

  const changed = buildOutputFingerprint(minimalRaw(element("body", { children: [text("afwijking")] })), {
    scenario: "bootstrap",
    checkpoint: "ready"
  });
  assert.notEqual(changed.dom.sha256, fingerprint.dom.sha256);
  assert.notEqual(changed.sha256, fingerprint.sha256);
  assert.equal(JSON.parse(serializeOutputFingerprint(fingerprint)).sha256, fingerprint.sha256);
});

test("Playwright capture-API accepteert een serialiseerbaar page-resultaat en valideert roots", async () => {
  const raw = minimalRaw();
  const page = { evaluate: async () => raw };
  const fingerprint = await captureOutputFingerprint(page, {
    scenario: "fake-page",
    checkpoint: "ready",
    roots: ["body"]
  });
  assert.equal(fingerprint.scenario, "fake-page");
  assert.equal(fingerprint.checkpoint, "ready");
  await assert.rejects(
    captureOutputFingerprint(page, { scenario: "fake-page", checkpoint: "ready", roots: [] }),
    /roots moet/
  );
});
