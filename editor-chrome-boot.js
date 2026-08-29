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
  function mountChrome() {
    let mountedChromeNode = null;
    return window.LeerpretSDKLoaderReady.then(loader => Promise.all([
      loader.load("editor-chrome"),
      loader.fetchAsset("editor-chrome", "template.html")
    ]))
    .then(([components, html]) => {
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

      const chrome = components?.[0] || window.LeerpretSDK?.components?.["editor-chrome"];
      if (!chrome || typeof chrome.wire !== "function") {
        throw new Error("LeerpretSDK editor-chrome is niet beschikbaar.");
      }
      chrome.wire(node);
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
