/**
 * Machineleesbare inventaris van alle gebruikersacties van de LeerboxEditor.
 *
 * De statische inventaris is bewust gesloten: de bijbehorende unit-test leest
 * index.html en het publieke Engine-template en weigert ieder nieuw control
 * totdat het hier aan een scenario of een gedocumenteerde historische no-op is
 * gekoppeld. Dynamische controls en postMessage-contracten zijn afzonderlijk
 * opgenomen omdat ze pas tijdens het renderen bestaan.
 */

export const ACTION_CATALOG_SCHEMA_VERSION = 1;

export const scenarioCatalog = Object.freeze({
  "chrome-menu": "Gedeelde chrome inklappen en terugnavigeren.",
  "chrome-twins": "Leerboxinventaris, popover en leerboxwissel.",
  "chrome-views": "Alle chromecommando's die een workbench-, paneel- of workspaceview openen.",
  "capture-reset": "Nieuwe capture annuleren of bevestigen.",
  "description-edit": "Ruwe beschrijving en strategische velden wijzigen.",
  "capture-field-edit": "Ieder canoniek captureveld, inclusief meerkeuzevelden, wijzigen.",
  "architecture-field-edit": "Dynamische architectuurvelden wijzigen.",
  "workbench-navigation": "Alle workbench-, tab-, workspace- en sluitknoppen.",
  "plan-views-downloads": "TeX-, PDF- en JSON-plan bekijken en downloaden.",
  "object-presets": "De vier objectpresets via chrome, dubbelklik en drop toevoegen.",
  "library-palette": "SDK-bibliotheekcategorie openen en een .blok-item kiezen.",
  "block-dialog-object": "Object toevoegen, wijzigen, bewaren, annuleren en verwijderen.",
  "block-dialog-step": "Routestap toevoegen, wijzigen, bewaren, annuleren en verwijderen.",
  "block-dialog-dependency": "Voorwaarde toevoegen, wijzigen, bewaren, annuleren en verwijderen.",
  "canvas-route": "Routekabel via nodes en LEGO-noppen maken en openen.",
  "canvas-conditional": "Voorwaardekabel via nodes en LEGO-noppen maken en openen.",
  "canvas-navigation": "Node slepen, kaart pannen, centreren en bij resize herberekenen.",
  "canvas-overlays": "Toolbox, inspector, rapport en lokale adviseur bedienen.",
  "history-restore": "Herstelpunten laden, sluiten en terugzetten.",
  "prompt-workflow": "AI-basisprompt openen, kopieren en downloaden.",
  "capture-import-export": "Beschrijving/capture importeren en capture-JSON exporteren.",
  "preview-generation": "Webapp-preview genereren, fout tonen en resultaat publiceren.",
  "simulation-prompt": "Simulatieparameters en vaste prompt bedienen.",
  "simulation-clock": "Klok via pointer, toetsenbord en numerieke invoer bedienen.",
  "simulation-profile": "Profielmodus en vijf archetypesliders wijzigen.",
  "simulation-testdata": "Testdata typen/uploaden, valideren en simuleren.",
  "simulation-existing-data": "Eerdere data zoeken, kiezen en gebruiken.",
  "json-output": "Afgeleide JSON en statements bekijken en kopieren.",
  "agent-conversation": "Agentstatus, mode, template, gesprek en resultaat toepassen.",
  "agent-token-dialogs": "Tokenbevestiging en werkelijk verbruik afhandelen.",
  "agent-trace": "Technoloogtrace openen en sluiten.",
  "agent-field-fill": "Een dynamische veld-Agentknop uitvoeren.",
  "bucket-drawer": "Bronlade, selectie, consent en downloads bedienen.",
  "bucket-import": "Document, ZIP, repository en website importeren.",
  "bucket-fill": "Velden uit bronnen invullen en voorgestelde mutaties afhandelen.",
  "iframe-inbound": "Alle publieke Dashboard-naar-Editorberichten uitvoeren.",
  "iframe-outbound": "Alle publieke Editor-naar-Dashboardberichten controleren.",
  "auth-bootstrap": "Authbeslissing en SDK/chrome-bootstrap controleren."
});

