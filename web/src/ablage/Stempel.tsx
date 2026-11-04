import { useEffect, useRef, useState } from 'react';
import type { Dokument, Mappentyp } from '../../../shared/src/model';
import {
  DECKKRAFT_HINWEIS_AB, NEUER_STEMPEL, platzhalterIn, STEMPEL_LAGEN, STEMPEL_SEITEN, STEMPEL_TEXT_MAX,
  type Stempel, type StempelLage, type StempelSeiten, type StempelTyp, type StempelVorlage, type StempelWunsch,
} from '../../../shared/src/stempel';
import { t } from '../sprache';
import { beispielWerte, PlatzhalterKnoepfe, StempelVorschau } from './StempelVorschau';
import { api } from '../api';
import { Hilfe } from '../Hilfe';
import { VerkleinertWahl } from './VerkleinertWahl';
import type { Stufe } from '../../../shared/src/verkleinern';
import { useKonto } from '../konto';
import { FassungWahl, hatArchivfassung, type Fassung } from './FassungWahl';

/**
 * Stempel beim Weitergeben (#394): dieselben Felder beim Herunterladen, beim Export und bei der E-Mail.
 * Das gespeicherte Original bleibt unverändert; der Server stempelt nur die ausgegebene Kopie.
 */

let zwischenspeicher: StempelVorlage[] | null = null;
/** Vorlagen (einmal je Sitzung geladen; die Werkbank setzt sie nach dem Speichern neu). */
export function useStempelVorlagen(): StempelVorlage[] | null {
  const [v, setV] = useState(zwischenspeicher);
  useEffect(() => { if (!zwischenspeicher) void api.stempelVorlagen().then((x) => { zwischenspeicher = x; setV(x); }, () => setV([])); }, []);
  return v;
}
export const merkeStempelVorlagen = (v: StempelVorlage[]) => { zwischenspeicher = v; };

export interface StempelWahl extends Stempel { an: boolean; vorlage: string; empfaenger: string }

/** Werte einer Vorlage; ohne Vorlage die Vorgaben für einen neuen Stempel (70 %, „wie Tinte“, #799). */
const ausVorlage = (v: StempelVorlage | undefined): Stempel & { vorlage: string } => {
  const { text, lage, deckkraft, seiten, tinte, drehung, x, y, farbe, groesse } = v ?? NEUER_STEMPEL;
  return { vorlage: v?.id ?? '', text, lage, deckkraft, seiten, tinte, drehung, x, y, farbe, groesse };
};

/** Startwerte: Schlägt der Mappentyp einen Stempel vor oder verlangt ihn, ist er an – mit seiner Vorlage. */
export function stempelStart(vorlagen: StempelVorlage[], typ?: StempelTyp | null): StempelWahl {
  const v = vorlagen.find((x) => x.id === typ?.vorlage) ?? vorlagen[0];
  return { an: !!typ, empfaenger: '', ...ausVorlage(v) };
}

/** Was an den Server geht; ohne Stempel `null` (bei Pflicht stempelt der Server trotzdem). */
export function alsWunsch(w: StempelWahl | null): StempelWunsch | null {
  if (!w?.an) return null;
  const { an: _an, vorlage, ...rest } = w;
  return { ...rest, ...(vorlage ? { vorlage } : {}) };
}

/** Fehler, bevor man abschickt; `ersatz` = Empfänger, wenn keiner eingegeben ist (z. B. E-Mail-Adressen). */
export function stempelFehler(w: StempelWahl | null, ersatz = ''): string | null {
  if (!w?.an) return null;
  if (!w.text.trim()) return 'Gib einen Text für den Stempel ein.';
  if (platzhalterIn(w.text).includes('empfaenger') && !w.empfaenger.trim() && !ersatz.trim()) return 'Gib den Empfänger an – der Stempel nennt ihn.';
  return null;
}

/** Strengster Stempel mehrerer Mappentypen: Pflicht vor Vorschlag. */
export function stempelVon(typen: Array<Mappentyp | undefined>): StempelTyp | null {
  const s = typen.map((t) => t?.stempel).filter((x): x is StempelTyp => !!x);
  return s.find((x) => x.modus === 'pflicht') ?? s[0] ?? null;
}

