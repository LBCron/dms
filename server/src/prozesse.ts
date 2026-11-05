/**
 * Mehrere Prozesse für Anfragen (#745): `DMS_PROZESSE` (Vorgabe 1 = wie bisher ein Prozess; `auto` = Kerne − 1,
 * höchstens 4, unter 2 GB Arbeitsspeicher 1).
 *
 * Aufbau mit `node:cluster`:
 * - Der **Hauptprozess** ist schlank (lädt nur diese Datei): Er startet die Prozesse, startet einen abgestürzten neu,
 *   reicht Nachrichten zwischen ihnen weiter und beendet beim Herunterfahren alle. Selbst beantwortet er keine Anfrage;
 *   den Port teilt er den Prozessen zu (Verteilung reihum).
 * - **Prozess 1 ist der Leiter.** Er startet zuerst – mit der Startseite „Ablago startet …“ (#802), den Migrationen
 *   und den einmaligen Arbeiten beim Start – und erledigt alle **Hintergrundarbeit**: Zeitpläne, Texterkennung,
 *   Vorschaubilder, Ereignisse und Automatisierungen, Paket-Läufer (genau einmal, er hält die API-Schlüssel der
 *   Pakete), Eingangsordner, Postfächer, Sicherung und Wiederherstellung. Daneben beantwortet er Anfragen wie alle.
 * - Erst wenn der Leiter bereit ist, starten die **weiteren Prozesse**: ohne Startseite und ohne Migrationen, nur für
 *   Anfragen. Was dabei Hintergrundarbeit anstößt, geht als Meldung oder Aufruf an den Leiter ({@link Verbund}).
 *
 * Zustand zwischen Anfragen steht seit #744 in der Datenbank; Anmeldungen überstehen den Neustart eines Prozesses.
 * Mit einem Prozess (Vorgabe) gibt es keinen Hauptprozess: {@link einzeln} erledigt alles im eigenen Prozess.
 */
import cluster, { type Worker } from 'node:cluster';
import { randomBytes } from 'node:crypto';
import { availableParallelism, totalmem } from 'node:os';
import { Fachfehler } from './fehler';
import { protokoll } from './protokoll';
import { dateiLeser, liesCgroup, type Leser } from './systemlast';

export const PROZESSE_MAX = 16;
/** Höchstens so viele empfiehlt Ablago (und nimmt `auto`). */
export const PROZESSE_EMPFOHLEN_MAX = 4;
/** Darunter (Arbeitsspeicher des Containers bzw. Rechners) empfiehlt Ablago einen Prozess. */
export const SPEICHER_FUER_MEHRERE = 2 * 1024 ** 3;

export interface ProzessEinstellung {
  anzahl: number;
  quelle: 'vorgabe' | 'umgebung' | 'auto';
  /** Nutzbare Kerne und Arbeitsspeicher (Grenze des Containers, sonst des Rechners) – Grundlage der Empfehlung. */
  kerne: number;
  speicher: number | null;
  /** Ungültiger Wert von DMS_PROZESSE (dann gilt 1); den Hinweis schreibt der Leiter ins Protokoll. */
  ungueltig?: string;
}

/** Empfehlung: Kerne − 1 (einer bleibt für PostgreSQL und das System), höchstens 4; bei wenig Arbeitsspeicher 1. */
export function empfohleneProzesse(kerne: number, speicher: number | null): number {
  if (speicher !== null && speicher < SPEICHER_FUER_MEHRERE) return 1;
  return Math.max(1, Math.min(PROZESSE_EMPFOHLEN_MAX, Math.floor(kerne) - 1));
}

