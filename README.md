# De grote kamelenrace

Een Kahoot-stijl quiz waarbij de voortgang van elk team wordt weergegeven als een kamelenrace op het digiboard, in een woestijn-thema. Elk vraagblok waarbij de meerderheid van een team het goed heeft, laat de kameel van dat team een stap vooruit lopen, op de maat van kermismuziek.

## Status

Fase 2, uitgebreid getest en werkend, inclusief een belastingtest met bijna 50 gelijktijdige spelers (zie [Belastingtest](#belastingtest--schaal) hieronder). Deelnemers joinen via hun eigen telefoon (URL of QR-code) met een spelcode, kiezen zelf een team (2 t/m 10, geen voorinvulling — een team moet expliciet gekozen worden) en beantwoorden vragen live mee. Firebase Realtime Database synchroniseert host en spelers.

**Later aanhaken:** joinen kan niet alleen tijdens de lobby, maar de hele quiz door — een klein QR-code/spelcode-blokje blijft rechtsboven op het host-scherm zichtbaar zolang de race loopt, zodat weggevallen of nog niet aangesloten deelnemers alsnog kunnen meedoen. Wie mid-quiz binnenkomt, doet gewoon mee vanaf de eerstvolgende vraag.

**Herstel na verversen/crashen:** zowel het host- als het spelerscherm herstellen automatisch de actuele stand (huidige vraag, teamposities, wie al meedoet) als de pagina per ongeluk ververst wordt of de browser crasht — geen dataverlies, geen opnieuw hoeven joinen. Kanttekening: bij herstel start de muziek/timer van de actieve vraag opnieuw vanaf het begin, niet vanaf het punt waar hij gebleven was.

**Verbinding kwijt / kamer vol:** als een speler geen verbinding kan maken (bijv. omdat de gratis Firebase-verbindingslimiet bereikt is, zie hieronder), verschijnt na 6 seconden een duidelijke melding in plaats van een oneindig hangend scherm, en blijft de "Meedoen"-knop bruikbaar voor een nieuwe poging.

**Gedeelde winnaar:** eindigen twee of meer teams gelijk, dan worden ze allemaal als winnaar getoond ("Team Rood & Team Blauw winnen samen!") in plaats van willekeurig er één te kiezen.

Teamnamen en vragen kunnen als JSON geëxporteerd/geïmporteerd worden op het setup-scherm (zie [Eigen vragen aanleveren](#eigen-vragen-aanleveren)) — handig om thuis voor te bereiden en op school in te laden, ongeacht op welk apparaat.

## Structuur

```
index.html            Host-scherm (digiboard): setup, lobby/QR, race, winnaar
player.html            Speler-scherm: join, vraag beantwoorden, reveal
css/style.css           Gedeelde/host-styling, woestijnbaan, animaties
css/player.css          Speler-scherm styling
js/firebase-config.js   Firebase-configuratie + init
js/host.js              Host-logica: spel aanmaken, lobby, quizverloop, scoretelling, herstel
js/player.js            Speler-logica: joinen, antwoorden, reveal volgen, herstel, timeouts
data/questions.json     Standaard vragenset (AI-thema)
assets/kamelenrace.mp3  Kermismuziek, gebruikt als vraag-timer
assets/spectators.png   Publieksillustratie voor de racebaan
assets/winner.jpg       Illustratie voor het winnaarsscherm
```

## Lokaal draaien

Vanwege `fetch()` op `data/questions.json` moet dit via een lokale webserver (niet als los bestand openen):

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765` voor het host-scherm. Open `http://localhost:8765/player.html?game=CODE` (of scan de QR-code die het host-scherm toont) om als speler mee te doen — test dit vanaf een tweede apparaat of tweede browsertab.

De live versie staat op GitHub Pages: `https://martijnvanmourik.github.io/kamelenrace/`.

## Spelflow

1. Host opent het host-scherm, stelt het aantal teams (2-10) + teamnamen in, klikt "Spel aanmaken".
2. Er verschijnt een 4-letter spelcode + QR-code. Spelers scannen/typen deze in op `player.html`, vullen hun naam in en kiezen hun team.
3. Host klikt "Start quiz". Bij elke vraag speelt de kermismuziek als timer; spelers beantwoorden op hun eigen scherm.
4. Zodra de muziek stopt, telt de host automatisch per team of de meerderheid het goed had (van wie er daadwerkelijk antwoordde — wie wegvalt telt gewoon niet mee) — zo ja, loopt de kameel van dat team een stap vooruit.
5. Na de laatste vraag verschijnt het winnende team (of de winnende teams, bij een gelijke stand) op zowel het host- als het spelerscherm, met een illustratie.

Tijdens de race staat de baan links en een vaste zijbalk rechts (QR/spelcode voor laatkomers, plus óf de actieve vraag óf de uitslag — nooit beide tegelijk, om ruimte te sparen). Op een breed digibord schaalt deze indeling mee met de schermbreedte in plaats van gecentreerd te blijven staan, zodat de kamelen niet halverwege het scherm beginnen en de zijbalk mooi tegen de rechterrand aansluit.

## Vormgeving

De racebaan heeft een woestijnthema: zandkleurig baanoppervlak met verspreide steentjes en gelaagde, naadloos herhalende duinranden (CSS/SVG, geen losse plaatjes), een publieksillustratie tegen de bovenste lijn, en een finishvlag rechtsonder. Verticale start- en finishlijnen markeren precies waar de kamelen beginnen en eindigen. De achtergrond (publiek, zand, duinen) loopt altijd tot de volledige breedte van het scherm door — ook onder de zijbalk — terwijl de kamelen, banen en finishvlag zelf in een smallere kolom blijven zodat het spel nooit onder de zijbalk verdwijnt.

De baan heeft een vaste hoogte voor 10 teams, ongeacht het werkelijke aantal — die hoogte staat volledig los van de inhoud van de zijbalk, dus de baan springt nooit van grootte tussen het vraag- en het uitslagscherm. Is de uitslagkaart een keer hoger dan de baan (bijv. bij 10 teams), dan valt die er gewoon overheen in plaats van de baan op te rekken. Lange teamnamen worden altijd afgekapt met "...", en de naam van een kameel die over de helft van de baan is, klapt om naar de andere kant zodat hij nooit onder de zijbalk of van de baan af loopt. Alles is los getest op zowel smalle als brede (tot 1920px) schermen zodat niets overlapt of vervormt.

## Eigen vragen aanleveren

Op het setup-scherm kun je een eigen vragenset importeren via "Vragen importeren" (een `.json`-bestand in het formaat hieronder) — geen redeploy nodig, blijft bewaard in de browser tot je op "Standaardvragen" klikt. Gebruik "Vragen exporteren" om de actief geladen set (of de standaardset) als bestand te downloaden, bijvoorbeeld als startpunt om aan te passen. Hetzelfde exporteren/importeren kan voor teamnamen ("Teamnamen exporteren/importeren").

Los daarvan kan `data/questions.json` in de repo ook direct vervangen worden — dat wordt de nieuwe standaardset voor iedereen die geen eigen bestand importeert.

Formaat:

```json
{
  "title": "Titel van de quiz",
  "questions": [
    {
      "question": "Vraagtekst?",
      "options": ["Optie A", "Optie B", "Optie C", "Optie D"],
      "correctIndex": 1
    }
  ]
}
```

## Firebase

Gebruikt Firebase Realtime Database (gratis Spark-tier) als gedeelde state tussen host en spelers. De configuratie in `js/firebase-config.js` bevat geen geheime sleutels — dat is normaal voor client-side Firebase-apps; de beveiliging zit in de database-rules, niet in het geheimhouden van deze config.

**Rules:** scoped onder `/games/$gameCode` in plaats van open op de root, zodat niemand in één verzoek de hele database kan wissen:

```json
{
  "rules": {
    "games": {
      "$gameCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Binnen een spelcode is alles nog open (spelers kunnen elkaars antwoorden theoretisch overschrijven) — verdere verfijning (bijv. spelers mogen alleen hun eigen antwoord schrijven) vereist Firebase Auth, wat voor een kortlopende klasactiviteit vooralsnog bewust achterwege is gelaten.

**Verbindingslimiet:** het gratis Spark-abonnement staat maximaal **100 gelijktijdige verbindingen** toe (elk apparaat dat `player.html` of `index.html` open heeft, telt als 1 — REST-verzoeken tellen niet mee). Bij een groep van 30-40 spelers zit je daar ruim onder. Wordt die limiet ooit overschreden, dan wijst de server nieuwe verbindingen af; de app vangt dat sinds kort netjes af met een duidelijke melding in plaats van een hangend scherm (zie hierboven). Structurele oplossing bij grotere groepen: upgraden naar het Blaze-abonnement (in de praktijk nog steeds gratis bij normaal gebruik, alleen de harde limiet vervalt), of het spel herontwerpen naar één antwoord per team in plaats van per speler.

**Bekende beperking:** de juiste antwoorden staan in `data/questions.json` (of de geïmporteerde set), die door elke speler wordt opgehaald. Een speler die de netwerkverzoeken inspecteert kan dus in theorie vooraf de antwoorden zien. Voor een klassikale quiz is dit een acceptabele afweging; voor een setting waar dat een probleem is, is server-side validatie (bijv. via een Cloud Function) nodig.

## Belastingtest & schaal

Op 13 september 2026 is de app getest met een gesimuleerde belasting van tot 49 gelijktijdige spelers (10 teams, joins, antwoorden, laatkomers mid-quiz, en een paginaverversing tijdens de race). Kernresultaten:

- 40 spelers gelijktijdig joinen: 203 ms, 0 fouten
- 49 antwoorden gelijktijdig verwerkt: 234 ms, telling exact 49/49
- Host- en spelerscherm herstelden feilloos na een refresh tijdens de belasting
- Databaseomvang per spel (49 spelers, meerdere vragen): enkele tientallen KB — verwaarloosbaar op de gratis 1 GB-limiet

Let op: die test simuleerde spelers via de Firebase REST API, wat wél de databaseverwerking en de host-weergave test, maar **niet** de daadwerkelijke verbindingslimiet van 100 (REST-verzoeken houden geen verbinding open). Praktijkfactoren als wifi-kwaliteit, telefoonverschillen en het gelijktijdig scannen van de QR-code door een grote groep blijven het beste te testen met een kleinere groep echte telefoons vooraf.

## Muziek

De meegeleverde kermismuziek is afkomstig van QuickSounds.com (Standard License, attributie vereist). Credit staat in de footer van beide schermen: "Geluidseffect: quicksounds.com".
