import type { ReactNode } from 'react';

/**
 * Kopf einer Werkbank-Seite. Seit #725 stehen manche frühere Bereiche als Abschnitt auf einer anderen Seite
 * (Wiederherstellen unter Sicherung, Wartungsmodus unter Wartung …): dann wird aus der Überschrift ein
 * Abschnittstitel mit Sprungmarke (`id`), damit alte Lesezeichen über `#…` an die richtige Stelle führen.
 */
export function Kopf({ titel, abschnitt, id, ueber = 'Werkbank', children }: { titel: ReactNode; abschnitt?: boolean; id?: string; ueber?: ReactNode; children?: ReactNode }) {
  if (abschnitt) {
    return (
      <div className="teilkopf" id={id}>
        <h2>{titel}</h2>
        {children}
      </div>
    );
  }
  return (
    <div className="mappenkopf" id={id}>
      <p className="ueber">{ueber}</p>
      <h1>{titel}</h1>
      {children}
    </div>
  );
}
