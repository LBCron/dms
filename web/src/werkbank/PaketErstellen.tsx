import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Symbol } from '../Symbol';
import { BESCHREIBUNG_LAENGE, LIZENZ_SCHLUESSEL, LIZENZEN_ALPHABETISCH, lizenzPasst, LIZENZNAME_LAENGE, naechsteVersion, naechsteVersionen, paketIdAus, VERSIONSARTEN, type ErstellenStand, type Lizenz, type PaketEntwurf, type PaketErstellenEingabe, type PaketPruefung, type VersionsArt } from '../../../shared/src/paketerstellung';
import { t } from '../sprache';
import { api, ApiFehler } from '../api';
import { Hilfe } from '../Hilfe';
import { geheZu } from '../ort';

/**
 * Werkbank → Pakete → Paket erstellen (#374): eigene Mappentypen und Ansichten als Paket im Format der
 * Registry, zum Mitnehmen in ein anderes DMS („Paket hochladen“ im Expertenmodus).
 * Prüfung und Erzeugung macht der Server; hier wird nur ausgewählt, angezeigt und heruntergeladen.
 */

const SCHRITTE = ['Auswählen', 'Prüfen', 'Angaben', 'Exportieren'] as const;
/** Probleme, die zu den Angaben gehören (Schritt 3), statt zur Auswahl. */
const istAngabe = (p: string) => /^(Id|Name|Version|Beschreibung|Autor|GitHub|Lizenz|Ablago-Version):/.test(p);
const groesse = (b: number) => (b < 1024 ? `${b} Bytes` : `${(b / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} KB`);

