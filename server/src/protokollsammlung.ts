/**
 * Warnungen und Fehler aus dem Protokoll aller Prozesse, zusammengefasst (#895) – für den Lasttest: Bericht, Ergebnisblock
 * und die Lasttest-Seite. Statt im Docker-Log nachzusehen, zählt Ablago gleiche Meldungen: Stufe (Warnung, Fehler),
 * Modul, Text, Art der Ausnahme, Anzahl, erster und letzter Zeitpunkt, in welchen Prozessen.
 *
 * Ohne Innenleben: Gezählt wird nur der Text der Meldung ohne Kontextobjekt (`daten`). Was im Text an Einzelheiten
 * steht – Pfade, Adressen, E-Mail-Adressen, Prüfsummen, Ids, Zahlen, Angaben in Anführungszeichen – ersetzt
 * {@link ohneEinzelheiten}. Aus einem Fehler im Kontextobjekt bleibt nur seine Art (`TypeError`, `Error ENOENT`),
 * nie die Nachricht oder der Stapel ({@link ausnahmeArt}).
 *
 * Mit mehreren Prozessen schickt jeder seine Meldungen gebündelt an den Hauptprozess, der sie für alle sammelt
 * (prozesse.ts) – so überstehen sie auch den Absturz eines Prozesses. Mit einem Prozess sammelt er selbst. Die Sammlung
 * lebt nur im Arbeitsspeicher, ist klein ({@link ARTEN_MAX} Arten) und kostet ohne Warnungen nichts.
 */

export type SammelStufe = 'warn' | 'error' | 'fatal';
export const SAMMEL_STUFEN: readonly string[] = ['warn', 'error', 'fatal'];
/** Höchstens so viele verschiedene Meldungen; weitere zählen nur noch in `weitere`. */
export const ARTEN_MAX = 100;
/** Länge des Textes einer Meldung. */
export const TEXT_MAX = 160;

/** Eine Meldung, wie sie zwischen Prozessen reist: schon ohne Einzelheiten. */
export interface Rohmeldung { stufe: SammelStufe; modul: string; text: string; ausnahme: string | null; anzahl: number; erste: string; letzte: string }

export interface Sammeleintrag extends Rohmeldung {
  /** Nummern der Prozesse, die sie meldeten (0 = Hauptprozess). */
  prozesse: number[];
}

export interface Sammelstand {
  /** Seit wann gesammelt wird (Start des sammelnden Prozesses). */
  seit: string;
  /** Alle gezählten Meldungen, auch die unter `weitere`. */
  gesamt: number;
  /** Meldungen von Arten, die nicht mehr in die Liste passten. */
  weitere: number;
  /** Häufigste zuerst, höchstens {@link ARTEN_MAX}. */
  eintraege: Sammeleintrag[];
}

/**
 * Einzelheiten aus einem Meldungstext entfernen: Adressen, E-Mail-Adressen, Pfade, Angaben in Anführungszeichen,
 * Ids und Prüfsummen, dann Zahlen. Leerraum zusammengezogen, höchstens {@link TEXT_MAX} Zeichen.
 */
export function ohneEinzelheiten(text: string): string {
  const t = String(text ?? '')
    .split('\n')[0]
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<Adresse>')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<E-Mail>')
    .replace(/„[^“\n]*“|"[^"\n]*"|«[^»\n]*»|»[^«\n]*«|`[^`\n]*`|'[^'\n]*'|‚[^‘\n]*‘/g, '„…“')
    .replace(/(^|[\s(=:,[])(?:[A-Za-z]:)?[/\\][^\s,;)\]]+/g, '$1<Pfad>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<Id>')
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8,}\b/gi, '<Prüfsumme>')
    .replace(/\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g, '<Id>')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > TEXT_MAX ? `${t.slice(0, TEXT_MAX - 1).trimEnd()}…` : t;
}

/**
 * Art einer Ausnahme ohne ihre Nachricht: Name (`TypeError`) und Code von Node.js (`ENOENT`, `ERR_…`), z. B.
 * „Error ENOENT“. Aus einem Error oder aus einem Text, wie ihn das Protokoll unter `fehler` ablegt (Stapel oder
 * „Name: Nachricht“). null, wenn nichts davon erkennbar ist.
 */
