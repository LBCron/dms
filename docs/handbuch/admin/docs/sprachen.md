# Sprachen

**Werkbank → Einstellungen → Sprachen** legt fest, in welchen Sprachen Ablago in deiner Ablage spricht. Fest eingebaut sind **Deutsch** und **Englisch**; weitere Sprachen kommen später als Sprachpaket aus dem [Paketkatalog](pakete.md).

## Einstellungen

- **Erlaubte Sprachen** – aus diesen wählt jede Person unter [Mein Konto → Konto → Sprache](https://help.ablago.app/benutzer/aktuell/profil/#sprache) ihre eigene. Deutsch ist die Ausgangssprache und immer dabei, ebenso die Sprache der Installation.
- **Sprache der Installation** – gilt für alle, die nichts gewählt haben, für die Anmeldeseite (solange der Browser keine erlaubte Sprache mitschickt) und für E-Mails an Personen ohne eigene Wahl. Der [Einrichtungsassistent](installation.md#sprache) setzt sie mit seinem ersten Schritt.

Nimmst du eine Sprache aus der Liste, sehen Personen, die sie gewählt hatten, Ablago wieder in der Sprache der Installation. Ihre Wahl bleibt gespeichert und gilt wieder, sobald du die Sprache erneut erlaubst.

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
| Datumsangaben, Zahlen und Beträge | nach der Sprache der Oberfläche (Englisch: britische Schreibweise, z. B. `04/03/2026` und `1,234.50`) |

Bezeichnungen, die du selbst vergibst – Mappentypen, Felder, Register, Ansichten –, übersetzt du je Sprache am jeweiligen Element (Register **Sprachen**).

## Gut zu wissen

- Fehlt in einer Sprache ein Text, erscheint er auf Englisch, sonst auf Deutsch – es bleibt nie eine leere Stelle.
- Maschinell übersetzte Sprachpakete zeigen in Mein Konto den Hinweis „Maschinell übersetzt – Verbesserungen willkommen“ mit einem Link, wie man mitmacht.
- Mit mehreren Servern gilt eine Änderung sofort an dem Server, an dem du speicherst, und an den anderen spätestens nach einer Minute.
- Die Einstellung steht in der Datenbank (Einstellung `sprachen`) und ist damit in jeder [Sicherung](sicherung.md); die Wahl jeder Person steht an ihrem Konto.
