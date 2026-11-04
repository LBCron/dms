# Automatisierungen

Mit einer **Automatisierung** erledigt Ablago etwas von selbst: **Wenn** etwas passiert (ein Ereignis oder ein Datum), **und** die Bedingungen stimmen, **dann** setzt es Felder oder gibt jemandem eine Aufgabe. Du findest sie unter **Werkbank → Ablage aufbauen → Automatisierungen**. Im Haushalt erscheint der Bereich im **Expertenmodus** (Werkbank → Werkbank anpassen), in Betrieben immer.

![Werkbank → Automatisierungen: Liste und Editor](bilder/werkbank-automatisierungen.png)

Links stehen alle Automatisierungen mit Name, Kurzform („Wenn Datum in N Tagen erreicht (Vertrag) → Aufgabe an Verantwortlich“), an/aus, Nummer in der Reihenfolge und dem letzten Lauf. Rechts baust du sie aus Karten zusammen – drei Bereiche untereinander, verbunden mit Pfeilen:

| Bereich | Was hinein gehört |
|---|---|
| **Wenn** | genau eine Karte: ein Ereignis (Mappe angelegt, gespeichert, Notiz, Dokument hochgeladen, Frist erreicht, Kontosperre …) oder **Datum in N Tagen erreicht** |
| **Und** | keine, eine oder mehrere Bedingungen: Feldwerte wie bei den [Ansichten](sichten.md), „Mappe ist in Ansicht …“, „Mappe ist Favorit von …“, Gruppen mit „alle“ oder „eine genügt“; jede Bedingung lässt sich mit **nicht** umkehren |
| **Dann** | eine oder mehrere Karten, der Reihe nach: **Feld ändern**, **Aufgabe / Benachrichtigung**, **Danach keine weiteren Automatisierungen** |

## Beispiel: an die Kündigungsfrist erinnern

Petra soll 30 Tage vor Ablauf der Kündigungsfrist eines Vertrags eine Aufgabe bekommen – aber nur, wenn im Vertrag jemand als verantwortlich eingetragen ist.

1. **+ Neu**, Name „Kündigung prüfen“.
2. **Wenn:** Ereignis **Datum in N Tagen erreicht**, Mappentyp *Vertrag*, Datumsfeld *Kündigung bis*, **In Tagen** 30, Uhrzeit 07:00.
3. **Und:** **+ Karte → Feld-Bedingung**, Feld *Verantwortlich* „ist nicht leer“.
4. **Dann:** **+ Karte → Aufgabe / Benachrichtigung**, Als *Aufgabe*, Empfänger *Person im Feld „Verantwortlich“*, fällig in 7 Tagen, Text `Bitte {titel} prüfen – kündbar bis {kuendigung_bis}.`
5. **Gleich einschalten** ankreuzen und **Speichern**.

![Aufgeklappte Dann-Karte mit Empfänger und Platzhaltern](bilder/werkbank-automatisierung-karte.png)

Eine Karte klappst du mit einem Klick auf ihren Namen **auf** (Einstellungen) und wieder **zu** (Kurzzeile wie „Aufgabe → Person im Feld „Verantwortlich““). Unter dem Text stehen die **Platzhalter**, die zur Wenn-Karte passen: die Felder des Mappentyps sowie `{titel}`, `{mappentyp}`, `{heute}`, `{automatisierung}` und beim Datum `{datum}` und `{tage}`. Ein Klick setzt den Platzhalter ein.

## Karten hinzufügen, umsortieren, entfernen

- **Mit der Maus oder am Handy:** **Kartenvorrat** aufklappen, nach einer Karte suchen und sie in ihren Bereich **ziehen** (am Handy lange drücken) – oder einfach anklicken.
- **Mit der Tastatur:** in jedem Bereich **+ Karte** – Auswahl öffnen, Karte wählen. Dann-Karten sortierst du über ihren Griff `⠿` mit **Alt+↑/↓** um, per Maus durch Ziehen.
- **Entfernen** steht an jeder Karte.

Der Vorrat zeigt nur, was zur Wenn-Karte passt: **Feld ändern** etwa nur, wenn die Wenn-Karte einen Mappentyp hat.

## Was die Dann-Karten tun

