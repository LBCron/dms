# New in version 0.200

!!! info "Development version"
    This manual describes the state of `main` – some of it is not in any release yet.

!!! note "Release notes in German"
    The release notes are written in German. A browser translation helps until they are available in English.

## 0.200.0

### Neu

- **Auswahlfelder mit festen Werten und Beschriftungen je Sprache** (#728): Die Werte einer Auswahlliste sind feste Werte – genau sie stehen in jeder folder. Im folderstyp-Editor gibt es unter **Beschriftung der Werte** je Sprache eine Beschriftung, z. B. „Electricity“ für „Strom“. Ansichten, Suche, Bedingungen, Automatisierungen, Export und Schnittstelle arbeiten mit dem festen Wert; gezeigt wird die Beschriftung in der Sprache des Benutzers. Die Suche findet einen Wert auch über seine Beschriftung, die Erkennung ebenso.
- **Namen und Hilfetexte in mehreren Sprachen** (#728): Name und Beschreibung von folderstypen und Ansichten, Bezeichnung und Hilfetext von Feldern sowie die Namen von Registern und Trefferlisten haben im Editor einen kleinen Sprachumschalter (Deutsch und Englisch, bis die Werkbank die Sprachen festlegt). Fehlt eine Beschriftung, gilt der deutsche Text. Der Editor zeigt als Hinweis, wie viele Texte schon beschriftet sind, z. B. „12 von 14 Beschriftungen auf Englisch“.
- **Paketformat** (#728): Pakete bringen Beschriftungen unter `beschriftungen` mit – am folderstyp, an Feldern (auch für die Optionen), Registern und Ansichten. Ältere Pakete mit reinen Textoptionen funktionieren unverändert. Ein Update ergänzt Beschriftungen nur dort, wo noch keine stehen; die Vorschau nennt die Anzahl. „Paket erstellen“, Sicherung und Vollexport enthalten die Beschriftungen.

### Geändert

- Namen, Felder und Hilfetexte der Systemmappentypen (Benutzer, Rolle, Post) sowie die Namen der Standard-Register stehen jetzt in den Sprachdateien (#728). Sichtbar ändert sich nichts.
- Schnittstelle: folderstypen, Felder, Register, Trefferlisten und Ansichten haben die Angabe `beschriftungen` (#728). Wer sie beim Speichern weglässt, behält die bisherigen; `null` entfernt sie.

## Older versions

- All changes since 0.199.0 in detail: [comparison on GitHub](https://github.com/motom001/dms/compare/v0.199.0...main)
- All versions with their changes: [releases on GitHub](https://github.com/motom001/dms/releases)
