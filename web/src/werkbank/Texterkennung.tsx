import { DateienPruefen } from './Archiv';
import { NummernNachtragen } from './Nummernkreise';
import { FormateUnpassend } from './FormateUnpassend';
import { AbsenderBereinigen } from './AbsenderBereinigen';
import { useCallback, useEffect, useState } from 'react';
import { OCR_STAENDE, type OcrStandArt } from '../../../shared/src/model';
import { api, type OcrStatus } from '../api';
import { Link } from '../ort';
import { Hilfe } from '../Hilfe';
import { rueckfrage } from '../rueckfrage';
import { WARTUNG_GEAENDERT } from '../wartung';
import { sprachname, sprachvorschlaege } from '../../../shared/src/textsprache';
import { TEXTERKENNUNG_PAKET } from '../../../shared/src/volltext';
import { fortschrittText } from '../../../shared/src/auftrag';
import type { Auftrag as HintergrundAuftrag } from '../api';
import { t as tx } from '../sprache';

/**
 * Werkbank → Texterkennung (#45, #459): Übersicht – welches Paket die Texterkennung übernimmt, woher der Text der
 * Dokumente kommt, erkannte Sprachen, Warteschlange und Aufträge. Einstellungen der Erkennung stehen beim Paket.
 * Werkbank → Wartungsoperationen: Volltext neu erzeugen (#458), alle Dateien prüfen (#212),
 * Nummern nachträglich vergeben. Sicherung, Wiederherstellung und Export sind eigene Bereiche.
 */

export function useTexterkennung(aktiv: boolean) {
  const [stand, setStand] = useState<OcrStatus | null>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async (werkzeugeNeu = false) => {
    try { setStand(await api.texterkennung(werkzeugeNeu)); setFehler(undefined); } catch (e) { setFehler((e as Error).message); }
  }, []);
  // Solange etwas wartet oder läuft, alle paar Sekunden auffrischen.
  const offen = !!stand && (stand.zaehler.wartet > 0 || stand.zaehler.laeuft > 0 || (stand.zaehler.paket ?? 0) > 0);
  useEffect(() => {
    if (!aktiv) return;
    void laden();
  }, [aktiv, laden]);
  useEffect(() => {
    if (!aktiv || !offen) return;
    const t = setInterval(() => void laden(), 3000);
    return () => clearInterval(t);
  }, [aktiv, offen, laden]);
  return { stand, setStand, fehler, laden };
}
export type TexterkennungZustand = ReturnType<typeof useTexterkennung>;

const zahl = (n: number) => n.toLocaleString('de-DE');
const REIHENFOLGE: OcrStandArt[] = ['wartet', 'laeuft', 'paket', 'fertig', 'fehler', 'ausgelassen', 'keiner'];

function Warteschlange({ s }: { s: OcrStatus }) {
  return (
    <dl className="eigenschaften">
      {REIHENFOLGE.map((k) => <div key={k} style={{ display: 'contents' }}><dt>{k === 'keiner' ? 'ohne Volltext (noch nie erkannt)' : OCR_STAENDE[k]}</dt><dd>{zahl(s.zaehler[k])}</dd></div>)}
    </dl>
  );
}

/**
 * Warum die Warteschlange steht (#366): ausgeschaltet oder Wartungsmodus – mit dem Knopf, der es behebt.
 * Steht bei der Texterkennung und bei „Volltext neu erzeugen“.
 */
