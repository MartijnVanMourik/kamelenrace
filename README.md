# Kamelenrace

Een Kahoot-stijl quiz waarbij de voortgang van elk team wordt weergegeven als een kamelenrace op het digiboard. Elk correct beantwoord vraagblok laat de kameel van dat team een stap vooruit lopen, op de maat van kermismuziek.

## Status

Fase 1 (huidige stand): een lokale, host-only demo. Eén scherm (bedoeld voor het digiboard) waarop de host zelf per vraag aanvinkt welke teams het goed hadden. Er is nog geen manier voor deelnemers om via hun eigen telefoon te antwoorden — dat komt in fase 2 met Firebase.

## Structuur

```
index.html          Host-scherm: setup, quizvragen, race-track, winnaar
css/style.css        Styling + animaties (kleuren per team, wiebel-animatie)
js/app.js            Quizlogica, timer, camel-positionering
data/questions.json  Vragenset (voorbeeld: AI-thema)
assets/              Muziek (kermismuziek, gebruikt als vraag-timer)
```

## Lokaal draaien

Vanwege `fetch()` op `data/questions.json` moet dit via een lokale webserver (niet als los bestand openen):

```bash
python3 -m http.server 8765
```

Open daarna `http://localhost:8765` in de browser.

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

## Volgende stap: Firebase

Voor fase 2 (100 deelnemers die via hun eigen telefoon antwoorden, teams joinen via een code, live gesynchroniseerd op het digiboard) wordt Firebase Realtime Database gebruikt als gedeelde state tussen host en spelers. Firebase-project en database zijn al aangemaakt; de web-app-configuratie wordt toegevoegd zodra de speler-flow gebouwd wordt.

## Muziek

De meegeleverde kermismuziek is afkomstig van QuickSounds.com. Controleer de licentievoorwaarden van dat bestand voordat je dit project buiten eigen gebruik (bijv. op school) publiekelijk inzet.