export function prozesseAus(env: Record<string, string | undefined>, lies: Leser = dateiLeser): ProzessEinstellung {
  const c = liesCgroup(lies);
  const kerne = Math.max(1, Math.round((c.kerne ?? availableParallelism()) * 100) / 100);
  const speicher = c.grenze ?? totalmem();
  const roh = env.DMS_PROZESSE?.trim();
  if (!roh) return { anzahl: 1, quelle: 'vorgabe', kerne, speicher };
  if (roh.toLowerCase() === 'auto') return { anzahl: empfohleneProzesse(kerne, speicher), quelle: 'auto', kerne, speicher };
  const n = Number(roh);
  if (!Number.isInteger(n) || n < 1 || n > PROZESSE_MAX) {
    return { anzahl: 1, quelle: 'vorgabe', kerne, speicher, ungueltig: roh };
  }
  return { anzahl: n, quelle: 'umgebung', kerne, speicher };
}

/** Ein Prozess von Ablago, wie der Hauptprozess ihn kennt. */
export interface ProzessInfo { nr: number; pid: number; leiter: boolean }

/** Bearbeitet einen Aufruf; `teil` schickt Zwischenstände (z. B. Teile einer Antwort) an den Aufrufer. */
export type Bediener = (args: unknown[], teil: (wert: unknown) => void) => unknown;

/**
 * Verbindung zu den anderen Prozessen. Mit einem Prozess ({@link einzeln}) bleibt alles im eigenen.
 * - `rufe`: Aufruf beim Leiter mit Ergebnis (Fehler kommen als Fachfehler mit Status zurück).
 * - `melde`: Meldung ohne Antwort an den Leiter, an alle (auch an sich selbst) oder an alle anderen.
 * - `frageAlle`: denselben Aufruf in jedem Prozess (z. B. Arbeitsspeicher und Wartezeit für den Systemzustand).
 */
export interface Verbund {
  /** Mehr als ein Prozess (mit Hauptprozess)? */
  readonly mehrere: boolean;
  readonly anzahl: number;
  readonly nr: number;
  readonly leiter: boolean;
  /** Erster Start des Leiters: Startseite, Migrationen und Arbeiten beim Start (nach einem Neustart nur ohne Startseite). */
  readonly erster: boolean;
  /** Gemeinsamer Zugangsschlüssel für den Befehl `dms` (#244); null = jeder Prozess erzeugt seinen eigenen. */
  readonly konsole: string | null;
  /** Prozess-Id des Hauptprozesses (null mit einem Prozess). */
  readonly primaer: number | null;
  bediene(name: string, f: Bediener): void;
  rufe<T>(name: string, args?: unknown[], o?: { teil?: (wert: unknown) => void; ms?: number }): Promise<T>;
  melde(name: string, daten?: unknown, an?: 'leiter' | 'alle' | 'andere'): void;
  hoere(name: string, f: (daten: unknown) => void): void;
  frageAlle<T>(name: string, ms?: number): Promise<Array<ProzessInfo & { wert: T | null }>>;
  prozesse(): ProzessInfo[];
  /** Dieser Prozess lauscht am Port. */
  bereit(): void;
  /** Ganz Ablago beenden (z. B. Neustart nach einer Wiederherstellung). false: nur ein Prozess – der Aufrufer beendet sich selbst. */
  beendeAlle(grund: string): boolean;
}

const KANAL = 'dms-prozesse';
/** Wartezeit eines Aufrufs beim Leiter, wenn der Aufrufer keine nennt. */
export const RUF_MS = 10 * 60_000;

/**
 * Fehler über Prozessgrenzen. `schluessel`: Text aus den Sprachdateien (`meldungen.prozesse.*`) – der Hauptprozess lädt
 * keine Sprachdateien, er schickt nur den Schlüssel; übersetzt wird beim Empfänger.
 */
interface Fehlerbild { status?: number; message: string; details?: unknown; schluessel?: string }
type Uebersetzer = (schluessel: string) => string;
const alsFehlerbild = (e: unknown): Fehlerbild => (e instanceof Fachfehler ? { status: e.status, message: e.message, details: e.details } : { message: e instanceof Error ? e.message : String(e) });
const ausFehlerbild = (f: Fehlerbild, t: Uebersetzer) => {
  const text = f.schluessel ? t(f.schluessel) : f.message;
  return f.status ? new Fachfehler(f.status, text, f.details) : new Error(text);
};

