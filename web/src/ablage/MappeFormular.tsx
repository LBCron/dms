import { feldHilfe, feldLabel, optionText, registerName, typName } from '../../../shared/src/beschriftung';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Symbol } from '../Symbol';
import { Stern } from './Stern';
import { spaltenName, zelle } from './spalten';
import { eigeneFelderIm, vorbelegungAus } from '../../../shared/src/sichten';
import { datumText, inFrist } from '../../../shared/src/archiv';
import { deutschePlz, eingabemodus, formatFehler, mitSchema, pruefeFormate, telefonLink } from '../../../shared/src/feldformate';
import { darfErstellen, darfLoeschen, formatiere, trefferlistenVon, geschuetzteFelder, istLeer, istOk,  standardRegister, VERWEISARTEN, verweisAusText, type Dokument, type Feld, type Mappe, type Mappenkonflikt, type Mappentyp, type Pruefergebnis, type Register, type Wert, type Werte } from '../../../shared/src/model';
import { api, ApiFehler, type Bezuege, type MappeDetails, type Rueckverweis } from '../api';
import { useDaten } from '../daten';
import { useKonto } from '../konto';
import { geheZu, Link, loeseWache, useUngespeichert } from '../ort';
import { ausRoh, leeresPasswort, rohAusWerten, standardRoh, werteAusRoh, zuRoh, type Roh, type RohBetrag, type RohPasswort, type RohWerte } from '../werte';
import { titelOder } from '../seiten';
import { Mehrfachauswahl } from './Mehrfachauswahl';
import { Formatiert, FormatiertEingabe } from './Formatiert';
import { Uebersetzbar } from './Uebersetzung';
import { Historie } from './Historie';
import { mitNotizen, NOTIZEN_REGISTER, startRegister, type AnsichtsRegister } from '../../../shared/src/mappenansicht';
import { Notizen } from './Notizen';
import { AufgabenHinweis, ErinnerungFormular, Erinnerungen, NeueAufgabe } from './Aufgaben';
import { Aktionsmenue, Druckansicht, EmailMaske } from './Aktionen';
import { LoeschBaum } from './LoeschBaum';
import { PostLeiste } from './Post';
import { linkZuMappe } from '../../../shared/src/direktlink';
import { Ehemalig, Person } from '../Person';
import { Dokumente, type NeueDatei } from './Dokumente';
import { AehnlicheDokumente } from './Aehnlich';
import { hinweis, rueckfrage } from '../rueckfrage';
import { mitGrund } from './Loeschgrund';
import { AusDokument, type AusDokumentErgebnis } from './AusDokument';
import { ausDokumentKnopf, type Sicherheit } from '../../../shared/src/erkennung';
import type { TypVorschlaege } from '../api';
import { altesFeldAusblenden } from '../../../shared/src/umwandlung';
import { t, tn } from '../sprache';
import { gebietsschema } from '../../../shared/src/sprache';

const zeit = (iso: string) => new Date(iso).toLocaleString(gebietsschema(), { dateStyle: 'medium', timeStyle: 'short' });

/** Register des Typs; ältere Typen ohne Register bekommen die Standardregister. */
const registerVon = (mappentyp: Mappentyp): Register[] => (mappentyp.register?.length ? mappentyp.register : standardRegister(mappentyp.felder));

/** Neue Mappe als Ziel von „Zuordnen“ (#192): danach wird die Post ihr zugeordnet. */
export interface ZuordnenNachher { post: string; register?: string; dokumente: string[]; kopieren: boolean; vorschlag: Record<string, Wert> }

export function NeueMappe({ typ, verweis, sicht, zuordnen, vorbelegen }: { typ: Mappentyp; verweis?: string; sicht: string; zuordnen?: ZuordnenNachher; vorbelegen?: string }) {
  const start = standardRoh(typ);
  // ?vorbelegen={…} (#172): was sich aus dem Auswahlfilter eines Referenzfelds ergibt, z. B. Art = Arzt.
  try {
    for (const [k, v] of Object.entries(vorbelegen ? JSON.parse(vorbelegen) as Record<string, unknown> : {})) {
      const f = typ.felder.find((x) => x.key === k);
      if (!f || f.typ === 'passwort' || f.typ === 'betrag') continue;
      if (f.typ === 'janein' && typeof v === 'boolean') start[k] = v;
      else if (Array.isArray(v) && f.mehrfach) start[k] = v.map(String);
      else if (typeof v === 'string' && !f.mehrfach) start[k] = v;
    }
  } catch { /* ohne Vorbelegung */ }
  // Vorschläge aus der Post (Betreff, Datum) und aus der Erkennung (#336: Betrag, Nummern, Verweis auf den Absender).
  const vorbelegt: string[] = [];
  for (const [k, v] of Object.entries(zuordnen?.vorschlag ?? {})) {
    const f = typ.felder.find((x) => x.key === k);
    if (!f || f.typ === 'passwort' || v == null) continue;
    if ((f.typ === 'text' || f.typ === 'langtext' || f.typ === 'datum' || f.typ === 'referenz') && typeof v !== 'string') continue;
    if (f.typ === 'betrag' && (typeof v !== 'object' || Array.isArray(v) || typeof (v as { betrag?: unknown }).betrag !== 'number')) continue;
    start[k] = zuRoh(f, v);
    vorbelegt.push(feldLabel(f));
  }
  // ?verweis=feldKey:mappeId belegt ein Referenzfeld vor („+ Vertrag anlegen“ beim Vertragspartner).
  if (verweis) {
    const [k, id] = verweis.split(':');
    const f = typ.felder.find((x) => x.key === k && x.typ === 'referenz');
    if (f && id) start[f.key] = f.mehrfach ? [id] : id;
  }
  return (
    <>
      <div className="mappenkopf">
        <p className="ueber">{typName(typ)}</p>
        <h1>{t('ablage.mappeformular.neue-mappe')}</h1>
      </div>
      {zuordnen && <div className="hinweis info"><p>{t('ablage.mappeformular.nach-dem-speichern-wird', { wert: zuordnen.dokumente.length ? t('ablage.mappeformular.ihre-dokumente-kommen-hierher', { anzahl: zuordnen.dokumente.length }) : '' })}{vorbelegt.length > 0 && <> {' '}{t('ablage.mappeformular.als-vorschlag-aus-der', { vorbelegt: vorbelegt.join(', ') })}</>}</p></div>}
      <Formular typ={typ} start={start} sicht={sicht} zuordnen={zuordnen} />
    </>
  );
}

/**
 * Verwaltungsmodus (#820): Diese Mappe dürfte die Person ohne Modus nicht lesen. Beim ersten Öffnen im Modus ein
 * deutlicher Hinweis (danach klein), dass es in der Historie der Mappe steht.
 */
function NurImModus({ mappeId }: { mappeId: string }) {
  const [erstes] = useState(() => {
    try { const k = `dms:nur-im-modus:${mappeId}`; const da = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); return !da; } catch { return true; }
  });
  return <div className={erstes ? 'hinweis warn' : 'leise klein'} role={erstes ? 'alert' : undefined} id="nur-im-verwaltungsmodus"><p>{t('mappen.verwaltungsmodus.hinweis')}</p></div>;
}

