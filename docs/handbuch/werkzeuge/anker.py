#!/usr/bin/env python3
"""
Gleiche Anker in jeder Sprache (#730).

    python3 docs/handbuch/werkzeuge/anker.py [sprache]            # trägt die deutschen Anker in die Übersetzung ein
    python3 docs/handbuch/werkzeuge/anker.py [sprache] --pruefen  # meldet Abweichungen, schreibt nichts

Die Oberfläche verlinkt auf Abschnitte (shared/src/hilfe.ts), die Seiten untereinander auch. Damit
dieselben Verweise in jeder Sprache treffen, trägt jede übersetzte Überschrift den Anker der deutschen:
„## Backup schedule {#zeitplan-und-aufbewahrung}“. Das Werkzeug ordnet die Überschriften einer Seite
der Reihe nach zu (gleiche Anzahl, gleiche Ebenen) und ergänzt fehlende Anker. Passt die Gliederung
nicht zusammen, meldet es die Seite – dann fehlt in der Übersetzung ein Abschnitt oder ist zu viel.

Sprache: en (Vorgabe). Ordner: <handbuch>/docs/ (Deutsch) und <handbuch>/docs-<sprache>/.
"""
import re, sys
from pathlib import Path

import markdown

HANDBUCH = Path(__file__).resolve().parents[1]
HANDBUECHER = ['benutzer', 'admin', 'installieren', 'entwickler']
# Wie in mkdocs.yml; ohne Snippets (darin stehen keine Überschriften).
ERWEITERUNGEN = ['admonition', 'attr_list', 'md_in_html', 'tables', 'toc', 'pymdownx.details', 'pymdownx.superfences']
UEBERSCHRIFT = re.compile(r'^(#{1,6})[ \t]+(.*?)[ \t]*$')
ANKER = re.compile(r'\s*\{\s*#([^}\s]+)[^}]*\}\s*$')
ZAUN = re.compile(r'^\s*(```+|~~~+)')
# Seiten, die ein Werkzeug erzeugt (neu.py, glossar.py) – ihre Gliederung folgt den Daten, nicht der Übersetzung.
ERZEUGT = {('benutzer', 'neu.md'), ('admin', 'neu.md'), ('benutzer', 'begriffe.md')}


def toc(text: str) -> list[tuple[int, str]]:
    """(Ebene, Anker) jeder Überschrift, wie mkdocs sie vergibt."""
    md = markdown.Markdown(extensions=ERWEITERUNGEN)
    md.convert(text)
    aus = []

    def lauf(tokens):
        for t in tokens:
            aus.append((t['level'], t['id']))
            lauf(t['children'])
    lauf(md.toc_tokens)
    return aus


def zeilen_mit_ueberschrift(zeilen: list[str]) -> list[int]:
    """Zeilennummern der ATX-Überschriften außerhalb von Codeblöcken."""
    aus, zaun = [], None
    for i, z in enumerate(zeilen):
        m = ZAUN.match(z)
        if m:
            zeichen = m.group(1)[0] * 3
            if zaun is None:
                zaun = zeichen
            elif z.strip().startswith(zaun):
                zaun = None
            continue
        if zaun is None and UEBERSCHRIFT.match(z):
            aus.append(i)
    return aus


def seite(de: Path, ue: Path, schreiben: bool) -> list[str]:
    deutsch = toc(de.read_text(encoding='utf-8'))
    text = ue.read_text(encoding='utf-8')
    fremd = toc(text)
    name = ue.relative_to(HANDBUCH)
    if [e for e, _ in deutsch] != [e for e, _ in fremd]:
        return [f'{name}: Gliederung weicht ab (Deutsch {len(deutsch)} Überschriften, Übersetzung {len(fremd)}) – '
                f'erste Abweichung bei Nr. {next((i + 1 for i, (a, b) in enumerate(zip(deutsch, fremd)) if a[0] != b[0]), min(len(deutsch), len(fremd)) + 1)}']
    zeilen = text.split('\n')
    nummern = zeilen_mit_ueberschrift(zeilen)
    if len(nummern) != len(fremd):
        return [f'{name}: {len(fremd)} Überschriften, davon {len(nummern)} im Text gefunden – bitte Anker von Hand setzen']
    fehler, geaendert = [], False
    for nr, (_, anker_de), (_, anker_ue) in zip(nummern, deutsch, fremd):
        if anker_de == anker_ue:
            continue
        if ANKER.search(zeilen[nr]):
            fehler.append(f'{name}:{nr + 1}: Anker #{anker_ue}, im Deutschen #{anker_de}')
        elif schreiben:
            zeilen[nr] = f'{zeilen[nr]} {{#{anker_de}}}'
            geaendert = True
        else:
            fehler.append(f'{name}:{nr + 1}: Anker #{anker_de} fehlt')
    if geaendert:
        ue.write_text('\n'.join(zeilen), encoding='utf-8')
    return fehler


def main():
    argumente = [a for a in sys.argv[1:] if not a.startswith('--')]
    sprache = argumente[0] if argumente else 'en'
    pruefen = '--pruefen' in sys.argv
    fehler, seiten = [], 0
    for h in HANDBUECHER:
        de_ordner, ue_ordner = HANDBUCH / h / 'docs', HANDBUCH / h / f'docs-{sprache}'
        if not ue_ordner.is_dir():
            continue
        for ue in sorted(ue_ordner.rglob('*.md')):
            rel = ue.relative_to(ue_ordner)
            de = de_ordner / rel
            if not de.is_file():
                fehler.append(f'{h}/docs-{sprache}/{rel}: keine deutsche Seite dazu')
                continue
            if (h, rel.as_posix()) in ERZEUGT:
                continue
            seiten += 1
            fehler += seite(de, ue, not pruefen)
        for de in sorted(de_ordner.rglob('*.md')):
            rel = de.relative_to(de_ordner)
            if not (ue_ordner / rel).is_file() and not rel.parts[0] in ('bilder', 'vorlagen'):
                fehler.append(f'{h}/docs/{rel}: fehlt in docs-{sprache}/')
    for f in fehler:
        print(f'::warning title=Anker ({sprache})::{f}' if pruefen else f)
    print(f'Anker {sprache}: {seiten} Seiten, {len(fehler)} Abweichung(en)')
    sys.exit(1 if fehler and pruefen else 0)


if __name__ == '__main__':
    main()
