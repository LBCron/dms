/** Systemrollen „Systemkonto“ und „Paket“, Konto „Automatisierung“ (#673). */
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { kontorolleKennung } from '../../shared/src/model';
import { NICHTS } from '../../shared/src/rechte';
import { speicherDateien } from '../src/dateispeicher';
import { Dienst } from '../src/dienst';
import { speicherEinstellungen } from '../src/einstellungen';
import { Fachfehler } from '../src/fehler';
import { Konten } from '../src/konten';
import { hasheSchluessel } from '../src/passwort';
import { speicherKontoRepo } from '../src/konto-repo';
import { speicherRepo } from '../src/repo-speicher';
import { routen, type Anfrage } from '../src/routen';
import { Tresor } from '../src/tresor';

const status = (s: number) => (e: unknown) => e instanceof Fachfehler && e.status === s;

async function aufbau() {
  const tresor = new Tresor(speicherEinstellungen(), join(await mkdtemp(join(tmpdir(), 'dms-system-')), 'dms.schluessel'), () => null);
  await tresor.laden(); await tresor.erzeuge();
  const repo = speicherRepo();
  const kontoRepo = speicherKontoRepo();
  const d = new Dienst(repo, speicherDateien(), { einstellungen: speicherEinstellungen(), tresor });
  const konten = new Konten(kontoRepo, null, 'http://nas', d.benutzerspiegel());
  d.verbindeKonten(konten.papierkorbHaken());
  d.systemkonten = (k) => konten.systemkonto(k);
  const { benutzer: admin } = await konten.einrichten({ email: 'admin@example.org', name: 'Lena', passwort: 'ein-langes-passwort' });
  const jonas = (await konten.legeBenutzerAn({ email: 'jonas@example.org', name: 'Jonas', rolle: 'mitglied' }, admin.id)).benutzer;
  await d.gleicheBenutzerAb(await konten.listeBenutzer());
  const auto = await konten.systemkonto('automatisierung');
  const typen = await d.listeTypen();
  const rolleTyp = typen.find((t) => t.system === 'rolle')!;
  const rolleId = async (k: 'systemkonto' | 'paket') => (await repo.holeSystemMappe(kontorolleKennung(k)))!.id;
  const gesundheit = await d.legeTypAn({ name: 'Gesundheit', felder: [{ key: 'titel', label: 'Titel', typ: 'text' }, { key: 'kennwort', label: 'Kennwort', typ: 'passwort' }] });
  const tabelle = routen(d, konten, {});
  const route = (m: string, p: string) => tabelle.find((r) => r.methode === m && r.pfad === p)!;
  const rufe = (m: string, p: string, x: Partial<Anfrage> = {}) => route(m, p).handler({ body: {}, params: {}, query: {}, ip: '1', ...x, benutzer: admin });
  return { d, repo, kontoRepo, konten, admin, jonas, auto, rolleTyp, rolleId, gesundheit, rufe };
}

