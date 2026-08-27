(function () {
  "use strict";
  var rawFetch = window.fetch.bind(window);
  var nativeFetch = function(input, options) {
    var opts = options || {};
    var headers = new Headers(opts.headers || {});
    headers.set("bypass-tunnel-reminder", "true");
    return rawFetch(input, Object.assign({}, opts, { headers: headers }));
  };
  var apiBase = String(window.LEERBOX_EDITOR_CONFIG.apiBase || "").replace(/\/+$/, "");
  function loadSdkLoader() {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = apiBase + "/sdk/sdk-loader/loader.js?bypass-tunnel-reminder=true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  var loaderReady = loadSdkLoader().then(function () {
    return window.LeerpretSDK.Loader.create({
      base: apiBase,
      fetch: nativeFetch,
      query: { "bypass-tunnel-reminder": "true" }
    });
  });
  window.LeerpretSDKLoaderReady = loaderReady;

  var ready = loaderReady
    .then(function (loader) {
      return loader.load("api-client");
    })
    .then(function () {
      var client = window.LeerpretSDK.create({
        apiBase: apiBase,
        clientId: "leerbox-editor",
        fetch: nativeFetch
      });
      return client.bootstrap().then(function () { return client; });
    });

  window.LeerpretSDKReady = ready;
  window.fetch = function (input, options) {
    var url = typeof input === "string" ? input : input.url;
    if (url.indexOf(apiBase) !== 0 || url.indexOf(apiBase + "/sdk/") === 0) {
      return nativeFetch(input, options);
    }
    return ready.then(function (client) { return client.request(url, options || {}); });
  };
})();
