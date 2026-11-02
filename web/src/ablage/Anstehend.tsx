import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject, type TouchEvent } from 'react';
import { ANSTEHEND_TAGE, datumDe, type Anstehend, type AnstehendAntwort } from '../../../shared/src/fristen';
import { ANSTEHEND_GRUPPEN, blaettere, gruppeVon, istAnsicht, jahresZeitraum, monatsraster, monatsZeitraum, monatVon, ueberfaelligSeit, type AnstehendAnsicht } from '../../../shared/src/kalender';
import { heuteIn } from '../../../shared/src/sichten';
import { api } from '../api';
import { useDaten } from '../daten';
import { Listenkopf } from '../Listenkopf';
import { Link } from '../ort';
import { titelOder } from '../seiten';
import { t } from '../sprache';
import { Symbol, type SymbolName } from '../Symbol';

/**
 * „Anstehend“ (#132) mit Umschalter Liste · Monat · Jahr (#528) – wie im Kalender am Handy: einfach,
 * überschaubar, nur lesen. Ein Klick auf einen Eintrag öffnet die Mappe rechts; erledigt wird wie bisher
 * in der Mappe bzw. unter „Zu erledigen“. Monat und Jahr nutzen Mitte und rechts, solange keine Mappe
 * offen ist (wie die erweiterte Suche, #426). Präfix ka-.
 *
 * Liste: Zeitraum aus dem Profil (Standard 30 Tage), gruppiert in Überfällig · Heute · Diese Woche · Später.
 * Monat/Jahr: eine Anfrage je Monat bzw. Jahr, dazu die künftigen Termine wiederkehrender Fristen (heller)
 * und die Feiertage wie bei der Täglichen Zusammenfassung. Ist die Spalte schmal (Handy oder neben einer
 * offenen Mappe), zeigt der Monat Punkte je Tag und darunter die Einträge des gewählten Tags.
 */

/** Liste (#132): eigene Fristen, Erinnerungen und Aufgaben mit Datum der nächsten Tage (Zeitraum im Profil). */
export function useAnstehend() {
  const d = useDaten();
  const tage = Number(d.einstellungen.anstehend_tage ?? ANSTEHEND_TAGE);
  const [liste, setListe] = useState<AnstehendAntwort>();
  const [fehler, setFehler] = useState<string>();
  useEffect(() => {
    let aktuell = true;
    api.anstehend(tage).then((x) => { if (aktuell) { setListe(x); setFehler(undefined); } }).catch((x) => aktuell && setFehler((x as Error).message));
    return () => { aktuell = false; };
  }, [tage, d.stand]);
  return { liste, fehler };
}
type ListeDaten = ReturnType<typeof useAnstehend>;

/** Wie die Dreiteilung: bis 820 px eine Spalte (Handy). */
const SCHMAL = 820;
function useSchmal() {
  const [schmal, setSchmal] = useState(() => innerWidth <= SCHMAL);
  useEffect(() => {
    const f = () => setSchmal(innerWidth <= SCHMAL);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  return schmal;
}

/**
 * Gewählte Ansicht, je Benutzer gemerkt – am Handy getrennt, dort ist die Liste die Vorgabe und es gibt
 * nur Liste und Monat (die Jahresansicht ist am Handy zu klein).
 */
export function useAnstehendAnsicht(): { ansicht: AnstehendAnsicht; setze(a: AnstehendAnsicht): void; schmal: boolean } {
  const d = useDaten();
  const schmal = useSchmal();
  const schluessel = schmal ? 'anstehend_ansicht_handy' : 'anstehend_ansicht';
  const roh = d.einstellungen[schluessel];
  const ansicht: AnstehendAnsicht = !istAnsicht(roh) ? 'liste' : schmal && roh === 'jahr' ? 'monat' : roh;
  const setze = useCallback((a: AnstehendAnsicht) => d.setzeEinstellung(schluessel, a === 'liste' ? null : a), [d, schluessel]);
  return { ansicht, setze, schmal };
}

/** Breite eines Elements, für die kompakte Darstellung des Monats in schmalen Spalten. */
function useBreite<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    setBreite(e.clientWidth);
    const b = new ResizeObserver(() => setBreite(e.clientWidth));
    b.observe(e);
    return () => b.disconnect();
  }, []);
  return [ref, breite];
}
/** Darunter zeigt der Monat Punkte statt Zeilen. */
const KOMPAKT_AB = 600;

