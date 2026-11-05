import { darfVerwalten } from '../../../shared/src/verwaltungsrecht';
import { useEffect, useRef, useState } from 'react';
import { datumDe, type Termin } from '../../../shared/src/fristen';
import { t, tn } from '../sprache';
import { api } from '../api';
import { useDaten } from '../daten';
import { useHandbuch } from '../Hilfe';
import { Listenkopf } from '../Listenkopf';
import { useKonto } from '../konto';
import { Link } from '../ort';
import { titelOder } from '../seiten';
import { neuePost } from './NeuePost';
import { StartSuche } from './StartSuche';
import { FragAblage } from './FragAblage';
import { istTouch, postFotografieren } from './PostKamera';
import { AnsichtSymbol, Symbol } from '../Symbol';
import { darfPostAnlegen } from '../../../shared/src/model';
import { gebietsschema } from '../../../shared/src/sprache';

/**
 * Startseite der Ablage (#334): wenige Kacheln mit je einer Zahl und einer Handlung.
 * Zu erledigen, Neue Post, Nächster Termin (#725, öffnet den Monat), eine wählbare Kachel (Favoriten oder eine Ansicht) und
 * „Zuletzt geöffnet“. In einer leeren Installation stattdessen drei Einstiege.
 * Abschalten und Kachel wählen: im Profil (Einstellungen „startseite“, „startseite_kachel“).
 *
 * Ohne geöffnete Mappe nutzt sie Mitte und rechten Bereich zusammen (#429, `breit`): ein Raster,
 * in dem jede Kachel einen festen Schlüssel (`data-kachel`) hat – Grundlage dafür, sie später
 * frei anzuordnen (#421). Mit geöffneter Mappe steht sie wie jede Liste in der Mitte.
 */
const zahl = (n: number) => n.toLocaleString(gebietsschema());

function Kachel({ name, to, art, titel, anzahl, leer, unter, symbol }: { name: string; to: string; art: 'auffaellig' | 'ruhig' | 'post'; titel: string; anzahl: number | null; leer: string; unter?: string; symbol?: string | null }) {
  const nichts = anzahl === 0;
  return (
    <div className="start-feld" data-kachel={name}>
      <Link to={to} className={`kachel ${art} ${nichts ? 'erledigt' : ''}`}>
        <span className="kacheltitel">{symbol && <><AnsichtSymbol name={symbol} /> </>}{titel}</span>
        {anzahl === null ? <span className="kachelzahl leise">…</span> : nichts ? <span className="kachelleer"><Symbol name="haken" /> {leer}</span> : <span className="kachelzahl">{zahl(anzahl)}</span>}
        {unter && !nichts && <span className="kachelunter leise klein">{unter}</span>}
      </Link>
    </div>
  );
}

/** Kachel „Nächster Termin“ (#725): Datum und Mappe des nächsten Termins; öffnet den Monat in „Zu erledigen“. */
function TerminKachel({ z }: { z: { termin: Termin | null; ueberfaellig: number } | null }) {
  const d = useDaten();
  const zumMonat = () => { if (d.einstellungen.erledigen_ansicht !== 'monat' && d.einstellungen.erledigen_ansicht !== 'jahr') d.setzeEinstellung('erledigen_ansicht', 'monat'); };
  const x = z?.termin;
  return (
    <div className="start-feld" data-kachel="termin" onClickCapture={zumMonat}>
      <Link to="/ablage/eingang" className={`kachel ruhig ${z && !x ? 'erledigt' : ''}`}>
        <span className="kacheltitel">{t('termine.kachel')}</span>
        {!z ? <span className="kachelzahl leise">…</span>
          : !x ? <span className="kachelleer"><Symbol name="haken" /> {t('termine.kachel.leer')}</span>
          : <span className="kachelzahl ka-kachel-datum">{datumDe(x.datum)}</span>}
        {x && <span className="kachelunter leise klein">{t.frei(`termine.art.${x.art}`)}: {titelOder(x.mappeTitel)}</span>}
        {!!z?.ueberfaellig && <span className="kachelunter problem klein">{t('termine.kachel.ueberfaellig', { anzahl: z.ueberfaellig })}</span>}
      </Link>
    </div>
  );
}

