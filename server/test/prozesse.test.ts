/**
 * Mehrere Prozesse (#745) ohne Datenbank: Einstellung DMS_PROZESSE, Aufteilung von Verbindungen und Arbeitern, der
 * Verbund (ein Prozess und echt mit node:cluster: Aufrufe beim Leiter, Teile, Fachfehler, Meldungen, Fragen an alle,
 * Neustart eines abgestürzten Prozesses, Beenden), Anstöße der weiteren Prozesse an den Leiter, der Paket-Läufer aus
 * der Ferne, hochgeladene Pakete über Prozessgrenzen, eigene Änderungen der Zähler, Aufräumen der Uploads.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { arbeiterAus } from '../src/arbeit';
import { teileArbeit } from '../src/aufteilung';
import { Auftraege } from '../src/auftrag';
import { speicherDateien } from '../src/dateispeicher';
import { verbindungenJeProzess } from '../src/db';
import { Dienst } from '../src/dienst';
import { speicherEinstellungen } from '../src/einstellungen';
import { Fachfehler } from '../src/fehler';
import { raeumeHochladenAuf } from '../src/hochladen';
import { speicherKurzzustand } from '../src/kurzzustand';
import { bedieneLaeufer, Fernlaeufer } from '../src/laeufer/fern';
import type { Paketlaeufer } from '../src/laeufer/verwaltung';
import { Paketverwaltung } from '../src/pakete';
import { kontext } from '../src/protokoll';
import { einzeln, empfohleneProzesse, prozesseAus, type Verbund } from '../src/prozesse';
import { speicherRepo } from '../src/repo-speicher';
import { Tresor } from '../src/tresor';
import { Haushaltsstand, MINDESTENS_MS, Zaehlerspeicher } from '../src/zaehlerspeicher';
import { zipPuffer } from '../src/zip';

const SERVER = fileURLToPath(new URL('..', import.meta.url));
/** Leser für /sys und /proc: ohne cgroup, Werte aus dem Test. */
const ohneCgroup = () => null;

describe('Einstellung DMS_PROZESSE (#745)', () => {
  it('Vorgabe 1 (Updates ändern nichts), Zahl, auto, Unsinn', () => {
    assert.deepEqual([prozesseAus({}, ohneCgroup).anzahl, prozesseAus({}, ohneCgroup).quelle], [1, 'vorgabe']);
    assert.deepEqual([prozesseAus({ DMS_PROZESSE: '3' }, ohneCgroup).anzahl, prozesseAus({ DMS_PROZESSE: '3' }, ohneCgroup).quelle], [3, 'umgebung']);
    const f = prozesseAus({ DMS_PROZESSE: '0' }, ohneCgroup);
    assert.equal(f.anzahl, 1);
    assert.equal(f.ungueltig, '0');
    assert.equal(prozesseAus({ DMS_PROZESSE: '17' }, ohneCgroup).anzahl, 1);
    assert.equal(prozesseAus({ DMS_PROZESSE: 'zwei' }, ohneCgroup).anzahl, 1);
    assert.equal(prozesseAus({ DMS_PROZESSE: 'AUTO' }, ohneCgroup).quelle, 'auto');
  });

  it('Empfehlung: Kerne − 1, höchstens 4; bei wenig Arbeitsspeicher (Raspberry Pi, kleines NAS) 1', () => {
    const GB = 1024 ** 3;
    assert.equal(empfohleneProzesse(1, 8 * GB), 1);
    assert.equal(empfohleneProzesse(2, 8 * GB), 1);
    assert.equal(empfohleneProzesse(4, 8 * GB), 3);
    assert.equal(empfohleneProzesse(6, 16 * GB), 4);
    assert.equal(empfohleneProzesse(32, 64 * GB), 4);
    assert.equal(empfohleneProzesse(4, 1 * GB), 1, 'Raspberry Pi mit 1 GB');
    // Grenze des Containers (cgroup v2): 4 Kerne, 1,5 GB → auto = 1.
    const cg = (p: string) => (p.endsWith('cpu.max') ? '400000 100000' : p.endsWith('memory.max') ? String(1.5 * GB) : p.endsWith('memory.current') ? '1000' : p.endsWith('cpu.stat') ? 'usage_usec 1' : null);
    assert.equal(prozesseAus({ DMS_PROZESSE: 'auto' }, cg).anzahl, 1);
  });

  it('Verbindungen je Prozess: zusammen nie über max_connections (mit Reserve)', () => {
    assert.deepEqual(verbindungenJeProzess(10, 1, 20), { max: 10, gekuerzt: false }, 'ein Prozess: wie bisher');
    assert.deepEqual(verbindungenJeProzess(10, 4, 100), { max: 10, gekuerzt: false });
    assert.deepEqual(verbindungenJeProzess(30, 4, 100), { max: 22, gekuerzt: true });
    assert.deepEqual(verbindungenJeProzess(10, 8, 20), { max: 2, gekuerzt: true }, 'mindestens 2');
    assert.deepEqual(verbindungenJeProzess(10, 4, null), { max: 10, gekuerzt: false });
  });

  it('Arbeiter: Vorgabe teilt sich auf die Prozesse auf, DMS_ARBEITER gilt je Prozess', () => {
    assert.equal(arbeiterAus({}, 8).groesse, 4);
    assert.equal(arbeiterAus({}, 8, 2).groesse, 2);
    assert.equal(arbeiterAus({}, 8, 4).groesse, 1);
    assert.equal(arbeiterAus({}, 2, 3).groesse, 1, 'mindestens 1');
    assert.equal(arbeiterAus({ DMS_ARBEITER: '3' }, 8, 4).groesse, 3);
  });
});

