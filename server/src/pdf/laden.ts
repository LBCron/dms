/**
 * PDF laden mit Grenze für gepackte Objektströme (#823).
 *
 * pdf-lib entpackt beim Laden alle Objekt- und Querverweis-Ströme (`/Type /ObjStm`, `/Type /XRef`) vollständig in den
 * Speicher. Ein präpariertes PDF von 2 MB kann so mehrere GB belegen – als `ArrayBuffer`, den die Speichergrenze der
 * Arbeiter (#542, `maxOldGenerationSizeMb`) nicht erfasst. Darum prüft Ablago diese Ströme vorher mit einer harten
 * Obergrenze (zlib `maxOutputLength`) und lehnt ab, was sie überschreitet oder ungewöhnlich verpackt ist.
 *
 * Inhalte und Bilder entpackt pdf-lib erst bei Bedarf; dort gelten die Grenzen der jeweiligen Vorgänge.
 */
import { inflateSync } from 'node:zlib';
import { PDFDocument, type LoadOptions } from 'pdf-lib';
import { Fachfehler } from '../fehler';
import { eigenerPuffer } from './puffer';

/** Höchstens so viel darf ein einzelner Objekt- oder Querverweis-Strom entpackt groß sein. */
export const OBJEKTSTROM_MAX = 64 * 1024 * 1024;
/** Höchstens so viel alle zusammen. */
export const OBJEKTSTROEME_MAX = 256 * 1024 * 1024;

const latin1 = new TextDecoder('latin1');
const STREAM = Buffer.from('stream');
const ENDSTREAM = Buffer.from('endstream');

/** Wörterbuch vor einem `stream`: Text ab dem letzten `obj` (höchstens 8 KB zurück). */
function woerterbuchVor(daten: Uint8Array, pos: number): string {
  const ab = Math.max(0, pos - 8192);
  const text = latin1.decode(daten.subarray(ab, pos));
  const i = text.lastIndexOf(' obj');
  return i >= 0 ? text.slice(i) : text;
}

/**
 * Prüft alle Objekt- und Querverweis-Ströme. Wirft Fachfehler 422, wenn einer entpackt zu groß ist, sich nicht
 * entpacken lässt oder mit anderen Filtern als FlateDecode gepackt ist.
 */
export function pruefeObjektstroeme(daten: Uint8Array): void {
  const buf = Buffer.from(daten.buffer, daten.byteOffset, daten.byteLength);
  let summe = 0;
  for (let pos = buf.indexOf(STREAM); pos >= 0; pos = buf.indexOf(STREAM, pos + STREAM.length)) {
    // „endstream“ enthält auch „stream“ – überspringen.
    if (pos >= 3 && buf.subarray(pos - 3, pos).toString('latin1') === 'end') continue;
    const dict = woerterbuchVor(daten, pos);
    const objektstrom = /\/ObjStm\b/.test(dict) || (/\/First\b/.test(dict) && /\/N\b/.test(dict));
    const querverweis = /\/XRef\b/.test(dict) || /\/W\s*\[/.test(dict);
    if (!objektstrom && !querverweis) continue;
    let start = pos + STREAM.length;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const ende = buf.indexOf(ENDSTREAM, start);
    if (ende < 0) continue; // pdf-lib scheitert selbst
    const filter = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict)?.[1]?.replace(/\s+/g, ' ').trim();
    if (!filter) { summe += ende - start; continue; }
    if (filter !== '/FlateDecode' && filter !== '[/FlateDecode]' && filter !== '[ /FlateDecode ]') {
      throw new Fachfehler(422, 'Das PDF ist ungewöhnlich verpackt (Objektstrom mit anderem Filter als FlateDecode) und wird nicht gelesen.');
    }
    let n: number;
    try {
      n = inflateSync(buf.subarray(start, ende), { maxOutputLength: OBJEKTSTROM_MAX, finishFlush: 2 /* Z_SYNC_FLUSH: Rest am Ende erlauben */ }).length;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE' || e instanceof RangeError) {
        throw new Fachfehler(422, 'Das PDF entpackt sich auf ein Vielfaches seiner Größe und wird zum Schutz des Servers nicht gelesen.');
      }
      continue; // kaputt gepackt: pdf-lib entscheidet selbst
    }
    summe += n;
    if (summe > OBJEKTSTROEME_MAX) throw new Fachfehler(422, 'Das PDF entpackt sich auf ein Vielfaches seiner Größe und wird zum Schutz des Servers nicht gelesen.');
  }
}

/** PDFDocument.load mit Prüfung der Objektströme und eigenem Puffer (#456). */
export async function ladePdf(daten: Uint8Array, optionen?: LoadOptions): Promise<PDFDocument> {
  pruefeObjektstroeme(daten);
  return PDFDocument.load(eigenerPuffer(daten), optionen);
}
