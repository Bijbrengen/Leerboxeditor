import { test, expect } from "@playwright/test";
import {
  API_BASE,
  API_PATH,
  addChromePreset,
  addFourCanonicalObjects,
  captureFromStorage,
  expectNoRuntimeErrors,
  prepareEditorFrame,
  prepareEditorPage,
  waitForSettledCanvas
} from "./fixtures.mjs";

test.describe("LeerboxEditor voor/na SDK-migratie", () => {
  test("bootstrap en lege kaart blijven pixelgelijk", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);

    await expect(page.locator("#networkNodes .network-node")).toHaveCount(0);
    await expect(page.locator("#canvasEmptyState")).toBeVisible();
    await expect(page).toHaveScreenshot("01-lege-editor.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("dezelfde vier chrome-acties houden kaart en posities pixelgelijk", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);
    await addFourCanonicalObjects(page);

    const positions = await page.locator("#networkNodes .network-node").evaluateAll(nodes => nodes.map(node => ({
      id: node.dataset.objectId,
      left: Number.parseFloat(node.style.left),
      top: Number.parseFloat(node.style.top)
    })));
    expect(positions).toEqual([
      { id: "startobject", left: 381, top: 280 },
      { id: "succesobject", left: 381, top: 415 },
      { id: "weerstandsobject", left: 381, top: 550 },
      { id: "leerobject", left: 381, top: 685 }
    ]);

    const stored = await captureFromStorage(page);
    expect(stored.objects.map(object => ({ id: object.object_id, position: object.editor_position }))).toEqual([
      { id: "startobject", position: { x: 381, y: 280 } },
      { id: "succesobject", position: { x: 381, y: 415 } },
      { id: "weerstandsobject", position: { x: 381, y: 550 } },
      { id: "leerobject", position: { x: 381, y: 540 } }
    ]);
    await expect(page).toHaveScreenshot("02-vier-objecten.png", { fullPage: false });
    await page.reload();
    await expect(page.locator("#networkNodes .network-node")).toHaveCount(4);
    await waitForSettledCanvas(page);
    await expect(page).toHaveScreenshot("02a-vier-objecten-na-herladen.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("slepen herberekent dezelfde kabel en dezelfde schermpositie", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);
    await addChromePreset(page, "entry", 1);
    await addChromePreset(page, "success", 2);
    await waitForSettledCanvas(page);

    await page.locator('[data-object-id="startobject"]').click();
    await page.mouse.move(920, 470, { steps: 4 });
    await expect(page.locator("#rubberBand")).toHaveAttribute(
      "d",
      /^M [-\d.]+ [-\d.]+ C [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+$/
    );
    await expect(page).toHaveScreenshot("03a-live-rubberband.png", { fullPage: false });
    await page.locator('[data-object-id="succesobject"]').click();
    await expect(page.locator('.lego-flow-map-cable[data-flow-from="startobject"][data-flow-to="succesobject"]')).toHaveCount(1);

    const startNode = page.locator('[data-object-id="startobject"]');
    const box = await startNode.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 104, box.y + box.height / 2 + 56, { steps: 8 });
    await page.mouse.up();
    await expect(startNode).toHaveCSS("left", "485px");
    await expect(startNode).toHaveCSS("top", "336px");

    const stored = await captureFromStorage(page);
    expect(stored.objects.find(object => object.object_id === "startobject").editor_position).toEqual({ x: 485, y: 336 });
    const cable = page.locator('.lego-flow-map-cable[data-flow-from="startobject"][data-flow-to="succesobject"]');
    await expect(cable.locator("path.cable-body")).toHaveAttribute(
      "d",
      /^M [-\d.]+ [-\d.]+ C [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+$/
    );
    await expect(page).toHaveScreenshot("03-gesleepte-node-met-kabel.png", { fullPage: false });
    await page.reload();
    await expect(page.locator('[data-object-id="startobject"]')).toHaveCSS("left", "485px");
    await expect(page.locator('[data-object-id="startobject"]')).toHaveCSS("top", "336px");
    await expect(page.locator('.lego-flow-map-cable[data-flow-from="startobject"][data-flow-to="succesobject"]')).toHaveCount(1);
    await waitForSettledCanvas(page);
    await expect(page).toHaveScreenshot("03c-kabel-na-herladen.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("een palette-drop gebruikt dezelfde client-naar-laagpositie", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);
    const target = { x: 620, y: 410 };
    await page.evaluate(position => {
      const source = document.querySelector('.object-toolbox [data-object-preset="entry"]');
      const canvas = document.getElementById("networkCanvas");
      const layer = document.getElementById("networkNodes");
      const layerRect = layer.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      const eventInit = {
        bubbles: true,
        cancelable: true,
        clientX: layerRect.left + position.x,
        clientY: layerRect.top + position.y,
        dataTransfer
      };
      canvas.dispatchEvent(new DragEvent("dragover", eventInit));
      canvas.dispatchEvent(new DragEvent("drop", eventInit));
    }, target);
    await expect(page.locator("#networkNodes .network-node")).toHaveCount(1);
    await waitForSettledCanvas(page);
    const stored = await captureFromStorage(page);
    expect(stored.objects[0].editor_position).toEqual(target);
    await expect(page.locator('[data-object-id="startobject"]')).toHaveCSS("left", `${target.x}px`);
    await expect(page.locator('[data-object-id="startobject"]')).toHaveCSS("top", `${target.y}px`);
    await expect(page).toHaveScreenshot("03b-palette-drop.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("pannen en centreren gebruiken dezelfde zichtbare wereld", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);
    await addFourCanonicalObjects(page);

    const scroller = page.locator(".strategy-canvas-layout");
    const before = await scroller.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));
    const box = await scroller.boundingBox();
    expect(box).not.toBeNull();
    const x = box.x + box.width * 0.72;
    const y = box.y + box.height * 0.78;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y - 80, { steps: 8 });
    await page.mouse.up();
    const panned = await scroller.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));
    expect(panned).toEqual({ left: before.left + 120, top: before.top + 80 });

    await page.locator("#centerCanvasButton").click();
    await expect.poll(() => scroller.evaluate(element => (
      Math.abs(element.scrollLeft - Math.max(0, (element.scrollWidth - element.clientWidth) / 2)) < 0.01
      && Math.abs(element.scrollTop - Math.max(0, (element.scrollHeight - element.clientHeight) / 2)) < 0.01
    ))).toBe(true);
    const centered = await scroller.evaluate(element => ({
      left: element.scrollLeft,
      top: element.scrollTop,
      expectedLeft: Math.max(0, (element.scrollWidth - element.clientWidth) / 2),
      expectedTop: Math.max(0, (element.scrollHeight - element.clientHeight) / 2)
    }));
    expect(centered.left).toBe(centered.expectedLeft);
    expect(centered.top).toBe(centered.expectedTop);
    await expect(page).toHaveScreenshot("04-opnieuw-gecentreerd.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("een compact tweede schermformaat houdt dezelfde relatieve layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { runtimeErrors } = await prepareEditorPage(page);
    await addFourCanonicalObjects(page);
    const positions = await page.locator("#networkNodes .network-node").evaluateAll(nodes => nodes.map(node => ({
      left: Number.parseFloat(node.style.left),
      top: Number.parseFloat(node.style.top)
    })));
    expect(new Set(positions.map(position => position.left)).size).toBe(1);
    expect(positions.slice(1).map((position, index) => position.top - positions[index].top)).toEqual([135, 135, 135]);
    await expect(page).toHaveScreenshot("04a-compact-scherm.png", { fullPage: false });
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("de simulatieradar blijft na dezelfde events pixelgelijk", async ({ page }) => {
    const { runtimeErrors } = await prepareEditorPage(page);
    await addFourCanonicalObjects(page);

    const simulationButton = page.locator("#simulation-clock-play");
    await expect(simulationButton).toBeEnabled();
    await simulationButton.click();
    await expect(page.locator("#simulationPanel")).toBeVisible();

    const events = [
      { timestamp: "2026-08-28T08:00:00.000Z", user_id: "e2e-user", learning_object_id: "startobject" },
      { timestamp: "2026-08-28T08:00:05.000Z", user_id: "e2e-user", learning_object_id: "weerstandsobject" },
      { timestamp: "2026-08-28T08:00:12.000Z", user_id: "e2e-user", learning_object_id: "leerobject" },
      { timestamp: "2026-08-28T08:00:18.000Z", user_id: "e2e-user", learning_object_id: "succesobject" }
    ];
    await page.locator("#testDataInput").fill(JSON.stringify(events));
    await expect(page.locator("#runTestButton")).toBeEnabled();
    await page.locator("#runTestButton").click();
    await expect(page.locator("#simulationOutput .radar-chart")).toBeVisible();
    await expect(page.locator("#simulationOutput .radar-axis")).toHaveCount(5);
    await expect(page.locator("#simulationOutput .radar-grid")).toHaveAttribute("points", /\d/);
    await expect(page.locator("#simulationOutput .radar-area")).toHaveAttribute("points", /\d/);
    await expect(page.locator("#simulationOutput .radar-chart")).toHaveScreenshot("05a-radardiagram.png");
    await expect(page.locator("#simulationPanel")).toHaveScreenshot("05-simulatieradar.png");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });

  test("Dashboard en Editor behouden dezelfde tweerichtings-iframecontracten", async ({ page }) => {
    const { editor, editorOrigin, iframe, runtimeErrors } = await prepareEditorFrame(page);
    const sendFromDashboard = message => page.evaluate(({ payload, targetOrigin }) => {
      document.getElementById("dashboard-editor").contentWindow.postMessage(payload, targetOrigin);
    }, { payload: message, targetOrigin: editorOrigin });

    await sendFromDashboard({ type: "leerpret-editor-view", view: "build", workspaceView: "vat" });
    await expect(editor.locator('.workspace-view[data-workspace-view="vat"]')).toHaveClass(/is-active/);
    await expect.poll(() => page.evaluate(() => window.__editorMessages.some(message => (
      message.type === "leerpret-editor-workspace-view"
      && message.workspaceView === "vat"
      && message.fromEditor
    )))).toBe(true);

    await sendFromDashboard({ type: "leerpret-editor-add-object-preset", preset: "entry" });
    await sendFromDashboard({ type: "leerpret-editor-add-object-preset", preset: "success" });
    await expect(editor.locator("#networkNodes .network-node")).toHaveCount(2);
    await waitForSettledCanvas(editor);
    await expect.poll(() => page.evaluate(() => window.__editorMessages.some(message => (
      message.type === "leerpret-editor-capture-updated"
      && message.objectCount === 2
      && message.fromEditor
    )))).toBe(true);
    const parentMessages = await page.evaluate(() => window.__editorMessages.filter(message => message.fromEditor));
    expect(parentMessages.every(message => message.origin === editorOrigin)).toBe(true);
    await expect(iframe).toHaveScreenshot("06-dashboard-iframe.png");
    await expectNoRuntimeErrors(page, runtimeErrors);
  });
});

test("de huidige Editor resolveert componentassets met het Engine-manifest en integriteit", async ({ page }) => {
  test.skip(process.env.LEERBOX_EDITOR_LEGACY_BASELINE === "1", "De historische baseline gebruikt bewust de oude directe assetroutes.");
  const { runtimeErrors, sdkRequests } = await prepareEditorPage(page);

  expect(await page.evaluate(() => window.LeerpretSDKApiBase)).toBe(API_BASE);
  expect(sdkRequests).toContain(`${API_PATH}/sdk/sdk-loader/loader.js`);
  expect(sdkRequests).toContain(`${API_PATH}/sdk/manifest.json`);
  expect(sdkRequests.some(path => path.includes("editor-shell"))).toBe(true);
  expect(sdkRequests.some(path => path.includes("editor-chrome"))).toBe(true);
  expect(sdkRequests.some(path => path.includes("lego-flow-map"))).toBe(true);
  expect(sdkRequests.some(path => path.includes("lego-spatial"))).toBe(true);
  const manifestIndex = sdkRequests.indexOf(`${API_PATH}/sdk/manifest.json`);
  const componentIndexes = sdkRequests
    .map((path, index) => ({ path, index }))
    .filter(({ path }) => ["editor-shell", "editor-chrome", "lego-flow-map", "lego-spatial"].some(name => path.includes(name)))
    .map(({ index }) => index);
  expect(componentIndexes.length).toBeGreaterThan(0);
  expect(componentIndexes.every(index => index > manifestIndex)).toBe(true);
  const manifestState = await page.evaluate(async () => {
    const loader = await window.LeerpretSDKLoaderReady;
    const definitions = Object.values(loader.manifest?.components || {});
    const integrities = definitions.flatMap(definition => Object.values(definition.integrity || {}));
    return { version: loader.manifest?.version, integrities };
  });
  expect(manifestState.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(manifestState.integrities.length).toBeGreaterThan(0);
  expect(manifestState.integrities.every(integrity => /^sha384-/.test(integrity))).toBe(true);
  await expect(page.locator('script[src*="/sdk/"][integrity^="sha384-"], link[href*="/sdk/"][integrity^="sha384-"]')).not.toHaveCount(0);
  await expect(page.locator('link[data-editor-shell-source="fallback"]')).toHaveCount(0);
  await expect(page.locator(".simulation-clock")).toHaveCSS("right", "20px");
  await expect(page.locator(".simulation-clock")).toHaveCSS("bottom", "20px");
  await expect(page.locator(".editor-page-menu")).toHaveCSS("left", "14px");
  await expect(page.locator(".editor-page-menu")).toHaveCSS("top", "14px");
  await expectNoRuntimeErrors(page, runtimeErrors);
});
