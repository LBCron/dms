# Sicherung

Wie du eine Sicherung wieder einspielst und wie Ablago sie wöchentlich probeweise einspielt, steht unter [Wiederherstellen](wiederherstellen.md).

Unter **Werkbank → Sicherung** legt Ablago Sicherungen selbst an: die ganze Datenbank und alle Dateien zum **selben Zeitpunkt**, verschlüsselt, ohne dass jemand aufhören muss zu arbeiten.

Eine Sicherung spielst du mit Ablago wieder ein. Möchtest du deine Unterlagen zusätzlich so haben, dass du sie **auch ohne Ablago** lesen kannst – etwa zum Mitnehmen in ein anderes Programm –, nimm den [Vollexport](export.md) in offenen Formaten.

![Sicherung in der Werkbank](bilder/werkbank-sicherung.png)

## Was eine Sicherung enthält

Jede Sicherung besteht aus zwei Dateien im Sicherungsordner, z. B.:

| Datei | Inhalt |
| --- | --- |
| `2026-10-29_0200-automatisch.dms-sicherung` | Datenbank und alle Dateien (Dokumente, [umgewandelte Fassungen](texterkennung.md#andere-dateitypen), Logos, Bilder gemeldeter Fehler), gepackt und **verschlüsselt** |
| `2026-10-29_0200-automatisch.json` | Metadaten, lesbar: Ablage-Id (Feld `haushaltId`), Versionen (Ablago, Datenbank-Stand, PostgreSQL, Node.js, Betriebssystem, Architektur), Art, Beginn und Dauer, Anzahl Mappen, Dokumente, Benutzer und umgewandelter Fassungen (Feld `anzahl.fassungen`), Größen, Verschlüsselung mit Fingerabdruck des Schlüssels und die **SHA-256-Prüfsumme** der Sicherungsdatei |

- Verschlüsselt wird mit AES-256-GCM. Der Schlüssel dafür wird aus dem Schlüssel unter **Werkbank → [Verschlüsselung](verschluesselung.md)** abgeleitet – derselbe wie für Passwortfelder. **Ohne diesen Schlüssel ist eine Sicherung nicht lesbar.** Er steht nie in der Sicherung, nur in der Schlüsseldatei und auf dem [Notfallblatt](#notfallblatt).
- Angemeldete Sitzungen gehören nicht dazu: Nach einer Wiederherstellung meldet sich jeder neu an.
- Die **umgewandelten Fassungen** von Paketen (z. B. ein TIFF-Scan als PDF, siehe [Andere Dateitypen](texterkennung.md#andere-dateitypen)) gehören seit Version 0.140.1 **dazu**, mit der Angabe, welches Paket sie erzeugt hat. Nach einer Wiederherstellung sind Fassung, Volltext und Vorschau so da wie vorher – auch wenn das Paket nicht mehr installiert ist oder eine neuere Version heute anders umwandeln würde.
- Die **Archivfassungen (PDF/A)** von Paketen (siehe [Archivfassung](texterkennung.md#archivfassung-pdfa)) gehören seit Version 0.149 ebenso dazu, mit Stand und den Wortpositionen der Texterkennung. Die Metadaten nennen ihre Zahl (`anzahl.archivfassungen`); die Probe-Wiederherstellung prüft jede gegen ihren Prüfwert.
- Die **Vorschaubilder** der Dokumente gehören nicht dazu – sie entstehen nach einer Wiederherstellung von selbst neu (aus der Datei bzw. der Fassung), und nichts verweist auf sie. Der Grundsatz: Im Zweifel kommt etwas in die Sicherung; draußen bleibt nur, was sich jederzeit gleich neu erzeugen lässt.
- Die Datenbank liest Ablago selbst – unabhängig von der PostgreSQL-Version. Eine Sicherung taugt deshalb auch für den Wechsel auf eine neue Hauptversion von PostgreSQL.
- Ein **Prüfwort** (ein bekanntes Wort, verschlüsselt in der Datenbank) zeigt nach einer Wiederherstellung, ob der richtige Schlüssel greift.

Ohne Schlüssel lässt sich keine Sicherung anlegen; die Seite weist dann auf die Verschlüsselung hin.

## Jetzt sichern

Oben im Abschnitt steht der Stand in einer Zeile: letzte Sicherung, Anzahl und Größe der Sicherungen, nächster Termin laut Zeitplan, freier Platz und wann das Notfallblatt heruntergeladen wurde.

**Jetzt sichern** startet eine Sicherung im Hintergrund, mit Fortschritt. Du kannst die Seite verlassen. Ist weniger Platz frei als der [Mindest-Speicherplatz](#zeitplan-und-aufbewahrung), beginnt keine Sicherung.

Die Liste zeigt alle Sicherungen im Ordner mit Zeitpunkt, Art, Größe und Inhalt. **Prüfen** rechnet die Prüfsumme der Datei nach und vergleicht sie mit der aus den Metadaten – „unverändert“ heißt: Die Datei ist so, wie Ablago sie geschrieben hat. **Löschen** entfernt beide Dateien.

Im Container geht das auch ohne Browser mit dem [Befehl `dms`](konsole.md#betrieb): `dms sicherung` listet die Sicherungen, `dms sicherung jetzt` startet eine, `dms sicherung pruefen <name>` prüft eine.

## Zeitplan und Aufbewahrung

![Zeitplan und Aufbewahrung](bilder/werkbank-sicherung-zeitplan.png)

- **Automatisch sichern** täglich oder wöchentlich zu einer Uhrzeit (z. B. täglich 02:00). War Ablago zu der Zeit aus, sichert es, sobald es wieder läuft – aber nur am selben Tag. Eine verpasste Sicherung vom Vortag holt es nicht nach; es sichert erst wieder zum nächsten geplanten Termin. Mehr als eine automatische Sicherung am Tag gibt es nie.
- Einschalten lässt sich der Zeitplan erst, wenn das **Notfallblatt** heruntergeladen ist – denn nur mit dem Schlüssel darauf lässt sich eine Sicherung öffnen.
- **Aufbewahrung** (Standard **7 tägliche / 4 wöchentliche / 12 monatliche**): Von den automatischen Sicherungen bleibt je Tag, je Woche und je Monat die neueste, so viele wie eingestellt; ältere entfernt Ablago nach jeder automatischen Sicherung. Von Hand angelegte Sicherungen bleiben, bis du sie löschst.
- **Lokal nur die neueste behalten** (seit 0.142): Statt der Aufbewahrung bleibt nur die neueste automatische Sicherung im Ordner – für knappen Platz, wenn eine [Kopie außer Haus](sicherung-ausser-haus.md) entsteht. Eine Sicherung, deren Kopie gerade läuft, bleibt stehen, bis sie angekommen ist (höchstens 2 Tage). „Lokal keine“ gibt es nicht.
- **Mindest-Speicherplatz** (Standard 1 GB): Ist im Sicherungsordner weniger frei, beginnt keine Sicherung; das steht als Hinweis in der Werkbank und im Protokoll.
- Im aktiven [Wartungsmodus](wartungsmodus.md) pausiert die automatische Sicherung.

!!! note "Später"
    Sicherungen, die nur neue Dateien enthalten, sparen Platz, machen die Wiederherstellung aber zu einer Kette. Das kommt erst, wenn der Platz drückt.

## Speicherplatz

Die Seite zeigt, wie groß Dokumente und Datenbank heute sind, eine **Hochrechnung** für die gewählte Aufbewahrung (jede Sicherung ist vollständig; die Datenbank lässt sich gut packen, Dokumente kaum), wie viel die Sicherungen belegen und wie viel im Ordner frei ist. Wird es knapp – weniger frei als der Mindest-Speicherplatz oder als zwei weitere Sicherungen –, warnt sie. Unabhängig davon überwacht **Werkbank → [Systemzustand](speicherplatz.md)** alle Ordner von Ablago mit Warnschwelle und Grenze.

## Hinweise bei Problemen

Die Übersicht der Werkbank zeigt einen Hinweis, wenn

- die letzte Sicherung **fehlgeschlagen** ist,
- die letzte erfolgreiche **älter als 2 Tage** ist (oder es noch keine gibt),
- das Notfallblatt fehlt oder zu einem früheren Schlüssel gehört,
- der Sicherungsordner kein eigenes Volume ist oder auf derselben Platte liegt wie die Dokumente,
- die [Kopie außer Haus](sicherung-ausser-haus.md#anzeige-und-hinweise) fehlgeschlagen ist oder seit mehr als 2 Tagen keine neuere Sicherung dort ankam.

Schlägt eine Sicherung fehl, bekommen alle Administratoren eine E-Mail – auch ohne Zeitplan, etwa bei **Jetzt sichern**. Ist die letzte erfolgreiche Sicherung zu alt, kommt die E-Mail nur, wenn der Zeitplan an ist. Es kommt **eine** E-Mail je Vorfall (nicht stündlich) – sofern der [E-Mail-Versand](installation.md#e-mail-und-adresse) eingerichtet ist. Alles steht auch im [Protokoll](fehlersuche.md#protokoll), Modul *sicherung*.

## Speicherort

Der Sicherungsordner ist in den [Compose-Vorlagen](https://github.com/motom001/dms/tree/main/deploy) ein eigenes Volume – bei zwei Containern wie bei [dms-komplett](https://help.ablago.app/installieren/aktuell/komplett/):

```yaml
volumes:
  - /volume1/docker/dms/sicherung:/data/sicherung
```

Liegt er auf derselben Platte wie Datenbank und Dokumente, nützt die Sicherung nichts, wenn diese Platte ausfällt. Die Werkbank warnt, wenn sie das erkennt (gleiche Platte wie die Dokumente; die Platte der Datenbank sieht Ablago nicht). Halte dich an die **3-2-1-Regel**:

- **3 Kopien** deiner Daten: das laufende Ablago und zwei Sicherungen,
- auf **2 verschiedenen Medien**, z. B. NAS und USB-Platte,
- **1 Kopie außer Haus**, z. B. in der Cloud oder bei Verwandten.

Ablago schreibt nur in den Sicherungsordner. Weiterkopieren lässt du ihn vom NAS, zum Beispiel:

- **Synology:** *Hyper Backup* mit dem Ordner `docker/dms/sicherung` als Quelle, Ziel USB-Platte oder Cloud (C2, S3, …).
- **UGREEN, QNAP und andere:** die Sicherungs-App des NAS (z. B. *Hybrid Backup Sync*) oder eine Synchronisation auf eine USB-Platte.
- Alternativ den Sicherungsordner gleich auf eine zweite Platte des NAS legen (`/volume2/…`) und diese weiterkopieren.

Ohne Sicherungs-App – etwa auf einem Raspberry Pi oder einem gemieteten Server – bringt ein Paket wie **Sicherungsziel WebDAV** jede Sicherung selbst außer Haus und prüft sie dort, siehe [Sicherung außer Haus](sicherung-ausser-haus.md).

Da die Sicherungen verschlüsselt sind, dürfen sie auch in eine Cloud. Das [Notfallblatt](#notfallblatt) mit dem Schlüssel gehört **nicht** dorthin.

**Was unverschlüsselt ist und wo es liegt:** Vollexporte, „Meine Daten exportieren“ und Auskünfte nach Art. 15 sind unverschlüsselt. Sie liegen deshalb nicht im Sicherungsordner, sondern im eigenen [Export-Ordner](export.md#export-ordner) (`/data/export`, neben `files/`) und werden nach dem Herunterladen bzw. nach 7 Tagen gelöscht. Den Sicherungsordner kannst du also vollständig in die Cloud kopieren. Legst du den Export-Ordner selbst an einen anderen Ort, dann nie in den Sicherungsordner – die Werkbank warnt, wenn er dort liegt.

## Notfallblatt

**Notfallblatt herunterladen** (hier und unter *Verschlüsselung*) erzeugt ein PDF mit allem, was du nach einem Ausfall brauchst – auf **einer Seite A4** in Ablago-Optik, auch in Schwarzweiß gut lesbar:

1. **Kopf:** Logo, Name deiner Ablage, Datum und Ablago-Version.
2. **Schlüssel:** groß in Vierergruppen zum Abtippen, dazu sein **Fingerabdruck**. Die Null ist durchgestrichen, und unter leicht verwechselbaren Zeichen (`0` und `O`, `l`, `I` und `1`, `-` und `_`) steht klein, welches gemeint ist. Einen QR-Code mit dem Schlüssel gibt es bewusst nicht – das wäre ein Weg mehr, an ihn zu kommen.
3. **Diese Ablage:** Adresse, **Ablage-Id** und in einem Satz, wo die Sicherungen liegen – seit 0.142 auch das Ziel der [Kopie außer Haus](sicherung-ausser-haus.md) (Paket und Adresse, ohne Benutzer und Passwort).
4. **Wen fragen?** Zeilen, in die du einträgst, wer dir im Ernstfall hilft.
5. **Etwas ist passiert?** Die Links zur Hilfeseite [Was ist dir passiert?](was-ist-passiert.md) – klickbar und immer mit `https://` ausgeschrieben: `https://help.ablago.app/notfall` (Englisch `https://help.ablago.app/emergency`) – und ein **QR-Code** dazu. Scanne ihn mit dem Handy, lies dort und arbeite parallel am Computer.

Ordner, Dateinamen und die Schritte zum Wiederherstellen stehen nicht auf dem Blatt, sondern hier im Handbuch unter [Wiederherstellen](wiederherstellen.md) – dort bleiben sie aktuell. Eine Adresse ohne `https://` steht ohne `http://` davor auf dem Blatt und ist nicht klickbar.

![Notfallblatt](bilder/notfallblatt.png)

Wo das Datenbank-Passwort steht, hängt von der Vorlage ab:

| Vorlage | Datenbank-Passwort |
| --- | --- |
| allgemeine Vorlage (`deploy/nas`) | in der Datei `.env` neben der Compose-Datei (`DB_PASSWORD`) |
| Synology, UGREEN, QNAP, TrueNAS, Unraid | oben in der Compose-Datei (`x-passwort`) |
| dms-komplett | keins – die Datenbank ist nur im Container erreichbar |

Auf dem Notfallblatt steht es nicht. Für ein neues System genügt ohnehin ein neues Passwort.

**Aufbewahren:** ausgedruckt an einem sicheren Ort (z. B. bei den Familienunterlagen oder im Tresor des Betriebs) oder als PDF in einem Passwortsafe – auf jeden Fall **getrennt vom NAS** und nicht neben den Sicherungen. Wer das Blatt hat, kann die Sicherungen lesen.

Jeder Download steht im Protokoll (ohne den Schlüssel). Ändert sich der Schlüssel ([Schlüssel wechseln](verschluesselung.md#schlussel-wechseln)), weist die Werkbank darauf hin, ein neues Notfallblatt zu erstellen; ältere Sicherungen brauchen weiterhin das alte – bewahre es auf, solange es solche Sicherungen gibt. In der Liste tragen sie den Hinweis „früherer Schlüssel“; mit **Sicherungen mit früherem Schlüssel löschen** entfernst du sie alle auf einmal. Die [Probe-Wiederherstellung](wiederherstellen.md#probe-wiederherstellung) braucht den aktuellen Schlüssel – Sicherungen mit früherem Schlüssel lassen sich nicht probeweise einspielen.

!!! tip "Für Selbstständige und Vermieter"
    Wie Sicherung, Historie und Berechtigungen zusammen eine geordnete Belegablage ergeben, beschreibt die [Vorlage für die Verfahrensdokumentation](verfahrensdokumentation.md).
