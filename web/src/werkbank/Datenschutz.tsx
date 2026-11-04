import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Symbol } from '../Symbol';
import { fortschrittText } from '../../../shared/src/auftrag';
import { ANREDE_BEISPIEL, ANREDE_NAME, ANREDEN, textDritte, type Anrede } from '../../../shared/src/anrede';
import { AUSKUNFT_PASSWORT_MIN, erwaehnungText, GRUND_MIN, istRechteStandard, personenTypen, rechteStandard, type AuskunftAuswahl, type AuskunftMappe, type AuskunftStand, type AuskunftVorschau, type Datenschutz } from '../../../shared/src/auskunft';
import { Zustellen, Zustellungen } from './Zustellen';
import { LoeschkonzeptBlatt } from './Loeschkonzept';
import { LoeschprotokollBlatt } from './Loeschprotokoll';
import { BAUM_RICHTUNGEN, kinderVon, type BaumKnoten, type BaumRichtung } from '../../../shared/src/baum';
import { datumText } from '../../../shared/src/archiv';
import { api, type Auftrag, type DatenschutzStand } from '../api';
import { useDaten } from '../daten';
import { Hilfe } from '../Hilfe';
import { Link } from '../ort';
import { rueckfrage } from '../rueckfrage';
import { titelOder } from '../seiten';
import { Mehrfachauswahl } from '../ablage/Mehrfachauswahl';
import { formatiere, type Mappe, type Mappentyp } from '../../../shared/src/model';
import { falte } from '../../../shared/src/suche';
import { Speicherleiste, useEntwurf } from '../Speicherleiste';
import { zeitzone } from '../../../shared/src/region';

/**
 * Werkbank → Datenschutz (#396): Auskunft nach Art. 15 DSGVO als ZIP.
 *   1. Betroffenen wählen (Mappentypen „betrifft eine Person“), optional Frist als Aufgabe
 *   2. Sammeln über Verweise (Baum, Tiefe einstellbar, nur über Zugehörigkeit weiter) und prüfen: Häkchen je
 *      Mappe, Dokument, Notiz, Historie; Bezug-Mappen nur als Erwähnung, bewusst ganz aufnehmbar (#472)
 *   3. Erzeugen als Hintergrundauftrag, optional mit Passwort (AES); Download, danach gelöscht
 *   4. Zustellen (#455): per E-Mail (nur verschlüsselt) oder als Abruf-Link mit Abrufcode
 * Unten: bereitliegende Auskünfte, Abruf-Links (Nachweis), Löschkonzept erzeugen (#469), Löschprotokoll (#470) und die Einstellungen (Absender, Rechte, Zwecke je Mappentyp).
 */

const groesse = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: zeitzone() }).format(new Date());

export function useDatenschutz(offen: boolean) {
  const [stand, setStand] = useState<DatenschutzStand | null>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async () => { try { setStand(await api.datenschutz()); setFehler(undefined); } catch (e) { setFehler((e as Error).message); } }, []);
  useEffect(() => { if (offen) void laden(); }, [offen, laden]);
  return { stand, fehler, laden };
}
export type DatenschutzZustand = ReturnType<typeof useDatenschutz>;

