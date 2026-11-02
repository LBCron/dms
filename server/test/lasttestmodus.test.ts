/**
 * Lasttest-Modus (#612): Variable, Speicherart, Ergebnisblock mit Gerät und Speicher, Seite mit Fortschritt,
 * Herunterfahren und Neustart danach. Das Skript ist hier ein Stellvertreter (Meldungen wie lasttest.mjs); der echte
 * Lauf steht in lasttestmodus-e2e.test.ts.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { after, describe, it } from 'node:test';
import { bereinigeGeraet, fuelleErgebnis, PLATZHALTER, restMinuten, type LasttestStand } from '../../shared/src/lasttest';
import { Lasttestmodus, lasttestAus } from '../src/lasttestmodus';
import { erkenneSpeicherart, geraeteNummer } from '../src/speicherart';

const WURZEL = new URL('../..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'dms-lasttest-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

async function freierPort(): Promise<number> {
  return new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(() => r(typeof a === 'object' && a ? a.port : 0)); }); });
}

describe('Lasttest-Modus (#612): Variable', () => {
  it('klein, mittel, gross, groß, alle – sonst aus mit Hinweis', () => {
    assert.deepEqual(lasttestAus({}), { wahl: null, dauer: null, fehler: null });
    assert.equal(lasttestAus({ DMS_LASTTEST: 'klein' }).wahl, 'klein');
    assert.equal(lasttestAus({ DMS_LASTTEST: ' Mittel ' }).wahl, 'mittel');
    assert.equal(lasttestAus({ DMS_LASTTEST: 'groß' }).wahl, 'gross');
    assert.equal(lasttestAus({ DMS_LASTTEST: 'alle' }).wahl, 'alle');
    for (const aus of ['', 'aus', '0', 'nein']) assert.deepEqual(lasttestAus({ DMS_LASTTEST: aus }), { wahl: null, dauer: null, fehler: null });
    const falsch = lasttestAus({ DMS_LASTTEST: 'riesig' });
    assert.equal(falsch.wahl, null);
    assert.match(falsch.fehler!, /keine Stufe.*startet normal/);
    assert.equal(lasttestAus({ DMS_LASTTEST: 'klein', DMS_LASTTEST_DAUER: '10' }).dauer, 10);
    assert.match(lasttestAus({ DMS_LASTTEST: 'klein', DMS_LASTTEST_DAUER: 'kurz' }).fehler!, /DMS_LASTTEST_DAUER/);
  });

  it('steht in keiner Vorlage für App-Stores und NAS (nur in der Anleitung)', () => {
    const dateien = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? dateien(join(d, n)) : [join(d, n)]));
    // Vorlagen: Compose-Dateien, App-Store-Vorlagen, Einrichtungsskripte – nicht die Probe der CI (deploy/*-probe.sh).
    const vorlagen = [...dateien(join(WURZEL, 'deploy')), join(WURZEL, 'docker-compose.yml')].filter((f) => !f.endsWith('-probe.sh'));
    assert.ok(vorlagen.length > 5);
    const treffer = vorlagen.filter((f) => readFileSync(f, 'utf8').includes('DMS_LASTTEST'));
    assert.deepEqual(treffer, []);
  });
});

describe('Lasttest-Modus (#612): Speicherart erkennen', () => {
  /** Nachgebautes /sys: Platten mit queue/rotational, Partitionen, RAID mit slaves, dev/block-Verweise. */
  function sys(platten: Record<string, '0' | '1'>, extra: (s: string) => void = () => {}) {
    const s = mkdtempSync(join(tmp, 'sys-'));
    for (const d of ['devices', 'block', 'class/block', 'dev/block']) mkdirSync(join(s, d), { recursive: true });
    for (const [n, rot] of Object.entries(platten)) {
      const p = join(s, 'devices', n);
      mkdirSync(join(p, 'queue'), { recursive: true });
      mkdirSync(join(p, 'device'));
      writeFileSync(join(p, 'queue/rotational'), `${rot}\n`);
      symlinkSync(p, join(s, 'block', n));
      symlinkSync(p, join(s, 'class/block', n));
    }
    extra(s);
    return s;
  }
  const dev = (major: number, minor: number) => major * 256 + minor;

  it('Gerätenummer aus stat().dev', () => {
    assert.deepEqual(geraeteNummer(dev(8, 1)), { major: 8, minor: 1 });
    assert.deepEqual(geraeteNummer(dev(259, 3)), { major: 259, minor: 3 });
  });

  it('Partition einer SSD, NVMe, Festplatte', () => {
    const s = sys({ sda: '0', sdb: '1', nvme0n1: '0' }, (x) => {
      mkdirSync(join(x, 'devices/sda/sda1')); writeFileSync(join(x, 'devices/sda/sda1/partition'), '1');
      symlinkSync(join(x, 'devices/sda/sda1'), join(x, 'dev/block/8:1'));
      symlinkSync(join(x, 'devices/sdb'), join(x, 'dev/block/8:16'));
      symlinkSync(join(x, 'devices/nvme0n1'), join(x, 'dev/block/259:0'));
    });
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(8, 1) }), 'SSD');
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(8, 16) }), 'HDD');
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(259, 0) }), 'NVMe');
  });

  it('RAID aus zwei Festplatten; gemischt oder ohne Blockgerät nur, wenn alle Platten gleich sind', () => {
    const s = sys({ sda: '1', sdb: '1', sdc: '0' }, (x) => {
      mkdirSync(join(x, 'devices/md0/slaves'), { recursive: true });
      for (const n of ['sda', 'sdb']) symlinkSync(join(x, 'devices', n), join(x, 'devices/md0/slaves', n));
      symlinkSync(join(x, 'devices/md0'), join(x, 'dev/block/9:0'));
      mkdirSync(join(x, 'devices/md1/slaves'), { recursive: true });
      for (const n of ['sda', 'sdc']) symlinkSync(join(x, 'devices', n), join(x, 'devices/md1/slaves', n));
      symlinkSync(join(x, 'devices/md1'), join(x, 'dev/block/9:1'));
    });
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(9, 0) }), 'HDD');
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(9, 1) }), null, 'gemischt: lieber fragen');
    // overlay des Containers (Hauptnummer 0): alle Platten – hier gemischt.
    assert.equal(erkenneSpeicherart('/', { sys: s, dev: dev(0, 52) }), null);
    assert.equal(erkenneSpeicherart('/', { sys: sys({ nvme0n1: '0', nvme1n1: '0' }), dev: dev(0, 52) }), 'NVMe');
    assert.equal(erkenneSpeicherart('/', { sys: join(tmp, 'gibt-es-nicht'), dev: dev(8, 0) }), null);
  });
});