const covered = (...scenarioIds) => Object.freeze({ scenarioIds: Object.freeze(scenarioIds) });
const historicalNoOp = reason => Object.freeze({ historicalNoOp: reason });

function entry(source, fingerprint, selector, coverage, expectedCount = 1) {
  return Object.freeze({ source, fingerprint, selector, expectedCount, ...coverage });
}

function byId(source, ids, coverage) {
  return ids.map(id => entry(source, `id:${id}`, `#${id}`, coverage));
}

function byName(tag, names, coverage) {
  return names.map(name => entry("index.html", `name:${tag}:${name}`, `${tag}[name="${name}"]`, coverage));
}

function byData(source, tag, attributes, selector, coverage, expectedCount = 1) {
  const fingerprint = `data:${tag}:${Object.entries(attributes).map(([name, value]) => `${name}=${value}`).join("&")}`;
  return entry(source, fingerprint, selector, coverage, expectedCount);
}

const indexTopLevel = [
  ...byId("index.html", ["newCaptureButton"], covered("capture-reset")),
  ...byId("index.html", ["uploadDescriptionButton", "rawDescriptionInput", "importButton", "importFileInput", "exportButton"], covered("capture-import-export")),
  ...byId("index.html", ["promptButton", "downloadPromptButton", "closePromptButton", "promptOutput", "copyPromptButton", "donePromptButton"], covered("prompt-workflow")),
  ...byId("index.html", ["previewWebappButton"], covered("preview-generation")),
  ...byId("index.html", ["simulateButton"], covered("simulation-prompt")),
  ...byId("index.html", ["languageSelect"], historicalNoOp("Het historische taalcontrol bevat uitsluitend Nederlands; wijzigen heeft daardoor geen tweede gebruikerskeuze."))
];

const descriptionIds = [
  "rawDescriptionText", "strategicMission", "strategicMissionActions",
  "strategicVision", "strategicVisionActions", "strategicStrategy",
  "strategicStrategyActions", "strategicGoals", "strategicGoalsActions",
  "strategicPhase", "discoveryInput"
];

const sourceIds = [
  "importDocumentsButton", "importZipButton", "importRepositoryButton", "importWebsiteButton",
  "sourceDocumentInput", "sourceZipInput", "repositoryUrl", "websiteUrl", "refreshBucketButton",
  "agentImportDocumentsButton", "agentImportZipButton", "agentImportRepositoryButton", "agentImportWebsiteButton"
];

const agentIds = [
  "agentResetConversationButton", "agentNewConversationButton", "agentPanelCloseButton",
  "agentMode", "agentDocumentCloseButton", "agentBucketConsent", "agentInput", "agentSendButton",
  "agentApplyCaptureButton", "agentApplyTestDataButton"
];

const agentDialogIds = [
  "fillFromSourcesButton", "sourceFillCancelButton", "sourceFillContinueButton", "sourceFillApplyButton"
];

const captureInputNames = [
  "metadata.work_name", "metadata.leerbox_id", "metadata.domain", "play_characteristics.recognizable_play_form"
];

const captureSelectNames = [
  "capture_mode", "metadata.type", "metadata.status", "participants.social_setting",
  "leerbox_design.attraction_type", "leerbox_design.learning_modes",
  "leerbox_design.leerbox_principles", "leerbox_design.material_mix",
  "leerbox_design.box_climates", "leerbox_design.good_practice_tags",
  "game_design.game_genres", "game_design.mechanics", "game_design.dynamics",
  "game_design.aesthetics", "game_design.levels_or_progression",
  "freedom_and_sequence.route_model"
];

