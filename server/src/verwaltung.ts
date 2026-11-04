import type { Einstellungen } from './einstellungen';
import { protokoll } from './protokoll';
import { t } from './sprache';
import { ortszeit } from './sicherung';
import { einstellungsMerker, laufeFaellige } from './zeitplan';

const log = protokoll.modul('werkbank');

/**
 * Technische Aufgaben des Admin-Kontos (#719): was die Verwaltung braucht – Sicherung, Pakete, Automatisierungen,
 * Postfächer, Speicherplatz … Sie bleiben beim Admin-Konto. Weil sich im Alltag kaum jemand als Administrator
 * anmeldet, gibt es zweierlei:
 *
 * - **E-Mail an die Administratoren**, gebündelt: höchstens eine je Tag (um `UHRZEIT`), nur wenn seit der letzten
 *   etwas Neues dazugekommen ist. Was ohnehin sofort eine eigene Mail schickt (Sicherung fehlgeschlagen oder zu alt,
 *   Speicherplatz, Notfallzugang – die „kritischen“), gilt mit Erscheinen als gemeldet; so kommt nichts doppelt.
 *   Entschieden als feste Meldung, nicht als mitgelieferte Automatisierung (#712): Diese Punkte hängen an keiner
 *   Mappe und an keinem Ereignis, Automatisierungen arbeiten aber mit Mappen und Ereignissen.
 * - **Hinweis ohne Einzelheiten** beim Alltags-Benutzer, der die Aufgaben ohne Empfänger bekommt: nur „ja/nein“,
 *   nie Inhalte. Er verschwindet, sobald nichts mehr offen ist.
 *
 * Mehrere Server: Der Tag der Sammel-Mail wird über den Zeitplan-Baustein beansprucht (genau ein Server schickt sie),
 * die schon gemeldeten Punkte liegen in der Datenbank (`verwaltung_gemeldet`).
 */
export interface Verwaltungspunkt {
  /** Fest je Sache (z. B. `paket:<id>`), damit er nur einmal gemeldet wird. */
  schluessel: string;
  /** Für die Mail an die Administratoren – nie für den Alltags-Benutzer. */
  text: string;
  /** Hat schon eine eigene, sofortige Mail an die Administratoren (Sicherung, Speicherplatz, Notfallzugang). */
  eigeneMail?: boolean;
}

export type Verwaltungsquelle = () => Promise<Verwaltungspunkt[]>;

/** Uhrzeit der täglichen Sammel-Mail (Zeitzone der Ablage). */
export const UHRZEIT = '07:00';
/** So lange gilt das Ergebnis für den Hinweis – er wird bei jedem Seitenaufruf gefragt. */
const MERKEN_MS = 60_000;

export interface VerwaltungDeps {
  /** Alle Quellen; eine, die scheitert, zählt als leer (der Rest gilt trotzdem). */
  quellen: Verwaltungsquelle[];
  einstellungen: Einstellungen;
  anAdmins: (betreff: string, text: string) => Promise<void>;
  /** Adresse für den Link in die Werkbank. */
  adresse?: () => string;
  jetzt?: () => Date;
}

export class Verwaltung {
  private gemerkt: { am: number; punkte: Verwaltungspunkt[] } | null = null;
  private readonly jetzt: () => Date;
  constructor(private d: VerwaltungDeps) { this.jetzt = d.jetzt ?? (() => new Date()); }

  /** Alle offenen technischen Punkte (sortiert nach Schlüssel). */
  async punkte(frisch = false): Promise<Verwaltungspunkt[]> {
    const t = this.jetzt().getTime();
    if (!frisch && this.gemerkt && t - this.gemerkt.am < MERKEN_MS) return this.gemerkt.punkte;
    const alle: Verwaltungspunkt[] = [];
    for (const q of this.d.quellen) {
      try { alle.push(...await q()); } catch (e) { log.warn('Technische Aufgaben: eine Quelle ist nicht lesbar', { fehler: (e as Error).message }); }
    }
    const punkte = [...new Map(alle.map((p) => [p.schluessel, p])).values()].sort((a, b) => a.schluessel.localeCompare(b.schluessel));
    this.gemerkt = { am: t, punkte };
    return punkte;
  }

  /** Für den Hinweis beim Alltags-Benutzer: Liegt etwas an? Nur ja/nein. */
  async offen(): Promise<boolean> { return (await this.punkte()).length > 0; }

  /**
   * Regelmäßig aufrufen (etwa jede Minute): Vergessenes (erledigte Punkte) aufräumen, Punkte mit eigener Mail als
   * gemeldet merken und einmal am Tag die Sammel-Mail mit allem Neuen schicken. Liefert die Zahl gemailter Punkte.
   */
  async tick(): Promise<number> {
    const punkte = await this.punkte(true);
    const jetzt = new Set(punkte.map((p) => p.schluessel));
    const alt = await this.gemeldet();
    // Erledigtes vergessen – kommt es wieder, wird es wieder gemeldet; mit eigener Mail gilt es sofort als gemeldet.
    let neu = alt.filter((s) => jetzt.has(s));
    for (const p of punkte) if (p.eigeneMail && !neu.includes(p.schluessel)) neu.push(p.schluessel);
    neu = [...new Set(neu)].sort();
    if (neu.join('\n') !== alt.join('\n')) await this.d.einstellungen.schreibe('verwaltung_gemeldet', neu);
    let gemailt = 0;
    const offen = punkte.filter((p) => !neu.includes(p.schluessel));
    if (!offen.length) return 0;
    await laufeFaellige(einstellungsMerker(this.d.einstellungen, 'verwaltung_mail_tag'), ortszeit(this.jetzt()), { uhrzeit: UHRZEIT }, async () => {
      await this.d.anAdmins(betreff(offen.length), mailtext(punkte, new Set(offen.map((p) => p.schluessel)), this.d.adresse?.()));
      await this.d.einstellungen.schreibe('verwaltung_gemeldet', [...new Set([...neu, ...offen.map((p) => p.schluessel)])].sort());
      gemailt = offen.length;
      log.info('Technische Aufgaben an die Administratoren gemailt', { neu: offen.length, offen: punkte.length });
    });
    return gemailt;
  }

  private async gemeldet(): Promise<string[]> {
    const v = await this.d.einstellungen.lies('verwaltung_gemeldet');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').sort() : [];
  }

}

const betreff = (n: number) => t('mail.verwaltung.betreff', { anzahl: n });

function mailtext(punkte: Verwaltungspunkt[], neu: Set<string>, adresse?: string): string {
  const zeile = (p: Verwaltungspunkt) => `- ${p.text}${neu.has(p.schluessel) ? ` ${t('mail.verwaltung.neu')}` : ''}`;
  return [
    t('mail.verwaltung.anrede'),
    t('mail.verwaltung.einleitung'),
    punkte.map(zeile).join('\n'),
    adresse ? t('mail.verwaltung.anmelden', { link: `${adresse.replace(/\/$/, '')}/werkbank` }) : t('mail.verwaltung.anmelden.ohne-link'),
    t('mail.verwaltung.fuss'),
  ].join('\n\n') + '\n';
}
