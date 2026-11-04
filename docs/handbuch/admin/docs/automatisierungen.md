# Automatisierungen

Mit einer **Automatisierung** erledigt Ablago etwas von selbst: **Wenn** etwas passiert (ein Ereignis oder ein Datum), **und** die Bedingungen stimmen, **dann** setzt es Felder oder gibt jemandem eine Aufgabe. Du findest sie unter **Werkbank → Ablage aufbauen → Automatisierungen**. Im Haushalt erscheint der Bereich im **Expertenmodus** (Werkbank → Werkbank anpassen), in Betrieben immer.

![Werkbank → Automatisierungen: Liste und Editor](bilder/werkbank-automatisierungen.png)

Links stehen alle Automatisierungen mit Name, Kurzform („Wenn Vertrag: Kündigung bis in 30 Tagen → Aufgabe an Verantwortlich“), an/aus, Nummer in der Reihenfolge und dem letzten Lauf. Rechts baust du sie aus Karten zusammen – drei Bereiche untereinander, verbunden mit Pfeilen:

| Bereich | Was hinein gehört |
|---|---|
| **Wenn** | genau eine Karte: ein Ereignis (Mappe angelegt, gespeichert, Notiz, Dokument hochgeladen, Kontosperre …) oder **Datum erreicht** |
| **Und** | keine, eine oder mehrere Bedingungen: Feldwerte wie bei den [Ansichten](sichten.md), „Mappe ist in Ansicht …“, „Mappe ist Favorit von …“, Gruppen mit „alle“ oder „eine genügt“; jede Bedingung lässt sich mit **nicht** umkehren |
| **Dann** | eine oder mehrere Karten, der Reihe nach: **Feld ändern**, **Aufgabe / Benachrichtigung**, **Danach keine weiteren Automatisierungen** |

## Beispiel: an die Kündigungsfrist erinnern

Petra soll 30 Tage vor Ablauf der Kündigungsfrist eines Vertrags eine Aufgabe bekommen – aber nur, wenn im Vertrag jemand als verantwortlich eingetragen ist.

1. **+ Neu**, Name „Kündigung prüfen“.
2. **Wenn:** **Datum erreicht**, Mappentyp *Vertrag*, Datumsfeld *Kündigung bis*, **Vorlauf** 30 *Tage*, Uhrzeit 07:00.
3. **Und:** **+ Karte → Feld-Bedingung**, Feld *Verantwortlich* „ist nicht leer“.
4. **Dann:** **+ Karte → Aufgabe / Benachrichtigung**, Als *Aufgabe*, Empfänger *Person im Feld „Verantwortlich“*, Text `Bitte {titel} prüfen – kündbar bis {kuendigung_bis}.`
5. **Speichern**. Der Schalter oben neben dem Namen steht bei einer neuen Automatisierung auf **an** – mit dem Speichern ist sie eingeschaltet. Soll sie noch nicht arbeiten, stell ihn vorher auf **aus**.

![Aufgeklappte Dann-Karte mit Empfänger und Platzhaltern](bilder/werkbank-automatisierung-karte.png)

Eine Karte klappst du mit einem Klick auf ihren Namen **auf** (Einstellungen) und wieder **zu** (Kurzzeile wie „Aufgabe → Person im Feld „Verantwortlich““). Unter dem Text stehen die **Platzhalter**, die zur Wenn-Karte passen: die Felder des Mappentyps sowie `{titel}`, `{mappentyp}`, `{heute}`, `{automatisierung}` und beim Datum `{datum}` und `{tage}`. Ein Klick setzt den Platzhalter ein.

## Datum erreicht

Die Karte **Datum erreicht** prüft einmal am Tag zur gewählten Uhrzeit, bei welchen Mappen ein Datumsfeld nach dem **Vorlauf** erreicht ist.

- **Vorlauf** in **Tagen, Wochen oder Monaten**. 3 Monate sind drei Kalendermonate, nicht 90 Tage: Für ein Ende am 31.05. greift die Karte am letzten Tag im Februar. 0 heißt „am Tag selbst“, eine negative Zahl „so lange danach“.
- **Wiederkehrend** (monatlich, vierteljährlich, halbjährlich, jährlich): Wer die Aufgabe erledigt, bekommt den Folgetermin vorgeschlagen, wie bei der Erinnerung am Datumsfeld.
- Eine **Aufgabe** daraus ist eine **Frist** zum Datum der Mappe. Sie erledigt sich selbst, wenn das Datum geändert oder geleert wird. Dieselbe Person bekommt je Mappe, Feld und Datum nur eine Frist, auch neben einer Erinnerung am Datumsfeld.
- War Ablago zur Uhrzeit aus, holt es verpasste Tage nach (bis zu 31 Tage zurück). Eine neu eingeschaltete Automatisierung beginnt heute.