const captureTextareaNames = [
  "metadata.summary", "pedagogical_core.central_learning_goal",
  "pedagogical_core.success_definition", "participants.primary_target_group",
  "game_design.player_goal", "game_design.win_state", "game_design.fail_state",
  "game_design.rules_summary", "game_design.core_loops", "game_design.challenge_curve",
  "game_design.onboarding", "play_characteristics.play_theme_or_story",
  "play_characteristics.core_mechanics", "play_characteristics.rules_or_constraints",
  "play_characteristics.freedom_degrees", "play_characteristics.direct_feedback_loop",
  "entry_and_orientation.first_visible_action", "entry_and_orientation.minimal_start_instruction",
  "entry_and_orientation.self_starting_signal", "entry_and_orientation.self_explaining_cues",
  "entry_and_orientation.proactive_invitation", "measurement.event_contract.example_action_types",
  "measurement.event_contract.result_values", "simulation_definition.not_visible_to_engine",
  "simulation_definition.realism_notes_for_contact_generation", "measurement.privacy_notes",
  "freedom_and_sequence.freedom_principle", "freedom_and_sequence.preferred_sequence",
  "freedom_and_sequence.free_choice_zones", "freedom_and_sequence.forced_path_risk",
  "freedom_and_sequence.variation_opportunities", "barriers_and_recovery.main_barrier"
];

const indexStatic = [
  ...indexTopLevel,
  ...byId("index.html", ["workflowPanelCloseButton", "paletteCloseButton"], covered("workbench-navigation")),
  ...byId("index.html", descriptionIds, covered("description-edit")),
  ...byId("index.html", sourceIds, covered("bucket-import")),
  ...byId("index.html", agentIds, covered("agent-conversation", "bucket-drawer")),
  ...byId("index.html", agentDialogIds, covered("bucket-fill", "agent-token-dialogs")),
  ...byId("index.html", ["agentTraceToggle", "agentTraceClose"], covered("agent-trace")),
  ...byId("index.html", ["addObjectButton", "closeDialogButton", "cancelDialogButton", "deleteBlockButton"], covered("block-dialog-object", "block-dialog-step", "block-dialog-dependency")),
  ...byId("index.html", ["addStepButton"], covered("block-dialog-step")),
  ...byId("index.html", ["addDependencyButton"], covered("block-dialog-dependency")),
  ...byId("index.html", ["downloadLatexButton", "downloadLatexDataButton"], covered("plan-views-downloads")),
  ...byId("index.html", ["toolboxToggle", "canvasReportToggle", "canvasReportClose", "advisorToggle", "advisorAiEnabled", "openAdvisorAgent"], covered("canvas-overlays")),
  ...byId("index.html", ["historyButton", "historyCloseButton"], covered("history-restore")),
  ...byId("index.html", ["centerCanvasButton"], covered("canvas-navigation")),
  ...byId("index.html", ["fullStatementsOutput", "vatStatementsOutput"], historicalNoOp("Dit zijn historisch bewerkbare afgeleide uitvoervelden; handmatige tekstwijzigingen muteren de capture niet.")),
  ...byId("index.html", ["copyButton", "jsonOutput"], covered("json-output")),
  ...byId("index.html", ["uploadTestDataButton", "testDataFileInput", "testDataInput", "runTestButton"], covered("simulation-testdata")),
  ...byId("index.html", ["existingDataSelect", "refreshExistingDataButton", "useExistingDataButton"], covered("simulation-existing-data")),
  ...byId("index.html", [
    "closeSimulationParametersButton", "simulationSigma", "simulationRunCount",
    "cancelSimulationParametersButton", "closeSimulationPromptButton", "simulationPromptOutput",
    "copySimulationPromptButton", "doneSimulationPromptButton"
  ], covered("simulation-prompt")),
  ...byName("input", captureInputNames, covered("capture-field-edit")),
  ...byName("select", captureSelectNames, covered("capture-field-edit")),
  ...byName("textarea", captureTextareaNames, covered("capture-field-edit")),
  ...["description", "agent", "sources", "intake", "build", "validation", "simulation", "json"].map(value =>
    byData("index.html", "button", { "data-workbench-view": value }, `button[data-workbench-view="${value}"]`, covered("workbench-navigation"))),
  ...["overview", "design", "game", "entry", "measurement"].map(value =>
    byData("index.html", "button", { "data-panel": value }, `button[data-panel="${value}"]`, covered("workbench-navigation"))),
  ...["latex", "architecture", "vat", "statements"].map(value =>
    byData("index.html", "button", { "data-workspace-view": value }, `button.workspace-view-button[data-workspace-view="${value}"]`, covered("workbench-navigation"))),
  byData("index.html", "button", { "data-workspace-close": "" }, "button[data-workspace-close]", covered("workbench-navigation"), 3),
  byData("index.html", "button", { "data-workbench-close": "build" }, "button[data-workbench-close=" + '"build"]', covered("workbench-navigation")),
  ...["source", "pdf", "json"].map(value =>
    byData("index.html", "button", { "data-plan-view": value }, `button[data-plan-view="${value}"]`, covered("plan-views-downloads"))),
  ...["entry", "success", "resistance", "normal"].map(value =>
    byData("index.html", "button", { "data-object-preset": value }, `.object-toolbox button[data-object-preset="${value}"]`, covered("object-presets"))),
  ...["individual", "group"].map(value =>
    byData("index.html", "button", { "data-profile-mode": value }, `button[data-profile-mode="${value}"]`, covered("simulation-profile"))),
  ...["Veroveraar", "Verwerver", "Verkenner", "Volger", "Verlater"].map(value =>
    byData("index.html", "input", { "data-archetype": value }, `input[data-archetype="${value}"]`, covered("simulation-profile"))),
  entry("index.html", "text:button:Clone", "#repositoryImportForm button[type=" + '"submit"]', covered("bucket-import")),
  entry("index.html", "text:button:Importeer", "#websiteImportForm button[type=" + '"submit"]', covered("bucket-import")),
  entry("index.html", "value:button:cancel", "#agentTokenDialog button[value=" + '"cancel"]', covered("agent-token-dialogs")),
  entry("index.html", "value:button:confirm", "#agentTokenDialog button[value=" + '"confirm"]', covered("agent-token-dialogs")),
  entry("index.html", "value:button:close", "#agentCallResultDialog button[value=" + '"close"]', covered("agent-token-dialogs")),
  entry("index.html", "text:button:Bewaar", "#blockForm button[type=" + '"submit"]', covered("block-dialog-object", "block-dialog-step", "block-dialog-dependency")),
  entry("index.html", "text:button:Maak prompt", "#simulationParametersForm button[type=" + '"submit"]', covered("simulation-prompt")),
  entry("index.html", "text:summary:Interactieroute 0", ".inspector-drawer summary", covered("canvas-overlays")),
  entry("index.html", "text:summary:Afhankelijkheden 0", ".inspector-drawer summary", covered("canvas-overlays"))
];

