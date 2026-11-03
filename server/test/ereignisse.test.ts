/** Ereigniskatalog (#670): Ausgangskorb, Bündeln, Verteiler, Pakete nach code.mappentypen, still, Frist genau einmal. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EREIGNISKATALOG, ereignisSchluessel, KATALOG_ARTEN, mischeFelder, WEBHOOK_KATALOG, type KatalogEreignis } from '../../shared/src/ereignisse';
import { EREIGNISSE, liesCode, MAPPEN_EREIGNISSE, type InstalliertesPaket } from '../../shared/src/pakete';
import { WEBHOOK_EREIGNISSE } from '../../shared/src/webhook';
import de from '../../shared/src/sprachen/de/ereignisse.json';
import { speicherDateien } from '../src/dateispeicher';
import { Dienst } from '../src/dienst';
import { speicherEinstellungen } from '../src/einstellungen';
import { Konten } from '../src/konten';
import { speicherKontoRepo } from '../src/konto-repo';
import { speicherRepo } from '../src/repo-speicher';

/** Uhr vorstellen (Bündelung, Wiederholung), danach zurück. */
async function spaeter<T>(ms: number, f: () => Promise<T>): Promise<T> {
  const echt = Date.now;
  Date.now = () => echt() + ms;
  try { return await f(); } finally { Date.now = echt; }
}

async function aufbau() {
  const repo = speicherRepo();
  const d = new Dienst(repo, speicherDateien(), { einstellungen: speicherEinstellungen() });
  const konten = new Konten(speicherKontoRepo(), null, 'http://nas', d.benutzerspiegel());
  d.verbindeKonten(konten.papierkorbHaken());
  const { benutzer: admin } = await konten.einrichten({ email: 'admin@example.org', name: 'Lena', passwort: 'ein-langes-passwort' });
  await d.gleicheBenutzerAb(await konten.listeBenutzer());
  const vertrag = await d.legeTypAn({ name: 'Vertrag', felder: [
    { key: 'name', label: 'Name', typ: 'text', pflicht: true },
    { key: 'kuendigung', label: 'Kündigung bis', typ: 'datum', frist: { vorlauf: 2, einheit: 'wochen', text: '{feld} {datum}' } },
  ] });
  const notiz = await d.legeTypAn({ name: 'Zettel', felder: [{ key: 'name', label: 'Name', typ: 'text' }] });
  const gesehen: KatalogEreignis[] = [];
  d.ereignisse.abonniere('test', async (e) => { gesehen.push(e); });
  const verteile = () => spaeter(10_000, () => d.ereignisse.verteile());
  return { d, repo, konten, admin, vertrag, notiz, gesehen, verteile };
}

describe('Ereigniskatalog (#670): Katalog', () => {
  it('jeder Eintrag hat Name, Text und Gruppe; Webhooks und Pakete stimmen mit dem Katalog überein', () => {
    const texte = de as Record<string, string>;
    for (const a of KATALOG_ARTEN) {
      assert.ok(texte[`name.${ereignisSchluessel(a)}`] && texte[`text.${ereignisSchluessel(a)}`], `Texte für ${a}`);
      assert.ok(texte[`gruppe.${EREIGNISKATALOG[a].gruppe}`], `Gruppe für ${a}`);
      for (const f of EREIGNISKATALOG[a].felder) assert.doesNotMatch(f, /titel|name|wert|text/i, `${a}: nur Ids/Schlüssel/Datum (${f})`);
    }
    assert.deepEqual([...WEBHOOK_EREIGNISSE], WEBHOOK_KATALOG);
    for (const a of MAPPEN_EREIGNISSE) assert.ok(Object.keys(EREIGNISSE).includes(a), `${a} für Pakete`);
    assert.deepEqual(mischeFelder({ felder: ['a', 'b'] }, { felder: ['b', 'c'] }).felder, ['a', 'b', 'c']);
  });

  it('code.mappentypen: Pflicht mit Mappen-Ereignissen, nur mit ihnen, nur eigene und lesbare Typen', () => {
    const basis = { sprache: 'c', ereignisse: ['mappe.geaendert'], mappentypen: ['vertrag'], rechte: { lesen: ['vertrag'] } };
    const f = (x: Record<string, unknown>) => liesCode({ ...basis, ...x }).fehler.join(' ');
    assert.deepEqual(liesCode(basis).fehler, []);
    assert.deepEqual(liesCode(basis).code!.mappentypen, ['vertrag']);
    assert.match(f({ mappentypen: [] }), /braucht code.mappentypen/);
    assert.match(f({ ereignisse: ['post.angelegt'] }), /nur mit Mappen-Ereignissen/);
    assert.match(f({ mappentypen: ['basis:organisation'] }), /fremden Mappentypen gibt es noch nicht/);
    assert.match(f({ rechte: { lesen: ['rechnung'] } }), /auch lesen dürfen/);
  });
});

