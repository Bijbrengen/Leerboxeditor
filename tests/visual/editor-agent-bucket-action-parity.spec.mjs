import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  EDITOR_BASE,
  buildEditorPath,
  createFixtureScenario,
  getBrowserMessages,
  getClipboardWrites,
  getDownloadCalls,
  installTestEnvironment,
  prepareEditorFrame,
  screenshotRenderedOutput,
  settleRenderedOutput
} from "./fixtures.mjs";
import {
  captureOutputFingerprint,
  stableJsonStringify
} from "./output-fingerprint.mjs";
import {
  SCREENSHOT_COMPARISON,
  screenshotSnapshotName
} from "./screenshot-comparison.mjs";

const ACTION_SMOKE = process.env.LEERBOX_EDITOR_ACTION_SMOKE === "1";
const BASELINE_COMMIT = "bcc4b886dac2b804c225bc3b1208e5d9e89f9ecb";

const BUCKET_ACTIONS = Object.freeze([
  "bucket-agent-view-loaded",
  "bucket-drawer-open",
  "bucket-source-checkbox-unchecked",
  "bucket-source-checkbox-checked",
  "bucket-source-download",
  "bucket-document-filechooser-import",
  "bucket-zip-filechooser-import",
  "bucket-repository-prompt-import",
  "bucket-website-prompt-import",
  "bucket-drawer-close",
  "bucket-panel-close",
  "bucket-legacy-source-controls-unreachable"
]);

const AGENT_ACTIONS = Object.freeze([
  "agent-view-loaded",
  "agent-template-mode-selected",
  "agent-template-field-filled",
  "agent-template-send-token-cancelled",
  "agent-document-drawer-open",
  "agent-source-consent-disabled",
  "agent-source-consent-enabled",
  "agent-document-drawer-closed",
  "agent-capture-mode-free-input",
  "agent-capture-send-confirmed",
  "agent-capture-applied",
  "agent-testdata-mode-free-input",
  "agent-testdata-send-confirmed",
  "agent-testdata-applied",
  "agent-conversation-reset",
  "agent-panel-closed"
]);

const TRACE_ACTIONS = Object.freeze([
  "technologist-agent-send-confirmed",
  "technologist-trace-open",
  "technologist-trace-close"
]);

const FIELD_AGENT_ACTIONS = Object.freeze([
  "field-agent-token-dialog-open",
  "field-agent-result-dialog-open",
  "field-agent-result-closed-and-applied"
]);

const SOURCE_FILL_ACTIONS = Object.freeze([
  "source-fill-apply-token-dialog-open",
  "source-fill-apply-result-dialog-open",
  "source-fill-apply-proposal-open",
  "source-fill-mutation-selected",
  "source-fill-approved-mutation-applied",
  "source-fill-continue-token-dialog-open",
  "source-fill-continue-result-dialog-open",
  "source-fill-continue-proposal-open",
  "source-fill-continue-selected",
  "source-fill-next-round-result-dialog-open",
  "source-fill-next-round-proposal-open",
  "source-fill-next-round-cancelled"
]);

/**
 * Gesloten, machineleesbaar bewijs voor de catalogusscenario's die deze spec
 * bezit. `historicalUnreachable` is geen stilzwijgende uitzondering: iedere
 * selector wordt in de eerste test opnieuw als niet-actionable bewezen.
 */
export const AGENT_BUCKET_ACTION_COVERAGE = Object.freeze({
  schemaVersion: 1,
  scenarioIds: Object.freeze([
    "agent-conversation",
    "agent-token-dialogs",
    "agent-trace",
    "agent-field-fill",
    "bucket-drawer",
    "bucket-import",
    "bucket-fill"
  ]),
  actionIds: Object.freeze([
    ...BUCKET_ACTIONS,
    ...AGENT_ACTIONS,
    ...TRACE_ACTIONS,
    ...FIELD_AGENT_ACTIONS,
    ...SOURCE_FILL_ACTIONS
  ]),
  visibleControls: Object.freeze([
    "#agentResetConversationButton",
    "#agentNewConversationButton",
    "#agentPanelCloseButton",
    "#agentMode",
    "#agentDocumentCloseButton",
    "#agentBucketConsent",
    "#agentInput",
    "#agentSendButton",
    "#agentApplyCaptureButton",
    "#agentApplyTestDataButton",
    "#agentImportDocumentsButton",
    "#agentImportZipButton",
    "#agentImportRepositoryButton",
    "#agentImportWebsiteButton",
    "#fillFromSourcesButton",
    "#sourceFillCancelButton",
    "#sourceFillContinueButton",
    "#sourceFillApplyButton",
    "#agentTokenDialog button[value=\"cancel\"]",
    "#agentTokenDialog button[value=\"confirm\"]",
    "#agentCallResultDialog button[value=\"close\"]",
    "#agentTraceToggle",
    "#agentTraceClose",
    "[data-template-field]",
    "[data-bucket-source-id]",
    ".bucket-source-download-link",
    ".field-agent-button[data-agent-field-path]",
    "[data-mutation-index]"
  ]),
  indirectlyActivatedControls: Object.freeze([
    {
      selector: "#sourceDocumentInput",
      via: "#agentImportDocumentsButton",
      interaction: "visible-button-filechooser"
    },
    {
      selector: "#sourceZipInput",
      via: "#agentImportZipButton",
      interaction: "visible-button-filechooser"
    }
  ]),
  historicalUnreachable: Object.freeze([
    {
      baselineCommit: BASELINE_COMMIT,
      selectors: Object.freeze([
        "#importDocumentsButton",
        "#importZipButton",
        "#importRepositoryButton",
        "#importWebsiteButton",
        "#repositoryUrl",
        "#repositoryImportForm button[type=\"submit\"]",
        "#websiteUrl",
        "#websiteImportForm button[type=\"submit\"]",
        "#refreshBucketButton"
      ]),
      reason: "activateWorkbenchView() zet #sourceImporter in de historische en huidige Editor voor iedere view op hidden; er bestaat geen zichtbare gebruikerstrigger naar deze legacy-controls. De zichtbare documentlade gebruikt #agentImport* en ververst na iedere import automatisch."
    }
  ])
});