const chromeSource = "engine:editor-chrome.template.html";
const chromeIds = [
  ...byId(chromeSource, ["editor-menu-collapse", "editor-back-to-learningbox"], covered("chrome-menu")),
  ...byId(chromeSource, ["editor-twin-select"], covered("chrome-twins")),
  ...byId(chromeSource, ["generate-preview-action", "hud-preview-action"], covered("preview-generation")),
  ...byId(chromeSource, ["hud-new-action"], covered("capture-reset")),
  ...byId(chromeSource, ["hud-report-action"], covered("canvas-overlays")),
  ...byId(chromeSource, ["hud-step-action"], covered("canvas-route")),
  ...byId(chromeSource, ["hud-dependency-action"], covered("canvas-conditional")),
  ...byId(chromeSource, ["editor-advisor-toggle", "editor-advisor-close"], covered("chrome-views")),
  ...byId(chromeSource, ["editor-advisor-chat"], historicalNoOp("Deze historische chromeknop heeft markup maar editor-chrome.js registreert er geen click-handler voor.")),
  ...byId(chromeSource, ["editor-tool-flyout-close"], historicalNoOp("De sluitknop is bedraad, maar de historische chrome bevat geen gebruikersactie die de flyout opent.")),
  ...byId(chromeSource, ["clock-duration-arc", "clock-actions-arc", "simulation-action-count", "simulation-clock-play"], covered("simulation-clock")),
  ...byId(chromeSource, ["simulation-unit", "simulation-sigma"], historicalNoOp("Verborgen implementatievelden voor de klok; ze zijn niet rechtstreeks door een gebruiker te bedienen."))
];

