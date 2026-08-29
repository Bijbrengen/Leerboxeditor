import { expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const API_BASE = (process.env.LEERPRET_API_URL || "http://127.0.0.1:47111/api").replace(/\/+$/, "");
export const API_PATH = new URL(API_BASE).pathname.replace(/\/+$/, "");
export const EDITOR_PATH = `?embedded=1&role=viewer&view=build&workspace=vat&api=${encodeURIComponent(API_BASE)}`;
export const EDITOR_BASE = process.env.LEERBOX_EDITOR_TEST_URL
  || process.env.LEERBOX_EDITOR_URL
  || "http://127.0.0.1:47114/";
export const EDITOR_URL = new URL(EDITOR_PATH, EDITOR_BASE).href;

export const FIXED_NOW = "2026-08-28T08:00:00.000Z";
export const FIXED_TEST_EVENTS = Object.freeze([
  Object.freeze({ timestamp: "2026-08-28T08:00:00.000Z", user_id: "e2e-user", learning_object_id: "startobject" }),
  Object.freeze({ timestamp: "2026-08-28T08:00:05.000Z", user_id: "e2e-user", learning_object_id: "weerstandsobject" }),
  Object.freeze({ timestamp: "2026-08-28T08:00:12.000Z", user_id: "e2e-user", learning_object_id: "leerobject" }),
  Object.freeze({ timestamp: "2026-08-28T08:00:18.000Z", user_id: "e2e-user", learning_object_id: "succesobject" })
]);

export const FIXED_CAPTURE = Object.freeze({
  schema_version: "1.0.0",
  metadata: Object.freeze({
    leerbox_id: "e2e-fixture",
    title: "Playwright leerbox"
  }),
  raw_user_description: "Deterministische Playwright-capture.",
  objects: Object.freeze([]),
  interaction_route: Object.freeze([]),
  freedom_and_sequence: Object.freeze({ route_model: "strict", hard_dependencies: Object.freeze([]) })
});

export const FIXED_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
  + "2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n"
  + "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8"
);

export const TEST_TWIN = Object.freeze({
  id: "e2e-fixture",
  title: "Playwright leerbox",
  status: "pilot",
  gevat_validation: { is_gevat: true }
});
let baselineManifestRecorded = false;

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

/**
 * Bouwt een deterministisch API-scenario. Een response mag een JSON-waarde,
 * async functie of descriptor `{ status, body, headers, contentType }` zijn.
 * `agentChats` is bewust een queue: een extra, niet-gefixturede AI-call faalt.
 */
export function createFixtureScenario(overrides = {}) {
  const fixedNow = overrides.fixedNow || FIXED_NOW;
  const datasetPath = `${API_PATH}/fixtures/e2e-events.json`;
  const defaults = {
    fixedNow,
    initialLocalStorage: {},
    twins: [cloneJson(TEST_TWIN)],
    selectedCapture: cloneJson(FIXED_CAPTURE),
    autosave: {},
    history: {
      entries: [{
        index: 7,
        timestamp: fixedNow,
        source: "autosave",
        changes: [{ path: "metadata.title" }]
      }]
    },
    restore: { capture: cloneJson(FIXED_CAPTURE) },
    preview: { preview_url: "/previews/e2e-fixture/index.html" },
    pdf: {
      body: Buffer.from(FIXED_PDF_BYTES),
      contentType: "application/pdf",
      headers: { "content-disposition": "inline; filename=\"e2e-fixture-verrijkingsplan.pdf\"" }
    },
    testDatasetCatalog: {
      preview_interactions: cloneJson(FIXED_TEST_EVENTS).map(event => ({
        timestamp: event.timestamp,
        user_id: event.user_id,
        object_id: event.learning_object_id,
        action: "click",
        source: "playwright"
      })),
      files: [{
        group_id: "e2e-fixture",
        group_title: "Playwright fixtures",
        name: "events.json",
        path: "fixtures/events.json",
        items: FIXED_TEST_EVENTS.length,
        data_url: `${API_BASE}/fixtures/e2e-events.json`
      }]
    },
    datasetFiles: { [datasetPath]: cloneJson(FIXED_TEST_EVENTS) },
    agentStatus: {
      online: true,
      limits: {
        max_messages: 12,
        max_output_tokens: 900,
        fill_max_output_tokens: 1800,
        system_prompt_characters: { fill_from_sources: 2400, fill_field: 1200 }
      }
    },
    agentChats: [{
      message: { role: "assistant", content: "Deterministisch Playwright-antwoord." },
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }
    }],
    projectBucket: {
      sources: [{
        id: "bron-een",
        type: "document",
        name: "bron-een.txt",
        path: "documents/bron-een.txt",
        imported_at: fixedNow
      }]
    },
    projectBucketResponse: undefined,
    projectConfig: {},
    documentUpload: undefined,
    zipUpload: undefined,
    repositoryImport: undefined,
    websiteImport: undefined,
    sourceDownloads: {
      "bron-een": {
        body: Buffer.from("Deterministische broninhoud.\n", "utf8"),
        contentType: "text/plain; charset=utf-8",
        headers: { "content-disposition": "attachment; filename=\"bron-een.txt\"" }
      }
    }
  };

  const scenario = {
    ...defaults,
    ...overrides,
    initialLocalStorage: { ...defaults.initialLocalStorage, ...(overrides.initialLocalStorage || {}) },
    twins: hasOwn(overrides, "twins") ? cloneJson(overrides.twins) : defaults.twins,
    selectedCapture: hasOwn(overrides, "selectedCapture") ? overrides.selectedCapture : defaults.selectedCapture,
    datasetFiles: { ...defaults.datasetFiles, ...(overrides.datasetFiles || {}) },
    agentChats: hasOwn(overrides, "agentChats") ? [...(overrides.agentChats || [])] : defaults.agentChats,
    projectBucket: {
      ...defaults.projectBucket,
      ...(overrides.projectBucket || {}),
      sources: hasOwn(overrides.projectBucket, "sources")
        ? cloneJson(overrides.projectBucket.sources)
        : cloneJson(defaults.projectBucket.sources)
    },
    sourceDownloads: { ...defaults.sourceDownloads, ...(overrides.sourceDownloads || {}) }
  };
  Object.defineProperty(scenario, "__editorFixtureScenario", { value: true });
  scenario.agentChatQueue = [...scenario.agentChats];
  scenario.uploadSequence = { document: 0, zip: 0, repository: 0, website: 0 };
  return scenario;
}

