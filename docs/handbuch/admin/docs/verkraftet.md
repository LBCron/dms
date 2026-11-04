# Was Ablago verkraftet

Gemessen mit dem [Lasttest](lasttest.md) in drei Stufen: **klein** (Haushalt, 25 gleichzeitige Anfragen, 5.000 Mappen), **mittel** (Kleinbetrieb, 100 gleichzeitig mit Export nebenher, 50.000 Mappen) und **groß** (Last steigern bis zur Grenze, 200.000 Mappen). Die Spalten zeigen p95 – 95 % der Antworten waren schneller – und bei groß die Grenze in gleichzeitigen Anfragen, bei der 95 % der Antworten noch unter 3 s blieben.

Die erste Zeile misst das Projekt jede Woche auf den Rechnern von GitHub (Workflow *Lasttest*); dort laufen Ablago, PostgreSQL und der Lasttest auf demselben Rechner. Die übrigen Zeilen sind Meldungen von Betreibern – gesammelt im Issue [Messergebnisse Lasttest (#576)](https://github.com/motom001/dms/issues/576) und in [eigenen Meldungen](https://github.com/motom001/dms/issues?q=label%3Amessergebnis-lasttest), jede mit Version und Datum, denn neue Versionen können schneller oder langsamer sein.

Auf welchen Geräten das Projekt Ablago selbst prüft – und bis wann voraussichtlich –, zeigt das Installationshandbuch unter [Geprüfte Plattformen](https://help.ablago.app/installieren/aktuell/plattformen/).

| Gerät | CPU / Kerne | RAM | Speicher | Image | Ablago | klein p95 | mittel p95 | groß: Grenze | Stand |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| GitHub-Rechner (ubuntu-latest) | 4 Kerne (x64) | 16 GB | SSD | ohne Container, PostgreSQL 17 daneben | 0.139.0 | 95 ms | 2.384 ms | unter 25 (p95 3,2 s bei 25) | 02.11.2026, erster Lauf |

Du hast selbst gemessen? [Lasttest selbst durchführen](lasttest.md) beschreibt, wie es geht. Den Ergebnisblock fügst du als Kommentar in das Sammel-Issue [Messergebnisse Lasttest (#576)](https://github.com/motom001/dms/issues/576) ein – oder du legst mit der Vorlage [Messergebnis Lasttest](https://github.com/motom001/dms/issues/new?template=messergebnis-lasttest.yml) ein eigenes Issue an. Das Projekt trägt die Meldungen hier ein.

**So liest du die Tabelle:** Liegt *klein* unter 0,3 s, fühlt sich Ablago für einen Haushalt flüssig an. Liegt *mittel* unter 1 s, reicht das Gerät auch für einen kleinen Betrieb mit großen Exporten nebenher. Diese Werte sind das **Ziel** des Projekts. Die *Grenze* von groß ist kein Ziel für den Alltag – 100 gleichzeitige Anfragen sind schon 10–15 Personen, die im selben Moment klicken (siehe [Technik → Viele gleichzeitige Anfragen](technik.md#last)).

**Ziel und CI-Grenze:** Bei *klein* und *mittel* wird die wöchentliche Messung auf den Rechnern von GitHub erst rot, wenn sie die **CI-Grenze** verfehlt – den ersten Lauf dort plus 20 %: für *klein* 0,3 s (das Ziel hält sie schon), für *mittel* 2,86 s (gemessen 2,38 s, Ziel 1 s). Die CI-Grenze wird nur strenger, bis sie das Ziel erreicht; dass *mittel* das Ziel noch verfehlt, ist eine Aufgabe für die Entwicklung: Ablago dort schneller machen. Messwerte von anderen Geräten helfen dabei – melde sie im Sammel-Issue [Messergebnisse Lasttest (#576)](https://github.com/motom001/dms/issues/576).
