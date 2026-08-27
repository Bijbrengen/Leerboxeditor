/**
 * Laadt de gedeelde editor-chrome (commandomenu + simulatieklok + adviseur +
 * flyout + leerbox-kiezer) uit de engine en injecteert die in de editorpagina.
 * De chrome is statische SDK-code; de wiring stuurt de editor via het bestaande
 * postMessage-contract. Vereist runtime-config.js vóór dit script.
 */
(function () {
  "use strict";

  // Injecteer de gedeelde chrome altijd: standalone én in het dashboard-iframe.
  // Het dashboard levert de chrome niet meer zelf (één bron uit de engine).
  const cfg = window.LEERBOX_EDITOR_CONFIG || {};
  let base = String(cfg.apiBase || "").replace(/\/+$/, "");
  if (!base) return;
  if (!/\/api$/.test(base)) base += "/api";

  function mountChrome() {
    let mountedChromeNode = null;

  // Alle chrome-assets komen rechtstreeks uit de publieke Engine-SDK.
  const cb = "?v=" + Date.now();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = base + "/sdk/editor-chrome/css" + cb;
  document.head.appendChild(link);

    return fetch(base + "/sdk/editor-chrome/template.html", { cache: "no-store" })
    .then(response => response.text())
    .then(html => {
      const holder = document.createElement("div");
      holder.innerHTML = html;
      const node = holder.firstElementChild || holder;
      mountedChromeNode = node;
      document.body.appendChild(node);
      document.body.classList.add("has-editor-chrome");

      // position:fixed werkt alleen t.o.v. de viewport als er geen voorouder met
      // transform is. Verplaats de zwevende HUD-onderdelen naar een directe
      // body-child zodat ze betrouwbaar rechtsonder/links vastzitten.
      node.querySelectorAll(".simulation-clock").forEach(el => document.body.appendChild(el));

      const overrides = document.createElement("style");
      overrides.textContent =
        ".simulation-clock{position:fixed!important;right:20px!important;bottom:20px!important;left:auto!important;top:auto!important;z-index:60}" +
        ".editor-page-menu{position:fixed!important;left:14px!important;top:14px!important;bottom:14px!important;z-index:55;overflow:auto}";
      document.head.appendChild(overrides);

      const loaded = window.LeerpretSDK?.components?.["editor-chrome"];
      if (loaded && typeof loaded.wire === "function") {
        loaded.wire(node);
        return;
      }
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = base + "/sdk/editor-chrome/chrome.js" + cb;
        script.crossOrigin = "anonymous";
        script.onload = () => {
          const chrome = window.LeerpretSDK?.components?.["editor-chrome"];
          if (!chrome || typeof chrome.wire !== "function") {
            reject(new Error("LeerpretSDK editor-chrome is niet beschikbaar."));
            return;
          }
          chrome.wire(node);
          resolve();
        };
        script.onerror = () => reject(new Error("LeerpretSDK editor-chrome kon niet worden geladen."));
        document.head.appendChild(script);
      });
    })
    .catch(error => {
      const chrome = window.LeerpretSDK?.components?.["editor-chrome"];
      if (mountedChromeNode && chrome && typeof chrome.wire === "function") {
        chrome.wire(mountedChromeNode);
        return;
      }
      console.error("LeerpretSDK editor-chrome kon niet worden gekoppeld.", error);
    });
  }

  Promise.resolve(window.LeerboxEditorAuthReady)
    .then(decision => {
      if (!decision || decision.action !== "allow") return;
      return mountChrome();
    });
})();
