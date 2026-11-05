"""
mkdocs-Hook für die Handbücher in weiteren Sprachen (#730).

Jedes Handbuch hat seine deutschen Seiten unter <handbuch>/docs/ und je weitere Sprache einen eigenen
Ordner, z. B. <handbuch>/docs-en/ mit mkdocs.en.yml. Die Seiten heißen in jeder Sprache gleich
(mappen.md → …/en/mappen/), die Anker auch (werkzeuge/anker.py). Dieser Hook sorgt dafür, dass die
Übersetzung nur ihre Texte enthalten muss:

- Alles außer Seiten (Stile, Skripte, Logo, Grafiken, Bildschirmfotos, Vorlagen …) kommt aus dem
  deutschen Ordner, wenn die Sprache es nicht selbst mitbringt. Grafiken mit Text liegen dort als
  eigene Fassung je Sprache (grafiken/name.en.svg); die übersetzte Seite bindet diese Fassung ein.
- Bildschirmfotos: Gibt es bilder/<sprache>/<name>.png (aufnehmen.mjs mit DMS_SPRACHE), nimmt die
  Übersetzung dieses Bild, sonst das deutsche. Seiten mit deutschen Bildern bekommen einen kurzen Hinweis.
- In der deutschen Fassung bleibt bilder/<sprache>/ draußen (exclude_docs in mkdocs.yml).

Ohne neue Abhängigkeit (kein mkdocs-static-i18n): je Sprache ein eigener Bau nach <ziel>/<handbuch>/<sprache>/.
"""
import os
import re
from pathlib import Path

from mkdocs.structure.files import File

# Hinweis über Seiten, deren Bildschirmfotos noch die deutsche Oberfläche zeigen.
HINWEIS_BILDER = {
    'en': (
        '!!! note "Screenshots in German"\n'
        '    The screenshots on this page still show the German interface. They are replaced automatically '
        'as soon as the interface is available in English.\n'
    ),
}
BILD = re.compile(r'\]\((?:\.\./)*bilder/([^)\s]+\.png)')

_sprache = ''
_deutsch: Path | None = None
_eigene_bilder: set[str] = set()


def on_config(config, **_):
    global _sprache, _deutsch
    _sprache = config.theme.get('language') or 'de'
    _deutsch = Path(config.config_file_path).parent / 'docs'
    return config


def on_files(files, config, **_):
    _eigene_bilder.clear()
    if _sprache == 'de' or not _deutsch or not _deutsch.is_dir():
        return files
    sprachbilder = _deutsch / 'bilder' / _sprache
    for wurzel, _ordner, dateien in os.walk(_deutsch, followlinks=True):
        for name in dateien:
            pfad = Path(wurzel) / name
            rel = pfad.relative_to(_deutsch).as_posix()
            if rel.endswith('.md') or rel.startswith(f'bilder/{_sprache}/'):
                continue
            if files.get_file_from_path(rel) is not None:
                continue
            datei = File(rel, str(_deutsch), config.site_dir, config.use_directory_urls)
            uebersetzt = sprachbilder / rel[len('bilder/'):] if rel.startswith('bilder/') else None
            if uebersetzt and uebersetzt.is_file():
                # Bildschirmfoto in dieser Sprache: unter demselben Namen ausliefern.
                datei.abs_src_path = str(uebersetzt)
                _eigene_bilder.add(rel[len('bilder/'):])
            files.append(datei)
    return files


def on_page_markdown(markdown, page, **_):
    hinweis = HINWEIS_BILDER.get(_sprache)
    if not hinweis:
        return markdown
    bilder = set(BILD.findall(markdown))
    if not bilder or bilder <= _eigene_bilder:
        return markdown
    # Direkt unter die Überschrift der Seite, sonst ganz oben.
    zeilen = markdown.split('\n')
    for i, z in enumerate(zeilen):
        if z.startswith('# '):
            return '\n'.join(zeilen[: i + 1] + ['', hinweis] + zeilen[i + 1 :])
    return hinweis + '\n' + markdown
