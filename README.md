# Leerpretarchitect editor

Zelfstandige statische browser-editor voor het maken, valideren en simuleren
van een `leerbox_capture_v5`-bestand. Deze repository is afgesplitst uit
`Bijbrengen/Leerpret`, waar de editor eerder onder
`leerbox/architect-editor/` stond.

Open `index.html` direct in de browser. De editor draait buiten de simulator en bewaart tussentijds in `localStorage`.

## Positie in het Leerpret-ecosysteem

De normale lokale indeling is:

```text
D:\repos\
├── Leerpret\
├── LeerpretEngine\
├── LeerboxEditor\
└── Learngame Operations Management\
```

De verantwoordelijkheden zijn bewust gescheiden:

- deze repository bezit `index.html`, `script.js`, `style.css`,
  `languages.js` en de editordocumentatie;
- `Leerpret/frontend-astro/src/pages/editor.astro` bezit de
  dashboardbuitenschil en laadt deze editor in een iframe;
- `Leerpret/prompts/` bezit de algemene prompts en capturetemplates;
- `LeerpretEngine` bezit authenticatie, AI-calls, Project Buckets, autosave,
  mutatiegeschiedenis, previewgeneratie en simulatie.

LeerpretEngine vindt deze repository via `LEERBOX_EDITOR_DIR` of standaard als
buurmap `../LeerboxEditor`. De bestaande dashboard-URL blijft:

```text
http://127.0.0.1:8011/tools/architect-editor/
```

De editor gebruikt standaard `/api` op dezelfde origin. Bij zelfstandig
serveren kan een andere Engine-API via de queryparameter `?api=...` worden
doorgegeven. Voorbeeld:

```text
http://127.0.0.1:4174/?api=http://127.0.0.1:8011/api
```

Er is geen Git-submodule of automatische broncodesynchronisatie. Wijzig
editorcode hier; wijzig backendgedrag via een publieke route in
LeerpretEngine; wijzig de dashboardbuitenschil in Leerpret.

## Lokaal openen

Zonder backendfuncties kan `index.html` rechtstreeks in de browser worden
geopend. Voor een lokale HTTP-origin:

```powershell
python -m http.server 4174
```

Voor volledige integratie start je LeerpretEngine op poort `8011` en open je
de gemounte `/tools/architect-editor/`-URL. De Leerpret-frontend draait
standaard op poort `8001`.

De taalopzet staat in `languages.js`. De standaardtaal is nu `nl`; extra talen kunnen later als extra key onder `messages` worden toegevoegd.

De editor gebruikt een game-dashboard: de ontwikkelfase staat bovenin, het centrale bouwscherm combineert een VATT-toolbox, een sleepbaar netwerkcanvas en een inspector, en de vaste commandobalk onderin opent missie, spel, kern, onboarding, route, sensoren, controle, simulatie en data. Canvasposities worden per object bewaard als `editor_position`; onbekende extra velden blijven bij import en export intact.

## Werkwijze

Het linkermenu toont telkens één taakgebied rechts: beschrijving, AI-assistent, editorvelden, bouwblokken, controle, simulatie of JSON-uitvoer. Zo blijft de werkruimte compact terwijl alle onderdelen beschikbaar blijven.

1. Upload of plak de ruwe beschrijving van de leerarchitectuur.
2. Download de basisprompt en gebruik die met de ruwe beschrijving in een eigen LLM-omgeving.
3. Importeer de JSON-uitkomst en controleer de synchrone views: LaTeX, leerarchitectuur, gevatte leerbox en computertaal-statements.
4. Sleep start-, succes-, weerstands- en normale objecten naar de architectuurkaart. Pas objecten, route en afhankelijkheden via de inspector aan totdat de gevatte leerbox groen valideert.
5. Maak een vaste simulatieprompt, gebruik die in een eigen AI-omgeving, importeer de JSON-actiestroom en run de lokale test.

Met de knop `AI-prompt` kan iemand eerst een menselijke beschrijving via een LLM laten omzetten naar JSON. De knop `Download prompt` maakt dezelfde prompt als bestand, inclusief de actuele ruwe beschrijving en het huidige schema. De JSON bevat naast de capture ook een LaTeX-fallbackbeschrijving en computertaal-statements voor de volledige leerarchitectuur en de gevatte leerbox.