export function createFixtureTrackers() {
  return {
    requests: [],
    selectedCaptures: [],
    autosaves: [],
    histories: [],
    restores: [],
    previews: [],
    pdfs: [],
    testDatasets: [],
    agentStatuses: [],
    agentChats: [],
    projectBuckets: [],
    projectConfigs: [],
    uploads: [],
    repositoryImports: [],
    websiteImports: [],
    sourceDownloads: [],
    dialogs: []
  };
}

async function recordBaselineManifest(page) {
  const outputPath = process.env.LEERBOX_EDITOR_BASELINE_MANIFEST_OUT;
  if (!outputPath || baselineManifestRecorded) return;
  const response = await page.request.get(`${API_BASE}/sdk/manifest.json`);
  if (!response.ok()) throw new Error(`Engine-manifest voor baselineprovenance gaf HTTP ${response.status()}.`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await response.body());
  baselineManifestRecorded = true;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fixtureSlug(value) {
  return String(value || "fixture")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fixture";
}

async function requestRecord(request) {
  const url = new URL(request.url());
  const postData = request.postData();
  const postDataBuffer = request.postDataBuffer();
  let json = null;
  try {
    json = postData == null ? null : request.postDataJSON();
  } catch {
    json = null;
  }
  const multipartText = postDataBuffer?.toString("latin1") || "";
  return {
    method: request.method(),
    url: request.url(),
    pathname: url.pathname,
    search: url.search,
    query: Object.fromEntries(url.searchParams),
    headers: request.headers(),
    postData,
    postDataBuffer: postDataBuffer ? Buffer.from(postDataBuffer) : null,
    json,
    fileNames: Array.from(multipartText.matchAll(/filename="([^"]*)"/g), match => match[1]),
    fieldNames: Array.from(multipartText.matchAll(/name="([^"]*)"/g), match => match[1])
  };
}

async function configuredResponse(configured, context) {
  return typeof configured === "function" ? configured(context) : configured;
}

function isResponseDescriptor(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && !Buffer.isBuffer(value)
    && (hasOwn(value, "status") || hasOwn(value, "contentType") || hasOwn(value, "headers"));
}

async function fulfillFixture(route, corsHeaders, configured, context = {}) {
  const resolved = await configuredResponse(configured, context);
  const descriptor = isResponseDescriptor(resolved) ? resolved : { body: resolved };
  const status = Number(descriptor.status || 200);
  const bodyValue = descriptor.body;
  const contentType = descriptor.contentType
    || (Buffer.isBuffer(bodyValue) || bodyValue instanceof Uint8Array
      ? "application/octet-stream"
      : "application/json; charset=utf-8");
  const headers = {
    ...corsHeaders,
    "content-type": contentType,
    ...(descriptor.headers || {})
  };
  const body = Buffer.isBuffer(bodyValue) || bodyValue instanceof Uint8Array
    ? Buffer.from(bodyValue)
    : typeof bodyValue === "string" && !/json/i.test(contentType)
      ? bodyValue
      : JSON.stringify(bodyValue ?? {});
  await route.fulfill({ status, headers, body });
}

function addBucketSource(scenario, source) {
  if (!source?.id) return;
  const sources = scenario.projectBucket.sources;
  if (!sources.some(candidate => candidate.id === source.id)) sources.push(source);
}

function defaultImportedSource(scenario, type, record) {
  scenario.uploadSequence[type] += 1;
  const url = record.json?.url || "";
  const name = record.fileNames[0]
    || (type === "repository" ? url.split("/").filter(Boolean).at(-1) : "")
    || (type === "website" ? new URL(url).hostname : "")
    || `${type}-fixture`;
  return {
    id: `${type}-${scenario.uploadSequence[type]}-${fixtureSlug(name)}`,
    type,
    name,
    ...(url ? { url } : { path: `${type}/${name}` }),
    imported_at: scenario.fixedNow
  };
}

function responseForMap(map, url) {
  return map[url.href] ?? map[url.pathname] ?? map[url.pathname.replace(API_PATH, "")];
}

export async function installTestEnvironment(page, options = {}) {
  await recordBaselineManifest(page);
  const runtimeErrors = [];
  const sdkRequests = [];
  const editorOrigin = new URL(EDITOR_URL).origin;
  const scenario = options.scenario?.__editorFixtureScenario
    ? options.scenario
    : createFixtureScenario(options.scenario || {});
  const trackers = options.trackers || createFixtureTrackers();

  page.on("pageerror", error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("request", request => {
    const url = request.url();
    if (url.startsWith(`${API_BASE}/sdk/`)) sdkRequests.push(new URL(url).pathname);
  });
  page.on("requestfailed", request => {
    const url = request.url();
    if (url.startsWith(API_BASE) || url.startsWith(editorOrigin)) {
      runtimeErrors.push(`requestfailed: ${request.method()} ${url} (${request.failure()?.errorText || "onbekend"})`);
    }
  });
  page.on("response", response => {
    const url = response.url();
    if (response.status() >= 400 && (url.startsWith(API_BASE) || url.startsWith(editorOrigin))) {
      runtimeErrors.push(`http ${response.status()}: ${response.request().method()} ${url}`);
    }
  });

  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: ""
  }));
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  await page.route(`${API_BASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin || "http://127.0.0.1:47114";
    const corsHeaders = {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": request.headers()["access-control-request-headers"]
        || "Content-Type, Authorization, X-Leerpret-SDK, X-Leerpret-Client, X-Leerpret-Request, X-Leerpret-Session, X-Leerpret-Role, X-Organization, X-API-Key",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-origin": origin,
      "access-control-expose-headers": "Content-Disposition, Content-Type"
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }
    const record = await requestRecord(request);
    if (url.pathname === `${API_PATH}/sdk/session` || url.pathname === `${API_PATH}/sdk/session/refresh`) {
      await fulfillFixture(route, corsHeaders, { token: "editor-e2e-session", expiresAt: 4_102_444_800 });
      return;
    }
    if (url.pathname.startsWith(`${API_PATH}/sdk/`)) {
      await route.continue();
      return;
    }
    trackers.requests.push(record);
    const track = (name, extra = {}) => trackers[name].push({ ...record, ...extra });
    const failUnknown = async detail => {
      runtimeErrors.push(`onverwachte API-call: ${request.method()} ${url.pathname}${detail ? ` (${detail})` : ""}`);
      await fulfillFixture(route, corsHeaders, {
        status: 503,
        body: { detail: detail || "Geen Playwright-fixture voor deze API-route" }
      });
    };

    if (url.pathname === `${API_PATH}/auth/editor-access` && request.method() === "GET") {
      await fulfillFixture(route, corsHeaders, {
        allowed: true,
        roles: [options.role || "architect"],
        user: { id: "e2e-user", label: "Playwright gebruiker" }
      }, { record, scenario, trackers });
      return;
    }

    if (url.pathname === `${API_PATH}/simulator/datasets`) {
      await fulfillFixture(route, corsHeaders, { leerbox_twins: scenario.twins }, { record, scenario, trackers });
      return;
    }

    const apiPrefix = escapeRegExp(API_PATH);
    let match = url.pathname.match(new RegExp(`^${apiPrefix}/leerbox/captures/([^/]+)$`));
    if (match && request.method() === "GET") {
      const leerboxId = decodeURIComponent(match[1]);
      track("selectedCaptures", { leerboxId });
      await fulfillFixture(route, corsHeaders, scenario.selectedCapture, { record, leerboxId, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/leerbox/([^/]+)/autosave$`));
    if (match && request.method() === "POST") {
      const leerboxId = decodeURIComponent(match[1]);
      track("autosaves", { leerboxId, capture: record.json?.capture, paths: record.json?.paths || [] });
      await fulfillFixture(route, corsHeaders, scenario.autosave, { record, leerboxId, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/leerbox/([^/]+)/history$`));
    if (match && request.method() === "GET") {
      const leerboxId = decodeURIComponent(match[1]);
      track("histories", { leerboxId, limit: url.searchParams.get("limit") });
      await fulfillFixture(route, corsHeaders, scenario.history, { record, leerboxId, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/leerbox/([^/]+)/restore/(\\d+)$`));
    if (match && request.method() === "POST") {
      const leerboxId = decodeURIComponent(match[1]);
      const index = Number(match[2]);
      track("restores", { leerboxId, index });
      await fulfillFixture(route, corsHeaders, scenario.restore, { record, leerboxId, index, scenario, trackers });
      return;
    }
    if (url.pathname === `${API_PATH}/developer/previews/generate` && request.method() === "POST") {
      track("previews", { capture: record.json });
      await fulfillFixture(route, corsHeaders, scenario.preview, { record, scenario, trackers });
      return;
    }
    if (url.pathname === `${API_PATH}/leerbox/latex-pdf` && request.method() === "POST") {
      track("pdfs", { latex: record.json?.latex || "" });
      await fulfillFixture(route, corsHeaders, scenario.pdf, { record, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/leerbox-tests/([^/]+)/data$`));
    if (match && request.method() === "GET") {
      const leerboxId = decodeURIComponent(match[1]);
      track("testDatasets", { kind: "catalog", leerboxId });
      await fulfillFixture(route, corsHeaders, scenario.testDatasetCatalog, { record, leerboxId, scenario, trackers });
      return;
    }
    const datasetResponse = responseForMap(scenario.datasetFiles, url);
    if (datasetResponse !== undefined && request.method() === "GET") {
      track("testDatasets", { kind: "file" });
      await fulfillFixture(route, corsHeaders, datasetResponse, { record, scenario, trackers });
      return;
    }
    if (url.pathname === `${API_PATH}/leerbox-agent/status` && request.method() === "GET") {
      track("agentStatuses", { probe: url.searchParams.get("probe") });
      await fulfillFixture(route, corsHeaders, scenario.agentStatus, { record, scenario, trackers });
      return;
    }
    if (url.pathname === `${API_PATH}/leerbox-agent/chat` && request.method() === "POST") {
      track("agentChats", {
        role: record.json?.role,
        mode: record.json?.mode,
        useProjectBucket: record.json?.use_project_bucket,
        bucketSourceIds: record.json?.bucket_source_ids || []
      });
      if (!scenario.agentChatQueue.length) {
        await failUnknown("agentChat-queue is leeg");
        return;
      }
      const response = scenario.agentChatQueue.shift();
      await fulfillFixture(route, corsHeaders, response, { record, scenario, trackers });
      return;
    }

    match = url.pathname.match(new RegExp(`^${apiPrefix}/project-buckets/([^/]+)/sources/([^/]+)/download$`));
    if (match && request.method() === "GET") {
      const leerboxId = decodeURIComponent(match[1]);
      const sourceId = decodeURIComponent(match[2]);
      track("sourceDownloads", { leerboxId, sourceId, role: url.searchParams.get("role") });
      const response = scenario.sourceDownloads[sourceId];
      if (response === undefined) {
        await failUnknown(`geen downloadfixture voor bron ${sourceId}`);
        return;
      }
      await fulfillFixture(route, corsHeaders, response, { record, leerboxId, sourceId, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/project-buckets/([^/]+)/config$`));
    if (match && request.method() === "PUT") {
      const leerboxId = decodeURIComponent(match[1]);
      track("projectConfigs", { leerboxId, config: record.json?.config });
      await fulfillFixture(route, corsHeaders, scenario.projectConfig, { record, leerboxId, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/project-buckets/([^/]+)/(documents|zip)$`));
    if (match && request.method() === "POST") {
      const leerboxId = decodeURIComponent(match[1]);
      const endpoint = match[2];
      const type = endpoint === "documents" ? "document" : "zip";
      track("uploads", { leerboxId, type });
      const configured = type === "document" ? scenario.documentUpload : scenario.zipUpload;
      const source = defaultImportedSource(scenario, type, record);
      const response = configured === undefined
        ? { source }
        : await configuredResponse(configured, { record, leerboxId, source, scenario, trackers });
      const responseSource = isResponseDescriptor(response) ? response.body?.source : response?.source;
      addBucketSource(scenario, responseSource);
      await fulfillFixture(route, corsHeaders, response, { record, leerboxId, source, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/project-buckets/([^/]+)/(repository|website)$`));
    if (match && request.method() === "POST") {
      const leerboxId = decodeURIComponent(match[1]);
      const type = match[2];
      track(type === "repository" ? "repositoryImports" : "websiteImports", {
        leerboxId,
        importedUrl: record.json?.url || ""
      });
      const configured = type === "repository" ? scenario.repositoryImport : scenario.websiteImport;
      const source = defaultImportedSource(scenario, type, record);
      const response = configured === undefined
        ? { source }
        : await configuredResponse(configured, { record, leerboxId, source, scenario, trackers });
      const responseSource = isResponseDescriptor(response) ? response.body?.source : response?.source;
      addBucketSource(scenario, responseSource);
      await fulfillFixture(route, corsHeaders, response, { record, leerboxId, source, scenario, trackers });
      return;
    }
    match = url.pathname.match(new RegExp(`^${apiPrefix}/project-buckets/([^/]+)$`));
    if (match && request.method() === "GET") {
      const leerboxId = decodeURIComponent(match[1]);
      track("projectBuckets", { leerboxId, role: url.searchParams.get("role") });
      const response = scenario.projectBucketResponse === undefined
        ? scenario.projectBucket
        : scenario.projectBucketResponse;
      await fulfillFixture(route, corsHeaders, response, { record, leerboxId, scenario, trackers });
      return;
    }

    await failUnknown();
  });

  await page.addInitScript(({ fixedNow, initialLocalStorage }) => {
    const NativeDate = globalThis.Date;
    const fixedEpoch = NativeDate.parse(fixedNow);
    function FixedDate(...args) {
      if (!new.target) return new NativeDate(fixedEpoch).toString();
      return Reflect.construct(NativeDate, args.length ? args : [fixedEpoch], new.target);
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.prototype = NativeDate.prototype;
    FixedDate.now = () => fixedEpoch;
    globalThis.Date = FixedDate;

    const marker = "leerbox-editor.playwright-session-v1";
    if (sessionStorage.getItem(marker) !== "1") {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(marker, "1");
      Object.entries(initialLocalStorage || {}).forEach(([key, value]) => {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      });
    }
    window.__editorClipboardWrites = [];
    window.__editorWindowOpenCalls = [];
    window.__editorDownloadCalls = [];
    window.__editorMessages = window.__editorMessages || [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text) {
          window.__editorClipboardWrites.push(String(text));
          return Promise.resolve();
        },
        readText() {
          return Promise.resolve(window.__editorClipboardWrites.at(-1) || "");
        }
      }
    });
    Object.defineProperty(window, "open", {
      configurable: true,
      value(url, target, features) {
        window.__editorWindowOpenCalls.push({ url: String(url || ""), target: String(target || ""), features: String(features || "") });
        return { closed: false, close() { this.closed = true; }, focus() {} };
      }
    });
    const blobUrls = new Map();
    const nativeCreateObjectUrl = URL.createObjectURL.bind(URL);
    const nativeRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = nativeCreateObjectUrl(blob);
      blobUrls.set(url, { type: blob?.type || "", size: Number(blob?.size || 0) });
      return url;
    };
    URL.revokeObjectURL = url => {
      nativeRevokeObjectUrl(url);
      blobUrls.delete(String(url));
    };
    const trackDownloadLink = link => {
      window.__editorDownloadCalls.push({
        filename: link.download,
        href: link.href,
        ...(blobUrls.get(link.href) || {})
      });
    };
    const programmaticDownloadLinks = new WeakSet();
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        programmaticDownloadLinks.add(this);
        trackDownloadLink(this);
      }
      try {
        return nativeAnchorClick.call(this);
      } finally {
        programmaticDownloadLinks.delete(this);
      }
    };
    window.addEventListener("message", event => {
      if (window.__editorHostOwnMessageTracker) return;
      let data = event.data;
      try { data = structuredClone(event.data); } catch { /* bewaar de originele testwaarde */ }
      window.__editorMessages.push({
        data,
        type: data?.type,
        origin: event.origin,
        fromSelf: event.source === window,
        fromParent: event.source === window.parent
      });
    });
    document.addEventListener("click", event => {
      const link = event.target.closest?.("a[download]");
      if (!link || programmaticDownloadLinks.has(link)) return;
      trackDownloadLink(link);
    }, true);
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.dataset.playwrightDeterminism = "true";
      style.textContent = `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
          caret-color: transparent !important;
        }
        html, body, button, input, select, textarea, output { font-family: Arial, sans-serif !important; }
        code, pre, .mono, .kicker { font-family: "Courier New", monospace !important; }
      `;
      document.head.appendChild(style);
    }, { once: true });
  }, { fixedNow: scenario.fixedNow, initialLocalStorage: scenario.initialLocalStorage });

  return { runtimeErrors, sdkRequests, scenario, trackers };
}