describe('Verbund mit einem Prozess (#745)', () => {
  it('Aufrufe, Meldungen und Fragen bleiben im eigenen Prozess', async () => {
    const v = einzeln();
    assert.deepEqual([v.mehrere, v.leiter, v.erster, v.nr, v.konsole], [false, true, true, 1, null]);
    v.bediene('summe', ([a, b]) => Number(a) + Number(b));
    v.bediene('teile', (_a, teil) => { teil('x'); return 'ok'; });
    assert.equal(await v.rufe('summe', [1, 2]), 3);
    const teile: unknown[] = [];
    assert.equal(await v.rufe('teile', [], { teil: (x) => teile.push(x) }), 'ok');
    assert.deepEqual(teile, ['x']);
    const gehoert: unknown[] = [];
    v.hoere('m', (d) => gehoert.push(d));
    v.melde('m', 1); v.melde('m', 2, 'alle'); v.melde('m', 3, 'andere');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(gehoert, [1, 2], 'an andere: niemand');
    assert.deepEqual((await v.frageAlle('summe')).map((p) => p.nr), [1]);
    assert.equal(v.beendeAlle('x'), false);
  });
});

describe('Verbund mit node:cluster (#745)', () => {
  it('Hauptprozess, Leiter und zwei weitere: Aufrufe, Fehler, Teile, Puffer, Meldungen, Neustart, Beenden', { timeout: 60_000 }, async () => {
    const { NODE_TEST_CONTEXT: _t, ...env } = process.env;
    const p = spawn(process.execPath, ['--import', 'tsx', 'test/hilfen-prozesse.ts'], { cwd: SERVER, env: { ...env, LOG_LEVEL: 'warn' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const zeilen: Array<Record<string, unknown>> = [];
    let rest = '', fehler = '';
    p.stdout.on('data', (d: Buffer) => {
      rest += d.toString();
      const teile = rest.split('\n'); rest = teile.pop()!;
      for (const z of teile) if (z.startsWith('{')) zeilen.push(JSON.parse(z));
    });
    p.stderr.on('data', (d: Buffer) => { fehler += d.toString(); });
    const warte = async (f: () => boolean, was: string) => {
      for (let i = 0; i < 400; i++) { if (f()) return; await new Promise((r) => setTimeout(r, 50)); }
      throw new Error(`${was} nicht erreicht: ${JSON.stringify(zeilen)}\n${fehler}`);
    };
    try {
      const ergebnisse = () => zeilen.filter((z) => z.art === 'ergebnis');
      await warte(() => ergebnisse().length >= 2, 'Ergebnisse von Prozess 2 und 3');
      for (const e of ergebnisse()) {
        assert.equal(e.leiter, false);
        assert.equal(e.summe, 5, 'Aufruf beim Leiter');
        assert.deepEqual(e.fehler, { fach: true, status: 409, text: 'Belegt', details: { grund: 'test' } }, 'Fachfehler mit Status und Einzelheiten');
        assert.deepEqual(e.teile, { wert: 'fertig', teile: ['a', 'b'] }, 'Teile vor dem Ergebnis');
        assert.equal(e.puffer, 'ab!', 'Puffer kommen als Bytes an');
        assert.deepEqual((e.alle as Array<{ nr: number; leiter: boolean; wert: { nr: number } | null }>).map((x) => [x.nr, x.leiter, x.wert?.nr ?? null]).filter((x) => x[2] !== null).map((x) => x[0]).includes(1), true);
      }
      const [e2, e3] = [ergebnisse().find((e) => e.nr === 2)!, ergebnisse().find((e) => e.nr === 3)!];
      assert.equal(typeof e2.konsole, 'string');
      assert.equal(e2.konsole, e3.konsole, 'ein gemeinsamer Schlüssel für den Befehl dms');
      await warte(() => zeilen.filter((z) => z.art === 'gruss').length >= 2, 'Meldungen an den Leiter');
      assert.ok(zeilen.filter((z) => z.art === 'gruss').every((z) => z.bei === 1), 'nur der Leiter hört „an den Leiter“');
      await warte(() => zeilen.filter((z) => z.art === 'alle').length >= 3, 'Meldung an alle');
      assert.deepEqual(zeilen.filter((z) => z.art === 'alle').map((z) => z.bei).sort(), [1, 2, 3]);
      // Absturz: Prozess 2 hart beenden – der Hauptprozess startet ihn neu, er läuft wieder durch.
      process.kill(Number(e2.pid), 'SIGKILL');
      await warte(() => ergebnisse().some((e) => e.nr === 2 && e.pid !== e2.pid), 'Neustart von Prozess 2');
      // Beenden: SIGTERM an den Hauptprozess beendet alle.
      p.kill('SIGTERM');
      const code = await new Promise((r) => p.once('exit', (c) => r(c)));
      assert.equal(code, 0);
      assert.deepEqual(zeilen.filter((z) => z.art === 'ende').map((z) => z.nr).sort(), [1, 2, 3]);
    } finally { if (p.exitCode === null) p.kill('SIGKILL'); }
  });
});

/** Verbund zum Mitschreiben: was ein weiterer Prozess an den Leiter schickt. */
function mitschreiber(antworten: Record<string, unknown> = {}) {
  const gemeldet: Array<[string, unknown]> = [];
  const gerufen: Array<[string, unknown[]]> = [];
  const hoerer = new Map<string, (d: unknown) => void>();
  const v: Verbund = {
    mehrere: false, anzahl: 2, nr: 2, leiter: false, erster: false, konsole: 'k', primaer: 1,
    bediene() {}, hoere(n, f) { hoerer.set(n, f); },
    async rufe<T>(n: string, a: unknown[] = []) { gerufen.push([n, a]); return antworten[n] as T; },
    melde(n, d) { gemeldet.push([n, d]); },
    async frageAlle() { return []; }, prozesse: () => [], bereit() {}, beendeAlle: () => true,
  };
  return { v, gemeldet, gerufen, hoerer };
}

describe('Weitere Prozesse geben Arbeit an den Leiter (#745)', () => {
  it('Texterkennung, Vorschaubilder, Ereignisse, Postfach, Eingang, Sicherung und Wiederherstellung', async () => {
    const lauf = { art: 'sicherung', titel: 'Sicherung', status: 'laeuft', schritt: 'x', bytes: 0, gesamt: 0, gestartet: '2026-11-05T00:00:00.000Z' };
    const { v, gemeldet, gerufen, hoerer } = mitschreiber({ 'sicherung.starte': lauf, spiegel: { sicherung: null, wiederherstellung: null, whLaeuft: false }, 'vorschau.nachholen': 2 });
    const d = new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() });
    const lokal = { anstossen: 0, verteilt: 0 };
    const te = { anstossen: () => { lokal.anstossen++; } };
    const vs = { anstossen: () => { lokal.anstossen++; }, einreihen: () => 0, ausFassung: () => 0, nachholen: async () => 0 };
    const si = { aktuellerLauf: () => null, laeuft: () => false, starte: async () => ({}), pruefe: () => ({}) };
    const wh = { aktuellerLauf: () => null, laeuft: () => false, starte: async () => ({}), starteProbe: async () => ({}) };
    const pf = { abrufen: async () => 0 };
    const ein = { pruefe: async () => 0 };
    d.ereignisse.wecke = () => { lokal.verteilt++; };
    const t = teileArbeit(v, { dienst: d, texterkennung: te, vorschau: vs, sicherung: si, wiederherstellung: wh, postfaecher: pf, eingangsordner: ein } as never);
    await t.start();
    (te as { anstossen(): void }).anstossen();
    const doc = { sha256: 'a'.repeat(64), mime: 'application/pdf', groesse: 10, name: 'brief.pdf', mappeId: 'm', id: 'd' };
    assert.equal((vs as unknown as { einreihen(x: unknown[]): number }).einreihen([doc]), 1);
    assert.equal(await (vs as unknown as { nachholen(x: unknown[]): Promise<number> }).nachholen([doc]), 2);
    d.ereignisse.wecke();
    assert.equal(await d.ereignisse.verteile(), 0, 'weitere Prozesse verteilen nie selbst');
    await (pf as { abrufen(id: string): Promise<number> }).abrufen('p1');
    await (ein as { pruefe(s?: boolean): Promise<number> }).pruefe(true);
    const s = await (si as unknown as { starte(a: string, v: string): Promise<{ lauf: unknown }> }).starte('manuell', 'lena@example.org');
    assert.deepEqual(s.lauf, lauf);
    assert.equal(lokal.anstossen + lokal.verteilt, 0, 'nichts läuft im eigenen Prozess');
    assert.deepEqual(gemeldet.map(([n]) => n), ['texterkennung.anstossen', 'vorschau.einreihen', 'ereignisse.wecke', 'ereignisse.wecke']);
    assert.deepEqual(gemeldet[1][1], [{ sha256: doc.sha256, mime: doc.mime, groesse: 10, name: 'brief.pdf' }], 'nur, was die Vorschau braucht');
    assert.deepEqual(gerufen.map(([n]) => n), ['spiegel', 'vorschau.nachholen', 'postfach.abrufen', 'eingang.pruefe', 'sicherung.starte']);
    // Spiegel vom Leiter: laeuft()/aktuellerLauf() ohne Warten.
    hoerer.get('spiegel')!({ sicherung: lauf, wiederherstellung: null, whLaeuft: true });
    assert.equal((si as { laeuft(): boolean }).laeuft(), true);
    assert.deepEqual((si as { aktuellerLauf(): unknown }).aktuellerLauf(), lauf);
    assert.equal((wh as { laeuft(): boolean }).laeuft(), true);
    t.stop();
  });

  it('Paket-Läufer aus der Ferne: Schnappschuss, Vektoren, Antworten in Teilen, Erkennen, Aktion', async () => {
    const v = einzeln();
    const leiterDienst = new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() });
    leiterDienst.paketKonten = new Map([['konto-1', 'paket.a']]);
    leiterDienst.erkennung.anbieter = { pakete: () => [{ id: 'paket.e', name: 'Erkennen', netz: false }], erkenne: async () => ({ text: '', ms: 0 }) };
    const aufrufe: string[] = [];
    const echt = {
      pid: 4711,
      vektorPaket: () => 'paket.v',
      paketMit: () => ({ id: 'paket.f', name: 'Fragen' }),
      aktion: async (p: string, a: string) => { aufrufe.push(`aktion ${p} ${a}`); return 'Erledigt.'; },
      codeGeaendert: async () => { aufrufe.push('code'); },
      ereignis: () => { aufrufe.push('ereignis'); },
      vektorFuer: async () => ({ paket: 'paket.v', modell: 'm', vektor: new Float32Array([0.5, 0.25]), schwelle: 0.3 }),
      schnittstelle: async (_p: string, aktion: string, _e: unknown, o: { teil?: (x: string) => void }) => { o.teil?.('Teil 1'); return { text: aktion, ms: 1 }; },
      uebersicht: async () => ({ laeuft: true }),
      vektorenNeu: async () => ({ entfernt: 3 }),
      stelleZu: async () => { aufrufe.push('zustellen'); },
    };
    bedieneLaeufer(v, echt as unknown as Paketlaeufer, leiterDienst);
    const d = new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() });
    const f = new Fernlaeufer(v, d);
    await f.start();
    assert.equal(f.pid, 4711);
    assert.deepEqual([...d.paketKonten], [['konto-1', 'paket.a']], 'Dienstkonten der Pakete kennt auch dieser Prozess');
    assert.equal(d.vektorAnbieter!.paket(), 'paket.v');
    assert.deepEqual([...(await d.vektorAnbieter!.vektorFuer('Strom', 1000))!.vektor], [0.5, 0.25]);
    assert.deepEqual(d.fragen.anbieter!.paket(), { id: 'paket.f', name: 'Fragen' });
    const teile: string[] = [];
    assert.deepEqual(await d.fragen.anbieter!.antworte('paket.f', {}, (x) => teile.push(x)), { text: 'dms:antworten', ms: 1 });
    assert.deepEqual(teile, ['Teil 1']);
    assert.deepEqual(d.erkennung.anbieter!.pakete(), [{ id: 'paket.e', name: 'Erkennen', netz: false }]);
    assert.equal((await d.erkennung.anbieter!.erkenne('paket.e', {}, 1000)).text, 'dms:erkennen');
    assert.equal(await f.aktion('paket.a', 'testen', {}), 'Erledigt.');
    await f.codeGeaendert();
    assert.deepEqual(await f.vektorenNeu(), { entfernt: 3 });
    d.ereignisWecker!();
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(aufrufe, ['aktion paket.a testen', 'code', 'zustellen']);
  });
});