export function MappeAnsicht({ typ, details, sicht, anhang = '', neuLaden }: { typ: Mappentyp; details: MappeDetails; sicht: string; anhang?: string; neuLaden: () => Promise<void> }) {
  const d = useDaten();
  const { ich } = useKonto();
  const mappe = details.mappe;
  const bekannt = new Set(typ.felder.map((f) => f.key));
  const verwaist = Object.entries(mappe.werte).filter(([k, v]) => !bekannt.has(k) && !istLeer(v));
  // Sprung auf einen Register von außen, z. B. „Zur Notiz“ im Aufgaben-Banner (#427).
  const [registerWunsch, setRegisterWunsch] = useState<{ key: string; n: number }>();
  const [aufgabeOffen, setAufgabeOffen] = useState(false);
  const [erinnernOffen, setErinnernOffen] = useState(false);
  const [emailOffen, setEmailOffen] = useState(false);
  const [drucken, setDrucken] = useState(false);
  const [loeschBaum, setLoeschBaum] = useState(false);
  // Handy (#489): „Mappe löschen“ steht im Menü „Mappe ▾“ statt in der Speicherleiste; der Formular-Teil löscht.
  const [loeschWunsch, setLoeschWunsch] = useState(0);
  const loeschbarHier = darfLoeschen(typ, mappe);
  const druckEnde = useCallback(() => setDrucken(false), []);
  // Sprechender Link (#98) über ein eindeutiges Feld oder die Titelfelder.
  const direktlink = linkZuMappe(typ, mappe);
  const [kopiert, setKopiert] = useState<{ link: string; ok: boolean } | null>(null);
  // Mit verknüpften Mappen löschen (#424): im Menü „Mappe ▾“ unter den Löschwegen (#427) und unter
  // „Warum nicht?“ am Löschknopf (#423); die Vorschau steht oben unter dem Kopf.
  const mitVerknuepften = darfLoeschen(typ, mappe) && details.rechte?.D !== false ? () => {
    setLoeschBaum(true);
    window.setTimeout(() => document.querySelector('.lb-blatt')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
  } : undefined;
  return (
    <>
      <div className="mappenkopf">
        <p className="ueber">{typName(typ)}</p>
        {/* Kopfzeile (#427): „Mappe ▾“ neben dem Stern – gehört sichtbar zur Mappe, nicht zum Aufgaben-Banner. */}
        <div className="titelzeile"><h1><Ehemalig id={mappe.id}>{titelOder(mappe.titel)}</Ehemalig></h1>
          <div className="mappenkopf-knoepfe">
            <Stern mappeId={mappe.id} an={!!details.favorit} />
            <Aktionsmenue aufgabe={() => setAufgabeOffen(true)} erinnern={() => setErinnernOffen(true)} email={details.exportierbar === false ? undefined : () => setEmailOffen(true)} drucken={details.exportierbar === false ? undefined : () => setDrucken(true)}
              link={direktlink ? () => { const l = location.origin + direktlink; void kopiere(l).then((ok) => setKopiert({ link: l, ok })); } : undefined}
              auskunft={details.auskunft ? () => geheZu(`/werkbank/auskuenfte/neu?mappe=${encodeURIComponent(details.mappe.id)}`) : undefined}
              loeschwege={[
                ...(loeschbarHier ? [{ text: t('ablage.mappeformular.mappe-loeschen'), tu: () => setLoeschWunsch((n) => n + 1), nurSchmal: true }] : []),
                ...(mitVerknuepften ? [{ text: t('ablage.mappeformular.mit-verknuepften-mappen-loeschen'), titel: t('ablage.mappeformular.diese-mappe-samt-allen'), tu: mitVerknuepften }] : []),
              ]} />
          </div>
        </div>
        <dl className="index">
          <div><dt>{t('ablage.mappeformular.angelegt')}</dt><dd>{t('ablage.mappeformular.von', { zeit: zeit(mappe.erstellt) })}{' '}<Person id={mappe.erstelltVon} /></dd></div>
          <div><dt>{t('ablage.mappeformular.zuletzt-geaendert')}</dt><dd>{t('ablage.mappeformular.von', { zeit: zeit(mappe.geaendert) })}{' '}<Person id={mappe.geaendertVon} /></dd></div>
          {/* Archivmodus (#212) */}
          {details.aufbewahrenBis && <div><dt><span className="chip archiv" title={t('ablage.mappeformular.archivmodus-vor-fristende-nicht')}>{t('ablage.mappeformular.archiv')}</span></dt><dd>{inFrist(details.aufbewahrenBis) ? t('ablage.mappeformular.aufbewahren-bis') : t('ablage.mappeformular.frist-abgelaufen-am')} {datumText(details.aufbewahrenBis)}</dd></div>}
        </dl>
        {typ.system === 'benutzer' && ich.rolle === 'admin' && <p className="leise klein"><Link to={`/werkbank/benutzer/${mappe.id}`} className="verweis">{t('ablage.mappeformular.in-der-benutzerverwaltung-oeffnen')}</Link></p>}
        {mappe.systemKennung && <p className="leise klein"><span className="chip">{t('ablage.mappeformular.systemrolle')}</span> {t('mappen.systemrolle.hinweis')}</p>}
        {kopiert && <LinkKopiert {...kopiert} schliessen={() => setKopiert(null)} />}
      </div>
      {details.nurImVerwaltungsmodus && <NurImModus mappeId={mappe.id} />}
      {typ.system === 'post' && <PostLeiste typ={typ} details={details} neuLaden={neuLaden} />}
      <AufgabenHinweis aufgaben={details.aufgaben ?? []} neuLaden={neuLaden} zuNotizen={() => setRegisterWunsch((w) => ({ key: NOTIZEN_REGISTER, n: (w?.n ?? 0) + 1 }))} />
      <Erinnerungen liste={details.erinnerungen ?? []} neuLaden={neuLaden} />
      {aufgabeOffen && <NeueAufgabe mappeId={mappe.id} neuLaden={neuLaden} schliessen={() => setAufgabeOffen(false)} />}
      {erinnernOffen && <ErinnerungFormular mappeId={mappe.id} neuLaden={neuLaden} schliessen={() => setErinnernOffen(false)} />}
      {loeschBaum && <LoeschBaum key={mappe.id} mappeId={mappe.id} titel={mappe.titel ?? ''} sicht={sicht} schliessen={() => setLoeschBaum(false)} neuLaden={neuLaden} />}
      {emailOffen && <EmailMaske key={mappe.id} typ={typ} details={details} neuLaden={neuLaden} schliessen={() => setEmailOffen(false)} />}
      {drucken && <Druckansicht typ={typ} details={details} fertig={druckEnde} />}
      {mappe.passt === false && (
        <div className="hinweis warn"><p>{t('ablage.mappeformular.diese-mappe-passt-nicht', { name: typ.name, wert: mappe.problem ? ` (${mappe.problem})` : '' })}</p></div>
      )}
      <Formular typ={typ} mappe={mappe} start={rohAusWerten(typ, mappe.werte)} sicht={sicht} anhang={anhang} details={details} neuLaden={neuLaden} registerWunsch={registerWunsch} mitVerknuepften={mitVerknuepften} loeschWunsch={loeschWunsch} />
      {verwaist.length > 0 && (
        <section className="blatt">
          <h2 className="h3">{t('ablage.mappeformular.werte-ohne-felddefinition')}</h2>
          <p className="leise">{t('ablage.mappeformular.diese-werte-stammen-aus')}</p>
          <ul className="verwaist">{verwaist.map(([k, v]) => <li key={k}><code>{k}</code>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}</ul>
        </section>
      )}
    </>
  );
}

/**
 * Register-Reihe (#427): Am Handy ist sie breiter als der Bildschirm und rollt waagerecht.
 * Ein Schatten am Rand zeigt, dass es weitergeht; der aktive Register rollt immer in den Blick.
 */
function RegisterReihe({ aktiv, children }: { aktiv?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rand, setRand] = useState({ links: false, rechts: false });
  const messe = useCallback(() => {
    const e = ref.current;
    if (!e) return;
    const links = e.scrollLeft > 2, rechts = e.scrollLeft + e.clientWidth < e.scrollWidth - 2;
    setRand((r) => (r.links === links && r.rechts === rechts ? r : { links, rechts }));
  }, []);
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    messe();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messe);
    ro?.observe(e);
    return () => ro?.disconnect();
  }, [messe]);
  useEffect(() => {
    const e = ref.current, eintrag = e?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!e || !eintrag || e.scrollWidth <= e.clientWidth) return;
    // Nur waagerecht rollen – scrollIntoView würde auch die Seite verschieben.
    if (eintrag.offsetLeft < e.scrollLeft) e.scrollLeft = eintrag.offsetLeft - 16;
    else if (eintrag.offsetLeft + eintrag.offsetWidth > e.scrollLeft + e.clientWidth) e.scrollLeft = eintrag.offsetLeft + eintrag.offsetWidth - e.clientWidth + 16;
    messe();
  }, [aktiv, messe]);
  return (
    <div className={`registerreihe${rand.links ? ' registerreihe-links' : ''}${rand.rechts ? ' registerreihe-rechts' : ''}`}>
      <div className="registertaben" role="tablist" aria-label={t('ablage.mappeformular.register')} ref={ref} onScroll={messe}>{children}</div>
    </div>
  );
}

/** In die Zwischenablage; ohne HTTPS (z. B. http://nas:8080) über ein unsichtbares Textfeld. */
async function kopiere(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* weiter mit dem Rückfall */ }
  const hTMLTextAreaElement = document.createElement('textarea');
  hTMLTextAreaElement.value = text; hTMLTextAreaElement.setAttribute('readonly', ''); hTMLTextAreaElement.style.position = 'fixed'; hTMLTextAreaElement.style.opacity = '0';
  document.body.appendChild(hTMLTextAreaElement); hTMLTextAreaElement.select();
  try { return document.execCommand('copy'); } catch { return false; } finally { hTMLTextAreaElement.remove(); }
}

/** Rückmeldung zu „Link kopieren“ (#98); klappt das Kopieren nicht, steht der Link markiert zum Kopieren da. */
function LinkKopiert({ link, ok, schliessen }: { link: string; ok: boolean; schliessen(): void }) {
  return (
    <div className={`hinweis ${ok ? 'gut' : 'warn'} linkkopiert`} role="status">
      <p>{ok ? t('ablage.mappeformular.link-kopiert') : t('ablage.mappeformular.kopieren-ging-nicht-markiere')}</p>
      <input type="text" readOnly value={link} aria-label={t('ablage.mappeformular.link-auf-diese-mappe')} onFocus={(e) => e.target.select()} autoFocus={!ok} />
      <button type="button" className="textknopf" onClick={schliessen}>{t('ablage.mappeformular.schliessen')}</button>
    </div>
  );
}

let zaehler = 0;

/** Mappen, die laut Register hierher verweisen (alle oder nur gewählte Quellen). */
function verknuepfungsGruppen(d: ReturnType<typeof useDaten>, mappe: Mappe | undefined, typId: string, register: Register, details?: MappeDetails | null) {
  const gewaehlt = register.quellen ?? [];
  return d.typen.flatMap((mappentyp) => mappentyp.felder
    .filter((f) => f.typ === 'referenz' && (f.zielTyp === typId || f.zielTyp === '*'))
    .filter((f) => !gewaehlt.length || gewaehlt.some((q) => q.typId === mappentyp.id && q.feldKey === f.key))
    .map((f) => ({
      t: mappentyp, f,
      // Trefferliste dieser Quelle (#75); fehlt sie (mehr), einfache Liste.
      liste: trefferlistenVon(mappentyp).find((l) => l.key === gewaehlt.find((q) => q.typId === mappentyp.id && q.feldKey === f.key)?.trefferliste),
      treffer: !mappe || !details ? [] as Rueckverweis[] : details.rueckverweise.filter((r) => r.quelleTypId === mappentyp.id && r.feldKey === f.key),
    })));
}

