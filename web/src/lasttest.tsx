import { useCallback, useEffect, useRef, useState } from 'react';
import { fuelleErgebnis, GERAET_MAX, PLATZHALTER, restMinuten, type LasttestStand, type Speicherwahl } from '../../shared/src/lasttest';
import { handbuchUrl } from '../../shared/src/hilfe';
import { api } from './api';
import { rueckfrage } from './rueckfrage';
import { t } from './sprache';
import { Symbol } from './Symbol';

/**
 * Lasttest-Modus (#612): die einzige Seite, die ein mit DMS_LASTTEST gestartetes DMS zeigt. Fortschritt und Restdauer,
 * Gerät und Speicher (gehen sofort in den Ergebnisblock), am Ende Bericht und Block zum Kopieren oder Herunterladen,
 * Links zum Formular und zum Sammel-Issue und der Knopf zum Herunterfahren. Keine Zugangsdaten, keine Adressen.
 */

const FORMULAR = 'https://github.com/motom001/dms/issues/new?template=messergebnis-lasttest.yml';
const SAMMEL = 'https://github.com/motom001/dms/issues/576';
const zahl = (n: number) => n.toLocaleString('de-DE');
const prozent = (q: number) => `${(q * 100).toFixed(2).replace('.', ',')} %`;

/** Kopieren auch ohne HTTPS (NAS im Heimnetz): Zwischenablage, sonst markieren und execCommand. */
async function kopiere(text: string, feld: HTMLTextAreaElement | null): Promise<boolean> {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* weiter */ }
  if (!feld) return false;
  feld.focus(); feld.select();
  try { return document.execCommand('copy'); } catch { return false; }
}