export function ausnahmeArt(f: unknown): string | null {
  if (f === null || f === undefined) return null;
  let name: string | null = null;
  let code: string | null = null;
  if (f instanceof Error) {
    name = f.name || null;
    const c = (f as NodeJS.ErrnoException).code;
    if (typeof c === 'string' && /^(E[A-Z0-9]{2,}|ERR_[A-Z0-9_]+)$/.test(c)) code = c;
    if (!code) code = f.message.match(/\b(E[A-Z]{3,}|ERR_[A-Z0-9_]{3,})\b/)?.[1] ?? null;
  } else {
    const erste = String(f).split('\n')[0];
    name = erste.match(/^\s*((?:[A-Z][A-Za-z]*)?(?:Error|Exception))\b/)?.[1] ?? null;
    code = erste.match(/\b(E[A-Z]{3,}|ERR_[A-Z0-9_]{3,})\b/)?.[1] ?? null;
  }
  const teile = [name, code].filter(Boolean);
  return teile.length ? teile.join(' ') : null;
}

const schluessel = (m: Pick<Rohmeldung, 'stufe' | 'modul' | 'text' | 'ausnahme'>) => `${m.stufe}\u0000${m.modul}\u0000${m.text}\u0000${m.ausnahme ?? ''}`;

/** Aus einem Eintrag des Protokolls die Rohmeldung (ohne Einzelheiten); null unter Warnung. */
export function rohAus(e: { stufe: string; modul: string; text: string; zeit: string; daten?: Record<string, unknown> }): Rohmeldung | null {
  if (!SAMMEL_STUFEN.includes(e.stufe)) return null;
  const d = e.daten ?? {};
  return {
    stufe: e.stufe as SammelStufe, modul: e.modul, text: ohneEinzelheiten(e.text),
    ausnahme: ausnahmeArt(d.fehler ?? d.err ?? d.error ?? null), anzahl: 1, erste: e.zeit, letzte: e.zeit,
  };
}

/** Zählt gleiche Meldungen zusammen; mit `prozess` für die Sammlung aller Prozesse. */
export class Protokollsammlung {
  private arten = new Map<string, Sammeleintrag>();
  private gesamt = 0;
  private weitere = 0;
  constructor(private readonly seit = new Date().toISOString(), private readonly max = ARTEN_MAX) {}

  nimm(m: Rohmeldung, prozess: number) {
    const n = Math.max(1, Math.floor(Number(m.anzahl)) || 1);
    this.gesamt += n;
    const k = schluessel(m);
    const alt = this.arten.get(k);
    if (alt) {
      alt.anzahl += n;
      if (m.erste < alt.erste) alt.erste = m.erste;
      if (m.letzte > alt.letzte) alt.letzte = m.letzte;
      if (!alt.prozesse.includes(prozess)) alt.prozesse = [...alt.prozesse, prozess].sort((a, b) => a - b);
      return;
    }
    if (this.arten.size >= this.max) { this.weitere += n; return; }
    this.arten.set(k, { stufe: m.stufe, modul: String(m.modul), text: ohneEinzelheiten(m.text), ausnahme: m.ausnahme ?? null, anzahl: n, erste: m.erste, letzte: m.letzte, prozesse: [prozess] });
  }

  stand(): Sammelstand {
    const eintraege = [...this.arten.values()].map((e) => ({ ...e, prozesse: [...e.prozesse] })).sort((a, b) => b.anzahl - a.anzahl || (a.erste < b.erste ? -1 : 1));
    return { seit: this.seit, gesamt: this.gesamt, weitere: this.weitere, eintraege };
  }
}

/**
 * Bündel für den Weg zum Hauptprozess (#895): gleiche Meldungen zusammengezählt, abgeschickt spätestens nach
 * `ms` – ein Fehler sofort, damit er auch einen Absturz übersteht.
 */
export class Buendel {
  private offen = new Map<string, Rohmeldung>();
  private uhr?: NodeJS.Timeout;
  constructor(private senden: (m: Rohmeldung[]) => void, private ms = 1000) {}

  nimm(m: Rohmeldung) {
    const k = schluessel(m);
    const alt = this.offen.get(k);
    if (alt) { alt.anzahl += m.anzahl; alt.letzte = m.letzte; } else this.offen.set(k, { ...m });
    if (m.stufe !== 'warn') { this.leeren(); return; }
    if (!this.uhr) { this.uhr = setTimeout(() => this.leeren(), this.ms); this.uhr.unref?.(); }
  }

  leeren() {
    if (this.uhr) { clearTimeout(this.uhr); this.uhr = undefined; }
    if (!this.offen.size) return;
    const m = [...this.offen.values()];
    this.offen.clear();
    try { this.senden(m); } catch { /* Hauptprozess weg: dann gibt es niemanden mehr, der sammelt */ }
  }
}
