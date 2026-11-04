# Automatisierungen

Mit einer **Automatisierung** erledigt Ablago etwas von selbst: **Wenn** etwas passiert (ein Ereignis oder ein Datum), **und** die Bedingungen stimmen, **dann** setzt es Felder oder gibt jemandem eine Aufgabe. Du findest sie unter **Werkbank → Ablage aufbauen → Automatisierungen**. Im Haushalt erscheint der Bereich im **Expertenmodus** (Werkbank → Werkbank anpassen), in Betrieben immer.

![Werkbank → Automatisierungen: Liste und Editor](bilder/werkbank-automatisierungen.png)

Links stehen alle Automatisierungen mit Name, Kurzform („Wenn Vertrag: Kündigung bis in 30 Tagen → Aufgabe an Verantwortlich“), an/aus, Nummer in der Reihenfolge und dem letzten Lauf. Rechts baust du sie aus Karten zusammen – drei Bereiche untereinander, verbunden mit Pfeilen:

| Bereich | Was hinein gehört |
|---|---|
| **Wenn** | genau eine Karte: ein Ereignis (Mappe angelegt, gespeichert, Notiz, Dokument hochgeladen, Favorit geändert, Kontosperre …), **Datum erreicht** oder **Zeitplan** |
| **Und** | keine, eine oder mehrere Bedingungen: Feldwerte wie bei den [Ansichten](sichten.md), „Mappe ist in Ansicht …“, „Mappe ist Favorit von …“, Gruppen mit „alle“ oder „eine genügt“; jede Bedingung lässt sich mit **nicht** umkehren |
| **Dann** | eine oder mehrere Karten, der Reihe nach: **Feld ändern**, **Aufgabe / Benachrichtigung**, **Tägliche Zusammenfassung senden**, **Favoriten-Änderungen melden**, **Anmeldeschutz melden**, **Danach keine weiteren Automatisierungen** |

## Beispiel: an die Kündigungsfrist erinnern

Petra soll 30 Tage vor Ablauf der Kündigungsfrist eines Vertrags eine Aufgabe bekommen – aber nur, wenn im Vertrag jemand als verantwortlich eingetragen ist.

1. **+ Neu**, Name „Kündigung prüfen“.
2. **Wenn:** **Datum erreicht**, Mappentyp *Vertrag*, Datumsfeld *Kündigung bis*, **Vorlauf** 30 *Tage*, Uhrzeit 07:00.
3. **Und:** **+ Karte → Feld-Bedingung**, Feld *Verantwortlich* „ist nicht leer“.
4. **Dann:** **+ Karte → Aufgabe / Benachrichtigung**, Als *Aufgabe*, Empfänger *Person im Feld „Verantwortlich“*, Text `Bitte {titel} prüfen – kündbar bis {kuendigung_bis}.`
5. **Gleich einschalten** ankreuzen und **Speichern**.

![Aufgeklappte Dann-Karte mit Empfänger und Platzhaltern](bilder/werkbank-automatisierung-karte.png)

Eine Karte klappst du mit einem Klick auf ihren Namen **auf** (Einstellungen) und wieder **zu** (Kurzzeile wie „Aufgabe → Person im Feld „Verantwortlich““). Unter dem Text stehen die **Platzhalter**, die zur Wenn-Karte passen: die Felder des Mappentyps sowie `{titel}`, `{mappentyp}`, `{heute}`, `{automatisierung}` und beim Datum `{datum}` und `{tage}`. Ein Klick setzt den Platzhalter ein.

## Datum erreicht

Die Karte **Datum erreicht** prüft einmal am Tag zur gewählten Uhrzeit, bei welchen Mappen ein Datumsfeld nach dem **Vorlauf** erreicht ist.

