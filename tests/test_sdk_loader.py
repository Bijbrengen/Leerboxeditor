from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SdkLoaderWiringTests(unittest.TestCase):
    def test_all_sdk_javascript_uses_manifest_component_loader(self) -> None:
        sources = {
            name: (ROOT / name).read_text(encoding="utf-8")
            for name in ("index.html", "script.js", "editor-auth.js", "editor-chrome-boot.js", "leerpret-sdk.js")
        }

        self.assertIn('loader.load("editor-shell")', sources["index.html"])
        self.assertIn('loader.load(["api-client", "auth-client"])', sources["editor-auth.js"])
        self.assertIn('loader.load("editor-chrome")', sources["editor-chrome-boot.js"])
        self.assertIn('loader.load("lego-flow-map")', sources["script.js"])
        self.assertIn("window.LeerpretSDKLoaderReady = loaderReady", sources["leerpret-sdk.js"])

        combined = "\n".join(sources.values())
        for hardcoded_asset in (
            "/sdk/editor-shell/mount.js",
            "/sdk/api-client/client.js",
            "/sdk/auth-client/client.js",
            "/sdk/editor-chrome/chrome.js",
        ):
            self.assertNotIn(hardcoded_asset, combined)

    def test_lego_flow_visuals_stay_in_the_sdk_component(self) -> None:
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        index = (ROOT / "index.html").read_text(encoding="utf-8")

        self.assertIn("legoFlowMap.renderScene", script)
        self.assertIn("legoFlowMap.toolboxPreviewMarkup", script)
        self.assertIn("legoFlowMap.previewCablePath", script)
        self.assertNotIn('marker id="routeArrow"', script)
        self.assertNotIn('<span>⚑</span>', index)
        self.assertNotIn('<span>★</span>', index)
        self.assertNotIn('<span>▲</span>', index)


    def test_library_selection_is_stored_but_classified_by_the_sdk(self) -> None:
        script = (ROOT / "script.js").read_text(encoding="utf-8")

        self.assertIn('"leerpret-editor-add-library-item"', script)
        self.assertIn("library_id: libraryId", script)
        self.assertIn("libraryId: object.library_id", script)
        self.assertNotIn("leerobject.self-starting", script)
        self.assertNotIn("minifig.veroveraar", script)


if __name__ == "__main__":
    unittest.main()
