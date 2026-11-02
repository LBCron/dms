/**
 * Überlastschutz (#544): Kommen mehr Anfragen gleichzeitig, als das DMS sinnvoll abarbeiten kann (etwa ein
 * falsch eingestelltes WebDAV-Programm), antwortet es sofort mit 503 und `Retry-After` statt jede Anfrage
 * in eine immer längere Warteschlange zu stellen, bis Programme und Browser aufgeben. So bleiben Antwortzeit
 * und Arbeitsspeicher begrenzt, und das DMS erholt sich von selbst, sobald die Last nachlässt.
 *
 * Gezählt werden Anfragen an `/api/` und `/webdav`, vom Eingang bis die Antwort fertig oder die Verbindung
 * zu ist. Nie abgewiesen werden die Gesundheitsprüfung des Containers und die Messwerte für den Lasttest.
 * Grenze: `DMS_MAX_ANFRAGEN` (Vorgabe 250 – das Zweieinhalbfache der realistischen Obergrenze von 100).
 */
import type { FastifyInstance } from 'fastify';
import { protokoll } from './protokoll';
import { t } from './sprache';

export const MAX_ANFRAGEN_VORGABE = 250;
export const MAX_ANFRAGEN_MIN = 20;
export const MAX_ANFRAGEN_MAX = 10_000;
/** Sekunden bis zum nächsten Versuch (Kopfzeile Retry-After). */
export const WIEDER_IN_S = 5;

const AUSGENOMMEN = new Set(['/api/gesundheit', '/api/werkbank/last']);
const log = protokoll.modul('system');

export interface UeberlastEinstellung { max: number; quelle: 'vorgabe' | 'umgebung'; fehler?: string }

export function maxAnfragenAus(env: Record<string, string | undefined>): UeberlastEinstellung {
  const roh = env.DMS_MAX_ANFRAGEN?.trim();
  if (!roh) return { max: MAX_ANFRAGEN_VORGABE, quelle: 'vorgabe' };
  const n = Number(roh);
  if (!Number.isInteger(n) || n < MAX_ANFRAGEN_MIN || n > MAX_ANFRAGEN_MAX) {
    return { max: MAX_ANFRAGEN_VORGABE, quelle: 'vorgabe', fehler: `DMS_MAX_ANFRAGEN=${roh} ist keine Zahl von ${MAX_ANFRAGEN_MIN} bis ${MAX_ANFRAGEN_MAX} und wird ignoriert.` };
  }
  return { max: n, quelle: 'umgebung' };
}

/** Zählt diese Anfrage mit? */
export function zaehlt(url: string): boolean {
  const pfad = url.split('?')[0];
  return (pfad.startsWith('/api/') || pfad === '/webdav' || pfad.startsWith('/webdav/')) && !AUSGENOMMEN.has(pfad);
}

export class Ueberlastschutz {
  laufend = 0;
  abgewiesen = 0;
  hoechstens = 0;
  private gemeldet = 0;
  private seitMeldung = 0;

  constructor(readonly max: number, readonly quelle: UeberlastEinstellung['quelle'] = 'vorgabe', private uhr: () => number = Date.now) {}

  /** Darf die Anfrage hinein? Wenn ja, zählt sie bis `fertig()`. */
  herein(): boolean {
    if (this.laufend >= this.max) {
      this.abgewiesen++;
      this.melde();
      return false;
    }
    this.laufend++;
    if (this.laufend > this.hoechstens) this.hoechstens = this.laufend;
    return true;
  }

  fertig() { if (this.laufend > 0) this.laufend--; }

  /** Höchstens eine Zeile je Minute im Protokoll. */
  private melde() {
    const jetzt = this.uhr();
    if (jetzt - this.gemeldet < 60_000) { this.seitMeldung++; return; }
    log.warn(`Überlast: ${this.max} Anfragen gleichzeitig – weitere werden mit 503 abgewiesen`, { abgewiesen: this.abgewiesen, seitLetzterMeldung: this.seitMeldung + 1 });
    this.gemeldet = jetzt;
    this.seitMeldung = 0;
  }

  stand() { return { max: this.max, quelle: this.quelle, laufend: this.laufend, hoechstens: this.hoechstens, abgewiesen: this.abgewiesen }; }

  /** Als erster Hook in Fastify einhängen. */
  haengeEin(app: FastifyInstance) {
    app.addHook('onRequest', async (req, reply) => {
      if (!zaehlt(req.url)) return;
      if (!this.herein()) {
        return reply.code(503).header('retry-after', String(WIEDER_IN_S)).header('cache-control', 'no-store')
          .send({ fehler: t('systemzustand.ueberlast.meldung') });
      }
      let zu = false;
      reply.raw.once('close', () => { if (!zu) { zu = true; this.fertig(); } });
    });
  }
}
