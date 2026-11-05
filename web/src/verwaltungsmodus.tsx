import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiFehler, setzeBestaetigung } from './api';
import { t } from './sprache';
import type { Verwaltungsstand } from '../../shared/src/verwaltungsrecht';

/**
 * Verwaltungsmodus (#819): erneute Anmeldung für „Ablago verwalten“, für den Wiedereinstieg nach Ablauf und als frische
 * Anmeldung vor heiklen Handlungen. Ein Dialog für alles – eingebunden einmal (`<Verwaltungsanmeldung />`).
 *
 * - Beginnen: ohne Abfrage, wenn die Anmeldung höchstens 10 Minuten zurückliegt; sonst Passwort und Code.
 * - Abgelaufen während der Arbeit: Die Anfrage wartet, der Dialog fragt; danach geht sie noch einmal hinaus (api.ts).
 *   Heute in diesem Browser schon bestätigt: Wiedereinstieg mit einem Klick, aktiv zu wählen.
 * - Heikle Handlung: immer Passwort (und Code), gilt dann 10 Minuten.
 */
type Art = 'beginnen' | 'modus' | 'frisch';
interface Offen { art: Art; heuteBestaetigt: boolean; fertig(ok: boolean): void }

let zeige: ((o: Offen) => void) | null = null;
const frage = (art: Art, heuteBestaetigt = false) => new Promise<boolean>((fertig) => {
  if (!zeige) { fertig(false); return; }
  zeige({ art, heuteBestaetigt, fertig });
});

/** „Ablago verwalten“: Modus beginnen, wenn nötig mit erneuter Anmeldung. `true` = läuft. */
export async function verwaltungBeginnen(): Promise<boolean> {
  try { await api.verwaltungBeginnen(); return true; } catch (e) {
    const d = e instanceof ApiFehler ? e.details as { bestaetigen?: boolean } | undefined : undefined;
    if (!d?.bestaetigen) throw e;
    return frage('beginnen');
  }
}

/** Vor einem Link zu einer heiklen Datei (Notfallblatt): erst frisch anmelden, wenn nötig. `true` = weiter. */
export async function frischAngemeldet(): Promise<boolean> {
  return frage('frisch');
}

export function Verwaltungsanmeldung({ stand, nachher }: { stand: Verwaltungsstand | null; nachher(): void }) {
  const [offen, setOffen] = useState<Offen | null>(null);
  useEffect(() => {
    zeige = (o) => setOffen(o);
    // Wiedereinstieg mit einem Klick: heute schon bestätigt oder Anmeldung vor höchstens 10 Minuten.
    setzeBestaetigung((art, d) => frage(art, !!d.heuteBestaetigt || (art === 'modus' && !!d.frisch)));
    return () => { zeige = null; setzeBestaetigung(null); };
  }, []);
  if (!offen) return null;
  const schliesse = (ok: boolean) => { setOffen(null); offen.fertig(ok); nachher(); };
  return <Dialog o={offen} stand={stand} schliesse={schliesse} />;
}

