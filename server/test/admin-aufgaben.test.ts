/** Aufgaben des Admin-Kontos (#719): Inhaltliches an einen Alltags-Benutzer, Technisches per E-Mail und Hinweis. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { speicherDateien } from '../src/dateispeicher';
import { Dienst } from '../src/dienst';
import { speicherEinstellungen } from '../src/einstellungen';
import { Fachfehler } from '../src/fehler';
import { Konten } from '../src/konten';
import { speicherKontoRepo } from '../src/konto-repo';
import { speicherRepo } from '../src/repo-speicher';
import { routen } from '../src/routen';
import { Verwaltung, type Verwaltungspunkt } from '../src/verwaltung';

const status = (s: number) => (e: unknown) => e instanceof Fachfehler && e.status === s;

async function aufbau() {
  const repo = speicherRepo();
  const d = new Dienst(repo, speicherDateien(), { einstellungen: speicherEinstellungen() });
  const konten = new Konten(speicherKontoRepo(), null, 'http://nas', d.benutzerspiegel());
  d.verbindeKonten(konten.papierkorbHaken());
  const { benutzer: admin } = await konten.einrichten({ email: 'admin@example.org', name: 'Markus', passwort: 'ein-langes-passwort' });
  const { benutzer: lena } = await konten.legeBenutzerAn({ email: 'lena@example.org', name: 'Lena', rolle: 'mitglied' });
  const { benutzer: jonas } = await konten.legeBenutzerAn({ email: 'jonas@example.org', name: 'Jonas', rolle: 'mitglied' });
  await d.gleicheBenutzerAb(await konten.listeBenutzer());
  const t = await d.legeTypAn({ name: 'Vorgang', felder: [{ key: 'nr', label: 'Nummer', typ: 'text', pflicht: true }] });
  /** Aufgabe ohne Empfänger, wie sie Post ohne „Für“ oder eine Frist ohne Zuständige anlegt. */
  const ohne = async (mappeId: string, text: string) => { const a = await repo.legeAufgabeAn({ id: randomUUID(), mappeId, empfaengerId: null, art: 'manuell', text, erstellt: new Date().toISOString(), erstelltVon: null, erledigt: null, erledigtVon: null }); d.stand.erhoehe(); return a; };
  return { d, konten, t, ohne, admin, lena, jonas, A: { id: admin.id, rolle: 'admin' }, L: { id: lena.id, rolle: 'mitglied' }, J: { id: jonas.id, rolle: 'mitglied' } };
}

describe('Aufgaben ohne Empfänger an einen Alltags-Benutzer (#719)', () => {
  it('der erste Benutzer ohne Admin-Rechte ist die Vorgabe – ohne Admin-Rechte, ein zweiter ändert nichts', async () => {
    const { d, konten, lena } = await aufbau();
    assert.equal((await d.alltagsEmpfaenger()).benutzerId, lena.id);
    assert.equal((await konten.listeBenutzer()).find((b) => b.id === lena.id)?.rolle, 'mitglied');
  });

  it('Lena sieht, zählt und erledigt Aufgaben ohne Empfänger; Jonas nicht; die Administratoren weiterhin', async () => {
    const { d, t, ohne, A, L, J } = await aufbau();
    const m = await d.legeMappeAn({ typId: t.id, werte: { nr: '1' } }, A.id);
    const a = await ohne(m.id, 'Bitte zuordnen');
    assert.equal(a.empfaengerId, null);
    assert.equal((await d.zaehler(L)).eingang, 1);
    assert.equal((await d.zaehler(A)).eingang, 1, 'Administratoren sehen sie weiterhin');
    assert.equal((await d.zaehler(J)).eingang, 0);
    assert.deepEqual((await d.meineAufgaben(L)).map((x) => x.id), [a.id]);
    assert.deepEqual(await d.meineAufgaben(J), []);
    // „Zu erledigen“ und der Zähler-Endpunkt (#625)
    const seite = await d.seite(L, { sicht: 'eingang' }) as { mappen: Array<{ id: string }> };
    assert.deepEqual(seite.mappen.map((x) => x.id), [m.id]);
    assert.equal((await d.zaehlerAbruf(await d.zugriff(L))).zahlen.zuErledigen, 1);
    await assert.rejects(d.erledigeAufgabe(a.id, J), status(403));
    await d.erledigeAufgabe(a.id, L);
    assert.equal((await d.zaehler(A)).eingang, 0);
  });

  it('Werkbank wählt jemand anderen oder niemanden; Administratoren und Deaktivierte sind nicht wählbar', async () => {
    const { d, konten, t, ohne, admin, lena, jonas, A, L, J } = await aufbau();
    await assert.rejects(d.setzeAufgabenEmpfaenger({ benutzerId: admin.id }, A.id), status(422));
    await assert.rejects(d.setzeAufgabenEmpfaenger({ benutzerId: '00000000-0000-4000-8000-0000000000cc' }, A.id), status(422));
    const m = await d.legeMappeAn({ typId: t.id, werte: { nr: '2' } }, A.id);
    await ohne(m.id, 'Post ohne Für');
    assert.equal((await d.zaehler(L)).eingang, 1);
    assert.equal((await d.setzeAufgabenEmpfaenger({ benutzerId: jonas.id }, A.id)).benutzerId, jonas.id);
    assert.equal((await d.zaehler(L)).eingang, 0, 'Zwischenspeicher kennt die neue Wahl');
    assert.equal((await d.zaehler(J)).eingang, 1);
    await d.setzeAufgabenEmpfaenger({ benutzerId: null }, A.id);
    assert.equal((await d.zaehler(J)).eingang, 0);
    // Gewählt, dann deaktiviert: gilt niemand, bis die Werkbank neu wählt.
    await d.setzeAufgabenEmpfaenger({ benutzerId: lena.id }, A.id);
    const ich = (await konten.listeBenutzer()).find((b) => b.id === admin.id)!;
    await konten.setzeAbwesenheit(ich, lena.id, { an: false, vertreterId: jonas.id });
    await konten.aendereBenutzer(ich, lena.id, { aktiv: false });
    const e = await d.alltagsEmpfaenger();
    assert.deepEqual([e.benutzerId, e.gespeichert, e.wirksam], [null, lena.id, jonas.id], 'deaktiviert: der Vertreter übernimmt');
    assert.equal((await d.zaehler(J)).eingang, 1);
    assert.equal((await d.zaehler(A)).eingang, 1, 'die Administratoren sehen sie weiter');
    await assert.rejects(d.setzeAufgabenEmpfaenger({ benutzerId: lena.id }, A.id), status(422));
  });

  it('nach „niemand“ setzt ein neuer Benutzer keine Vorgabe mehr', async () => {
    const { d, konten, A } = await aufbau();
    await d.setzeAufgabenEmpfaenger({ benutzerId: null }, A.id);
    await konten.legeBenutzerAn({ email: 'petra@example.org', name: 'Petra', rolle: 'mitglied' });
    await d.gleicheBenutzerAb(await konten.listeBenutzer());
    assert.equal((await d.alltagsEmpfaenger()).benutzerId, null);
  });
});