Als er al simulator-data bestaan, kan `Gebruik eerdere data` deze inladen. De editor waarschuwt dan expliciet dat zulke data mogelijk niet meer representatief zijn wanneer de leerboxdefinitie, objecten of afhankelijkheden inmiddels zijn aangepast.

De editor geeft geen ontwerpadvies. De simulatie-output is diagnostisch: objectherkenning, gedragsmarkers, archetype-ijking, radardiagram, interactiebeeld, formule-output en mogelijke bottlenecks. Een bezoek aan een conditioneel doel voordat alle harde voorgangers zijn gezien wordt als dependency-overtreding geregistreerd; dat doel telt in die stroom als afgeleid weerstandsobject.

## Interne Leerbox-agent

De handmatige knoppen `AI-prompt`, `Download prompt` en `Importeer JSON` blijven beschikbaar. Voor ingelogde Leerpretarchitecten en Leerprettechnologen controleert de editor daarnaast `/api/leerbox-agent/status`. Als Azure OpenAI bereikbaar is, begeleidt de agent de intake met dezelfde opnameprompt en hetzelfde `leerbox_capture_v5`-template. De testdatamodus kan een synthetische JSON-eventreeks maken en direct in het bestaande testpaneel laden.

De sleutel blijft uitsluitend in LeerpretEngine. Configureer lokaal in het
genegeerde `LeerpretEngine/.env`-bestand:

```dotenv
LEERPRET_OPENAI_API_KEY=...
LEERPRET_OPENAI_BASE_URL=https://<litellm-host>
# Optioneel; leeg betekent automatisch een beschikbaar chatmodel kiezen.
LEERPRET_OPENAI_MODEL=
```

Of gebruik een directe Azure OpenAI-verbinding:

```dotenv
LEERPRET_AZURE_OPENAI_API_KEY=...
LEERPRET_AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
LEERPRET_AZURE_OPENAI_DEPLOYMENT=<deployment-name>
LEERPRET_AZURE_OPENAI_API_VERSION=2024-10-21
LEERPRET_AGENT_MAX_OUTPUT_TOKENS=900
```

Voor de lokale migratie leest LeerpretEngine ook de oude namen
`AZURE_OPEN_AI_KEY`, `AZURE_OPEN_AI_ENDPOINT` en `AZURE_MODEL_NAME`. In een
deployment hoort de configuratie in omgevingsvariabelen of Azure Key Vault en
niet in Git.

Alleen de Leerprettechnoloog ziet na een call het extra traceblok. Headers worden daarin geschoond; de API-key wordt altijd als `[REDACTED]` weergegeven.

## Smart Importer en Project Bucket

Het werkmenu `Importeer bronnen` ondersteunt PDF-, DOCX-, PPTX-, XLSX-, ODS-, MD-, CSV- en TXT-documenten, publieke HTTPS-Git-repositories, websites en ZIP-archieven. De editor stuurt de actuele `leerbox_capture_v5` mee als bucketconfiguratie. De runtimeopslag staat standaard onder:

```text
../LeerpretEngine/storage/buckets/<leerbox_id>/
├── source_docs/
├── code_repo/
├── config.json
└── sources.json
```

Stel in productie `LEERPRET_BUCKET_ROOT` in op een persistent volume. De service is bewust achter de bestaande organisatie-authenticatie geplaatst. Uploadlimieten, toegestane extensies, ZIP-traversal/symlinks, archiefgrootte, repositorygrootte en private/locale netwerkadressen worden aan de backendgrens geweigerd.

Uploaden activeert nooit een AI-call. In de AI-assistent staat Project Bucket-context standaard uit. De gebruiker selecteert eerst de gewenste bronnen en geeft daarna eenmalig toestemming voor het volgende bericht; de schakelaar gaat direct na die call weer uit. Alleen de gekozen geëxtraheerde document-/webtekst en bekende tekst/codebestanden worden begrensd meegestuurd. Broninhoud wordt expliciet als onbetrouwbare kennisbron gemarkeerd; instructies die in een geïmporteerd bestand staan krijgen geen systeemgezag.