const chromeViews = [
  ["description", "", ""], ["sources", "", ""], ["build", "", "latex"],
  ["intake", "overview", ""], ["description", "mission", ""],
  ["description", "vision", ""], ["description", "strategy", ""],
  ["description", "goals", ""], ["intake", "game", ""],
  ["intake", "entry", ""], ["description", "resistance", ""],
  ["description", "success", ""], ["build", "", "architecture"],
  ["build", "", "statements"], ["validation", "", ""],
  ["intake", "measurement", ""]
];

const chromeStatic = [
  ...chromeIds,
  ...chromeViews.map(([view, panel, workspace]) => {
    const attributes = { "data-editor-page-view": view };
    if (panel) attributes["data-editor-panel"] = panel;
    if (workspace) attributes["data-editor-workspace-view"] = workspace;
    const selector = `button[data-editor-page-view="${view}"]${panel ? `[data-editor-panel="${panel}"]` : ""}${workspace ? `[data-editor-workspace-view="${workspace}"]` : ""}`;
    return byData(chromeSource, "button", attributes, selector, covered("chrome-views"));
  }),
  ...["entry", "success", "resistance", "normal"].map(value =>
    byData(chromeSource, "button", { "data-object-preset": value }, `.editor-page-menu button[data-object-preset="${value}"]`, covered("object-presets"))),
  entry(chromeSource, "title:button:Scan de route", '.editor-advisor-actions button[title="Scan de route"]', historicalNoOp("De historische SDK-templateknop heeft geen geregistreerde click-handler.")),
  entry(chromeSource, "title:button:Vraag advies", '.editor-advisor-actions button[title="Vraag advies"]', historicalNoOp("De historische SDK-templateknop heeft geen geregistreerde click-handler.")),
  entry(chromeSource, "title:button:Waarschuwingen", '.editor-advisor-actions button[title="Waarschuwingen"]', historicalNoOp("De historische SDK-templateknop heeft geen geregistreerde click-handler."))
];

export const staticControlCatalog = Object.freeze([...indexStatic, ...chromeStatic]);

export const dynamicControlFamilies = Object.freeze([
  { id: "twin-popover-items", source: "editor-chrome.js", selector: "#editor-twin-popover [data-twin-id]", scenarioIds: ["chrome-twins"], evidence: "data-twin-id" },
  { id: "library-categories", source: "lego-library-browser.mount.js", selector: "[data-blok-library-category]", scenarioIds: ["library-palette"], evidence: "data-blok-library-category" },
  { id: "library-items", source: "lego-library-browser.mount.js", selector: "[data-library-index]", scenarioIds: ["library-palette"], evidence: "data-library-index" },
  { id: "field-agent-buttons", source: "script.js", selector: ".field-agent-button[data-agent-field-path]", scenarioIds: ["agent-field-fill"], evidence: "data-agent-field-path" },
  { id: "agent-template-fields", source: "script.js", selector: "[data-template-field]", scenarioIds: ["agent-conversation"], evidence: "data-template-field" },
  { id: "bucket-source-checkboxes", source: "script.js", selector: "[data-bucket-source-id]", scenarioIds: ["bucket-drawer"], evidence: "data-bucket-source-id" },
  { id: "bucket-download-links", source: "script.js", selector: ".bucket-source-download-link", scenarioIds: ["bucket-drawer"], evidence: "bucket-source-download-link" },
  { id: "source-fill-mutations", source: "script.js", selector: "[data-mutation-index]", scenarioIds: ["bucket-fill"], evidence: "mutationIndex" },
  { id: "history-items", source: "script.js", selector: "[data-history-index]", scenarioIds: ["history-restore"], evidence: "data-history-index" },
  { id: "report-route-items", source: "script.js", selector: "[data-report-route]", scenarioIds: ["canvas-overlays"], evidence: "data-report-route" },
  { id: "object-block-cards", source: "script.js", selector: ".block-card.object[data-index]", scenarioIds: ["block-dialog-object"], evidence: "block-card object" },
  { id: "step-block-cards", source: "script.js", selector: ".block-card.step[data-index]", scenarioIds: ["block-dialog-step"], evidence: "block-card step" },
  { id: "dependency-block-cards", source: "script.js", selector: ".block-card.dependency[data-index]", scenarioIds: ["block-dialog-dependency"], evidence: "block-card dependency" },
  { id: "dialog-generated-fields", source: "script.js", selector: "#dialogFields [name]", scenarioIds: ["block-dialog-object", "block-dialog-step", "block-dialog-dependency"], evidence: "id=\"${id}\" name=\"${key}\"" },
  { id: "architecture-generated-inputs", source: "script.js", selector: "[data-architecture-path]", scenarioIds: ["architecture-field-edit"], evidence: "data-architecture-path" },
  { id: "network-nodes", source: "lego-flow-map", selector: ".network-node[data-object-index][data-object-id]", scenarioIds: ["canvas-route", "canvas-conditional", "canvas-navigation", "block-dialog-object"], evidence: "network-node" },
  { id: "network-edges", source: "lego-flow-map", selector: "[data-block-type][data-block-index]", scenarioIds: ["canvas-route", "canvas-conditional", "block-dialog-step", "block-dialog-dependency"], evidence: "data-block-type" },
  { id: "lego-studs", source: "lego-flow-map", selector: "[data-flow-stud]", scenarioIds: ["canvas-route", "canvas-conditional"], evidence: "data-flow-stud" },
  { id: "rubber-band", source: "script.js", selector: "#rubberBand", scenarioIds: ["canvas-route", "canvas-conditional"], evidence: "rubberBand" }
]);

