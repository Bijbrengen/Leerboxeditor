export const SCREENSHOT_COMPARISON_SCHEMA_VERSION = 1;

// Pixelmatch vergelijkt pas een pixel als regressie wanneer het grootste
// genormaliseerde kanaalverschil boven `threshold` komt. Daarmee wordt de
// waargenomen Chromium-antialias-/filterruis genegeerd. De grens 0.065 laat
// bij het zwaarste reproduceerbare kabelcheckpoint exact 45 pixels over.
// Van de resterende, grotere verschillen staan we expliciet hoogstens de door
// de gebruiker geaccepteerde 45 rasterpixels toe.
export const SCREENSHOT_COMPARISON = Object.freeze({
  threshold: 0.065,
  maxDiffPixels: 45
});

export function actionSnapshotSlug(actionId) {
  const name = String(actionId || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (!name) throw new TypeError("Een actiescreenshot vereist een niet-lege actie-ID.");
  return name;
}

export function screenshotSnapshotName(actionId) {
  return `${actionSnapshotSlug(actionId)}.png`;
}
