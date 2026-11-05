import { useEffect, useState } from 'react';
import { Symbol } from '../Symbol';
import { AUFGABENARTEN, type Aufgabe } from '../../../shared/src/model';
import { datumDe, type Erinnerung } from '../../../shared/src/fristen';
import { heuteIn, verschiebe } from '../../../shared/src/sichten';
import { aufgabenBeschriftung, ausNotiz } from '../../../shared/src/mappenansicht';
import { api } from '../api';
import { nameMitAbwesenheit, useDaten } from '../daten';
import { useKonto } from '../konto';
import { Person } from '../Person';
import { Hilfe } from '../Hilfe';
import { rueckfrage } from '../rueckfrage';
import { t, tn } from '../sprache';

/** Aufgaben an einer Mappe (#54): offene als Hinweis über der Mappe; eigene erledigen oder weitergeben. */
const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'short' });

export function BenutzerWahl({ wert, setze, ohne, label, fokus }: { wert: string; setze: (id: string) => void; ohne?: string | null; label: string; fokus?: boolean }) {
  const d = useDaten();
  return (
    <select aria-label={label} value={wert} autoFocus={fokus} onChange={(e) => setze(e.target.value)}>
      <option value="">{t('ablage.aufgaben.benutzer-waehlen')}</option>
      {d.personen.filter((p) => p.aktiv !== false && p.id !== ohne).map((p) => <option key={p.id} value={p.id}>{nameMitAbwesenheit(p)}</option>)}
    </select>
  );
}

type Folge = { aufgabe: Aufgabe; datum: string };

/**
 * Zuweisen von Hand (#798): Darf der Empfänger die Mappe nicht lesen, erst Bescheid sagen – „Trotzdem zuweisen“ oder
 * „Abbrechen“. Rechte vergibt hier niemand; das kann nur der Admin in der Werkbank. Klappt die Prüfung nicht, geht es
 * weiter wie bisher (der Server antwortet dann mit einem Hinweis).
 */
export async function trotzdemZuweisen(mappeId: string, an: string, name: string): Promise<boolean> {
  try { if ((await api.darfLesen(mappeId, an)).lesen) return true; } catch { return true; }
  return rueckfrage({ titel: t('mappen.aufgabe.zuweisen.titel', { name }), text: t('mappen.aufgabe.zuweisen.text', { name }), ja: t('mappen.aufgabe.zuweisen.trotzdem'), nein: t('mappen.aufgabe.zuweisen.abbrechen') });
}

