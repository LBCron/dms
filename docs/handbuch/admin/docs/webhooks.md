# Webhooks

Mit einem **Webhook** meldet sich Ablago selbst bei einem anderen System, sobald sich die Zahlen eines Benutzers ändern: neue Post, *Zu erledigen*, anstehende und überfällige Fristen. Hausautomatisierung (Homey, Node-RED, ioBroker, openHAB) und eigene Skripte reagieren dann sofort, statt alle paar Minuten nachzufragen.

Benutzer legen ihre Webhooks selbst an (**Profil → Benachrichtigungen → Sofort melden**); sie gelten immer für die eigenen Zahlen und in den eigenen Rechten. Du als Administrator bestimmst unter **Werkbank → Webhooks**, **wohin** gemeldet werden darf, siehst alle Webhooks und schaltest sie bei Bedarf ab. Wie Benutzer einen Webhook einrichten (mit Beispiel für Node-RED), steht im Benutzerhandbuch unter [In die Hausautomatisierung einbinden](https://help.ablago.app/benutzer/aktuell/hausautomatisierung/#sofort-melden-webhook).

## Was gemeldet wird – und was nie

Eine Meldung enthält **nur** die Art, eine Ereignis-Id, eine Zeit und die Zahlen – dieselben wie beim [Zähler-Endpunkt](api.md#zaehler):

```json
{"art":"zaehler.geaendert","id":"7c0e6a8e-3d1f-4f0a-9c55-2b8f0d3e4a11","zeit":"2026-11-03T07:15:02.000Z","daten":{"neuePost":2,"zuErledigen":5,"anstehend":3,"ueberfaellig":1,"stand":42,"geaendert":"2026-11-03T07:15:00.000Z"}}
```

**Keine** Titel, Absender, Namen, E-Mail-Adressen oder Inhalte. Wer mehr wissen will, holt es über die [Schnittstelle](api.md) mit einem eigenen Schlüssel und eigenen Rechten. Ablago meldet nur an Adressen, die du freigegeben hast – nie an das Projekt oder an andere Server.

## Ziele freigeben

Unter **Werkbank → Webhooks → Freigegebene Ziele** trägst du je Zeile eine Adresse ein. Es zählt nur ihr Anfang (Schema, Rechner, Port), z. B.:

```text
http://homey.home.arpa
http://192.168.178.20:1880
https://hooks.example.org
```

- **`https://`** geht überall, **`http://`** ohne TLS nur im Heimnetz: private Adressen (`192.168.…`, `10.…`, `172.16–31.…`), `localhost`, Namen ohne Punkt und die Endungen `.home.arpa`, `.lan`, `.local`, `.internal` – dieselbe Liste wie bei der Anmeldung über einen Anbieter.
- Benutzer können Webhooks **nur an freigegebene Ziele** richten. Legst du selbst im Profil einen Webhook an, gibt Ablago dessen Ziel gleich mit frei.
- Nimmst du ein Ziel heraus, stellt Ablago dorthin **nichts mehr zu**; die Webhooks zeigen dann „Das Ziel ist nicht mehr freigegeben“.

!!! warning "Ein Ziel ist eine ausgehende Verbindung"
    Mit einem Ziel erlaubst du Ablago, Anfragen an diese Adresse zu schicken. Gib nur Systeme frei, die eine solche Meldung erwarten – nicht etwa die Datenbank, den Router oder die Verwaltungsseite des NAS.

## Übersicht und Abschalten

Darunter stehen **alle Webhooks** mit Benutzer, Adresse, letzter Zustellung (Zeit, Ergebnis, HTTP-Status, Fehler) und der Zahl der Fehlschläge in Folge. Die Leiste zeigt ein **!**, sobald ein Webhook Fehler hat oder abgeschaltet wurde.

- **Ausschalten** – Ablago meldet nichts mehr; eine wartende Meldung verfällt. Hast du abgeschaltet, kann nur ein Administrator wieder **einschalten**, nicht der Benutzer selbst.
- **Löschen** – der Webhook ist weg, samt Verlauf. Wird ein Benutzer gelöscht, verschwinden seine Webhooks mit.

## Zustellung

- **Zusammenfassen:** Nach einer Änderung wartet Ablago etwa 3 Sekunden und zählt dann. Je Webhook geht **höchstens eine Meldung je 30 Sekunden** hinaus; was dazwischen passiert, kommt zusammengefasst mit dem neuesten Stand. 20 Briefe aus dem Scanner ergeben so wenige Meldungen.
- **Zeitgrenze:** 5 Sekunden je Zustellung. Als angekommen gilt jede Antwort `2xx`.
- **Keine Weiterleitungen:** Antwortet der Empfänger mit `301`, `302` usw., folgt Ablago nicht und meldet einen Fehler. Trag die endgültige Adresse ein.
- **Wiederholen:** Bei einem Fehler versucht es Ablago erneut, mit wachsenden Abständen (30 Sekunden, 1, 2, 5, 10, 30 Minuten, 1, 2, 4, 6, 8 Stunden) – zusammen etwa 22 Stunden, 12 Versuche. Kommen inzwischen neue Zahlen, geht beim nächsten Versuch der neue Stand hinaus.
- **Abschalten nach vielen Fehlschlägen:** Klappt auch der letzte Versuch nicht, schaltet Ablago den Webhook ab, zeigt den Grund im Profil und hier und schickt den Administratoren eine E-Mail (wenn der [E-Mail-Versand](installation.md#e-mail-und-adresse) eingerichtet ist). Der Benutzer schaltet ihn nach der Reparatur wieder ein; dann kommt gleich eine Meldung mit dem aktuellen Stand.
- **Mindestens einmal:** Die Meldungen warten in der Datenbank. Nach einem Neustart oder einer Unterbrechung geht eine Meldung unter Umständen ein zweites Mal hinaus – mit derselben **Ereignis-Id**, an der der Empfänger die Wiederholung erkennt.
- Im **Wartungsmodus** und während einer **Wiederherstellung** ruht die Zustellung und holt danach nach.

## Signatur

Jeder Webhook hat ein eigenes **Geheimnis** (`whsec_…`). Ablago zeigt es nur beim Anlegen und beim Erneuern ganz an und speichert es mit dem [Schlüssel von Ablago](verschluesselung.md) verschlüsselt; beim Schlüsselwechsel wird es mit umgeschlüsselt. Mit ihm signiert Ablago jede Meldung:

| Kopf | Inhalt |
| --- | --- |
| `X-DMS-Signatur` | `v1=` und HMAC-SHA256 (hex) über `<X-DMS-Zeit>.<Rumpf>` |
| `X-DMS-Zeit` | Zeitpunkt des Sendens in Sekunden seit 1970 (Unix-Zeit) |
| `X-DMS-Ereignis` | Ereignis-Id (wie `id` im Rumpf) – gleich bei einer Wiederholung |
| `X-DMS-Art` | `zaehler.geaendert` oder `probe` |
| `X-DMS-Versuch` | 1 beim ersten Versuch, dann 2, 3 … |
| `X-DMS-Webhook` | Id des Webhooks |

Der Empfänger rechnet die Signatur mit dem Geheimnis nach und verwirft Meldungen, deren Zeit mehr als 5 Minuten abweicht. Beispiele in JavaScript und Python stehen im [Entwicklerhandbuch](https://help.ablago.app/entwickler/aktuell/aufbau/#webhooks). Geht ein Geheimnis verloren, erzeugt der Benutzer im Profil mit **Neues Geheimnis** ein neues; das alte gilt sofort nicht mehr.

## Sicherung und Export

Webhooks und ihre wartenden Meldungen gehen mit in die [Sicherung](sicherung.md) (das Geheimnis verschlüsselt). Nach einer [Wiederherstellung](wiederherstellen.md) meldet Ablago, sobald die Zahlen von denen der Sicherung abweichen; der `stand` kann dabei auf den der Sicherung zurückgehen. In den [Vollexport](export.md) kommen sie nicht – sie sind Zugangsdaten.