export async function settleRenderedOutput(target) {
  await target.evaluate(async () => {
    await document.fonts.ready;
    const freezeOpenShadowTrees = root => {
      if (!root.querySelectorAll) return;
      root.querySelectorAll("*").forEach(element => {
        const shadow = element.shadowRoot;
        if (!shadow) return;
        if (!shadow.querySelector('style[data-playwright-shadow-determinism="true"]')) {
          const style = document.createElement("style");
          style.dataset.playwrightShadowDeterminism = "true";
          style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
          shadow.appendChild(style);
        }
        freezeOpenShadowTrees(shadow);
      });
    };
    freezeOpenShadowTrees(document);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // SDK-componenten mogen in de eerste twee frames een nieuw open shadow
    // root monteren. Bevries ook die boom vóór de fingerprint/screenshot.
    freezeOpenShadowTrees(document);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function screenshotRenderedOutput(target, screenshotPage = target) {
  await target.evaluate(async () => {
    const style = document.createElement("style");
    style.dataset.playwrightScreenshotRasterDeterminism = "true";
    // Chromium compositet SVG drop-shadows op kleine kabelsignalen soms anders
    // bij identieke DOM/CSS/SVG. De productie-CSS wordt vóór deze tijdelijke
    // stijl exact gefingerprint; de screenshot blijft vorm, kleur en positie
    // van signalen en live kabels onverminderd meten.
    style.textContent = `
      .cable-signal { opacity: 0 !important; filter: none !important; }
      .lego-flow-stud-preview { filter: none !important; }
    `;
    document.head.appendChild(style);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  try {
    return await screenshotPage.screenshot({ caret: "hide", scale: "css" });
  } finally {
    await target.evaluate(() => {
      document.querySelector('style[data-playwright-screenshot-raster-determinism="true"]')?.remove();
    });
  }
}

async function waitForEditor(editor, { chrome = true } = {}) {
  if (chrome) {
    await expect(editor.locator("body")).toHaveClass(/has-editor-chrome/);
    await expect(editor.locator('[data-editor-chrome="1"]')).toHaveAttribute("data-chrome-wired", "1");
    await expect(editor.locator(".editor-page-menu")).toBeVisible();
    await expect(editor.locator('.editor-page-menu [data-object-preset="entry"] .lego-flow-tool-preview svg')).toBeVisible();
  } else {
    await expect(editor.locator("body")).not.toHaveClass(/is-workbench-embedded/);
    await expect(editor.locator(".object-toolbox")).toBeVisible();
    await expect(editor.locator('.object-toolbox [data-object-preset="entry"] .lego-flow-tool-preview svg')).toBeVisible();
  }
  await expect.poll(() => editor.evaluate(() => {
    const previews = [...document.querySelectorAll("[data-category-preview]")];
    return previews.length === 3 && previews.every(preview => Boolean(preview.shadowRoot?.querySelector("svg")));
  }), { timeout: 20_000 }).toBe(true);
  await settleRenderedOutput(editor);
}

export function buildEditorPath(options = {}) {
  if (options.editorPath) return options.editorPath;
  const hasQueryOverrides = options.role !== undefined
    || options.leerboxId !== undefined
    || options.view !== undefined
    || options.workspace !== undefined
    || options.embedded !== undefined
    || options.query !== undefined;
  if (!hasQueryOverrides) return EDITOR_PATH;
  const params = new URLSearchParams(new URL(EDITOR_URL).search);
  const set = (name, value) => {
    if (value === null || value === false || value === "") params.delete(name);
    else if (value !== undefined) params.set(name, value === true ? "1" : String(value));
  };
  set("embedded", options.embedded);
  set("role", options.role);
  set("leerbox_id", options.leerboxId);
  set("view", options.view);
  set("workspace", options.workspace);
  Object.entries(options.query || {}).forEach(([name, value]) => set(name, value));
  return `?${params.toString()}`;
}

export async function prepareEditorPage(page, options = {}) {
  const testState = await installTestEnvironment(page, options);
  const editorPath = buildEditorPath(options);

  await page.goto(editorPath);
  await waitForEditor(page);

  return { ...testState, editorPath };
}

export async function prepareEditorFrame(page, options = {}) {
  const testState = await installTestEnvironment(page, options);
  const hostUrl = new URL("/__playwright-editor-host.html", EDITOR_URL);
  const childUrl = new URL(buildEditorPath(options), EDITOR_BASE);
  childUrl.searchParams.set("parent_origin", hostUrl.origin);
  const html = `<!doctype html>
    <html><head><meta charset="utf-8"><style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #07171c; }
      #dashboard-editor { display: block; width: 100%; height: 100%; border: 0; }
    </style></head><body><iframe id="dashboard-editor" title="LeerboxEditor"></iframe><script>
      window.__editorHostOwnMessageTracker = true;
      window.__editorMessages = [];
      const editorFrame = document.getElementById("dashboard-editor");
      window.addEventListener("message", event => window.__editorMessages.push({
        data: event.data,
        type: event.data && event.data.type,
        workspaceView: event.data && event.data.workspace_view,
        objectCount: event.data && event.data.capture && Array.isArray(event.data.capture.objects)
          ? event.data.capture.objects.length : null,
        fromEditor: event.source === editorFrame.contentWindow,
        origin: event.origin
      }));
      editorFrame.src = ${JSON.stringify(childUrl.href)};
    </script></body></html>`;
  await page.route(hostUrl.href, route => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
  await page.goto(hostUrl.href);
  const iframe = page.locator("#dashboard-editor");
  await expect(iframe).toBeVisible();
  const handle = await iframe.elementHandle();
  const editor = await handle.contentFrame();
  if (!editor) throw new Error("Het dashboard-iframe heeft geen Editor-frame gekoppeld.");
  await waitForEditor(editor, { chrome: String(options.embedded ?? "1") !== "0" });

  return { ...testState, editor, iframe, editorOrigin: childUrl.origin, editorPath: childUrl.href };
}

function trackerSource(value) {
  return value?.trackers || value;
}

function matchesValue(actual, expected, record) {
  if (typeof expected === "function") return Boolean(expected(actual, record));
  if (expected instanceof RegExp) return expected.test(String(actual));
  return actual === expected;
}

function matchesRequest(record, matcher) {
  if (typeof matcher === "function") return Boolean(matcher(record));
  if (matcher instanceof RegExp) return matcher.test(`${record.method} ${record.pathname}${record.search}`);
  if (typeof matcher === "string") return record.pathname === matcher || record.url === matcher;
  return Object.entries(matcher || {}).every(([key, expected]) => matchesValue(record[key], expected, record));
}

export function requestLog(testStateOrTrackers, matcher = () => true) {
  const trackers = trackerSource(testStateOrTrackers);
  return (trackers?.requests || []).filter(record => matchesRequest(record, matcher));
}

export async function waitForRequestLog(testStateOrTrackers, matcher, count = 1) {
  await expect.poll(() => requestLog(testStateOrTrackers, matcher).length).toBeGreaterThanOrEqual(count);
  return requestLog(testStateOrTrackers, matcher);
}

export async function getClipboardWrites(target) {
  return target.evaluate(() => [...(window.__editorClipboardWrites || [])]);
}

export async function getWindowOpenCalls(target) {
  return target.evaluate(() => [...(window.__editorWindowOpenCalls || [])]);
}

export async function getDownloadCalls(target) {
  return target.evaluate(() => [...(window.__editorDownloadCalls || [])]);
}

export async function getBrowserMessages(target) {
  return target.evaluate(() => [...(window.__editorMessages || [])]);
}

export async function clearBrowserMessages(target) {
  await target.evaluate(() => {
    window.__editorMessages = [];
  });
}

export async function postSelfMessage(target, message, targetOrigin = "*") {
  await target.evaluate(({ payload, origin }) => window.postMessage(payload, origin), {
    payload: message,
    origin: targetOrigin
  });
}

export async function postEditorMessage(hostPage, message, targetOrigin, iframeSelector = "#dashboard-editor") {
  await hostPage.evaluate(({ selector, payload, origin }) => {
    const frame = document.querySelector(selector);
    if (!frame?.contentWindow) throw new Error(`Iframe ${selector} ontbreekt.`);
    frame.contentWindow.postMessage(payload, origin);
  }, { selector: iframeSelector, payload: message, origin: targetOrigin });
}

export async function waitForBrowserMessage(target, matcher) {
  await expect.poll(async () => {
    const messages = await getBrowserMessages(target);
    return messages.some(message => {
      if (typeof matcher === "function") return matcher(message);
      if (typeof matcher === "string") return message.type === matcher;
      return Object.entries(matcher || {}).every(([key, expected]) => matchesValue(message[key], expected, message));
    });
  }).toBe(true);
  return getBrowserMessages(target);
}

export function handleNextDialog(page, testStateOrTrackers, options = {}) {
  const trackers = trackerSource(testStateOrTrackers);
  const action = options.action || "dismiss";
  return new Promise((resolve, reject) => {
    page.once("dialog", async dialog => {
      const record = {
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
        action,
        promptText: options.promptText || ""
      };
      trackers?.dialogs?.push(record);
      try {
        if (options.type !== undefined && !matchesValue(record.type, options.type, record)) {
          throw new Error(`Verwacht dialogtype ${options.type}, kreeg ${record.type}.`);
        }
        if (options.message !== undefined && !matchesValue(record.message, options.message, record)) {
          throw new Error(`Onverwachte dialogtekst: ${record.message}`);
        }
        if (action === "accept") await dialog.accept(options.promptText);
        else await dialog.dismiss();
        resolve(record);
      } catch (error) {
        try { await dialog.dismiss(); } catch { /* dialog was al afgehandeld */ }
        reject(error);
      }
    });
  });
}

export async function runWithDialog(page, testStateOrTrackers, trigger, options = {}) {
  const handled = handleNextDialog(page, testStateOrTrackers, options);
  await trigger();
  return handled;
}

export async function captureDownload(page, trigger) {
  const downloadPromise = page.waitForEvent("download");
  await trigger();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const browserCalls = (await Promise.all(page.frames().map(frame =>
    frame.evaluate(() => [...(window.__editorDownloadCalls || [])]).catch(() => [])
  ))).flat();
  const browserCall = browserCalls.at(-1) || null;
  return {
    download,
    suggestedFilename: download.suggestedFilename(),
    body,
    text: body.toString("utf8"),
    contentType: browserCall?.type || "",
    browserCall
  };
}

export async function expectDownload(page, trigger, expected = {}) {
  const result = await captureDownload(page, trigger);
  if (expected.filename !== undefined) {
    if (expected.filename instanceof RegExp) expect(result.suggestedFilename).toMatch(expected.filename);
    else expect(result.suggestedFilename).toBe(expected.filename);
  }
  if (expected.body !== undefined) {
    if (Buffer.isBuffer(expected.body) || expected.body instanceof Uint8Array) {
      expect(result.body.equals(Buffer.from(expected.body))).toBe(true);
    } else if (expected.body instanceof RegExp) {
      expect(result.text).toMatch(expected.body);
    } else {
      expect(result.text).toBe(String(expected.body));
    }
  }
  const expectedContentType = expected.contentType ?? expected.mime;
  if (expectedContentType !== undefined) {
    if (expectedContentType instanceof RegExp) expect(result.contentType).toMatch(expectedContentType);
    else expect(result.contentType).toBe(expectedContentType);
  }
  if (expected.json !== undefined) expect(JSON.parse(result.text)).toEqual(expected.json);
  return result;
}

export async function addChromePreset(page, preset, expectedCount) {
  const button = page.locator(`.editor-page-menu [data-object-preset="${preset}"]`);
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(page.locator("#networkNodes .network-node")).toHaveCount(expectedCount);
}

export async function waitForSettledCanvas(page) {
  await expect(page.locator(".network-node.is-just-added")).toHaveCount(0, { timeout: 4_000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function addFourCanonicalObjects(page) {
  await addChromePreset(page, "entry", 1);
  await addChromePreset(page, "success", 2);
  await addChromePreset(page, "resistance", 3);
  await addChromePreset(page, "normal", 4);
  await waitForSettledCanvas(page);
}

export async function expectNoRuntimeErrors(page, runtimeErrors) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(50);
  expect(runtimeErrors).toEqual([]);
}

export function captureFromStorage(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("leerpretarchitect-capture-v1")));
}
