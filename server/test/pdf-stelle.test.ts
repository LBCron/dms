/**
 * Gemeinsame PDF-Stelle (#541): pdf-lib wird nur in `server/src/pdf/` eingebunden. So trifft ein späterer
 * Austausch der Bibliothek (gepflegte Abspaltung, mehr über qpdf, anderes Werkzeug) nur diesen Ordner.
 * Diese Prüfung läuft in der CI – wie die Sperre gegen bunte Symbole (#425).
 *
 * Gesucht wird in Server, Weboberfläche und shared nach `from 'pdf-lib'`, `import('pdf-lib')` und
 * `require('pdf-lib')` (auch Unterpfade wie `pdf-lib/cjs/...`). Tests dürfen pdf-lib weiter nutzen, um die
 * erzeugten PDFs zu untersuchen – sie gehören nicht zum ausgelieferten Code.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const WURZEL = new URL('../..', import.meta.url).pathname;
const ORDNER = ['server/src', 'web/src', 'shared/src'].map((o) => join(WURZEL, o));
const STELLE = join(WURZEL, 'server/src/pdf') + '/';

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]pdf-lib(?:\/[^'"]*)?['"]/m;

export function bindetPdfLibEin(text: string): boolean {
  return text.split('\n').some((z) => IMPORT.test(z));
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' || n === 'dist' ? [] : dateien(p);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(n) ? [p] : [];
  });
}

describe('Gemeinsame PDF-Stelle (#541)', () => {
  it('erkennt die Arten, pdf-lib einzubinden', () => {
    assert.ok(bindetPdfLibEin("import { PDFDocument } from 'pdf-lib';"));
    assert.ok(bindetPdfLibEin('import {\n  degrees,\n} from "pdf-lib";'));
    assert.ok(bindetPdfLibEin("const p = await import('pdf-lib');"));
    assert.ok(bindetPdfLibEin("const p = require('pdf-lib/cjs/api');"));
    assert.ok(bindetPdfLibEin("import 'pdf-lib';"));
    assert.ok(!bindetPdfLibEin(' * pdf-lib liest Bilder über DataView'));
    assert.ok(!bindetPdfLibEin("import { x } from './pdf';"));
  });

  it('pdf-lib nur in server/src/pdf/', () => {
    const funde = ORDNER.flatMap(dateien).filter((p) => !p.startsWith(STELLE) && bindetPdfLibEin(readFileSync(p, 'utf8')));
    assert.deepEqual(funde.map((p) => relative(WURZEL, p)), [], 'pdf-lib bitte nur über die PDF-Stelle server/src/pdf/ nutzen (#541).');
  });

  it('pdf-lib ist nur im Server eine Abhängigkeit', () => {
    for (const p of ['package.json', 'web/package.json', 'shared/package.json']) {
      let pk: { dependencies?: Record<string, string> };
      try { pk = JSON.parse(readFileSync(join(WURZEL, p), 'utf8')); } catch { continue; }
      assert.ok(!pk.dependencies?.['pdf-lib'], `${p}: pdf-lib gehört nur in server/package.json`);
    }
  });
});