function PauseHinweis({ t, wartungAn }: { t: TexterkennungZustand; wartungAn?: boolean }) {
  const s = t.stand!;
  const [meldung, setMeldung] = useState<string>();
  const offen = s.zaehler.wartet + s.zaehler.laeuft;
  const warten = offen ? ` ${zahl(offen)} ${offen === 1 ? 'Dokument wartet' : 'Dokumente warten'}.` : '';
  async function einschalten() {
    try { t.setStand(await api.texterkennungSpeichern({ ...s.einstellungen, aktiv: true })); } catch (e) { setMeldung((e as Error).message); }
  }
  async function wartungBeenden() {
    if (!(await rueckfrage({ titel: 'Wartungsmodus beenden?', text: 'Alle können sich wieder anmelden, die Hintergrundarbeit läuft weiter.', ja: 'Wartung beenden' }))) return;
    try { await api.wartungAus(); dispatchEvent(new Event(WARTUNG_GEAENDERT)); await t.laden(); } catch (e) { setMeldung((e as Error).message); }
  }
  if (!s.einstellungen.aktiv) return (
    <div className="hinweis warn hinweiszeile" role="status">
      <p><strong>Die Texterkennung ist ausgeschaltet.</strong>{warten} Neue Dokumente bleiben in der Warteschlange, bis du sie einschaltest.{meldung && <span className="fehlertext blockzeile">{meldung}</span>}</p>
      <button type="button" className="knopf primaer klein" onClick={() => void einschalten()}>Einschalten</button>
    </div>
  );
  if (wartungAn) return (
    <div className="hinweis warn hinweiszeile" role="status">
      <p><strong>Pausiert, solange der Wartungsmodus an ist.</strong>{warten}{meldung && <span className="fehlertext blockzeile">{meldung}</span>}</p>
      <button type="button" className="knopf klein" onClick={() => void wartungBeenden()}>Wartungsmodus beenden</button>
    </div>
  );
  return null;
}

export function TexterkennungPanel({ t, wartungAn }: { t: TexterkennungZustand; wartungAn?: boolean }) {
  if (t.fehler) return <div className="hinweis schlecht"><p>{t.fehler}</p></div>;
  if (!t.stand) return <p className="leise">Lade …</p>;
  const s = t.stand;
  const w = s.werkzeuge;
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">Werkbank</p>
        <h1>Texterkennung</h1>
        <p className="leise">{tx('volltext.werkbank.einleitung')} <Hilfe ort="werkbank.texterkennung" /></p>
      </div>
      <PauseHinweis t={t} wartungAn={wartungAn} />

      <PaketBlock s={s} />

      <HerkunftBlock s={s} />

      <UmwandlungBlock s={s} />

      <ErkannteSprachen s={s} />

      <section className="blatt" id="warteschlange">
        <h2 className="h3">Warteschlange</h2>
        <p><strong>{zahl(s.zaehler.wartet + s.zaehler.laeuft)} offen</strong> · {zahl(s.zaehler.fehler)} mit Fehler{!s.einstellungen.aktiv ? ' · ausgeschaltet' : wartungAn ? ' · pausiert (Wartungsmodus)' : ''}</p>
        <Warteschlange s={s} />
        <p className="leise klein">{tx('volltext.werkbank.neu')} <Link to="/werkbank/wartung" className="verweis">{tx('volltext.werkbank.neu.link')}</Link></p>
      </section>

      <section className="blatt" id="werkzeuge">
        <h2 className="h3">Werkzeuge</h2>
        <dl className="eigenschaften">
          <dt>{tx('volltext.werkbank.poppler')}</dt><dd>{w.pdftotext && w.pdftoppm ? tx('volltext.werkbank.poppler.da') : <span className="fehlertext">{tx('volltext.werkbank.poppler.fehlt')}</span>}</dd>
        </dl>
        <div className="knoepfe"><button type="button" className="knopf klein" onClick={() => void t.laden(true)}>Erneut prüfen</button></div>
      </section>

      <Auftraege t={t} />
    </div>
  );
}

/**
 * Wer Scans und Bilder erkennt (#458, #459): das Paket (mit Link zu seinen Einstellungen) – oder der deutliche
 * Hinweis, dass es fehlt, mit dem direkten Weg zur Installation.
 */
function PaketBlock({ s }: { s: OcrStatus }) {
  const p = s.paket;
  const wartet = s.zaehler.paket ?? 0;
  return (
    <section className="blatt" id="paket">
      <h2 className="h3">{tx('volltext.werkbank.paket.titel')}</h2>
      {p ? <>
        <p>{tx('volltext.werkbank.paket.da', { paket: `${p.name} ${p.version}` })}</p>
        {wartet > 0 && <p className="leise">{tx('volltext.werkbank.paket.wartet', { anzahl: wartet })}</p>}
        <div className="knoepfe"><Link to={`/werkbank/pakete/${p.id}`} className="knopf klein">{tx('volltext.werkbank.paket.einstellungen')}</Link></div>
      </> : (
        <div className="hinweis warn hinweiszeile" role="status">
          <p><strong>{tx('volltext.werkbank.paket.fehlt')}</strong> {tx('volltext.werkbank.paket.fehlt.text')}{wartet > 0 ? ` ${tx('volltext.werkbank.paket.ohne', { anzahl: wartet })}` : ''}</p>
          <Link to={`/werkbank/pakete/${TEXTERKENNUNG_PAKET}`} className="knopf primaer klein">{tx('volltext.werkbank.paket.installieren')}</Link>
        </div>
      )}
    </section>
  );
}

