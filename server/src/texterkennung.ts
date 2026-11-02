import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { OCR_STAENDE, type Dokument, type OcrStandArt } from '../../shared/src/model';
import { PAKET_TEXT } from '../../shared/src/pakete';
import { erkenneSprache, istTextsprache, spracheZuInfo } from '../../shared/src/textsprache';
import type { Dateispeicher } from './dateispeicher';
import type { Einstellungen } from './einstellungen';
import { Fachfehler } from './fehler';
import { protokoll } from './protokoll';
import type { OcrErgebnis, Repo } from './repo';
import { INFO_TEXTEBENE, infoWartet } from '../../shared/src/volltext';

/**
 * Volltext (#45, #458, #459).
 *
 * - PDFs: Der Kern liest die Textebene (pdftotext aus poppler) – sofort, ohne Texterkennung.
 * - Scans und Bilder (JPEG, PNG) erkennt ein Paket mit der Schnittstelle dms:texterkennung (z. B. „Texterkennung“
 *   aus dem Katalog). Seit #459 steckt keine Texterkennung (Tesseract) mehr im Image.
 * - Eine Warteschlange in der Datenbank (ocr_stand); die Arbeit läuft im Hintergrund. Nach einem Neustart geht es
 *   weiter. Gleiche Datei schon gelesen? Dann wird der Text übernommen.
 * - Dokumente ohne Text (und bei „neu“ alle) stehen auf „wartet auf Texterkennung“ (Stand paket), bis das Paket den
 *   Volltext schreibt – bzw. bis eins installiert ist. Jedes Ergebnis geht über `nachher` an die Pakete (Ereignis
 *   volltext.fertig, auch ohne Text).
 * - Sprache (#395, #400): die erkannte Sprache des Texts steht am Ende des Hinweises und als eigenes Feld.
 */

const log = protokoll.modul('texterkennung');

/** Dateitypen, für die das DMS einen Volltext erzeugt (Textebene bzw. Texterkennung durch das Paket). */
export const DATEITYPEN: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG-Bild',
  'image/png': 'PNG-Bild',
};
/** Höchstens so viele Seiten liest der Kern aus der Textebene (pdftotext ist schnell). */
export const MAX_SEITEN = 1000;
/** Größere Dateien bekommen keinen Volltext (MB). */
export const MAX_MB = 100;

/**
 * Einstellungen (#45): seit #459 nur noch, ob überhaupt Volltext erzeugt wird und wie viele Dokumente gleichzeitig.
 * Was die Texterkennung tut (Sprache, Seiten, Dateitypen), stellt man beim Paket ein. Gespeicherte Werte aus der Zeit
 * der eingebauten Texterkennung (sprachen, typen …) werden beim Lesen übergangen.
 */
export interface OcrEinstellungen {
  /** Volltext überhaupt erzeugen (aus: neue Dokumente bleiben in der Warteschlange). */
  aktiv: boolean;
  /** Gleichzeitige Aufträge (1–4). */
  auftraege: number;
}

export const OCR_STANDARD: OcrEinstellungen = { aktiv: true, auftraege: 1 };

export function bereinigeOcr(e: unknown, alt: OcrEinstellungen = OCR_STANDARD): OcrEinstellungen {
  const x = (e ?? {}) as Record<string, unknown>;
  let auftraege = alt.auftraege;
  if (x.auftraege !== undefined) {
    const n = Number(x.auftraege);
    if (!Number.isInteger(n) || n < 1 || n > 4) throw new Fachfehler(422, 'Gleichzeitige Aufträge: eine ganze Zahl von 1 bis 4.');
    auftraege = n;
  }
  return { aktiv: x.aktiv === undefined ? alt.aktiv : x.aktiv === true, auftraege };
}

/** Gespeicherte Einstellungen lesen – auch solche aus der Zeit der eingebauten Texterkennung (#459). */
export function ocrAusGespeichert(e: unknown): OcrEinstellungen {
  const x = (e ?? {}) as Record<string, unknown>;
  const n = Number(x.auftraege);
  return { aktiv: x.aktiv !== false, auftraege: Number.isInteger(n) && n >= 1 && n <= 4 ? n : OCR_STANDARD.auftraege };
}

/* ---------- Werkzeuge ---------- */

