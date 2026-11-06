/**
 * Angezeigtes holt sich den neuen Stand selbst (#919).
 * Über HTTP (Fastify inject) wie im Betrieb; der Baustein der Oberfläche (web/src/nachladen.ts) als reine Logik.
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { ANFANG, schritt, starteNachladen, TAKT_MS, type Umgebung } from '../../web/src/nachladen';
import { speicherDateien } from '../src/dateispeicher';
import { Dienst } from '../src/dienst';
import { speicherEinstellungen } from '../src/einstellungen';
import { Konten } from '../src/konten';
import { speicherKontoRepo, type KontoRepo } from '../src/konto-repo';
import { speicherRepo } from '../src/repo-speicher';
import { imModus } from './hilfen';

const PW = 'ein-langes-passwort';
const MIN = 60_000;

async function aufbau() {
  const d = new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() });
  const grund = speicherKontoRepo();
  // Zählt, wie oft „zuletzt aktiv“ einer Sitzung gesetzt wird; die Sitzung gilt dafür immer als lange unberührt.
  const beruehrt = { n: 0 };
  const repo: KontoRepo = {
    ...grund,
    holeSitzung: async (h) => { const s = await grund.holeSitzung(h); return s && { ...s, zuletztAktiv: new Date(0) }; },
    holeAnmeldung: async (h) => { const x = await grund.holeAnmeldung!(h); return x && { ...x, sitzung: { ...x.sitzung, zuletztAktiv: new Date(0) } }; },
    beruehreSitzung: async (h) => { beruehrt.n++; await grund.beruehreSitzung(h); },
  };
  const konten = new Konten(repo, null, 'http://nas', d.benutzerspiegel());
  d.verbindeKonten(konten.papierkorbHaken());
  const { benutzer: lena } = await konten.einrichten({ email: 'lena@example.org', name: 'Lena', passwort: PW });
  const mitPasswort = async (email: string, name: string) => {
    const r = await konten.legeBenutzerAn({ email, name }, lena.id);
    await konten.passwortSetzen({ schluessel: r.link!.split('/passwort/')[1], passwort: PW });
    return r.benutzer;
  };
  const markus = await mitPasswort('markus@example.org', 'Markus');
  const petra = await mitPasswort('petra@example.org', 'Petra');
  await konten.setzeVerwaltung(imModus(lena), markus.id, ['benutzer']);
  await d.gleicheBenutzerAb(await konten.listeBenutzer());
  const { baueApp } = await import('../src/http');
  const { ApiSchluesselDienst, speicherApiSchluesselRepo } = await import('../src/apischluessel');
  const app = await baueApp(d, konten, { apiSchluessel: new ApiSchluesselDienst(speicherApiSchluesselRepo()) });
  const anmelden = async (email: string) => {
    const r = await app.inject({ method: 'POST', url: '/api/konto/anmelden', payload: { email, passwort: PW }, headers: { 'x-dms': '1' } });
    assert.equal(r.statusCode, 200, r.body);
    return ([] as string[]).concat(r.headers['set-cookie'] as string | string[])[0].split(';')[0];
  };
  const rufe = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown, kopf: Record<string, string> = {}) =>
    app.inject({ method, url, ...(payload === undefined ? {} : { payload: payload as object }), headers: { 'x-dms': '1', cookie, ...kopf } });
  const verwalten = (cookie: string) => rufe(cookie, 'POST', '/api/konto/verwaltung', {});
  const jetzt = { t: Date.now() };
  konten.uhr = () => jetzt.t;
  return { d, konten, grund, beruehrt, app, lena, markus, petra, anmelden, rufe, verwalten, jetzt };
}

/** Umgebung zum Durchspielen: Sichtbarkeit von Hand, Zeitgeber als Liste. */
function probeUmgebung() {
  let sichtbar = true;
  const hoerer = new Set<() => void>();
  const wartend: Array<{ ms: number; f: () => void; weg: boolean }> = [];
  const u: Umgebung = {
    sichtbar: () => sichtbar,
    beiSichtbarkeit: (f) => { hoerer.add(f); return () => hoerer.delete(f); },
    spaeter: (ms, f) => { const w = { ms, f, weg: false }; wartend.push(w); return () => { w.weg = true; }; },
    zufall: () => 0.5,
  };
  const ruhe = () => new Promise((r) => setImmediate(r));
  return {
    u,
    /** Nächsten Takt auslösen (wenn einer geplant ist). */
    async takt() { const w = wartend.filter((x) => !x.weg).shift(); if (!w) return false; w.weg = true; w.f(); await ruhe(); return true; },
    geplant: () => wartend.filter((x) => !x.weg),
    async setzeSichtbar(an: boolean) { sichtbar = an; for (const f of hoerer) f(); await ruhe(); },
    ruhe,
    hoerer: () => hoerer.size,
  };
}

