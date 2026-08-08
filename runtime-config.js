(function() {
  var endpoints = Object.freeze({
    "localApiBase": "http://127.0.0.1:47111/api",
    "localEditorUrl": "http://127.0.0.1:47114/",
    "localDashboardUrl": "http://127.0.0.1:47112/",
    "localLearngameOmUrl": "http://127.0.0.1:47113/",
    "productionApiBase": "https://api.leerpretpark.nl/api",
    "productionEditorUrl": "https://bijbrengen.github.io/Leerboxeditor/",
    "productionDashboardUrl": "https://bijbrengen.github.io/LeerpretDashboard/",
    "productionLearngameOmUrl": "https://bijbrengen.github.io/Learngame-Operations-Management/"
  });
  var isLocal = typeof window !== "undefined" && (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
  window.LEERBOX_EDITOR_CONFIG = Object.freeze({
    apiBase: isLocal ? endpoints.localApiBase : endpoints.productionApiBase,
    editorUrl: isLocal ? endpoints.localEditorUrl : endpoints.productionEditorUrl,
    dashboardUrl: isLocal ? endpoints.localDashboardUrl : endpoints.productionDashboardUrl,
    learngameOmUrl: isLocal ? endpoints.localLearngameOmUrl : endpoints.productionLearngameOmUrl
  });
})();