function Dialog({ o, stand, schliesse }: { o: Offen; stand: Verwaltungsstand | null; schliesse(ok: boolean): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const feld = useRef<HTMLInputElement>(null);
  const id = useId();
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  const [mitCode, setMitCode] = useState(!!stand?.code);
  const [fehler, setFehler] = useState<string>();
  const [sendet, setSendet] = useState(false);
  const ohnePasswort = stand?.passwort === false;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    feld.current?.focus();
  }, []);
  const wieder = o.art === 'modus' && o.heuteBestaetigt;
  async function tu(f: () => Promise<unknown>) {
    setSendet(true); setFehler(undefined);
    try { await f(); schliesse(true); } catch (e) {
      const d = e instanceof ApiFehler ? e.details as { code?: boolean } | undefined : undefined;
      if (d?.code) setMitCode(true);
      setFehler((e as Error).message);
    } finally { setSendet(false); }
  }
  const anmelden = () => tu(() => (o.art === 'frisch'
    ? api.verwaltungBestaetigen({ passwort, ...(mitCode ? { code } : {}) })
    : api.verwaltungBeginnen({ passwort, ...(mitCode ? { code } : {}) })));
  // Nur Anbieter (#241): dort erneut anmelden; danach ist die Anmeldung frisch und es geht ohne Abfrage weiter.
  const beimAnbieter = () => {
    try { sessionStorage.setItem('dms:nach-anmeldung', '/werkbank?verwalten=1'); } catch { /* ohne */ }
    location.href = '/api/konto/anbieter/start';
  };
  const titel = o.art === 'frisch' ? t('konten.verwaltung.dialog.frisch.titel') : wieder ? t('konten.verwaltung.dialog.wieder.titel') : o.art === 'modus' ? t('konten.verwaltung.dialog.abgelaufen.titel') : t('konten.verwaltung.dialog.titel');
  const text = o.art === 'frisch' ? t('konten.verwaltung.dialog.frisch.text') : wieder ? t('konten.verwaltung.dialog.wieder.text') : o.art === 'modus' ? t('konten.verwaltung.dialog.abgelaufen.text') : t('konten.verwaltung.dialog.text');
  return (
    <dialog ref={ref} className="rueckfrage verwaltungsdialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-x`}
      onCancel={(e) => { e.preventDefault(); schliesse(false); }}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (wieder) void tu(() => api.verwaltungBeginnen()); else if (!ohnePasswort) void anmelden(); }}>
        <h2 id={`${id}-t`}>{titel}</h2>
        <div id={`${id}-x`} className="rueckfrage-text"><p>{text}</p></div>
        {!wieder && !ohnePasswort && <>
          <label className="eigenschaft"><span>{t('anmeldung.passwort')}</span>
            <input ref={feld} id="verwaltung-passwort" type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoComplete="current-password" required />
          </label>
          {mitCode && <label className="eigenschaft"><span>{t('anmeldung.code.feld')}</span>
            <input id="verwaltung-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </label>}
        </>}
        {!wieder && ohnePasswort && <p className="leise klein">{t('konten.verwaltung.fehler.anbieter')}</p>}
        {fehler && <p className="fehlertext" role="alert">{fehler}</p>}
        <div className="rueckfrage-knoepfe">
          <button type="button" className="knopf" onClick={() => schliesse(false)}>{t('konten.verwaltung.dialog.abbrechen')}</button>
          {wieder && <button type="button" className="textknopf" onClick={() => void api.verwaltungBeenden().catch(() => undefined).finally(() => schliesse(false))}>{t('konten.verwaltung.beenden')}</button>}
          {ohnePasswort && !wieder
            ? <button type="button" className="knopf primaer" onClick={beimAnbieter}>{t('konten.verwaltung.dialog.anbieter')}</button>
            : <button type="submit" className="knopf primaer" disabled={sendet}>{wieder ? t('konten.verwaltung.dialog.wieder.knopf') : t('konten.verwaltung.dialog.knopf')}</button>}
        </div>
      </form>
    </dialog>
  );
}

/**
 * Notfallblatt & Co. (#819): Herunterladen eines Schlüssels ist eine heikle Handlung. Liegt die letzte Anmeldung länger
 * als 10 Minuten zurück, fragt Ablago vorher das Passwort ab – erst dann startet der Download (ein Link kann die Antwort
 * des Servers sonst nicht abfangen).
 */
export async function heikelHerunterladen(e: { preventDefault(): void }, url: string, nachher?: () => void) {
  e.preventDefault();
  const st = await api.status().catch(() => null);
  if (!st?.verwaltungsmodus?.frisch && !(await frischAngemeldet())) return;
  const a = Object.assign(document.createElement('a'), { href: url, download: '' });
  document.body.append(a); a.click(); a.remove();
  nachher?.();
}