describe('Zustand über Prozessgrenzen (#745)', () => {
  const ICH = { id: '00000000-0000-4000-8000-0000000000aa', email: 'lena@example.org' };
  const tmp: string[] = [];
  after(async () => { for (const t of tmp) await rm(t, { recursive: true, force: true }); });

  it('Hochgeladenes Paket: bei einem Prozess hochgeladen, beim anderen installiert; nur für den Dienstbenutzer lesbar', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'dms-a745-'));
    tmp.push(ordner);
    const basis = fileURLToPath(new URL('./pakete/basis', import.meta.url));
    const dateien: Array<{ name: string; daten: Buffer }> = [];
    const lies = (p: string, vor = '') => { for (const n of readdirSync(p)) { const x = join(p, n); if (statSync(x).isDirectory()) lies(x, `${vor}${n}/`); else dateien.push({ name: `${vor}${n}`, daten: readFileSync(x) }); } };
    lies(basis);
    const zip = zipPuffer(dateien);
    const pv = () => new Paketverwaltung(new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() }), {
      version: () => '0.197.0', katalogUrl: 'https://katalog.test/katalog.json', abruf: async () => { throw new Error('ohne Netz'); }, uploadOrdner: join(ordner, 'pakete'),
    });
    const a = pv(), b = pv();
    const h = await a.hochladen(zip, ICH);
    const liegt = readdirSync(join(ordner, 'pakete'));
    assert.equal(liegt.length, 2);
    assert.ok(liegt.every((n) => !n.includes(h.upload)), 'die Kennung steht nicht im Dateinamen');
    assert.ok(liegt.every((n) => (statSync(join(ordner, 'pakete', n)).mode & 0o077) === 0), 'nur für den Dienstbenutzer');
    const v = await b.vorschau({ upload: h.upload });
    assert.equal(v.pruefung?.art, 'datei');
    const inst = await b.installiere({ upload: h.upload, bestaetigt: true }, ICH);
    assert.equal(inst.herkunft.art, 'hochgeladen');
    assert.equal(readdirSync(join(ordner, 'pakete')).length, 0, 'nach dem Installieren weg');
    await assert.rejects(() => a.installiere({ upload: 'unbekannt', bestaetigt: true }, ICH), (e) => e instanceof Fachfehler && e.status === 410);
  });

  it('Eigene Änderungen der Zähler gelten sofort auch in einem anderen Prozess (#742)', async () => {
    let db = 1;
    const quelle = { lies: async () => db, erhoehe: async () => ++db };
    const z = speicherKurzzustand();
    const a = new Haushaltsstand(new Set(), quelle), b = new Haushaltsstand(new Set(), quelle);
    a.teileEigene(z); b.teileEigene(z);
    const speicherB = new Zaehlerspeicher<number>(b);
    let zaehlungen = 0;
    const zaehle = async () => ({ wert: ++zaehlungen, zeitabhaengig: false });
    await speicherB.hole('k', zaehle, { mindestensMs: MINDESTENS_MS, wer: 'jonas' });
    // Lena ändert etwas in Prozess A …
    await kontext.run({ benutzerId: 'lena' } as never, async () => { await a.erhoehe(); });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(db, 2);
    // … Jonas sieht in Prozess B noch kurz den alten Wert (Mindestgültigkeit), Lena dort sofort den neuen.
    assert.equal((await speicherB.hole('k', zaehle, { mindestensMs: MINDESTENS_MS, wer: 'jonas' })).art, 'treffer');
    assert.equal((await speicherB.hole('k', zaehle, { mindestensMs: MINDESTENS_MS, wer: 'lena' })).art, 'neu');
  });

  it('Werkbank-Auftrag: in einem Prozess gestartet, im anderen sichtbar, dort abbrechbar; nur einer zugleich', async () => {
    const z = speicherKurzzustand();
    const a = new Auftraege(), b = new Auftraege();
    a.teile(z); b.teile(z);
    const x = await a.angemeldet(a.starte('demo', 'Lauf in A', async (f, signal) => {
      for (let i = 0; !signal!.aborted && i < 500; i++) { f(i, 500); await new Promise((r) => setTimeout(r, 10)); }
      return 'ende';
    }, [], { abbrechbar: true }));
    const imB = await b.stand();
    assert.equal(imB?.id, x.id);
    assert.equal(imB?.status, 'laeuft');
    // Zweiter Auftrag in B: abgelehnt mit dem Titel des laufenden.
    const y = await b.angemeldet(b.starte('nummern', 'Lauf in B', async () => 'nie'));
    assert.equal(y.status, 'fehler');
    assert.match(y.fehler!, /Es läuft bereits: Lauf in A/);
    await new Promise((r) => setTimeout(r, 1100));
    assert.ok((await b.stand())!.fertig > 0, 'Fortschritt kommt im anderen Prozess an');
    assert.equal((await b.abbrechen(x.id)).abgebrochen, true);
    const ende = await a.warte();
    assert.equal(ende?.abgebrochen, true);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal((await b.stand())?.status, 'fertig');
    // Stirbt der Prozess mitten im Lauf (Belegung weg), zeigt der andere „unterbrochen“.
    await z.setze('auftrag', 'stand', { ...x, status: 'laeuft' }, null);
    assert.match((await b.stand())!.fehler!, /Unterbrochen/);
  });

  it('Schlüssel in einem Prozess erzeugt: der andere lädt ihn nach (Haushaltsstand lesen)', async () => {
    const o = await mkdtemp(join(tmpdir(), 'dms-a745-t-'));
    tmp.push(o);
    const e = speicherEinstellungen();
    const a = new Tresor(e, join(o, 'dms.schluessel'), () => null), b = new Tresor(e, join(o, 'dms.schluessel'), () => null);
    await a.laden(); await b.laden();
    await a.erzeuge();
    assert.equal(a.bereit, true);
    assert.equal(b.bereit, false);
    assert.equal(await b.nachladen(), true);
    assert.equal(b.bereit, true);
    assert.equal(b.entschluessele(a.verschluessele('geheim')), 'geheim');
  });

  it('Temporäre Uploads: neben anderen Prozessen nur alte löschen', async () => {
    const o = mkdtempSync(join(tmpdir(), 'dms-a745-h-'));
    tmp.push(o);
    writeFileSync(join(o, 'neu.tmp'), 'x');
    writeFileSync(join(o, 'alt.tmp'), 'x');
    const vor = (Date.now() - 7 * 3600_000) / 1000;
    utimesSync(join(o, 'alt.tmp'), vor, vor);
    assert.equal(await raeumeHochladenAuf(o, 6 * 3600_000), 1);
    assert.deepEqual(readdirSync(o), ['neu.tmp']);
    assert.equal(await raeumeHochladenAuf(o), 1, 'allein: alles');
  });
});
