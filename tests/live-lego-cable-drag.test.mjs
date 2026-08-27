import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("de editor delegeert iedere drag-frame aan de LEGO flow-map SDK", () => {
  const dragStart = source.indexOf("function startNodeDrag(event)");
  const dragEnd = source.indexOf("function emptyText(type)", dragStart);
  const dragSource = source.slice(dragStart, dragEnd);

  assert.match(dragSource, /legoFlowMap\.updateDragFrame\(\{/);
  assert.match(dragSource, /edgesRoot:\s*elements\.networkEdges/);
  assert.match(dragSource, /objectId:\s*object\.object_id/);
  assert.doesNotMatch(dragSource, /node\.style\.(?:left|top)\s*=/);
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
