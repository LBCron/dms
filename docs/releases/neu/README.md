# Release-Notizen bis zum Merge (#952)

Hier legt jeder Pull Request, der das Programm ändert, **eine** Datei `<branch>.md` an:

```markdown
art: minor

## Neu

- **Etwas Neues** (#123): …
```

Erste Zeile `art: minor`, `art: patch` oder `art: keine`. Nach dem Merge vergibt der Workflow *Version vergeben* die Nummer, fasst die Dateien zu `docs/releases/v<version>.md` zusammen und löscht sie. Mehr im Entwicklerhandbuch unter *Release*.
