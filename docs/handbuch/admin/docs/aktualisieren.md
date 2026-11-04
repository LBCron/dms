# Aktualisieren und Sichern

--8<-- "ausgeblendet-schritt.md"

## Aktualisieren

1. **Vorher sichern:** **Werkbank → [Sicherung](sicherung.md) → Jetzt sichern.** Das ist dein Rückweg, falls nach dem Update etwas nicht stimmt – dauert meist nur Minuten.
2. Lies unter [Releases](https://github.com/motom001/dms/releases), was sich geändert hat.
3. Schalte den [Wartungsmodus](wartungsmodus.md) ein, damit niemand mitten im Update arbeitet.
4. Image neu ziehen und das Projekt neu starten – auf der Kommandozeile:
   ```sh
   docker compose pull && docker compose up -d
   ```
   oder in der Container-Verwaltung des NAS „Projekt neu erstellen“. Bei [dms-komplett](https://help.ablago.app/installieren/aktuell/komplett/) ist es nur ein Container; Datenbank und Ablago kommen mit demselben Image. Bringt ein neues Image eine neue Hauptversion von PostgreSQL mit, siehe [Wachsen und umziehen](wachsen.md#neue-hauptversion-von-postgresql).
5. Datenbank-Migrationen laufen beim Start automatisch und in einer Transaktion: Schlägt eine fehl, bleibt die Datenbank unverändert, und der Container startet nicht. Im Container-Log steht dann der Grund.
6. Kurz prüfen, ob alles läuft, dann den Wartungsmodus beenden.

Während des Neustarts ist Ablago kurz nicht erreichbar. Offene Seiten zeigen dann oben „Ablago ist gerade nicht erreichbar“ und fragen mit wachsendem Abstand (2 bis 30 Sekunden) nach, bis es wieder antwortet. Eingaben bleiben stehen; gespeichert wird nichts automatisch. Läuft danach eine andere Version, bittet die Leiste darum, die Seite neu zu laden – sonst arbeitet der Browser mit der alten Oberfläche gegen den neuen Server weiter. Erkannt wird das an `/api/gesundheit`, das neben `ok` eine Kennung des laufenden Stands liefert (ein Hash aus Version, Commit und Build-Zeit, damit ohne Anmeldung keine Version sichtbar ist).

Welche Version läuft und ob es neuere gibt, zeigt **Werkbank → Technik** (siehe [Fehlersuche](fehlersuche.md#technik)).

### Welches Image-Tag? { #image-tag }

Die Vorlagen nutzen **`:stabil`**. So bekommst du beim Aktualisieren nur Versionen mit Nummer und Release-Notes – nichts, was nirgends beschrieben ist.

| Tag | Was du bekommst | Für wen |
|---|---|---|
| `ghcr.io/motom001/dms:stabil` (bzw. `dms-komplett:stabil`) | die neueste geprüfte Version mit Nummer und Release-Notes | **Empfehlung** für alle |
| `ghcr.io/motom001/dms:0.158.0` (eine feste Nummer) | genau diese Version, bis du die Nummer selbst erhöhst | wer jedes Update selbst anstoßen möchte |
| `ghcr.io/motom001/dms:main` | jeden Stand auf `main`, auch Unveröffentlichtes ohne Nummer und Release-Notes | nur zum Testen |

`:stabil` wandert automatisch weiter, wenn eine neue Version veröffentlicht ist und alle Prüfungen bestanden hat: Release mit Nummer und Release-Notes, beide Images für amd64 und arm64 gebaut und mit Herkunftsnachweis, und ein **Update-Test** vom bisherigen `:stabil` auf die neue Version (mit Probedaten, allen Migrationen und einer Probe-Wiederherstellung der alten Sicherung). Fehlerbehebungen und neue Funktionen wandern gleich. Der Maintainer kann eine Version zurückhalten; dann bleibt `:stabil` auf der vorigen.

Bei zwei Containern bleibt `postgres:17` für Sicherheits-Updates der Reihe 17 offen – unabhängig vom Tag von Ablago.

!!! note "Wenn eine stabile Version einen schweren Fehler hat"
    Der Maintainer setzt `:stabil` dann auf die vorige Version zurück (Workflow *:stabil zurücksetzen*). Beim nächsten Aktualisieren bekommst du sie wieder. Was passiert ist, steht in den [Releases](https://github.com/motom001/dms/releases). Hast du schon aktualisiert und läuft danach etwas nicht, hilft die Sicherung von vor dem Update (siehe [Sichern](#sichern)); eine feste ältere Nummer im Tag hält Ablago bis zur Korrektur dort.

!!! info "Woher kommt das Image?"
    Jedes Image von Ablago trägt einen **Herkunftsnachweis**: eine Signatur, die belegt, dass es von GitHub aus genau diesem Repository gebaut wurde, und eine **Stückliste** (SBOM) aller enthaltenen Pakete. Beides ist öffentlich und lässt sich mit der GitHub-Kommandozeile prüfen:

    ```sh
    gh attestation verify oci://ghcr.io/motom001/dms:stabil -R motom001/dms
    ```

    Vor jeder Veröffentlichung prüft die CI die Images außerdem auf bekannte Sicherheitslücken. Mehr dazu in der [Sicherheitsrichtlinie](https://github.com/motom001/dms/blob/main/SECURITY.md).

### Texterkennung als Paket (ab 0.134)

Die Texterkennung (Tesseract) steckt nicht mehr im Image; das Image ist dadurch kleiner (beim Einbau in 0.11 kamen rund 50 MB dazu). Scans und Fotos erkennt jetzt das Paket **Texterkennung (Deutsch und Englisch)** (Kennung `texterkennung`) aus dem Katalog:

- **Vorhandener Volltext bleibt** unverändert – auch der, den die eingebaute Texterkennung erkannt hat. PDFs mit Text liest Ablago weiter selbst.
- Nach dem Update steht in der [Übersicht der Werkbank](uebersicht.md) **„Texterkennung ist jetzt ein Paket“** mit **Jetzt installieren**. Bis das Paket installiert ist, bleiben neue Scans ohne Text („wartet auf Texterkennung – kein Paket installiert“); danach gehen sie von selbst an das Paket.
- Sprachen, die du über ein eigenes Image (`tesseract-ocr-data-…`) oder eingehängte Dateien nachgerüstet hattest, kommen jetzt als **Zusatzsprachen** (z. B. *Texterkennung – Zusatzsprache Französisch*); das eigene Image kannst du wieder durch das offizielle ersetzen. Siehe [Weitere Sprachen](texterkennung.md#weitere-sprachen).
- Die Einstellungen der Texterkennung (Sprache, Seiten, Dateitypen) stehen jetzt beim Paket; TIFF-, WebP-, GIF- und BMP-Bilder bekommen keinen Volltext mehr.

### Datenbank-Anbindung und Haushalt (ab 0.24)

Beim ersten Start übernimmt Ablago `DATABASE_URL` und – falls gesetzt – `HAUSHALT_ID` in die Datei `/data/geheim/datenbank.json` (siehe [Datenbank-Anbindung](installation.md#datenbank-anbindung)). Es läuft ohne Zutun weiter. Danach sind beide Variablen überflüssig; die Werkbank-Übersicht weist darauf hin, und du kannst sie beim nächsten Update aus der Compose-Datei entfernen. Ändern lässt sich die Anbindung dann unter **Werkbank → Datenbank-Anbindung**.

### Feste Ordner (ab 0.23)

Die Ordner im Container sind jetzt fest: `/data/files`, `/data/geheim` und `/data/sicherung` (siehe [Ordner und Volumes](installation.md#ordner-und-volumes)). Die Variablen `FILES_DIR`, `DMS_SCHLUESSEL_DATEI` und `DMS_SICHERUNG_DIR` entfallen.

- **Steht `FILES_DIR: /data/files` in deiner Compose-Datei** (so war es in der Vorlage), läuft alles weiter. Entferne die Zeile beim nächsten Update; bis dahin erinnert die Werkbank-Übersicht daran.
- **Zeigte eine der Variablen auf einen anderen Ordner**, startet Ablago nicht und nennt im Protokoll des Containers das Volume, das stattdessen auf den festen Ordner zeigen muss. Beispiel: Stand bisher `FILES_DIR: /dokumente` mit dem Volume `/volume1/dms-daten:/dokumente`, wird daraus `/volume1/dms-daten:/data/files` – und die Variable fällt weg. Die Dateien selbst bleiben, wo sie sind.
- Prüfe nach dem Start unter **Werkbank → Technik**, dass alle drei Ordner auf einem eigenen Volume liegen.

### Auf 0.11 aktualisieren

- In der Compose-Datei ein Volume für den Schlüssel ergänzen (siehe [Vorlage](https://github.com/motom001/dms/blob/main/deploy/nas/docker-compose.yml)):
  ```yaml
  volumes:
    - /volume1/docker/dms/files:/data/files
    - /volume1/docker/dms/geheim:/data/geheim
  ```
  Danach unter **Werkbank → Verschlüsselung** den Schlüssel erzeugen. Ein schon gespeichertes SMTP-Passwort wird dabei verschlüsselt; bis dahin funktioniert der Versand wie bisher.
- Das Image enthält jetzt die Texterkennung und ist dadurch etwa 50 MB größer.
- Vorhandene Dokumente bekommen ihren Volltext erst, wenn du unter **Werkbank → [Wartungsoperationen](texterkennung.md#wartungsoperationen)** „Volltext neu erzeugen → Für Dokumente ohne Text“ anstößt.

### PostgreSQL

Kleinere Versionen (17.x) bekommst du durch Neuziehen des Images `postgres:17`. Ein Wechsel der Hauptversion (z. B. 17 → 18) braucht eine Sicherung und Wiederherstellung – PostgreSQL kann die Daten einer älteren Hauptversion nicht direkt öffnen.

## Wie neue Versionen entstehen

Jede Version von Ablago hat eine Nummer wie `0.8.1`. Sobald auf `main` eine neue Nummer steht und alle Prüfungen bestanden sind, entsteht automatisch:

- ein **Release** auf GitHub mit dem Changelog – [Releases](https://github.com/motom001/dms/releases),
- ein **Image** mit dieser Nummer, z. B. `ghcr.io/motom001/dms:0.8.1`,
- danach, wenn der Update-Test bestanden ist, das Tag **`:stabil`** auf dieser Version.

Änderungen ohne neue Nummer (kleine Korrekturen, Doku) landen nur im Image `main`, nie in `:stabil`. Mehrere Wünsche lassen sich so zu einem Release bündeln: Die Nummer wird erst mit dem letzten erhöht.

## Sichern

Am einfachsten sichert Ablago sich selbst: **Werkbank → [Sicherung](sicherung.md)** – Datenbank und Dateien zum selben Zeitpunkt, verschlüsselt, auf Wunsch nach Zeitplan. Der Rest dieses Abschnitts beschreibt den Weg von Hand, z. B. für eine zusätzliche Kopie.

Die Sicherung ist ein eigenes, verschlüsseltes Format – zum Wiederherstellen brauchst du Ablago. Eine Kopie, die du **auch ohne Ablago** lesen kannst, ist der [Vollexport](export.md) in offenen Formaten (CSV, JSON, Dateien in Ordnern).

Von Hand zu sichern sind diese Ordner aus der Compose-Vorlage:

| Ordner | Inhalt |
| --- | --- |
| `postgres` | die Datenbank: Mappentypen, Mappen, Benutzer, Einstellungen (bei dms-komplett im Container unter `/data/postgres`) |
| `files` | die hochgeladenen Dateien, je Datei unter ihrem SHA-256-Prüfwert |
| `geheim` | der Schlüssel `dms.schluessel` für alle gespeicherten Geheimnisse (siehe [Verschlüsselung](verschluesselung.md)) und Sicherungen, die Datenbank-Anbindung `datenbank.json` (mit Passwort), bis zur Einrichtung der Einrichtungscode und bei Bedarf die [RESCUE-Datei](notfall.md) – **getrennt** von den anderen aufbewahren |
| `sicherung` | die Sicherungen von Ablago (verschlüsselt) |

Für eine konsistente Datenbanksicherung im laufenden Betrieb vorher einen Abzug erstellen:

```sh
docker exec <db-container> pg_dump -U dms dms > dms.sql
```

Bei dms-komplett heißt der Befehl `docker exec <container> pg_dump -h 127.0.0.1 -U dms dms > dms.sql`. Sichere `dms.sql` zusammen mit dem Ordner `files`.

### Wiederherstellen

Sicherungen von Ablago spielst du in der Werkbank ein: [Wiederherstellen](wiederherstellen.md). Für einen Abzug von Hand:

1. Projekt stoppen, Ordner `files` zurückkopieren.
2. Datenbank leeren und einspielen:
   ```sh
   docker compose up -d db
   docker exec -i <db-container> psql -U dms -d dms < dms.sql
   ```
3. Projekt starten.

Dieser Weg gilt für zwei Container: Dort lässt sich die Datenbank allein starten. Bei dms-komplett laufen Ablago und Datenbank im selben Container und starten immer zusammen. Hol dort einen früheren Stand mit einer Sicherung von Ablago zurück, wie unter [Wiederherstellen](wiederherstellen.md) beschrieben.

!!! warning "Dateien und Datenbank gehören zusammen"
    Die Datenbank kennt jede Datei über ihren Prüfwert. Sichere und stelle beide immer vom selben Zeitpunkt wieder her.

!!! warning "Ohne Schlüssel keine Passwörter"
    Gespeicherte Passwörter lassen sich nur mit der Schlüsseldatei aus `geheim` lesen. Fehlt sie nach einer Wiederherstellung, zeigt **Werkbank → [Verschlüsselung](verschluesselung.md)**, welche Passwörter neu einzugeben sind. Bewahre die Schlüsseldatei getrennt von der Datenbanksicherung auf – liegen beide zusammen, schützt die Verschlüsselung die Sicherung nicht.
