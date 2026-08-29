# Editorpagina — structuur voor AI's en ontwikkelaars

Beschrijft de volledige paginastructuur van de Editor (rol: Leerprettechnoloog e.a.) in boomvorm,
plus het canvasmodel. URL-voorbeeld: `/editor/?role=technologist&id=<leerbox>&workspace=vat&view=sources`.

## Overzicht: twee lagen

De pagina bestaat uit een **buitenschil** (Astro, `frontend-astro/src/pages/editor.astro`) met daarin een
**iframe** dat de eigenlijke editor rechtstreeks vanaf de zelfstandige
`LEERBOX_EDITOR_URL` laadt (bronrepository `LeerboxEditor`: `index.html` +
`script.js` + `style.css` + `languages.js` + `engine-adapter.js`).
Het iframe draait in "embedded workbench"-modus (`body.is-workbench-embedded`).

De zelfstandige Editor laadt `api-client`, `auth-client`, `editor-shell` en
`editor-chrome` uitsluitend via `LeerpretSDKLoaderReady` en het Engine-manifest.
Ook het HTML-template van de chrome loopt via de manifest-gevalideerde
`loader.fetchAsset()`-functie; er bestaan geen lokale of hard-gecodeerde
componentassetpaden meer. `leerpret-sdk.js` resolveert `?api=`, runtimeconfig en
lokale opslag één keer naar `window.LeerpretSDKApiBase`, waarna alle consumers
exact dezelfde Engine-origin gebruiken.

## Buitenschil (editor.astro)

```
[ .editor-page-layout: 2 kolommen — vast linkerpaneel + content ]
├── [ aside .editor-page-menu: linker gereedschapspaneel, inklapbaar (#editor-menu-collapse) ]
│   ├── Terug-link naar /learningbox
│   ├── [ .editor-leerbox-context: leerbox-keuze ]
│   │   ├── select #editor-twin-select (actieve leerbox; wissel = iframe herladen)
│   │   ├── popover #editor-twin-popover (leerboxlijst met status)
│   │   └── acties: beschrijving, preview genereren, statusbadge #editor-twin-status
│   ├── Commandocentrum-knoppen [data-editor-page-view]: Missie / Bronnen / Spel / Kern / Start /
│   │   Plan / Structuur / Kaart / Code / Meten / Controle / Data  → postMessage naar iframe
│   ├── [ section bestand/preview: Taal, Nieuw, Prompt, Upload, Preview, Export ]
│   ├── [ section bouwcommando's: Object (+subtools Start/Succes/Weerstand/Normaal), Stap, Voorw. ]
│   ├── [ .editor-advisor-dock: adviseur-portret + uitklappaneel ]
│   ├── [ .editor-tool-flyout: hover-flyout met uitleg per gereedschap ]
│   └── [ .simulation-clock: OVERLAY rechtsonder — simulatieklok ]
│       ├── SVG-klok: fasering (concept/prototype/pilot/uitrol), 2 boog-sliders (duur, acties)
│       ├── input #simulation-action-count + play-knop #simulation-clock-play
│       └── lock-melding #simulation-clock-lock (als leerbox niet "gevat" is)
└── [ main .editor-page-content ]
    ├── status #editor-page-status ("Editor laden…")
    └── iframe #editor-page-iframe  ← laadt LEERBOX_EDITOR_URL/?embedded=1&…
```

Communicatie buitenschil ↔ iframe: `postMessage` (types: `leerpret-editor-view`,
`leerpret-editor-click-control`, `leerpret-editor-add-object-preset`,
`leerpret-editor-simulation-control`, `leerpret-preview-generated`, `leerpret-editor-workspace-view`).

## Binnenkant iframe (architect-editor, embedded modus)

