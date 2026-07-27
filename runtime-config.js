(function() {
  var isLocal = typeof window !== "undefined" && (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
  var tunnelUrl = "https://slimy-masks-glow.loca.lt/api";

  window.LEERBOX_EDITOR_CONFIG = Object.freeze({
    "apiBase": isLocal ? "http://127.0.0.1:47111/api" : tunnelUrl,
    "editorUrl": isLocal ? "http://127.0.0.1:47114/" : "https://bijbrengen.github.io/LeerboxEditor/",
    "dashboardUrl": isLocal ? "http://127.0.0.1:47112/" : "https://bijbrengen.github.io/LeerpretDashboard/",
    "learngameOmUrl": isLocal ? "http://127.0.0.1:47113/" : "https://bijbrengen.github.io/Learngame-Operations-Management/"
  });
})();
