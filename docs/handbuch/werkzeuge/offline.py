#!/usr/bin/env python3
"""
Handbücher für die Offline-Hilfe im Image bauen (#219).

    python3 docs/handbuch/werkzeuge/offline.py <ziel>

Baut alle vier Handbücher ohne Screenshots nach <ziel>/<handbuch>/, ihre Übersetzungen (#730) nach
<ziel>/<handbuch>/<sprache>/ und die Startseiten nach <ziel>/index.html und <ziel>/<sprache>/index.html –
für die Auslieferung unter /hilfe/ im DMS. Arbeitet auf einer Kopie von
docs/, damit „Neu in dieser Version“ das Arbeitsverzeichnis nicht verändert. Prüft danach,
dass jeder lokale Verweis (/hilfe/…) auf eine vorhandene Seite zeigt.
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[3]
HANDBUECHER = ['benutzer', 'admin', 'installieren', 'entwickler']
# Weitere Sprachen (#730): je Handbuch mkdocs.<sprache>.offline.yml, Startseite start/<sprache>/index.html.
SPRACHEN = ['en']


def main():
    ziel = Path(sys.argv[1] if len(sys.argv) > 1 else 'hilfe').resolve()
    version = json.loads((WURZEL / 'package.json').read_text())['version']
    m = re.match(r'^(\d+)\.(\d+)\.', version)
    ordner = f'v{m.group(1)}.{m.group(2)}' if m else 'aktuell'
    shutil.rmtree(ziel, ignore_errors=True)
    ziel.mkdir(parents=True)

    with tempfile.TemporaryDirectory() as tmp:
        kopie = Path(tmp)
        shutil.copytree(WURZEL / 'docs' / 'handbuch', kopie / 'docs' / 'handbuch', ignore=shutil.ignore_patterns('bilder', 'site', 'node_modules'))
        shutil.copytree(WURZEL / 'docs' / 'releases', kopie / 'docs' / 'releases')
        shutil.copy(WURZEL / 'package.json', kopie / 'package.json')
        subprocess.run([sys.executable, str(kopie / 'docs/handbuch/werkzeuge/neu.py'), ordner], check=True)
        for h in HANDBUECHER:
            env = {**os.environ, 'DMS_HILFE_HANDBUCH': h, 'DMS_HILFE_VERSION': ordner}
            # Erst Deutsch (räumt <ziel>/<handbuch>/ leer), dann jede Übersetzung in ihren Unterordner.
            fassungen = [('mkdocs.offline.yml', ziel / h)] + [(f'mkdocs.{s}.offline.yml', ziel / h / s) for s in SPRACHEN]
            for datei, aus in fassungen:
                if not (kopie / 'docs/handbuch' / h / datei).is_file():
                    continue
                subprocess.run(['mkdocs', 'build', '--strict', '--quiet', '-f', str(kopie / 'docs/handbuch' / h / datei), '-d', str(aus)], check=True, env=env)
                (aus / 'sitemap.xml').unlink(missing_ok=True)
                (aus / 'sitemap.xml.gz').unlink(missing_ok=True)
                schlanker(aus)

    # Startseiten: „aktuell“ gibt es offline nicht – die Handbücher liegen direkt unter /hilfe/<handbuch>/.
    for unter in [''] + [f'{s}/' for s in SPRACHEN]:
        quelle = WURZEL / 'docs/handbuch/start' / unter / 'index.html'
        if not quelle.is_file():
            continue
        start = quelle.read_text(encoding='utf-8')
        start = re.sub(rf'href="((?:\.\./)*)({"|".join(HANDBUECHER)})/aktuell/', r'href="\1\2/', start)
        (ziel / unter).mkdir(parents=True, exist_ok=True)
        (ziel / unter / 'index.html').write_text(start, encoding='utf-8')
    for f in (WURZEL / 'docs/handbuch/start').iterdir():  # Logo und Favicon der Startseite (#689)
        if f.is_file() and f.name != 'index.html':
            shutil.copy(f, ziel / f.name)

    fehler = pruefe(ziel)
    # Nichts von außen (#698): Die Hilfe im Programm lädt keine Schrift, kein Skript, kein Bild von fremden Diensten.
    sys.path.insert(0, str(Path(__file__).parent))
    import fremd
    fehler += fremd.pruefe([p for p in ziel.rglob('*') if p.suffix in ('.html', '.css')], offline=True)
    groesse = sum(p.stat().st_size for p in ziel.rglob('*') if p.is_file())
    print(f'Offline-Hilfe {ordner}: {sum(1 for _ in ziel.rglob("*.html"))} Seiten, {groesse / 1e6:.1f} MB')
    if fehler:
        print('\n'.join(f'::error title=Offline-Hilfe::{f}' for f in fehler[:50]))
        sys.exit(1)


def schlanker(ordner: Path):
    """Was offline niemand braucht: Quellkarten und Suchsprachen außer Deutsch."""
    for p in ordner.rglob('*.map'):
        p.unlink()
    lunr = ordner / 'assets' / 'javascripts' / 'lunr'
    behalten = {'lunr.de.min.js', 'lunr.stemmer.support.min.js', 'lunr.multi.min.js'}
    for p in lunr.rglob('*.js'):
        if p.name not in behalten:
            p.unlink()


def pruefe(ziel: Path) -> list[str]:
    """Jeder Verweis auf /hilfe/… zeigt auf eine vorhandene Datei oder Seite."""
    fehler = set()
    for html in ziel.rglob('*.html'):
        for pfad in re.findall(r'(?:href|src)="(/hilfe/[^"#?]*)', html.read_text(encoding='utf-8')):
            p = ziel / pfad[len('/hilfe/'):]
            if not (p.is_file() or (p / 'index.html').is_file()):
                fehler.add(f'{html.relative_to(ziel)}: {pfad} fehlt')
    return sorted(fehler)


if __name__ == '__main__':
    main()
