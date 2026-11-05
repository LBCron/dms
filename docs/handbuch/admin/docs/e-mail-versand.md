# E-Mail-Versand

Ablago verschickt Einladungen, Passwort-Links, die [Tägliche Zusammenfassung](aufgaben.md#tagliche-zusammenfassung) und Mappen, die jemand [per E-Mail versendet](https://help.ablago.app/benutzer/versenden/). Dafür braucht es ein Postfach, über dessen Mailserver (SMTP) Ablago schreibt. Den Versand richtest du im [Einrichtungsassistenten](installation.md#optionales) ein oder später unter **Werkbank → E-Mail und Adresse**. Beide Stellen sind gleich aufgebaut; nur **Verbindung prüfen** und die Testmail gibt es erst in der Werkbank, weil sie eine Anmeldung brauchen.

Was dabei hinausgeht, steht unter [Was deine Ablage verlässt](datenschutz.md#was-deine-ablage-verlasst): nur Mails, die jemand auslöst oder einschaltet, über deinen Mailserver.

## Der einfache Weg: Adresse und Passwort

![E-Mail-Versand im Einrichtungsassistenten](bilder/einrichtung-mail.png)

1. **Mit welcher E-Mail-Adresse soll Ablago schreiben?** Vorbelegt ist die Adresse deines Kontos (im Assistenten die des Administrators). Am besten nimmst du eine eigene Adresse für Ablago, etwa `ablage@example.org`.
2. **Passwort** bzw. **App-Passwort** des Postfachs eintragen.
3. **Verbindung prüfen** (in der Werkbank). Ablago meldet sich am Server an, ohne etwas zu senden.

Den Rest schlägt der Assistent aus der Adresse vor und kennzeichnet ihn mit **vorgeschlagen vom Assistenten**:

| Angabe | Vorschlag |
| --- | --- |
| Server, Port, Verbindungsart | aus der Liste bekannter Anbieter oder gefunden (siehe unten) |
| Benutzer | die Adresse selbst (laut Einstellungsdatei mancher Anbieter nur der Teil vor dem @) |
| Absender | `Ablago – {Name der Ablage} <adresse>`, z. B. `Ablago – Familie Beispiel <lena@example.org>` |
| Testmail an | dieselbe Adresse |

Übernommen wird nur, was sichtbar dasteht. Änderst du ein Feld selbst, ist es kein Vorschlag mehr und bleibt, wie du es eingetragen hast. Im Assistenten setzt du zuerst das Häkchen **E-Mail-Versand jetzt einrichten**; ohne Häkchen bleibt der Versand aus. **Weiter** übernimmt die Angaben in die Zusammenfassung, eigene Speichern-Knöpfe gibt es dort nicht. Gespeichert wird erst mit **Jetzt einrichten**. Das Passwort behält der Assistent bis dahin nur, solange die Seite offen ist; nach dem Neuladen fragt er es erneut ab. In der Werkbank speicherst du wie überall über die Leiste unten.

## Server und Port finden

Ablago sucht den Server in dieser Reihenfolge:

1. **Eingebaute Liste** gängiger Anbieter: GMX, WEB.DE, T-Online, Gmail, Outlook.com, iCloud, Posteo und mailbox.org. Dafür verlässt nichts das Gerät.
2. Steht die Domain nicht in der Liste, fragt Ablago beim Verlassen des Adressfelds das **DNS deiner Domain**: die SRV-Einträge `_submissions._tcp` und `_submission._tcp` (RFC 8314, RFC 6186) und den MX-Eintrag. Am MX-Eintrag erkennt Ablago eigene Domains bei IONOS, Strato, Microsoft 365, Google Workspace und mailbox.org.
3. Danach die **Einstellungsdatei deines eigenen Anbieters**, falls es sie gibt: `https://autoconfig.<domain>/mail/config-v1.1.xml` und `https://<domain>/.well-known/autoconfig/mail/config-v1.1.xml`.
4. Findet Ablago nichts, kannst du **In der Thunderbird-Datenbank nachschlagen**. Das geschieht nur auf diesen Knopfdruck.

**Was das Gerät dabei verlässt:** In Schritt 2 geht eine DNS-Anfrage mit der Domain (z. B. `example.org`) an den DNS-Server, den dein NAS sowieso nutzt. In Schritt 3 gehen zwei HTTPS-Anfragen an die Domain deines eigenen Anbieters. Sie enthalten keine Adresse, und Weiterleitungen an andere Adressen folgt Ablago nicht. In Schritt 4 geht nur die Domain an `autoconfig.thunderbird.net` (Mozilla). Adresse und Passwort verlassen das Gerät bei der Suche nie. Jede Anfrage hat ein Zeitlimit von wenigen Sekunden. Unter dem Vorschlag steht, wen Ablago gefragt hat.

Findet Ablago keinen Server, öffnet sich **Erweitert**. Server und Port stehen dann meist in der Hilfe deines Anbieters.

## Hinweise je Anbieter

| Anbieter | Server | Was zu beachten ist |
| --- | --- | --- |
| GMX | `mail.gmx.net`, 587, STARTTLS | Den Versand per SMTP erst im Postfach freischalten: Einstellungen → POP3/IMAP Abruf ([Hilfe von GMX](https://hilfe.gmx.net/pop-imap/einschalten.html)) |
| WEB.DE | `smtp.web.de`, 587, STARTTLS | wie GMX freischalten ([Hilfe von WEB.DE](https://hilfe.web.de/pop-imap/einschalten.html)) |
| T-Online | `securesmtp.t-online.de`, 465, SSL/TLS | das **E-Mail-Passwort** aus dem Kundencenter, nicht das Passwort für den Login |
| Gmail | `smtp.gmail.com`, 465, SSL/TLS | ein **App-Passwort** ([Hilfe von Google](https://support.google.com/accounts/answer/185833)) oder die [Anmeldung über OAuth](#anmeldung-uber-oauth) |
| Outlook.com | `smtp-mail.outlook.com`, 587, STARTTLS | [Anmeldung über OAuth](#anmeldung-uber-oauth) |
| Microsoft 365 | `smtp.office365.com`, 587, STARTTLS | [Anmeldung über OAuth](#anmeldung-uber-oauth). Microsoft schaltet die Anmeldung mit Passwort für SMTP bei Exchange Online Ende Dezember 2026 ab ([Hilfe von Microsoft](https://learn.microsoft.com/de-de/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission)) |
| iCloud | `smtp.mail.me.com`, 587, STARTTLS | ein **App-spezifisches Passwort** ([Hilfe von Apple](https://support.apple.com/de-de/102654)) |
| Posteo | `posteo.de`, 587, STARTTLS | – |
| mailbox.org | `smtp.mailbox.org`, 465, SSL/TLS | – |
| IONOS | `smtp.ionos.de`, 587, STARTTLS | erkannt am MX-Eintrag deiner Domain |
| Strato | `smtp.strato.de`, 465, SSL/TLS | erkannt am MX-Eintrag deiner Domain |

Dieselben Hinweise zeigt Ablago unter dem Vorschlag an, mit Link zur Hilfe des Anbieters.

## Verbindung prüfen und Testmail

![Werkbank → E-Mail und Adresse: E-Mail-Versand](bilder/werkbank-mail.png)

**Verbindung prüfen** steht gleich unter dem Passwort. **Testmail senden** schickt eine Mail an die Adresse unter *Testmail an*. Beides geht mit den Werten im Formular, auch bevor du speicherst.

Klappt etwas nicht, nennt Ablago die Ursache in einem Satz. Die genaue Antwort des Servers steht darunter unter *Antwort des Servers*.

| Meldung | Was hilft |
| --- | --- |
| Passwort falsch oder App-Passwort nötig | Passwort prüfen; bei Gmail und iCloud ein App-Passwort anlegen; bei GMX und WEB.DE den Versand freischalten |
| Google verlangt ein App-Passwort | App-Passwort anlegen oder OAuth nehmen |
| Microsoft lässt die Anmeldung mit Passwort hier nicht zu | [Anmeldung über OAuth](#anmeldung-uber-oauth) |
| Der Server lässt diesen Absender nicht zu | als Absender die Adresse des Kontos nehmen |
| Die Verbindungsart passt nicht zum Port | 465 gehört zu SSL/TLS, 587 zu STARTTLS |
| Das Zertifikat des Servers ist nicht vertrauenswürdig | Servernamen prüfen; nur bei einem eigenen Server im Heimnetz *Selbstsigniertes Zertifikat erlauben* |
| Der Server antwortet nicht / Keine Verbindung | Server und Port prüfen; manche Netze sperren ausgehende Mail-Ports |

## Erweitert

Eingeklappt unter **Erweitert** stehen alle Felder: Server, Verbindungsart (STARTTLS, meist Port 587; SSL/TLS, meist 465; unverschlüsselt nur im Heimnetz), Port, Benutzer, Absender, *Gespeichertes Passwort entfernen* und *Selbstsigniertes Zertifikat erlauben*. Ein leerer Benutzer heißt: ohne Anmeldung, etwa für einen Mailserver im Heimnetz.

Das Passwort speichert Ablago mit dem [Schlüssel](verschluesselung.md) verschlüsselt und zeigt es nie wieder an.

## Anmeldung über OAuth

Bei **Microsoft 365, Outlook.com** und **Gmail** kann Ablago statt mit Passwort über **OAuth** senden (SMTP mit XOAUTH2). Das ist dieselbe Anmeldung wie bei den [Postfächern](postfaecher.md#anmeldung-mit-oauth): dieselbe App beim Anbieter, dieselbe Umleitungs-URI, derselbe Ablauf im Browser oder mit Gerätecode.

1. Die App beim Anbieter anlegen, wie unter [Postfächer → Anmeldung mit OAuth](postfaecher.md#anmeldung-mit-oauth) beschrieben. Bei **Microsoft** braucht sie zusätzlich die Berechtigung **SMTP.Send** (Office 365 Exchange Online, delegiert). Bei **Google** gilt der Bereich `https://mail.google.com/` für Abruf und Versand.
2. **Werkbank → E-Mail und Adresse**: Adresse eintragen, *Anmeldung* **Über Microsoft (OAuth)** bzw. **Über Google (OAuth)** wählen und **speichern**.
3. Darunter, falls noch nicht geschehen, **Client-ID** und **Client-Geheimnis** eintragen und dann **Im Browser anmelden** oder **Mit Gerätecode anmelden** (nur Microsoft).
4. **Verbindung prüfen**.

Im Einrichtungsassistenten gibt es OAuth noch nicht, weil die App beim Anbieter vorher angelegt sein muss. Dort steht ein Hinweis; eingerichtet wird es danach in der Werkbank.

!!! note "Sicherheit"
    Mit OAuth schickt Ablago das Zugriffstoken nur an den Versandserver des Anbieters selbst (`smtp.office365.com`, `smtp-mail.outlook.com` bzw. `smtp.gmail.com`), nur verschlüsselt und nur mit gültigem Zertifikat. Token speichert Ablago nur verschlüsselt; sie erscheinen nie in der Oberfläche. Änderst du Anmeldeart, Anbieter, Konto oder Server, oder an der App den Mandanten, meldet Ablago den Versand ab. Der Anbieter sieht dabei jede Anmeldung, aber keine Unterlagen außer den Mails, die über ihn hinausgehen.

Ablago erneuert die Anmeldung vor Ablauf selbst. Ist sie abgelaufen oder entzogen, scheitert der Versand mit einem klaren Hinweis, bis du dich in der Werkbank neu anmeldest. Eine Mail darüber gibt es dann nicht, denn sie müsste über genau diese Anmeldung gehen.