Die früheren Karten „Datum in N Tagen“ und „Frist erreicht“ sind in **Datum erreicht** aufgegangen. Aus „Datum in N Tagen“ wird beim nächsten Öffnen dieselbe Karte mit Vorlauf in Tagen. Bei „Frist erreicht“ fehlt das Datumsfeld: Die Automatisierung steht rot da, bis du es wählst.

## An, aus und angehalten

Ob eine Automatisierung arbeitet, siehst und änderst du an **einer** Stelle: am Schalter oben neben dem Namen, in der Liste steht derselbe Zustand (**an**, **aus**, **angehalten**).

- Bei einer gespeicherten Automatisierung wirkt der Schalter sofort; an seiner Stelle steht kurz „Eingeschaltet.“ bzw. „Ausgeschaltet.“.
- Ist sie **angehalten** (rot, siehe unten), steht dort der Grund und der Knopf **Wieder einschalten**.
- Daneben steht der Knopf **Kopieren**: Er legt eine eigene Kopie an und öffnet sie.

## Karten hinzufügen, umsortieren, entfernen

- **Mit der Maus oder am Handy:** **Kartenvorrat** aufklappen, nach einer Karte suchen und sie in ihren Bereich **ziehen** (am Handy lange drücken) – oder einfach anklicken.
- **Mit der Tastatur:** in jedem Bereich **+ Karte** – Auswahl öffnen, Karte wählen. Dann-Karten sortierst du über ihren Griff `⠿` mit **Alt+↑/↓** um, per Maus durch Ziehen.
- **Entfernen** steht an jeder Karte.

Der Vorrat zeigt nur, was zur Wenn-Karte passt: **Feld ändern** etwa nur, wenn die Wenn-Karte einen Mappentyp hat.

## Was die Dann-Karten tun

- **Feld ändern** setzt nur die gewählten Felder und lässt alle anderen unverändert. Text mit Platzhaltern; bei Datumsfeldern `heute`, `heute+7` oder `heute-3`. Ablago prüft den Wert wie im Formular (Pflichtfelder, Auswahllisten, Archivmodus). In der Historie der Mappe steht „durch Automatisierung ‚…‘“.
- **Aufgabe / Benachrichtigung** geht an Personen, an **alle aktiven Mitglieder einer Rolle**, an die **Person in einem Feld** der Mappe oder an **wer die Mappe angelegt hat**. Eine *Aufgabe* kann ein Fälligkeitsdatum haben; *Benachrichtigungen* bündelt Ablago, damit niemand bei vielen Läufen hintereinander überschwemmt wird. Wer die Mappe nicht sehen darf, bekommt die Aufgabe an seiner eigenen Benutzer-Mappe – ohne Link auf die Mappe.
- Aufgaben aus Automatisierungen verhalten sich wie die eingebauten: Ist jemand **abwesend oder deaktiviert**, geht die Aufgabe an seine **Vertretung** (in der Historie steht „weitergegeben wegen Abwesenheit …“). Gibt es keine, bekommen sie die Administratoren – der Lauf bricht nicht ab.
- Eine Aufgabe **erledigt sich selbst**, wenn ihr Anlass wegfällt: bei **Datum erreicht**, wenn das Datum geändert oder geleert wird; bei **Neue Post**, wenn die Post zugeordnet oder erledigt ist; bei **Abwesenheit gesetzt**, wenn die Abwesenheit endet.
- **Danach keine weiteren Automatisierungen** beendet die Reihe: Automatisierungen mit höherer Nummer laufen für dieses Ereignis nicht mehr (im Verlauf „Übersprungen durch …“).

Automatisierungen arbeiten mit dem **Systemkonto „Automatisierung“** (Werkbank → Benutzer). Was dieses Konto nicht lesen darf, überspringt die Automatisierung; Platzhalter zeigen dann „(nicht sichtbar)“.