/** Ergebnisblock aus dem Skript (dieselbe Funktion wie auf der Konsole) mit den Platzhaltern des Lasttest-Modus. */
interface Skript {
  PLATZHALTER: typeof PLATZHALTER;
  ergebnisblock(e: unknown[], x: unknown, u: unknown, a?: { geraet?: string; speicher?: string }): string;
}
const skript = (await import(new URL('./lasttest.mjs', import.meta.url).href)) as Skript;
const umgebung = { version: '0.144.0', image: 'dms-komplett', datenbank: 'im Container', architektur: 'x64', cpu: 'Beispiel-CPU', kerne: 4, kerneBegrenzt: false, rechnerKerne: 4, ramGb: 15.5, ramBegrenzt: false, grenzen: null };
const ergebnisse = [{ stufe: 'klein', art: 'zusage', verfehlt: [], zielVerfehlt: [], durchgang: { n: 25, median: 40, p95: 90, p99: 120, fehlerquote: 0 } }];
const x = { bestand: { gesamt: 5013, demo: 5000 }, dokumente: 110, laeufe: [{ speicherMbMax: 300, schleifeP99: 12 }] };

describe('Lasttest-Modus (#612): Ergebnisblock', () => {
  it('Platzhalter wie im Skript; Gerät und Speicher werden eingesetzt', () => {
    assert.deepEqual(skript.PLATZHALTER, PLATZHALTER);
    const vorlage = skript.ergebnisblock(ergebnisse, x, umgebung, skript.PLATZHALTER);
    assert.match(vorlage, /Gerät\/Modell: \{\{geraet\}\}/);
    assert.match(vorlage, /Speicher: \{\{speicher\}\}/);
    const block = fuelleErgebnis(vorlage, { geraet: 'UGREEN DXP4800 Plus, 16 GB RAM', speicher: 'SSD' }, 'SSD');
    assert.match(block, /Gerät\/Modell: UGREEN DXP4800 Plus, 16 GB RAM\n/);
    assert.match(block, /Speicher: SSD \(erkannt\)/);
    assert.match(fuelleErgebnis(vorlage, { geraet: '', speicher: 'HDD' }, 'SSD'), /Gerät\/Modell: bitte ergänzen\n[\s\S]*Speicher: HDD\n/);
    assert.match(fuelleErgebnis(vorlage, { geraet: '', speicher: 'unbekannt' }, null), /Speicher: weiß nicht/);
    assert.match(fuelleErgebnis(vorlage, { geraet: '', speicher: null }, null), /Speicher: bitte ergänzen \(HDD\/SSD\/NVMe\)/);
    // Wie bisher auf der Konsole: ohne Angaben „bitte ergänzen“.
    assert.match(skript.ergebnisblock(ergebnisse, x, umgebung, {}), /Gerät\/Modell: bitte ergänzen/);
  });

  it('Gerät: eine Zeile, ohne Backticks, höchstens 120 Zeichen', () => {
    assert.equal(bereinigeGeraet('NAS\n```\nmehr'), "NAS ''' mehr");
    assert.equal(bereinigeGeraet('x'.repeat(300)).length, 120);
    assert.equal(bereinigeGeraet(undefined), '');
  });

  it('Restdauer: Schätzung der Stufe minus vergangene Zeit, mindestens der laufende Durchgang', () => {
    const s = { wahl: 'alle' as const, stufe: 'klein' as const, fertigeStufen: [], stufeBegonnen: 0, jetzt: 60_000, durchgang: null, zustand: 'laeuft' as const };
    assert.deepEqual(restMinuten(s), [2 + 15 + 30, 4 + 30 + 60]);
    assert.deepEqual(restMinuten({ ...s, wahl: 'klein' }), [2, 4]);
    assert.equal(restMinuten({ ...s, wahl: 'klein', jetzt: 10 * 60_000 }), null, 'gleich fertig');
    assert.deepEqual(restMinuten({ ...s, wahl: 'klein', jetzt: 10 * 60_000, durchgang: { name: 'klein', n: 25, ende: 12 * 60_000 } }), [2, 2]);
    assert.equal(restMinuten({ ...s, zustand: 'fertig' }), null);
  });
});