export function DatenschutzPanel({ z }: { z: DatenschutzZustand }) {
  const s = z.stand;
  // Zustellen (#455): welche bereitliegende Auskunft gerade aufgeklappt ist.
  const [zustellen, setZustellen] = useState<string | null>(null);
  const oeffne = (id: string) => { setZustellen(id); window.setTimeout(() => document.getElementById(`auskunft-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); };
  if (!s) return <p className="leise">{z.fehler ?? 'Lade …'}</p>;
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">Werkbank</p>
        <h1>Datenschutz</h1>
        <p className="leise">Fragt ein Kunde, Mieter oder Kontakt nach seinen Daten (Auskunft nach Art. 15 DSGVO), sammelt Ablago alles, was mit ihm verknüpft ist. Du prüfst die Liste und bekommst eine ZIP-Datei mit Deckblatt, Übersicht, Dokumenten und maschinenlesbaren Daten. <Hilfe ort="werkbank.datenschutz" /></p>
      </div>
      <AuskunftErteilen einstellung={s.einstellung} nachher={z.laden} zustellen={oeffne} />
      <Bereitliegend z={z} offen={zustellen} setOffen={setZustellen} />
      <Zustellungen z={z} />
      <LoeschkonzeptBlatt luecken={s.loeschkonzept?.luecken ?? []} />
      <LoeschprotokollBlatt />
      <Einstellungen z={z} />
    </div>
  );
}

/* ---------- Auskunft erteilen ---------- */

/** Steht ein Suchwort nicht im Titel, das erste Feld, in dem es vorkommt („Firma: Muster GmbH“, #667). */
function grundVon(typ: Mappentyp | undefined, m: Mappe, eingabe: string): string | null {
  const woerter = falte(eingabe).split(/\s+/).filter(Boolean);
  if (!typ || !woerter.length || woerter.every((w) => falte(m.titel ?? '').includes(w))) return null;
  for (const f of typ.felder) {
    if (f.typ === 'passwort' || f.typ === 'referenz') continue;
    const text = formatiere(f, m.werte[f.key]);
    if (text && woerter.some((w) => falte(text).includes(w))) return `${f.label}: ${text}`;
  }
  return null;
}

/**
 * Person wählen wie in einem Verweisfeld (#667): gemeinsame Auswahl aus #602, Suche beim Tippen über alle
 * Mappentypen, die eine Person betreffen; je Treffer der Mappentyp und – wenn nicht der Name trifft – das Feld.
 */
function PersonWahl({ typen, waehle }: { typen: Mappentyp[]; waehle(m: { id: string; typId: string; titel: string }): void }) {
  const [eingabe, setEingabe] = useState('');
  const [offen, setOffen] = useState(false);
  const [treffer, setTreffer] = useState<Mappe[] | null>(null);
  const [gesamt, setGesamt] = useState(0);
  const ids = typen.map((t) => t.id).join(',');
  useEffect(() => {
    if (!offen) return;
    let aktuell = true;
    const t = setTimeout(() => {
      Promise.all(ids.split(',').map((id) => api.seite(`typ:${id}`, 0, 20, eingabe.trim())))
        .then((r) => { if (!aktuell) return; setTreffer(r.flatMap((x) => x.mappen).slice(0, 20)); setGesamt(r.reduce((n, x) => n + x.gesamt, 0)); })
        .catch(() => aktuell && setTreffer([]));
    }, 200);
    return () => { aktuell = false; clearTimeout(t); };
  }, [offen, eingabe, ids]);
  const typ = (id: string) => typen.find((t) => t.id === id);
  return (
    <Mehrfachauswahl id="auskunft-person" name="Person" platzhalter={`${typen.map((t) => t.name).join(', ')} suchen …`}
      eingabe={eingabe} setEingabe={setEingabe} offen={offen} setOffen={setOffen}
      vorschlaege={treffer === null ? null : treffer.map((m) => {
        const grund = grundVon(typ(m.typId), m, eingabe);
        return { id: m.id, text: <span>{titelOder(m.titel)} <span className="leise klein">{typ(m.typId)?.name}{grund ? ` · ${grund}` : ''}</span></span> };
      })}
      leerText={eingabe ? 'Nichts gefunden.' : 'Noch keine Mappe dieser Art.'}
      fuss={gesamt > (treffer?.length ?? 0) && <p className="leise klein">{gesamt.toLocaleString('de-DE')} insgesamt – tippe, um einzugrenzen.</p>}
      waehle={(id) => { const m = treffer?.find((x) => x.id === id); if (m) waehle({ id: m.id, typId: m.typId, titel: m.titel ?? '' }); }}
      gewaehlt={[]} entferne={() => {}} />
  );
}

interface Wahl { mappen: Set<string>; dokumente: Set<string>; notizen: Set<string>; historie: Set<string>; gruende: Record<string, string>; erwaehnungen: Set<string> }
const LEER: Wahl = { mappen: new Set(), dokumente: new Set(), notizen: new Set(), historie: new Set(), gruende: {}, erwaehnungen: new Set() };

/** Vorgabe: alles an – außer Originalen, zu denen es eine geschwärzte Fassung gibt. */
function vorgabe(inhalte: Record<string, AuskunftMappe>, ids: string[], w: Wahl = LEER): Wahl {
  const n: Wahl = { mappen: new Set(w.mappen), dokumente: new Set(w.dokumente), notizen: new Set(w.notizen), historie: new Set(w.historie), gruende: { ...w.gruende }, erwaehnungen: new Set(w.erwaehnungen) };
  for (const id of ids) {
    const x = inhalte[id]; if (!x) continue;
    n.mappen.add(id); n.historie.add(id);
    for (const d of x.dokumente) if (!d.geschwaerzteFassung) n.dokumente.add(d.id);
    for (const t of x.notizen) n.notizen.add(t.id);
  }
  return n;
}

function AuskunftErteilen({ einstellung, nachher, zustellen }: { einstellung: Datenschutz; nachher(): Promise<void>; zustellen(id: string): void }) {
  const d = useDaten();
  const personTypen = personenTypen(einstellung).map((id) => d.typ(id)).filter((t) => !!t);
  const [betroffen, setBetroffen] = useState<{ id: string; typId: string; titel: string } | null>(null);
  const [tiefe, setTiefe] = useState(2);
  const [richtungen, setRichtungen] = useState<BaumRichtung[]>(['verwiesenVon', 'verweistAuf']);
  const [vorschau, setVorschau] = useState<AuskunftVorschau | null>(null);
  const [wahl, setWahl] = useState<Wahl>(LEER);
  const [eingang, setEingang] = useState(heute());
  const [empfaenger, setEmpfaenger] = useState(einstellung.empfaenger);
  const [anmerkung, setAnmerkung] = useState('');
  const [passwort, setPasswort] = useState('');
  const [geprueft, setGeprueft] = useState(false);
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht' | 'info'; text: string }>();

  // Aus der Mappe („Aktionen → Auskunft erstellen …“): /werkbank/datenschutz?mappe=<id>
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('mappe');
    if (!id) return;
    api.mappe(id).then((x) => setBetroffen({ id: x.mappe.id, typId: x.mappe.typId, titel: x.mappe.titel ?? '' }), () => {});
  }, []);
  useEffect(() => {
    if (auftrag?.status !== 'laeuft') return;
    const t = setInterval(() => void api.auftrag().then((a) => { setAuftrag(a); if (a?.status !== 'laeuft') void nachher(); }), 1000);
    return () => clearInterval(t);
  }, [auftrag?.status, nachher]);

  async function sammeln() {
    if (!betroffen) return;
    setLaeuft(true); setMeldung(undefined); setVorschau(null); setGeprueft(false); setAuftrag(null);
    try {
      const v = await api.auskunftVorschau({ mappeId: betroffen.id, tiefe, richtungen });
      setVorschau(v);
      // Zugehörige Mappen ganz; Bezug-Mappen (#472) nur als Erwähnung – ganz aufnehmen nur bewusst.
      setWahl({ ...vorgabe(v.mappen, v.baum.knoten.filter((k) => !k.nurBezug).map((k) => k.id)), erwaehnungen: new Set(v.baum.knoten.filter((k) => k.nurBezug).map((k) => k.id)) });
    } catch (e) { setMeldung({ art: 'schlecht', text: (e as Error).message }); } finally { setLaeuft(false); }
  }
  async function frist() {
    if (!betroffen) return;
    try { const a = await api.auskunftFrist({ mappeId: betroffen.id, eingang }); setMeldung({ art: 'gut', text: `Aufgabe angelegt: ${a.text}` }); }
    catch (e) { setMeldung({ art: 'schlecht', text: (e as Error).message }); }
  }

  const inhalte = useMemo(() => vorschau?.mappen ?? {}, [vorschau]);
  const schalte = (art: 'mappen' | 'dokumente' | 'notizen' | 'historie' | 'erwaehnungen', id: string, an: boolean) => setWahl((w) => { const n = new Set(w[art]); if (an) n.add(id); else n.delete(id); setGeprueft(false); return { ...w, [art]: n }; });
  /** Bezug-Mappe (#472) bewusst ganz aufnehmen – mit Dokumenten, Notizen und allen Angaben. */
  const ganz = (id: string, an: boolean) => {
    setWahl((w) => (an ? vorgabe(inhalte, [id], w) : { ...w, mappen: new Set([...w.mappen].filter((x) => x !== id)) }));
    setGeprueft(false);
  };
  const gewaehlt = [...wahl.mappen].filter((id) => inhalte[id]);
  const auswahl: AuskunftAuswahl = {
    mappen: gewaehlt,
    dokumente: gewaehlt.flatMap((id) => inhalte[id].dokumente.filter((x) => wahl.dokumente.has(x.id)).map((x) => x.id)),
    notizen: gewaehlt.flatMap((id) => inhalte[id].notizen.filter((x) => wahl.notizen.has(x.id)).map((x) => x.id)),
    historie: gewaehlt.filter((id) => wahl.historie.has(id)),
    ohneNotizen: gewaehlt.flatMap((id) => inhalte[id].notizen.filter((x) => !wahl.notizen.has(x.id)).map((x) => ({ id: x.id, grund: wahl.gruende[x.id] ?? '' }))),
    erwaehnungen: [...wahl.erwaehnungen].filter((id) => !wahl.mappen.has(id) && vorschau?.baum.knoten.some((k) => k.id === id && k.nurBezug)),
  };
  const ohneGrund = auswahl.ohneNotizen.filter((x) => x.grund.trim().length < GRUND_MIN).length;
  const pwFehler = passwort && passwort.length < AUSKUNFT_PASSWORT_MIN;
  const bytes = gewaehlt.flatMap((id) => inhalte[id].dokumente).filter((x) => wahl.dokumente.has(x.id)).reduce((s, x) => s + x.groesse, 0);
  const fertig = auftrag?.status === 'fertig' && auftrag.art === 'auskunft' ? auftrag.ergebnis as AuskunftStand : null;

  async function erzeugen() {
    if (!betroffen || !vorschau) return;
    if (!passwort && !(await rueckfrage({ titel: 'Ohne Passwort erzeugen?', text: 'Die ZIP-Datei ist dann unverschlüsselt. Für den Versand per E-Mail empfiehlt sich ein Passwort, das du getrennt mitteilst (z. B. per Telefon oder SMS).', ja: 'Ohne Passwort erzeugen' }))) return;
    setMeldung(undefined);
    try { setAuftrag(await api.auskunftStarten({ mappeId: betroffen.id, tiefe, richtungen, auswahl, geprueft, passwort, empfaenger, anmerkung })); }
    catch (e) { setMeldung({ art: 'schlecht', text: (e as Error).message }); }
  }

  const knoten = vorschau?.baum.knoten ?? [];
  const wurzel = knoten[0];
  const zeigeKnoten = (k: BaumKnoten): ReactNode => (k.nurBezug && k.ueber ? (
    <li key={k.id}>
      <div className={`auskunft-mappe ${wahl.erwaehnungen.has(k.id) || wahl.mappen.has(k.id) ? '' : 'aus'}`}>
        <label className="haken"><input type="checkbox" checked={wahl.erwaehnungen.has(k.id) || wahl.mappen.has(k.id)} disabled={wahl.mappen.has(k.id)} onChange={(e) => schalte('erwaehnungen', k.id, e.target.checked)} />
          <span>{erwaehnungText({ typ: k.typ, titel: titelOder(k.titel), feld: k.ueber.feld, richtung: k.ueber.richtung })}{' '}
            <span className="chip" title="Nur über einen Verweis der Art Bezug verbunden: Es geht nur hinaus, dass die Person hier genannt ist – ohne Dokumente, Notizen und übrige Angaben. Über diese Mappe wird nicht weitergesammelt.">Bezug</span>{' '}
            <a href={`/ablage/${k.typId}/${k.id}`} className="verweis klein" target="_blank" rel="noreferrer">öffnen</a></span></label>
        <label className="haken klein auskunft-ganz"><input type="checkbox" checked={wahl.mappen.has(k.id)} onChange={(e) => ganz(k.id, e.target.checked)} />
          <span>ganz aufnehmen <span className="leise">– mit Dokumenten, Notizen und allen Angaben; nur, wenn sie wirklich die Person betreffen</span></span></label>
        {wahl.mappen.has(k.id) && <MappeEintrag id={k.id} titel={k.titel} typ={k.typ} typId={k.typId} inhalt={inhalte[k.id]} wahl={wahl} schalte={schalte} nurInhalt
          setGrund={(id, g) => setWahl((w) => ({ ...w, gruende: { ...w.gruende, [id]: g } }))} />}
      </div>
    </li>
  ) : (
    <li key={k.id}>
      <MappeEintrag id={k.id} titel={k.titel} typ={k.typ} typId={k.typId} inhalt={inhalte[k.id]} wahl={wahl} schalte={schalte}
        setGrund={(id, g) => setWahl((w) => ({ ...w, gruende: { ...w.gruende, [id]: g } }))}
        info={<>{k.ueber && <span className="leise klein"> · {k.ueber.richtung === 'verwiesenVon' ? `verweist über „${k.ueber.feld}“ darauf` : `über „${k.ueber.feld}“`}</span>}
          {k.auchUeber.length > 0 && <span className="chip" title="Diese Mappe ist auf mehreren Wegen erreichbar (Kreis) – sie steht nur einmal in der Liste">↻ {k.auchUeber.length}</span>}
          {k.gesperrt && k.aufbewahrenBis && <span className="chip" title="Archivmodus: Aufbewahrungsfrist"><Symbol name="schloss" /> bis {datumText(k.aufbewahrenBis)}</span>}</>} />
      {kinderVon(vorschau!.baum, k.id).length > 0 && <ul className="auskunft-baum">{kinderVon(vorschau!.baum, k.id).map(zeigeKnoten)}</ul>}
    </li>
  ));

  return (
    <section className="blatt" id="auskunft">
      <h2 className="h3">Auskunft erteilen <Hilfe ort="werkbank.auskunft" /></h2>
      {!personTypen.length ? (
        <div className="hinweis info"><p>Lege zuerst unter <a href="#datenschutz-einstellungen" className="verweis">Einstellungen</a> fest, welche Mappentypen eine Person betreffen (z. B. Mieter, Kunde, Kontakt).</p></div>
      ) : !betroffen ? (
        <>
          <label className="eigenschaft" htmlFor="auskunft-person"><span>1. Person, die nach ihren Daten fragt</span></label>
          <PersonWahl typen={personTypen as Mappentyp[]} waehle={(m) => { setBetroffen(m); setVorschau(null); }} />
        </>
      ) : (
        <>
          {/* Gewählte Person als Eintrag wie im Verweisfeld (#667); „Entfernen“ führt zurück zur Suche. */}
          <Mehrfachauswahl name="Person" platzhalter="" eingabe="" setEingabe={() => {}} offen={false} setOffen={() => {}} vorschlaege={[]} leerText="" waehle={() => {}} ohneSuche
            className="betroffen"
            gewaehlt={[{ id: betroffen.id, inhalt: <><Link to={`/ablage/${betroffen.typId}/${betroffen.id}`} className="verweis">{titelOder(betroffen.titel)}</Link> <span className="leise klein">{d.typ(betroffen.typId)?.name}</span></>, entfernenText: `${titelOder(betroffen.titel)} entfernen – andere Person wählen` }]}
            entferne={() => { setBetroffen(null); setVorschau(null); setAuftrag(null); }} />
          <div className="zeile-umbruch">
            <label className="inline">Anfrage eingegangen am <input type="date" value={eingang} max={heute()} onChange={(e) => setEingang(e.target.value)} /></label>
            <button type="button" className="knopf klein" onClick={() => void frist()} title="Aufgabe für dich, fällig einen Monat nach Eingang (Art. 12 Abs. 3 DSGVO)">Frist als Aufgabe anlegen</button>
          </div>
          <p className="leise klein">2. Sammeln: alle Mappen, die zur Person gehören (Verweise der Art Zugehörigkeit) – nach unten über mehrere Stufen, nach oben nur weiter nach oben. Mappen, in denen die Person nur genannt ist (Bezug, z. B. als Ansprechpartner), stehen ohne ihre Inhalte da. Eine Volltext-Suche gibt es bewusst nicht – zu viele Verwechslungen.</p>
          <div className="zeile-umbruch">
            <label className="inline">Tiefe <select value={tiefe} onChange={(e) => setTiefe(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Ebene' : 'Ebenen'}</option>)}</select></label>
            {(Object.keys(BAUM_RICHTUNGEN) as BaumRichtung[]).map((r) => (
              <label key={r} className="haken inline"><input type="checkbox" checked={richtungen.includes(r)} onChange={(e) => setRichtungen(e.target.checked ? [...richtungen, r] : richtungen.filter((x) => x !== r))} /><span>{BAUM_RICHTUNGEN[r]}</span></label>
            ))}
            <button type="button" className="knopf klein primaer" disabled={laeuft || !richtungen.length} onClick={() => void sammeln()}>{laeuft ? 'Sammle …' : vorschau ? 'Neu sammeln' : 'Sammeln'}</button>
          </div>
        </>
      )}
      {meldung && <div className={`hinweis ${meldung.art}`} role="status"><p>{meldung.text}</p></div>}

      {vorschau && wurzel && (
        <>
          <h3 className="h4">3. Prüfen</h3>
          <p className="leise klein">Nur was angehakt ist, kommt in die Auskunft. Passwortfelder sind nie enthalten, ältere Versionen von Dokumenten auch nicht.
            {vorschau.baum.kreise > 0 && ` ${vorschau.baum.kreise === 1 ? 'Ein Verweis führt' : `${vorschau.baum.kreise} Verweise führen`} auf eine schon gesammelte Mappe (↻) – jede Mappe steht nur einmal da.`}
            {vorschau.baum.abgeschnitten && ' Es gibt mehr Mappen, als hier gezeigt werden (Obergrenze) – verringere die Tiefe oder erteile die Auskunft in Teilen.'}
            {vorschau.baum.tieferMoeglich && ' Mit mehr Ebenen kämen weitere Mappen dazu.'}</p>
          <div className="hinweis warn"><p><strong>Daten Dritter?</strong> Enthalten Dokumente Angaben zu anderen Personen (z. B. Nachbarn in einer Nebenkostenabrechnung), schwärze sie vorher: Dokument in der Ablage öffnen → „Schwärzen“, danach hier „Neu sammeln“. Die geschwärzte Fassung wird dann statt des Originals vorgeschlagen.</p></div>
          <ul className="auskunft-baum wurzel">{zeigeKnoten(wurzel)}</ul>
          <h3 className="h4">4. Erzeugen</h3>
          <p>{auswahl.mappen.length} {auswahl.mappen.length === 1 ? 'Mappe' : 'Mappen'}{auswahl.erwaehnungen.length ? ` und ${auswahl.erwaehnungen.length} ${auswahl.erwaehnungen.length === 1 ? 'Erwähnung' : 'Erwähnungen'}` : ''}, {auswahl.dokumente.length} {auswahl.dokumente.length === 1 ? 'Dokument' : 'Dokumente'} ({groesse(bytes)}), {auswahl.notizen.length} {auswahl.notizen.length === 1 ? 'Notiz' : 'Notizen'}{auswahl.ohneNotizen.length ? `, ${auswahl.ohneNotizen.length} zurückgehalten` : ''}.</p>
          <div className="raster">
            <label className="eigenschaft breit"><span>Empfänger der Daten <small>steht auf dem Deckblatt, z. B. Steuerberatung, Hausmeisterdienst</small></span><textarea rows={2} value={empfaenger} onChange={(e) => setEmpfaenger(e.target.value)} /></label>
            <label className="eigenschaft breit"><span>Anmerkung <small>optional, steht auf dem Deckblatt</small></span><textarea rows={2} value={anmerkung} onChange={(e) => setAnmerkung(e.target.value)} /></label>
            <label className="eigenschaft"><span>Passwort für die ZIP-Datei <small>optional, AES-256; mindestens {AUSKUNFT_PASSWORT_MIN} Zeichen</small></span>
              <span className="zeile-umbruch"><input type="text" autoComplete="off" spellCheck={false} value={passwort} onChange={(e) => setPasswort(e.target.value)} className="mono" />
                <button type="button" className="knopf klein" onClick={() => setPasswort(zufallsPasswort())}>Vorschlagen</button></span></label>
          </div>
          {pwFehler && <p className="fehlertext klein">Mindestens {AUSKUNFT_PASSWORT_MIN} Zeichen.</p>}
          {passwort && !pwFehler && <p className="leise klein">Teile das Passwort getrennt von der Datei mit. Öffnen lässt sie sich z. B. mit 7-Zip, WinZip oder Keka; die Dateinamen sind ebenfalls verschlüsselt (innen liegt „Auskunft.zip“).</p>}
          <label className="haken"><input type="checkbox" checked={geprueft} onChange={(e) => setGeprueft(e.target.checked)} /><span>Ich habe die Auswahl geprüft – das darf hinaus.</span></label>
          {ohneGrund > 0 && <p className="fehlertext klein">{ohneGrund === 1 ? 'Eine abgewählte Notiz braucht' : `${ohneGrund} abgewählte Notizen brauchen`} eine Begründung.</p>}
          {auftrag?.status === 'laeuft' && <p className="leise" role="status">{fortschrittText(auftrag)}</p>}
          {auftrag?.status === 'fehler' && <p className="fehlertext" role="alert">{auftrag.fehler}</p>}
          {/* #665: Das Ergebnis steht an der Stelle des Knopfs – darüber verschiebt sich nichts; ein zweites Erzeugen nur über „Neue Auskunft erstellen“. */}
          {fertig ? <AuskunftFertig f={fertig} zustellen={zustellen} nachher={nachher} neu={() => { setAuftrag(null); setGeprueft(false); }} />
            : <div className="knoepfe"><button type="button" className="knopf primaer" disabled={!geprueft || !auswahl.mappen.length || ohneGrund > 0 || !!pwFehler || auftrag?.status === 'laeuft'} onClick={() => void erzeugen()}>
            {auftrag?.status === 'laeuft' ? 'Wird erzeugt …' : 'Auskunft erzeugen'}</button></div>}
        </>
      )}
    </section>
  );
}

const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Ergebnis von „Auskunft erzeugen“ (#665): Text und Knöpfe untereinander, Fokus darauf, darunter „Neue Auskunft erstellen“. */
function AuskunftFertig({ f, zustellen, nachher, neu }: { f: AuskunftStand; zustellen(id: string): void; nachher(): Promise<void>; neu(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="auskunft-fertig">
      <div ref={ref} tabIndex={-1} className="hinweis gut stapel" role="status">
        <p><strong>Auskunft ist fertig</strong> – {anzahl(f.mappen, 'Mappe', 'Mappen')}, {anzahl(f.dokumente, 'Dokument', 'Dokumente')} ({groesse(f.bytes)}){f.verschluesselt ? ', mit Passwort' : ''}.</p>
        <p>Wie soll sie zur Person kommen?</p>
        <p className="knoepfe"><button type="button" className="knopf primaer" onClick={() => zustellen(f.id)}>Zustellen …</button>
          <a className="knopf" href={`/api/werkbank/auskunft/${f.id}/zip`} onClick={() => window.setTimeout(() => void nachher(), 3000)}>Herunterladen</a></p>
        <p className="leise klein">Ohne Abruf-Link wird die Datei nach dem Herunterladen gelöscht, spätestens am {zeit(f.bis)}. In der Historie der Person ist die Auskunft vermerkt; sie steht auch unter „Bereitliegende Auskünfte“.</p>
      </div>
      <p><button type="button" className="textknopf klein" onClick={neu}>Neue Auskunft erstellen</button></p>
    </div>
  );
}

function zufallsPasswort() {
  // 32 gut unterscheidbare Zeichen (ohne I, O, 0, 1): 5 Bit je Zeichen per Bitmaske – gleichverteilt, ohne Modulo-Bias; 16 Zeichen = 80 Bit.
  const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => z[x & 31]).join('').replace(/(.{4})(?!$)/g, '$1-');
}

function MappeEintrag({ id, titel, typ, typId, inhalt, wahl, schalte, setGrund, info, nurInhalt }: {
  id: string; titel: string; typ: string; typId: string; inhalt?: AuskunftMappe; wahl: Wahl; info?: ReactNode; nurInhalt?: boolean;
  schalte(art: 'mappen' | 'dokumente' | 'notizen' | 'historie' | 'erwaehnungen', id: string, an: boolean): void; setGrund(id: string, g: string): void;
}) {
  const an = wahl.mappen.has(id);
  return (
    <div className={`auskunft-mappe ${an ? '' : 'aus'}`}>
      {!nurInhalt && <label className="haken"><input type="checkbox" checked={an} onChange={(e) => schalte('mappen', id, e.target.checked)} />
        <span><a href={`/ablage/${typId}/${id}`} className="verweis" target="_blank" rel="noreferrer">{titelOder(titel)}</a> <span className="leise klein">{typ}</span>{info}</span></label>}
      {an && inhalt && (
        <div className="auskunft-inhalt">
          {inhalt.dritte.length > 0 && <p className="klein auskunft-dritte">Daten Dritter? Hängt auch an: {inhalt.dritte.slice(0, 4).join(', ')}{inhalt.dritte.length > 4 ? ' …' : ''}</p>}
          {inhalt.dokumente.map((x) => (
            <label key={x.id} className="haken klein"><input type="checkbox" checked={wahl.dokumente.has(x.id)} onChange={(e) => schalte('dokumente', x.id, e.target.checked)} />
              <span><Symbol name="dokument" /> {x.name} <span className="leise">{x.register} · {groesse(x.groesse)}</span>
                {x.geschwaerzt && <span className="chip">geschwärzt</span>}
                {x.geschwaerzteFassung && <span className="leise"> – geschwärzte Fassung vorhanden</span>}
                {!x.geschwaerzt && x.schwaerzbar && <> · <a href={`/ablage/${typId}/${id}`} className="verweis" target="_blank" rel="noreferrer" title="Mappe in einem neuen Tab öffnen; dort am Dokument „Schwärzen“">schwärzen …</a></>}</span></label>
          ))}
          {inhalt.notizen.map((n) => (
            <div key={n.id}>
              <label className="haken klein"><input type="checkbox" checked={wahl.notizen.has(n.id)} onChange={(e) => schalte('notizen', n.id, e.target.checked)} />
                <span><Symbol name="notiz" /> {n.text.length > 120 ? `${n.text.slice(0, 120)} …` : n.text} <span className="leise">{zeit(n.erstellt)}</span></span></label>
              {!wahl.notizen.has(n.id) && <label className="eigenschaft einzug klein"><span>Warum zurückhalten? <small>Pflicht, z. B. „interne Bewertung, Art. 15 Abs. 4 DSGVO“</small></span>
                <input value={wahl.gruende[n.id] ?? ''} maxLength={500} onChange={(e) => setGrund(n.id, e.target.value)} /></label>}
            </div>
          ))}
          {inhalt.historie > 0 && <label className="haken klein"><input type="checkbox" checked={wahl.historie.has(id)} onChange={(e) => schalte('historie', id, e.target.checked)} /><span><Symbol name="historie" /> Historie ({inhalt.historie} {inhalt.historie === 1 ? 'Eintrag' : 'Einträge'})</span></label>}
          {inhalt.ohneFelder.length > 0 && <p className="leise klein">Nie enthalten: {inhalt.ohneFelder.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Bereitliegende Auskünfte ---------- */

function Bereitliegend({ z, offen, setOffen }: { z: DatenschutzZustand; offen: string | null; setOffen(id: string | null): void }) {
  const s = z.stand!;
  const [fehler, setFehler] = useState<string>();
  // Aus der Mappe der Person (?mappe=…): ihre Auskünfte zuerst.
  const person = new URLSearchParams(location.search).get('mappe');
  const liste = person ? [...s.auskuenfte].sort((a, b) => Number(b.mappeId === person) - Number(a.mappeId === person)) : s.auskuenfte;
  return (
    <section className="blatt" id="auskuenfte">
      <h2 className="h3">Bereitliegende Auskünfte <Hilfe ort="werkbank.auskunft.zustellen" /></h2>
      <p className="leise klein">Eine erzeugte Auskunft liegt bereit, bis du sie herunterlädst – höchstens {s.tage} Tage, mit Abruf-Link bis zu dessen Ablauf. Danach wird sie gelöscht; in der Historie der Person bleibt der Nachweis. Mit <strong>Zustellen …</strong> schickst du sie per E-Mail oder als Abruf-Link.</p>
      {fehler && <p className="fehlertext">{fehler}</p>}
      {!liste.length ? <p className="leise">Keine.</p> : <ul className="stapel">{liste.map((a) => (
        <li key={a.id} id={`auskunft-${a.id}`} className="auskunft-bereit">
          <strong>{titelOder(a.titel)}</strong> <span className="leise klein">{zeit(a.erstellt)} · {a.mappen} Mappen, {a.dokumente} Dokumente, {groesse(a.bytes)}{a.verschluesselt ? ' · mit Passwort' : ''} · bis {zeit(a.bis)} · von {a.von}</span>
          <span className="knoepfe">
            <button type="button" className={`knopf klein${offen === a.id ? '' : ' primaer'}`} aria-expanded={offen === a.id} onClick={() => setOffen(offen === a.id ? null : a.id)}>{offen === a.id ? 'Zustellen schließen' : 'Zustellen …'}</button>
            <a className="knopf klein" href={`/api/werkbank/auskunft/${a.id}/zip`} onClick={() => window.setTimeout(() => void z.laden(), 3000)}>Herunterladen</a>
            <button type="button" className="knopf klein gefahr-rand" onClick={async () => {
              if (!(await rueckfrage({ titel: 'Diese Auskunft löschen?', text: `${titelOder(a.titel)}, erstellt ${zeit(a.erstellt)}. Der Nachweis in der Historie bleibt.`, ja: 'Löschen', gefahr: true }))) return;
              try { await api.auskunftLoeschen(a.id); await z.laden(); } catch (e) { setFehler((e as Error).message); }
            }}>Löschen</button>
          </span>
          {offen === a.id && <Zustellen a={a} s={s} nachher={z.laden} />}
        </li>
      ))}</ul>}
    </section>
  );
}

/* ---------- Einstellungen ---------- */

function Einstellungen({ z }: { z: DatenschutzZustand }) {
  const d = useDaten();
  const gespeichert = z.stand!.einstellung;
  const [e, setE] = useState<Datenschutz>(gespeichert);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  useEffect(() => { setE(gespeichert); }, [gespeichert]);
  const ent = useEntwurf(gespeichert, e, { zuruecksetzen: () => { setE(gespeichert); setMeldung(undefined); } });
  const typen = d.typen.filter((t) => t.system !== 'benutzer' && t.system !== 'rolle');
  const typ = (id: string) => e.typen[id] ?? { person: false, zweck: '' };
  async function speichern() {
    setLaeuft(true); setMeldung(undefined);
    try { await api.setzeDatenschutz(e); await z.laden(); setMeldung({ art: 'gut', text: 'Gespeichert.' }); }
    catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); } finally { setLaeuft(false); }
  }
  return (
    <form className="blatt" id="datenschutz-einstellungen" onSubmit={(x) => { x.preventDefault(); void speichern(); }} onKeyDown={ent.tasten}>
      <h2 className="h3">Einstellungen</h2>
      <div className="raster">
        <label className="eigenschaft breit"><span>Verantwortlicher <small>Name und Anschrift, steht als Absender auf dem Deckblatt</small></span><textarea rows={3} value={e.verantwortlicher} onChange={(x) => setE({ ...e, verantwortlicher: x.target.value })} /></label>
        <label className="eigenschaft breit"><span>Empfänger <small>Vorschlag für jede Auskunft</small></span><textarea rows={2} value={e.empfaenger} onChange={(x) => setE({ ...e, empfaenger: x.target.value })} /></label>
        <label className="eigenschaft breit"><span>Rechte der Person <small>Text auf dem Deckblatt</small></span><textarea rows={4} value={e.rechte} onChange={(x) => setE({ ...e, rechte: x.target.value })} /></label>
      </div>
      <AnredeWahl anrede={e.anrede} setAnrede={(anrede) => setE({ ...e, anrede, rechte: istRechteStandard(e.rechte) ? rechteStandard(anrede) : e.rechte })} />
      <h3 className="h4">Mappentypen</h3>
      <p className="leise klein">Welche Mappentypen betreffen eine Person (nur sie lassen sich als Betroffene wählen)? Der Zweck steht je Mappentyp auf dem Deckblatt, die Speicherdauer kommt aus dem Archivmodus.</p>
      <ul className="stapel auskunft-typen">{typen.map((t) => (
        <li key={t.id}>
          <label className="haken"><input type="checkbox" checked={typ(t.id).person} onChange={(x) => setE({ ...e, typen: { ...e.typen, [t.id]: { ...typ(t.id), person: x.target.checked } } })} />
            <span>{t.name} <span className="leise klein">betrifft eine Person{t.archiv ? ` · Aufbewahrung ${t.archiv.jahre} Jahre` : ''}</span></span></label>
          <label className="eigenschaft einzug klein"><span>Zweck</span><input value={typ(t.id).zweck} maxLength={500} placeholder="z. B. Durchführung des Mietverhältnisses" onChange={(x) => setE({ ...e, typen: { ...e.typen, [t.id]: { ...typ(t.id), zweck: x.target.value } } })} /></label>
        </li>
      ))}</ul>
      {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
      <Speicherleiste ent={ent} gegenstand="Einstellungen" sendet={laeuft} />
    </form>
  );
}

/**
 * Anrede in Unterlagen für Dritte (#474): du oder Sie für alles, was an die Person geht – Deckblatt, Übersicht,
 * LIESMICH, Abrufseite, E-Mails. Die Oberfläche bleibt beim „du“. Vorschau: ein Satz in beiden Formen.
 */
function AnredeWahl({ anrede, setAnrede }: { anrede: Anrede; setAnrede(a: Anrede): void }) {
  return (
    <fieldset className="anrede-dritte" id="anrede">
      <legend>Anrede in Unterlagen für Dritte <Hilfe ort="werkbank.datenschutz.anrede" /></legend>
      <p className="leise klein">Gilt für alles, was an die Person geht: Deckblatt, Übersicht und LIESMICH der Auskunft, die Abrufseite und die E-Mails dazu. Ablago selbst spricht dich weiter mit „du“ an.</p>
      <div className="anrede-dritte-wahl" role="radiogroup" aria-label="Anrede">
        {ANREDEN.map((a) => (
          <label key={a} className={`anrede-dritte-form${a === anrede ? ' gewaehlt' : ''}`}>
            <span className="anrede-dritte-kopf"><input type="radio" name="anrede-dritte" checked={a === anrede} onChange={() => setAnrede(a)} /><strong>{ANREDE_NAME[a]}</strong>{a === 'du' && <span className="leise klein"> (Vorgabe)</span>}</span>
            <q className="klein">{textDritte(a, ANREDE_BEISPIEL)}</q>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
