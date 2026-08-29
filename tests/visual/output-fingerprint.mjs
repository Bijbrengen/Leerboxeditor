import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const OUTPUT_FINGERPRINT_SCHEMA_VERSION = 3;
export const OUTPUT_FINGERPRINT_GEOMETRY_QUANTUM = 1 / 64;

// Deze lijst is bewust expliciet en versioneerbaar. Een nieuwe relevante CSS-
// eigenschap toevoegen is daarmee een zichtbare wijziging aan het snapshotcontract.
export const OUTPUT_FINGERPRINT_CSS_PROPERTIES = Object.freeze([
  "align-content",
  "align-items",
  "align-self",
  "appearance",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "bottom",
  "box-shadow",
  "box-sizing",
  "color",
  "column-gap",
  "cursor",
  "display",
  "fill",
  "filter",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "grid-auto-columns",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-column",
  "grid-row",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "inset",
  "justify-content",
  "justify-items",
  "left",
  "letter-spacing",
  "line-height",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "opacity",
  "outline-color",
  "outline-style",
  "outline-width",
  "overflow-x",
  "overflow-y",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "pointer-events",
  "position",
  "right",
  "row-gap",
  "stroke",
  "stroke-dasharray",
  "stroke-width",
  "text-align",
  "text-decoration",
  "text-overflow",
  "text-transform",
  "top",
  "transform",
  "transform-origin",
  "transition-property",
  "user-select",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "z-index"
]);

const ASSET_TAGS = new Set(["link", "script", "style"]);
function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, sortObjectKeys(value[key])])
  );
}

export function stableJsonStringify(value, space = 0) {
  return JSON.stringify(sortObjectKeys(value), null, space);
}

export function sha256Hex(value) {
  const bytes = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : stableJsonStringify(value);
  return createHash("sha256").update(bytes).digest("hex");
}

function originEntries(context = {}) {
  return [
    [context.apiOrigin, "<API_ORIGIN>"],
    [context.editorOrigin, "<EDITOR_ORIGIN>"]
  ]
    .filter(([origin]) => typeof origin === "string" && origin.length > 0)
    .sort((left, right) => right[0].length - left[0].length);
}