- **Vorlauf** in **Tagen, Wochen oder Monaten**. 3 Monate sind drei Kalendermonate, nicht 90 Tage: Für ein Ende am 31.05. greift die Karte am letzten Tag im Februar. 0 heißt „am Tag selbst“, eine negative Zahl „so lange danach“.
- **Wiederkehrend** (monatlich, vierteljährlich, halbjährlich, jährlich): Wer die Aufgabe erledigt, bekommt den Folgetermin vorgeschlagen.
- Eine **Aufgabe** daraus ist eine **Frist** zum Datum der Mappe. Sie erledigt sich selbst, wenn das Datum geändert oder geleert wird. Dieselbe Person bekommt je Mappe, Feld und Datum nur eine Frist.
- Liegt ein Datum beim **Speichern** einer Mappe schon im Vorlauf, läuft die Automatisierung sofort – ein spät eingetragenes Datum erinnert also trotzdem.
- Damit ein Datumsfeld unter *Zu erledigen* und im Kalender erscheint, braucht es am Mappentyp den Haken [Ist eine Frist](mappentypen.md#fristen-erinnerungen-an-datumsfeldern).
- War Ablago zur Uhrzeit aus, holt es verpasste Tage nach (bis zu 31 Tage zurück). Eine neu eingeschaltete Automatisierung beginnt heute.

Die früheren Karten „Datum in N Tagen“ und „Frist erreicht“ sind in **Datum erreicht** aufgegangen. Aus „Datum in N Tagen“ wird beim nächsten Öffnen dieselbe Karte mit Vorlauf in Tagen. Bei „Frist erreicht“ fehlt das Datumsfeld: Die Automatisierung steht rot da, bis du es wählst.

## Zeitplan

Die Karte **Zeitplan** löst an den gewählten **Wochentagen** zur gewählten **Uhrzeit** aus (deutsche Zeit), auf Wunsch **nicht an Feiertagen** – das Bundesland dafür stellst du bei der [Täglichen Zusammenfassung](aufgaben.md#tagliche-zusammenfassung) ein.

- **Für jeden Benutzer:** Die Automatisierung läuft je aktivem Benutzer genau einmal am Tag – auf Wunsch nur für die Mitglieder einer **Rolle**. Die Karten sehen dann die Benutzer-Mappe der Person, der Platzhalter `{benutzer}` steht für ihren Namen.
- **Uhrzeit aus dem Profil:** Mit diesem Haken gelten Uhrzeit, Wochentage und Feiertage, die jemand in seinem Profil für die Tägliche Zusammenfassung gewählt hat; wer nichts gewählt hat, bekommt die Uhrzeit der Karte und Montag bis Freitag.
- War Ablago zur Uhrzeit aus, läuft die Automatisierung noch am selben Tag nach – an Folgetagen nicht. Auch mit mehreren Servern läuft jeder Tag (je Person) genau einmal.

## Karten hinzufügen, umsortieren, entfernen

- **Mit der Maus oder am Handy:** **Kartenvorrat** aufklappen, nach einer Karte suchen und sie in ihren Bereich **ziehen** (am Handy lange drücken) – oder einfach anklicken.
- **Mit der Tastatur:** in jedem Bereich **+ Karte** – Auswahl öffnen, Karte wählen. Dann-Karten sortierst du über ihren Griff `⠿` mit **Alt+↑/↓** um, per Maus durch Ziehen.
- **Entfernen** steht an jeder Karte.

Der Vorrat zeigt nur, was zur Wenn-Karte passt: **Feld ändern** etwa nur, wenn die Wenn-Karte einen Mappentyp hat.

## Was die Dann-Karten tun

- **Feld ändern** setzt nur die gewählten Felder und lässt alle anderen unverändert. Text mit Platzhaltern; bei Datumsfeldern `heute`, `heute+7` oder `heute-3`. Ablago prüft den Wert wie im Formular (Pflichtfelder, Auswahllisten, Archivmodus). In der Historie der Mappe steht „durch Automatisierung ‚…‘“.
- **Aufgabe / Benachrichtigung** geht an Personen, an **alle aktiven Mitglieder einer Rolle**, an die **Person in einem Feld** der Mappe (optional „sonst wer die Mappe angelegt hat“), an **wer die Mappe angelegt hat** oder an eine **Person aus dem Ereignis** (z. B. den Vertreter bei *Abwesenheit gesetzt*). Eine *Aufgabe* kann ein Fälligkeitsdatum haben; *Benachrichtigungen* bündelt Ablago, damit niemand bei vielen Läufen hintereinander überschwemmt wird. Wer die Mappe nicht sehen darf, bekommt die Aufgabe an seiner eigenen Benutzer-Mappe – ohne Link auf die Mappe.
- Aufgaben aus Automatisierungen verhalten sich wie die eingebauten: Ist jemand **abwesend oder deaktiviert**, geht die Aufgabe an seine **Vertretung** (in der Historie steht „weitergegeben wegen Abwesenheit …“). Gibt es keine, bekommen sie die Administratoren – der Lauf bricht nicht ab.
- Eine Aufgabe **erledigt sich selbst**, wenn ihr Anlass wegfällt: bei **Datum erreicht**, wenn das Datum geändert oder geleert wird; bei **Neue Post**, wenn die Post zugeordnet oder erledigt ist; bei **Abwesenheit gesetzt**, wenn die Abwesenheit endet.
- **Tägliche Zusammenfassung senden** (nur mit *Zeitplan für jeden Benutzer*) schickt der Person ihre offenen Aufgaben per E-Mail – derselbe Inhalt wie bisher. Wer sie im Profil abbestellt hat, abwesend ist oder nichts offen hat, bekommt keine; der Verlauf nennt den Grund.
- **Favoriten-Änderungen melden** (nur mit *Favorit geändert*) gibt allen, die die Mappe als Favorit haben, die gebündelte Benachrichtigung „Geändert“ – wie bisher. Die [Freigabe für Favoriten](aufgaben.md#favoriten-benachrichtigen) und der Schalter im Profil gelten weiter; eigene Änderungen melden nie.
- **Anmeldeschutz melden** schickt den Administratoren entweder die **Sammelmeldung** über die Sperren (mit *Zeitplan*, nicht je Benutzer) oder sofort eine Mail, wenn ein **Benutzerkonto gesperrt** wurde (mit *Benutzerkonto gesperrt*, je Konto höchstens einmal am Tag). Siehe [Anmeldeschutz](anmeldeschutz.md#mail-an-die-administratoren).
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

## Aus Paketen

Pakete bringen **vorgefertigte Automatisierungen** mit, zum Beispiel „HU wird bald fällig“ (Paket Fahrzeuge) oder „Kündigung bald fällig“ (Paket Haushalt). Beim Installieren – im Einrichtungsassistenten wie in der Werkbank – listet Ablago sie mit Namen auf: **„Sollen sie gleich eingeschaltet werden?“**, alle vorausgewählt. Was angehakt bleibt, ist nach der Installation eingeschaltet, der Rest aus.

- In der Liste erkennst du sie an der Herkunft **aus Paket …**. Du kannst sie einschalten, anpassen und kopieren.
- Bei einem **Update** des Pakets ersetzt die neue Fassung die alte, solange du sie nicht geändert hast; an/aus bleibt. Eine geänderte bleibt, wie sie ist. Neue Automatisierungen aus dem Update stehen beim Aktualisieren wieder zur Wahl.
- Entfernst du das Paket, gehen seine Automatisierungen mit, wenn sie aus und unverändert sind.

### Vertretung

Wird für jemanden eine **Abwesenheit mit Vertreter** eingetragen, bekommt der Vertreter eine Aufgabe – das macht die Automatisierung **Vertretung eingetragen** (Wenn *Abwesenheit gesetzt*, Empfänger *Vertreter aus dem Ereignis*, Platzhalter `{benutzer}`, `{vertreter}`, `{von}`, `{bis}`, `{zeitraum}`). Sie erledigt sich, sobald die Abwesenheit endet oder sich Zeitraum oder Vertreter ändern. Für den bisherigen Vertreter gibt es die Wenn-Karte **Vertretung zurückgezogen** (Abwesenheit beendet, anderer oder kein Vertreter mehr). Beide bringt das Paket **Benachrichtigungen** mit; bei bestehenden Ablagen hat das Update *Vertretung eingetragen* eingeschaltet übernommen. Nennt das Ereignis keine Person (Abwesenheit ohne Vertreter), passiert nichts – das ist kein Fehler.

### Benachrichtigungen

Die **Tägliche Zusammenfassung**, das Melden geänderter **Favoriten** und die Mails des **Anmeldeschutzes** sind Automatisierungen. Das Paket **Benachrichtigungen** bringt sie mit; im Einrichtungsassistenten ist es vorausgewählt. Ohne eine Automatisierung mit *Tägliche Zusammenfassung senden* weist die Werkbank-Übersicht darauf hin: „Keine automatischen Benachrichtigungen“ mit **Paket installieren**.

Beim Update auf diese Fassung hat Ablago in bestehenden Ablagen **einmal** vier Automatisierungen mit den bisherigen Werten angelegt: *Tägliche Zusammenfassung* (Uhrzeit aus dem Profil, an oder aus wie bisher), *Favoriten-Änderungen melden*, *Sammelmeldung Anmeldeschutz* und *Kontosperre sofort melden* (an, wenn die Haken im Anmeldeschutz gesetzt waren). Für Benutzer ändert sich nichts. Installierst du das Paket, gehen sie in dessen Automatisierungen auf, solange du sie nicht geändert hast.

### Erinnerungen aus früheren Versionen

Bis Version 0.176 stellte man Vorlauf, Empfänger und Text einer Erinnerung direkt am Datumsfeld ein, und die Vertretungs-Aufgabe war fest eingebaut. Beim Update hat Ablago jede dieser Erinnerungen **einmal** als eingeschaltete Automatisierung *Erinnerung: Feld (Mappentyp)* übernommen – mit gleichem Verhalten. Die Werkbank-Übersicht weist einmal darauf hin (*Verstanden* blendet den Hinweis aus). Bringt ein Paket später eine eigene Automatisierung für dasselbe Feld mit, ersetzt sie die übernommene, solange du diese nicht geändert hast. So erinnert nie etwas doppelt.

## Beispiele

Ablago bringt einige **ausgeschaltete Beispiele** mit (Herkunft „von Ablago“): *An die Kündigungsfrist erinnern*, *Kontosperre melden* und *Neue Dokumente melden*. Beispiele lassen sich einschalten und anpassen, aber nicht löschen; mit **Kopieren** machst du eine eigene daraus (die Kopie ist zunächst aus).

![Editor in dunkler Darstellung](bilder/werkbank-automatisierung-dunkel.png)

Am Handy steht erst die Liste, nach dem Antippen der Editor; Karten fügst du dort am einfachsten mit **+ Karte** hinzu.

![Automatisierung am Handy](bilder/werkbank-automatisierung-handy.png){ width="320" }