describe('Baustein „von selbst nachladen“ (#919, web/src/nachladen.ts)', () => {
  it('Schritt: erster Wert nur merken, Nachlauf einmal, gleicher Stand → nichts, Änderung → laden', () => {
    let z = ANFANG;
    const lauf = (s: string, o = {}) => { const r = schritt(z, s, o); z = r.zustand; return r.melden; };
    assert.equal(lauf('a'), false, 'erster Wert: die Seite hat schon geladen');
    assert.equal(lauf('a'), true, 'Nachlauf: Zahlen anderer dürfen kurz nachhinken');
    assert.equal(lauf('a'), false);
    assert.equal(lauf('a'), false, 'Stand gleich → kein Nachladen');
    assert.equal(lauf('b'), true, 'Stand geändert → nachladen');
    assert.equal(lauf('b'), true, 'und noch einmal im nächsten Takt');
    assert.equal(lauf('b'), false);
    // Für Listen, die selbst angezeigt werden (#921): ersten Wert melden, kein Nachlauf.
    z = ANFANG;
    assert.equal(lauf('x', { erstesMelden: true, nachlauf: false }), true);
    assert.equal(lauf('x', { erstesMelden: true, nachlauf: false }), false);
    assert.equal(lauf('y', { erstesMelden: true, nachlauf: false }), true);
    assert.equal(lauf('y', { erstesMelden: true, nachlauf: false }), false);
  });

  it('Abfrage: Takt 10–15 s, gleicher Stand → keine weitere Anfrage der Seite; Hintergrund-Tab fragt nicht, zurück sofort', async () => {
    const p = probeUmgebung();
    let stand = 's1';
    let gefragt = 0;
    let geladen = 0;
    const stopp = starteNachladen({ hole: async () => { gefragt++; return stand; }, melde: () => { geladen++; }, umgebung: p.u });
    await p.ruhe();
    assert.equal(gefragt, 1, 'gleich beim Start einmal');
    assert.equal(p.geplant()[0].ms, TAKT_MS[0] + Math.floor(0.5 * (TAKT_MS[1] - TAKT_MS[0] + 1)));
    assert.ok(p.geplant()[0].ms >= 10_000 && p.geplant()[0].ms <= 15_000);
    await p.takt();
    assert.equal(geladen, 1, 'Nachlauf nach dem ersten Wert');
    for (let i = 0; i < 5; i++) await p.takt();
    assert.equal(gefragt, 7);
    assert.equal(geladen, 1, 'Stand gleich → die Seite lädt nichts nach');
    stand = 's2';
    await p.takt();
    assert.equal(geladen, 2, 'Stand geändert → einmal nachladen');
    await p.takt();
    await p.takt();
    assert.equal(geladen, 3, 'ein Nachlauf, dann Ruhe');
    // Hintergrund-Tab: kein Takt mehr geplant, keine Anfrage.
    await p.setzeSichtbar(false);
    assert.equal(p.geplant().length, 0);
    const vorher = gefragt;
    assert.equal(await p.takt(), false);
    assert.equal(gefragt, vorher, 'im Hintergrund wird nicht gefragt');
    // Zurück im Tab: sofort einmal, danach wieder im Takt.
    stand = 's3';
    await p.setzeSichtbar(true);
    assert.equal(gefragt, vorher + 1);
    assert.equal(geladen, 4);
    assert.equal(p.geplant().length, 1);
    // Fehler (nicht erreichbar): nichts melden, weiter im Takt.
    const geladenVorher = geladen;
    stopp();
    assert.equal(p.geplant().length, 0, 'beendet: nichts mehr geplant');
    assert.equal(p.hoerer(), 0, 'beendet: kein Hörer mehr');
    let fehler = 0;
    const p2 = probeUmgebung();
    const stopp2 = starteNachladen({ hole: async () => { fehler++; throw new Error('weg'); }, melde: () => { geladen++; }, umgebung: p2.u });
    await p2.ruhe();
    await p2.takt();
    assert.equal(fehler, 2);
    assert.equal(geladen, geladenVorher);
    assert.equal(p2.geplant().length, 1);
    stopp2();
  });

  it('startet im Hintergrund-Tab nicht, sondern erst beim Zurückkehren', async () => {
    const p = probeUmgebung();
    await p.setzeSichtbar(false);
    let gefragt = 0;
    const stopp = starteNachladen({ hole: async () => { gefragt++; return 1; }, melde: () => {}, umgebung: p.u });
    await p.ruhe();
    assert.equal(gefragt, 0);
    await p.setzeSichtbar(true);
    assert.equal(gefragt, 1);
    stopp();
  });
});

