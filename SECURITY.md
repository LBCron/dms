# Sicherheit

**Deutsch** · [English](SECURITY.en.md)

## Eine Sicherheitslücke melden

Bitte **kein öffentliches Issue** für Sicherheitslücken. Melde sie vertraulich über GitHub: **Security → Report a vulnerability** in diesem Repository ([Private Vulnerability Reporting](https://github.com/motom001/dms/security/advisories/new)). Meldungen auf Deutsch oder Englisch sind willkommen.

Hilfreich sind: betroffene Version (Werkbank → Technik), Schritte zum Nachstellen, was jemand damit erreichen kann. Wir melden uns, sobald wir die Meldung gesehen haben, und veröffentlichen eine Korrektur als Patch-Release mit Hinweis in den Release-Notes.

## Unterstützte Versionen

Korrekturen gibt es für die **neueste Version**. Aktualisiere bitte zuerst, bevor du meldest – siehe [Aktualisieren](https://motom001.github.io/dms/admin/aktuell/aktualisieren/).

## Was automatisch geprüft wird

| Was | Womit | Wann |
| --- | --- | --- |
| Unser Code (TypeScript, Workflows) | CodeQL | jeder Pull Request, jeder Push auf `main` |
| Bibliotheken | Dependabot (Warnungen und Updates), `npm audit` ab Stufe „hoch“ | jeder Pull Request, wöchentlich |
| Images `dms` und `dms-komplett` | Trivy: kritische Lücken mit Korrektur blockieren den Pull Request | jeder Pull Request, jede Veröffentlichung, wöchentlicher Neubau |
| Geheimnisse (Tokens, Passwörter) | Secret Scanning mit Push-Schutz | jeder Push |
| Arbeitsweise des Projekts | [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/motom001/dms) | wöchentlich, jeder Push auf `main` |

Die Funde stehen unter **Security** in diesem Repository. Bewusst hingenommene Funde der Image-Prüfung stehen mit Begründung in [`.trivyignore`](.trivyignore).

## Herkunft der Images prüfen

Jedes veröffentlichte Image trägt einen signierten **Herkunftsnachweis** (aus welchem Commit, mit welchem Workflow gebaut) und eine **Stückliste** (SBOM, SPDX). Prüfen mit der [GitHub-Kommandozeile](https://cli.github.com/):

```sh
gh attestation verify oci://ghcr.io/motom001/dms:<version> -R motom001/dms
gh attestation verify oci://ghcr.io/motom001/dms-komplett:<version> -R motom001/dms
```

Wie das im Einzelnen gebaut ist, steht im [Entwicklerhandbuch](https://motom001.github.io/dms/entwickler/aktuell/release/#abhangigkeiten-und-sicherheitsupdates).

## Herkunft der Pakete prüfen

Das DMS-Projekt signiert den offiziellen Paketkatalog ([dms-registry](https://github.com/motom001/dms-registry)) mit Ed25519. Das DMS prüft die Signatur ab Version 0.141.0 mit diesen beiden öffentlichen Schlüsseln (fest im Code, `server/src/projektschluessel.ts`); gültig ist eine Signatur mit einem der beiden:

| Schlüssel | Kennung | Fingerabdruck (SHA-256 des öffentlichen Schlüssels) |
| --- | --- | --- |
| Signierschlüssel (CI der Registry) | `da31d65f4a429768` | `da31 d65f 4a42 9768 db27 8f76 e67a ce99 7024 9d25 9352 e7da 5a0b 931b d85d 5ac0` |
| Reserveschlüssel (offline beim Maintainer) | `e8e8f4f53d4eca0e` | `e8e8 f4f5 3d4e ca0e 3e51 ac12 bbe8 807e 9c3c 00af 19a7 27cc 2d1e 1b92 172b fe15` |

> **Achtung: Das sind noch Testschlüssel.** Ihre privaten Gegenstücke stehen offen in den Tests; eine damit erzeugte Signatur beweist nichts. Sobald der Maintainer die echten Schlüssel erzeugt hat, stehen hier deren Fingerabdrücke. Wie das geht, steht im [Entwicklerhandbuch](https://motom001.github.io/dms/entwickler/aktuell/pakete/#projektschluessel-austauschen).

Was „signiert“ und „nicht signiert“ in der Vorschau bedeutet, steht im [Administrationshandbuch](https://motom001.github.io/dms/admin/aktuell/pakete/#herkunft-signiert-oder-nicht).
