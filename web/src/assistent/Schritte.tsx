import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BUNDESLAENDER } from '../../../shared/src/feiertage';
import { handbuchUrl, HILFE, hilfeOnlineUrl, type Hilfeort } from '../../../shared/src/hilfe';
import { PASSWORT_MINDESTLAENGE } from '../../../shared/src/model';
import type { Sammelschritt } from '../../../shared/src/einrichtungsplan';
import { api } from '../api';
import { Marke } from '../Marke';
import { geheZu } from '../ort';
import { rueckfrage } from '../rueckfrage';
import { t } from '../sprache';
import { Symbol } from '../Symbol';
import { PaketApiKontext, type PaketApi, type PaketWahl } from '../werkbank/PaketAblauf';
import { PaketeDazuholen } from '../werkbank/PaketeDazuholen';
import { MailSammeln, type MailGriff } from '../werkbank/MailVersand';
import { ausfuehren, neuerLauf, STUFEN_JE_SCHRITT, stufenZuruecksetzen } from './ausfuehren';
import { ladeDatei, merkeDatei, pruefeAlles, speichereDatei } from './datei';
import { geheim, holeStand, planAus, setzeSammlung, setzeStand, STUFEN, useAssistent, vergiss, type Ansicht, type MailSammlung, type Sammlung, type Stufe } from './stand';

/**
 * Einrichtungsassistent (#119, #804): erst sammeln, dann eine Zusammenfassung, dann „Jetzt einrichten“.
 *
 *   1 Code · 2 Datenbank · 3 Neu oder Sicherung       – sofort, weil technisch nötig
 *   4 Ablage · 5 Administrator · 6 Erster Benutzer · 7 Pakete · 8 Optionales  – nur gesammelt, jederzeit änderbar
 *   9 Zusammenfassung → „Jetzt einrichten“ (mit Fortschritt) · 10 Fertig: Notfallblatt herunterladen, abschließen
 *
 * Im Assistenten gibt es keine einzelnen Speichern-Knöpfe (#803): „Weiter“ übernimmt alles, was im Schritt sichtbar
 * steht – auch Vorschläge, die man nicht geändert hat. Die Knöpfe stehen in jedem Schritt unten an derselben Stelle.
 */
export const SCHRITTE = [
  t('einrichtung.schritt.code'), t('einrichtung.schritt.datenbank'), t('einrichtung.schritt.wahl'), t('einrichtung.schritt.ablage'),
  t('einrichtung.schritt.administrator'), t('einrichtung.schritt.benutzer'), t('einrichtung.schritt.pakete'), t('einrichtung.schritt.optional'),
  t('einrichtung.schritt.zusammenfassung'), t('einrichtung.schritt.fertig'),
] as const;
export const NR: Record<Ansicht | 'fertig', number> = { ablage: 3, administrator: 4, benutzer: 5, pakete: 6, optional: 7, zusammenfassung: 8, fertig: 9 };
const REIHE: Ansicht[] = ['ablage', 'administrator', 'benutzer', 'pakete', 'optional', 'zusammenfassung'];
const REPO = 'https://github.com/motom001/dms';

/** Hilfe je Schritt (#278): der passende Abschnitt im Online-Handbuch, mit Bildern. */
const HILFE_JE_SCHRITT: Hilfeort[] = ['einrichtung.code', 'einrichtung.datenbank', 'einrichtung.wahl', 'einrichtung.mandant', 'einrichtung.administrator', 'einrichtung.benutzer', 'einrichtung.pakete', 'einrichtung.optional', 'einrichtung.zusammenfassung', 'einrichtung.fertig'];

/** Schrittleiste: welche Schritte anklickbar sind, welche gesperrt (mit Grund). */
export interface Leiste { erledigt(i: number): boolean; klick?(i: number): (() => void) | null; gesperrt?(i: number): string | null }

function Fortschritt({ aktiv, leiste }: { aktiv: number; leiste?: Leiste }) {
  const [grund, setGrund] = useState<string | null>(null);
  const erledigt = (i: number) => i !== aktiv && (leiste ? leiste.erledigt(i) : i < aktiv);
  return (
    <>
      <ol className="assistent-schritte" aria-label={t('einrichtung.leiste', { nr: aktiv + 1, von: SCHRITTE.length, name: SCHRITTE[aktiv] })}>
        {SCHRITTE.map((s, i) => {
          const inhalt = <><span className="nr" aria-hidden="true">{erledigt(i) ? <Symbol name="haken" /> : i + 1}</span><span className="name">{s}</span></>;
          const gehe = i !== aktiv ? leiste?.klick?.(i) ?? null : null;
          const sperre = !gehe && i !== aktiv ? leiste?.gesperrt?.(i) ?? null : null;
          const klick = gehe ? () => { setGrund(null); gehe(); } : sperre ? () => setGrund(sperre) : null;
          return (
            <li key={s} className={erledigt(i) ? 'erledigt' : i === aktiv ? 'aktiv' : ''} aria-current={i === aktiv ? 'step' : undefined}>
              {klick ? <button type="button" className="textknopf" onClick={klick} title={gehe ? t('einrichtung.leiste.zu', { name: s }) : t('einrichtung.leiste.gesperrt', { name: s })}>{inhalt}</button> : inhalt}
            </li>
          );
        })}
      </ol>
      {grund && <div className="hinweis info klein" role="status"><p><Symbol name="schloss" /> {grund}</p></div>}
    </>
  );
}