interface Lauf { stdout: string; stderr: string }
function starte(cmd: string, args: string[], ms: number, signal?: AbortSignal): Promise<Lauf> {
  return new Promise((ok, fehler) => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', signal }, (e, stdout, stderr) => {
      if (e) {
        const f = e as NodeJS.ErrnoException & { killed?: boolean };
        if (signal?.aborted) { fehler(new Error('abgebrochen')); return; }
        fehler(new Error(f.code === 'ENOENT' ? `${cmd} ist nicht installiert.` : f.killed ? `${cmd} brauchte zu lange (über ${Math.round(ms / 1000)} s).` : (stderr || f.message).trim().split('\n').slice(-2).join(' ')));
      } else ok({ stdout, stderr });
    });
  });
}

/** Was der Kern für den Volltext braucht: poppler (pdftotext für die Textebene, pdftoppm für Seitenbilder). */
export interface Werkzeuge {
  pdftotext: boolean;
  pdftoppm: boolean;
}

/** Was ist installiert? (Für die Werkbank.) */
export async function pruefeWerkzeuge(): Promise<Werkzeuge> {
  const da = (cmd: string) => starte(cmd, ['-v'], 10_000).then(() => true, (e: Error) => !/nicht installiert/.test(e.message));
  return { pdftotext: await da('pdftotext'), pdftoppm: await da('pdftoppm') };
}

/**
 * Text eines Dokuments (Datei liegt unter pfad): bei PDFs die Textebene. `ohneText` (#458): Seiten (ab 1) ohne
 * nennenswerten Text – die erkennt das Paket. Bilder haben keine Textebene: alle Seiten ohne Text.
 */
export type Engine = (pfad: string, mime: string, o: { maxSeiten: number; werkzeuge: Werkzeuge; signal?: AbortSignal }) => Promise<{ text: string; seiten: number; info: string; ohneText?: number[] }>;

const sauber = (t: string) => t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
/** Seite mit nennenswertem Text (sonst: gescannt). */
export const hatText = (t: string) => t.replace(/\s/g, '').length >= 20;

/** Die Textebene mit pdftotext (#459: ohne Texterkennung im Kern). */
export const textebeneEngine: Engine = async (pfad, mime, o) => {
  if (mime !== 'application/pdf') return { text: '', seiten: 1, info: 'Bild ohne Textebene', ohneText: [1] };
  if (!o.werkzeuge.pdftotext) throw new Error('pdftotext (poppler) ist nicht installiert.');
  const info = await starte('pdfinfo', [pfad], 30_000, o.signal).then((r) => r.stdout, () => '');
  const gesamt = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 1);
  const seiten = Math.min(gesamt, o.maxSeiten);
  // Ganze Textebene auf einmal; Seiten sind durch Seitenvorschub (\f) getrennt.
  const ebene = (await starte('pdftotext', ['-f', '1', '-l', String(seiten), '-layout', '-enc', 'UTF-8', pfad, '-'], 120_000, o.signal)).stdout.split('\f');
  const texte: string[] = [];
  const ohneText: number[] = [];
  for (let i = 0; i < seiten; i++) {
    const t = ebene[i] ?? '';
    if (!hatText(t)) ohneText.push(i + 1);
    texte.push(t);
  }
  const gekuerzt = gesamt > seiten ? ` – nur die ersten ${seiten} von ${gesamt} Seiten` : '';
  return { text: sauber(texte.join('\n\n')), seiten, info: INFO_TEXTEBENE + gekuerzt, ohneText };
};

/* ---------- Warteschlange ---------- */

const alsBuffer = async (x: Readable | Buffer): Promise<Buffer> => {
  if (Buffer.isBuffer(x)) return x;
  const teile: Buffer[] = [];
  for await (const c of x) teile.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(teile);
};

/** Das Paket, das die Texterkennung übernimmt (#458, Schnittstelle dms:texterkennung). */
export interface TexterkennungPaket { id: string; name: string; version: string; sprachen?: string[] }

/** Was der Kern nach seinem Schritt an die Pakete meldet (#458). */
export interface KernErgebnis {
  /** Nennenswerter Text gefunden (Textebene bzw. eingebaute Texterkennung)? */
  text: boolean;
  /** „Volltext neu erzeugen“ bzw. „erneut“ am Dokument: das Paket soll auch dann neu erkennen, wenn es Text gibt. */
  neu: boolean;
  /** Gemischte PDFs (#458): Seiten ohne Textebene (ab 1) – das Paket erkennt nur diese und hängt sie an. */
  seitenOhneText?: number[];
}

