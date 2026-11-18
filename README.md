# MSR Werkjahr

Interaktives Lernspiel zur Vorlesung Mess-, Steuerungs- und Regelungstechnik (W213).
20 Tage zu je etwa 20 Minuten: erst messen (Tag 1–8), dann steuern (Tag 9–13), dann regeln (Tag 14–19), am Ende eine Probeklausur (Tag 20).

## Starten

`index.html` im Browser öffnen. Es wird kein Server und kein Build benötigt.
Der Spielstand liegt im `localStorage` des Browsers.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/content-messen.js`, `content-steuern.js`, `content-regeln.js` | Tage, Erklärungen, Aufgaben, Aufgabengeneratoren, Kurzerklärungen je Thema |
| `js/formulas.js` | Formelsammlung mit Gleichungsnummern des Skripts |
| `js/figures.js` | Skizzen (SVG) mit Erklärschritten |
| `js/sims.js` | Simulatoren (Zielscheibe, A/D-Wandler, Logikgatter, Grafcet, Tank, PID-Regler …) |
| `js/app.js` | Spielablauf, Aufgabentypen, Fehleranalyse, Werkstatt, Lernprotokoll |
| `js/lib.js` | Formelsatz, Diagramme, Regelkreis-Simulation |

## Fehleranalyse

Klappt eine Aufgabe nicht, fragt das Spiel nach dem Grund (Begriff, Formel, Umstellen, Einheiten, Rechenfehler, Aufgabenstellung).
Je nach Grund entstehen neue Übungen in der Werkstatt: Kurzerklärung, Formel-Check, geführte Rechenaufgabe oder dieselbe Aufgabe mit neuen Zahlen.

## Neue Aufgaben ergänzen

Eine Aufgabe ist ein Eintrag in `steps` eines Tages, z. B.

```js
tk('boole', 'mc', { q: 'Frage', opts: ['richtig', 'falsch'], a: 0, sol: 'Erklärung', hint: 'Tipp' })
```

Typen: `mc`, `multi`, `num`, `order`, `match`, `tt` (Wahrheitstabelle), `sim`.
Rechenaufgaben mit variablen Zahlen stehen als Generator in `MSR.gens` und werden mit `gn(thema, 'name')` eingebunden.

## Weiteres Projekt im Repository

`spin-coach/` – Lern- und Analysetool für 3-Max Spin & Gold (Hand-Review per Sprache, Trainer, Ranges, Statistik). Details in `spin-coach/README.md`.
