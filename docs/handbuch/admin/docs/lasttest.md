# Lasttest selbst durchführen

Wie viel verkraftet das DMS **auf deinem Gerät**? Die Rechner, auf denen das Projekt jede Woche misst, sind kein NAS. Mit dem Lasttest misst du selbst – etwa vor dem Kauf eines neuen Geräts, vor einem Umzug oder wenn das DMS dir langsam vorkommt. Das Ergebnis kannst du freiwillig zurückmelden; daraus entsteht die Tabelle [Was das DMS verkraftet](verkraftet.md).

!!! warning "Nur gegen eine Test-Installation – nie gegen deine echte Ablage"
    Der Lasttest legt einen eigenen Haushalt mit Lasttest-Konten und bis zu 200.000 Demo-Mappen an, probiert falsche Passwörter aus (um den [Anmeldeschutz](anmeldeschutz.md) zu prüfen) und belastet das Gerät minutenlang bis an seine Grenze. Starte dafür eine **eigene, frische Test-Installation** und lösche sie danach wieder. Das Skript prüft das selbst: Ist das DMS schon eingerichtet und nicht vom Lasttest, oder liegen dort mehr als 200 Mappen, die keine Demo-Mappen sind, bricht es ab, **bevor** es etwas anlegt.

## Die drei Stufen