function SchrittHilfe({ aktiv }: { aktiv: number }) {
  const z = HILFE[HILFE_JE_SCHRITT[aktiv]];
  return (
    <a className="assistent-hilfe" href={hilfeOnlineUrl(z)} target="_blank" rel="noreferrer" title={`Hilfe zu „${z.titel}“ im Administratorhandbuch`} aria-label="Hilfe zu diesem Schritt im Handbuch, mit Bildern (öffnet in neuem Tab)">
      <span className="hilfesymbol" aria-hidden="true">?</span> Hilfe mit Bildern
    </a>
  );
}

/**
 * „Aus Konfigurationsdatei laden“ (#806), klein oben rechts. Auf dem Schritt „Einrichtungscode“ prüft Ablago die Datei
 * erst nach dem Code – ohne Code nimmt der Server nichts an.
 */
function DateiLaden({ ohneCode, imEinrichtungsmodus }: { ohneCode?: boolean; imEinrichtungsmodus?: boolean }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<string>();
  const st = useAssistent();
  async function gewaehlt(f: File | undefined) {
    if (!f) return;
    setMeldung(undefined);
    if (f.size > 64 * 1024) { setMeldung(t('einrichtung.datei.zugross')); return; }
    const text = await f.text();
    if (ohneCode) { merkeDatei(text); setMeldung(t('einrichtung.datei.nachcode', { name: f.name })); return; }
    if (st.sammlung.besucht.length && !(await rueckfrage({ titel: t('einrichtung.datei.ersetzen.titel'), text: t('einrichtung.datei.ersetzen.text'), ja: t('einrichtung.datei.ersetzen.ja') }))) return;
    try { await ladeDatei(text, !!imEinrichtungsmodus); } catch (e) { setMeldung((e as Error).message); }
  }
  return (
    <span className="assistent-datei">
      <button type="button" className="textknopf klein" onClick={() => eingabe.current?.click()} title={t('einrichtung.datei.laden.titel')}>{t('einrichtung.datei.laden')}</button>
      <input ref={eingabe} type="file" accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml" hidden onChange={(e) => { void gewaehlt(e.target.files?.[0]); e.target.value = ''; }} />
      {meldung && <span className="leise klein" role="status">{meldung}</span>}
    </span>
  );
}