/** Gemeinsam für beide Arten: Bediener und Hörer im eigenen Prozess. */
abstract class Grund {
  protected bediener = new Map<string, Bediener>();
  protected hoerer = new Map<string, Array<(d: unknown) => void>>();
  bediene(name: string, f: Bediener) { this.bediener.set(name, f); }
  hoere(name: string, f: (d: unknown) => void) { this.hoerer.set(name, [...(this.hoerer.get(name) ?? []), f]); }
  protected verteile(name: string, daten: unknown) {
    for (const f of this.hoerer.get(name) ?? []) {
      try { f(daten); } catch (e) { protokoll.modul('system').warn('Meldung zwischen Prozessen nicht verarbeitet', { meldung: name, fehler: (e as Error).message }); }
    }
  }
  protected async lokal(name: string, args: unknown[], teil: (w: unknown) => void): Promise<unknown> {
    const f = this.bediener.get(name);
    if (!f) throw new Error(`Unbekannter Aufruf zwischen Prozessen: ${name}`);
    return f(args, teil);
  }
}

/** Ein Prozess (Vorgabe): Aufrufe und Meldungen bleiben im eigenen Prozess. */
class Einzeln extends Grund implements Verbund {
  readonly mehrere = false;
  readonly anzahl = 1;
  readonly nr = 1;
  readonly leiter = true;
  readonly erster = true;
  readonly konsole = null;
  readonly primaer = null;
  async rufe<T>(name: string, args: unknown[] = [], o: { teil?: (w: unknown) => void } = {}): Promise<T> { return await this.lokal(name, args, o.teil ?? (() => {})) as T; }
  melde(name: string, daten?: unknown, an: 'leiter' | 'alle' | 'andere' = 'leiter') { if (an !== 'andere') queueMicrotask(() => this.verteile(name, daten)); }
  async frageAlle<T>(name: string): Promise<Array<ProzessInfo & { wert: T | null }>> {
    const wert = this.bediener.has(name) ? await this.lokal(name, [], () => {}).catch(() => null) as T : null;
    return [{ nr: 1, pid: process.pid, leiter: true, wert }];
  }
  prozesse(): ProzessInfo[] { return [{ nr: 1, pid: process.pid, leiter: true }]; }
  bereit() {}
  beendeAlle() { return false; }
}

/** Ein Prozess für alle Fälle ohne Hauptprozess (Tests, `DMS_PROZESSE=1`). */
export const einzeln = (): Verbund => new Einzeln();

interface Rolle { nr: number; leiter: boolean; erster: boolean; konsole: string; anzahl: number; primaer: number }
type Nachricht = { dms: typeof KANAL; art: string; [k: string]: unknown };

/** Ein Prozess unter dem Hauptprozess (`cluster.isWorker`). */
class Teil extends Grund implements Verbund {
  readonly mehrere = true;
  readonly anzahl: number;
  readonly nr: number;
  readonly leiter: boolean;
  readonly erster: boolean;
  readonly konsole: string;
  readonly primaer: number;
  private liste: ProzessInfo[] = [];
  private offen = new Map<number, { ok: (w: unknown) => void; nein: (e: Error) => void; teil?: (w: unknown) => void; uhr: NodeJS.Timeout }>();
  private naechste = 1;

  constructor(r: Rolle, private t: Uebersetzer) {
    super();
    this.nr = r.nr; this.leiter = r.leiter; this.erster = r.erster; this.konsole = r.konsole; this.anzahl = r.anzahl; this.primaer = r.primaer;
    this.liste = [{ nr: r.nr, pid: process.pid, leiter: r.leiter }];
    process.on('message', (m: Nachricht) => { if (m?.dms === KANAL) void this.empfange(m); });
    // Ohne Hauptprozess (abgestürzt, beendet) gibt es keine Anfragen mehr: geordnet beenden.
    process.on('disconnect', () => process.kill(process.pid, 'SIGTERM'));
  }

  private sende(m: Record<string, unknown>) { if (process.connected) process.send!({ dms: KANAL, ...m }); }

