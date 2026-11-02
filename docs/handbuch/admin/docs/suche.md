# Suche

Die Suche der Ablage verzeiht Tippfehler und andere Schreibweisen. Was sie dabei tut, stellst du unter **Werkbank → Suche** ein (Gruppe *Ablage aufbauen*; in der Vorlage *Haushalt* nur im [Expertenmodus](uebersicht.md#werkbank-anpassen), in *Betrieb* und *Alles* immer). Wie Benutzer suchen, steht im [Benutzerhandbuch](https://motom001.github.io/dms/benutzer/aktuell/ablage/#suchen).

## Was immer gilt

Ohne Einstellung gleicht die Suche aus:

- **Umlaute, Akzente und ß:** „Gebuhr“ findet „Gebühr“, „Strasse“ findet „Straße“, „Ozdemir“ findet „Özdemir“ – in Titeln, Angaben, Notizen und im Volltext.
- **Bindestriche:** „Kfzversicherung“ findet „Kfz-Versicherung“ und umgekehrt.
- **Wortformen** im Volltext: „Rechnungen“ findet „Rechnung“ – in der Sprache des Dokuments (Deutsch, wenn keine erkannt ist). Bei Dokumenten in mehreren Sprachen (seit 0.139.0) je Seite in ihrer Sprache; gesucht wird über alle Sprachen des Dokuments (siehe [Texterkennung → Dokumente in mehreren Sprachen](texterkennung.md#mehrere-sprachen)).

## Tippfehler und „Meintest du …?“

Findet die Suche **nichts**, sucht sie mit ähnlichen Wörtern aus deiner Ablage weiter (Ähnlichkeit über Buchstabengruppen, pg_trgm) und sagt das über den Treffern: „Keine genauen Treffer für ‚Waschmaschiene‘. Gezeigt werden ähnliche Schreibweisen.“ Dazu schlägt sie **„Meintest du ‚waschmaschine‘?“** vor; ein Klick sucht genau dieses Wort. Gibt es genaue Treffer, bleibt es bei ihnen – genaue Treffer gehen immer vor.

Die ähnlichen Wörter kommen aus dem **Wörterverzeichnis**: allen Wörtern ab vier Buchstaben aus Titeln, Angaben und Volltexten. Es wächst von selbst mit – neue Wörter kommen im Hintergrund alle paar Sekunden dazu, damit gleichzeitiges Speichern sich nicht gegenseitig blockiert; Wörter gelöschter Mappen bleiben stehen, bis du es mit **Neu aufbauen** frisch zählst (das dauert bei großen Ablagen einige Sekunden). Mit dem Haken **Bei keinem Treffer ähnliche Schreibweisen zeigen …** schaltest du die Tippfehler-Suche ab.

Ähnlich klingende Namen (Meier, Mayer, Maier) findet die Suche nur, wenn sie sich auch ähnlich schreiben.

## Gleichbedeutende Wörter

Eine **Gruppe** gleichbedeutender Wörter, z. B. *Kfz, Auto, PKW* oder *Nebenkosten, Betriebskosten*, sorgt dafür, dass die Suche nach einem der Wörter auch die anderen findet. Unter **Gleichbedeutende Wörter** trägst du eine Gruppe mit Komma getrennt ein und klickst **Gruppe hinzufügen**; **Ändern** und **Entfernen** stehen an jeder Gruppe. Eine Gruppe hat 2 bis 20 Wörter.

Gruppen gelten für einfache Suchen. Wer Anführungszeichen oder ein Minus benutzt (siehe [Suchsyntax](https://motom001.github.io/dms/benutzer/aktuell/ablage/#im-text-der-dokumente-suchen)), sucht genau das Eingegebene.

**Wortlisten aus Paketen:** [Pakete](pakete.md) können fertige Gruppen mitbringen, z. B. für Fahrzeuge oder Vermietung. Sie stehen unter **Wortlisten aus Paketen** zum Ansehen, ändern sich mit einem Update des Pakets und verschwinden, wenn du das Paket entfernst. Ohne solches Paket ist die Liste leer.

## Technik

- **PostgreSQL:** Umlaute faltet die Erweiterung `unaccent`, Tippfehler und Wortteile findet `pg_trgm` – mehr dazu unter [Erweiterungen der Datenbank](#erweiterungen-der-datenbank).
- **Suchindex:** Das Update auf 0.127.0 baut den Suchindex der Dokumente einmal neu auf (Sprache des Dokuments, Umlaute, Bindestriche) und füllt das Wörterverzeichnis. Das dauert je nach Ablage einige Sekunden bis Minuten; in der Zeit startet das DMS noch nicht. Messwerte stehen in den Release-Notizen.
- **Sicherung:** Das Wörterverzeichnis gehört nicht in die Sicherung; beim Wiederherstellen entsteht es aus Mappen und Dokumenten neu. Die gleichbedeutenden Wörter sind in Sicherung und [Vollexport](export.md) (`struktur/synonyme.json`).

## Erweiterungen der Datenbank

Die Suche nutzt zwei Erweiterungen von PostgreSQL:

| Erweiterung | wofür | fehlt sie |
| --- | --- | --- |
| `pg_trgm` | Tippfehler und „Meintest du …?“, schnelle Suche nach Wortteilen („Ofen“ findet „Backofen“) | keine ähnlichen Schreibweisen, Wortteile ohne Index (langsamer) |
| `unaccent` | Umlaute, Akzente und ß („Muller“ findet „Müller“) | das DMS faltet selbst, nur die häufigen Buchstaben |

Beide sind ab PostgreSQL 13 „vertrauenswürdig“: Der Eigentümer der Datenbank legt sie ohne Superuser-Rechte an – auch bei einer [eigenen Datenbank](installation.md#datenbank-anbindung). `postgres:17` und `dms-komplett` bringen sie mit. Das DMS legt sie im eigenen Schema **`erweiterungen_dms`** an. Das ist wichtig fürs [Wiederherstellen](wiederherstellen.md): Es tauscht das Schema `public` aus und löscht das alte samt Inhalt – eine Erweiterung dort verschwände mit. Bis 0.131.0 lag `pg_trgm` noch in `public`; nach einer Wiederherstellung war die Tippfehler-Suche dann still aus. Das Update auf 0.131.1 zieht sie um und legt sie neu an, wenn sie schon fehlt.

**Prüfung:** Bei jedem Start legt das DMS eine fehlende `pg_trgm` neu an und zieht Erweiterungen aus `public` nach `erweiterungen_dms` um (die Indizes dazu entstehen danach im Hintergrund). Klappt das nicht, steht unter **Werkbank → Systemzustand** ein Hinweis mit Abhilfe, dazu ein Hinweis in der Übersicht und im [Protokoll](fehlersuche.md#protokoll) (Modul *datenbank*). Auch die [Probe-Wiederherstellung](wiederherstellen.md#probe-wiederherstellung) meldet fehlende Erweiterungen.

**Abhilfe**, wenn der Hinweis bleibt:

- **Recht fehlt:** Der Datenbank-Benutzer des DMS braucht das Recht `CREATE` auf seiner Datenbank (als Eigentümer der Datenbank hat er es). Danach das DMS neu starten.
- **Erweiterung nicht installiert:** Bei einer eigenen PostgreSQL-Installation gehören beide zum Paket `postgresql-contrib` (bei Debian/Ubuntu im Server-Paket enthalten).
- **Gehört einem anderen Benutzer:** Hat die Verwaltung der Datenbank die Erweiterung selbst in `public` angelegt, kann das DMS sie nicht umziehen. Dann zieht sie die Verwaltung um: `ALTER EXTENSION pg_trgm SET SCHEMA erweiterungen_dms;` – bei `unaccent` danach das DMS neu starten, es passt seine Suchfunktion beim Start an.
- Fehlt `unaccent` von Anfang an, funktioniert die Suche trotzdem; das DMS nimmt die Erweiterung nicht nachträglich auf.