/** Stellvertreter für den Kindprozess: nimmt Meldungen an wie fork() mit IPC. */
class FalschesKind extends EventEmitter {
  getoetet = false;
  kill() { this.getoetet = true; setImmediate(() => this.emit('exit', null)); return true; }
  sende(m: object) { this.emit('message', m); }
}

describe('Lasttest-Modus (#612): Seite', () => {
  const ordner = join(tmp, 'ergebnis');
  let kind: FalschesKind | null = null;
  let aufrufe: string[][] = [];
  let beendet = 0;
  let port = 0;
  const neu = async () => {
    port = await freierPort();
    const m = new Lasttestmodus({
      wahl: 'klein', dauer: 5, skript: '/x/lasttest.mjs', ziel: 'http://127.0.0.1:1', ergebnisOrdner: ordner, env: {}, speicherart: 'SSD',
      port, host: '127.0.0.1', beenden: () => { beendet++; },
      starte: (_s, args) => { aufrufe.push(args); kind = new FalschesKind(); return kind as unknown as ChildProcess; },
    });
    await m.start();
    return m;
  };
  const hole = async (pfad: string, o: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${pfad}`, o);
  const stand = async () => (await (await hole('/api/lasttest')).json()) as LasttestStand;
  const post = (pfad: string, body: unknown, mitKennung = true) => hole(pfad, { method: 'POST', headers: { 'content-type': 'application/json', ...(mitKennung ? { 'x-dms': '1' } : {}) }, body: JSON.stringify(body) });

  it('Fortschritt, Gerät und Speicher, Ergebnis, Datei – ohne Zugangsdaten; keine Ablage', async () => {
    const m = await neu();
    try {
      assert.deepEqual(aufrufe[0], ['klein', '--ziel', 'http://127.0.0.1:1', '--dauer', '5']);
      assert.equal(((await (await hole('/api/konto/status')).json()) as { lasttest: boolean }).lasttest, true);
      assert.equal((await hole('/api/mappen')).status, 503, 'keine nutzbare Ablage');
      assert.equal((await hole('/api/konto/anmelden', { method: 'POST' })).status, 503);
      let s = await stand();
      assert.equal(s.zustand, 'laeuft');
      assert.equal(s.speicherErkannt, 'SSD');
      assert.equal(s.angaben.speicher, 'SSD');
      kind!.sende({ art: 'stufe', stufe: 'klein', nr: 1, von: 1 });
      kind!.sende({ art: 'schritt', schritt: 'demo', anzahl: 5000, mappen: 5000 });
      kind!.sende({ art: 'demo', fertig: 1200, gesamt: 5000 });
      s = await stand();
      assert.deepEqual([s.stufe, s.schritt, s.demo], ['klein', 'demo', { fertig: 1200, gesamt: 5000 }]);
      kind!.sende({ art: 'durchgang', name: 'klein', n: 25, dauer: 5 });
      s = await stand();
      assert.equal(s.schritt, 'messen');
      assert.ok(s.durchgang && s.durchgang.ende > s.jetzt);
      kind!.sende({ art: 'durchgang-fertig', name: 'klein', n: 25, p95: 90, fehlerquote: 0 });
      // Gerät ohne Kennung der Oberfläche: abgelehnt.
      assert.equal((await post('/api/lasttest/angaben', { geraet: 'X' }, false)).status, 403);
      assert.equal((await post('/api/lasttest/angaben', { speicher: 'Diskette' })).status, 400);
      assert.equal((await post('/api/lasttest/angaben', { geraet: 'Beispiel-NAS\n16 GB', speicher: 'HDD' })).status, 200);
      const vorlage = skript.ergebnisblock(ergebnisse, x, umgebung, skript.PLATZHALTER);
      kind!.sende({ art: 'ergebnis', bericht: '## Lasttest', vorlage, verfehlt: false });
      kind!.emit('exit', 0);
      s = await stand();
      assert.equal(s.zustand, 'fertig');
      assert.deepEqual(s.fertigeStufen, ['klein']);
      assert.equal(s.durchgaenge[0].p95, 90);
      assert.equal(s.angaben.geraet, 'Beispiel-NAS 16 GB');
      const text = JSON.stringify(s);
      for (const geheim of ['passwort', 'lasttest-passwort', 'einrichtungscode', '127.0.0.1']) assert.ok(!text.toLowerCase().includes(geheim), `Stand enthält ${geheim}`);
      // Datei unter /data/ergebnis mit Gerät und Speicher.
      await new Promise((r) => setTimeout(r, 100));
      const datei = readFileSync(join(ordner, 'lasttest-klein.md'), 'utf8');
      assert.match(datei, /Gerät\/Modell: Beispiel-NAS 16 GB/);
      assert.match(datei, /Speicher: HDD\n/);
      assert.equal(s.datei, join(ordner, 'lasttest-klein.md'));

      // Herunterfahren nur mit Kennung; danach Merker, Stand und beenden().
      assert.equal((await post('/api/lasttest/beenden', {}, false)).status, 403);
      assert.equal(beendet, 0);
      assert.equal((await post('/api/lasttest/beenden', {})).status, 200);
      await new Promise((r) => setTimeout(r, 600));
      assert.equal(beendet, 1);
      assert.ok(existsSync(join(ordner, 'beendet')));
      await assert.rejects(hole('/api/lasttest'), 'Seite ist zu');
    } finally { await m.stop(); }
  });

  it('nach dem Beenden neu gestartet (Neustart-Regel): kein zweiter Lauf, Ergebnis bleibt sichtbar', async () => {
    aufrufe = [];
    const m = await neu();
    try {
      const s = await stand();
      assert.equal(s.zustand, 'beendet');
      assert.deepEqual(aufrufe, [], 'Skript nicht noch einmal gestartet');
      assert.match(s.ergebnis!.vorlage, /\{\{geraet\}\}/);
      assert.equal(s.angaben.geraet, 'Beispiel-NAS 16 GB');
    } finally { await m.stop(); }
  });

  it('Abbruch des Skripts (Schutz der echten Ablage) und unerwartetes Ende', async () => {
    rmSync(ordner, { recursive: true, force: true });
    aufrufe = [];
    let m = await neu();
    try {
      kind!.sende({ art: 'abbruch', text: 'Dieses DMS ist schon eingerichtet, aber nicht vom Lasttest.' });
      kind!.emit('exit', 2);
      const s = await stand();
      assert.equal(s.zustand, 'abbruch');
      assert.match(s.meldung!, /nicht vom Lasttest/);
    } finally { await m.stop(); }
    m = await neu();
    try {
      kind!.emit('exit', 1);
      assert.equal((await stand()).zustand, 'fehler');
    } finally { await m.stop(); }
  });
});
