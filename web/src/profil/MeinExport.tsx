import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useKonto } from '../konto';
import { Hilfe } from '../Hilfe';
import { t, tn } from '../sprache';

/** Profil → Meine Daten exportieren (#255): eigene Daten im Format des Vollexports. */
export function MeinExport() {
  const { vertretung } = useKonto();
  const [s, setS] = useState<Awaited<ReturnType<typeof api.meinExport>> | null>(null);
  const [pw, setPw] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async () => { try { setS(await api.meinExport()); } catch (e) { setFehler((e as Error).message); } }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { if (!s?.laeuft) return; const timer = setInterval(() => void laden(), 2000); return () => clearInterval(timer); }, [s?.laeuft, laden]);
  if (!s) return null;
  return (
    <div className="blatt" id="export">
      <h2 className="h3">{tn('profil.meinexport.meine-daten-exportieren', { hilfe: <Hilfe ort="profil.export" /> })}</h2>
      {!s.erlaubt ? <p className="leise">{t('profil.meinexport.der-persoenliche-export-ist')}</p> : <>
        <p className="leise">{t('profil.meinexport.alle-mappen-die-du')}</p>
        <label className="haken"><input type="checkbox" checked={pw} onChange={(e) => { setPw(e.target.checked); if (!e.target.checked) setPwOk(false); }} /><span>{tn('profil.meinexport.passwortfelder-die-ich-sehen', { klein: <small className="hilfe">{t('profil.meinexport.als-passwoerter-csv-fuer')}</small> })}</span></label>
        {pw && <label className="haken einzug"><input type="checkbox" checked={pwOk} onChange={(e) => setPwOk(e.target.checked)} /><span className="fehlertext">{t('profil.meinexport.mir-ist-klar-die')}</span></label>}
        {s.laeuft && <p className="leise">{t('profil.meinexport.export-laeuft')}</p>}
        {s.fehler && <p className="fehlertext">{s.fehler}</p>}
        {fehler && <p className="fehlertext">{fehler}</p>}
        {s.fertig && !s.laeuft && <p>{tn('profil.meinexport.fertig-am', { wert: s.fertig.erstellt ? new Date(s.fertig.erstellt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–', link: <a className="knopf klein" href="/api/konto/export/zip">{t('profil.meinexport.herunterladen-zip')}</a>, klein: <small className="hilfe">{t('profil.export.bereit', { datum: new Date(s.fertig.bis).toLocaleDateString('de-DE', { dateStyle: 'medium' }) })}</small> })}</p>}
        <div className="knoepfe"><button type="button" className="knopf" disabled={s.laeuft || (pw && !pwOk) || !!vertretung}
          onClick={() => { setFehler(undefined); void api.meinExportStarten(pw, pwOk).then(laden).catch((e) => setFehler((e as Error).message)); }}>{s.fertig ? t('profil.meinexport.neu-exportieren') : t('profil.meinexport.export-erstellen')}</button></div>
      </>}
    </div>
  );
}