describe('Systemkonten (#673)', () => {
  it('Konto „Automatisierung“: einmal angelegt, sichtbar, aber in keiner Liste und Auswahl', async () => {
    const { konten, auto, admin, rufe } = await aufbau();
    assert.equal(auto.art, 'system');
    assert.equal(auto.systemkonto, 'automatisierung');
    assert.equal(auto.name, 'Automatisierung');
    assert.equal((await konten.systemkonto('automatisierung')).id, auto.id, 'zweiter Aufruf liefert dasselbe Konto');
    assert.ok(!(await konten.listeBenutzer()).some((b) => b.id === auto.id), 'nicht in der Benutzerliste');
    assert.equal(await konten.einrichtungNoetig(), false);
    const personen = await konten.personen();
    const p = personen.find((x) => x.id === auto.id);
    assert.ok(p && p.aktiv === false && 'art' in p && p.art === 'system', 'nur für Namen, nie auswählbar');
    const liste = await rufe('GET', '/api/benutzer/systemkonten') as { body: Array<{ id: string; rolle: string; automatisierungen: unknown[] }> };
    const k = liste.body.find((x) => x.id === auto.id)!;
    assert.equal(k.rolle, 'systemkonto');
    assert.deepEqual(k.automatisierungen, []);
    const benutzer = await rufe('GET', '/api/benutzer') as { body: Array<{ id: string }> };
    assert.ok(!benutzer.body.some((x) => x.id === auto.id));
    assert.ok(admin);
  });

  it('nicht anmeldbar: Anmeldung, Passwort vergessen, Sitzung, API-Schlüssel, Benutzerwechsel, Ändern scheitern', async () => {
    const { konten, kontoRepo, auto, admin } = await aufbau();
    await assert.rejects(konten.anmelden({ email: auto.email, passwort: 'irgendein-langes-passwort' }, '1.2.3.4'), status(401));
    await konten.passwortVergessen?.({ email: auto.email }).catch(() => undefined);
    assert.equal((await kontoRepo.holeHash(auto.email)), undefined, 'kein Konto für „Passwort vergessen“');
    // Eine untergeschobene Sitzung gilt nicht.
    await kontoRepo.legeSitzungAn(hasheSchluessel('untergeschoben'), auto.id, new Date(Date.now() + 60_000), { geraet: 'x', ip: '1' });
    assert.equal(await konten.benutzerZu('untergeschoben'), undefined);
    assert.equal(await konten.benutzerMitId(auto.id), undefined, 'kein API-Schlüssel');
    await assert.rejects(konten.vertrete(admin, undefined, auto.id, { geraet: 'x', ip: '1' }), status(404));
    await assert.rejects(konten.aendereBenutzer(admin, auto.id, { aktiv: false }), status(404));
    await assert.rejects(konten.loescheBenutzer(admin, auto.id), status(404));
  });

  it('Systemrollen „Systemkonto“ und „Paket“ als Rollen-Mappen, nie an Menschen vergeben', async () => {
    const { d, jonas, rolleId } = await aufbau();
    const s = await rolleId('systemkonto'), p = await rolleId('paket');
    assert.ok(s && p);
    assert.ok(!(await d.listeRollen()).some((r) => r.id === s || r.id === p), 'nicht in der Auswahl der Benutzerverwaltung');
    assert.ok((await d.listeRollen(true)).some((r) => r.id === s && r.konto));
    await assert.rejects(d.setzeRollen(jonas.id, [s]), status(422));
    // Name fest, nicht löschbar wie die anderen Systemrollen.
    await assert.rejects(d.loescheMappe(s), (e: unknown) => e instanceof Fachfehler);
  });

  it('Rechte: ohne Regeln alles außer Passwörter; Regeln mit der Rolle Systemkonto schränken ein; der Standard für Mitglieder gilt nicht', async () => {
    const { d, auto, admin, gesundheit, rolleId } = await aufbau();
    const m = await d.legeMappeAn({ typId: gesundheit.id, werte: { titel: 'Impfung', kennwort: { neu: 'geheim' } } }, admin.id);
    let z = await d.zugriff(auto);
    let r = await d.rechteAn(z, m);
    assert.deepEqual(r, { C: true, R: true, U: true, D: true, P: false });
    // Standard „nichts“ für Mitglieder: das Systemkonto ist davon nicht betroffen.
    await d.setzeBerechtigungen(gesundheit.id, { grund: NICHTS, regeln: [] }, true);
    z = await d.zugriff(auto);
    assert.equal((await d.rechteAn(z, m)).R, true);
    // Regel „Systemkonto darf von Gesundheit nichts“.
    await d.setzeBerechtigungen(gesundheit.id, { grund: NICHTS, regeln: [{ id: 's', name: 'Keine Automatisierung', wenn: [{ art: 'rolle', rollen: [await rolleId('systemkonto')] }], dann: { C: 'entziehen', R: 'entziehen', U: 'entziehen', D: 'entziehen', P: 'entziehen' }, stopp: true }] }, true);
    z = await d.zugriff(auto);
    r = await d.rechteAn(z, m);
    assert.deepEqual(r, { C: false, R: false, U: false, D: false, P: false });
    assert.equal((await d.lesbare(z, [m.id])).has(m.id), false, 'auch in Listen und Suche nicht lesbar');
    assert.equal(z.admin, false, 'das Systemkonto ist kein Administrator');
    const sz = await d.systemZugriff();
    assert.equal(sz.ich.id, auto.id);
  });

  it('Paket: bestätigte Rechte bleiben; Regeln mit der Rolle Paket schränken nur ein', async () => {
    const { d, repo, konten, admin, gesundheit, rolleId } = await aufbau();
    const andere = await d.legeTypAn({ name: 'Notiz', felder: [{ key: 'titel', label: 'Titel', typ: 'text' }] });
    await repo.speicherePaket({
      id: 'probe', name: 'Probe', version: '1.0.0', beschreibung: '', lizenz: 'Apache-2.0', autor: { name: 'Lena', github: 'lena' }, herkunft: 'katalog' as never,
      installiert: new Date().toISOString(), installiertVon: admin.id, aktualisiert: null, aktualisiertVon: null,
      typen: { gesundheit: gesundheit.id, notiz: andere.id }, sichten: {}, abhaengigkeiten: {}, code: true,
      laeufer: { sprache: 'wasm', ereignisse: [], rechte: { lesen: ['gesundheit', 'notiz'], schreiben: ['notiz'], dokumente: 'keine' }, netz: [] } as never,
    });
    const konto = await konten.dienstkonto('probe', 'Probe');
    const g = await d.legeMappeAn({ typId: gesundheit.id, werte: { titel: 'Impfung' } }, admin.id);
    const n = await d.legeMappeAn({ typId: andere.id, werte: { titel: 'Zettel' } }, admin.id);
    let z = await d.zugriff(konto);
    assert.deepEqual(await d.rechteAn(z, g), { C: false, R: true, U: false, D: false, P: false }, 'wie bestätigt: nur lesen');
    assert.deepEqual(await d.rechteAn(z, n), { C: true, R: true, U: true, D: false, P: false });
    // Strenger Standard für Mitglieder ändert nichts; eine Regel für die Rolle Paket entzieht das Lesen.
    await d.setzeBerechtigungen(gesundheit.id, { grund: NICHTS, regeln: [{ id: 'p', name: 'Pakete nicht', wenn: [{ art: 'rolle', rollen: [await rolleId('paket')] }], dann: { R: 'entziehen' }, stopp: true }] }, true);
    // Erteilen über die bestätigten Rechte hinaus geht nicht.
    await d.setzeBerechtigungen(andere.id, { grund: NICHTS, regeln: [{ id: 'q', name: 'Pakete alles', wenn: [{ art: 'rolle', rollen: [await rolleId('paket')] }], dann: { C: 'erteilen', R: 'erteilen', U: 'erteilen', D: 'erteilen', P: 'erteilen' }, stopp: true }] }, true);
    z = await d.zugriff(konto);
    assert.equal((await d.rechteAn(z, g)).R, false);
    assert.equal((await d.lesbare(z, [g.id, n.id])).has(g.id), false);
    assert.ok((await d.lesbare(z, [n.id])).has(n.id));
    assert.deepEqual(await d.rechteAn(z, n), { C: true, R: true, U: true, D: false, P: false });
  });
});