export function StempelFelder({ wahl, setze, vorlagen, pflicht, mappe, empfaengerErsatz, id = 'stempel', immer }: {
  wahl: StempelWahl; setze(w: StempelWahl): void; vorlagen: StempelVorlage[];
  /** Der Mappentyp verlangt einen Stempel: lässt sich nicht abschalten. */
  pflicht?: boolean;
  /** Für die Vorschau des Platzhalters {mappe}. */
  mappe?: string;
  /** Hinweis, was ohne Empfänger gilt (E-Mail: die Adressen). */
  empfaengerErsatz?: string;
  id?: string;
  /** Im Dialog „Herunterladen mit Stempel“: immer an, ohne Kästchen. */
  immer?: boolean;
}) {
  const { ich } = useKonto();
  const nutztEmpfaenger = platzhalterIn(wahl.text).includes('empfaenger');
  const werte = { ...beispielWerte(), empfaenger: wahl.empfaenger.trim() || empfaengerErsatz || '…', benutzer: ich?.name || ich?.email, mappe: mappe ?? '…', archivnummer: 'A-000123' };
  const s = (p: Partial<StempelWahl>) => setze({ ...wahl, ...p });
  const textfeld = useRef<HTMLTextAreaElement>(null);
  return (
    <fieldset className="stempelwahl">
      <legend className="sr">Stempel</legend>
      {immer ? <p className="leise klein">{pflicht ? 'Der Mappentyp verlangt beim Weitergeben einen Stempel. ' : ''}Nur die Kopie bekommt den Stempel, das gespeicherte Original bleibt unverändert. Bilder werden dabei zum PDF. <Hilfe ort="stempel.weitergeben" /></p>
      : <label className="haken"><input id={`${id}-an`} type="checkbox" checked={wahl.an || !!pflicht} disabled={pflicht} onChange={(e) => s({ an: e.target.checked })} />
        <span>Mit Stempel <Hilfe ort="stempel.weitergeben" />
          <small className="hilfe">{pflicht ? 'Der Mappentyp verlangt beim Weitergeben einen Stempel.' : 'Nur die Kopie bekommt den Stempel, das gespeicherte Original bleibt unverändert. Bilder werden dabei zum PDF.'}</small></span></label>}
      {(wahl.an || pflicht || immer) && (
        <div className="stempelfelder">
          <div className="raster">
            <label className="eigenschaft"><span>Vorlage</span>
              <select id={`${id}-vorlage`} value={wahl.vorlage} onChange={(e) => setze({ ...wahl, ...ausVorlage(vorlagen.find((v) => v.id === e.target.value)), vorlage: e.target.value })}>
                <option value="">– eigener Text –</option>
                {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select></label>
            <label className="eigenschaft"><span>Empfänger {!nutztEmpfaenger && <small>nur für {'{empfänger}'}</small>}</span>
              <input id={`${id}-empfaenger`} value={wahl.empfaenger} maxLength={120} onChange={(e) => s({ empfaenger: e.target.value })}
                placeholder={empfaengerErsatz ? `ohne Angabe: ${empfaengerErsatz}` : 'z. B. Hausverwaltung Müller'} required={nutztEmpfaenger && !empfaengerErsatz} /></label>
            <div className="eigenschaft breit"><label htmlFor={`${id}-text`}><span>{t('werkbank.stempel.text')}</span></label>
              <textarea id={`${id}-text`} ref={textfeld} rows={2} value={wahl.text} maxLength={STEMPEL_TEXT_MAX} onChange={(e) => s({ text: e.target.value, vorlage: '' })} />
              <PlatzhalterKnoepfe feld={() => textfeld.current} text={wahl.text} setze={(text) => s({ text, vorlage: '' })} /></div>
            <label className="eigenschaft"><span>{t('werkbank.stempel.lage')}</span>
              <select id={`${id}-lage`} value={wahl.lage} onChange={(e) => s({ lage: e.target.value as StempelLage })}>
                {Object.keys(STEMPEL_LAGEN).map((k) => <option key={k} value={k}>{t.frei(`werkbank.stempel.lage.${k}`)}</option>)}
              </select></label>
            <div className="eigenschaft"><label htmlFor={`${id}-deckkraft`}><span>{t('werkbank.stempel.deckkraft')} <small>{Math.round(wahl.deckkraft * 100)} %</small></span></label>
              <input id={`${id}-deckkraft`} type="range" min={10} max={100} step={5} value={Math.round(wahl.deckkraft * 100)} onChange={(e) => s({ deckkraft: Number(e.target.value) / 100 })} />
              {wahl.deckkraft >= DECKKRAFT_HINWEIS_AB && <small className="warntext" role="status">{t('werkbank.stempel.deckkraft.hinweis')}</small>}</div>
            <label className="eigenschaft"><span>{t('werkbank.stempel.seiten')}</span>
              <select id={`${id}-seiten`} value={wahl.seiten} onChange={(e) => s({ seiten: e.target.value as StempelSeiten })}>
                {Object.keys(STEMPEL_SEITEN).map((k) => <option key={k} value={k}>{t.frei(`werkbank.stempel.seiten.${k}`)}</option>)}
              </select></label>
          </div>
          <div className="stempelzeile">
            <div className="stempelvorschau-klein"><StempelVorschau stempel={wahl} werte={werte} beispiele={['rechnung']} /></div>
            <div>
              <label className="haken"><input id={`${id}-tinte`} type="checkbox" checked={wahl.tinte} onChange={(e) => s({ tinte: e.target.checked })} />
                <span>{t('werkbank.stempel.tinte')} <small className="hilfe">{t('werkbank.stempel.tinte.hilfe')}</small></span></label>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** Dialog „Herunterladen mit Stempel“ an einem Dokument (auch für ältere Versionen). */
export function StempelDialog({ d, typ, mappe, version, schliessen }: { d: Dokument; typ?: Mappentyp; mappe: string; version?: number; schliessen(): void }) {
  const vorlagen = useStempelVorlagen();
  const [wahl, setWahl] = useState<StempelWahl | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  // Verkleinert (#393): erst verkleinern, dann stempeln – nur für PDFs.
  const [klein, setKlein] = useState<Stufe | null>(null);
  // Archivfassung oder Original (#715); ältere Versionen haben keine Archivfassung.
  const [fassung, setFassung] = useState<Fassung>('archiv');
  const mitArchiv = !version && hatArchivfassung(d);
  useEffect(() => { if (vorlagen && !wahl) setWahl({ ...stempelStart(vorlagen, typ?.stempel), an: true }); }, [vorlagen, wahl, typ]);
  const pflicht = typ?.stempel?.modus === 'pflicht';
  const fehler = stempelFehler(wahl);
  async function los() {
    if (!wahl) return;
    setLaeuft(true); setMeldung(undefined);
    try {
      const r = await api.herunterladenMitStempel(d.id, alsWunsch({ ...wahl, an: true }), d.name, version, d.mime === 'application/pdf' || (mitArchiv && fassung === 'archiv') ? klein : null, mitArchiv ? fassung : undefined);
      setMeldung({ art: 'gut', text: `„${r.name}“ gespeichert. Die Historie der Mappe vermerkt die Weitergabe.` });
    } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); } finally { setLaeuft(false); }
  }
  return (
    <div className="exportdialog blatt stempeldialog" role="dialog" aria-label="Herunterladen mit Stempel">
      <div className="blattkopf zeile-zwischen"><h2 className="h3">Herunterladen mit Stempel</h2>
        <button type="button" className="textknopf" onClick={schliessen}>Schließen</button></div>
      <p className="leise klein">{d.name}{version ? ` · Version ${version}` : ''}</p>
      {!wahl || !vorlagen ? <p className="leise">Lade …</p> : (
        // Kein eigenes <form>: Der Dialog steht im Formular der Mappe; Enter lädt herunter statt die Mappe zu speichern.
        <div onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); if (!fehler && !laeuft) void los(); } }}>
          <StempelFelder wahl={{ ...wahl, an: true }} setze={setWahl} vorlagen={vorlagen} pflicht={pflicht} mappe={mappe} id={`stempel-${d.id}`} immer />
          {!version && <FassungWahl wert={fassung} setze={setFassung} dokumente={[d]} id={`stempel-fassung-${d.id}`} />}
          {(d.mime === 'application/pdf' || (mitArchiv && fassung === 'archiv')) && <VerkleinertWahl wert={klein} setze={setKlein} wie="herunterladen" id={`stempel-klein-${d.id}`} />}
          {fehler && <p className="leise klein">{fehler}</p>}
          {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
          <div className="knoepfe">
            <button type="button" className="knopf primaer" disabled={laeuft || !!fehler} onClick={() => void los()}>{laeuft ? 'Wird gestempelt …' : 'Herunterladen'}</button>
            <button type="button" className="knopf" onClick={schliessen}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
