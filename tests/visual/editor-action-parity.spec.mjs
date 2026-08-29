import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  API_BASE,
  addChromePreset,
  captureFromStorage,
  clearBrowserMessages,
  createFixtureScenario,
  getBrowserMessages,
  getClipboardWrites,
  expectNoRuntimeErrors,
  postEditorMessage,
  prepareEditorFrame,
  prepareEditorPage,
  requestLog,
  screenshotRenderedOutput,
  settleRenderedOutput,
  waitForBrowserMessage,
  waitForRequestLog,
  waitForSettledCanvas
} from "./fixtures.mjs";
import {
  captureOutputFingerprint,
  sha256Hex,
  stableJsonStringify
} from "./output-fingerprint.mjs";
import {
  SCREENSHOT_COMPARISON,
  actionSnapshotSlug,
  screenshotSnapshotName
} from "./screenshot-comparison.mjs";

const FIXED_EVENTS = Object.freeze([
  { timestamp: "2026-08-28T08:00:00.000Z", user_id: "e2e-user", learning_object_id: "startobject" },
  { timestamp: "2026-08-28T08:00:05.000Z", user_id: "e2e-user", learning_object_id: "weerstandsobject" },
  { timestamp: "2026-08-28T08:00:12.000Z", user_id: "e2e-user", learning_object_id: "leerobject" },
  { timestamp: "2026-08-28T08:00:18.000Z", user_id: "e2e-user", learning_object_id: "succesobject" }
]);
const ACTION_SMOKE = process.env.LEERBOX_EDITOR_ACTION_SMOKE === "1";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function checkpoint(page, records, action, {
  roots = ["body"],
  network = [],
  messages = [],
  downloads = [],
  errors = [],
  screenshotPage = page
} = {}) {
  await settleRenderedOutput(page);
  if (ACTION_SMOKE) {
    console.log(`ACTION_SMOKE ${action}`);
    records.push({ action });
    return;
  }
  const fingerprint = await captureOutputFingerprint(page, {
    scenario: "complete-action-matrix",
    checkpoint: action,
    roots,
    network,
    messages,
    downloads
  });
  const screenshot = await screenshotRenderedOutput(page, screenshotPage);
  try {
    await expect(screenshot).toMatchSnapshot(screenshotSnapshotName(action), SCREENSHOT_COMPARISON);
  } catch (error) {
    await test.info().attach(`${action}-fingerprint.json`, {
      body: Buffer.from(`${stableJsonStringify(fingerprint, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
    error.message += `\nSemantische checkpoint-hashes: ${stableJsonStringify({
      dom: fingerprint.dom.sha256,
      css: fingerprint.css.sha256,
      geometry: fingerprint.geometry.sha256,
      svg: sha256Hex(fingerprint.svg.drawables || []),
      state: fingerprint.state.sha256
    })}`;
    throw error;
  }
  records.push({
    action,
    domSha256: fingerprint.dom.sha256,
    cssSha256: fingerprint.css.sha256,
    geometrySha256: fingerprint.geometry.sha256,
    svgDrawablesSha256: sha256Hex(fingerprint.svg.drawables || []),
    stateSha256: fingerprint.state.sha256,
    network: fingerprint.assets.networkTrace || [],
    messages: fingerprint.messages.items || [],
    downloads: fingerprint.downloads.items || [],
    errors: [...errors]
  });
}

async function expectActionGolden(records, name) {
  if (ACTION_SMOKE) {
    expect(records.length, `${name} bevat geen acties`).toBeGreaterThan(0);
    expect(new Set(records.map(record => record.action)).size, `${name} bevat dubbele actie-ID's`).toBe(records.length);
    return;
  }
  expect(`${stableJsonStringify(records, 2)}\n`).toMatchSnapshot(name);
}

async function clickAndRecord(page, records, selector, action, options) {
  const control = page.locator(selector);
  await expect(control).toHaveCount(1);
  await activateControl(control);
  await checkpoint(page, records, action, options);
}

async function activateControl(control) {
  if (await control.isVisible() && await control.isEnabled()) {
    await control.click();
    return "pointer";
  }
  // Sommige legacy-controls blijven bewust als verborgen programmatic API in
  // de DOM staan. HTMLElement.click() volgt voor die controls exact het pad
  // dat ook het toegestane postMessage-contract aanroept.
  await control.evaluate(element => element.click());
  return "programmatic";
}

async function setControlValue(control, value, eventType = "input") {
  await control.evaluate((element, next) => {
    element.value = next.value;
    element.dispatchEvent(new Event(next.eventType, { bubbles: true }));
  }, { value, eventType });
}

async function clickElementCenter(page, control) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function movePointerToCanvasReference(page) {
  const canvas = page.locator("#networkCanvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // Relatief aan het actuele canvas, zodat viewport- en paneelgroottes geen
  // hard-coded schermcoördinaat in deze browseractie introduceren.
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.18);
}

async function nativeDragElement(page, source, target, targetPosition) {
  const rect = element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const [sourceBox, targetBox] = await Promise.all([
    source.evaluate(rect),
    target.evaluate(rect)
  ]);
  expect(sourceBox.width).toBeGreaterThan(0);
  expect(sourceBox.height).toBeGreaterThan(0);
  expect(targetBox.width).toBeGreaterThan(targetPosition.x);
  expect(targetBox.height).toBeGreaterThan(targetPosition.y);
  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const finish = { x: targetBox.x + targetPosition.x, y: targetBox.y + targetPosition.y };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(finish.x, finish.y, { steps: 12 });
  await page.mouse.up();
}

async function chooseFilesViaButton(page, button, files) {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const chooserPromise = page.waitForEvent("filechooser");
  await button.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(files);
}

function networkEvidence(trackers) {
  return requestLog(trackers).map(record => ({
    method: record.method,
    url: record.url,
    pathname: record.pathname,
    query: record.query,
    jsonSha256: record.json == null ? null : sha256Hex(record.json),
    postDataSha256: record.postData == null ? null : sha256Hex(record.postData),
    fileNames: record.fileNames,
    fieldNames: record.fieldNames
  })).sort((left, right) => stableJsonStringify(left).localeCompare(stableJsonStringify(right)));
}

function messageEvidence(messages) {
  return messages
    .filter(message => message.fromEditor || message.fromSelf || message.fromParent)
    .map(message => ({
      type: message.type,
      origin: message.origin,
      fromEditor: Boolean(message.fromEditor),
      fromSelf: Boolean(message.fromSelf),
      fromParent: Boolean(message.fromParent),
      dataSha256: sha256Hex(message.data),
      workspaceView: message.data?.workspace_view || message.workspaceView || "",
      previewUrl: message.data?.preview_url || "",
      status: message.data?.status || "",
      sourceCount: message.data?.count ?? null,
      objectCount: Array.isArray(message.data?.capture?.objects)
        ? message.data.capture.objects.length
        : message.objectCount ?? null
    }));
}

async function capturedDownload(page, action) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    action()
  ]);
  const path = await download.path();
  const bytes = await readFile(path);
  return {
    suggestedFilename: download.suggestedFilename(),
    sha256: digest(bytes),
    size: bytes.length
  };
}

