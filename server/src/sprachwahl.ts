import { setzeErlaubteSprachen } from '../../shared/src/beschriftung';
import { setzeSprache } from '../../shared/src/sprache';
import { istVerfuegbar, liesSpracheinstellung, verfuegbareSprachen, type Spracheinstellung } from '../../shared/src/sprachwahl';
import type { Einstellungen } from './einstellungen';
import { Fachfehler } from './fehler';
import { protokoll } from './protokoll';
import { t } from './sprache';

/**
 * Sprachen der Ablage (#729): erlaubte Sprachen und Sprache der Installation – Einstellung „sprachen“ (Werkbank →
 * Sprachen). Wie die Region liest jeder Prozess sie beim Start und danach jede Minute neu; der speichernde Server
 * übernimmt sie sofort. Die Sprache der Installation gilt für Anfragen ohne eigene Wahl, für E-Mails an Personen ohne
 * Wahl und für Texte, die der Server einmal für alle bildet (z. B. Titel und Namen der Systemmappentypen).
 */
export const SPRACHEN_NEU_LESEN_MS = 60_000;

export class SprachDienst {
  private uhr: ReturnType<typeof setInterval> | null = null;
  constructor(private einstellungen: Einstellungen) {}

  async lies(): Promise<Spracheinstellung> { return liesSpracheinstellung(await this.einstellungen.lies('sprachen')); }

  /** Liest die Einstellung und setzt Sprache und erlaubte Sprachen dieses Prozesses. */
  async lade(): Promise<Spracheinstellung> {
    const e = await this.lies();
    uebernimm(e);
    return e;
  }

  starte() {
    this.uhr ??= setInterval(() => { void this.lade().catch(() => {}); }, SPRACHEN_NEU_LESEN_MS);
    this.uhr.unref?.();
  }
  stoppe() { if (this.uhr) clearInterval(this.uhr); this.uhr = null; }

  /** Stand für die Werkbank: Einstellung und alle Sprachen, die es gibt. */
  async stand() { return { einstellung: await this.lies(), verfuegbar: verfuegbareSprachen() }; }

  async speichere(e: unknown): Promise<Spracheinstellung> {
    const x = (e ?? {}) as Record<string, unknown>;
    const alt = await this.lies();
    if (x.standard !== undefined && !istVerfuegbar(x.standard)) throw new Fachfehler(422, t('meldungen.sprachen.unbekannt'));
    if (x.erlaubt !== undefined && (!Array.isArray(x.erlaubt) || !x.erlaubt.every(istVerfuegbar))) throw new Fachfehler(422, t('meldungen.sprachen.unbekannt'));
    const standard = (x.standard as string | undefined) ?? alt.standard;
    const erlaubt = (x.erlaubt as string[] | undefined) ?? alt.erlaubt;
    if (!erlaubt.includes(standard)) throw new Fachfehler(422, t('meldungen.sprachen.standard-erlaubt'));
    const neu = liesSpracheinstellung({ standard, erlaubt });
    await this.einstellungen.schreibe('sprachen', neu);
    uebernimm(neu);
    protokoll.modul('werkbank').info('Sprachen eingestellt', { standard: neu.standard, erlaubt: neu.erlaubt.join(', ') });
    return neu;
  }
}

/** Einstellung für diesen Prozess übernehmen. */
export function uebernimm(e: Spracheinstellung) {
  setzeSprache(e.standard);
  setzeErlaubteSprachen(e.erlaubt);
}
