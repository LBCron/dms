import { useEffect, useState } from 'react';
import { KATALOG_LINK_REL, sammelSeiteMitVersion, type AblaufErgebnis, type InstalliertesPaket, type Katalog } from '../../../shared/src/pakete';
import { api, ApiFehler, type PaketVorschau, type Sammeldatei } from '../api';
import { Hilfe } from '../Hilfe';
import { Symbol } from '../Symbol';
import { HerkunftZeile } from './Herkunft';
import { PaketAblauf, sammelStand } from './PaketAblauf';
import { t } from '../sprache';

/**
 * Pakete dazuholen (#460): Auswahl aus dem offiziellen Katalog mit Abhängigkeiten und Ergänzungen (#405, z. B. weitere
 * Sprachen der Texterkennung), dann ein gemeinsamer Ablauf mit einer Rechte-Bestätigung für alle Pakete und einem Knopf.
 * Der Katalog wird erst abgefragt, wenn diese Ansicht erscheint.
 */

/** Vorgewählt (#460): ohne Texterkennung werden gescannte Dokumente nicht durchsuchbar (#458). */
export const VORAUSWAHL = ['texterkennung'];

/**
 * Auswahl aus dem offiziellen Katalog und Installation, z. B. im Einrichtungsassistenten (#460).
 * Ist der Katalog nicht erreichbar: Sammeldatei hochladen (#461) oder überspringen.
 */
export function PaketeDazuholen({ weiter, ueberspringen, geaendert }: {
  weiter(e: AblaufErgebnis): void; ueberspringen(): void;
  /** Nach der Installation (z. B. Daten neu laden). */
  geaendert?(): void;
}) {
  const [stand, setStand] = useState<{ dms: string; installiert: InstalliertesPaket[] } | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [fehler, setFehler] = useState<string>();
  const [versuch, setVersuch] = useState(0);
  const [sammel, setSammel] = useState<{ s: Sammeldatei; datei: string } | null>(null);
  useEffect(() => {
    let aktuell = true;
    setFehler(undefined); setKatalog(null);
    void (async () => {
      try {
        const st = await api.pakete();
        if (!aktuell) return;
        setStand({ dms: st.dms, installiert: st.installiert });
        // Nur der offizielle Katalog – und erst jetzt, weil der Schritt angezeigt wird (keine Verbindung ohne Anlass).
        const k = (await api.paketKatalog(false)).kataloge.find((x) => x.offiziell);
        if (!aktuell) return;
        if (!k?.katalog) throw new Error(k?.fehler ?? 'Der Katalog lässt sich nicht abrufen.');
        setKatalog(k.katalog);
      } catch (e) { if (aktuell) setFehler((e as Error).message); }
    })();
    return () => { aktuell = false; };
  }, [versuch]);

  if (sammel && stand) return (
    <SammeldateiAnsicht s={sammel.s} datei={sammel.datei} dms={stand.dms} installiert={stand.installiert} geaendert={geaendert} abbrechen={() => setSammel(null)} fertig={weiter} />
  );
  if (fehler) return (
    <>
      <div className="hinweis warn" role="status">
        <p><strong>Der Paketkatalog ist gerade nicht erreichbar.</strong> Ohne Internet fehlen die Pakete – etwa die Texterkennung, ohne die gescannte Dokumente nicht durchsuchbar sind.</p>
        <p className="leise klein">{fehler}</p>
      </div>
      <section className="stapel" aria-label="Ohne Internet">
        <h2 className="h3">Ohne Internet: Sammeldatei hochladen</h2>
        <p className="leise">Stell die Pakete an einem Gerät mit Internet auf der <a className="verweis" href={sammelSeiteMitVersion(stand?.dms ?? '')} target="_blank" rel={KATALOG_LINK_REL}>Katalog-Webseite <Symbol name="extern" /></a> zusammen (die Texterkennung ist dort vorausgewählt) und lade die heruntergeladene Datei hier hoch. Oder überspring den Schritt und hol die Pakete später unter Werkbank → Pakete. <Hilfe ort="werkbank.pakete.sammeldatei" /></p>
        <p className="leise klein">{t('pakete.katalog.hinweis')}</p>
        {stand && <SammeldateiWahl geladen={(x, datei) => setSammel({ s: x, datei })} />}
      </section>
      <div className="knoepfe">
        <button type="button" className="knopf" onClick={ueberspringen}>Überspringen</button>
        <button type="button" className="knopf" onClick={() => setVersuch((n) => n + 1)}>Nochmal versuchen</button>
      </div>
    </>
  );
  if (!katalog || !stand) return <p className="leise">Frage den offiziellen Paketkatalog ab …</p>;
  // Vorauswahl: Texterkennung, wenn sie hier passt und noch fehlt; empfohlene oben, sonst wie im Katalog nach Namen.
  const sortiert: Katalog = { ...katalog, pakete: [...katalog.pakete].sort((a, b) => Number(VORAUSWAHL.includes(b.id)) - Number(VORAUSWAHL.includes(a.id))) };
  return (
    <PaketAblauf quelle={{ art: 'katalog', katalog: sortiert, dms: stand.dms, installiert: stand.installiert }} start={VORAUSWAHL} empfohlen={VORAUSWAHL}
      aktionen={<button type="button" className="knopf" onClick={ueberspringen}>Überspringen</button>}
      geaendert={geaendert} fertig={weiter} />
  );
}

