# Texterkennung und Wartung

Damit die Suche auch den Text von Dokumenten findet, erzeugt das DMS zu jedem neuen Dokument einen **Volltext** – im Hintergrund, ohne dass jemand warten muss:

*Texterkennung* gehört zur Vorlage **Betrieb**, *Wartungsoperationen* nur zur Vorlage **Alles**.

--8<-- "ausgeblendet-schritt.md"

- **PDFs:** Das DMS liest die vorhandene **Textebene** selbst (poppler) – sofort. PDFs, die ein Programm oder ein Scanner mit Text erzeugt hat, sind damit gleich durchsuchbar.
- **Scans und Fotos** (gescannte PDF-Seiten, JPEG, PNG) haben keine Textebene. Ihren Text erkennt das Paket **Texterkennung** aus dem [Katalog](pakete.md).
- **Andere Dateien** (z. B. Word, Excel, TIFF) bekommen vorerst keinen Volltext.

!!! warning "Seit Version 0.134: Texterkennung ist ein Paket"
    Bis Version 0.133 steckte die Texterkennung (Tesseract) im Image. Seit 0.134 ist das Image schlanker, und Scans bekommen ihren Text nur noch mit dem Paket **Texterkennung**. Nach dem Update zeigt die [Übersicht der Werkbank](uebersicht.md) den Hinweis **„Texterkennung ist jetzt ein Paket“** mit **Jetzt installieren** – das führt direkt zum Paket unter **Werkbank → Pakete**. Vorhandener Volltext bleibt unverändert. Dokumente, die noch auf ihre Texterkennung warteten, stehen auf „wartet auf Texterkennung – kein Paket installiert“; sobald das Paket installiert ist, gehen sie von selbst an das Paket. Ohne Internet installierst du es aus einer [Sammeldatei](pakete.md).

## Texterkennung als Paket