```
[ body.is-workbench-embedded: height 100vh, overflow hidden — GEEN windowscrollbar ]
├── [ topbar: verborgen in embedded modus ]
├── [ workbench-sidebar / workflow-panelen: per view (description, sources, agent, …) ]
└── [ .editor-grid > .workspace > .workspace-view[data-workspace-view="vat"] ]
    └── [ .strategy-canvas-layout: HET KAARTVENSTER — de ENIGE scroller (overflow:auto) ]
        │     hoogte = 100vh − var(--hud-top) − 16px; cursor:grab; pannen met handje
        ├── [ aside .object-toolbox: HUD, position:fixed links — bouwstenen om te slepen ]
        │   ├── knoppen [data-object-preset]: Start ⚑ / Succes ★ / Weerstand ▲ / Normaal ⚙
        │   └── .path-legend (vrij / sequentie / voorwaarde)
        ├── [ .network-stage #networkCanvas: DE WERELD — grootte dynamisch, zie canvasmodel ]
        │   ├── [ .canvas-hud: HUD fixed linksboven — titel "Architectuurkaart" ]
        │   ├── [ .canvas-resource-bar: HUD fixed rechtsboven — tellers objecten/route/voorwaarden ]
        │   ├── [ .canvas-report-toggle + .canvas-report-drawer: HUD fixed rechts — wereldrapport ]
        │   ├── [ .advisor-panel: HUD fixed rechts — adviseur ]
        │   ├── svg #networkEdges: SDK-isometrisch raster en LEGO-kabels (route/voorwaarden)
        │   ├── div #networkNodes: SDK-LEGO-blokken (.network-node, absolute op editor_position x/y)
        │   └── [ #canvasEmptyState: fixed gecentreerd — "Lege spelwereld" ]
        └── [ aside .canvas-inspector: HUD fixed rechts — eigenschappenvenster (alleen .is-open) ]
```

## Canvasmodel (SimCity/Civilization-principe)

Berekend door de publieke SDK-primitive `lego-flow-map.layoutScreenSceneV1()` en
door `renderNetworkCanvas()` (script.js) toegepast via CSS-variabelen op
`.strategy-canvas-layout`:

Ook zichtcentrum, scroll-delta en terugzetten naar het midden komen uit de
pure SDK-functies `visibleLayerCenterV1`, `centerDeltaV1` en
`centeredScrollOffsetV1`; `clientPointToLayerV1`, `panScrollOffsetV1` en
`dragScreenPositionV1` verzorgen drop-, rubberband-, pan- en node-dragwiskunde.
De editor leest alleen pointerevents en actuele DOM-rechthoeken.

- **Bounding box**: de SDK berekent de kleinste rechthoek om alle leerobjecten
  (`editor_position`) plus de legacy marge voor nodebreedte en relatiebogen.
- **Canvasgrootte** (`--dynamic-canvas-width/height` → `.network-stage`):
  bbox + precies **één vensterbreedte links én rechts** + **één vensterhoogte boven én onder**
  (venster = zichtbare kaartdeel, `layout.clientWidth/Height`). Zo kun je elk object tot in elke
  uithoek van het beeld pannen (dus ook vrij van menu-overlay en simulatieklok), maar is het canvas
  nooit groter dan nodig. Groei van de leerbox → canvas groeit automatisch mee bij elke render.
- **Objectlaag** (`--dynamic-canvas-offset-x/y` + `--dynamic-content-width/height` →
  `#networkNodes` en `#networkEdges`): behoudt de opgeslagen coördinaten en wordt zó geplaatst dat
  het bbox-midden exact op het canvasmidden ligt. Gevolg: **sliders in het midden = midden van de
  tekening in beeld** — er is geen aparte "zoek het centrum"-berekening nodig.
- **LEGO-weergave**: `script.js` levert objecten, rollen, labels, posities en
  relaties aan de publieke LeerpretSDK-component `lego-flow-map`. Raster,
  blokgeometrie, noppen, kwalificatiekleuren, tekstprojectie, paint-order en
  kabelmarkup blijven volledig in LeerpretEngine; de dashboardbuitenschil
  bevat geen renderintelligentie.
- **Reset**: bij leerboxwissel of paginarefresh (signature = `metadata.leerbox_id`,
  `networkCanvasCenteredSignature`) worden de sliders naar het midden van hun bereik gezet:
  `scrollLeft = (scrollWidth − clientWidth) / 2` (idem verticaal).
- **Pannen**: pointerdown op de kaart (niet op knoppen/nodes/HUD) → handje sleept de scroller
  (`bindNetworkCanvas()`); scrollbars blijven als tweede weg beschikbaar. Windowscroll is uit.
- **HUD-verankering**: `updateHudAnchor()` meet de bovenkant van het kaartvenster en zet
  `--hud-top` op `body`; alle HUD-panelen staan `position:fixed` t.o.v. het venster.

## Bestanden

| Onderdeel | Bestand |
|---|---|
| Buitenschil + linkerpaneel + simulatieklok | `frontend-astro/src/pages/editor.astro` |
| Editor-markup (iframe) | `LeerboxEditor/index.html` |
| Canvasmodel, pannen, centreren, HUD-anker | `LeerboxEditor/script.js` |
| Canonieke layout + HUD-regels | LeerpretSDK `editor-shell` en `editor-chrome` |
| Bytegelijke offline stylesheetfallback | `LeerboxEditor/style.css` |
| Serving | Eigen statische origin; dashboard gebruikt `embed_url` uit `/api/ui/surfaces` |
