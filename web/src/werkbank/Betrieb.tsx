import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type BetriebAnsicht } from '../api';
import { MailVersand } from './MailVersand';
import { Speicherleiste, useEntwurf } from '../Speicherleiste';
import { Hilfe } from '../Hilfe';

/**
 * E-Mail-Versand und Adresse des DMS (#37) – früher Umgebungsvariablen (SMTP_*, APP_URL),
 * jetzt hier gepflegt, sofort wirksam und testbar.
 */
export function useBetrieb() {
  const [stand, setStand] = useState<BetriebAnsicht | null>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = useCallback(async () => {
    try { setStand(await api.betrieb()); setFehler(undefined); } catch (e) { setFehler((e as Error).message); }
  }, []);
  return { stand, setStand, fehler, laden };
}
export type BetriebZustand = ReturnType<typeof useBetrieb>;

export function BetriebPanel({ b }: { b: BetriebZustand }) {
  useEffect(() => { void b.laden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (b.fehler) return <div className="hinweis schlecht"><p>{b.fehler}</p></div>;
  if (!b.stand) return <p className="leise">Lade …</p>;
  return (
    <div className="einspaltig">
      <div className="mappenkopf">
        <p className="ueber">Werkbank</p>
        <h1>E-Mail und Adresse</h1>
        <p className="leise">Wie Ablago E-Mails verschickt und unter welcher Adresse es erreichbar ist. Änderungen gelten sofort, ohne Neustart. <Hilfe ort="werkbank.betrieb" /></p>
      </div>
      <Adresse b={b} />
      {/* #813: Adresse und Passwort genügen; Vorschläge, Server finden, Erweitert, OAuth. */}
      <MailVersand key={JSON.stringify(b.stand.mail)} b={b} />
    </div>
  );
}

function Adresse({ b }: { b: BetriebZustand }) {
  const s = b.stand!;
  const [adresse, setAdresse] = useState(s.adresse);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'schlecht'; text: string }>();
  const ent = useEntwurf(s.adresse, adresse.trim(), { zuruecksetzen: () => { setAdresse(s.adresse); setMeldung(undefined); } });
  async function speichern(ev?: FormEvent, wert = adresse) {
    ev?.preventDefault();
    try { const n = await api.adresseSpeichern(wert); b.setStand({ ...b.stand!, ...n }); setAdresse(n.adresse); setMeldung({ art: 'gut', text: n.adresse ? 'Gespeichert.' : 'Keine Adresse gepflegt – Links nutzen die Adresse der Anfrage.' }); }
    catch (x) { setMeldung({ art: 'schlecht', text: (x as Error).message }); }
  }
  return (
    <form className="blatt" id="adresse" onSubmit={speichern} onKeyDown={ent.tasten}>
      <h2 className="h3">Adresse von Ablago</h2>
      <p className="leise">Unter dieser Adresse öffnen die Benutzer Ablago. Sie steht in den Links der E-Mails (Einladungen, Passwort vergessen). Beginnt sie mit <span className="mono">https://</span>, gilt die Anmeldung nur noch über HTTPS.</p>
      <label className="eigenschaft"><span>Adresse <small>z. B. http://nas.home.arpa:8080 oder https://ablage.example.org</small></span>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder={s.vorschlag ?? 'http://nas.home.arpa:8080'} inputMode="url" autoComplete="off" /></label>
      {!s.adresse && (
        <div className="hinweis info"><p>Noch keine Adresse gepflegt. Bis dahin nimmt Ablago die Adresse, unter der es gerade aufgerufen wird{s.vorschlag ? <> – hier <span className="mono">{s.vorschlag}</span></> : ''}.</p>
          {s.vorschlag && <button type="button" className="knopf klein" onClick={() => { setAdresse(s.vorschlag!); void speichern(undefined, s.vorschlag!); }}>Diese Adresse übernehmen</button>}
        </div>
      )}
      {s.adresse.startsWith('https://') && s.vorschlag?.startsWith('http://') && (
        <div className="hinweis warn"><p>Du rufst Ablago gerade über HTTP auf, die Adresse ist aber HTTPS. Nach der nächsten Anmeldung geht das nur noch über HTTPS. Läuft ein Reverse-Proxy davor und steht <span className="mono">TRUST_PROXY</span> auf <span className="mono">false</span>, die Variable entfernen.</p></div>
      )}
      {meldung && <p className={meldung.art === 'gut' ? 'gutertext' : 'fehlertext'} role="status">{meldung.text}</p>}
      <Speicherleiste ent={ent} gegenstand="Adresse" />
    </form>
  );
}