export function normalizeKnownOrigins(value, context = {}) {
  if (typeof value !== "string") return value;
  const normalized = originEntries(context).reduce(
    (result, [origin, replacement]) => result.split(origin).join(replacement),
    value
  );
  // Een object-URL bevat een willekeurige browser-ID. Type en bytegrootte van
  // downloads worden afzonderlijk vastgelegd; in DOM/state is alleen het feit
  // dat dezelfde origin een blob-URL levert contractueel relevant.
  return normalized.replace(
    /blob:(<EDITOR_ORIGIN>|<API_ORIGIN>)\/[^\s"'<>]+/g,
    "blob:$1/<BLOB_ID>"
  );
}

function normalizeLegacyTimestampQuery(url) {
  return url.replace(/([?&]v=)\d{10,}(?=(&|#|$))/g, "$1<TIMESTAMP>");
}

export function normalizeAssetUrl(value, context = {}) {
  if (!value) return "";
  return normalizeLegacyTimestampQuery(normalizeKnownOrigins(String(value), context));
}

export function logicalAssetName(value, context = {}) {
  const normalized = normalizeAssetUrl(value, context);
  const queryIndex = normalized.search(/[?#]/);
  const path = queryIndex === -1 ? normalized : normalized.slice(0, queryIndex);
  const sdkMatch = path.match(/<API_ORIGIN>(\/[^?#]*\/sdk\/)([^/]+)\/(.+)$/);
  if (sdkMatch) return `engine:${sdkMatch[2]}/${sdkMatch[3]}`;
  if (path.startsWith("<EDITOR_ORIGIN>")) return `editor:${path.slice("<EDITOR_ORIGIN>".length) || "/"}`;
  return path;
}

function canonicalAttribute(attribute, context) {
  const name = String(attribute.name);
  let value = normalizeKnownOrigins(String(attribute.value), context);
  if (name === "class") value = value.split(/\s+/).filter(Boolean).sort().join(" ");
  return {
    name,
    namespace: attribute.namespace || null,
    value
  };
}

function attributeValue(node, name) {
  return (node.attributes || []).find(attribute => attribute.name === name)?.value ?? null;
}

const SAFELY_REMOVABLE_DEFINITION_TAGS = new Set([
  "clippath", "filter", "g", "lineargradient", "marker", "mask",
  "path", "pattern", "radialgradient", "symbol"
]);
const DEFINITION_SIDE_EFFECT_TAGS = new Set([
  "a", "animate", "animatemotion", "animatetransform", "foreignobject",
  "script", "set", "style"
]);
const ID_REFERENCE_ATTRIBUTES = new Set([
  "aria-activedescendant", "aria-controls", "aria-describedby", "aria-details",
  "aria-errormessage", "aria-flowto", "aria-labelledby", "aria-owns", "for",
  "headers", "list"
]);
const SIMPLE_REFERENCE_ID = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function walkRawTree(node, visitor, parent = null) {
  visitor(node, parent);
  if (node?.kind === "element") (node.children || []).forEach(child => walkRawTree(child, visitor, node));
}

function collectNodeIds(node) {
  const ids = new Set();
  walkRawTree(node, child => {
    if (child?.kind !== "element") return;
    const id = attributeValue(child, "id");
    if (id) ids.add(id);
  });
  return ids;
}

function fragmentId(value) {
  const text = String(value || "");
  const hash = text.lastIndexOf("#");
  if (hash === -1 || hash === text.length - 1) return null;
  const raw = text.slice(hash + 1).replace(/[\s"')].*$/, "");
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function referencesInValue(name, value, knownIds, { stylesheet = false } = {}) {
  const found = new Set();
  const text = String(value || "");
  const add = candidate => {
    if (candidate && knownIds.has(candidate)) found.add(candidate);
  };
  for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) add(fragmentId(match[1]));
  const localName = String(name || "").toLowerCase();
  if (localName === "href" || localName.endsWith(":href")) add(fragmentId(text));
  if (ID_REFERENCE_ATTRIBUTES.has(localName)) text.trim().split(/\s+/).forEach(add);
  if (localName === "begin" || localName === "end") {
    for (const part of text.split(/[;\s]+/)) add(part.includes(".") ? part.slice(0, part.indexOf(".")) : null);
  }
  if (text.trim().startsWith("#")) add(fragmentId(text.trim()));
  if (stylesheet) {
    for (const match of text.matchAll(/#([A-Za-z_][A-Za-z0-9_.:-]*)/g)) add(match[1]);
  }
  return found;
}

function candidateCanBeOmitted(candidate) {
  if (!candidate.ids.size || !SAFELY_REMOVABLE_DEFINITION_TAGS.has(candidate.tag)) return false;
  if ([...candidate.ids].some(id => !SIMPLE_REFERENCE_ID.test(id))) return false;
  let safe = true;
  walkRawTree(candidate.node, node => {
    if (!safe || node?.kind !== "element") return;
    const tag = String(node.tag).toLowerCase();
    if (DEFINITION_SIDE_EFFECT_TAGS.has(tag)) safe = false;
    for (const attribute of node.attributes || []) {
      const name = String(attribute.name).toLowerCase();
      const value = String(attribute.value || "").trim();
      if (name.startsWith("on")) safe = false;
      if ((name === "href" || name.endsWith(":href")) && value && !value.startsWith("#")) safe = false;
    }
  });
  return safe;
}

export function analyzeSvgDefinitionUsage(rawRoots, { referenceValues = [] } = {}) {
  if (!Array.isArray(rawRoots)) throw new TypeError("DOM-roots moeten een lijst zijn.");
  const candidates = [];
  rawRoots.forEach(root => walkRawTree(root.tree, (node, parent) => {
    if (node?.kind !== "element" || parent?.kind !== "element") return;
    if (String(parent.tag).toLowerCase() !== "defs") return;
    candidates.push({
      node,
      tag: String(node.tag).toLowerCase(),
      directId: attributeValue(node, "id"),
      ids: collectNodeIds(node),
      dependencies: new Set(),
      forced: false
    });
  }));

  const candidatesByNode = new Map(candidates.map(candidate => [candidate.node, candidate]));
  const candidatesById = new Map();
  candidates.forEach(candidate => candidate.ids.forEach(id => {
    if (!candidatesById.has(id)) candidatesById.set(id, []);
    candidatesById.get(id).push(candidate);
  }));
  const knownIds = new Set(candidatesById.keys());
  const rootReferences = new Set();
  const addReferences = (target, values) => values.forEach(item => (
    referencesInValue(item.name, item.value, knownIds, item.options)
      .forEach(id => target.add(id))
  ));

  rawRoots.forEach(root => {
    function visit(node, activeCandidate = null) {
      if (!node || node.kind === "text") return;
      const candidate = candidatesByNode.get(node) || activeCandidate;
      const values = (node.attributes || [])
        .filter(attribute => attribute.name !== "id")
        .map(attribute => ({ name: attribute.name, value: attribute.value, options: {} }));
      if (String(node.tag).toLowerCase() === "style") {
        values.push(...(node.children || [])
          .filter(child => child.kind === "text")
          .map(child => ({ name: "stylesheet", value: child.value, options: { stylesheet: true } })));
      }
      addReferences(candidate ? candidate.dependencies : rootReferences, values);
      (node.children || []).forEach(child => visit(child, candidate));
    }
    visit(root.tree);
  });
  addReferences(rootReferences, (referenceValues || []).map(value => ({
    name: "stylesheet", value, options: { stylesheet: true }
  })));

  const idMultiplicity = new Map([...candidatesById].map(([id, owners]) => [id, owners.length]));
  candidates.forEach(candidate => {
    candidate.forced = !candidateCanBeOmitted(candidate);
  });
  const retained = new Set(candidates.filter(candidate => candidate.forced));
  const queue = [...retained];
  const retainId = id => {
    for (const candidate of candidatesById.get(id) || []) {
      if (retained.has(candidate)) continue;
      retained.add(candidate);
      queue.push(candidate);
    }
  };
  rootReferences.forEach(retainId);
  while (queue.length) queue.shift().dependencies.forEach(retainId);

  const omittedCandidates = candidates.filter(candidate => !retained.has(candidate));
  const omittedNodes = new Set(omittedCandidates.map(candidate => candidate.node));
  const omittedIds = new Set(omittedCandidates.flatMap(candidate => [...candidate.ids]));
  const sortableNodes = new Set(candidates
    .filter(candidate => retained.has(candidate)
      && candidateCanBeOmitted(candidate)
      && [...candidate.ids].every(id => (idMultiplicity.get(id) || 0) === 1))
    .map(candidate => candidate.node));
  const sortableIds = new Set(candidates
    .filter(candidate => sortableNodes.has(candidate.node) && candidate.directId)
    .map(candidate => candidate.directId));
  return { omittedNodes, omittedIds, sortableNodes, sortableIds, retained, candidates };
}

function canonicalNode(node, context, definitionUsage = null) {
  if (node.kind === "text") return { kind: "text", value: String(node.value) };
  if (node.kind !== "element") throw new TypeError(`Onbekend DOM-nodetype: ${node.kind}`);
  if (ASSET_TAGS.has(String(node.tag).toLowerCase())) return null;
  if (definitionUsage?.omittedNodes.has(node)) return null;

  const attributes = (node.attributes || [])
    .map(attribute => canonicalAttribute(attribute, context))
    .sort((left, right) => (
      `${left.namespace || ""}\u0000${left.name}`.localeCompare(`${right.namespace || ""}\u0000${right.name}`)
    ));
  let childPairs = (node.children || [])
    .map(child => ({ raw: child, canonical: canonicalNode(child, context, definitionUsage) }))
    .filter(pair => pair.canonical);

  if (String(node.tag).toLowerCase() === "defs") {
    childPairs = childPairs.filter(pair => !(
      pair.canonical.kind === "text" && /^\s*$/.test(pair.canonical.value)
    ));
    const idCounts = new Map();
    childPairs.forEach(pair => {
      if (pair.canonical.kind !== "element") return;
      const id = attributeValue(pair.canonical, "id");
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    });
    const sortable = childPairs.filter(pair => {
      if (pair.canonical.kind !== "element" || !definitionUsage?.sortableNodes.has(pair.raw)) return false;
      const id = attributeValue(pair.canonical, "id");
      return id && idCounts.get(id) === 1;
    }).map(pair => {
      const id = attributeValue(pair.canonical, "id");
      return {
        pair,
        key: `${pair.canonical.namespace || ""}\u0000${pair.canonical.tag}\u0000${id}\u0000${stableJsonStringify(pair.canonical)}`
      };
    }).sort((left, right) => left.key.localeCompare(right.key));
    const sortablePairs = new Set(sortable.map(item => item.pair));
    let sortableIndex = 0;
    childPairs = childPairs.map(pair => (
      sortablePairs.has(pair) ? sortable[sortableIndex++].pair : pair
    ));
  }

  return {
    kind: "element",
    namespace: node.namespace || null,
    tag: String(node.tag),
    attributes,
    children: childPairs.map(pair => pair.canonical)
  };
}

function walkCanonicalTree(node, visitor) {
  visitor(node);
  if (node.kind === "element") node.children.forEach(child => walkCanonicalTree(child, visitor));
}

function validateLocalReferences(roots) {
  const ids = new Set();
  const references = new Set();
  roots.forEach(root => walkCanonicalTree(root, node => {
    if (node.kind !== "element") return;
    node.attributes.forEach(attribute => {
      if (attribute.name === "id") {
        ids.add(attribute.value);
      }
      if (attribute.name === "href" || attribute.name.endsWith(":href")) {
        const id = fragmentId(attribute.value);
        if (id) references.add(id);
      }
      for (const match of attribute.value.matchAll(/url\(\s*["']?#([^\s"')]+)["']?\s*\)/g)) references.add(match[1]);
    });
  }));
  const unresolved = [...references].filter(id => !ids.has(id)).sort();
  if (unresolved.length) throw new Error(`Onopgeloste lokale SVG/DOM-referenties: ${unresolved.join(", ")}`);
}

export function canonicalizeContentDom(rawRoots, context = {}, options = {}) {
  if (!Array.isArray(rawRoots) || rawRoots.length === 0) throw new TypeError("Minstens één DOM-root is vereist.");
  const definitionUsage = options.definitionUsage
    || analyzeSvgDefinitionUsage(rawRoots, { referenceValues: options.referenceValues || [] });
  const roots = rawRoots.map(root => ({
    selector: String(root.selector),
    match: Number(root.match || 0),
    tree: canonicalNode(root.tree, context, definitionUsage)
  }));
  validateLocalReferences(roots.map(root => root.tree));
  return roots;
}

function normalizeStringValues(value, context) {
  if (typeof value === "string") return normalizeKnownOrigins(value, context);
  if (Array.isArray(value)) return value.map(item => normalizeStringValues(item, context));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeStringValues(child, context)]));
}

export function quantizeLayoutGeometry(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return value;
    const quantized = Math.round(value / OUTPUT_FINGERPRINT_GEOMETRY_QUANTUM)
      * OUTPUT_FINGERPRINT_GEOMETRY_QUANTUM;
    return Object.is(quantized, -0) ? 0 : quantized;
  }
  if (Array.isArray(value)) return value.map(quantizeLayoutGeometry);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, quantizeLayoutGeometry(child)]));
}

function parsedStorage(rawStorage) {
  return Object.fromEntries(Object.keys(rawStorage || {}).sort().map(key => {
    const raw = String(rawStorage[key]);
    let json = null;
    let isJson = false;
    try {
      json = JSON.parse(raw);
      isJson = true;
    } catch {
      // De exacte ruwe waarde blijft leidend; json is uitsluitend een leesbare afgeleide.
    }
    return [key, { raw, isJson, ...(isJson ? { json: sortObjectKeys(json) } : {}) }];
  }));
}

function withHash(value) {
  const canonical = sortObjectKeys(value);
  return { ...canonical, sha256: sha256Hex(canonical) };
}

function normalizeAsset(asset, context) {
  const observedUrl = normalizeAssetUrl(asset.url || asset.href || asset.src || "", context);
  return sortObjectKeys({
    ...normalizeStringValues(asset, context),
    // DOM-insertievolgorde van onafhankelijke async SDK-assets is geen asset-
    // identiteit. De afzonderlijke networkTrace bewaart volgorde wanneer die
    // onderdeel van een scenario moet zijn.
    index: undefined,
    observedUrl,
    logicalName: logicalAssetName(observedUrl, context),
    url: undefined,
    href: undefined,
    src: undefined,
    ...(asset.inlineText == null ? {} : { inlineSha256: sha256Hex(String(asset.inlineText)), inlineText: undefined })
  });
}

function normalizeNetworkEntry(entry, context) {
  if (!entry || typeof entry !== "object") return entry;
  const url = normalizeAssetUrl(entry.url || "", context);
  return sortObjectKeys({
    ...normalizeStringValues(entry, context),
    url,
    logicalName: logicalAssetName(url, context)
  });
}

function definitionReferenceValues(raw) {
  const values = [...(raw.definitionReferenceValues || [])];
  for (const node of raw.cssNodes || []) {
    values.push(...Object.values(node.properties || {}));
    values.push(...Object.values(node.pseudo?.before?.properties || {}));
    values.push(...Object.values(node.pseudo?.after?.properties || {}));
  }
  for (const asset of raw.assets?.elements || []) {
    if (asset.inlineText != null) values.push(String(asset.inlineText));
  }
  for (const sheet of raw.assets?.styleSheets || []) {
    values.push(...(sheet.rules || []));
  }
  return values;
}

function canonicalSvgSection(rawSvg, context, definitionUsage) {
  const retainedDefinitions = (rawSvg?.definitions || [])
    .filter(definition => !definition.id || !definitionUsage.omittedIds.has(definition.id))
    .map(definition => ({
      ownerPath: normalizeKnownOrigins(String(definition.path || "").replace(/\/[^/]+\[\d+\]$/, ""), context),
      tag: String(definition.tag),
      id: definition.id || null,
      tree: canonicalNode(definition.tree, context, null)
    }));
  const grouped = new Map();
  retainedDefinitions.forEach(definition => {
    if (!grouped.has(definition.ownerPath)) grouped.set(definition.ownerPath, []);
    grouped.get(definition.ownerPath).push(definition);
  });
  const definitions = [];
  for (const [ownerPath, group] of grouped) {
    const idCounts = new Map();
    group.forEach(item => item.id && idCounts.set(item.id, (idCounts.get(item.id) || 0) + 1));
    const sortable = group
      .filter(item => item.id && idCounts.get(item.id) === 1 && definitionUsage.sortableIds.has(item.id))
      .slice()
      .sort((left, right) => stableJsonStringify(left).localeCompare(stableJsonStringify(right)));
    const sortableItems = new Set(sortable.map(item => item.id));
    let sortableIndex = 0;
    group.map(item => sortableItems.has(item.id) ? sortable[sortableIndex++] : item)
      .forEach((item, index) => definitions.push({ ...item, ownerPath, index }));
  }
  const drawables = (rawSvg?.drawables || []).map(drawable => ({
    path: normalizeKnownOrigins(String(drawable.path), context),
    tag: String(drawable.tag),
    attributes: (drawable.attributes || [])
      .map(attribute => canonicalAttribute(attribute, context))
      .sort((left, right) => `${left.namespace || ""}\u0000${left.name}`
        .localeCompare(`${right.namespace || ""}\u0000${right.name}`))
  }));
  return { definitions, drawables };
}

export function buildOutputFingerprint(raw, {
  scenario,
  checkpoint,
  network = [],
  messages = [],
  downloads = []
} = {}) {
  if (!scenario || typeof scenario !== "string") throw new TypeError("Fingerprint-scenario ontbreekt.");
  if (!checkpoint || typeof checkpoint !== "string") throw new TypeError("Fingerprint-checkpoint ontbreekt.");

  const context = {
    editorOrigin: raw.origins?.editorOrigin || "",
    apiOrigin: raw.origins?.apiOrigin || ""
  };
  const referenceValues = definitionReferenceValues(raw);
  const definitionUsage = analyzeSvgDefinitionUsage(raw.domRoots, { referenceValues });
  const domRoots = canonicalizeContentDom(raw.domRoots, context, { definitionUsage });
  const cssNodes = (raw.cssNodes || [])
    .map(node => normalizeStringValues(node, context))
    .sort((left, right) => left.path.localeCompare(right.path));
  const geometryNodes = (raw.geometryNodes || [])
    .map(node => quantizeLayoutGeometry(normalizeStringValues(node, context)))
    .sort((left, right) => left.path.localeCompare(right.path));
  const svg = canonicalSvgSection(raw.svg || { definitions: [], drawables: [] }, context, definitionUsage);
  const state = normalizeStringValues({
    localStorage: parsedStorage(raw.state?.localStorage),
    sessionStorage: parsedStorage(raw.state?.sessionStorage),
    controls: (raw.state?.controls || []).slice().sort((left, right) => left.path.localeCompare(right.path)),
    scroll: (raw.state?.scroll || []).slice().sort((left, right) => left.path.localeCompare(right.path)),
    activeElement: raw.state?.activeElement || null,
    windowScroll: raw.state?.windowScroll || { x: 0, y: 0 }
  }, context);
  const assetElements = (raw.assets?.elements || [])
    .map(asset => normalizeAsset(asset, context))
    .sort((left, right) => stableJsonStringify(left).localeCompare(stableJsonStringify(right)));
  const styleSheets = (raw.assets?.styleSheets || [])
    .map(sheet => normalizeAsset(sheet, context))
    .sort((left, right) => stableJsonStringify(left).localeCompare(stableJsonStringify(right)));
  const resources = (raw.assets?.resources || [])
    .map(resource => normalizeAsset(resource, context))
    .sort((left, right) => stableJsonStringify(left).localeCompare(stableJsonStringify(right)));
  const networkTrace = (network || []).map(entry => normalizeNetworkEntry(entry, context));

  const result = {
    schemaVersion: OUTPUT_FINGERPRINT_SCHEMA_VERSION,
    scenario,
    checkpoint,
    environment: withHash(normalizeStringValues({
      ...raw.environment,
      location: raw.environment?.location || "",
      apiBase: raw.origins?.apiBase || "",
      roots: raw.rootSelectors || []
    }, context)),
    dom: withHash({ roots: domRoots }),
    css: withHash({
      propertiesSchema: OUTPUT_FINGERPRINT_CSS_PROPERTIES,
      nodes: cssNodes
    }),
    geometry: withHash({ nodes: geometryNodes }),
    svg: withHash(svg),
    state: withHash(state),
    assets: withHash({ elements: assetElements, styleSheets, resources, networkTrace }),
    messages: withHash({ items: normalizeStringValues(messages || [], context) }),
    downloads: withHash({ items: normalizeStringValues(downloads || [], context) })
  };
  return { ...result, sha256: sha256Hex(result) };
}

function validateRoots(roots) {
  const selectors = roots == null ? ["body"] : roots;
  if (!Array.isArray(selectors) || selectors.length === 0 || selectors.some(selector => typeof selector !== "string" || !selector)) {
    throw new TypeError("roots moet een niet-lege lijst CSS-selectors zijn.");
  }
  return selectors;
}

export async function captureOutputFingerprint(page, {
  scenario,
  checkpoint,
  roots,
  network = [],
  messages = [],
  downloads = []
} = {}) {
  if (!page || typeof page.evaluate !== "function") throw new TypeError("Een Playwright-page is vereist.");
  const rootSelectors = validateRoots(roots);
  const raw = await page.evaluate(({ selectors, cssProperties }) => {
    const assetTags = new Set(["LINK", "SCRIPT", "STYLE"]);
    const rootMatches = [];
    selectors.forEach(selector => {
      const matches = [...document.querySelectorAll(selector)];
      if (!matches.length) throw new Error(`Fingerprint-root ontbreekt: ${selector}`);
      matches.forEach((element, match) => rootMatches.push({ selector, match, element }));
    });

    function attributes(element) {
      return [...element.attributes].map(attribute => ({
        name: attribute.name,
        namespace: attribute.namespaceURI,
        value: attribute.value
      }));
    }

    function tree(node) {
      if (node.nodeType === Node.TEXT_NODE) return { kind: "text", value: node.nodeValue || "" };
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      return {
        kind: "element",
        namespace: node.namespaceURI,
        tag: node.localName,
        attributes: attributes(node),
        children: [...node.childNodes].map(tree).filter(Boolean)
      };
    }

    const elementPaths = new Map();
    function register(element, path) {
      if (!elementPaths.has(element)) elementPaths.set(element, path);
      let elementIndex = 0;
      [...element.children].forEach(child => {
        if (assetTags.has(child.tagName)) return;
        register(child, `${path}/${child.localName}[${elementIndex++}]`);
      });
    }
    rootMatches.forEach(({ element, selector, match }, rootIndex) => {
      register(element, `root[${rootIndex}](${selector})[${match}]/${element.localName}`);
    });

    function pathFor(element) {
      if (elementPaths.has(element)) return elementPaths.get(element);
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const siblings = current.parentElement
          ? [...current.parentElement.children].filter(sibling => !assetTags.has(sibling.tagName))
          : [current];
        parts.unshift(`${current.localName}[${siblings.indexOf(current)}]`);
        current = current.parentElement;
      }
      return `document/${parts.join("/")}`;
    }

    function styleValues(style) {
      return Object.fromEntries(cssProperties.map(property => [property, style.getPropertyValue(property)]));
    }

    const contentElements = [...elementPaths.keys()].filter(element => (
      !assetTags.has(element.tagName) && !element.closest("defs")
    ));
    // DOM en SVG-markup worden hierboven/onder exact en volledig vastgelegd en
    // iedere checkpoint krijgt daarnaast een pixelscreenshot. Computed style en
    // boxgeometrie van duizenden afzonderlijke SVG-paintprimitives voegen daar
    // geen informatie aan toe, maar maakten een volledige actiematrix urenlang.
    // Neem daarom ieder HTML-element plus de SVG-roots en interactieve SVG-
    // ankers op; drawable volgorde/pathdata blijft onverkort in `svg.drawables`.
    const fingerprintElements = contentElements.filter(element => (
      element.namespaceURI !== "http://www.w3.org/2000/svg"
      || element.matches("svg, [role=slider], [data-flow-stud], [data-block-type], .network-edge, .lego-flow-map-cable, .radar-chart")
    ));
    const cssNodes = fingerprintElements.map(element => {
      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");
      const beforeContent = before.getPropertyValue("content");
      const afterContent = after.getPropertyValue("content");
      return {
        path: pathFor(element),
        properties: styleValues(getComputedStyle(element)),
        pseudo: {
          before: beforeContent === "none" ? { content: "none" } : { content: beforeContent, properties: styleValues(before) },
          after: afterContent === "none" ? { content: "none" } : { content: afterContent, properties: styleValues(after) }
        }
      };
    });
    // De bbox van SVG-kabelgroepen is een browserafleiding van exact vastgelegde
    // drawable-attributen. Chromium kan die onzichtbare groepsbox na identieke
    // frames enkele subpixels anders rapporteren. CSS en SVG blijven exact; voor
    // geometrie meten we de zichtbare SVG-root en interactieve ankers.
    const geometryElements = fingerprintElements.filter(element => (
      !element.matches(".network-edge, .lego-flow-map-cable")
    ));
    const geometryNodes = geometryElements.map(element => {
      const rect = element.getBoundingClientRect();
      return {
        path: pathFor(element),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        },
        client: { width: element.clientWidth, height: element.clientHeight, left: element.clientLeft, top: element.clientTop },
        offset: { width: element.offsetWidth, height: element.offsetHeight, left: element.offsetLeft, top: element.offsetTop },
        scroll: { left: element.scrollLeft, top: element.scrollTop, width: element.scrollWidth, height: element.scrollHeight }
      };
    });

    function controlState(element) {
      const state = {
        path: pathFor(element),
        tag: element.localName,
        type: element.type || null,
        disabled: Boolean(element.disabled),
        hidden: Boolean(element.hidden),
        ariaSelected: element.getAttribute("aria-selected"),
        ariaExpanded: element.getAttribute("aria-expanded")
      };
      if ("value" in element) state.value = element.value;
      if ("checked" in element) state.checked = Boolean(element.checked);
      if (element.localName === "select") {
        state.selectedIndex = element.selectedIndex;
        state.options = [...element.options].map(option => ({
          value: option.value,
          text: option.text,
          selected: option.selected,
          disabled: option.disabled
        }));
      }
      if (element.files) {
        state.files = [...element.files].map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }));
      }
      if (element.localName === "dialog") state.open = element.open;
      return state;
    }

    function storageObject(storage) {
      return Object.fromEntries([...Array(storage.length).keys()].map(index => {
        const key = storage.key(index);
        return [key, storage.getItem(key)];
      }));
    }

    const controls = fingerprintElements
      .filter(element => element.matches("button, input, output, select, textarea, dialog, [contenteditable], [aria-selected], [aria-expanded]"))
      .map(controlState);
    const scroll = fingerprintElements
      .filter(element => element.scrollLeft !== 0 || element.scrollTop !== 0 || element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)
      .map(element => ({
        path: pathFor(element),
        left: element.scrollLeft,
        top: element.scrollTop,
        width: element.scrollWidth,
        height: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight
      }));

    const definitionElements = [...document.querySelectorAll("svg defs > *")];
    const drawableSelector = "svg path, svg polygon, svg polyline, svg line, svg rect, svg circle, svg ellipse, svg use, svg text";
    const drawables = [...document.querySelectorAll(drawableSelector)]
      .filter(element => !element.closest("defs"))
      .map(element => ({ path: pathFor(element), tag: element.localName, attributes: attributes(element) }));
    const definitions = definitionElements.map(element => ({
      path: pathFor(element),
      tag: element.localName,
      id: element.id || null,
      tree: tree(element)
    }));
    const definitionReferenceValues = [...document.querySelectorAll("svg *")]
      .filter(element => !element.closest("defs"))
      .flatMap(element => {
        const style = getComputedStyle(element);
        return ["fill", "stroke", "filter", "clip-path", "mask", "marker-start", "marker-mid", "marker-end"]
          .map(property => style.getPropertyValue(property));
      });

    const assetElements = [...document.querySelectorAll("link, script, style")].map((element, index) => ({
      index,
      tag: element.localName,
      url: element.src || element.href || "",
      rel: element.rel || "",
      type: element.type || "",
      media: element.media || "",
      integrity: element.integrity || "",
      crossOrigin: element.crossOrigin || "",
      disabled: Boolean(element.disabled),
      attributes: attributes(element),
      ...(element.src || element.href ? {} : { inlineText: element.textContent || "" })
    }));
    const styleSheets = [...document.styleSheets].map((sheet, index) => ({
      index,
      url: sheet.href || "",
      disabled: sheet.disabled,
      media: sheet.media?.mediaText || "",
      ownerTag: sheet.ownerNode?.localName || null
    }));
    const resources = performance.getEntriesByType("resource").map(entry => ({
      url: entry.name,
      initiatorType: entry.initiatorType
    }));

    let apiBase = String(window.LeerpretSDKApiBase || "");
    if (!apiBase) {
      const parameter = new URLSearchParams(location.search).get("api");
      if (parameter) apiBase = parameter;
    }
    let apiOrigin = "";
    try { apiOrigin = apiBase ? new URL(apiBase, location.href).origin : ""; } catch { /* Ongeldige base blijft zichtbaar in apiBase. */ }

    return {
      origins: { editorOrigin: location.origin, apiOrigin, apiBase },
      rootSelectors: selectors,
      environment: {
        location: location.href,
        title: document.title,
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: { width: innerWidth, height: innerHeight },
        screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight },
        devicePixelRatio,
        colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
      },
      domRoots: rootMatches.map(({ selector, match, element }) => ({ selector, match, tree: tree(element) })),
      cssNodes,
      geometryNodes,
      svg: { definitions, drawables },
      definitionReferenceValues,
      state: {
        localStorage: storageObject(localStorage),
        sessionStorage: storageObject(sessionStorage),
        controls,
        scroll,
        activeElement: document.activeElement ? pathFor(document.activeElement) : null,
        windowScroll: { x: scrollX, y: scrollY }
      },
      assets: { elements: assetElements, styleSheets, resources }
    };
  }, { selectors: rootSelectors, cssProperties: OUTPUT_FINGERPRINT_CSS_PROPERTIES });

  return buildOutputFingerprint(raw, { scenario, checkpoint, network, messages, downloads });
}

export async function expectOutputFingerprint(page, expected, options = {}) {
  const actual = await captureOutputFingerprint(page, options);
  assert.deepStrictEqual(actual, expected);
  return actual;
}

export function serializeOutputFingerprint(fingerprint, space = 2) {
  return `${stableJsonStringify(fingerprint, space)}\n`;
}
