# Mein Konto und Einstellungen

## Das Menü unter deinem Namen

Ein Klick auf deinen Namen oben rechts öffnet ein Menü:

![Benutzermenü](bilder/benutzermenue.png)

- Oben stehen dein Name, deine E-Mail-Adresse und deine Rolle.
- **Mein Konto** – dein [Profil](#profil) mit allen Bereichen: Konto, Sicherheit, Darstellung (Design, Schriftgröße, Startseite, geänderte Mappen hervorheben, Spaltenbreiten), Benachrichtigungen, [Abwesenheit](#abwesenheit).
- Solange eine Abwesenheit wirkt, steht oben im Menü „Du bist abwesend“ – ein Klick darauf führt direkt dorthin –, und neben deinem Namen ist ein Punkt.
- **Hilfe** – öffnet dieses Handbuch.
- **Fehler melden** – siehe [Fehler melden](#fehler-melden).
- **Über Ablago** – siehe [Über Ablago](#uber-das-dms).
- **Abmelden**.

Jeder Eintrag hat vorn ein kleines Piktogramm, damit du ihn schneller findest.

### Über Ablago { #uber-das-dms }

Das Fenster **Über Ablago** zeigt, was Ablago ist, welche **Version** gerade läuft und unter welcher **Lizenz** es steht: der Apache License 2.0 – Ablago ist freie Software, du darfst es kostenlos nutzen, verändern und weitergeben. Der Link **Quellcode** führt zum Quellcode genau dieser Version auf GitHub. Dazu gibt es Links zu diesem Handbuch, zu „Neu in dieser Version“ und den Release-Notizen und – freiwillig – zur Seite „Wer nutzt Ablago?“, auf der du erzählen kannst, wie du Ablago einsetzt.

Schließen kannst du das Fenster mit **Schließen**, mit der Esc-Taste oder mit einem Klick daneben.

![Über Ablago](bilder/ueber-dms.png){ loading=lazy }

## Mein Konto { #profil }

Mein Konto hat links fünf Bereiche (am Smartphone oben als Knöpfe):

![Mein Konto](bilder/profil.png){ loading=lazy }

### Konto

- **Name** – so erscheinst du bei „angelegt von“ und „zuletzt geändert von“ – und als Titel deiner Benutzer-Mappe.
- **E-Mail-Adresse** – damit meldest du dich an. Zum Ändern brauchst du dein aktuelles Passwort. Verschickt Ablago E-Mails, bekommt die bisherige Adresse einen Hinweis – falls jemand anderes die Adresse geändert hat, merkst du es so.

#### Meine Daten { #meine-daten }

Dein Ablago läuft bei dir zu Hause oder in deinem Betrieb, nicht bei einem Cloud-Anbieter, und es sendet keine Nutzungsdaten – auch keine anonymen. Was es über dich speichert, sind dein Konto, die Mappen und Dokumente, die du und andere anlegen, und wer wann was geändert hat.

- **Eine Kopie deiner Daten** holst du dir selbst: unter [Meine Daten exportieren](#meine-daten-exportieren).
- **Soll etwas gelöscht werden** – oder willst du wissen, was sonst noch über dich gespeichert ist –, frag den Administrator deines Ablago. Er kann Mappen löschen, die du selbst nicht löschen darfst. Manches muss eine Zeit lang aufbewahrt werden (z. B. Rechnungen); dann bleibt es gesperrt, bis die Frist abgelaufen ist. Dein Konto wird nicht gelöscht, sondern deaktiviert, sobald du es einmal benutzt hast – dein Name bleibt bei dem stehen, was du angelegt hast.

#### Meine Daten exportieren

Unter **Konto → Meine Daten exportieren** bekommst du eine Kopie von allem, was du sehen darfst – in offenen Formaten (CSV, JSON, Excel, PDF, die Dokumente im Original) und lesbar ohne Ablago:

- alle Mappen, die du lesen darfst, mit ihren Dokumenten und älteren Versionen,
- deine eigenen Aufgaben, Erinnerungen, Favoriten und was du in den Papierkorb gelegt hast,
- dein eigenes Benutzerkonto (ohne Passwort).

Was dem ganzen Haushalt gehört – Löschprotokoll, gleichbedeutende Wörter der Suche, Automatisierungen –, steht nur im Vollexport des Administrators. Verweist eine Mappe auf eine, die du nicht lesen darfst, steht dort statt des Titels „nicht sichtbare Mappe“.

**Der Export ist unverschlüsselt** – bewahre die Datei sicher auf. Passwortfelder stehen nur dabei, wenn du sie sehen darfst und das ausdrücklich bestätigst; sie liegen dann im Klartext in der Datei `passwoerter.csv`. Der Export läuft im Hintergrund; ist er fertig, lädst du ihn als ZIP herunter. Es gibt immer nur deinen letzten Export – ein neuer ersetzt den alten. **Nach dem Herunterladen wird er gelöscht**, spätestens nach 7 Tagen; bis wann er bereitliegt, steht neben dem Knopf. Brauchst du ihn länger, bewahre die ZIP-Datei auf. Solange ein Administrator [in deinem Namen arbeitet](#hinweis-ein-administrator-hat-in-deinem-namen-gearbeitet), lässt sich kein Export starten. Hat ein Administrator den Export abgeschaltet, steht das an dieser Stelle.

### Meine Rechte

Unten im Bereich *Konto*, unter Name und E-Mail-Adresse, steht, was du je Mappentyp darfst: **anlegen, lesen, bearbeiten, löschen** und **Passwörter sehen** – jeweils mit „ja“, „nein“ oder „je nach Mappe“. „Je nach Mappe“ heißt: Es hängt von der einzelnen Mappe ab, zum Beispiel davon, ob du dort verantwortlich bist oder eine Aufgabe dazu hast. Festgelegt werden die Rechte von einem Administrator; mehr unter [Was du sehen und ändern darfst](mappen.md#was-du-sehen-und-andern-darfst).

![Meine Rechte](bilder/meine-rechte.png){ loading=lazy }

### Sicherheit

- **Passwort** – gib dein aktuelles und zweimal das neue Passwort ein (mindestens 10 Zeichen). Nach dem Ändern sind alle anderen Anmeldungen beendet.
- **Zwei-Faktor-Anmeldung** – siehe [unten](#zwei-faktor-anmeldung).
- **Meine angemeldeten Geräte** – überall, wo du gerade angemeldet bist, mit Browser, Gerät und letzter Aktivität; *dieses Gerät* ist markiert. **Abmelden** beendet eine einzelne Anmeldung, **Alle anderen abmelden** alle außer dieser – etwa wenn du ein Handy verloren hast. Ändere dann am besten auch dein Passwort.
- **API-Schlüssel** – damit können andere Programme in deinem Namen auf Ablago zugreifen, etwa ein Scanner. Brauchst du das nicht, kannst du diesen Abschnitt übergehen. Passwortfelder liefert ein Schlüssel nur, wenn du beim Erzeugen **Passwörter lesen** ankreuzt. Unter **Rechte** wählst du eine von drei Stufen:
    - **nur lesen** – das Programm liest alles, was du lesen darfst, und ändert nichts.
    - **lesen und schreiben** – das Programm liest und ändert alles, was du darfst, z. B. ein Scanner, der Post ablegt.
    - **nur Zähler** – für Hausautomatisierung und Anzeigen, z. B. eine Lampe bei neuer Post oder die Zahl auf dem Wand-Tablet. Der Schlüssel ruft nur deine Zahlen ab: neue Post, Zu erledigen und überfällige Fristen. Geht er verloren, erfährt jemand höchstens, wie viel Post und Aufgaben du hast – keine Titel, Absender oder Inhalte. Alles andere lehnt das Ablago ab.

    Wie du damit zum Beispiel einen Homey Pro einbindest, steht unter [Ablago in die Hausautomatisierung einbinden](hausautomatisierung.md); die Technik beschreibt das [Administratorhandbuch](https://help.ablago.app/admin/aktuell/api/#zaehler).
- <span id="papierkorb"></span>**Papierkorb** – **Beim Abmelden leeren** löscht deine gelöschten Mappen endgültig, sobald du dich abmeldest. Ohne den Haken bleiben sie so lange im [Papierkorb](ablage.md#papierkorb), wie der Administrator es eingestellt hat.

!!! note "Anmelden mit dem Firmenkonto"
    Steht auf der Anmeldeseite ein Knopf wie **Mit Firmenkonto anmelden**, meldest du dich darüber mit dem Konto deiner Firma oder deines Anmeldedienstes an. Dein Passwort für Ablago brauchst du dann nicht; Passwort und Abmelden verwaltet der Anbieter. Er sieht dabei, wann du dich anmeldest – deine Unterlagen sieht er nicht.

#### Zwei-Faktor-Anmeldung

Mit der Zwei-Faktor-Anmeldung fragt Ablago nach dem Passwort zusätzlich einen sechsstelligen Code ab, den eine App auf deinem Handy alle 30 Sekunden neu erzeugt. Wer nur dein Passwort kennt, kommt dann nicht hinein.

1. Unter **Mein Konto → Sicherheit** (oben rechts auf deinen Namen klicken) auf **Einrichten** klicken.
2. In einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, Aegis, 2FAS, Bitwarden oder den Passwörtern auf dem iPhone) den QR-Code scannen. Geht das nicht, tippst du den Schlüssel darunter ab.
3. Den Code aus der App eingeben und **Bestätigen**.
4. Du bekommst **zehn Wiederherstellungscodes**. Speichere oder drucke sie und bewahre sie getrennt vom Handy auf – sie werden nur dieses eine Mal angezeigt.

Ab jetzt meldest du dich mit Passwort **und** Code an. Ist das Handy nicht zur Hand, klickst du bei der Anmeldung auf **Wiederherstellungscode verwenden**; jeder Code gilt nur einmal. Gehen sie zur Neige, erzeugst du mit **Neue Wiederherstellungscodes** frische (die alten gelten dann nicht mehr). **Abschalten** schaltet die Zwei-Faktor-Anmeldung wieder aus; beides bestätigst du mit deinem Passwort.

Auch ein Link zum Zurücksetzen des Passworts fragt danach den Code ab. Handy verloren und keine Codes mehr? Dann setzt ein Administrator die Zwei-Faktor-Anmeldung bei deinem Benutzer zurück.

!!! note "Vorgeschrieben"
    Kann ein Administrator für deine Systemrolle (Administrator oder Mitglied) vorschreiben. Dann richtest du sie nach der Anmeldung ein, bevor es weitergeht, und kannst sie nicht selbst abschalten.

### Darstellung

- **Design** – wie Ablago für dich aussieht. **Standard** folgt dem Design, das der Administrator festgelegt hat. Gilt für dein Konto auf allen Geräten.
- **Schriftgröße auf diesem Gerät** – klein, normal oder groß. Gilt nur für das Gerät, an dem du gerade sitzt; am Smartphone kannst du eine andere Größe wählen als am PC.
- <span id="startseite"></span>**Startseite** – **Mit der Startseite beginnen** schaltet die [Startseite](startseite.md) ein oder aus; ohne sie geht es nach der Anmeldung direkt zu *Zu erledigen*. **Vierte Kachel** wählt, was neben Zu erledigen, Neue Post und Nächster Termin steht: deine Favoriten oder eine Ansicht.
- <span id="geaenderte"></span>**Geänderte Mappen** – **Geänderte Favoriten und eigene Mappen in Listen hervorheben** (Standard: an) setzt einen Punkt vor den Titel, bis du die Mappe öffnest. Was dahintersteckt, steht unter [Favoriten als Abo](ablage.md#favoriten-als-abo).
- **Darstellung auf diesem Gerät** – die Breite der Spalten und eingeklappte Bereiche merkt sich jedes Gerät. Ist etwas nicht mehr zu finden, stellt **Standard-Darstellung wiederherstellen** die ursprüngliche Aufteilung her.
- **Entwicklermodus** – zeigt unten rechts, wie lange ein Seitenaufruf gedauert hat.

![Mein Konto → Darstellung](bilder/profil-darstellung.png){ loading=lazy }

### Benachrichtigungen { #benachrichtigungen }

<span id="benachrichtigungen-und-ablage"></span>

- **Aufgaben** – Mappen mit offenen [Aufgaben](eingang.md) für dich stehen unter „Zu erledigen“. Zusätzlich schickt Ablago dir die **Tägliche Zusammenfassung** per E-Mail, solange du welche hast. **Tägliche Zusammenfassung meiner Aufgaben per E-Mail** bestellt sie ab oder wieder an. Sie enthält Mappentitel und Links, keine Dokumente, und geht über den Mailserver deiner Ablage. Darunter wählst du:
    - **Uhrzeit** – im 15-Minuten-Raster; *Standard* ist die Uhrzeit, die der Administrator eingestellt hat.
    - **Wochentage** – Standard Montag bis Freitag. Ohne Wochentag kommt keine Zusammenfassung.
    - **Nicht an Feiertagen** – an gesetzlichen Feiertagen des Bundeslands, das der Administrator gewählt hat, kommt keine (Standard: an). Ohne Bundesland ist der Haken ausgegraut.

- **Favoriten** – **Bei Änderungen an meinen Favoriten benachrichtigen** (Standard: an); das Hervorheben geänderter Mappen steht unter [Darstellung](#geaenderte). Was dahintersteckt, steht unter [Favoriten als Abo](ablage.md#favoriten-als-abo). Hat ein Administrator die Benachrichtigung für deine Rolle abgeschaltet, steht hier statt des ersten Schalters ein Hinweis.

- **Sofort melden (Webhooks)** – Ablago meldet an eine Adresse, sobald sich deine Zahlen ändern (neue Post, Zu erledigen, Fristen), z. B. an Homey oder Node-RED. Nur Zahlen, keine Inhalte; nur an Ziele, die ein Administrator freigegeben hat. **Probe senden**, **Ein-/Ausschalten**, **Neues Geheimnis**, **Löschen** und die **letzten Meldungen** stehen an jedem Webhook. Wie du ihn einrichtest: [In die Hausautomatisierung einbinden](hausautomatisierung.md#sofort-melden-webhook).

![Mein Konto → Benachrichtigungen](bilder/profil-benachrichtigungen.png){ loading=lazy }

### Abwesenheit

Damit während deines Urlaubs nichts liegen bleibt, trägst du unter **Abwesenheit** einen **Vertreter** ein:

- **Abwesend** an, **Vertreter** wählen (Pflicht), optional **von** und **bis** (jeweils einschließlich). Ohne Datum gilt die Abwesenheit, bis du sie ausschaltest; mit „bis“ endet sie danach von selbst.
- Solange sie wirkt, gehen **neue** Aufgaben für dich – von Hand vergebene, Erwähnungen und „passt nicht“ – an deinen Vertreter. In der Historie der Mappe steht „weitergegeben wegen Abwesenheit“. Ist dein Vertreter selbst abwesend, geht sie an dessen Vertreter weiter.
- **Alle offenen Aufgaben an ‹Vertreter› geben** gibt auch die schon vorhandenen ab. Nach deiner Rückkehr bleiben sie beim Vertreter.
- Schaltest du die Abwesenheit ein und hast noch offene Aufgaben, erinnert dich ein Hinweis daran: Neue Aufgaben gehen an den Vertreter, die bestehenden bleiben bei dir, bis du sie weitergibst.
- Dein Vertreter bekommt einen Hinweis unter „Zu erledigen“ („Du wurdest für … als Vertreter hinterlegt“). Abwesende bekommen keine tägliche Zusammenfassung.
- Ein Administrator kann deine Abwesenheit auch für dich eintragen, etwa bei Krankheit. Eintragen, Ändern und Beenden stehen in der Historie deiner Benutzer-Mappe.

#### Meine offenen Aufgaben { #meine-offenen-aufgaben }

Alle Aufgaben, die gerade bei dir liegen, gibst du unter **Zu erledigen → Mehrere Aufgaben weitergeben …** weiter – einzeln, in Gruppen oder alle auf einmal:

- **Filter** nach **Art**, **Mappentyp**, **Fälligkeit** und Suche im Titel.
- **Einzeln:** unter der Aufgabe bei *weitergeben an* eine Person wählen.
- **Mehrere:** die Kästchen links anhaken oder **Alle angezeigten auswählen** (gilt für die gerade gefilterten). In der Leiste **Ausgewählte weitergeben an** eine Person wählen – dein eingetragener Vertreter ist schon vorausgewählt.

Weitergeben geht nur an Personen, die die jeweilige Mappe lesen dürfen; was nicht geht, steht danach mit Grund da und bleibt ausgewählt. Jede Weitergabe steht in der Historie der Mappe.

![Mehrere Aufgaben weitergeben](bilder/profil-abwesenheit-aufgaben.png){ loading=lazy }

## Fehler melden

Funktioniert etwas nicht, wähle im Menü **Fehler melden**:

![Fehler melden](bilder/fehler-melden.png)

1. Beschreibe kurz, was passiert ist und was du erwartet hättest.
2. Füge bei Bedarf bis zu zwei **Screenshots** hinzu (PNG, JPEG oder WebP, je höchstens 10 MB) – auch direkt mit Strg+V ins Textfeld.
3. Unter **Technische Angaben ansehen** steht, was mitgeschickt wird: Version von Ablago, Browser und Gerät, Bildschirm- und Fenstergröße, Sprache und Zeitzone, die zuletzt besuchten Seiten (bis zu 25) und die letzten Fehler im Browser (bis zu 10). Passwörter, Inhalte von Mappen und Dokumente gehen nicht mit.
4. **An die Administratoren senden** – oder **In die Zwischenablage kopieren**, um es z. B. per E-Mail zu schicken.

Die Administratoren sehen deine Meldung in der Werkbank und melden sich, falls sie Fragen haben.

## Hinweis „Ein Administrator hat in deinem Namen gearbeitet“

Um einen Fehler nachzustellen, kann sich ein Administrator als du anmelden. Er sieht dann genau, was du siehst. Danach zeigt dir Ablago beim nächsten Mal oben einen Hinweis, wer das wann getan hat. Mit **Verstanden** blendest du ihn aus. Solange er als du arbeitet, steht bei dieser Anmeldung unter *Meine angemeldeten Geräte* der Hinweis **Administrator agiert als du**.