describe('Stand der Ablage (#919, GET /api/ablage/stand)', () => {
  const offen: Array<() => Promise<unknown>> = [];
  after(async () => { for (const f of offen) await f(); });

  it('gleich, solange sich nichts ändert; anders nach einer Änderung; nur ein kurzer Wert ohne Inhalt', async () => {
    const x = await aufbau();
    offen.push(() => x.app.close());
    const c = await x.anmelden('petra@example.org');
    const stand = async () => { const r = await x.rufe(c, 'GET', '/api/ablage/stand'); assert.equal(r.statusCode, 200, r.body); return r.json() as { stand: string } };
    const s1 = await stand();
    assert.deepEqual(Object.keys(s1), ['stand']);
    assert.match(s1.stand, /^[\w-]{10,40}$/);
    assert.equal((await stand()).stand, s1.stand, 'nichts geändert → gleicher Stand');
    await x.d.legeTypAn({ id: crypto.randomUUID(), name: 'Notiz', felder: [{ key: 'name', label: 'Name', typ: 'text' }], register: [{ key: 'a', name: 'A', art: 'felder', felder: ['name'] }], trefferliste: ['_titel'] });
    const s2 = await stand();
    assert.notEqual(s2.stand, s1.stand, 'nach einer Änderung ein anderer Stand');
    assert.equal((await stand()).stand, s2.stand);
    // Ohne Anmeldung nichts; nicht in der öffentlichen Schnittstelle.
    assert.equal((await x.app.inject({ method: 'GET', url: '/api/ablage/stand' })).statusCode, 401);
    assert.equal((await x.rufe(c, 'GET', '/api/v1/ablage/stand')).statusCode, 404);
  });

  it('zählt nicht als Aktivität: „zuletzt aktiv“ bleibt, der Verwaltungsmodus verlängert sich nicht', async () => {
    const x = await aufbau();
    offen.push(() => x.app.close());
    const c = await x.anmelden('lena@example.org');
    x.beruehrt.n = 0;
    assert.equal((await x.rufe(c, 'GET', '/api/ablage/stand', undefined, { 'x-dms-aktiv': '1' })).statusCode, 200);
    assert.equal(x.beruehrt.n, 0, 'die Abfrage setzt „zuletzt aktiv“ nicht');
    assert.equal((await x.rufe(c, 'GET', '/api/sichten')).statusCode, 200);
    assert.equal(x.beruehrt.n, 1, 'eine gewöhnliche Anfrage schon (Gegenprobe)');
    assert.equal((await x.verwalten(c)).statusCode, 200);
    const imModus = (await x.rufe(c, 'GET', '/api/ablage/stand')).json().stand;
    x.jetzt.t += 10 * MIN;
    // Auch mit dem Kennzeichen „aktiv“ (kurz nach einer Eingabe) verlängert die Abfrage nichts.
    assert.equal((await x.rufe(c, 'GET', '/api/ablage/stand', undefined, { 'x-dms-aktiv': '1' })).statusCode, 200);
    x.jetzt.t += 6 * MIN;
    assert.equal((await x.rufe(c, 'GET', '/api/werkbank/uebersicht')).statusCode, 403, '16 Minuten nach der letzten Eingabe abgelaufen');
    // Modus vorbei: Die Rolle gehört zum Stand – die Zahlen wechseln (im Modus sieht man mehr).
    assert.notEqual((await x.rufe(c, 'GET', '/api/ablage/stand')).json().stand, imModus);
  });
});
