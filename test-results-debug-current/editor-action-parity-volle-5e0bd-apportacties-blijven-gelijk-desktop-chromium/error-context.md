# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-action-parity.spec.mjs >> volledige LeerboxEditor-actiekarakterisering >> object-, blok-, kaart-, kabel- en rapportacties blijven gelijk
- Location: tests\visual\editor-action-parity.spec.mjs:383:3

# Error details

```
Error: Diagnostische stop na block-dialog-cancel.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - text: "＋ ⇧ ⇩ { } ◆ LOCK ▾"
    - generic [ref=e4]:
      - text: AI ➤
      - region "Leerbox editor" [ref=e5]:
        - region "Visuele programmeerwerkplaats" [ref=e6]:
          - generic [ref=e8]:
            - text: LOCK LOCK LOCK
            - generic "Leerbox-netwerkcanvas; sleep bouwstenen hierheen" [ref=e9]:
              - generic [ref=e10]:
                - button "Selecteer eerst een leerbox" [disabled] [ref=e11] [cursor=pointer]: ⟲
                - button "Kaart centreren op de leerobjecten" [ref=e12] [cursor=pointer]: ◎
              - generic "Kaartstatistieken" [ref=e13]:
                - 'generic "Vrijheid van de leerbox: 50% (2 routestappen en 1 voorwaarden op 8 leerobjecten)" [ref=e14]':
                  - generic [ref=e15]: 🕊
                  - generic [ref=e18]: 50%
                - generic "Leerobjecten" [ref=e19]:
                  - generic [ref=e20]: ⬡
                  - generic [ref=e21]: "8"
                - generic "Routestappen" [ref=e22]:
                  - generic [ref=e23]: ➜
                  - generic [ref=e24]: "2"
                - generic "Voorwaarden" [ref=e25]:
                  - generic [ref=e26]: ▣
                  - generic [ref=e27]: "1"
              - img:
                - generic:
                  - generic [ref=e28] [cursor=pointer]
                  - generic [ref=e29] [cursor=pointer]: "1"
                - generic:
                  - generic [ref=e32] [cursor=pointer]
                  - generic [ref=e33] [cursor=pointer]: ▣
              - generic:
                - button "Startobject, Start" [active] [ref=e36]:
                  - img [ref=e37]:
                    - generic: Startobject
                - button "Succesobject, Succes" [ref=e74]:
                  - img [ref=e75]:
                    - generic: Succesobject
                - button "Weerstandsobject, Weerstand" [ref=e112]:
                  - img [ref=e113]:
                    - generic: Weerstandsobject
                - button "Leerobject, Leerobject" [ref=e150]:
                  - img [ref=e151]:
                    - generic: Leerobject
                - button "Startobject, Start" [ref=e188]:
                  - img [ref=e189]:
                    - generic: Startobject
                - button "Succesobject, Succes" [ref=e226]:
                  - img [ref=e227]:
                    - generic: Succesobject
                - button "Weerstandsobject, Weerstand" [ref=e264]:
                  - img [ref=e265]:
                    - generic: Weerstandsobject
                - button "Leerobject, Leerobject" [ref=e302]:
                  - img [ref=e303]:
                    - generic: Leerobject
            - text: 1 2
          - generic [ref=e341]:
            - generic [ref=e342]:
              - generic [ref=e343]: ✓
              - strong [ref=e344]: Controle
            - button "Controle inklappen" [ref=e345] [cursor=pointer]: −
  - text: ▣ ↗
  - complementary "Editoronderdelen" [ref=e346]:
    - button "Linker gereedschapspaneel inklappen" [expanded] [ref=e347] [cursor=pointer]: −
    - generic [ref=e348]:
      - text: ◫
      - combobox "Actieve leerbox":
        - option "Playwright leerbox" [selected]
    - region "Beheer" [ref=e349]:
      - button [ref=e350] [cursor=pointer]:
        - generic [ref=e351]: +
        - strong [ref=e352]: Nieuw
      - button [ref=e353] [cursor=pointer]:
        - generic [ref=e354]: ⇅
        - strong [ref=e355]: Bronnen
      - button [ref=e356] [cursor=pointer]:
        - generic [ref=e357]: ▤
        - strong [ref=e358]: Plan
    - region "Onderwijsarchitectuur" [ref=e359]:
      - button [ref=e360] [cursor=pointer]:
        - generic [ref=e361]: ℹ️
        - strong [ref=e362]: Info
      - button [ref=e363] [cursor=pointer]:
        - generic [ref=e364]: 🎯
        - strong [ref=e365]: Missie
      - button [ref=e366] [cursor=pointer]:
        - generic [ref=e367]: 🔭
        - strong [ref=e368]: Visie
      - button [ref=e369] [cursor=pointer]:
        - generic [ref=e370]: 🧭
        - strong [ref=e371]: Strategie
      - button [ref=e372] [cursor=pointer]:
        - generic [ref=e373]: 🏁
        - strong [ref=e374]: Doelen
      - button [ref=e375] [cursor=pointer]:
        - generic [ref=e376]: 🎮
        - strong [ref=e377]: Game
      - button [ref=e378] [cursor=pointer]:
        - generic [ref=e379]: ⚑
        - strong [ref=e380]: Start
      - button [ref=e381] [cursor=pointer]:
        - generic [ref=e382]: 🧗
        - strong [ref=e383]: Weerstand
      - button [ref=e384] [cursor=pointer]:
        - generic [ref=e385]: 🏆
        - strong [ref=e386]: Succes
    - region "Analyse" [ref=e387]:
      - button [ref=e388] [cursor=pointer]:
        - generic [ref=e389]: ⌘
        - strong [ref=e390]: Structuur
      - button [ref=e391] [cursor=pointer]:
        - generic [ref=e392]: </>
        - strong [ref=e393]: Code
      - button [ref=e394] [cursor=pointer]:
        - generic [ref=e395]: ▦
        - strong [ref=e396]: Rapport
      - button [ref=e397] [cursor=pointer]:
        - generic [ref=e398]: ✓
        - strong [ref=e399]: Controle
      - button [ref=e400] [cursor=pointer]:
        - generic [ref=e401]: ◉
        - strong [ref=e402]: Meten
      - button [ref=e403] [cursor=pointer]:
        - generic [ref=e404]: ▣
        - strong [ref=e405]: Preview
    - region "Gereedschap" [ref=e406]:
      - generic "Leerobject" [ref=e407]:
        - button [ref=e408] [cursor=pointer]:
          - generic: ⚑
          - strong [ref=e409]: Start
        - button [ref=e410] [cursor=pointer]:
          - generic:
            - text: ★
            - img:
              - generic:
                - generic: "2"
                - generic: "1"
                - generic: "3"
          - strong [ref=e411]: Succes
        - button [ref=e412] [cursor=pointer]:
          - generic: ▲
          - strong [ref=e413]: Weerstand
        - button [ref=e414] [cursor=pointer]:
          - generic: ⚙
          - strong [ref=e415]: Normaal
      - radiogroup "Soort verbinding" [ref=e416]:
        - radio [ref=e417] [cursor=pointer]:
          - strong [ref=e422]: Route
        - radio [checked] [ref=e423] [cursor=pointer]:
          - generic [ref=e424]: ▣
          - strong [ref=e425]: Voorw.
    - region "Bouwstenenbibliotheek" [ref=e427]:
      - button [ref=e428] [cursor=pointer]:
        - strong [ref=e448]: Reguliere LEGO-blokken
      - button [ref=e449] [cursor=pointer]:
        - strong [ref=e511]: Speciale leerblokken en leerobjecten
      - button [ref=e512] [cursor=pointer]:
        - strong [ref=e716]: Archetypen
    - button "Adviseur openen" [ref=e718] [cursor=pointer]
  - generic "Simulatielengte in acties" [ref=e728]:
    - group "Simulatieklok met ontwikkelfasen, duur en aantal acties" [ref=e729]:
      - generic "Ontwikkelfase leerbox" [ref=e730]
      - slider "Duur in minuten" [ref=e733]
      - slider "Aantal acties" [ref=e735]
      - generic: PILOT
      - generic: "30"
      - generic: MIN
      - generic: "100"
      - generic: ACTIES
    - generic [ref=e739]:
      - generic [ref=e740]: ACTIES
      - spinbutton "Simulatiewaarde" [ref=e741]: "100"
    - button "Simulatie starten" [ref=e742] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { createHash } from "node:crypto";
  3   | import { readFile, writeFile } from "node:fs/promises";
  4   | import {
  5   |   API_BASE,
  6   |   addChromePreset,
  7   |   captureFromStorage,
  8   |   createFixtureScenario,
  9   |   getBrowserMessages,
  10  |   getClipboardWrites,
  11  |   expectNoRuntimeErrors,
  12  |   postEditorMessage,
  13  |   prepareEditorFrame,
  14  |   prepareEditorPage,
  15  |   requestLog,
  16  |   settleRenderedOutput,
  17  |   waitForBrowserMessage,
  18  |   waitForRequestLog,
  19  |   waitForSettledCanvas
  20  | } from "./fixtures.mjs";
  21  | import {
  22  |   captureOutputFingerprint,
  23  |   sha256Hex,
  24  |   stableJsonStringify
  25  | } from "./output-fingerprint.mjs";
  26  | import { pngVisualSha256 } from "./png-pixel-hash.mjs";
  27  | 
  28  | const FIXED_EVENTS = Object.freeze([
  29  |   { timestamp: "2026-08-28T08:00:00.000Z", user_id: "e2e-user", learning_object_id: "startobject" },
  30  |   { timestamp: "2026-08-28T08:00:05.000Z", user_id: "e2e-user", learning_object_id: "weerstandsobject" },
  31  |   { timestamp: "2026-08-28T08:00:12.000Z", user_id: "e2e-user", learning_object_id: "leerobject" },
  32  |   { timestamp: "2026-08-28T08:00:18.000Z", user_id: "e2e-user", learning_object_id: "succesobject" }
  33  | ]);
  34  | const ACTION_SMOKE = process.env.LEERBOX_EDITOR_ACTION_SMOKE === "1";
  35  | const DEBUG_CHECKPOINTS = new Set(String(process.env.LEERBOX_EDITOR_DEBUG_CHECKPOINTS || "")
  36  |   .split(",").map(value => value.trim()).filter(Boolean));
  37  | const DEBUG_STOP_AFTER = String(process.env.LEERBOX_EDITOR_DEBUG_STOP_AFTER || "").trim();
  38  | 
  39  | function digest(bytes) {
  40  |   return createHash("sha256").update(bytes).digest("hex");
  41  | }
  42  | 
  43  | function slug(value) {
  44  |   return String(value)
  45  |     .normalize("NFKD")
  46  |     .replace(/[^a-zA-Z0-9]+/g, "-")
  47  |     .replace(/^-|-$/g, "")
  48  |     .toLowerCase();
  49  | }
  50  | 
  51  | async function checkpoint(page, records, action, {
  52  |   roots = ["body"],
  53  |   network = [],
  54  |   messages = [],
  55  |   downloads = [],
  56  |   errors = [],
  57  |   screenshotPage = page
  58  | } = {}) {
  59  |   await settleRenderedOutput(page);
  60  |   if (ACTION_SMOKE) {
  61  |     console.log(`ACTION_SMOKE ${action}`);
  62  |     records.push({ action });
  63  |     return;
  64  |   }
  65  |   const fingerprint = await captureOutputFingerprint(page, {
  66  |     scenario: "complete-action-matrix",
  67  |     checkpoint: action,
  68  |     roots,
  69  |     network,
  70  |     messages,
  71  |     downloads
  72  |   });
  73  |   const screenshot = await screenshotPage.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
  74  |   if (DEBUG_CHECKPOINTS.has(action)) {
  75  |     const screenshotPath = test.info().outputPath(`${action}.png`);
  76  |     const geometryPath = test.info().outputPath(`${action}.geometry.json`);
  77  |     await writeFile(screenshotPath, screenshot);
  78  |     await writeFile(geometryPath, `${stableJsonStringify(fingerprint.geometry.nodes, 2)}\n`, "utf8");
  79  |     await test.info().attach(`${action}.png`, { path: screenshotPath, contentType: "image/png" });
  80  |     await test.info().attach(`${action}.geometry.json`, { path: geometryPath, contentType: "application/json" });
  81  |   }
> 82  |   if (action === DEBUG_STOP_AFTER) throw new Error(`Diagnostische stop na ${action}.`);
      |                                          ^ Error: Diagnostische stop na block-dialog-cancel.
  83  |   records.push({
  84  |     action,
  85  |     screenshotVisualSha256: pngVisualSha256(screenshot),
  86  |     domSha256: fingerprint.dom.sha256,
  87  |     cssSha256: fingerprint.css.sha256,
  88  |     geometrySha256: fingerprint.geometry.sha256,
  89  |     svgDrawablesSha256: sha256Hex(fingerprint.svg.drawables || []),
  90  |     stateSha256: fingerprint.state.sha256,
  91  |     network: fingerprint.assets.networkTrace || [],
  92  |     messages: fingerprint.messages.items || [],
  93  |     downloads: fingerprint.downloads.items || [],
  94  |     errors: [...errors]
  95  |   });
  96  | }
  97  | 
  98  | async function expectActionGolden(records, name) {
  99  |   if (ACTION_SMOKE) {
  100 |     expect(records.length, `${name} bevat geen acties`).toBeGreaterThan(0);
  101 |     expect(new Set(records.map(record => record.action)).size, `${name} bevat dubbele actie-ID's`).toBe(records.length);
  102 |     return;
  103 |   }
  104 |   expect(`${stableJsonStringify(records, 2)}\n`).toMatchSnapshot(name);
  105 | }
  106 | 
  107 | async function clickAndRecord(page, records, selector, action, options) {
  108 |   const control = page.locator(selector);
  109 |   await expect(control).toHaveCount(1);
  110 |   await activateControl(control);
  111 |   await checkpoint(page, records, action, options);
  112 | }
  113 | 
  114 | async function activateControl(control) {
  115 |   if (await control.isVisible() && await control.isEnabled()) {
  116 |     await control.click();
  117 |     return "pointer";
  118 |   }
  119 |   // Sommige legacy-controls blijven bewust als verborgen programmatic API in
  120 |   // de DOM staan. HTMLElement.click() volgt voor die controls exact het pad
  121 |   // dat ook het toegestane postMessage-contract aanroept.
  122 |   await control.evaluate(element => element.click());
  123 |   return "programmatic";
  124 | }
  125 | 
  126 | async function setControlValue(control, value, eventType = "input") {
  127 |   await control.evaluate((element, next) => {
  128 |     element.value = next.value;
  129 |     element.dispatchEvent(new Event(next.eventType, { bubbles: true }));
  130 |   }, { value, eventType });
  131 | }
  132 | 
  133 | async function clickElementCenter(page, control) {
  134 |   await control.scrollIntoViewIfNeeded();
  135 |   const box = await control.boundingBox();
  136 |   expect(box).not.toBeNull();
  137 |   await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  138 | }
  139 | 
  140 | async function nativeDragElement(page, source, target, targetPosition) {
  141 |   const rect = element => {
  142 |     const box = element.getBoundingClientRect();
  143 |     return { x: box.x, y: box.y, width: box.width, height: box.height };
  144 |   };
  145 |   const [sourceBox, targetBox] = await Promise.all([
  146 |     source.evaluate(rect),
  147 |     target.evaluate(rect)
  148 |   ]);
  149 |   expect(sourceBox.width).toBeGreaterThan(0);
  150 |   expect(sourceBox.height).toBeGreaterThan(0);
  151 |   expect(targetBox.width).toBeGreaterThan(targetPosition.x);
  152 |   expect(targetBox.height).toBeGreaterThan(targetPosition.y);
  153 |   const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  154 |   const finish = { x: targetBox.x + targetPosition.x, y: targetBox.y + targetPosition.y };
  155 |   await page.mouse.move(start.x, start.y);
  156 |   await page.mouse.down();
  157 |   await page.mouse.move(finish.x, finish.y, { steps: 12 });
  158 |   await page.mouse.up();
  159 | }
  160 | 
  161 | async function chooseFilesViaButton(page, button, files) {
  162 |   await expect(button).toBeVisible();
  163 |   await expect(button).toBeEnabled();
  164 |   const chooserPromise = page.waitForEvent("filechooser");
  165 |   await button.click();
  166 |   const chooser = await chooserPromise;
  167 |   await chooser.setFiles(files);
  168 | }
  169 | 
  170 | function networkEvidence(trackers) {
  171 |   return requestLog(trackers).map(record => ({
  172 |     method: record.method,
  173 |     url: record.url,
  174 |     pathname: record.pathname,
  175 |     query: record.query,
  176 |     jsonSha256: record.json == null ? null : sha256Hex(record.json),
  177 |     postDataSha256: record.postData == null ? null : sha256Hex(record.postData),
  178 |     fileNames: record.fileNames,
  179 |     fieldNames: record.fieldNames
  180 |   }));
  181 | }
  182 | 
```