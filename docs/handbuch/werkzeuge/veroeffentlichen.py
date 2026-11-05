#!/usr/bin/env python3
"""
Handbuch online (#846): stellt aus den gebauten Handbüchern die Seite für GitHub Pages zusammen.

    python3 veroeffentlichen.py <ausgabe> <gebaut> <startseite.html>

  <gebaut>   enthält benutzer/, admin/, installieren/ und entwickler/ (mkdocs build), darin je
             Übersetzung einen Unterordner, z. B. benutzer/en/ (#730)
  <ausgabe>  wird neu angelegt und mit actions/upload-pages-artifact hochgeladen

Online gibt es nur noch „aktuell“. Ältere Fassungen bringt jede Installation unter /hilfe/ mit
(#219), und aus jedem Git-Tag lassen sie sich neu bauen. Aufbau:

  /index.html                 Startseite mit Logo und Favicons
  /en/index.html              Startseite auf Englisch (#730)
  /notfall/, /emergency/      Kurzadressen vom Notfallblatt (#814) – bleiben dauerhaft gültig
  /404.html                   leitet alte Adressen (v0.xx, entwicklung, ohne Ordner) auf „aktuell“
  /benutzer/index.html        → aktuell/
  /benutzer/aktuell/          …, ebenso admin/, installieren/, entwickler/
  /benutzer/aktuell/en/       dieselben Seiten auf Englisch (#730)

Die eigene Adresse help.ablago.app steht in den Pages-Einstellungen; eine Datei CNAME
braucht die Veröffentlichung über Actions nicht.
"""
import json, shutil, sys
from pathlib import Path

HANDBUECHER = ('benutzer', 'admin', 'installieren', 'entwickler')
ORDNER = 'aktuell'
# Übersetzungen (#730): je Handbuch ein Unterordner mit denselben Seiten.
SPRACHEN = ('en',)

# Kurzadressen (#814): Sie stehen auf dem Notfallblatt, also auf Papier – nie entfernen oder umbenennen, nur das
# Ziel darf sich ändern. Englisch zeigt seit #730 auf die englische Notfallseite.
KURZADRESSEN = {
    'notfall': 'admin/aktuell/was-ist-passiert/',
    'emergency': 'admin/aktuell/en/was-ist-passiert/',
}

UMLEITUNG = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Weiter …</title>
<meta http-equiv="refresh" content="0; url={ziel}">
<link rel="canonical" href="{ziel}">
<script>location.replace({ziel_js} + location.hash)</script>
</head><body><p><a href="{ziel}">Weiter zum Handbuch</a></p></body></html>
"""

NICHT_GEFUNDEN = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Ablago – Handbuch</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:15vh auto;padding:0 16px;color:#141A22}a{color:#1F4E79}</style>
<script>
// Alte Adressen (#846): /admin/v0.22/sicherung/, /admin/entwicklung/sicherung/ und /admin/sicherung/
// führen auf /admin/aktuell/sicherung/ – gibt es die Seite dort nicht, auf die Startseite des Handbuchs.
(async () => {
  const m = location.pathname.match(/^(.*?\\/)(benutzer|admin|installieren|entwickler)\\/(.*)$/);
  if (!m) return;
  const [, basis, h, rest] = m;
  const teile = rest.split('/');
  if (teile[0] === 'aktuell') {
    // Unbekannte Seite: auf die Startseite des Handbuchs in derselben Sprache (#730).
    const sprache = teile[1] === 'en' ? 'en/' : '';
    if (teile.slice(sprache ? 2 : 1).join('') !== '') location.replace(basis + h + '/aktuell/' + sprache);
    return;
  }
  const seite = /^v\\d+\\.\\d+$/.test(teile[0]) || teile[0] === 'entwicklung' ? teile.slice(1).join('/') : rest;
  const ziel = basis + h + '/aktuell/' + seite;
  let da = false;
  try { da = (await fetch(ziel, { method: 'HEAD' })).ok; } catch { /* offline: Startseite */ }
  location.replace((da ? ziel : basis + h + '/aktuell/') + (da ? location.hash : ''));
})();
</script></head>
<body><h1>Seite nicht gefunden</h1><p>Weiter zu <a href="/">allen Handbüchern</a>: <a href="/installieren/">Wie komme ich an Ablago?</a>, <a href="/benutzer/">Benutzerhandbuch</a>, <a href="/admin/">Administratorhandbuch</a>, <a href="/entwickler/">Entwicklerhandbuch</a>.</p>
<h2 lang="en">Page not found</h2><p lang="en">Continue to <a href="/en/">all manuals in English</a>.</p></body></html>
"""


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    ausgabe, gebaut, start = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    if ausgabe.exists():
        shutil.rmtree(ausgabe)
    ausgabe.mkdir(parents=True)
    for h in HANDBUECHER:
        if not (gebaut / h).is_dir():
            sys.exit(f'Handbuch {h} fehlt in {gebaut}')
        for s in SPRACHEN:
            if not (gebaut / h / s / 'index.html').is_file():
                sys.exit(f'Handbuch {h} fehlt auf {s} in {gebaut}/{h}/{s}')
        shutil.copytree(gebaut / h, ausgabe / h / ORDNER)
        weiter = f'{ORDNER}/'
        (ausgabe / h / 'index.html').write_text(UMLEITUNG.format(ziel=weiter, ziel_js=json.dumps(weiter)))
    for kurz, ziel in KURZADRESSEN.items():
        if not (ausgabe / ziel / 'index.html').is_file():
            sys.exit(f'Kurzadresse /{kurz}/: Ziel {ziel} fehlt im Handbuch')
        (ausgabe / kurz).mkdir()
        weiter = f'/{ziel}'
        (ausgabe / kurz / 'index.html').write_text(UMLEITUNG.format(ziel=weiter, ziel_js=json.dumps(weiter)))
    shutil.copy(start, ausgabe / 'index.html')
    for f in start.parent.iterdir():  # Logo und Favicons der Startseite (#689)
        if f.is_file() and f.name != 'index.html':
            shutil.copy(f, ausgabe / f.name)
    for s in SPRACHEN:  # Startseite je Sprache (#730), z. B. start/en/index.html → /en/
        if not (start.parent / s / 'index.html').is_file():
            sys.exit(f'Startseite {s}/index.html fehlt')
        (ausgabe / s).mkdir(exist_ok=True)
        shutil.copy(start.parent / s / 'index.html', ausgabe / s / 'index.html')
    (ausgabe / '404.html').write_text(NICHT_GEFUNDEN)
    (ausgabe / '.nojekyll').write_text('')
    groesse = sum(f.stat().st_size for f in ausgabe.rglob('*') if f.is_file())
    print(f'Handbuch „{ORDNER}“ zusammengestellt in {ausgabe}: {groesse / 2**20:.0f} MB')
    if groesse > 900 * 2**20:  # GitHub Pages: höchstens 1 GB je Seite
        sys.exit('Zu groß für GitHub Pages (höchstens 1 GB)')


if __name__ == '__main__':
    main()