/** Ein Monat oder Jahr in einer Anfrage (#528); das Alte bleibt stehen, bis das Neue da ist. */
function useZeitraum(von: string, bis: string, aktiv: boolean) {
  const d = useDaten();
  const [daten, setDaten] = useState<AnstehendAntwort>();
  const [fehler, setFehler] = useState<string>();
  useEffect(() => {
    if (!aktiv) return;
    let aktuell = true;
    api.anstehendZeitraum(von, bis).then((x) => { if (aktuell) { setDaten(x); setFehler(undefined); } }).catch((x) => aktuell && setFehler((x as Error).message));
    return () => { aktuell = false; };
  }, [von, bis, aktiv, d.stand]);
  return { daten: daten && daten.von === von && daten.bis === bis ? daten : undefined, alt: daten, fehler };
}

const SYMBOL: Record<Anstehend['art'], SymbolName> = { frist: 'stoppuhr', erinnerung: 'erinnern', aufgabe: 'aufgabe' };
const artText = (x: Anstehend) => t.frei(`anstehend.art.${x.art}`);
const istUeberfaellig = (x: Anstehend, heute: string) => x.faellig && x.datum < heute;
const pfad = (x: Anstehend) => `/ablage/anstehend/${x.mappeId}`;
const schluessel = (x: Anstehend, i: number) => `${x.mappeId}-${x.feldKey ?? x.erinnerungId ?? i}-${x.datum}-${x.folgetermin ? 'f' : ''}`;

const WOCHENTAG = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const WOCHENTAG_LANG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });
const TAG_LANG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' });
const MONAT_JAHR = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const alsDatum = (iso: string) => new Date(`${iso}T00:00:00Z`);
const tagText = (iso: string) => `${WOCHENTAG.format(alsDatum(iso))} ${datumDe(iso)}`;
const tagLang = (iso: string) => TAG_LANG.format(alsDatum(iso));
const monatName = (monat: string) => MONAT.format(alsDatum(`${monat}-01`));
const monatJahr = (monat: string) => MONAT_JAHR.format(alsDatum(`${monat}-01`));
/** Mo … So für den Tabellenkopf, kurz und ausgeschrieben. */
const WOCHE = monatsraster('2026-11')[1].map((iso) => ({ kurz: WOCHENTAG.format(alsDatum(iso)).replace('.', ''), lang: WOCHENTAG_LANG.format(alsDatum(iso)) }));

/** Einträge je Tag. */
function jeTag(eintraege: Anstehend[]) {
  const m = new Map<string, Anstehend[]>();
  for (const x of eintraege) { const l = m.get(x.datum); if (l) l.push(x); else m.set(x.datum, [x]); }
  return m;
}