- **Feld ändern** setzt nur die gewählten Felder und lässt alle anderen unverändert. Text mit Platzhaltern; bei Datumsfeldern `heute`, `heute+7` oder `heute-3`. Ablago prüft den Wert wie im Formular (Pflichtfelder, Auswahllisten, Archivmodus). In der Historie der Mappe steht „durch Automatisierung ‚…‘“.
- **Aufgabe / Benachrichtigung** geht an Personen, an **alle aktiven Mitglieder einer Rolle** oder an die **Person in einem Feld** der Mappe. Eine *Aufgabe* kann ein Fälligkeitsdatum haben; *Benachrichtigungen* bündelt Ablago, damit niemand bei vielen Läufen hintereinander überschwemmt wird. Wer die Mappe nicht sehen darf, bekommt die Aufgabe an seiner eigenen Benutzer-Mappe – ohne Link auf die Mappe.
- **Danach keine weiteren Automatisierungen** beendet die Reihe: Automatisierungen mit höherer Nummer laufen für dieses Ereignis nicht mehr (im Verlauf „Übersprungen durch …“).

Automatisierungen arbeiten mit dem **Systemkonto „Automatisierung“** (Werkbank → Benutzer). Was dieses Konto nicht lesen darf, überspringt die Automatisierung; Platzhalter zeigen dann „(nicht sichtbar)“.

## Reihenfolge

Gibt es mehrere Automatisierungen für denselben Auslöser, laufen sie nach ihrer **Reihenfolge** (1–99, kleinere zuerst; eigene beginnen bei 50). Im Editor steht dann „läuft als 2. von 3 beim selben Auslöser“. In der Liste zeigt **Nach Auslöser** alle Automatisierungen eines Ereignisses zusammen; dort sortierst du sie per Ziehen oder mit **Alt+↑/↓** am Griff um, die Nummern passen sich an.

## Ausprobieren, Verlauf und Änderungsverlauf

![Verlauf mit den Schritten eines Laufs](bilder/werkbank-automatisierung-verlauf.png)

- **Ausprobieren:** Mappe wählen und **Ausführen** – als wäre das Ereignis eingetreten. Mit **Trockenlauf** zeigt Ablago nur, was passieren würde („Würde Aufgabe an 1 Person senden: …“), und ändert nichts.
- **Verlauf:** jeder Lauf mit Zeit und Ergebnis (*abgeschlossen*, *trifft nicht zu*, *übersprungen*, *fehlgeschlagen*); aufgeklappt siehst du je Schritt, welche Bedingung zutraf und welche Karte was getan hat. Läuft die Automatisierung gerade, während der Editor offen ist, erscheinen die Schritte **live** nacheinander.
- **Fehlgeschlagene Läufe** bleiben stehen und lassen sich **wiederholen** – einzeln im Verlauf oder alle über den Hinweis oben in der Liste. Die [Übersicht der Werkbank](uebersicht.md) meldet sie ebenfalls.
- **Änderungsverlauf:** jede gespeicherte Fassung mit Zeit und wer; **Wiederherstellen** holt einen früheren Stand zurück (der jetzige bleibt als eigene Fassung erhalten).

## Wenn etwas nicht mehr passt

Ablago blockiert deine Arbeit nicht: Mappentypen, Felder und Ansichten lassen sich weiterhin ändern und löschen. Fehlt einer Automatisierung danach etwas (Feld gelöscht, Ansicht weg), wird sie **rot markiert und angehalten** – mit Grund in der Liste und einem Hinweis in der Übersicht. Korrigieren, speichern, wieder einschalten.

Außerdem hält Ablago eine Automatisierung an, wenn sie **mehr als 30-mal in einer Minute** läuft, und nach einer [Wiederherstellung](wiederherstellen.md) alle eingeschalteten – damit eingespielte Daten nicht sofort eine Welle von Aufgaben auslösen. Automatisierungen, die einander auslösen, laufen höchstens drei Ebenen tief.

## Beispiele

Ablago bringt einige **ausgeschaltete Beispiele** mit (Herkunft „von Ablago“): *An die Kündigungsfrist erinnern*, *Kontosperre melden* und *Neue Dokumente melden*. Beispiele lassen sich einschalten und anpassen, aber nicht löschen; mit **Kopieren** machst du eine eigene daraus (die Kopie ist zunächst aus).

![Editor in dunkler Darstellung](bilder/werkbank-automatisierung-dunkel.png)

Am Handy steht erst die Liste, nach dem Antippen der Editor; Karten fügst du dort am einfachsten mit **+ Karte** hinzu.

![Automatisierung am Handy](bilder/werkbank-automatisierung-handy.png){ width="320" }