const FIXED_CAPTURE_RESULT = Object.freeze({
  schema_version: "1.0.0",
  metadata: Object.freeze({
    leerbox_id: "e2e-fixture",
    work_name: "Agent-capture uit Playwright",
    type: "game",
    status: "prototype",
    domain: "agent-test",
    summary: "Deterministische capture uit de Agent."
  }),
  objects: Object.freeze([]),
  interaction_route: Object.freeze([]),
  freedom_and_sequence: Object.freeze({ route_model: "free", hard_dependencies: Object.freeze([]) })
});

const FIXED_TESTDATA_RESULT = Object.freeze([
  Object.freeze({
    timestamp: "2026-08-28T08:00:00.000Z",
    user_id: "agent-user",
    learning_object_id: "startobject"
  }),
  Object.freeze({
    timestamp: "2026-08-28T08:00:08.000Z",
    user_id: "agent-user",
    learning_object_id: "succesobject"
  })
]);

const SOURCE_FILL_CAPTURE = Object.freeze({
  schema_version: "1.0.0",
  metadata: Object.freeze({
    leerbox_id: "e2e-fixture",
    work_name: "Bestaande bronnaam",
    type: "unknown",
    status: "unknown",
    domain: "unknown",
    summary: "unknown"
  }),
  pedagogical_core: Object.freeze({
    central_learning_goal: "Bestaand leerdoel",
    success_definition: "unknown"
  }),
  objects: Object.freeze([]),
  interaction_route: Object.freeze([]),
  freedom_and_sequence: Object.freeze({ route_model: "free", hard_dependencies: Object.freeze([]) })
});