Das Paket **Texterkennung** (ab 2.0, Tesseract als WebAssembly im [Paket-Läufer](pakete.md)) übernimmt die Texterkennung. Es braucht dafür das Recht [Texterkennung übernehmen](pakete.md#recht-texterkennung). So läuft es:

1. Das DMS liest bei PDFs die **Textebene** – sofort, ohne Wartezeit. Hat ein PDF Text, ist es gleich durchsuchbar.
2. Jedes Dokument meldet das DMS dem Paket (Ereignis [Volltext fertig](pakete.md#ereignis-volltext-fertig)) – auch, wenn es keinen Text gefunden hat.
3. Dokumente **ohne Text** (Scans, Fotos) – und PDFs, in denen neben Textseiten gescannte Seiten stecken – stehen auf **„wartet auf Texterkennung (Paket …)“**, bis das Paket den Volltext schreibt. Danach steht am Dokument „Texterkennung durch Paket …“. Bei langen Dokumenten zeigt das Paket dort, wie weit es ist (z. B. „Seite 20 von 64“).
4. Was das Paket erkennt (Sprache, Seiten aufrichten, ob es auch PDFs mit Text neu erkennt, Auflösung), stellst du **beim Paket** ein: **Werkbank → Pakete → Texterkennung → Einstellungen**.

Ohne Paket bleiben Scans und Fotos ohne Text („wartet auf Texterkennung – kein Paket installiert“); PDFs mit Text sind trotzdem durchsuchbar.

**Wie schnell?** Das Paket ist etwas langsamer als die frühere eingebaute Texterkennung, weil es als WebAssembly abgeschottet läuft: Auf einem Rechner mit 2 Kernen (amd64) brauchte es für 10 gescannte Seiten etwa 31–35 Sekunden, die eingebaute dort 25–26 Sekunden; eine einzelne Seite dauert vom Hochladen bis zum Text etwa 4–6 Sekunden. Erkannt hat es dabei genauso gut. Lange Dokumente erkennt es abschnittsweise, die Zeitgrenze des Paket-Läufers greift nicht. Mehr Messwerte stehen im README des Pakets.

![Werkbank → Texterkennung](bilder/werkbank-texterkennung.png)

## Werkbank → Texterkennung

Die Seite ist eine **Übersicht**; Einstellungen der Erkennung gibt es hier nicht mehr (sie stehen beim Paket):

- **Texterkennung für Scans und Bilder:** welches Paket die Texterkennung übernimmt, mit Link zu seinen Einstellungen, und wie viele Dokumente gerade darauf warten. Fehlt das Paket, steht hier der Hinweis mit **Jetzt installieren**.
- **Woher der Text kommt:** wie viele Dokumente ihren Text aus dem PDF haben, vom Paket, von der früheren eingebauten Texterkennung (bis 0.133), ohne Text sind, auf die Texterkennung warten oder einen Fehler hatten.
- **Erkannte Sprachen** mit dem Hinweis, wenn dem Paket Sprachdaten fehlen (siehe [Weitere Sprachen](#weitere-sprachen)).
- **Warteschlange**, **Werkzeuge** (poppler) und **Aufträge** (siehe unten).

Ob ein Dokumentenregister überhaupt einen Volltext erzeugt, stellst du am [Mappentyp](mappentypen.md#register) ein (*Volltext erzeugen*, Standard: an).

Steht die Warteschlange, sagt ein Hinweis oben auf der Seite und bei *Volltext neu erzeugen* warum: **ausgeschaltet** (mit **Einschalten**) oder **pausiert, solange der Wartungsmodus an ist** (mit **Wartungsmodus beenden**). Ein nur angekündigter Wartungsmodus hält die Warteschlange nicht an.

## Sprache automatisch erkennen

Das DMS erkennt aus dem Text selbst, in welcher Sprache ein Dokument geschrieben ist – offline und ohne fremde Dienste: Es zählt typische kurze Wörter (Artikel, Präpositionen, Grußformeln) und Sonderzeichen. Unterschieden werden Deutsch, Englisch, Französisch, Spanisch, Italienisch, Niederländisch, Türkisch, Polnisch, Portugiesisch, Russisch, Ukrainisch und Arabisch. Bei sehr wenig Text (z. B. nur Zahlen) bleibt die Sprache offen.

Die erkannte Sprache steht **am Dokument** neben dem Stand des Volltexts (z. B. „Volltext: fertig · 2 Seiten · Französisch“), auch bei PDFs mit Textebene. Sie ist ein eigenes Feld des Dokuments, und die **Volltextsuche nimmt die Wortstämme dieser Sprache**: Im französischen Brief findet „cheval“ auch „chevaux“, im englischen „invoice“ auch „invoices“. Ohne erkannte Sprache gilt Deutsch.

Das Paket **Texterkennung** nutzt dieselbe Erkennung bei *Sprache: Automatisch*: Es liest zuerst Deutsch, erkennt die Sprache und liest die Seite in der erkannten Sprache ein zweites Mal, wenn es eine andere ist und das Paket ihre Sprachdaten hat – das bessere Ergebnis gilt. Quer liegende oder auf dem Kopf stehende Seiten richtet es vorher auf.

Pakete und die [Schnittstelle](api.md) geben die Sprache mit dem Volltext an (`PUT /dokumente/{id}/volltext` mit `sprache`) oder setzen sie einzeln (`PUT /dokumente/{id}/sprache`, z. B. `{ "sprache": "fra" }`, `null` = keine Angabe). Das steht in der Historie der Mappe.

## Weitere Sprachen

Im Paket **Texterkennung** stecken Deutsch, Englisch und die Lageerkennung. Weitere Sprachen kommen als **Zusatzpakete** aus dem Katalog dazu, z. B. **Texterkennung – Französisch** (`texterkennung_fra`). Ein eigenes Image oder eingehängte Sprachdateien braucht es nicht mehr.

Unter **Werkbank → Texterkennung → Erkannte Sprachen** siehst du, wie viele Dokumente in welcher Sprache vorliegen und ob das Paket ihre Sprachdaten hat. Fehlen sie, macht die Seite einen Vorschlag, z. B. „12 Dokumente auf Französisch – das Paket Texterkennung liest sie besser mit dem Zusatzpaket texterkennung_fra“, mit Link zum Zusatzpaket. Fehlende Sprachdaten nennt das Paket außerdem im Ergebnis und im Protokoll des Paket-Läufers („Sprachdaten fehlen: fra (Zusatzpaket texterkennung_fra)“).

Nach dem Installieren eines Zusatzpakets erkennt **Volltext neu erzeugen → Für alle Dokumente** (siehe unten) die vorhandenen Dokumente neu – oder du startest einzelne unter **Aufträge → fertig** neu.

## Aufträge

Unter **Aufträge** siehst du in einer Liste mit fester Höhe die Dokumente je Stand (*Fehler*, *wartet*, *läuft*, *wartet auf Texterkennung*, *ausgelassen*, *fertig*) – mit Mappe (als Link), Größe, Zeitpunkt und dem **Grund** bei Fehlern oder ausgelassenen Dokumenten.

- Dokumente auswählen und **Neu starten**: Sie kommen wieder in die Warteschlange.
- Wartende **aus der Warteschlange nehmen** bzw. laufende **abbrechen**: Sie gelten dann als *ausgelassen* („Vom Administrator abgebrochen“); ein laufender Vorgang (pdftotext) wird beendet. Bei *wartet auf Texterkennung* verwirft das DMS die noch nicht zugestellte Meldung an das Paket; Text aus dem PDF bleibt.
- **Neu starten** lässt den Volltext ausdrücklich neu erzeugen: Auch ein Paket erkennt dann Dokumente neu, die schon Text haben.
- **Alle Fehler neu starten** reiht alle Dokumente mit Fehler wieder ein.

**Wenn die Datenbank ausgelastet ist:** Speichern viele Vorgänge gleichzeitig (ein Stapel Scans, Demo-Daten, ein Import), kann die Datenbank das Speichern eines Ergebnisses ausnahmsweise abbrechen. Das DMS versucht es dann von selbst noch einige Male mit kurzer Pause. Klappt es auch dann nicht, steht das Dokument auf *Fehler* mit dem Grund „Text erkannt, aber nicht gespeichert – die Datenbank war ausgelastet“ und einem Eintrag im Protokoll – nie still ohne Volltext. **Neu starten** bzw. **Alle Fehler neu starten** holt es nach. Das gilt auch, wenn ein Paket den Text schreibt: Es bekommt dann die Antwort 503 und sendet erneut.

**Passwortgeschützte PDFs** erkennt das DMS und lässt sie mit dem Grund „Das PDF ist mit einem Passwort geschützt“ aus, statt einen Fehler zu melden – ein neuer Versuch würde nichts ändern.

Alle Meldungen der Texterkennung stehen im [Protokoll](fehlersuche.md) unter dem Modul `texterkennung`.

Am Dokument sehen alle Benutzer den Stand (*wartet*, *läuft*, *wartet auf Texterkennung*, *fertig*, *Fehler*, *ausgelassen*) und woher der Text kommt („Text aus dem PDF“, „Texterkennung durch Paket …“); bei einem Fehler lässt sich die Texterkennung dort **erneut versuchen**, und ein fertiger Text lässt sich anzeigen. Wer die Mappe bearbeiten darf, kann den Volltext eines Dokuments mit **Neu erzeugen** ausdrücklich neu erzeugen lassen. Liegt dieselbe Datei schon mit Volltext in einer anderen Mappe, übernimmt das DMS diesen Text.

## Wartungsoperationen

**Werkbank → Wartungsoperationen** sammelt Arbeiten am ganzen Bestand, die du bei Bedarf anstößt:

- **Volltext neu erzeugen** – für Dokumente ohne Text oder für alle, siehe unten.
- **Vorschaubilder nachholen** erzeugt für ältere PDFs und Bilder das kleine Bild der ersten Seite, das neben jedem Dokument steht. Neue Dokumente bekommen es gleich nach dem Hochladen, ältere sonst beim ersten Anzeigen. Die Bilder entstehen eins nach dem anderen mit `pdftoppm` (poppler, im Image enthalten).
- **Alle Dateien prüfen** liest jede gespeicherte Datei, auch ältere Versionen, und vergleicht sie mit ihrem Prüfwert. So fällt auf, wenn eine Datei auf dem Speicher verändert wurde oder fehlt. Mehr dazu unter [Alle Dateien prüfen](archiv.md#alle-dateien-prufen).
- **Nummern nachträglich vergeben** gibt Mappen eine Nummer, die angelegt wurden, bevor ihr Feld einen Nummernkreis bekam. Mehr dazu unter [Nummern nachträglich vergeben](nummernkreise.md#nummern-nachtraglich-vergeben).
- **Absender bereinigen** leert falsche Absender bei älterer Post, siehe unten.
- **Angaben, die nicht zum Format passen** listet gespeicherte Werte auf, die nicht zu einem Format oder zu Datumsgrenzen passen, siehe unten.

Alle laufen im Hintergrund; das DMS bleibt dabei benutzbar.

### Volltext neu erzeugen

Läuft wie bei einem neuen Dokument: Das DMS liest die Textebene neu und gibt das Dokument an das Paket für die Texterkennung.

- **Für Dokumente ohne Text** – alle Dokumente, deren Volltext leer ist: noch nie gelesen (z. B. vor Version 0.11 hochgeladen), Scans, für die es noch kein Paket gab, oder nach einem Fehler. Ersetzt das frühere „Volltext nachholen“.
- **Für alle Dokumente** – nach einer Rückfrage mit der Anzahl. Das ist ein **ausdrückliches Neu**: Das Paket erkennt dann auch Dokumente neu, die schon Text haben – auch wenn bei ihm „Vorhandenen Volltext verwerfen und neu erkennen“ aus ist. Sinnvoll etwa nach einem neuen Sprachpaket. Bis das Paket fertig ist, bleibt der bisherige Text für die Suche stehen.

Nur Dokumente in Registern, die einen Volltext erzeugen. Es läuft als **Auftrag mit Fortschritt** („Textebene lesen und an die Texterkennung geben: 120 von 800“) und lässt sich **abbrechen**; das DMS bleibt benutzbar. Der Auftrag selbst ist schnell – die Zeit braucht die Texterkennung danach: Das Paket **Texterkennung** schafft etwa **10 Seiten in 35 Sekunden** (amd64, 2 Kerne), 1.000 Seiten also in rund einer Stunde. Wie weit es ist, siehst du unter **Werkbank → Texterkennung** („wartet auf Texterkennung“).

Ist kein Paket für die Texterkennung installiert, sagt die Seite das mit dem Weg zu **Werkbank → Pakete**.

### Absender bereinigen

Bis Version 0.99 trug das DMS bei hochgeladener Post ohne Absender den **Namen dessen ein, der sie angelegt hat** – bei Post aus dem Eingangsordner „Eingangsordner“. Absender ist aber, wer den Brief geschickt hat. Neue Post bekommt seitdem keinen Absender mehr, solange niemand ihn einträgt.

Für den Bestand zeigt **Absender bereinigen** eine Vorschau: eingehende Post mit Kanal *Hochgeladen*, *API*, *WebDAV* oder *Ordner*, deren Absender genau der Name des Anlegenden (bzw. „Eingangsordner“) ist. Post aus Postfächern und versendete E-Mails sind nie dabei. Nimm den Haken weg, wo der Absender doch stimmt, und tippe auf **Absender leeren**. In der Historie jeder Post steht danach, was vorher im Feld stand und wer bereinigt hat.

### Angaben, die nicht zum Format passen

Bekommt ein Feld ein [Format oder Datumsgrenzen](mappentypen.md#formate-und-datumsgrenzen) – selbst eingestellt oder mit einem Paket-Update –, bleiben gespeicherte Angaben gültig. Diese Liste zeigt sie je Mappentyp und Feld: die Mappe (ein Klick öffnet sie in der Ablage), die Angabe und was nicht passt, z. B. „Eine deutsche PLZ hat genau 5 Ziffern“ oder „Das Datum darf nicht in der Zukunft liegen“. Je Feld stehen höchstens 200 Mappen da.

Korrigieren musst du nichts sofort: Sobald jemand das Feld in der Mappe ändert, muss die Angabe passen. Andere Felder der Mappe lassen sich wie bisher speichern.