function Formular({ typ, mappe, start, sicht, anhang = '', details, neuLaden, zuordnen, registerWunsch, mitVerknuepften, loeschWunsch = 0 }: {
  typ: Mappentyp; mappe?: Mappe; start: RohWerte; sicht: string; anhang?: string; details?: MappeDetails | null; neuLaden?: () => Promise<void>; zuordnen?: ZuordnenNachher;
  /** „Mit verknüpften Mappen löschen …“ (#424) – als weiterer Weg unter „Warum nicht?“ (#423). */
  mitVerknuepften?: () => void;
  /** Register von außen öffnen (#427); `n` zählt, damit derselbe Wunsch erneut wirkt. */
  registerWunsch?: { key: string; n: number };
  /** „Mappe löschen …“ aus dem Menü „Mappe ▾“ (Handy, #489): zählt hoch, jeder neue Wert löscht (mit Rückfrage). */
  loeschWunsch?: number;
}) {
  const d = useDaten();
  const { ich } = useKonto();
  // Register des Typs plus System-Register „Notizen“ vor der Historie (#427).
  const register = mitNotizen(registerVon(typ));
  // Nur lesbar: Systemfelder von Benutzern, Name einer Systemrolle (#26, #27).
  const geschuetzt = geschuetzteFelder(typ, mappe);
  // Berechtigungen (#126): ohne „Bearbeiten“ nur ansehen; Löschen und Passwörter je nach Recht.
  const rechte = mappe ? details?.rechte : undefined;
  const nurLesen = !!rechte && !rechte.U;
  const darfLoeschenHier = !rechte || rechte.D;
  // „Mappe löschen“ (#423): nie kommentarlos grau – warum nicht, steht auf Klick direkt am Knopf.
  const loeschenZeigen = !!mappe && darfLoeschen(typ, mappe);
  const loeschSperre: Loeschsperre | undefined = !loeschenZeigen ? undefined
    : !darfLoeschenHier ? { grund: t('ablage.mappeformular.mappen-dieses-mappentyps-darfst') }
    : details?.loeschbar?.ok === false ? { grund: details.loeschbar.grund ?? t('ablage.mappeformular.diese-mappe-laesst-sich'), rueckverweise: details.loeschbar.rueckverweise }
    : undefined;
  // Weitere Löschwege trotz Sperre (z. B. „Mit verknüpften Mappen löschen …“, #424) kommen über `wege` dazu.
  const loeschKnopf = loeschenZeigen ? <LoeschKnopf sperre={loeschSperre} loeschen={() => void loeschen()}
    wege={mitVerknuepften && <button type="button" className="textknopf gefahr klein" onClick={mitVerknuepften}>{t('ablage.mappeformular.mit-verknuepften-mappen-loeschen')}</button>} /> : <span />;
  // Sprung aus der Suche nach einer Archivnummer (#345): ?register=… öffnet das Register.
  // Erwähnung in einer Notiz (#427): gleich den Register „Notizen“.
  const [aktiv, setAktiv] = useState(() => startRegister(register, new URLSearchParams(location.search).get('register'), details?.aufgaben, ich.id));
  useEffect(() => { if (registerWunsch) setAktiv(registerWunsch.key); }, [registerWunsch]);
  const [basis, setBasis] = useState(() => JSON.stringify(start));
  const basisRoh = useMemo(() => JSON.parse(basis) as RohWerte, [basis]);
  // Gleichzeitig bearbeiten (#609): Stand der Mappe, auf dem `basis` beruht – geht beim Speichern mit.
  const [stand, setStand] = useState(mappe?.geaendert);
  const [konflikt, setKonflikt] = useState<Mappenkonflikt & { wahl: Record<string, 'meins' | 'seins'> }>();
  const [roh, setRoh] = useState<RohWerte>(start);
  const [neueDateien, setNeueDateien] = useState<NeueDatei[]>([]);
  const [entfernt, setEntfernt] = useState<string[]>([]);
  const [fehler, setFehler] = useState<Pruefergebnis | null>(null);
  const [meldung, setMeldung] = useState<string>();
  const [hinweise, setHinweise] = useState<Array<{ art: 'warn' | 'schlecht'; text: ReactNode }>>([]);
  const [sendet, setSendet] = useState(false);
  // „Aus Dokument ausfüllen“ (#391): Vorschläge je Feld – eingetragen (Feld war leer) oder als Alternative.
  const knopf = nurLesen ? null : ausDokumentKnopf(typ);
  const [adOffen, setAdOffen] = useState(false);
  const [vorschlaege, setVorschlaege] = useState<Record<string, FeldVorschlag>>({});
  const [adNeu, setAdNeu] = useState<TypVorschlaege['neu']>({});
  const [adMeldung, setAdMeldung] = useState<string>();
  // Titel und Typ der Mappen, auf die verwiesen wird (vom Server und aus der Auswahl).
  const [bekannt, setBekannt] = useState<Bezuege>(details?.bezuege ?? {});
  useEffect(() => { if (details) setBekannt((b) => ({ ...b, ...details.bezuege })); }, [details]);
  const merke = (id: string, b: { titel: string; typId: string }) => setBekannt((x) => (x[id]?.titel === b.titel ? x : { ...x, [id]: b }));
  const werteGeaendert = JSON.stringify(roh) !== basis;
  // Hat sich die Mappe anderswo geändert (z. B. „Datum auf … setzen“, #130) und ist hier nichts ungespeichert: übernehmen.
  const startJson = JSON.stringify(start);
  useEffect(() => {
    if (mappe && !werteGeaendert && startJson !== basis) { setBasis(startJson); setRoh(JSON.parse(startJson)); }
    // Mit den Werten auch ihren Stand übernehmen (#609) – solange hier nichts ungespeichert ist.
    if (mappe && !werteGeaendert) setStand(mappe.geaendert);
  }, [startJson, mappe?.geaendert]); // eslint-disable-line react-hooks/exhaustive-deps
  const dokumenteGeaendert = neueDateien.length > 0 || entfernt.length > 0;
  const geaendert = werteGeaendert || dokumenteGeaendert || !mappe;
  useUngespeichert(werteGeaendert || dokumenteGeaendert);

  const dokumenteIn = (key: string) => (details?.dokumente ?? []).filter((x) => x.registerKey === key);
  const anzahl = (r: AnsichtsRegister): number | undefined => {
    if (r.art === 'notizen') return mappe ? details?.notizen?.length ?? 0 : undefined;
    if (r.art === 'dokumente') return dokumenteIn(r.key).filter((x) => !entfernt.includes(x.id)).length + neueDateien.filter((n) => n.register === r.key).length;
    if (r.art === 'verknuepfungen') return verknuepfungsGruppen(d, mappe, typ.id, r, details).reduce((a, g) => a + g.treffer.length, 0);
    return undefined;
  };
  const verwerfen = () => { setKonflikt(undefined); setRoh(JSON.parse(basis)); setNeueDateien([]); setEntfernt([]); setFehler(null); setMeldung(undefined); setHinweise([]); setVorschlaege({}); setAdNeu({}); setAdMeldung(undefined); };

  const reg = register.find((r) => r.key === aktiv) ?? register[0];
  const felderAuf = (r: Register) => typ.felder.filter((f) => r.felder?.includes(f.key));
  const fehlerAuf = (r: AnsichtsRegister) => (r.art === 'felder' ? felderAuf(r).filter((f) => fehler?.felder[f.key]).length : 0);

  /** Auswahlfilter mit Werten dieser Mappe (#173): nur die Felder, von denen er abhängt. */
  const eigeneWerte = (f: Feld): Werte | undefined => {
    const keys = eigeneFelderIm(f.auswahlFilter);
    if (!keys.length) return undefined;
    const w = werteAusRoh(typ, roh);
    return Object.fromEntries(keys.map((k) => [k, w[k] ?? null]));
  };
  const setze = (k: string, v: Roh) => {
    setRoh((r) => ({ ...r, [k]: v }));
    if (fehler?.felder[k]) setFehler((f) => f && { ...f, felder: Object.fromEntries(Object.entries(f.felder).filter(([x]) => x !== k)) });
  };

  /** Vorschläge eintragen (#391): leere Felder bekommen den Wert, gefüllte eine Alternative; nichts ist gespeichert. */
  function uebernimmVorschlaege({ r, dateien, ablegen }: AusDokumentErgebnis) {
    const neu: Record<string, FeldVorschlag> = {};
    const werte: RohWerte = {};
    for (const [k, v] of Object.entries(r.vorschlaege)) {
      const f = typ.felder.find((x) => x.key === k);
      if (!f || geschuetzt[k] !== undefined) continue;
      const vorschlag = zuRoh(f, v.wert);
      if (istLeer(ausRoh(f, roh[k]))) { werte[k] = vorschlag; neu[k] = { ...v, art: 'eingetragen', vorher: roh[k] }; }
      else if (JSON.stringify(roh[k]) !== JSON.stringify(vorschlag)) neu[k] = { ...v, art: 'alternative' };
    }
    for (const [id, b] of Object.entries(r.bezuege)) merke(id, b);
    setRoh((x) => ({ ...x, ...werte }));
    setVorschlaege(neu);
    setAdNeu(Object.fromEntries(Object.entries(r.neu).filter(([k]) => istLeer(ausRoh(typ.felder.find((x) => x.key === k)!, roh[k])))));
    if (ablegen && dateien.length) setNeueDateien((x) => [...x, ...dateien.map((datei) => ({ uid: `n${++zaehler}`, datei, register: ablegen }))]);
    const n = Object.values(neu).filter((v) => v.art === 'eingetragen').length;
    const alt = Object.values(neu).filter((v) => v.art === 'alternative').length;
    const teile = [n ? t('ablage.mappeformular.felder-als-vorschlag-eingetragen', { anzahl: n }) : '', alt ? t('ablage.mappeformular.alternativen-zu-ausgefuellten', { anzahl: alt }) : ''].filter(Boolean);
    // Erkennung per Paket (#511): womit erkannt wurde bzw. warum die eingebaute übernahm.
    // Gekürzt (#564): Der KI-Dienst hat nur einen Teil des Texts gelesen – das sagen, nie still abschneiden.
    const herkunft = [r.engine?.art === 'paket' ? t('erkennung.ergebnis.paket', { name: r.engine.name }) : '', r.gekuerzt ? t('erkennung.ergebnis.gekuerzt') : '', r.hinweis ?? ''].filter(Boolean).join(' ');
    setAdMeldung(`${teile.length ? t('ablage.mappeformular.verstanden-bitte-pruefen-und', { teile: teile.join(', ') }) : t('ablage.mappeformular.gelesen-aber-keine-passenden')}${herkunft ? ` ${herkunft}` : ''}`);
    setAdOffen(false);
    // Zum ersten Feldregister mit einem Vorschlag.
    const ziel = register.find((x) => x.art === 'felder' && felderAuf(x).some((f) => neu[f.key]));
    if (ziel) setAktiv(ziel.key);
  }
  function vorschlagZuruecknehmen(k: string) {
    const v = vorschlaege[k];
    if (v?.art === 'eingetragen') setRoh((x) => ({ ...x, [k]: v.vorher ?? zuRoh(typ.felder.find((f) => f.key === k)!, null) }));
    setVorschlaege((x) => Object.fromEntries(Object.entries(x).filter(([y]) => y !== k)));
  }
  function alternativeUebernehmen(k: string) {
    const v = vorschlaege[k]; const f = typ.felder.find((x) => x.key === k);
    if (!v || !f) return;
    const vorher = roh[k];
    setze(k, zuRoh(f, v.wert));
    setVorschlaege((x) => ({ ...x, [k]: { ...v, art: 'eingetragen', vorher } }));
  }
  async function neuAnlegen(k: string) {
    const n = adNeu[k]; const f = typ.felder.find((x) => x.key === k); const ziel = d.typ(n?.typId);
    if (!n || !f || !ziel) return;
    const liste = Object.entries(n.werte).map(([key, w]) => `${((f2) => (f2 ? feldLabel(f2) : key))(ziel.felder.find((x) => x.key === key))}: ${w}`).join(' · ');
    if (!(await rueckfrage({ titel: t('ablage.mappeformular.neue-mappe-anlegen', { name: typName(ziel) }), text: t('ablage.mappeformular.mit-diesen-angaben-du', { liste }), ja: t('ablage.mappeformular.anlegen') }))) return;
    try {
      const m = await api.mappeAnlegen({ typId: ziel.id, werte: n.werte });
      merke(m.id, { titel: m.titel ?? '', typId: m.typId });
      const vorher = roh[k];
      setze(k, f.mehrfach ? [m.id] : m.id);
      setVorschlaege((x) => ({ ...x, [k]: { wert: m.id, sicherheit: 'mittel', fundstelle: t('ablage.mappeformular.neu-angelegt', { titelOder: titelOder(m.titel) }), art: 'eingetragen', vorher } }));
      setAdNeu((x) => Object.fromEntries(Object.entries(x).filter(([y]) => y !== k)));
      await d.neuLaden();
    } catch (e) { await hinweis({ titel: t('ablage.mappeformular.nicht-angelegt'), text: (e as Error).message }); }
  }
  /** Hinweis am Feld: Vorschlag (solange der Wert noch so ist) bzw. Alternative aus dem Dokument. */
  function vorschlagAm(f: Feld): ReactNode {
    const v = vorschlaege[f.key];
    if (!v) return null;
    const sicher = v.sicherheit === 'hoch' ? 'sicher' : v.sicherheit === 'mittel' ? 'wahrscheinlich' : 'unsicher';
    if (v.art === 'eingetragen') {
      if (JSON.stringify(roh[f.key]) !== JSON.stringify(zuRoh(f, v.wert))) return null;
      return <p className="ad-hinweis"><span className="chip">{t('ablage.mappeformular.vorschlag')}</span> <span className="leise">{sicher}{v.fundstelle ? <> – „{v.fundstelle}“</> : null}</span> <button type="button" className="textknopf klein" onClick={() => vorschlagZuruecknehmen(f.key)}>{t('ablage.mappeformular.zuruecknehmen')}</button></p>;
    }
    const text = f.typ === 'referenz' ? titelOder(bekannt[String(Array.isArray(v.wert) ? v.wert[0] : v.wert)]?.titel) : formatiere(f, v.wert);
    return <p className="ad-hinweis"><span className="chip">{t('ablage.mappeformular.im-dokument')}</span> <strong>{text}</strong> <span className="leise">({sicher})</span> <button type="button" className="textknopf klein" onClick={() => alternativeUebernehmen(f.key)}>{t('ablage.mappeformular.uebernehmen')}</button> <button type="button" className="textknopf klein" onClick={() => vorschlagZuruecknehmen(f.key)}>{t('ablage.mappeformular.verwerfen')}</button></p>;
  }
  const alternativen = Object.entries(vorschlaege).filter(([, v]) => v.art === 'alternative').map(([k]) => k);
  /** Altes Textfeld nach einem Paket-Update (#534): leer ausgeblendet, sonst mit Hinweis auf die Umwandlung. */
  const altesFeld = (f: Feld) => verweisAusText(typ, f);
  const sichtbar = (f: Feld) => !altesFeldAusblenden(f, mappe?.werte[f.key], altesFeld(f));
  function hinweisAm(f: Feld): ReactNode {
    const v = altesFeld(f);
    const zusatz = vorschlagAm(f);
    if (!v || istLeer(mappe?.werte[f.key])) return zusatz;
    return <>{zusatz}<small className="hilfe">{t('pakete.formular.alttext', { feld: v.label })}</small></>;
  }

  function zeigeFehler(p: Pruefergebnis) {
    setFehler(p);
    // Zum ersten Register mit Fehler springen, falls das aktuelle keinen hat.
    if (reg?.art === 'felder' && felderAuf(reg).some((f) => p.felder[f.key])) return;
    const ziel = register.find((r) => r.art === 'felder' && felderAuf(r).some((f) => p.felder[f.key]));
    if (ziel) setAktiv(ziel.key);
  }

  /**
   * Speichern. Gleichzeitig bearbeiten (#609): An den Server gehen nur die Felder, die hier geändert wurden,
   * dazu der Stand, auf dem sie beruhen. Hat jemand anderes dasselbe Feld inzwischen geändert, antwortet er
   * mit 409 – dann fragt das Formular je Feld (`konflikt`). `nochmal`: nach der Antwort, mit dem neuen Stand;
   * Felder in `seins` bleiben, wie sie auf dem Server stehen.
   */
  async function speichern(nochmal?: { stand: string; seins: Record<string, Roh> }) {
    setMeldung(undefined);
    setKonflikt(undefined);
    const rohJetzt: RohWerte = nochmal ? { ...roh, ...nochmal.seins } : roh;
    if (nochmal) setRoh(rohJetzt);
    const werte = werteAusRoh(typ, rohJetzt);
    const geaenderteFelder = typ.felder.map((f) => f.key).filter((k) => JSON.stringify(rohJetzt[k] ?? null) !== JSON.stringify(basisRoh[k] ?? null) && !(nochmal && k in nochmal.seins));
    const zuSenden = Object.fromEntries(geaenderteFelder.map((k) => [k, werte[k] ?? null]));
    const p = d.pruefe(typ, werte, (id) => bekannt[id]?.typId);
    // Formate und Datumsgrenzen (#535): neue Mappe ganz, sonst nur, was sich ändert.
    for (const [k, m] of Object.entries(pruefeFormate(typ, werte, mappe?.werte))) p.felder[k] ??= m;
    if (!istOk(p)) { zeigeFehler(p); setMeldung(t('ablage.mappeformular.bitte-die-markierten-felder')); return; }
    // Würde man sich mit diesen Werten selbst das Lesen oder Bearbeiten entziehen? Dann erst fragen (#126).
    if (mappe && werteGeaendert && ich.rolle !== 'admin') {
      const r = await api.rechteVorschau(mappe.id, werte).catch(() => null);
      if (r && !r.R && !(await rueckfrage({ titel: t('ablage.mappeformular.trotzdem-speichern'), text: t('ablage.mappeformular.nach-dem-speichern-kannst'), ja: t('ablage.mappeformular.trotzdem-speichern-2'), gefahr: true }))) return;
      if (r && r.R && !r.U && !(await rueckfrage({ titel: t('ablage.mappeformular.trotzdem-speichern'), text: t('ablage.mappeformular.nach-dem-speichern-kannst-2'), ja: t('ablage.mappeformular.trotzdem-speichern-2'), gefahr: true }))) return;
    }
    setSendet(true); setHinweise([]);
    let gespeichert: (Mappe & { hinweis?: string }) | undefined = mappe;
    try {
      if (!mappe) gespeichert = await api.mappeAnlegen({ typId: typ.id, werte });
      else if (geaenderteFelder.length) gespeichert = await api.mappeAendern(mappe.id, { werte: zuSenden, stand: nochmal?.stand ?? stand });
      setFehler(null); setBasis(JSON.stringify(rohJetzt));
      if (gespeichert) setStand(gespeichert.geaendert);
    } catch (e) {
      const f = e as ApiFehler;
      const k = f.status === 409 ? f.details as Mappenkonflikt | undefined : undefined;
      if (k && Array.isArray(k.konflikte) && k.konflikte.length) {
        setKonflikt({ ...k, wahl: {} });
        setMeldung(t('mappen.konflikt.status'));
        window.setTimeout(() => document.querySelector('.mappenkonflikt')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      } else {
        if (f.pruefung) zeigeFehler(f.pruefung);
        setMeldung(f.message);
      }
      setSendet(false);
      return;
    }
    // Dokumente erst jetzt: hochladen, was neu ist, und entfernen, was markiert ist.
    const neu: typeof hinweise = [];
    const offen: NeueDatei[] = [];
    for (const n of neueDateien) {
      try {
        // Gleicher Name (#194): Standard mit Versionierung „neue Version“, sonst „mit Zähler“.
        const gleich = (details?.dokumente ?? []).some((x) => x.registerKey === n.register && !entfernt.includes(x.id) && x.name.toLowerCase() === n.datei.name.toLowerCase());
        const versioniert = !!typ.register.find((r) => r.key === n.register)?.versionierung;
        const r = await api.ladeHoch(gespeichert!.id, n.register, n.datei, gleich ? n.gleicherName ?? (versioniert ? 'version' : 'zaehler') : undefined);
        const anderswo = r.gleicherInhalt.filter((g) => g.mappeId !== gespeichert!.id);
        if (anderswo.length) neu.push({ art: 'warn', text: <>{t('ablage.mappeformular.hat-denselben-inhalt-wie', { name: n.datei.name })}{' '}{anderswo.map((g, j) => { return <span key={j}>{tn('ablage.mappeformular.in', { wert: j > 0 && ', ', name: g.name, wert2: g.typId ? <Link to={`/ablage/${g.typId}/${g.mappeId}`} className="verweis">{titelOder(g.titel)}</Link> : t('ablage.mappeformular.einer-anderen-mappe') })}</span>; })}{t('ablage.mappeformular.gespeichert-ist-die-datei')}</> });
      } catch (e) {
        offen.push(n);
        neu.push({ art: 'schlecht', text: t('ablage.mappeformular.wurde-nicht-hochgeladen', { name: n.datei.name, message: (e as Error).message }) });
      }
    }
    // Zuordnen (#192): Die Post gehört jetzt zu dieser neuen Mappe.
    if (!mappe && zuordnen) {
      try { await api.zuordnen(zuordnen.post, { ziel: gespeichert!.id, register: zuordnen.register, dokumente: zuordnen.dokumente, kopieren: zuordnen.kopieren }); }
      catch (e) { await hinweis({ titel: t('ablage.mappeformular.post-nicht-zugeordnet'), text: t('ablage.mappeformular.die-mappe-ist-angelegt', { message: (e as Error).message }) }); }
    }
    const nichtEntfernt: string[] = [];
    for (const id of entfernt) {
      try { await api.dokumentLoeschen(id); } catch (e) { nichtEntfernt.push(id); neu.push({ art: 'schlecht', text: (e as Error).message }); }
    }
    setNeueDateien(offen); setEntfernt(nichtEntfernt); setHinweise(neu);
    setVorschlaege({}); setAdNeu({}); setAdMeldung(undefined);
    if (!offen.length && !nichtEntfernt.length) loeseWache();
    // Lesen verloren (#126): zurück zur Liste, mit Hinweis.
    const verloren = gespeichert?.hinweis?.includes('nicht mehr sehen');
    if (verloren) { loeseWache(); await hinweis({ titel: t('ablage.mappeformular.gespeichert'), text: gespeichert!.hinweis }); await d.neuLaden(); geheZu(`/ablage/${sicht}${anhang}`); return; }
    await d.neuLaden();
    await neuLaden?.();
    setSendet(false);
    if (!mappe) geheZu(`/ablage/${sicht}/${gespeichert!.id}`);
    else setMeldung(gespeichert?.hinweis ?? (offen.length || nichtEntfernt.length ? t('ablage.mappeformular.teilweise-gespeichert') : t('ablage.mappeformular.gespeichert-2')));
  }

  /** Rückfrage beantwortet (#609): „meins“ geht mit dem neuen Stand noch einmal mit, „seins“ wird übernommen. */
  function konfliktEntscheiden() {
    if (!konflikt) return;
    const seins: Record<string, Roh> = {};
    for (const k of konflikt.konflikte) {
      if (konflikt.wahl[k.feld] !== 'seins') continue;
      const f = typ.felder.find((x) => x.key === k.feld);
      if (f) seins[k.feld] = k.geheim ? basisRoh[k.feld] ?? zuRoh(f, null) : zuRoh(f, k.wert ?? null);
    }
    void speichern({ stand: konflikt.stand, seins });
  }

  async function loeschen() {
    if (!mappe) return;
    const n = details?.dokumente.length ?? 0;
    const korb = d.zaehler.papierkorbTage ?? 0;
    // Grund fürs Löschprotokoll (#470).
    const anlass = await mitGrund(korb
      ? { titel: t('ablage.mappeformular.mappe-in-den-papierkorb', { titelOder: titelOder(mappe.titel) }), text: t('ablage.mappeformular.dort-laesst-sie-sich', { anzahl: korb, wert: n ? t('ablage.mappeformular.ihre-dokumente-kommen-mit', { anzahl: n }) : '' }), ja: t('ablage.mappeformular.in-den-papierkorb'), gefahr: true }
      : { titel: t('ablage.mappeformular.mappe-endgueltig-loeschen', { titelOder: titelOder(mappe.titel) }), text: t('ablage.mappeformular.das-laesst-sich-nicht', { wert: n ? t('ablage.mappeformular.ihre-dokumente-werden-mitgeloescht', { anzahl: n }) : '' }), ja: t('ablage.mappeformular.endgueltig-loeschen'), gefahr: true });
    if (!anlass) return;
    try {
      await api.mappeLoeschen(mappe.id, anlass);
      loeseWache(); await d.neuLaden(); geheZu(`/ablage/${sicht}${anhang}`);
    } catch (e) { setMeldung((e as Error).message); }
  }

  const loeschenRef = useRef({ loeschen, loeschSperre });
  loeschenRef.current = { loeschen, loeschSperre };
  const ersterLoeschWunsch = useRef(loeschWunsch);
  useEffect(() => {
    if (loeschWunsch === ersterLoeschWunsch.current) return;
    const { loeschen: tu, loeschSperre: sperre } = loeschenRef.current;
    if (sperre) void hinweis({ titel: t('ablage.mappeformular.loeschen-nicht-moeglich'), text: sperre.grund });
    else void tu();
  }, [loeschWunsch]);

  let inhalt: ReactNode = null;
  if (!reg) inhalt = <p className="leise">{t('ablage.mappeformular.dieser-mappentyp-hat-keine')}</p>;
  else if (reg.art === 'felder') {
    const felder = felderAuf(reg).filter(sichtbar);
    inhalt = felder.length
      ? <div className="formular">{felder.map((f) => <FeldEingabe key={f.key} feld={f} roh={roh[f.key]} fehler={fehler?.felder[f.key]?.[0]} setze={(v) => setze(f.key, v)} eigeneId={mappe?.id} bekannt={bekannt} merke={merke}
          typId={typ.id} unpassend={details?.unpassend?.[f.key]} eigene={eigeneWerte(f)}
          gesperrt={geschuetzt[f.key] ?? (nurLesen && f.typ !== 'passwort' ? '' : undefined)} nurLesen={nurLesen} plzDeutsch={f.format === 'plz' ? deutschePlz(f, typ.felder, roh as Werte) : undefined} passwortSehen={!rechte || rechte.P} zusatz={hinweisAm(f)} gespeichert={mappe ? mappe.werte[f.key] : undefined} />)}</div>
      : <p className="leise">{t('ablage.mappeformular.auf-diesem-register-liegen')}</p>;
  } else if (reg.art === 'dokumente') {
    inhalt = mappe && !details ? <p className="leise">{t('ablage.mappeformular.lade')}</p> : (
      <Dokumente key={reg.key} register={reg} dokumente={dokumenteIn(reg.key)} neue={neueDateien.filter((n) => n.register === reg.key)} entfernt={entfernt}
        hinzufuegen={(dateien) => setNeueDateien((x) => [...x, ...dateien.map((datei) => ({ uid: `n${++zaehler}`, datei, register: reg.key }))])}
        entferne={(id) => setEntfernt((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))}
        entferneMehrere={(ids) => setEntfernt((x) => [...x, ...ids.filter((id) => !x.includes(id))])}
        vergiss={(uid) => setNeueDateien((x) => x.filter((n) => n.uid !== uid))} nurLesen={nurLesen}
        setzeNeue={(uid, patch) => setNeueDateien((x) => x.map((n) => (n.uid === uid ? { ...n, ...patch } : n)))}
        neuLaden={mappe ? async () => { await neuLaden?.(); await d.neuLaden(); } : undefined} post={typ.system === 'post'} typ={typ} mappeTitel={mappe?.titel ?? ''}
        mitnehmen={details?.exportierbar !== false} />
    );
    // Ähnliche Dokumente (#442): nur mit einem Paket mit dms:vektoren und wenn hier Dokumente liegen.
    if (mappe && details && dokumenteIn(reg.key).length > 0) inhalt = <>{inhalt}<AehnlicheDokumente mappeId={mappe.id} /></>;
  } else if (reg.art === 'notizen') {
    inhalt = !mappe ? <p className="leise">{t('ablage.mappeformular.notizen-gehen-nach-dem')}</p>
      : !details ? <p className="leise">{t('ablage.mappeformular.lade')}</p>
      : <Notizen mappeId={mappe.id} notizen={details.notizen ?? []} neuLaden={async () => { await neuLaden?.(); }} />;
  } else if (reg.art === 'protokoll') {
    inhalt = mappe ? <Historie mappeId={mappe.id} stand={mappe.geaendert} typ={typ} /> : <p className="leise">{t('ablage.mappeformular.die-historie-beginnt-mit')}</p>;
  } else if (!mappe) {
    inhalt = <p className="leise">{t('ablage.mappeformular.verknuepfungen-entstehen-sobald')}</p>;
  } else if (!details) {
    inhalt = <p className="leise">{t('ablage.mappeformular.lade')}</p>;
  } else {
    inhalt = <Verknuepfungen mappe={mappe} gruppen={verknuepfungsGruppen(d, mappe, typ.id, reg, details)} />;
  }

  return (
    <>
    {knopf && (adOffen
      ? <AusDokument typ={typ} titel={knopf} mappeId={mappe?.id} dokumente={(details?.dokumente ?? []).filter((x) => x.ocr?.stand === 'fertig')} fertig={uebernimmVorschlaege} schliessen={() => setAdOffen(false)} />
      : <div className="ad-leiste"><button type="button" className="knopf klein" onClick={() => setAdOffen(true)}><Symbol name="kamera" /> {knopf}</button></div>)}
    {(adMeldung || Object.keys(adNeu).length > 0) && (
      <div className="hinweis info ad-ergebnis" role="status">
        {adMeldung && <p>{adMeldung}</p>}
        {Object.entries(adNeu).map(([k, n]) => {
          const f = typ.felder.find((x) => x.key === k); const ziel = d.typ(n.typId);
          return f && ziel ? <p key={k}>{t('ablage.mappeformular.fuer-gibt-es-noch', { label: feldLabel(f), values: Object.values(n.werte).slice(0, 3).join(', ') })}{' '}{darfErstellen(ziel) && <button type="button" className="textknopf" onClick={() => void neuAnlegen(k)}>{t('ablage.mappeformular.mit-diesen-angaben-anlegen', { name: ziel.name })}</button>}</p> : null;
        })}
        {(alternativen.length > 0 || Object.keys(vorschlaege).length > 0) && <div className="knoepfe">
          {alternativen.length > 0 && <button type="button" className="knopf klein" onClick={() => alternativen.forEach(alternativeUebernehmen)}>{t('ablage.mappeformular.alle-alternativen-uebernehmen')}</button>}
          <button type="button" className="textknopf klein" onClick={() => { Object.keys(vorschlaege).forEach(vorschlagZuruecknehmen); setAdMeldung(undefined); setAdNeu({}); }}>{t('ablage.mappeformular.alle-vorschlaege-zuruecknehmen')}</button>
        </div>}
      </div>
    )}
    <form className="blatt mitregistern" onSubmit={(e) => { e.preventDefault(); void speichern(); }} noValidate>
      <RegisterReihe aktiv={reg?.key}>
        {register.map((r) => {
          const n = fehlerAuf(r);
          const zahl = anzahl(r);
          return (
            <button key={r.key} type="button" role="tab" aria-selected={r.key === reg?.key} className={`registertab art-${r.art} ${r.key === reg?.key ? 'an' : ''}`}
              onClick={() => setAktiv(r.key)}>
              {registerName(r)}
              {n > 0 && <span className="fehlerpunkt" title={t('ablage.mappeformular.felder-mit-fehler', { anzahl: n })}>{n}</span>}
              {zahl !== undefined && <span className="anzahl">{zahl}</span>}
            </button>
          );
        })}
      </RegisterReihe>
      {fehler?.allgemein.length ? <div className="hinweis schlecht"><p>{fehler.allgemein.join(' ')}</p></div> : null}
      {hinweise.map((h, i) => <div key={i} className={`hinweis ${h.art}`}><p>{h.text}</p></div>)}
      <div className="registerinhalt" role="tabpanel">{inhalt}</div>
      {konflikt && <Konfliktfrage konflikt={konflikt} ich={ich.id} sendet={sendet}
        waehle={(feld, w) => setKonflikt((k) => k && { ...k, wahl: { ...k.wahl, [feld]: w } })}
        speichern={konfliktEntscheiden} abbrechen={() => { setKonflikt(undefined); setMeldung(undefined); }} />}
      {nurLesen ? <div className="speicherleiste">
        <span className="hy-nur-breit">{loeschKnopf}</span>
        <span className="status" role="status">{meldung ?? t('ablage.mappeformular.nur-lesen-bearbeiten-darfst')}</span>
        <span />
      </div> : <div className={`speicherleiste${mappe && !werteGeaendert && !dokumenteGeaendert && !sendet && !meldung ? ' hy-ruhig' : ''}`}>
        <span className="hy-nur-breit">{loeschKnopf}</span>
        <span className={`status ${meldung && fehler ? 'schlecht' : ''}`} role="status">{sendet ? t('ablage.mappeformular.speichere') : meldung ?? (mappe && (werteGeaendert || dokumenteGeaendert) ? t('ablage.mappeformular.ungespeicherte-aenderungen') : '')}</span>
        <div className="knoepfe">
          {mappe
            ? <button type="button" className="knopf" disabled={!(werteGeaendert || dokumenteGeaendert) || sendet} onClick={verwerfen}><span className="hy-nur-breit">{t('ablage.mappeformular.aenderungen-verwerfen')}</span><span className="hy-nur-schmal">{t('ablage.mappeformular.verwerfen')}</span></button>
            : <Link to={`/ablage/${sicht}`} className="knopf">{t('ablage.mappeformular.abbrechen')}</Link>}
          <button type="submit" className="knopf gruen" disabled={sendet}>{sendet ? t('ablage.mappeformular.speichere') : <><span className="hy-nur-breit">{t('ablage.mappeformular.mappe-speichern')}</span><span className="hy-nur-schmal">{t('ablage.mappeformular.speichern')}</span></>}</button>
        </div>
      </div>}
    </form>
    </>
  );
}

/** „um 17:04“ (heute) bzw. „am 01.11.2026 um 17:04“. */
function wann(iso: string): string {
  const d = new Date(iso);
  const uhrzeit = d.toLocaleTimeString(gebietsschema(), { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? t('mappen.konflikt.heute', { uhrzeit })
    : t('mappen.konflikt.am', { datum: d.toLocaleDateString(gebietsschema(), { day: '2-digit', month: '2-digit', year: 'numeric' }), uhrzeit });
}

/**
 * Rückfrage beim gleichzeitigen Bearbeiten (#609): je Feld, wer es wann worauf geändert hat und was du
 * eintragen wolltest – mit „Meins übernehmen“ und „Wert von … behalten“. Alles andere ist schon zusammengeführt.
 */
function Konfliktfrage({ konflikt, ich, sendet, waehle, speichern, abbrechen }: {
  konflikt: Mappenkonflikt & { wahl: Record<string, 'meins' | 'seins'> }; ich: string; sendet: boolean;
  waehle: (feld: string, w: 'meins' | 'seins') => void; speichern: () => void; abbrechen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const alle = konflikt.konflikte.every((k) => konflikt.wahl[k.feld]);
  const text = (v: string) => (v ? `„${v}“` : t('mappen.konflikt.leer'));
  return (
    <div className="hinweis warn mappenkonflikt" role="group" aria-labelledby="mappenkonflikt-titel" tabIndex={-1} ref={ref}>
      <h2 className="h3" id="mappenkonflikt-titel"><Symbol name="warnung" /> {t('mappen.konflikt.titel')}</h2>
      <p>{t('mappen.konflikt.einleitung')}</p>
      {konflikt.konflikte.map((k) => {
        const selbst = k.von === ich;
        const werte = { name: k.name, feld: k.label, wann: wann(k.zeit), aktuell: text(k.aktuell), deins: text(k.deins) };
        const satz = k.geheim ? t(selbst ? 'mappen.konflikt.selbstGeheim' : 'mappen.konflikt.andererGeheim', werte) : t(selbst ? 'mappen.konflikt.selbst' : 'mappen.konflikt.anderer', werte);
        return (
          <fieldset key={k.feld} className="mk-feld">
            <legend>{t('mappen.konflikt.frage', { feld: k.label })}</legend>
            <p>{satz}</p>
            <div className="mk-wahl">
              <label className="haken"><input type="radio" name={`mk-${k.feld}`} checked={konflikt.wahl[k.feld] === 'meins'} onChange={() => waehle(k.feld, 'meins')} />
                <span>{selbst ? t('mappen.konflikt.hier') : t('mappen.konflikt.meins')}{!k.geheim && <span className="leise"> – {text(k.deins)}</span>}</span></label>
              <label className="haken"><input type="radio" name={`mk-${k.feld}`} checked={konflikt.wahl[k.feld] === 'seins'} onChange={() => waehle(k.feld, 'seins')} />
                <span>{selbst ? t('mappen.konflikt.dort') : t('mappen.konflikt.seins', { name: k.name })}{!k.geheim && <span className="leise"> – {text(k.aktuell)}</span>}</span></label>
            </div>
          </fieldset>
        );
      })}
      {!alle && <p className="leise klein">{t('mappen.konflikt.fehlt')}</p>}
      <div className="knoepfe">
        <button type="button" className="knopf" onClick={abbrechen} disabled={sendet}>{t('mappen.konflikt.abbrechen')}</button>
        <button type="button" className="knopf gruen" onClick={speichern} disabled={!alle || sendet}>{t('mappen.konflikt.speichern')}</button>
      </div>
    </div>
  );
}

/** Ein Vorschlag aus „Aus Dokument ausfüllen“ (#391) am Feld. */
interface FeldVorschlag { wert: Wert; sicherheit: Sicherheit; fundstelle: string; art: 'eingetragen' | 'alternative'; vorher?: Roh }

function FeldEingabe({ feld: f, roh, fehler, setze, eigeneId, bekannt, merke, gesperrt, nurLesen, passwortSehen = true, typId, unpassend, eigene, zusatz, plzDeutsch, gespeichert }: {
  feld: Feld; roh: Roh | undefined; fehler?: string; setze: (v: Roh) => void; eigeneId?: string;
  /** Gespeicherter Wert (#732): Übersetzt wird immer nur er, nie die Eingabe. */
  gespeichert?: Wert;
  /** Format PLZ (#535): gilt die deutsche Regel? Dann am Handy die Zifferntastatur. */
  plzDeutsch?: boolean;
  /** Unter dem Feld, z. B. ein Vorschlag aus „Aus Dokument ausfüllen“ (#391). */
  zusatz?: ReactNode;
  /** Typ der Mappe und Verweise, die nicht (mehr) zum Auswahlfilter passen (#172). */
  typId?: string; unpassend?: string[];
  /** Werte dieser Mappe, von denen der Auswahlfilter abhängt (#173). */
  eigene?: Werte;
  bekannt: Bezuege; merke: (id: string, b: { titel: string; typId: string }) => void;
  /** Grund, warum das Feld hier nur angezeigt wird. */
  gesperrt?: string;
  /** Berechtigungen (#126): ohne „Bearbeiten“ bzw. ohne „Passwörter sehen“. */
  nurLesen?: boolean; passwortSehen?: boolean;
}) {
  const d = useDaten();
  const id = `feld-${f.key}`;
  // Übersetzung anzeigen (#732): unter dem Feld, nur lesbar – bearbeitet wird weiter das Original im Feld.
  const uebersetzung = eigeneId && typeof gespeichert === 'string' && feldUebersetzbar(f, gespeichert)
    ? <Uebersetzbar quelle={{ art: 'feld', mappe: eigeneId, feld: f.key }} original={gespeichert} ersetzen={false}
        darstellen={(x) => (f.typ === 'formatiert' ? <Formatiert text={x} /> : <span className="mehrzeilig">{x}</span>)}>{null}</Uebersetzbar>
    : null;
  let ctl: ReactNode;
  let breit = false;
  let mitLabelFor = true;

  if (gesperrt !== undefined) {
    mitLabelFor = false;
    const ids = f.typ === 'referenz' ? (Array.isArray(roh) ? roh as string[] : roh ? [String(roh)] : []) : [];
    ctl = <div className="festwert" title={gesperrt}>{
      f.typ === 'referenz'
        ? <ul>{ids.map((x) => <li key={x}>{bekannt[x]?.typId && !bekannt[x].verborgen ? <Link to={`/ablage/${bekannt[x].typId}/${x}`} className="verweis"><Ehemalig id={x}>{titelOder(bekannt[x].titel)}</Ehemalig></Link> : <span className={bekannt[x]?.verborgen ? 'verborgen-titel' : ''}>{titelOder(bekannt[x]?.titel)}</span>}</li>)}</ul>
        : f.typ === 'janein' ? (roh ? t('ablage.mappeformular.ja') : t('ablage.mappeformular.nein')) : f.typ === 'formatiert' ? <Formatiert text={String(roh ?? '')} />
        : f.typ === 'datum' ? formatiere(f, String(roh ?? '')) : f.typ === 'langtext' ? <span className="mehrzeilig">{String(roh ?? '')}</span>
        : f.typ === 'text' && f.format ? <FormatWert f={f} wert={String(roh ?? '')} /> : String(roh ?? '')
    }</div>;
    return (
      <div className={`feld ${f.typ === 'langtext' || f.typ === 'formatiert' ? 'breit' : ''}`}>
        <div className="feldkopf"><span className="label">{feldLabel(f)}</span></div>
        {ctl}
        {uebersetzung}
        <span className="hilfe">{gesperrt}</span>
        {fehler && <p className="fehlertext">{fehler}</p>}
      </div>
    );
  }

  switch (f.typ) {
    case 'langtext':
      breit = true;
      ctl = <textarea id={id} rows={3} value={String(roh ?? '')} onChange={(e) => setze(e.target.value)} />;
      break;
    case 'zahl':
      ctl = <input id={id} inputMode="decimal" value={String(roh ?? '')} onChange={(e) => setze(e.target.value)} />;
      break;
    case 'betrag': {
      const b = (roh ?? { betrag: '', waehrung: 'EUR' }) as RohBetrag;
      ctl = (
        <div className="betrag">
          <input id={id} inputMode="decimal" placeholder="0,00" value={b.betrag} onChange={(e) => setze({ ...b, betrag: e.target.value })} />
          <input aria-label={t('ablage.mappeformular.waehrung')} className="mono" maxLength={3} value={b.waehrung} onChange={(e) => setze({ ...b, waehrung: e.target.value.toUpperCase() })} />
        </div>
      );
      break;
    }
    case 'datum':
      ctl = <input id={id} type="date" value={String(roh ?? '')} onChange={(e) => setze(e.target.value)} />;
      break;
    case 'janein':
      mitLabelFor = false;
      ctl = <label className="haken"><input id={id} type="checkbox" checked={!!roh} onChange={(e) => setze(e.target.checked)} /><span>{t('ablage.mappeformular.ja')}</span></label>;
      break;
    case 'auswahl': {
      const optionen = f.optionen ?? [];
      if (f.mehrfach) {
        mitLabelFor = false;
        const gewaehlt = (roh as string[]) ?? [];
        ctl = <div className="auswahlliste">{optionen.map((o) => (
          <label key={o} className="haken"><input type="checkbox" checked={gewaehlt.includes(o)} onChange={(e) => setze(e.target.checked ? [...gewaehlt, o] : gewaehlt.filter((x) => x !== o))} /><span>{optionText(f, o)}</span></label>
        ))}</div>;
      } else {
        const r = String(roh ?? '');
        ctl = <select id={id} value={r} onChange={(e) => setze(e.target.value)}>
          <option value="">{t('ablage.mappeformular.keine-angabe')}</option>
          {/* Gespeichert wird der feste Wert, gezeigt die Beschriftung (#728). */}
          {optionen.map((o) => <option key={o} value={o}>{optionText(f, o)}</option>)}
          {r && !optionen.includes(r) && <option value={r}>{r}</option>}
        </select>;
      }
      break;
    }
    case 'referenz': {
      const ziel = d.typ(f.zielTyp);
      if (!ziel) { ctl = <p className="leise">{t('ablage.mappeformular.der-ziel-mappentyp-existiert')}</p>; break; }
      mitLabelFor = !f.mehrfach;
      ctl = <MappenWahl id={id} ziel={ziel} mehrfach={!!f.mehrfach} wert={roh as string | string[] | undefined} eigeneId={eigeneId}
        bekannt={bekannt} merke={merke} setze={setze}
        sicht={f.auswahlFilter?.length && typId ? `feld:${typId}:${f.key}` : undefined}
        vorbelegen={f.auswahlFilter?.length ? vorbelegungAus(f.auswahlFilter, ziel) : undefined}
        unpassend={unpassend} eigene={eigene} />;
      break;
    }
    case 'formatiert':
      breit = true;
      mitLabelFor = false;
      ctl = <FormatiertEingabe id={id} wert={String(roh ?? '')} setze={setze} />;
      break;
    case 'passwort':
      ctl = <PasswortEingabe id={id} feld={f} roh={(roh ?? leeresPasswort) as RohPasswort} setze={setze} mappeId={eigeneId} nurLesen={nurLesen} sehen={passwortSehen} />;
      break;
    default:
      ctl = <input id={id} value={String(roh ?? '')} onChange={(e) => setze(e.target.value)}
        inputMode={eingabemodus(f, plzDeutsch)} {...(f.format === 'iban' ? { autoCapitalize: 'characters', spellCheck: false } : f.format ? { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } : {})} />;
      // E-Mail, Telefon, Internetseite (#535): daneben direkt antippen, sobald die Angabe passt.
      if (f.format === 'email' || f.format === 'telefon' || f.format === 'internetseite') {
        const w = String(roh ?? '').trim();
        ctl = <div className="ff-eingabe">{ctl}{w && !formatFehler(f, w, { felder: [], werte: {} }) && <FormatLink f={f} wert={w} nurSymbol />}</div>;
      }
  }

  return (
    <div className={`feld ${breit ? 'breit' : ''} ${fehler ? 'fehlerhaft' : ''}`}>
      <div className="feldkopf">
        {mitLabelFor ? <label htmlFor={id}>{feldLabel(f)}{f.pflicht && <span className="pflicht">*</span>}</label> : <span className="label">{feldLabel(f)}{f.pflicht && <span className="pflicht">*</span>}</span>}
        {f.typ === 'referenz' && <span className="chip">{VERWEISARTEN[f.verweisart ?? 'bezug']}</span>}
      </div>
      {ctl}
      {uebersetzung}
      {zusatz}
      {f.hilfe && <span className="hilfe">{feldHilfe(f)}</span>}
      {fehler && <p className="fehlertext">{fehler}</p>}
    </div>
  );
}


/**
 * Lohnt eine Übersetzung (#732)? Lange Texte und formatierte Texte immer; einzeilige Textfelder nur ohne Format (keine
 * E-Mail, IBAN, Telefonnummer) und erst ab vier Wörtern – Namen und Nummern übersetzt niemand.
 */
function feldUebersetzbar(f: Feld, wert: string): boolean {
  if (!wert.trim()) return false;
  if (f.typ === 'langtext' || f.typ === 'formatiert') return true;
  return f.typ === 'text' && !f.format && wert.trim().split(/\s+/).length >= 4;
}

/** Link zu einer Angabe mit Format (#535): mailto:, tel: oder die Internetseite (neuer Tab). */
function FormatLink({ f, wert, nurSymbol }: { f: Feld; wert: string; nurSymbol?: boolean }) {
  const href = f.format === 'email' ? `mailto:${wert}` : f.format === 'telefon' ? telefonLink(wert) : mitSchema(wert);
  const text = t(f.format === 'email' ? 'felder.eingabe.link.email' : f.format === 'telefon' ? 'felder.eingabe.link.telefon' : 'felder.eingabe.link.internetseite', { wert });
  const extern = f.format === 'internetseite' ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return nurSymbol
    ? <a href={href} className="ff-link" aria-label={text} title={text} {...extern}><Symbol name={f.format === 'email' ? 'email' : f.format === 'telefon' ? 'telefon' : 'extern'} /></a>
    : <a href={href} className="verweis" title={text} {...extern}>{wert}</a>;
}

/** Nur lesbare Angabe mit Format (#535): E-Mail, Telefon und Internetseite als Link, IBAN in Vierergruppen. */
function FormatWert({ f, wert }: { f: Feld; wert: string }) {
  if (!wert) return null;
  if ((f.format === 'email' || f.format === 'telefon' || f.format === 'internetseite') && !formatFehler(f, wert, { felder: [], werte: {} })) return <FormatLink f={f} wert={wert} />;
  return <>{formatiere(f, wert)}</>;
}

/**
 * Passwortfeld (#46): Das gespeicherte Passwort kommt nie mit der Mappe. Das Auge holt es
 * einzeln vom Server (steht im Protokoll); zum Ändern wird ein neues eingegeben.
 */
function PasswortEingabe({ id, feld: f, roh: p, setze, mappeId, nurLesen, sehen = true }: { id: string; feld: Feld; roh: RohPasswort; setze: (v: Roh) => void; mappeId?: string; nurLesen?: boolean; sehen?: boolean }) {
  const { passwoerterMoeglich } = useKonto();
  const [klartext, setKlartext] = useState<string | null>(null);
  const [zeigen, setZeigen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string>();
  const [aendern, setAendern] = useState(false);
  // Nach dem Speichern (neuer Stand vom Server) die Anzeige zurücksetzen.
  useEffect(() => { if (!p.neu) { setKlartext(null); setAendern(false); setZeigen(false); } }, [p.gesetzt, p.lesbar]); // eslint-disable-line react-hooks/exhaustive-deps
  const auge = (an: boolean) => <Symbol name={an ? 'auge-aus' : 'auge'} />;

  if (p.entfernen) return (
    <div className="passwort">
      <span className="festwert leise">{t('ablage.mappeformular.wird-beim-speichern-entfernt')}</span>
      <button type="button" className="knopf klein" onClick={() => setze({ ...p, entfernen: false })}>{t('ablage.mappeformular.rueckgaengig')}</button>
    </div>
  );

  if (nurLesen && !p.gesetzt) return <span id={id} className="festwert leise">{t('ablage.mappeformular.kein-passwort-gespeichert')}</span>;
  if (p.gesetzt && (!aendern || nurLesen) && !p.neu) {
    async function umschalten() {
      if (klartext !== null) { setKlartext(null); return; }
      if (!mappeId) return;
      setLaedt(true); setFehler(undefined);
      try { setKlartext((await api.passwortAnzeigen(mappeId, f.key)).wert); } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
    }
    return (
      <>
        <div className="passwort">
          <span id={id} className={`festwert mono ${p.lesbar ? '' : 'leise'}`} aria-live="polite">{!p.lesbar ? t('ablage.mappeformular.nicht-lesbar-bitte-neu') : klartext ?? '••••••••'}</span>
          {p.lesbar && mappeId && sehen && <button type="button" className="knopf klein" disabled={laedt} onClick={() => void umschalten()} title={klartext === null ? t('ablage.mappeformular.passwort-anzeigen-wird-protokolliert') : t('ablage.mappeformular.passwort-verbergen')} aria-label={klartext === null ? t('ablage.mappeformular.passwort-anzeigen') : t('ablage.mappeformular.passwort-verbergen')}>{auge(klartext !== null)}</button>}
          {!nurLesen && <button type="button" className="knopf klein" disabled={!passwoerterMoeglich} onClick={() => { setKlartext(null); setAendern(true); }}>{t('ablage.mappeformular.aendern')}</button>}
          {!nurLesen && <button type="button" className="knopf klein" onClick={() => { setKlartext(null); setze({ ...p, entfernen: true }); }} title={t('ablage.mappeformular.wird-erst-mit-mappe')}>{t('ablage.mappeformular.passwort-entfernen')}</button>}
        </div>
        {fehler && <p className="fehlertext">{fehler}</p>}
        {!sehen && p.lesbar && <span className="hilfe">{t('ablage.mappeformular.passwoerter-dieser-mappe-darfst')}</span>}
        {!passwoerterMoeglich && !nurLesen && <span className="hilfe">{t('ablage.mappeformular.aendern-geht-erst-wieder')}</span>}
      </>
    );
  }

  if (!passwoerterMoeglich) return (
    <>
      <input id={id} type="password" disabled placeholder={t('ablage.mappeformular.nicht-moeglich')} />
      <span className="hilfe">{t('ablage.mappeformular.passwoerter-lassen-sich-erst')}</span>
    </>
  );

  return (
    <div className="passwort">
      <input id={id} type={zeigen ? 'text' : 'password'} value={p.neu} autoComplete="new-password" spellCheck={false}
        placeholder={p.gesetzt ? t('ablage.mappeformular.neues-passwort') : ''} onChange={(e) => setze({ ...p, neu: e.target.value })} />
      <button type="button" className="knopf klein" onClick={() => setZeigen(!zeigen)} aria-label={zeigen ? t('ablage.mappeformular.eingabe-verbergen') : t('ablage.mappeformular.eingabe-anzeigen')} title={zeigen ? t('ablage.mappeformular.eingabe-verbergen') : t('ablage.mappeformular.eingabe-anzeigen')}>{auge(zeigen)}</button>
      {p.gesetzt && <button type="button" className="knopf klein" onClick={() => { setze({ ...p, neu: '' }); setAendern(false); setZeigen(false); }}>{t('ablage.mappeformular.abbrechen')}</button>}
    </div>
  );
}

/* ---------- Verknüpfungsregister ---------- */

/** Warum sich die Mappe nicht löschen lässt: Grund und ggf. die Mappen, die noch verweisen (#79). */
interface Loeschsperre { grund: string; rueckverweise?: Rueckverweis[] }

/**
 * „Mappe löschen“ mit der Begründung auf Klick (#423): Ist Löschen gesperrt (Verweise, Archivmodus,
 * fehlendes Recht), steht neben dem grauen Knopf „Warum nicht?“ und klappt die Begründung direkt
 * am Knopf auf. Bildschirmleser hören den Grund über aria-describedby schon am Knopf.
 *
 * `wege`: weitere Löschwege, die trotz Sperre gehen – sie stehen in der aufgeklappten Begründung
 * unter „Stattdessen“ (z. B. „Mit verknüpften Mappen löschen …“, #424).
 */
function LoeschKnopf({ sperre, loeschen, wege }: { sperre?: Loeschsperre; loeschen(): void; wege?: ReactNode }) {
  const d = useDaten();
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener('mousedown', zu); document.addEventListener('keydown', zu);
    return () => { document.removeEventListener('mousedown', zu); document.removeEventListener('keydown', zu); };
  }, [offen]);
  useEffect(() => { if (!sperre) setOffen(false); }, [sperre]);
  if (!sperre) return <button type="button" className="textknopf gefahr" onClick={loeschen}>{t('ablage.mappeformular.mappe-loeschen-2')}</button>;
  const quellen = [...new Map((sperre.rueckverweise ?? []).map((r) => [r.quelleId, r])).values()];
  const zeige = quellen.slice(0, 8);
  return (
    <div className="loeschwahl" ref={ref}>
      {/* Gesperrt als Knopf erkennbar (#648): Rahmen, gedämpft, Schloss; der Grund steht sichtbar daneben. */}
      <button type="button" className="knopf klein loeschwahl-gesperrt" aria-disabled="true" aria-describedby="loeschwahl-grund" onClick={() => setOffen(!offen)}>
        <Symbol name="schloss" /> {t('mappen.loeschen.knopf')}
      </button>
      <span id="loeschwahl-grund" className="klein leise loeschwahl-grund">{t('mappen.loeschen.gesperrt', { grund: sperre.grund })}</span>
      <button type="button" className="textknopf klein loeschwahl-warum" aria-expanded={offen} aria-controls="loeschwahl-begruendung" onClick={() => setOffen(!offen)}>
        <Symbol name="info" /> {t('mappen.loeschen.warum')}
      </button>
      {offen && (
        <div className="loeschwahl-begruendung klein" id="loeschwahl-begruendung" role="region" aria-label={t('ablage.mappeformular.warum-sich-die-mappe')}>
          <p><strong>{t('ablage.mappeformular.loeschen-nicht-moeglich-2')}</strong> {sperre.grund}</p>
          {zeige.length > 0 && <ul>{zeige.map((r) => (
            <li key={r.quelleId}>{r.verborgen ? <span className="verborgen-titel">{r.titel}</span> : <Link to={`/ablage/${r.quelleTypId}/${r.quelleId}`} className="verweis"><Ehemalig id={r.quelleId}>{titelOder(r.titel)}</Ehemalig></Link>} <span className="leise">({d.typ(r.quelleTypId)?.name ?? t('ablage.mappeformular.mappe')})</span></li>
          ))}{quellen.length > zeige.length && <li className="leise">{t('ablage.mappeformular.und-weitere', { wert: quellen.length - zeige.length })}</li>}</ul>}
          {wege && <div className="loeschwahl-wege"><p className="leise">{t('ablage.mappeformular.stattdessen')}</p>{wege}</div>}
        </div>
      )}
    </div>
  );
}

function Verknuepfungen({ mappe, gruppen }: { mappe: Mappe; gruppen: ReturnType<typeof verknuepfungsGruppen> }) {
  const d = useDaten();
  if (!gruppen.length) return <p className="leise">{tn('ablage.mappeformular.kein-mappentyp-verweist-auf', { name: d.typ(mappe.typId)?.name })}</p>;
  return (
    <div className="gruppen">
      {gruppen.map(({ t: mappentyp, f, treffer, liste }) => (
        <section key={`${mappentyp.id}-${f.key}`} className="gruppe">
          <header>
            <span><strong>{typName(mappentyp)}</strong> <span className="leise">{t('ablage.mappeformular.ueber', { label: feldLabel(f) })}</span> <span className="chip">{VERWEISARTEN[f.verweisart ?? 'bezug']}</span> <span className="anzahl">{treffer.length}</span></span>
            {darfErstellen(mappentyp) && <Link to={`/ablage/${mappentyp.id}/neu?verweis=${encodeURIComponent(`${f.key}:${mappe.id}`)}`} className="knopf klein">{t('ablage.mappeformular.anlegen-2', { name: mappentyp.name })}</Link>}
          </header>
          {!treffer.length ? <p className="leise">{t('ablage.mappeformular.noch-keine')}</p>
            : liste?.spalten.length ? <VerweisTabelle mappeId={mappe.id} typ={mappentyp} feldKey={f.key} spalten={liste.spalten} anzahl={treffer.length} />
            : <Trefferliste treffer={treffer} />}
        </section>
      ))}
    </div>
  );
}

/** Verweisende Mappen als Tabelle mit den Spalten einer Trefferliste (#75). */
function VerweisTabelle({ mappeId, typ, feldKey, spalten, anzahl }: { mappeId: string; typ: Mappentyp; feldKey: string; spalten: string[]; anzahl: number }) {
  const d = useDaten();
  const [daten, setDaten] = useState<{ gesamt: number; mappen: Mappe[]; bezuege: Bezuege } | null>(null);
  const [fehler, setFehler] = useState<string>();
  useEffect(() => { api.verweisende(mappeId, typ.id, feldKey).then(setDaten, (e: Error) => setFehler(e.message)); }, [mappeId, typ.id, feldKey, anzahl, d.stand]);
  if (fehler) return <p className="fehlertext klein">{fehler}</p>;
  if (!daten) return <p className="leise klein">{t('ablage.mappeformular.lade')}</p>;
  const rechts = (k: string) => { const f = typ.felder.find((x) => x.key === k); return f?.typ === 'zahl' || f?.typ === 'betrag'; };
  return (
    <div className="trefferliste verweistabelle">
      <table>
        <thead><tr>{spalten.map((k) => <th key={k} className={rechts(k) ? 'rechts' : ''}>{spaltenName(k, typ)}</th>)}</tr></thead>
        <tbody>
          {daten.mappen.map((m) => {
            const ziel = `/ablage/${typ.id}/${m.id}`;
            return (
              <tr key={m.id} onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) geheZu(ziel); }}>
                {spalten.map((k, i) => {
                  const text = zelle(k, m, typ, daten.bezuege, d.person);
                  return <td key={k} className={rechts(k) ? 'rechts' : ''}>{i === 0 ? <Link to={ziel}>{text || titelOder(m.titel)}</Link> : text}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {daten.gesamt > daten.mappen.length && <p className="leise klein">{t('ablage.mappeformular.die-ersten-von', { mappen: daten.mappen.length.toLocaleString(gebietsschema()), gesamt: daten.gesamt.toLocaleString(gebietsschema()) })}</p>}
    </div>
  );
}

/** Verweisende Mappen; bei sehr vielen erst die ersten 100. */
function Trefferliste({ treffer }: { treffer: Rueckverweis[] }) {
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? treffer : treffer.slice(0, 100);
  return (
    <>
      <ul>{sichtbar.map((r) => <li key={r.quelleId + r.feldKey}><Link to={`/ablage/${r.quelleTypId}/${r.quelleId}`} className="verweis"><Ehemalig id={r.quelleId}>{titelOder(r.titel)}</Ehemalig></Link></li>)}</ul>
      {sichtbar.length < treffer.length && <button type="button" className="textknopf" onClick={() => setAlle(true)}>{t('ablage.mappeformular.alle-zeigen', { treffer: treffer.length.toLocaleString(gebietsschema()) })}</button>}
    </>
  );
}

/* ---------- Auswahl verwiesener Mappen (mit Suche statt langer Klappliste) ---------- */

export function MappenWahl({ id, ziel, mehrfach, wert, eigeneId, bekannt, merke, setze, sicht, vorbelegen, unpassend: vomServer = [], eigene, ohneAnlegen, platzhalter, quelle, leer }: {
  id: string; ziel: Mappentyp; mehrfach: boolean; wert: string | string[] | undefined; eigeneId?: string;
  bekannt: Bezuege; merke: (id: string, b: { titel: string; typId: string }) => void; setze: (v: Roh) => void;
  /** Auswahlfilter (#172): Sicht „feld:<typ>:<feld>“ und Vorbelegung für „+ anlegen“. */
  sicht?: string; vorbelegen?: Record<string, unknown>; unpassend?: string[]; eigene?: Werte;
  /** Ohne „+ … anlegen“, z. B. im Testlauf der Werkbank (#371). */
  ohneAnlegen?: boolean;
  /** Eigener Platzhalter statt „<Typ> suchen …“, z. B. „Mappe suchen …“ für die Testmappe (#710). */
  platzhalter?: string;
  /** Eigene Vorschläge statt der Seite des Zieltyps, z. B. nur Mappen, die eine Automatisierung sehen darf (#709). */
  quelle?: (suche: string) => Promise<{ mappen: Array<Pick<Mappe, 'id' | 'titel' | 'typId'>>; gesamt: number }>;
  /** Text, wenn es gar keine Vorschläge gibt. */
  leer?: string;
}) {
  const eigeneText = eigene ? JSON.stringify(eigene) : '';
  const gewaehlt = (Array.isArray(wert) ? wert : wert ? [wert] : []).filter(Boolean);
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState('');
  const [treffer, setTreffer] = useState<Mappe[] | null>(null);
  const [gesamt, setGesamt] = useState(0);
  const [aendern, setAendern] = useState(false);
  const zeigeSuche = mehrfach || !gewaehlt.length || aendern;

  // Titel unbekannter Verweise nachladen (z. B. vorbelegt über ?verweis=…).
  const fehlend = gewaehlt.filter((x) => !bekannt[x]).join(',');
  useEffect(() => {
    for (const x of fehlend ? fehlend.split(',') : []) {
      api.mappe(x).then((r) => merke(x, { titel: r.mappe.titel ?? '', typId: r.mappe.typId })).catch(() => merke(x, { titel: t('ablage.mappeformular.geloeschte-mappe'), typId: '' }));
    }
  }, [fehlend]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!offen) return;
    let aktuell = true;
    const timer = setTimeout(() => {
      (quelle ? quelle(eingabe.trim()) as Promise<{ mappen: Mappe[]; gesamt: number }> : api.seite(sicht ?? `typ:${ziel.id}`, 0, 20, eingabe.trim(), undefined, false, false, undefined, eigeneText ? JSON.parse(eigeneText) as Werte : undefined)).then((s) => { if (aktuell) { setTreffer(s.mappen); setGesamt(s.gesamt); } }).catch(() => aktuell && setTreffer([]));
    }, 200);
    return () => { aktuell = false; clearTimeout(timer); };
  }, [offen, eingabe, ziel.id, sicht, eigeneText, quelle]);

  // Passen die gewählten Mappen noch zu den Werten dieser Mappe (#173)? Hinweis schon vor dem Speichern.
  const gewaehltText = gewaehlt.join(',');
  const [live, setLive] = useState<string[] | null>(null);
  useEffect(() => {
    if (!sicht || !gewaehltText) { setLive(null); return; }
    const [, typId, feldKey] = sicht.split(':');
    let aktuell = true;
    const timer = setTimeout(() => { api.auswahlPruefen(typId, feldKey, gewaehltText.split(','), eigeneText ? JSON.parse(eigeneText) as Werte : {}).then((r) => aktuell && setLive(r.unpassend)).catch(() => {}); }, 300);
    return () => { aktuell = false; clearTimeout(timer); };
  }, [sicht, gewaehltText, eigeneText]);
  const unpassend = live ?? vomServer;

  function waehle(m: Mappe) {
    merke(m.id, { titel: m.titel ?? '', typId: m.typId });
    setze(mehrfach ? [...gewaehlt, m.id] : m.id);
    setEingabe(''); setOffen(false); setAendern(false);
  }
  const auswahl = (treffer ?? []).filter((m) => m.id !== eigeneId && !gewaehlt.includes(m.id));
  const vor = vorbelegen && Object.keys(vorbelegen).length ? `?vorbelegen=${encodeURIComponent(JSON.stringify(vorbelegen))}` : '';
  const anlegen = !ohneAnlegen && darfErstellen(ziel) ? <Link to={`/ablage/${ziel.id}/neu${vor}`} className="verweis klein">{t('ablage.mappeformular.anlegen-2', { name: typName(ziel) })}</Link> : null;

  return (
    <Mehrfachauswahl id={id} name={t('felder.verweis.gewaehlt')} platzhalter={platzhalter ?? t('felder.verweis.suchen', { typ: typName(ziel) })}
      eingabe={eingabe} setEingabe={setEingabe} offen={offen} setOffen={setOffen} schliessen={() => setAendern(false)} ohneSuche={!zeigeSuche}
      vorschlaege={treffer === null ? null : auswahl.map((m) => ({ id: m.id, text: titelOder(m.titel) }))}
      leerText={eingabe ? t('felder.verweis.nichts') : leer ?? t('felder.verweis.leer', { typ: typName(ziel) })}
      fuss={gesamt > (treffer?.length ?? 0) && <p className="leise klein">{t('felder.verweis.mehr', { zahl: gesamt.toLocaleString(gebietsschema()) })}</p>}
      waehle={(mid) => { const m = auswahl.find((x) => x.id === mid); if (m) waehle(m); }}
      gewaehlt={gewaehlt.map((x) => ({
        id: x,
        inhalt: bekannt[x]?.typId && !bekannt[x].verborgen ? <Link to={`/ablage/${bekannt[x].typId}/${x}`} className="verweis"><Ehemalig id={x}>{titelOder(bekannt[x].titel)}</Ehemalig></Link> : <span className={bekannt[x]?.verborgen ? 'verborgen-titel' : 'leise'}>{bekannt[x]?.titel ?? t('felder.auswahl.lade')}</span>,
        zusatz: unpassend.includes(x) && <span className="chip warn" title={t('felder.verweis.unpassend.titel')}>{t('felder.verweis.unpassend')}</span>,
        aktionen: !mehrfach && !aendern && <button type="button" className="textknopf klein" onClick={() => { setAendern(true); setOffen(true); }}>{t('felder.verweis.aendern')}</button>,
        entfernenText: bekannt[x] ? t('felder.verweis.entfernen', { titel: titelOder(bekannt[x].titel) }) : t('felder.verweis.entfernen.ohne'),
      }))}
      entferne={(x) => setze(mehrfach ? gewaehlt.filter((y) => y !== x) : '')}
      darunter={anlegen && <div className="zeile">{anlegen}</div>} />
  );
}
