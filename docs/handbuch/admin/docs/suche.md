# Suche

Die Suche der Ablage verzeiht Tippfehler und andere Schreibweisen. Was sie dabei tut, stellst du unter **Werkbank → Suche** ein (Gruppe *Ablage aufbauen*; in der schlanken Werkbank für Haushalte ausgeblendet, siehe [Werkbank-Ansicht](uebersicht.md)). Wie Benutzer suchen, steht im [Benutzerhandbuch](https://motom001.github.io/dms/benutzer/aktuell/ablage/#suchen).

## Was immer gilt

Ohne Einstellung gleicht die Suche aus:

- **Umlaute, Akzente und ß:** „Gebuhr“ findet „Gebühr“, „Strasse“ findet „Straße“, „Ozdemir“ findet „Özdemir“ – in Titeln, Angaben, Notizen und im Volltext.
- **Bindestriche:** „Kfzversicherung“ findet „Kfz-Versicherung“ und umgekehrt.
- **Wortformen** im Volltext: „Rechnungen“ findet „Rechnung“ – in der Sprache des Dokuments (Deutsch, wenn keine erkannt ist).

## Tippfehler und „Meintest du …?“

Findet die Suche **nichts**, sucht sie mit ähnlichen Wörtern aus deiner Ablage weiter (Ähnlichkeit über Buchstabengruppen, pg_trgm) und sagt das über den Treffern: „Keine genauen Treffer für ‚Waschmaschiene‘. Gezeigt werden ähnliche Schreibweisen.“ Dazu schlägt sie **„Meintest du ‚waschmaschine‘?“** vor; ein Klick sucht genau dieses Wort. Gibt es genaue Treffer, bleibt es bei ihnen – genaue Treffer gehen immer vor.

Die ähnlichen Wörter kommen aus dem **Wörterverzeichnis**: allen Wörtern ab vier Buchstaben aus Titeln, Angaben und Volltexten. Es wächst von selbst mit; Wörter gelöschter Mappen bleiben stehen, bis du es mit **Neu aufbauen** frisch zählst (das dauert bei großen Ablagen einige Sekunden). Mit dem Haken **Bei keinem Treffer ähnliche Schreibweisen zeigen …** schaltest du die Tippfehler-Suche ab.

Ähnlich klingende Namen (Meier, Mayer, Maier) findet die Suche nur, wenn sie sich auch ähnlich schreiben.

## Gleichbedeutende Wörter

Eine **Gruppe** gleichbedeutender Wörter, z. B. *Kfz, Auto, PKW* oder *Nebenkosten, Betriebskosten*, sorgt dafür, dass die Suche nach einem der Wörter auch die anderen findet. Unter **Gleichbedeutende Wörter** trägst du eine Gruppe mit Komma getrennt ein und klickst **Gruppe hinzufügen**; **Ändern** und **Entfernen** stehen an jeder Gruppe. Eine Gruppe hat 2 bis 20 Wörter.

Gruppen gelten für einfache Suchen. Wer Anführungszeichen oder ein Minus benutzt (siehe [Suchsyntax](https://motom001.github.io/dms/benutzer/aktuell/ablage/#im-text-der-dokumente-suchen)), sucht genau das Eingegebene.

**Wortlisten aus Paketen:** [Pakete](pakete.md) können fertige Gruppen mitbringen, z. B. für Fahrzeuge oder Vermietung. Sie stehen unter **Wortlisten aus Paketen** zum Ansehen, ändern sich mit einem Update des Pakets und verschwinden, wenn du das Paket entfernst. Ohne solches Paket ist die Liste leer.

## Technik

- **PostgreSQL:** Umlaute faltet die Erweiterung `unaccent`. Sie ist ab PostgreSQL 13 „vertrauenswürdig“: Der Eigentümer der Datenbank legt sie ohne Superuser-Rechte an – auch bei einer [eigenen Datenbank](installation.md#datenbank-anbindung). `postgres:17` und `dms-komplett` bringen sie mit. Das DMS legt sie im eigenen Schema `erweiterungen_dms` an (sonst im Schema der Tabellen), damit sie das [Wiederherstellen](wiederherstellen.md) übersteht. Fehlt sie, faltet das DMS selbst (nur die häufigen Buchstaben); das steht beim Start als Hinweis im Protokoll der Migration.
- **Suchindex:** Das Update auf 0.127.0 baut den Suchindex der Dokumente einmal neu auf (Sprache des Dokuments, Umlaute, Bindestriche) und füllt das Wörterverzeichnis. Das dauert je nach Ablage einige Sekunden bis Minuten; in der Zeit startet das DMS noch nicht. Messwerte stehen in den Release-Notizen.
- **Sicherung:** Das Wörterverzeichnis gehört nicht in die Sicherung; beim Wiederherstellen entsteht es aus Mappen und Dokumenten neu. Die gleichbedeutenden Wörter sind in Sicherung und [Vollexport](export.md) (`struktur/synonyme.json`).
