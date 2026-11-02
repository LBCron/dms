/**
 * Lasttest-Modus (#612): Stand der Seite im Browser und der Ergebnisblock mit Gerät und Speicher. Server
 * (server/src/lasttestmodus.ts) und Oberfläche (web/src/lasttest.tsx) nutzen dieselben Typen und dieselbe Füllung,
 * damit die Datei unter /data/ergebnis genau das enthält, was man auf der Seite kopiert.
 */

export type LasttestStufe = 'klein' | 'mittel' | 'gross';
export type LasttestWahl = LasttestStufe | 'alle';
export const LASTTEST_WAHL: readonly LasttestWahl[] = ['klein', 'mittel', 'gross', 'alle'];
export type Speicherwahl = 'HDD' | 'SSD' | 'NVMe' | 'unbekannt';

/** Geschätzte Dauer je Stufe in Minuten (von–bis), wie im Administratorhandbuch. */
export const LASTTEST_DAUER: Record<LasttestStufe, [number, number]> = { klein: [3, 5], mittel: [15, 30], gross: [30, 60] };

export const stufenVon = (w: LasttestWahl): LasttestStufe[] => (w === 'alle' ? ['klein', 'mittel', 'gross'] : [w]);

/** Was das Skript gerade tut (Meldungen von server/test/lasttest.mjs). */
export type LasttestSchritt = 'start' | 'pruefen' | 'einrichten' | 'demo' | 'hintergrund' | 'vorbereiten' | 'messen' | 'auswerten';

export interface LasttestStand {
  wahl: LasttestWahl;
  /** laeuft → fertig; abbruch: Schutz der echten Ablage; fehler: Skript unerwartet beendet; beendet: Knopf gedrückt. */
  zustand: 'laeuft' | 'fertig' | 'abbruch' | 'fehler' | 'beendet';
  stufe: LasttestStufe | null;
  nr: number;
  von: number;
  schritt: LasttestSchritt;
  /** Demo-Mappen anlegen: Stand des Auftrags. */
  demo: { fertig: number; gesamt: number } | null;
  /** Laufender Durchgang; `ende` in Millisekunden (Uhr des Servers). */
  durchgang: { name: string; n: number; ende: number } | null;
  /** Fertige Durchgänge mit p95 und Fehlerquote. */
  durchgaenge: Array<{ name: string; n: number; p95: number | null; fehlerquote: number }>;
  begonnen: number;
  /** Beginn der laufenden Stufe (Uhr des Servers). */
  stufeBegonnen: number;
  /** Uhr des Servers – die Seite rechnet die Restdauer damit, nicht mit der Uhr des Browsers. */
  jetzt: number;
  /** Fertige Stufen (für die Restdauer bei „alle“). */
  fertigeStufen: LasttestStufe[];
  ergebnis: { bericht: string; vorlage: string; verfehlt: boolean } | null;
  /** Grund für Abbruch oder Fehler (ohne Zugangsdaten). */
  meldung: string | null;
  angaben: { geraet: string; speicher: Speicherwahl | null };
  speicherErkannt: 'HDD' | 'SSD' | 'NVMe' | null;
  /** Wo das Ergebnis im Container liegt (z. B. /data/ergebnis/lasttest-klein.md). */
  datei: string | null;
}

/** Platzhalter im Ergebnisblock – wie PLATZHALTER in server/test/lasttest.mjs. */
export const PLATZHALTER = { geraet: '{{geraet}}', speicher: '{{speicher}}' } as const;
export const GERAET_MAX = 120;

/** Gerät für den Block: eine Zeile, ohne Backticks (der Block steht in ```text), höchstens GERAET_MAX Zeichen. */
export function bereinigeGeraet(s: unknown): string {
  return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/`/g, "'").replace(/\s{2,}/g, ' ').trim().slice(0, GERAET_MAX);
}

/**
 * Block mit Gerät und Speicher. Die Wörter gehören zum festen Format des Blocks (wie „bitte ergänzen“ im Skript),
 * nicht zur Oberfläche: Das Formular „Messergebnis Lasttest“ erwartet sie so.
 */
export function fuelleErgebnis(vorlage: string, a: LasttestStand['angaben'], erkannt: LasttestStand['speicherErkannt']): string {
  const geraet = bereinigeGeraet(a.geraet) || 'bitte ergänzen';
  const speicher = !a.speicher ? 'bitte ergänzen (HDD/SSD/NVMe)'
    : a.speicher === 'unbekannt' ? 'weiß nicht'
      : a.speicher === erkannt ? `${a.speicher} (erkannt)` : a.speicher;
  return vorlage.split(PLATZHALTER.geraet).join(geraet).split(PLATZHALTER.speicher).join(speicher);
}

/** Restdauer in Minuten (von–bis); null: gleich fertig. */
export function restMinuten(s: Pick<LasttestStand, 'wahl' | 'stufe' | 'fertigeStufen' | 'stufeBegonnen' | 'jetzt' | 'durchgang' | 'zustand'>): [number, number] | null {
  if (s.zustand !== 'laeuft') return null;
  const offen = stufenVon(s.wahl).filter((x) => !s.fertigeStufen.includes(x) && x !== s.stufe);
  const spaeter = offen.reduce(([a, b], x) => [a + LASTTEST_DAUER[x][0], b + LASTTEST_DAUER[x][1]], [0, 0]);
  const vergangen = (s.jetzt - s.stufeBegonnen) / 60_000;
  const [lo, hi] = s.stufe ? LASTTEST_DAUER[s.stufe] : [0, 0];
  const von = Math.max(0, lo - vergangen) + spaeter[0];
  const bis = Math.max(0, hi - vergangen) + spaeter[1];
  const rest = s.durchgang ? Math.max(0, (s.durchgang.ende - s.jetzt) / 60_000) : 0;
  const a = Math.ceil(Math.max(von, rest));
  const b = Math.ceil(Math.max(bis, rest));
  return b < 1 ? null : [Math.max(1, a), b];
}
