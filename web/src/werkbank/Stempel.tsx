import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useDaten } from '../daten';
import { Hilfe } from '../Hilfe';
import { Link, loeseWache } from '../ort';
import { rueckfrage } from '../rueckfrage';
import { Speicherleiste, useEntwurf } from '../Speicherleiste';
import { merkeStempelVorlagen } from '../ablage/Stempel';
import { beispielWerte, PlatzhalterKnoepfe, StempelVorschau } from '../ablage/StempelVorschau';
import { t, tn } from '../sprache';
import {
  DECKKRAFT_HINWEIS_AB, einzeilig, NEUER_STEMPEL, pruefeVorlage, STEMPEL_FARBEN, STEMPEL_LAGEN, STEMPEL_MODI, STEMPEL_NAME_MAX, STEMPEL_SEITEN, STEMPEL_TEXT_MAX,
  type Stempel, type StempelFarbe, type StempelLage, type StempelSeiten, type StempelVorlage,
} from '../../../shared/src/stempel';

/**
 * Werkbank → Stempel (#394): Vorlagen für Stempel und Wasserzeichen beim Weitergeben.
 *
 * Zweiteilig nach der Regel aus #366: Die Mitte gibt es nur für große Sammlungen. Stempel-Vorlagen sind
 * eine kleine Sammlung (meist vier bis zehn) – sie stehen rechts als aufklappbare Liste wie „Gesperrte
 * Adressen“; aufgeklappt wird eine Vorlage direkt bearbeitet. Es ist immer nur eine offen, damit es nur
 * eine Speicherleiste gibt. ?offen=<id> klappt eine Vorlage auf (alte Links /werkbank/stempel/:id leiten dorthin).
 */

export function useStempelVorlagenWerkbank(offen: boolean) {
  const [liste, setL] = useState<StempelVorlage[] | null>(null);
  const [fehler, setFehler] = useState<string>();
  const setListe = useCallback((l: StempelVorlage[]) => { merkeStempelVorlagen(l); setL(l); }, []);
  const laden = useCallback(async () => { try { setListe(await api.stempelVorlagen()); setFehler(undefined); } catch (e) { setFehler((e as Error).message); } }, [setListe]);
  useEffect(() => { if (offen) void laden(); }, [offen, laden]);
  return { liste, fehler, laden, setListe };
}
export type StempelZustand = ReturnType<typeof useStempelVorlagenWerkbank>;

export function StempelPanel({ z }: { z: StempelZustand }) {
  const d = useDaten();
  const ausAdresse = new URLSearchParams(location.search).get('offen');
  const [offen, setOffen] = useState<string | null>(ausAdresse);
  // Auch nach der Umleitung eines alten Links (/werkbank/stempel/:id → ?offen=:id) aufklappen.
  useEffect(() => { if (ausAdresse) setOffen(ausAdresse); }, [ausAdresse]);
  const umschalten = async (id: string) => {
    if (offen === id) { setOffen(null); return; }
    // Ungespeicherte Änderungen der offenen Vorlage nicht stillschweigend verwerfen.
    if (offen && document.querySelector('.stempeleditor[data-geaendert="ja"]') && !(await rueckfrage({ titel: t('werkbank.stempel.aenderungen-verwerfen'), text: t('werkbank.stempel.die-geoeffnete-vorlage-hat'), ja: t('werkbank.stempel.verwerfen'), gefahr: true }))) return;
    loeseWache(); setOffen(id);
  };
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">{t('werkbank.stempel.werkbank')}</p>
        <h1>{t('werkbank.stempel.stempel')}</h1>
        <p className="leise">{tn('werkbank.stempel.vorlagen-fuer-stempel-und', { hilfe: <Hilfe ort="werkbank.stempel" /> })}</p>
      </div>
      {z.fehler && <div className="hinweis schlecht"><p>{z.fehler}</p></div>}
      <div className="blatt stapel">
        <div className="zeile-zwischen"><h2 className="h3">{t('werkbank.stempel.vorlagen')}</h2>
          <button type="button" className="knopf gruen klein" disabled={offen === 'neu'} onClick={() => void umschalten('neu')}>{t('werkbank.stempel.neue-vorlage')}</button></div>
        {!z.liste ? <p className="leise">{t('werkbank.stempel.lade')}</p> : (
          <ul className="aufklappliste stempelvorlagen">
            {z.liste.map((v) => {
              const auf = offen === v.id;
              const genutzt = d.typen.filter((mappentyp) => mappentyp.stempel?.vorlage === v.id);
              return (
                <li key={v.id} className={auf ? 'an' : undefined}>
                  <button type="button" className="aufklappzeile" aria-expanded={auf} onClick={() => void umschalten(v.id)}>
                    <strong>{v.name}</strong> · <span className="stempeltext">{einzeilig(v.text)}</span> <span className="leise klein">· {t.frei(`werkbank.stempel.lage.${v.lage}`).replace(/ \(.*\)$/, '')}{genutzt.length ? ` · ${genutzt.map((mappentyp) => mappentyp.name).join(', ')}` : ''}</span>
                  </button>
                  {auf && <StempelEditor key={v.id} z={z} id={v.id} schliessen={() => setOffen(null)} />}
                </li>
              );
            })}
            {offen === 'neu' && <li className="an"><p className="aufklappzeile" aria-expanded="true"><strong>{t('werkbank.stempel.neue-vorlage-2')}</strong></p>
              <StempelEditor key="neu" z={z} id="neu" schliessen={() => setOffen(null)} geoeffnet={(id) => setOffen(id)} /></li>}
          </ul>
        )}
        {z.liste && !z.liste.length && offen !== 'neu' && <p className="leise">{t('werkbank.stempel.noch-keine-vorlage')}</p>}
      </div>
    </div>
  );
}

