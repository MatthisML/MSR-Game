# Spin Coach

Lern- und Analysetool für **3-Max Spin & Gold** (Hyper-Turbo, Winner-takes-all).
Hände nach der Session per Sprache oder Text eingeben, jede Entscheidung bewerten lassen, gezielt trainieren und den Lernfortschritt verfolgen.

> **Fair Play:** Gedacht für Review und Training abseits des Tisches. Hilfe während einer laufenden Hand (Real-Time-Assistance) verbieten die Pokerseiten, auch GGPoker.

## Starten

- **PC:** `index.html` im Browser öffnen (Chrome oder Edge für die Spracheingabe). Es braucht weder Server noch Build.
- **Handy:** Die App muss über HTTPS laufen, sonst gibt der Browser das Mikrofon nicht frei. Am einfachsten über GitHub Pages (siehe unten). Danach im Browser „Zum Startbildschirm hinzufügen“ wählen; die App läuft dann auch offline.

## Bereiche

| Bereich | Inhalt |
|---|---|
| **Review** | Hand per Sprache oder Text im festen Format eingeben. Der Coach spielt die Hand nach und bewertet jede deiner Entscheidungen (Richtig / Vertretbar / Fehler, EV-Verlust in BB, Begründung). Die Hand wird automatisch gespeichert. |
| **Trainer** | Zufällige Spots: Push/Fold, Call vs. All-in, Preflop mit tieferen Stacks, Postflop gegen Bet, Postflop erste Aktion. Bevorzugt werden Hände nahe an der Grenze der Range. |
| **Ranges** | 13×13-Raster aller Nash-Charts (1–25 BB) und der Modell-Ranges. Rote Punkte markieren Hände, bei denen du im Trainer Fehler gemacht hast. |
| **Statistik** | Trainer-Score pro Tag, Leak-Tabelle nach Spot-Art, Hand-Verlauf, Export/Import (JSON). |

## Festes Eingabeformat

```
Stack 18
Position Button
Hand Herz Ass Pik König
Button raise 2
Small Blind fold
Big Blind call
Flop Herz Dame, Pik Sieben, Karo Zwei
Big Blind check
Button bet 50 Prozent
Big Blind call
Turn Kreuz Neun
Big Blind bet 4
Ich call
```

- Stacks in BB: `Stack 18` oder `Stack Button 20 Small Blind 15 Big Blind 25`. Ohne Angabe gelten 25 BB.
- Heads-up: `Heads up`. Der Button ist dann der Small Blind.
- Karten: `Herz Ass`, `Ah`, ohne Farben `Ass König suited`.
- Aktionen: fold, check, call, bet, raise, all in (auch limp, shove, min raise). `raise 2` bedeutet *auf* 2 BB, `bet 3` setzt 3 BB. Relativ geht `bet 50 Prozent`, `bet halber Pot` oder `bet Pot`.
- `Ich` steht für deine Position. Fehlt ein Spieler, ergänzt der Coach Fold bzw. Check und weist darauf hin.
- Sprachbefehle: „auswerten“, „zurück“, „neue Hand“, „stopp“.

## Was steckt dahinter – und wie genau ist es?

| Spot | Methode | Genauigkeit |
|---|---|---|
| Push/Fold bis 10 BB, Call vs. All-in bis 25 BB | Nash-Gleichgewicht 3-Max und Heads-up, berechnet per Fictitious Play (`tools/gen-pushfold.js`) | Gleichgewicht im Push/Fold-Modell. Bei Winner-takes-all entspricht Chip-EV dem Turnier-EV. |
| Call vs. All-in mit echten Stacks und Pot | Equity gegen die Gleichgewichts-Range mit den echten Pot-Odds | exakt gegen diese Range |
| Preflop 11–25 BB (Open, Limp, Defend, Re-Shove) | Modell-Ranges plus EV-Rechnung (Fold-Equity, Equity, Realisierung) | Näherung |
| Postflop | Gegner-Range aus der Preflop-Linie, eingeengt durch jede Aktion; Equity (am Turn und River exakt), Pot-Odds, MDF, Draws, SPR, Board-Textur, Range-Vorteil | GTO-nahe Heuristik, **kein Solver** |

Annahmen: Blinds 0,5/1 BB ohne Antes. Bei ungleichen Stacks gilt der effektive Stack.
Jede Empfehlung zeigt in der App an, wie belastbar sie ist („Gleichgewicht“, „exakt“, „Näherung“).

## Daten

Alles liegt im `localStorage` des jeweiligen Browsers. Zum Übertragen zwischen Handy und PC: Statistik → Exportieren, dann auf dem anderen Gerät Importieren. Beim Import werden fehlende Einträge ergänzt, vorhandene bleiben erhalten.

## GitHub Pages (für das Handy)

Repository → Settings → Pages → „Deploy from a branch“, Branch wählen, Ordner `/ (root)`.
Die App liegt dann unter `https://<user>.github.io/<repo>/spin-coach/`.
Bei privaten Repositories ist Pages nur mit einem kostenpflichtigen GitHub-Plan verfügbar.

## Entwicklung

```
node --test tests/*.test.js         # Tests
node tools/gen-equity.js 12000 600  # Preflop-Equities (~1 min, schreibt js/data/eq2.js)
node tools/gen-pushfold.js 300      # Nash-Tabellen (~10 min, schreibt js/data/pushfold.js)
```

| Datei | Inhalt |
|---|---|
| `js/core/cards.js`, `eval.js`, `equity.js` | Karten, Handbewertung, Ranges, Monte-Carlo-Equity |
| `js/core/game.js` | Hand nachspielen: Pot, Reihenfolge, Spots |
| `js/input/parser.js`, `voice.js` | Festes Format, Spracherkennung (Web Speech API) |
| `js/strategy/preflop.js`, `postflop.js`, `coach.js` | Empfehlungen und Bewertung |
| `js/ui/*.js` | Oberfläche |
| `js/data/*.js` | generierte Tabellen |
