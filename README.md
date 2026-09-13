# Kamelenrace

Een Kahoot-stijl quiz waarbij de voortgang van elk team wordt weergegeven als een kamelenrace op het digiboard. Elk correct beantwoord vraagblok laat de kameel van dat team een stap vooruit lopen, op de maat van kermismuziek.

## Status

Fase 2: deelnemers joinen via hun eigen telefoon (URL of QR-code) met een spelcode, kiezen een team en beantwoorden vragen live mee. Firebase Realtime Database synchroniseert host en spelers.

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

1. Host opent het host-scherm, stelt het aantal teams + teamnamen in, klikt "Spel aanmaken".
2. Er verschijnt een 4-letter spelcode + QR-code. Spelers scannen/typen deze in op `player.html`, vullen hun naam in en kiezen hun team.
3. Host klikt "Start quiz". Bij elke vraag speelt de kermismuziek als timer; spelers beantwoorden op hun eigen scherm.
4. Zodra de muziek stopt, telt de host automatisch per team of de meerderheid het goed had — zo ja, loopt de kameel van dat team een stap vooruit.
5. Na de laatste vraag verschijnt het winnende team op zowel het host- als het spelerscherm.

## Eigen vragen aanleveren

Vervang `data/questions.json` door je eigen vragenset in hetzelfde formaat:

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

**Let op — huidige rules zijn volledig open** (`.read`/`.write`: `true`), praktisch voor testen maar niet geschikt om lang open te laten staan. Overweeg de rules aan te scherpen voordat je dit breed inzet, bijvoorbeeld door schrijven te beperken tot het toevoegen van nieuwe data (niet het overschrijven van bestaande games).

**Bekende beperking:** de juiste antwoorden staan in `data/questions.json`, dat door elke speler wordt opgehaald. Een speler die de netwerkverzoeken inspecteert kan dus in theorie vooraf de antwoorden zien. Voor een klassikale quiz is dit een acceptabele afweging; voor een setting waar dat een probleem is, is server-side validatie (bijv. via een Cloud Function) nodig.

## Muziek

De meegeleverde kermismuziek is afkomstig van QuickSounds.com (Standard License, attributie vereist). Credit staat in de footer van beide schermen: "Geluidseffect: quicksounds.com".