function herunterladen(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LasttestSeite() {
  const [stand, setStand] = useState<LasttestStand | null>(null);
  const [fehler, setFehler] = useState<string>();
  const [geraet, setGeraet] = useState<string | null>(null);
  const [speicher, setSpeicher] = useState<Speicherwahl | null | undefined>(undefined);
  const [kopiert, setKopiert] = useState<'ja' | 'nein' | null>(null);
  const [beendet, setBeendet] = useState(false);
  const feld = useRef<HTMLTextAreaElement>(null);
  const senden = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Wann der Stand kam (Uhr des Browsers): Die Restdauer rechnet mit der Uhr des Servers weiter. */
  const geholt = useRef(0);

  const hole = useCallback(async () => {
    try { const s = await api.lasttest(); geholt.current = Date.now(); setStand(s); setFehler(undefined); } catch (e) { setFehler((e as Error).message); }
  }, []);
  useEffect(() => { void hole(); }, [hole]);
  const laeuft = !beendet && (!stand || stand.zustand === 'laeuft');
  useEffect(() => {
    if (!laeuft) return;
    const z = setInterval(() => void hole(), 2000);
    return () => clearInterval(z);
  }, [laeuft, hole]);
  // Sekunden des Durchgangs mitzählen, ohne den Server öfter zu fragen.
  const [, setTick] = useState(0);
  useEffect(() => { const z = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(z); }, []);

  if (!stand) {
    return <div className="kartenseite"><div className="karte breit"><h1>{t('lasttest.titel')}</h1>{fehler ? <div className="hinweis schlecht"><p>{fehler}</p></div> : <p className="leise">{t('anmeldung.lade')}</p>}</div></div>;
  }

  // Eingaben gehen sofort in den Block; der Server bekommt sie kurz danach (für die Datei unter /data/ergebnis).
  const angaben = { geraet: geraet ?? stand.angaben.geraet, speicher: speicher === undefined ? stand.angaben.speicher : speicher };
  const merke = (a: Partial<LasttestStand['angaben']>) => {
    clearTimeout(senden.current);
    senden.current = setTimeout(() => { void api.lasttestAngaben(a).catch(() => {}); }, 400);
  };
  const block = stand.ergebnis ? fuelleErgebnis(stand.ergebnis.vorlage, angaben, stand.speicherErkannt) : '';
  const zeile = fuelleErgebnis(`${PLATZHALTER.geraet}\n${PLATZHALTER.speicher}`, angaben, stand.speicherErkannt).split('\n');
  const jetzt = stand.jetzt + (Date.now() - geholt.current);
  const rest = restMinuten({ ...stand, jetzt });
  const zustand = beendet ? 'beendet' : stand.zustand;
  const textDatei = stand.ergebnis ? `${stand.ergebnis.bericht}\n\n### ${t('lasttest.ergebnis')}\n\n${block}\n` : '';

  async function beenden() {
    const ja = await rueckfrage({ titel: t('lasttest.beenden.frage'), text: zustand === 'laeuft' ? t('lasttest.beenden.frage.laeuft') : t('lasttest.beenden.frage.text'), ja: t('lasttest.beenden.frage.ja'), gefahr: true });
    if (!ja) return;
    try { await api.lasttestBeenden(); setBeendet(true); } catch (e) { setFehler((e as Error).message); }
  }

  return (
    <div className="kartenseite">
      <div className="karte breit lasttest">
        <h1>{t('lasttest.titel')}{stand.stufe ? ` – ${t.frei(`lasttest.stufe.${stand.stufe}`)}` : ''}</h1>
        <p className="leise">{t('lasttest.unter')}</p>

        <div className="lasttest-stand" role="status" aria-live="polite">
          {zustand === 'laeuft' && (
            <>
              {stand.stufe && <p className="klein leise">{t('lasttest.stufe', { nr: stand.nr, von: stand.von })}</p>}
              <p><strong>{t.frei(`lasttest.schritt.${stand.schritt}`)}</strong></p>
              {stand.demo && (<><progress max={stand.demo.gesamt || 1} value={stand.demo.fertig} /><p className="klein leise">{t('lasttest.demo', { fertig: zahl(stand.demo.fertig), gesamt: zahl(stand.demo.gesamt) })}</p></>)}
              {stand.durchgang && <p className="klein">{t('lasttest.durchgang', { name: stand.durchgang.name, n: stand.durchgang.n, sekunden: Math.max(0, Math.round((stand.durchgang.ende - jetzt) / 1000)) })}</p>}
              <p className="lasttest-rest"><Symbol name="stoppuhr" /> {rest ? (rest[0] === rest[1] ? t('lasttest.rest.eine', { bis: rest[1] }) : t('lasttest.rest', { von: rest[0], bis: rest[1] })) : t('lasttest.rest.gleich')}</p>
            </>
          )}
          {zustand === 'fertig' && <div className="hinweis gut"><p><Symbol name="haken" /> <strong>{t('lasttest.fertig')}</strong>{stand.ergebnis?.verfehlt ? ` ${t('lasttest.fertig.verfehlt')}` : ''}</p></div>}
          {(zustand === 'abbruch' || zustand === 'fehler') && (
            <div className="hinweis schlecht"><p><Symbol name="warnung" /> <strong>{t(zustand === 'abbruch' ? 'lasttest.abbruch' : 'lasttest.fehler')}</strong> {stand.meldung} {zustand === 'fehler' ? t('lasttest.fehler.protokoll') : ''}</p></div>
          )}
          {zustand === 'beendet' && <div className="hinweis info"><p><strong>{t('lasttest.beendet')}</strong> {t('lasttest.beendet.text')}</p></div>}
          {!!stand.durchgaenge.length && (
            <ul className="klein leise lasttest-durchgaenge">
              {stand.durchgaenge.map((d, i) => <li key={i}>{t('lasttest.durchgang.fertig', { name: d.name, p95: d.p95 ?? '–', fehler: prozent(d.fehlerquote) })}</li>)}
            </ul>
          )}
        </div>
        {fehler && <div className="hinweis schlecht"><p>{fehler}</p></div>}

        <div className="formular">
          <label className="feld breit">
            <span>{t('lasttest.geraet')}</span>
            <input value={angaben.geraet} maxLength={GERAET_MAX} placeholder={t('lasttest.geraet.beispiel')} disabled={zustand === 'beendet'}
              onChange={(e) => { setGeraet(e.target.value); merke({ geraet: e.target.value }); }} />
            <span className="klein leise">{t('lasttest.geraet.hinweis')}</span>
          </label>
          <label className="feld">
            <span>{t('lasttest.speicher')}</span>
            <select value={angaben.speicher ?? ''} disabled={zustand === 'beendet'}
              onChange={(e) => { const w = (e.target.value || null) as Speicherwahl | null; setSpeicher(w); merke({ speicher: w }); }}>
              {!angaben.speicher && <option value="">{t('lasttest.speicher.waehlen')}</option>}
              {(['HDD', 'SSD', 'NVMe'] as const).map((a) => <option key={a} value={a}>{a === stand.speicherErkannt ? t('lasttest.speicher.erkannt', { art: a }) : a}</option>)}
              <option value="unbekannt">{t('lasttest.speicher.unbekannt')}</option>
            </select>
            <span className="klein leise">{stand.speicherErkannt ? t('lasttest.speicher.hinweis.erkannt', { art: stand.speicherErkannt }) : t('lasttest.speicher.hinweis.offen')}</span>
          </label>
          <p className="feld breit klein leise lasttest-auto">{t('lasttest.automatisch')}</p>
        </div>

        <section className="lasttest-ergebnis" aria-labelledby="lasttest-ergebnis">
          <h2 id="lasttest-ergebnis">{t('lasttest.ergebnis')}</h2>
          {!stand.ergebnis ? (
            <>
              <p className="leise">{t('lasttest.ergebnis.warten')}</p>
              <p className="klein mono umbruch">{t('lasttest.vorschau', { geraet: zeile[0], speicher: zeile[1] })}</p>
            </>
          ) : (
            <>
              <p className="klein leise">{t('lasttest.ergebnis.text')}</p>
              <textarea ref={feld} className="mono lasttest-block" readOnly value={block} rows={block.split('\n').length} aria-label={t('lasttest.ergebnis')} />
              <div className="knoepfe">
                <button type="button" className="knopf primaer" onClick={() => void kopiere(block, feld.current).then((ok) => setKopiert(ok ? 'ja' : 'nein'))}>{kopiert === 'ja' ? <><Symbol name="haken" /> {t('lasttest.kopiert')}</> : t('lasttest.kopieren')}</button>
                <button type="button" className="knopf" onClick={() => herunterladen(`lasttest-${stand.wahl}.md`, textDatei)}>{t('lasttest.herunterladen')}</button>
                <a className="knopf" href={FORMULAR} target="_blank" rel="noreferrer">{t('lasttest.formular')} <Symbol name="extern" /></a>
                <a className="knopf" href={SAMMEL} target="_blank" rel="noreferrer">{t('lasttest.sammel')} <Symbol name="extern" /></a>
              </div>
              {kopiert === 'nein' && <p className="klein fehlertext" role="alert">{t('lasttest.kopieren.geht-nicht')}</p>}
              {stand.datei && <p className="klein leise">{t('lasttest.datei', { datei: stand.datei })}</p>}
              <details><summary>{t('lasttest.bericht')}</summary><pre className="lasttest-bericht">{stand.ergebnis.bericht}</pre></details>
            </>
          )}
        </section>

        <div className="knoepfe lasttest-ende">
          <a className="verweis klein" href={handbuchUrl('admin', null, 'lasttest/')} target="_blank" rel="noreferrer">{t('lasttest.handbuch')} <Symbol name="extern" /></a>
          {zustand !== 'beendet' && <button type="button" className="knopf gefahr-rand" onClick={() => void beenden()}>{t('lasttest.beenden')}</button>}
        </div>
      </div>
    </div>
  );
}
