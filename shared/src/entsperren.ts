/**
 * Geschützte PDFs entsperren (#827) – gemeinsam für Server und Oberfläche.
 *
 * - **Passwort zum Öffnen:** Ablago zeigt am Dokument einen Hinweis. Nach Eingabe des Passworts entsteht mit qpdf eine
 *   entsperrte Fassung für Vorschau, Volltext, Stempel und Archivfassung. Das Original bleibt unverändert.
 * - **Nur Rechte-Sperre** (Öffnen ohne Passwort, Drucken oder Kopieren verboten): ohne Rückfrage wie ein normales PDF.
 * - **Passwörter für Dokumente merken** (Variante A): im Konto der Person, verschlüsselt mit dem Schlüssel von Ablago.
 *   Kommt neue Post für diese Person, probiert Ablago sie still durch.
 */

/** Wie ein PDF geschützt ist. */
export type PdfSchutzArt = 'passwort' | 'rechte';

/** Wie die entsperrte Fassung entstand: eingegebenes Passwort, gemerktes Passwort oder ohne Passwort (Rechte-Sperre). */
export interface Entsperrt {
  art: 'passwort' | 'gemerkt' | 'rechte';
  /** Konto, das entsperrt hat (null: Ablago selbst, z. B. bei der Rechte-Sperre). */
  von: string | null;
  /** Name des gemerkten Passworts (nur bei `gemerkt`). */
  name?: string;
}

/** Am Dokument (#827): Schutz und – falls vorhanden – die entsperrte Fassung. */
export interface PdfSchutz {
  art: PdfSchutzArt;
  entsperrt: (Entsperrt & { am: string }) | null;
}

/** Ein gemerktes Passwort, wie die Liste es zeigt – ohne das Passwort selbst. */
export interface GemerktesPasswort {
  id: string;
  name: string;
  erstellt: string;
  /** Zuletzt zum Entsperren benutzt (null: noch nie). */
  zuletzt: string | null;
}

/** Höchstens so viele gemerkte Passwörter je Person. */
export const GEMERKT_MAX = 20;
/** So lange gilt die erneute Bestätigung für „Passwörter für Dokumente“ (Anzeigen und Ändern). */
export const BESTAETIGUNG_MS = 5 * 60_000;
/** Höchstens so viele falsche Passwörter je Person und Dokument im Zeitfenster … */
export const VERSUCHE_MAX = 5;
/** … von 15 Minuten. */
export const VERSUCHE_MS = 15 * 60_000;
/** Längstes Passwort und längster Name. */
export const PASSWORT_MAX = 256;
export const NAME_MAX = 80;

/** Vorschlag für den Namen eines gemerkten Passworts: der Betreff ohne Datum, Nummern und Anhängsel. */
export function namensvorschlag(betreff: string | null | undefined): string {
  const t = String(betreff ?? '')
    .replace(/^\s*((AW|WG|RE|FW|Fwd)\s*:\s*)+/i, '')
    .replace(/\b\d{1,4}([./-]\d{1,4}){1,2}\b/g, ' ')
    .replace(/\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/[\s\-–:_,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t.slice(0, NAME_MAX);
}
