# Kamelenrace

Een Kahoot-stijl quiz waarbij de voortgang van elk team wordt weergegeven als een kamelenrace op het digiboard. Elk correct beantwoord vraagblok laat de kameel van dat team een stap vooruit lopen, op de maat van kermismuziek.

## Status

Fase 2, getest en werkend: deelnemers joinen via hun eigen telefoon (URL of QR-code) met een spelcode, kiezen zelf een team (2 t/m 10, geen voorinvulling — een team moet expliciet gekozen worden) en beantwoorden vragen live mee. Firebase Realtime Database synchroniseert host en spelers. Getest met 10 gelijktijdige spelers (gesimuleerd via de Firebase REST API) inclusief live join-updates, realtime antwoord-telling en automatische scoretelling per team.

Teamnamen en vragen kunnen als JSON geëxporteerd/geïmporteerd worden op het setup-scherm (zie hieronder) — handig om thuis voor te bereiden en op school in te laden, ongeacht op welk apparaat.

**Herstel na verversen/crashen:** zowel het host- als het spelerscherm herstellen automatisch de actuele stand (huidige vraag, teamposities, wie al meedoet) als de pagina per ongeluk ververst wordt of de browser crasht — geen data-verlies, geen opnieuw hoeven joinen. Enige kanttekening: bij herstel start de muziek/timer van de actieve vraag opnieuw vanaf het begin, niet vanaf het punt waar hij gebleven was.

## Structuur

```
index.html            Host-scherm (digiboard): setup, lobby/QR, race, winnaar
player.html            Speler-scherm: join, vraag beantwoorden, reveal
css/style.css           Gedeelde/host-styling + animaties (kleuren per team, wiebel-animatie)
css/player.css          Speler-scherm styling
js/firebase-config.js   Firebase-configuratie + init
js/host.js              Host-logica: spel aanmaken, lobby, quizverloop, scoretelling
js/player.js            Speler-logica: joinen, antwoorden, reveal volgen
data/questions.json     Vragenset (voorbeeld: AI-thema)
assets/                 Muziek (kermismuziek, gebruikt als vraag-timer)
```

## Lokaal draaien

Vanwege `fetch()` op `data/questions.json` moet dit via een lokale webserver (niet als los bestand openen):

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765` voor het host-scherm. Open `http://localhost:8765/player.html?game=CODE` (of scan de QR-code die het host-scherm toont) om als speler mee te doen — test dit vanaf een tweede apparaat of tweede browsertab.

## Spelflow

1. Host opent het host-scherm, stelt het aantal teams (2-10) + teamnamen in, klikt "Spel aanmaken".
2. Er verschijnt een 4-letter spelcode + QR-code. Spelers scannen/typen deze in op `player.html`, vullen hun naam in en kiezen hun team.
3. Host klikt "Start quiz". Bij elke vraag speelt de kermismuziek als timer; spelers beantwoorden op hun eigen scherm.
4. Zodra de muziek stopt, telt de host automatisch per team of de meerderheid het goed had — zo ja, loopt de kameel van dat team een stap vooruit.
5. Na de laatste vraag verschijnt het winnende team op zowel het host- als het spelerscherm.

## Eigen vragen aanleveren

Op het setup-scherm kun je een eigen vragenset importeren via "Vragen importeren" (een `.json`-bestand in het formaat hieronder) — geen redeploy nodig, blijft bewaard in de browser tot je op "Standaardvragen" klikt. Gebruik "Vragen exporteren" om de actief geladen set (of de standaardset) als bestand te downloaden, bijvoorbeeld als startpunt om aan te passen.

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

**Bekende beperking:** de juiste antwoorden staan in `data/questions.json`, dat door elke speler wordt opgehaald. Een speler die de netwerkverzoeken inspecteert kan dus in theorie vooraf de antwoorden zien. Voor een klassikale quiz is dit een acceptabele afweging; voor een setting waar dat een probleem is, is server-side validatie (bijv. via een Cloud Function) nodig.

## Muziek

De meegeleverde kermismuziek is afkomstig van QuickSounds.com (Standard License, attributie vereist). Credit staat in de footer van beide schermen: "Geluidseffect: quicksounds.com".
