/**
 * Woher der Volltext eines Dokuments kommt (#458) – für die Anzeige am Dokument und in der Werkbank.
 *
 * Der Kern liest die Textebene von PDFs selbst (poppler). Scans und Bilder erkennt ein Paket mit der Schnittstelle
 * `dms:texterkennung`; bis es den Volltext schreibt, steht das Dokument auf „wartet auf Texterkennung“ (Stand
 * `paket`). Die Herkunft steht im Hinweis `ocr.info`; diese Datei liest sie daraus zurück.
 */
import type { OcrStand } from './model';
import { PAKET_TEXT } from './pakete';

/** Id des Pakets Texterkennung im offiziellen Katalog (#459: für „jetzt installieren“). */
export const TEXTERKENNUNG_PAKET = 'texterkennung';

/** Hinweis bei Text aus der Textebene eines PDFs. */
export const INFO_TEXTEBENE = 'Textebene des PDFs';
/** So beginnt der Hinweis, solange ein Dokument auf das Paket wartet. */
export const INFO_WARTET = 'wartet auf Texterkennung';

/** Hinweis für Stand `paket`: mit dem Namen des Pakets oder ohne installiertes Paket. */
export const infoWartet = (paket: { name: string } | null) => (paket ? `${INFO_WARTET} (Paket ${paket.name})` : `${INFO_WARTET} – kein Paket installiert`);

export type VolltextHerkunft =
  | { art: 'pdf' }
  | { art: 'paket'; paket: string }
  | { art: 'wartet'; paket: string | null }
  | { art: 'eingebaut' }
  | { art: 'api' };

/** Herkunft aus dem Stand; null, wenn es (noch) keine gibt oder sie unbekannt ist. */
export function volltextHerkunft(o: OcrStand | null | undefined): VolltextHerkunft | null {
  if (!o) return null;
  if (o.stand === 'paket') return { art: 'wartet', paket: /\(Paket (.+?)\)/.exec(o.info ?? '')?.[1] ?? null };
  if (o.stand !== 'fertig' || !o.info) return null;
  // „übernommen (gleicher Inhalt): …“ – die Herkunft des übernommenen Texts zählt.
  const info = o.info.replace(/^übernommen \(gleicher Inhalt\): /, '');
  if (info.startsWith(PAKET_TEXT)) return { art: 'paket', paket: info.slice(PAKET_TEXT.length).split(/ · | – /)[0].trim() };
  if (info.startsWith(INFO_TEXTEBENE)) return { art: 'pdf' };
  if (info.startsWith('Volltext über die API')) return { art: 'api' };
  if (/Texterkennung/.test(info)) return { art: 'eingebaut' };
  return null;
}

/** Hinweis am Dokument, wenn die Datenbank ein Ergebnis auch nach mehreren Versuchen nicht annahm (#575). */
export const NICHT_GESPEICHERT = 'Text erkannt, aber nicht gespeichert – die Datenbank war ausgelastet. Bitte erneut versuchen';