interface Entwurf extends Stempel { name: string }
const entwurfAus = (v: StempelVorlage | undefined): Entwurf => {
  const { text, lage, deckkraft, seiten, tinte, drehung, x, y, farbe, groesse } = v ?? NEUER_STEMPEL;
  return { name: v?.name ?? '', text, lage, deckkraft, seiten, tinte, drehung, x, y, farbe, groesse };
};

function StempelEditor({ z, id, schliessen, geoeffnet }: { z: StempelZustand; id: string; schliessen(): void; geoeffnet?: (id: string) => void }) {
  const d = useDaten();
  const neu = id === 'neu';
  const v = neu ? undefined : z.liste?.find((x) => x.id === id);
  // Neue Vorlagen beginnen mit 70 % und „wie Tinte“ (#799); bestehende behalten ihre Werte.
  const gespeichert = entwurfAus(v);
  const [e, setE] = useState(gespeichert);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  const [sendet, setSendet] = useState(false);
  const textfeld = useRef<HTMLTextAreaElement>(null);
  const ent = useEntwurf(gespeichert, e, { neu, zuruecksetzen: () => { setE(gespeichert); setMeldung(undefined); if (neu) schliessen(); } });
  if (!neu && !v) return z.liste ? <div className="leer"><p>{t('werkbank.stempel.diese-vorlage-gibt-es')}</p></div> : <p className="leise">{t('werkbank.stempel.lade')}</p>;
  const fehler = pruefeVorlage(e, (z.liste ?? []).filter((x) => x.id !== v?.id).map((x) => x.name));
  const genutzt = d.typen.filter((mappentyp) => mappentyp.stempel?.vorlage === v?.id);
  const setze = (p: Partial<Entwurf>) => setE((alt) => ({ ...alt, ...p }));
  async function speichern(werte = e) {
    setSendet(true); setMeldung(undefined);
    try {
      const l = neu ? await api.stempelVorlageAnlegen(werte) : await api.stempelVorlageAendern(v!.id, werte);
      z.setListe(l);
      if (neu) { loeseWache(); geoeffnet?.(l[l.length - 1].id); return; }
      setMeldung({ art: 'gut', text: t('werkbank.stempel.gespeichert') });
    } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); } finally { setSendet(false); }
  }
  async function loeschen() {
    if (!(await rueckfrage({ titel: t('werkbank.stempel.vorlage-loeschen', { name: v!.name }), text: t('werkbank.stempel.bereits-weitergegebene-kopien'), ja: t('werkbank.stempel.loeschen'), gefahr: true }))) return;
    try { z.setListe(await api.stempelVorlageLoeschen(v!.id)); loeseWache(); schliessen(); } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
  }
  const prozent = Math.round(e.deckkraft * 100);
  return (
    <div className="stempeleditor" data-geaendert={ent.geaendert ? 'ja' : 'nein'}>
      {meldung && <div className={`hinweis ${meldung.art}`}><p>{meldung.text}</p></div>}
      {/* Umstellung der entfallenen Haken (#799): nichts ändert sich heimlich – Hinweis, bis die Vorlage gespeichert ist. */}
      {v?.umgestellt && <div className="hinweis warn"><p>{t('werkbank.stempel.umgestellt')}</p>
        {!ent.geaendert && <p><button type="button" className="knopf klein" disabled={sendet} onClick={() => void speichern(gespeichert)}>{t('werkbank.stempel.umgestellt.ok')}</button></p>}</div>}
      <form onSubmit={(x) => { x.preventDefault(); void speichern(); }} onKeyDown={ent.tasten}>
        <div className="raster">
          <label className="eigenschaft"><span>{t('werkbank.stempel.name')}</span><input id="stempel-name" value={e.name} maxLength={STEMPEL_NAME_MAX} onChange={(x) => setze({ name: x.target.value })} required /></label>
          <div className="eigenschaft breit"><label htmlFor="stempel-text"><span>{t('werkbank.stempel.text')} <small>{t('werkbank.stempel.text.hilfe')}</small></span></label>
            <textarea id="stempel-text" ref={textfeld} rows={3} value={e.text} maxLength={STEMPEL_TEXT_MAX} onChange={(x) => setze({ text: x.target.value })} required />
            <PlatzhalterKnoepfe feld={() => textfeld.current} text={e.text} setze={(text) => setze({ text })} /></div>
          <label className="eigenschaft"><span>{t('werkbank.stempel.lage')}</span>
            <select id="stempel-lage" value={e.lage} onChange={(x) => setze({ lage: x.target.value as StempelLage })}>{Object.keys(STEMPEL_LAGEN).map((k) => <option key={k} value={k}>{t.frei(`werkbank.stempel.lage.${k}`)}</option>)}</select></label>
          <label className="eigenschaft"><span>{t('werkbank.stempel.seiten')}</span>
            <select id="stempel-seiten" value={e.seiten} onChange={(x) => setze({ seiten: x.target.value as StempelSeiten })}>{Object.keys(STEMPEL_SEITEN).map((k) => <option key={k} value={k}>{t.frei(`werkbank.stempel.seiten.${k}`)}</option>)}</select></label>
          <label className="eigenschaft"><span>{t('werkbank.stempel.farbe')}</span>
            <select id="stempel-farbe" value={e.farbe} onChange={(x) => setze({ farbe: x.target.value as StempelFarbe })}>{Object.keys(STEMPEL_FARBEN).map((k) => <option key={k} value={k}>{t.frei(`werkbank.stempel.farbe.${k}`)}</option>)}</select></label>
          <label className="eigenschaft"><span>{t('werkbank.stempel.groesse')} <small>{e.groesse} %</small></span>
            <input id="stempel-groesse" type="range" min={50} max={200} step={10} value={e.groesse} onChange={(x) => setze({ groesse: Number(x.target.value) })} /></label>
          <div className="eigenschaft"><label htmlFor="stempel-deckkraft"><span>{t('werkbank.stempel.deckkraft')} <small>{prozent} %</small></span></label>
            <input id="stempel-deckkraft" type="range" min={10} max={100} step={5} value={prozent} aria-describedby={e.deckkraft >= DECKKRAFT_HINWEIS_AB ? 'stempel-deckkraft-hinweis' : undefined} onChange={(x) => setze({ deckkraft: Number(x.target.value) / 100 })} />
            {e.deckkraft >= DECKKRAFT_HINWEIS_AB && <small id="stempel-deckkraft-hinweis" className="warntext" role="status">{t('werkbank.stempel.deckkraft.hinweis')}</small>}</div>
          <div className="eigenschaft"><label htmlFor="stempel-drehung"><span>{t('werkbank.stempel.drehung')} <small>{e.lage === 'diagonal' ? t('werkbank.stempel.drehung.diagonal') : `${e.drehung}°`}</small></span></label>
            <div className="zeile-mit-zahl">
              <input id="stempel-drehung" type="range" min={0} max={359} step={1} value={e.drehung} disabled={e.lage === 'diagonal'} onChange={(x) => setze({ drehung: Number(x.target.value) })} />
              <input id="stempel-drehung-zahl" type="number" min={0} max={359} step={1} value={e.drehung} disabled={e.lage === 'diagonal'} aria-label={`${t('werkbank.stempel.drehung')} (${t('werkbank.stempel.drehung.grad')})`}
                onChange={(x) => { const n = Number(x.target.value); if (Number.isFinite(n)) setze({ drehung: ((Math.round(n) % 360) + 360) % 360 }); }} />
            </div></div>
        </div>
        <label className="haken"><input id="stempel-tinte" type="checkbox" checked={e.tinte} onChange={(x) => setze({ tinte: x.target.checked })} />
          <span>{t('werkbank.stempel.tinte')} <small className="hilfe">{t('werkbank.stempel.tinte.hilfe')}</small></span></label>
        <h3 className="h3">{t('werkbank.stempel.vorschau')}</h3>
        <p className="leise klein">{t('werkbank.stempel.vorschau.hilfe')}</p>
        <StempelVorschau stempel={e} werte={beispielWerte()} setze={setze} />
        {Object.values(fehler).map((f) => <p key={f} className="fehlertext klein">{f}</p>)}
        <Speicherleiste ent={ent} gegenstand={t('werkbank.stempel.vorlage')} sendet={sendet} ungueltig={Object.keys(fehler).length > 0}
          links={!neu && <button type="button" className="textknopf gefahr" disabled={genutzt.length > 0} title={genutzt.length ? t('werkbank.stempel.ein-mappentyp-verwendet-sie') : undefined} onClick={() => void loeschen()}>{t('werkbank.stempel.vorlage-loeschen-2')}</button>} />
      </form>
      {!neu && <p className="leise klein">{t('werkbank.stempel.verwendet-in')}{' '}{genutzt.length ? genutzt.map((mappentyp, i) => <span key={mappentyp.id}>{i > 0 && ', '}<Link to={`/werkbank/typen/${mappentyp.id}`} className="verweis">{mappentyp.name}</Link> ({STEMPEL_MODI[mappentyp.stempel!.modus]})</span>)
        : t('werkbank.stempel.keinem-mappentyp-das-stellst')}</p>}
    </div>
  );
}