export function AnstehendSicht({ z, offen, ansicht, setze, schmal }: { z: ListeDaten; offen?: string } & ReturnType<typeof useAnstehendAnsicht>) {
  const [monat, setMonat] = useState(() => monatVon(heuteIn()));
  /** Gewählter Tag (Tagesliste) oder „ueberfaellig“ für die Liste des Überfälligen über dem Raster. */
  const [tag, setTag] = useState<string | null>(null);
  const jahr = Number(monat.slice(0, 4));
  const listeRef = useRef<HTMLDivElement>(null);
  const ansichten: AnstehendAnsicht[] = schmal ? ['liste', 'monat'] : ['liste', 'monat', 'jahr'];

  const zuHeute = () => {
    const h = heuteIn();
    setMonat(monatVon(h)); setTag(h);
    if (ansicht === 'liste') (listeRef.current?.querySelector('[data-gruppe="heute"], [data-gruppe="woche"], [data-gruppe="spaeter"]') ?? listeRef.current)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const blaettern = (n: number) => { setMonat((m) => blaettere(m, ansicht === 'jahr' ? 12 * n : n)); setTag(null); };
  const zumMonat = (m: string, d: string | null) => { setMonat(m); setTag(d); setze('monat'); };
  // Pfeiltasten blättern (nicht in Eingabefeldern) – im Kalender und, solange nichts den Fokus hat, auf der ganzen Seite.
  const pfeil = (e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; target: EventTarget | null; preventDefault(): void }) => {
    if (ansicht === 'liste' || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement | null)?.closest?.('input, select, textarea')) return;
    const n = e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : 0;
    if (n) { e.preventDefault(); blaettern(n); }
  };
  const taste = (e: KeyboardEvent<HTMLDivElement>) => pfeil(e);
  const pfeilRef = useRef(pfeil);
  pfeilRef.current = pfeil;
  useEffect(() => {
    const f = (e: globalThis.KeyboardEvent) => { if (e.target === document.body) pfeilRef.current(e); };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  return (
    <div className={`ka ka-ansicht-${ansicht}`} onKeyDown={taste}>
      <Listenkopf className="ka-kopf" titel={t('anstehend.titel')} hilfe="ablage.anstehend" beschreibung={<>
        {ansicht === 'liste' ? t('anstehend.beschreibung.liste', { tage: z.liste?.tage ?? ANSTEHEND_TAGE }) : t('anstehend.beschreibung.kalender')}
        {ansicht === 'liste' && <> {t('anstehend.zeitraum')} <Link to="/profil/darstellung" className="verweis">{t('anstehend.zeitraum.link')}</Link> {t('anstehend.zeitraum.ende')}</>}
      </>} />
      <div className="ka-leiste">
        <div className="segmente ka-umschalter" role="radiogroup" aria-label={t('anstehend.ansicht')}>
          {ansichten.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={ansicht === a} className={ansicht === a ? 'an' : ''} onClick={() => setze(a)}>{t.frei(`anstehend.ansicht.${a}`)}</button>
          ))}
        </div>
        <button type="button" className="knopf klein ka-heute" onClick={zuHeute}>{t('anstehend.heute')}</button>
        {ansicht !== 'liste' && (
          <div className="ka-blaettern">
            <button type="button" className="knopf klein ka-pfeil" onClick={() => blaettern(-1)} aria-label={t.frei(`anstehend.zurueck.${ansicht}`)} title={t.frei(`anstehend.zurueck.${ansicht}`)}><Symbol name="pfeil-links" /></button>
            <h2 className="ka-zeitraum" aria-live="polite">{ansicht === 'jahr' ? jahr : monatJahr(monat)}</h2>
            <button type="button" className="knopf klein ka-pfeil" onClick={() => blaettern(1)} aria-label={t.frei(`anstehend.weiter.${ansicht}`)} title={t.frei(`anstehend.weiter.${ansicht}`)}><Symbol name="pfeil-rechts" /></button>
          </div>
        )}
      </div>
      {ansicht === 'liste'
        ? <div ref={listeRef}><ListeAnsicht z={z} offen={offen} /></div>
        : ansicht === 'monat'
        ? <MonatAnsicht monat={monat} tag={tag} setTag={setTag} offen={offen} blaettern={blaettern} schmal={schmal} />
        : <JahrAnsicht jahr={jahr} zumMonat={zumMonat} />}
    </div>
  );
}

/** Ein Eintrag als Zeile mit Symbol, Datum, Mappe und Text (Liste und Tagesliste). */
function Eintrag({ x, heute, offen, mitDatum = true }: { x: Anstehend; heute: string; offen?: string; mitDatum?: boolean }) {
  const ueber = istUeberfaellig(x, heute);
  return (
    <Link to={pfad(x)} className={`eintrag ka-eintrag${offen === x.mappeId ? ' an' : ''}${ueber ? ' ka-ueber' : ''}${x.folgetermin ? ' ka-folge' : ''}`}>
      <span className="titel"><Symbol name={SYMBOL[x.art]} className="ka-sym" /> {mitDatum ? `${tagText(x.datum)} · ` : ''}{titelOder(x.mappeTitel)}</span>
      <span className="unter">{artText(x)}: {x.text}</span>
      {ueber
        ? <span className="ka-ueberfaellig"><Symbol name="warnung" /> {t('anstehend.ueberfaellig', { anzahl: ueberfaelligSeit(x.datum, heute) })}</span>
        : x.folgetermin ? <span className="unter leise">{t('anstehend.folgetermin')}</span>
        : x.faellig ? <span className="problem">{t('anstehend.im-eingang')}</span>
        : x.ab > heute ? <span className="unter leise">{t('anstehend.ab', { datum: datumDe(x.ab) })}</span> : null}
    </Link>
  );
}

