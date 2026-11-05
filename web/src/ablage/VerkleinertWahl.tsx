import { STUFEN, STUFEN_LISTE, type Stufe } from '../../../shared/src/verkleinern';
import { Hilfe } from '../Hilfe';
import { t, tn } from '../sprache';

/**
 * „Verkleinert senden“ (#393) beim Weitergeben (Export, E-Mail, Herunterladen mit Stempel): PDFs gehen als
 * verkleinerte Kopie hinaus, das gespeicherte Dokument bleibt unverändert. null = nicht verkleinern.
 */
export function VerkleinertWahl({ wert, setze, wie = 'senden', id }: { wert: Stufe | null; setze(s: Stufe | null): void; wie?: 'senden' | 'exportieren' | 'herunterladen'; id: string }) {
  return (
    <div className="verkleinertwahl">
      <label className="haken" htmlFor={id}>
        <input id={id} type="checkbox" checked={!!wert} onChange={(e) => setze(e.target.checked ? 'standard' : null)} />
        <span>{tn('ablage.verkleinertwahl.pdfs-verkleinert', { wie, span: <span className="leise klein">{t('ablage.verkleinertwahl.bilder-heruntergerechnet-das')}</span> })}</span>
      </label>
      {wert && (
        <label className="inline klein">{t('ablage.verkleinertwahl.stufe')}{' '}<select value={wert} onChange={(e) => setze(e.target.value as Stufe)} aria-label={t('ablage.verkleinertwahl.stufe-beim-verkleinern')}>
            {STUFEN_LISTE.map((s) => <option key={s} value={s}>{t('ablage.verkleinertwahl.dpi', { name: STUFEN[s].name, dpi: STUFEN[s].dpi })}</option>)}
          </select>
        </label>
      )}
      <Hilfe ort="versenden.verkleinert" />
    </div>
  );
}
