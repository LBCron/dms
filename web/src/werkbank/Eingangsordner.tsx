import { useCallback, useEffect, useState } from 'react';
import { api, type EingangEinstellung, type EingangStand } from '../api';
import { Link } from '../ort';
import { Hilfe } from '../Hilfe';
import { Speicherleiste, useEntwurf } from '../Speicherleiste';
import { t, tn } from '../sprache';
import { gebietsschema } from '../../../shared/src/sprache';

/**
 * Werkbank → Eingangsordner (#195): Ein/Aus, Prüfabstand, was nach dem Übernehmen geschieht,
 * zuletzt übernommene Dateien und Fehler. Nur sichtbar, wenn /eingang eingebunden ist.
 */

const zeit = (iso: string) => new Date(iso).toLocaleString(gebietsschema(), { dateStyle: 'short', timeStyle: 'medium' });

export function useEingangsordner(offen: boolean) {
  const [stand, setStand] = useState<EingangStand | null>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async () => {
    try { setStand(await api.eingangsordner()); setFehler(undefined); } catch (e) { setFehler((e as Error).message); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    if (!offen) return;
    const timer = setInterval(() => void laden(), 10_000);
    return () => clearInterval(timer);
  }, [offen, laden]);
  return { stand, fehler, laden, setStand };
}
export type EingangZustand = ReturnType<typeof useEingangsordner>;

