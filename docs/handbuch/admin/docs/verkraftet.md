# Was das DMS verkraftet

Gemessen mit dem [Lasttest](lasttest.md) in drei Stufen: **klein** (Haushalt, 25 gleichzeitige Anfragen, 5.000 Mappen), **mittel** (Kleinbetrieb, 100 gleichzeitig mit Export nebenher, 50.000 Mappen) und **groß** (Last steigern bis zur Grenze, 200.000 Mappen). Die Spalten zeigen p95 – 95 % der Antworten waren schneller – und bei groß die Grenze in gleichzeitigen Anfragen, bei der 95 % der Antworten noch unter 3 s blieben.

Die erste Zeile misst das Projekt jede Woche auf den Rechnern von GitHub (Workflow *Lasttest*); dort laufen DMS, PostgreSQL und der Lasttest auf demselben Rechner. Die übrigen Zeilen sind [Meldungen von Betreibern](https://github.com/motom001/dms/issues?q=label%3Amessergebnis-lasttest) – jede mit Version und Datum, denn neue Versionen können schneller oder langsamer sein.

| Gerät | CPU / Kerne | RAM | Speicher | Image | DMS | klein p95 | mittel p95 | groß: Grenze | Stand |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| GitHub-Rechner (ubuntu-latest) | 4 Kerne (x64) | 16 GB | SSD | ohne Container, PostgreSQL 17 daneben | 0.132.0 | folgt | folgt | folgt | erster wöchentlicher Lauf steht aus |

Du hast selbst gemessen? [Lasttest selbst durchführen](lasttest.md) beschreibt, wie es geht und wie du das Ergebnis meldest. Das Projekt trägt die Meldungen hier ein.

**So liest du die Tabelle:** Liegt *klein* unter 0,3 s, fühlt sich das DMS für einen Haushalt flüssig an. Liegt *mittel* unter 1 s, reicht das Gerät auch für einen kleinen Betrieb mit großen Exporten nebenher. Die *Grenze* von groß ist kein Ziel für den Alltag – 100 gleichzeitige Anfragen sind schon 10–15 Personen, die im selben Moment klicken (siehe [Technik → Viele gleichzeitige Anfragen](technik.md#last)).
