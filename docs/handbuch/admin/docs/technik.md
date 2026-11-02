# Technik des DMS

Überblick für Betrieb und Support. Welche Versionen auf einem System tatsächlich laufen, zeigt die Werkbank unter **Technik** – dort lässt sich die Übersicht auch für ein GitHub-Issue kopieren.

## Bausteine

```
Browser ── HTTP ──▶ DMS-Container (Node.js) ──▶ PostgreSQL-Container
   React-Oberfläche        Fastify-API              Mappen, Typen, Benutzer,
   (im Image enthalten)    Dateien unter /data/…    Sitzungen, Protokolle
```

| Baustein | Technik | Wozu |
| --- | --- | --- |
| Oberfläche | React 19, gebaut mit Vite | Ablage, Werkbank, Profil – alles im Browser |
| Server | Node.js 24, Fastify 5, TypeScript (mit esbuild gebündelt) | Schnittstelle unter `/api`, liefert auch die Oberfläche aus |
| Datenbank | PostgreSQL 17, Zugriff mit postgres.js, SQL-Migrationen in `server/migrations` | Alle Daten außer den Dateien |
| Dateien | Feste Ordner `/data/files`, `/data/geheim`, `/data/sicherung` (Volumes, siehe [Installation](installation.md#ordner-und-volumes)); je Datei ihr SHA-256 als Name; optional der [Eingangsordner](eingangsordner.md) `/eingang` | Hochgeladene Dokumente, gleicher Inhalt nur einmal; Schlüssel; Sicherungen; Scans zum Abholen |
| E-Mail | nodemailer über SMTP zum Versenden; imapflow und mailparser über IMAP zum Abholen (beides optional, eingestellt in der Werkbank) | Einladungen, Passwort-Links, Hinweise, Mappen versenden; Mails aus [Postfächern](postfaecher.md) als Post abholen |
| Texterkennung | Tesseract (deu, eng) und poppler (pdftotext, pdftoppm) im Image; deutsche Volltextsuche von PostgreSQL | Volltext von PDFs, Scans und Bildern (#45) |
| PDF verkleinern | pdf-lib, pdftoppm (poppler) für die Bilder und qpdf (Apache-2.0) für die Struktur, beides im Image; kein Ghostscript | Große Scans kleiner machen (#393) |
| Schwärzen | pdftoppm und pdftotext (poppler) zum Rendern und für die Wortpositionen, Tesseract für Seiten ohne Text, pdf-lib zum Neuaufbau; kein MuPDF, kein Ghostscript (beide AGPL) | Stellen endgültig entfernen, Original bleibt (#392) |
| PDF bearbeiten | pdf-lib (MIT), nur über eine gemeinsame Stelle im Server gekapselt (#541); Bewertung der Alternativen im [Entwicklerhandbuch](https://motom001.github.io/dms/entwickler/aktuell/aufbau/#pdf-stelle) | Stempel, Export, Seiten bearbeiten, Schwärzen, Verkleinern, Vorschau, Auskunft, Aufkleber |
| Arbeiter | `node:worker_threads`, ohne zusätzliche Bibliothek: ein kleiner Pool neben dem Hauptfaden (#542), siehe [Systemzustand](speicherplatz.md#arbeiter-fur-pdf-und-exporte) | PDF-Arbeiten und große Exporte, ohne dass andere Benutzer warten |
| Verschlüsselung | AES-256-GCM (Node.js crypto), Schlüssel als Datei unter `/data/geheim` | Gespeicherte Passwörter (#39, #46) |
| Image | `node:24-alpine`, mehrstufig gebaut, für amd64 und arm64 – jede Architektur auf einem eigenen, passenden Rechner von GitHub (ohne Emulation), danach zu einem Image zusammengeführt | Läuft auf dem NAS neben dem PostgreSQL-Image |
| dms-komplett | Dasselbe Image mit PostgreSQL 17 (Alpine-Paket) im selben Container; Datenbank im Ordner `/data/postgres` | DMS und Datenbank in einem Container |
| Prüfungen | GitHub Actions: Typprüfung, Tests gegen PostgreSQL, Image-Bau | Jeder Push auf `main`, jeder Pull Request, jedes Versions-Tag und einmal pro Woche |

## Viele gleichzeitige Anfragen { #last }

Ein Haushalt hat 2–6 Benutzer, ein Kleinbetrieb 10–20. Ein Benutzer löst selbst schon mehrere Anfragen gleichzeitig aus (die Ablage öffnen sind 6–10), dazu kommen WebDAV-Programme, Pakete und Skripte. **100 gleichzeitige Anfragen** – etwa 10–15 Personen, die im selben Moment klicken – sind die realistische Obergrenze; dafür ist das DMS ausgelegt und wird regelmäßig gemessen (Lasttest, #544). Mehr kommt im Betrieb kaum vor, etwa bei einem falsch eingestellten WebDAV-Programm.

- **Überlastschutz:** Laufen schon **250** Anfragen gleichzeitig (`DMS_MAX_ANFRAGEN`), bekommt jede weitere sofort die Antwort „Das DMS ist gerade sehr beschäftigt. Bitte versuche es in ein paar Sekunden noch einmal.“ (HTTP 503 mit `Retry-After: 5`) – statt in einer immer längeren Warteschlange zu hängen, bis Browser und Programme aufgeben. So bleiben Antwortzeiten und Arbeitsspeicher begrenzt, und das DMS erholt sich von selbst, sobald die Last nachlässt. Die Gesundheitsprüfung des Containers wird nie abgewiesen. Greift der Schutz, steht höchstens einmal je Minute „Überlast: …“ im [Protokoll](fehlersuche.md#protokoll).
- **Verbindungen zur Datenbank:** höchstens **10** gleichzeitig. Im Lasttest mit 100 gleichzeitigen Anfragen lagen 5, 10 und 20 Verbindungen gleichauf: Der Engpass ist die Rechenzeit, die sich Server und PostgreSQL teilen, nicht die Zahl der Verbindungen. Jede Verbindung kostet PostgreSQL etwa 5–10 MB Arbeitsspeicher. Erst mit deutlich mehr Kernen (oder PostgreSQL auf einem eigenen Rechner) können mehr helfen: `DMS_DB_VERBINDUNGEN` (2–100; PostgreSQL erlaubt in der Vorgabe 100 Verbindungen insgesamt). Wie lange Abfragen auf eine freie Verbindung warten, zeigt **Werkbank → Datenbank-Anbindung** unter *Auslastung des Servers*.
- **Schwere Arbeit** wie PDF-Bearbeitung und große Exporte läuft in eigenen [Arbeitern](speicherplatz.md#arbeiter-fur-pdf-und-exporte), damit andere Benutzer nicht warten.
- Der **Anmeldeschutz** zählt auch unter Last jeden Fehlversuch; eine abgewiesene Anmeldung (503) prüft kein Passwort und zählt darum nicht.

## Schnittstelle

`/api/v1` für andere Programme (API-Schlüssel), Beschreibung unter `/api/openapi.json`. Die Oberfläche selbst nutzt interne Adressen unter `/api/…`, die sich ändern dürfen.

## Hilfe ohne Internet

Das Image bringt die Handbücher seiner Version mit: Startseite, Wie komme ich an ein DMS?, Benutzer-, Administrator- und Entwicklerhandbuch, erreichbar unter `/hilfe/` der eigenen Installation (z. B. `http://<NAS>:8080/hilfe/`), ohne Anmeldung und schon im Einrichtungsassistenten. Das Fragezeichen neben einer Überschrift und die Links auf das Handbuch öffnen diese Version. Sie kommt ohne Internet aus; nur die Bildschirmfotos fehlen – an ihrer Stelle steht ein Link auf dieselbe Seite online. Im Fuß jeder Seite geht es zur Online-Hilfe und zur neuesten Version.

## Module

Jede Zeile im [Protokoll](fehlersuche.md#protokoll) gehört zu einem Modul. Für jede Anfrage an den Server schreibt das DMS eine Zeile mit Methode, Pfad, Status, Dauer und Datenbankzugriffen – im Modul des Bereichs, zu dem die Anfrage gehört (z. B. `ablage` für Mappen). Anfragen, die nur lesen – auch Vorschauen, Zählungen und Testläufe, die die Oberfläche per POST schickt –, stehen nur auf Stufe `debug`, also nur im Debug-Modus.

| Modul | Was |
| --- | --- |
| `system` | Start, Einstellungen, Debug-Modus |
| `http` | Anfragen, die zu keinem anderen Modul gehören (z. B. Seiten der Oberfläche) |
| `konto` | Anmeldung, Sitzungen, Benutzer, Rollen, Vertretung |
| `ablage` | Mappen anlegen, ändern, löschen; Ansichten, Papierkorb, Notizen, Aufgaben |
| `werkbank` | Mappentypen, Demo-Daten, Einstellungen, Versionsabgleich |
| `dokumente` | Hochladen, Anzeigen, Löschen |
| `texterkennung` | Texterkennung: abgeschlossen, ausgelassen, fehlgeschlagen, neu gestartet, abgebrochen; Einstellungen |
| `sicherung` | Sicherung, Notfallblatt, Wiederherstellung und Probe |
| `datenbank` | Migrationen, Verbindung, lange Zugriffe |
| `mail` | Versand und Fehler beim Versand |

## Wo was steht

| Was | Wo |
| --- | --- |
| Protokoll dauerhaft | Container-Logs: `docker logs <app-container>` |
| Protokoll der letzten 24 Stunden | Werkbank → Protokoll |
| Lange Datenbankzugriffe | Werkbank → Datenbank-Anbindung (Tabelle `langlaeufer`) |
| Datenbank sichern | am besten über **Werkbank → Sicherung**; zusätzlich mit zwei Containern `docker exec <db-container> pg_dump -U dms dms > dms.sql`, bei dms-komplett `docker exec <container> pg_dump -h 127.0.0.1 -U dms dms > dms.sql` |
| Dateien sichern | Ordner `files` aus der Compose-Vorlage |

## Versionen und Aktualisierung

Das Image enthält Node.js, Alpine Linux und alle Bibliotheken; aktualisiert wird durch Neuziehen von `ghcr.io/motom001/dms:main` und Neustart.

- **Zwei Container (empfohlen):** PostgreSQL ist ein eigenes Image (`postgres:17`): kleinere Versionen (17.x) durch Neuziehen, unabhängig vom DMS.
- **dms-komplett:** PostgreSQL (Alpine-Paket) steckt im Image `ghcr.io/motom001/dms-komplett` und kommt mit dessen Updates. Beide Images werden jede Woche neu gebaut, mit den aktuellen Alpine-Paketen (Tag `main`); feste Versionsnummern ändern sich dabei nicht.
- Ein Wechsel der Hauptversion (z. B. 17 → 18) braucht in beiden Fällen eine Sicherung und Wiederherstellung, siehe [Wachsen und umziehen](wachsen.md#neue-hauptversion-von-postgresql).

Der Versionsabgleich in der Werkbank fragt nur auf Knopfdruck: GitHub für den Stand des DMS, [endoflife.date](https://endoflife.date) für Node.js, PostgreSQL und Alpine, die npm-Registry für die Bibliotheken. Er trennt, was du **selbst aktualisierst** (das DMS-Image, bei zwei Containern PostgreSQL), von dem, was **mit dem DMS kommt** (Node.js, Alpine, Bibliotheken – bei dms-komplett auch PostgreSQL).

Die Entscheidungen hinter dem Aufbau stehen in [entscheidungen.md](entscheidungen.md).