  private async empfange(m: Nachricht) {
    switch (m.art) {
      case 'rufe': {
        const id = m.id;
        try {
          const wert = await this.lokal(String(m.name), (m.args as unknown[]) ?? [], (w) => this.sende({ art: 'teil', id, wert: w }));
          this.sende({ art: 'antwort', id, ok: true, wert });
        } catch (e) { this.sende({ art: 'antwort', id, ok: false, fehler: alsFehlerbild(e) }); }
        return;
      }
      case 'antwort': {
        const p = this.offen.get(Number(m.id));
        if (!p) return;
        this.offen.delete(Number(m.id));
        clearTimeout(p.uhr);
        if (m.ok) p.ok(m.wert); else p.nein(ausFehlerbild(m.fehler as Fehlerbild, this.t));
        return;
      }
      case 'teil': this.offen.get(Number(m.id))?.teil?.(m.wert); return;
      case 'meldung': this.verteile(String(m.name), m.daten); return;
      case 'prozesse': this.liste = m.liste as ProzessInfo[]; return;
    }
  }

  private warte<T>(m: Record<string, unknown>, ms: number, teil?: (w: unknown) => void): Promise<T> {
    const id = this.naechste++;
    return new Promise<T>((ok, nein) => {
      const uhr = setTimeout(() => { if (this.offen.delete(id)) nein(new Fachfehler(504, this.t('meldungen.prozesse.keine-antwort'))); }, ms);
      uhr.unref?.();
      this.offen.set(id, { ok: ok as (w: unknown) => void, nein, teil, uhr });
      this.sende({ ...m, id });
    });
  }

  async rufe<T>(name: string, args: unknown[] = [], o: { teil?: (w: unknown) => void; ms?: number } = {}): Promise<T> {
    if (this.leiter) return await this.lokal(name, args, o.teil ?? (() => {})) as T;
    return this.warte<T>({ art: 'rufe', name, args }, o.ms ?? RUF_MS, o.teil);
  }

  melde(name: string, daten?: unknown, an: 'leiter' | 'alle' | 'andere' = 'leiter') {
    if (an === 'leiter' && this.leiter) { queueMicrotask(() => this.verteile(name, daten)); return; }
    this.sende({ art: 'melde', an, name, daten });
  }

  frageAlle<T>(name: string, ms = 2000): Promise<Array<ProzessInfo & { wert: T | null }>> {
    return this.warte({ art: 'frageAlle', name, ms }, ms + 1000);
  }

  prozesse() { return this.liste; }
  bereit() { this.sende({ art: 'bereit' }); }
  beendeAlle(grund: string) { this.sende({ art: 'beenden', grund }); return true; }
}

/** Verbund für diesen Prozess: unter einem Hauptprozess erst die Rolle erfragen, sonst {@link einzeln}. */
export async function verbundFuerProzess(): Promise<Verbund> {
  if (!cluster.isWorker) return einzeln();
  // Sprachdateien erst hier: Der Hauptprozess lädt sie nie.
  const { t } = await import('./sprache');
  const uebersetze: Uebersetzer = (k) => t(k as never);
  return new Promise((ok) => {
    const f = (m: Nachricht) => {
      if (m?.dms !== KANAL || m.art !== 'rolle') return;
      process.off('message', f);
      ok(new Teil(m as unknown as Rolle, uebersetze));
    };
    process.on('message', f);
    process.send!({ dms: KANAL, art: 'hallo' });
  });
}

/* ---------- Hauptprozess ---------- */

/** Neustart eines abgestürzten Prozesses: 1 s, dann doppelt so lange bis höchstens 60 s; nach 5 Minuten Laufzeit wieder 1 s. */
export const neustartWarten = (folge: number) => Math.min(60_000, 1000 * 2 ** folge);
const STABIL_MS = 5 * 60_000;
/** So lange warten die Prozesse beim Beenden, bevor der Hauptprozess sie hart beendet. */
const BEENDEN_MS = 20_000;

/**
 * Der Hauptprozess: startet den Leiter, nach dessen „bereit“ die übrigen; reicht Aufrufe und Meldungen weiter, startet
 * Abgestürzte neu (der Leiter vor seinem ersten „bereit“ nicht – dann endet Ablago wie bisher mit seinem Code, und
 * Docker startet den Container neu). Kehrt nicht zurück.
 */
