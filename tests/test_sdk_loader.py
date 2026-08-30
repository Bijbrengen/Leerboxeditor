from __future__ import annotations

import hashlib
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
        self.assertIn('src="script.js?v=sdk-learning-box-2"', sources["index.html"])
        self.assertIn('loader.load(["api-client", "auth-client"])', sources["editor-auth.js"])
        self.assertIn('loader.load("editor-chrome")', sources["editor-chrome-boot.js"])
        self.assertIn('loader.load(["lego-flow-map", "lego-spatial"])', sources["script.js"])
        self.assertIn("window.LeerpretSDKLoaderReady = loaderReady", sources["leerpret-sdk.js"])

        combined = "\n".join(sources.values())
        for hardcoded_asset in (
            "/sdk/editor-shell/mount.js",
            "/sdk/editor-shell/css",
            "/sdk/api-client/client.js",
            "/sdk/auth-client/client.js",
            "/sdk/editor-chrome/chrome.js",
            "/sdk/editor-chrome/template.html",
        ):
            self.assertNotIn(hardcoded_asset, combined)

        self.assertIn('loader.fetchAsset("editor-chrome", "template.html")', sources["editor-chrome-boot.js"])
        self.assertNotIn("shellStyles", sources["index.html"])

    def test_offline_stylesheet_is_exact_engine_output_golden(self) -> None:
        stylesheet = (ROOT / "style.css").read_bytes()
        self.assertEqual(
            hashlib.sha256(stylesheet).hexdigest(),
            "d27061e5648b56e2f4a24e4017ed40bd054c14b1d39e9ac7afbb031fc95efe59",
        )

    def test_lego_flow_visuals_stay_in_the_sdk_component(self) -> None:
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        index = (ROOT / "index.html").read_text(encoding="utf-8")

        self.assertIn("legoFlowMap.renderScene", script)
        self.assertIn("legoFlowMap.toolboxPreviewMarkup", script)
        self.assertIn("legoFlowMap.previewCablePath", script)
        self.assertIn("legoFlowMap.layoutScreenSceneV1", script)
        self.assertNotIn("legoFlowMap.clampScreenPositionV1({", script)
        self.assertIn("legoFlowMap.studConnectionPoint", script)
        self.assertIn("legoFlowMap.visibleLayerCenterV1", script)
        self.assertIn("legoFlowMap.centerDeltaV1", script)
        self.assertIn("legoFlowMap.centeredScrollOffsetV1", script)
        self.assertIn("legoFlowMap.clientPointToLayerV1", script)
        self.assertIn("legoFlowMap.panScrollOffsetV1", script)
        self.assertIn("legoFlowMap.dragScreenPositionV1", script)
        self.assertIn("legoFlowMap?.zoomInputDirectionV1", script)
        self.assertIn("legoFlowMap.zoomViewportV1", script)
        self.assertIn("legoFlowMap.scaleScreenSceneV1", script)
        self.assertIn('environment: "learning-box-v1"', script)
        self.assertIn("legoFlowMap.learningBoxStudPositionV1", script)
        self.assertNotIn("learningBoxSceneLayers", script)
        self.assertNotIn("learningBoxBackgroundMarkup", script)
        self.assertIn("legoSpatial.radarSeriesPoints", script)
        self.assertNotIn("Math.cos(angle) * radius", script)
        self.assertNotIn("source.editor_position.y - 27", script)
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