describe('Technische Aufgaben (#719)', () => {
  function verwaltung(punkte: () => Verwaltungspunkt[], zeit: { jetzt: Date }) {
    const mails: Array<{ betreff: string; text: string }> = [];
    const v = new Verwaltung({ quellen: [async () => punkte()], einstellungen: speicherEinstellungen(), anAdmins: async (betreff, text) => { mails.push({ betreff, text }); }, adresse: () => 'https://ablage.example.org', jetzt: () => zeit.jetzt });
    return { v, mails };
  }

  it('höchstens eine Mail am Tag, nur mit Neuem; Punkte mit eigener Mail kommen nicht doppelt', async () => {
    const zeit = { jetzt: new Date('2026-11-04T05:00:00Z') }; // 06:00 in Berlin – vor der Uhrzeit der Mail
    let p: Verwaltungspunkt[] = [{ schluessel: 'paket:a', text: 'Das Paket „A“ braucht noch Einstellungen.' }, { schluessel: 'sicherung-fehler:x', text: 'Sicherung', eigeneMail: true }];
    const { v, mails } = verwaltung(() => p, zeit);
    assert.equal(await v.tick(), 0, 'vor 07:00 nichts');
    zeit.jetzt = new Date('2026-11-04T06:30:00Z');
    assert.equal(await v.tick(), 1);
    assert.equal(mails.length, 1);
    assert.match(mails[0].text, /Paket „A“.*\(neu\)/);
    assert.match(mails[0].text, /ablage\.example\.org\/werkbank/);
    // Neues am selben Tag wartet bis morgen.
    p = [...p, { schluessel: 'postfach:p', text: 'Postfach' }];
    zeit.jetzt = new Date('2026-11-04T12:00:00Z');
    assert.equal(await v.tick(), 0);
    zeit.jetzt = new Date('2026-11-05T06:30:00Z');
    assert.equal(await v.tick(), 1);
    assert.equal(mails.length, 2);
    // Nichts Neues: keine Mail.
    zeit.jetzt = new Date('2026-11-06T06:30:00Z');
    assert.equal(await v.tick(), 0);
    // Erledigt und wieder da: wird wieder gemeldet.
    p = []; await v.tick();
    p = [{ schluessel: 'paket:a', text: 'Paket A' }];
    zeit.jetzt = new Date('2026-11-07T06:30:00Z');
    assert.equal(await v.tick(), 1);
    assert.equal(mails.length, 3);
  });

  it('der Hinweis beim Alltags-Benutzer ist nur ja/nein – ohne Inhalte, und nicht bei anderen', async () => {
    const { d, konten, lena, jonas, admin } = await aufbau();
    let p: Verwaltungspunkt[] = [{ schluessel: 'paket:geheim', text: 'Das Paket „Geheimprojekt“ braucht noch Einstellungen.' }];
    const v = new Verwaltung({ quellen: [async () => p], einstellungen: speicherEinstellungen(), anAdmins: async () => {} });
    const r = routen(d, konten, { verwaltung: v }).find((x) => x.methode === 'GET' && x.pfad === '/api/konto/status')!;
    const fuer = async (b: unknown) => (await r.handler({ benutzer: b, sitzungsDaten: {}, query: {}, params: {}, body: undefined, kopf: {} } as never)) as { body: Record<string, unknown> };
    const ichL = (await konten.listeBenutzer()).find((b) => b.id === lena.id)!;
    const s = (await fuer(ichL)).body;
    assert.equal(s.verwaltung, true);
    assert.equal(s.aufgabenOhneEmpfaenger, true);
    assert.doesNotMatch(JSON.stringify(s), /Geheimprojekt|paket:geheim/);
    assert.equal((await fuer((await konten.listeBenutzer()).find((b) => b.id === jonas.id))).body.verwaltung, false);
    assert.equal((await fuer((await konten.listeBenutzer()).find((b) => b.id === admin.id))).body.verwaltung, false, 'der Administrator sieht es in der Werkbank');
    // Erledigt: Hinweis weg (nach der kurzen Merkzeit).
    p = []; await v.punkte(true);
    assert.equal((await fuer(ichL)).body.verwaltung, false);
  });
});
