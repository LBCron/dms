/**
 * Öffentliche Abrufseite einer Auskunft (#455) – Bausteine ohne Datenbank.
 *
 * Der Link trägt nur einen zufälligen Schlüssel (256 Bit) im Fragment (`/abruf#<schlüssel>`): Der Browser
 * schickt ihn nie von selbst mit, er steht also in keinem Zugriffsprotokoll und in keinem Referer. Die
 * Seite schickt Schlüssel und Abrufcode per POST; stimmt beides, gibt es ein Ticket für genau einen
 * Download (zwei Minuten gültig, nur im Arbeitsspeicher). In der Datenbank liegen nur Hashes.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { CODE_LAENGE, CODE_ZEICHEN } from '../../shared/src/auskunft';

/** Abrufcode aus gut unterscheidbaren Zeichen (ohne 0/O, 1/I), gleichverteilt. */
export function neuerAbrufcode(): string {
  let c = '';
  for (let i = 0; i < CODE_LAENGE; i++) c += CODE_ZEICHEN[randomInt(CODE_ZEICHEN.length)];
  return c;
}

/** Schlüssel eines Abruf-Links: 32 Byte base64url, also genau 43 Zeichen. */
export const SCHLUESSEL_MUSTER = /^[A-Za-z0-9_-]{43}$/;

/** IP fürs Protokoll gekürzt (Datensparsamkeit): IPv4 auf /24, IPv6 auf /48. */
export function kuerzeIp(ip: string | undefined): string {
  const a = (ip ?? '').replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1').trim();
  const f = isIP(a);
  if (f === 4) return a.replace(/\.\d+$/, '.0');
  if (f === 6) {
    const teile = a.split('::')[0].split(':').filter(Boolean).slice(0, 3);
    return `${teile.join(':')}::`;
  }
  return '–';
}

export const TICKET_MS = 2 * 60_000;
const TICKETS_MAX = 1000;

/** Einmal-Tickets für den Download nach richtig eingegebenem Code. */
export class AbrufTickets {
  private tickets = new Map<string, { linkId: string; bis: number }>();
  constructor(private jetzt: () => number = Date.now) {}

  stelleAus(linkId: string): string {
    this.aufraeumen();
    // Gegen Fluten des Speichers: die ältesten fallen heraus.
    while (this.tickets.size >= TICKETS_MAX) this.tickets.delete(this.tickets.keys().next().value as string);
    const t = randomBytes(32).toString('base64url');
    this.tickets.set(t, { linkId, bis: this.jetzt() + TICKET_MS });
    return t;
  }

  /** Löst ein Ticket ein (nur einmal); liefert die Id des Links oder null. */
  loese(ticket: unknown): string | null {
    this.aufraeumen();
    if (typeof ticket !== 'string' || !SCHLUESSEL_MUSTER.test(ticket)) return null;
    const x = this.tickets.get(ticket);
    if (!x) return null;
    this.tickets.delete(ticket);
    return x.linkId;
  }

  private aufraeumen() {
    const t = this.jetzt();
    for (const [k, v] of this.tickets) if (v.bis <= t) this.tickets.delete(k);
  }
}

/**
 * Bereich einer IP für den Zähler der Abrufseite: IPv4 einzeln, IPv6 je /64 (sonst hätte jeder
 * Anschluss mit IPv6 praktisch unbegrenzt viele Adressen).
 */
export function ipBereich(ip: string | undefined): string {
  const a = (ip ?? '').replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1').trim().replace(/%.*$/, '');
  const f = isIP(a);
  if (f === 4) return a;
  if (f !== 6) return '–';
  const [kopf, rest] = a.includes('::') ? a.split('::') : [a, ''];
  const vorn = kopf ? kopf.split(':') : [];
  const hinten = rest ? rest.split(':') : [];
  const gruppen = [...vorn, ...Array(Math.max(0, 8 - vorn.length - hinten.length)).fill('0'), ...hinten];
  return `${gruppen.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export interface BremseOptionen {
  /** Fehlversuche je IP-Bereich, bevor er für `sperreMs` gesperrt ist. */
  fehlerMax: number;
  sperreMs: number;
  /** Höchstens so viele Code-Prüfungen (scrypt) gleichzeitig über alle Links. */
  gleichzeitig: number;
  jetzt: () => number;
}
const BEREICHE_MAX = 10_000;

/**
 * Bremse der öffentlichen Abrufseite – getrennt vom Anmeldeschutz der Benutzerkonten. Fehlversuche an
 * Abruf-Links sperren also nie die Anmeldung (auch nicht hinter einem Reverse Proxy, der alle Anfragen
 * mit derselben IP weitergibt), und Ausnahmen des Anmeldeschutzes gelten hier nicht. Dazu begrenzt sie
 * die Zahl gleichzeitiger Code-Prüfungen: Jede kostet einen scrypt-Durchlauf, und parallele Anfragen
 * dürfen weder den Server auslasten noch an den Zählern vorbei raten.
 */
export class AbrufBremse {
  private fehler = new Map<string, { n: number; bis: number }>();
  private laufend = 0;
  private o: BremseOptionen;
  constructor(o: Partial<BremseOptionen> = {}) {
    this.o = { fehlerMax: 5, sperreMs: 15 * 60_000, gleichzeitig: 2, jetzt: Date.now, ...o };
  }

  /** Ist der Bereich gerade gesperrt? */
  gesperrt(bereich: string): boolean {
    const x = this.fehler.get(bereich);
    if (!x) return false;
    if (x.bis <= this.o.jetzt()) { this.fehler.delete(bereich); return false; }
    return x.n >= this.o.fehlerMax;
  }

  fehlschlag(bereich: string) {
    const t = this.o.jetzt();
    const x = this.fehler.get(bereich);
    if (x && x.bis > t) { x.n++; x.bis = t + this.o.sperreMs; return; }
    while (this.fehler.size >= BEREICHE_MAX) this.fehler.delete(this.fehler.keys().next().value as string);
    this.fehler.set(bereich, { n: 1, bis: t + this.o.sperreMs });
  }

  /** Belegt einen Platz für eine Code-Prüfung; null, wenn alle belegt sind. Freigeben genau einmal. */
  belege(): (() => void) | null {
    if (this.laufend >= this.o.gleichzeitig) return null;
    this.laufend++;
    let frei = false;
    return () => { if (!frei) { frei = true; this.laufend--; } };
  }
}
