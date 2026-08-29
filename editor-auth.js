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
  const base = window.LeerpretSDKApiBase;
  if (!base) return;

  if (embedded) {
    window.LeerboxEditorAuthReady = Promise.resolve({ action: "allow", reason: "embedded" });
    return;
  }

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

  function loadAuthClient() {
    if (window.LeerpretLogin) return Promise.resolve(window.LeerpretLogin);
    return window.LeerpretSDKLoaderReady
      .then(loader => loader.load(["api-client", "auth-client"]))
      .then(() => {
        if (window.LeerpretLogin) return window.LeerpretLogin;
        throw new Error("LeerpretSDK auth-client is niet beschikbaar.");
      });
  }

  let centralSdkClient = null;
  window.LeerboxEditorAuthReady = Promise.all([window.LeerpretSDKReady, loadAuthClient()])
    .then(function ([sdkClient, login]) {
    centralSdkClient = sdkClient;
    return login.completeGoogleLogin({ apiBase: base, sdkClient, shareProfile: true })
      .then(() => login.ensureEditorAccess({
        apiBase: base,
        embedded,
        alreadyChecked,
        redirect: false,
        sdkClient
      }))
      .then(decision => {
        if (decision.action === "denied") showDenied(decision.roles);
        if (decision.action === "login" || decision.action === "denied") login.mountLogin(document.body, {
          apiBase: base,
          sdkClient,
          shareProfile: true,
          title: "Inloggen bij de LeerboxEditor",
          message: "Meld je aan en deel naam en e-mailadres zodat de Engine je bestaande tester- en editorrol kan controleren."
        });
        return decision;
      });
  })
  .catch(error => {
    document.body.dataset.auth = "unavailable";
    console.error("LeerpretSDK-login niet beschikbaar", error);
    const login = window.LeerpretLogin;
    if (login && typeof login.mountLogin === "function") {
      login.mountLogin(document.body, {
        apiBase: base,
        sdkClient: centralSdkClient,
        shareProfile: true,
        title: "Inloggen bij de LeerboxEditor",
        message: "De vorige Google-aanmelding is niet afgerond. Meld je opnieuw aan."
      });
      const status = document.querySelector("[data-sdk-login-status]");
      if (status) status.textContent = typeof login.errorDetailMessage === "function"
        ? login.errorDetailMessage(error && error.message || error, "Aanmelden is niet gelukt.")
        : String(error && error.message || "Aanmelden is niet gelukt.");
    }
    return { action: "error", reason: "authentication_failed" };
  });
})();
