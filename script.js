(function () {
  "use strict";

  const baseStorageKey = "leerpretarchitect-capture-v1";
  const languageStorageKey = "leerpretarchitect-language";
  const simulationParametersStorageKey = "leerpretarchitect-simulation-parameters-v1";
  const advisorAiStorageKey = "leerpretarchitect-advisor-ai-v1";
  const workbenchViewStorageKey = "leerpretarchitect-workbench-view-v1";
  const pageParameters = new URLSearchParams(window.location.search);
  const selectedLeerboxId = pageParameters.get("leerbox_id") || "";
  const parentOrigin = pageParameters.get("parent_origin") || "*";
  const storageKey = selectedLeerboxId ? `${baseStorageKey}:${selectedLeerboxId}` : baseStorageKey;
  const agentRole = pageParameters.get("role") || "architect";
  const engineAdapter = window.LeerboxEditorEngine || {
    apiBase: pageParameters.get("api")?.replace(/\/$/, "") || "",
    fetch: (input, init) => window.fetch(input, init)
  };
  const agentApiBase = engineAdapter.apiBase;
  // Standalone (top-level venster) draait automatisch embedded: de eigen topbar
  // en pill-sidebar verdwijnen en de gedeelde editor-chrome neemt de navigatie
  // over. In het dashboard-iframe bepaalt ?embedded=1 het gedrag.
  const embeddedWorkbench = pageParameters.get("embedded") === "1" || window.parent === window;
  const unknown = "unknown";
  const languageConfig = window.LeerpretArchitectLanguages || { defaultLanguage: "nl", messages: { nl: {} } };
  const promptFilename = "leerbox-basisprompt.txt";
  const jargonRationale =
    "Deze specifieke trefwoorden en syntaxisdefinities zijn gekozen op basis van eerdere praktijkvalidatie, omdat ze patronen van vrije actieregulatie consistent vangen in leermetadata.";
  const testDataFields = ["timestamp", "user_id", "learning_object_id"];
  const defaultSimulationParameters = {
    sigma: "2σ - gebalanceerd",
    run_count: 100,
    profile_mode: "individual",
    archetype_mix: { Veroveraar: 20, Verwerver: 20, Verkenner: 20, Volger: 20, Verlater: 20 }
  };
  const emptyImportedTestData = {
    raw_json: "",
    events: [],
    errors: [],
    is_valid: false
  };
  const simulationPromptTemplate = `Jij bent een geavanceerde data-simulator voor onderwijsarchitectuur.
Op basis van de onderstaande computertaal-statements (die een complete leerarchitectuur beschrijven) ga jij synthetische testdata genereren.

PARAMETERS VOOR DE SIMULATIE:
- Betrouwbaarheid/Marge: [INJECTEER_GEKOZEN_SIGMA]
- Omvang (Aantal testruns): [INJECTEER_AANTAL_RUNS]
- Profielmodus en archetypemix: [INJECTEER_PROFIEL]

OPDRACHT:
Genereer een reeks van opeenvolgende gedragsmarkers (een actiestroom) op basis van consistente gedragsprofielen (archetypen) die zich door deze structuur bewegen. Wees kritisch op de structuur: als een route logisch stagneert bij een weerstandsobject, simuleer dan herhaling of uitval.

OUTPUT FORMAAT:
Lever de data EXCLUSIEF op als een valide JSON-array, bestaande uit objecten met exact deze drie velden:
[
  { "timestamp": "ISO-8601-string", "user_id": "string", "learning_object_id": "string" },
  ...
]

HIER IS DE STRUCTUUR (SYNTAX):
[INJECTEER_VOLLEDIGE_STATEMENTS_UIT_VIEW_2]`;

  const optionSets = {
    learningMode: [
      "reproductive",
      "application_oriented",
      "meaning_oriented",
      "productive",
      "investigative",
      "design_based",
      "entrepreneurial",
      "playful",
      "visual",
      "narrative",
      "model_based",
      "self_directed",
      "collaborative",
      "reflective"
    ],
    leerboxPrinciple: [
      "thematic_context",
      "material_rich",
      "self_starting",
      "self_explaining",
      "proactive_invitation",
      "safe_try_retry",
      "choice_autonomy",
      "direct_feedback",
      "productive_barrier",
      "visible_success",
      "non_invasive_observation",
      "minimum_engine_input",
      "rich_simulation_context",
      "multiple_profile_routes"
    ],
    materialCategory: [
      "research_material",
      "language_material",
      "creative_material",
      "decoration_material",
      "math_material",
      "physical_tool",
      "digital_canvas",
      "portfolio_canvas",
      "role_card",
      "mission_card",
      "story_object",
      "construction_block",
      "sensor_object",
      "feedback_display",
      "success_artifact"
    ],
    boxClimate: ["living_room", "arena", "laboratory", "stage"],
    goodPractice: [
      "goal_clarity",
      "intrinsic_motivation",
      "prior_knowledge_connection",
      "orientation",
      "practice_opportunity",
      "process_support",
      "feedback",
      "assessment_evidence",
      "reflection",
      "differentiation",
      "formativity",
      "collaboration",
      "real_world_relevance",
      "creativity",
      "basic_skills_integrated",
      "citizenship_integrated",
      "teacher_workload_reduction",
      "accessibility",
      "social_safety"
    ],
    gameGenre: [
      "mission_game",
      "simulation",
      "adventure",
      "sandbox",
      "puzzle",
      "role_play",
      "strategy",
      "construction",
      "escape_room",
      "quest",
      "collecting",
      "cooperative",
      "competitive",
      "creative_tool"
    ],
    gameMechanic: [
      "choice",
      "resource_management",
      "collection",
      "construction",
      "matching",
      "sequencing",
      "trading",
      "negotiation",
      "role_assignment",
      "turn_taking",
      "timer",
      "unlocking",
      "leveling",
      "scoring",
      "quest_completion",
      "crafting",
      "experimentation",
      "risk_reward",
      "collaboration",
      "competition"
    ],
    gameDynamic: [
      "exploration",
      "optimization",
      "trial_and_error",
      "strategy_shift",
      "cooperation",
      "competition",
      "emergent_order",
      "escalating_challenge",
      "recovery_loop",
      "social_proof",
      "creative_expression",
      "mastery_loop"
    ],
    gameAesthetic: [
      "sensation",
      "fantasy",
      "narrative",
      "challenge",
      "fellowship",
      "discovery",
      "expression",
      "submission",
      "meaning",
      "competence",
      "autonomy",
      "relatedness"
    ],
    progressionSystem: [
      "none",
      "levels",
      "badges",
      "unlockable_tools",
      "unlockable_areas",
      "skill_tree",
      "portfolio_growth",
      "resource_growth",
      "difficulty_ramp",
      "narrative_chapters"
    ],
    objectType: [
      "container",
      "workspace",
      "tool",
      "material",
      "instruction_card",
      "mission_card",
      "role_token",
      "choice_station",
      "resource",
      "building_block",
      "puzzle_lock",
      "barrier_mechanism",
      "feedback_signal",
      "progress_indicator",
      "success_gate",
      "reward_artifact",
      "reflection_prompt",
      "portfolio_surface",
      "collaboration_surface",
      "sensor",
      "digital_canvas",
      "simulation_state"
    ],
    affordance: [
      "look",
      "pick_up",
      "choose",
      "sort",
      "combine",
      "build",
      "test",
      "measure",
      "compare",
      "transform",
      "role_play",
      "negotiate",
      "explain",
      "present",
      "reflect",
      "retry",
      "unlock",
      "collect",
      "record",
      "share"
    ],
    feedbackType: [
      "visual",
      "auditory",
      "tactile",
      "movement",
      "state_change",
      "score",
      "unlock",
      "hint",
      "peer_response",
      "facilitator_response",
      "artifact_quality",
      "system_log"
    ],
    barrierType: [
      "none",
      "conceptual_puzzle",
      "material_misfit",
      "sequence_error",
      "resource_shortage",
      "time_pressure",
      "role_conflict",
      "social_threshold",
      "technical_lock",
      "quality_check",
      "ambiguity",
      "choice_overload"
    ],
    sensorModality: [
      "none",
      "rfid_nfc",
      "button",
      "switch",
      "magnetic_contact",
      "load_cell",
      "camera",
      "microphone",
      "accelerometer",
      "touchscreen",
      "software_log",
      "manual_observation",
      "qr_scan"
    ]
  };

  const template = {
    schema_version: "leerbox_capture_v5",
    capture_mode: "unknown",
    raw_user_description: "",
    fallback_latex_description: {
      format: "latex",
      source_style: "user_fallback",
      body: "unknown"
    },
    computertaal_statements: {
      rationale: jargonRationale,
      full_architecture: [],
      captured_learning_box: []
    },
    completeness: {
      required_fields_complete: false,
      unknown_fields: [],
      open_questions: []
    },
    metadata: {
      work_name: "unknown",
      leerbox_id: "unknown",
      type: "unknown",
      status: "unknown",
      domain: "unknown",
      summary: "unknown"
    },
    pedagogical_core: {
      central_learning_goal: "unknown",
      central_discovery: "unknown",
      success_definition: "unknown",
      why_it_matters_for_participant: "unknown"
    },
    participants: {
      primary_target_group: "unknown",
      secondary_target_groups: [],
      prior_knowledge: "unknown",
      known_barriers_or_support_needs: "unknown",
      social_setting: "unknown"
    },
    leerbox_design: {
      attraction_type: [],
      learning_modes: [],
      leerbox_principles: [],
      material_mix: [],
      box_climates: [],
      good_practice_tags: [],
      path_role_requirements: {
        entry_object_id: "unknown",
        resistance_object_ids: [],
        success_object_ids: [],
        exit_object_id: "unknown",
        exit_must_be_distinct_from_success: true,
        exit_must_be_distinct_from_resistance: true
      },
      source_basis: [
        "leerbox.nl",
        "articles/Leerpret gevat.tex",
        "wikibooks/collections/leerpret-bronnen",
        "wikibooks/books"
      ]
    },
    game_design: {
      game_required: true,
      game_genres: [],
      player_goal: "unknown",
      win_state: "unknown",
      fail_state: "unknown",
      rules_summary: "unknown",
      mechanics: [],
      dynamics: [],
      aesthetics: [],
      players_and_roles: [],
      resources: [],
      levels_or_progression: [],
      core_loops: [],
      challenge_curve: "unknown",
      onboarding: "unknown",
      balancing_notes: "unknown",
      narrative_frame: "unknown",
      game_feedback: [],
      telemetry_for_gameplay: []
    },
    entry_and_orientation: {
      first_visible_action: "unknown",
      minimal_start_instruction: "unknown",
      self_starting_signal: "unknown",
      self_explaining_cues: [],
      proactive_invitation: "unknown"
    },
    play_characteristics: {
      recognizable_play_form: "unknown",
      play_theme_or_story: "unknown",
      core_mechanics: [],
      rules_or_constraints: [],
      freedom_degrees: "unknown",
      known_game_or_familiar_hook: "unknown",
      roles_or_multiplayer_structure: "unknown",
      direct_feedback_loop: "unknown"
    },
    freedom_and_sequence: {
      route_model: "unknown",
      freedom_principle: "unknown",
      preferred_sequence: [],
      hard_dependencies: [],
      soft_dependencies: [],
      free_choice_zones: [],
      forced_path_risk: "unknown",
      variation_opportunities: [],
      repetition_logic: {
        expected_repetition: "unknown",
        repetition_as_goal_or_effect: "unknown",
        evidence: "unknown"
      }
    },
    objects: [],
    interaction_route: [],
    barriers_and_recovery: {
      main_barrier: "unknown",
      why_productive: "unknown",
      recovery_options: [],
      too_hard_when: "unknown"
    },
    didactic_functions: statusEvidenceMap([
      "goal_clarity",
      "motivation",
      "prior_knowledge_connection",
      "orientation",
      "practice_opportunity",
      "process_support",
      "feedback",
      "assessment_or_success_evidence",
      "evaluation_or_reflection"
    ]),
    playful_learning_requirements: statusEvidenceMap([
      "recognizable_play_frame",
      "familiar_or_fast_entry",
      "rules_explicit_or_discoverable",
      "freedom_to_choose_or_shape_play",
      "creativity_and_self_thinking",
      "direct_feedback_loop",
      "safe_try_retry_space",
      "role_or_multiplayer_interaction",
      "proactive_initiative_invited"
    ]),
    learning_style_and_adaptivity: statusEvidenceMap([
      "playful_entry",
      "reproductive_route",
      "application_route",
      "meaning_route",
      "productive_route",
      "adaptivity_in_tempo_or_route",
      "individual_and_social_options"
    ]),
    measurement: {
      marker_mapping: {
        T: "unknown",
        A: "unknown",
        V: "unknown",
        R: "unknown",
        S: "unknown"
      },
      event_contract: {
        required_fields: [
          "personID",
          "sessionID",
          "learningBoxID",
          "leerbox_id",
          "learningObjectID",
          "timestamp",
          "actionType",
          "objectRole",
          "result",
          "stage",
          "strategy"
        ],
        example_action_types: [],
        minimal_contact_message: {
          personID: "required",
          learningBoxID: "required",
          learningObjectID: "required",
          timestamp: "required"
        },
        sequence_fields: [
          "previousObjectID",
          "nextObjectID",
          "attemptNumber",
          "durationSincePrevious",
          "dependencySatisfied",
          "timeGapBoundary",
          "learningBoxSwitchBoundary"
        ],
        result_values: []
      },
      engine_derivations_needed: {
        time: "unknown",
        activity_density: "unknown",
        variation: "unknown",
        resilience: "unknown",
        success: "unknown",
        sequence_patterns: "unknown"
      },
      privacy_notes: "unknown"
    },
    simulation_definition: {
      rich_context_allowed: true,
      not_visible_to_engine: [],
      physical_layout: "unknown",
      materials_and_states: [],
      object_affordances: [],
      participant_situations: [],
      social_dynamics: "unknown",
      facilitator_roles: [],
      environmental_cues: [],
      realism_notes_for_contact_generation: "unknown"
    },
    archetype_expectations: [],
    source_integrity: {
      explicitly_stated_by_user: [],
      normalized_by_model: [],
      left_unknown: []
    }
  };

  const requiredChecks = [
    ["metadata.work_name", "required.name"],
    ["metadata.type", "required.type"],
    ["metadata.status", "required.status"],
    ["pedagogical_core.central_learning_goal", "required.learningGoal"],
    ["pedagogical_core.success_definition", "required.successDefinition"],
    ["participants.primary_target_group", "required.targetGroup"],
    ["entry_and_orientation.first_visible_action", "required.firstAction"],
    ["entry_and_orientation.self_starting_signal", "required.selfStarting"],
    ["entry_and_orientation.proactive_invitation", "required.initiative"],
    ["play_characteristics.recognizable_play_form", "required.playForm"],
    ["play_characteristics.freedom_degrees", "required.freedomDegrees"],
    ["freedom_and_sequence.route_model", "required.routeModel"],
    ["barriers_and_recovery.main_barrier", "required.barrier"]
  ];

  const blockSchemas = {
    object: [
      ["object_id", "dialog.objectId", "text"],
      ["label", "dialog.label", "text"],
      ["object_type", "dialog.objectType", "select", optionSets.objectType],
      ["material_category", "dialog.materialCategory", "select", optionSets.materialCategory],
      ["role", "dialog.role", "select", [
        "entry",
        "start",
        "orientation",
        "mission",
        "rule",
        "story",
        "exploration",
        "practice",
        "variation",
        "resistance",
        "barrier",
        "recovery",
        "feedback",
        "progress",
        "reward",
        "success",
        "exit",
        "social",
        "role_token",
        "unknown"
      ]],
      ["affordance", "dialog.affordance", "select", optionSets.affordance],
      ["feedback_type", "dialog.feedbackType", "select", optionSets.feedbackType],
      ["barrier_type", "dialog.barrierType", "select", optionSets.barrierType],
      ["sensor_modality", "dialog.sensorModality", "select", optionSets.sensorModality],
      ["visible_cues", "dialog.visibleCues", "textarea"],
      ["loggable_actions", "dialog.loggableActions", "list"],
      ["access_conditions", "dialog.accessConditions", "list"],
      ["likely_marker_roles", "dialog.likelyMarkerRoles", "list"],
      ["learning_mode_tags", "dialog.learningModeTags", "listselect", optionSets.learningMode],
      ["good_practice_tags", "dialog.goodPracticeTags", "listselect", optionSets.goodPractice]
    ],
    step: [
      ["participant_action", "dialog.participantAction", "textarea"],
      ["object_id", "dialog.objectId", "objectref"],
      ["action_type", "dialog.actionType", "text"],
      ["game_mechanic", "dialog.gameMechanic", "select", optionSets.gameMechanic],
      ["game_dynamic", "dialog.gameDynamic", "select", optionSets.gameDynamic],
      ["expected_feedback", "dialog.expectedFeedback", "textarea"],
      ["if_success_next", "dialog.ifSuccess", "textarea"],
      ["if_stuck_next", "dialog.ifStuck", "textarea"]
    ],
    dependency: [
      ["from_object_id", "dialog.fromObject", "objectref"],
      ["to_object_id", "dialog.toObject", "objectref"],
      ["dependency_type", "dialog.type", "select", [
        "must_complete",
        "must_visit",
        "must_choose",
        "safety_lock",
        "role_lock",
        "unknown"
      ]],
      ["reason", "dialog.reason", "textarea"]
    ]
  };

  const state = {
    capture: loadCapture(),
    simulation_parameters: loadSimulationParameters(),
    imported_test_data: clone(emptyImportedTestData),
    existing_dataset_catalog: [],
    language: loadLanguage(),
    activeBlock: null,
    agent_messages: [],
    agent_online: false,
    agent_max_output_tokens: 900,
    agent_fill_max_output_tokens: 8000,
    agent_fill_system_prompt_characters: 2500,
    agent_field_system_prompt_characters: 1400,
    agent_last_json: null,
    advisor_report: null,
    bucket_sources: [],
    bucket_selected_source_ids: [],
    bucket_selection_initialized: false,
    bucket_drawer_mode: "manage"
  };
  let networkCanvasCenteredSignature = "";
  let networkCanvasSceneLayout = null;
  let networkLearningBoxProfile = null;
  let canvasZoom = 1;
  let legoFlowMap = null;
  let legoSpatial = null;
  let legoFlowMapError = "";
  let cableController = null;
  let cableModeRequested = false;
  let connectionMode = "route";
  /* Verbinden op de kaart: het gekozen beginpunt. Deze toestand hoort bovenaan te
     staan, want renderNetworkCanvas leest hem en kan al tijdens het opstarten draaien
     - een const verderop in het bestand bestaat op dat moment nog niet. */
  const linking = { sourceId: null };

  /* Venstertitels per paneel: icoon + naam, uniform voor alle zwevende vensters.
     Let op: declaraties hier bovenin, want de init draait vóór de rest van het bestand. */
  const panelMeta = {
    overview: ["ℹ️", "Infobox"],
    design: ["🧭", "Ontwerp"],
    game: ["🎮", "Game"],
    entry: ["⚑", "Start"],
    sequence: ["➜", "Route"],
    measurement: ["◉", "Meten"],
    mission: ["🎯", "Missie"],
    vision: ["🔭", "Visie"],
    strategy: ["🧭", "Strategie"],
    goals: ["🏁", "Doelen"],
    resistance: ["🧗", "Weerstand"],
    success: ["🏆", "Succes"]
  };
  const strategicPanels = ["mission", "vision", "strategy", "goals", "resistance", "success"];
  let designPanelHome = null;

  /* Elk onderwijsarchitectuur-element leeft in precies één venster. Deze velden verhuizen
     bij het opstarten definitief uit de Infobox naar hun eigen venster (geen herhaling). */
  const panelFieldSelectors = {
    mission: 'textarea[name="participants.primary_target_group"]',
    goals: 'textarea[name="pedagogical_core.central_learning_goal"]',
    success: 'textarea[name="pedagogical_core.success_definition"]',
    resistance: 'textarea[name="barriers_and_recovery.main_barrier"]'
  };

  function relocateCaptureFields() {
    const slot = document.getElementById("extraFieldSlot");
    if (!slot) return;
    Object.entries(panelFieldSelectors).forEach(([panelName, selector]) => {
      const label = document.querySelector(selector)?.closest("label");
      if (!label || label.parentElement === slot) return;
      label.dataset.fieldPanel = panelName;
      slot.appendChild(label);
    });
  }

  function moveFieldToWorkflow(panelName) {
    const slot = document.getElementById("extraFieldSlot");
    if (!slot) return;
    let zichtbaar = false;
    slot.querySelectorAll("[data-field-panel]").forEach((label) => {
      const actief = label.dataset.fieldPanel === panelName;
      label.hidden = !actief;
      if (actief) zichtbaar = true;
    });
    slot.hidden = !zichtbaar;
  }

  /* Strategisch kader: per item de wens van de leerattractie (onderwijsarchitectuur)
     én de vertaling naar handelingen van de lerende (leerarchitectuur ontwerpt leerprocessen).
     Geen enkel veld is verplicht. */
  const strategicFrameFields = [
    ["strategicMission", "mission"],
    ["strategicMissionActions", "mission_learner_actions"],
    ["strategicVision", "vision"],
    ["strategicVisionActions", "vision_learner_actions"],
    ["strategicStrategy", "strategy"],
    ["strategicStrategyActions", "strategy_learner_actions"],
    ["strategicGoals", "goals"],
    ["strategicGoalsActions", "goals_learner_actions"],
    ["strategicPhase", "education_phase"]
  ];

  const elements = {
    form: document.getElementById("captureForm"),
    architectureRouteFields: document.getElementById("architectureRouteFields"),
    objectBlocks: document.getElementById("objectBlocks"),
    stepBlocks: document.getElementById("stepBlocks"),
    dependencyBlocks: document.getElementById("dependencyBlocks"),
    objectCount: document.getElementById("objectCount"),
    stepCount: document.getElementById("stepCount"),
    dependencyCount: document.getElementById("dependencyCount"),
    languageSelect: document.getElementById("languageSelect"),
    jsonOutput: document.getElementById("jsonOutput"),
    workspaceTitle: document.getElementById("workspaceTitle"),
    auditScore: document.getElementById("auditScore"),
    auditList: document.getElementById("auditList"),
    blockDialog: document.getElementById("blockDialog"),
    blockForm: document.getElementById("blockForm"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogFields: document.getElementById("dialogFields"),
    deleteBlockButton: document.getElementById("deleteBlockButton"),
    promptDialog: document.getElementById("promptDialog"),
    promptOutput: document.getElementById("promptOutput"),
    importFileInput: document.getElementById("importFileInput"),
    rawDescriptionInput: document.getElementById("rawDescriptionInput"),
    rawDescriptionText: document.getElementById("rawDescriptionText"),
    simulateButton: document.getElementById("simulateButton"),
    validationPanel: document.getElementById("validationPanel"),
    validationStatus: document.getElementById("validationStatus"),
    validationSummary: document.getElementById("validationSummary"),
    validationList: document.getElementById("validationList"),
    simulationOutput: document.getElementById("simulationOutput"),
    latexPreview: document.getElementById("latexPreview"),
    fullStatementsOutput: document.getElementById("fullStatementsOutput"),
    vatStatementsOutput: document.getElementById("vatStatementsOutput"),
    architectureDiagram: document.getElementById("architectureDiagram"),
    simulationParametersDialog: document.getElementById("simulationParametersDialog"),
    simulationParametersForm: document.getElementById("simulationParametersForm"),
    simulationSigma: document.getElementById("simulationSigma"),
    simulationRunCount: document.getElementById("simulationRunCount"),
    simulationPromptDialog: document.getElementById("simulationPromptDialog"),
    simulationPromptOutput: document.getElementById("simulationPromptOutput"),
    testDataInput: document.getElementById("testDataInput"),
    testDataFileInput: document.getElementById("testDataFileInput"),
    testDataStatus: document.getElementById("testDataStatus"),
    runTestButton: document.getElementById("runTestButton"),
    existingDataSelect: document.getElementById("existingDataSelect"),
    useExistingDataButton: document.getElementById("useExistingDataButton"),
    agentPanel: document.getElementById("agentPanel"),
    agentStatus: document.getElementById("agentStatus"),
    agentStatusLabel: document.getElementById("agentStatusLabel"),
    agentIntro: document.getElementById("agentIntro"),
    agentMode: document.getElementById("agentMode"),
    agentTemplateFields: document.getElementById("agentTemplateFields"),
    agentConversation: document.getElementById("agentConversation"),
    agentForm: document.getElementById("agentForm"),
    agentInput: document.getElementById("agentInput"),
    agentSendButton: document.getElementById("agentSendButton"),
    agentLimitText: document.getElementById("agentLimitText"),
    agentResultActions: document.getElementById("agentResultActions"),
    agentApplyCaptureButton: document.getElementById("agentApplyCaptureButton"),
    agentApplyTestDataButton: document.getElementById("agentApplyTestDataButton"),
    agentTraceToggle: document.getElementById("agentTraceToggle"),
    agentTracePanel: document.getElementById("agentTracePanel"),
    agentTraceClose: document.getElementById("agentTraceClose"),
    agentTraceOutput: document.getElementById("agentTraceOutput"),
    agentTokenDialog: document.getElementById("agentTokenDialog"),
    agentTokenInputEstimate: document.getElementById("agentTokenInputEstimate"),
    agentTokenOutputEstimate: document.getElementById("agentTokenOutputEstimate"),
    agentTokenTotalEstimate: document.getElementById("agentTokenTotalEstimate"),
    agentTokenCostEstimate: document.getElementById("agentTokenCostEstimate"),
    agentCallResultDialog: document.getElementById("agentCallResultDialog"),
    agentCallResultKicker: document.getElementById("agentCallResultKicker"),
    agentCallResultTitle: document.getElementById("agentCallResultTitle"),
    agentCallResultMessage: document.getElementById("agentCallResultMessage"),
    agentCallInputActual: document.getElementById("agentCallInputActual"),
    agentCallOutputActual: document.getElementById("agentCallOutputActual"),
    agentCallTotalActual: document.getElementById("agentCallTotalActual"),
    agentCallCostActual: document.getElementById("agentCallCostActual"),
    agentBucketConsentPanel: document.getElementById("agentBucketConsentPanel"),
    agentBucketConsent: document.getElementById("agentBucketConsent"),
    agentBucketSources: document.getElementById("agentBucketSources"),
    agentSelectedSources: document.getElementById("agentSelectedSources"),
    agentBucketConsentSummary: document.getElementById("agentBucketConsentSummary"),
    agentBucketConsentIntro: document.getElementById("agentBucketConsentIntro"),
    agentDocumentCloseButton: document.getElementById("agentDocumentCloseButton"),
    sourceImporter: document.getElementById("sourceImporter"),
    sourceDocumentInput: document.getElementById("sourceDocumentInput"),
    sourceZipInput: document.getElementById("sourceZipInput"),
    repositoryImportForm: document.getElementById("repositoryImportForm"),
    repositoryUrl: document.getElementById("repositoryUrl"),
    websiteImportForm: document.getElementById("websiteImportForm"),
    websiteUrl: document.getElementById("websiteUrl"),
    bucketStatus: document.getElementById("bucketStatus"),
    bucketSourceList: document.getElementById("bucketSourceList"),
    bucketAgentBar: document.getElementById("bucketAgentBar"),
    fillFromSourcesButton: document.getElementById("fillFromSourcesButton"),
    fillFromSourcesStatus: document.getElementById("fillFromSourcesStatus"),
    sourceFillDialog: document.getElementById("sourceFillDialog"),
    sourceFillList: document.getElementById("sourceFillList"),
    sourceFillSummary: document.getElementById("sourceFillSummary"),
    sourceFillIntro: document.getElementById("sourceFillIntro"),
    sourceFillCancelButton: document.getElementById("sourceFillCancelButton"),
    sourceFillContinueButton: document.getElementById("sourceFillContinueButton"),
    sourceFillApplyButton: document.getElementById("sourceFillApplyButton"),
    workbenchMenu: document.getElementById("workbenchMenu"),
    workflowPanel: document.querySelector('[data-workbench-panel="description"]'),
    editorGrid: document.getElementById("editorGrid")
  };

  elements.networkCanvas = document.getElementById("networkCanvas");
  elements.networkEdges = document.getElementById("networkEdges");
  elements.networkNodes = document.getElementById("networkNodes");
  elements.canvasEmptyState = document.getElementById("canvasEmptyState");

  bindEvents();
  initializePersistenceControls();
  initializeWorkbench();
  initializeGameDocks();
  initializeFloatingDocumentDrawer();
  updateProjectDocumentAccessUI();
  populateOptionControls();
  applyLanguage();
  hydrateForm();
  const legoFlowMapReady = initializeLegoFlowMap();
  const selectedCaptureReady = initializeSelectedCapture();
  render();
  initializeAgent();
  Promise.all([legoFlowMapReady, selectedCaptureReady]).then(() => {
    render();
    publishCaptureUpdate();
  });

  function initializeLegoFlowMap() {
    if (!window.LeerpretSDKLoaderReady) {
      legoFlowMapError = "De LeerpretSDK-loader is niet beschikbaar.";
      return Promise.resolve(null);
    }
    return window.LeerpretSDKLoaderReady
      .then((loader) => loader.load(["lego-flow-map", "lego-spatial"]))
      .then(([component, spatial]) => {
        if (!component?.renderScene
          || !component?.updateDragFrame
          || !component?.layoutScreenSceneV1
          || !component?.clampScreenPositionV1
          || !component?.studConnectionPoint
          || !component?.visibleLayerCenterV1
          || !component?.centerDeltaV1
          || !component?.centeredScrollOffsetV1
          || !component?.clientPointToLayerV1
          || !component?.panScrollOffsetV1
          || !component?.dragScreenPositionV1
          || !component?.zoomInputDirectionV1
          || !component?.zoomViewportV1
          || !component?.scaleScreenSceneV1
          || !spatial?.radarSeriesPoints) {
          throw new Error("lego-flow-map mist de screen-v1 compatibiliteits-API");
        }
        legoFlowMap = component;
        legoSpatial = spatial;
        document.querySelectorAll("[data-object-preset]").forEach((button) => {
          const preview = button.querySelector(".lego-flow-tool-preview");
          if (preview) preview.innerHTML = legoFlowMap.toolboxPreviewMarkup(button.dataset.objectPreset);
        });
        render();
        return component;
      })
      .catch((error) => {
        legoFlowMapError = error?.message || "De LEGO-SDK kon niet laden.";
        renderNetworkCanvas(state.capture);
        return null;
      });
  }

  function statusEvidenceMap(keys) {
    return Object.fromEntries(keys.map((key) => [key, { status: "unknown", evidence: "unknown" }]));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadCapture() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return clone(template);
    }

    try {
      return normalizeCapture(JSON.parse(saved));
    } catch (error) {
      return clone(template);
    }
  }

  async function initializeSelectedCapture() {
    if (!selectedLeerboxId || localStorage.getItem(storageKey)) {
      return;
    }
    try {
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox/captures/${encodeURIComponent(selectedLeerboxId)}`, {
        credentials: "include"
      });
      if (!response.ok) {
        return;
      }
      state.capture = normalizeCapture(await response.json());
      localStorage.setItem(storageKey, JSON.stringify(state.capture));
      hydrateForm();
    } catch (error) {
      console.warn("Geselecteerde leerbox kon niet in de Editor worden geladen.", error);
    }
  }

  function loadSimulationParameters() {
    const saved = localStorage.getItem(simulationParametersStorageKey);
    if (!saved) {
      return clone(defaultSimulationParameters);
    }
    try {
      const stored = JSON.parse(saved);
      return { ...defaultSimulationParameters, ...stored, archetype_mix: { ...defaultSimulationParameters.archetype_mix, ...(stored.archetype_mix || {}) } };
    } catch (error) {
      return clone(defaultSimulationParameters);
    }
  }

  function normalizeCapture(capture) {
    const incoming = clone(capture || {});
    const attractionType = incoming.leerbox_design?.attraction_type;
    if (isPlainObject(incoming.leerbox_design) && !Array.isArray(attractionType)) {
      incoming.leerbox_design.attraction_type =
        attractionType && attractionType !== unknown ? [attractionType] : [];
    }
    return mergeDeep(clone(template), incoming);
  }

  function mergeDeep(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) ? incoming : base;
    }

    if (!isPlainObject(base)) {
      return incoming === undefined ? base : incoming;
    }

    const merged = { ...base };
    if (!isPlainObject(incoming)) {
      return merged;
    }

    for (const key of Object.keys(incoming)) {
      merged[key] = key in base ? mergeDeep(base[key], incoming[key]) : incoming[key];
    }
    return merged;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function loadLanguage() {
    const saved = localStorage.getItem(languageStorageKey);
    const fallback = languageConfig.defaultLanguage || "nl";
    return languageConfig.messages[saved] ? saved : fallback;
  }

  function t(key, replacements = {}) {
    const messages = languageConfig.messages[state.language] || languageConfig.messages.nl || {};
    const fallbackMessages = languageConfig.messages[languageConfig.defaultLanguage] || {};
    const templateText = messages[key] || fallbackMessages[key] || key;
    return Object.entries(replacements).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      templateText
    );
  }

  function applyLanguage() {
    document.documentElement.lang = state.language;
    document.title = t("app.title");
    elements.languageSelect.value = state.language;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-label]").forEach((label) => {
      setLabelText(label, t(label.dataset.i18nLabel));
    });
    populateOptionControls();
  }

  function setLabelText(label, text) {
    const firstTextNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
      firstTextNode.textContent = `${text}\n                `;
      return;
    }
    label.prepend(document.createTextNode(`${text}\n                `));
  }

  function bindEvents() {
    window.addEventListener("leerpret-sdk-library-ready", () => renderNetworkCanvas(state.capture));
    window.addEventListener("message", (event) => {
      // Accepteer besturing van de ouder (dashboard-iframe) én van hetzelfde
      // venster (de ingebouwde gedeelde editor-chrome die self-post gebruikt).
      if (event.source !== window.parent && event.source !== window) return;
      if (event.data?.type === "leerpret-editor-view") {
        activateWorkbenchView(event.data.view);
        if (event.data.panel) activatePanel(event.data.panel);
        if (event.data.workspaceView) activateWorkspaceView(event.data.workspaceView);
      }
      // De omliggende app ruimt vensters op voordat het gereedschap iets opent.
      if (event.data?.type === "leerpret-editor-close-overlays") {
        const reportDrawer = document.getElementById("canvasReportDrawer");
        if (reportDrawer && reportDrawer.hidden === false) {
          reportDrawer.hidden = true;
          document.getElementById("canvasReportToggle")?.setAttribute("aria-expanded", "false");
        }
        document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
        setDocumentDrawerOpen(false);
      }
      if (event.data?.type === "leerpret-editor-click-control") {
        const selector = String(event.data.selector || "");
        const allowed = new Set(["#languageSelect", "#newCaptureButton", "#promptButton", "#uploadDescriptionButton", "#previewWebappButton", "#exportButton", "#addObjectButton", "#addStepButton", "#addDependencyButton", "#canvasReportToggle"]);
        if (allowed.has(selector)) document.querySelector(selector)?.click();
      }
      if (event.data?.type === "leerpret-editor-add-object-preset") {
        const preset = String(event.data.preset || "");
        if (["entry", "success", "resistance", "normal"].includes(preset)) addPresetObject(preset);
      }
      if (event.data?.type === "leerpret-editor-add-library-item") {
        addLibraryObject(event.data.item);
      }
      if (event.data?.type === "leerpret-editor-start-cable") {
        connectionMode = "route";
        cableModeRequested = true;
        cancelLinking();
        activateWorkspaceView("vat");
        window.requestAnimationFrame(() => cableController?.setMode(connectionMode).activate());
      }
      if (event.data?.type === "leerpret-editor-connection-mode") {
        connectionMode = event.data.mode === "conditional" ? "conditional" : "route";
        cableModeRequested = true;
        cancelLinking();
        activateWorkspaceView("vat");
        window.requestAnimationFrame(() => cableController?.setMode(connectionMode).activate());
      }
      if (event.data?.type === "leerpret-editor-generate-preview") generateWebappPreview();
      if (event.data?.type === "leerpret-editor-simulation-control") handleSimulationControl(event.data);
    });
    document.querySelectorAll(".workbench-menu-button").forEach((button) => {
      button.addEventListener("click", () => activateWorkbenchView(button.dataset.workbenchView));
    });
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => activatePanel(button.dataset.panel));
    });
    document.querySelectorAll(".workspace-view-button").forEach((button) => {
      button.addEventListener("click", () => activateWorkspaceView(button.dataset.workspaceView));
    });
    document.querySelectorAll("[data-workspace-close]").forEach((button) => {
      button.addEventListener("click", () => activateWorkspaceView("vat"));
    });
    // Inklapknop van het Controle-venster: terug naar de bouwweergave met de kaart.
    document.querySelectorAll("[data-workbench-close]").forEach((button) => {
      button.addEventListener("click", () => activateWorkbenchView(button.dataset.workbenchClose));
    });
    bindNetworkCanvas();

    const handleCaptureFieldInput = (event) => {
      const field = event.target;
      if (!field.name) {
        return;
      }

      const value = field.multiple
        ? selectedValues(field)
        : field.dataset.list === ""
          ? linesToList(field.value)
          : cleanText(field.value);
      setByPath(state.capture, field.name, value);

      if (field.name === "metadata.work_name" && isUnknown(getByPath(state.capture, "metadata.leerbox_id"))) {
        setByPath(state.capture, "metadata.leerbox_id", slugify(field.value));
        hydrateFormField("metadata.leerbox_id");
      }

      persistAndRender(field.name);
    };
    elements.form.addEventListener("input", handleCaptureFieldInput);
    // Velden die naar hun eigen venster zijn verhuisd, blijven zo gewoon opslaan.
    elements.workflowPanel?.addEventListener("input", handleCaptureFieldInput);
    // Route en volgorde staat sinds de menuherindeling in het Structuur-venster.
    elements.architectureRouteFields?.addEventListener("input", handleCaptureFieldInput);
    document.addEventListener("mousedown", (event) => {
      const option = event.target.closest("select[multiple] option");
      if (!option) return;
      event.preventDefault();
      option.selected = !option.selected;
      const select = option.closest("select");
      select.focus();
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    document.addEventListener("input", () => window.requestAnimationFrame(refreshFieldAgentButtons));
    relocateCaptureFields();

    document.getElementById("addObjectButton").addEventListener("click", () => openBlockDialog("object"));
    document.getElementById("addStepButton").addEventListener("click", () => openBlockDialog("step"));
    document.getElementById("addDependencyButton").addEventListener("click", () => openBlockDialog("dependency"));
    document.getElementById("newCaptureButton").addEventListener("click", resetCapture);
    document.getElementById("uploadDescriptionButton").addEventListener("click", () => elements.rawDescriptionInput.click());
    document.getElementById("promptButton").addEventListener("click", openPromptDialog);
    document.getElementById("downloadPromptButton").addEventListener("click", downloadPrompt);
    document.getElementById("downloadLatexButton").addEventListener("click", downloadLatex);
    document.getElementById("downloadLatexDataButton").addEventListener("click", downloadLatex);
    elements.simulateButton.addEventListener("click", openSimulationParametersDialog);
    document.getElementById("exportButton").addEventListener("click", exportJson);
    document.getElementById("previewWebappButton").addEventListener("click", generateWebappPreview);
    document.getElementById("importButton").addEventListener("click", () => elements.importFileInput.click());
    document.getElementById("copyButton").addEventListener("click", copyJson);
    document.getElementById("closeDialogButton").addEventListener("click", closeBlockDialog);
    document.getElementById("cancelDialogButton").addEventListener("click", closeBlockDialog);
    document.getElementById("closePromptButton").addEventListener("click", closePromptDialog);
    document.getElementById("donePromptButton").addEventListener("click", closePromptDialog);
    document.getElementById("copyPromptButton").addEventListener("click", copyPrompt);
    document.getElementById("closeSimulationParametersButton").addEventListener("click", closeSimulationParametersDialog);
    document.getElementById("cancelSimulationParametersButton").addEventListener("click", closeSimulationParametersDialog);
    document.getElementById("closeSimulationPromptButton").addEventListener("click", closeSimulationPromptDialog);
    document.getElementById("doneSimulationPromptButton").addEventListener("click", closeSimulationPromptDialog);
    document.getElementById("copySimulationPromptButton").addEventListener("click", copySimulationPrompt);
    document.getElementById("uploadTestDataButton").addEventListener("click", () => elements.testDataFileInput.click());
    document.getElementById("refreshExistingDataButton").addEventListener("click", refreshExistingDataCatalog);
    elements.useExistingDataButton.addEventListener("click", useSelectedExistingData);
    elements.runTestButton.addEventListener("click", runImportedTestData);
    elements.languageSelect.addEventListener("change", changeLanguage);

    elements.importFileInput.addEventListener("change", importJson);
    elements.rawDescriptionInput.addEventListener("change", importRawDescription);
    elements.testDataFileInput.addEventListener("change", importTestDataFile);
    elements.testDataInput.addEventListener("input", () => parseAndStoreTestData(elements.testDataInput.value));
    elements.existingDataSelect.addEventListener("change", renderExistingDataSelection);
    // Ontdekking (eigen venster): opgeslagen in capture.pedagogical_core.central_discovery.
    document.getElementById("discoveryInput")?.addEventListener("input", (event) => {
      if (!isPlainObject(state.capture.pedagogical_core)) state.capture.pedagogical_core = {};
      state.capture.pedagogical_core.central_discovery = event.target.value;
    });
    // Strategisch kader (Missie-venster): opgeslagen in capture.strategic_frame.
    strategicFrameFields.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("input", (event) => {
        if (!isPlainObject(state.capture.strategic_frame)) state.capture.strategic_frame = {};
        state.capture.strategic_frame[key] = event.target.value;
      });
    });
    elements.rawDescriptionText.addEventListener("input", () => {
      state.capture.raw_user_description = elements.rawDescriptionText.value;
      persistAndRender();
    });
    elements.architectureDiagram.addEventListener("change", handleArchitectureInput);

    elements.simulationParametersForm.addEventListener("submit", makeSimulationPromptFromParameters);
    elements.blockForm.addEventListener("submit", saveBlockFromDialog);
    elements.deleteBlockButton.addEventListener("click", deleteActiveBlock);
    elements.agentForm.addEventListener("submit", sendAgentMessage);
    document.getElementById("agentResetConversationButton")?.addEventListener("click", resetAgentConversation);
    document.getElementById("agentNewConversationButton")?.addEventListener("click", () => {
      setDocumentDrawerOpen(!elements.agentBucketConsentPanel.classList.contains("is-open"), "chat");
    });
    elements.agentDocumentCloseButton?.addEventListener("click", () => setDocumentDrawerOpen(false));
    document.getElementById("agentImportDocumentsButton")?.addEventListener("click", () => elements.sourceDocumentInput.click());
    document.getElementById("agentImportZipButton")?.addEventListener("click", () => elements.sourceZipInput.click());
    document.getElementById("agentImportRepositoryButton")?.addEventListener("click", importRepositoryFromPrompt);
    document.getElementById("agentImportWebsiteButton")?.addEventListener("click", importWebsiteFromPrompt);
    elements.agentMode.addEventListener("change", applyAgentPromptTemplate);
    // Inklapknoppen op zwevende vensters: terug naar de kaart en de buitenpagina laten meeschakelen.
    const requestPanelClose = () => {
      activateWorkbenchView("build");
      if (embeddedWorkbench) window.parent.postMessage({ type: "leerpret-editor-panel-closed" }, parentOrigin);
    };
    document.querySelectorAll("[data-plan-view]").forEach((button) => {
      button.addEventListener("click", () => setPlanView(button.dataset.planView));
    });
    document.getElementById("historyButton")?.addEventListener("click", openHerstelvenster);
    document.getElementById("centerCanvasButton")?.addEventListener("click", centerCanvasOnDrawing);
    document.getElementById("historyCloseButton")?.addEventListener("click", () => {
      const paneel = document.getElementById("historyPanel");
      if (paneel) paneel.hidden = true;
    });
    document.getElementById("workflowPanelCloseButton")?.addEventListener("click", requestPanelClose);
    document.getElementById("agentPanelCloseButton")?.addEventListener("click", requestPanelClose);
    document.getElementById("paletteCloseButton")?.addEventListener("click", requestPanelClose);
    // Statustekst is visueel verborgen; toon hem als tooltip op de statuspunt voor "Agent".
    const agentStatusElement = document.getElementById("agentStatus");
    if (agentStatusElement && elements.agentStatusLabel) {
      new MutationObserver(() => { agentStatusElement.title = elements.agentStatusLabel.textContent || ""; })
        .observe(elements.agentStatusLabel, { childList: true, characterData: true, subtree: true });
    }
    elements.agentApplyCaptureButton.addEventListener("click", applyAgentCapture);
    elements.agentApplyTestDataButton.addEventListener("click", applyAgentTestData);
    elements.agentTraceToggle?.addEventListener("click", () => {
      const open = elements.agentTracePanel.hidden;
      elements.agentTracePanel.hidden = !open;
      elements.agentTraceToggle.setAttribute("aria-expanded", String(open));
    });
    elements.agentTraceClose?.addEventListener("click", () => {
      elements.agentTracePanel.hidden = true;
      elements.agentTraceToggle?.setAttribute("aria-expanded", "false");
    });
    elements.agentBucketConsent.addEventListener("change", updateAgentBucketConsentUI);
    elements.agentBucketSources.addEventListener("change", updateAgentBucketSourceSelection);
    elements.bucketSourceList.addEventListener("change", updateBucketSourceSelection);
    document.getElementById("importDocumentsButton")?.addEventListener("click", () => elements.sourceDocumentInput.click());
    document.getElementById("importZipButton")?.addEventListener("click", () => elements.sourceZipInput.click());
    document.getElementById("importRepositoryButton")?.addEventListener("click", importRepositoryFromPrompt);
    document.getElementById("importWebsiteButton")?.addEventListener("click", importWebsiteFromPrompt);
    elements.sourceDocumentInput.addEventListener("change", importSourceDocuments);
    elements.sourceZipInput.addEventListener("change", importSourceZip);
    elements.repositoryImportForm.addEventListener("submit", importRepository);
    elements.websiteImportForm.addEventListener("submit", importWebsite);
    document.getElementById("refreshBucketButton").addEventListener("click", refreshProjectBucket);
    elements.fillFromSourcesButton?.addEventListener("click", fillFieldsFromSources);
  }

  function initializeWorkbench() {
    document.body.classList.toggle("is-workbench-embedded", embeddedWorkbench);
    const agentAvailable = ["architect", "technologist"].includes(agentRole);
    const agentButton = elements.workbenchMenu.querySelector('[data-workbench-view="agent"]');
    if (!agentAvailable) {
      agentButton.hidden = true;
    }
    const savedView = pageParameters.get("view") || localStorage.getItem(workbenchViewStorageKey) || "build";
    activateWorkbenchView(!agentAvailable && savedView === "agent" ? "description" : savedView);
    activateWorkspaceView(pageParameters.get("workspace") || "vat");
  }

  function initializeGameDocks() {
    if (!embeddedWorkbench) return;
    const toolbox = document.querySelector(".object-toolbox");
    const toggle = document.getElementById("toolboxToggle");
    const expanded = localStorage.getItem("leerpretarchitect-toolbox-expanded") === "true";
    const setExpanded = (value) => {
      toolbox?.classList.toggle("is-expanded", value);
      toggle?.setAttribute("aria-expanded", String(value));
      if (toggle) toggle.textContent = value ? "‹" : "›";
      localStorage.setItem("leerpretarchitect-toolbox-expanded", String(value));
    };
    setExpanded(expanded);
    toggle?.addEventListener("click", () => setExpanded(!toolbox.classList.contains("is-expanded")));

    /* Het blokdialoog is een venster als alle andere en hoort naast het linkermenu,
       niet in het inspectorpaneel. Het blijft daarom een kind van <body>: binnen de
       canvaslaag (die een transform heeft) zou position:fixed niet op het venster
       maar op die laag worden berekend. */
    if (elements.blockDialog) {
      elements.blockDialog.classList.add("workspace-dialog");
      document.body.appendChild(elements.blockDialog);
    }

    const advisorPanel = document.getElementById("advisorPanel");
    const advisorToggle = document.getElementById("advisorToggle");
    const advisorBody = document.getElementById("advisorBody");
    advisorToggle?.addEventListener("click", () => {
      const expanded = advisorToggle.getAttribute("aria-expanded") !== "false";
      advisorToggle.setAttribute("aria-expanded", String(!expanded));
      advisorPanel?.classList.toggle("is-collapsed", expanded);
      if (advisorBody) advisorBody.hidden = expanded;
      const icon = advisorToggle.querySelector("i");
      if (icon) icon.textContent = expanded ? "+" : "_";
      advisorToggle.title = expanded ? "Adviseur openen" : "Adviseur inklappen";
    });
    const advisorAiEnabled = document.getElementById("advisorAiEnabled");
    const openAdvisorAgent = document.getElementById("openAdvisorAgent");
    const syncAdvisorAi = () => {
      const enabled = Boolean(advisorAiEnabled?.checked);
      if (advisorAiEnabled) advisorAiEnabled.closest("label")?.querySelector("small")?.replaceChildren(enabled ? "aan" : "uit");
      if (openAdvisorAgent) {
        openAdvisorAgent.disabled = !enabled;
        openAdvisorAgent.replaceChildren();
        if (enabled) {
          const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          icon.className = "shared-advisor-face-icon";
          icon.setAttribute("viewBox", "0 0 80 94");
          icon.setAttribute("aria-hidden", "true");
          const face = document.createElementNS("http://www.w3.org/2000/svg", "path");
          face.classList.add("advisor-face");
          face.setAttribute("d", "M21 43c0-15 8-24 19-24s19 9 19 24v12c0 13-8 22-19 22s-19-9-19-22V43Z");
          icon.append(face);
          const label = document.createElement("span");
          label.textContent = "Bespreek met adviseur";
          openAdvisorAgent.append(icon, label);
        } else {
          openAdvisorAgent.textContent = "AI-advies staat uit";
        }
      }
      localStorage.setItem(advisorAiStorageKey, String(enabled));
    };
    if (advisorAiEnabled) advisorAiEnabled.checked = localStorage.getItem(advisorAiStorageKey) === "true";
    advisorAiEnabled?.addEventListener("change", syncAdvisorAi);
    syncAdvisorAi();
    openAdvisorAgent?.addEventListener("click", () => {
      if (advisorAiEnabled?.checked) activateWorkbenchView("agent");
    });

    const reportDrawer = document.getElementById("canvasReportDrawer");
    const reportToggle = document.getElementById("canvasReportToggle");
    const setReportOpen = (open) => {
      if (reportDrawer) reportDrawer.hidden = !open;
      reportToggle?.setAttribute("aria-expanded", String(open));
    };
    reportToggle?.addEventListener("click", () => setReportOpen(reportDrawer?.hidden !== false));
    document.getElementById("canvasReportClose")?.addEventListener("click", () => setReportOpen(false));

    document.querySelectorAll("[data-profile-mode]").forEach((button) => button.addEventListener("click", () => {
      state.simulation_parameters.profile_mode = button.dataset.profileMode;
      document.querySelectorAll("[data-profile-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
      persistSimulationProfile();
    }));
    document.querySelectorAll("[data-archetype]").forEach((input) => input.addEventListener("input", () => {
      state.simulation_parameters.archetype_mix[input.dataset.archetype] = Number(input.value);
      input.nextElementSibling.textContent = `${input.value}%`;
      persistSimulationProfile();
    }));
    hydrateSimulationProfile();
  }

  function persistSimulationProfile() {
    localStorage.setItem(simulationParametersStorageKey, JSON.stringify(state.simulation_parameters));
  }

  function hydrateSimulationProfile() {
    document.querySelectorAll("[data-profile-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.profileMode === state.simulation_parameters.profile_mode));
    document.querySelectorAll("[data-archetype]").forEach((input) => {
      input.value = String(state.simulation_parameters.archetype_mix?.[input.dataset.archetype] ?? 20);
      input.nextElementSibling.textContent = `${input.value}%`;
    });
  }

  function activateWorkbenchView(viewName) {
    const validViews = new Set(["description", "agent", "sources", "intake", "build", "validation", "simulation", "json"]);
    const agentAvailable = ["architect", "technologist"].includes(agentRole);
    const selectedView = validViews.has(viewName) && (viewName !== "agent" || agentAvailable)
      ? viewName
      : "description";

    document.querySelectorAll(".workbench-menu-button").forEach((button) => {
      const active = button.dataset.workbenchView === selectedView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    elements.workflowPanel.hidden = selectedView !== "description";
    if (selectedView === "description") {
      setFloatingPanelTitle("workflowPanelIcon", "workflowPanelTitle", panelMeta.mission);
    } else {
      moveDesignPanelToStrategy(false);
      moveFieldToWorkflow(null);
    }
    elements.agentPanel.hidden = selectedView !== "agent";
    elements.sourceImporter.hidden = true;
    const embeddedWorkbench = document.body.classList.contains("is-workbench-embedded");
    const gridView = embeddedWorkbench && ["agent", "sources", "description"].includes(selectedView) ? "build" : selectedView;
    elements.editorGrid.hidden = (!embeddedWorkbench && selectedView === "description") || (!embeddedWorkbench && ["agent", "sources"].includes(selectedView));
    elements.editorGrid.dataset.activeView = gridView;
    localStorage.setItem(workbenchViewStorageKey, selectedView);
    if (["build", "validation"].includes(selectedView)) window.requestAnimationFrame(() => renderNetworkCanvas(state.capture));
    if (selectedView === "sources") {
      setDocumentDrawerOpen(true, "manage");
    } else {
      setDocumentDrawerOpen(false);
    }
    if (selectedView === "agent") refreshProjectBucket();
  }

  function projectBucketId() {
    const value = cleanText(getByPath(state.capture, "metadata.leerbox_id"));
    if (!value || value === unknown || !/^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$/.test(value)) {
      throw new Error("Vul eerst bij Editorvelden een geldig leerbox-id in.");
    }
    return value;
  }

  function handleSimulationControl(control) {
    if (control.mode === "pause") return;
    const simulationValue = Math.max(1, Number(control.action_count || state.simulation_parameters.run_count));
    state.simulation_parameters.sequence_basis = control.simulation_unit === "duration" ? "duration_minutes" : "actions";
    state.simulation_parameters.sequence_value = simulationValue;
    if (control.sigma) state.simulation_parameters.sigma = control.sigma;
    if (state.simulation_parameters.sequence_basis === "actions") state.simulation_parameters.run_count = simulationValue;
    localStorage.setItem(simulationParametersStorageKey, JSON.stringify(state.simulation_parameters));
    activateWorkbenchView("simulation");
    if (control.mode === "play" && state.imported_test_data.is_valid) {
      runImportedTestData();
    } else if (control.mode === "play" && !elements.simulateButton.disabled) {
      elements.simulationPromptOutput.value = buildStaticSimulationPrompt();
      elements.simulationPromptDialog.showModal();
    }
  }

  function setBucketStatus(stateName, message) {
    elements.bucketStatus.dataset.state = stateName;
    elements.bucketStatus.textContent = message;
  }

  function showBucketInlineMessage(message, stateName = "info") {
    const tone = stateName === "error" ? "bucket-inline-error" : stateName === "busy" ? "bucket-inline-busy" : "empty-note";
    const html = `<p class="${tone}">${escapeText(message)}</p>`;
    if (elements.agentBucketSources) elements.agentBucketSources.innerHTML = html;
    if (elements.bucketSourceList) elements.bucketSourceList.innerHTML = html;
  }

  function reportProjectSourceCount() {
    const count = Array.isArray(state.bucket_sources) ? state.bucket_sources.length : 0;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "leerpret-source-count", count }, "*");
    }
  }

  function initializeFloatingDocumentDrawer() {
    if (document.body.classList.contains("is-workbench-embedded") && elements.agentBucketConsentPanel) {
      document.body.appendChild(elements.agentBucketConsentPanel);
    }
    if (document.body.classList.contains("is-workbench-embedded") && elements.agentTracePanel) {
      document.body.appendChild(elements.agentTracePanel);
    }
  }

  function setDocumentDrawerOpen(open, mode = state.bucket_drawer_mode) {
    if (!open) {
      elements.agentBucketConsentPanel.classList.remove("is-open");
      document.getElementById("agentNewConversationButton")?.setAttribute("aria-expanded", "false");
      return;
    }
    if (!canUseProjectDocuments()) {
      setBucketStatus("error", "Documenten zijn om privacyredenen alleen beschikbaar voor Leerpretarchitect en Leerprettechnoloog.");
      return;
    }
    state.bucket_drawer_mode = mode;
    elements.agentBucketConsentPanel.hidden = false;
    elements.agentBucketConsentPanel.dataset.drawerMode = mode;
    elements.agentBucketConsentPanel.classList.toggle("is-open", open);
    document.getElementById("agentNewConversationButton")?.setAttribute("aria-expanded", String(open && mode === "chat"));
    elements.agentBucketConsent.checked = mode === "chat" && state.bucket_selected_source_ids.length > 0;
    updateAgentBucketConsentUI();
    refreshProjectBucket();
  }

  function canUseProjectDocuments() {
    return ["architect", "technologist"].includes(agentRole);
  }

  function projectDownloadUrl(sourceId) {
    const leerboxId = projectBucketId();
    return `${agentApiBase}/project-buckets/${encodeURIComponent(leerboxId)}/sources/${encodeURIComponent(sourceId)}/download?role=${encodeURIComponent(agentRole)}`;
  }

  function updateProjectDocumentAccessUI() {
    const allowed = canUseProjectDocuments();
    document.querySelectorAll(".import-method-grid").forEach((element) => {
      element.hidden = !allowed;
    });
    if (!allowed) {
      elements.agentBucketConsentPanel.hidden = true;
      elements.agentSelectedSources.hidden = true;
    }
  }

  async function projectRequest(path, options = {}) {
    const separator = String(path).includes("?") ? "&" : "?";
    const requestPath = `${path}${separator}role=${encodeURIComponent(agentRole)}`;
    const headers = { "X-Leerpret-Role": agentRole, ...(options.headers || {}) };
    const response = await engineAdapter.fetch(`${agentApiBase}${requestPath}`, { credentials: "include", ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || `${response.status} ${response.statusText}`);
    return result;
  }

  async function syncProjectConfig(leerboxId) {
    syncDerivedCapture(state.capture);
    await projectRequest(`/project-buckets/${encodeURIComponent(leerboxId)}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: state.capture })
    });
  }

  async function refreshProjectBucket() {
    if (!canUseProjectDocuments()) {
      state.bucket_sources = [];
      state.bucket_selected_source_ids = [];
      renderBucketSources();
      reportProjectSourceCount();
      setBucketStatus("error", "Documenten zijn afgeschermd voor deze rol.");
      return;
    }
    try {
      const leerboxId = projectBucketId();
      setBucketStatus("busy", "Bucket laden…");
      const bucket = await projectRequest(`/project-buckets/${encodeURIComponent(leerboxId)}`);
      state.bucket_sources = bucket.sources || [];
      if (!state.bucket_selection_initialized) {
        state.bucket_selected_source_ids = state.bucket_sources.map((source) => source.id);
        state.bucket_selection_initialized = true;
      } else {
        const availableIds = new Set(state.bucket_sources.map((source) => source.id));
        state.bucket_selected_source_ids = state.bucket_selected_source_ids.filter((id) => availableIds.has(id));
      }
      renderBucketSources();
      renderLatexPreview(state.capture);
      reportProjectSourceCount();
      setBucketStatus("success", `${state.bucket_sources.length} bron${state.bucket_sources.length === 1 ? "" : "nen"}`);
    } catch (error) {
      state.bucket_sources = [];
      renderBucketSources();
      reportProjectSourceCount();
      setBucketStatus("error", error.message);
    }
  }

  function updateBucketAgentBar() {
    if (!elements.bucketAgentBar) return;
    const usable = canUseProjectDocuments() && Array.isArray(state.bucket_sources) && state.bucket_sources.length > 0;
    elements.bucketAgentBar.hidden = !usable;
    const button = elements.fillFromSourcesButton;
    if (!usable || !button) return;
    const offline = !state.agent_online;
    button.disabled = offline || sourceFillBusy;
    button.title = offline
      ? "De Agent is offline. Zodra de verbinding er is, kun je hier lege velden uit de bronnen laten invullen."
      : "Laat de Agent lege editorvelden invullen op basis van de geselecteerde bronnen (of alle bronnen als je niets aanvinkt). De Agent verzint niets en toont eerst de kosten.";
    if (sourceFillBusy) return;
    const status = elements.fillFromSourcesStatus?.textContent || "";
    if (offline && !status) {
      setFillStatus("Agent offline");
    } else if (!offline && status === "Agent offline") {
      setFillStatus("");
    }
  }

  function renderBucketSources() {
    updateBucketAgentBar();
    if (!canUseProjectDocuments()) {
      elements.bucketSourceList.innerHTML = '<p class="empty-note">Documenten zijn om privacyredenen alleen beschikbaar voor Leerpretarchitect en Leerprettechnoloog.</p>';
      renderAgentBucketSources();
      return;
    }
    if (!state.bucket_sources.length) {
      elements.bucketSourceList.innerHTML = '<p class="empty-note">Nog geen documenten in deze leerboxmap.</p>';
      renderAgentBucketSources();
      return;
    }
    const labels = { document: "Document", repository: "Git repo", website: "Website", zip: "ZIP" };
    const icons = { document: "?", repository: "?", website: "?", zip: "?" };
    const selected = new Set(state.bucket_selected_source_ids);
    elements.bucketSourceList.innerHTML = state.bucket_sources.slice().reverse().map((source) => `
      <article class="bucket-source-item bucket-source-explorer-item">
        <label class="bucket-source-select">
          <input type="checkbox" data-bucket-source-id="${escapeText(source.id)}" ${selected.has(source.id) ? "checked" : ""}>
          <span class="bucket-source-icon" aria-hidden="true">${escapeText(icons[source.type] || "?")}</span>
          <span class="bucket-source-main">
            <strong title="${escapeText(source.path || source.url || "")}">${escapeText(source.name || source.url || "Bron")}</strong>
            <small>${escapeText(labels[source.type] || source.type)} ? ${escapeText(source.imported_at ? new Date(source.imported_at).toLocaleString("nl-NL") : "zonder datum")}</small>
          </span>
        </label>
      </article>`).join("");
    renderAgentBucketSources();
  }

  function renderAgentBucketSources() {
    if (!state.bucket_sources.length) {
      elements.agentBucketSources.innerHTML = '<p class="empty-note">Deze leerbox bevat nog geen ge?mporteerde bronnen.</p>';
      elements.agentBucketConsent.checked = false;
      elements.agentBucketConsent.disabled = true;
      updateAgentBucketConsentUI();
      return;
    }
    elements.agentBucketConsent.disabled = false;
    const selected = new Set(state.bucket_selected_source_ids);
    const labels = { document: "Document", repository: "Git repo", website: "Website", zip: "ZIP" };
    const icons = { document: "?", repository: "?", website: "?", zip: "?" };
    elements.agentBucketSources.innerHTML = state.bucket_sources.map((source) => `
      <article class="agent-bucket-source-choice bucket-source-explorer-item">
        <input type="checkbox" data-bucket-source-id="${escapeText(source.id)}" ${selected.has(source.id) ? "checked" : ""}>
        <span class="bucket-source-icon" aria-hidden="true">${escapeText(icons[source.type] || "?")}</span>
        <span class="bucket-source-main">
          ${source.path ? `<a class="bucket-source-download-link" href="${escapeText(projectDownloadUrl(source.id))}" download title="Download ${escapeText(source.name || "bron")}">${escapeText(source.name || source.url || "Bron")}</a>` : `<strong title="${escapeText(source.url || "")}">${escapeText(source.name || source.url || "Bron")}</strong>`}
          <small>${escapeText(labels[source.type] || source.type)} ? ${escapeText(source.imported_at ? new Date(source.imported_at).toLocaleString("nl-NL") : "zonder datum")}</small>
        </span>
      </article>`).join("");
    updateAgentBucketConsentUI();
  }

  function updateAgentBucketSourceSelection(event) {
    if (!event.target.matches("[data-bucket-source-id]")) return;
    state.bucket_selected_source_ids = Array.from(elements.agentBucketSources.querySelectorAll("[data-bucket-source-id]:checked"))
      .map((input) => input.dataset.bucketSourceId);
    elements.agentBucketConsent.checked = state.bucket_drawer_mode === "chat" && state.bucket_selected_source_ids.length > 0;
    renderBucketSources();
    updateAgentBucketConsentUI();
  }

  function updateBucketSourceSelection(event) {
    if (!event.target.matches("[data-bucket-source-id]")) return;
    state.bucket_selected_source_ids = Array.from(elements.bucketSourceList.querySelectorAll("[data-bucket-source-id]:checked"))
      .map((input) => input.dataset.bucketSourceId);
    elements.agentBucketConsent.checked = state.bucket_drawer_mode === "chat" && state.bucket_selected_source_ids.length > 0;
    renderAgentBucketSources();
    updateAgentBucketConsentUI();
  }

  function updateAgentBucketConsentUI() {
    const count = state.bucket_selected_source_ids.length;
    const chatMode = state.bucket_drawer_mode === "chat";
    const enabled = chatMode && elements.agentBucketConsent.checked && count > 0;
    elements.agentBucketConsentPanel.dataset.enabled = String(enabled);
    const heading = document.getElementById("agentBucketConsentHeading");
    if (heading) heading.textContent = chatMode ? "Documenten meesturen" : "Bronnen";
    if (elements.agentBucketConsentIntro) {
      // Downloadsectie: pijl omlaag; de importsectie eronder heeft een pijl omhoog.
      elements.agentBucketConsentIntro.innerHTML = chatMode
        ? '<span aria-hidden="true">⬆</span>Selecteer bronnen om met je volgende bericht mee te sturen.'
        : '<span aria-hidden="true">⬇</span>Selecteer bronnen om los te downloaden, of samen als ZIP.';
    }
    const selectedSources = state.bucket_sources.filter((source) => state.bucket_selected_source_ids.includes(source.id));
    if (elements.agentSelectedSources) {
      elements.agentSelectedSources.hidden = selectedSources.length === 0;
      elements.agentSelectedSources.innerHTML = selectedSources.map((source) =>
        `<span title="${escapeText(source.path || source.url || source.name || "Bron")}">? ${escapeText(source.name || source.url || "Bron")}</span>`
      ).join("");
    }
    elements.agentBucketConsentSummary.textContent = selectedSources.length
      ? chatMode
        ? `${selectedSources.length} bron${selectedSources.length === 1 ? "" : "nen"} geselecteerd voor de volgende AI-call.`
        : `${selectedSources.length} bron${selectedSources.length === 1 ? "" : "nen"} aangevinkt. Klik op een bronnaam om te downloaden.`
      : chatMode
        ? "Kies of upload bronnen om ze met de volgende AI-call mee te sturen."
        : "Upload nieuwe bronnen of klik op een bestaande bron om te downloaden.";
  }

  async function uploadProjectFile(endpoint, file) {
    const leerboxId = projectBucketId();
    await syncProjectConfig(leerboxId);
    const data = new FormData();
    data.append("file", file, file.name);
    return projectRequest(`/project-buckets/${encodeURIComponent(leerboxId)}/${endpoint}`, { method: "POST", body: data });
  }

  async function importSourceDocuments() {
    const files = Array.from(elements.sourceDocumentInput.files || []);
    if (!files.length) return;
    try {
      setBucketStatus("busy", `${files.length} document${files.length === 1 ? "" : "en"} uploaden...`);
      showBucketInlineMessage(`${files.length} document${files.length === 1 ? "" : "en"} uploaden...`, "busy");
      const uploadedIds = [];
      for (const file of files) {
        const result = await uploadProjectFile("documents", file);
        if (result?.source?.id) uploadedIds.push(result.source.id);
      }
      elements.sourceDocumentInput.value = "";
      await refreshProjectBucket();
      if (uploadedIds.length) {
        state.bucket_selected_source_ids = Array.from(new Set([...state.bucket_selected_source_ids, ...uploadedIds]));
        elements.agentBucketConsent.checked = state.bucket_drawer_mode === "chat";
        renderBucketSources();
        renderAgentBucketSources();
        updateAgentBucketConsentUI();
      }
    } catch (error) {
      elements.sourceDocumentInput.value = "";
      setBucketStatus("error", error.message);
      showBucketInlineMessage(error.message || "Upload is mislukt.", "error");
    }
  }

  async function importSourceZip() {
    const file = elements.sourceZipInput.files?.[0];
    if (!file) return;
    try {
      setBucketStatus("busy", "ZIP veilig uitpakken...");
      showBucketInlineMessage("ZIP veilig uitpakken...", "busy");
      const result = await uploadProjectFile("zip", file);
      elements.sourceZipInput.value = "";
      await refreshProjectBucket();
      const sourceId = result?.source?.id;
      if (sourceId) {
        state.bucket_selected_source_ids = Array.from(new Set([...state.bucket_selected_source_ids, sourceId]));
        elements.agentBucketConsent.checked = state.bucket_drawer_mode === "chat";
        renderBucketSources();
        renderAgentBucketSources();
        updateAgentBucketConsentUI();
      }
    } catch (error) {
      elements.sourceZipInput.value = "";
      setBucketStatus("error", error.message);
      showBucketInlineMessage(error.message || "ZIP-import is mislukt.", "error");
    }
  }

  async function importUrlSource(type, url) {
    const leerboxId = projectBucketId();
    await syncProjectConfig(leerboxId);
    return projectRequest(`/project-buckets/${encodeURIComponent(leerboxId)}/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
  }

  async function importRepository(event) {
    event.preventDefault();
    try {
      setBucketStatus("busy", "Repository clonen…");
      await importUrlSource("repository", elements.repositoryUrl.value);
      elements.repositoryImportForm.reset();
      await refreshProjectBucket();
    } catch (error) {
      setBucketStatus("error", error.message);
    }
  }

  async function importWebsite(event) {
    event.preventDefault();
    try {
      setBucketStatus("busy", "Website lezen…");
      await importUrlSource("website", elements.websiteUrl.value);
      elements.websiteImportForm.reset();
      await refreshProjectBucket();
    } catch (error) {
      setBucketStatus("error", error.message);
    }
  }

  async function importRepositoryFromPrompt() {
    const url = window.prompt("GitHub repository-URL", elements.repositoryUrl?.value || "https://github.com/");
    if (!url) return;
    try {
      setBucketStatus("busy", "Repository clonen...");
      await importUrlSource("repository", url.trim());
      if (elements.repositoryImportForm) elements.repositoryImportForm.reset();
      await refreshProjectBucket();
    } catch (error) {
      setBucketStatus("error", error.message);
    }
  }

  async function importWebsiteFromPrompt() {
    const url = window.prompt("Website-URL", elements.websiteUrl?.value || "https://");
    if (!url) return;
    try {
      setBucketStatus("busy", "Website lezen...");
      await importUrlSource("website", url.trim());
      if (elements.websiteImportForm) elements.websiteImportForm.reset();
      await refreshProjectBucket();
    } catch (error) {
      setBucketStatus("error", error.message);
    }
  }

  async function initializeAgent() {
    if (!["architect", "technologist"].includes(agentRole)) {
      elements.agentPanel.hidden = true;
      return;
    }
    if (agentRole === "technologist") {
      elements.agentTracePanel.hidden = true;
      elements.agentTraceToggle.hidden = false;
      elements.agentIntro.textContent = "Gebruik dezelfde begeleide editor als de architect. Dit technoloogblok toont daarnaast de geschoonde Azure request en response.";
      document.querySelector(".topbar .kicker").textContent = "Leerprettechnoloog";
    }
    try {
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox-agent/status?probe=true`, {
        cache: "no-store",
        credentials: "include"
      });
      if (response.status === 401) {
        setAgentStatus(false, "Log in om de interne agent te gebruiken");
        return;
      }
      const status = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = response.status === 404
          ? "backend ondersteunt het agent-endpoint niet (404)"
          : status.detail || `${response.status} ${response.statusText}`.trim();
        setAgentStatus(false, `Agent offline: ${reason}`);
        return;
      }
      setAgentStatus(Boolean(status.online), status.online ? "Agent online" : `Agent offline: ${status.reason || "onbekende oorzaak"}`);
      if (status.limits) {
        state.agent_max_output_tokens = status.limits.max_output_tokens || 900;
        state.agent_fill_max_output_tokens = status.limits.fill_max_output_tokens || state.agent_fill_max_output_tokens;
        state.agent_fill_system_prompt_characters =
          status.limits.system_prompt_characters?.fill_from_sources || state.agent_fill_system_prompt_characters;
        state.agent_field_system_prompt_characters =
          status.limits.system_prompt_characters?.fill_field || state.agent_field_system_prompt_characters;
        elements.agentLimitText.textContent = `Maximaal ${status.limits.max_messages || 12} berichten en ${state.agent_max_output_tokens} uitvoertokens per call.`;
      }
    } catch (error) {
      setAgentStatus(false, "Agent offline: backend niet bereikbaar");
    }
  }

  function setAgentStatus(online, label) {
    state.agent_online = online;
    elements.agentStatus.dataset.state = online ? "online" : "offline";
    elements.agentStatusLabel.textContent = label;
    elements.agentSendButton.disabled = !online;
    updateBucketAgentBar();
    refreshFieldAgentButtons();
  }

  function resetAgentConversation() {
    state.agent_messages = [];
    state.agent_last_json = null;
    elements.agentInput.value = "";
    elements.agentResultActions.hidden = true;
    elements.agentTraceOutput.textContent = "Nog geen call uitgevoerd.";
    renderAgentConversation();
  }

  function renderAgentConversation() {
    if (!state.agent_messages.length) {
      elements.agentConversation.innerHTML = '<p class="empty-note">De agent wacht op je eerste bericht.</p>';
      return;
    }
    elements.agentConversation.innerHTML = state.agent_messages.map((message) =>
      `<div class="agent-message ${message.role}">${escapeText(message.content)}</div>`
    ).join("");
    elements.agentConversation.scrollTop = elements.agentConversation.scrollHeight;
  }

  /* Invulprompts: Mustache-achtig sjabloonformaat.
     {{veld: Label}}  -> de UI toont automatisch een invulveld; de invoer vervangt het token.
     {{! Instructie }} -> gebruikersinstructie (bv. wat uploaden); getoond in de UI maar
                          gestript uit de prompt en dus NIET meegestuurd naar Azure OpenAI. */
  const agentPromptTemplateBuilders = {
    start_description: () => t("prompt.text", {
      schema: JSON.stringify(normalizeCapture(state.capture), null, 2),
      description: "{{veld: Menselijke beschrijving van de leerarchitectuur}}"
    }) + "\n\n{{! Stuur via de +-knop de documenten mee waarop je beschrijving is gebaseerd, zoals formulieren, procesbeschrijvingen of handleidingen. }}"
  };

  function parsePromptTemplate(text) {
    const fields = [];
    const instructions = [];
    const veldPatroon = /\{\{\s*veld\s*:\s*([^}]+?)\s*\}\}/g;
    const instructiePatroon = /\{\{\s*!\s*([^}]+?)\s*\}\}/g;
    let match;
    while ((match = veldPatroon.exec(text)) !== null) {
      if (!fields.some((field) => field.token === match[0])) fields.push({ token: match[0], label: match[1] });
    }
    while ((match = instructiePatroon.exec(text)) !== null) instructions.push(match[1]);
    return { text, fields, instructions };
  }

  function renderAgentTemplateFields() {
    const container = elements.agentTemplateFields;
    if (!container) return;
    const template = state.agent_prompt_template;
    if (!template || (!template.fields.length && !template.instructions.length)) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    container.hidden = false;
    container.innerHTML = template.instructions
      .map((instruction) => `<p class="agent-template-instruction">ⓘ ${escapeText(instruction)}</p>`)
      .join("")
      + template.fields
        .map((field, index) => `<label>${escapeText(field.label)}<textarea data-template-field="${index}" rows="6" maxlength="20000" placeholder="Vul in; de agent plakt dit in de gekozen prompt."></textarea></label>`)
        .join("");
  }

  function applyAgentPromptTemplate() {
    const templates = {
      capture: "Zet de beschikbare leerboxinformatie en eventuele meegestuurde bronnen om naar compacte Freell/leertaal. Geef alleen bruikbare structuur, objecten, routes, voorwaarden en ontbrekende beslispunten terug.",
      testdata: "Genereer compacte realistische simulatiedata voor deze leerbox op basis van de huidige structuur en eventuele meegestuurde bronnen. Geef alleen JSON terug met actiereeksen en vermijd vrije toelichting."
    };
    const value = elements.agentMode.value;
    state.agent_prompt_template = null;
    if (agentPromptTemplateBuilders[value]) {
      state.agent_prompt_template = parsePromptTemplate(agentPromptTemplateBuilders[value]());
      renderAgentTemplateFields();
      // Toon de originele prompt (met {{veld:…}}-tokens) in het promptveld, net als bij de andere keuzes.
      elements.agentInput.value = state.agent_prompt_template.text;
      elements.agentStatusLabel.textContent = "Vul de invulvelden in; bij verzenden vervangen ze de {{veld:…}}-tokens in de prompt.";
      elements.agentTemplateFields?.querySelector("textarea")?.focus();
      return;
    }
    renderAgentTemplateFields();
    if (!templates[value]) return;
    elements.agentInput.value = templates[value];
    elements.agentInput.focus();
  }

  /* Vrijheidsscore: 100% = volledig vrij; dwingende routestappen en harde
     voorwaarden drukken de score. Onder de 20%: te weinig vrijheid voor
     een leerarchitectuur. */
  function computeFreedomScore(capture) {
    const objectCount = (capture.objects || []).length;
    const strictSteps = (capture.interaction_route || []).length;
    const dependencies = (capture.freedom_and_sequence?.hard_dependencies || []).length;
    const score = objectCount
      ? Math.round(100 * Math.max(0, 1 - (strictSteps + 2 * dependencies) / objectCount))
      : 100;
    const color = score >= 70 ? "#34e1d1" : score >= 40 ? "#f0b647" : "#ff9679";
    const title = score < 20
      ? `Vrijheid ${score}%: te weinig vrijheid voor een leerarchitectuur`
      : `Vrijheid van de leerbox: ${score}% (${strictSteps} routestappen en ${dependencies} voorwaarden op ${objectCount} leerobjecten)`;
    return { score, color, title };
  }

  function renderMissionSummary() {
    const container = document.getElementById("missionSummary");
    if (!container) return;
    const leeg = "Nog niet ingevuld.";
    const items = [
      ["🎓", "Leerdoel", getByPath(state.capture, "pedagogical_core.central_learning_goal")],
      ["🔍", "Ontdekking", getByPath(state.capture, "pedagogical_core.central_discovery")],
      ["🏆", "Succesdefinitie", getByPath(state.capture, "pedagogical_core.success_definition")],
      ["🧗", "Weerstand", getByPath(state.capture, "barriers_and_recovery.main_barrier")],
      ["👥", "Doelgroep", getByPath(state.capture, "participants.primary_target_group")],
      ["📄", "Samenvatting", getByPath(state.capture, "metadata.summary")]
    ];
    container.innerHTML = items
      .map(([icon, label, value]) => {
        const text = cleanText(value) && value !== unknown ? String(value) : leeg;
        return `<article title="${escapeText(label)}"><span aria-label="${escapeText(label)}">${icon}</span><p>${escapeText(text)}</p></article>`;
      })
      .join("");
  }

  function estimateTokenCount(text) {
    const value = String(text || "").trim();
    if (!value) {
      return 0;
    }
    const words = value.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(value.length / 4), Math.ceil(words * 1.35));
  }

  const SOL_PRICE_USD_PER_MILLION = {
    input: 5,
    cachedInput: 0.5,
    cacheWriteInput: 6.25,
    output: 30
  };

  function solCostUsd(inputTokens, outputTokens, cachedInputTokens = 0, cacheWriteTokens = 0) {
    const input = Math.max(0, Number(inputTokens) || 0);
    const output = Math.max(0, Number(outputTokens) || 0);
    const cached = Math.min(input, Math.max(0, Number(cachedInputTokens) || 0));
    const cacheWrite = Math.min(input - cached, Math.max(0, Number(cacheWriteTokens) || 0));
    const uncached = Math.max(0, input - cached - cacheWrite);
    const longContext = input > 272000;
    const inputMultiplier = longContext ? 2 : 1;
    const outputMultiplier = longContext ? 1.5 : 1;
    return (
      uncached * SOL_PRICE_USD_PER_MILLION.input
      + cached * SOL_PRICE_USD_PER_MILLION.cachedInput
      + cacheWrite * SOL_PRICE_USD_PER_MILLION.cacheWriteInput
    ) / 1_000_000 * inputMultiplier
      + output * SOL_PRICE_USD_PER_MILLION.output / 1_000_000 * outputMultiplier;
  }

  function estimateAgentCall(content) {
    const selectedSources = state.bucket_sources.filter((source) => state.bucket_selected_source_ids.includes(source.id));
    const compactCapture = {
      metadata: state.capture?.metadata,
      objects: state.capture?.objects,
      steps: state.capture?.steps,
      dependencies: state.capture?.dependencies,
      routes: state.capture?.routes
    };
    const promptPayload = JSON.stringify({
      role: agentRole,
      mode: elements.agentMode.value,
      content,
      previous_messages: state.agent_messages,
      capture: compactCapture,
      selected_sources: selectedSources.map((source) => ({ name: source.name, type: source.kind || source.type || "bron" }))
    });
    const sourceReserveTokens = selectedSources.length * 1200;
    const inputTokens = estimateTokenCount(promptPayload) + sourceReserveTokens;
    const outputTokens = Math.min(state.agent_max_output_tokens || 900, Math.max(300, Math.ceil(inputTokens * 0.35)));
    const cost = solCostUsd(inputTokens, outputTokens);
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost };
  }

  function formatTokenNumber(value) {
    return new Intl.NumberFormat("nl-NL").format(Math.max(0, Math.round(value || 0)));
  }

  function formatUsd(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(value || 0);
  }

  function confirmAgentTokenEstimate(estimate) {
    const message = `Je verstuurt ongeveer ${formatTokenNumber(estimate.inputTokens)} tokens en verwacht maximaal ${formatTokenNumber(estimate.outputTokens)} uitvoertokens. Doorgaan?`;
    if (!elements.agentTokenDialog?.showModal) {
      return Promise.resolve(window.confirm(message));
    }
    elements.agentTokenInputEstimate.textContent = `${formatTokenNumber(estimate.inputTokens)} tokens`;
    elements.agentTokenOutputEstimate.textContent = `${formatTokenNumber(estimate.outputTokens)} tokens`;
    elements.agentTokenTotalEstimate.textContent = `${formatTokenNumber(estimate.totalTokens)} tokens`;
    elements.agentTokenCostEstimate.textContent = formatUsd(estimate.cost);
    elements.agentTokenDialog.returnValue = "";
    return new Promise((resolve) => {
      const dialog = elements.agentTokenDialog;
      const closeHandler = () => resolve(dialog.returnValue === "confirm");
      dialog.addEventListener("close", closeHandler, { once: true });
      dialog.showModal();
    });
  }

  function normalizedAgentUsage(usage) {
    const source = isPlainObject(usage) ? usage : {};
    const inputDetails = source.prompt_tokens_details ?? source.input_tokens_details;
    const inputTokens = Number(source.prompt_tokens ?? source.input_tokens);
    const outputTokens = Number(source.completion_tokens ?? source.output_tokens);
    const reportedTotal = Number(source.total_tokens);
    const cachedInputTokens = Number(inputDetails?.cached_tokens);
    const cacheWriteTokens = Number(inputDetails?.cache_write_tokens);
    return {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : null,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : null,
      cachedInputTokens: Number.isFinite(cachedInputTokens) ? cachedInputTokens : 0,
      cacheWriteTokens: Number.isFinite(cacheWriteTokens) ? cacheWriteTokens : 0,
      totalTokens: Number.isFinite(reportedTotal)
        ? reportedTotal
        : Number.isFinite(inputTokens) && Number.isFinite(outputTokens)
          ? inputTokens + outputTokens
          : null
    };
  }

  function actualAgentCost(usage) {
    if (usage.inputTokens === null || usage.outputTokens === null) return null;
    return solCostUsd(
      usage.inputTokens,
      usage.outputTokens,
      usage.cachedInputTokens,
      usage.cacheWriteTokens
    );
  }

  function showAgentCallResult({ success, usage, message }) {
    const actual = normalizedAgentUsage(usage);
    const cost = actualAgentCost(actual);
    const tokenText = (value) => value === null ? "Niet gemeld" : `${formatTokenNumber(value)} tokens`;
    if (!elements.agentCallResultDialog?.showModal) {
      const fallback = `${success ? "AI-call geslaagd" : "AI-call mislukt"}: ${message || ""}\n`
        + `Input: ${tokenText(actual.inputTokens)}, output: ${tokenText(actual.outputTokens)}, `
        + `totaal: ${tokenText(actual.totalTokens)}, Sol-kostenindicatie: ${cost === null ? "niet berekenbaar" : formatUsd(cost)}.`;
      window.alert(fallback);
      return Promise.resolve();
    }
    elements.agentCallResultDialog.dataset.state = success ? "success" : "error";
    elements.agentCallResultKicker.textContent = success ? "AI-call afgerond" : "AI-call mislukt";
    elements.agentCallResultTitle.textContent = success ? "Werkelijk tokengebruik" : "Er is iets misgegaan";
    elements.agentCallResultMessage.textContent = message || (success ? "De Agent-call is voltooid." : "De Agent-call kon niet worden voltooid.");
    elements.agentCallInputActual.textContent = actual.inputTokens === null
      ? "Niet gemeld"
      : `${tokenText(actual.inputTokens)}${actual.cachedInputTokens ? ` (${formatTokenNumber(actual.cachedInputTokens)} cached)` : ""}`;
    elements.agentCallOutputActual.textContent = tokenText(actual.outputTokens);
    elements.agentCallTotalActual.textContent = tokenText(actual.totalTokens);
    elements.agentCallCostActual.textContent = cost === null ? "Niet berekenbaar" : formatUsd(cost);
    elements.agentCallResultDialog.returnValue = "";
    return new Promise((resolve) => {
      elements.agentCallResultDialog.addEventListener("close", resolve, { once: true });
      elements.agentCallResultDialog.showModal();
    });
  }

  async function sendAgentMessage(event) {
    event.preventDefault();
    if (state.agent_prompt_template) {
      // Vervang de {{veld:…}}-tokens in het promptveld door de ingevulde waarden en strip {{! …}}-instructies.
      const template = state.agent_prompt_template;
      let text = elements.agentInput.value;
      for (const [index, field] of template.fields.entries()) {
        if (!text.includes(field.token)) continue;
        const fieldInput = elements.agentTemplateFields?.querySelector(`[data-template-field="${index}"]`);
        const value = cleanText(fieldInput?.value || "");
        if (!value) {
          elements.agentStatusLabel.textContent = `Vul eerst het veld "${field.label}" in.`;
          fieldInput?.focus();
          return;
        }
        text = text.split(field.token).join(value);
      }
      elements.agentInput.value = text.replace(/\{\{\s*!\s*[^}]*?\}\}/g, "").trim();
      state.agent_prompt_template = null;
      renderAgentTemplateFields();
    }
    if (!cleanText(elements.agentInput.value) && elements.agentMode.value) {
      applyAgentPromptTemplate();
    }
    const content = cleanText(elements.agentInput.value);
    if (!content) {
      elements.agentStatusLabel.textContent = "Kies een prompt of typ eerst een bericht.";
      elements.agentInput.focus();
      return;
    }
    if (!state.agent_online) {
      elements.agentStatusLabel.textContent = "Agent offline: er kan nog geen token-popup worden getoond.";
      return;
    }
    if (state.agent_messages.length >= 11) {
      elements.agentStatusLabel.textContent = "Gesprekslimiet bereikt. Start eerst een nieuw gesprek.";
      return;
    }
    const tokenEstimate = estimateAgentCall(content);
    const confirmed = await confirmAgentTokenEstimate(tokenEstimate);
    if (!confirmed) {
      elements.agentStatusLabel.textContent = "AI-call geannuleerd.";
      return;
    }
    state.agent_messages.push({ role: "user", content });
    elements.agentInput.value = "";
    elements.agentSendButton.disabled = true;
    elements.agentStatusLabel.textContent = "Agent denkt…";
    renderAgentConversation();

    try {
      syncDerivedCapture(state.capture);
      const useProjectBucket = elements.agentBucketConsent.checked && state.bucket_selected_source_ids.length > 0;
      const selectedBucketSourceIds = useProjectBucket ? [...state.bucket_selected_source_ids] : [];
      elements.agentBucketConsent.checked = false;
      updateAgentBucketConsentUI();
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox-agent/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: agentRole,
          mode: elements.agentMode.value,
          messages: state.agent_messages,
          capture: state.capture,
          leerbox_id: getByPath(state.capture, "metadata.leerbox_id") === unknown ? null : getByPath(state.capture, "metadata.leerbox_id"),
          use_project_bucket: useProjectBucket,
          bucket_source_ids: selectedBucketSourceIds
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || `${response.status} ${response.statusText}`);
      }
      state.agent_messages.push(result.message);
      state.agent_last_json = extractJsonFromAgentMessage(result.message.content);
      elements.agentResultActions.hidden = state.agent_last_json === null;
      elements.agentApplyCaptureButton.hidden = !state.agent_last_json || Array.isArray(state.agent_last_json);
      elements.agentApplyTestDataButton.hidden = !Array.isArray(state.agent_last_json);
      if (agentRole === "technologist" && result.trace) {
        elements.agentTraceOutput.textContent = JSON.stringify(result.trace, null, 2);
        elements.agentTraceToggle.hidden = false;
      }
      setAgentStatus(true, "Agent online");
    } catch (error) {
      state.agent_messages.push({ role: "assistant", content: `De agent kon niet antwoorden: ${error.message}` });
      setAgentStatus(false, "Agent offline of call mislukt");
    }
    renderAgentConversation();
  }

  function extractJsonFromAgentMessage(content) {
    const fenced = String(content || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : String(content || "").trim();
    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }

  function applyAgentCapture() {
    if (!state.agent_last_json || Array.isArray(state.agent_last_json)) {
      return;
    }
    state.capture = normalizeCapture(extractCapturePayload(state.agent_last_json));
    hydrateForm();
    persistAndRender();
    elements.agentResultActions.hidden = true;
    activateWorkbenchView("intake");
  }

  function applyAgentTestData() {
    if (!Array.isArray(state.agent_last_json)) {
      return;
    }
    parseAndStoreTestData(JSON.stringify(state.agent_last_json, null, 2), "Interne Leerbox-agent");
    elements.agentResultActions.hidden = true;
    activateWorkbenchView("simulation");
  }

  /* Bronnen -> velden: laat de agent lege editorvelden invullen uit de bronnen.
     Lege velden worden automatisch gevuld; wijzigingen aan al gevulde velden
     vragen eerst om goedkeuring via een mutatievenster. */
  const FILL_SKIP_PATHS = new Set([
    "schema_version",
    "capture_mode",
    "fallback_latex_description",
    "computertaal_statements",
    "completeness",
    "leerbox_design.source_basis"
  ]);
  let pendingSourceFillMutations = [];
  let sourceFillBusy = false;

  function setFillStatus(message) {
    if (elements.fillFromSourcesStatus) elements.fillFromSourcesStatus.textContent = message || "";
  }

  function setFillBusy(busy, message) {
    sourceFillBusy = busy;
    if (elements.fillFromSourcesButton) {
      elements.fillFromSourcesButton.disabled = busy || !state.agent_online;
      elements.fillFromSourcesButton.setAttribute("aria-busy", String(busy));
    }
    if (busy && message) setFillStatus(message);
  }

  function estimateFillCall(content, sourceIds) {
    const ids = new Set(sourceIds);
    const selectedSources = state.bucket_sources.filter((source) => ids.has(source.id));
    // De backend rapporteert de werkelijke lengte van de compacte fill-systeemprompt.
    const systemOverheadChars = state.agent_fill_system_prompt_characters;
    // De volledige huidige capture gaat als context mee.
    const captureChars = JSON.stringify(state.capture || {}).length;
    // Broncontext: platte tekst, max 6.000 tekens per bron en 28.000 totaal.
    const bucketChars = Math.min(selectedSources.length * 6000, 28000);
    const inputChars = systemOverheadChars + captureChars + bucketChars + content.length;
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = state.agent_fill_max_output_tokens || 8000;
    const cost = solCostUsd(inputTokens, outputTokens);
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost };
  }

  let fieldAgentBusyPath = "";

  function fieldPathForControl(field) {
    if (field.name) return field.name;
    if (field.dataset?.architecturePath) return field.dataset.architecturePath;
    if (field.id === "discoveryInput") return "pedagogical_core.central_discovery";
    const strategic = strategicFrameFields.find(([id]) => id === field.id);
    return strategic ? `strategic_frame.${strategic[1]}` : "";
  }

  function fieldControlForPath(path) {
    const named = captureFieldRoots()
      .map((root) => root.querySelector(`[name="${cssEscape(path)}"]`))
      .find(Boolean);
    if (named) return named;
    const architecture = document.querySelector(`[data-architecture-path="${cssEscape(path)}"]`);
    if (architecture) return architecture;
    if (path === "pedagogical_core.central_discovery") return document.getElementById("discoveryInput");
    const strategic = strategicFrameFields.find(([, key]) => path === `strategic_frame.${key}`);
    return strategic ? document.getElementById(strategic[0]) : null;
  }

  function isFieldControlEmpty(field, path) {
    const value = getByPath(state.capture, path);
    if (field.multiple || field.dataset.list === "") {
      return !Array.isArray(value) || value.length === 0;
    }
    return isEmptyCaptureValue(value);
  }

  function createSharedAdvisorIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("shared-advisor-face-icon");
    icon.setAttribute("viewBox", "0 0 80 94");
    icon.setAttribute("aria-hidden", "true");
    const face = document.createElementNS("http://www.w3.org/2000/svg", "path");
    face.classList.add("advisor-face");
    face.setAttribute("d", "M21 43c0-15 8-24 19-24s19 9 19 24v12c0 13-8 22-19 22s-19-9-19-22V43Z");
    icon.append(face);
    return icon;
  }

  function refreshFieldAgentButtons() {
    const fields = [
      ...captureFieldRoots().flatMap((root) => Array.from(root.querySelectorAll("[name]"))),
      ...document.querySelectorAll("[data-architecture-path]"),
      ...strategicFrameFields.map(([id]) => document.getElementById(id)).filter(Boolean),
      document.getElementById("discoveryInput")
    ].filter(Boolean);
    const seen = new Set();
    fields.forEach((field) => {
      const path = fieldPathForControl(field);
      if (!path || seen.has(path)) return;
      seen.add(path);
      const host = field.closest("label") || field.closest(".architecture-card");
      if (!host) return;
      let button = host.querySelector(`.field-agent-button[data-agent-field-path="${cssEscape(path)}"]`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "field-agent-button";
        button.dataset.agentFieldPath = path;
        button.append(createSharedAdvisorIcon());
        button.addEventListener("click", fillSingleFieldWithAgent);
        host.append(button);
      }
      const empty = isFieldControlEmpty(field, path);
      button.hidden = !empty;
      button.disabled = Boolean(fieldAgentBusyPath);
      button.classList.toggle("is-busy", fieldAgentBusyPath === path);
      button.setAttribute("aria-label", `Laat de Agent ${humanizeCapturePath(path)} invullen`);
      button.title = state.agent_online
        ? "Laat de Agent dit lege veld invullen met alles wat al bekend is, inclusief de bronnen."
        : "Klik om opnieuw verbinding met de Agent te maken en dit veld in te vullen.";
    });
  }

  function fieldAgentRequestDetails(field, path) {
    const allowedValues = field instanceof HTMLSelectElement
      ? Array.from(field.options).map((option) => option.value).filter((value) => value && value !== unknown)
      : [];
    const expectsList = field.multiple || field.dataset.list === "";
    const details = [
      `Vul uitsluitend het lege veld met pad "${path}" in.`,
      `Veldnaam: ${humanizeCapturePath(path)}.`,
      `Verwacht JSON-type: ${expectsList ? "array van korte strings" : "string"}.`
    ];
    if (allowedValues.length) {
      details.push(`Toegestane waarden: ${JSON.stringify(allowedValues)}. Kies exact één${field.multiple ? " of meer" : ""} van deze waarden.`);
    }
    details.push("Gebruik de actuele leerbox, eerdere gesprekscontext en beschikbare Project Bucket-bronnen. Geef null terug als de invulling niet voldoende te onderbouwen is.");
    return details.join("\n");
  }

  function estimateFieldCall(content, sourceIds, messages) {
    const ids = new Set(sourceIds);
    const selectedSources = state.bucket_sources.filter((source) => ids.has(source.id));
    const captureChars = JSON.stringify(state.capture).length;
    const conversationChars = messages.reduce((total, message) => total + String(message.content || "").length, 0);
    const bucketChars = Math.min(selectedSources.length * 6000, 28000);
    const inputChars = state.agent_field_system_prompt_characters + captureChars + conversationChars + bucketChars + content.length;
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = state.agent_max_output_tokens || 900;
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: solCostUsd(inputTokens, outputTokens)
    };
  }

  async function fillSingleFieldWithAgent(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const path = button.dataset.agentFieldPath;
    const field = fieldControlForPath(path);
    if (!field || !isFieldControlEmpty(field, path) || fieldAgentBusyPath) return;
    if (!state.agent_online) {
      await initializeAgent();
      if (!state.agent_online) {
        await showAgentCallResult({
          success: false,
          usage: null,
          message: elements.agentStatusLabel?.textContent || "De Agent is offline."
        });
        return;
      }
    }
    const leerboxId = getByPath(state.capture, "metadata.leerbox_id");
    const sourceIds = state.bucket_selected_source_ids.length
      ? [...state.bucket_selected_source_ids]
      : state.bucket_sources.map((source) => source.id);
    const useProjectBucket = Boolean(sourceIds.length && leerboxId && leerboxId !== unknown);
    const content = fieldAgentRequestDetails(field, path);
    const previousMessages = state.agent_messages
      .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: String(message.content).slice(-6000)
      }));
    const messages = [...previousMessages, { role: "user", content }].slice(-12);
    const confirmed = await confirmAgentTokenEstimate(estimateFieldCall(content, sourceIds, previousMessages));
    if (!confirmed) return;

    fieldAgentBusyPath = path;
    refreshFieldAgentButtons();
    let callUsage = null;
    try {
      syncDerivedCapture(state.capture);
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox-agent/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: agentRole,
          mode: "fill_field",
          messages,
          capture: state.capture,
          leerbox_id: useProjectBucket ? leerboxId : null,
          use_project_bucket: useProjectBucket,
          bucket_source_ids: useProjectBucket ? sourceIds : []
        })
      });
      const result = await response.json().catch(() => ({}));
      callUsage = result.usage || null;
      if (!response.ok) {
        const detail = result.detail;
        const error = new Error(isPlainObject(detail) ? detail.message : detail || `${response.status} ${response.statusText}`);
        error.usage = isPlainObject(detail) ? detail.usage : null;
        throw error;
      }
      const proposal = extractJsonFromAgentMessage(result.message?.content || "");
      if (!isPlainObject(proposal) || proposal.path !== path) {
        throw new Error("De Agent gaf geen geldige invulling voor precies dit veld terug.");
      }
      await showAgentCallResult({
        success: true,
        usage: result.usage,
        message: proposal.value === null
          ? `De Agent vond onvoldoende grond om ${humanizeCapturePath(path)} in te vullen.`
          : `De Agent heeft een invulling voor ${humanizeCapturePath(path)} gevonden.`
      });
      if (proposal.value === null || isEmptyCaptureValue(proposal.value)) return;
      const expectsList = field.multiple || field.dataset.list === "";
      const value = expectsList
        ? (Array.isArray(proposal.value) ? proposal.value.map(String).filter(Boolean) : [String(proposal.value)])
        : String(proposal.value).trim();
      if (field instanceof HTMLSelectElement) {
        const allowed = new Set(Array.from(field.options).map((option) => option.value));
        const proposedValues = Array.isArray(value) ? value : [value];
        if (proposedValues.some((item) => !allowed.has(item))) {
          throw new Error("De Agent koos een waarde die niet in dit keuzeveld voorkomt.");
        }
      }
      setByPath(state.capture, path, value);
      hydrateForm();
      persistAndRender();
      fieldControlForPath(path)?.focus();
    } catch (error) {
      await showAgentCallResult({
        success: false,
        usage: error.usage || callUsage,
        message: error.message
      });
    } finally {
      fieldAgentBusyPath = "";
      refreshFieldAgentButtons();
    }
  }

  async function fillFieldsFromSources() {
    if (!canUseProjectDocuments()) {
      setFillStatus("Alleen beschikbaar voor architect en technoloog.");
      return;
    }
    let leerboxId;
    try {
      leerboxId = projectBucketId();
    } catch (error) {
      setFillStatus(error.message);
      return;
    }
    if (!Array.isArray(state.bucket_sources) || !state.bucket_sources.length) {
      setFillStatus("Er zijn nog geen bronnen om uit te putten.");
      return;
    }
    if (!state.agent_online) {
      setFillStatus("Agent offline: probeer het later opnieuw.");
      return;
    }
    const selectedIds = state.bucket_selected_source_ids.length
      ? [...state.bucket_selected_source_ids]
      : state.bucket_sources.map((source) => source.id);
    const content = "Vul de leerbox_capture aan op basis van de meegestuurde Project Bucket-bronnen. "
      + "Vul alleen wat de bronnen onderbouwen en verzin niets. Geef in één JSON-codeblok uitsluitend een compact deelobject terug "
      + "met `_fill_meta` en `patch`: zet de voorgestelde velden en nieuwe lijst-items in `patch` volgens hun bestaande capture-hiërarchie, "
      + "kopieer geen ongewijzigde inhoud en zet `_fill_meta.has_more` alleen op true als een volgende ronde nog concrete broninformatie kan verwerken.";
    const estimate = estimateFillCall(content, selectedIds);
    const confirmed = await confirmAgentTokenEstimate(estimate);
    if (!confirmed) {
      setFillStatus("Geannuleerd.");
      return;
    }

    setFillBusy(true, `Agent leest ${selectedIds.length} bron${selectedIds.length === 1 ? "" : "nen"}…`);
    let callUsage = null;
    try {
      syncDerivedCapture(state.capture);
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox-agent/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: agentRole,
          mode: "fill_from_sources",
          messages: [{ role: "user", content }],
          capture: state.capture,
          leerbox_id: leerboxId,
          use_project_bucket: true,
          bucket_source_ids: selectedIds
        })
      });
      const result = await response.json().catch(() => ({}));
      callUsage = result.usage || null;
      if (!response.ok) {
        const detail = result.detail;
        const error = new Error(
          isPlainObject(detail)
            ? detail.message || `${response.status} ${response.statusText}`
            : detail || `${response.status} ${response.statusText}`
        );
        error.usage = isPlainObject(detail) ? detail.usage : null;
        throw error;
      }
      const proposedJson = extractJsonFromAgentMessage(result.message?.content || "");
      if (!proposedJson || Array.isArray(proposedJson)) {
        throw new Error("De agent gaf geen bruikbaar capture-object terug.");
      }
      const fillMeta = isPlainObject(proposedJson._fill_meta) ? proposedJson._fill_meta : {};
      const proposed = isPlainObject(proposedJson.patch)
        ? proposedJson.patch
        : extractCapturePayload(proposedJson);
      if (!isPlainObject(proposed)) {
        throw new Error("De agent gaf geen geldig JSON-deelobject terug.");
      }
      const diff = computeCaptureDiff(state.capture, proposed);
      const proposalCount = diff.additions.length + diff.mutations.length;
      const hasMore = fillMeta.has_more === true
        || (!Object.hasOwn(fillMeta, "has_more") && proposalCount >= 25);
      const hasMoreReason = cleanText(fillMeta.reason);
      await showAgentCallResult({
        success: true,
        usage: result.usage,
        message: "De Agent-call is geslaagd. Hieronder staat het werkelijke, door de provider gemelde tokengebruik."
      });
      if (diff.additions.length) {
        const working = clone(state.capture);
        applyCaptureChanges(working, diff.additions);
        state.capture = normalizeCapture(working);
        hydrateForm();
        persistAndRender();
      }
      const remainingEmpty = countEmptyCaptureValues(state.capture);
      openSourceFillDialog(diff.additions, diff.mutations, remainingEmpty, hasMore, hasMoreReason);
    } catch (error) {
      setFillStatus(`Mislukt: ${error.message}`);
      await showAgentCallResult({
        success: false,
        usage: error.usage || callUsage,
        message: error.message
      });
    } finally {
      setFillBusy(false);
    }
  }

  function isEmptyCaptureValue(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" || trimmed === unknown;
    }
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.values(value).every(isEmptyCaptureValue);
    return false;
  }

  function captureItemKey(item) {
    if (isPlainObject(item)) {
      if (item.id) return `id:${String(item.id).toLowerCase()}`;
      if (item.name) return `name:${String(item.name).toLowerCase()}`;
      if (item.label) return `label:${String(item.label).toLowerCase()}`;
    }
    return `json:${JSON.stringify(item)}`;
  }

  function summarizeCaptureItem(item) {
    if (!isPlainObject(item)) return String(item);
    const readable = item.name || item.label || item.title || item.id
      || Object.values(item).find((value) => typeof value === "string" && value.trim() && value.trim() !== unknown);
    return String(readable || "item").slice(0, 80);
  }

  function humanizeCapturePath(path) {
    return String(path).split(".").map((part) => part.replace(/_/g, " ")).join(" › ");
  }

  function computeCaptureDiff(current, proposed) {
    const additions = [];
    const mutations = [];
    walkCaptureDiff(current, proposed, "", additions, mutations);
    return { additions, mutations };
  }

  function walkCaptureDiff(current, proposed, path, additions, mutations) {
    if (path && FILL_SKIP_PATHS.has(path)) return;
    if (isPlainObject(proposed)) {
      for (const key of Object.keys(proposed)) {
        const childPath = path ? `${path}.${key}` : key;
        walkCaptureDiff(current?.[key], proposed[key], childPath, additions, mutations);
      }
      return;
    }
    if (Array.isArray(proposed)) {
      diffCaptureArray(Array.isArray(current) ? current : [], proposed, path, additions, mutations);
      return;
    }
    if (typeof proposed === "string") {
      const value = proposed.trim();
      if (!value || value === unknown) return;
      if (isEmptyCaptureValue(current)) {
        additions.push({ kind: "field", path, from: current, to: value });
      } else if (String(current).trim() !== value) {
        mutations.push({ kind: "field", path, from: current, to: value });
      }
    }
    // Getallen en booleans zijn structurele schakelaars en worden bewust overgeslagen.
  }

  function diffCaptureArray(current, proposed, path, additions, mutations) {
    if (!proposed.length) return;
    const isEmpty = current.length === 0;
    const scalar = proposed.every((item) => !isPlainObject(item) && !Array.isArray(item));
    const currentKeys = new Set(current.map(captureItemKey));
    for (const item of proposed) {
      if (scalar) {
        const text = String(item).trim();
        if (!text || text === unknown) continue;
        if (current.some((existing) => String(existing).trim().toLowerCase() === text.toLowerCase())) continue;
        const entry = { kind: "list-add", path, item, label: text };
        if (isEmpty) additions.push(entry); else mutations.push(entry);
      } else {
        if (!isPlainObject(item) || isEmptyCaptureValue(item)) continue;
        if (currentKeys.has(captureItemKey(item))) continue;
        const entry = { kind: "list-add", path, item, label: summarizeCaptureItem(item) };
        if (isEmpty) additions.push(entry); else mutations.push(entry);
      }
    }
  }

  function applyCaptureChanges(target, changes) {
    for (const change of changes) {
      if (change.kind === "field") {
        setByPath(target, change.path, change.to);
      } else if (change.kind === "list-add") {
        const existing = getByPath(target, change.path);
        const list = Array.isArray(existing) ? existing : [];
        list.push(change.item);
        setByPath(target, change.path, list);
      }
    }
  }

  function countEmptyCaptureValues(value, path = "") {
    if (path && FILL_SKIP_PATHS.has(path)) return 0;
    if (typeof value === "string") return isEmptyCaptureValue(value) ? 1 : 0;
    if (Array.isArray(value)) {
      if (!value.length) return 1;
      return value.reduce((total, item, index) =>
        total + countEmptyCaptureValues(item, `${path}[${index}]`), 0);
    }
    if (isPlainObject(value)) {
      return Object.entries(value).reduce((total, [key, item]) => {
        const childPath = path ? `${path}.${key}` : key;
        return total + countEmptyCaptureValues(item, childPath);
      }, 0);
    }
    return 0;
  }

  function openSourceFillDialog(additions, mutations, remainingEmpty, hasMore, hasMoreReason) {
    pendingSourceFillMutations = mutations;
    const filledCount = additions.length;
    const parts = [];
    if (filledCount) parts.push(`${filledCount} leeg veld${filledCount === 1 ? "" : "en"} automatisch ingevuld uit de bronnen.`);
    else parts.push("Geen lege velden automatisch ingevuld.");
    if (mutations.length) {
      parts.push(`${mutations.length} voorgestelde wijziging${mutations.length === 1 ? "" : "en"} wacht op goedkeuring.`);
    }
    parts.push(`${remainingEmpty} veld${remainingEmpty === 1 ? "" : "en"} nog leeg of unknown.`);
    if (hasMore && remainingEmpty) parts.push("De bronnen bevatten nog informatie voor een volgende invulronde.");
    if (elements.sourceFillSummary) elements.sourceFillSummary.textContent = parts.join(" ");
    if (elements.sourceFillIntro) {
      const baseIntro = mutations.length
        ? "Doorgevoerde aanvullingen zijn gemarkeerd. Vink daaronder alleen de voorgestelde wijzigingen aan die je ook wilt toepassen."
        : filledCount
          ? "Dit zijn de aanvullingen die automatisch in de onderwijsarchitectuur zijn doorgevoerd."
          : "De geselecteerde bronnen bevatten in deze ronde geen nieuwe, voldoende onderbouwde invulling. Probeer opnieuw voor een volgende ronde of voeg rijkere bronnen toe.";
      elements.sourceFillIntro.textContent = hasMore && hasMoreReason
        ? `${baseIntro} Nog beschikbaar: ${hasMoreReason}`
        : baseIntro;
    }
    if (elements.sourceFillCancelButton) {
      elements.sourceFillCancelButton.textContent = mutations.length ? "Overige niet toepassen" : "Sluiten";
    }
    if (elements.sourceFillApplyButton) elements.sourceFillApplyButton.hidden = mutations.length === 0;
    if (elements.sourceFillContinueButton) {
      elements.sourceFillContinueButton.hidden = !(hasMore && remainingEmpty);
    }
    renderSourceFillList(additions, mutations);
    if (!elements.sourceFillDialog?.showModal) {
      setFillStatus(`${filledCount} veld(en) ingevuld; ${remainingEmpty} nog leeg of unknown.`);
      return;
    }
    const dialog = elements.sourceFillDialog;
    dialog.returnValue = "";
    const continueHandler = () => {
      if (mutations.length) applyApprovedMutations(filledCount);
      dialog.close("continue");
      window.setTimeout(() => fillFieldsFromSources(), 0);
    };
    elements.sourceFillContinueButton?.addEventListener("click", continueHandler);
    const handler = () => {
      dialog.removeEventListener("close", handler);
      elements.sourceFillContinueButton?.removeEventListener("click", continueHandler);
      if (dialog.returnValue === "continue") {
        return;
      } else if (mutations.length && dialog.returnValue === "confirm") {
        applyApprovedMutations(filledCount);
      } else if (!mutations.length) {
        setFillStatus(`${filledCount} veld(en) ingevuld; ${remainingEmpty} nog leeg of unknown.`);
      } else {
        setFillStatus(filledCount ? `${filledCount} veld(en) ingevuld; wijzigingen niet toegepast.` : "Geen wijzigingen toegepast.");
      }
    };
    dialog.addEventListener("close", handler);
    dialog.showModal();
  }

  function renderSourceFillList(additions, mutations) {
    if (!elements.sourceFillList) return;
    elements.sourceFillList.replaceChildren();
    additions.forEach((addition) => {
      const item = document.createElement("div");
      item.className = "source-fill-item is-applied";
      const pathLabel = document.createElement("span");
      pathLabel.className = "source-fill-item-path";
      pathLabel.textContent = humanizeCapturePath(addition.path);
      const badge = document.createElement("span");
      badge.className = "source-fill-applied-badge";
      badge.textContent = "Doorgevoerd";
      const change = document.createElement("span");
      change.className = "source-fill-item-change";
      const added = document.createElement("span");
      added.className = "source-fill-item-new";
      added.textContent = addition.kind === "list-add"
        ? `+ ${addition.label || summarizeCaptureItem(addition.item)}`
        : String(addition.to);
      change.append(added);
      item.append(pathLabel, badge, change);
      elements.sourceFillList.appendChild(item);
    });
    mutations.forEach((mutation, index) => {
      const item = document.createElement("label");
      item.className = "source-fill-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.mutationIndex = String(index);
      const pathLabel = document.createElement("span");
      pathLabel.className = "source-fill-item-path";
      pathLabel.textContent = humanizeCapturePath(mutation.path);
      const change = document.createElement("span");
      change.className = "source-fill-item-change";
      if (mutation.kind === "list-add") {
        const added = document.createElement("span");
        added.className = "source-fill-item-new";
        added.textContent = `+ ${mutation.label || summarizeCaptureItem(mutation.item)}`;
        change.append(added);
      } else {
        const oldSpan = document.createElement("span");
        oldSpan.className = "source-fill-item-old";
        oldSpan.textContent = String(mutation.from);
        const newSpan = document.createElement("span");
        newSpan.className = "source-fill-item-new";
        newSpan.textContent = String(mutation.to);
        change.append(oldSpan, document.createTextNode("  →  "), newSpan);
      }
      item.append(checkbox, pathLabel, change);
      elements.sourceFillList.appendChild(item);
    });
  }

  function applyApprovedMutations(filledCount) {
    const checked = Array.from(elements.sourceFillList.querySelectorAll("input[type=checkbox]:checked"))
      .map((box) => pendingSourceFillMutations[Number(box.dataset.mutationIndex)])
      .filter(Boolean);
    if (!checked.length) {
      setFillStatus(filledCount ? `${filledCount} veld(en) ingevuld; geen wijzigingen aangevinkt.` : "Geen wijzigingen aangevinkt.");
      return;
    }
    const working = clone(state.capture);
    applyCaptureChanges(working, checked);
    state.capture = normalizeCapture(working);
    hydrateForm();
    persistAndRender();
    setFillStatus(`${checked.length} wijziging${checked.length === 1 ? "" : "en"} toegepast${filledCount ? ` (naast ${filledCount} ingevuld veld(en))` : ""}.`);
  }

  function handleArchitectureInput(event) {
    const field = event.target;
    if (!field.dataset.architecturePath) {
      return;
    }
    const value = field.dataset.list === ""
      ? linesToList(field.value)
      : cleanText(field.value);
    setByPath(state.capture, field.dataset.architecturePath, value);
    hydrateFormField(field.dataset.architecturePath);
    persistAndRender();
  }

  function closeBlockDialog() {
    elements.blockDialog.close();
    state.activeBlock = null;
  }

  function changeLanguage(event) {
    state.language = event.target.value;
    localStorage.setItem(languageStorageKey, state.language);
    applyLanguage();
    render();
  }

  function openPromptDialog() {
    elements.promptOutput.value = buildAiPrompt();
    elements.promptDialog.showModal();
  }

  function closePromptDialog() {
    elements.promptDialog.close();
  }

  function copyPrompt() {
    const text = elements.promptOutput.value;
    const copyPromise = navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : fallbackTextAreaCopy(elements.promptOutput);

    copyPromise.then(() => {
      const button = document.getElementById("copyPromptButton");
      button.textContent = t("prompt.copied");
      window.setTimeout(() => {
        button.textContent = t("prompt.copy");
      }, 1300);
    });
  }

  function buildAiPrompt() {
    const schema = JSON.stringify(normalizeCapture(state.capture), null, 2);
    return t("prompt.text", {
      schema,
      description: state.capture.raw_user_description || t("prompt.descriptionPlaceholder")
    });
  }

  function downloadPrompt() {
    downloadTextFile(promptFilename, buildAiPrompt(), "text/plain");
  }

  function downloadLatex() {
    syncDerivedCapture(state.capture);
    const id = captureId();
    if (planView === "pdf") {
      downloadPlanPdf(id);
      return;
    }
    if (planView === "json") {
      downloadTextFile(`${id}.json`, JSON.stringify(normalizeCapture(state.capture), null, 2), "application/json");
      return;
    }
    downloadTextFile(`${id}-verrijkingsplan.tex`, state.capture.fallback_latex_description.body, "application/x-tex");
  }

  /* Ontwerpplan: wisselen tussen LaTeX-bron en de gegenereerde PDF.
     De PDF wordt door de backend gecompileerd uit dezelfde LaTeX-bron. */
  let planView = "source";
  let planPdfUrl = "";
  let planPdfSource = "";

  function currentPlanLatex() {
    syncDerivedCapture(state.capture);
    return state.capture.fallback_latex_description?.body || "";
  }

  async function ensurePlanPdf() {
    const latexBron = currentPlanLatex();
    const status = document.getElementById("latexPdfStatus");
    const frame = document.getElementById("latexPdfFrame");
    if (!status || !frame) return;
    if (planPdfUrl && planPdfSource === latexBron) {
      status.hidden = true;
      frame.hidden = false;
      return;
    }
    status.hidden = false;
    frame.hidden = true;
    status.textContent = "PDF wordt gegenereerd…";
    try {
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox/latex-pdf`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: latexBron })
      });
      if (!response.ok) {
        const fout = await response.json().catch(() => ({}));
        throw new Error(fout.detail || `${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      if (planPdfUrl) URL.revokeObjectURL(planPdfUrl);
      planPdfUrl = URL.createObjectURL(blob);
      planPdfSource = latexBron;
      frame.src = planPdfUrl;
      status.hidden = true;
      frame.hidden = false;
    } catch (fout) {
      status.hidden = false;
      frame.hidden = true;
      status.textContent = `PDF kon niet worden gemaakt: ${fout.message}`;
    }
  }

  async function downloadPlanPdf(id) {
    await ensurePlanPdf();
    if (!planPdfUrl) return;
    const link = document.createElement("a");
    link.href = planPdfUrl;
    link.download = `${id}-verrijkingsplan.pdf`;
    link.click();
  }

  function setPlanView(view) {
    planView = ["pdf", "json"].includes(view) ? view : "source";
    document.querySelectorAll("[data-plan-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.planView === planView);
    });
    const preview = document.getElementById("latexPreview");
    const pdfView = document.getElementById("latexPdfView");
    const jsonView = document.getElementById("latexJsonView");
    const downloadButton = document.getElementById("downloadLatexButton");
    if (preview) preview.hidden = planView !== "source";
    if (pdfView) pdfView.hidden = planView !== "pdf";
    if (jsonView) {
      jsonView.hidden = planView !== "json";
      if (planView === "json") jsonView.textContent = JSON.stringify(normalizeCapture(state.capture), null, 2);
    }
    if (downloadButton) {
      const labels = { pdf: "Download .pdf", json: "Download .json", source: "Download .tex" };
      downloadButton.textContent = labels[planView];
    }
    if (planView === "pdf") ensurePlanPdf();
  }

  function moveDesignPanelToStrategy(active) {
    const designPanel = document.querySelector('.panel[data-panel="design"]');
    const slot = document.getElementById("strategyDesignSlot");
    if (!designPanel || !slot) return;
    if (!designPanelHome) designPanelHome = designPanel.parentElement;
    if (active) {
      slot.hidden = false;
      slot.appendChild(designPanel);
      designPanel.classList.add("is-active");
    } else if (designPanel.parentElement === slot) {
      slot.hidden = true;
      designPanelHome.appendChild(designPanel);
      designPanel.classList.remove("is-active");
    }
  }

  function setFloatingPanelTitle(iconId, titleId, meta) {
    if (!meta) return;
    const icon = document.getElementById(iconId);
    const title = document.getElementById(titleId);
    if (icon) icon.textContent = meta[0];
    if (title) title.textContent = meta[1];
  }

  function activatePanel(panelName) {
    if (strategicPanels.includes(panelName)) {
      // Onderwijsarchitectuur-vensters: elk element op precies één plek.
      activateWorkbenchView("description");
      document.querySelectorAll(".strategic-item").forEach((item) => {
        const actief = item.dataset.strategic === panelName;
        item.hidden = !actief;
        item.open = actief;
      });
      const rawField = document.querySelector(".raw-description-field");
      if (rawField) rawField.hidden = panelName !== "mission";
      // Ontdekking hoort bij Doelen.
      const discoveryField = document.getElementById("discoveryField");
      if (discoveryField) discoveryField.hidden = panelName !== "goals";
      moveDesignPanelToStrategy(panelName === "strategy");
      moveFieldToWorkflow(panelName);
      setFloatingPanelTitle("workflowPanelIcon", "workflowPanelTitle", panelMeta[panelName]);
      return;
    }
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.panel === panelName);
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === panelName);
    });
    setFloatingPanelTitle("paletteIcon", "paletteTitle", panelMeta[panelName]);
  }

  function activateWorkspaceView(viewName) {
    const selectedView = ["latex", "architecture", "vat", "statements"].includes(viewName) ? viewName : "vat";
    document.querySelectorAll(".workspace-view-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.workspaceView === selectedView);
    });
    document.querySelectorAll(".workspace-view").forEach((view) => {
      view.classList.toggle("is-active", view.dataset.workspaceView === selectedView);
    });
    if (embeddedWorkbench) {
      window.parent.postMessage({ type: "leerpret-editor-workspace-view", workspace_view: selectedView }, parentOrigin);
    }
    // Kaart zichtbaar geworden: opnieuw renderen zodat maatvoering en centrering kloppen.
    if (selectedView === "vat" && state.capture) window.requestAnimationFrame(() => renderNetworkCanvas(state.capture));
  }

  /* Sommige capturevelden staan buiten het formulier (verplaatst naar hun eigen venster),
     dus zoeken we ze in het formulier én in het beschrijvingsvenster. */
  function captureFieldRoots() {
    return [elements.form, elements.workflowPanel, elements.architectureRouteFields].filter(Boolean);
  }

  function hydrateForm() {
    captureFieldRoots().forEach((root) => {
      root.querySelectorAll("[name]").forEach((field) => hydrateField(field));
    });
  }

  function hydrateFormField(path) {
    for (const root of captureFieldRoots()) {
      const field = root.querySelector(`[name="${cssEscape(path)}"]`);
      if (field) {
        hydrateField(field);
        return;
      }
    }
  }

  function hydrateField(field) {
    const value = getByPath(state.capture, field.name);
    if (field.multiple) {
      const selected = new Set(Array.isArray(value) ? value : []);
      Array.from(field.options).forEach((option) => {
        option.selected = selected.has(option.value);
      });
      return;
    }
    field.value = field.dataset.list === "" ? listToLines(value) : isUnknown(value) ? "" : value;
  }

  function populateOptionControls() {
    document.querySelectorAll("select[data-multi]").forEach((select) => {
      const optionSet = optionSets[select.dataset.multi] || [];
      const selected = new Set(Array.from(select.selectedOptions).map((option) => option.value));
      select.innerHTML = optionSet
        .map((value) => `<option value="${escapeText(value)}" ${selected.has(value) ? "selected" : ""}>${escapeText(enumLabel(value))}</option>`)
        .join("");
    });
  }

  function render() {
    const capture = state.capture;
    syncDerivedCapture(capture);
    const title = capture.metadata.work_name && capture.metadata.work_name !== unknown
      ? capture.metadata.work_name
      : t("workspace.newTitle");
    const validation = validateCapturedLearningBox(capture);

    elements.workspaceTitle.textContent = title;
    strategicFrameFields.forEach(([id, key]) => {
      const field = document.getElementById(id);
      if (field && document.activeElement !== field) field.value = capture.strategic_frame?.[key] || "";
    });
    const discoveryInput = document.getElementById("discoveryInput");
    if (discoveryInput && document.activeElement !== discoveryInput) {
      const discoveryValue = capture.pedagogical_core?.central_discovery;
      discoveryInput.value = discoveryValue && discoveryValue !== unknown ? discoveryValue : "";
    }
    if (document.activeElement !== elements.rawDescriptionText) {
      elements.rawDescriptionText.value = capture.raw_user_description || "";
    }
    renderBlocks("object", capture.objects, elements.objectBlocks, validation);
    renderBlocks("step", capture.interaction_route, elements.stepBlocks);
    renderBlocks("dependency", capture.freedom_and_sequence.hard_dependencies, elements.dependencyBlocks);
    elements.objectCount.textContent = String(capture.objects.length);
    elements.stepCount.textContent = String(capture.interaction_route.length);
    elements.dependencyCount.textContent = String(capture.freedom_and_sequence.hard_dependencies.length);
    const hudCounts = {
      hudObjectCount: capture.objects.length,
      hudStepCount: capture.interaction_route.length,
      hudDependencyCount: capture.freedom_and_sequence.hard_dependencies.length
    };
    // Vrijheidsthermometer: hoe vrij is de leerbox (vrij <-> gedicteerd)?
    const freedom = computeFreedomScore(capture);
    const freedomWrap = document.getElementById("hudFreedom");
    const freedomValue = document.getElementById("hudFreedomValue");
    if (freedomWrap && freedomValue) {
      freedomValue.textContent = `${freedom.score}%`;
      freedomValue.style.color = freedom.color;
      freedomWrap.title = freedom.title;
      freedomWrap.style.setProperty("--freedom-width", `${freedom.score}%`);
      freedomWrap.style.setProperty("--freedom-color", freedom.color);
    }
    Object.entries(hudCounts).forEach(([id, value]) => {
      const output = document.getElementById(id);
      if (output) output.textContent = String(value);
    });
    renderNetworkCanvas(capture);
    renderCanvasReport(capture);
    renderMeasurementDashboard(capture);

    const audit = auditCapture(capture);
    capture.completeness.required_fields_complete = audit.missing.length === 0;
    capture.completeness.unknown_fields = audit.missing;
    capture.completeness.open_questions = audit.missing.map((item) => t("audit.openQuestion", { item }));

    elements.auditScore.textContent = `${audit.complete}/${audit.total}`;
    elements.auditList.innerHTML = audit.missing.length
      ? audit.missing.map((item) => `<li>${escapeText(item)}</li>`).join("")
      : `<li>${escapeText(t("audit.ready"))}</li>`;
    renderSynchronousViews(capture, validation);
    renderValidation(validation);
    renderInventoryProgress(audit, validation);
    renderAdvisor(validation, state.advisor_report);
    elements.jsonOutput.value = JSON.stringify(capture, null, 2);
    window.requestAnimationFrame(refreshFieldAgentButtons);
  }

  function renderCanvasReport(capture) {
    const output = document.getElementById("canvasReportContent");
    if (!output) return;
    const objects = capture.objects || [];
    const steps = capture.interaction_route || [];
    const dependencies = capture.freedom_and_sequence.hard_dependencies || [];
    output.innerHTML = `
      <section><h4>Objecten <b>${objects.length}</b></h4>${objects.length ? objects.map((item) => `<span>${escapeText(item.label || item.object_id)}</span>`).join("") : "<em>Nog geen objecten</em>"}</section>
      <section><h4>Interactieroute <b>${steps.length}</b></h4>${steps.length ? steps.map((item, index) => `<button type="button" data-report-route="${index}">${index + 1}. ${escapeText(item.action_type || item.object_id)}</button>`).join("") : "<em>Nog geen route</em>"}</section>
      <section><h4>Afhankelijkheden <b>${dependencies.length}</b></h4>${dependencies.length ? dependencies.map((item) => `<span>${escapeText(item.from_object_id)} → ${escapeText(item.to_object_id)}</span>`).join("") : "<em>Geen harde afhankelijkheden</em>"}</section>`;
    output.querySelectorAll("[data-report-route]").forEach((button) => button.addEventListener("click", () => {
      const routeIndex = button.dataset.reportRoute;
      elements.networkEdges.querySelectorAll(".network-edge").forEach((edge) => edge.classList.toggle("is-highlighted", edge.dataset.routeIndex === routeIndex));
      output.querySelectorAll("[data-report-route]").forEach((item) => item.classList.toggle("is-active", item === button));
    }));
  }

  function renderMeasurementDashboard(capture) {
    const output = document.getElementById("measurementDashboard");
    if (!output) return;
    const actionTypes = capture.measurement?.event_contract?.example_action_types || [];
    const resultValues = capture.measurement?.event_contract?.result_values || [];
    const values = [actionTypes.length, resultValues.length, (capture.interaction_route || []).length, (capture.objects || []).length];
    const labels = ["Acties", "Resultaten", "Route", "Objecten"];
    const max = Math.max(1, ...values);
    output.innerHTML = `<header><strong>Sensorbeeld</strong><span>Live uit de actuele leerbox</span></header><div class="measurement-bars">${values.map((value, index) => `<div><span>${labels[index]}</span><i style="height:${Math.max(8, value / max * 74)}px"></i><b>${value}</b></div>`).join("")}</div>`;
  }

  function renderInventoryProgress(audit, validation) {
    const ratio = audit.total ? audit.complete / audit.total : 0;
    const level = validation.is_valid ? 3 : ratio >= .66 ? 2 : ratio >= .33 ? 1 : 0;
    const badge = document.getElementById("inventoryLevel");
    if (badge) badge.textContent = `L${level}`;
    document.querySelectorAll("[data-unlock-level]").forEach((button) => {
      const locked = Number(button.dataset.unlockLevel) > level;
      button.classList.toggle("is-locked", locked);
      button.setAttribute("aria-label", `${button.textContent.trim()}${locked ? `; wordt prominent bij niveau ${button.dataset.unlockLevel}` : "; vrijgespeeld"}`);
    });
  }

  function renderAdvisor(validation, report = null) {
    const panel = document.getElementById("advisorPanel");
    const signal = document.getElementById("advisorSignal");
    const message = document.getElementById("advisorMessage");
    if (!panel || !signal || !message) return;

    let severity = "info";
    let label = "INFRASTRUCTUUR GEREED";
    let advice = "De leerbox heeft een bruikbare start, weerstand, succes en route. Start de simulatie om spelerspaden te controleren.";
    const violation = report?.dependency_violations?.[0];

    if (violation) {
      severity = "critical";
      label = "PAD GEBLOKKEERD";
      advice = `Spelers bereiken '${violation.target_object_id}' voordat '${violation.missing_object_id}' is voltooid. Voeg een conditioneel pad of een duidelijkere aanwijzing toe.`;
    } else if (report?.bottlenecks?.length) {
      severity = "warning";
      label = "SIMULATIEWAARSCHUWING";
      advice = report.bottlenecks[0];
    } else if (!validation.is_valid) {
      severity = "warning";
      label = "BOUWADVIES";
      const missing = validation.missing[0] || "onvolledige infrastructuur";
      const recommendations = {
        "meer dan een Begin-object": "Kies één toegangspoort. Meerdere beginpunten maken het spelerspad onduidelijk.",
        "geen duidelijk Begin-object": "Plaats één Start-object zodat iedere speler de wereld herkenbaar binnenkomt.",
        "geen Eind-object": "Plaats een Eind-object waarmee de speler de leerbox aantoonbaar kan verlaten.",
        "geen adequaat weerstandsobject": "Voeg een betekenisvolle hindernis toe; zonder weerstand ontstaat geen herstel of leerroute.",
        "succesobject ontbreekt": "Voeg een zichtbaar succesmoment toe, los van de uitgang van de leerbox.",
        "geen route voor gesimuleerde datastroom": "Verbind de objecten met acties. Zonder route kan de adviseur geen spelersgedrag simuleren."
      };
      advice = recommendations[missing] || `Los eerst '${missing}' op om de infrastructuur speelbaar te maken.`;
    }

    panel.dataset.severity = severity;
    signal.textContent = label;
    message.textContent = advice;
  }

  function renderBlocks(type, items, container, validation = null) {
    if (!items.length) {
      container.innerHTML = `<div class="empty-note">${emptyText(type)}</div>`;
      return;
    }

    container.innerHTML = items.map((item, index) => blockHtml(type, item, index, validation)).join("");
    container.querySelectorAll(".block-card").forEach((button) => {
      button.addEventListener("click", () => openBlockDialog(type, Number(button.dataset.index)));
    });
  }

  function updateHudAnchor() {
    if (!document.body.classList.contains("is-workbench-embedded")) return;
    const canvasScroller = elements.networkCanvas?.closest(".strategy-canvas-layout");
    if (!canvasScroller || !canvasScroller.offsetParent) return;
    const top = Math.max(0, Math.round(canvasScroller.getBoundingClientRect().top));
    document.body.style.setProperty("--hud-top", `${top}px`);
  }

  function bindNetworkCanvas() {
    if (!elements.networkCanvas) return;
    // Naast de kaart klikken of Escape breekt het verbinden af.
    elements.networkCanvas.addEventListener("click", (event) => {
      if (!linking.sourceId) return;
      if (event.target.closest(".network-node, [data-block-type]")) return;
      cancelLinking();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && linking.sourceId) cancelLinking();
      if (event.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (!elements.networkCanvas?.offsetParent || !legoFlowMap?.zoomInputDirectionV1(event)) return;
      const canvasScroller = elements.networkCanvas.closest(".strategy-canvas-layout");
      if (!canvasScroller) return;
      event.preventDefault();
      zoomNetworkCanvas(event, {
        x: canvasScroller.clientWidth / 2,
        y: canvasScroller.clientHeight / 2
      });
    });
    const canvasScroller = elements.networkCanvas.closest(".strategy-canvas-layout");
    if (canvasScroller) {
      // SimCity-model: één scroller; het handje verschuift altijd deze scroller.
      let panState = null;
      const stopPan = () => {
        if (!panState) return;
        canvasScroller.classList.remove("is-panning");
        document.body.classList.remove("is-panning");
        panState = null;
      };
      canvasScroller.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        // [data-block-type] = de lijnen en hun markeringen. Zonder deze uitzondering start
        // een klik op een lijn het verschuiven van de kaart: die roept preventDefault aan
        // en legt de pointer vast op de scroller, waardoor het klikevent de lijn nooit bereikt.
        if (event.target.closest("button, input, select, textarea, a, details, summary, [draggable='true'], .network-node, [data-block-type], .edge-mark, .object-toolbox, .canvas-inspector, .canvas-report-drawer, .advisor-panel")) return;
        panState = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: canvasScroller.scrollLeft,
          top: canvasScroller.scrollTop
        };
        try { canvasScroller.setPointerCapture(event.pointerId); } catch { /* geen capture beschikbaar */ }
        canvasScroller.classList.add("is-panning");
        document.body.classList.add("is-panning");
        event.preventDefault();
      });
      canvasScroller.addEventListener("pointermove", (event) => {
        if (!panState || event.pointerId !== panState.pointerId) return;
        const offset = legoFlowMap.panScrollOffsetV1(
          { left: panState.left, top: panState.top },
          { x: panState.x, y: panState.y },
          event
        );
        canvasScroller.scrollLeft = offset.x;
        canvasScroller.scrollTop = offset.y;
      });
      canvasScroller.addEventListener("pointerup", stopPan);
      canvasScroller.addEventListener("pointercancel", stopPan);
      canvasScroller.addEventListener("lostpointercapture", stopPan);
      canvasScroller.addEventListener("wheel", (event) => {
        if (event.target?.closest?.("input, textarea, select")) return;
        if (!legoFlowMap?.zoomInputDirectionV1(event)) return;
        const rect = canvasScroller.getBoundingClientRect();
        event.preventDefault();
        zoomNetworkCanvas(event, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }, { passive: false });
      updateHudAnchor();
    }
    document.querySelectorAll("[data-object-preset]").forEach((button) => {
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/leerpret-object", button.dataset.objectPreset);
      });
      button.addEventListener("dblclick", () => addPresetObject(button.dataset.objectPreset));
    });
    elements.networkCanvas.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes("text/leerpret-object") ? "copy" : "move";
      elements.networkCanvas.classList.add("is-drop-target");
    });
    elements.networkCanvas.addEventListener("dragleave", () => elements.networkCanvas.classList.remove("is-drop-target"));
    elements.networkCanvas.addEventListener("drop", (event) => {
      event.preventDefault();
      elements.networkCanvas.classList.remove("is-drop-target");
      const preset = event.dataTransfer.getData("text/leerpret-object");
      if (!preset) return;
      const bounds = elements.networkNodes?.getBoundingClientRect() || elements.networkCanvas.getBoundingClientRect();
      const position = legoFlowMap.clientPointToLayerV1(event, bounds, { scale: canvasZoom });
      addPresetObject(preset, position.x, position.y);
    });
    window.addEventListener("resize", () => renderNetworkCanvas(state.capture));
  }

  function applyNetworkCanvasScale(sceneLayout = networkCanvasSceneLayout) {
    const layout = elements.networkCanvas?.closest(".strategy-canvas-layout");
    if (!layout || !sceneLayout || !legoFlowMap) return;
    const scaled = legoFlowMap.scaleScreenSceneV1(sceneLayout, canvasZoom);
    layout.dataset.canvasZoom = String(scaled.scale);
    layout.style.setProperty("--canvas-zoom", String(scaled.scale));
    layout.style.setProperty("--dynamic-canvas-offset-x", `${scaled.offsetX}px`);
    layout.style.setProperty("--dynamic-canvas-offset-y", `${scaled.offsetY}px`);
    layout.style.setProperty("--dynamic-canvas-width", `${scaled.dynamicCanvasWidth}px`);
    layout.style.setProperty("--dynamic-canvas-height", `${scaled.dynamicCanvasHeight}px`);
    layout.style.setProperty("--dynamic-content-width", `${scaled.contentWidth}px`);
    layout.style.setProperty("--dynamic-content-height", `${scaled.contentHeight}px`);
    [elements.networkNodes, elements.networkEdges].forEach((layer) => {
      if (!layer) return;
      layer.style.transform = `scale(${scaled.scale})`;
      layer.style.transformOrigin = "0 0";
      layer.style.willChange = "transform";
    });
    elements.networkCanvas.setAttribute("aria-label", `Leerbox-netwerkcanvas, zoom ${Math.round(scaled.scale * 100)} procent; sleep bouwstenen hierheen`);
  }

  function zoomNetworkCanvas(input, focus) {
    const layout = elements.networkCanvas?.closest(".strategy-canvas-layout");
    if (!layout || !networkCanvasSceneLayout || !legoFlowMap) return false;
    const result = legoFlowMap.zoomViewportV1({
      scale: canvasZoom,
      input,
      scroll: { left: layout.scrollLeft, top: layout.scrollTop },
      viewport: { width: layout.clientWidth, height: layout.clientHeight },
      focus
    });
    if (!result.direction) return false;
    canvasZoom = result.scale;
    applyNetworkCanvasScale();
    layout.scrollLeft = result.scroll.x;
    layout.scrollTop = result.scroll.y;
    return result.changed;
  }

  function addPresetObject(preset, x, y) {
    const definitions = {
      entry: { label: "Startobject", role: "entry", object_type: "instruction_card", affordance: "look", visible_cues: "Start hier" },
      success: { label: "Succesobject", role: "success", object_type: "reward_artifact", affordance: "collect", feedback_type: "visual", visible_cues: "Resultaat behaald" },
      resistance: { label: "Weerstandsobject", role: "resistance", object_type: "barrier_mechanism", affordance: "retry", barrier_type: "conceptual_puzzle", visible_cues: "Uitdaging" },
      normal: { label: "Leerobject", role: "practice", object_type: "workspace", affordance: "choose", visible_cues: "Actie mogelijk" }
    };
    const definition = definitions[preset] || definitions.normal;
    const item = { ...newBlock("object"), ...definition };
    const baseId = slugify(definition.label).replaceAll("-", "_");
    const ids = new Set(state.capture.objects.map((object) => object.object_id));
    let suffix = 1;
    item.object_id = baseId;
    while (ids.has(item.object_id)) item.object_id = `${baseId}_${++suffix}`;
    const center = visibleCanvasCenter();
    if ((x == null || y == null) && !center) {
      legoFlowMapReady.then(() => {
        if (legoFlowMap) addPresetObject(preset, x, y);
      });
      return;
    }
    item.editor_position = {
      x: Math.round(x ?? center.x),
      y: Math.round(y ?? center.y)
    };
    state.capture.objects.push(item);
    persistAndRender();
    centerObjectInCanvas(item.object_id);
  }

  function addLibraryObject(declaration, x, y) {
    const libraryId = String(declaration?.libraryId || "").trim();
    const allowedKinds = new Set(["element", "logistics-object", "leerobject", "leerbox-bouwsteen", "minifig"]);
    const libraryKind = String(declaration?.libraryKind || "").trim();
    if (!libraryId || !allowedKinds.has(libraryKind)) return;
    const role = ["entry", "success", "resistance", "practice"].includes(declaration?.role) ? declaration.role : "practice";
    const label = String(declaration?.label || libraryId).trim().slice(0, 160) || libraryId;
    const item = {
      ...newBlock("object"),
      label,
      role,
      object_type: "sdk_blok",
      affordance: "choose",
      visible_cues: label,
      library_id: libraryId,
      library_kind: libraryKind
    };
    const baseId = slugify(label).replaceAll("-", "_") || "bibliotheekblok";
    const ids = new Set(state.capture.objects.map((object) => object.object_id));
    let suffix = 1;
    item.object_id = baseId;
    while (ids.has(item.object_id)) item.object_id = `${baseId}_${++suffix}`;
    const center = visibleCanvasCenter();
    if ((x == null || y == null) && !center) {
      legoFlowMapReady.then(() => {
        if (legoFlowMap) addLibraryObject(declaration, x, y);
      });
      return;
    }
    item.editor_position = { x: Math.round(x ?? center.x), y: Math.round(y ?? center.y) };
    state.capture.objects.push(item);
    persistAndRender();
    centerObjectInCanvas(item.object_id);
  }

  /* Middelpunt van wat de gebruiker nu ziet, uitgedrukt in objectcoördinaten.
     Een nieuw object hoort daar te verschijnen, niet in het midden van de hele wereld. */
  function visibleCanvasCenter() {
    if (!legoFlowMap) return null;
    const nodesLayer = elements.networkNodes;
    const layout = elements.networkCanvas?.closest(".strategy-canvas-layout");
    return legoFlowMap.visibleLayerCenterV1({
      layerRect: nodesLayer && layout ? nodesLayer.getBoundingClientRect() : null,
      viewportRect: nodesLayer && layout ? layout.getBoundingClientRect() : null,
      fallbackRect: nodesLayer?.getBoundingClientRect() || elements.networkCanvas?.getBoundingClientRect(),
      scale: canvasZoom
    });
  }

  /* Schuift de kaart zo dat het opgegeven object midden in beeld staat. */
  function centerObjectInCanvas(objectId) {
    centerObjectsInCanvas([objectId]);
  }

  /* Zet één of meer objecten midden in beeld. Een routestap of afhankelijkheid heeft
     zelf geen plek op de kaart; die brengt de objecten in beeld die hij verbindt,
     met het midden tussen beide als middelpunt. */
  function centerObjectsInCanvas(objectIds) {
    if (!legoFlowMap) return;
    const layout = elements.networkCanvas?.closest(".strategy-canvas-layout");
    if (!layout || !elements.networkNodes) return;
    const indexes = (objectIds || [])
      .map((id) => state.capture.objects.findIndex((object) => object.object_id === id))
      .filter((index) => index >= 0);
    if (!indexes.length) return;

    window.requestAnimationFrame(() => {
      const nodes = indexes
        .map((index) => elements.networkNodes.querySelector(`.network-node[data-object-index="${index}"]`))
        .filter(Boolean);
      if (!nodes.length) return;

      const rects = nodes.map((node) => node.getBoundingClientRect());
      const viewRect = layout.getBoundingClientRect();
      const delta = legoFlowMap.centerDeltaV1(rects, viewRect);
      layout.scrollLeft += delta.x;
      layout.scrollTop += delta.y;

      nodes.forEach((node) => {
        node.classList.add("is-just-added");
        window.setTimeout(() => node.classList.remove("is-just-added"), 1400);
      });
    });
  }

  function renderNetworkCanvas(capture) {
    if (!elements.networkCanvas || !elements.networkNodes || !elements.networkEdges) return;
    const objects = capture.objects || [];
    const embeddedWorkbench = document.body.classList.contains("is-workbench-embedded");
    const layout = elements.networkCanvas.closest(".strategy-canvas-layout");
    if (embeddedWorkbench) updateHudAnchor();
    if (!legoFlowMap) {
      elements.networkEdges.innerHTML = "";
      elements.networkNodes.innerHTML = `<div class="lego-flow-sdk-status">${escapeText(legoFlowMapError || "Isometrische LEGO-kaart laden…")}</div>`;
      elements.canvasEmptyState.hidden = true;
      return;
    }
    const sceneLayout = legoFlowMap.layoutScreenSceneV1({
      positions: objects.map((object) => object.editor_position || null),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      embedded: embeddedWorkbench,
      nodesWidth: elements.networkNodes.clientWidth,
      canvasWidth: elements.networkCanvas.clientWidth,
      nodesHeight: elements.networkNodes.clientHeight,
      canvasHeight: elements.networkCanvas.clientHeight
    });
    networkCanvasSceneLayout = sceneLayout;
    const { width, height, drawnHeight } = sceneLayout;
    if (embeddedWorkbench && layout) {
      applyNetworkCanvasScale(sceneLayout);
    }
    objects.forEach((object, index) => {
      const position = sceneLayout.positions[index];
      if (!object.editor_position) {
        object.editor_position = { x: position.x, y: position.y };
      } else {
        object.editor_position.x = position.x;
        object.editor_position.y = position.y;
      }
    });
    const byId = new Map(objects.map((object) => [object.object_id, object]));

    /* Elke kabel onthoudt bij welk blok hij hoort, met de index in de oorspronkelijke
       lijst - niet in de gefilterde - zodat een klik het juiste blok opent. */
    const routeSteps = (capture.interaction_route || [])
      .map((step, index) => ({ objectId: step.object_id, stepIndex: index, editorCable: step.editor_cable }))
      .filter((step) => byId.has(step.objectId));
    const strictEdges = routeSteps.slice(1).map((step, index) => ({
      from: routeSteps[index].objectId,
      to: step.objectId,
      type: "strict",
      fromStud: step.editorCable?.from_stud,
      toStud: step.editorCable?.to_stud,
      routeIndex: index + 1,
      blockType: "step",
      blockIndex: step.stepIndex
    }));
    const conditionalEdges = (capture.freedom_and_sequence.hard_dependencies || [])
      .map((dependency, index) => ({ dependency, index }))
      .filter(({ dependency }) => byId.has(dependency.from_object_id) && byId.has(dependency.to_object_id))
      .map(({ dependency, index }) => ({
        from: dependency.from_object_id,
        to: dependency.to_object_id,
        fromStud: dependency.editor_cable?.from_stud,
        toStud: dependency.editor_cable?.to_stud,
        type: "conditional",
        blockType: "dependency",
        blockIndex: index
      }));
    const freeEdges = capture.freedom_and_sequence.route_model === "free"
      ? objects.slice(1).map((object, index) => ({ from: objects[index].object_id, to: object.object_id, type: "free" }))
      : [];
    const edges = [...freeEdges, ...strictEdges, ...conditionalEdges];
    elements.networkEdges.setAttribute("viewBox", `0 0 ${width} ${drawnHeight}`);
    const scene = legoFlowMap.renderScene({
      width,
      height: drawnHeight,
      environment: "learning-box-v1",
      objects: objects.map((object) => ({
        id: object.object_id,
        label: object.label || object.object_id,
        role: object.role,
        libraryId: object.library_id,
        libraryKind: object.library_kind,
        x: object.editor_position.x,
        y: object.editor_position.y
      })),
      edges
    });
    networkLearningBoxProfile = scene.environment;
    let snappedToGroundPlate = false;
    scene.positions.forEach((position, index) => {
      const stored = objects[index].editor_position;
      if (!stored || stored.x !== position.x || stored.y !== position.y) snappedToGroundPlate = true;
      objects[index].editor_position = { x: position.x, y: position.y };
    });
    if (snappedToGroundPlate) localStorage.setItem(storageKey, JSON.stringify(state.capture));
    elements.networkNodes.innerHTML = scene.nodesMarkup;
    elements.networkEdges.innerHTML = scene.edgesMarkup;
    elements.canvasEmptyState.hidden = objects.length > 0;

    elements.networkNodes.querySelectorAll(".network-node").forEach((node) => {
      // Eén klik verbindt, twee klikken openen. Zie handleNodeClick.
      node.addEventListener("click", (event) => {
        if (node.dataset.justDragged === "true") return;
        handleNodeClick(Number(node.dataset.objectIndex), event);
      });
      node.addEventListener("dblclick", (event) => {
        event.preventDefault();
        cancelLinking();
        openBlockDialog("object", Number(node.dataset.objectIndex));
      });
      node.addEventListener("pointerdown", startNodeDrag);
    });

    cableController = legoFlowMap.wireStudConnections({
      nodesRoot: elements.networkNodes,
      edgesRoot: elements.networkEdges,
      getScale: () => canvasZoom,
      connectionMode,
      onConnect: ({ fromObjectId, fromStud, toObjectId, toStud, edgeType }) => {
        createConnection(fromObjectId, toObjectId, edgeType, { from_stud: fromStud, to_stud: toStud });
      }
    });
    if (cableModeRequested) cableController?.activate();

    // Klikken op een lijn opent de routestap of de voorwaarde die erachter zit.
    elements.networkEdges.querySelectorAll("[data-block-type]").forEach((edge) => {
      edge.addEventListener("click", (event) => {
        event.stopPropagation();
        cancelLinking();
        openBlockDialog(edge.dataset.blockType, Number(edge.dataset.blockIndex));
      });
    });

    if (linking.sourceId) markLinkingSource();
    // Reset bij leerboxwissel of paginarefresh: sliders exact in het midden = midden van de tekening in beeld.
    const centerSignature = String(getByPath(capture, "metadata.leerbox_id") || "unknown");
    if (embeddedWorkbench && layout && layout.clientWidth > 0 && centerSignature !== networkCanvasCenteredSignature) {
      networkCanvasCenteredSignature = centerSignature;
      centerCanvasOnDrawing();
    }
  }

  /* Zet de kaart terug op het midden van de tekening. Dit is dezelfde beweging als bij
     een leerboxwissel of een refresh, nu ook met de hand op te roepen: na veel slepen
     is het midden van de leerobjecten anders niet meer terug te vinden. */
  function centerCanvasOnDrawing() {
    if (!legoFlowMap) return;
    const layout = elements.networkCanvas?.closest(".strategy-canvas-layout");
    if (!layout || layout.clientWidth === 0) return;
    window.requestAnimationFrame(() => {
      const offset = legoFlowMap.centeredScrollOffsetV1(
        { width: layout.scrollWidth, height: layout.scrollHeight },
        { width: layout.clientWidth, height: layout.clientHeight }
      );
      layout.scrollLeft = offset.x;
      layout.scrollTop = offset.y;
    });
  }


  function objectIdByIndex(index) {
    return state.capture.objects[index]?.object_id || null;
  }

  function handleNodeClick(index, event) {
    const objectId = objectIdByIndex(index);
    if (!objectId) return;
    event.stopPropagation();

    if (!linking.sourceId) {
      linking.sourceId = objectId;
      markLinkingSource();
      startRubberBand();
      return;
    }

    if (linking.sourceId === objectId) {
      cancelLinking();
      return;
    }

    createConnection(linking.sourceId, objectId, connectionMode === "conditional" ? "conditional" : "strict");
    cancelLinking();
  }

  function markLinkingSource() {
    elements.networkNodes?.querySelectorAll(".network-node").forEach((node) => {
      const isSource = objectIdByIndex(Number(node.dataset.objectIndex)) === linking.sourceId;
      node.classList.toggle("is-linking", isSource);
    });
    elements.networkCanvas?.classList.toggle("is-linking", Boolean(linking.sourceId));
  }

  function startRubberBand() {
    const source = state.capture.objects.find((object) => object.object_id === linking.sourceId);
    if (!source || !elements.networkEdges) return;
    let band = elements.networkEdges.querySelector("#rubberBand");
    if (!band) {
      band = document.createElementNS("http://www.w3.org/2000/svg", "path");
      band.setAttribute("id", "rubberBand");
      band.setAttribute("class", "network-edge edge-rubber");
      elements.networkEdges.appendChild(band);
    }
    const move = (moveEvent) => {
      const layerRect = elements.networkNodes.getBoundingClientRect();
      const pointer = legoFlowMap.clientPointToLayerV1(moveEvent, layerRect, { scale: canvasZoom });
      const sourcePoint = legoFlowMap.studConnectionPoint({
        x: source.editor_position.x,
        y: source.editor_position.y
      });
      band.setAttribute("d", legoFlowMap
        ? legoFlowMap.previewCablePath(sourcePoint, [pointer.x, pointer.y])
        : "");
    };
    linking.move = move;
    document.addEventListener("pointermove", move);
  }

  function cancelLinking() {
    if (linking.move) {
      document.removeEventListener("pointermove", linking.move);
      linking.move = null;
    }
    elements.networkEdges?.querySelector("#rubberBand")?.remove();
    linking.sourceId = null;
    markLinkingSource();
  }

  function createDependency(fromObjectId, toObjectId, cable = null) {
    const dependencies = state.capture.freedom_and_sequence.hard_dependencies;
    const bestaat = dependencies.some((dependency) =>
      dependency.from_object_id === fromObjectId && dependency.to_object_id === toObjectId);
    if (bestaat) return;
    dependencies.push({
      ...newBlock("dependency"),
      from_object_id: fromObjectId,
      to_object_id: toObjectId,
      ...(cable ? { editor_cable: cable } : {})
    });
    persistAndRender();
  }

  function createRouteConnection(fromObjectId, toObjectId, cable = null) {
    const route = state.capture.interaction_route;
    let fromIndex = route.findIndex((step) => step.object_id === fromObjectId);
    let toIndex = route.findIndex((step) => step.object_id === toObjectId);

    if (fromIndex < 0) {
      route.push({ ...newBlock("step"), object_id: fromObjectId });
      fromIndex = route.length - 1;
    }

    if (toIndex === fromIndex + 1) {
      if (cable) route[toIndex].editor_cable = cable;
      persistAndRender();
      return;
    }

    let targetStep;
    if (toIndex >= 0) {
      [targetStep] = route.splice(toIndex, 1);
      if (toIndex < fromIndex) fromIndex -= 1;
    } else {
      targetStep = { ...newBlock("step"), object_id: toObjectId };
    }
    targetStep.object_id = toObjectId;
    if (cable) targetStep.editor_cable = cable;
    route.splice(fromIndex + 1, 0, targetStep);
    renumberSteps();
    persistAndRender();
  }

  function createConnection(fromObjectId, toObjectId, edgeType, cable = null) {
    if (edgeType === "conditional") createDependency(fromObjectId, toObjectId, cable);
    else createRouteConnection(fromObjectId, toObjectId, cable);
  }

  function startNodeDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest?.("[data-flow-stud]")) return;
    const node = event.currentTarget;
    const index = Number(node.dataset.objectIndex);
    const object = state.capture.objects[index];
    const canvasLayer = elements.networkNodes || elements.networkCanvas;
    const start = { x: event.clientX, y: event.clientY, left: object.editor_position.x, top: object.editor_position.y };
    let moved = false;
    node.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const drag = legoFlowMap.dragScreenPositionV1({
        pointerStart: { x: start.x, y: start.y },
        pointerCurrent: moveEvent,
        positionStart: { left: start.left, top: start.top },
        bounds: { width: canvasLayer.clientWidth, height: canvasLayer.clientHeight },
        scale: canvasZoom,
        threshold: 5
      });
      const fixed = networkLearningBoxProfile
        ? legoFlowMap.learningBoxStudPositionV1(drag.position, networkLearningBoxProfile, {
            libraryId: object.library_id
          })
        : drag.position;
      if (drag.moved) moved = true;
      object.editor_position.x = fixed.x;
      object.editor_position.y = fixed.y;
      legoFlowMap.updateDragFrame({
        node,
        nodesRoot: elements.networkNodes,
        edgesRoot: elements.networkEdges,
        objectId: object.object_id,
        x: object.editor_position.x,
        y: object.editor_position.y
      });
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      if (moved) {
        node.dataset.justDragged = "true";
        window.setTimeout(() => delete node.dataset.justDragged, 0);
        localStorage.setItem(storageKey, JSON.stringify(state.capture));
        publishCaptureUpdate();
        renderNetworkCanvas(state.capture);
      }
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
  }


  function emptyText(type) {
    if (type === "object") {
      return t("empty.object");
    }
    if (type === "step") {
      return t("empty.step");
    }
    return t("empty.dependency");
  }

  function blockHtml(type, item, index, validation = null) {
    if (type === "object") {
      const warning = validation?.object_warnings?.[item.object_id];
      return `
        <button class="block-card object${warning ? " validation-warning" : ""}" type="button" data-index="${index}">
          <strong>${escapeText(item.label || item.object_id || t("block.newObject"))}</strong>
          <span>${escapeText(item.affordance || item.visible_cues || t("block.noAffordance"))}</span>
          <div class="chip-row">
            <span class="chip">${escapeText(enumLabel(item.role || unknown))}</span>
            <span class="chip">${escapeText(item.object_id || unknown)}</span>
            ${warning ? `<span class="chip">${escapeText(warning)}</span>` : ""}
          </div>
        </button>`;
    }

    if (type === "step") {
      return `
        <button class="block-card step" type="button" data-index="${index}" data-step="${index + 1}">
          <strong>${escapeText(item.participant_action || t("block.newStep"))}</strong>
          <span>${escapeText(item.expected_feedback || t("block.noFeedback"))}</span>
          <div class="chip-row">
            <span class="chip">${escapeText(item.object_id || unknown)}</span>
            <span class="chip">${escapeText(item.action_type || unknown)}</span>
          </div>
        </button>`;
    }

    return `
      <button class="block-card dependency" type="button" data-index="${index}">
        <strong>${escapeText(item.from_object_id || unknown)} -> ${escapeText(item.to_object_id || unknown)}</strong>
        <span>${escapeText(item.reason || t("block.noReason"))}</span>
        <div class="chip-row">
          <span class="chip">${escapeText(enumLabel(item.dependency_type || unknown))}</span>
        </div>
      </button>`;
  }

  function syncDerivedCapture(capture) {
    capture.raw_user_description = capture.raw_user_description || "";
    syncPathRolesFromObjects(capture);
    capture.fallback_latex_description = {
      format: "latex",
      source_style: "user_fallback",
      body: buildLatexDocument(capture)
    };
    capture.computertaal_statements = {
      rationale: jargonRationale,
      full_architecture: buildFullArchitectureStatements(capture),
      captured_learning_box: buildCapturedLearningBoxStatements(capture)
    };
  }

  function syncPathRolesFromObjects(capture) {
    const roleIds = pathRoleIds(capture);
    const requirements = capture.leerbox_design.path_role_requirements;
    if (roleIds.entry.length) {
      requirements.entry_object_id = roleIds.entry[0];
    }
    if (roleIds.resistance.length) {
      requirements.resistance_object_ids = roleIds.resistance;
    }
    if (roleIds.success.length) {
      requirements.success_object_ids = roleIds.success;
    }
    if (roleIds.exit.length) {
      requirements.exit_object_id = roleIds.exit[0];
    }
  }

  function pathRoleIds(capture) {
    const requirements = capture.leerbox_design.path_role_requirements || {};
    const objects = capture.objects || [];
    return {
      entry: unique([
        ...objects.filter((object) => ["entry", "start"].includes(object.role)).map((object) => object.object_id),
        requirements.entry_object_id
      ]),
      resistance: unique([
        ...objects.filter((object) => ["resistance", "barrier"].includes(object.role)).map((object) => object.object_id),
        ...(requirements.resistance_object_ids || [])
      ]),
      success: unique([
        ...objects.filter((object) => object.role === "success").map((object) => object.object_id),
        ...(requirements.success_object_ids || [])
      ]),
      exit: unique([
        ...objects.filter((object) => object.role === "exit").map((object) => object.object_id),
        requirements.exit_object_id
      ])
    };
  }

  function validateCapturedLearningBox(capture) {
    const ids = pathRoleIds(capture);
    const objectTypes = unique((capture.objects || []).map((object) => object.object_type || object.role));
    const actionTypes = unique((capture.interaction_route || []).map((step) => step.action_type));
    const missing = [];
    const objectWarnings = {};

    if (ids.entry.length !== 1) {
      missing.push(ids.entry.length > 1 ? "meer dan een Begin-object" : "geen duidelijk Begin-object");
      ids.entry.forEach((id) => {
        objectWarnings[id] = "Begin-object dubbel";
      });
    }
    if (ids.exit.length < 1) {
      missing.push("geen Eind-object");
    }
    if (!ids.resistance.length) {
      missing.push("geen adequaat weerstandsobject");
    }
    if (!ids.success.length) {
      missing.push("succesobject ontbreekt");
    }
    if (ids.exit.some((id) => ids.success.includes(id))) {
      missing.push("Eind-object mag niet hetzelfde zijn als succesobject");
      ids.exit.forEach((id) => {
        if (ids.success.includes(id)) objectWarnings[id] = "Eind en succes gemengd";
      });
    }
    if (ids.exit.some((id) => ids.resistance.includes(id))) {
      missing.push("Eind-object mag niet hetzelfde zijn als weerstandsobject");
      ids.exit.forEach((id) => {
        if (ids.resistance.includes(id)) objectWarnings[id] = "Eind en weerstand gemengd";
      });
    }
    if ((capture.objects || []).length < 3 || objectTypes.length < 3 || actionTypes.length < 2) {
      missing.push("te weinig variatie in leerobjecten of acties");
    }
    if (!(capture.interaction_route || []).length) {
      missing.push("geen route voor gesimuleerde datastroom");
    }

    return {
      is_valid: missing.length === 0,
      missing,
      ids,
      object_warnings: objectWarnings,
      summary: {
        object_count: (capture.objects || []).length,
        object_type_count: objectTypes.length,
        action_type_count: actionTypes.length,
        dependency_count: (capture.freedom_and_sequence.hard_dependencies || []).length
      }
    };
  }

  function renderSynchronousViews(capture, validation) {
    renderLatexPreview(capture);
    renderArchitectureDiagram(capture, validation);
    elements.fullStatementsOutput.value = (capture.computertaal_statements.full_architecture || []).join("\n");
    elements.vatStatementsOutput.value = (capture.computertaal_statements.captured_learning_box || []).join("\n");
  }

  function renderLatexPreview(capture) {
    const plan = buildEnrichmentPlan(capture);
    elements.latexPreview.innerHTML = `
      <article class="enrichment-plan">
        <header>
          <span>Verrijkingsplan · bestaande leerattractie</span>
          <h3>${escapeText(plan.title)}</h3>
          <p>${escapeText(plan.introduction)}</p>
        </header>
        <section>
          <h4>Werkwijze en rol van de Leerpretarchitect</h4>
          <p>${escapeText(plan.architectRole)}</p>
          <ol>${plan.transformationSteps.map((step) => `<li>${escapeText(step)}</li>`).join("")}</ol>
        </section>
        <section>
          <h4>Herkende onderwijsarchitectuur</h4>
          <p>Dit is wat in de huidige leerattractie en de beschikbare bronnen is herkend.</p>
          <div class="plan-recognized-grid">
            ${plan.recognizedSections.map((section) => `
              <article>
                <h5>${escapeText(section.title)}</h5>
                <dl>${section.entries.map((entry) => `<div><dt>${escapeText(entry.label)}</dt><dd>${escapeText(entry.value)}</dd></div>`).join("")}</dl>
              </article>`).join("") || "<p>Nog onvoldoende onderwijsarchitectuur herkend.</p>"}
          </div>
        </section>
        <section>
          <h4>Bronvermelding</h4>
          <p>Voor dit plan beschikbare en in de capture geregistreerde bronnen:</p>
          <ul>${plan.sources.map((source) => `<li>${escapeText(source)}</li>`).join("") || "<li>Nog geen bron geregistreerd.</li>"}</ul>
        </section>
        <section>
          <h4>Voorgestelde verrijkingen</h4>
          <p>Deze onderdelen zijn nog niet aanwezig. De Leerpretarchitect beoordeelt, concretiseert en accordeert iedere verrijking.</p>
          <div class="plan-enrichment-list">
            ${plan.enrichments.map((item, index) => `
              <article>
                <span>${index + 1}</span>
                <div><h5>${escapeText(item.title)}</h5><p>${escapeText(item.proposal)}</p></div>
                <aside><b>${escapeText(item.markers.join(" · "))}</b><small>${escapeText(item.effect)}</small></aside>
              </article>`).join("") || "<p>De beschreven architectuur bevat op dit moment geen standaardverrijkingen die nog ontbreken.</p>"}
          </div>
        </section>
        <section class="plan-impact-summary">
          <h4>Verwacht effect op Leerpret</h4>
          <p>${escapeText(plan.impactSummary)}</p>
          <small>${escapeText(plan.measurementCaveat)}</small>
        </section>
      </article>
    `;
  }

  function planDisplayValue(value) {
    if (isEmptyCaptureValue(value)) return "";
    if (Array.isArray(value)) return value.map((item) => enumLabel(item)).join(", ");
    return String(value);
  }

  function buildEnrichmentPlan(capture) {
    const entry = (label, value) => ({ label, value: planDisplayValue(value) });
    const section = (title, entries) => ({
      title,
      entries: entries.filter((item) => item.value)
    });
    const recognizedSections = [
      section("Identiteit en context", [
        entry("Naam", capture.metadata?.work_name),
        entry("Domein", capture.metadata?.domain),
        entry("Samenvatting", capture.metadata?.summary),
        entry("Type leerbox", capture.metadata?.type),
        entry("Sociale setting", capture.participants?.social_setting)
      ]),
      section("Missie, visie en strategie", [
        entry("Missie", capture.strategic_frame?.mission),
        entry("Visie", capture.strategic_frame?.vision),
        entry("Strategie", capture.strategic_frame?.strategy),
        entry("Doelen", capture.strategic_frame?.goals),
        entry("Onderwijsfase", capture.strategic_frame?.education_phase),
        entry("Type leerattractie", capture.leerbox_design?.attraction_type)
      ]),
      section("Pedagogische kern", [
        entry("Centraal leerdoel", capture.pedagogical_core?.central_learning_goal),
        entry("Centrale ontdekking", capture.pedagogical_core?.central_discovery),
        entry("Succesdefinitie", capture.pedagogical_core?.success_definition),
        entry("Doelgroep", capture.participants?.primary_target_group),
        entry("Voorkennis", capture.participants?.prior_knowledge)
      ]),
      section("Ervaring, start en route", [
        entry("Spelvorm", capture.play_characteristics?.recognizable_play_form),
        entry("Eerste zichtbare actie", capture.entry_and_orientation?.first_visible_action),
        entry("Startinstructie", capture.entry_and_orientation?.minimal_start_instruction),
        entry("Routemodel", capture.freedom_and_sequence?.route_model),
        entry("Vrijheidsprincipe", capture.freedom_and_sequence?.freedom_principle),
        entry("Hoofdbarrière", capture.barriers_and_recovery?.main_barrier)
      ]),
      section("Gevatte structuur", [
        entry("Leerobjecten", `${(capture.objects || []).length}`),
        entry("Routestappen", `${(capture.interaction_route || []).length}`),
        entry("Afhankelijkheden", `${(capture.freedom_and_sequence?.hard_dependencies || []).length}`),
        entry("Leerwijzen", capture.leerbox_design?.learning_modes),
        entry("Leerbox-principes", capture.leerbox_design?.leerbox_principles)
      ]),
      section("Herkenbare Leerpret-markers", Object.entries(capture.measurement?.marker_mapping || {})
        .map(([marker, value]) => entry(marker, value)))
    ].filter((item) => item.entries.length);

    const sources = unique([
      ...(capture.leerbox_design?.source_basis || []),
      ...(capture.source_integrity?.explicitly_stated_by_user || []),
      ...state.bucket_sources.map((source) => source.name || source.url || source.path || source.id)
    ]);

    const enrichmentDefinitions = [
      {
        path: "pedagogical_core.central_learning_goal",
        title: "Leerdoel expliciteren",
        proposal: "Formuleer het beoogde leren als waarneembare verandering, zodat keuzes en succes eraan getoetst kunnen worden.",
        markers: ["A", "S"],
        effect: "Meer gerichte activiteit en beter herkenbaar succes."
      },
      {
        path: "entry_and_orientation.first_visible_action",
        title: "Directe eerste actie ontwerpen",
        proposal: "Laat de deelnemer beginnen met een concrete, zichtbare handeling in plaats van met uitleg.",
        markers: ["T", "A"],
        effect: "Kortere aanlooptijd en sneller actief gedrag."
      },
      {
        path: "entry_and_orientation.self_starting_signal",
        title: "Self-starting signaal toevoegen",
        proposal: "Maak zonder begeleiding duidelijk waar en hoe iemand zelfstandig kan beginnen.",
        markers: ["T", "A"],
        effect: "Minder stilstand en een hogere activatiekans."
      },
      {
        path: "entry_and_orientation.proactive_invitation",
        title: "Proactieve uitnodiging zichtbaar maken",
        proposal: "Laat materiaal, interface of begeleider de deelnemer herkenbaar tot handelen uitnodigen.",
        markers: ["A"],
        effect: "Meer concrete en meetbare acties."
      },
      {
        path: "play_characteristics.recognizable_play_form",
        title: "Herkenbaar spel- of handelingskader kiezen",
        proposal: "Geef de ervaring een herkenbaar kader met doel, speelruimte en betekenisvolle handelingen.",
        markers: ["A", "V"],
        effect: "Meer betrokken actie en variatie in aanpak."
      },
      {
        path: "play_characteristics.direct_feedback_loop",
        title: "Directe feedbacklus toevoegen",
        proposal: "Maak na iedere betekenisvolle actie zichtbaar wat veranderde en welke mogelijkheden nu ontstaan.",
        markers: ["A", "R", "S"],
        effect: "Acties worden begrijpelijker, herstelbaarder en succes wordt zichtbaarder."
      },
      {
        path: "freedom_and_sequence.freedom_principle",
        title: "Keuzevrijheid expliciteren",
        proposal: "Bepaal waar de deelnemer route, tempo, rol of aanpak werkelijk zelf kan kiezen.",
        markers: ["V", "R"],
        effect: "Meer routevariatie en ruimte om na frictie anders verder te gaan."
      },
      {
        path: "barriers_and_recovery.main_barrier",
        title: "Productieve weerstand ontwerpen",
        proposal: "Benoem de kernbarrière die denken of proberen uitlokt zonder de deelnemer definitief te blokkeren.",
        markers: ["R", "A"],
        effect: "Meer betekenisvolle pogingen en zichtbaar herstelgedrag."
      },
      {
        path: "barriers_and_recovery.recovery_options",
        title: "Herstelmogelijkheden aanbieden",
        proposal: "Ontwerp meerdere veilige manieren om na een mislukking opnieuw of anders verder te gaan.",
        markers: ["R", "V"],
        effect: "Sterkere veerkracht en meer variatie na tegenslag."
      },
      {
        path: "pedagogical_core.success_definition",
        title: "Succes observeerbaar maken",
        proposal: "Definieer welk resultaat of gedrag ondubbelzinnig laat zien dat de leerervaring geslaagd is.",
        markers: ["S"],
        effect: "Een duidelijker en meetbaar succesmoment."
      },
      {
        path: "measurement.event_contract.example_action_types",
        title: "Meetbare acties vastleggen",
        proposal: "Vertaal de kernhandelingen naar een klein vocabulaire van observeerbare actietypen.",
        markers: ["T", "A", "V", "R", "S"],
        effect: "De verwachte Leerpret-impact wordt toetsbaar met echte actiereeksen."
      }
    ];
    const enrichments = enrichmentDefinitions.filter((item) => isEmptyCaptureValue(getByPath(capture, item.path)));
    const coveredMarkers = Object.entries(capture.measurement?.marker_mapping || {})
      .filter(([, value]) => !isEmptyCaptureValue(value))
      .map(([marker]) => marker);
    const affectedMarkers = unique(enrichments.flatMap((item) => item.markers));
    const impactDirection = affectedMarkers.length
      ? `De voorgestelde verrijkingen richten zich vooral op ${affectedMarkers.join(", ")}.`
      : "De vijf Leerpret-markers zijn inhoudelijk beschreven; de volgende stap is empirisch toetsen.";

    return {
      title: capture.metadata?.work_name && !isUnknown(capture.metadata.work_name)
        ? `Van ${capture.metadata.work_name} naar een gevatte leerbox`
        : "Van bestaande leerattractie naar een gevatte leerbox",
      introduction: "We willen de bestaande leerattractie vatten in een leerbox. Dat betekent dat we de aanwezige onderwijsarchitectuur eerst herkenbaar vastleggen en haar daarna doelgericht verrijken met handelingsmogelijkheden, feedback, vrijheid, herstel en observeerbaar succes.",
      architectRole: "De Leerpretarchitect bewaakt de bedoeling van de bestaande praktijk, controleert of de herkenning klopt, kiest welke verrijkingen passend zijn en voorkomt dat techniek of spelvorm het leerdoel overneemt. De architect accordeert dus zowel de vertaling als de verwachte bijdrage aan Leerpret.",
      transformationSteps: [
        "Herkennen: beschrijven wat al aanwezig is in bedoeling, doelgroep, start, route, weerstand en succes.",
        "Herleiden: verbinden van bronuitspraken aan velden in de onderwijsarchitectuur.",
        "Vatten: vertalen naar leerobjecten, acties, routes, afhankelijkheden en meetbare succesmomenten.",
        "Verrijken: toevoegen wat nog ontbreekt voor tijd, activiteit, variatie, veerkracht en succes.",
        "Toetsen: observeren van echte actiereeksen en vergelijken van de gemeten Leerpret met de verwachting."
      ],
      recognizedSections,
      sources,
      enrichments,
      impactSummary: `${coveredMarkers.length}/5 Leerpret-markers zijn momenteel inhoudelijk onderbouwd. ${impactDirection}`,
      measurementCaveat: "De pijlen beschrijven een verwachte richting, geen gegarandeerde numerieke stijging. De werkelijke Leerpret-waarde ontstaat pas uit gemeten actiereeksen en kan na een simulatietest worden vergeleken."
    };
  }

  function renderArchitectureDiagram(capture, validation) {
    /* Alleen de rolkoppelingen van leerobjecten: leerdoel, doelgroep, start, spelkader,
       vrijheid en succes hebben inmiddels hun eigen venster in het menu. */
    const cards = [
      ["⚑", "Startobject", "leerbox_design.path_role_requirements.entry_object_id", validation.ids.entry.join(", ") || unknown, "input"],
      ["🧗", "Weerstandsobjecten", "leerbox_design.path_role_requirements.resistance_object_ids", validation.ids.resistance.join("\n") || unknown, "list"],
      ["🏆", "Succesobjecten", "leerbox_design.path_role_requirements.success_object_ids", validation.ids.success.join("\n") || unknown, "list"],
      ["◆", "Eindobject", "leerbox_design.path_role_requirements.exit_object_id", validation.ids.exit.join(", ") || unknown, "input"]
    ];
    elements.architectureDiagram.innerHTML = cards
      .map(
        ([icon, label, path, value, type]) => `
          <article class="architecture-card">
            <strong><span aria-hidden="true">${icon}</span>${escapeText(label)}</strong>
            ${architectureEditorField(path, value, type)}
          </article>
        `
      )
      .join("");
  }

  function architectureEditorField(path, value, type) {
    const escaped = escapeText(isUnknown(value) ? "" : value);
    if (type === "textarea" || type === "list") {
      return `<textarea data-architecture-path="${escapeText(path)}" ${type === "list" ? "data-list" : ""} rows="3">${escaped}</textarea>`;
    }
    return `<input data-architecture-path="${escapeText(path)}" value="${escaped}" autocomplete="off">`;
  }

  function renderValidation(validation) {
    elements.validationPanel.classList.toggle("is-valid", validation.is_valid);
    elements.validationPanel.classList.toggle("is-invalid", !validation.is_valid);
    elements.validationStatus.textContent = validation.is_valid ? "Valide" : "Incompleet";
    elements.validationSummary.textContent = validation.is_valid
      ? "De gevatte leerbox voldoet aan de minimale eisen."
      : "Simulatie blijft uitgeschakeld totdat de gevatte leerbox sluitend is.";
    elements.validationList.innerHTML = validation.is_valid
      ? "<li>Simulatie actief</li>"
      : validation.missing.map((item) => `<li>${escapeText(item)}</li>`).join("");
    elements.simulateButton.disabled = !validation.is_valid;
    elements.simulateButton.textContent = validation.is_valid ? "Simuleer Leerpret" : "Niet gevat";
    elements.simulateButton.title = validation.is_valid
      ? "Start de AI-simulatie."
      : "Los eerst de rode configuratiefouten op; alleen AI-simulatie vereist een gevatte leerbox.";
    elements.runTestButton.disabled = !state.imported_test_data.is_valid;
  }

  function buildLatexDocument(capture) {
    const plan = buildEnrichmentPlan(capture);
    const itemize = (items) => [
      "\\begin{itemize}",
      ...items.map((item) => `\\item ${latexEscape(item)}`),
      "\\end{itemize}"
    ];
    return [
      "\\documentclass{article}",
      "\\usepackage[dutch]{babel}",
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[margin=2.4cm]{geometry}",
      "\\usepackage{xcolor}",
      "\\definecolor{leerpret}{HTML}{167C72}",
      "\\begin{document}",
      `\\section*{${latexEscape(plan.title)}}`,
      "\\textbf{Verrijkingsplan voor een bestaande leerattractie}",
      latexEscape(plan.introduction),
      "\\subsection*{Werkwijze en rol van de Leerpretarchitect}",
      latexEscape(plan.architectRole),
      "\\subsubsection*{Van onderwijsarchitectuur naar leerbox}",
      ...itemize(plan.transformationSteps),
      "\\subsection*{Herkende onderwijsarchitectuur}",
      "Dit is wat in de huidige leerattractie en de beschikbare bronnen is herkend.",
      ...plan.recognizedSections.flatMap((section) => [
        `\\subsubsection*{${latexEscape(section.title)}}`,
        ...itemize(section.entries.map((entry) => `${entry.label}: ${entry.value}`))
      ]),
      "\\subsection*{Bronvermelding}",
      "Voor dit plan beschikbare en in de capture geregistreerde bronnen:",
      ...itemize(plan.sources.length ? plan.sources : ["Nog geen bron geregistreerd."]),
      "\\subsection*{Voorgestelde verrijkingen}",
      "Deze onderdelen zijn nog niet aanwezig. De Leerpretarchitect beoordeelt, concretiseert en accordeert iedere verrijking.",
      ...(plan.enrichments.length
        ? plan.enrichments.flatMap((item, index) => [
            `\\subsubsection*{${index + 1}. ${latexEscape(item.title)}}`,
            latexEscape(item.proposal),
            `\\textbf{Verwachte invloed: ${latexEscape(item.markers.join(", "))}.} ${latexEscape(item.effect)}`
          ])
        : ["Er ontbreken op dit moment geen standaardverrijkingen."]),
      "\\subsection*{Verwacht effect op Leerpret}",
      latexEscape(plan.impactSummary),
      `\\textit{${latexEscape(plan.measurementCaveat)}}`,
      "\\end{document}"
    ].join("\n\n");
  }

  function buildFullArchitectureStatements(capture) {
    return [
      statementLine("ARCHITECTURE", capture.metadata.leerbox_id, "HAS_NAME", capture.metadata.work_name),
      statementLine("ARCHITECTURE", capture.metadata.leerbox_id, "HAS_GOAL", capture.pedagogical_core.central_learning_goal),
      statementLine("ARCHITECTURE", capture.metadata.leerbox_id, "FOR_TARGET_GROUP", capture.participants.primary_target_group),
      statementLine("ARCHITECTURE", capture.metadata.leerbox_id, "USES_PLAY_FORM", capture.play_characteristics.recognizable_play_form),
      statementLine("ARCHITECTURE", capture.metadata.leerbox_id, "HAS_ROUTE_MODEL", capture.freedom_and_sequence.route_model),
      ...(capture.objects || []).map((object) =>
        statementLine("OBJECT", object.object_id, "ROLE", `${object.role}; TYPE ${object.object_type}; AFFORDANCE ${object.affordance}`)
      ),
      ...(capture.interaction_route || []).map((step) =>
        statementLine("ROUTE_STEP", step.step, "USES", `${step.object_id}; ACTION ${step.action_type}; FEEDBACK ${step.expected_feedback}`)
      )
    ];
  }

  function buildCapturedLearningBoxStatements(capture) {
    const ids = pathRoleIds(capture);
    return [
      statementLine("VAT", capture.metadata.leerbox_id, "ENTRY_OBJECT", ids.entry.join(", ") || unknown),
      statementLine("VAT", capture.metadata.leerbox_id, "RESISTANCE_OBJECTS", ids.resistance.join(", ") || unknown),
      statementLine("VAT", capture.metadata.leerbox_id, "SUCCESS_OBJECTS", ids.success.join(", ") || unknown),
      statementLine("VAT", capture.metadata.leerbox_id, "EXIT_OBJECT", ids.exit.join(", ") || unknown),
      ...(capture.objects || []).map((object) =>
        statementLine("VAT_OBJECT", object.object_id, "TYPE", `${object.object_type}; ROLE ${object.role}`)
      ),
      ...(capture.freedom_and_sequence.hard_dependencies || []).map((dependency) =>
        statementLine("DEPENDENCY", dependency.from_object_id, "BEFORE", `${dependency.to_object_id}; ${dependency.dependency_type}`)
      )
    ];
  }

  function statementLine(subjectType, subjectId, relation, value) {
    return `${subjectType} ${String(subjectId || unknown)} ${relation} "${String(value || unknown).replaceAll('"', "'")}"`;
  }

  function openBlockDialog(type, index = null) {
    const item = index === null ? newBlock(type) : clone(getCollection(type)[index]);
    state.activeBlock = { type, index, item };
    elements.dialogTitle.textContent = dialogTitle(type, index);
    elements.deleteBlockButton.hidden = index === null;
    elements.dialogFields.innerHTML = blockSchemas[type].map(([key, labelKey, inputType, options]) => {
      const value = item[key];
      const id = `dialog-${key}`;
      const label = t(labelKey);
      if (inputType === "textarea") {
        return `<label for="${id}">${label}<textarea id="${id}" name="${key}" rows="3">${escapeText(isUnknown(value) ? "" : value)}</textarea></label>`;
      }
      if (inputType === "list") {
        return `<label for="${id}">${label}<textarea id="${id}" name="${key}" rows="3" data-list>${escapeText(listToLines(value))}</textarea></label>`;
      }
      if (inputType === "listselect") {
        const selected = new Set(Array.isArray(value) ? value : []);
        return `<label for="${id}">${label}<select id="${id}" name="${key}" multiple>${options.map((option) => `<option value="${escapeText(option)}" ${selected.has(option) ? "selected" : ""}>${escapeText(enumLabel(option))}</option>`).join("")}</select></label>`;
      }
      if (inputType === "select") {
        return `<label for="${id}">${label}<select id="${id}" name="${key}">${options.map((option) => `<option value="${escapeText(option)}" ${option === value ? "selected" : ""}>${escapeText(enumLabel(option))}</option>`).join("")}</select></label>`;
      }
      /* Verwijzing naar een leerobject: kies uit de bestaande objecten in plaats van
         een id overtypen. Een tikfout leverde eerder een stille verwijzing naar niets. */
      if (inputType === "objectref") {
        const objects = state.capture.objects || [];
        const known = objects.some((object) => object.object_id === value);
        const keuzes = objects
          .map((object) => `<option value="${escapeText(object.object_id)}" ${object.object_id === value ? "selected" : ""}>${escapeText(object.label && !isUnknown(object.label) ? `${object.label} (${object.object_id})` : object.object_id)}</option>`)
          .join("");
        // Een bestaande maar onbekende waarde blijft zichtbaar, zodat opslaan hem niet wist.
        const onbekend = !known && !isUnknown(value) && value
          ? `<option value="${escapeText(value)}" selected>${escapeText(value)} — ${escapeText(t("objectref.missing"))}</option>`
          : "";
        const leeg = `<option value="" ${isUnknown(value) || !value ? "selected" : ""}>${escapeText(t("objectref.choose"))}</option>`;
        return `<label for="${id}">${label}<select id="${id}" name="${key}">${leeg}${onbekend}${keuzes}</select></label>`;
      }
      return `<label for="${id}">${label}<input id="${id}" name="${key}" value="${escapeText(isUnknown(value) ? "" : value)}" autocomplete="off"></label>`;
    }).join("");

    if (embeddedWorkbench) {
      // Niet-modaal: de kaart eronder blijft zichtbaar en bruikbaar.
      elements.blockDialog.show();
    } else {
      elements.blockDialog.showModal();
    }
  }

  function dialogTitle(type, index) {
    const labels = {
      object: t("dialog.object"),
      step: t("dialog.step"),
      dependency: t("dialog.dependency")
    };
    return `${index === null ? t("dialog.new") : t("dialog.edit")} ${labels[type]}`;
  }

  function newBlock(type) {
    if (type === "object") {
      return {
        object_id: "unknown",
        label: "unknown",
        object_type: "unknown",
        material_category: "unknown",
        role: "unknown",
        affordance: "unknown",
        feedback_type: "unknown",
        barrier_type: "none",
        sensor_modality: "unknown",
        visible_cues: "unknown",
        loggable_actions: [],
        access_conditions: [],
        likely_marker_roles: [],
        learning_mode_tags: [],
        good_practice_tags: []
      };
    }

    if (type === "step") {
      return {
        step: state.capture.interaction_route.length + 1,
        participant_action: "unknown",
        object_id: "unknown",
        action_type: "unknown",
        game_mechanic: "unknown",
        game_dynamic: "unknown",
        expected_feedback: "unknown",
        if_success_next: "unknown",
        if_stuck_next: "unknown"
      };
    }

    return {
      from_object_id: "unknown",
      to_object_id: "unknown",
      dependency_type: "unknown",
      reason: "unknown"
    };
  }

  function saveBlockFromDialog(event) {
    event.preventDefault();
    const active = state.activeBlock;
    if (!active) {
      return;
    }

    const next = { ...active.item };
    elements.dialogFields.querySelectorAll("[name]").forEach((field) => {
      const key = field.name;
      next[key] = field.multiple
        ? selectedValues(field)
        : field.dataset.list === ""
          ? linesToList(field.value)
          : cleanText(field.value);
    });

    if (active.type === "object" && isUnknown(next.object_id) && !isUnknown(next.label)) {
      next.object_id = slugify(next.label).replaceAll("-", "_");
    }

    const collection = getCollection(active.type);
    const isNewObject = active.index === null && active.type === "object";
    if (active.index === null) {
      collection.push(next);
    } else {
      collection[active.index] = next;
    }
    // Een nieuw object krijgt zijn plek in het midden van wat je nu ziet.
    if (isNewObject && !next.editor_position) {
      const center = visibleCanvasCenter();
      if (center) next.editor_position = { x: Math.round(center.x), y: Math.round(center.y) };
    }
    renumberSteps();
    elements.blockDialog.close();
    state.activeBlock = null;
    persistAndRender();

    if (active.index === null) {
      // Breng in beeld waar het nieuwe blok over gaat: het object zelf, het object van
      // de routestap, of de twee objecten die de afhankelijkheid verbindt. Velden die
      // nog "unknown" zijn wijzen nergens heen en laten we buiten beschouwing.
      const doelen = active.type === "dependency"
        ? [next.from_object_id, next.to_object_id]
        : [next.object_id];
      centerObjectsInCanvas(doelen.filter((id) => id && !isUnknown(id)));
    }
  }

  function deleteActiveBlock() {
    const active = state.activeBlock;
    if (!active || active.index === null) {
      return;
    }

    getCollection(active.type).splice(active.index, 1);
    renumberSteps();
    elements.blockDialog.close();
    state.activeBlock = null;
    persistAndRender();
  }

  function getCollection(type) {
    if (type === "object") {
      return state.capture.objects;
    }
    if (type === "step") {
      return state.capture.interaction_route;
    }
    return state.capture.freedom_and_sequence.hard_dependencies;
  }

  function renumberSteps() {
    state.capture.interaction_route.forEach((step, index) => {
      step.step = index + 1;
    });
  }

  function auditCapture(capture) {
    const missing = requiredChecks
      .filter(([path]) => isUnknown(getByPath(capture, path)))
      .map(([, labelKey]) => t(labelKey));

    if (!capture.objects.length) {
      missing.push(t("required.object"));
    }
    if (!capture.interaction_route.length) {
      missing.push(t("required.step"));
    }
    if (!Array.isArray(capture.simulation_definition.not_visible_to_engine)) {
      missing.push(t("required.layers"));
    }

    return {
      missing,
      total: requiredChecks.length + 3,
      complete: requiredChecks.length + 3 - missing.length
    };
  }

  function persistAndRender(gewijzigdPad) {
    localStorage.setItem(storageKey, JSON.stringify(state.capture));
    render();
    publishCaptureUpdate();
    autosaveNaarBackend(gewijzigdPad);
  }

  /* Autosave: net als in een game bewaart de editor elke wijziging vanzelf.
     De wijzigingen worden kort gebundeld en met tijdstempel naar de backend
     gestuurd, die ze in het mutatielogboek zet (basis voor de herstelknop). */
  let autosaveTimer = null;
  let autosavePaden = new Set();

  function autosaveNaarBackend(gewijzigdPad) {
    if (!selectedLeerboxId) return;
    if (gewijzigdPad) autosavePaden.add(gewijzigdPad);
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(async () => {
      const paden = [...autosavePaden];
      autosavePaden = new Set();
      try {
        const response = await engineAdapter.fetch(`${agentApiBase}/leerbox/${encodeURIComponent(selectedLeerboxId)}/autosave`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ capture: state.capture, paths: paden })
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      } catch (fout) {
        console.warn("Leerbox kon niet automatisch worden bewaard.", fout);
      }
    }, 1500);
  }

  function initializePersistenceControls() {
    const historyButton = document.getElementById("historyButton");
    if (!historyButton) return;
    const hasSelectedLeerbox = Boolean(selectedLeerboxId);
    historyButton.disabled = !hasSelectedLeerbox;
    const label = hasSelectedLeerbox ? "Herstelpunten bekijken" : "Selecteer eerst een leerbox";
    historyButton.title = label;
    historyButton.setAttribute("aria-label", label);
  }

  async function openHerstelvenster() {
    const paneel = document.getElementById("historyPanel");
    const lijst = document.getElementById("historyList");
    if (!paneel || !lijst) return;
    if (!selectedLeerboxId) {
      paneel.hidden = true;
      return;
    }
    paneel.hidden = false;
    lijst.innerHTML = '<p class="empty-note">Geschiedenis wordt geladen…</p>';
    try {
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox/${encodeURIComponent(selectedLeerboxId)}/history?limit=50`, { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      const items = data.entries || [];
      if (!items.length) {
        lijst.innerHTML = '<p class="empty-note">Nog geen wijzigingen vastgelegd.</p>';
        return;
      }
      lijst.innerHTML = items.map((item) => {
        const tijd = new Date(item.timestamp).toLocaleString("nl-NL");
        const velden = (item.changes || []).map((wijziging) => wijziging.path).join(", ") || item.source;
        return `<button type="button" data-history-index="${item.index}"><strong>${escapeText(tijd)}</strong><small>${escapeText(velden)}</small></button>`;
      }).join("");
      lijst.querySelectorAll("[data-history-index]").forEach((knop) => {
        knop.addEventListener("click", () => herstelVersie(Number(knop.dataset.historyIndex)));
      });
    } catch (fout) {
      lijst.innerHTML = `<p class="empty-note">Geschiedenis kon niet worden geladen: ${escapeText(fout.message)}</p>`;
    }
  }

  async function herstelVersie(index) {
    try {
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox/${encodeURIComponent(selectedLeerboxId)}/restore/${index}`, {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      state.capture = normalizeCapture(data.capture);
      localStorage.setItem(storageKey, JSON.stringify(state.capture));
      hydrateForm();
      render();
      publishCaptureUpdate();
      const paneel = document.getElementById("historyPanel");
      if (paneel) paneel.hidden = true;
    } catch (fout) {
      console.warn("Herstelpunt kon niet worden teruggezet.", fout);
    }
  }

  function publishCaptureUpdate() {
    if (!embeddedWorkbench) return;
    window.parent.postMessage({
      type: "leerpret-editor-capture-updated",
      capture: state.capture
    }, parentOrigin);
  }

  function resetCapture() {
    if (!window.confirm(t("confirm.reset"))) {
      return;
    }
    state.capture = clone(template);
    localStorage.removeItem(storageKey);
    hydrateForm();
    render();
    publishCaptureUpdate();
  }

  function exportJson() {
    syncDerivedCapture(state.capture);
    const id = captureId();
    const blob = new Blob([JSON.stringify(state.capture, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function generateWebappPreview() {
    syncDerivedCapture(state.capture);
    const previewBtn = document.getElementById("previewWebappButton");
    if (!previewBtn) return;

    previewBtn.disabled = true;
    const originalContent = previewBtn.innerHTML;
    previewBtn.textContent = "...";

    try {
      const res = await engineAdapter.fetch(`${agentApiBase}/developer/previews/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(state.capture)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Generatie mislukt");
      }

      const data = await res.json();
      const relativeUrl = data.preview_url;
      // Resolve path relative to api root
      const previewUrl = new URL(relativeUrl, agentApiBase).toString();

      if (embeddedWorkbench) {
        window.parent.postMessage({
          type: "leerpret-preview-generated",
          preview_url: previewUrl,
          capture: state.capture
        }, parentOrigin);
      } else {
        window.open(previewUrl, "_blank");
      }
    } catch (err) {
      alert("Fout bij genereren preview: " + err.message);
    } finally {
      previewBtn.disabled = false;
      previewBtn.innerHTML = originalContent;
    }
  }

  function importJson(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        state.capture = normalizeCapture(extractCapturePayload(JSON.parse(String(reader.result))));
        hydrateForm();
        persistAndRender();
      } catch (error) {
        window.alert(t("alert.importFailed"));
      } finally {
        elements.importFileInput.value = "";
      }
    });
    reader.readAsText(file);
  }

  function importRawDescription(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.capture.raw_user_description = String(reader.result || "");
      elements.rawDescriptionInput.value = "";
      persistAndRender();
    });
    reader.readAsText(file);
  }

  function extractCapturePayload(payload) {
    if (payload && payload.schema_version) {
      return payload;
    }
    if (payload?.leerbox_capture) {
      return payload.leerbox_capture;
    }
    if (payload?.capture) {
      return payload.capture;
    }
    return payload;
  }

  function openSimulationParametersDialog() {
    elements.simulationSigma.value = state.simulation_parameters.sigma;
    elements.simulationRunCount.value = String(state.simulation_parameters.run_count);
    elements.simulationParametersDialog.showModal();
  }

  function closeSimulationParametersDialog() {
    elements.simulationParametersDialog.close();
  }

  function makeSimulationPromptFromParameters(event) {
    event.preventDefault();
    state.simulation_parameters = {
      ...state.simulation_parameters,
      sigma: elements.simulationSigma.value,
      run_count: Math.max(1, Number(elements.simulationRunCount.value || 100))
    };
    localStorage.setItem(simulationParametersStorageKey, JSON.stringify(state.simulation_parameters));
    elements.simulationPromptOutput.value = buildStaticSimulationPrompt();
    elements.simulationParametersDialog.close();
    elements.simulationPromptDialog.showModal();
  }

  function buildStaticSimulationPrompt() {
    syncDerivedCapture(state.capture);
    return simulationPromptTemplate
      .replace("[INJECTEER_GEKOZEN_SIGMA]", state.simulation_parameters.sigma)
      .replace("[INJECTEER_AANTAL_RUNS]", String(state.simulation_parameters.run_count))
      .replace("[INJECTEER_PROFIEL]", `${state.simulation_parameters.profile_mode}; ${Object.entries(state.simulation_parameters.archetype_mix || {}).map(([name, value]) => `${name} ${value}%`).join(", ")}`)
      .replace("[INJECTEER_VOLLEDIGE_STATEMENTS_UIT_VIEW_2]", state.capture.computertaal_statements.full_architecture.join("\n"));
  }

  function closeSimulationPromptDialog() {
    elements.simulationPromptDialog.close();
  }

  function copySimulationPrompt() {
    const text = elements.simulationPromptOutput.value;
    const copyPromise = navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : fallbackTextAreaCopy(elements.simulationPromptOutput);
    copyPromise.then(() => {
      const button = document.getElementById("copySimulationPromptButton");
      button.textContent = "Gekopieerd";
      window.setTimeout(() => {
        button.textContent = "Kopieer prompt";
      }, 1300);
    });
  }

  function importTestDataFile(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      parseAndStoreTestData(String(reader.result || ""));
      elements.testDataFileInput.value = "";
    });
    reader.readAsText(file);
  }

  function parseAndStoreTestData(rawJson, sourceLabel = "Handmatige import") {
    const result = validateTestData(rawJson);
    state.imported_test_data = {
      raw_json: rawJson,
      events: result.events,
      errors: result.errors,
      is_valid: result.errors.length === 0,
      source_label: sourceLabel
    };
    if (document.activeElement !== elements.testDataInput) {
      elements.testDataInput.value = rawJson;
    }
    renderTestDataStatus();
  }

  function validateTestData(rawJson) {
    const errors = [];
    let payload;
    try {
      payload = JSON.parse(String(rawJson || "[]"));
    } catch (error) {
      return { events: [], errors: ["JSON is niet valide."] };
    }
    if (!Array.isArray(payload)) {
      return { events: [], errors: ["Testdata moet een JSON-array zijn."] };
    }
    const events = payload.map((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`Item ${index + 1} is geen object.`);
        return null;
      }
      for (const field of testDataFields) {
        if (!item[field]) {
          errors.push(`Item ${index + 1} mist ${field}.`);
        }
      }
      if (item.timestamp && Number.isNaN(Date.parse(item.timestamp))) {
        errors.push(`Item ${index + 1} heeft geen geldige timestamp.`);
      }
      return {
        timestamp: String(item.timestamp || ""),
        user_id: String(item.user_id || ""),
        learning_object_id: String(item.learning_object_id || "")
      };
    }).filter(Boolean);
    if (!events.length) {
      errors.push("Er is minimaal 1 event nodig.");
    }
    return { events, errors };
  }

  function renderTestDataStatus() {
    const data = state.imported_test_data;
    elements.runTestButton.disabled = !data.is_valid;
    elements.testDataStatus.classList.toggle("is-valid", data.is_valid);
    elements.testDataStatus.classList.toggle("is-invalid", !data.is_valid && Boolean(data.raw_json));
    if (data.is_valid) {
      elements.testDataStatus.textContent = `${data.events.length} events geladen uit ${data.source_label || "testdata"}.`;
      return;
    }
    elements.testDataStatus.textContent = data.errors.length ? data.errors.join(" ") : "Nog geen testdata geladen.";
  }

  async function refreshExistingDataCatalog() {
    elements.existingDataSelect.innerHTML = `<option value="">Eerdere data laden...</option>`;
    elements.useExistingDataButton.disabled = true;
    try {
      const leerboxId = state.capture.metadata.leerbox_id || "";
      if (!leerboxId || leerboxId === unknown) throw new Error("Leerbox-ID ontbreekt");
      const response = await engineAdapter.fetch(`${agentApiBase}/leerbox-tests/${encodeURIComponent(leerboxId)}/data`, {
        credentials: "include",
        headers: authHeaders()
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      state.existing_dataset_catalog = flattenExistingDatasetCatalog(data);
      renderExistingDataOptions();
    } catch (error) {
      elements.existingDataSelect.innerHTML = `<option value="">Eerdere data niet bereikbaar</option>`;
      elements.testDataStatus.textContent = "Eerdere data konden niet via de backend worden geladen.";
    }
  }

  function flattenExistingDatasetCatalog(data) {
    const leerboxId = state.capture.metadata.leerbox_id || "";
    const previewEvents = (data.preview_interactions || []).map((event) => ({
      timestamp: event.timestamp,
      user_id: event.user_id,
      learning_object_id: event.object_id,
      action: event.action,
      source: event.source
    }));
    const preview = previewEvents.length ? [{
      id: "preview-user",
      group_id: "preview-user",
      group_title: "Previewgebruikers",
      name: "Geregistreerde aanklikdata",
      items: previewEvents.length,
      score: 120,
      events: previewEvents
    }] : [];
    const files = (data.files || []).map((file) => ({
        id: `${file.group_id}/${file.name}`,
        group_id: file.group_id,
        group_title: file.group_title,
        name: file.name,
        items: file.items,
        data_url: file.data_url,
        score: existingDatasetScore({ id: file.group_id, title: file.group_title }, file, leerboxId)
      }));
    return [...preview, ...files].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  }

  function existingDatasetScore(group, file, leerboxId) {
    const slug = String(leerboxId || "").replace(/^leerbox-/, "");
    const haystack = `${group.id} ${group.title} ${file.name} ${file.path}`.toLowerCase();
    if (leerboxId && haystack.includes(leerboxId.toLowerCase())) return 100;
    if (slug && haystack.includes(slug.toLowerCase())) return 80;
    if (leerboxId === "leerbox-phile" && group.id === "phile") return 70;
    if (leerboxId === "leerbox-learngame-operations-management" && group.id === "learngame-om") return 70;
    if (leerboxId.startsWith("leerbox-") && group.id === "article-leerbox") return 60;
    return 0;
  }

  function renderExistingDataOptions() {
    if (!state.existing_dataset_catalog.length) {
      elements.existingDataSelect.innerHTML = `<option value="">Geen eerdere data gevonden</option>`;
      elements.useExistingDataButton.disabled = true;
      return;
    }
    elements.existingDataSelect.innerHTML = state.existing_dataset_catalog.map((item) => {
      const match = item.score ? "match" : "algemeen";
      return `<option value="${escapeText(item.id)}">${escapeText(match)} - ${escapeText(item.group_title)} - ${escapeText(item.name)} (${escapeText(item.items ?? "?")} items)</option>`;
    }).join("");
    renderExistingDataSelection();
  }

  function renderExistingDataSelection() {
    elements.useExistingDataButton.disabled = !elements.existingDataSelect.value;
  }

  async function useSelectedExistingData() {
    const selected = state.existing_dataset_catalog.find((item) => item.id === elements.existingDataSelect.value);
    if (!selected) {
      return;
    }
    elements.testDataStatus.textContent = "Eerdere data worden geladen...";
    try {
      if (Array.isArray(selected.events)) {
        const rawJson = JSON.stringify(selected.events, null, 2);
        elements.testDataInput.value = rawJson;
        parseAndStoreTestData(rawJson, `${selected.group_title} / ${selected.name}`);
        return;
      }
      const response = await engineAdapter.fetch(selected.data_url, {
        credentials: "include",
        headers: authHeaders()
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      const events = normalizeExistingDatasetEvents(payload, selected);
      const rawJson = JSON.stringify(events, null, 2);
      elements.testDataInput.value = rawJson;
      parseAndStoreTestData(rawJson, `${selected.group_title} / ${selected.name}`);
      elements.testDataStatus.textContent += " Let op: controleer representativiteit na wijzigingen aan de leerbox.";
    } catch (error) {
      elements.testDataStatus.textContent = "Eerdere data konden niet worden ingeladen.";
    }
  }

  function normalizeExistingDatasetEvents(payload, selected) {
    const currentBoxId = state.capture.metadata.leerbox_id || "";
    const extracted = [];
    collectExistingEvents(payload, extracted);
    const filtered = extracted.filter((event) => {
      if (!currentBoxId || selected.score < 60) return true;
      return [event.learningBoxID, event.leerbox_id, event.learning_box_id].some((value) => value === currentBoxId)
        || (selected.group_id === "phile" && currentBoxId === "leerbox-phile")
        || (selected.group_id === "learngame-om" && currentBoxId === "leerbox-learngame-operations-management");
    });
    return (filtered.length ? filtered : extracted).map((event) => ({
      timestamp: String(event.timestamp || new Date().toISOString()),
      user_id: String(event.user_id || event.personID || event.personId || event.actor_id || "unknown-user"),
      learning_object_id: String(event.learning_object_id || event.learningObjectID || event.object_id || event.screen || "unknown-object")
    }));
  }

  function collectExistingEvents(value, result) {
    if (Array.isArray(value)) {
      value.forEach((item) => collectExistingEvents(item, result));
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }
    if (value.timestamp && (value.learningObjectID || value.learning_object_id || value.object_id || value.screen)) {
      result.push(value);
    }
    Object.values(value).forEach((item) => {
      if (Array.isArray(item) || isPlainObject(item)) {
        collectExistingEvents(item, result);
      }
    });
  }

  function runImportedTestData() {
    const validation = validateCapturedLearningBox(state.capture);
    if (!state.imported_test_data.is_valid) {
      renderTestDataStatus();
      return;
    }
    elements.runTestButton.classList.add("is-running");
    elements.runTestButton.textContent = "Simuleert…";
    window.parent.postMessage({ type: "leerpret-simulation-status", status: "running" }, parentOrigin);
    window.setTimeout(() => {
      const report = analyzeImportedEvents(state.imported_test_data.events, validation);
      renderSimulationReport(report);
      elements.runTestButton.classList.remove("is-running");
      elements.runTestButton.textContent = "Run Test";
      window.parent.postMessage({ type: "leerpret-simulation-status", status: "complete", score: report.learning_value }, parentOrigin);
    }, 450);
  }

  function analyzeImportedEvents(events, validation) {
    const sorted = [...events].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    const first = Date.parse(sorted[0]?.timestamp || new Date().toISOString());
    const last = Date.parse(sorted[sorted.length - 1]?.timestamp || sorted[0]?.timestamp || new Date().toISOString());
    const users = unique(sorted.map((event) => event.user_id));
    const targets = unique(sorted.map((event) => event.learning_object_id));
    const dependencyViolations = detectDependencyViolations(sorted, state.capture.freedom_and_sequence.hard_dependencies || []);
    const inferredResistanceIds = unique(dependencyViolations.map((violation) => violation.target_object_id));
    const resistanceHits = sorted.filter((event) => validation.ids.resistance.includes(event.learning_object_id) || inferredResistanceIds.includes(event.learning_object_id));
    const successHits = sorted.filter((event) => validation.ids.success.includes(event.learning_object_id) || validation.ids.exit.includes(event.learning_object_id));
    const recoveries = countRecoveriesAfterResistance(sorted, unique([...validation.ids.resistance, ...inferredResistanceIds]));
    const markers = {
      T: clamp01((last - first) / 1000 / 900),
      A: clamp01(sorted.length / Math.max(20, users.length * 8)),
      V: clamp01(targets.length / Math.max(3, (state.capture.objects || []).length || 3)),
      R: clamp01(recoveries / Math.max(1, resistanceHits.length)),
      S: clamp01(successHits.length / Math.max(1, users.length))
    };
    const learningValue = average(Object.values(markers));
    return {
      events: sorted,
      users,
      targets,
      markers,
      learning_value: learningValue,
      archetype: inferArchetype(markers),
      bottlenecks: buildBottlenecks(sorted, validation, dependencyViolations),
      dependency_violations: dependencyViolations,
      inferred_resistance_object_ids: inferredResistanceIds,
      object_counts: countBy(sorted, "learning_object_id"),
      user_paths: pathsByUser(sorted)
    };
  }

  function countRecoveriesAfterResistance(events, resistanceIds) {
    let recoveries = 0;
    const lastWasResistance = new Map();
    events.forEach((event) => {
      const wasResistance = lastWasResistance.get(event.user_id);
      const isResistance = resistanceIds.includes(event.learning_object_id);
      if (wasResistance && !isResistance) {
        recoveries += 1;
      }
      lastWasResistance.set(event.user_id, isResistance);
    });
    return recoveries;
  }

  function detectDependencyViolations(events, dependencies) {
    const seenByUser = new Map();
    const violations = [];
    events.forEach((event) => {
      const seen = seenByUser.get(event.user_id) || new Set();
      dependencies.filter((dependency) => dependency.to_object_id === event.learning_object_id).forEach((dependency) => {
        if (!seen.has(dependency.from_object_id)) {
          violations.push({
            user_id: event.user_id,
            target_object_id: event.learning_object_id,
            missing_object_id: dependency.from_object_id,
            dependency_type: dependency.dependency_type,
            timestamp: event.timestamp
          });
        }
      });
      seen.add(event.learning_object_id);
      seenByUser.set(event.user_id, seen);
    });
    return violations;
  }

  function renderSimulationReport(report) {
    state.advisor_report = report;
    renderAdvisor(validateCapturedLearningBox(state.capture), report);
    elements.simulationOutput.innerHTML = `
      <div class="simulation-visuals">
        <section>
          <h3>Radardiagram</h3>
          ${renderRadarChart(report.markers)}
        </section>
        <section>
          <h3>Interactiediagram</h3>
          ${renderInteractionDiagram(report)}
        </section>
        <section>
          <h3>Leerpretformule</h3>
          ${renderFormulaDiagnostics(report)}
        </section>
      </div>
    `;
  }

  function renderRadarChart(markers) {
    const labels = ["T", "A", "V", "R", "S"];
    const center = 92;
    const radius = 70;
    const points = legoSpatial.radarSeriesPoints(
      labels.map(label => markers[label] || 0),
      { center: [center, center], radius }
    ).map((point, index) => ({ ...point, label: labels[index] }));
    return `
      <svg class="radar-chart" viewBox="0 0 184 184" role="img" aria-label="Radardiagram">
        <polygon points="${points.map((point) => `${point.axisX},${point.axisY}`).join(" ")}" class="radar-grid"></polygon>
        ${points.map((point) => `<line x1="${center}" y1="${center}" x2="${point.axisX}" y2="${point.axisY}" class="radar-axis"></line>`).join("")}
        <polygon points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" class="radar-area"></polygon>
        ${points.map((point) => `<text x="${point.axisX}" y="${point.axisY}" text-anchor="middle">${point.label}</text>`).join("")}
      </svg>
    `;
  }

  function renderInteractionDiagram(report) {
    const entries = Object.entries(report.object_counts).slice(0, 10);
    if (!entries.length) {
      return `<p>Geen objectinteracties gevonden.</p>`;
    }
    const max = Math.max(...entries.map(([, count]) => count), 1);
    return `
      <div class="interaction-diagram">
        ${entries.map(([objectId, count]) => `
          <div class="interaction-row">
            <span>${escapeText(objectId)}</span>
            <strong style="width:${Math.max(8, (count / max) * 100)}%">${escapeText(count)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderFormulaDiagnostics(report) {
    return `
      <div class="formula-diagnostics">
        <div><strong>${report.learning_value.toFixed(2)}</strong><span>Leerpret-score</span></div>
        <div><strong>${escapeText(report.archetype)}</strong><span>Dominante richting</span></div>
        <div><strong>${escapeText(report.events.length)}</strong><span>Events</span></div>
        <p>${escapeText(report.bottlenecks.join(" "))}</p>
      </div>
    `;
  }

  function buildBottlenecks(events, validation, dependencyViolations = []) {
    const counts = countBy(events, "learning_object_id");
    const messages = validation.ids.resistance
      .filter((id) => counts[id])
      .map((id) => `Weerstand '${id}' komt ${counts[id]} keer voor.`);
    const violationsByTarget = countBy(dependencyViolations, "target_object_id");
    Object.entries(violationsByTarget).forEach(([id, count]) => {
      messages.push(`'${id}' werkt ${count} keer als weerstand: vereiste voorganger(s) ontbreken.`);
    });
    if (!messages.length) {
      messages.push("Geen duidelijk bottleneck-object in de actiestroom.");
    }
    return messages;
  }

  function inferArchetype(markers) {
    const candidates = [
      ["Veroveraar", markers.R],
      ["Verwerver", markers.S],
      ["Verkenner", markers.V],
      ["Volger", (markers.T + markers.A) / 2]
    ].sort((left, right) => right[1] - left[1]);
    return candidates[0][0];
  }

  function copyJson() {
    const text = elements.jsonOutput.value;
    const copyPromise = navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : fallbackCopy(text);

    copyPromise.then(() => {
      document.getElementById("copyButton").textContent = t("actions.copied");
      window.setTimeout(() => {
        document.getElementById("copyButton").textContent = t("actions.copy");
      }, 1300);
    });
  }

  function fallbackCopy(text) {
    elements.jsonOutput.value = text;
    return fallbackTextAreaCopy(elements.jsonOutput);
  }

  function fallbackTextAreaCopy(textArea) {
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    return Promise.resolve(textArea.value);
  }

  function getByPath(source, path) {
    return path.split(".").reduce((value, key) => value && value[key], source);
  }

  function setByPath(source, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((current, key) => {
      current[key] = current[key] || {};
      return current[key];
    }, source);
    target[last] = value;
  }

  function cleanText(value) {
    const trimmed = String(value || "").trim();
    return trimmed || unknown;
  }

  function linesToList(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function listToLines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function selectedValues(select) {
    return Array.from(select.selectedOptions).map((option) => option.value);
  }

  function unique(values) {
    const result = [];
    const seen = new Set();
    for (const value of values || []) {
      const text = String(value || "").trim();
      if (!text || text === unknown || seen.has(text)) {
        continue;
      }
      seen.add(text);
      result.push(text);
    }
    return result;
  }

  function authHeaders() {
    return {
      "X-Organization": "local-dev",
      "X-API-Key": "leerpret-local-dev"
    };
  }

  function clamp01(value) {
    const number = Number(value || 0);
    return Math.max(0, Math.min(1, number));
  }

  function average(values) {
    const numbers = values.map((value) => Number(value || 0));
    return numbers.reduce((total, value) => total + value, 0) / Math.max(1, numbers.length);
  }

  function countBy(items, key) {
    return items.reduce((counts, item) => {
      const value = item[key] || unknown;
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  function pathsByUser(events) {
    return events.reduce((paths, event) => {
      paths[event.user_id] = paths[event.user_id] || [];
      paths[event.user_id].push(event.learning_object_id);
      return paths;
    }, {});
  }

  function isUnknown(value) {
    return value === undefined || value === null || value === "" || value === unknown;
  }

  function captureId() {
    return state.capture.metadata.leerbox_id && state.capture.metadata.leerbox_id !== unknown
      ? state.capture.metadata.leerbox_id
      : t("export.defaultFile");
  }

  function downloadTextFile(filename, text, type) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function slugify(value) {
    const slug = String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || unknown;
  }

  function escapeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function latexEscape(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\textbackslash{}")
      .replaceAll("&", "\\&")
      .replaceAll("%", "\\%")
      .replaceAll("$", "\\$")
      .replaceAll("#", "\\#")
      .replaceAll("_", "\\_")
      .replaceAll("{", "\\{")
      .replaceAll("}", "\\}")
      .replaceAll("~", "\\textasciitilde{}")
      .replaceAll("^", "\\textasciicircum{}");
  }

  function enumLabel(value) {
    const key = `enum.${value}`;
    const translated = t(key);
    return translated === key
      ? String(value || unknown).replaceAll("_", " ")
      : translated;
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replaceAll('"', '\\"');
  }
})();
