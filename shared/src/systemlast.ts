/**
 * Systemzustand → Auslastung (#409): Typen und Schwellen, gemeinsam für Server (`server/src/systemlast.ts`)
 * und Oberfläche (Werkbank → Wartung und Fehlersuche → Systemzustand).
 */

/** Ein Messpunkt (jede Minute). Anteile in Prozent (0–100), Netz in Byte je Sekunde; `null` = nicht verfügbar. */
export interface Messpunkt { zeit: string; cpu: number | null; speicher: number | null; rx: number | null; tx: number | null }

/** Anteile am Arbeitsspeicher in Byte: DMS-Prozess, Paket-Läufer, PostgreSQL (nur bei dms-komplett im selben Container). */
export interface Anteile { dms: number | null; pakete: number | null; datenbank: number | null }

export interface SystemlastStand {
  /** Jetzt: seit der letzten Messung (mindestens eine Sekunde). */
  jetzt: Messpunkt;
  verlauf: Messpunkt[];
  cgroup: 'v2' | 'v1' | null;
  /** Erlaubte Kerne des Containers; ohne Grenze die des Rechners. */
  kerne: number;
  kerneBegrenzt: boolean;
  speicher: { belegt: number | null; grenze: number | null; ohneGrenze: boolean };
  anteile: Anteile;
  /** Systemlast des Rechners (1, 5, 15 Minuten) und seine Kerne. */
  last: [number, number, number];
  hostKerne: number;
  netz: boolean;
  /** PostgreSQL läuft im selben Container (dms-komplett)? Sonst sieht das DMS dessen Auslastung nicht. */
  datenbankImContainer: boolean;
  warnung: Warnung[];
}

/** Woran der Systemzustand warnt: CPU, Arbeitsspeicher (#409) und Wartezeit der Ereignisschleife (#542). */
export type Warnung = 'cpu' | 'speicher' | 'schleife';

/**
 * Warnung bei hoher Wartezeit des Servers (#542): Liegt die Verzögerung der Ereignisschleife bei 99 % der
 * Messungen (p99) über `SCHLEIFE_GRENZE_MS`, und das in jedem der letzten `SCHLEIFE_MINUTEN` Minutenfenster.
 */
export const SCHLEIFE_GRENZE_MS = 100;
export const SCHLEIFE_MINUTEN = 5;

/** Arbeiter für PDF und große Exporte (#542), wie Werkbank → Systemzustand sie zeigt. */
export type ArbeiterStand =
  | { aus: true; quelle: 'vorgabe' | 'umgebung'; kerne: number }
  | {
    aus: false; quelle: 'vorgabe' | 'umgebung'; kerne: number;
    groesse: number; arbeiter: number; beschaeftigt: number; wartend: number;
    erledigt: number; fehler: number; zeitueberschreitungen: number; abgewiesen: number;
    mittlereDauerMs: number | null; mittleresWartenMs: number | null; laengstesWartenMs: number; zeitMs: number; warteschlangeMax: number;
  };

/** Warnung, wenn ein Wert so lange über der Schwelle liegt (#409: „RAM > 90 % länger als 5 Minuten“). */
export const SCHWELLE_PROZENT = 90;
export const SCHWELLE_MINUTEN = 5;
export const VERLAUF_MINUTEN = 60;

/** Welche Werte die letzten `minuten` Messpunkte lang durchgehend über der Schwelle lagen. */
export function dauerhaftHoch(verlauf: Messpunkt[], minuten = SCHWELLE_MINUTEN, schwelle = SCHWELLE_PROZENT): Array<'cpu' | 'speicher'> {
  const letzte = verlauf.slice(-minuten);
  if (letzte.length < minuten) return [];
  return (['cpu', 'speicher'] as const).filter((k) => letzte.every((p) => p[k] !== null && p[k]! >= schwelle));
}