export function leite(e: ProzessEinstellung): Promise<never> {
  const log = protokoll.modul('system');
  cluster.setupPrimary({ serialization: 'advanced' });
  const konsole = randomBytes(32).toString('base64url');
  const plaetze = new Map<number, { w: Worker; bereit: boolean; seit: number }>();
  const folgen = new Map<number, number>();
  /** Weitergereichte Aufrufe: Nummer beim Ziel → Absender und seine Nummer. */
  const weiter = new Map<number, { w: Worker; id: unknown }>();
  /** Sammelfragen an alle: Nummer beim Ziel → Sammlung und Prozess. */
  const fragen = new Map<number, { s: Sammlung; info: ProzessInfo }>();
  interface Sammlung { w: Worker; id: unknown; offen: Set<number>; werte: Array<ProzessInfo & { wert: unknown }>; uhr: NodeJS.Timeout }
  let naechste = 1;
  let leiterWarBereit = false;
  let ende: number | null = null;

  const sende = (w: Worker, m: Record<string, unknown>) => { if (w.isConnected()) w.send({ dms: KANAL, ...m }); };
  const liste = (): ProzessInfo[] => [...plaetze].filter(([, p]) => p.w.process.pid).map(([nr, p]) => ({ nr, pid: p.w.process.pid!, leiter: nr === 1 }));
  const verteileListe = () => { const l = liste(); for (const p of plaetze.values()) sende(p.w, { art: 'prozesse', liste: l }); };
  const sammlungFertig = (s: Sammlung, k?: number) => {
    if (k !== undefined) s.offen.delete(k);
    if (s.offen.size) return;
    clearTimeout(s.uhr);
    s.werte.sort((a, b) => a.nr - b.nr);
    sende(s.w, { art: 'antwort', id: s.id, ok: true, wert: s.werte });
  };

  const nachricht = (nr: number, w: Worker, m: Nachricht) => {
    if (m?.dms !== KANAL) return;
    const p = plaetze.get(nr);
    switch (m.art) {
      case 'hallo':
        sende(w, { art: 'rolle', nr, leiter: nr === 1, erster: nr === 1 && !leiterWarBereit, konsole, anzahl: e.anzahl, primaer: process.pid });
        verteileListe();
        return;
      case 'bereit':
        if (p) p.bereit = true;
        log.info(`Prozess ${nr}${nr === 1 ? ' (Leiter)' : ''} ist bereit`, { pid: w.process.pid });
        if (nr === 1 && !leiterWarBereit) {
          leiterWarBereit = true;
          for (let i = 2; i <= e.anzahl; i++) starte(i);
        }
        verteileListe();
        return;
      case 'rufe': {
        const l = plaetze.get(1);
        if (!l?.bereit) { sende(w, { art: 'antwort', id: m.id, ok: false, fehler: { status: 503, message: '', schluessel: 'meldungen.prozesse.leiter-startet' } }); return; }
        const k = naechste++;
        weiter.set(k, { w, id: m.id });
        sende(l.w, { art: 'rufe', id: k, name: m.name, args: m.args });
        return;
      }
      case 'antwort': case 'teil': {
        const k = Number(m.id);
        const f = fragen.get(k);
        if (f) {
          if (m.art === 'teil') return;
          fragen.delete(k);
          f.s.werte.push({ ...f.info, wert: m.ok ? m.wert : null });
          sammlungFertig(f.s, k);
          return;
        }
        const z = weiter.get(k);
        if (!z) return;
        if (m.art === 'antwort') weiter.delete(k);
        sende(z.w, { ...m, id: z.id });
        return;
      }
      case 'melde': {
        const an = m.an === 'alle' || m.an === 'andere' ? m.an : 'leiter';
        for (const [n, x] of plaetze) {
          if ((an === 'leiter' && n !== 1) || (an === 'andere' && x.w === w)) continue;
          sende(x.w, { art: 'meldung', name: m.name, daten: m.daten });
        }
        return;
      }
      case 'frageAlle': {
        const s: Sammlung = { w, id: m.id, offen: new Set(), werte: [], uhr: setTimeout(() => {
          for (const k of s.offen) { const f = fragen.get(k); if (f) { fragen.delete(k); s.werte.push({ ...f.info, wert: null }); } }
          s.offen.clear();
          sammlungFertig(s);
        }, Number(m.ms) || 2000) };
        for (const i of liste()) {
          const x = plaetze.get(i.nr)!;
          if (!x.bereit && x.w !== w) { s.werte.push({ ...i, wert: null }); continue; }
          const k = naechste++;
          fragen.set(k, { s, info: i });
          s.offen.add(k);
          sende(x.w, { art: 'rufe', id: k, name: m.name, args: [] });
        }
        sammlungFertig(s);
        return;
      }
      case 'beenden':
        log.warn(`Ablago wird ganz beendet: ${String(m.grund ?? '')}`);
        beendeAlle(0);
        return;
    }
  };

  const beendet = (nr: number, w: Worker, code: number | null, signal: string | null) => {
    const p = plaetze.get(nr);
    if (p?.w !== w) return;
    plaetze.delete(nr);
    // Was noch auf den beendeten Prozess wartet, bekommt eine Antwort; Fragen von ihm verfallen.
    for (const [k, z] of weiter) {
      if (z.w === w) weiter.delete(k);
      else if (nr === 1) { weiter.delete(k); sende(z.w, { art: 'antwort', id: z.id, ok: false, fehler: { status: 503, message: '', schluessel: 'meldungen.prozesse.leiter-neu' } }); }
    }
    for (const [k, f] of fragen) if (f.info.nr === nr) { fragen.delete(k); f.s.werte.push({ ...f.info, wert: null }); sammlungFertig(f.s, k); }
    if (ende !== null) { if (!plaetze.size) process.exit(ende); return; }
    verteileListe();
    if (nr === 1 && !leiterWarBereit) {
      // Start gescheitert: wie mit einem Prozess beenden – Docker startet den Container neu.
      log.error(`Ablago startet nicht (Prozess 1 beendet: ${signal ?? `Code ${code}`})`);
      process.exit(code ?? 1);
    }
    const folge = Date.now() - p.seit > STABIL_MS ? 0 : (folgen.get(nr) ?? 0);
    folgen.set(nr, folge + 1);
    const ms = neustartWarten(folge);
    // Nur Nummer, Code und Signal – der Grund steht im Protokoll des Prozesses selbst (ohne Geheimnisse).
    log.warn(`Prozess ${nr}${nr === 1 ? ' (Leiter)' : ''} beendet (${signal ?? `Code ${code}`}) – startet in ${ms / 1000} s neu`);
    setTimeout(() => { if (ende === null) starte(nr); }, ms);
  };

  const starte = (nr: number) => {
    const w = cluster.fork();
    plaetze.set(nr, { w, bereit: false, seit: Date.now() });
    w.on('message', (m: Nachricht) => nachricht(nr, w, m));
    w.on('exit', (code, signal) => beendet(nr, w, code, signal));
  };

  const beendeAlle = (code: number) => {
    if (ende !== null) return;
    ende = code;
    if (!plaetze.size) process.exit(code);
    for (const p of plaetze.values()) p.w.process.kill('SIGTERM');
    setTimeout(() => { for (const p of plaetze.values()) p.w.process.kill('SIGKILL'); process.exit(code); }, BEENDEN_MS).unref();
  };
  process.on('SIGTERM', () => beendeAlle(0));
  process.on('SIGINT', () => beendeAlle(0));

  log.info(`Ablago startet mit ${e.anzahl} Prozessen (DMS_PROZESSE${e.quelle === 'auto' ? '=auto' : ''}): Prozess 1 leitet und erledigt die Arbeit im Hintergrund, alle beantworten Anfragen`, { kerne: e.kerne });
  starte(1);
  return new Promise<never>(() => {});
}
