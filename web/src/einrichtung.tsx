import { useEffect, useState, type FormEvent } from 'react';
import { INSTALLIEREN_URL } from '../../shared/src/hilfe';
import { api, ApiFehler, hatEinrichtungscode, setzeEinrichtungscode, type AnbindungEingabe, type AnbindungPruefung, type KontoStatus } from './api';
import { WiederherstellungsAssistent } from './wiederherstellen';
import { useKonto } from './konto';
import { t } from './sprache';
import { nachDemLaden, nimmDatei, ladeDatei } from './assistent/datei';
import { Rahmen, Sammelassistent, unterbrochenerLauf, type Leiste } from './assistent/Schritte';
import { setzeStand, useAssistent } from './assistent/stand';

/**
 * Einrichtungsassistent (#119). Seit #804: Code, Datenbank und „Neu oder Sicherung“ wirken sofort, weil sie technisch
 * nötig sind. Danach sammelt der Assistent nur (Ablage, Dein Konto, Pakete, Optionales), zeigt eine
 * Zusammenfassung und legt erst mit „Jetzt einrichten“ etwas an – Schritte und Ablauf in assistent/Schritte.tsx.
 * Übersprungenes lässt sich in der Werkbank nachholen.
 */

/** Nach dem Übernehmen der Datenbank ist der Server kurz weg; danach meldet er die nächste Phase. */
async function warteBisGestartet(abbrechen: () => boolean = () => false) {
  for (let i = 0; i < 240 && !abbrechen(); i++) {
    try { const st = await api.status(); if (st.einrichtung?.phase !== 'startet' && st.einrichtung?.phase !== 'datenbank') return; } catch { /* startet noch */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
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

/** Vor dem Sammeln: Code und Datenbank sind gesperrt (mit Grund), alles danach noch nicht erreicht. */
const VORHER: Leiste = {
  erledigt: (i) => i < 2,
  gesperrt: (i) => (i === 0 ? t('einrichtung.gesperrt.code') : i === 1 ? t('einrichtung.gesperrt.datenbank') : null),
};

/* ---------- Ohne Anmeldung: Code, Datenbank, Neu oder Sicherung, dann sammeln ---------- */

export function Einrichtungsassistent({ status, fertig }: { status: KontoStatus; fertig: () => Promise<void> }) {
  const e = status.einrichtung;
  const phase = e?.phase ?? 'konto';
  const [codeOk, setCodeOk] = useState(!e?.code || false);
  const [sicherung, setSicherung] = useState(false);
  const st = useAssistent();

  // Gespeicherten Code (sessionStorage) beim Laden prüfen.
  useEffect(() => {
    if (!e?.code || !hatEinrichtungscode() || phase === 'startet') return;
    api.einrichtungCode().then(() => { if (!codeOk) { setCodeOk(true); void fertig(); } }, () => setzeEinrichtungscode(null));
  }, [e?.code, phase]);

  // DMS startet nach dem Übernehmen der Datenbank im selben Prozess: Stand abfragen, bis es da ist.
  useEffect(() => {
    if (phase !== 'startet') return;
    let aus = false;
    void warteBisGestartet(() => aus).then(() => { if (!aus) void fertig(); });
    return () => { aus = true; };
  }, [phase, fertig]);

  // Konfigurationsdatei (#806): auf dem Code-Schritt gewählt, oder vor der Datenbank geladen – jetzt prüfen.
  useEffect(() => {
    if (!codeOk || phase === 'startet') return;
    const wartend = nimmDatei();
    if (wartend) { void ladeDatei(wartend, phase === 'datenbank').catch(() => {}); return; }
    if (phase === 'konto' && st.sammlung.pruefungOffen) void nachDemLaden().catch(() => {});
  }, [codeOk, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'startet') return <Rahmen aktiv={1} titel="Ablago startet …" leiste={VORHER}><p className="leise">Die Datenbank ist verbunden. Jetzt legt Ablago seine Tabellen an – das dauert einen Moment.</p></Rahmen>;
  if (e?.code && !codeOk) return <CodeSchritt ok={() => { setCodeOk(true); void fertig(); }} />;
  // Bisherige Anbindung und Fehler liefert der Server erst mit Code – dann neu vorbelegen.
  if (phase === 'datenbank') return <DatenbankSchritt key={`${e?.anbindung ? 'mit' : 'ohne'}-${st.sammlung.datenbank ? 'datei' : ''}`} status={status} weiter={fertig} />;
  const zurWahl = () => setzeStand((x) => ({ ...x, neu: false }));
  // Läuft „Jetzt einrichten“ schon, bleibt es bei dieser Oberfläche – auch wenn das eigene Konto schon angelegt ist.
  if (st.neu || st.lauf) return <Sammelassistent zurWahl={zurWahl} abschliessen={fertig} />;
  if (sicherung) return (
    <Rahmen aktiv={2} titel="Aus Sicherung wiederherstellen" leiste={VORHER} unter="Wähle eine Sicherung aus dem Sicherungsordner. Danach meldest du dich mit den Zugangsdaten an, die zur Zeit der Sicherung galten – ein neues Konto ist nicht nötig.">
      <WiederherstellungsAssistent frisch gestartet={() => void fertig()} abbrechen={() => setSicherung(false)} />
    </Rahmen>
  );
  return (
    <Rahmen aktiv={2} titel="Neu einrichten oder wiederherstellen?" unter="Die Datenbank ist verbunden und noch leer." leiste={VORHER} datei={{}}>
      <div className="wahlkarten">
        <button type="button" className="wahlkarte" onClick={() => setzeStand((x) => ({ ...x, neu: true }))}>
          <strong>Neu einrichten</strong><span className="leise">{t('einrichtung.wahl.neu')}</span>
        </button>
        <button type="button" className="wahlkarte" onClick={() => setSicherung(true)}>
          <strong>Aus einer Sicherung wiederherstellen</strong><span className="leise">Neues NAS, alte Sicherung: Lege sie in den Sicherungsordner und halte das Notfallblatt bereit. Danach meldest du dich mit den bisherigen Zugangsdaten an.</span>
        </button>
      </div>
    </Rahmen>
  );
}

function CodeSchritt({ ok }: { ok: () => void }) {
  const [code, setCode] = useState('');
  const s = useSenden();
  return (
    <Rahmen aktiv={0} titel="Einrichtungscode" leiste={{ erledigt: () => false }} datei={{ ohneCode: true }} unter="Damit niemand sonst im Netz dein Ablago einrichtet, fragt es zuerst nach einem Code. Den hat Ablago beim Start an zwei Stellen hinterlegt:">
      <ol className="anleitung">
        <li><strong>Im Protokoll des Containers.</strong> In der Docker-Oberfläche des NAS den Container <span className="mono">app</span> des Projekts öffnen (bei UGREEN: <em>Docker → Container → dms-app → Protokoll</em>, bei Synology: <em>Container Manager → Container → Details → Protokoll</em>) oder auf der Kommandozeile <span className="mono">docker compose logs app</span>. Gesucht ist die Zeile <span className="mono">Einrichtungscode für Ablago: XXXX-XXXX-XXXX</span>.</li>
        <li><strong>In einer Datei</strong> namens <span className="mono">EINRICHTUNGSCODE</span> im Ordner für den Schlüssel, in der Vorlage <span className="mono">/volume1/docker/dms/geheim</span>.</li>
      </ol>
      <form className="stapel" onSubmit={(ev) => { ev.preventDefault(); void s.los(async () => {
        setzeEinrichtungscode(code.trim());
        try { await api.einrichtungCode(); ok(); } catch (x) { setzeEinrichtungscode(null); throw x; }
      }); }}>
        <label className="eigenschaft"><span>Einrichtungscode</span><input className="mono" value={code} onChange={(x) => setCode(x.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus required /></label>
        {s.fehler && <p className="fehlertext">{s.fehler}</p>}
        <button className="knopf primaer" disabled={s.sendet || !code.trim()}>{s.sendet ? 'Prüfe …' : 'Weiter'}</button>
      </form>
      <p className="klein">Wo das bei deinem Gerät ist, zeigt die Anleitung deiner Plattform mit Bildern: <a className="verweis" href={INSTALLIEREN_URL} target="_blank" rel="noreferrer">Wie komme ich an ein DMS? ↗</a></p>
      <p className="leise klein">Nach der Einrichtung ist der Code wertlos; Ablago löscht die Datei.</p>
    </Rahmen>
  );
}

export const STANDARD_DB: AnbindungEingabe = { host: 'db', port: 5432, datenbank: 'dms', benutzer: 'dms', passwort: '' };

/** Formular der Anbindung – im Assistenten und in der Werkbank. */
export function AnbindungFormular({ wert, setWert, passwortGesetzt, felder }: { wert: AnbindungEingabe; setWert: (a: AnbindungEingabe) => void; passwortGesetzt: boolean; felder?: Record<string, string> }) {
  const feld = (k: keyof AnbindungEingabe, name: string, hilfe: string, typ = 'text') => (
    <label className="eigenschaft"><span>{name} <small>{hilfe}</small></span>
      <input type={typ} value={String(wert[k])} onChange={(x) => setWert({ ...wert, [k]: k === 'port' ? Number(x.target.value) : x.target.value })}
        autoComplete={k === 'passwort' ? 'new-password' : 'off'} spellCheck={false} aria-invalid={!!felder?.[k]} />
      {felder?.[k] && <small className="fehlertext">{felder[k]}</small>}
    </label>
  );
  return (
    <div className="raster">
      {feld('host', 'Server', 'Name des Datenbank-Containers, meist „db“')}
      {feld('port', 'Port', 'meist 5432', 'number')}
      {feld('datenbank', 'Datenbank', 'meist „dms“')}
      {feld('benutzer', 'Benutzer', 'meist „dms“')}
      {feld('passwort', 'Passwort', passwortGesetzt ? 'leer lassen = bisheriges behalten' : 'DB_PASSWORD aus der .env', 'password')}
    </div>
  );
}

export function PruefungAnzeige({ p }: { p: AnbindungPruefung }) {
  if (p.ok) return <div className="hinweis gut"><p><strong>Verbindung klappt.</strong> PostgreSQL {p.postgres.split(' ')[0]}{p.eingerichtet ? ` – darin gibt es schon ein DMS (${p.benutzer} ${p.benutzer === 1 ? 'Benutzer' : 'Benutzer'}).` : ' – die Datenbank ist leer; Ablago legt seine Tabellen selbst an.'}</p></div>;
  return <div className="hinweis schlecht"><p><strong>{p.text}</strong></p><details><summary className="leise klein">Technische Meldung</summary><p className="mono klein">{p.technisch}</p></details></div>;
}

function DatenbankSchritt({ status, weiter }: { status: KontoStatus; weiter: () => Promise<void> }) {
  const e = status.einrichtung!;
  const v = e.anbindung;
  // Aus einer Konfigurationsdatei (#806) vorbelegt – das Passwort steht nie darin.
  const datei = useAssistent().sammlung.datenbank;
  const [a, setA] = useState<AnbindungEingabe>(datei ? { host: datei.host, port: datei.port, datenbank: datei.datenbank, benutzer: datei.benutzer, passwort: '' }
    : v ? { host: v.host, port: v.port, datenbank: v.datenbank, benutzer: v.benutzer, passwort: '' } : STANDARD_DB);
  const [p, setP] = useState<AnbindungPruefung | null>(null);
  const [felder, setFelder] = useState<Record<string, string>>();
  const [startet, setStartet] = useState(false);
  const s = useSenden();
  const tu = (f: () => Promise<void>) => s.los(async () => {
    setFelder(undefined);
    try { await f(); } catch (x) { if (x instanceof ApiFehler) setFelder((x.details as { felder?: Record<string, string> })?.felder); throw x; }
  });
  if (startet) return <Rahmen aktiv={1} titel="Ablago startet …" leiste={VORHER}><p className="leise">Die Datenbank ist verbunden. Jetzt legt Ablago seine Tabellen an – das dauert einen Moment.</p></Rahmen>;
  return (
    <Rahmen aktiv={1} titel="Datenbank" leiste={{ erledigt: (i) => i < 1, gesperrt: (i) => (i === 0 ? t('einrichtung.gesperrt.code') : null) }} datei={{ imEinrichtungsmodus: true }} unter="Ablago speichert alles außer den Dateien in PostgreSQL. In der Compose-Vorlage läuft die Datenbank als eigener Container „db“; das Passwort steht in der Datei .env daneben.">
      {e.fehler && <div className="hinweis warn"><p><strong>{e.quelle === 'umgebung' ? 'Mit DATABASE_URL aus der Compose-Datei' : e.quelle === 'datei' ? 'Mit der gespeicherten Anbindung' : 'Die Verbindung'} klappt es nicht:</strong> {e.fehler}</p><p className="leise klein">Korrigiere die Angaben hier – sie werden in /data/geheim gespeichert und gelten ab dann, auch wenn DATABASE_URL anders lautet.</p></div>}
      <form className="stapel" onSubmit={(ev: FormEvent) => { ev.preventDefault(); void tu(async () => setP(await api.einrichtungDbPruefen(a))); }}>
        {datei && <p className="leise klein">{t('einrichtung.datenbank.datei')}</p>}
        <AnbindungFormular wert={a} setWert={(x) => { setA(x); setP(null); }} passwortGesetzt={!!v?.passwortGesetzt} felder={felder} />
        {p && <PruefungAnzeige p={p} />}
        {s.fehler && <p className="fehlertext">{s.fehler}</p>}
        <div className="knoepfe">
          <button className="knopf" disabled={s.sendet}>{s.sendet ? 'Prüfe …' : 'Verbindung prüfen'}</button>
          {p && !p.ok && p.art === 'datenbank_fehlt' && p.anlegenMoeglich && <button type="button" className="knopf" disabled={s.sendet} onClick={() => void tu(async () => setP(await api.einrichtungDbAnlegen(a)))}>Datenbank „{a.datenbank}“ anlegen</button>}
          {p?.ok && <button type="button" className="knopf primaer" disabled={s.sendet} onClick={() => void tu(async () => { await api.einrichtungDbUebernehmen(a); setStartet(true); await warteBisGestartet(); await weiter(); })}>Übernehmen und weiter</button>}
        </div>
        {p && !p.ok && p.art === 'datenbank_fehlt' && !p.anlegenMoeglich && <p className="leise klein">Dieser Benutzer darf keine Datenbanken anlegen. Lege sie in PostgreSQL an oder nimm den Benutzer aus der Compose-Vorlage.</p>}
      </form>
    </Rahmen>
  );
}


/* ---------- Angemeldet mit „Gesamte Verwaltung“: „Jetzt einrichten“ läuft weiter bzw. Abschluss ---------- */

/**
 * Nach dem Anlegen des eigenen Kontos (auch nach Neuladen): Fortschritt, Fehler und Abschluss aus dem gespeicherten
 * Stand. Ohne Stand (anderer Browser oder ein Assistent aus einer älteren Version) bleiben nur Schlüssel und
 * Notfallblatt – den Rest holt man in der Werkbank nach.
 */
export function AssistentAngemeldet() {
  const { aktualisieren, version } = useKonto();
  const st = useAssistent();
  useEffect(() => { if (!st.lauf) unterbrochenerLauf(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st.lauf) return <p className="leise mittig">Lade …</p>;
  return <Sammelassistent zurWahl={() => {}} abschliessen={aktualisieren} version={version} />;
}