Darf das Konto „Automatisierung“ Mappen vom Typ der Wenn-Karte **gar nicht** sehen – zum Beispiel, weil am Mappentyp eine Regel „System- und Paketrollen verboten“ gilt –, kann die Automatisierung nie laufen. Dann steht im Editor und in der Liste ein Hinweis „Diese Automatisierung kann nicht laufen …“. Über **Rechte am Mappentyp ansehen** kommst du zum [Testlauf](berechtigungen.md#testlauf) dieses Mappentyps, mit dem Konto „Automatisierung“ schon gewählt; dort siehst du, welche Regel entschieden hat. Speichern bleibt trotzdem möglich.

## Reihenfolge

Gibt es mehrere Automatisierungen für denselben Auslöser, laufen sie nach ihrer **Reihenfolge** (1–99, kleinere zuerst; eigene beginnen bei 50). Im Editor steht dann „läuft als 2. von 3 beim selben Auslöser“. In der Liste zeigt **Nach Auslöser** alle Automatisierungen eines Ereignisses zusammen; dort sortierst du sie per Ziehen oder mit **Alt+↑/↓** am Griff um, die Nummern passen sich an.

## Ausprobieren, Verlauf und Änderungsverlauf

![Verlauf mit den Schritten eines Laufs](bilder/werkbank-automatisierung-verlauf.png)

- **Ausprobieren:** Mappe wählen und **Ausführen** – als wäre das Ereignis eingetreten. Die Mappe wählst du wie in einem Verweisfeld: Tippe einen Teil des Titels und klicke auf einen Treffer. Angeboten werden nur Mappen vom Mappentyp der Wenn-Karte, die das Konto „Automatisierung“ sehen darf – mit allen anderen könnte die Automatisierung ohnehin nicht laufen. Mit **Probelauf** zeigt Ablago nur, was passieren würde („Würde Aufgabe an 1 Person senden: …“), und ändert nichts.
- **Verlauf:** sieht aus wie die Historie einer Mappe: je Lauf eine Zeile mit Datum und Uhrzeit, dem Auslöser (z. B. „Mappe angelegt“, „Probelauf“, „Wiederholung“), einer Zusammenfassung, dem Ergebnis (*abgeschlossen*, *trifft nicht zu*, *übersprungen*, *fehlgeschlagen*) und der Zahl der Karten. Aufgeklappt zeigt eine Tabelle **Karte · Ergebnis · Einzelheiten**, was jede Karte getan hat; ist etwas schiefgegangen, steht der Grund bei der Karte, die gescheitert ist. Mit **Alle aufklappen** / **Alle zuklappen** siehst du alles auf einmal. Läuft die Automatisierung gerade, während der Editor offen ist, ist dieser Lauf aufgeklappt und die Karten werden **live** abgehakt; Karten, die noch nicht dran waren, stehen auf „wartet“.
- **Fehlgeschlagene Läufe** bleiben stehen. Über der Liste der Automatisierungen steht dann zum Beispiel „1 Lauf ist fehlgeschlagen: Neue Benutzer melden, 04.11.26, 04:48“; bei mehreren Läufen zeigt **Anzeigen** nur die betroffenen Automatisierungen. **Alle wiederholen** führt sie noch einmal aus, **Nicht wiederholen** nimmt sie aus dem Hinweis – im Verlauf bleiben sie als „fehlgeschlagen – nicht wiederholt (wer, wann)“ stehen, gelöscht wird nichts. Dieselbe Wahl hast du je Lauf im aufgeklappten Verlauf. **Probeläufe** zählen nicht mit; ihr Ergebnis steht nur im Verlauf. Die [Übersicht der Werkbank](uebersicht.md) meldet fehlgeschlagene Läufe ebenfalls.
- **Änderungsverlauf:** jede gespeicherte **Version** mit Zeit, wer und was sich geändert hat („geändert: Name, Dann: Aufgabe / Benachrichtigung“); die aktuelle ist mit „aktuell“ gekennzeichnet. Aufgeklappt zeigt eine Tabelle **Was · vorher · nachher** die Unterschiede zur Version davor. **Wiederherstellen** holt einen früheren Stand zurück – nach einer Rückfrage wird daraus eine neue Version, der jetzige Stand bleibt erhalten.

## Wenn etwas nicht mehr passt

Ablago blockiert deine Arbeit nicht: Mappentypen, Felder und Ansichten lassen sich weiterhin ändern und löschen. Fehlt einer Automatisierung danach etwas (Feld gelöscht, Ansicht weg), wird sie **rot markiert und angehalten** – mit Grund in der Liste und einem Hinweis in der Übersicht. Korrigieren, speichern, wieder einschalten.

Außerdem hält Ablago eine Automatisierung an, wenn sie **mehr als 30-mal in einer Minute** läuft, und nach einer [Wiederherstellung](wiederherstellen.md) alle eingeschalteten – damit eingespielte Daten nicht sofort eine Welle von Aufgaben auslösen. Automatisierungen, die einander auslösen, laufen höchstens drei Ebenen tief.

## Beispiele

Ablago bringt einige **ausgeschaltete Beispiele** mit (Herkunft „von Ablago“): *An die Kündigungsfrist erinnern*, *Kontosperre melden* und *Neue Dokumente melden*. Beispiele lassen sich einschalten und anpassen, aber nicht löschen; mit **Kopieren** machst du eine eigene daraus (die Kopie ist zunächst aus).

![Editor in dunkler Darstellung](bilder/werkbank-automatisierung-dunkel.png)

Am Handy steht erst die Liste, nach dem Antippen der Editor; Karten fügst du dort am einfachsten mit **+ Karte** hinzu.

![Automatisierung am Handy](bilder/werkbank-automatisierung-handy.png){ width="320" }