| Stufe | bildet ab | Last | Daten | Zusage |
| --- | --- | --- | --- | --- |
| `klein` | Haushalt (2–5 Personen) | 25 gleichzeitige Anfragen, gemischt wie im Alltag | 5.000 Mappen | 95 % der Antworten schneller als 0,3 s, keine Fehler |
| `mittel` | Kleinbetrieb (10–15 Personen) | 100 gleichzeitig, dazu ein großer Export nach dem anderen | 50.000 Mappen | 95 % schneller als 1 s, weniger als 0,1 % Fehler |
| `gross` | Belastungsgrenze | alle 2 Minuten 25 gleichzeitige Anfragen mehr, bis 95 % nicht mehr unter 3 s bleiben, mehr als 1 % fehlschlagen oder der [Überlastschutz](technik.md#last) greift; danach kurz 1000 gleichzeitig | 200.000 Mappen | kein fester Wert – gemessen wird, **wo die Grenze liegt**; Pflicht: kein Absturz, Erholung von selbst |

„Gemischt wie im Alltag“ heißt: Startseite, Listen, Mappen öffnen, Suchen, Vorschaubilder und Dokumente herunterladen, als Administrator und als Mitglied. 25 gleichzeitige Anfragen entsprechen etwa 2–5 Personen, die gerade klicken – ein Klick löst mehrere Anfragen aus.

## Voraussetzungen

- Das DMS ab Version 0.132.0 – der Lasttest steckt als Befehl `dms-lasttest` im Image.
- Platz für die Test-Installation: etwa 1 GB für `klein` und `mittel`, 3–5 GB für `gross`.
- Ruhe auf dem Gerät: Laufen nebenher eine Sicherung des NAS, ein Medienserver oder Downloads, misst du die mit.

## Schritt für Schritt

1. **Test-Installation starten** – am einfachsten mit `dms-komplett` (DMS und Datenbank in einem Container), mit eigenem Namen, eigenem Port und eigenen, leeren Ordnern, z. B.:

    ```sh
    docker run -d --name dms-test -p 8099:3000 \
      -v /pfad/zu/dms-test/files:/data/files \
      -v /pfad/zu/dms-test/geheim:/data/geheim \
      -v /pfad/zu/dms-test/sicherung:/data/sicherung \
      -v /pfad/zu/dms-test/postgres:/data/postgres \
      ghcr.io/motom001/dms-komplett:main
    ```

    Willst du die Variante mit getrennter Datenbank messen, nimm deine Vorlage (Compose-Datei) als eigenes Projekt, z. B. `dms-test`, mit anderen Ordnern und anderem Port. Nicht einrichten – das macht der Lasttest.

2. **Stufe starten** – im Test-Container, also auf demselben Gerät:

    ```sh
    docker exec -it dms-test dms-lasttest klein --geraet "Modell deines Geräts" --speicher SSD
    ```

    Statt `klein` geht `mittel`, `gross` oder `alle` (alle drei nacheinander). Beim ersten Start richtet der Lasttest das frische DMS selbst ein; den Einrichtungscode liest er aus dem Ordner `geheim`. Fehlen für eine größere Stufe Mappen, legt er die Demo-Mappen dazu und wartet, bis das DMS mit der Arbeit im Hintergrund fertig ist. In der Oberfläche einer NAS geht das ebenso über die Konsole des Containers (Befehl `dms-lasttest klein`).

3. **Ergebnis lesen** – am Ende steht ein Bericht und darunter der Block **Messergebnis Lasttest** (siehe unten).

4. **Aufräumen:** Test-Container stoppen und löschen (`docker rm -f dms-test`), die Ordner der Test-Installation löschen.

Optionen: `--geraet "…"` und `--speicher HDD|SSD|NVMe` tragen Gerät und Speicher in den Ergebnisblock ein (sonst steht dort „bitte ergänzen“). `--dauer <Sekunden>` ändert die Messdauer von `klein` und `mittel` (Vorgabe 120). `--start`, `--schritt` und `--schritt-dauer` ändern die Steigerung von `gross` (Vorgabe 25, 25, 120 Sekunden), `--bis <n>` begrenzt sie. `--bericht <Datei>` speichert den Bericht.

**Dauer** (je nach Gerät): `klein` etwa 5 Minuten, `mittel` 15–30 Minuten (50.000 Mappen anlegen), `gross` 30–60 Minuten (200.000 Mappen anlegen, dann je Schritt 2 Minuten). Den Lasttest auf einem anderen Rechner gegen die Test-Installation laufen zu lassen geht auch (`--ziel http://…:8099`); dann fehlt im Ergebnis das CPU-Modell, und das Netzwerk misst mit.

## Ergebnis lesen

- **p50, p95, p99:** Die Hälfte, 95 % bzw. 99 % der Antworten kamen schneller als dieser Wert. p95 ist der wichtigste: Er zeigt, wie es sich anfühlt, wenn es gerade hakt.
- **Fehlerquote:** Anteil der Anfragen mit Serverfehler oder ganz ohne Antwort. Abgewiesene Anfragen („gerade sehr beschäftigt“, 503) zählen extra.
- **Zusage eingehalten / verfehlt** (`klein`, `mittel`): ob dein Gerät die Werte der Tabelle oben schafft. Verfehlt heißt nicht kaputt – das DMS ist dann bei so vielen gleichzeitigen Anfragen langsamer, als das Projekt es sich vornimmt.
- **Grenze** (`gross`): so viele gleichzeitige Anfragen schafft das Gerät noch mit 95 % der Antworten unter 3 s, dazu die Anfragen je Sekunde. Darunter steht, warum der nächste Schritt zu viel war, und wie schnell sich das DMS nach 1000 gleichzeitigen Anfragen erholt hat.
- **Arbeitsspeicher** und **Ereignisschleife p99** (wie lange Anfragen höchstens warten mussten, weil der Server rechnete) zeigen, wo es eng wird. Hinweise zu den Einstellungen dafür stehen unter [Systemzustand → Einstellungen und Engpässe](speicherplatz.md#einstellungen-und-engpasse).

## Ergebnis zurückmelden

Der Block **Messergebnis Lasttest** enthält **keine personenbezogenen Daten** und **keine Adressen, Rechner- oder Haushaltsnamen** – nur DMS-Version, Image, wo die Datenbank läuft, Gerät, CPU, Kerne, Arbeitsspeicher, Art des Speichers, Zahl der Mappen und Dokumente, je Stufe p50/p95/p99 und Fehlerquote, die Grenze, die Spitze des Arbeitsspeichers und die Ereignisschleife. Kopiere ihn unverändert in das Formular [Messergebnis Lasttest](https://github.com/motom001/dms/issues/new?template=messergebnis-lasttest.yml) auf GitHub. Der Beitrag ist öffentlich; alles ist freiwillig – das DMS selbst meldet nichts.
