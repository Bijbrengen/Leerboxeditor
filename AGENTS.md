# LeerboxEditor AI-werkkaart

Deze repository bevat de zelfstandige statische LeerboxEditor. Lees
`README.md` en `EDITOR-STRUCTUUR.md` voordat je de editorstructuur wijzigt.

## Eigenaarschap

- `index.html`: editor-markup.
- `script.js`: capturestate, API-client, canvas, validatie en simulatie-UI.
- `style.css`: standalone en embedded layout.
- `languages.js`: vertaalstrings.
- `EDITOR-STRUCTUUR.md`: kaart van iframe, dashboardbuitenschil en canvas.

De dashboardbuitenschil staat in de buurrepository
`../Leerpret/frontend-astro/src/pages/editor.astro`. Backendfuncties staan in
`../LeerpretEngine` en worden alleen via publieke `/api`-routes gebruikt.
Importeer geen interne Engine-code en plaats geen secrets in deze repository.

LeerpretEngine vindt deze repo via `LEERBOX_EDITOR_DIR` of standaard als
`../LeerboxEditor` en mount hem op `/tools/architect-editor/`.

## Verificatie

Controleer na wijzigingen ten minste:

1. dat `index.html` zelfstandig via een statische webserver opent;
2. dat de Engine-route `/tools/architect-editor/` antwoordt;
3. dat de iframecommunicatie met de Leerpret-dashboardpagina blijft werken;
4. dat API-calls een configureerbare `?api=`-base blijven gebruiken.

Commit of push nooit zonder expliciete toestemming van de gebruiker.