function Zeile({ a, neuLaden, setBestaetigt, setFolge, zuNotizen }: { a: Aufgabe; neuLaden: () => Promise<void>; setBestaetigt: (text: string) => void; setFolge: (f: Folge) => void; zuNotizen?: () => void }) {
  const d = useDaten();
  const { ich, ohneEmpfaenger } = useKonto();
  const [weiter, setWeiter] = useState(false);
  const [an, setAn] = useState('');
  const [fehler, setFehler] = useState<string>();
  // Aufgaben ohne Empfänger (#719): auch beim gewählten Alltags-Benutzer.
  const meine = a.empfaengerId === ich.id || (!a.empfaengerId && ohneEmpfaenger);
  const darf = meine || ich.rolle === 'admin';
  async function tu(f: () => Promise<unknown>, meldung?: string) {
    setFehler(undefined);
    try {
      const r = await f() as { hinweis?: string; folgetermin?: string } | null;
      setWeiter(false); setAn('');
      // Wiederkehrende Frist (#130): nächsten Termin vorschlagen.
      if (r?.folgetermin) setFolge({ aufgabe: a, datum: r.folgetermin });
      // Empfänger darf die Mappe nicht lesen (#127): trotzdem vergeben, aber Bescheid sagen.
      if (meldung || r?.hinweis) setBestaetigt([meldung, r?.hinweis].filter(Boolean).join(' '));
      await neuLaden(); await d.neuLaden();
    } catch (e) { setFehler((e as Error).message); }
  }
  return (
    <li className={meine ? 'meine' : ''}>
      <div className="aufgabentext">
        {/* „Deine Aufgabe:“ (#427) – damit klar ist, dass Erledigt/Weitergeben rechts zur Aufgabe gehören. */}
        <strong>{meine ? aufgabenBeschriftung(a.art, true) : <>{aufgabenBeschriftung(a.art, false)} {a.empfaengerId ? <Person id={a.empfaengerId} /> : t('konten.verwaltende.ohneEmpfaenger')}</>}:</strong> {a.text}
        {a.art === 'frist' && a.datum && <span className={`chip ${a.datum <= heuteIn() ? 'schlecht' : 'warn'}`} title={t('ablage.aufgaben.frist')}>{noch(a.datum)}</span>}
        <span className="leise klein"> {' '}{t('ablage.aufgaben.seit', { AUFGABENARTEN: AUFGABENARTEN[a.art], datum: datum(a.erstellt) })}{a.erstelltVon && <> {' '}{t('ablage.aufgaben.von')}{' '}<Person id={a.erstelltVon} /></>}</span>
      </div>
      {darf && !weiter && (
        <div className="aufgabenaktionen">
          {zuNotizen && ausNotiz(a) && <button type="button" className="textknopf klein" onClick={zuNotizen}>{t('ablage.aufgaben.zur-notiz')}</button>}
          {/* Automatisch zugeordnet (#337): „Passt“ bestätigt, „Rückgängig“ nimmt die Zuordnung zurück. */}
          {a.art === 'zugeordnet' && <button type="button" className="knopf klein" onClick={() => void (async () => {
            if (await rueckfrage({ titel: t('ablage.aufgaben.zuordnung-rueckgaengig-machen'), text: t('ablage.aufgaben.die-dokumente-kommen-zurueck'), ja: t('ablage.aufgaben.rueckgaengig-machen') })) {
              await tu(() => api.zuordnungRueckgaengig(a.id), t('ablage.aufgaben.zuordnung-rueckgaengig-gemacht-die'));
            }
          })()}>{t('ablage.aufgaben.rueckgaengig')}</button>}
          {a.art !== 'passung' && <button type="button" className={`knopf klein ${a.art === 'zugeordnet' ? 'primaer' : ''}`} onClick={() => void tu(() => api.aufgabeErledigt(a.id))}>{a.art === 'zugeordnet' ? t('ablage.aufgaben.passt') : t('ablage.aufgaben.erledigt')}</button>}
          <button type="button" className="knopf klein" onClick={() => setWeiter(true)}>{t('ablage.aufgaben.weitergeben')}</button>
        </div>
      )}
      {darf && weiter && (
        <form className="weitergeben" onSubmit={(e) => { e.preventDefault(); if (an) void (async () => { if (await trotzdemZuweisen(a.mappeId, an, d.person(an))) await tu(() => api.aufgabeDelegieren(a.id, an), t('ablage.aufgaben.an-weitergegeben', { person: d.person(an) })); })(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setWeiter(false); setAn(''); } }}>
          <span className="leise klein">{t('ablage.aufgaben.weitergeben-an')}</span>
          <BenutzerWahl label={t('ablage.aufgaben.weitergeben-an')} wert={an} setze={setAn} ohne={a.empfaengerId} fokus />
          <button className="knopf klein primaer" disabled={!an}>{t('ablage.aufgaben.weitergeben')}</button>
          <button type="button" className="textknopf" onClick={() => { setWeiter(false); setAn(''); }}>{t('ablage.aufgaben.abbrechen')}</button>
        </form>
      )}
      {fehler && <p className="fehlertext">{fehler}</p>}
    </li>
  );
}

/** Hinweis über der Mappe mit allen offenen Aufgaben. */
export function AufgabenHinweis({ aufgaben, neuLaden, zuNotizen }: { aufgaben: Aufgabe[]; neuLaden: () => Promise<void>; zuNotizen?: () => void }) {
  const offen = aufgaben.filter((a) => !a.erledigt);
  const [bestaetigt, setBestaetigt] = useState<string>();
  const [folge, setFolge] = useState<Folge>();
  useEffect(() => { if (!bestaetigt) return; const timer = window.setTimeout(() => setBestaetigt(undefined), 6000); return () => window.clearTimeout(timer); }, [bestaetigt]);
  const vorschlag = folge && <Folgetermin f={folge} neuLaden={neuLaden} fertig={(eintrag) => { setFolge(undefined); if (eintrag) setBestaetigt(eintrag); }} />;
  if (!offen.length) return bestaetigt || vorschlag ? <>{vorschlag}{bestaetigt && <div className="hinweis gut" role="status"><p>{bestaetigt}</p></div>}</> : null;
  return (
    <>
      {vorschlag}
      <div className="hinweis warn stapel aufgabenhinweis" role="status">
        <ul>{offen.map((a) => <Zeile key={a.id} a={a} neuLaden={neuLaden} setBestaetigt={setBestaetigt} setFolge={setFolge} zuNotizen={zuNotizen} />)}</ul>
        {bestaetigt && <p className="gutertext klein">{bestaetigt}</p>}
      </div>
    </>
  );
}