export const postMessageContracts = Object.freeze({
  inbound: Object.freeze([
    "leerpret-editor-view",
    "leerpret-editor-close-overlays",
    "leerpret-editor-click-control",
    "leerpret-editor-add-object-preset",
    "leerpret-editor-add-library-item",
    "leerpret-editor-start-cable",
    "leerpret-editor-connection-mode",
    "leerpret-editor-generate-preview",
    "leerpret-editor-simulation-control"
  ].map(type => Object.freeze({ type, scenarioIds: ["iframe-inbound"] }))),
  outbound: Object.freeze([
    "leerpret-editor-panel-closed",
    "leerpret-source-count",
    "leerpret-editor-workspace-view",
    "leerpret-editor-capture-updated",
    "leerpret-preview-generated",
    "leerpret-simulation-status"
  ].map(type => Object.freeze({ type, scenarioIds: ["iframe-outbound"] })))
});

const semanticDataAttributes = Object.freeze([
  "data-editor-page-view", "data-editor-panel", "data-editor-workspace-view",
  "data-workbench-view", "data-panel", "data-workspace-view", "data-workspace-close",
  "data-workbench-close", "data-plan-view", "data-object-preset", "data-profile-mode",
  "data-archetype", "data-sim-control", "data-clock-slider"
]);

function parseAttributes(source) {
  const attributes = Object.create(null);
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

/** Dezelfde stabiele fingerprintfunctie wordt door de gesloten CI-test gebruikt. */
export function fingerprintHtmlControls(html) {
  const controls = [];
  const pattern = /<(button|select|textarea|a|summary)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(input|path)\b([^>]*)>/gi;
  for (const match of html.matchAll(pattern)) {
    const tag = (match[1] || match[4]).toLowerCase();
    const attributes = parseAttributes(match[2] || match[5] || "");
    if (tag === "path" && attributes.role !== "slider") continue;
    let fingerprint;
    if (attributes.id) {
      fingerprint = `id:${attributes.id}`;
    } else if (attributes.name) {
      fingerprint = `name:${tag}:${attributes.name}`;
    } else {
      const data = semanticDataAttributes
        .filter(name => Object.hasOwn(attributes, name))
        .map(name => `${name}=${attributes[name]}`);
      if (data.length) {
        fingerprint = `data:${tag}:${data.join("&")}`;
      } else if (attributes.title) {
        fingerprint = `title:${tag}:${attributes.title}`;
      } else if (attributes["aria-label"]) {
        fingerprint = `aria:${tag}:${attributes["aria-label"]}`;
      } else if (attributes.value) {
        fingerprint = `value:${tag}:${attributes.value}`;
      } else {
        const text = String(match[3] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        fingerprint = `text:${tag}:${text}`;
      }
    }
    controls.push({ tag, fingerprint });
  }
  return controls;
}
