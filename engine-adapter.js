(function () {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const configuredApiBase = String(
    parameters.get("api")
      || window.LEERBOX_EDITOR_CONFIG?.apiBase
      || localStorage.getItem("leerbox-editor.apiBase")
      || ""
  ).trim();
  if (!configuredApiBase) {
    throw new Error("LEERPRET_API_URL ontbreekt in runtime-config.js.");
  }
  const apiBase = configuredApiBase.replace(/\/$/, "");

  function resolveUrl(input) {
    if (input instanceof Request) return input;
    const value = String(input || "");
    if (/^https?:\/\//i.test(value)) return value;
    return `${apiBase}/${value.replace(/^\/+/, "")}`;
  }

  async function engineFetch(input, init = {}) {
    return window.fetch(resolveUrl(input), {
      credentials: "include",
      ...init
    });
  }

  window.LeerboxEditorEngine = Object.freeze({
    apiBase,
    fetch: engineFetch,
    resolveUrl
  });
})();
