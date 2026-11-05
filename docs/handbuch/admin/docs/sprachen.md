# Sprachen

**Werkbank → Einstellungen → Sprachen** legt fest, in welchen Sprachen Ablago in deiner Ablage spricht. Fest eingebaut sind **Deutsch** und **Englisch**; weitere Sprachen kommen als [Sprachpaket](#sprachpakete) aus dem [Paketkatalog](pakete.md).

## Einstellungen

- **Erlaubte Sprachen** – aus diesen wählt jede Person unter [Mein Konto → Konto → Sprache](https://help.ablago.app/benutzer/aktuell/profil/#sprache) ihre eigene. Deutsch ist die Ausgangssprache und immer dabei, ebenso die Sprache der Installation.
- **Sprache der Installation** – gilt für alle, die nichts gewählt haben, für die Anmeldeseite (solange der Browser keine erlaubte Sprache mitschickt) und für E-Mails an Personen ohne eigene Wahl. Der [Einrichtungsassistent](installation.md#sprache) setzt sie mit seinem ersten Schritt.

Nimmst du eine Sprache aus der Liste, sehen Personen, die sie gewählt hatten, Ablago wieder in der Sprache der Installation. Ihre Wahl bleibt gespeichert und gilt wieder, sobald du die Sprache erneut erlaubst.

## Sprachpakete { #sprachpakete }

Weitere Sprachen – etwa Französisch, Niederländisch, Spanisch, Italienisch, Türkisch oder Polnisch – installierst du unter **Werkbank → Pakete** wie jedes andere Paket: aus dem Katalog, über die [Sammeldatei](pakete.md#uber-die-katalog-webseite) (auch ohne Internet) oder als hochgeladene Datei. Ein Sprachpaket enthält **nur Texte**: die Oberfläche, Meldungen und E-Mails in seiner Sprache und Beschriftungen für die Standardpakete (Mappentypen, Felder, Auswahlwerte, Ansichten). Es enthält keinen Code und kann nichts an deinen Mappen ändern.

- **Vorschau:** Sie nennt die Sprache, wie vollständig die Übersetzung für deine Ablago-Version ist, für welche Version sie gemacht ist und ob sie **maschinell übersetzt** oder **geprüft** ist.
- **Danach erlauben:** Nach der Installation steht die Sprache in der Liste oben; erst wenn du sie erlaubst (und speicherst), können Personen sie in Mein Konto wählen.
- **Übersicht:** Unter **Weitere Sprachen** steht je Sprachpaket „Übersetzung 94 % vollständig“, für welche Ablago-Version es gemacht ist, ob maschinell übersetzt oder von wem geprüft und wie viele Personen es gewählt haben.
- **Fehlende Texte** erscheinen auf Englisch, sonst auf Deutsch. Datum, Zahlen und Beträge folgen den Regeln der Sprache (Französisch z. B. `04/03/2026` und `1 234,50`).
- **Beschriftungen:** Bringt das Sprachpaket Beschriftungen für installierte Pakete mit, ergänzt Ablago sie an deren Mappentypen und Ansichten – nur, wo in dieser Sprache noch nichts steht. Was du selbst beschriftet hast, bleibt.
- **Entfernen:** Hat jemand die Sprache gewählt oder ist sie die Sprache der Installation, fragt Ablago vorher nach. Die Betroffenen sehen Ablago danach in der Sprache der Installation – Deutsch, wenn die entfernte Sprache die der Installation war. Ihre Wahl bleibt gespeichert; Mein Konto weist sie darauf hin.

## Was in welcher Sprache erscheint

| Was | Sprache |
|---|---|
| Oberfläche, Meldungen, Hilfetexte | die der Person, sonst die der Installation |
| E-Mails an eine Person (Einladung, Passwort, Hinweise, Tägliche Zusammenfassung) | die der Person, sonst die der Installation |
| E-Mails an alle Administratoren | je Empfänger in seiner Sprache |
| Notfallblatt | die Sprache dessen, der es herunterlädt |
| Texte für Dritte (Auskunft nach Art. 15 DSGVO, Abruf-Link, Stempel) | die der Installation |
| Titel und Namen, die der Server einmal für alle bildet (z. B. Systemmappentypen, Ansichten der Pakete) | die der Installation |
| Protokoll | immer Deutsch |
| Datumsangaben, Zahlen und Beträge | nach der Sprache der Oberfläche (Englisch: britische Schreibweise, z. B. `04/03/2026` und `1,234.50`; Sprachpakete nach ihrem Gebietsschema) |

Bezeichnungen, die du selbst vergibst – Mappentypen, Felder, Register, Ansichten –, übersetzt du je Sprache am jeweiligen Element (Register **Sprachen**).

## Gut zu wissen

- Fehlt in einer Sprache ein Text, erscheint er auf Englisch, sonst auf Deutsch – es bleibt nie eine leere Stelle.
- Maschinell übersetzte Sprachpakete zeigen in Mein Konto den Hinweis „Maschinell übersetzt – Verbesserungen willkommen“ mit einem Link, wie man mitmacht.
- Mit mehreren Servern gilt eine Änderung sofort an dem Server, an dem du speicherst, und an den anderen spätestens nach einer Minute.
- Die Einstellung steht in der Datenbank (Einstellung `sprachen`) und ist damit in jeder [Sicherung](sicherung.md); die Wahl jeder Person steht an ihrem Konto.
