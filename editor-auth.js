/**
 * Editor-sessiebrug (dunne bootstrap).
 *
 * De login-logica zelf is publieke, gedeelde SDK-code die uit de engine komt
 * (LeerpretSDK component "auth-client"). Dit bestand laadt die client en vraagt
 * of de huidige gebruiker editor-toegang heeft:
 *   - ingebed in het dashboard (?embedded=1): ouder regelt auth -> niets doen;
 *   - niet ingelogd: de SDK mount de Google-login rechtstreeks in de editor;
 *   - ingelogd zonder architect/technoloog-rol: toon een nette "geen toegang";
 *   - ingelogd met de juiste rol: doorgaan.
 *
 * De SDK/UI is publiek; de data blijft afgeschermd achter deze rolcontrole.
 * Vereist runtime-config.js (window.LEERBOX_EDITOR_CONFIG) vóór dit script.
 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const embedded = params.get("embedded") === "1";
  const alreadyChecked = params.get("auth_checked") === "1";

  const cfg = window.LEERBOX_EDITOR_CONFIG || {};
  let base = String(cfg.apiBase || "").replace(/\/+$/, "");
  if (!base) return;
  if (!/\/api$/.test(base)) base += "/api";

  if (embedded) return; // Dashboard (ouder) heeft de sessie al.

  function showDenied(roles) {
    document.body.innerHTML =
      '<main style="max-width:520px;margin:12vh auto;padding:28px;font-family:system-ui,sans-serif;' +
      'text-align:center;color:#0b171d">' +
      "<h1>Geen toegang tot de editor</h1>" +
      "<p>Je bent ingelogd, maar mist de rol <strong>Leerpretarchitect</strong> of " +
      "<strong>Leerprettechnoloog</strong> die nodig is om de editor te gebruiken.</p>" +
      (roles && roles.length ? "<p>Je huidige rollen: " + roles.join(", ") + ".</p>" : "") +
      '<p><a href="' + String(cfg.dashboardUrl || "/") + '">Terug naar het dashboard</a></p>' +
      "</main>";
  }

  window.LeerpretSDKLoaderReady
    .then(loader => {
      return loader.load(["api-client", "auth-client"]);
    })
    .then(function () {
    const login = window.LeerpretLogin;
    if (!login) return;
    const sdkClient = window.LeerpretSDK.create({ apiBase: base, clientId: "leerbox-editor" });
    return sdkClient.bootstrap()
      .then(() => login.completeGoogleLogin({ apiBase: base, sdkClient }))
      .then(() => login.ensureEditorAccess({
        apiBase: base,
        embedded,
        alreadyChecked,
        redirect: false,
        sdkClient
      }))
      .then(decision => {
        if (decision.action === "denied") showDenied(decision.roles);
        if (decision.action === "login") login.mountLogin(document.body, {
          apiBase: base,
          sdkClient,
          title: "Inloggen bij de LeerboxEditor",
          message: "Meld je hier met Google aan. De Engine controleert daarna je editorrol."
        });
        // "allow": niets doen; "error": de editor toont zelf de offline-status.
      });
  })
  .catch(error => {
    document.body.dataset.auth = "unavailable";
    console.error("LeerpretSDK-login niet beschikbaar", error);
  });
})();
