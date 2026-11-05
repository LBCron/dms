import { randomUUID } from 'node:crypto';
import { Fachfehler } from './fehler';
import { meldeFortschritt, neuerStand, schliessePhasen, type Auftrag, type Fortschritt, type PhasenPlan } from '../../shared/src/auftrag';
import { t } from './sprache';

export type { Auftrag, AuftragPhase, Fortschritt, PhasenPlan } from '../../shared/src/auftrag';

/**
 * Lange Arbeiten (z. B. tausende Demo-Mappen) laufen im Hintergrund, damit ein
 * Reverse-Proxy die Anfrage nicht nach seiner Wartezeit abbricht (Fehler 504).
 * Die Oberfläche fragt den Stand regelmäßig ab. Es läuft immer nur ein Auftrag.
 * Seit #364 mit Phasen und Einheit (`phasen`), `fertig`/`gesamt` sind die Summe.
 */
export class Auftraege {
  private letzter?: Auftrag;
  private abbruch?: AbortController;

  constructor(private log: (m: string) => void = () => {}) {}

  aktuell(): Auftrag | null { return this.letzter ?? null; }

  /**
   * Mit `abbrechbar` (#458) bekommt die Arbeit ein Signal; abbrechen() setzt es, die Arbeit hört dann von selbst auf
   * und gibt ihr Ergebnis bis dahin zurück.
   */
  starte(art: string, titel: string, arbeit: (fortschritt: Fortschritt, signal?: AbortSignal) => Promise<unknown>, phasen: PhasenPlan[] = [], opt: { abbrechbar?: boolean } = {}): Auftrag {
    if (this.letzter?.status === 'laeuft') throw new Fachfehler(409, t('meldungen.auftrag.es-laeuft-bereits-bitte', { titel: this.letzter.titel }));
    const a: Auftrag = { id: randomUUID(), art, titel, status: 'laeuft', ...neuerStand(phasen), gestartet: new Date().toISOString(), ...(opt.abbrechbar ? { abbrechbar: true } : {}) };
    this.letzter = a;
    const signal = opt.abbrechbar ? (this.abbruch = new AbortController()).signal : undefined;
    if (!opt.abbrechbar) this.abbruch = undefined;
    const beginn = Date.now();
    void (async () => {
      try {
        a.ergebnis = await arbeit((fertig, gesamt, phase, extra) => meldeFortschritt(a, fertig, gesamt, phase, extra), signal);
        a.status = 'fertig';
        schliessePhasen(a);
        this.log(`${titel}: fertig nach ${Date.now() - beginn} ms`);
      } catch (e) {
        a.status = 'fehler';
        a.fehler = e instanceof Error ? e.message : String(e);
        this.log(`${titel}: Fehler – ${a.fehler}`);
      } finally {
        a.beendet = new Date().toISOString();
      }
    })();
    return a;
  }

  /** Den laufenden Auftrag abbrechen (#458) – nur, wenn er sich abbrechen lässt (und es dieser ist). */
  abbrechen(id?: unknown): Auftrag {
    const a = this.letzter;
    if (!a || a.status !== 'laeuft' || (id !== undefined && id !== a.id)) throw new Fachfehler(409, t('meldungen.auftrag.es-laeuft-gerade-kein'));
    if (!a.abbrechbar || !this.abbruch) throw new Fachfehler(409, t('meldungen.auftrag.laesst-sich-nicht-abbrechen', { titel: a.titel }));
    a.abgebrochen = true;
    this.abbruch.abort();
    this.log(`${a.titel}: abgebrochen`);
    return a;
  }

  /** Wartet, bis der aktuelle Auftrag beendet ist (für Tests). */
  async warte(): Promise<Auftrag | null> {
    while (this.letzter?.status === 'laeuft') await new Promise((r) => setTimeout(r, 10));
    return this.aktuell();
  }
}
