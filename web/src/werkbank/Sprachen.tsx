import { useCallback, useEffect, useState } from 'react';
import { setzeErlaubteSprachen, sprachname } from '../../../shared/src/beschriftung';
import { AUSGANGSSPRACHE, EINGEBAUTE_SPRACHEN } from '../../../shared/src/sprache';
import { api, type SprachenStand } from '../api';
import { Hilfe } from '../Hilfe';
import { Speicherleiste, useEntwurf } from '../Speicherleiste';
import { t } from '../sprache';

/**
 * Werkbank → Einstellungen → Sprachen (#729): welche Sprachen es in der Ablage gibt und welche für alle gilt, die nichts
 * gewählt haben. Fest eingebaut sind Deutsch und Englisch; weitere kommen als Sprachpaket (#731). Deutsch ist die
 * Ausgangssprache und bleibt immer erlaubt.
 */
export function useSprachen(offen: boolean) {
  const [stand, setStand] = useState<SprachenStand | null>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async () => { try { setStand(await api.sprachen()); setFehler(undefined); } catch (e) { setFehler((e as Error).message); } }, []);
  useEffect(() => { if (offen) void laden(); }, [offen, laden]);
  return { stand, fehler, laden, setStand };
}
export type SprachenZustand = ReturnType<typeof useSprachen>;

type Einstellung = SprachenStand['einstellung'];

export function SprachenPanel({ z }: { z: SprachenZustand }) {
  const s = z.stand;
  const [e, setE] = useState<Einstellung | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  const [sendet, setSendet] = useState(false);
  useEffect(() => { if (s && !e) setE(s.einstellung); }, [s, e]);
  const ent = useEntwurf(s?.einstellung ?? null, e, { aus: !e, zuruecksetzen: () => { setE(s?.einstellung ?? null); setMeldung(undefined); } });
  if (!s || !e) return z.fehler ? <div className="hinweis schlecht"><p>{z.fehler}</p></div> : <p className="leise">{t('werkbank.sprachen.lade')}</p>;
  async function speichern() {
    setSendet(true);
    try {
      const n = await api.sprachenSetzen(e!);
      z.setStand(n); setE(n.einstellung); setzeErlaubteSprachen(n.einstellung.erlaubt);
      setMeldung({ art: 'gut', text: t('werkbank.sprachen.gespeichert') });
    } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); } finally { setSendet(false); }
  }
  const schalte = (spr: string, an: boolean) => setE({ ...e, erlaubt: s.verfuegbar.filter((x) => (x === spr ? an : e.erlaubt.includes(x))) });
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">{t('werkbank.sprachen.ueber')}</p>
        <h1>{t('werkbank.bereich.sprachen.name')}</h1>
        <p className="leise">{t('werkbank.sprachen.einleitung')} <Hilfe ort="werkbank.sprachen" /></p>
      </div>
      {meldung && <div className={`hinweis ${meldung.art}`} role="status"><p>{meldung.text}</p></div>}
      <form className="blatt" onSubmit={(x) => { x.preventDefault(); void speichern(); }} onKeyDown={ent.tasten}>
        <fieldset className="eigenschaft">
          <legend>{t('werkbank.sprachen.erlaubt')}</legend>
          {s.verfuegbar.map((spr) => {
            const fest = spr === AUSGANGSSPRACHE || spr === e.standard;
            return (
              <label key={spr} className="haken">
                <input type="checkbox" id={`sprache-${spr}`} checked={e.erlaubt.includes(spr)} disabled={fest} onChange={(x) => schalte(spr, x.target.checked)} />
                <span lang={spr}>{sprachname(spr, spr)}</span>
                <small className="leise">{(EINGEBAUTE_SPRACHEN as readonly string[]).includes(spr) ? t('werkbank.sprachen.eingebaut') : t('werkbank.sprachen.paket')}
                  {spr === AUSGANGSSPRACHE ? ` · ${t('werkbank.sprachen.ausgang')}` : spr === e.standard ? ` · ${t('werkbank.sprachen.ist-standard')}` : ''}</small>
              </label>
            );
          })}
        </fieldset>
        <label className="eigenschaft"><span>{t('werkbank.sprachen.standard')} <small>{t('werkbank.sprachen.standard.hinweis')}</small></span>
          <select id="sprachen-standard" value={e.standard} onChange={(x) => setE({ ...e, standard: x.target.value, erlaubt: e.erlaubt.includes(x.target.value) ? e.erlaubt : [...e.erlaubt, x.target.value] })}>
            {e.erlaubt.map((spr) => <option key={spr} value={spr}>{sprachname(spr)}</option>)}
          </select></label>
        <Speicherleiste ent={ent} gegenstand={t('werkbank.bereich.sprachen.name')} sendet={sendet} />
      </form>
      <section className="blatt">
        <h2 className="h3">{t('werkbank.sprachen.weitere')}</h2>
        <p className="leise">{t('werkbank.sprachen.weitere.text')}</p>
        <p className="leise klein">{t('werkbank.sprachen.rueckfall')}</p>
      </section>
    </div>
  );
}