/** Woher der Volltext der Dokumente kommt (#459): aus dem PDF, vom Paket, ohne Text, mit Fehler. */
function HerkunftBlock({ s }: { s: OcrStatus }) {
  const h = s.herkunft;
  if (!h) return null;
  const zeilen: Array<[string, number]> = [
    [tx('volltext.herkunft.pdf'), h.pdf],
    [tx('volltext.werkbank.herkunft.paket'), h.paket],
    ...(h.eingebaut ? [[tx('volltext.werkbank.herkunft.eingebaut'), h.eingebaut] as [string, number]] : []),
    ...(h.api ? [[tx('volltext.herkunft.api'), h.api] as [string, number]] : []),
    ...(h.sonst ? [[tx('volltext.werkbank.herkunft.sonst'), h.sonst] as [string, number]] : []),
    [OCR_STAENDE.paket, s.zaehler.paket ?? 0],
    [tx('volltext.werkbank.herkunft.ohne'), h.ohneText + s.zaehler.keiner],
    [OCR_STAENDE.fehler, s.zaehler.fehler],
  ];
  return (
    <section className="blatt" id="herkunft">
      <h2 className="h3">{tx('volltext.werkbank.herkunft.titel')}</h2>
      <dl className="eigenschaften">
        {zeilen.map(([k, n]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{zahl(n)}</dd></div>)}
      </dl>
    </section>
  );
}

/**
 * Andere Dateitypen (#577): je Typ, wie viele Dokumente es gibt und ob ein Paket sie umwandelt – sonst welches Paket
 * aus dem Katalog es könnte, mit dem Weg zur Installation.
 */
function UmwandlungBlock({ s }: { s: OcrStatus }) {
  const u = s.umwandlung;
  if (!u) return null;
  return (
    <section className="blatt" id="umwandlung">
      <h2 className="h3">{tx('volltext.werkbank.umwandlung.titel')} <Hilfe ort="werkbank.texterkennung.umwandlung" /></h2>
      <p className="leise">{tx('volltext.werkbank.umwandlung.einleitung')}</p>
      {!u.typen.length ? <p className="leise">{tx('volltext.werkbank.umwandlung.keine')}</p> : (
        <table className="tabelle klein">
          <thead><tr><th>{tx('volltext.werkbank.umwandlung.typ')}</th><th className="zahlzelle">{tx('volltext.werkbank.umwandlung.anzahl')}</th><th>{tx('volltext.werkbank.umwandlung.paket')}</th></tr></thead>
          <tbody>{u.typen.map((x) => (
            <tr key={x.mime}>
              <td>{x.name} {x.name !== x.mime && <span className="leise mono">{x.mime}</span>}</td>
              <td className="zahlzelle">{zahl(x.anzahl)}</td>
              <td>{x.paket ? <Link to={`/werkbank/pakete/${x.paket.id}`} className="verweis">{tx('volltext.werkbank.umwandlung.durch', { paket: x.paket.name })}</Link>
                : x.katalog ? <>{tx('volltext.werkbank.umwandlung.katalog', { paket: x.katalog.name })} <Link to={`/werkbank/pakete/${x.katalog.id}`} className="verweis">{tx('volltext.werkbank.umwandlung.installieren')}</Link></>
                : <span className="leise">{tx('volltext.werkbank.umwandlung.keins')}</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {u.typen.some((x) => !x.paket && x.katalog) && <p className="leise klein">{tx('volltext.werkbank.umwandlung.nachholen')}</p>}
    </section>
  );
}

/** Statistik der erkannten Sprachen mit Vorschlägen für fehlende Sprach-Zusatzpakete (#395, #459). */
function ErkannteSprachen({ s }: { s: OcrStatus }) {
  const erkannt = s.erkannteSprachen ?? {};
  const liste = Object.entries(erkannt).sort((a, b) => b[1] - a[1]);
  const da = s.paket?.sprachen;
  const vorschlaege = da ? sprachvorschlaege(erkannt, da) : [];
  return (
    <section className="blatt" id="sprachen">
      <h2 className="h3">Erkannte Sprachen</h2>
      {!liste.length ? <p className="leise">Noch keine – die Sprache steht an jedem Dokument, sobald es einen Volltext hat.</p> : (
        <table className="tabelle klein">
          <thead><tr><th>Sprache</th><th className="zahlzelle">Dokumente</th>{da && <th>{tx('volltext.werkbank.sprachdaten')}</th>}</tr></thead>
          <tbody>{liste.map(([k, n]) => (
            <tr key={k}><td>{sprachname(k)} <span className="leise mono">{k}</span></td><td className="zahlzelle">{zahl(n)}</td>
              {da && <td>{da.includes(k) ? tx('volltext.werkbank.sprachdaten.da') : <span className="fehlertext">{tx('volltext.werkbank.sprachdaten.fehlt')}</span>}</td>}</tr>
          ))}</tbody>
        </table>
      )}
      {vorschlaege.map((v) => (
        <div key={v.sprache} className="hinweis info hinweiszeile">
          <p>{tx('volltext.werkbank.sprachdaten.vorschlag', { anzahl: v.anzahl, sprache: sprachname(v.sprache), paket: v.paket })} <Hilfe ort="werkbank.texterkennung.sprachpakete" /></p>
          <Link to={`/werkbank/pakete/${v.paket}`} className="knopf klein">{tx('volltext.werkbank.sprachdaten.paket')}</Link>
        </div>
      ))}
    </section>
  );
}

/* ---------- Wartungsoperationen ---------- */

export function WartungPanel({ t, wartungAn }: { t: TexterkennungZustand; wartungAn?: boolean }) {
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">Werkbank</p>
        <h1>Wartungsoperationen</h1>
        <p className="leise">Arbeiten am ganzen Bestand, die du bei Bedarf anstößt. Sie laufen im Hintergrund; das DMS bleibt benutzbar. <Hilfe ort="werkbank.wartung" /></p>
      </div>
      <VolltextNeu t={t} wartungAn={wartungAn} />
      <VorschauNachholen />
      <DateienPruefen />
      <NummernNachtragen />
      <AbsenderBereinigen />
      <FormateUnpassend />
    </div>
  );
}

/**
 * „Volltext neu erzeugen“ (#458): für Dokumente ohne Text oder für alle (mit Rückfrage und Anzahl), als Auftrag mit
 * Fortschritt, abbrechbar. Ersetzt „Volltext nachholen“ (das sind die Dokumente ohne Text).
 */
function VolltextNeu({ t, wartungAn }: { t: TexterkennungZustand; wartungAn?: boolean }) {
  const s = t.stand;
  const laden = t.laden;
  const [auftrag, setAuftrag] = useState<HintergrundAuftrag | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  // Läuft schon einer (z. B. nach dem Neuladen der Seite)? Dann seinen Stand zeigen.
  useEffect(() => { void api.auftrag().then((a) => { if (a?.art === 'volltext-neu') setAuftrag(a); }, () => {}); }, []);
  useEffect(() => {
    if (auftrag?.status !== 'laeuft') return;
    const x = setInterval(() => void api.auftrag().then((a) => { setAuftrag(a); if (a?.status !== 'laeuft') void laden(); }), 1000);
    return () => clearInterval(x);
  }, [auftrag?.status, laden]);
  async function starte(umfang: 'ohne' | 'alle') {
    setMeldung(undefined);
    try {
      const { anzahl } = await api.volltextNeuAnzahl(umfang);
      if (!anzahl) { setMeldung({ art: 'gut', text: tx('volltext.neu.nichts') }); return; }
      if (umfang === 'alle' && !(await rueckfrage({ titel: tx('volltext.neu.rueckfrage.titel'), text: tx('volltext.neu.rueckfrage.text', { anzahl }), ja: tx('volltext.neu.rueckfrage.ja') }))) return;
      setAuftrag(await api.volltextNeu(umfang));
    } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
  }
  async function abbrechen() {
    if (!auftrag) return;
    try { setAuftrag(await api.auftragAbbrechen(auftrag.id)); } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
  }
  const e = auftrag?.status === 'fertig' ? auftrag.ergebnis as { dokumente: number; erledigt: number; abgebrochen: boolean } : null;
  const laeuft = auftrag?.status === 'laeuft';
  return (
    <section className="blatt" id="volltext">
      <h2 className="h3">{tx('volltext.neu.titel')} <Hilfe ort="werkbank.wartung.volltext" /></h2>
      <p className="leise">{tx('volltext.neu.text')}</p>
      {s?.paket ? <p className="leise klein">{tx('volltext.neu.dauer')}</p> : s && (
        <div className="hinweis warn hinweiszeile" role="status">
          <p>{tx('volltext.werkbank.paket.fehlt')}</p>
          <Link to={`/werkbank/pakete/${TEXTERKENNUNG_PAKET}`} className="knopf klein">{tx('volltext.werkbank.paket.installieren')}</Link>
        </div>
      )}
      {s && <PauseHinweis t={t} wartungAn={wartungAn} />}
      {s && <Warteschlange s={s} />}
      {laeuft && <p className="leise" role="status">{fortschrittText(auftrag, 'Dokumente')}{auftrag.abgebrochen ? ` · ${tx('volltext.neu.abgebrochen', { erledigt: auftrag.fertig, dokumente: auftrag.gesamt })}` : ''}</p>}
      {e && <p className="gutertext" role="status">{e.abgebrochen ? tx('volltext.neu.abgebrochen', { erledigt: e.erledigt, dokumente: e.dokumente }) : tx('volltext.neu.fertig', { erledigt: e.erledigt, dokumente: e.dokumente })}</p>}
      {auftrag?.status === 'fehler' && <p className="fehlertext">{auftrag.fehler}</p>}
      {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
      <div className="knoepfe">
        <button type="button" className="knopf primaer" disabled={laeuft} onClick={() => void starte('ohne')}>{tx('volltext.neu.ohne')}</button>
        <button type="button" className="knopf" disabled={laeuft} onClick={() => void starte('alle')}>{tx('volltext.neu.alle')}</button>
        {laeuft && <button type="button" className="knopf gefahr-rand" disabled={auftrag.abgebrochen} onClick={() => void abbrechen()}>{auftrag.abgebrochen ? tx('volltext.neu.laeuft') : tx('volltext.neu.abbrechen')}</button>}
      </div>
    </section>
  );
}

/** Aufträge der Texterkennung (#61): je Stand die Dokumente mit Mappe, neu starten, abbrechen. */
const STAENDE_LISTE: OcrStandArt[] = ['fehler', 'wartet', 'laeuft', 'paket', 'ausgelassen', 'fertig'];
type Auftrag = Awaited<ReturnType<typeof api.ocrAuftraege>>['eintraege'][number];

function Auftraege({ t }: { t: TexterkennungZustand }) {
  const s = t.stand!;
  const [stand, setStand] = useState<OcrStandArt>(s.zaehler.fehler ? 'fehler' : s.zaehler.wartet || s.zaehler.laeuft ? 'wartet' : 'fehler');
  const [liste, setListe] = useState<{ gesamt: number; eintraege: Auftrag[] } | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  const zaehlerText = JSON.stringify(s.zaehler);
  const laden = useCallback(async () => {
    try { setListe(await api.ocrAuftraege(stand)); } catch (e) { setMeldung({ art: 'schlecht', text: (e as Error).message }); }
  }, [stand]);
  useEffect(() => { void laden(); setAuswahl(new Set()); }, [laden, zaehlerText]);
  const ids = [...auswahl];
  async function tu(f: () => Promise<string>) {
    setMeldung(undefined);
    try { const text = await f(); setMeldung({ art: 'gut', text }); setAuswahl(new Set()); await t.laden(); await laden(); } catch (e) { setMeldung({ art: 'schlecht', text: (e as Error).message }); }
  }
  const umschalten = (id: string) => setAuswahl((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alle = liste?.eintraege ?? [];
  const abbrechbar = stand === 'wartet' || stand === 'laeuft' || stand === 'paket';
  return (
    <section className="blatt" id="auftraege">
      <div className="blattkopf zeile-zwischen"><h2 className="h3">Aufträge</h2>
        {s.zaehler.fehler > 0 && <button type="button" className="knopf klein" onClick={() => void tu(async () => { const r = await api.ocrFehlerNeu(); return `${zahl(r.eingereiht)} ${r.eingereiht === 1 ? 'Dokument steht' : 'Dokumente stehen'} wieder in der Warteschlange.`; })}>Alle Fehler neu starten</button>}
      </div>
      <div className="registertaben klein" role="tablist" aria-label="Stand">
        {STAENDE_LISTE.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={stand === k} className={`registertab ${stand === k ? 'an' : ''}`} onClick={() => setStand(k)}>
            {OCR_STAENDE[k]} <span className="anzahl">{zahl(s.zaehler[k])}</span>
          </button>
        ))}
      </div>
      {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
      {liste === null ? <p className="leise">Lade …</p> : !alle.length ? <p className="leise">Keine Dokumente in diesem Stand.</p> : (
        <>
          <div className="tabellenrahmen festhoehe">
            <table className="auftraege">
              <thead><tr>
                <th><input type="checkbox" aria-label="Alle wählen" checked={auswahl.size === alle.length} onChange={(e) => setAuswahl(e.target.checked ? new Set(alle.map((a) => a.dokument.id)) : new Set())} /></th>
                <th>Dokument</th><th>Mappe</th><th>Größe</th><th>{stand === 'fertig' ? 'Seiten' : 'Grund / Stand'}</th><th>seit</th>
              </tr></thead>
              <tbody>{alle.map((a) => {
                const o = a.dokument.ocr;
                return (
                  <tr key={a.dokument.id} className={auswahl.has(a.dokument.id) ? 'an' : ''}>
                    <td><input type="checkbox" aria-label={`${a.dokument.name} wählen`} checked={auswahl.has(a.dokument.id)} onChange={() => umschalten(a.dokument.id)} /></td>
                    <td>{a.dokument.name}</td>
                    <td><Link to={`/ablage/${a.typId}/${a.dokument.mappeId}`} className="verweis">{a.mappeTitel || 'Ohne Titel'}</Link></td>
                    <td className="zahlzelle">{groesse(a.dokument.groesse)}</td>
                    <td>{stand === 'fertig' ? (o?.seiten ?? '–') : (o?.info || OCR_STAENDE[o?.stand ?? 'keiner'])}</td>
                    <td className="leise">{o?.zeit ? new Date(o.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {liste.gesamt > alle.length && <p className="leise klein">Gezeigt werden die neuesten {zahl(alle.length)} von {zahl(liste.gesamt)}.</p>}
          <div className="knoepfe">
            {abbrechbar && <button type="button" className="knopf gefahr-rand" disabled={!ids.length} onClick={() => void tu(async () => { const r = await api.ocrAbbrechen(ids); return `${zahl(r.abgebrochen)} abgebrochen.`; })}>{stand === 'laeuft' ? 'Abbrechen' : 'Aus der Warteschlange nehmen'}</button>}
            <button type="button" className="knopf primaer" disabled={!ids.length} onClick={() => void tu(async () => { const r = await api.ocrNeu(ids); return `${zahl(r.eingereiht)} neu gestartet.`; })}>Neu starten{ids.length ? ` (${ids.length})` : ''}</button>
          </div>
        </>
      )}
    </section>
  );
}
const groesse = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

/** Vorschaubilder der ersten Seite für vorhandene Dokumente erzeugen (#332). */
function VorschauNachholen() {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  async function nachholen() {
    setLaeuft(true); setMeldung(undefined);
    try {
      const r = await api.vorschauNachholen();
      setMeldung({ art: 'gut', text: r.eingereiht ? `Für ${zahl(r.eingereiht)} ${r.eingereiht === 1 ? 'Datei entsteht' : 'Dateien entstehen'} jetzt im Hintergrund ein Vorschaubild.` : 'Nichts nachzuholen – alle PDFs und Bilder haben schon ein Vorschaubild.' });
    } catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
    finally { setLaeuft(false); }
  }
  return (
    <section className="blatt" id="vorschau">
      <h2 className="h3">Vorschaubilder nachholen</h2>
      <p className="leise">Neben jedem PDF und Bild zeigt die Ablage ein kleines Bild der ersten Seite. Für neue Dokumente entsteht es gleich nach dem Hochladen, für ältere beim ersten Anzeigen. Das hier erzeugt die fehlenden auf einmal – eins nach dem anderen im Hintergrund.</p>
      {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
      <div className="knoepfe"><button type="button" className="knopf" disabled={laeuft} onClick={() => void nachholen()}>{laeuft ? 'Stelle ein …' : 'Vorschaubilder nachholen'}</button></div>
    </section>
  );
}
