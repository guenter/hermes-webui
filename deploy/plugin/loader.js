(function () {
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const STANDALONE_URL = "/dashboard-plugins/hermes-webui/dist/index.html?v=" + Date.now();

  if (!SDK || !window.__HERMES_PLUGINS__) {
    console.error("Hermes Web UI requires the dashboard plugin SDK");
    return;
  }

  function HermesUi() {
    SDK.React.useEffect(function () {
      // Run the chat UI as its own document. Keeping the URL on the dashboard
      // origin preserves its authenticated REST and WebSocket connections
      // without inheriting the dashboard shell or its navigation stacking.
      window.location.replace(STANDALONE_URL);
    }, []);

    return SDK.React.createElement("main", {
      style: {
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        color: "#767985",
        background: "#f4f5f7",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "13px"
      }
    }, SDK.React.createElement("a", {
      href: STANDALONE_URL,
      style: { color: "inherit" }
    }, "Opening Hermes Web UI…"));
  }

  window.__HERMES_PLUGINS__.register("hermes-webui", HermesUi);
})();
