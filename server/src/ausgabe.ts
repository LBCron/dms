/**
 * Ausgabe-Bearbeitungen (#394): Was beim Weitergeben mit einem Dokument passiert – an EINER Stelle für
 * Herunterladen, Export (PDF, ZIP) und E-Mail. Das gespeicherte Original bleibt immer unverändert; hier
 * entsteht nur die ausgegebene Kopie.
 *
 * Schritte in dieser Reihenfolge: erst verkleinern (#393), dann stempeln (#394) – so wird der Stempel nicht
 * mit heruntergerechnet. Später kommt Schwärzen (#392) als weiteres Feld von `Ausgabewunsch` dazu.
 *
 * Der Stempel wird als Seiteninhalt gezeichnet und mit dem übrigen Seiteninhalt zu einem Strom
 * zusammengeführt (`pdf/stempel.ts`, #541). Wer PDF-Werkzeuge beherrscht, kann Textoperatoren trotzdem
 * entfernen – ein Pixel-genaues „Einbrennen“ ist das nicht (siehe Handbuch).
 */
import { ersetzePlatzhalter, kannStempeln, type GeltenderStempel } from '../../shared/src/stempel';
import { Fachfehler } from './fehler';
import { bildAlsA4Pdf, stempelePdf } from './pdf';
import { mb, verkleinere, type Stufe } from './verkleinern';

export interface Ausgabedatei { name: string; mime: string; inhalt: Buffer }
/** Was mit der Kopie geschehen soll. Später: `schwaerzen` (#392). */
export interface Ausgabewunsch { stempel?: GeltenderStempel | null; verkleinern?: Stufe | null }
export interface Ausgabekontext { benutzer: string; mappe: string; archivnummer?: string | null; datum?: string }
export interface Ausgabe extends Ausgabedatei {
  /** Der Stempeltext mit ersetzten Platzhaltern, wenn gestempelt wurde. */
  stempeltext: string | null;
  /** Grund, warum die Datei unverändert bleibt (z. B. kein PDF/Bild bei freiwilligem Stempel). */
  unveraendert?: string;
  /** Verkleinert (#393): Größe vorher und nachher; fehlt, wenn nicht verkleinert wurde (oder es nichts brachte). */
  verkleinert?: { vorher: number; nachher: number } | null;
  /** Gestempelt (auch nur mit Seitenzahlen oder Archivnummer). */
  gestempelt?: boolean;
}

/** Für Historie und Mail (#393, #394): „mit Stempel „KOPIE“, verkleinert (18,4 MB → 2,1 MB)“; leer, wenn nichts bearbeitet wurde. */
export function weitergabeWas(a: Ausgabe[] | null | undefined): string {
  if (!a?.length) return '';
  const gestempelt = a.filter((x) => x.gestempelt);
  const text = gestempelt.find((x) => x.stempeltext)?.stempeltext;
  const klein = a.filter((x) => x.verkleinert);
  const vorher = klein.reduce((s, x) => s + x.verkleinert!.vorher, 0), nachher = klein.reduce((s, x) => s + x.verkleinert!.nachher, 0);
  return [
    gestempelt.length ? (text ? `mit Stempel „${text}“` : 'mit Seitenzahlen') : '',
    klein.length ? `verkleinert (${mb(vorher)} → ${mb(nachher)})` : '',
  ].filter(Boolean).join(', ');
}

export { kannStempeln };
export const brauchtBearbeitung = (w: Ausgabewunsch | null | undefined) => !!w?.stempel || !!w?.verkleinern;

/** „foto.jpg“ → „foto.pdf“ (Bilder werden beim Stempeln zum PDF). */
export function pdfName(name: string): string {
  const p = name.lastIndexOf('.');
  return `${p > 0 ? name.slice(0, p) : name}.pdf`;
}

/**
 * Bereitet eine Datei für die Ausgabe auf. Ohne Bearbeitung kommt sie unverändert zurück.
 * `streng`: eine Datei, die sich nicht stempeln lässt, ist ein Fehler (einzelnes Herunterladen);
 * sonst bleibt sie unverändert – außer der Mappentyp verlangt den Stempel (Pflicht).
 */
export async function fuerAusgabe(d: Ausgabedatei, w: Ausgabewunsch | null | undefined, k: Ausgabekontext, streng = false): Promise<Ausgabe> {
  const g = w?.stempel;
  // 1. Verkleinern (#393): nur PDFs; bringt es weniger als 10 %, bleibt die Datei, wie sie ist.
  let verkleinert: Ausgabe['verkleinert'] = null;
  if (w?.verkleinern && d.mime === 'application/pdf') {
    try {
      const r = await verkleinere(d.inhalt, w.verkleinern);
      if (r.lohnt) { d = { ...d, inhalt: r.inhalt }; verkleinert = { vorher: r.vorher, nachher: r.nachher }; }
    } catch (x) {
      // Verkleinern ist ein Angebot: Lässt sich ein PDF nicht lesen, geht das Original hinaus (außer beim einzelnen Herunterladen).
      if (streng) throw x;
    }
  }
  if (!g) return { ...d, stempeltext: null, verkleinert, ...(verkleinert || !w?.verkleinern ? {} : { unveraendert: d.mime === 'application/pdf' ? `„${d.name}“ lässt sich nicht nennenswert verkleinern.` : `„${d.name}“ ist kein PDF und wird nicht verkleinert.` }) };
  // 2. Stempeln (#394)
  const text = ersetzePlatzhalter(g.stempel.text, { datum: k.datum, empfaenger: g.empfaenger, benutzer: k.benutzer, mappe: k.mappe });
  if (!kannStempeln(d.mime)) {
    const grund = `„${d.name}“ lässt sich nicht stempeln – das geht nur bei PDFs und Bildern (JPEG, PNG).`;
    if (streng || g.pflicht) throw new Fachfehler(422, g.pflicht ? `${grund} Der Mappentyp verlangt beim Weitergeben einen Stempel.` : grund);
    return { ...d, stempeltext: null, unveraendert: grund };
  }
  // Gezeichnet wird in der PDF-Stelle (#541). Nach dem Verkleinern mit Objektströmen speichern, sonst wäre
  // ein Teil der Ersparnis wieder weg.
  const inhalt = await stempelePdf({ name: d.name, mime: d.mime, inhalt: d.inhalt, stempel: g.stempel, text, archivnummer: k.archivnummer ?? null, objektstroeme: !!verkleinert });
  return { name: d.mime === 'application/pdf' ? d.name : pdfName(d.name), mime: 'application/pdf', inhalt, stempeltext: text || null, verkleinert, gestempelt: true };
}

/** Ein Bild (JPEG/PNG) als PDF-Seite in A4, Hoch- oder Querformat nach dem Bild. */
export const bildAlsPdf = (bild: Buffer, png: boolean): Promise<Buffer> => bildAlsA4Pdf(bild, png);
