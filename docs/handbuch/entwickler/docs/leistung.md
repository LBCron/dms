# Leistung

Das DMS soll auch nach Jahren mit vielen Mappen flüssig bleiben. Dafür gibt es eine Messlatte, einen Test, der sie in der CI prüft, und ein Mess-Skript für genauere Messungen (#367).

## Messlatte

Bei **10.000 Mappen und 20.000–30.000 Dokumenten** (Volltext je Dokument 5–50 KB) gilt im Median:

| Vorgang | Grenze |
|---|---:|
| Mappe öffnen (`Dienst.holeMappe`) | 200 ms |
| Dokumentliste einer Mappe (`listeDokumente`) | 200 ms |

Das gilt auch, **während** im selben Prozess Demo-Daten mit Dokumenten entstehen und die Texterkennung läuft. Gemessen auf einem gewöhnlichen Rechner liegen die Werte heute im einstelligen Millisekundenbereich; die Grenze lässt Platz für ein langsames NAS.

Die Werte stehen als `MESSLATTE_MS` in `server/test/leistung-messen.ts`.

## Test in der CI

`server/test/leistung.test.ts` läuft mit `TEST_DATABASE_URL` (in GitHub Actions automatisch, sonst übersprungen). Er legt eine eigene Datenbank mit 1.200 Demo-Mappen und ihren Dokumenten an und

- misst „Mappe öffnen“ und die Dokumentliste – eine Überschreitung der Messlatte ist nur eine **Warnung** (`t.diagnostic` und `console.warn`), weil Laufzeiten je Rechner schwanken;
- prüft **fest**, dass Dokument-Listen keinen Volltext lesen (`DOKUMENT_SPALTEN` in `repo-pg.ts` ohne `volltext`, aber mit jeder anderen Spalte der Tabelle – eine neue Spalte muss dort ergänzt werden);
- prüft **fest**, dass der Export gebündelt liest: keine Zugriffe je Mappe oder Dokument (keine N+1-Abfragen).

Der Test dauert etwa 20 Sekunden.

## Mess-Skript

Für Messungen mit dem vollen Datenbestand und vorher/nachher-Vergleiche (aus `server/`):

```bash
MESS_DATABASE_URL=postgres://postgres:dms@127.0.0.1:5432/dmsmessung \
  node --import tsx test/leistungsmessung.ts --neu --mappen 10000 --export 2000 --explain --last
```

- `--neu` legt die Datenbank **neu** an (eine vorhandene gleichen Namens wird gelöscht) und erzeugt die Daten mit festem Startwert – gleiche Daten bei jedem Lauf. Das dauert einige Minuten (die Indizes der Volltextsuche).
- Ohne `--neu` wird der vorhandene Bestand gemessen, z. B. vor und nach einer Änderung.
- `--export N` misst den Export (wie „Meine Daten exportieren“) über die ersten N Mappen: Gesamtzeit, Zeit in der Datenbank und Zugriffe je Methode.
- `--explain` gibt die Pläne (`EXPLAIN (ANALYZE, BUFFERS)`) der wichtigsten Abfragen aus.
- `--last` misst dieselben Zugriffe noch einmal, **während** im selben Prozess Demo-Daten mit Dokumenten entstehen und die Texterkennung läuft (auf einer Kopie der Datenbank), dazu die Verzögerung der Ereignisschleife.

## Zeitmessung einer Anfrage

Jede Antwort einer Route trägt den Header `Server-Timing` (#11, #477):

```
vor;dur=0.1, app;dur=211.5, db;dur=154.7;desc="8", rechte;dur=2.6, json;dur=0.7, gesamt;dur=212.4
```

| Teil | Gemessen |
|---|---|
| `vor` | Eingang der Anfrage (Hook `onRequest`) bis Beginn des Handlers |
| `app` | Handler, enthält `db` und `rechte` |
| `db` | Summe der Datenbankzugriffe (`Messung.umhuelle`), in `desc` ihre Anzahl |
| `rechte` | Rechte auswerten (`Dienst.zugriff`, `rechteAn`, `rechteAnVielen`, `lesbare`), überlappende Aufrufe einmal, ohne die Datenbankzugriffe darin (`rechteMessen` in `messung.ts`) |
| `json` | `reply.send` bis zum Hook `onSend` – die Antwort in Text umwandeln |
| `gesamt` | Eingang bis `onSend` |
| `zs` | Nur bei Anfragen, die die Zahlen der Ansichten brauchen (#512): Dauer und in `desc` `treffer` (Zwischenspeicher) oder `neu` (gezählt) |

Wartet eine Anfrage, weil der eine Faden von Node.js gerade für eine andere rechnet, nimmt der Server sie erst danach an – das steckt dann nicht in `vor`, sondern in der „Leitung“ der Zeitmessung im Browser. Dafür misst `Auslastung` (`perf_hooks.monitorEventLoopDelay`) die Verzögerung der Ereignisschleife; Werkbank → Datenbank zeigt sie. Ganze Anfragen über der Schwelle für lange Zugriffe landen mit ihrer Aufteilung bei den Langläufern (`zugriff` beginnt mit `Anfrage:`).

Im Browser teilt `shared/src/zeitmessung.ts` die Zeit mit Resource Timing weiter auf: „Warten (Browser)“ (`startTime` bis `requestStart` ohne Verbindungsaufbau – der Browser schickt höchstens etwa 6 Anfragen gleichzeitig) und „Leitung“ (Hin- und Rückweg minus `gesamt`).

## Ladezeiten der Oberfläche

`server/test/ladezeiten.mjs` lädt Startseite, eine Liste und eine Mappe in Chromium als Administrator, als Mitglied mit Rolle und als Mitglied ohne Rolle (mit Regeln, die einen Lesefilter in SQL ergeben) und fasst Server-Timing je Seite zusammen. Gegen ein laufendes DMS mit frischer Datenbank:

```bash
DMS_URL=http://localhost:3100 CODE=<Einrichtungscode> node server/test/ladezeiten.mjs --einrichten --mappen 50000
DMS_URL=http://localhost:3100 N=5 node server/test/ladezeiten.mjs
```

**Messung zu #477** (50.000 Demo-Mappen ohne Dokumente, lokaler Rechner, Median aus 5 Ladevorgängen, Mittel aus zwei abwechselnden Durchgängen; Server = Summe aller Anfragen der Seite, sie laufen teils gleichzeitig):

| Seite | Wer | Laden vorher ms | Laden nachher ms | Server vorher ms | Server nachher ms | davon Rechte ms |
|---|---|---:|---:|---:|---:|---:|
| Startseite | Administrator | 562 | 360 | 659 | 464 | 2 |
| Startseite | Mitglied mit Rolle | 452 | 306 | 585 | 393 | 4 |
| Startseite | Mitglied ohne Rolle | 492 | 288 | 583 | 339 | 4 |
| Liste (4.120 Rechnungen) | Administrator | 636 | 401 | 770 | 520 | 2 |
| Liste (4.120 Rechnungen) | Mitglied mit Rolle | 504 | 328 | 687 | 385 | 4 |
| Liste (4.120 Rechnungen) | Mitglied ohne Rolle | 450 | 332 | 617 | 379 | 3 |
| Mappe öffnen | Administrator | 570 | 414 | 717 | 527 | 6 |
| Mappe öffnen | Mitglied mit Rolle | 584 | 362 | 890 | 470 | 5 |
| Mappe öffnen | Mitglied ohne Rolle | 441 | 325 | 650 | 443 | 4 |

Befund: Die Rechte-Auswertung im Arbeitsspeicher kostet je Seite nur wenige Millisekunden (unter 1 %); der Verdacht aus dem Issue hat sich nicht bestätigt. Die Zeit lag in der Datenbank, bei zwei Anfragen, die jede Seite der Ablage stellt:

- `/api/anstehend` lud **alle** Mappen jedes Typs mit Fristfeldern und filterte das Datum im Arbeitsspeicher. Jetzt holt `mappenMitDatum` nur Mappen mit einem Datum im Zeitraum (einzeln gemessen etwa 250 → 30 ms).
- `/api/sichten` zählte den Eingang mit einem `EXISTS` je Mappe; für Mitglieder mit Lesefilter lief der ganze Zähler dafür **ein zweites Mal** ohne Filter. Jetzt zählt eine Abfrage über die offenen Aufgaben den Eingang, einmal für alle.

Zielwert: Ein Mitglied lädt Startseite und Ablage bei gleichen Daten höchstens 10 % langsamer als der Administrator – erfüllt (sogar schneller, weil für den Administrator auch Fristen ohne Empfänger anstehen). Die Verzögerung der Ereignisschleife blieb bei 99 % unter 16 ms. Größter Posten ist jetzt `/api/sichten` (Zähler je Typ und Ansicht, 150–230 ms bei 50.000 Mappen, für alle Benutzer gleich). Das behebt #512 (nächster Abschnitt).

## Zahlen der Ansichten (#512)

Die Zahlen neben den Ansichten (`GET /api/sichten` → `Dienst.zaehler`) zählen mit **einer** Abfrage alle sichtbaren Ansichten per `count(*) FILTER (WHERE …)` über alle Mappen des Haushalts, dazu Typen, Eingang, Favoriten und Papierkorb – bei 50.000 Mappen 120–150 ms allein, unter Last der Seite 150–260 ms. Zwei Mittel:

1. **Nicht blockieren.** Die Oberfläche (`web/src/daten.tsx`) lädt Typen, Personen, Ansichten und den Rahmen (`GET /api/sichten/rahmen`: Papierkorb-Tage, Ansicht „Neue Post“ – ohne Zählen) und zeigt die Ablage; die Zahlen kommen danach (`zahlenDa`). Bis dahin steht an ihrer Stelle „…“ (`ZahlWarte`, Kacheln der Startseite ebenso), es springt nichts. Beim Neuladen bleiben die alten Zahlen stehen, bis die neuen da sind. Was aus den Zahlen etwas ableitet (Suchfeld der Liste, Belegung beim Entfernen eines Feldes), wartet nicht auf sie.
2. **Zwischenspeichern** (`server/src/zaehlerspeicher.ts`). Der **Stand des Haushalts** (`Haushaltsstand`) zählt hoch, sobald eine ändernde Methode des Repos fertig ist – der `Dienst` umhüllt sein Repo damit (`transaktion` zählt als Ganzes). Lesende und folgenlose Methoden (Historie, Ereignisse, Texterkennung, „gesehen“ …) stehen in `OHNE_FOLGEN`; eine neue Methode zählt, bis sie dort steht. Der Schlüssel je Eintrag: Benutzer, Rolle und ein Fingerabdruck von Lesefilter, verborgenen Ansichten und eigenen Rollen; gültig bei gleichem Stand und gleichem `heute`, also höchstens bis Mitternacht. Ansichten mit Datumsbezug (`heute`, Monat, Jahr, Frist) gelten höchstens 5 Minuten (`ZEITABHAENGIG_MS`), alle anderen höchstens 30 Minuten (`HOECHSTENS_MS`, Sicherheitsnetz für Änderungen an der Datenbank vorbei, etwa von Hand). Gleichzeitige Anfragen mit gleichem Schlüssel warten auf dieselbe Zählung. Ein Treffer kostet etwa 7 ms (Sitzung, Rechte, Ansichten laden), neu zählen 110–150 ms.

**Messung zu #512** (dieselben Daten wie #477, `server/test/ladezeiten.mjs`, Median aus 5 Ladevorgängen, davon der Median aus drei abwechselnden Durchgängen; im Lauf trifft der Zwischenspeicher bei allen Ladevorgängen nach dem ersten):

| Seite | Wer | Sichtbar vorher | Sichtbar nachher | Zahlen da vorher | Zahlen da nachher | `/api/sichten` vorher | `/api/sichten` nachher | Laden vorher | Laden nachher |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Startseite | Administrator | 388 | 273 | 337 | 176 | 213 | 56 | 460 | 312 |
| Startseite | Mitglied mit Rolle | 381 | 269 | 310 | 182 | 185 | 60 | 388 | 255 |
| Startseite | Mitglied ohne Rolle | 344 | 247 | 263 | 165 | 144 | 54 | 335 | 219 |
| Liste Rechnungen | Administrator | 392 | 277 | 303 | 237 | 201 | 80 | 427 | 396 |
| Liste Rechnungen | Mitglied mit Rolle | 385 | 263 | 302 | 141 | 189 | 36 | 405 | 226 |
| Liste Rechnungen | Mitglied ohne Rolle | 312 | 271 | 264 | 155 | 146 | 36 | 374 | 261 |
| Mappe öffnen | Administrator | 875 | 284 | 305 | 134 | 201 | 30 | 445 | 282 |
| Mappe öffnen | Mitglied mit Rolle | 882 | 324 | 302 | 165 | 179 | 43 | 409 | 282 |
| Mappe öffnen | Mitglied ohne Rolle | 487 | 283 | 293 | 153 | 173 | 33 | 439 | 268 |

*Sichtbar* = bis Kacheln, erste Zeile der Liste bzw. Kopf der Mappe zu sehen sind; *Zahlen da* = bis die Antwort von `/api/sichten` im Browser ist; `/api/sichten` = Server-Zeit dieser Anfrage (unter Last der Seite; allein 6–9 ms bei einem Treffer); *Laden* = bis keine Anfrage mehr läuft. Alle Werte in ms, lokaler Rechner. „Sichtbar“ schwankt bei „Mappe öffnen“ stark (einzelne Läufe um 870 ms in beiden Fassungen).

Nicht umgesetzt: **nur zählen, was zu sehen ist** (eingeklappte Gruppen, geschlossene Ansicht-Auswahl am Handy) – mit 1 und 2 wartet die Ablage nicht mehr auf die Zahlen, und ein Treffer kostet einstellige Millisekunden; ein Teilzählen würde den Zwischenspeicher nur aufsplitten. Auch ein **Index** für einzelne Bedingungen lohnt nicht: Die eine Abfrage liest ohnehin alle Mappen des Haushalts einmal (Seq Scan), und sie läuft nur noch nach Änderungen.

## Anstehend als Kalender (#528)

Monat und Jahr in „Anstehend“ laden ihren Zeitraum mit **einer** Anfrage: `GET /api/anstehend?von=…&bis=…` (höchstens 400 Tage, `zeitraumProblem` in `shared/src/kalender.ts`). Der Server holt wie die Liste nur Mappen mit einem Datum im Zeitraum (`mappenMitDatum`, #477); für Felder mit **wiederkehrender** Frist zusätzlich alle Mappen mit einem Datum bis zum Ende des Zeitraums, denn deren künftige Termine (`folgetermine` in `shared/src/fristen.ts`, Datum + k · Abstand) können hineinfallen. Gespeichert werden diese Termine nie. Die Antwort liegt wie die Zahlen der Ansichten im Zwischenspeicher (`Zaehlerspeicher`), je Benutzer, Rechte und Zeitraum; ein eigener `Haushaltsstand` (`fristenstand`) zählt zusätzlich bei geänderten Erinnerungen (`ZAEHLT_FUER_ANSTEHEND`), weil die sonst in `OHNE_FOLGEN` stehen.

**Messung zu #528** (dieselben Daten wie #477: 50.000 Demo-Mappen, lokaler Rechner; Median aus 5 Anfragen; *kalt* = je Anfrage ein neuer Zeitraum, *Treffer* = derselbe Zeitraum aus dem Zwischenspeicher; Zeit bis zur vollständigen Antwort):

| Abfrage | Wer | Einträge | davon Folgetermine | kalt ms | Treffer ms |
|---|---|---:|---:|---:|---:|
| Liste 30 Tage | Administrator | 545 | – | 32 | 9 |
| Monat | Administrator | 934 | 377 | 160 | 9 |
| Jahr | Administrator | 11.863 | 11.863 | 381 | 81 |
| Monat | Mitglied mit Rolle | 0 | 0 | 74 | 6 |
| Jahr | Mitglied mit Rolle | 0 | 0 | 141 | 6 |
| Monat | Mitglied ohne Rolle | 0 | 0 | 81 | 6 |
| Jahr | Mitglied ohne Rolle | 0 | 0 | 120 | 7 |

Der Administrator ist der ungünstigste Fall: Ihm gehören alle Fristen ohne Empfänger, bei den Demo-Daten fast alle Verträge mit jährlicher Kündigungsfrist. Das Jahr ist dann 3,2 MB JSON (ohne Kompression); im Browser steht die Jahresansicht trotzdem nach etwa 0,1–0,2 s, der Monat nach 0,1–0,3 s. Die Mitglieder haben in den Demo-Daten keine eigenen Fristen; ihre Zeit ist das Suchen der Kandidaten. In einem Haushalt mit einigen Dutzend Fristen liegt alles im Bereich der Liste.

## Lasttest { #lasttest }

`server/test/lasttest.mjs` (#544, #563) schickt viele **gleichzeitige HTTP-Anfragen** an ein laufendes DMS – das Gegenstück zum Mess-Skript, das einzelne Datenbankzugriffe misst. Ohne Abhängigkeiten, nur mit `fetch` von Node.js. Im Image steckt es als Befehl `dms-lasttest` (Betreiber: Administratorhandbuch → [Lasttest selbst durchführen](https://motom001.github.io/dms/admin/aktuell/lasttest/)).

**Lasttest-Modus** (#612): Mit `DMS_LASTTEST=klein|mittel|gross|alle` lauscht das DMS nur auf 127.0.0.1 (freier Port) und startet das Skript als Kindprozess (`fork`, IPC) gegen diese Adresse; unter dem eigentlichen Port gibt es nur die Seite mit Fortschritt und Ergebnis (`server/src/lasttestmodus.ts`, `web/src/lasttest.tsx`, gemeinsame Typen in `shared/src/lasttest.ts`). Das Skript meldet seine Schritte mit `process.send` (nur mit IPC-Kanal, auf der Konsole ändert sich nichts) und schickt am Ende Bericht und Ergebnisblock mit den Platzhaltern `{{geraet}}` und `{{speicher}}`, die die Seite füllt. Vorher prüft `lasttest.mjs --pruefen` die Sperre der echten Ablage, ohne etwas anzulegen; schlägt sie an, startet das DMS normal und meldet den Grund in der Werkbank-Übersicht (`lasttestAbbruch`). `DMS_LASTTEST_DAUER` entspricht `--dauer`. Tests: `lasttestmodus.test.ts`, mit PostgreSQL `lasttestmodus-e2e.test.ts` (Stufe klein mit 3 s Messdauer, etwa eine Minute).

```bash
# DMS frisch starten (eigene, leere Datenbank), dann eine Stufe oder alle – das Skript richtet selbst ein
# und legt die Demo-Mappen je Stufe dazu (5.000, 50.000, 200.000; 2 % mit einem Brief als PDF)
node server/test/lasttest.mjs klein --ziel http://127.0.0.1:3100 --grenzen
node server/test/lasttest.mjs alle --ziel http://127.0.0.1:3100 --dauer 120 --bericht bericht.md --json lasttest.json --grenzen
```

Ein passendes DMS startet man aus `server/` mit eigener, leerer Datenbank (z. B. `dmslast`): `NODE_ENV=production DMS_DATENWURZEL=/tmp/dmslast DMS_EINRICHTUNGSCODE=aus DATABASE_URL=postgres://…/dmslast PORT=3100 node dist/index.js` nach `npm run build -w server`. Die Datenbank danach wieder löschen.

**Schutz der echten Ablage:** Ist das DMS frisch, richtet der Test es ein (Haushalt „Lasttest“, Konten mit Persona-Namen unter `example.org`, Beispiele, eine Rolle, Regeln wie in einem Haushalt). Ist es schon eingerichtet, misst er nur, wenn er sich mit seinem Administrator-Konto anmelden kann und höchstens 200 Mappen keine Demo-Mappen sind – sonst Abbruch mit Exit-Code 2, ohne etwas anzulegen. Nach neuen Demo-Mappen wartet er, bis die Arbeit im Hintergrund (Texterkennung, Vorschaubilder) vorbei ist.

**Profil:** Jede „Person“ schickt eine Anfrage nach der anderen, gemischt wie im Alltag – Startseite (`/api/startseite`, `/api/sichten`, `/api/anstehend`, `/api/typen`) 15 %, Liste einer Ansicht 25 %, Mappe öffnen 25 %, Suche 15 %, Vorschaubild 10 %, Dokument herunterladen 10 %; ein Drittel als Administrator, der Rest als Mitglied (mit Lesefilter). „100 gleichzeitig“ heißt: 100 Anfragen sind ständig unterwegs. Bekommt eine Person 503, wartet sie, wie `Retry-After` sagt.

**Stufen** (#563; die Stufen „normal“ und „Überlast“ aus #544 gehen darin auf, `--stufe normal` bzw. `ueberlast` laufen als `mittel` bzw. `gross`)

| Stufe | Was | Daten | Geprüft (`--grenzen`) |
| --- | --- | --- | --- |
| klein | 25 gleichzeitig, `--dauer` Sekunden | 5.000 Mappen | **Ziel:** p95 < 300 ms. **CI-Grenze:** p95 300 ms, keine Fehler (kein 5xx, keine Anfrage ohne Antwort), keine 503 |
| mittel | 100 gleichzeitig, nebenher ein großer Export nach dem anderen: PDF von bis zu 1000 Mappen mit Übersicht, PDF der Mappen mit Dokumenten, ZIP der größten Ansicht | 50.000 Mappen | **Ziel:** p95 < 1 s. **CI-Grenze:** p95 2.860 ms, Fehlerquote < 0,1 %, keine 503, jeder Export gelingt |
| groß | 5, 10, dann ab 25 gleichzeitig alle `--schritt-dauer` (120) Sekunden 25 mehr (`--start` beginnt genau dort), bis p95 > 3 s, Fehlerquote > 1 % oder der Überlastschutz greift (503); danach 1000 gleichzeitig (höchstens 60 s) mit Anmeldeschutz-Probe, dann Erholung | 200.000 Mappen | **Messung:** Grenze = höchste Stufe ohne Abbruch; mit `--vorher` Warnung, wenn sie mehr als 20 % unter der des letzten Laufs liegt. **Pflicht:** keine Anfrage ohne Antwort nach 60 s, Arbeitsspeicher des DMS ≤ 1,5 GB, Server bleibt erreichbar, Erholung (20 Anfragen in Folge mit p95 ≤ 1 s) innerhalb von 30 s, Anmeldeschutz sperrt nach falschen Passwörtern auch das richtige (429) |

Ausgabe je Durchgang: Anfragen, je Sekunde, Median, p95, p99, Fehlerquote (5xx und ohne Antwort), abgewiesen (503, mit `Retry-After`), Verzögerung der Ereignisschleife (p99 und höchstens), Warten auf eine Verbindung zur Datenbank, Arbeitsspeicher des DMS (Start, höchstens, Ende), dazu Dauer und Größe jedes Exports und Median/p95 je Art. Die Werte des Servers liest der Test alle 2 Sekunden über `GET /api/werkbank/last`. Am Ende steht der **Ergebnisblock** zum Kopieren – ohne Adresse des Ziels, ohne Namen; das CPU-Modell nur, wenn der Test auf demselben Rechner läuft. Mit `--json` alles als Datei (auch Eingabe für `--vorher`), mit `--gleichzeitig <n>` (und `--ohne-export`) ein einzelner Durchgang.

**Warum diese Grenzen:** klein und mittel sind eine **Qualitätszusage** (Thomas, #563): Ein Haushalt soll das DMS flüssig erleben, ein Kleinbetrieb auch mit Export nebenher. Die **Ziele** (p95 < 0,3 s bzw. < 1 s) sind deutlich strenger als die großzügigen Grenzen aus #544 (p95 ≤ 5 s bzw. 6 s, Fehlerquote ≤ 1 %). Weil schon der erste Lauf auf den Rechnern von GitHub das Ziel von mittel verfehlte, gilt für den Exit-Code eine eigene **CI-Grenze** (Entscheidung Thomas, #563): erster GitHub-Lauf + 20 % (Run 41448183378, DMS 0.139.0: klein p95 95 ms → bleibt beim Ziel 300 ms; mittel p95 2384 ms → 2860 ms). Sie wird nur strenger, nie lockerer, bis sie das Ziel erreicht. Ein verfehltes Ziel steht im Bericht (Abschnitt „Ziel verfehlt“, im Workflow als Hinweis) und führt zu einem Folge-Issue „Beschleunigen“; rot wird der Lauf nur über der CI-Grenze. Beides steht in `STUFEN` (`ziel`, `ciGrenze`) in `server/test/lasttest.mjs`, geprüft von `server/test/lasttest-grenzen.test.ts`. Groß ist dagegen eine **Messung**: Wo die Grenze liegt, hängt an der Hardware; der Lauf meldet sie und warnt bei deutlicher Verschlechterung, statt rot zu werden. Lokal, auf einem belasteten Rechner mit 2 Kernen, lagen klein bei p95 525 ms und mittel bei p95 4,7 s – nicht aussagekräftig, aber ein Hinweis, dass ein Rechner mit 2 Kernen die Zusage für mittel nicht schafft.

**Überlastschutz** (`server/src/ueberlast.ts`): Mehr als `DMS_MAX_ANFRAGEN` (250) gleichzeitige Anfragen an `/api/` und `/webdav` beantwortet ein Hook vor allem anderen sofort mit 503 und `Retry-After: 5`. Gezählt wird vom Eingang bis die Antwort fertig oder die Verbindung zu ist (`close`). Ausgenommen: `/api/gesundheit` und `/api/werkbank/last`. Dazu nimmt der Server neue Verbindungen mit einer längeren Warteschlange an (`backlog: 2048` statt 511). Programme, die `Retry-After` nicht beachten und sofort wieder fragen, bekommen ebenfalls sofort ihre 503; auf dem Testrechner mit 2 Kernen blieben dann bei 1000 gleichzeitig rund 1–2 % der Anfragen nach 60 s ohne Antwort, obwohl der Server keine Anfrage länger als 15 s bearbeitete – der Lasttest selbst (im selben Rechner) kam mit dem Verbindungsaufbau nicht mehr hinterher.

**Verbindungen zur Datenbank** (`server/src/db.ts`): Vorgabe 10, einstellbar mit `DMS_DB_VERBINDUNGEN` (2–100). Gemessen bei 100 gleichzeitig ohne Export, je zwei Runden: 5 Verbindungen 3.894–4.117 Anfragen je Minute (p95 2,7–2,9 s), 10 Verbindungen 3.516–3.726 (p95 2,9–3,1 s), 20 Verbindungen 3.512–3.517 (p95 2,9 s) – gleichauf im Rahmen der Schwankung. `Verbindungswarten` misst alle 5 Sekunden mit `SELECT 1`, wie lange eine Abfrage auf eine freie Verbindung wartet (einschließlich Hin- und Rückweg und Wartezeit der Ereignisschleife); Werkbank → Datenbank-Anbindung zeigt Median und Höchstwert der letzten Minute.

**Workflow** `.github/workflows/lasttest.yml`: wöchentlich (mittwochs nachts) und von Hand („Run workflow“, wahlweise Stufe und Dauer) – nicht bei jedem Pull Request, weil die Rechner von GitHub schwanken und ein Lauf gut eine Stunde dauert. Er startet PostgreSQL 17 als Dienst, baut den Server, misst alle drei Stufen mit `--grenzen` (CI-Grenze von klein oder mittel oder eine Pflicht verfehlt → Lauf rot; Ziel verfehlt → Hinweis) und hängt den Bericht an den Lauf (Zusammenfassung; Bericht, JSON und Protokoll des DMS als Artefakt). Die Grenze von groß merkt er sich im Cache (`lasttest-gross-…`) für die Warnung beim nächsten Lauf. Vor einem größeren Release von Hand starten.

**Beschleunigt in #615** (Suche und „Mappe öffnen“ unter Last): Gemessen mit Stichproben aus `pg_stat_activity` während des Laufs, `EXPLAIN ANALYZE`, Server-Timing und einem CPU-Profil des Servers (`--cpu-prof`). Die Ursachen, in der Reihenfolge ihres Gewichts:

1. **Suche faltete jede Mappe neu.** Titel und jeder Wert gingen bei jeder Suche durch `dms_falte` (unaccent) und `jsonb_each_text` – rund 200 ms Rechenzeit der Datenbank je Abfrage bei 20.000 Mappen, und eine Suche braucht zwei bis fünf Abfragen (Zählen, Seite, ohne Treffer noch einmal mit ähnlichen Wörtern). Jetzt steht der gefaltete Text in `mappen.suchtext` (Migration 055, Trigger); die Suche filtert damit vor und vergleicht danach wie bisher genau je Titel und Wert – dieselben Treffer, 10–15 ms je Abfrage. Mit Suche sortiert PostgreSQL erst nach dem Filtern (Teilabfrage mit `OFFSET 0`): Der allgemeine Plan einer vorbereiteten Abfrage ging sonst bei seltenen Begriffen den Titel-Index ganz durch (über 100 ms).
2. **Schreiben unter Last.** Jeder Langläufer war ein eigenes INSERT mit eigenem Commit – unter Last fast jede zweite Anfrage, das bremste die Datenbank gerade dann (Warten auf `WALWrite`/`WALSync`). Jetzt gesammelt. „Mappe öffnen“ schreibt „Zuletzt geöffnet“ und „gesehen“: Beides ist jetzt je eine Anweisung ohne Warten auf die Platte (`ohneWarten` in `repo-pg.ts`); vorher hielten die Commits die Zeile des Benutzers so lange gesperrt, dass gleichzeitige Anfragen desselben Benutzers aufeinander warteten (`Lock:transactionid`).
3. **Listen sortierten alle Mappen einer Ansicht.** Mit `typ_id = ANY(…)` nutzt PostgreSQL 16 den Index `(haushalt_id, typ_id, lower(titel))` nicht für die Reihenfolge; ein einzelner Typ steht deshalb als Gleichheit in der Abfrage (`typIn`): eine Seite der größten Ansicht 1 ms statt 45 ms.
4. **Doppelte Zugriffe je Anfrage.** Mappentypen und Rollen des Benutzers liest der Zugriff schon (`z.typen`, `z.a`); Liste und „Mappe öffnen“ lesen sie nicht noch einmal. „Mappe öffnen“ liest die Aufgaben der Mappe einmal (für die Regel „mit Aufgabe“, die Antwort und „gesehen“) und prüft Rückverweise und Bezüge in einem Zugriff: 15 statt 19 Zugriffe (Mitglied 18 statt 24), die Liste 10 statt 12. Die Startseite fragt nur noch, ob es eine eigene Mappe gibt, statt alle Mappen je Typ zu zählen; `heuteIn` legt sein `Intl.DateTimeFormat` nur einmal an (vorher gut 3 % der Rechenzeit des Servers).

Lasttest mittel auf dem Testrechner (2 Kerne, Lasttest auf demselben Rechner, PostgreSQL 16): p95 vorher 3,9 s, nachher 0,75 s (120 s je Lauf); Zahlen je Aktion in den Release-Notes von #615. Danach ist der eine Faden von Node.js der Engpass (Antworten in JSON wandeln, Masken für Passwörter, Socket-Schreiben von postgres.js), nicht mehr die Datenbank.

**Messung zu #542** (Arbeiter-Pool, vorher/nachher abwechselnd gemessen): Bei 10 gleichzeitigen Anfragen mit Export sank p95 von 2.172 auf 786 ms und die Verzögerung der Ereignisschleife (p99) von 1.373 auf 135 ms; Einzelheiten in den Release-Notes von #542.

## Regeln

- **Kein `SELECT *` auf Tabellen mit großen Spalten.** Dokumente immer mit `DOKUMENT_SPALTEN`, Mappen mit `MAPPEN_SPALTEN` (ohne `suchtext`, #615); den Volltext nur über `volltext(id)` oder gebündelt über `volltexte(ids)` lesen. EXPLAIN zeigt das nicht: Der Volltext liegt ausgelagert (TOAST) und wird erst beim Senden an den Server entpackt.
- **Nicht alle Mappen laden, um im Arbeitsspeicher zu filtern.** Was sich in SQL eingrenzen lässt (Datum im Zeitraum, offene Aufgaben), grenzt die Abfrage ein (#477: `mappenMitDatum`, Eingang im Zähler).
- **Keine Zugriffe in Schleifen über Mappen oder Dokumente.** Für Massenarbeit gibt es gebündelte Methoden (`dokumenteVon`, `volltexte`, `versionenVonDokumenten`, `notizenVon`, `aufgabenVonMappen`, `historieVon`). Ein Zugriff kostet auch lokal etwa eine halbe Millisekunde – bei 10.000 Mappen sind das Sekunden.
- **Nach Massenläufen die Statistik auffrischen:** `Dienst.aktualisiereStatistik()` (Demo-Daten erzeugen und entfernen; die Wiederherstellung macht es selbst). Für `dokumente` nur über die Spalten in `STATISTIK_SPALTEN`: Ohne Spaltenliste berechnet PostgreSQL auch die Statistik des Index `to_tsvector('german', volltext)` – über eine Minute bei 20.000 Dokumenten statt 0,1 Sekunden.
- **Lange Rechenarbeit gibt nach.** Server und Oberfläche teilen sich einen Node-Prozess: Was die Ereignisschleife blockiert, verzögert jede Anfrage – und erscheint in der Messung der Datenbankzugriffe als „langer Zugriff“, obwohl die Datenbank schnell war. Schleifen über viele Elemente geben mit `takt()` (`server/src/demo.ts`) oder `setImmediate` nach; große Daten werden mit dem asynchronen `zlib` gepackt statt im Hauptthread.
- **Schwere Arbeit in den Arbeiter.** Was Sekunden rechnet (PDF, große Tabellen), gehört in den [Arbeiter-Pool](aufbau.md#arbeiter-pool) (#542), nicht in den Hauptfaden – auch nicht mit Pausen.
- **Was der Zugriff schon weiß, nicht noch einmal lesen** (#615): Mappentypen (`z.typen`, außer für Dienstkonten – die sehen nur ihre) und die Auflösung mit Rollen und Datum (`z.a`).
- **Merkposten ohne Warten auf die Platte** (#615): Was bei einem Absturz verloren gehen darf („Zuletzt geöffnet“, „gesehen“), schreibt eine einzige Anweisung mit `ohneWarten(sql)` in `FROM`. Nie für Daten, die der Benutzer eingegeben hat, und nicht in einer Transaktion (dort wirkt es nicht).
- **Kein `indexOf` in Sortierungen über viele Elemente.** `liste.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))` ist quadratisch: Bei 20.000 Mappen sind das Sekunden bis über eine halbe Minute im Hauptfaden (#542). Erst einen Index bauen (`inReihenfolge` in `dienst.ts`).