export function EingangsordnerPanel({ z }: { z: EingangZustand }) {
  const s = z.stand;
  const [e, setE] = useState<EingangEinstellung | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  const [sendet, setSendet] = useState(false);
  useEffect(() => { if (s?.einstellung && !e) setE(s.einstellung); }, [s, e]);
  const ent = useEntwurf(s?.einstellung ?? null, e, { aus: !e, zuruecksetzen: () => { setE(s?.einstellung ?? null); setMeldung(undefined); } });
  if (!s) return <p className="leise">{z.fehler ?? t('werkbank.eingangsordner.lade')}</p>;
  if (!s.vorhanden || !e) {
    return (
      <div className="einspaltig"><div className="mappenkopf"><p className="ueber">{t('werkbank.eingangsordner.werkbank')}</p><h1>{t('werkbank.eingangsordner.eingangsordner')}</h1>
        <p className="leise">{tn('werkbank.eingangsordner.es-ist-kein-eingangsordner', { code: <code>{'/eingang'}</code>, hilfe: <Hilfe ort="werkbank.eingangsordner" /> })}</p></div></div>
    );
  }
  async function speichern() {
    setSendet(true);
    try { const n = await api.eingangsordnerSetzen(e!); z.setStand(n); setE(n.einstellung ?? e); setMeldung({ art: 'gut', text: t('werkbank.eingangsordner.gespeichert') }); } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); } finally { setSendet(false); }
  }
  async function jetzt() {
    try { const r = await api.eingangsordnerPruefen(); z.setStand(r.stand); setMeldung({ art: 'gut', text: r.uebernommen ? t('werkbank.eingangsordner.dateien-uebernommen', { anzahl: r.uebernommen }) : t('werkbank.eingangsordner.geprueft-nichts-fertiges-gefunden') }); } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
  }
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">{t('werkbank.eingangsordner.werkbank')}</p>
        <h1>{t('werkbank.eingangsordner.eingangsordner')}</h1>
        <p className="leise">{tn('werkbank.eingangsordner.jede-fertige-datei-im', { code: <code>{s.pfad}</code>, code2: <code>{t('werkbank.eingangsordner.eingang-lena')}</code>, hilfe: <Hilfe ort="werkbank.eingangsordner" /> })}</p>
      </div>
      {meldung && <div className={`hinweis ${meldung.art}`}><p>{meldung.text}</p></div>}
      {s.pausiert && <div className="hinweis warn"><p>{t('werkbank.eingangsordner.ruht-gerade', { pausiert: s.pausiert })}</p></div>}
      {s.andereInstanz && <div className="hinweis warn"><p>{t('werkbank.eingangsordner.eine-andere-instanz-von')}</p></div>}
      <form className="blatt" onSubmit={(x) => { x.preventDefault(); void speichern(); }} onKeyDown={ent.tasten}>
        <h2 className="h3">{t('werkbank.eingangsordner.einstellungen')}</h2>
        <label className="haken"><input id="eingang-aktiv" type="checkbox" checked={e.aktiv} onChange={(x) => setE({ ...e, aktiv: x.target.checked })} /><span>{t('werkbank.eingangsordner.eingangsordner-pruefen')}</span></label>
        <div className="raster">
          <label className="eigenschaft"><span>{tn('werkbank.eingangsordner.pruefabstand', { klein: <small>{t('werkbank.eingangsordner.in-sekunden-5-bis')}</small> })}</span>
            <input id="eingang-abstand" type="number" min={5} max={3600} value={e.abstand} onChange={(x) => setE({ ...e, abstand: Number(x.target.value) })} /></label>
          <label className="eigenschaft"><span>{t('werkbank.eingangsordner.nach-dem-uebernehmen')}</span>
            <select id="eingang-nachher" value={e.nachher} onChange={(x) => setE({ ...e, nachher: x.target.value as EingangEinstellung['nachher'] })}>
              <option value="erledigt">{t('werkbank.eingangsordner.in-erledigt-verschieben')}</option>
              <option value="loeschen">{t('werkbank.eingangsordner.loeschen')}</option>
            </select></label>
        </div>
        <label className="haken"><input type="checkbox" checked={e.doppelteUeberspringen === true} onChange={(x) => setE({ ...e, doppelteUeberspringen: x.target.checked })} />
          <span>{tn('werkbank.eingangsordner.doppelte-dateien-ueberspringen', { klein: <small className="leise">{t('werkbank.eingangsordner.liegt-genau-diese-datei')}</small> })}</span></label>
        <div className="knoepfe">
          <button type="button" className="knopf" onClick={() => void jetzt()}>{t('werkbank.eingangsordner.jetzt-pruefen')}</button>
        </div>
        <Speicherleiste ent={ent} gegenstand={t('werkbank.eingangsordner.einstellungen')} sendet={sendet} />
      </form>
      <div className="blatt">
        <h2 className="h3">{t('werkbank.eingangsordner.stand')}</h2>
        <dl className="eigenschaften">
          <dt>{t('werkbank.eingangsordner.letzte-pruefung')}</dt><dd>{s.letztePruefung ? zeit(s.letztePruefung) : '–'}</dd>
          <dt>{t('werkbank.eingangsordner.noch-nicht-fertig')}</dt><dd>{s.wartend ?? 0} {s.wartend === 1 ? t('werkbank.eingangsordner.datei') : t('werkbank.eingangsordner.dateien')} <span className="leise klein">{t('werkbank.eingangsordner.werden-uebernommen-sobald-sie')}</span></dd>
        </dl>
        {(s.fehler ?? []).length > 0 && <>
          <h3 className="h4">{t('werkbank.eingangsordner.fehler')}</h3>
          <ul>{(s.fehler ?? []).map((f) => <li key={`${f.datei}-${f.zeit}`}><strong>{f.datei}</strong> ({zeit(f.zeit)}): {f.grund}</li>)}</ul>
          <p className="leise klein">{tn('werkbank.eingangsordner.abgelehnte-dateien-liegen-in', { code: <code>{t('werkbank.eingangsordner.fehler-2')}</code> })}</p>
        </>}
      </div>
      <div className="blatt" id="uebernommen">
        <h2 className="h3">{t('werkbank.eingangsordner.zuletzt-uebernommen')}</h2>
        {!(s.uebernommen ?? []).length ? <p className="leise">{t('werkbank.eingangsordner.noch-nichts-uebernommen')}</p> : (
          <ul className="sitzungsliste festhoehe">
            {(s.uebernommen ?? []).map((u) => (
              <li key={`${u.datei}-${u.zeit}`}>
                <span><strong>{u.datei}</strong> <span className="leise klein">{zeit(u.zeit)}</span></span>
                {u.mappeId && <Link to={`/ablage/eingang/${u.mappeId}`} className="verweis klein">{t('werkbank.eingangsordner.post-oeffnen')}</Link>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
