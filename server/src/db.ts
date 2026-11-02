import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

/**
 * Zahl der Verbindungen zur Datenbank (#544). Vorgabe bleibt 10: Im Lasttest mit 100 gleichzeitigen Anfragen
 * (realistische Obergrenze für einen Kleinbetrieb) lagen 5, 10 und 20 Verbindungen gleichauf – der Engpass
 * ist die Rechenzeit (Server und PostgreSQL teilen sich die Kerne), nicht die Zahl der Verbindungen. Mehr
 * Verbindungen kosten PostgreSQL je etwa 5–10 MB Arbeitsspeicher und helfen erst mit mehr Kernen; weniger
 * ließen Texterkennung, Sicherung und Anfragen sich gegenseitig ausbremsen. Für größere Installationen
 * einstellbar mit `DMS_DB_VERBINDUNGEN` (2–100); PostgreSQL erlaubt in der Vorgabe 100 Verbindungen insgesamt.
 */
export const VERBINDUNGEN_VORGABE = 10;
export const VERBINDUNGEN_MIN = 2;
export const VERBINDUNGEN_MAX = 100;

export interface VerbindungsEinstellung { max: number; quelle: 'vorgabe' | 'umgebung'; fehler?: string }

export function verbindungenAus(env: Record<string, string | undefined>): VerbindungsEinstellung {
  const roh = env.DMS_DB_VERBINDUNGEN?.trim();
  if (!roh) return { max: VERBINDUNGEN_VORGABE, quelle: 'vorgabe' };
  const n = Number(roh);
  if (!Number.isInteger(n) || n < VERBINDUNGEN_MIN || n > VERBINDUNGEN_MAX) {
    return { max: VERBINDUNGEN_VORGABE, quelle: 'vorgabe', fehler: `DMS_DB_VERBINDUNGEN=${roh} ist keine Zahl von ${VERBINDUNGEN_MIN} bis ${VERBINDUNGEN_MAX} und wird ignoriert.` };
  }
  return { max: n, quelle: 'umgebung' };
}

/**
 * postgres.js 4 (#236): `infer: true` behält die Parametertypen von v3 (Date als timestamptz, boolean, bytea …),
 * damit Abfragen ohne ausdrücklichen Typ unverändert laufen.
 */
export function verbinde(url: string, max = VERBINDUNGEN_VORGABE) {
  return postgres(url, { max, onnotice: () => {}, infer: true });
}

/**
 * Warten auf eine freie Verbindung (#544): Alle paar Sekunden läuft `SELECT 1` über denselben Pool wie die
 * Anfragen. Die Abfrage selbst kostet unter einer Millisekunde; was sie länger dauert, hat sie auf eine
 * freie Verbindung gewartet – plus Hin- und Rückweg zum Datenbank-Server und, wenn der Server gerade
 * rechnet, die Wartezeit der Ereignisschleife bis zur Antwort. Die Werte der letzten Minute stehen in
 * Werkbank → Datenbank-Anbindung und im Lasttest.
 */
export class Verbindungswarten {
  private werte: Array<{ t: number; ms: number }> = [];
  private zeitgeber?: NodeJS.Timeout;
  constructor(private sql: postgres.Sql, readonly max: number, readonly quelle: VerbindungsEinstellung['quelle'] = 'vorgabe') {}

  start(intervallMs = 5000) {
    if (this.zeitgeber) return;
    this.zeitgeber = setInterval(() => void this.probe().catch(() => {}), intervallMs);
    this.zeitgeber.unref();
  }
  stop() { if (this.zeitgeber) clearInterval(this.zeitgeber); this.zeitgeber = undefined; }

  /** Eine Messung; gemerkt wird sie für eine Minute. */
  async probe(): Promise<number> {
    const t0 = performance.now();
    await this.sql`SELECT 1`;
    const ms = performance.now() - t0;
    const jetzt = Date.now();
    this.werte.push({ t: jetzt, ms });
    this.werte = this.werte.filter((w) => w.t > jetzt - 60_000);
    return ms;
  }

  stand(): { max: number; quelle: VerbindungsEinstellung['quelle']; messungen: number; median: number | null; p95: number | null; hoechstens: number | null } {
    const s = this.werte.map((w) => w.ms).sort((a, b) => a - b);
    const q = (x: number) => (s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(x * s.length))] * 10) / 10 : null);
    return { max: this.max, quelle: this.quelle, messungen: s.length, median: q(0.5), p95: q(0.95), hoechstens: s.length ? Math.round(s[s.length - 1] * 10) / 10 : null };
  }
}

/**
 * Führt alle noch nicht ausgeführten SQL-Dateien aus `verzeichnis` in
 * Namensreihenfolge aus. Alles läuft in einer Transaktion: scheitert eine
 * Migration, bleibt die Datenbank unverändert. Die Transaktionssperre
 * verhindert, dass zwei Instanzen gleichzeitig migrieren.
 */
export async function migriere(sql: postgres.Sql, verzeichnis: string, log: (m: string) => void = console.log) {
  const dateien = (await readdir(verzeichnis)).filter((f) => f.endsWith('.sql')).sort();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(4711001)`;
    await tx`
      CREATE TABLE IF NOT EXISTS schema_migrationen (
        name text PRIMARY KEY,
        ausgefuehrt timestamptz NOT NULL DEFAULT now()
      )`;
    const erledigt = new Set((await tx`SELECT name FROM schema_migrationen`).map((r) => r.name as string));
    for (const datei of dateien) {
      if (erledigt.has(datei)) continue;
      await tx.unsafe(await readFile(join(verzeichnis, datei), 'utf8'));
      await tx`INSERT INTO schema_migrationen (name) VALUES (${datei})`;
      log(`Migration ausgeführt: ${datei}`);
    }
  });
}