export class Texterkennung {
  private laufend = 0;
  /** Laufende Aufträge je Dokument, damit Administratoren sie abbrechen können (#61). */
  private laeufe = new Map<string, AbortController>();
  private werkzeuge?: Promise<Werkzeuge>;
  private aus = false;
  /** Dokumente in der Warteschlange, die ausdrücklich neu erkannt werden sollen (#458; nur im Speicher). */
  private neuMarken = new Set<string>();
  /** Nach jedem Ergebnis (#338, #458: Ereignis für Pakete – auch ohne Text). */
  nachher: ((d: Dokument, e: OcrErgebnis, k: KernErgebnis) => void) | null = null;
  /** Im aktiven Wartungsmodus (#102) keine neuen Aufträge; danach anstossen(). */
  pause: () => boolean = () => false;
  /** Das installierte Paket für die Texterkennung (#458); null = keins. */
  paket: () => Promise<TexterkennungPaket | null> = async () => null;

  constructor(
    private repo: Repo,
    private dateien: Dateispeicher,
    private einstellungen?: Einstellungen,
    private engine: Engine = textebeneEngine,
    private pruefe: () => Promise<Werkzeuge> = pruefeWerkzeuge,
  ) {}

  async optionen(): Promise<OcrEinstellungen> {
    const e = this.einstellungen ? await this.einstellungen.lies('ocr') : null;
    return e ? ocrAusGespeichert(e) : OCR_STANDARD;
  }

  async speichere(e: unknown): Promise<OcrEinstellungen> {
    if (!this.einstellungen) throw new Fachfehler(404, 'Die Texterkennung ist nicht eingerichtet.');
    const neu = bereinigeOcr(e, await this.optionen());
    await this.einstellungen.schreibe('ocr', neu);
    log.info('Einstellungen des Volltexts geändert', { aktiv: neu.aktiv, auftraege: neu.auftraege });
    this.anstossen();
    return neu;
  }

  werkzeugeLaden(neu = false) {
    if (neu || !this.werkzeuge) this.werkzeuge = this.pruefe();
    return this.werkzeuge;
  }

  /** Beim Start: Unterbrochenes wieder einreihen und loslegen. */
  async start() {
    const n = await this.repo.ocrZurueckstellen();
    if (n) log.info('Unterbrochene Texterkennung wird fortgesetzt', { dokumente: n });
    const w = await this.werkzeugeLaden();
    if (!w.pdftotext) log.warn('poppler (pdftotext) fehlt – PDFs bekommen keinen Volltext.');
    // Seit #459 keine Texterkennung im Image: Scans und Bilder erkennt ein Paket.
    const p = await this.paket().catch(() => null);
    log.info(p ? `Volltext bereit: Textebene von PDFs, Texterkennung durch Paket ${p.name} ${p.version}` : 'Volltext bereit: Textebene von PDFs – kein Paket für die Texterkennung installiert, Scans und Bilder bleiben ohne Text (Werkbank → Pakete → Texterkennung).');
    this.anstossen();
  }

  /** Beenden: keine neuen Aufträge mehr annehmen. */
  stop() { this.aus = true; }

  /** Freie Aufträge mit wartenden Dokumenten füllen. */
  anstossen() {
    if (this.aus) return;
    void this.pumpe().catch((e) => log.error('Texterkennung gestört', { fehler: (e as Error).message }));
  }

  private async pumpe() {
    const o = await this.optionen();
    if (!o.aktiv || this.pause()) return;
    while (!this.aus && this.laufend < o.auftraege) {
      // Platz vor dem Warten reservieren, sonst nehmen sich zwei Durchläufe zu viele Aufträge.
      this.laufend++;
      const d = await this.repo.ocrNaechster().catch((e) => { this.laufend--; throw e; });
      if (!d) { this.laufend--; return; }
      void this.verarbeite(d).finally(() => { this.laufend--; this.anstossen(); });
    }
  }

