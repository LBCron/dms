import { verschiebe } from '../../shared/src/sichten';
import type { Einstellungen } from './einstellungen';

/**
 * Der eine Zeitplan-Baustein (#724): Wann ist ein täglicher Lauf fällig, was wird nachgeholt, wer macht ihn?
 * Sicherung, Probe-Wiederherstellung, Tägliche Zusammenfassung und „Datum erreicht“ nutzen ihn; die Wenn-Karte
 * „Zeitplan“ (Stufe 2) setzt darauf auf.
 *
 * **Eine Regel zum Nachholen:** Fällig ist jeder Tag nach dem zuletzt gelaufenen, an dem der Takt gilt, sobald seine
 * Uhrzeit erreicht ist – höchstens `nachholenTage` zurück (0 = nur heute). Das gilt auch nach einem Neustart: Was
 * heute (bzw. in den letzten Tagen) zur Uhrzeit nicht lief, läuft beim nächsten Blick. Ein neuer Takt (noch nie
 * gelaufen) beginnt heute, nichts rückwirkend.
 *
 * **Mehrere Server:** Wer den Tag im Merker einträgt (vergleichen und tauschen in der Datenbank), macht den Lauf.
 */
export interface Takt {
  /** Uhrzeit „HH:MM“ (Zeitzone des Haushalts). */
  uhrzeit: string;
  /** Gilt der Takt an diesem Tag (Wochentag, Feiertag …)? Ohne: jeden Tag. */
  an?: (datum: string) => boolean;
  /** So viele Tage zurück holt der Baustein verpasste Läufe nach (0 = nur heute). */
  nachholenTage?: number;
}

/** Ortszeit als Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM). */
export interface Jetzt { datum: string; uhr: string }

/** Die Regel: fällige Tage (älteste zuerst) nach dem zuletzt gelaufenen. */
export function faelligeTage(zuletzt: string | null, jetzt: Jetzt, t: Takt): string[] {
  const bis = jetzt.uhr >= t.uhrzeit ? jetzt.datum : verschiebe(jetzt.datum, -1);
  const fruehestens = verschiebe(jetzt.datum, -(t.nachholenTage ?? 0));
  let tag = zuletzt ? verschiebe(zuletzt, 1) : jetzt.datum;
  if (tag < fruehestens) tag = fruehestens;
  const erg: string[] = [];
  for (; tag <= bis && erg.length < 400; tag = verschiebe(tag, 1)) if (!t.an || t.an(tag)) erg.push(tag);
  return erg;
}

/** Wo ein Takt sich merkt, bis wann er gelaufen ist. */
export interface Merker {
  lies(): Promise<string | null>;
  /** Tag eintragen, wenn noch `alt` drinsteht; true = dieser Server macht den Lauf. */
  beanspruche(alt: string | null, tag: string): Promise<boolean>;
}

/** Merker in den Einstellungen (Schlüssel wie bisher, z. B. `sicherung_zuletzt_auto`). */
export function einstellungsMerker(e: Einstellungen, schluessel: string): Merker {
  return {
    async lies() { const v = await e.lies(schluessel); return typeof v === 'string' ? v : null; },
    async beanspruche(alt, tag) {
      if (e.tausche) return e.tausche(schluessel, alt, tag);
      if (((await e.lies(schluessel)) ?? null) !== alt) return false;
      await e.schreibe(schluessel, tag); return true;
    },
  };
}

/**
 * Fällige Läufe eines Takts nacheinander: je Tag erst eintragen, dann `lauf(tag)`. Liefert die gelaufenen Tage.
 * Scheitert ein Lauf, bleibt der Tag eingetragen (kein Dauerversuch); der Aufrufer meldet den Fehler.
 */
export async function laufeFaellige(m: Merker, jetzt: Jetzt, t: Takt, lauf: (tag: string) => Promise<void>): Promise<string[]> {
  let zuletzt = await m.lies();
  const erledigt: string[] = [];
  for (const tag of faelligeTage(zuletzt, jetzt, t)) {
    if (!(await m.beanspruche(zuletzt, tag))) break;
    zuletzt = tag;
    erledigt.push(tag);
    await lauf(tag);
  }
  return erledigt;
}

/** Wochentag eines Datums JJJJ-MM-TT: 1 = Montag … 7 = Sonntag (wie in den Einstellungen). */
export const wochentagVon = (datum: string) => ((new Date(`${datum}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