export function PaketErstellen() {
  const [stand, setStand] = useState<ErstellenStand | null>(null);
  const [e, setE] = useState<PaketErstellenEingabe | null>(null);
  const [idAuto, setIdAuto] = useState(true);
  const [schritt, setSchritt] = useState(0);
  const [pruefung, setPruefung] = useState<PaketPruefung | null>(null);
  const [prueft, setPrueft] = useState(false);
  const [suche, setSuche] = useState('');
  const [fehler, setFehler] = useState<string>();
  const [fertig, setFertig] = useState<string>();
  const [sendet, setSendet] = useState(false);
  const [experte, setExperte] = useState(false);
  const [hochgeladen, setHochgeladen] = useState(false);
  const lauf = useRef(0);

  useEffect(() => {
    api.paketErstellenStand().then((s) => { setStand(s); setE(s.vorschlag); setIdAuto(!s.vorschlag.id); }, (x) => setFehler((x as Error).message));
    // Expertenmodus der Werkbank (#356): Version und Ablago-Version dann auch von Hand (#651).
    api.werkbankAnsicht().then((w) => setExperte(!!w.eigene.experte), () => setExperte(false));
  }, []);

  // #651: Version und nötige Ablago-Version aus der Prüfung vorbelegen, solange nichts Passendes gewählt ist.
  const lage = pruefung?.version;
  useEffect(() => {
    if (!e || !lage || e.vonHand) return;
    const x: Partial<PaketErstellenEingabe> = {};
    if (!lage.dmsOptionen.includes(e.dms)) x.dms = lage.dmsOptionen[0];
    const moeglich = lage.bekannt ? Object.values(naechsteVersionen(lage.bekannt)) : ['1.0.0', ...(experte ? ['0.1.0'] : [])];
    if (!moeglich.includes(e.version)) x.version = lage.bekannt ? naechsteVersionen(lage.bekannt)[lage.art ?? 'inhalt'] : '1.0.0';
    if (Object.keys(x).length) setE({ ...e, ...x });
  }, [lage, e, experte]);

  // Automatische Prüfung bei jeder Änderung (kurz verzögert); die letzte Antwort gewinnt.
  useEffect(() => {
    if (!e) return;
    const nr = ++lauf.current;
    setPrueft(true);
    const t = setTimeout(() => {
      api.paketErstellenPruefen(e).then((p) => { if (nr === lauf.current) { setPruefung(p); setFehler(undefined); } }, (x) => { if (nr === lauf.current) setFehler((x as Error).message); })
        .finally(() => { if (nr === lauf.current) setPrueft(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [e]);

  if (fehler && !stand) return <div className="leer"><p>{fehler}</p></div>;
  if (!stand || !e) return <div className="leer"><p>Lade …</p></div>;

  const setze = (x: Partial<PaketErstellenEingabe>) => { setFertig(undefined); setE({ ...e, ...x }); };
  const umschalten = (liste: 'typen' | 'sichten' | 'beispiele' | 'wortlisten', id: string, an: boolean) => { const l = e[liste] ?? []; setze({ [liste]: an ? [...l, id] : l.filter((x) => x !== id) }); };
  const ausEntwurf = (x: PaketEntwurf) => { setIdAuto(false); setHochgeladen(false); setze({ ...x, version: naechsteVersion(x.version), dms: '', aenderungen: '', bekannteVersion: undefined }); };
  async function letzteHochladen(datei: File) {
    if (!e) return;
    try {
      const r = await api.paketLetzteVersion(datei);
      if (e.id && r.id !== e.id) { setFehler(t('pakete.erstellen.version.andereId', { id: r.id, eigene: e.id })); return; }
      setFehler(undefined); setHochgeladen(true);
      if (!e.id) setIdAuto(false);
      setze({ bekannteVersion: r.version, ...(e.id ? {} : { id: r.id, name: e.name || r.name }) });
    } catch (x) { setFehler([(x as Error).message, ...(x instanceof ApiFehler ? x.gruende : [])].join(' ')); }
  }

  const p = pruefung;
  const auswahlProbleme = p?.probleme.filter((x) => !istAngabe(x)) ?? [];
  const angabeProbleme = p?.probleme.filter(istAngabe) ?? [];

  async function exportieren() {
    if (!e) return;
    setSendet(true); setFehler(undefined); setFertig(undefined);
    try {
      const r = await api.paketExportieren(e);
      setFertig(`Gespeichert als „${r.name}“ (${groesse(r.bytes)}). In der anderen Ablago-Installation: Werkbank → Pakete → Expertenmodus → Paket hochladen.`);
      setStand(await api.paketErstellenStand());
    } catch (x) { setFehler([(x as Error).message, ...(x instanceof ApiFehler ? x.gruende : [])].join(' ')); }
    finally { setSendet(false); }
  }

  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">Werkbank · Pakete</p>
        <h1>Paket erstellen</h1>
        <p className="leise">Mach aus deinen eigenen Mappentypen und Ansichten ein Paket, das du in einer anderen Ablago-Installation mit „Paket hochladen“ installierst. Mappen, Dokumente, Benutzer und Passwörter kommen nicht mit. <Hilfe ort="werkbank.pakete.erstellen" /></p>
      </div>
      <ol className="assistent-schritte" aria-label={`Schritt ${schritt + 1} von ${SCHRITTE.length}: ${SCHRITTE[schritt]}`}>
        {SCHRITTE.map((s, i) => (
          <li key={s} className={i < schritt ? 'erledigt' : i === schritt ? 'aktiv' : ''} aria-current={i === schritt ? 'step' : undefined}>
            <button type="button" className="textknopf" onClick={() => setSchritt(i)}><span className="nr" aria-hidden="true">{i < schritt ? <Symbol name="haken" /> : i + 1}</span><span className="name">{s}</span></button>
          </li>
        ))}
      </ol>

      {schritt === 0 && <Auswahl stand={stand} e={e} suche={suche} setSuche={setSuche} umschalten={umschalten} pruefung={p} />}

      {schritt === 1 && (
        <section className="blatt" aria-label="Prüfung">
          <h2 className="h3">Automatische Prüfung</h2>
          {!p ? <p className="leise">Prüfe …</p> : <>
            {auswahlProbleme.length > 0 && <div className="hinweis schlecht"><ul>{auswahlProbleme.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            {p.fehlend.length > 0 && (
              <div className="hinweis warn">
                <p>Nicht gewählt, aber gebraucht:</p>
                <ul>{p.fehlend.map((f) => (
                  <li key={f.id}>{f.art === 'typ' ? 'Mappentyp' : 'Ansicht'} „{f.name}“ <span className="leise">({f.grund})</span> <button type="button" className="textknopf" onClick={() => umschalten(f.art === 'typ' ? 'typen' : 'sichten', f.id, true)}>Mit aufnehmen</button></li>
                ))}</ul>
              </div>
            )}
            {p.hinweise.length > 0 && <div className="hinweis info"><ul>{p.hinweise.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            {!auswahlProbleme.length && !p.fehlend.length && <p className="gut">Die Auswahl passt.</p>}
            <Inhalt p={p} />
          </>}
        </section>
      )}

      {schritt === 2 && (
        <section className="blatt" aria-label="Angaben">
          <h2 className="h3">Angaben</h2>
          <div className="raster">
          {stand.entwuerfe.length > 0 && (
            <label className="eigenschaft breit"><span>Früher exportiert</span>
              <select value="" onChange={(x) => { const w = stand.entwuerfe.find((y) => y.id === x.target.value); if (w) ausEntwurf(w); }}>
                <option value="">– Angaben übernehmen –</option>
                {stand.entwuerfe.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.id}) · {w.version} · {new Date(w.exportiert).toLocaleDateString('de-DE')}</option>)}
              </select>
              <small className="leise">Dieselbe Id mit höherer Version – dann aktualisiert die andere Ablago-Installation das Paket.</small>
            </label>
          )}
          <label className="eigenschaft"><span>Name</span><input value={e.name} maxLength={60} onChange={(x) => setze({ name: x.target.value, ...(idAuto ? { id: paketIdAus(x.target.value) } : {}) })} /></label>
          <label className="eigenschaft"><span>Id</span><input value={e.id} maxLength={20} onChange={(x) => { setIdAuto(false); setze({ id: x.target.value }); }} />
            <small className="leise">Kleinbuchstaben, Ziffern und _, z. B. <code>vertraege_familie</code>. Bleibt bei jeder Version gleich.</small></label>
          <label className="eigenschaft breit"><span>Beschreibung</span><textarea rows={3} value={e.beschreibung} maxLength={BESCHREIBUNG_LAENGE.max} onChange={(x) => setze({ beschreibung: x.target.value })} />
            <small className="leise">Ein, zwei Sätze: was das Paket bringt und für wen ({BESCHREIBUNG_LAENGE.min}–{BESCHREIBUNG_LAENGE.max} Zeichen). Daraus wird auch die README.</small></label>
          <label className="eigenschaft"><span>Autor</span><input value={e.autor.name} onChange={(x) => setze({ autor: { ...e.autor, name: x.target.value } })} /></label>
          <label className="eigenschaft"><span>GitHub-Name (optional)</span><input value={e.autor.github} onChange={(x) => setze({ autor: { ...e.autor, github: x.target.value } })} /></label>
          <label className="eigenschaft breit"><span>Was ist neu in dieser Version?</span><textarea rows={2} value={e.aenderungen} onChange={(x) => setze({ aenderungen: x.target.value })} placeholder="z. B. Feld Kundennummer am Vertrag" />
            <small className="leise">Steht im CHANGELOG; leer: „Erste Fassung.“ bzw. „Neue Version …“.</small></label>
          </div>
          <VersionWahl e={e} setze={setze} lage={lage ?? null} experte={experte} hochgeladen={hochgeladen} hochladen={(d) => void letzteHochladen(d)} />
          <LizenzWahl e={e} setze={setze} />
          {angabeProbleme.length > 0 && <div className="hinweis schlecht"><ul>{angabeProbleme.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        </section>
      )}

      {schritt === 3 && (
        <section className="blatt" aria-label="Exportieren">
          <h2 className="h3">Exportieren</h2>
          {!p ? <p className="leise">Prüfe …</p> : p.einspielbar ? <>
            <div className="hinweis gut"><p>Das Paket hat dieselbe Prüfung bestanden wie beim Hochladen – es lässt sich so in einer anderen Ablago-Installation installieren{Object.keys(p.abhaengigkeiten).length ? ', wenn dort die Abhängigkeiten installiert sind' : ''}.</p></div>
            <dl className="eigenschaften">
              <dt>Paket</dt><dd>{e.name} ({e.id}) · Version {e.version} · {e.lizenzArt === 'eigen' ? e.lizenzName : e.lizenzArt === 'keine' ? t('pakete.erstellen.lizenz.keine') : e.lizenz} · Ablago {e.dms}</dd>
              <dt>Datei</dt><dd>{p.datei?.name} · {groesse(p.datei?.bytes ?? 0)}</dd>
            </dl>
            <Inhalt p={p} />
            {e.lizenzArt && e.lizenzArt !== 'frei' && <div className="hinweis warn"><p>{t('pakete.erstellen.lizenz.nichtKatalog')}</p></div>}
          </> : <div className="hinweis schlecht stapel"><p>{t('pakete.erstellen.nochnicht')}</p><ul>{p.probleme.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {fertig && <div className="hinweis gut" role="status"><p>{fertig}</p></div>}
        </section>
      )}

      {fehler && <div className="hinweis schlecht" role="alert"><p>{fehler}</p></div>}

      <div className="speicherleiste">
        <button type="button" className="textknopf" onClick={() => geheZu('/werkbank/pakete')}>Abbrechen</button>
        <span className="status" role="status">{prueft ? 'Prüfe …' : p ? (p.einspielbar ? 'Bereit zum Export' : `${p.probleme.length} ${p.probleme.length === 1 ? 'Punkt' : 'Punkte'} offen`) : ''}</span>
        <div className="knoepfe">
          {schritt > 0 && <button type="button" className="knopf" onClick={() => setSchritt(schritt - 1)}>Zurück</button>}
          {schritt < SCHRITTE.length - 1
            ? <button type="button" className="knopf primaer" onClick={() => setSchritt(schritt + 1)}>Weiter</button>
            : <button type="button" className="knopf primaer" disabled={sendet || prueft || !p?.einspielbar} onClick={() => void exportieren()}>{sendet ? 'Erstelle …' : 'Als .zip exportieren'}</button>}
        </div>
      </div>
    </div>
  );
}

/** Schritt 1: Mappentypen, Ansichten und (optional) Beispiel-Mappen wählen. */
function Auswahl({ stand, e, suche, setSuche, umschalten, pruefung }: {
  stand: ErstellenStand; e: PaketErstellenEingabe; suche: string; setSuche(s: string): void; pruefung: PaketPruefung | null;
  umschalten(liste: 'typen' | 'sichten' | 'beispiele' | 'wortlisten', id: string, an: boolean): void;
}) {
  const s = suche.trim().toLowerCase();
  const passt = (n: string) => !s || n.toLowerCase().includes(s);
  // Ansichten als Baum (eingerückt), Reihenfolge wie in der Ablage.
  const baum = useMemo(() => {
    const erg: Array<{ s: ErstellenStand['sichten'][number]; tiefe: number }> = [];
    const besuche = (eltern: string | null, tiefe: number, gesehen: Set<string>) => {
      for (const x of stand.sichten.filter((y) => y.elternId === eltern)) {
        if (gesehen.has(x.id)) continue;
        gesehen.add(x.id); erg.push({ s: x, tiefe }); besuche(x.id, tiefe + 1, gesehen);
      }
    };
    besuche(null, 0, new Set());
    return erg;
  }, [stand.sichten]);
  return (
    <>
      <div className="zeile"><input type="search" placeholder="Suchen …" aria-label="Mappentypen, Ansichten und Wortlisten durchsuchen" value={suche} onChange={(x) => setSuche(x.target.value)} /></div>
      <section className="blatt" aria-label="Mappentypen">
        <h2 className="h3">Mappentypen</h2>
        <ul className="stapel">
          {stand.typen.filter((t) => passt(t.name)).map((t) => (
            <li key={t.id}><label className="haken"><input type="checkbox" checked={e.typen.includes(t.id)} onChange={(x) => umschalten('typen', t.id, x.target.checked)} />
              <span>{t.name}{t.paket && <> <span className="chip" title="Kommt beim Export als Abhängigkeit mit, nicht als Kopie">aus {t.paket.name} {t.paket.version}</span></>}{t.geaendert && (t.unterschiede
                ? <details className="unterschiede"><summary><span className="chip warn">geändert: {t.unterschiede.kurz}</span></summary><ul className="klein">{t.unterschiede.liste.map((x) => <li key={x}>{x}</li>)}</ul></details>
                : <> <span className="chip warn" title="Nach der Installation des Pakets geändert – Einzelheiten kennt Ablago erst nach dem nächsten Update des Pakets">geändert</span></>)}
                {t.beschreibung && <small className="leise">{t.beschreibung}</small>}</span></label></li>
          ))}
          {!stand.typen.length && <li className="leise">Keine Mappentypen.</li>}
        </ul>
      </section>
      <section className="blatt" aria-label="Ansichten">
        <h2 className="h3">Ansichten</h2>
        <ul className="stapel">
          {baum.filter(({ s: x }) => passt(x.name)).map(({ s: x, tiefe }) => (
            <li key={x.id} style={{ paddingLeft: `${s ? 0 : tiefe * 1.4}em` }}><label className="haken"><input type="checkbox" checked={e.sichten.includes(x.id)} onChange={(y) => umschalten('sichten', x.id, y.target.checked)} />
              <span>{x.name}{x.paket && <> <span className="chip">aus {x.paket.name}</span></>}</span></label></li>
          ))}
          {!stand.sichten.length && <li className="leise">Keine Ansichten.</li>}
        </ul>
      </section>
      <section className="blatt" aria-label="Wortlisten">
        <h2 className="h3">Wortlisten</h2>
        <p className="leise klein">Gleichbedeutende Wörter für die Suche (Werkbank → Suche). Beim Empfänger stehen sie unter „aus Paketen“; Gruppen aus installierten Paketen kommen nicht mit.</p>
        <ul className="stapel">
          {(stand.wortlisten ?? []).filter((g) => passt(g.woerter.join(' '))).map((g) => (
            <li key={g.id}><label className={`haken${g.paket ? ' grau' : ''}`}><input type="checkbox" disabled={!!g.paket} checked={!g.paket && (e.wortlisten ?? []).includes(g.id)} onChange={(x) => umschalten('wortlisten', g.id, x.target.checked)} />
              <span>{g.woerter.join(', ')}{g.paket && <> <span className="chip">aus {g.paket.name}</span></>}</span></label></li>
          ))}
          {!(stand.wortlisten ?? []).length && <li className="leise">Keine Wortlisten.</li>}
        </ul>
      </section>
      <section className="blatt" aria-label="Beispiel-Mappen">
        <h2 className="h3">Beispiel-Mappen (optional)</h2>
        <p className="leise klein">Ohne Auswahl enthält das Paket keine Mappen. Wählst du Mappen, kommen ihre Feldwerte als Beispiele ins Paket – nimm nur Mappen mit erfundenen Daten, z. B. Demo-Mappen. Passwörter, Dokumente, Notizen und Verweise auf nicht gewählte Mappen bleiben draußen.</p>
        {!pruefung ? <p className="leise klein">Lade …</p> : !pruefung.beispielMappen.length ? <p className="leise klein">Wähle zuerst eigene Mappentypen.</p> : pruefung.beispielMappen.map((b) => (
          <details key={b.typId} open={b.mappen.some((m) => e.beispiele.includes(m.id))}>
            <summary>{b.typ} <span className="leise klein">({b.mappen.filter((m) => e.beispiele.includes(m.id)).length} von {b.mappen.length}{b.mehr ? '+' : ''} gewählt)</span></summary>
            <ul className="stapel">
              {b.mappen.filter((m) => passt(m.titel)).map((m) => (
                <li key={m.id}><label className="haken"><input type="checkbox" checked={e.beispiele.includes(m.id)} onChange={(x) => umschalten('beispiele', m.id, x.target.checked)} /><span>{m.titel}{m.demo && <> <span className="chip gut">Demo</span></>}</span></label></li>
              ))}
              {!b.mappen.length && <li className="leise klein">Keine Mappen.</li>}
            </ul>
          </details>
        ))}
      </section>
    </>
  );
}

/** Was ins Paket kommt („würde installieren …“). */
function Inhalt({ p }: { p: PaketPruefung }) {
  const abh = Object.entries(p.abhaengigkeiten);
  return (
    <dl className="eigenschaften">
      <dt>Mappentypen</dt><dd>{p.inhalt.typen.map((t) => t.name).join(', ') || '–'}</dd>
      <dt>Ansichten</dt><dd>{p.inhalt.sichten.map((s) => (s.eltern ? `${p.inhalt.sichten.find((x) => x.schluessel === s.eltern)?.name} → ${s.name}` : s.name)).join(', ') || '–'}</dd>
      <dt>Beispiele</dt><dd>{p.inhalt.beispiele || 'keine'}</dd>
      <dt>Wortlisten</dt><dd>{p.inhalt.wortlisten || 'keine'}</dd>
      <dt>Abhängigkeiten</dt><dd>{abh.length ? abh.map(([k, v]) => `${k} ${v}`).join(', ') : 'keine'}</dd>
    </dl>
  );
}

/** #651: Version wählen (drei Arten der Änderung) und nötige Ablago-Version aus der Auswahl. */
function VersionWahl({ e, setze, lage, experte, hochgeladen, hochladen }: {
  e: PaketErstellenEingabe; setze(x: Partial<PaketErstellenEingabe>): void; lage: PaketPruefung['version'] | null;
  experte: boolean; hochgeladen: boolean; hochladen(d: File): void;
}) {
  const datei = useRef<HTMLInputElement>(null);
  const name = useId();
  if (!lage) return <p className="leise">{t('pakete.erstellen.version.titel')}: …</p>;
  const n = lage.bekannt ? naechsteVersionen(lage.bekannt) : null;
  const beispiel: Record<VersionsArt, string> = { korrektur: t('pakete.erstellen.version.korrekturBeispiel'), inhalt: t('pakete.erstellen.version.inhaltBeispiel'), gross: t('pakete.erstellen.version.grossBeispiel') };
  const titel: Record<VersionsArt, (v: string) => string> = { korrektur: (v) => t('pakete.erstellen.version.korrektur', { version: v }), inhalt: (v) => t('pakete.erstellen.version.inhalt', { version: v }), gross: (v) => t('pakete.erstellen.version.gross', { version: v }) };
  const opt = lage.dmsOptionen;
  return (
    <>
      <fieldset className="eigenschaft breit">
        <legend>{t('pakete.erstellen.version.titel')}</legend>
        {e.vonHand ? (
          <label className="eigenschaft"><span>{t('pakete.erstellen.version.titel')}</span><input value={e.version} onChange={(x) => setze({ version: x.target.value })} /></label>
        ) : n ? <>
          <p className="leise klein">{t(hochgeladen ? 'pakete.erstellen.version.bekanntHochgeladen' : 'pakete.erstellen.version.bekannt', { version: lage.bekannt! })}</p>
          {VERSIONSARTEN.map((a) => (
            <label key={a} className="haken"><input type="radio" name={name} checked={e.version === n[a]} onChange={() => setze({ version: n[a] })} />
              <span>{titel[a](n[a])}<small className="leise">{beispiel[a]}</small></span></label>
          ))}
          {lage.art && lage.artGrund && <p className="leise klein">{t('pakete.erstellen.version.erkannt', { grund: lage.artGrund })}</p>}
        </> : <>
          {experte ? <>
            <label className="haken"><input type="radio" name={name} checked={e.version === '1.0.0'} onChange={() => setze({ version: '1.0.0' })} /><span>1.0.0<small className="leise">{t('pakete.erstellen.version.erstesErklaerung')}</small></span></label>
            <label className="haken"><input type="radio" name={name} checked={e.version === '0.1.0'} onChange={() => setze({ version: '0.1.0' })} /><span>{t('pakete.erstellen.version.nullEins')}</span></label>
          </> : <p><strong>{t('pakete.erstellen.version.erstes')}</strong><br /><small className="leise">{t('pakete.erstellen.version.erstesErklaerung')}</small></p>}
        </>}
        {!e.vonHand && <p className="leise klein">{t('pakete.erstellen.version.unbekannt')}{' '}
          <button type="button" className="textknopf" onClick={() => datei.current?.click()}>{t('pakete.erstellen.version.hochladen')}</button>
          <input ref={datei} type="file" accept=".zip,application/zip" hidden onChange={(x) => { const f = x.target.files?.[0]; if (f) hochladen(f); x.target.value = ''; }} /></p>}
        {experte && <label className="haken"><input type="checkbox" checked={!!e.vonHand} onChange={(x) => setze({ vonHand: x.target.checked || undefined })} />
          <span>{t('pakete.erstellen.version.vonHand')}<small className="leise">{t('pakete.erstellen.version.vonHandHinweis')}</small></span></label>}
      </fieldset>
      <label className="eigenschaft"><span>{t('pakete.erstellen.dms.titel')}</span>
        {e.vonHand ? <input value={e.dms} onChange={(x) => setze({ dms: x.target.value })} />
          : <select value={opt.includes(e.dms) ? e.dms : ''} onChange={(x) => setze({ dms: x.target.value })}>
            {[...opt].reverse().map((o, i, alle) => <option key={o} value={o}>{o === opt[0] ? t('pakete.erstellen.dms.mindest', { angabe: o }) : i === 0 && alle.length > 1 ? t('pakete.erstellen.dms.eigene', { angabe: o }) : o}</option>)}
          </select>}
        <small className="leise">{lage.gruende.length ? t('pakete.erstellen.dms.gruende', { gruende: lage.gruende.join(', ') }) : t('pakete.erstellen.dms.grundlage')}</small></label>
    </>
  );
}

/** #651: freie Lizenz (Suchfeld mit Vorschlägen), eigene Lizenz (Name + Text) oder keine. */
function LizenzWahl({ e, setze }: { e: PaketErstellenEingabe; setze(x: Partial<PaketErstellenEingabe>): void }) {
  const art = e.lizenzArt ?? 'frei';
  const name = useId();
  return (
    <fieldset className="eigenschaft breit">
      <legend>{t('pakete.erstellen.lizenz.titel')}</legend>
      {(['frei', 'eigen', 'keine'] as const).map((a) => (
        <label key={a} className="haken"><input type="radio" name={name} checked={art === a} onChange={() => setze({ lizenzArt: a })} /><span>{t(`pakete.erstellen.lizenz.${a}`)}</span></label>
      ))}
      {art === 'frei' && <LizenzSuche wert={e.lizenz} waehle={(l) => setze({ lizenz: l })} />}
      {art === 'eigen' && <>
        <label className="eigenschaft"><span>{t('pakete.erstellen.lizenz.name')}</span>
          <input value={e.lizenzName ?? ''} maxLength={LIZENZNAME_LAENGE.max} placeholder={t('pakete.erstellen.lizenz.namePlatzhalter')} onChange={(x) => setze({ lizenzName: x.target.value })} /></label>
        <label className="eigenschaft breit"><span>{t('pakete.erstellen.lizenz.text')}</span>
          <textarea rows={6} value={e.lizenzText ?? ''} onChange={(x) => setze({ lizenzText: x.target.value })} /></label>
        <label className="eigenschaft"><span>{t('pakete.erstellen.lizenz.datei')}</span>
          <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(x) => { const f = x.target.files?.[0]; if (f) void f.text().then((text) => setze({ lizenzText: text })); }} /></label>
      </>}
      {art === 'keine' && <p className="leise klein">{t('pakete.erstellen.lizenz.keineHinweis')}</p>}
      {art !== 'frei' && <div className="hinweis info"><p>{t('pakete.erstellen.lizenz.nichtKatalog')}</p></div>}
    </fieldset>
  );
}

const lizenzName = (l: Lizenz) => t.frei(`pakete.erstellen.lizenz.${LIZENZ_SCHLUESSEL[l]}.name`);
const lizenzSatz = (l: Lizenz) => t.frei(`pakete.erstellen.lizenz.${LIZENZ_SCHLUESSEL[l]}.satz`);

/** Suchfeld mit Vorschlägen (Combobox): Kürzel und Name, alphabetisch; Pfeiltasten, Enter, Escape. */
function LizenzSuche({ wert, waehle }: { wert: string; waehle(l: Lizenz): void }) {
  const [eingabe, setEingabe] = useState(wert);
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(0);
  const id = useId();
  const liste = LIZENZEN_ALPHABETISCH.filter((l) => lizenzPasst(l, lizenzName(l), eingabe === wert ? '' : eingabe));
  const nimm = (l: Lizenz) => { waehle(l); setEingabe(l); setOffen(false); };
  const gewaehlt = (LIZENZEN_ALPHABETISCH as string[]).includes(wert) ? (wert as Lizenz) : null;
  return (
    <div className="refbox" onBlur={(x) => { if (!x.currentTarget.contains(x.relatedTarget as Node)) { setOffen(false); setEingabe(wert); } }}>
      <div className="wahl">
        <input type="search" role="combobox" aria-label={t('pakete.erstellen.lizenz.suchen')} placeholder={t('pakete.erstellen.lizenz.suchen')} autoComplete="off"
          aria-expanded={offen} aria-controls={offen ? `${id}-l` : undefined} aria-autocomplete="list" aria-activedescendant={offen && liste[aktiv] ? `${id}-${aktiv}` : undefined}
          value={eingabe} onFocus={() => setOffen(true)} onClick={() => setOffen(true)}
          onChange={(x) => { setEingabe(x.target.value); setOffen(true); setAktiv(0); }}
          onKeyDown={(x) => {
            if (x.key === 'Escape') { setOffen(false); setEingabe(wert); }
            else if (x.key === 'ArrowDown') { x.preventDefault(); if (!offen) setOffen(true); else setAktiv((a) => Math.min(a + 1, liste.length - 1)); }
            else if (x.key === 'ArrowUp') { x.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)); }
            else if (x.key === 'Enter') { x.preventDefault(); if (offen && liste[aktiv]) nimm(liste[aktiv]); }
          }} />
        {offen && (
          <div id={`${id}-l`} className="wahlliste" role="listbox" aria-label={t('pakete.erstellen.lizenz.frei')}>
            {!liste.length ? <p className="leise klein">{t('pakete.erstellen.lizenz.keinTreffer')}</p> : liste.map((l, i) => (
              <button key={l} id={`${id}-${i}`} type="button" role="option" aria-selected={l === wert} className={i === aktiv ? 'an' : undefined}
                onMouseDown={(x) => x.preventDefault()} onClick={() => nimm(l)}>
                <strong>{l}</strong> – {lizenzName(l)}<br /><small className="leise">{lizenzSatz(l)}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      {gewaehlt && <p className="leise klein">{lizenzName(gewaehlt)}: {lizenzSatz(gewaehlt)} {t('pakete.erstellen.lizenz.freiHinweis')}</p>}
    </div>
  );
}