function ListeAnsicht({ z, offen }: { z: ListeDaten; offen?: string }) {
  const l = z.liste;
  if (z.fehler) return <p className="fehlertext">{z.fehler}</p>;
  if (!l) return <p className="leise leerliste">{t('anstehend.lade')}</p>;
  if (!l.eintraege.length) return <p className="leise leerliste">{t('anstehend.leer', { tage: l.tage })}</p>;
  return (
    <>
      {ANSTEHEND_GRUPPEN.map((g) => {
        const liste = l.eintraege.filter((x) => gruppeVon(x.datum, l.heute) === g);
        if (!liste.length) return null;
        return (
          <section key={g} className={`ka-gruppe ka-gruppe-${g}`} data-gruppe={g} aria-labelledby={`ka-g-${g}`}>
            <h2 className="ueber" id={`ka-g-${g}`}>{g === 'ueberfaellig' && <Symbol name="warnung" />} {t.frei(`anstehend.gruppe.${g}`)} <span className="ka-anzahl">{liste.length}</span></h2>
            <ul className="mappenliste">
              {liste.map((x, i) => <li key={schluessel(x, i)}><Eintrag x={x} heute={l.heute} offen={offen} /></li>)}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** Höchstens so viele Zeilen je Tag im breiten Monat; danach „+n weitere“. */
const JE_TAG = 3;

function MonatAnsicht({ monat, tag, setTag, offen, blaettern, schmal }: { monat: string; tag: string | null; setTag(t: string | null): void; offen?: string; blaettern(n: number): void; schmal: boolean }) {
  const { von, bis } = monatsZeitraum(monat);
  const { daten, alt, fehler } = useZeitraum(von, bis, true);
  const [ref, breite] = useBreite<HTMLDivElement>();
  const kompakt = schmal || (breite > 0 && breite < KOMPAKT_AB);
  const d = daten ?? alt;
  const heute = d?.heute ?? heuteIn();
  const tage = useMemo(() => jeTag(daten?.eintraege ?? []), [daten]);
  const ueberfaellig = (d?.eintraege ?? []).filter((x) => istUeberfaellig(x, heute));
  const raster = monatsraster(monat);
  // Kompakt: immer eine Tagesliste – heute, wenn es in diesem Monat liegt, sonst der Erste.
  const gewaehlt = tag ?? (kompakt ? (monatVon(heute) === monat ? heute : `${monat}-01`) : null);
  // Wischen blättert (Handy).
  const start = useRef<{ x: number; y: number } | null>(null);
  const wisch = {
    onTouchStart: (e: TouchEvent) => { const p = e.touches[0]; start.current = { x: p.clientX, y: p.clientY }; },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current; start.current = null;
      const p = e.changedTouches[0];
      if (!s || !p) return;
      const dx = p.clientX - s.x; const dy = p.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) blaettern(dx < 0 ? 1 : -1);
    },
  };
  const feiertag = (iso: string) => d?.feiertage?.[iso];

  const zelle = (iso: string): ReactNode => {
    const liste = tage.get(iso) ?? [];
    const imMonat = iso.startsWith(monat);
    const name = feiertag(iso);
    const istHeute = iso === heute;
    const beschriftung = [tagLang(iso), istHeute ? t('anstehend.heute') : '', name ?? '', liste.length ? t('anstehend.eintraege', { anzahl: liste.length }) : ''].filter(Boolean).join(', ');
    const klasse = `ka-tag${imMonat ? '' : ' ka-fremd'}${istHeute ? ' ka-heute-tag' : ''}${gewaehlt === iso ? ' ka-gewaehlt' : ''}${wochenende(iso) ? ' ka-we' : ''}`;
    if (kompakt) {
      const punkte = liste.slice(0, 3);
      return (
        <td key={iso} className={klasse} aria-current={istHeute ? 'date' : undefined}>
          <button type="button" className="ka-tagknopf" aria-label={beschriftung} aria-pressed={gewaehlt === iso} onClick={() => setTag(iso)}>
            <span className="ka-zahl">{Number(iso.slice(8))}</span>
            <span className="ka-punkte" aria-hidden="true">{punkte.map((x, i) => <span key={i} className={`ka-punkt art-${x.art}${istUeberfaellig(x, heute) ? ' ka-ueber' : ''}${x.folgetermin ? ' ka-folge' : ''}`} />)}</span>
          </button>
        </td>
      );
    }
    const mehr = liste.length > JE_TAG ? liste.length - (JE_TAG - 1) : 0;
    return (
      <td key={iso} className={klasse} aria-current={istHeute ? 'date' : undefined}>
        <div className="ka-tagkopf">
          <button type="button" className="ka-zahl" aria-label={beschriftung} aria-pressed={gewaehlt === iso} onClick={() => setTag(gewaehlt === iso ? null : iso)}>{Number(iso.slice(8))}</button>
          {name && <span className="ka-feiertag" title={name}>{name}</span>}
        </div>
        {(mehr ? liste.slice(0, JE_TAG - 1) : liste).map((x, i) => <Zeile key={schluessel(x, i)} x={x} heute={heute} offen={offen} />)}
        {mehr > 0 && <button type="button" className="textknopf klein ka-mehr" onClick={() => setTag(iso)}>{t('anstehend.weitere', { anzahl: mehr })}</button>}
      </td>
    );
  };

  const tagesliste = gewaehlt === 'ueberfaellig' ? ueberfaellig : gewaehlt ? tage.get(gewaehlt) ?? [] : [];
  return (
    <div ref={ref} className={`ka-monat${kompakt ? ' ka-kompakt' : ''}`}>
      {fehler && <p className="fehlertext">{fehler}</p>}
      {ueberfaellig.length > 0 && (
        <button type="button" className="ka-ueberzeile" aria-pressed={gewaehlt === 'ueberfaellig'} onClick={() => setTag(gewaehlt === 'ueberfaellig' ? null : 'ueberfaellig')}>
          <Symbol name="warnung" /> {t('anstehend.ueberfaellig.zahl', { anzahl: ueberfaellig.length })}
        </button>
      )}
      <table className="ka-raster" {...wisch} aria-busy={!daten}>
        <caption className="sr">{t('anstehend.raster', { monat: monatJahr(monat) })}</caption>
        <thead><tr>{WOCHE.map((w) => <th key={w.lang} scope="col" abbr={w.lang}><span aria-hidden="true">{w.kurz}</span><span className="sr">{w.lang}</span></th>)}</tr></thead>
        <tbody>{raster.map((w) => <tr key={w[0]}>{w.map(zelle)}</tr>)}</tbody>
      </table>
      {!daten && !fehler && <p className="leise klein">{t('anstehend.lade')}</p>}
      {daten && !daten.eintraege.length && <p className="leise klein">{t('anstehend.leer.monat')}</p>}
      {gewaehlt && (
        <section className="ka-tagesliste" aria-labelledby="ka-tl">
          <div className="ka-tl-kopf">
            <h2 className="h3" id="ka-tl">{gewaehlt === 'ueberfaellig' ? t('anstehend.gruppe.ueberfaellig') : tagLang(gewaehlt)}</h2>
            {gewaehlt !== 'ueberfaellig' && feiertag(gewaehlt) && <span className="chip">{feiertag(gewaehlt)}</span>}
            {!kompakt && <button type="button" className="textknopf klein" onClick={() => setTag(null)}>{t('anstehend.schliessen')}</button>}
          </div>
          {tagesliste.length
            ? <ul className="mappenliste">{tagesliste.map((x, i) => <li key={schluessel(x, i)}><Eintrag x={x} heute={heute} offen={offen} mitDatum={gewaehlt === 'ueberfaellig'} /></li>)}</ul>
            : <p className="leise klein">{t('anstehend.leer.tag')}</p>}
        </section>
      )}
    </div>
  );
}

const wochenende = (iso: string) => { const w = alsDatum(iso).getUTCDay(); return w === 0 || w === 6; };

/** Kurze Zeile im breiten Monat: Symbol und Mappentitel; Art, Text und Zustand im Titel bzw. für Vorleser. */
function Zeile({ x, heute, offen }: { x: Anstehend; heute: string; offen?: string }) {
  const ueber = istUeberfaellig(x, heute);
  const zustand = ueber ? t('anstehend.ueberfaellig', { anzahl: ueberfaelligSeit(x.datum, heute) }) : x.folgetermin ? t('anstehend.folgetermin') : '';
  const titel = `${artText(x)}: ${x.text} – ${titelOder(x.mappeTitel)}${zustand ? ` (${zustand})` : ''}`;
  return (
    <Link to={pfad(x)} title={titel} className={`ka-zeile art-${x.art}${ueber ? ' ka-ueber' : ''}${x.folgetermin ? ' ka-folge' : ''}${offen === x.mappeId ? ' an' : ''}`}>
      <Symbol name={ueber ? 'warnung' : SYMBOL[x.art]} className="ka-sym" />
      <span className="ka-zt"><span className="sr">{artText(x)}: </span>{titelOder(x.mappeTitel)}{zustand && <span className="sr"> ({zustand})</span>}</span>
    </Link>
  );
}

function JahrAnsicht({ jahr, zumMonat }: { jahr: number; zumMonat(m: string, tag: string | null): void }) {
  const { von, bis } = jahresZeitraum(jahr);
  const { daten, alt, fehler } = useZeitraum(von, bis, true);
  const heute = (daten ?? alt)?.heute ?? heuteIn();
  const tage = useMemo(() => jeTag(daten?.eintraege ?? []), [daten]);
  const monate = Array.from({ length: 12 }, (_, i) => `${String(jahr).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`);
  const ueberfaellig = (daten?.eintraege ?? []).filter((x) => istUeberfaellig(x, heute)).length;
  return (
    <div className="ka-jahr-rahmen">
      {fehler && <p className="fehlertext">{fehler}</p>}
      {ueberfaellig > 0 && (
        <button type="button" className="ka-ueberzeile" onClick={() => zumMonat(monatVon(heute), 'ueberfaellig')}>
          <Symbol name="warnung" /> {t('anstehend.ueberfaellig.zahl', { anzahl: ueberfaellig })}
        </button>
      )}
      {!daten && !fehler && <p className="leise klein">{t('anstehend.lade')}</p>}
      <div className="ka-jahr" aria-busy={!daten}>
        {monate.map((m) => (
          <section key={m} className="ka-jm" aria-labelledby={`ka-jm-${m}`}>
            <h3 className="h3"><button type="button" id={`ka-jm-${m}`} className="textknopf ka-jm-titel" onClick={() => zumMonat(m, null)}>{monatName(m)}</button></h3>
            <table className="ka-mini">
              <caption className="sr">{t('anstehend.raster', { monat: monatJahr(m) })}</caption>
              <thead><tr>{WOCHE.map((w) => <th key={w.lang} scope="col" abbr={w.lang}><span aria-hidden="true">{w.kurz.slice(0, 1)}</span><span className="sr">{w.lang}</span></th>)}</tr></thead>
              <tbody>
                {monatsraster(m).map((w) => (
                  <tr key={w[0]}>
                    {w.map((iso) => {
                      if (!iso.startsWith(m)) return <td key={iso} className="ka-fremd" />;
                      const liste = tage.get(iso) ?? [];
                      const istHeute = iso === heute;
                      const zahl = Number(iso.slice(8));
                      if (!liste.length) return <td key={iso} className={istHeute ? 'ka-heute-tag' : undefined} aria-current={istHeute ? 'date' : undefined}><span className="ka-mt">{zahl}</span></td>;
                      const nurFolge = liste.every((x) => x.folgetermin);
                      const ueber = liste.some((x) => istUeberfaellig(x, heute));
                      const text = `${tagLang(iso)}: ${t('anstehend.eintraege', { anzahl: liste.length })}${ueber ? `, ${t('anstehend.gruppe.ueberfaellig')}` : ''}`;
                      return (
                        <td key={iso} className={istHeute ? 'ka-heute-tag' : undefined} aria-current={istHeute ? 'date' : undefined}>
                          <button type="button" className={`ka-mt ka-mt-knopf${nurFolge ? ' ka-folge' : ''}${ueber ? ' ka-ueber' : ''}`} title={text} aria-label={text} onClick={() => zumMonat(m, iso)}>
                            {zahl}<span className="ka-mpunkt" aria-hidden="true" />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