/** „noch 12 Tage“, „heute“, „seit 3 Tagen“ bis zur Frist. */
function noch(iso: string): string {
  const tage = Math.round((Date.parse(iso) - Date.parse(heuteIn())) / 86_400_000);
  return tage === 0 ? t('ablage.aufgaben.heute') : tage === 1 ? t('ablage.aufgaben.morgen') : tage > 0 ? t('ablage.aufgaben.noch-tage', { tage }) : tage === -1 ? t('ablage.aufgaben.seit-gestern') : t('ablage.aufgaben.seit-tagen', { wert: -tage });
}

/** Wiederkehrende Frist erledigt (#130): „Datum auf … setzen“ – nie automatisch. */
function Folgetermin({ f, neuLaden, fertig }: { f: Folge; neuLaden: () => Promise<void>; fertig: (meldung?: string) => void }) {
  const d = useDaten();
  const [fehler, setFehler] = useState<string>();
  async function setzen() {
    try { const r = await api.folgetermin(f.aufgabe.id); await neuLaden(); await d.neuLaden(); fertig(r.hinweis ?? t('ablage.aufgaben.naechster-termin-eingetragen', { datumDe: datumDe(f.datum) })); }
    catch (e) { setFehler((e as Error).message); }
  }
  return (
    <div className="hinweis info folgetermin" role="status">
      <p>{tn('ablage.aufgaben.erledigt-der-termin-wiederholt', { b: <strong>{t('ablage.aufgaben.naechsten-termin-auf-setzen', { datumDe: datumDe(f.datum) })}</strong> })}</p>
      <div className="knoepfe">
        <button type="button" className="knopf klein primaer" onClick={() => void setzen()}>{t('ablage.aufgaben.datum-auf-setzen', { datumDe: datumDe(f.datum) })}</button>
        <button type="button" className="textknopf" onClick={() => fertig()}>{t('ablage.aufgaben.nein-danke')}</button>
      </div>
      {fehler && <p className="fehlertext">{fehler}</p>}
    </div>
  );
}

/** Noch nicht fällige Erinnerungen an der Mappe (#131): ändern und löschen (Ersteller und Empfänger). */
export function Erinnerungen({ liste, neuLaden }: { liste: Erinnerung[]; neuLaden: () => Promise<void> }) {
  const { ich } = useKonto();
  const [bearbeiten, setBearbeiten] = useState<string>();
  const [fehler, setFehler] = useState<string>();
  if (!liste.length) return null;
  async function loeschen(e: Erinnerung) {
    if (!(await rueckfrage({ titel: t('ablage.aufgaben.erinnerung-loeschen'), text: `„${e.text}“`, ja: t('ablage.aufgaben.loeschen'), gefahr: true }))) return;
    try { await api.erinnerungLoeschen(e.id); await neuLaden(); } catch (x) { setFehler((x as Error).message); }
  }
  return (
    <div className="hinweis info stapel erinnerungen" role="status">
      <ul>{liste.map((e) => {
        const darf = e.erstelltVon === ich.id || e.empfaengerId === ich.id || ich.rolle === 'admin';
        return bearbeiten === e.id
          ? <li key={e.id}><ErinnerungFormular mappeId={e.mappeId} e={e} neuLaden={neuLaden} schliessen={() => setBearbeiten(undefined)} eingebettet /></li>
          : (
            <li key={e.id}>
              <div className="aufgabentext">{tn('ablage.aufgaben.fuer', { symbol: <Symbol name="erinnern" />, b: <strong>{datumDe(e.datum)}</strong> })}{' '}{e.empfaengerId === ich.id ? t('ablage.aufgaben.dich') : <Person id={e.empfaengerId} />}: {e.text}</div>
              {darf && <div className="aufgabenaktionen">
                <button type="button" className="knopf klein" onClick={() => setBearbeiten(e.id)}>{t('ablage.aufgaben.aendern')}</button>
                <button type="button" className="textknopf gefahr klein" onClick={() => void loeschen(e)}>{t('ablage.aufgaben.loeschen')}</button>
              </div>}
            </li>
          );
      })}</ul>
      {fehler && <p className="fehlertext">{fehler}</p>}
    </div>
  );
}

