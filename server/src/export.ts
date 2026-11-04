/**
 * Export mehrerer Mappen (#152, #153): Tabelle (CSV, Excel), ZIP mit Dokumenten und ein PDF.
 * Passwortfelder werden nie ausgegeben.
 */
import { formatiere, istSystemspalte, SYSTEMSPALTEN, trefferlistenVon, type Dokument, type Feld, type Mappe, type Mappentyp } from '../../shared/src/model';
import { spaltenDerSicht } from '../../shared/src/sichten';
import type { Zelle } from './xlsx';
import { mappenPdfZeichnen, type PdfMappenSeite } from './pdf';
import { zeitzone } from '../../shared/src/region';

export type Spaltenart = 'liste' | 'alle';

const ALLE_SYSTEM = ['_titel', '_typ', '_erstellt', '_erstelltVon', '_geaendert', '_geaendertVon'];
const istPasswort = (typen: Mappentyp[], k: string) => typen.some((t) => t.felder.some((f) => f.key === k && f.typ === 'passwort'));

/** Spalten des Exports: wie die Trefferliste der Sicht oder alle Felder; nie Passwörter. */
export function exportSpalten(typen: Mappentyp[], art: Spaltenart, trefferliste?: string | null): string[] {
  let s: string[];
  if (art === 'liste') {
    s = spaltenDerSicht(typen, trefferliste).spalten;
    if (!s.length || (typen.length === 1 && !trefferlistenVon(typen[0]).some((l) => l.spalten.length))) s = [];
  } else s = [];
  if (!s.length) {
    const felder: string[] = [];
    for (const t of typen) for (const f of t.felder) if (!felder.includes(f.key)) felder.push(f.key);
    s = ['_titel', ...(typen.length > 1 ? ['_typ'] : []), ...felder, '_erstellt', '_erstelltVon', '_geaendert', '_geaendertVon'];
  }
  if (!s.includes('_titel')) s = ['_titel', ...s];
  return s.filter((k) => (istSystemspalte(k) ? ALLE_SYSTEM.includes(k) : !istPasswort(typen, k)));
}

export function spaltenKopf(k: string, typen: Mappentyp[]): string {
  if (istSystemspalte(k)) return SYSTEMSPALTEN[k];
  return typen.map((t) => t.felder.find((f) => f.key === k)?.label).find(Boolean) ?? k;
}

const titelOder = (t: string | null | undefined) => (t && t.trim() ? t : 'Ohne Titel');
const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: zeitzone(), dateStyle: 'short', timeStyle: 'short' });

export interface Quelle { typen: Map<string, Mappentyp>; titel(id: string | null | undefined): string }

/** Eine Zeile: als Text (CSV, PDF) und als Wert (Excel). */
export function zeile(m: Mappe, spalten: string[], q: Quelle): { text: string[]; werte: Zelle[] } {
  const typ = q.typen.get(m.typId);
  const text: string[] = []; const werte: Zelle[] = [];
  for (const k of spalten) {
    switch (k) {
      case '_titel': text.push(titelOder(m.titel)); werte.push(titelOder(m.titel)); continue;
      case '_typ': text.push(typ?.name ?? ''); werte.push(typ?.name ?? ''); continue;
      case '_erstellt': text.push(zeit(m.erstellt)); werte.push({ zeitpunkt: m.erstellt }); continue;
      case '_geaendert': text.push(zeit(m.geaendert)); werte.push({ zeitpunkt: m.geaendert }); continue;
      case '_erstelltVon': { const n = m.erstelltVon ? q.titel(m.erstelltVon) : ''; text.push(n); werte.push(n); continue; }
      case '_geaendertVon': { const n = m.geaendertVon ? q.titel(m.geaendertVon) : ''; text.push(n); werte.push(n); continue; }
    }
    const f = typ?.felder.find((x) => x.key === k);
    const v = m.werte[k];
    if (!f || f.typ === 'passwort' || v == null || v === '') { text.push(''); werte.push(null); continue; }
    const t = formatiere(f, v, (id) => q.titel(id));
    text.push(t);
    werte.push(wert(f, v, t));
  }
  return { text, werte };
}

function wert(f: Feld, v: unknown, text: string): Zelle {
  switch (f.typ) {
    case 'zahl': return typeof v === 'number' ? v : text;
    case 'betrag': { const b = v as { betrag?: number; waehrung?: string }; return typeof b?.betrag === 'number' ? { betrag: b.betrag, waehrung: b.waehrung || 'EUR' } : null; }
    case 'datum': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? { datum: v } : text;
    case 'janein': return text;
    default: return text;
  }
}

