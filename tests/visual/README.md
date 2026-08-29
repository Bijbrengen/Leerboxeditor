# Visueel voor/na-contract

De PNG-bestanden onder `__screenshots__/win32/` zijn op 28 augustus 2026
rechtstreeks gegenereerd uit een schone `git archive` van de ongemigreerde
LeerboxEditor-commit:

```text
bcc4b886dac2b804c225bc3b1208e5d9e89f9ecb
```

Die historische Editor en de huidige Editor gebruiken in de vergelijking
dezelfde LeerpretEngine en dezelfde vaste API-antwoorden. SDK- en
componentassets komen echt uit `/api/sdk/`; alleen sessie-, dataset- en overige
muteerbare API-antwoorden zijn deterministisch gemaakt. Viewport, locale,
tijdzone, kleurmodus, testfonts en animaties liggen vast. De fonts worden voor
de geometrische vergelijking genormaliseerd naar Arial en Courier New; dit
voorkomt netwerk- en Google-Fonts-ruis, maar maakt deze goldens bewust
Windows/Chromium-specifiek. `baseline-provenance.json` legt daarnaast de
Editor-commit, Playwrightversie, Engine-manifesthash, relevante
assetintegriteiten en de volledige recursieve goldenboom machineleesbaar vast.
Iedere PNG- en JSON-golden krijgt een SHA-256 en bytegrootte; PNG's krijgen ook
hun afmetingen en action-JSON krijgt het aantal checkpoints. De provenance
bindt die artefacten tevens aan de versies en inhoudshashes van de gesloten
action-catalogus en het outputfingerprintcontract.

`editor-screen-parity.spec.mjs` herhaalt aan beide kanten dezelfde zichtbare
acties. Chromium-antialiasverschillen tot `0.065` volgens Pixelmatch zijn geen
afwijkende pixel; daarboven zijn maximaal 45 rasterpixels toegestaan. Naast
de screenshots controleert de suite objectcoördinaten, opslag, kabelgeometrie,
HTML5-dropcoördinaten, scrollcentrum, radar-SVG, twee schermgroottes,
tweerichtings-iframeberichten en browser-/netwerkfouten semantisch. Onbekende
API-routes krijgen in de fixture bewust HTTP 503 en laten de test falen.

`editor-action-parity.spec.mjs` karakteriseert daarnaast de volledige
actiecatalogus. Iedere actie heeft een echte historische PNG-golden met dezelfde
strenge 45-pixelgrens. De JSON-goldens bevatten daarnaast hashes van DOM,
berekende CSS, geometrie, SVG-drawables, state, netwerk, downloads en
iframeberichten. Daardoor blijft een brede raster-, kleur- of layoutwijziging
zichtbaar, terwijl de overige uitvoercontracten byte-exact blijven.
Alleen tijdens de PNG-opname wordt de GPU-afhankelijke `drop-shadow` van kleine
kabelsignalen en live-previewpaden uitgeschakeld. De productie-CSS inclusief
die filters is vlak daarvoor al exact in de CSS-fingerprint vastgelegd. De
enkele signaalcirkels zelf worden voor die opname transparant gemaakt; hun vorm,
kleur, coördinaten en kabelankers blijven exact in CSS/SVG/geometrie
gecontroleerd en de volledige kabelpaden blijven zichtbaar in de PNG.

`editor-agent-bucket-action-parity.spec.mjs` legt de bronimport-, Project
Bucket- en Agentflows afzonderlijk vast. Ook deze suite schrijft in de volledige
modus verplichte historische JSON- én PNG-goldens. Zo vallen wijzigingen aan
dialogen, uploads, bronselectie, Agentverkeer en bijbehorende schermoutput onder
hetzelfde voor/na-contract.

Voer de normale regressiecontrole uit met:

```powershell
npm run test:e2e
```

Werk de goldens uitsluitend bij wanneer een zichtbare wijziging expliciet is
goedgekeurd. De updateopdracht weigert te starten tenzij
`LEERBOX_EDITOR_TEST_URL` naar een andere origin wijst,
`LEERBOX_EDITOR_LEGACY_BASELINE=1` is gezet, `LEERBOX_EDITOR_BASELINE_REF` een
volledige commit bevat en `LEERBOX_EDITOR_APPROVE_BASELINE_UPDATE=1` is gezet.
Na goedkeuring draait de updater screen-parity en beide action-paritysuites
samen met `--update-snapshots`, dwingt hij de volledige actionmatrices af
(smokemodus wordt uitgezet), controleert hij dat alle drie suites hun verplichte
artefacten produceerden en bouwt hij provenance schema 5 opnieuw op. Een
ontbrekend, extra of gewijzigd bestand onder `__screenshots__/<platform>/` laat
de Node-provenancetest falen.