export function Rahmen({ aktiv, titel, unter, children, leiste, datei }: {
  aktiv: number; titel: string; unter?: ReactNode; children: ReactNode; leiste?: Leiste;
  /** „Aus Konfigurationsdatei laden“ zeigen (#806). */
  datei?: { ohneCode?: boolean; imEinrichtungsmodus?: boolean };
}) {
  const st = useAssistent();
  return (
    <div className="kartenseite">
      <div className="karte breit assistent">
        <div className="marke gross"><Marke logo={null} schriftzug="Ablago" gross /></div>
        <div className="assistent-kopf">
          <p className="ueber">Einrichtung · Schritt {aktiv + 1} von {SCHRITTE.length}</p>
          <span className="assistent-kopf-rechts">{datei && <DateiLaden {...datei} />}<SchrittHilfe aktiv={aktiv} /></span>
        </div>
        <Fortschritt aktiv={aktiv} leiste={leiste} />
        {datei && st.dateiFehler.length > 0 && (
          <div className="hinweis schlecht stapel" role="alert">
            <p><strong>{t('einrichtung.datei.fehler.titel')}</strong></p>
            <ul>{st.dateiFehler.map((f, i) => <li key={i}>{f.zeile ? t('einrichtung.datei.fehler.zeile', { zeile: f.zeile, feld: f.feld }) : f.feld}: {f.text}</li>)}</ul>
            <div className="knoepfe"><button type="button" className="knopf klein" onClick={() => setzeStand((x) => ({ ...x, dateiFehler: [] }))}>{t('einrichtung.datei.fehler.schliessen')}</button></div>
          </div>
        )}
        <h1>{titel}</h1>
        {unter && <p className="leise">{unter}</p>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Sammeln ---------- */

/** Schrittleiste beim Sammeln: Code und Datenbank sind erledigt, alles ab „Neu oder Sicherung“ jederzeit anklickbar. */
function sammelLeiste(s: Sammlung, zurWahl: () => void): Leiste {
  return {
    erledigt: (i) => i < 3 || REIHE.some((a) => NR[a] === i && s.besucht.includes(a)),
    klick: (i) => (i === 2 ? zurWahl : i >= 3 && i <= 8 ? () => setzeSammlung((x) => ({ ...x, ansicht: REIHE[i - 3] })) : null),
    gesperrt: (i) => (i === 0 ? t('einrichtung.gesperrt.code') : i === 1 ? t('einrichtung.gesperrt.datenbank') : i === 9 ? t('einrichtung.gesperrt.fertig') : null),
  };
}

/** Nach „Weiter“: nächster Schritt – nach „Ändern“ oder dem Laden der nächste, der nicht passt, sonst die Zusammenfassung. */
function weiterVon(von: Ansicht) {
  const st = holeStand();
  if (st.aendern) {
    // Ändern während „Jetzt einrichten“ (nach einem Fehler): zurück zum Fortschritt, betroffene Stufen erneut.
    if (von !== 'zusammenfassung') stufenZuruecksetzen([...STUFEN_JE_SCHRITT[von]]);
    setzeStand((x) => ({ ...x, aendern: null, sammlung: { ...x.sammlung, besucht: [...new Set([...x.sammlung.besucht, von])], probleme: { ...x.sammlung.probleme, [von]: undefined } } }));
    void ausfuehren();
    return;
  }
  setzeSammlung((s) => {
    const probleme = { ...s.probleme, [von]: undefined };
    const besucht = [...new Set([...s.besucht, von])];
    const naechster = s.zurZusammenfassung
      ? (REIHE.find((a) => a !== von && a !== 'zusammenfassung' && (probleme[a as Sammelschritt]?.length || !besucht.includes(a))) ?? 'zusammenfassung')
      : REIHE[REIHE.indexOf(von) + 1] ?? 'zusammenfassung';
    return { ...s, probleme, besucht, ansicht: naechster };
  });
}

function zurueckVon(von: Ansicht, zurWahl: () => void) {
  if (holeStand().aendern) { setzeStand((x) => ({ ...x, aendern: null })); return; }
  const i = REIHE.indexOf(von);
  if (i <= 0) zurWahl(); else setzeSammlung((s) => ({ ...s, ansicht: REIHE[i - 1] }));
}

/** Navigation am Ende jedes Schritts – überall gleich: links „Zurück“, rechts „Weiter“. */
function Navigation({ zurueck, weiter, weiterText, sendet, fehler, kannWeiter = true }: { zurueck?: () => void; weiter: () => void; weiterText?: string; sendet?: boolean; fehler?: string; kannWeiter?: boolean }) {
  const aendern = !!holeStand().aendern;
  return (
    <>
      {fehler && <p className="fehlertext" role="alert">{fehler}</p>}
      <div className="knoepfe">
        {zurueck && <button type="button" className="knopf" onClick={zurueck}><Symbol name="pfeil-links" /> {aendern ? t('einrichtung.zurueck.lauf') : t('einrichtung.zurueck')}</button>}
        <button type="submit" className="knopf primaer" disabled={sendet || !kannWeiter} onClick={(e) => { e.preventDefault(); weiter(); }}>{sendet ? t('einrichtung.pruefe') : weiterText ?? (aendern ? t('einrichtung.uebernehmen.lauf') : t('einrichtung.weiter'))}</button>
      </div>
    </>
  );
}

/** Gründe aus der Prüfung bzw. der Datei, oben im Schritt. */
function Probleme({ liste }: { liste?: string[] }) {
  if (!liste?.length) return null;
  return <div className="hinweis warn" role="status"><p><strong>{t('einrichtung.probleme')}</strong></p><ul>{liste.map((p) => <li key={p}>{p}</li>)}</ul></div>;
}

function useSenden() {
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string>();
  const los = async (f: () => Promise<void>) => {
    setSendet(true); setFehler(undefined);
    try { await f(); } catch (e) { setFehler((e as Error).message); } finally { setSendet(false); }
  };
  return { sendet, fehler, setFehler, los };
}

/** Prüft einen Schritt auf dem Server (ohne etwas anzulegen): die Gründe, leer = passt. */
async function pruefeSchritt(s: Sammelschritt, passwort?: string): Promise<string[]> {
  const { probleme } = await api.einrichtungPruefen(planAus(holeStand().sammlung), passwort);
  return probleme[s] ?? [];
}

function AblageSchritt({ s, zurWahl, leiste, datei }: { s: Sammlung; zurWahl: () => void; leiste: Leiste; datei?: { imEinrichtungsmodus?: boolean } }) {
  const [name, setName] = useState(s.ablage);
  return (
    <Rahmen aktiv={NR.ablage} titel="Willkommen" unter="Wie heißt dein Ablago? Meist der Name der Familie oder der Firma." leiste={leiste} datei={datei}>
      <form className="stapel" onSubmit={(e) => e.preventDefault()}>
        {s.hinweise.length > 0 && <div className="hinweis info"><ul>{s.hinweise.map((h) => <li key={h}>{h}</li>)}</ul></div>}
        <Probleme liste={s.probleme.ablage} />
        <label className="eigenschaft"><span>Name deiner Ablage <small>z. B. „Familie Mustermann“ oder „Büro Mustermann“</small></span>
          <input value={name} onChange={(x) => setName(x.target.value)} maxLength={30} autoFocus required /></label>
        <p className="leise klein">Er erscheint als Schriftzug in der Kopfzeile, im Browser-Tab und auf der Anmeldeseite. Ändern lässt er sich jederzeit unter Werkbank → Designs → Logo und Schriftzug.</p>
        <Navigation zurueck={() => { setzeSammlung((x) => ({ ...x, ablage: name })); zurueckVon('ablage', zurWahl); }} kannWeiter={!!name.trim()}
          weiter={() => { setzeSammlung((x) => ({ ...x, ablage: name.replace(/\s+/g, ' ').trim() })); weiterVon('ablage'); }} />
      </form>
    </Rahmen>
  );
}

function AdminSchritt({ s, zurWahl, leiste }: { s: Sammlung; zurWahl: () => void; leiste: Leiste }) {
  const [name, setName] = useState(s.administrator.name);
  const [email, setEmail] = useState(s.administrator.email);
  const [pw, setPw] = useState(geheim.administrator);
  const [pw2, setPw2] = useState(geheim.administrator);
  const [probleme, setProbleme] = useState<string[] | undefined>(s.probleme.administrator);
  const x = useSenden();
  const merke = () => setzeSammlung((a) => ({ ...a, administrator: { name: name.trim(), email: email.trim() } }));
  return (
    <Rahmen aktiv={NR.administrator} titel="Administrator" leiste={leiste} unter={<>Der Administrator richtet Ablago ein – Mappentypen, Benutzer, Sicherung. <strong>In der Ablage arbeitet er nicht</strong>; dafür legst du im nächsten Schritt einen normalen Benutzer an, z. B. dich selbst mit einer zweiten Adresse.</>}>
      <form className="stapel" onSubmit={(e) => e.preventDefault()}>
        <Probleme liste={probleme} />
        {s.verweise.administrator && <p className="leise klein">{t('einrichtung.administrator.verweis', { verweis: s.verweise.administrator })}</p>}
        <label className="eigenschaft"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="z. B. Admin" autoFocus /></label>
        <label className="eigenschaft"><span>E-Mail-Adresse <small>damit meldest du dich als Administrator an</small></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="eigenschaft"><span>Passwort <small>mindestens {PASSWORT_MINDESTLAENGE} Zeichen</small></span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required /></label>
        <label className="eigenschaft"><span>Passwort wiederholen</span><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></label>
        <p className="leise klein">{t('einrichtung.administrator.erst')}</p>
        <Navigation sendet={x.sendet} fehler={x.fehler} zurueck={() => { merke(); zurueckVon('administrator', zurWahl); }}
          weiter={() => void x.los(async () => {
            if (pw !== pw2) throw new Error('Die beiden Passwörter stimmen nicht überein.');
            merke();
            const p = await pruefeSchritt('administrator', pw);
            setProbleme(p);
            if (p.length) return;
            geheim.administrator = pw;
            weiterVon('administrator');
          })} />
      </form>
    </Rahmen>
  );
}

function BenutzerSchritt({ s, zurWahl, leiste }: { s: Sammlung; zurWahl: () => void; leiste: Leiste }) {
  const [b, setB] = useState(s.benutzer);
  const [probleme, setProbleme] = useState<string[] | undefined>(s.probleme.benutzer);
  const x = useSenden();
  const name = b.name.trim() || b.email.trim();
  const merke = () => setzeSammlung((a) => ({ ...a, benutzer: b }));
  return (
    <Rahmen aktiv={NR.benutzer} titel="Erster Benutzer" leiste={leiste} unter="Mit diesem Konto arbeitest du in der Ablage. Der Administrator bleibt für die Werkbank – so trennt Ablago Einrichten und Arbeiten.">
      <form className="stapel" onSubmit={(e) => e.preventDefault()}>
        <Probleme liste={probleme} />
        <label className="eigenschaft"><span>Name</span><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} autoComplete="off" autoFocus /></label>
        <label className="eigenschaft"><span>E-Mail-Adresse <small>eine andere als die des Administrators</small></span><input type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} autoComplete="off" /></label>
        {b.email.trim() && (
          <label className="haken"><input type="checkbox" checked={b.aufgabenOhneEmpfaenger} onChange={(e) => setB({ ...b, aufgabenOhneEmpfaenger: e.target.checked })} />
            <span>{t('werkbank.aufgabenempfaenger.assistent.haken', { name })}<small className="hilfe">{t('werkbank.aufgabenempfaenger.assistent.hilfe', { name })}</small></span></label>
        )}
        <p className="leise klein">{t('einrichtung.benutzer.leer')}</p>
        <Navigation sendet={x.sendet} fehler={x.fehler} zurueck={() => { merke(); zurueckVon('benutzer', zurWahl); }}
          weiter={() => void x.los(async () => {
            merke();
            const p = b.email.trim() || b.name.trim() ? await pruefeSchritt('benutzer') : [];
            setProbleme(p);
            if (!p.length) weiterVon('benutzer');
          })} />
      </form>
    </Rahmen>
  );
}

/** Im Assistenten wählt man Pakete über die Schnittstellen mit Einrichtungscode – installiert wird noch nichts. */
const EINRICHTUNG_PAKETE: PaketApi = { stand: () => api.einrichtungPakete(), katalog: () => api.einrichtungPaketKatalog(), plan: (e) => api.einrichtungPaketPlan(e) };

function PaketeSchritt({ s, zurWahl, leiste }: { s: Sammlung; zurWahl: () => void; leiste: Leiste }) {
  // Vorbelegt beim „Ändern“ bzw. aus der Datei (#806): Auswahl, Beispiele, ausgeschaltete Automatisierungen.
  const quelle = s.pakete ? s.pakete.pakete.map((p) => ({ id: p.id, beispiele: p.beispiele, automatisierungen: p.automatisierungen, gewaehlt: p.gewaehlt })) : s.paketeVorgabe?.map((p) => ({ ...p, gewaehlt: true })) ?? null;
  const start = quelle?.filter((p) => p.gewaehlt).map((p) => p.id);
  const vorgabe = quelle ? { beispiele: quelle.filter((p) => p.beispiele).map((p) => p.id), automatisierungenAus: quelle.flatMap((p) => Object.entries(p.automatisierungen).filter(([, an]) => !an).map(([k]) => `${p.id}|${k}`)) } : undefined;
  const gesammelt = (w: PaketWahl | null) => {
    geheim.paketEinstellungen = w?.eingabe.einstellungen;
    setzeSammlung((x) => ({ ...x, pakete: w, paketeVorgabe: null }));
    weiterVon('pakete');
  };
  return (
    <Rahmen aktiv={NR.pakete} titel="Pakete dazuholen" leiste={leiste} unter="Pakete bringen fertige Mappentypen, Ansichten und Funktionen wie die Texterkennung mit. Wähle, was du gleich brauchst – alles andere holst du später unter Werkbank → Pakete.">
      <Probleme liste={s.probleme.pakete} />
      <p className="leise klein">{t('einrichtung.pakete.erst')}</p>
      <PaketApiKontext.Provider value={EINRICHTUNG_PAKETE}>
        <PaketeDazuholen key={JSON.stringify(start ?? null)} start={start} vorgabe={vorgabe} sammeln={gesammelt} zurueck={() => zurueckVon('pakete', zurWahl)}
          ueberspringen={() => gesammelt(null)} weiter={() => {}} />
      </PaketApiKontext.Provider>
    </Rahmen>
  );
}

const neueMail = (): MailSammlung => ({ aktiv: true, host: '', port: 587, verbindung: 'starttls', benutzer: '', absender: '', selbstsigniert: false, mitPasswort: false });

function OptionalSchritt({ s, zurWahl, leiste }: { s: Sammlung; zurWahl: () => void; leiste: Leiste }) {
  const [o, setO] = useState(s.optional);
  const [probleme, setProbleme] = useState<string[] | undefined>(s.probleme.optional);
  const x = useSenden();
  // E-Mail-Versand mit demselben Formular wie in der Werkbank (#813); es sammelt nur, gespeichert wird bei „Jetzt einrichten“.
  const mail = useRef<MailGriff | null>(null);
  const vorschlag = typeof location !== 'undefined' ? location.origin : '';
  const mitTypen = (s.pakete?.neueTypen ?? 0) > 0;
  const m = o.mail;
  const merke = () => {
    // Passwort nur im Speicher (geheim), im Sammelstand (sessionStorage) steht nur, ob eines eingegeben ist.
    const g = m ? mail.current?.sammle() : undefined;
    const { passwort, ...angaben } = g ?? { passwort: geheim.mail };
    geheim.mail = m ? passwort : '';
    setzeSammlung((a) => ({ ...a, optional: { ...o, beispiele: o.beispiele && !mitTypen, mail: m ? { ...m, ...angaben, mitPasswort: !!passwort } : null } }));
  };
  return (
    <Rahmen aktiv={NR.optional} titel="Optionales" leiste={leiste} unter={t('einrichtung.optional.unter')}>
      <form className="stapel" onSubmit={(e) => e.preventDefault()}>
        <Probleme liste={probleme} />
        <section className="blatt">
          <h2 className="h3">Adresse von Ablago</h2>
          <p className="leise klein">Unter dieser Adresse öffnen die Benutzer Ablago; sie steht in den Links der E-Mails.</p>
          <label className="eigenschaft"><span>{t('einrichtung.optional.adresse')} {o.adresse && o.adresse === vorschlag && <small className="chip">{t('einrichtung.vorgeschlagen')}</small>}</span>
            <input value={o.adresse} onChange={(e) => setO({ ...o, adresse: e.target.value })} inputMode="url" autoComplete="off" placeholder="z. B. http://nas.home.arpa:8080" /></label>
          <p className="leise klein">{o.adresse ? t('einrichtung.optional.adresse.hinweis') : t('einrichtung.optional.adresse.leer')}</p>
        </section>
        <section className="blatt">
          <h2 className="h3">{t('einrichtung.optional.region')}</h2>
          <p className="leise klein">{t('einrichtung.optional.region.text')}</p>
          <label className="eigenschaft"><span>{t('einrichtung.optional.bundesland')}</span>
            <select value={o.bundesland} onChange={(e) => setO({ ...o, bundesland: e.target.value })}>
              <option value="">{t('einrichtung.optional.bundesland.keins')}</option>
              {Object.entries(BUNDESLAENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
        </section>
        <section className="blatt">
          <h2 className="h3">Beispiele</h2>
          <p className="leise klein">Ein paar fertige Mappentypen (z. B. Verträge, Rechnungen) als Ausgangspunkt. Sie lassen sich anpassen oder löschen.</p>
          <label className="haken"><input type="checkbox" checked={o.beispiele && !mitTypen} disabled={mitTypen} onChange={(e) => setO({ ...o, beispiele: e.target.checked })} />
            <span>{t('einrichtung.optional.beispiele')}{mitTypen && <small className="hilfe">{t('einrichtung.optional.beispiele.pakete')}</small>}</span></label>
        </section>
        <section className="blatt" id="mail">
          <h2 className="h3">{t('einrichtung.optional.mail')}</h2>
          <p className="leise klein">{t('einrichtung.optional.mail.text')}</p>
          <label className="haken"><input type="checkbox" checked={!!m} onChange={(e) => setO({ ...o, mail: e.target.checked ? neueMail() : null })} /><span>{t('einrichtung.optional.mail.an')}</span></label>
          {m && <>
            <MailSammeln wert={m} passwort={geheim.mail} email={s.administrator.email.trim()} ablage={s.ablage} griff={mail} />
            <p className="leise klein">{s.verweise.mail ? t('einrichtung.optional.mail.verweis', { verweis: s.verweise.mail }) : t('einrichtung.optional.mail.passwort')}</p>
            <p className="leise klein">{t('einrichtung.optional.mail.testen')}</p>
          </>}
        </section>
        <Navigation sendet={x.sendet} fehler={x.fehler} zurueck={() => { merke(); zurueckVon('optional', zurWahl); }}
          weiter={() => void x.los(async () => {
            merke();
            const p = await pruefeSchritt('optional');
            setProbleme(p);
            if (!p.length) weiterVon('optional');
          })} />
      </form>
    </Rahmen>
  );
}

/* ---------- Zusammenfassung ---------- */

function Abschnitt({ titel, ziel, probleme, children }: { titel: string; ziel: Ansicht; probleme?: string[]; children: ReactNode }) {
  return (
    <section className={`blatt zf-abschnitt${probleme?.length ? ' mitfehler' : ''}`} aria-label={titel}>
      <div className="zf-kopf">
        <h2 className="h3">{titel}</h2>
        <button type="button" className="textknopf" onClick={() => setzeSammlung((s) => ({ ...s, ansicht: ziel, zurZusammenfassung: true }))}>{t('einrichtung.zf.aendern')}<span className="sr-only"> – {titel}</span></button>
      </div>
      <div className="zf-inhalt">{children}</div>
      {probleme?.length ? <ul className="fehlertext klein">{probleme.map((p) => <li key={p}>{p}</li>)}</ul> : null}
    </section>
  );
}

function Zusammenfassung({ s, zurWahl, leiste }: { s: Sammlung; zurWahl: () => void; leiste: Leiste }) {
  const x = useSenden();
  const [gespeichert, setGespeichert] = useState(false);
  const p = s.probleme;
  const offen = REIHE.filter((a) => a !== 'zusammenfassung' && !s.besucht.includes(a));
  const benutzer = s.benutzer.email.trim() ? s.benutzer : null;
  const autoAn = s.pakete?.pakete.reduce((n, q) => n + Object.values(q.automatisierungen).filter(Boolean).length, 0) ?? 0;
  const m = s.optional.mail;
  const keineProbleme = !Object.values(p).some((l) => l?.length) && !offen.length;
  return (
    <Rahmen aktiv={NR.zusammenfassung} titel={t('einrichtung.zf.titel')} unter={t('einrichtung.zf.unter')} leiste={leiste}>
      {offen.length > 0 && <div className="hinweis info"><p>{t('einrichtung.zf.offen', { schritte: offen.map((a) => SCHRITTE[NR[a]]).join(', ') })}</p></div>}
      <div className="stapel">
        <Abschnitt titel={t('einrichtung.zf.ablage')} ziel="ablage" probleme={p.ablage}><p>{s.ablage || <span className="leise">{t('einrichtung.zf.fehlt')}</span>}</p></Abschnitt>
        <Abschnitt titel={t('einrichtung.zf.administrator')} ziel="administrator" probleme={p.administrator}>
          <p>{[s.administrator.name, s.administrator.email].filter(Boolean).join(' · ') || <span className="leise">{t('einrichtung.zf.fehlt')}</span>}</p>
          <p className="leise klein">{geheim.administrator ? t('einrichtung.zf.passwort.gesetzt') : t('einrichtung.zf.passwort.fehlt')}</p>
        </Abschnitt>
        <Abschnitt titel={t('einrichtung.zf.benutzer')} ziel="benutzer" probleme={p.benutzer}>
          {benutzer ? <><p>{[benutzer.name, benutzer.email].filter(Boolean).join(' · ')}</p>
            <p className="leise klein">{benutzer.aufgabenOhneEmpfaenger ? t('einrichtung.zf.benutzer.aufgaben') : t('einrichtung.zf.benutzer.ohne')}</p></>
            : <p className="leise">{t('einrichtung.zf.benutzer.keiner')}</p>}
        </Abschnitt>
        <Abschnitt titel={t('einrichtung.zf.pakete')} ziel="pakete" probleme={p.pakete}>
          {s.pakete?.pakete.length ? <p>{s.pakete.pakete.map((q) => q.name).join(', ')}{autoAn ? ` (${t('einrichtung.zf.pakete.automatisierungen', { anzahl: autoAn })})` : ''}</p>
            : s.paketeVorgabe?.length ? <p>{s.paketeVorgabe.map((q) => q.id).join(', ')} <span className="leise">– {t('einrichtung.zf.pakete.vorgabe')}</span></p>
              : <p className="leise">{t('einrichtung.zf.pakete.keine')}</p>}
        </Abschnitt>
        <Abschnitt titel={t('einrichtung.zf.optional')} ziel="optional" probleme={p.optional}>
          <dl className="eigenschaften klein">
            <dt>{t('einrichtung.optional.adresse')}</dt><dd>{s.optional.adresse.trim() || <span className="leise">{t('einrichtung.zf.adresse.keine')}</span>}</dd>
            <dt>{t('einrichtung.optional.bundesland')}</dt><dd>{s.optional.bundesland ? BUNDESLAENDER[s.optional.bundesland as keyof typeof BUNDESLAENDER] : <span className="leise">{t('einrichtung.optional.bundesland.keins')}</span>}</dd>
            <dt>Beispiele</dt><dd>{s.optional.beispiele ? t('einrichtung.zf.ja') : t('einrichtung.zf.nein')}</dd>
            <dt>{t('einrichtung.optional.mail')}</dt><dd>{m ? `${m.host}:${m.port}${m.benutzer ? ` · ${m.benutzer}` : ''} · ${m.mitPasswort && geheim.mail ? t('einrichtung.zf.passwort.gesetzt') : t('einrichtung.zf.mail.ohne')}${m.aktiv ? '' : ` · ${t('einrichtung.zf.mail.aus')}`}` : <span className="leise">{t('einrichtung.zf.mail.keine')}</span>}</dd>
          </dl>
        </Abschnitt>
        <div className="hinweis info"><p>{t('einrichtung.zf.schluessel')}</p></div>
      </div>
      <section className="blatt stapel" aria-label={t('einrichtung.zf.datei')}>
        <h2 className="h3">{t('einrichtung.zf.datei')}</h2>
        <p className="leise klein">{t('einrichtung.zf.datei.text')}</p>
        <div><button type="button" className="knopf" onClick={() => void x.los(async () => { await speichereDatei(); setGespeichert(true); })}>{t('einrichtung.zf.datei.knopf')}</button></div>
        {gespeichert && <p className="gutertext klein" role="status">{t('einrichtung.zf.datei.fertig')}</p>}
      </section>
      <Navigation sendet={x.sendet} fehler={x.fehler} zurueck={() => zurueckVon('zusammenfassung', zurWahl)} weiterText={t('einrichtung.zf.los')}
        kannWeiter={!offen.length}
        weiter={() => void x.los(async () => {
          const probleme = await pruefeAlles();
          if (Object.values(probleme).some((l) => l?.length)) return;
          setzeStand((a) => ({ ...a, lauf: neuerLauf() }));
          void ausfuehren();
        })} />
      {!keineProbleme && !offen.length && <p className="leise klein">{t('einrichtung.zf.erst')}</p>}
    </Rahmen>
  );
}

/* ---------- Jetzt einrichten: Fortschritt ---------- */

const STUFE_TEXT: Record<Stufe, string> = {
  ablage: 'einrichtung.lauf.ablage', schluessel: 'einrichtung.lauf.schluessel', adresse: 'einrichtung.lauf.adresse', region: 'einrichtung.lauf.region',
  mail: 'einrichtung.lauf.mail', benutzer: 'einrichtung.lauf.benutzer', beispiele: 'einrichtung.lauf.beispiele', pakete: 'einrichtung.lauf.pakete',
};
/** Welcher Schritt eine Stufe ändert (nach einem Fehler). */
const SCHRITT_JE_STUFE: Partial<Record<Stufe, Ansicht>> = { ablage: 'administrator', adresse: 'optional', region: 'optional', mail: 'optional', benutzer: 'benutzer', beispiele: 'optional', pakete: 'pakete' };

function LaufAnsicht() {
  const st = useAssistent();
  const l = st.lauf!;
  const fehler = STUFEN.find((s) => l.stufen[s].zustand === 'fehler');
  const anzahl = st.sammlung.pakete?.eingabe.pakete?.length ?? 0;
  const ablageFertig = l.stufen.ablage.zustand === 'fertig';
  const leiste: Leiste = { erledigt: (i) => i < NR.zusammenfassung, gesperrt: () => t('einrichtung.gesperrt.lauf') };
  return (
    <Rahmen aktiv={NR.zusammenfassung} titel={fehler ? t('einrichtung.lauf.titel.fehler') : t('einrichtung.lauf.titel')} unter={fehler ? t('einrichtung.lauf.unter.fehler') : t('einrichtung.lauf.unter')} leiste={leiste}>
      <ol className="lauf-liste" aria-live="polite">
        {STUFEN.filter((s) => l.stufen[s].zustand !== 'ausgelassen').map((s) => {
          const x = l.stufen[s];
          const text = t(STUFE_TEXT[s] as 'einrichtung.lauf.ablage', { ablage: st.sammlung.ablage, anzahl });
          const ziel = SCHRITT_JE_STUFE[s];
          return (
            <li key={s} className={`lauf-${x.zustand}`} aria-busy={x.zustand === 'laeuft' || undefined}>
              <span className="lauf-zeichen" aria-hidden="true">{x.zustand === 'fertig' ? <Symbol name="haken" /> : x.zustand === 'fehler' ? <Symbol name="warnung" /> : x.zustand === 'laeuft' ? '…' : '·'}</span>
              <span className="lauf-text">
                <span>{text}{x.zustand === 'laeuft' ? ' …' : ''}<span className="sr-only"> – {t(`einrichtung.lauf.zustand.${x.zustand}`)}</span></span>
                {x.meldung && <span className={x.zustand === 'fehler' ? 'fehlertext klein' : 'leise klein'}>{x.meldung}</span>}
                {x.zustand === 'fehler' && (
                  <span className="knoepfe">
                    {ziel && <button type="button" className="knopf klein" onClick={() => setzeStand((a) => (
                      // Vor dem Anlegen der Ablage ist noch nichts passiert: zurück zum Sammeln.
                      ablageFertig ? { ...a, aendern: ziel, sammlung: { ...a.sammlung, ansicht: ziel } } : { ...a, lauf: null, sammlung: { ...a.sammlung, ansicht: ziel, zurZusammenfassung: true } }))}>{t('einrichtung.zf.aendern')}</button>}
                    <button type="button" className="knopf klein primaer" disabled={l.laeuft} onClick={() => void ausfuehren()}>{t('einrichtung.lauf.nochmal')}</button>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {fehler && <p className="leise klein">{t('einrichtung.lauf.rest')}</p>}
    </Rahmen>
  );
}

/* ---------- Fertig: Notfallblatt ---------- */

function Abschluss({ abschliessen, version }: { abschliessen: () => Promise<void>; version: string | null }) {
  const st = useAssistent();
  const l = st.lauf!;
  const [fingerabdruck, setFingerabdruck] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const x = useSenden();
  useEffect(() => { void api.tresor().then((s) => { setFingerabdruck(s.fingerabdruck); if (s.notfallblatt?.aktuell) setGeladen(true); }, () => {}); }, []);
  // Der Server merkt sich das Herunterladen; erst dann gilt es (auch nach Neuladen).
  async function heruntergeladen() {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { if ((await api.tresor()).notfallblatt?.aktuell) { setGeladen(true); return; } } catch { /* gleich noch einmal */ }
    }
  }
  const umgebung = `Version ${version ?? 'unbekannt'}, Browser ${navigator.userAgent}`;
  const issue = `${REPO}/issues/new?${new URLSearchParams({ title: 'Problem bei der Einrichtung', body: `**Was ist passiert?**\n\n\n**Was hätte ich erwartet?**\n\n\n---\n${umgebung}` })}`;
  const nicht = STUFEN.filter((s) => l.stufen[s].meldung && l.stufen[s].zustand === 'fertig');
  const leiste: Leiste = { erledigt: (i) => i < NR.fertig, gesperrt: () => t('einrichtung.gesperrt.abschluss') };
  return (
    <Rahmen aktiv={NR.fertig} titel={t('einrichtung.abschluss.titel', { ablage: st.sammlung.ablage || 'Dein Ablago' })} unter={t('einrichtung.abschluss.unter')} leiste={leiste}>
      {l.unterbrochen && <div className="hinweis info"><p>{t('einrichtung.abschluss.unterbrochen')}</p></div>}
      {nicht.length > 0 && <div className="hinweis warn"><ul>{nicht.map((s) => <li key={s}>{l.stufen[s].meldung}</li>)}</ul></div>}
      {l.einladung && (
        <section className="blatt stapel">
          <h2 className="h3">{t('einrichtung.abschluss.einladung', { name: l.einladung.name })}</h2>
          <p className="leise">{l.einladung.mailVerschickt ? 'Die Einladung ist per E-Mail unterwegs.' : 'Mit diesem Link legt er sein Passwort fest – öffne ihn nach der Einrichtung, am besten in einem anderen Browser oder privaten Fenster:'}</p>
          {l.einladung.link && (
            <div className="zeile">
              <input className="mono" readOnly value={l.einladung.link} onFocus={(e) => e.target.select()} style={{ flex: 1 }} aria-label="Einladungslink" />
              <button type="button" className="knopf" onClick={() => void navigator.clipboard?.writeText(l.einladung!.link!).then(() => setKopiert(true), () => {})}>{kopiert ? 'Kopiert' : 'Kopieren'}</button>
            </div>
          )}
        </section>
      )}
      <section className="blatt stapel" aria-label={t('einrichtung.abschluss.notfallblatt')}>
        <h2 className="h3">{t('einrichtung.abschluss.notfallblatt')}</h2>
        <p>{t('einrichtung.abschluss.notfallblatt.text')}</p>
        {fingerabdruck && <p className="leise klein">{t('einrichtung.abschluss.fingerabdruck')} <span className="mono">{fingerabdruck}</span></p>}
        <div className="knoepfe links">
          <a className={`knopf${geladen ? '' : ' primaer'}`} href="/api/werkbank/notfallblatt" download onClick={() => void heruntergeladen()}>{t('einrichtung.abschluss.herunterladen')}</a>
        </div>
        {geladen ? <p className="gutertext klein" role="status"><Symbol name="haken" /> {t('einrichtung.abschluss.geladen')}</p> : <p className="leise klein">{t('einrichtung.abschluss.pflicht')}</p>}
      </section>
      <ul className="linkliste">
        <li><a className="verweis" href={handbuchUrl('admin', version, 'fuenf-schritte/')} target="_blank" rel="noreferrer">Einrichten in fünf Schritten ↗</a> – was du jetzt noch tun solltest, damit alles sicher läuft.</li>
        <li><a className="verweis" href={handbuchUrl('benutzer', version)} target="_blank" rel="noreferrer">Benutzerhandbuch ↗</a> – Ablage, Dokumente, Aufgaben.</li>
        <li><a className="verweis" href={handbuchUrl('admin', version)} target="_blank" rel="noreferrer">Administratorhandbuch ↗</a> – Mappentypen, Sicherung, Wartung.</li>
        <li><a className="verweis" href={issue} target="_blank" rel="noreferrer">Problem melden ↗</a> – als vorbereitetes GitHub-Issue mit Version und Umgebung.</li>
        <li><a className="verweis" href="https://github.com/sponsors/motom001" target="_blank" rel="noreferrer">Projekt unterstützen ↗</a> – freiwillig, Betrag frei wählbar.</li>
      </ul>
      {x.fehler && <p className="fehlertext" role="alert">{x.fehler}</p>}
      <div className="knoepfe">
        <button type="button" className="knopf primaer" disabled={!geladen || x.sendet} onClick={() => void x.los(async () => { await api.einrichtungSchritt('fertig'); vergiss(); geheZu('/werkbank', true); await abschliessen(); })}>{t('einrichtung.abschluss.knopf')}</button>
      </div>
    </Rahmen>
  );
}

/* ---------- Ganzer Ablauf nach „Neu einrichten“ ---------- */

/**
 * Sammeln, Zusammenfassung, Fortschritt und Abschluss – vor und nach dem Anlegen des Administrators dieselbe
 * Oberfläche, der Stand liegt außerhalb der Komponente (stand.ts). `zurWahl` führt zurück zu „Neu oder Sicherung“.
 */
export function Sammelassistent({ zurWahl, abschliessen, version = null, imEinrichtungsmodus }: { zurWahl: () => void; abschliessen: () => Promise<void>; version?: string | null; imEinrichtungsmodus?: boolean }) {
  const st = useAssistent();
  const s = st.sammlung;
  if (st.lauf && !st.aendern) return st.lauf.fertig ? <Abschluss abschliessen={abschliessen} version={version} /> : <LaufAnsicht />;
  const leiste: Leiste = st.aendern
    ? { erledigt: (i) => i < NR.zusammenfassung, gesperrt: () => t('einrichtung.gesperrt.lauf') }
    : sammelLeiste(s, zurWahl);
  const ansicht = st.aendern ?? s.ansicht;
  const p = { s, zurWahl, leiste };
  const k = `${ansicht}-${st.aendern ?? ''}`;
  if (ansicht === 'ablage') return <AblageSchritt key={k} {...p} datei={st.aendern ? undefined : { imEinrichtungsmodus }} />;
  if (ansicht === 'administrator') return <AdminSchritt key={k} {...p} />;
  if (ansicht === 'benutzer') return <BenutzerSchritt key={k} {...p} />;
  if (ansicht === 'pakete') return <PaketeSchritt key={k} {...p} />;
  if (ansicht === 'optional') return <OptionalSchritt key={k} {...p} />;
  return <Zusammenfassung key={k} {...p} />;
}

/** Nach dem Anmelden ohne gespeicherten Stand (anderer Browser, alter Assistent): nur noch Schlüssel und Notfallblatt. */
export function unterbrochenerLauf() {
  const l = neuerLauf();
  for (const s of STUFEN) if (s !== 'schluessel') l.stufen[s] = { zustand: 'ausgelassen' };
  setzeStand((x) => ({ ...x, neu: true, lauf: { ...l, unterbrochen: true } }));
  void ausfuehren();
}