/** Erinnern (#131): Datum, Text, für mich oder jemand anderen. */
export function ErinnerungFormular({ mappeId, e, neuLaden, schliessen, eingebettet }: { mappeId: string; e?: Erinnerung; neuLaden: () => Promise<void>; schliessen: () => void; eingebettet?: boolean }) {
  const d = useDaten();
  const { ich } = useKonto();
  const [datum, setDatum] = useState(e?.datum ?? verschiebe(heuteIn(), 7));
  const [text, setText] = useState(e?.text ?? '');
  const [an, setAn] = useState(e?.empfaengerId ?? ich.id);
  const [fehler, setFehler] = useState<string>();
  const [hinweis, setHinweis] = useState<string>();
  async function senden() {
    setFehler(undefined);
    try {
      const x = { datum, text, empfaengerId: an || undefined };
      const r = e ? await api.erinnerungAendern(e.id, x) : await api.erinnerungAnlegen(mappeId, x);
      await neuLaden(); await d.neuLaden();
      if (r.hinweis) setHinweis(r.hinweis); else schliessen();
    } catch (x) { setFehler((x as Error).message); }
  }
  const inhalt = (
    <>
      <div className="raster">
        <label className="eigenschaft"><span>{t('ablage.aufgaben.am')}</span><input type="date" value={datum} onChange={(x) => setDatum(x.target.value)} /></label>
        <label className="eigenschaft"><span>{t('ablage.aufgaben.fuer-2')}</span><BenutzerWahl label={t('ablage.aufgaben.erinnerung-fuer')} wert={an} setze={setAn} /></label>
        <label className="eigenschaft breit"><span>{t('ablage.aufgaben.woran')}</span><input value={text} maxLength={500} onChange={(x) => setText(x.target.value)} placeholder={t('ablage.aufgaben.z-b-angebote-vergleichen')} autoFocus /></label>
      </div>
      <p className="leise klein">{t('ablage.aufgaben.am-gewaehlten-tag-steht', { wert: an === ich.id ? '' : t('ablage.aufgaben.des-empfaengers') })}</p>
      {fehler && <p className="fehlertext">{fehler}</p>}
      {hinweis && <div className="hinweis warn"><p>{hinweis}</p></div>}
      <div className="knoepfe">
        {eingebettet && <button type="button" className="textknopf" onClick={schliessen}>{t('ablage.aufgaben.abbrechen')}</button>}
        <button type="button" className="knopf primaer" disabled={!datum || !text.trim() || !an} onClick={() => void senden()}>{e ? t('ablage.aufgaben.erinnerung-aendern') : t('ablage.aufgaben.erinnern')}</button>
      </div>
    </>
  );
  if (eingebettet) return <div className="erinnerungformular">{inhalt}</div>;
  return (
    <section className="blatt" aria-label={t('ablage.aufgaben.erinnern')}>
      <div className="blattkopf zeile-zwischen"><h2 className="h3">{tn('ablage.aufgaben.erinnern-2', { hilfe: <Hilfe ort="ablage.erinnern" /> })}</h2><button type="button" className="textknopf" onClick={schliessen}>{t('ablage.aufgaben.schliessen')}</button></div>
      {inhalt}
    </section>
  );
}

/** Aufgabe von Hand vergeben. */
export function NeueAufgabe({ mappeId, neuLaden, schliessen }: { mappeId: string; neuLaden: () => Promise<void>; schliessen: () => void }) {
  const d = useDaten();
  const [an, setAn] = useState('');
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState<string>();
  const [hinweis, setHinweis] = useState<string>();
  async function senden() {
    setFehler(undefined);
    if (!(await trotzdemZuweisen(mappeId, an, d.person(an)))) return;
    try {
      const r = await api.aufgabeAnlegen(mappeId, an, text);
      await neuLaden(); await d.neuLaden();
      // Empfänger darf die Mappe nicht lesen (#127): Maske offen lassen, Hinweis zeigen.
      if (r.hinweis) { setHinweis(r.hinweis); setText(''); setAn(''); } else schliessen();
    } catch (e) { setFehler((e as Error).message); }
  }
  return (
    <section className="blatt" aria-label={t('ablage.aufgaben.aufgabe-vergeben')}>
      <div className="blattkopf zeile-zwischen"><h2 className="h3">{t('ablage.aufgaben.aufgabe-vergeben')}</h2><button type="button" className="textknopf" onClick={schliessen}>{t('ablage.aufgaben.schliessen')}</button></div>
      <div className="raster">
        <label className="eigenschaft"><span>{t('ablage.aufgaben.fuer-2')}</span><BenutzerWahl label={t('ablage.aufgaben.empfaenger')} wert={an} setze={setAn} /></label>
        <label className="eigenschaft breit"><span>{t('ablage.aufgaben.was-ist-zu-tun')}</span><input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={t('ablage.aufgaben.z-b-bitte-rechnung')} /></label>
      </div>
      <p className="leise klein">{t('ablage.aufgaben.die-mappe-erscheint-beim')}</p>
      {fehler && <p className="fehlertext">{fehler}</p>}
      {hinweis && <div className="hinweis warn" role="status"><p>{hinweis}</p></div>}
      <div className="knoepfe"><button type="button" className="knopf primaer" disabled={!an || !text.trim()} onClick={() => void senden()}>{t('ablage.aufgaben.aufgabe-vergeben')}</button></div>
    </section>
  );
}