De actie `Vul lege velden uit bronnen` gebruikt een compacte, afzonderlijke systeemprompt. De volledige opnameprompt en het canonieke template gaan alleen mee bij de gewone capture-/intakeflow. De fill-agent retourneert alleen een hiërarchisch JSON-deelobject met voorgestelde aanvullingen; zo hoeft een grote capture niet binnen het uitvoertokenbudget te worden herhaald. Voor de kostenraming rapporteert de backend de actuele lengte van de fill-systeemprompt aan de editor.

De fill-modus heeft een afzonderlijk uitvoerbudget van standaard 8.000 tokens (`LEERPRET_AGENT_FILL_MAX_OUTPUT_TOKENS`, begrensd op 500–8.000). Dit is een maximum; de compacte patch kan eerder stoppen. Bij ondersteunde redeneermodellen vraagt de backend voor deze extractietaak minimale of lage redeneerinspanning. Eén ronde is begrensd op 25 veldvoorstellen en 10 nieuwe lijst-items; opnieuw uitvoeren kan resterende lege velden aanvullen.

Na iedere fill-call toont de editor een resultaatpopup met het werkelijk door de provider gemelde input-, output- en totaaltokengebruik. De kostenindicatie gebruikt het publieke standaardtarief van GPT-5.6 Sol in USD: $5 per miljoen inputtokens, $0,50 per miljoen cached inputtokens en $30 per miljoen outputtokens. Cache writes kosten 1,25× het gewone inputtarief. Boven 272.000 inputtokens rekent de editor 2× input en 1,5× output voor de volledige call. Priority processing, een ander model of contractafspraken kunnen afwijken; de popup is daarom geen providerfactuur. Bij een mislukte call toont de popup de foutmelding en, wanneer de provider die meestuurt, het reeds verbruikte tokenaantal.

Na de kostenpopup opent altijd het resultaatvenster van de broninvulling. Dit toont elk automatisch doorgevoerd leeg veld of nieuw lijst-item, markeert wijzigingen aan bestaande waarden als nog goed te keuren en vermeldt hoeveel velden nog leeg of `unknown` zijn. Een geslaagde AI-call betekent daardoor niet meer impliciet dat de hele onderwijsarchitectuur volledig is ingevuld.

De fill-respons bevat `_fill_meta.has_more`. Als de Agent expliciet meldt dat de bronnen na de huidige, begrensde ronde nog concrete invulling bevatten, toont het resultaatvenster `Verder invullen`. Die knop verwerkt eerst eventueel aangevinkte wijzigingen, sluit het venster en start daarna een nieuwe fill-call met opnieuw een kostenbevestiging en de inmiddels bijgewerkte capture. De knop blijft verborgen wanneer resterende lege velden niet uit de bronnen zijn te onderbouwen.

Bij ieder leeg of `unknown` invoerveld staat een kleine Agent-knop. Daarmee kan alleen dat veld worden ingevuld op basis van de actuele capture, eerdere Agent-gesprekscontext en de geselecteerde Project Bucket-bronnen. Ook voor deze gerichte call wordt vooraf een kostenindicatie en achteraf het werkelijke providergebruik getoond.

## Verrijkingsplan

Het venster **Plan** stelt voor iedere leerbox automatisch een verrijkingsplan samen vanuit de actuele onderwijsarchitectuur. Het plan begint met het vaste uitgangspunt dat een bestaande leerattractie in een leerbox wordt gevat, legt de rol van de Leerpretarchitect en de omzettingsstappen uit, beschrijft de herkende architectuur, vermeldt de geregistreerde en geïmporteerde bronnen en benoemt alleen verrijkingen die nog ontbreken. Per verrijking staat de verwachte invloed op de markers T, A, V, R en S. Een numerieke stijging wordt niet voorspeld zonder simulatie- of praktijkmetingen. De HTML-weergave, LaTeX-download en PDF gebruiken dezelfde actuele planinhoud.