describe('Ereigniskatalog (#670): Ausgangskorb und Verteiler', () => {
  it('Mappe angelegt, geändert (gebündelt, nur Feldschlüssel), verknüpft, Notiz, gelöscht, wiederhergestellt – mit Auslöser', async () => {
    const { d, admin, vertrag, gesehen, verteile } = await aufbau();
    const m = await d.legeMappeAn({ typId: vertrag.id, werte: { name: 'Strom' } }, admin.id);
    await d.aendereMappe(m.id, { werte: { name: 'Strom Haus' } }, admin.id);
    await d.aendereMappe(m.id, { werte: { name: 'Strom Haus', kuendigung: '2031-09-30' } }, admin.id);
    await d.legeNotizAn(m.id, 'Anruf', admin.id);
    await verteile();
    const arten = gesehen.map((e) => e.art);
    assert.ok(arten.includes('mappe.angelegt'));
    assert.ok(arten.includes('mappe.notiz'));
    const geaendert = gesehen.filter((e) => e.art === 'mappe.geaendert');
    assert.equal(geaendert.length, 1, 'schnelle Änderungen werden ein Ereignis');
    assert.deepEqual([...(geaendert[0].daten.felder as string[])].sort(), ['kuendigung', 'name']);
    assert.ok(!JSON.stringify(gesehen).includes('Strom'), 'nie Werte');
    assert.deepEqual(gesehen[0].ausloeser, { art: 'benutzer', id: admin.id, konto: admin.id });
    assert.equal(gesehen[0].daten.mappe, m.id);
    assert.equal(gesehen[0].daten.typ, vertrag.id);
    gesehen.length = 0;
    await d.loescheMappe(m.id, admin.id);
    await d.stelleWiederHer(m.id, { id: admin.id, rolle: 'admin' });
    await verteile();
    assert.deepEqual(gesehen.map((e) => e.art).filter((a) => a.startsWith('mappe.')), ['mappe.geloescht', 'mappe.wiederhergestellt']);
  });

  it('scheitert ein Abnehmer, kommt dasselbe Ereignis (gleiche Id) noch einmal; die anderen bekommen es auch wieder', async () => {
    const { d, admin, notiz, gesehen, verteile } = await aufbau();
    let mal = 0;
    d.ereignisse.abonniere('wackelt', async () => { if (mal++ === 0) throw new Error('kurz weg'); });
    await d.legeMappeAn({ typId: notiz.id, werte: { name: 'A' } }, admin.id);
    await verteile();
    assert.equal(gesehen.length, 1);
    assert.equal(await verteile(), 0, 'vor der Wiederholung nichts');
    await spaeter(2 * 60_000, () => d.ereignisse.verteile());
    assert.equal(gesehen.length, 2);
    assert.equal(gesehen[0].id, gesehen[1].id, 'Wiederholung an der Id erkennbar');
    assert.equal(await verteile(), 0, 'danach verteilt');
  });

  it('mitAusloeser kennzeichnet eine Automatisierung; ohneEreignisse (Beispiele, Demo) ist still', async () => {
    const { d, admin, notiz, gesehen, verteile } = await aufbau();
    await d.mitAusloeser({ art: 'automatisierung', id: 'regel-1', konto: 'sys', kette: 1 }, () => d.legeMappeAn({ typId: notiz.id, werte: { name: 'B' } }, admin.id));
    await d.ohneEreignisse(() => d.legeMappeAn({ typId: notiz.id, werte: { name: 'C' } }, admin.id));
    await verteile();
    assert.equal(gesehen.length, 1);
    assert.deepEqual(gesehen[0].ausloeser, { art: 'automatisierung', id: 'regel-1', konto: 'sys', kette: 1 });
  });

  it('Pakete bekommen Mappen-Ereignisse nur zu ihren code.mappentypen – und bei Wiederholung nicht doppelt', async () => {
    const { d, repo, admin, vertrag, notiz, verteile } = await aufbau();
    const code = { sprache: 'c', ereignisse: ['mappe.angelegt', 'frist.erreicht'], mappentypen: ['vertrag'], rechte: { lesen: ['vertrag'] } };
    const p: InstalliertesPaket = {
      id: 'fristen', name: 'Fristen', version: '1.0.0', beschreibung: '', lizenz: 'Apache-2.0', autor: { name: 'T', github: 't' }, dms: '>=0.153.0',
      herkunft: { art: 'hochgeladen', von: null, am: '' }, installiert: new Date().toISOString(), installiertVon: null, aktualisiert: null, aktualisiertVon: null,
      typen: { vertrag: vertrag.id }, sichten: {}, abhaengigkeiten: {}, code: true, laeufer: liesCode(code).code!, einstellungen: undefined,
    };
    await repo.speicherePaket(p);
    let mal = 0;
    d.ereignisse.abonniere('wackelt', async () => { if (mal++ === 0) throw new Error('kurz weg'); });
    const m = await d.legeMappeAn({ typId: vertrag.id, werte: { name: 'Strom' } }, admin.id);
    await d.legeMappeAn({ typId: notiz.id, werte: { name: 'Zettel' } }, admin.id);
    await verteile();
    await spaeter(2 * 60_000, () => d.ereignisse.verteile());
    const beimPaket = (await repo.faelligeEreignisse(50)).filter((e) => e.paketId === 'fristen');
    assert.equal(beimPaket.length, 1, 'nur der Vertrag, und nur einmal');
    assert.equal(beimPaket[0].art, 'mappe.angelegt');
    assert.equal(beimPaket[0].daten.mappe, m.id);
    assert.equal(typeof beimPaket[0].daten.ereignis, 'string');
  });

  it('Frist erreicht: zum Erinnerungszeitpunkt und am Tag selbst je genau einmal', async () => {
    const { d, admin, vertrag, gesehen, verteile } = await aufbau();
    const m = await d.legeMappeAn({ typId: vertrag.id, werte: { name: 'Strom', kuendigung: '2031-06-30' } }, admin.id);
    await d.fristenAbgleichen({}, '2031-06-10');
    await d.fristenAbgleichen({}, '2031-06-20');
    await d.fristenAbgleichen({}, '2031-06-21');
    await d.fristenAbgleichen({}, '2031-06-30');
    await d.fristenAbgleichen({}, '2031-06-30');
    await verteile();
    const f = gesehen.filter((e) => e.art === 'frist.erreicht');
    assert.deepEqual(f.map((e) => e.daten.zeitpunkt), ['vorlauf', 'faellig']);
    assert.deepEqual(f[0].daten, { mappe: m.id, typ: vertrag.id, feld: 'kuendigung', datum: '2031-06-30', zeitpunkt: 'vorlauf', empfaenger: f[0].daten.empfaenger });
    assert.equal(f[0].ausloeser.art, 'system');
  });
});
