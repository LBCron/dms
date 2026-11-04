# Pakete entwickeln

Pakete erweitern Ablago um fertige Mappentypen, Ansichten und Beispiel-Mappen. Administratoren installieren sie unter **Werkbank → Pakete** aus dem offiziellen Katalog (siehe [Administratorhandbuch → Pakete](https://help.ablago.app/admin/aktuell/pakete/)).

## Wo Pakete liegen

Alle offiziellen Pakete liegen im Repository **[motom001/dms-registry](https://github.com/motom001/dms-registry)**, ein Ordner je Paket unter `pakete/<id>/`. Dort gelten dieselben Regeln wie in Ablago: erst ein Issue als User Story, umgesetzt wird nach dem Label `freigegeben`. Die Regeln für Pakete (Lizenzen, Verbotenes, Namen) stehen in [REGELN.md](https://github.com/motom001/dms-registry/blob/main/REGELN.md).

## Ein Paket anlegen

```sh
git clone https://github.com/<du>/dms-registry && cd dms-registry
werkzeuge/neues-paket.sh mein_paket "Mein Paket"   # kopiert vorlage/ nach pakete/mein_paket/
```

Dann ausfüllen:

| Datei | Inhalt |
| --- | --- |
| `manifest.yaml` | `schema: 1` (Pflicht), Id, Name, Version (SemVer), Beschreibung, Autor, Lizenz, nötige Ablago-Version (z. B. `">=0.63.0"`), Abhängigkeiten, `inhalt` mit den Pfaden der Inhaltsdateien (z. B. `mappentypen: inhalt/mappentypen.yaml`), optional `code` |
| `inhalt/mappentypen.yaml` | Mappentypen mit Feldern, Registern, Titel und Trefferliste |
| `inhalt/sichten.yaml` | Ansichten mit Elternansicht, Mappentypen und Bedingungen |
| `inhalt/beispiele.yaml` | optional: Beispiel-Mappen mit erfundenen Daten |
| `inhalt/wortlisten.yaml` | optional (ab Ablago 0.127.0): Gruppen gleichbedeutender Wörter für die Suche |
| `inhalt/automatisierungen.yaml` | optional (ab Ablago 0.177.0): vorgefertigte Automatisierungen, nach der Installation aus |
| `README.md`, `LICENSE`, `CHANGELOG.md` | Beschreibung, Lizenztext, Änderungen je Version |
| `tests/erwartung.yaml` | was nach der Installation da sein muss |

### Paket aus deinem Ablago erstellen { #paket-aus-deinem-dms-erstellen }

Statt mit der Vorlage zu beginnen, kannst du Mappentypen und Ansichten, die du in einem DMS gebaut hast, unter **Werkbank → Pakete → Paket erstellen** exportieren (ab Ablago 0.86.0, siehe [Administratorhandbuch → Paket aus deinem Ablago erstellen](https://help.ablago.app/admin/aktuell/pakete/#paket-aus-deinem-dms-erstellen)). Das Ergebnis ist ein ZIP mit einem Ordner `<id>/` im Format der Registry – `manifest.yaml`, `inhalt/mappentypen.yaml`, `inhalt/sichten.yaml`, ggf. `inhalt/beispiele.yaml`, `README.md` aus der Beschreibung, `CHANGELOG.md`, `LICENSE` mit dem vollen Lizenztext und `tests/erwartung.yaml`. Es besteht `werkzeuge/pruefen.py`; entpackt unter `pakete/` ist es ein fertiger Paketordner für einen Pull Request (README und Beschreibung lohnt es sich noch auszubauen).

So bildet der Export Ablago auf das Paketformat ab:

| In Ablago | Im Paket |
| --- | --- |
| eigener Mappentyp | Eintrag in `mappentypen.yaml`; Kennung aus der Kennung des Typs, bleibt über Versionen gleich (gemerkt) |
| Typ oder Ansicht aus einem installierten Paket | nicht kopiert, sondern `abhaengigkeiten: { <paket>: ">=<installierte Version>" }`, Verweise als `<paket>:<kennung>` |
| Verweis auf Benutzer, Rolle, Ablageort | `dms:benutzer`, `dms:rolle`, `dms:ablageort` (dann `dms` mindestens `>=0.75.0`) |
| Ansicht auf einen eigenen, nicht gewählten Typ (#656) | `fremde_typen: [{ kennung, name }]` an der Ansicht – Kennung des Typs (bzw. `<paket>_<kennung>`, wenn er in einem früher exportierten Paket steckt); dann `dms` mindestens `>=0.178.0` |
| Standard-Trefferliste | `trefferliste`; weitere Trefferlisten fehlen |
| Bedingung auf ein Feld | `{ feld, operator, wert }`, dynamische Werte (heute, ich …) als Objekt; Bedingungen auf Anzahlen, Favoriten, Fristen und auf feste Mappen fehlen |
| gewählte Beispiel-Mappen | `beispiele.yaml` mit `schluessel` und `{ beispiel: … }` für Verweise untereinander; ohne Passwörter, Dokumente und Verweise auf nicht gewählte Mappen |
| Nummernkreis am Feld, Berechtigungen, Archivmodus | fehlen (das Format kennt sie nicht); die Prüfung nennt sie |

## Paketformat (verbindlich)

Das Format beschreiben die JSON-Schemas in der Registry: [`schema/manifest.schema.json`](https://github.com/motom001/dms-registry/blob/main/schema/manifest.schema.json) und [`schema/inhalt.schema.json`](https://github.com/motom001/dms-registry/blob/main/schema/inhalt.schema.json). Die Vorlage zeigt jede Angabe mit Kommentar. Ablago liest genau dieses Format:

- **Manifest:** `schema: 1` ist Pflicht; ein anderer Wert wird abgelehnt. `inhalt` nennt die Dateien mit `mappentypen`, `sichten`, `beispiele`, `wortlisten` und `automatisierungen` (Pfade relativ zum Paketordner). Das Schema kennt außerdem `inhalt.rollen`; Ablago liest es nicht.
- **Unbekannte Felder** (dms #635): Felder, die Ablago nicht kennt, ignoriert es – im Manifest (oben und in Unterabschnitten wie `autor`, `inhalt`, an Mappentypen, Ansichten und Beispielen), in `katalog.json` und im Verzeichnis einer Sammeldatei. So brechen neue optionale Felder (z. B. `symbol`, `kuerzel`, `kategorien`) ältere Ablago nicht; neue Felder sind deshalb immer optional. Abgelehnt wird nur ein anderes Format: `schema` bzw. `format` ungleich 1. Die Signatur gilt weiter über die rohen Bytes von `katalog.json`, unbekannte Felder eingeschlossen. Der Test `server/test/unbekannte-felder.test.ts` hält das fest.
- **Kennungen** (`schluessel` bei Mappentypen und Ansichten, `key` bei Feldern und Registern) sind im Paket lokal. Ablago legt Mappentypen als `<paket>_<schluessel>` an.
- **Ansichten mit `fremde_typen`** (ab Ablago 0.178.0, #656): Mappentypen, die das Paket nicht mitbringt, nennt eine Ansicht mit ihrer Kennung (`kennung`, wie `schluessel` eines Mappentyps in Ablago) und einem Namen für Meldungen. Ablago ordnet sie beim Installieren dem Typ mit dieser Kennung zu. Gibt es ihn nicht, kommt die Ansicht ohne ihn – fehlen alle ihre Typen, wird sie (mit ihren Unteransichten) übersprungen und die Vorschau sagt es vorher; das übrige Paket wird installiert. Eine spätere Version des Pakets legt übersprungene Ansichten an, sobald der Typ da ist.
- **Felder** wie in der Werkbank: `key`, `label`, `typ` (text, langtext, formatiert, zahl, betrag, datum, janein, auswahl, referenz, passwort) und die üblichen Eigenschaften (`pflicht`, `eindeutig`, `hilfe`, `standard`, `minLen`, `maxLen`, `muster`, `min`, `max`, `nachkomma`, `waehrung`, `optionen`, `mehrfach`, `verweisart`, `frist`, `erkennung`, `format`, `landFeld`).
- **Formate und Datumsgrenzen** (dms #535): Textfelder bekommen mit `format` eine Prüfung – `email`, `telefon`, `internetseite`, `iban` oder `plz`. Bei `plz` nennt `landFeld` die Kennung des Felds mit dem Land (Text oder Auswahl im selben Mappentyp); steht dort Deutschland oder nichts, sind genau 5 Ziffern Pflicht, sonst ist die PLZ frei. Datumsfelder bekommen mit `min` und `max` Grenzen: ein Datum (`2000-01-01`) oder `heute`, z. B. `max: heute` für einen Geburtstag. Beispiel: `- { key: plz, label: PLZ, typ: text, maxLen: 10, format: plz, landFeld: land }`. Neue und geänderte Werte müssen passen – auch die Beispiele des Pakets –, gespeicherte bleiben gültig. Bei einem Update übernimmt Ablago Format bzw. Grenzen an vorhandenen Feldern, an denen der Administrator weder Format noch Grenzen eingestellt hat; die Vorschau nennt sie. Ältere Ablago ignorieren die Angaben.
- **Für die Erkennung nutzen** (`erkennung`, dms #336/#391): `erkennung: {}` markiert ein Feld für die eingebaute Erkennung; optional `art` (`name`, `vorname`, `nachname`, `funktion`, `nummer`, `iban`, `ustid`, `email`, `internet`, `telefon`, `mobil`, `fax`, `strasse`, `hausnummer`, `plz`, `ort`, `datum`, `betrag`, `verweis`, `auswahl` – passend zur Feldart) und `hinweis` (höchstens 300 Zeichen, z. B. „Muster 100-####“). Nur bei text, langtext, zahl, betrag, datum, auswahl und referenz; ältere Ablago ignorieren die Angabe. Bei einem Update übernimmt Ablago die Markierung an vorhandenen Feldern, an denen der Administrator nichts eingestellt hat.
- **Verweise** (`ziel` bei Verweisfeldern, `quellen[].typ` bei Verknüpfungsregistern): `schluessel` für einen Mappentyp dieses Pakets, `<paket>:<schluessel>` für den Mappentyp eines anderen Pakets. Das andere Paket steht dann unter `abhaengigkeiten`. Mappentypen eines Pakets dürfen auch im Kreis aufeinander verweisen.
- **Verweise auf Mappentypen von Ablago** (seit 0.75.0): `dms:ablageort` (Ablageort, z. B. für das Feld `verbleib_original` „Verbleib Originaldokumente“), `dms:benutzer` und `dms:rolle` (z. B. für „Verantwortlich“). Erlaubt in `ziel`, `quellen[].typ` und `typen` einer Ansicht. Andere Typen von Ablago (z. B. Post) gehen nicht; die Id `dms` ist für Pakete gesperrt. Ein Paket mit solchen Verweisen gibt im Manifest `dms: ">=0.75.0"` an; ein älteres Ablago lehnt es mit einer verständlichen Meldung ab. Die Vorschau zeigt die Typen als „Ablageort (aus Ablago)“.
- **Ansichten:** `eltern` ist die lokale Kennung einer anderen Ansicht des Pakets. `bedingungen` sind `{ feld, operator, wert }` mit den Operatoren der Werkbank (`gleich`, `enthaelt`, `kleiner`, `groesser`, `zwischen`, `ausserhalb`, `imZeitraum`, `einerVon`, `zeigtAuf`, `leer`, `nichtLeer`, `ja`, `nein`); bei `zwischen` und `ausserhalb` ist `wert` eine Liste mit zwei Werten.
- **Beispiele:** `{ typ, werte }`; Beträge dürfen als Zahl stehen. Ab Ablago 0.79.0 (#347) zusätzlich:
    - `schluessel` (optional, Kleinbuchstaben, Ziffern, `_`; eindeutig im Paket) – damit andere Beispiele auf diese Mappe zeigen können.
    - Ein Verweisfeld darf `{ beispiel: strom }` sein (bei `mehrfach` auch eine Liste davon), auf ein Beispiel einer **Abhängigkeit** mit Präfix: `{ beispiel: "basis:stadtwerke" }`.
    - Ablago legt die Beispiele so an, dass Ziele vorher da sind; die Reihenfolge in der Datei ist egal. Kreise (A → B → A), unbekannte Schlüssel und Präfixe, die nicht unter `abhaengigkeiten` stehen, lehnt es beim Lesen ab.
    - Werden die Beispiele installiert, kommen auch die der Abhängigkeiten mit, die dabei neu installiert werden. Ist eine Abhängigkeit schon **ohne** Beispiele installiert, bleiben Verweise darauf leer; die Vorschau sagt das. Ablago merkt sich die Mappen der Beispiele mit Schlüssel am installierten Paket (`beispiele`).
    - Beim Update entstehen keine Beispiele – wie bisher.
    - Pakete, die das nutzen, verlangen im Manifest `dms: ">=0.79.0"`.
- **Wortlisten** (dms #356, ab 0.127.0): `inhalt.wortlisten` nennt eine Datei mit Gruppen gleichbedeutender Wörter für die Suche – wer eines sucht, findet auch die anderen. Jede Gruppe ist `{ woerter: [Kfz, Auto, PKW] }` mit 2 bis 20 verschiedenen Wörtern (je 2 bis 60 Zeichen; Groß-/Kleinschreibung und Umlaute zählen beim Vergleich nicht); höchstens 1000 Gruppen je Paket. Ablago legt sie beim Installieren an, ersetzt sie beim Update durch die des Pakets und entfernt sie mit dem Paket; in der Werkbank unter **Suche** stehen sie zum Ansehen. Pakete mit Wortlisten verlangen `dms: ">=0.127.0"` – ältere Ablago übergehen den Abschnitt stillschweigend. Beispiel:

    ```yaml
    # inhalt/wortlisten.yaml
    - woerter: [Kfz, Auto, PKW, Fahrzeug]
    - woerter: [Nebenkosten, Betriebskosten]
    ```

- **Automatisierungen** (dms #712, dms-registry #108, ab 0.177.0): `inhalt.automatisierungen` nennt eine Datei mit vorgefertigten [Automatisierungen](https://help.ablago.app/admin/aktuell/automatisierungen/) – je Eintrag `schluessel` (fest, wie bei Typen), `name`, optional `beschreibung`, genau eine Wenn-Karte `wenn`, optional `und`, mindestens eine Karte in `dann`. Karten und Werte wie im Editor; Mappentypen als eigener Schlüssel oder `paket:typ` einer Abhängigkeit. **Feste Personen gibt es nicht** – Empfänger sind ein Feld (`{ art: feld, feld: verantwortlich, sonst: ersteller }`), oder der Ersteller der Mappe. Nach der Installation sind sie **aus**; beim Installieren fragt Ablago, welche gleich eingeschaltet werden (Vorgabe: alle). Ein Update ersetzt nur unveränderte Automatisierungen, beim Entfernen des Pakets gehen unveränderte, ausgeschaltete mit. Ältere Ablago übergehen den Abschnitt; Pakete damit verlangen `dms: ">=0.177.0"`. Beispiel:

    ```yaml
    # inhalt/automatisierungen.yaml
    - schluessel: hu_bald
      name: HU wird bald fällig
      beschreibung: Einen Monat vor der Hauptuntersuchung bekommt der Verantwortliche eine Frist.
      wenn: { art: datum, typ: fahrzeug, feld: hu_faellig, vorlauf: 1, einheit: monate, uhrzeit: "07:00" }
      dann:
        - { art: aufgabe, als: aufgabe, empfaenger: [{ art: feld, feld: verantwortlich, sonst: ersteller }], text: "Für {kennzeichen} wird bald die HU fällig: {datum}." }
    ```

    Am Datumsfeld bleibt nur `frist` („ist eine Frist“: steht unter *Zu erledigen*, im Kalender und löst *Datum erreicht* aus). Seit 0.177.0 legt das Feld **keine Aufgaben mehr selbst an**; `frist.vorlauf`, `einheit`, `wiederholung` und `text` dienen nur noch als Vorgabe – erinnern soll eine mitgelieferte Automatisierung mit derselben Vorlaufzeit.
- **Abhängigkeiten** (`abhaengigkeiten: { <paket>: "<bereich>" }`): Pakete, die vorher installiert sein müssen. Beim Installieren kommen fehlende Abhängigkeiten im selben Ablauf mit – seit Ablago 0.151.0 (#405) auch solche **mit Code**: Der Administrator sieht die Rechte aller Pakete auf einer Seite und bestätigt sie einmal; jedes Paket behält sein eigenes Dienstkonto und seine eigenen Rechte. Ein Update, das die Rechte ändert, braucht wie bisher eine neue Bestätigung.
- **Ergänzungen** (`ergaenzt`, dms #405, ab 0.151.0): Ein Paket, das ein anderes erweitert – etwa eine Zusatzsprache der Texterkennung –, sagt das mit `ergaenzt`. Das ergänzte Paket muss auch unter `abhaengigkeiten` stehen. Die Installation zeigt Ergänzungen als **Häkchen unter dem ergänzten Paket** (beim ersten Installieren, im Einrichtungsassistenten, aus einer Sammeldatei und nachträglich am installierten Paket), gruppiert nach `gruppe` – ohne Gruppe unter „Ergänzungen“. Die Gruppe ist eine kurze Frage ohne Fragezeichen (höchstens 40 Zeichen), Ablago hängt „?“ an. Jede Ergänzung bleibt ein eigenes Paket mit eigener Version und eigenem Update. Ältere Ablago ignorieren das Feld; ein Paket braucht dafür kein höheres `dms`. Ohne `ergaenzt` erscheint ein abhängiges Paket nur als normales Paket in der Liste.

    ```yaml
    # manifest.yaml einer Zusatzsprache
    abhaengigkeiten:
      texterkennung: ">=2.0.0"
    ergaenzt: { paket: texterkennung, gruppe: Weitere Sprachen }   # oder kurz: ergaenzt: texterkennung
    ```

    Im Katalog steht die Angabe je Version (`versionen[].ergaenzt`, immer als `{ paket, gruppe }`). Ein Sammelpaket „alle Sprachen“ ohne eigenen Inhalt braucht es dafür nicht.
- **Versionen:** `dms` und `abhaengigkeiten` nehmen Bereiche: `>=1.2.0`, `>1.2.0`, `1.2.0` bzw. `=1.2.0`, `^1.2.0` (gleiche Hauptversion), `~1.2.0` (gleiche Nebenversion), optional mit Obergrenze ` <2.0.0`. Bei `0.x` heißt `^` gleiche Nebenversion: `^0.63.0` passt nur zu 0.63.x. Für die Ablago-Version deshalb `>=0.63.0` (bzw. die eigene Mindestversion) schreiben.

Bei einem **Update** ergänzt Ablago nur: neue Mappentypen, Felder, Register und Ansichten. Felder, Register oder Ansichten zu entfernen oder umzubenennen hat auf installierte Ablago keine Wirkung – plane das Format deshalb vorher. Mappentypen und Ansichten, die ein Administrator gelöscht hat, legt ein Update nicht neu an.

## Einstellungen beschreiben

Braucht dein Paket (mit Code) Einstellungen, beschreibst du sie im Manifest unter `code.einstellungen` – eine eigene Oberfläche bringt ein Paket nicht mit. Ablago zeigt das Formular, prüft und speichert die Werte (Teil der Sicherung) und gibt sie dem Paket.

```yaml
code:
  einstellungen:
    - abschnitt: Allgemein
      felder:
        - { schluessel: aktiv, name: Regeln automatisch anwenden, typ: janein, standard: true }
        - { schluessel: token, name: API-Schlüssel, typ: geheim, pflicht: true }
    - liste: regeln
      name: Regeln
      eintrag: Regel
      sortierbar: true
      felder:
        - { schluessel: absender, name: Absender enthält, typ: text }
        - { schluessel: ziel, name: Mappentyp, typ: mappentyp, pflicht: true }
  aktionen:
    - { schluessel: anwenden, name: Regeln jetzt auf neue Post anwenden, bestaetigen: true }
```

- Höchstens **zwei Ebenen**: Abschnitte (`abschnitt`, `hilfe`, `felder`) und Listen (`liste`, `name`, `eintrag`, `hilfe`, `sortierbar`, `felder`).
- **Typen:** `text`, `mehrzeilig`, `zahl` (`min`/`max`, optional `schritt` und `vorschlaege`, siehe unten), `janein`, `datum`, `auswahl` und `mehrfachauswahl` (`optionen`), `geheim`, Verweise `mappentyp`, `feld` (mit `mappentyp:`), `benutzer`, `rolle`, `sicht`, und seit Ablago 0.124.0 `adresse` – die Dienst-Adresse, zu der allein das Paket ins Netz darf (ohne `standard`, höchstens mit `beispiel`; siehe [Pakete mit Code](pakete-code.md#im-manifest)).
- **Zahlen mit Vorschlägen** (#657): Eine `zahl` nimmt nur Ziffern (ggf. mit Komma) innerhalb von `min`/`max` an – geprüft im Formular und beim Speichern („Bitte eine Zahl zwischen 150 und 400.“). `schritt: 1` erlaubt nur ganze Zahlen. Mit `vorschlaege` zeigt Ablago eine Auswahl mit Beschriftung statt eines Zahlenfelds; „Eigener Wert …“ öffnet das Zahlenfeld. Jeder Vorschlag liegt in `min`/`max`, `standard` muss einer davon sein. Ältere Ablago-Versionen ignorieren `schritt` und `vorschlaege` und zeigen ein Textfeld.
  ```yaml
  - schluessel: dpi
    name: Auflösung (dpi)
    typ: zahl
    min: 150
    max: 400
    standard: 300
    vorschlaege:
      - { wert: 150, name: "gering – schneller, für klare Ausdrucke" }
      - { wert: 300, name: "normal – empfohlen" }
      - { wert: 400, name: "hoch – kleine Schrift, dauert länger" }
  ```
- **Typen:** `text`, `mehrzeilig`, `zahl` (`min`/`max`), `janein`, `datum`, `auswahl` und `mehrfachauswahl` (`optionen`), `geheim`, Verweise `mappentyp`, `feld` (mit `mappentyp:`), `benutzer`, `rolle`, `sicht`, und seit Ablago 0.124.0 `adresse` – die Dienst-Adresse, zu der allein das Paket ins Netz darf (ohne `standard`, höchstens mit `beispiel`; siehe [Pakete mit Code](pakete-code.md#im-manifest)).
- **Mehrfachauswahl für Verweise** (ab Ablago 0.179.0, #658): `mehrfach: true` an `mappentyp`, `benutzer`, `rolle` oder `sicht` zeigt das Feld wie ein Verweisfeld mit Mehrfachauswahl (suchen, Auswahl unter dem Feld, „Entfernen“); der Wert ist eine Liste von Ids. `schliesst_aus: <schlüssel>` nennt ein zweites Feld desselben Verweistyps im Abschnitt: Was in dem einen gewählt ist, bietet Ablago im anderen nicht an, und der Server lehnt dieselbe Id in beiden ab (z. B. „Nur diese Mappentypen“ ↔ „Diese Mappentypen ausschließen“). Eine **Liste mit genau einem Verweisfeld** (z. B. `liste: typen` mit `eintrag: Mappentyp`) zeigt Ablago ebenfalls so, ohne dass das Paket sich ändern muss – gespeichert bleibt die Liste. Macht ein Update aus so einer Liste ein Feld mit `mehrfach: true` unter demselben Schlüssel, übernimmt Ablago die gewählten Ids.
- **Werte**, wie das Paket sie bekommt: Abschnittsfelder unter ihrer Kennung, Listen als Liste von Objekten (mit `_id` je Eintrag). Verweise sind Ids (bei `feld`: `{ typ, feld }`), Geheimnisse im Klartext – nur für das eigene Paket.
- Zu `code` gehören außerdem `sprache`, `quelle`, `ereignisse`, `rechte` und `netz` (siehe [Pakete mit Code](pakete-code.md#im-manifest)); das Beispiel oben zeigt nur Einstellungen und Aktionen.
- **Zugangsdaten nur als `geheim`**, nie als `text` und nie mit `standard`.
- Bei einem **Update** bekommen neue Felder ihre Vorgabe, vorhandene Werte bleiben, wegfallende werden entfernt.

`werkzeuge/pruefen.py` prüft Kennungen, Vorgaben, Optionen, Geheimnisse und Verweise. Zum Ausprobieren eignet sich der Expertenmodus mit **Paket hochladen**.

Was das Paket mit den Einstellungen macht und welche Rechte es braucht, beschreibt [Pakete mit Code](pakete-code.md).

## Prüfen

```sh
pip install pyyaml jsonschema
python3 werkzeuge/pruefen.py pakete/mein_paket      # Schema, Pflichtdateien, Verweise, Lizenz, Changelog
python3 werkzeuge/katalog.py --probe /tmp/katalog    # lässt sich der Katalog bauen?
```

Dieselben Prüfungen laufen im Pull Request. Ein veröffentlichtes Paket ändert sich nie: Jede Änderung braucht eine höhere Version und einen Eintrag im `CHANGELOG.md`.

## Pull Request und Katalog

1. Pull Request mit `Closes #…`; jeder Commit trägt ein `Signed-off-by:` (`git commit -s`).
2. Nach dem Merge baut die CI je Paketversion ein Archiv `<id>-<version>.zip` und den Katalog `katalog.json` mit SHA-256, signiert den Katalog (`katalog.sig`, siehe unten) und legt alles auf den Branch `gh-pages`. Ablago findet das Paket beim nächsten **Katalog abrufen**.

## Signierter Katalog { #signierter-katalog }

Ab Ablago 0.141.0 prüft Ablago, **woher** ein Katalog stammt (#594, Registry: motom001/dms-registry#74). Die Prüfsumme je Archiv belegt nur, dass ein Paket unterwegs nicht kaputtging; die Signatur über `katalog.json` belegt, dass der ganze Katalog – und damit jede Prüfsumme darin – vom Ablago-Projekt kommt.

- **Verfahren:** Ed25519 über die **exakten Bytes** von `katalog.json`. Ablago prüft mit `crypto.verify` aus Node, ohne weitere Abhängigkeit (`server/src/katalogsignatur.ts`).
- **`katalog.sig`** liegt neben `katalog.json`, getrennt, damit ältere Ablago-Versionen den Katalog unverändert lesen:

    ```json
    { "format": 1, "verfahren": "ed25519", "schluessel": "6d868387314e64df", "signatur": "<64 Bytes, Base64>", "erstellt": "2026-11-02T10:00:00Z" }
    ```

- **Kennung und Fingerabdruck** eines Schlüssels: SHA-256 über die 32 Bytes des öffentlichen Schlüssels, hexadezimal. Die Kennung sind die ersten 16 Zeichen, der Fingerabdruck alle 64 in Vierergruppen. `werkzeuge/signieren.py fingerabdruck <datei.pub>` in der Registry rechnet genauso.
- **Zwei Projektschlüssel:** Signierschlüssel (Secret in der CI der Registry) und Reserveschlüssel (offline beim Maintainer). Beide öffentlichen Schlüssel stehen fest in Ablago; gültig ist eine Signatur mit einem der beiden.
- **`erstellt`:** Ablago merkt sich je Katalog den neuesten gültig signierten Stand (Einstellung `paket_katalog_staende`, Teil der Sicherung) und lehnt online einen älteren ab – so lässt sich kein alter Katalog mit einer inzwischen behobenen Paketversion unterschieben. Eine Sammeldatei (ohne Internet) zeigt nur „Stand vom …“ und warnt ab 90 Tagen.
- **Übergang:** In 0.141.0 gibt es beim offiziellen Katalog ohne Signatur nur eine Warnung. Eine Minor-Version später **muss** er signiert sein (eigenes Issue). Eine **ungültige** Signatur zählt schon jetzt wie eine fremde Quelle: Die Herkunft muss bestätigt werden, und das Protokoll vermerkt es.
- **Weiterleitungen:** Beim Holen von Katalog, Signatur, Schlüssel und Archiven folgt Ablago Weiterleitungen nur auf `https://`-Adressen (höchstens fünf).

### Projektschlüssel austauschen { #projektschluessel-austauschen }

Die öffentlichen Schlüssel stehen an **einer** Stelle: `server/src/projektschluessel.ts`. Dort stehen die echten Schlüssel des Maintainers (`signier.pub` und `reserve.pub` aus motom001/dms-registry#74, `test: false`); ihre Fingerabdrücke stehen in `SECURITY.md`. Ablago 0.141.0 bis 0.144.1 hatten an dieser Stelle noch Testschlüssel.

| Schlüssel | Kennung | Fingerabdruck |
| --- | --- | --- |
| Signierschlüssel | `6d868387314e64df` | `6d86 8387 314e 64df 715c a3bd 9856 58d5 f888 c0ea 7cab ac91 a43f 9b99 6052 e728` |
| Reserveschlüssel | `4543c81b5ccf522d` | `4543 c81b 5ccf 522d f5a3 5e76 6660 8774 5f6c ae42 4722 3b6d 91c9 63cc 34b0 3954` |

Der Fingerabdruck ist SHA-256 über die **32 Bytes** des Schlüssels, nicht über die ganze DER-Datei (die 44 Bytes, die `openssl pkey -pubin -outform der` ausgibt). Wer `sha256sum` über die DER-Datei rechnet, bekommt einen anderen Wert.

**Tests** signieren nie mit den eingebauten Schlüsseln. Sie geben eigene Testschlüssel mit: `TEST_PROJEKT` aus `server/test/katalogschluessel.ts` als Option `projektSchluessel` an die `Paketverwaltung` bzw. an `projektSchluessel(TEST_PROJEKT)`. Diese Option setzt nur Code; im Betrieb gibt es dafür **keine** Umgebungsvariable und keine Einstellung – sonst ließe sich ein fremder Schlüssel als „Ablago-Projekt“ einschmuggeln. Mit Testschlüsseln zeigt die Vorschau „prüft noch mit Testschlüsseln“ (`test: true`). Der Test „Projektschlüssel“ prüft, dass die eingebauten Schlüssel keine Testschlüssel sind, dass ihre Fingerabdrücke genau so in `SECURITY.md` und `SECURITY.en.md` stehen und dass ein mit Testschlüsseln signierter Katalog im Betrieb als ungültig gilt.

So werden die Schlüssel ausgetauscht (neues Paar, z. B. nach Verlust des Signierschlüssels):

1. Der Maintainer erzeugt das Schlüsselpaar auf seinem eigenen Rechner (Anleitung in der README der Registry, Abschnitt „Katalog signieren“) und veröffentlicht den öffentlichen Schlüssel.
2. In `server/src/projektschluessel.ts` den PEM-Text ersetzen (`test` bleibt `false`).
3. Fingerabdrücke ausrechnen (`python3 werkzeuge/signieren.py fingerabdruck signier.pub` in der Registry) und in `SECURITY.md`, `SECURITY.en.md`, im Test „Projektschlüssel“ und in der Tabelle oben eintragen; in der Registry den öffentlichen Schlüssel unter `schluessel/` ablegen und die Fingerabdrücke in `README.md` und `README.en.md` eintragen.

Fällt der Signierschlüssel aus (verloren oder bekannt geworden), signiert die Registry mit dem Reserveschlüssel weiter; Ablago nimmt das ohne Update an. Danach kommt ein neues Paar (neuer Reserveschlüssel) mit einem DMS-Release.

## Eigener Katalog mit eigenem Schlüssel { #eigener-katalog-mit-eigenem-schluessel }

Wer selbst einen Katalog betreibt (siehe unten, „Eigenes Paket testen“), kann ihn ebenfalls signieren. Ablago behandelt den Schlüssel wie SSH beim ersten Kontakt:

1. **Schlüsselpaar erzeugen** – auf deinem Rechner, nicht auf dem Webserver:

    ```sh
    openssl genpkey -algorithm ed25519 -out katalog.pem
    openssl pkey -in katalog.pem -pubout -out katalog.schluessel
    ```

2. **Signieren** nach jedem Bau des Katalogs, mit dem Werkzeug der Registry:

    ```sh
    python3 werkzeuge/katalog.py <ordner>
    python3 werkzeuge/signieren.py signieren <ordner> --schluessel katalog.pem --oeffentlich katalog.schluessel
    ```

    Es schreibt `<ordner>/katalog.sig` und prüft sie gleich mit dem öffentlichen Schlüssel.
3. **Veröffentlichen:** `katalog.json`, `katalog.sig` und `katalog.schluessel` liegen im selben Ordner auf einem HTTPS-Server. `katalog.pem` bleibt bei dir.
4. **Fingerabdruck nennen:** `python3 werkzeuge/signieren.py fingerabdruck katalog.schluessel` – schreib ihn auf deine Webseite. Wer deinen Katalog in Ablago hinzufügt, sieht den Fingerabdruck und soll ihn damit vergleichen. Ablago übernimmt den Schlüssel erst nach dieser Bestätigung.

Danach verlangt Ablago für diesen Katalog eine **gültige Signatur**: Fehlt sie oder passt sie nicht, nimmt es den Katalog nicht (und vermerkt das im Protokoll). Dafür muss beim Installieren niemand mehr die Herkunft bestätigen. Auch hier gilt: Ein älterer `erstellt` als zuletzt gesehen wird abgelehnt.

**Schlüssel wechseln:**

- **Geordnet:** Signiere den neuen öffentlichen Schlüssel mit dem bisherigen und leg die Signatur als `katalog.schluessel.sig` daneben (Format wie `katalog.sig`):

    ```sh
    openssl genpkey -algorithm ed25519 -out neu.pem
    openssl pkey -in neu.pem -pubout -out neu.schluessel
    python3 werkzeuge/signieren.py signieren-datei neu.schluessel --schluessel katalog.pem --ziel katalog.schluessel.sig
    mv neu.schluessel katalog.schluessel   # danach den Katalog mit neu.pem signieren
    ```

    Ablago übernimmt den neuen Schlüssel ohne Rückfrage, zeigt einen Hinweis und vermerkt den Wechsel im Protokoll. Lass `katalog.schluessel.sig` eine Weile liegen (etwa ein halbes Jahr): Ein Ablago, das den Katalog erst später wieder abruft, braucht den Nachweis auch noch.
- **Ohne den alten Schlüssel** (verloren): Ablago **sperrt** den Katalog mit deutlicher Warnung, bis ein Admin den neuen Fingerabdruck bestätigt. Sag deinen Nutzern Bescheid und nenne den neuen Fingerabdruck auf deiner Webseite.

Ein Katalog **ohne** `katalog.schluessel` bleibt wie bisher: Er geht, aber jede Installation daraus verlangt die Bestätigung der Herkunft.

## Eigenes Paket testen

Bevor dein Paket in den Katalog kommt, probierst du es im eigenen Ablago aus – am besten in einem Test-DMS (z. B. mit [Demo-Daten](https://help.ablago.app/admin/aktuell/demo/)):

1. **Werkbank → Pakete → ▸ Expertenmodus** aufklappen.
2. Den Paketordner als ZIP packen, z. B. `cd pakete/mein_paket && zip -r ../../mein_paket.zip .`, und unter **Paket hochladen** wählen. Ein Ordner vor `manifest.yaml` (z. B. `mein_paket/manifest.yaml`) stört nicht. Ablago prüft das Paket wie ein Katalogpaket und zeigt die Vorschau; Fehler im Format stehen dort gesammelt.
    - **Grenzen:** höchstens **128 MB** als ZIP (dieselbe Grenze im Katalog, beim Hochladen, in der Sammeldatei und beim Paket erstellen; `pruefen.py` und `katalog.py` der Registry lehnen größere Pakete ab), entpackt höchstens 20 MB ohne `code/` (für `code/` gelten ebenfalls 128 MB) und 500 Dateien. Ein hochgeladenes Paket bleibt 30 Minuten zum Installieren bereit; danach erneut hochladen.
3. Installieren (Herkunft bestätigen), ansehen, ändern. Für ein Update die **Version erhöhen** und erneut hochladen – Ablago aktualisiert wie bei einem Update aus dem Katalog (nur ergänzen). Zum Neuanfang das Paket entfernen (geht, solange es keine Mappen seiner Mappentypen gibt).

Mehrere Pakete testest du auch als eigenen Katalog: `python3 werkzeuge/katalog.py <ordner>` baut `katalog.json` und die Archive; leg den Ordner auf einen HTTPS-Server und trage die Adresse von `katalog.json` im Expertenmodus unter **Weitere Quellen** ein.

## Ausblick

- **Pakete mit Code** gibt es seit 0.88.0: WebAssembly-Module, die auf Ereignisse reagieren und mit bestätigten Rechten über die API arbeiten – siehe [Pakete mit Code](pakete-code.md), mit der Übersicht der [Schnittstellen des Kerns](pakete-code.md#schnittstellen) (Vektoren, Antworten, Erkennung, Texterkennung, [Dateien umwandeln](pakete-code.md#dateien-umwandeln), [Volltext liefern](pakete-code.md#volltext-liefern)).
