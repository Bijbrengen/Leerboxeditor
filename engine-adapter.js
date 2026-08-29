(function () {
  "use strict";

  const apiBase = window.LeerpretSDKApiBase;
  if (!apiBase) {
    throw new Error("LEERPRET_API_URL ontbreekt in runtime-config.js.");
  }

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