  /**
   * Sofort statt über die Warteschlange (#458, Auftrag „Volltext neu erzeugen“): dieselbe Arbeit wie für ein neues
   * Dokument, danach das Ereignis an die Pakete. Wartet, bis der Kern fertig ist (nicht auf das Paket).
   */
  async jetzt(id: string, opt: { neu: boolean; signal?: AbortSignal }): Promise<void> {
    const d = await this.repo.holeDokument(id);
    if (!d || d.ocr?.stand === 'laeuft') return;
    await this.repo.ocrSetze(id, { stand: 'laeuft', info: d.ocr?.info ?? null, seiten: d.ocr?.seiten ?? null });
    const abbruch = () => this.laeufe.get(id)?.abort();
    opt.signal?.addEventListener('abort', abbruch, { once: true });
    try { await this.verarbeite(d, opt.neu); } finally { opt.signal?.removeEventListener('abort', abbruch); }
  }

  /** Ein Dokument: auslassen, Text übernehmen oder erkennen. */
  private async verarbeite(d: Dokument, neu = false) {
    const start = Date.now();
    let e: OcrErgebnis;
    const abbruch = new AbortController();
    this.laeufe.set(d.id, abbruch);
    if (this.neuMarken.delete(d.id)) neu = true;
    try {
      e = await this.ergebnis(d, abbruch.signal, neu);
    } catch (f) {
      const m = (f as Error).message;
      e = abbruch.signal.aborted ? { stand: 'ausgelassen', info: 'Vom Administrator abgebrochen.', text: null }
        // Ein erneuter Versuch ändert nichts: als ausgelassen mit klarem Grund (#61).
        : /password|passwort|encrypt/i.test(m) ? { stand: 'ausgelassen', info: 'Das PDF ist mit einem Passwort geschützt.', text: null }
        : { stand: 'fehler', info: m.slice(0, 500) };
    } finally { this.laeufe.delete(d.id); }
    // Hat inzwischen ein Paket den Volltext geschrieben (#338), bleibt der stehen – außer bei „neu“ (#458).
    const jetzt = await this.repo.holeDokument(d.id).catch(() => undefined);
    if (!jetzt) return;
    if (!neu && jetzt.ocr?.stand === 'fertig' && jetzt.ocr.info?.startsWith(PAKET_TEXT)) { log.info('Texterkennung verworfen: Volltext kam schon von einem Paket', { dokument: d.name, id: d.id }); return; }
    // Seiten ohne Text (#458) gehören nicht ins Repo, nur ins Ereignis.
    const ohneText = (e as OcrErgebnis & { ohneText?: number[] }).ohneText;
    delete (e as OcrErgebnis & { ohneText?: number[] }).ohneText;
    try { await this.repo.ocrSetze(d.id, e); } catch (f) { log.error('Ergebnis der Texterkennung nicht gespeichert', { dokument: d.name, fehler: (f as Error).message }); return; }
    const daten = { dokument: d.name, id: d.id, stand: e.stand, seiten: e.seiten ?? undefined, ms: Date.now() - start, info: e.info ?? undefined };
    if (e.stand === 'fehler') log.warn('Texterkennung fehlgeschlagen', daten); else if (e.stand === 'ausgelassen') log.info('Texterkennung ausgelassen', daten);
    else if (e.stand === 'paket') log.info('Textebene gelesen, Texterkennung durch Paket folgt', daten); else log.info('Texterkennung abgeschlossen', daten);
    // Vom Administrator abgebrochen: kein Ereignis (sonst finge das Paket gleich wieder an).
    if (abbruch.signal.aborted) return;
    // Gemischt nur, wenn es auch Text gibt; bei text: false erkennt das Paket ohnehin alle Seiten.
    const gemischt = e.stand === 'paket' && !!e.text && hatText(e.text) && ohneText?.length ? { seitenOhneText: ohneText } : {};
    try { this.nachher?.(jetzt, e, { text: !!e.text && hatText(e.text), neu, ...gemischt }); } catch { /* nur Benachrichtigung */ }
  }

  private async ergebnis(d: Dokument, signal?: AbortSignal, neu = false): Promise<OcrErgebnis> {
    if (!DATEITYPEN[d.mime]) return { stand: 'ausgelassen', info: `Dateityp ${d.mime} bekommt keinen Volltext.`, text: null };
    if (d.groesse > MAX_MB * 1024 * 1024) return { stand: 'ausgelassen', info: `Größer als ${MAX_MB} MB.`, text: null };
    // Der Kern liest nur die Textebene (#458, #459); Scans und Bilder erkennt das Paket – ist keins installiert,
    // wartet das Dokument, bis eins kommt.
    return this.nurTextebene(d, await this.paket().catch(() => null), neu, signal);
  }