function agentJsonResponse(value, options = {}) {
  return {
    message: {
      role: "assistant",
      content: `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
    },
    usage: options.usage || {
      prompt_tokens: 240,
      completion_tokens: 60,
      total_tokens: 300,
      prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 10 }
    },
    ...(options.trace ? { trace: options.trace } : {})
  };
}

function bytesSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonSha256(value) {
  return bytesSha256(Buffer.from(stableJsonStringify(value), "utf8"));
}

function normalizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
      return `${url.pathname}${url.search}`;
    }
    return url.href;
  } catch {
    return String(value);
  }
}

function summarizeJsonBody(body) {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) return { arrayLength: body.length, sha256: jsonSha256(body) };
  const summary = {};
  if (Object.hasOwn(body, "url")) summary.url = body.url;
  if (Object.hasOwn(body, "role")) summary.role = body.role;
  if (Object.hasOwn(body, "mode")) summary.mode = body.mode;
  if (Object.hasOwn(body, "leerbox_id")) summary.leerboxId = body.leerbox_id;
  if (Object.hasOwn(body, "use_project_bucket")) summary.useProjectBucket = body.use_project_bucket;
  if (Object.hasOwn(body, "bucket_source_ids")) summary.bucketSourceIds = body.bucket_source_ids;
  if (Array.isArray(body.messages)) {
    summary.messages = body.messages.map(message => ({
      role: message.role,
      characters: String(message.content || "").length,
      sha256: bytesSha256(Buffer.from(String(message.content || ""), "utf8"))
    }));
  }
  if (body.capture) summary.captureSha256 = jsonSha256(body.capture);
  if (body.config) summary.configSha256 = jsonSha256(body.config);
  return summary;
}

function normalizeRequest(record) {
  const jsonBody = record.json == null ? null : record.json;
  const multipart = jsonBody == null && record.postDataBuffer;
  return {
    method: record.method,
    pathname: record.pathname,
    query: record.query || {},
    roleHeader: record.headers?.["x-leerpret-role"] || "",
    body: jsonBody == null
      ? multipart
        ? {
            kind: "multipart",
            byteLength: record.postDataBuffer.length,
            fileNames: record.fileNames || [],
            fieldNames: record.fieldNames || []
          }
        : null
      : {
          kind: "json",
          sha256: jsonSha256(jsonBody),
          summary: summarizeJsonBody(jsonBody)
        }
  };
}

function normalizeMessage(message) {
  const data = message.data && typeof message.data === "object" ? message.data : null;
  const semantic = data ? {
    type: data.type,
    count: data.count,
    workspaceView: data.workspace_view,
    status: data.status,
    score: data.score,
    previewUrl: normalizeUrl(data.preview_url),
    captureSha256: data.capture ? jsonSha256(data.capture) : undefined
  } : null;
  return {
    type: message.type || data?.type || "",
    origin: message.fromEditor || message.fromSelf ? "<editor-origin>" : normalizeUrl(message.origin),
    fromEditor: Boolean(message.fromEditor),
    fromSelf: Boolean(message.fromSelf),
    sha256: data ? jsonSha256(data) : jsonSha256(message.data ?? null),
    semantic
  };
}

function normalizeDownloadCall(call) {
  return {
    filename: call.filename || "",
    href: normalizeUrl(call.href),
    type: call.type || "",
    size: Number(call.size || 0)
  };
}

function effectCursor() {
  return {
    request: 0,
    message: 0,
    clipboard: 0,
    downloadCall: 0,
    error: 0
  };
}

async function clickUser(target, selector) {
  const control = target.locator(selector);
  await expect(control, `${selector} ontbreekt`).toHaveCount(1);
  await expect(control, `${selector} is geen zichtbaar gebruikerstraject`).toBeVisible();
  await expect(control, `${selector} is niet bedienbaar`).toBeEnabled();
  await control.evaluate(element => element.scrollIntoView({ block: "center", inline: "center" }));
  await settleRenderedOutput(target);
  await control.scrollIntoViewIfNeeded({ timeout: 10_000 });
  const safePoint = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const fractions = [
      [0.5, 0.5], [0.25, 0.5], [0.75, 0.5],
      [0.25, 0.25], [0.5, 0.25], [0.75, 0.25],
      [0.25, 0.75], [0.5, 0.75], [0.75, 0.75],
      [0.1, 0.5], [0.9, 0.5]
    ];
    for (const [fx, fy] of fractions) {
      const x = rect.left + rect.width * fx;
      const y = rect.top + rect.height * fy;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === element || element.contains(hit))) {
        return { viewportX: x, viewportY: y };
      }
    }
    return null;
  });
  const browserPage = typeof target.page === "function" ? target.page() : target;
  if (!safePoint) {
    await control.focus({ timeout: 10_000 });
    await expect(control, `${selector} is ook niet via het toetsenbord bereikbaar`).toBeFocused();
    await browserPage.keyboard.press("Enter");
    return;
  }
  let frameOffset = { x: 0, y: 0 };
  if (typeof target.frameElement === "function") {
    const frameElement = await target.frameElement();
    const frameBox = await frameElement.boundingBox();
    expect(frameBox, `${selector} heeft geen zichtbaar host-frame`).not.toBeNull();
    frameOffset = { x: frameBox.x, y: frameBox.y };
  }
  await browserPage.mouse.click(
    frameOffset.x + safePoint.viewportX,
    frameOffset.y + safePoint.viewportY
  );
}

async function selectUser(target, selector, value) {
  const control = target.locator(selector);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.selectOption(value, { timeout: 10_000 });
}

async function fillUser(target, selector, value) {
  const control = target.locator(selector);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.fill(value, { timeout: 10_000 });
}

async function chooseFileFromVisibleButton(page, target, buttonSelector, file) {
  const button = target.locator(buttonSelector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const chooserPromise = page.waitForEvent("filechooser");
  await button.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

async function answerPromptFromVisibleButton(page, target, buttonSelector, value) {
  const button = target.locator(buttonSelector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const dialogPromise = page.waitForEvent("dialog");
  const clickPromise = button.click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("prompt");
  const evidence = { type: dialog.type(), message: dialog.message(), acceptedValue: value };
  await dialog.accept(value);
  await clickPromise;
  return evidence;
}

async function downloadFromVisibleLink(page, link) {
  await expect(link).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click()
  ]);
  const path = await download.path();
  const bytes = await readFile(path);
  return {
    suggestedFilename: download.suggestedFilename(),
    size: bytes.length,
    sha256: bytesSha256(bytes)
  };
}

async function checkpoint(target, screenshotPage, records, actionId, state, options = {}) {
  await settleRenderedOutput(target);
  if (ACTION_SMOKE) {
    records.push({ actionId });
    return;
  }

  const allMessages = await getBrowserMessages(state.messageTarget || target);
  const allClipboard = await getClipboardWrites(target);
  const allDownloadCalls = await getDownloadCalls(target);
  const requests = state.trackers.requests.slice(state.cursor.request).map(normalizeRequest);
  const messages = allMessages.slice(state.cursor.message).map(normalizeMessage);
  const clipboard = allClipboard.slice(state.cursor.clipboard);
  const downloadCalls = allDownloadCalls.slice(state.cursor.downloadCall).map(normalizeDownloadCall);
  const errors = state.runtimeErrors.slice(state.cursor.error);
  state.cursor.request = state.trackers.requests.length;
  state.cursor.message = allMessages.length;
  state.cursor.clipboard = allClipboard.length;
  state.cursor.downloadCall = allDownloadCalls.length;
  state.cursor.error = state.runtimeErrors.length;

  const downloads = [...downloadCalls, ...(options.downloads || [])];
  const fingerprint = await captureOutputFingerprint(target, {
    scenario: "agent-bucket-complete-action-matrix",
    checkpoint: actionId,
    roots: ["body"],
    network: requests,
    messages,
    downloads
  });
  const screenshot = await screenshotRenderedOutput(target, screenshotPage);
  try {
    await expect(screenshot).toMatchSnapshot(screenshotSnapshotName(actionId), SCREENSHOT_COMPARISON);
  } catch (error) {
    await test.info().attach(`${actionId}-fingerprint.json`, {
      body: Buffer.from(`${stableJsonStringify(fingerprint, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
    error.message += `\nSemantische checkpoint-hashes: ${stableJsonStringify({
      dom: fingerprint.dom.sha256,
      css: fingerprint.css.sha256,
      geometry: fingerprint.geometry.sha256,
      svg: fingerprint.svg.sha256,
      state: fingerprint.state.sha256
    })}`;
    throw error;
  }
  records.push({
    actionId,
    control: options.control || "",
    fingerprintSha256: fingerprint.sha256,
    output: {
      dom: fingerprint.dom.sha256,
      css: fingerprint.css.sha256,
      geometry: fingerprint.geometry.sha256,
      svg: fingerprint.svg.sha256,
      state: fingerprint.state.sha256,
      assets: fingerprint.assets.sha256
    },
    effects: {
      requests,
      messages,
      clipboard,
      downloads,
      errors,
      ...(options.evidence ? { evidence: options.evidence } : {})
    }
  });
}

function testState(fixtureState, messageTarget) {
  return {
    ...fixtureState,
    messageTarget,
    cursor: effectCursor()
  };
}

async function expectGolden(records, expectedActions, snapshotName) {
  expect(records.map(record => record.actionId)).toEqual(expectedActions);
  expect(new Set(records.map(record => record.actionId)).size).toBe(records.length);
  if (!ACTION_SMOKE) {
    expect(`${stableJsonStringify(records, 2)}\n`).toMatchSnapshot(snapshotName);
  }
}

async function waitForTracker(trackers, name, count) {
  await expect.poll(() => trackers[name].length, `${name} bleef onder ${count}`).toBeGreaterThanOrEqual(count);
}

async function captureFromEditorStorage(target, leerboxId = "e2e-fixture") {
  return target.evaluate((id) => {
    const scoped = id ? `leerpretarchitect-capture-v1:${id}` : "leerpretarchitect-capture-v1";
    const value = localStorage.getItem(scoped) || localStorage.getItem("leerpretarchitect-capture-v1");
    return value ? JSON.parse(value) : null;
  }, leerboxId);
}

async function prepareNonEmbeddedEditorFrame(page, options = {}) {
  const fixture = await installTestEnvironment(page, options);
  const hostUrl = new URL("/__playwright-nonembedded-editor-host.html", EDITOR_BASE);
  const childUrl = new URL(buildEditorPath({ ...options, embedded: 0 }), EDITOR_BASE);
  childUrl.searchParams.set("parent_origin", hostUrl.origin);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { width:100%; height:100%; margin:0; background:#07171c; }
    #dashboard-editor { display:block; width:100%; height:100%; border:0; }
  </style></head><body><iframe id="dashboard-editor" title="LeerboxEditor"></iframe><script>
    window.__editorHostOwnMessageTracker = true;
    window.__editorMessages = [];
    const editorFrame = document.getElementById("dashboard-editor");
    window.addEventListener("message", event => window.__editorMessages.push({
      data: event.data,
      type: event.data && event.data.type,
      fromEditor: event.source === editorFrame.contentWindow,
      origin: event.origin
    }));
    editorFrame.src = ${JSON.stringify(childUrl.href)};
  </script></body></html>`;
  await page.route(hostUrl.href, route => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: html
  }));
  await page.goto(hostUrl.href);
  const iframe = page.locator("#dashboard-editor");
  await expect(iframe).toBeVisible();
  const handle = await iframe.elementHandle();
  const editor = await handle.contentFrame();
  if (!editor) throw new Error("Het niet-embedded Editor-frame kon niet worden gekoppeld.");
  await expect(editor.locator("body")).not.toHaveClass(/is-workbench-embedded/);
  await expect(editor.locator(`[data-workbench-view="${options.view || "build"}"]`)).toHaveAttribute("aria-selected", "true");
  const chromeCollapse = editor.locator("#editor-menu-collapse");
  await expect(chromeCollapse).toHaveAttribute("aria-expanded", "true");
  await clickUser(editor, "#editor-menu-collapse");
  await expect(chromeCollapse).toHaveAttribute("aria-expanded", "false");
  await editor.evaluate(() => document.fonts.ready);
  return { ...fixture, editor, iframe, editorOrigin: childUrl.origin, editorPath: childUrl.href };
}

async function openTokenDialogAndChoose(target, choice) {
  await expect(target.locator("#agentTokenDialog")).toHaveAttribute("open", "");
  await clickUser(target, `#agentTokenDialog button[value="${choice}"]`);
  await expect(target.locator("#agentTokenDialog")).not.toHaveAttribute("open", "");
}

async function closeAgentResult(target) {
  await expect(target.locator("#agentCallResultDialog")).toHaveAttribute("open", "");
  await clickUser(target, '#agentCallResultDialog button[value="close"]');
  await expect(target.locator("#agentCallResultDialog")).not.toHaveAttribute("open", "");
}

test.describe("echte bronnen-, bucket- en Agent-acties", () => {
  test("zichtbare bucketdrawer importeert, selecteert en downloadt; legacybroncontrols blijven aantoonbaar onbereikbaar", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario();
    const fixture = await prepareEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      view: "agent",
      scenario
    });
    const { editor, trackers } = fixture;
    const state = testState(fixture, page);
    const records = [];

    await waitForTracker(trackers, "selectedCaptures", 1);
    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    await checkpoint(editor, page, records, "bucket-agent-view-loaded", state, {
      control: '[data-workbench-view="agent"]'
    });

    await clickUser(editor, "#agentNewConversationButton");
    await expect(editor.locator("#agentBucketConsentPanel")).toHaveClass(/is-open/);
    await waitForTracker(trackers, "projectBuckets", 1);
    await expect(editor.locator("#agentBucketSources [data-bucket-source-id]")).toHaveCount(1);
    await checkpoint(editor, page, records, "bucket-drawer-open", state, {
      control: "#agentNewConversationButton"
    });

    const sourceCheckbox = editor.locator("#agentBucketSources [data-bucket-source-id]").first();
    await expect(sourceCheckbox).toBeChecked();
    await sourceCheckbox.click();
    await expect(sourceCheckbox).not.toBeChecked();
    await checkpoint(editor, page, records, "bucket-source-checkbox-unchecked", state, {
      control: "#agentBucketSources [data-bucket-source-id]"
    });
    await sourceCheckbox.click();
    await expect(sourceCheckbox).toBeChecked();
    await checkpoint(editor, page, records, "bucket-source-checkbox-checked", state, {
      control: "#agentBucketSources [data-bucket-source-id]"
    });

    const downloadedSource = await downloadFromVisibleLink(
      page,
      editor.locator("#agentBucketSources .bucket-source-download-link").first()
    );
    await waitForTracker(trackers, "sourceDownloads", 1);
    await checkpoint(editor, page, records, "bucket-source-download", state, {
      control: ".bucket-source-download-link",
      downloads: [downloadedSource]
    });

    const documentFile = {
      name: "architectuur-notities.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Deterministische architectuurnotities.\n", "utf8")
    };
    await chooseFileFromVisibleButton(page, editor, "#agentImportDocumentsButton", documentFile);
    await waitForTracker(trackers, "uploads", 1);
    await expect(editor.locator("#bucketStatus")).toHaveAttribute("data-state", "success");
    await checkpoint(editor, page, records, "bucket-document-filechooser-import", state, {
      control: "#agentImportDocumentsButton -> #sourceDocumentInput",
      evidence: {
        file: { name: documentFile.name, size: documentFile.buffer.length, sha256: bytesSha256(documentFile.buffer) }
      }
    });

    const zipFile = {
      name: "leerbox-bronnen.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("504b0304140000000000", "hex")
    };
    await chooseFileFromVisibleButton(page, editor, "#agentImportZipButton", zipFile);
    await waitForTracker(trackers, "uploads", 2);
    await expect(editor.locator("#bucketStatus")).toHaveAttribute("data-state", "success");
    await checkpoint(editor, page, records, "bucket-zip-filechooser-import", state, {
      control: "#agentImportZipButton -> #sourceZipInput",
      evidence: {
        file: { name: zipFile.name, size: zipFile.buffer.length, sha256: bytesSha256(zipFile.buffer) }
      }
    });

    const repositoryDialog = await answerPromptFromVisibleButton(
      page,
      editor,
      "#agentImportRepositoryButton",
      "https://github.com/leerpret/e2e-bronnen.git"
    );
    await waitForTracker(trackers, "repositoryImports", 1);
    await expect(editor.locator("#bucketStatus")).toHaveAttribute("data-state", "success");
    await checkpoint(editor, page, records, "bucket-repository-prompt-import", state, {
      control: "#agentImportRepositoryButton",
      evidence: { dialog: repositoryDialog }
    });

    const websiteDialog = await answerPromptFromVisibleButton(
      page,
      editor,
      "#agentImportWebsiteButton",
      "https://voorbeeld.nl/leerarchitectuur"
    );
    await waitForTracker(trackers, "websiteImports", 1);
    await expect(editor.locator("#bucketStatus")).toHaveAttribute("data-state", "success");
    await checkpoint(editor, page, records, "bucket-website-prompt-import", state, {
      control: "#agentImportWebsiteButton",
      evidence: { dialog: websiteDialog }
    });

    await clickUser(editor, "#agentDocumentCloseButton");
    await expect(editor.locator("#agentBucketConsentPanel")).not.toHaveClass(/is-open/);
    await checkpoint(editor, page, records, "bucket-drawer-close", state, {
      control: "#agentDocumentCloseButton"
    });

    await clickUser(editor, "#agentPanelCloseButton");
    await expect(editor.locator('[data-workbench-view="build"]')).toHaveAttribute("aria-selected", "true");
    await checkpoint(editor, page, records, "bucket-panel-close", state, {
      control: "#agentPanelCloseButton"
    });

    await expect(editor.locator("#sourceImporter")).toBeHidden();
    for (const historical of AGENT_BUCKET_ACTION_COVERAGE.historicalUnreachable[0].selectors) {
      await expect(editor.locator(historical), `${historical} werd onverwacht een zichtbaar gebruikerspad`).toBeHidden();
    }
    await checkpoint(editor, page, records, "bucket-legacy-source-controls-unreachable", state, {
      control: "#sourceImporter[hidden]",
      evidence: AGENT_BUCKET_ACTION_COVERAGE.historicalUnreachable[0]
    });

    await expectGolden(records, BUCKET_ACTIONS, "agent-bucket-actions-01-import-download.json");
  });

  test("Agent-template, vrije invoer, consent, tokenkeuzes en toepassen van capture/testdata blijven gelijk", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario({
      agentChats: [
        agentJsonResponse(FIXED_CAPTURE_RESULT),
        agentJsonResponse(FIXED_TESTDATA_RESULT)
      ]
    });
    const fixture = await prepareNonEmbeddedEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      view: "agent",
      scenario
    });
    const { editor, trackers } = fixture;
    const state = testState(fixture, page);
    const records = [];

    await waitForTracker(trackers, "selectedCaptures", 1);
    await clickUser(editor, '[data-workbench-view="agent"]');
    await waitForTracker(trackers, "projectBuckets", 1);
    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    await expect(editor.locator("#agentSendButton")).toBeEnabled();
    await checkpoint(editor, page, records, "agent-view-loaded", state, {
      control: '[data-workbench-view="agent"]'
    });

    await selectUser(editor, "#agentMode", "start_description");
    await expect(editor.locator('[data-template-field="0"]')).toBeVisible();
    await checkpoint(editor, page, records, "agent-template-mode-selected", state, {
      control: "#agentMode"
    });
    await fillUser(editor, '[data-template-field="0"]', "Een mensgerichte leerarchitectuur met bronbewijs.");
    await checkpoint(editor, page, records, "agent-template-field-filled", state, {
      control: '[data-template-field="0"]'
    });
    await clickUser(editor, "#agentSendButton");
    await openTokenDialogAndChoose(editor, "cancel");
    await expect(editor.locator("#agentStatusLabel")).toContainText("geannuleerd");
    expect(trackers.agentChats).toHaveLength(0);
    await checkpoint(editor, page, records, "agent-template-send-token-cancelled", state, {
      control: '#agentTokenDialog button[value="cancel"]'
    });

    await clickUser(editor, "#agentNewConversationButton");
    await expect(editor.locator("#agentBucketConsentPanel")).toHaveClass(/is-open/);
    await expect(editor.locator("#agentBucketSources [data-bucket-source-id]").first()).toBeChecked();
    await checkpoint(editor, page, records, "agent-document-drawer-open", state, {
      control: "#agentNewConversationButton"
    });
    await expect(editor.locator("#agentBucketConsent")).toBeVisible();
    await expect(editor.locator("#agentBucketConsent")).toBeChecked();
    await clickUser(editor, 'label[for="agentBucketConsent"]');
    await expect(editor.locator("#agentBucketConsent")).not.toBeChecked();
    await checkpoint(editor, page, records, "agent-source-consent-disabled", state, {
      control: "#agentBucketConsent"
    });
    await clickUser(editor, 'label[for="agentBucketConsent"]');
    await expect(editor.locator("#agentBucketConsent")).toBeChecked();
    await checkpoint(editor, page, records, "agent-source-consent-enabled", state, {
      control: "#agentBucketConsent"
    });
    await clickUser(editor, "#agentDocumentCloseButton");
    await expect(editor.locator("#agentBucketConsentPanel")).not.toHaveClass(/is-open/);
    await checkpoint(editor, page, records, "agent-document-drawer-closed", state, {
      control: "#agentDocumentCloseButton"
    });

    await selectUser(editor, "#agentMode", "capture");
    await fillUser(editor, "#agentInput", "Maak exact de afgesproken capture-JSON.");
    await checkpoint(editor, page, records, "agent-capture-mode-free-input", state, {
      control: "#agentMode + #agentInput"
    });
    await clickUser(editor, "#agentSendButton");
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 1);
    await expect(editor.locator("#agentApplyCaptureButton")).toBeVisible();
    await expect(editor.locator("#agentConversation .assistant")).toContainText("Agent-capture uit Playwright");
    await checkpoint(editor, page, records, "agent-capture-send-confirmed", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    expect(trackers.agentChats[0].json).toMatchObject({
      role: "architect",
      mode: "capture",
      use_project_bucket: true,
      bucket_source_ids: ["bron-een"]
    });
    await clickUser(editor, "#agentApplyCaptureButton");
    await expect(editor.locator('[data-workbench-view="intake"]')).toHaveAttribute("aria-selected", "true");
    expect((await captureFromEditorStorage(editor)).metadata.work_name).toBe("Agent-capture uit Playwright");
    await checkpoint(editor, page, records, "agent-capture-applied", state, {
      control: "#agentApplyCaptureButton"
    });

    await clickUser(editor, '[data-workbench-view="agent"]');
    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    await selectUser(editor, "#agentMode", "testdata");
    await fillUser(editor, "#agentInput", "Maak exact de afgesproken testdata-array.");
    await checkpoint(editor, page, records, "agent-testdata-mode-free-input", state, {
      control: "#agentMode + #agentInput"
    });
    await clickUser(editor, "#agentSendButton");
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 2);
    await expect(editor.locator("#agentApplyTestDataButton")).toBeVisible();
    await checkpoint(editor, page, records, "agent-testdata-send-confirmed", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    await clickUser(editor, "#agentApplyTestDataButton");
    await expect(editor.locator('[data-workbench-view="simulation"]')).toHaveAttribute("aria-selected", "true");
    await expect(editor.locator("#testDataInput")).toHaveValue(/agent-user/);
    await checkpoint(editor, page, records, "agent-testdata-applied", state, {
      control: "#agentApplyTestDataButton"
    });

    await clickUser(editor, '[data-workbench-view="agent"]');
    await clickUser(editor, "#agentResetConversationButton");
    await expect(editor.locator("#agentConversation")).toContainText("wacht op je eerste bericht");
    await checkpoint(editor, page, records, "agent-conversation-reset", state, {
      control: "#agentResetConversationButton"
    });
    await clickUser(editor, "#agentPanelCloseButton");
    await expect(editor.locator('[data-workbench-view="build"]')).toHaveAttribute("aria-selected", "true");
    await checkpoint(editor, page, records, "agent-panel-closed", state, {
      control: "#agentPanelCloseButton"
    });

    await expectGolden(records, AGENT_ACTIONS, "agent-bucket-actions-02-conversation-apply.json");
  });

  test("technoloog opent en sluit de echte trace na een Agent-call", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario({
      agentChats: [{
        message: { role: "assistant", content: "Deterministisch antwoord voor de technoloog." },
        usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
        trace: {
          request: { deployment: "gpt-5.6-sol", messages: 1 },
          response: { id: "trace-e2e", finish_reason: "stop" }
        }
      }]
    });
    const fixture = await prepareNonEmbeddedEditorFrame(page, {
      role: "technologist",
      leerboxId: "e2e-fixture",
      view: "agent",
      scenario
    });
    const { editor, trackers } = fixture;
    const state = testState(fixture, page);
    const records = [];

    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    await fillUser(editor, "#agentInput", "Geef de deterministische technoloogtrace.");
    await clickUser(editor, "#agentSendButton");
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 1);
    await expect(editor.locator("#agentConversation .assistant")).toContainText("technoloog");
    await checkpoint(editor, page, records, "technologist-agent-send-confirmed", state, {
      control: "#agentInput + #agentSendButton"
    });

    await clickUser(editor, "#agentTraceToggle");
    await expect(editor.locator("#agentTracePanel")).toBeVisible();
    await expect(editor.locator("#agentTraceOutput")).toContainText("trace-e2e");
    await checkpoint(editor, page, records, "technologist-trace-open", state, {
      control: "#agentTraceToggle"
    });
    await clickUser(editor, "#agentTraceClose");
    await expect(editor.locator("#agentTracePanel")).toBeHidden();
    await checkpoint(editor, page, records, "technologist-trace-close", state, {
      control: "#agentTraceClose"
    });

    await expectGolden(records, TRACE_ACTIONS, "agent-bucket-actions-03-technologist-trace.json");
  });

  test("dynamische veld-Agent doorloopt tokeninschatting, werkelijk gebruik en veldtoepassing", async ({ page }) => {
    test.setTimeout(600_000);
    const fieldPath = "metadata.work_name";
    const scenario = createFixtureScenario({
      selectedCapture: {
        ...SOURCE_FILL_CAPTURE,
        metadata: { ...SOURCE_FILL_CAPTURE.metadata, work_name: "unknown" }
      },
      agentChats: [agentJsonResponse({ path: fieldPath, value: "Veldinvulling uit Playwright" })]
    });
    const fixture = await prepareNonEmbeddedEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      view: "intake",
      scenario
    });
    const { editor, trackers } = fixture;
    const state = testState(fixture, page);
    const records = [];

    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    const fieldButton = editor.locator(`.field-agent-button[data-agent-field-path="${fieldPath}"]`);
    await expect(fieldButton).toBeVisible();
    await fieldButton.click();
    await expect(editor.locator("#agentTokenDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "field-agent-token-dialog-open", state, {
      control: `.field-agent-button[data-agent-field-path="${fieldPath}"]`
    });
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 1);
    await expect(editor.locator("#agentCallResultDialog")).toHaveAttribute("open", "");
    await expect(editor.locator("#agentCallResultMessage")).toContainText("invulling");
    await checkpoint(editor, page, records, "field-agent-result-dialog-open", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    await closeAgentResult(editor);
    await expect(editor.locator('input[name="metadata.work_name"]')).toHaveValue("Veldinvulling uit Playwright");
    await checkpoint(editor, page, records, "field-agent-result-closed-and-applied", state, {
      control: '#agentCallResultDialog button[value="close"]'
    });

    expect(trackers.agentChats[0].json).toMatchObject({
      mode: "fill_field",
      messages: [{ role: "user" }]
    });
    await expectGolden(records, FIELD_AGENT_ACTIONS, "agent-bucket-actions-04-field-agent.json");
  });

  test("velden uit bronnen ondersteunt mutation-selectie, toepassen, doorgaan en annuleren", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario({
      selectedCapture: SOURCE_FILL_CAPTURE,
      agentChats: [
        agentJsonResponse({
          _fill_meta: { has_more: false },
          patch: {
            metadata: {
              summary: "Nieuwe samenvatting uit de bron.",
              work_name: "Eerste voorgestelde naam"
            }
          }
        }),
        agentJsonResponse({
          _fill_meta: { has_more: true, reason: "Een tweede bronsectie is nog beschikbaar." },
          patch: {
            pedagogical_core: { success_definition: "Succes uit de bron." },
            metadata: { work_name: "Tweede voorgestelde naam" }
          }
        }),
        agentJsonResponse({
          _fill_meta: { has_more: false },
          patch: { metadata: { work_name: "Niet toepassen uit laatste ronde" } }
        })
      ]
    });
    const fixture = await prepareNonEmbeddedEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      view: "agent",
      scenario
    });
    const { editor, trackers } = fixture;
    const state = testState(fixture, page);
    const records = [];

    await waitForTracker(trackers, "selectedCaptures", 1);
    await expect(editor.locator("#agentStatus")).toHaveAttribute("data-state", "online");
    await clickUser(editor, "#agentNewConversationButton");
    await waitForTracker(trackers, "projectBuckets", 1);
    await expect(editor.locator("#fillFromSourcesButton")).toBeVisible();
    await expect(editor.locator("#fillFromSourcesButton")).toBeEnabled();

    await clickUser(editor, "#fillFromSourcesButton");
    await expect(editor.locator("#agentTokenDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-apply-token-dialog-open", state, {
      control: "#fillFromSourcesButton"
    });
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 1);
    await expect(editor.locator("#agentCallResultDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-apply-result-dialog-open", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    await closeAgentResult(editor);
    await expect(editor.locator("#sourceFillDialog")).toHaveAttribute("open", "");
    await expect(editor.locator("[data-mutation-index]")).toHaveCount(1);
    await checkpoint(editor, page, records, "source-fill-apply-proposal-open", state, {
      control: '#agentCallResultDialog button[value="close"]'
    });
    await editor.locator('[data-mutation-index="0"]').click();
    await expect(editor.locator('[data-mutation-index="0"]')).toBeChecked();
    await checkpoint(editor, page, records, "source-fill-mutation-selected", state, {
      control: '[data-mutation-index="0"]'
    });
    await clickUser(editor, "#sourceFillApplyButton");
    await expect(editor.locator("#sourceFillDialog")).not.toHaveAttribute("open", "");
    await expect(editor.locator("#fillFromSourcesStatus")).toContainText("toegepast");
    await checkpoint(editor, page, records, "source-fill-approved-mutation-applied", state, {
      control: "#sourceFillApplyButton"
    });

    await clickUser(editor, "#fillFromSourcesButton");
    await expect(editor.locator("#agentTokenDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-continue-token-dialog-open", state, {
      control: "#fillFromSourcesButton"
    });
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 2);
    await expect(editor.locator("#agentCallResultDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-continue-result-dialog-open", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    await closeAgentResult(editor);
    await expect(editor.locator("#sourceFillDialog")).toHaveAttribute("open", "");
    await expect(editor.locator("#sourceFillContinueButton")).toBeVisible();
    await checkpoint(editor, page, records, "source-fill-continue-proposal-open", state, {
      control: '#agentCallResultDialog button[value="close"]'
    });
    await editor.locator('[data-mutation-index="0"]').click();
    await clickUser(editor, "#sourceFillContinueButton");
    await expect(editor.locator("#sourceFillDialog")).not.toHaveAttribute("open", "");
    await expect(editor.locator("#agentTokenDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-continue-selected", state, {
      control: "#sourceFillContinueButton"
    });
    await openTokenDialogAndChoose(editor, "confirm");
    await waitForTracker(trackers, "agentChats", 3);
    await expect(editor.locator("#agentCallResultDialog")).toHaveAttribute("open", "");
    await checkpoint(editor, page, records, "source-fill-next-round-result-dialog-open", state, {
      control: '#agentTokenDialog button[value="confirm"]'
    });
    await closeAgentResult(editor);
    await expect(editor.locator("#sourceFillDialog")).toHaveAttribute("open", "");
    await expect(editor.locator("[data-mutation-index]")).toHaveCount(1);
    await checkpoint(editor, page, records, "source-fill-next-round-proposal-open", state, {
      control: '#agentCallResultDialog button[value="close"]'
    });
    await clickUser(editor, "#sourceFillCancelButton");
    await expect(editor.locator("#sourceFillDialog")).not.toHaveAttribute("open", "");
    await expect(editor.locator("#fillFromSourcesStatus")).toHaveText("Geen wijzigingen toegepast.");
    await checkpoint(editor, page, records, "source-fill-next-round-cancelled", state, {
      control: "#sourceFillCancelButton"
    });

    const stored = await captureFromEditorStorage(editor);
    expect(stored.metadata.work_name).toBe("Tweede voorgestelde naam");
    expect(stored.metadata.summary).toBe("Nieuwe samenvatting uit de bron.");
    expect(stored.pedagogical_core.success_definition).toBe("Succes uit de bron.");
    expect(trackers.agentChats.map(call => call.mode)).toEqual([
      "fill_from_sources",
      "fill_from_sources",
      "fill_from_sources"
    ]);
    await expectGolden(records, SOURCE_FILL_ACTIONS, "agent-bucket-actions-05-source-fill.json");
  });
});
