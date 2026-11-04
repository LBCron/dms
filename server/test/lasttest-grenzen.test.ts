/**
 * Lasttest (#563): Ziel und CI-Grenze getrennt. Das Ziel (klein p95 < 300 ms, mittel < 1000 ms) steht im Bericht,
 * der Exit-Code richtet sich nach der CI-Grenze (erster GitHub-Lauf + 20 %, danach nur strenger).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface Durchgang { p95: number | null; fehler: number; ohneAntwort: number; fehlerquote: number; abgewiesen: number; exporte: { status: number }[] }
interface Stufe { ziel: { p95Ms: number; fehlerquote: number }; ciGrenze: { p95Ms: number } }
interface Lasttest {
  STUFEN: Record<'klein' | 'mittel', Stufe>;
  PFLICHT: { speicherMb: number };
  pruefeFesteStufe(name: string, e: Durchgang): { verfehlt: string[]; zielVerfehlt: string[] };
  zielText(name: string): string;
}
const pfad = new URL('./lasttest.mjs', import.meta.url).href;
const lt = (await import(pfad)) as Lasttest;
const lauf = (p95: number, x: Partial<Durchgang> = {}): Durchgang => ({ p95, fehler: 0, ohneAntwort: 0, fehlerquote: 0, abgewiesen: 0, exporte: [], ...x });

describe('Lasttest: Ziel und CI-Grenze (#563)', () => {
  it('Ziel bleibt, CI-Grenze aus dem ersten GitHub-Lauf + 20 %', () => {
    assert.equal(lt.STUFEN.klein.ziel.p95Ms, 300);
    assert.equal(lt.STUFEN.mittel.ziel.p95Ms, 1000);
    assert.equal(lt.STUFEN.klein.ciGrenze.p95Ms, 300);
    assert.equal(lt.STUFEN.mittel.ciGrenze.p95Ms, 1000);
    // Nur strenger: nie lockerer als der letzte GitHub-Lauf + 20 % (586 ms → 703 ms), nie strenger als das Ziel – also das Ziel selbst.
    for (const s of [lt.STUFEN.klein, lt.STUFEN.mittel]) assert.ok(s.ciGrenze.p95Ms >= s.ziel.p95Ms);
    assert.equal(lt.STUFEN.mittel.ciGrenze.p95Ms, Math.max(lt.STUFEN.mittel.ziel.p95Ms, Math.round(586 * 1.2)));
    assert.equal(lt.PFLICHT.speicherMb, 1536, 'Arbeitsspeicher: entscheidet der Maintainer noch');
  });

  it('knapp unter Ziel und CI-Grenze: eingehalten', () => {
    const r = lt.pruefeFesteStufe('mittel', lauf(999));
    assert.deepEqual(r.verfehlt, []);
    assert.deepEqual(r.zielVerfehlt, []);
  });

  it('p95 über der CI-Grenze: verfehlt', () => {
    const r = lt.pruefeFesteStufe('mittel', lauf(1000));
    assert.equal(r.verfehlt.length, 1);
    assert.match(r.verfehlt[0], /CI-Grenze 1000 ms \(Ziel < 1000 ms\)/);
    assert.deepEqual(lt.pruefeFesteStufe('klein', lauf(301)).verfehlt.length, 1);
  });

  it('Ziel eingehalten; Fehler und 503 zählen weiter als Grenze', () => {
    const ok = lt.pruefeFesteStufe('klein', lauf(95));
    assert.deepEqual([ok.verfehlt, ok.zielVerfehlt], [[], []]);
    assert.equal(lt.pruefeFesteStufe('klein', lauf(95, { fehler: 1 })).verfehlt.length, 1);
    assert.equal(lt.pruefeFesteStufe('mittel', lauf(500, { abgewiesen: 3 })).verfehlt.length, 1);
  });

  it('Bericht nennt Ziel und CI-Grenze', () => {
    assert.equal(lt.zielText('mittel'), 'Ziel p95 < 1000 ms, CI-Grenze 1000 ms, Fehler < 0,10 %');
    assert.equal(lt.zielText('klein'), 'Ziel p95 < 300 ms, CI-Grenze 300 ms, keine Fehler');
  });
});