test.describe("volledige LeerboxEditor-actiekarakterisering", () => {
  test("alle navigatie-, paneel-, workspace- en lokale chrome-acties blijven gelijk", async ({ page }) => {
    test.setTimeout(600_000);
    const { runtimeErrors } = await prepareEditorPage(page, { role: "architect" });
    const records = [];
    await checkpoint(page, records, "navigation-initial");

    for (const view of ["description", "agent", "sources", "intake", "build", "validation", "simulation", "json"]) {
      const button = page.locator(`[data-workbench-view="${view}"]`);
      await expect(button).toHaveCount(1);
      await activateControl(button);
      await checkpoint(page, records, `workbench-${view}`);
    }

    for (const panel of ["overview", "design", "game", "entry", "measurement"]) {
      await activateControl(page.locator('[data-workbench-view="intake"]'));
      await activateControl(page.locator(`.tab-button[data-panel="${panel}"]`));
      await checkpoint(page, records, `intake-panel-${panel}`);
    }

    for (const workspace of ["latex", "architecture", "vat", "statements"]) {
      await activateControl(page.locator('[data-workbench-view="build"]'));
      await activateControl(page.locator(`.workspace-view-button[data-workspace-view="${workspace}"]`));
      await checkpoint(page, records, `workspace-${workspace}`);
    }
    const workspaceCloseButtons = page.locator("[data-workspace-close]");
    for (let index = 0; index < await workspaceCloseButtons.count(); index += 1) {
      await activateControl(page.locator('.workspace-view-button[data-workspace-view="architecture"]'));
      await activateControl(workspaceCloseButtons.nth(index));
      await checkpoint(page, records, `workspace-close-${index + 1}`);
    }
    await activateControl(page.locator('[data-workbench-view="validation"]'));
    await activateControl(page.locator('[data-workbench-close="build"]'));
    await checkpoint(page, records, "validation-close");

    const chromeViewButtons = page.locator('.editor-page-menu [data-editor-page-view]');
    for (let index = 0; index < await chromeViewButtons.count(); index += 1) {
      const button = chromeViewButtons.nth(index);
      const key = await button.evaluate(element => [
        element.dataset.editorPageView,
        element.dataset.editorPanel || "none",
        element.dataset.editorWorkspaceView || "none",
        element.id || element.title || "button"
      ].join("-"));
      await activateControl(button);
      await checkpoint(page, records, `chrome-view-${index + 1}-${actionSnapshotSlug(key)}`);
    }

    await clickAndRecord(page, records, "#editor-menu-collapse", "chrome-menu-collapse");
    await clickAndRecord(page, records, "#editor-menu-collapse", "chrome-menu-expand");
    await clickAndRecord(page, records, "#editor-advisor-toggle", "chrome-advisor-open");
    for (const [index, title] of ["chat", "scan", "advice", "warnings"].entries()) {
      const button = page.locator("#editor-advisor-panel .editor-advisor-actions button").nth(index);
      await button.click();
      await checkpoint(page, records, `chrome-advisor-${title}-historical-${index === 0 ? "control" : "noop"}`);
    }
    await clickAndRecord(page, records, "#editor-advisor-close", "chrome-advisor-close");
    await page.locator("#editor-tool-flyout").evaluate(element => { element.hidden = false; });
    await clickAndRecord(page, records, "#editor-tool-flyout-close", "chrome-tool-flyout-close");

    await activateControl(page.locator('[data-workbench-view="build"]'));
    await activateControl(page.locator('.workspace-view-button[data-workspace-view="vat"]'));
    await clickAndRecord(page, records, "#toolboxToggle", "canvas-toolbox-expand");
    await clickAndRecord(page, records, "#toolboxToggle", "canvas-toolbox-collapse");
    await clickAndRecord(page, records, "#advisorToggle", "canvas-advisor-expand");
    await clickAndRecord(page, records, "#advisorToggle", "canvas-advisor-collapse");
    await page.locator("#advisorToggle").evaluate(element => element.click());
    await page.locator("#advisorAiEnabled").evaluate(element => {
      element.checked = true;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await checkpoint(page, records, "canvas-advisor-ai-enable", { errors: runtimeErrors });
    await activateControl(page.locator("#openAdvisorAgent"));
    await checkpoint(page, records, "canvas-advisor-open-agent");
    await page.locator("#advisorAiEnabled").evaluate(element => {
      element.checked = false;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await checkpoint(page, records, "canvas-advisor-ai-disable");

    await clickAndRecord(page, records, "#canvasReportToggle", "canvas-report-open");
    await clickAndRecord(page, records, "#canvasReportClose", "canvas-report-close");
    await page.locator("#languageSelect").evaluate(element => {
      element.value = "nl";
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await checkpoint(page, records, "language-nl-change");

    await expectActionGolden(records, "actions-01-navigation-panels.json");
    expect(runtimeErrors).toEqual([
      "pageerror: Cannot set property className of #<SVGElement> which has only a getter"
    ]);
  });

  test("ieder declaratief captureveld gebruikt dezelfde browseractie en levert dezelfde uitvoer", async ({ page }) => {
    test.setTimeout(600_000);
    const { runtimeErrors } = await prepareEditorPage(page, { role: "architect" });
    const records = [];
    const fields = page.locator([
      "#captureForm [name]",
      "#architectureRouteFields [name]",
      '[data-workbench-panel="description"] [name]'
    ].join(","));
    const count = await fields.count();
    expect(count).toBeGreaterThan(35);

    for (let index = 0; index < count; index += 1) {
      const field = fields.nth(index);
      const descriptor = await field.evaluate(element => ({
        tag: element.localName,
        type: element.type || "",
        name: element.name,
        multiple: Boolean(element.multiple),
        options: element instanceof HTMLSelectElement
          ? [...element.options].map(option => option.value)
          : []
      }));
      if (descriptor.tag === "select") {
        const choices = descriptor.options.filter(Boolean);
        const selected = choices.slice(0, descriptor.multiple ? Math.min(2, choices.length) : 1);
        if (selected.length) await field.selectOption(selected, { force: true });
      } else {
        const value = await field.getAttribute("data-list") !== null
          ? `regel-${index + 1}-a\nregel-${index + 1}-b`
          : `Playwright waarde ${index + 1}`;
        await setControlValue(field, value);
      }
      await checkpoint(page, records, `capture-field-${index + 1}-${actionSnapshotSlug(descriptor.name)}`);
    }

    for (const [id, value] of [
      ["rawDescriptionText", "Volledige ruwe beschrijving uit Playwright."],
      ["strategicMission", "Missie uit Playwright"],
      ["strategicMissionActions", "Missiehandeling uit Playwright"],
      ["strategicVision", "Visie uit Playwright"],
      ["strategicVisionActions", "Visiehandeling uit Playwright"],
      ["strategicStrategy", "Strategie uit Playwright"],
      ["strategicStrategyActions", "Strategiehandeling uit Playwright"],
      ["strategicGoals", "Doelen uit Playwright"],
      ["strategicGoalsActions", "Doelhandeling uit Playwright"],
      ["discoveryInput", "Centrale ontdekking uit Playwright"]
    ]) {
      await setControlValue(page.locator(`#${id}`), value);
      await checkpoint(page, records, `strategic-field-${actionSnapshotSlug(id)}`);
    }
    const strategicPhase = page.locator("#strategicPhase");
    const phaseValue = await strategicPhase.locator("option").nth(1).getAttribute("value");
    if (phaseValue) await strategicPhase.selectOption(phaseValue, { force: true });
    await checkpoint(page, records, "strategic-phase");

    await activateControl(page.locator('[data-workbench-view="build"]'));
    await activateControl(page.locator('.workspace-view-button[data-workspace-view="architecture"]'));
    const architectureFields = page.locator("[data-architecture-path]");
    for (let index = 0; index < await architectureFields.count(); index += 1) {
      const field = architectureFields.nth(index);
      const path = await field.getAttribute("data-architecture-path");
      await setControlValue(field, `architectuur-${index + 1}-a\narchitectuur-${index + 1}-b`, "change");
      await checkpoint(page, records, `architecture-field-${actionSnapshotSlug(path)}`);
    }

    const stored = await captureFromStorage(page);
    expect(stored.metadata.work_name).toContain("Playwright");
    await expectActionGolden(records, "actions-02-all-capture-fields.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("object-, blok-, kaart-, kabel- en rapportacties blijven gelijk", async ({ page }) => {
    test.setTimeout(600_000);
    const { runtimeErrors } = await prepareEditorPage(page, { role: "architect" });
    const records = [];

    for (const preset of ["entry", "success", "resistance", "normal"]) {
      const expectedCount = (await page.locator("#networkNodes .network-node").count()) + 1;
      await addChromePreset(page, preset, expectedCount);
      await waitForSettledCanvas(page);
      await checkpoint(page, records, `chrome-preset-${preset}`);
    }
    await page.locator("#toolboxToggle").evaluate(element => element.click());
    for (const preset of ["entry", "success", "resistance", "normal"]) {
      const source = page.locator(`.object-toolbox [data-object-preset="${preset}"]`);
      await source.evaluate(element => element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
      await waitForSettledCanvas(page);
      await checkpoint(page, records, `toolbox-doubleclick-${preset}`);
    }

    await page.locator('[data-object-id="startobject"]').click();
    await page.mouse.move(900, 460);
    await checkpoint(page, records, "link-route-live-rubberband");
    await page.keyboard.press("Escape");
    await checkpoint(page, records, "link-route-cancel-escape");
    await page.locator('[data-object-id="startobject"]').click();
    await page.locator('[data-object-id="startobject"]').click();
    await checkpoint(page, records, "link-route-cancel-same-node");
    await page.locator('[data-object-id="startobject"]').click();
    await page.locator("#networkCanvas").evaluate(element => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 30, clientY: 30 }));
    });
    await checkpoint(page, records, "link-route-cancel-canvas");

    await page.locator("#hud-step-action").click();
    await page.locator('[data-object-id="startobject"]').click();
    await page.locator('[data-object-id="succesobject"]').click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-route-node-to-node");
    await page.locator("#hud-dependency-action").click();
    await page.locator('[data-object-id="weerstandsobject"]').click();
    await page.locator('[data-object-id="succesobject"]').click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-conditional-node-to-node");

    const startStud = page.locator('[data-object-id="startobject"] [data-flow-stud="0:0"]');
    const successStud = page.locator('[data-object-id="succesobject"] [data-flow-stud="1:0"]');
    const resistanceStud = page.locator('[data-object-id="weerstandsobject"] [data-flow-stud="0:1"]');
    await expect(startStud).toBeVisible();
    await page.locator("#hud-step-action").click();
    await startStud.click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-route-stud-live-preview");
    await successStud.click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-route-stud-to-stud");
    await page.locator("#hud-dependency-action").click();
    await resistanceStud.click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-conditional-stud-live-preview");
    await successStud.click();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-conditional-stud-to-stud");
    await page.locator("#hud-dependency-action").click();
    await startStud.click();
    await page.keyboard.press("Escape");
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "link-conditional-stud-cancel-escape");

    const startNode = page.locator('[data-object-id="startobject"]');
    const box = await startNode.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 104, box.y + box.height / 2 + 56, { steps: 8 });
    await page.mouse.up();
    await movePointerToCanvasReference(page);
    await checkpoint(page, records, "node-drag-over-threshold");

    await startNode.dblclick();
    await expect(page.locator("#blockDialog")).toHaveAttribute("open", "");
    await checkpoint(page, records, "node-doubleclick-edit-dialog");
    await page.locator("#cancelDialogButton").click();
    await checkpoint(page, records, "block-dialog-cancel");

    for (const [type, selector] of [
      ["object", "#addObjectButton"],
      ["step", "#addStepButton"],
      ["dependency", "#addDependencyButton"]
    ]) {
      await activateControl(page.locator(selector));
      await checkpoint(page, records, `block-${type}-open-new`);
      const firstText = page.locator("#dialogFields input, #dialogFields textarea").first();
      if (await firstText.count()) await firstText.fill(`Playwright ${type}`);
      await page.locator("#blockForm button[type=submit]").click();
      await checkpoint(page, records, `block-${type}-save-new`);
    }

    const objectCards = page.locator("#objectBlocks .block-card");
    await activateControl(objectCards.first());
    await checkpoint(page, records, "block-object-open-card");
    await page.locator("#closeDialogButton").click();
    await checkpoint(page, records, "block-dialog-close-icon");
    await activateControl(objectCards.last());
    await page.locator("#deleteBlockButton").click();
    await checkpoint(page, records, "block-object-delete");

    const edge = page.locator("#networkEdges [data-block-type]").first();
    if (await edge.count()) {
      await edge.evaluate(element => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await checkpoint(page, records, "cable-edge-open-dialog");
      await page.locator("#cancelDialogButton").evaluate(element => element.click());
    }
    for (const [type, fieldName, value] of [
      ["step", "participant_action", "Gewijzigde routeactie uit Playwright"],
      ["dependency", "reason", "Gewijzigde voorwaarde uit Playwright"]
    ]) {
      const typedEdge = page.locator(`#networkEdges .edge-mark[data-block-type="${type}"] circle`).first();
      await expect(typedEdge).toHaveCount(1);
      await clickElementCenter(page, typedEdge);
      await expect(page.locator("#blockDialog")).toHaveAttribute("open", "");
      await page.locator(`#dialogFields [name="${fieldName}"]`).fill(value);
      await page.locator("#blockForm button[type=submit]").click();
      await checkpoint(page, records, `block-${type}-edit-save-from-cable`);

      const updatedEdge = page.locator(`#networkEdges .edge-mark[data-block-type="${type}"] circle`).first();
      await clickElementCenter(page, updatedEdge);
      await page.locator("#deleteBlockButton").click();
      await checkpoint(page, records, `block-${type}-delete-from-cable`);
    }
    const drawers = page.locator("details.inspector-drawer");
    for (let index = 0; index < await drawers.count(); index += 1) {
      await drawers.nth(index).evaluate(element => {
        element.open = !element.open;
        element.dispatchEvent(new Event("toggle"));
      });
      await checkpoint(page, records, `inspector-drawer-${index + 1}-toggle`);
    }

    await activateControl(page.locator("#canvasReportToggle"));
    const reportRoutes = page.locator("[data-report-route]");
    for (let index = 0; index < await reportRoutes.count(); index += 1) {
      await activateControl(reportRoutes.nth(index));
      await checkpoint(page, records, `report-route-${index + 1}-highlight`);
    }
    await activateControl(page.locator("#canvasReportClose"));
    await checkpoint(page, records, "report-close-after-route");

    // De compacte embedded chrome vervangt de klassieke toolbox door gewone
    // presetknoppen. In de zelfstandige editor blijft HTML5 drag-and-drop een
    // echt gebruikerspad; voer dat daarom in die zichtbare layout uit.
    const { editor: standaloneEditor, runtimeErrors: standaloneRuntimeErrors } = await prepareEditorFrame(page, {
      role: "architect",
      embedded: "0"
    });
    const dragSource = standaloneEditor.locator('.object-toolbox [data-object-preset="entry"]');
    await expect(standaloneEditor.locator("#networkCanvas")).toBeVisible();
    await expect(dragSource).toBeVisible();
    await expect.poll(() => standaloneEditor.locator("#networkNodes .network-node").count()).toBeGreaterThan(0);
    const draggedObjectCount = (await standaloneEditor.locator("#networkNodes .network-node").count()) + 1;
    await nativeDragElement(page, dragSource, standaloneEditor.locator("#networkCanvas"), { x: 520, y: 360 });
    await expect.poll(() => standaloneEditor.locator("#networkNodes .network-node").count()).toBe(draggedObjectCount);
    await waitForSettledCanvas(standaloneEditor);
    await checkpoint(standaloneEditor, records, "standalone-toolbox-native-drag-to-grid", { screenshotPage: page });
    await expectNoRuntimeErrors(standaloneEditor, standaloneRuntimeErrors);

    await expectActionGolden(records, "actions-03-authoring-map-cables.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("import, export, prompt, plan, reset en simulatie voeren alle browseracties gelijk uit", async ({ page }) => {
    test.setTimeout(600_000);
    const { runtimeErrors } = await prepareEditorPage(page, { role: "architect" });
    const records = [];

    await page.locator("#rawDescriptionInput").setInputFiles({
      name: "beschrijving.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Vaste beschrijving\n\nEen leerbox uit Playwright.\n")
    });
    await checkpoint(page, records, "file-import-description-markdown");

    const importedCapture = {
      schema_version: "leerbox_capture_v5",
      metadata: {
        work_name: "Geimporteerde leerbox",
        leerbox_id: "geimporteerde-leerbox",
        type: "leerroute",
        status: "concept"
      },
      pedagogical_core: {
        central_learning_goal: "De deelnemer doorloopt de vaste route.",
        success_definition: "De deelnemer bereikt aantoonbaar de uitgang."
      },
      participants: { primary_target_group: "Testdeelnemers" },
      entry_and_orientation: {
        first_visible_action: "Open het startobject.",
        self_starting_signal: "De startknop licht op.",
        proactive_invitation: "Kies de eerste stap."
      },
      play_characteristics: {
        recognizable_play_form: "Routepuzzel",
        freedom_degrees: "Keuze tussen oefenen en doorgaan."
      },
      freedom_and_sequence: { route_model: "vertakkend" },
      barriers_and_recovery: { main_barrier: "Een bewuste weerstandsstap." },
      leerbox_design: {
        path_role_requirements: {
          entry_object_id: "startobject",
          resistance_object_ids: ["weerstandsobject"],
          success_object_ids: ["succesobject"],
          exit_object_id: "eindobject",
          exit_must_be_distinct_from_success: true,
          exit_must_be_distinct_from_resistance: true
        }
      },
      objects: [
        { object_id: "startobject", name: "Start", role: "entry", object_type: "start" },
        { object_id: "weerstandsobject", name: "Weerstand", role: "resistance", object_type: "challenge" },
        { object_id: "succesobject", name: "Succes", role: "success", object_type: "reward" },
        { object_id: "eindobject", name: "Einde", role: "exit", object_type: "exit" }
      ],
      interaction_route: [
        { step: 1, from_object_id: "startobject", to_object_id: "weerstandsobject", action_type: "open" },
        { step: 2, from_object_id: "weerstandsobject", to_object_id: "succesobject", action_type: "answer" },
        { step: 3, from_object_id: "succesobject", to_object_id: "eindobject", action_type: "continue" }
      ],
      simulation_definition: { not_visible_to_engine: [] }
    };
    for (const [shape, payload] of [
      ["direct", importedCapture],
      ["capture-wrapper", { capture: importedCapture }],
      ["leerbox-capture-wrapper", { leerbox_capture: importedCapture }]
    ]) {
      await page.locator("#importFileInput").setInputFiles({
        name: `${shape}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(payload))
      });
      await checkpoint(page, records, `file-import-capture-${shape}`);
    }
    let invalidAlert = "";
    page.once("dialog", async dialog => {
      invalidAlert = `${dialog.type()}:${dialog.message()}`;
      await dialog.accept();
    });
    await page.locator("#importFileInput").setInputFiles({
      name: "ongeldig.json",
      mimeType: "application/json",
      buffer: Buffer.from("{geen json")
    });
    await expect.poll(() => invalidAlert).not.toBe("");
    await checkpoint(page, records, `file-import-invalid-${actionSnapshotSlug(invalidAlert)}`);

    const exportDownload = await capturedDownload(page, () => activateControl(page.locator("#exportButton")));
    await checkpoint(page, records, "download-export-json", { downloads: [exportDownload] });
    const promptDownload = await capturedDownload(page, () => activateControl(page.locator("#downloadPromptButton")));
    await checkpoint(page, records, "download-ai-prompt", { downloads: [promptDownload] });

    await activateControl(page.locator("#promptButton"));
    await checkpoint(page, records, "prompt-dialog-open");
    await activateControl(page.locator("#copyPromptButton"));
    await checkpoint(page, records, "prompt-dialog-copy");
    await activateControl(page.locator("#donePromptButton"));
    await checkpoint(page, records, "prompt-dialog-done-close");
    await activateControl(page.locator("#promptButton"));
    await activateControl(page.locator("#closePromptButton"));
    await checkpoint(page, records, "prompt-dialog-icon-close");

    await activateControl(page.locator('[data-workbench-view="build"]'));
    await activateControl(page.locator('.workspace-view-button[data-workspace-view="latex"]'));
    for (const planView of ["source", "json", "pdf"]) {
      await activateControl(page.locator(`[data-plan-view="${planView}"]`));
      if (planView === "pdf") await expect(page.locator("#latexPdfFrame")).toBeVisible();
      await checkpoint(page, records, `plan-view-${planView}`);
      const planDownload = await capturedDownload(page, () => activateControl(page.locator("#downloadLatexButton")));
      await checkpoint(page, records, `plan-download-${planView}`, {
        downloads: [planDownload]
      });
    }

    await activateControl(page.locator('[data-plan-view="source"]'));
    await activateControl(page.locator('[data-workbench-view="json"]'));
    await activateControl(page.locator("#copyButton"));
    await checkpoint(page, records, "json-output-copy", { messages: await getClipboardWrites(page) });
    const blueprintDownload = await capturedDownload(page, () => activateControl(page.locator("#downloadLatexDataButton")));
    await checkpoint(page, records, "json-output-download-blueprint", { downloads: [blueprintDownload] });

    await activateControl(page.locator('[data-workbench-view="simulation"]'));
    await chooseFilesViaButton(page, page.locator("#uploadTestDataButton"), {
      name: "events.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(FIXED_EVENTS))
    });
    await checkpoint(page, records, "testdata-file-valid");
    await setControlValue(page.locator("#testDataInput"), "geen json");
    await checkpoint(page, records, "testdata-text-invalid-json");
    await setControlValue(page.locator("#testDataInput"), JSON.stringify([{ timestamp: "fout" }]));
    await checkpoint(page, records, "testdata-text-invalid-fields");
    await setControlValue(page.locator("#testDataInput"), JSON.stringify(FIXED_EVENTS));
    await checkpoint(page, records, "testdata-text-valid");

    await activateControl(page.locator('[data-profile-mode="group"]'));
    await checkpoint(page, records, "simulation-profile-group");
    await activateControl(page.locator('[data-profile-mode="individual"]'));
    await checkpoint(page, records, "simulation-profile-individual");
    const archetypes = page.locator("[data-archetype]");
    for (let index = 0; index < await archetypes.count(); index += 1) {
      const input = archetypes.nth(index);
      await setControlValue(input, String(10 + index * 7));
      await checkpoint(page, records, `simulation-archetype-${actionSnapshotSlug(await input.getAttribute("data-archetype"))}`);
    }
    await activateControl(page.locator("#runTestButton"));
    await expect(page.locator("#simulationOutput .radar-chart")).toBeVisible();
    await checkpoint(page, records, "simulation-run-report");

    await activateControl(page.locator("#simulateButton"));
    await checkpoint(page, records, "simulation-parameters-open");
    await page.locator("#simulationSigma").selectOption({ index: 1 });
    await setControlValue(page.locator("#simulationRunCount"), "37");
    await activateControl(page.locator("#simulationParametersForm button[type=submit]"));
    await checkpoint(page, records, "simulation-prompt-created");
    await activateControl(page.locator("#copySimulationPromptButton"));
    await checkpoint(page, records, "simulation-prompt-copy");
    await activateControl(page.locator("#doneSimulationPromptButton"));
    await checkpoint(page, records, "simulation-prompt-done-close");
    await activateControl(page.locator("#simulateButton"));
    await activateControl(page.locator("#simulationParametersForm button[type=submit]"));
    await activateControl(page.locator("#closeSimulationPromptButton"));
    await checkpoint(page, records, "simulation-prompt-icon-close");
    await activateControl(page.locator("#simulateButton"));
    await activateControl(page.locator("#cancelSimulationParametersButton"));
    await checkpoint(page, records, "simulation-parameters-cancel");
    await activateControl(page.locator("#simulateButton"));
    await activateControl(page.locator("#closeSimulationParametersButton"));
    await checkpoint(page, records, "simulation-parameters-icon-close");

    page.once("dialog", dialog => dialog.dismiss());
    await activateControl(page.locator("#newCaptureButton"));
    await checkpoint(page, records, "new-capture-confirm-dismiss");
    page.once("dialog", dialog => dialog.accept());
    await activateControl(page.locator("#newCaptureButton"));
    await checkpoint(page, records, "new-capture-confirm-accept");

    await expectActionGolden(records, "actions-04-files-prompts-simulation.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("autosave, herstelpunten en bestaande datasets behouden hun volledige servicecontract", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario({
      restore: {
        capture: {
          schema_version: "leerbox_capture_v5",
          metadata: { leerbox_id: "e2e-fixture", work_name: "Herstelde Playwright-leerbox" },
          raw_user_description: "Hersteld op het vaste testtijdstip.",
          objects: [],
          interaction_route: []
        }
      }
    });
    const { editor, trackers, runtimeErrors } = await prepareEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      scenario
    });
    const records = [];
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/leerbox/captures/e2e-fixture"));
    await waitForBrowserMessage(page, message => (
      message.fromEditor && message.type === "leerpret-editor-capture-updated"
    ));
    // Bootstrapberichten concurreren bewust met de eerste GET's. Vanaf hier
    // leggen we alleen effecten van de navolgende echte gebruikersacties vast.
    await clearBrowserMessages(page);

    await editor.locator('.editor-page-menu [data-editor-page-view="intake"][data-editor-panel="overview"]').click();
    const summaryField = editor.locator('textarea[name="metadata.summary"]');
    await expect(summaryField).toBeVisible();
    await summaryField.fill("Samenvatting uit de echte browseractie");
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/leerbox/e2e-fixture/autosave"));
    await checkpoint(editor, records, "persistence-autosave-field-edit", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });

    await editor.locator('.editor-page-menu [data-editor-page-view="build"][data-editor-workspace-view="architecture"]').click();
    await editor.locator("#historyButton").click();
    await expect(editor.locator('[data-history-index="7"]')).toBeVisible();
    await checkpoint(editor, records, "history-open-loaded", {
      screenshotPage: page,
      network: networkEvidence(trackers)
    });
    await editor.locator("#historyCloseButton").click();
    await checkpoint(editor, records, "history-close", { screenshotPage: page });
    await editor.locator("#historyButton").click();
    await editor.locator('[data-history-index="7"]').click();
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/restore/7"));
    await expect(editor.locator("#historyPanel")).toBeHidden();
    await checkpoint(editor, records, "history-restore-version", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });

    await editor.locator("#simulation-clock-play").click();
    await expect(editor.locator("#simulationPanel")).toBeVisible();
    await editor.locator("#refreshExistingDataButton").click();
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/leerbox-tests/e2e-fixture/data"));
    await expect(editor.locator("#existingDataSelect option")).toHaveCount(2);
    await editor.locator("#existingDataSelect").selectOption("preview-user");
    await editor.locator("#useExistingDataButton").click();
    await expect(editor.locator("#testDataStatus")).toContainText("events geladen");
    await checkpoint(editor, records, "existing-data-use-preview-events", {
      screenshotPage: page,
      network: networkEvidence(trackers)
    });

    await editor.locator("#existingDataSelect").selectOption("e2e-fixture/events.json");
    await editor.locator("#useExistingDataButton").click();
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/fixtures/e2e-events.json"));
    await expect(editor.locator("#testDataStatus")).toContainText("events geladen");
    await checkpoint(editor, records, "existing-data-use-file", {
      screenshotPage: page,
      network: networkEvidence(trackers)
    });

    await editor.locator("#runTestButton").click();
    await waitForBrowserMessage(page, message => message.type === "leerpret-simulation-status" && message.data?.status === "complete");
    await expect(editor.locator("#simulationOutput .radar-chart")).toBeVisible();
    await checkpoint(editor, records, "existing-data-run-and-complete", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });

    const outboundTypes = new Set((await getBrowserMessages(page))
      .filter(message => message.fromEditor)
      .map(message => message.type));
    expect(outboundTypes.has("leerpret-editor-workspace-view")).toBe(true);
    expect(outboundTypes.has("leerpret-editor-capture-updated")).toBe(true);
    expect(outboundTypes.has("leerpret-simulation-status")).toBe(true);

    await expectActionGolden(records, "actions-06-persistence-existing-data.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("preview, gedeelde chrome, bibliotheek en leerboxkiezer blijven echte gebruikerspaden", async ({ page }) => {
    test.setTimeout(600_000);
    const scenario = createFixtureScenario({
      twins: [
        { id: "e2e-fixture", title: "Playwright leerbox", status: "pilot", gevat_validation: { is_gevat: true } },
        { id: "tweede-fixture", title: "Tweede leerbox", status: "concept", gevat_validation: { is_gevat: false } }
      ]
    });
    const { editor, editorOrigin, trackers, runtimeErrors } = await prepareEditorFrame(page, {
      role: "architect",
      leerboxId: "e2e-fixture",
      scenario
    });
    const records = [];

    await expect(editor.locator("[data-blok-library-category]")).toHaveCount(3, { timeout: 20_000 });
    for (const category of ["elements", "learning", "archetypes"]) {
      const button = editor.locator(`[data-blok-library-category="${category}"]`);
      await expect(button).toBeVisible();
      await button.click();
      await expect(editor.locator("[data-blok-library-flyout]")).toBeVisible();
      await checkpoint(editor, records, `library-category-${category}-open`, { screenshotPage: page });
      await button.click();
      await expect(editor.locator("[data-blok-library-flyout]")).toBeHidden();
    }
    await editor.locator('[data-blok-library-category="learning"]').click();
    await expect(editor.locator("[data-library-index]").first()).toBeVisible();
    await editor.locator("[data-library-index]").first().click();
    await expect(editor.locator("#networkNodes .network-node")).toHaveCount(1);
    await checkpoint(editor, records, "library-item-add-from-visible-palette", {
      screenshotPage: page,
      messages: messageEvidence(await getBrowserMessages(page))
    });

    await editor.locator("#hud-report-action").click();
    await expect(editor.locator("#canvasReportDrawer")).toBeVisible();
    await checkpoint(editor, records, "chrome-hud-report-open", { screenshotPage: page });
    await editor.locator("#canvasReportClose").click();

    await editor.locator('.editor-page-menu [data-editor-page-view="description"][data-editor-panel="mission"]').click();
    await expect(editor.locator("#workflowPanelCloseButton")).toBeVisible();
    await editor.locator("#workflowPanelCloseButton").click();
    await waitForBrowserMessage(page, "leerpret-editor-panel-closed");
    await checkpoint(editor, records, "workflow-panel-close-and-publish", {
      screenshotPage: page,
      messages: messageEvidence(await getBrowserMessages(page))
    });
    await editor.locator('.editor-page-menu [data-editor-page-view="intake"][data-editor-panel="overview"]').click();
    await expect(editor.locator("#paletteCloseButton")).toBeVisible();
    await editor.locator("#paletteCloseButton").click();
    await checkpoint(editor, records, "palette-panel-close-and-publish", {
      screenshotPage: page,
      messages: messageEvidence(await getBrowserMessages(page))
    });

    await editor.locator("#hud-preview-action").click();
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/developer/previews/generate"));
    await waitForBrowserMessage(page, "leerpret-preview-generated");
    await checkpoint(editor, records, "preview-from-hud", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });
    await postEditorMessage(page, { type: "leerpret-editor-generate-preview" }, editorOrigin);
    await waitForRequestLog(trackers, record => record.pathname.endsWith("/developer/previews/generate"), 2);
    await checkpoint(editor, records, "preview-from-inbound-contract", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });

    page.once("dialog", dialog => dialog.dismiss());
    await editor.locator("#hud-new-action").click();
    await checkpoint(editor, records, "chrome-hud-new-dismiss", { screenshotPage: page });
    page.once("dialog", dialog => dialog.accept());
    await editor.locator("#hud-new-action").click();
    await checkpoint(editor, records, "chrome-hud-new-accept", {
      screenshotPage: page,
      messages: messageEvidence(await getBrowserMessages(page))
    });

    const backLink = editor.locator("#editor-back-to-learningbox");
    await expect(backLink).toBeHidden();
    await expect(backLink).toHaveAttribute("href", "http://127.0.0.1:47112/learningbox");
    await checkpoint(editor, records, "chrome-back-link-historical-hidden-contract", { screenshotPage: page });

    await editor.locator(".editor-leerbox-context").click();
    await expect(editor.locator("#editor-twin-popover")).toBeVisible();
    await expect(editor.locator("#editor-twin-popover [data-twin-id]")).toHaveCount(2);
    await checkpoint(editor, records, "chrome-twin-popover-open", { screenshotPage: page });
    await editor.locator('#editor-twin-popover [data-twin-id="tweede-fixture"]').click();
    await expect.poll(() => editor.url()).toContain("leerbox_id=tweede-fixture");
    await expect(editor.locator('[data-editor-chrome="1"]')).toHaveAttribute("data-chrome-wired", "1");
    await checkpoint(editor, records, "chrome-twin-switch-navigation", {
      screenshotPage: page,
      network: networkEvidence(trackers)
    });

    await expectActionGolden(records, "actions-07-preview-chrome-library-twins.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("alle klokinputs en de volledige iframe-opdrachtenset blijven gelijk", async ({ page }) => {
    test.setTimeout(600_000);
    const { editor, editorOrigin, trackers, runtimeErrors } = await prepareEditorFrame(page, { role: "architect" });
    const records = [];
    const send = payload => page.evaluate(({ message, origin }) => {
      document.getElementById("dashboard-editor").contentWindow.postMessage(message, origin);
    }, { message: payload, origin: editorOrigin });

    for (const [unit, selector] of [["duration", "#clock-duration-arc"], ["actions", "#clock-actions-arc"]]) {
      const slider = editor.locator(selector);
      await slider.focus();
      for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
        await slider.press(key);
        await checkpoint(editor, records, `clock-${unit}-keyboard-${actionSnapshotSlug(key)}`, { screenshotPage: page });
      }
      const box = await slider.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + Math.max(1, box.height * 0.2), { steps: 4 });
      await page.mouse.up();
      await checkpoint(editor, records, `clock-${unit}-pointer`, { screenshotPage: page });
    }
    await editor.locator("#simulation-action-count").fill("170");
    await editor.locator("#simulation-action-count").press("Tab");
    await checkpoint(editor, records, "clock-number-change", { screenshotPage: page });
    await editor.locator("#simulation-clock-play").click();
    await checkpoint(editor, records, "clock-play-without-data", { screenshotPage: page });
    if (await editor.locator("#simulationPromptDialog[open]").count()) {
      await editor.locator("#doneSimulationPromptButton").click();
    }

    const commands = [
      { type: "leerpret-editor-view", view: "intake", panel: "game", workspaceView: "vat" },
      { type: "leerpret-editor-click-control", selector: "#promptButton" },
      { type: "leerpret-editor-close-overlays" },
      { type: "leerpret-editor-add-object-preset", preset: "entry" },
      { type: "leerpret-editor-add-library-item", item: {
        libraryId: "element.brick.2x2.blue",
        libraryKind: "element",
        label: "Bibliotheekobject",
        role: "practice",
        objectType: "sdk_blok"
      } },
      { type: "leerpret-editor-start-cable" },
      { type: "leerpret-editor-connection-mode", mode: "conditional" },
      { type: "leerpret-editor-generate-preview" },
      { type: "leerpret-editor-simulation-control", mode: "pause", action_count: 12, simulation_unit: "actions" }
    ];
    for (const command of commands) {
      await send(command);
      if (command.type === "leerpret-editor-generate-preview") {
        await waitForRequestLog(trackers, record => record.pathname.endsWith("/developer/previews/generate"));
      }
      if (command.type === "leerpret-editor-add-library-item") {
        await expect(editor.locator("#networkNodes .network-node")).toHaveCount(2);
      }
      await checkpoint(editor, records, `iframe-in-${actionSnapshotSlug(command.type)}-${actionSnapshotSlug(command.selector || command.mode || command.preset || "default")}`, {
        screenshotPage: page,
        network: networkEvidence(trackers),
        messages: messageEvidence(await getBrowserMessages(page))
      });
    }
    await send({ type: "leerpret-editor-click-control", selector: "body" });
    await checkpoint(editor, records, "iframe-reject-unknown-click-control", {
      screenshotPage: page,
      network: networkEvidence(trackers),
      messages: messageEvidence(await getBrowserMessages(page))
    });

    await expectActionGolden(records, "actions-05-clock-and-iframe.json");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("de SDK-componenten die HTML, CSS en JS leveren zijn live en integriteitsgebonden", async ({ page }) => {
    test.skip(process.env.LEERBOX_EDITOR_LEGACY_BASELINE === "1", "De historische Editor gebruikte de directe SDK-loader zonder manifestgraph.");
    const { runtimeErrors, sdkRequests } = await prepareEditorPage(page, { role: "architect" });
    const graph = await page.evaluate(async () => {
      const loader = await window.LeerpretSDKLoaderReady;
      const componentNames = ["editor-shell", "editor-chrome", "lego-flow-map", "lego-spatial"];
      return {
        version: loader.manifest.version,
        components: Object.fromEntries(componentNames.map(name => {
          const declaration = loader.manifest.components[name];
          return [name, {
            version: declaration.version,
            assets: declaration.assets,
            integrity: declaration.integrity,
            runtimeKeys: Object.keys(window.LeerpretSDK.components[name] || {}).sort()
          }];
        }))
      };
    });
    expect(graph.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(graph.components["lego-flow-map"].runtimeKeys).toEqual(expect.arrayContaining([
      "layoutScreenSceneV1",
      "clientPointToLayerV1",
      "panScrollOffsetV1",
      "dragScreenPositionV1"
    ]));
    expect(graph.components["lego-spatial"].runtimeKeys).toContain("radarSeriesPoints");
    expect(Object.values(graph.components).flatMap(component => Object.values(component.integrity || {})))
      .toEqual(expect.arrayContaining([expect.stringMatching(/^sha384-/)]));
    expect(sdkRequests.some(path => path.includes("editor-chrome"))).toBe(true);
    expect(sdkRequests.some(path => path.includes("lego-flow-map"))).toBe(true);
    expect(sdkRequests.some(path => path.includes("lego-spatial"))).toBe(true);
    await expectNoRuntimeErrors(page, runtimeErrors);
  });
});
