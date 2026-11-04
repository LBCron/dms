#!/usr/bin/env python3
"""
Lädt das gebaute Handbuch etwas von fremden Diensten? (#698)

    python3 docs/handbuch/werkzeuge/fremd.py <ordner> [--offline] [weitere Dateien …]

Sucht in allen HTML- und CSS-Dateien nach Skripten, Stilen, Schriften, Bildern, Rahmen und
Medien mit einer Adresse außerhalb von help.ablago.app. Normale Links (<a href>) nach draußen
bleiben erlaubt. Mit --offline (Hilfe im Programm) ist gar keine fremde Adresse erlaubt.
Exit 1 mit einer Liste der Fundstellen.
"""
import re, sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ERLAUBT = {'help.ablago.app'}
# Attribute, die der Browser von selbst lädt (Element → Attribute).
LAEDT = {'script': ['src'], 'img': ['src', 'srcset'], 'iframe': ['src'], 'source': ['src', 'srcset'],
         'video': ['src', 'poster'], 'audio': ['src'], 'embed': ['src'], 'object': ['data'], 'image': ['href', 'xlink:href'],
         'use': ['href', 'xlink:href'], 'input': ['src']}
# <link rel=…>, die etwas laden (Stil, Schrift, Symbol, Vorladen); „canonical“, „alternate“ usw. sind nur Verweise.
LINK_LAEDT = {'stylesheet', 'icon', 'shortcut', 'apple-touch-icon', 'preload', 'prefetch', 'modulepreload', 'preconnect', 'dns-prefetch', 'manifest', 'mask-icon'}
CSS_URL = re.compile(r'''url\(\s*['"]?([^'")\s]+)|@import\s+['"]([^'"]+)''')


def fremd(adresse: str, offline: bool) -> bool:
    adresse = adresse.strip()
    if adresse.startswith('//'):
        adresse = 'https:' + adresse
    u = urlparse(adresse)
    if u.scheme in ('', 'data', 'blob') or not u.netloc:
        return False
    return offline or u.hostname not in ERLAUBT


class Leser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.funde: list[str] = []
        self.im_stil = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        werte = []
        if tag == 'link' and LINK_LAEDT & set((a.get('rel') or '').lower().split()):
            werte.append(a.get('href') or '')
        for name in LAEDT.get(tag, []):
            v = a.get(name) or ''
            werte += [t.strip().split(' ')[0] for t in v.split(',')] if name == 'srcset' else [v]
        if a.get('style'):
            werte += [x or y for x, y in CSS_URL.findall(a['style'])]
        self.funde += [f'<{tag}> {w}' for w in werte if w]
        self.im_stil = tag == 'style'

    def handle_endtag(self, tag):
        if tag == 'style':
            self.im_stil = False

    def handle_data(self, data):
        if self.im_stil:
            self.funde += [f'<style> {x or y}' for x, y in CSS_URL.findall(data)]


def pruefe(dateien, offline: bool) -> list[str]:
    fehler = []
    for f in dateien:
        text = f.read_text(encoding='utf-8', errors='replace')
        if f.suffix == '.css':
            funde = [f'css {x or y}' for x, y in CSS_URL.findall(text)]
        else:
            l = Leser(); l.feed(text); funde = l.funde
        for fund in funde:
            if fremd(fund.split(' ', 1)[1], offline):
                fehler.append(f'{f}: {fund}')
    return fehler


def main():
    args = [a for a in sys.argv[1:] if a != '--offline']
    offline = '--offline' in sys.argv
    if not args:
        sys.exit(__doc__)
    dateien = []
    for a in args:
        p = Path(a)
        dateien += [x for x in p.rglob('*') if x.suffix in ('.html', '.css')] if p.is_dir() else [p]
    fehler = pruefe(dateien, offline)
    for x in fehler[:80]:
        print(f'::error title=Fremde Adresse im Handbuch::{x}')
    print(f'{len(dateien)} Dateien geprüft, {len(fehler)} fremde Adressen' + (' (offline: gar keine erlaubt)' if offline else ''))
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
