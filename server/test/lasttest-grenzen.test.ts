/**
 * Lasttest (#563): Ziel und CI-Grenze getrennt. Das Ziel (klein p95 < 300 ms, mittel < 1000 ms) steht im Bericht,
 * der Exit-Code richtet sich nach der CI-Grenze (erster GitHub-Lauf + 20 %, danach nur strenger).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface Durchgang { p95: number | null; fehler: number; ohneAntwort: number; fehlerquote: number; abgewiesen: number; exporte: { status: number }[] }
interface Stufe { ziel: { p95Ms: number; fehlerquote: number }; ciGrenze: { p95Ms: number } }
interface Lasttest {
  STUFEN: Record<'klein' | 'mittel', Stufe & { gleichzeitig: number; mappen: number; export: boolean }> & Record<'gross' | 'extrem', Record<string, unknown> & { mappen: number }>;
  PFLICHT: { speicherMb: number };
  PROFIL: Array<[string, number]>;
  PROFIL_SPEICHERN: Array<[string, number]>;
  HISTORIE_LESEN: Array<[string, number]>;
  SCHREIBEN: Array<[string, number]>;
  mappenFuer(stufe: string, wert?: string): number;
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

describe('Lasttest: mit Speichern und extrem (#739) – alte Stufen bleiben vergleichbar', () => {
  it('bisherige Stufen und Mischung unverändert (gleiche Last, gleiche Bestände)', () => {
    assert.deepEqual([lt.STUFEN.klein.gleichzeitig, lt.STUFEN.klein.mappen, lt.STUFEN.klein.export], [25, 5_000, false]);
    assert.deepEqual([lt.STUFEN.mittel.gleichzeitig, lt.STUFEN.mittel.mappen, lt.STUFEN.mittel.export], [100, 50_000, true]);
    const { mappenWahl: _w, mappen: mExtrem, bildet: _b, ...ablaufExtrem } = lt.STUFEN.extrem;
    const { mappen: mGross, bildet: _g, ...ablaufGross } = lt.STUFEN.gross;
    assert.equal(mGross, 200_000);
    assert.deepEqual(ablaufGross, { vorstufen: [5, 10], start: 25, schritt: 25, schrittSekunden: 120, hoechstens: 2000, abbruch: { p95Ms: 3000, fehlerquote: 0.01 }, ueberlast: 1000, verschlechterung: 0.2 });
    assert.deepEqual(ablaufExtrem, ablaufGross, 'extrem läuft wie groß');
    assert.equal(mExtrem, 500_000);
    assert.deepEqual(lt.PROFIL, [['Startseite', 15], ['Liste', 25], ['Mappe öffnen', 25], ['Suche', 15], ['Vorschaubild', 10], ['Herunterladen', 10]]);
  });

  it('Mischung mit Speichern: 10 % schreibend, 5 % Historie (#800), Lesen im selben Verhältnis wie bisher', () => {
    const summe = (p: Array<[string, number]>) => p.reduce((a, [, g]) => a + g, 0);
    assert.equal(Math.round(summe(lt.PROFIL_SPEICHERN) * 1000) / 1000, 100);
    assert.equal(summe(lt.SCHREIBEN), 10);
    assert.deepEqual(lt.SCHREIBEN.map(([a]) => a), ['Mappe ändern', 'Stern', 'Notiz', 'Aufgabe']);
    assert.deepEqual(lt.HISTORIE_LESEN, [['Historie', 5]]);
    for (const [a, g] of lt.PROFIL) assert.equal(lt.PROFIL_SPEICHERN.find(([b]) => b === a)![1], g * 0.85);
  });

  it('extrem: 500.000 als Vorgabe, 1 Mio. wählbar; sonst feste Bestände', () => {
    assert.equal(lt.mappenFuer('extrem', undefined), 500_000);
    assert.equal(lt.mappenFuer('extrem', '1000000'), 1_000_000);
    assert.equal(lt.mappenFuer('extrem', '1.000.000'), 1_000_000);
    assert.equal(lt.mappenFuer('extrem', '20000'), 20_000, 'kleiner nur zum Ausprobieren');
    assert.throws(() => lt.mappenFuer('extrem', 'viele'), /keine Anzahl/);
    assert.equal(lt.mappenFuer('gross', '1000000'), 200_000, '--mappen ändert die bisherigen Stufen nicht');
    assert.equal(lt.mappenFuer('klein', '1000000'), 5_000);
  });
});
