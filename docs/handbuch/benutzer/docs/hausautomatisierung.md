# DMS in die Hausautomatisierung einbinden

Eine Lampe im Flur, die leuchtet, wenn neue Post da ist. Eine Mitteilung aufs Handy, wenn eine Frist ansteht. Die Zahl der offenen Aufgaben auf dem Wand-Tablet. Dafür bindest du das DMS in deine **Hausautomatisierung** ein – ohne dass jemand das DMS öffnen muss.

Die Hausautomatisierung bekommt dabei **nur Zahlen**: wie viel neue Post, wie viel unter *Zu erledigen*, wie viele Fristen in den nächsten 7 Tagen und wie viele überfällig sind. Titel, Absender, Namen oder Dokumente sieht sie nie.

## Was es gibt

| System | Stand |
| --- | --- |
| **Homey Pro** | App **DMS** – Werte am Gerät und Flow-Karten wie „Neue Post angekommen“ und „Frist wird fällig“. Anleitung im [README der Homey-App](https://github.com/motom001/dms-clients/blob/main/homey/README.md). |
| **Home Assistant** | später ([motom001/dms-clients#3](https://github.com/motom001/dms-clients/issues/3)) |
| Andere (Node-RED, ioBroker, eigene Skripte) | über die [Zähler-Schnittstelle](https://motom001.github.io/dms/admin/aktuell/api/#zaehler) mit demselben Schlüssel |

Die Apps und Anbindungen liegen im Repository [motom001/dms-clients](https://github.com/motom001/dms-clients). Du brauchst keine davon – das DMS ist vollständig im Browser bedienbar.

!!! note "Nur im Heimnetz"
    Die Hausautomatisierung fragt dein DMS direkt im Heimnetz ab. Deshalb geht es mit **Homey Pro**, nicht mit Homey Cloud: Ein Dienst im Internet erreicht ein DMS in deinem Heimnetz nicht.

## Schlüssel „nur Zähler“ anlegen

Die Hausautomatisierung meldet sich mit einem **API-Schlüssel** an. Nimm dafür die Stufe **nur Zähler**:

1. Melde dich als die Person an, deren Zahlen angezeigt werden sollen – die Zahlen gelten immer für den Benutzer des Schlüssels und in seinen Rechten.
2. Öffne **Profil → Sicherheit → API-Schlüssel** und erzeuge einen neuen Schlüssel, z. B. „Homey“.
3. Wähle unter **Rechte** die Stufe **nur Zähler**.
4. Kopiere den Schlüssel gleich (er beginnt mit `dms_`) – er ist nur jetzt ganz zu sehen – und trag ihn zusammen mit der Adresse deines DMS (z. B. `https://dms.home.arpa`) in der Hausautomatisierung ein.

Warum *nur Zähler*: Dieser Schlüssel ruft **nur die Zahlen** ab; alles andere lehnt das DMS ab, auch das [Laufwerk](laufwerk.md). Geht er verloren – etwa mit einer Sicherung der Hausautomatisierung –, erfährt jemand höchstens, wie viel Post und Aufgaben du hast. Die Homey-App funktioniert auch mit *nur lesen*, empfiehlt aber *nur Zähler*; einen Schlüssel *lesen und schreiben* lehnt sie ab.

!!! tip "Für mehrere Personen"
    Soll die Familie die Zahlen von Lena und Jonas getrennt sehen, legt jede Person ihren eigenen Schlüssel *nur Zähler* an. In der Homey-App wird daraus je Person ein eigenes Gerät „DMS“.

Brauchst du den Schlüssel nicht mehr, löschst du ihn unter **Profil → Sicherheit → API-Schlüssel**; die Hausautomatisierung meldet dann „Schlüssel ungültig“.

## Wie schnell die Hausautomatisierung Neues bemerkt

Die Homey-App fragt das DMS in einem festen Abstand ab, Vorgabe alle **5 Minuten**. Hat sich nichts geändert, antwortet das DMS nur mit „nichts Neues“ – das kostet praktisch nichts. Neue Post bemerkt die Hausautomatisierung also spätestens nach einem Abfrage-Abstand.

**Später** soll das DMS Neues auch sofort melden können (Webhook, [motom001/dms#627](https://github.com/motom001/dms/issues/627)); dann löst die Hausautomatisierung ohne Warten aus.

Technische Einzelheiten zur Schnittstelle stehen im [Administratorhandbuch](https://motom001.github.io/dms/admin/aktuell/api/#zaehler).
