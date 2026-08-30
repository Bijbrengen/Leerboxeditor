import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("de editor delegeert iedere drag-frame aan de LEGO flow-map SDK", () => {
  const dragStart = source.indexOf("function startNodeDrag(event)");
  const dragEnd = source.indexOf("function emptyText(type)", dragStart);
  const dragSource = source.slice(dragStart, dragEnd);

  assert.match(dragSource, /legoFlowMap\.updateDragFrame\(\{/);
  assert.match(dragSource, /legoFlowMap\.dragScreenPositionV1\(\{/);
  assert.match(dragSource, /if \(drag\.moved\) moved = true/);
  assert.match(dragSource, /edgesRoot:\s*elements\.networkEdges/);
  assert.match(dragSource, /objectId:\s*object\.object_id/);
  assert.doesNotMatch(dragSource, /node\.style\.(?:left|top)\s*=/);
  assert.doesNotMatch(dragSource, /Math\.max\(62,\s*Math\.min\(/);
  assert.doesNotMatch(dragSource, /Math\.abs\(dx\) \+ Math\.abs\(dy\)/);
});

test("de editor delegeert nop-naar-nopkabels aan de SDK en bewaart de ankers", () => {
  assert.match(source, /legoFlowMap\.wireStudConnections\(\{/);
  assert.match(source, /connectionMode,/);
  assert.match(source, /edgeType/);
  assert.match(source, /fromStud:\s*dependency\.editor_cable\?\.from_stud/);
  assert.match(source, /toStud:\s*dependency\.editor_cable\?\.to_stud/);
  assert.match(source, /editor_cable:\s*cable/);
  assert.match(source, /type === "leerpret-editor-connection-mode"/);
});

test("de gekozen SDK-modus bepaalt route of voorwaarde", () => {
  assert.match(source, /function createConnection\(fromObjectId, toObjectId, edgeType, cable = null\)/);
  assert.match(source, /if \(edgeType === "conditional"\) createDependency/);
  assert.match(source, /else createRouteConnection/);
  assert.match(source, /editorCable:\s*step\.editor_cable/);
  assert.match(source, /fromStud:\s*step\.editorCable\?\.from_stud/);
  assert.match(source, /toStud:\s*step\.editorCable\?\.to_stud/);
});

test("de editor delegeert legacy schermlayout en rubberbandanker zonder lokale geometrie", () => {
  const renderStart = source.indexOf("function renderNetworkCanvas(capture)");
  const renderEnd = source.indexOf("function centerCanvasOnDrawing()", renderStart);
  const renderSource = source.slice(renderStart, renderEnd);
  const rubberStart = source.indexOf("function startRubberBand()");
  const rubberEnd = source.indexOf("function cancelLinking()", rubberStart);
  const rubberSource = source.slice(rubberStart, rubberEnd);

  assert.match(renderSource, /legoFlowMap\.layoutScreenSceneV1\(\{/);
  assert.ok(renderSource.indexOf("if (!legoFlowMap)") < renderSource.indexOf("legoFlowMap.layoutScreenSceneV1"));
  assert.match(renderSource, /positions:\s*objects\.map\(\(object\) => object\.editor_position \|\| null\)/);
  assert.match(renderSource, /const \{ width, height, drawnHeight \} = sceneLayout/);
  assert.match(renderSource, /object\.editor_position\.x = position\.x/);
  assert.match(renderSource, /object\.editor_position\.y = position\.y/);
  assert.doesNotMatch(renderSource, /\b(?:bboxMinX|gridColumns|minGapX|gridRowHeight)\b/);
  assert.doesNotMatch(renderSource, /const drawnHeight = Math\.max/);

  assert.match(rubberSource, /legoFlowMap\.studConnectionPoint\(\{/);
  assert.match(rubberSource, /legoFlowMap\.clientPointToLayerV1\(moveEvent, layerRect, \{ scale: canvasZoom \}\)/);
  assert.match(rubberSource, /legoFlowMap\.previewCablePath\(sourcePoint, \[pointer\.x, pointer\.y\]\)/);
  assert.doesNotMatch(rubberSource, /editor_position\.y\s*-\s*27/);
});

test("pan en drop gebruiken dezelfde pure client-naar-laagwiskunde", () => {
  const workbenchStart = source.indexOf("function initializeWorkbench()");
  const workbenchEnd = source.indexOf("function addPresetObject", workbenchStart);
  const workbenchSource = source.slice(workbenchStart, workbenchEnd);
  assert.match(workbenchSource, /legoFlowMap\.panScrollOffsetV1\(/);
  assert.match(workbenchSource, /legoFlowMap\.clientPointToLayerV1\(event, bounds, \{ scale: canvasZoom \}\)/);
  assert.doesNotMatch(workbenchSource, /panState\.left - \(event\.clientX - panState\.x\)/);
  assert.doesNotMatch(workbenchSource, /event\.clientX - bounds\.left/);
});

test("de Leerboxvloer schakelt alleen via SDK-policy de oude schermafstandsregel uit", () => {
  assert.match(source, /layoutScreenSceneV1\(\{[\s\S]*?collisionPolicy: "preserve"[\s\S]*?\}\)/);
  assert.doesNotMatch(source, /collisionGapX|collisionGapY|gridRowHeight/);
});

test("bibliotheekobjecten laten hun footprint tijdens slepen door de SDK bepalen", () => {
  assert.match(source, /learningBoxStudPositionV1\(drag\.position, networkLearningBoxProfile, \{\s*libraryId: object\.library_id\s*\}\)/);
  assert.doesNotMatch(source, /learningBoxStudPositionV1\(drag\.position, networkLearningBoxProfile\)\s*\n\s*: drag\.position/);
});

test("muiswiel en gewone of numerieke plus/min delegeren dezelfde zoomoptie aan de SDK", () => {
  const bindStart = source.indexOf("function bindNetworkCanvas()");
  const bindEnd = source.indexOf("function addPresetObject", bindStart);
  const bindSource = source.slice(bindStart, bindEnd);
  const applyStart = source.indexOf("function applyNetworkCanvasScale");
  const zoomStart = source.indexOf("function zoomNetworkCanvas(input, focus)");
  const zoomEnd = source.indexOf("function addPresetObject", zoomStart);
  const applySource = source.slice(applyStart, zoomStart);
  const zoomSource = source.slice(zoomStart, zoomEnd);

  assert.match(bindSource, /addEventListener\("wheel",/);
  assert.match(bindSource, /\{ passive: false \}/);
  assert.match(bindSource, /zoomInputDirectionV1\(event\)/);
  assert.match(bindSource, /zoomNetworkCanvas\(event,/);
  assert.match(zoomSource, /legoFlowMap\.zoomViewportV1\(\{/);
  assert.match(applySource, /legoFlowMap\.scaleScreenSceneV1\(sceneLayout, canvasZoom\)/);
  assert.match(applySource, /layer\.style\.transform = `scale\(\$\{scaled\.scale\}\)`/);
  assert.match(applySource, /layer\.style\.transformOrigin = "0 0"/);
  assert.match(source, /getScale: \(\) => canvasZoom/);
  assert.match(source, /scale: canvasZoom/);
  assert.match(zoomSource, /layout\.scrollLeft = result\.scroll\.x/);
  assert.match(zoomSource, /layout\.scrollTop = result\.scroll\.y/);
  assert.doesNotMatch(zoomSource, /requestAnimationFrame/);
  assert.doesNotMatch(zoomSource, /Math\.(?:min|max|pow)/);
});

test("de editor delegeert viewportcentrum en scrollwiskunde aan dezelfde pure SDK-laag", () => {
  const visibleStart = source.indexOf("function visibleCanvasCenter()");
  const visibleEnd = source.indexOf("function centerObjectInCanvas", visibleStart);
  const centerStart = source.indexOf("function centerObjectsInCanvas(objectIds)");
  const centerEnd = source.indexOf("function renderNetworkCanvas(capture)", centerStart);
  const resetStart = source.indexOf("function centerCanvasOnDrawing()");
  const resetEnd = source.indexOf("function objectIdByIndex", resetStart);
  const visibleSource = source.slice(visibleStart, visibleEnd);
  const centerSource = source.slice(centerStart, centerEnd);
  const resetSource = source.slice(resetStart, resetEnd);

  assert.match(visibleSource, /legoFlowMap\.visibleLayerCenterV1\(\{/);
  assert.match(visibleSource, /if \(!legoFlowMap\) return null/);
  assert.doesNotMatch(visibleSource, /Math\.max\(70|Math\.max\(80/);
  assert.match(centerSource, /legoFlowMap\.centerDeltaV1\(rects, viewRect\)/);
  assert.doesNotMatch(centerSource, /rects\.reduce/);
  assert.match(resetSource, /legoFlowMap\.centeredScrollOffsetV1\(/);
  assert.match(resetSource, /if \(!legoFlowMap\) return/);
  assert.doesNotMatch(resetSource, /scrollWidth - layout\.clientWidth/);
});

test("startup publiceert de capture pas nadat de asynchrone SDK-layout is toegepast", () => {
  const initialization = source.slice(
    source.indexOf("const legoFlowMapReady = initializeLegoFlowMap()"),
    source.indexOf("function initializeLegoFlowMap()")
  );
  const loaderStart = source.indexOf("function initializeLegoFlowMap()");
  const loader = source.slice(loaderStart, source.indexOf("function statusEvidenceMap", loaderStart));
  const selectedStart = source.indexOf("async function initializeSelectedCapture()");
  const selected = source.slice(selectedStart, source.indexOf("function loadSimulationParameters", selectedStart));
  assert.match(initialization, /const selectedCaptureReady = initializeSelectedCapture\(\)/);
  assert.match(initialization, /Promise\.all\(\[legoFlowMapReady, selectedCaptureReady\]\)\.then\(\(\) => \{/);
  assert.match(initialization, /render\(\);\s*publishCaptureUpdate\(\)/);
  assert.match(loader, /return window\.LeerpretSDKLoaderReady/);
  assert.match(loader, /render\(\);\s*return component/);
  assert.doesNotMatch(loader, /publishCaptureUpdate/);
  assert.doesNotMatch(selected, /publishCaptureUpdate/);
});
