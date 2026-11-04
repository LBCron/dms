import { Kopf } from './Kopf';
import { useKonto } from '../konto';
import { Link } from '../ort';
import { useWartung } from '../wartung';
import { WiederherstellungsAssistent } from '../wiederherstellen';
import { Hilfe } from '../Hilfe';

/** Werkbank → Wiederherstellen (#107): nur im aktiven Wartungsmodus. */

export function WiederherstellungPanel({ abschnitt }: { abschnitt?: boolean } = {}) {
  const { aktualisieren } = useKonto();
  const { stand } = useWartung();
  return (
    <div className="einspaltig">
      <Kopf titel="Wiederherstellen" abschnitt={abschnitt} id="wiederherstellen">
        <p className="leise">Ersetzt den jetzigen Stand durch eine Sicherung. Vorher sichert Ablago den jetzigen Stand selbst. Eingespielt wird erst in einen eigenen Bereich; umgeschaltet wird nur, wenn alles geklappt hat – bricht etwas ab, bleibt alles, wie es ist. Danach startet Ablago neu, und alle melden sich neu an. <Hilfe ort="werkbank.wiederherstellung" /></p>
      </Kopf>
      {stand && stand.stufe !== 'aktiv' ? (
        <div className="hinweis warn stapel">
          <p><strong>Wiederherstellen geht nur im aktiven Wartungsmodus</strong>, damit niemand gleichzeitig arbeitet.</p>
          <div><Link to="/werkbank/wartung#wartungsmodus" className="knopf klein">Zum Wartungsmodus</Link></div>
        </div>
      ) : (
        <section className="blatt">
          <WiederherstellungsAssistent frisch={false} gestartet={() => void aktualisieren()} />
        </section>
      )}
    </div>
  );
}