/* ---------- Sammeldatei (#461) ---------- */

/** Datei wählen und hochladen: eine Sammeldatei (oder ein einzelnes Paket, falls gewollt). */
export function SammeldateiWahl({ geladen, einzeln }: { geladen(s: Sammeldatei, datei: string): void; einzeln?(r: { upload: string; vorschau: PaketVorschau }, datei: string): void }) {
  const [fehler, setFehler] = useState<string>();
  const [laedt, setLaedt] = useState(false);
  async function hochladen(f: File | undefined) {
    if (!f) return;
    setFehler(undefined); setLaedt(true);
    try {
      const r = await api.paketHochladen(f);
      if ('sammeldatei' in r) geladen(r.sammeldatei, f.name);
      else if (einzeln) einzeln(r, f.name);
      else setFehler('Das ist ein einzelnes Paket, keine Sammeldatei. Einzelne Pakete lädst du unter Werkbank → Pakete → Expertenmodus hoch.');
    } catch (e) { setFehler([(e as Error).message, ...(e instanceof ApiFehler ? e.gruende : [])].join(' ')); }
    finally { setLaedt(false); }
  }
  return (
    <div className="stapel">
      <label className="pd-datei">
        <span className="knopf">{laedt ? 'Prüfe …' : 'Sammeldatei wählen …'}</span>
        <input type="file" accept=".zip,application/zip" disabled={laedt} aria-label="Sammeldatei (.zip) hochladen" onChange={(e) => { void hochladen(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {fehler && <p className="fehlertext klein" role="alert">{fehler}</p>}
    </div>
  );
}

/**
 * Inhalt einer Sammeldatei zeigen und im gemeinsamen Ablauf installieren (#461, #405). Die Prüfsummen hat der Server
 * schon geprüft; die Herkunft bestätigst du einmal für alle Pakete, die Rechte ebenso.
 */
export function SammeldateiAnsicht({ s, datei, dms, installiert, fertig, abbrechen, geaendert }: {
  s: Sammeldatei; datei: string; dms: string; installiert: InstalliertesPaket[]; fertig(e: AblaufErgebnis): void; abbrechen(): void; geaendert?(): void;
}) {
  const abgeglichen = s.pakete.every((p) => p.katalog === 'gleich');
  const datum = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso || '–' : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); };
  const herkunftNoetig = s.pakete.some((p) => sammelStand(p).installierbar && p.vorschau.pruefung?.bestaetigen !== false);
  return (
    <section className="blatt stapel" aria-label="Sammeldatei">
      <h2 className="h3">Sammeldatei „{datei}“</h2>
      <dl className="eigenschaften">
        <dt>Zusammengestellt</dt><dd>{datum(s.datei.erstellt)}{s.datei.dms ? ` für Ablago ${s.datei.dms}` : ''} (dieser Installation: {dms})</dd>
        <dt>Prüfwert der Datei</dt><dd><code className="pd-pruefwert" title={s.datei.sha256}>SHA-256 {s.datei.sha256}</code></dd>
      </dl>
      <HerkunftZeile p={s.datei.pruefung} sammel />
      <div className="hinweis gut klein"><p><strong>Geprüft:</strong> Jedes Archiv hat genau die Größe und Prüfsumme aus dem Verzeichnis der Sammeldatei, jedes Paket ist gültig, und es liegt nichts anderes darin.
        {abgeglichen ? ' Alle Prüfsummen stimmen außerdem mit dem offiziellen Katalog überein.' : ' Mit dem offiziellen Katalog konnte Ablago sie nicht abgleichen (nicht abgerufen oder ohne Internet).'}</p></div>
      {!herkunftNoetig && <div className="hinweis gut klein"><p>{t('pakete.herkunft.sammel.ok')}</p></div>}
      {herkunftNoetig && s.datei.nichtImKatalog.length > 0 && <div className="hinweis info klein"><p>{t('pakete.herkunft.sammel.fehlen', { namen: s.datei.nichtImKatalog.join(', ') })}</p></div>}
      <PaketAblauf quelle={{ art: 'sammel', sammeldatei: s, dms, installiert }} start={s.pakete.filter((p) => p.gewaehlt).map((p) => p.upload)}
        aktionen={<button type="button" className="textknopf" onClick={abbrechen}>Abbrechen</button>}
        geaendert={geaendert} fertig={fertig} />
    </section>
  );
}