export function Startseite({ offen, breit = false }: { offen?: string; breit?: boolean }) {
  const d = useDaten();
  const { ich } = useKonto();
  const handbuch = useHandbuch();
  const [daten, setDaten] = useState<{ zuletzt: Array<{ id: string; typId: string; titel: string }>; leer: boolean } | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let aktuell = true;
    api.startseite().then((x) => { if (aktuell) setDaten(x); }, () => { if (aktuell) setDaten({ zuletzt: [], leer: false }); });
    return () => { aktuell = false; };
  }, [d.stand]);
  // Nächster Termin (#725): eigene Aufgaben mit Datum, Erinnerungen, Fristen an lesbaren Mappen.
  const [termin, setTermin] = useState<{ termin: Termin | null; ueberfaellig: number } | null>(null);
  useEffect(() => {
    let aktuell = true;
    api.naechsterTermin().then((x) => { if (aktuell) setTermin(x); }, () => { if (aktuell) setTermin({ termin: null, ueberfaellig: 0 }); });
    return () => { aktuell = false; };
  }, [d.stand]);

  const postSicht = d.zaehler.neuePost ? d.sicht(d.zaehler.neuePost) : undefined;
  // Zahlen kommen nach (#512): bis dahin „…“ in der Kachel.
  const z = (n: number) => (d.zahlenDa ? n : null);
  const wahl = typeof d.einstellungen.startseite_kachel === 'string' ? d.einstellungen.startseite_kachel : 'favoriten';
  const lieblings = wahl !== 'favoriten' ? d.sicht(wahl) : undefined;
  const postTyp = d.typen.find((mappentyp) => mappentyp.system === 'post');
  const kamera = istTouch() && darfPostAnlegen(postTyp) && !!postTyp?.register.some((r) => r.art === 'dokumente');

  return (
    <>
      <Listenkopf titel={t('ablage.startseite.start')} hilfe="ablage.start" beschreibung={<>{t('ablage.startseite.hallo-hier-faengst-du', { wert: ich.name?.split(/\s+/)[0] || ich.email })}</>} />
      <div className={`listenrumpf startseite${breit ? ' start-breit' : ''}`}>
        {/* Schnell finden (#497) ganz oben; darunter (ohne Suchbegriff) die Kamera, Kacheln und „zuletzt geöffnet“. */}
        <StartSuche ohneSuche={!!daten?.leer} sonst={<>
        {/* Frag deine Ablage (#444): eigenes Feld, nur mit einem Antwort-Paket. */}
        {!daten?.leer && <FragAblage />}
        {/* Handy (#490): mit einem Tipp in die Kamera – mehrseitig, ein PDF, eine Post. */}
        {kamera && <button type="button" className="knopf gruen pk-start" onClick={() => postFotografieren()}>{tn('ablage.startseite.post-fotografieren', { symbol: <Symbol name="kamera" /> })}</button>}
        {daten?.leer ? (
          <div className="einstiege">
            <p>{t('ablage.startseite.noch-ist-die-ablage')}</p>
            <button type="button" className="kachel post" onClick={() => datei.current?.click()}>
              <span className="kacheltitel">{t('ablage.startseite.erste-post-ablegen')}</span><span className="kachelunter">{t('ablage.startseite.brief-scannen-oder-fotografieren')}</span>
            </button>
            <input ref={datei} type="file" multiple hidden accept="application/pdf,image/*" onChange={(e) => { neuePost([...(e.target.files ?? [])]); e.target.value = ''; }} />
            {/* #818: Wer verwalten darf, kommt darüber in den Verwaltungsmodus. */}
            {(ich.rolle === 'admin' || darfVerwalten(ich)) && (
              <Link to="/werkbank/pakete" className="kachel ruhig">
                <span className="kacheltitel">{t('ablage.startseite.paket-haushalt-installieren')}</span><span className="kachelunter">{t('ablage.startseite.fertige-mappentypen-fuer-konten')}</span>
              </Link>
            )}
            <a href={handbuch('benutzer', 'erste-schritte/')} target="_blank" rel="noreferrer" className="kachel ruhig">
              <span className="kacheltitel">{t('ablage.startseite.hilfe-so-faengst-du')}</span><span className="kachelunter">{t('ablage.startseite.die-ersten-schritte-im')}</span>
            </a>
          </div>
        ) : (
          <div className="kacheln start-raster">
            <Kachel name="eingang" to="/ablage/eingang" art="auffaellig" titel={t('ablage.startseite.zu-erledigen')} anzahl={z(d.zaehler.eingang)} leer={t('ablage.startseite.nichts-zu-erledigen')} unter={t('ablage.startseite.aufgaben-und-mappen-an')} />
            {postSicht && <Kachel name="post" to={`/ablage/${postSicht.id}`} art="post" titel={postSicht.name} anzahl={z(d.zaehler.sichten?.[postSicht.id] ?? 0)} leer={t('ablage.startseite.keine-neue-post')} unter={t('ablage.startseite.noch-nicht-zugeordnet')} />}
            <TerminKachel z={termin} />
            {lieblings
              ? <Kachel name="wahl" to={`/ablage/${lieblings.id}`} art="ruhig" titel={lieblings.name} symbol={lieblings.symbol} anzahl={z(d.zaehler.sichten?.[lieblings.id] ?? 0)} leer={t('ablage.startseite.leer')} />
              : <Kachel name="wahl" to="/ablage/favoriten" art="ruhig" titel={t('ablage.startseite.favoriten')} anzahl={z(d.zaehler.favoriten ?? 0)} leer={t('ablage.startseite.noch-keine-der-stern')} />}
          </div>
        )}
        {daten && daten.zuletzt.length > 0 && (
          <section className="zuletzt" data-kachel="zuletzt">
            <h2 className="h3">{t('ablage.startseite.zuletzt-geoeffnet')}</h2>
            <ul className="mappenliste">
              {daten.zuletzt.map((m) => (
                <li key={m.id}>
                  <Link to={`/ablage/start/${m.id}`} className={`eintrag ${offen === m.id ? 'an' : ''}`}>
                    <span className="titel">{titelOder(m.titel)}</span>
                    <span className="unter">{d.typ(m.typId)?.name ?? ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        </>} />
      </div>
    </>
  );
}
