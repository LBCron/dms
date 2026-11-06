import { useEffect, useRef } from 'react';
import { starteNachladen, type Schrittart } from './nachladen';

/**
 * React-Hülle für den Baustein aus nachladen.ts (#919): fragt `hole` im Takt ab, solange die Komponente da ist (und
 * `an`), und ruft `melde` nur bei Änderung. Die Rückrufe dürfen sich bei jedem Aufbau ändern – es gilt der jüngste.
 */
export function useNachladen<T>(hole: () => Promise<T>, melde: (wert: T) => void, o: Schrittart & { an?: boolean } = {}) {
  const r = useRef({ hole, melde });
  r.current = { hole, melde };
  const an = o.an !== false;
  const { nachlauf, erstesMelden } = o;
  useEffect(() => {
    if (!an) return;
    return starteNachladen<T>({ hole: () => r.current.hole(), melde: (w) => r.current.melde(w), nachlauf, erstesMelden });
  }, [an, nachlauf, erstesMelden]);
}
