# Notfall: Was ist dir passiert?

Du hast das [Notfallblatt](sicherung.md#notfallblatt) vor dir und den Code darauf gescannt? Gut. Lies hier am Handy und arbeite parallel am Computer. Such dir aus, was passiert ist – jeder Fall hat nur wenige Schritte.

Diese Seite erreichst du immer unter **https://help.ablago.app/notfall** (Englisch: **https://help.ablago.app/emergency**). Die Adressen bleiben gültig, weil sie auf Papier stehen.

## Ablago startet nicht mehr { #startet-nicht }

Zum Beispiel nach einem Update. Deine Daten liegen weiter auf dem Gerät – ein Update löscht nichts.

1. Öffne die Verwaltung deines Geräts (z. B. den Container Manager auf dem NAS) und sieh dir das Protokoll des Ablago-Containers an. Meist steht dort in einer Zeile, was fehlt.
2. Kam das nach einem Update: Trag die vorige Version als Image-Tag ein und starte neu. Wie das geht, steht unter [Welches Image-Tag?](aktualisieren.md#image-tag).
3. Hilft das nicht, führt dich die [Fehlersuche](fehlersuche.md) weiter.

## Mein Gerät ist kaputt { #geraet-kaputt }

Du richtest Ablago neu ein und spielst die Sicherung ein.

1. Leg bereit: das **Notfallblatt** mit dem Schlüssel und die **beiden Dateien einer Sicherung** – vom alten Datenträger oder von der [Kopie außer Haus](sicherung-ausser-haus.md).
2. Installiere Ablago neu, wie unter [Wie komme ich an Ablago?](https://help.ablago.app/installieren/aktuell/) beschrieben.
3. Kopiere die beiden Dateien in den Sicherungsordner der neuen Installation.
4. Öffne Ablago im Browser. Wähle im Einrichtungsassistenten **Aus einer Sicherung wiederherstellen** und tippe den **Schlüssel vom Notfallblatt** ein. Leerzeichen zählen nicht; unter leicht verwechselbaren Zeichen steht auf dem Blatt, welches gemeint ist.
5. Danach meldest du dich mit deinen bisherigen Zugangsdaten an.

Alle Einzelheiten stehen unter [Neues NAS, alte Sicherung](wiederherstellen.md#neues-nas-alte-sicherung).

## Ich komme nicht mehr hinein { #kein-zugang }

- **Passwort vergessen:** Wähle auf der Anmeldeseite **Passwort vergessen** – das geht, wenn der E-Mail-Versand eingerichtet ist. Sonst erzeugt ein anderer Administrator unter **Werkbank → Benutzer** einen Passwort-Link für dich.
- **Kein Administrator kommt mehr hinein:** Leg dir über eine Datei auf dem Gerät einen Notfallzugang an – Schritt für Schritt unter [Notfall: kein Admin mehr](notfall.md).
- **Handy für die Zwei-Faktor-Anmeldung verloren:** Ein anderer Administrator setzt sie zurück, oder du nutzt den [Befehl `dms`](konsole.md) im Container.

## Jemand anderes muss übernehmen { #uebernehmen }

Du hast das Notfallblatt gefunden, weil die Person, die Ablago eingerichtet hat, nicht mehr kann?

1. **Bewahre das Blatt gut auf** und gib es nicht weiter. Wer es hat, kann die Sicherungen lesen.
2. Unter **Wen fragen?** auf dem Blatt stehen Menschen, die helfen können. Sprich zuerst mit ihnen.
3. **Läuft Ablago noch**, melde dich mit dem Zugang eines Administrators an (oft im Passwortsafe). Fehlt er, hilft [Notfall: kein Admin mehr](notfall.md). Leg dir dann ein eigenes Konto an, siehe [Benutzer und Rollen](benutzer.md).
4. **Läuft Ablago nicht mehr**, geh vor wie unter [Mein Gerät ist kaputt](#geraet-kaputt).
