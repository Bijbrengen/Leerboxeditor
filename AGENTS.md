# LeerboxEditor AI-werkkaart

Deze repository bevat de zelfstandige statische LeerboxEditor. Lees
`README.md` en `EDITOR-STRUCTUUR.md` voordat je de editorstructuur wijzigt.

## Eigenaarschap

- `index.html`: editor-markup.
- `script.js`: capturestate, API-client, canvas, validatie en simulatie-UI.
- `style.css`: standalone en embedded layout.
- `languages.js`: vertaalstrings.
- `engine-adapter.js`: enige grens tussen statische editor en dynamische
  LeerpretEngine-API.
- `EDITOR-STRUCTUUR.md`: kaart van iframe, dashboardbuitenschil en canvas.

De dashboardbuitenschil staat in de buurrepository
`../Leerpret/frontend-astro/src/pages/editor.astro`. Backendfuncties staan in
`../LeerpretEngine` en worden alleen via publieke `/api`-routes gebruikt.
Importeer geen interne Engine-code en plaats geen secrets in deze repository.

De Editor draait op een eigen configureerbare HTTP-origin. LeerpretEngine
publiceert die origin via zijn publieke UI-surfacecontract; de Engine leest of
mount nooit bestanden uit deze repository.

## Verificatie

Controleer na wijzigingen ten minste:

1. dat `index.html` zelfstandig via een statische webserver opent;
2. dat de publieke Engine-routes onder `/api/sdk/` antwoorden;
3. dat de iframecommunicatie met de Leerpret-dashboardpagina blijft werken;
4. dat API-calls een configureerbare `?api=`-base blijven gebruiken;
5. dat `npm test` slaagt, inclusief de pixel-exacte Playwrightvergelijking met
   de vastgelegde voor-migratiebeelden.

Commit of push nooit zonder expliciete toestemming van de gebruiker.