/** Ordner- und Dateinamen ohne verbotene Zeichen. */
export function sichererName(s: string, max = 80): string {
  return (s.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '') || 'ohne Namen').slice(0, max).trim();
}

/** Eindeutige Namen: „a.pdf“, „a (2).pdf“ … */
export function eindeutig(namen: string[]): string[] {
  const vergeben = new Set<string>();
  return namen.map((n) => {
    let x = n; let i = 2;
    const punkt = n.lastIndexOf('.');
    const [kern, endung] = punkt > 0 ? [n.slice(0, punkt), n.slice(punkt)] : [n, ''];
    while (vergeben.has(x.toLowerCase())) x = `${kern} (${i++})${endung}`;
    vergeben.add(x.toLowerCase());
    return x;
  });
}

/* ---------- PDF (#152) ---------- */

export interface PdfMappe {
  mappe: Mappe; typ?: Mappentyp; dokumente: Dokument[];
  /** Inhalt eines Dokuments (für PDFs und Bilder). */
  inhalt(d: Dokument): Promise<Buffer>;
}

const EINGEBUNDEN = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/** Was auf der Seite einer Mappe steht; die Inhalte der PDFs und Bilder werden dafür gelesen. */
async function mappenSeite(x: PdfMappe, q: Quelle): Promise<PdfMappenSeite> {
  const { mappe: m, typ } = x;
  const register = typ?.register.filter((r) => r.art === 'felder') ?? [];
  const bloecke: PdfMappenSeite['register'] = [];
  for (const r of register.length ? register : [{ key: '', name: '', felder: typ?.felder.map((f) => f.key) ?? [] }]) {
    const felder = (r.felder ?? []).map((k) => typ?.felder.find((f) => f.key === k)).filter((f): f is Feld => !!f && f.typ !== 'passwort');
    const mitWert = felder.filter((fd) => m.werte[fd.key] != null && m.werte[fd.key] !== '' && !(Array.isArray(m.werte[fd.key]) && !(m.werte[fd.key] as unknown[]).length));
    if (!mitWert.length) continue;
    bloecke.push({ name: register.length > 1 && r.name ? r.name : null, felder: mitWert.map((fd) => [fd.label, formatiere(fd, m.werte[fd.key], (id) => q.titel(id))]) });
  }
  const dokumente: PdfMappenSeite['dokumente'] = [];
  for (const d of x.dokumente) {
    let inhalt: Buffer | null | undefined;
    if (EINGEBUNDEN.has(d.mime)) { try { inhalt = await x.inhalt(d); } catch { inhalt = null; } }
    dokumente.push({ name: d.name, groesse: d.groesse, mime: d.mime, inhalt });
  }
  return {
    titel: titelOder(m.titel),
    zeile: `${typ?.name ?? ''} · angelegt ${zeit(m.erstellt)}${m.erstelltVon ? ` von ${q.titel(m.erstelltVon)}` : ''} · geändert ${zeit(m.geaendert)}${m.geaendertVon ? ` von ${q.titel(m.geaendertVon)}` : ''}`,
    register: bloecke, dokumente,
  };
}

/**
 * Ein PDF für mehrere Mappen: optional eine Übersicht als Tabelle, dann je Mappe eine Seite mit ihren
 * Feldern (ohne Passwörter) und der Liste der Dokumente; PDFs werden danach eingebunden, Bilder (JPEG, PNG)
 * als eigene Seite, andere Dateien nur genannt. Gezeichnet wird in der PDF-Stelle (#541).
 */
export async function mappenPdf(titel: string, mappen: PdfMappe[], q: Quelle, uebersicht: { spalten: string[]; typen: Mappentyp[] } | null): Promise<Buffer> {
  const seiten: PdfMappenSeite[] = [];
  for (const x of mappen) seiten.push(await mappenSeite(x, q));
  return mappenPdfZeichnen({
    titel,
    uebersicht: uebersicht && mappen.length ? {
      zeile: `${mappen.length} ${mappen.length === 1 ? 'Mappe' : 'Mappen'} · ${zeit(new Date().toISOString())}`,
      kopf: uebersicht.spalten.map((k) => spaltenKopf(k, uebersicht.typen)),
      zeilen: mappen.map((m) => zeile(m.mappe, uebersicht.spalten, q).text),
    } : null,
    mappen: seiten,
  });
}