  /** Datei lesen: Textebene (poppler). */
  private async lese(d: Dokument, signal?: AbortSignal): Promise<OcrErgebnis & { ohneText?: number[] }> {
    const dir = await mkdtemp(join(tmpdir(), 'dms-ocr-'));
    try {
      const pfad = join(dir, 'datei');
      await writeFile(pfad, await alsBuffer(await this.dateien.lies(d.sha256)));
      if (signal?.aborted) throw new Error('abgebrochen');
      const r = await this.engine(pfad, d.mime, { maxSeiten: MAX_SEITEN, werkzeuge: await this.werkzeugeLaden(), signal });
      // Erkannte Sprache am Ende des Hinweises (#395) – für Anzeige und Statistik.
      const sprache = erkenneSprache(r.text);
      // Sprache als eigenes Feld (#400): Die Volltextsuche nimmt die Wortstämme dieser Sprache.
      return { stand: 'fertig', text: r.text, seiten: r.seiten, info: r.info + (sprache ? spracheZuInfo(sprache) : ''), sprache: sprache && istTextsprache(sprache.sprache) ? sprache.sprache : null, ohneText: r.ohneText ?? [] };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }

  /**
   * PDFs nur über die Textebene (#458). Ohne Text – oder bei „neu“ – wartet das Dokument auf das Paket für die
   * Texterkennung (Stand paket; ohne Paket „kein Paket installiert“); vorhandener Text bleibt so lange stehen, damit
   * die Suche ihn findet. Bilder haben keine Textebene: Sie warten gleich auf das Paket.
   */
  private async nurTextebene(d: Dokument, paket: TexterkennungPaket | null, neu: boolean, signal?: AbortSignal): Promise<OcrErgebnis> {
    const wartet: OcrErgebnis = { stand: 'paket', info: infoWartet(paket), seiten: d.ocr?.seiten ?? null };
    // Gleiche Datei schon mit Text (auch von der früheren eingebauten Texterkennung oder einem Paket): übernehmen.
    const vorhanden = neu ? undefined : await this.repo.ocrVonSha(d.sha256, d.id);
    if (vorhanden && hatText(vorhanden.text)) return { stand: 'fertig', text: vorhanden.text, seiten: vorhanden.seiten, info: `übernommen (gleicher Inhalt): ${vorhanden.info ?? ''}`.trim(), sprache: vorhanden.sprache ?? null };
    if (d.mime !== 'application/pdf') return wartet;
    const r = await this.lese(d, signal);
    // Gemischt (Text und gescannte Seiten): wartet auch auf das Paket – es erkennt nur die Seiten ohne Text. „Neu“ ohne
    // Paket ändert nichts: Der Text aus dem PDF gilt.
    const ohne = (r as OcrErgebnis & { ohneText?: number[] }).ohneText ?? [];
    if (r.text && hatText(r.text) && !ohne.length && (!neu || !paket)) return r;
    return { ...wartet, seiten: r.seiten ?? null, ...(r.text && hatText(r.text) ? { text: r.text, sprache: r.sprache, ohneText: ohne } : {}) } as OcrErgebnis;
  }

  /**
   * Sofort und ohne Warteschlange (#391, „Aus Dokument ausfüllen“): Text einer Datei, die (noch) nicht
   * gespeichert ist – höchstens 5 Seiten. Seit #459 nur die Textebene von PDFs: Fotos und Scans erkennt allein das
   * Paket, und das erst nach dem Speichern.
   */
  async erkenneSofort(inhalt: Buffer, mime: string): Promise<{ text: string; info: string }> {
    if (mime !== 'application/pdf') throw new Fachfehler(422, 'Fotos und Bilder liest das DMS nicht sofort – ihren Text erkennt das Paket Texterkennung nach dem Speichern.');
    const dir = await mkdtemp(join(tmpdir(), 'dms-sofort-'));
    try {
      const pfad = join(dir, 'datei');
      await writeFile(pfad, inhalt);
      const r = await this.engine(pfad, mime, { maxSeiten: 5, werkzeuge: await this.werkzeugeLaden() });
      return { text: r.text, info: r.info };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }

  /** Für die Werkbank: Stand der Warteschlange und der Werkzeuge. */
  /** Liste der Aufträge eines Stands für die Werkbank (#61). */
  auftraege(q: { stand?: unknown; von?: unknown; anzahl?: unknown }) {
    const stand = (typeof q.stand === 'string' && q.stand in OCR_STAENDE ? q.stand : 'fehler') as OcrStandArt;
    const von = Math.max(0, Math.floor(Number(q.von) || 0));
    const anzahl = Math.min(200, Math.max(1, Math.floor(Number(q.anzahl) || 100)));
    return this.repo.ocrAuftraege({ stand, von, anzahl });
  }

  /** Ein Dokument ausdrücklich neu erkennen lassen (#458): in die Warteschlange, das Paket bekommt `neu`. */
  async neuErkennen(id: string) {
    this.laeufe.get(id)?.abort();
    this.neuMarken.add(id);
    await this.repo.ocrEinreihen([id]);
    this.anstossen();
  }

  /** Neu starten: zurück in die Warteschlange (#61); bei „fertig“ ausdrücklich neu (#458). */
  async neuStarten(ids: unknown, von: string) {
    const liste = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    if (!liste.length) throw new Fachfehler(422, 'Keine Dokumente gewählt.');
    for (const id of liste) this.laeufe.get(id)?.abort();
    for (const id of liste) this.neuMarken.add(id);
    // Wartet ein Dokument auf das Paket, kommt sein Ereignis gleich neu – das alte fällt weg.
    await this.repo.loescheOffeneEreignisse('volltext.fertig', liste).catch(() => 0);
    await this.repo.ocrEinreihen(liste);
    log.info('Texterkennung neu gestartet', { dokumente: liste.length, von });
    this.anstossen();
    return { eingereiht: liste.length };
  }

  /** „Fehler“ insgesamt neu starten. */
  async fehlerNeuStarten(von: string) {
    const ids: string[] = [];
    for (let seite = 0; ; seite += 200) {
      const r = await this.repo.ocrAuftraege({ stand: 'fehler', von: seite, anzahl: 200 });
      ids.push(...r.eintraege.map((e) => e.dokument.id));
      if (r.eintraege.length < 200) break;
    }
    if (!ids.length) return { eingereiht: 0 };
    return this.neuStarten(ids, von);
  }

  /** Abbrechen bzw. aus der Warteschlange nehmen: wartende werden ausgelassen, laufende beendet (#61). */
  async abbrechen(ids: unknown, von: string) {
    const liste = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    if (!liste.length) throw new Fachfehler(422, 'Keine Dokumente gewählt.');
    let n = 0;
    for (const id of liste) {
      const lauf = this.laeufe.get(id);
      if (lauf) { lauf.abort(); n++; continue; }
      const d = await this.repo.holeDokument(id);
      if (d?.ocr?.stand === 'wartet') { await this.repo.ocrSetze(id, { stand: 'ausgelassen', info: 'Vom Administrator abgebrochen.', text: null }); n++; }
      // Wartet es auf das Paket (#458): Ereignis verwerfen, Text aus dem PDF bleibt.
      if (d?.ocr?.stand === 'paket') {
        await this.repo.loescheOffeneEreignisse('volltext.fertig', [id]);
        await this.repo.ocrSetze(id, { stand: 'ausgelassen', info: 'Texterkennung durch Paket vom Administrator abgebrochen.', seiten: d.ocr.seiten ?? null });
        n++;
      }
    }
    log.info('Texterkennung abgebrochen', { dokumente: n, von });
    return { abgebrochen: n };
  }

  /** Nur die Zähler, z. B. für die Übersicht der Werkbank (#68). */
  zaehler() { return this.repo.ocrZaehler(); }

  async status(werkzeugeNeu = false) {
    const werkzeuge = await this.werkzeugeLaden(werkzeugeNeu);
    const einstellungen = await this.optionen();
    return {
      zaehler: await this.repo.ocrZaehler(), laufend: this.laufend, werkzeuge, einstellungen, dateitypen: DATEITYPEN,
      // #458: Paket, das die Texterkennung übernimmt (null = keins installiert).
      paket: await this.paket().catch(() => null),
      // #459: woher der Text der Dokumente kommt; erkannte Sprachen der fertigen Dokumente (#395).
      herkunft: await this.repo.volltextHerkunft(),
      erkannteSprachen: await this.repo.ocrSprachen(),
    };
  }
}
