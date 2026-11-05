/**
 * Einrichtungsassistent: erst sammeln, dann einrichten (#804), und Einrichtung als Konfigurationsdatei (#806).
 * Prüfen und Datei legen nichts an; die Datei hat keine Geheimnisse; Laden und Speichern ergeben dieselbe Datei;
 * Fehler mit Zeile und Feld; nur mit Einrichtungscode und nur vor der Einrichtung; Abschluss erst mit Notfallblatt.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { Einrichtungsplan } from '../../shared/src/einrichtungsplan';
import { Einrichtung, planAusEingabe } from '../src/einrichtung';
import { liesEinrichtungsdatei, schemaText, schreibeEinrichtungsdatei, SCHEMA_DATEI } from '../src/einrichtungsdatei';
import { Einrichtungscode } from '../src/einrichtungscode';
import { speicherEinstellungen } from '../src/einstellungen';
import { Konten } from '../src/konten';
import { speicherKontoRepo } from '../src/konto-repo';

const WURZEL = new URL('../..', import.meta.url).pathname;
const DOKU = ['docs/handbuch/admin/docs/einrichtungsdatei', 'docs/handbuch/entwickler/docs/einrichtungsdatei'];

/** Die Beispieldatei aus den Handbüchern – nur Persona-Namen und Beispiel-Domains. */
const BEISPIEL: Einrichtungsplan = {
  datenbank: { host: 'db', port: 5432, datenbank: 'dms', benutzer: 'dms', passwort: '${DMS_DB_PASSWORT}' },
  ablage: 'Familie Beispiel',
  administrator: { name: 'Admin', email: 'admin@example.org', passwort: '${DMS_ADMIN_PASSWORT}' },
  benutzer: { name: 'Lena Beispiel', email: 'lena@example.org', aufgabenOhneEmpfaenger: true },
  pakete: [{ id: 'texterkennung', beispiele: false, automatisierungen: {} }, { id: 'benachrichtigungen', beispiele: false, automatisierungen: {} }],
  optional: {
    adresse: 'https://ablago.example.org', bundesland: 'SN', beispiele: false,
    mail: { aktiv: true, host: 'smtp.example.org', port: 587, verbindung: 'starttls', benutzer: 'ablago@example.org', absender: 'Ablago <ablago@example.org>', selbstsigniert: false, passwort: '${DMS_MAIL_PASSWORT}' },
  },
};

const VOLL: Einrichtungsplan = {
  ...BEISPIEL,
  pakete: [{ id: 'haushalt', beispiele: true, automatisierungen: { 'fristen-erinnern': false, 'abo-pruefen': true } }, { id: 'texterkennung', beispiele: false, automatisierungen: {} }],
};

const fehlerVon = (text: string) => liesEinrichtungsdatei(text).fehler;

describe('Konfigurationsdatei (#806): Hin und Zurück', () => {
  it('Speichern und Laden ergeben denselben Plan und dieselbe Datei', () => {
    for (const p of [BEISPIEL, VOLL, { ...BEISPIEL, datenbank: null, benutzer: null, pakete: null, optional: { adresse: null, bundesland: null, beispiele: false, mail: null } }, { ...BEISPIEL, pakete: [] }]) {
      const text = schreibeEinrichtungsdatei(p);
      const r = liesEinrichtungsdatei(text);
      assert.deepEqual(r.fehler, []);
      assert.deepEqual(r.plan, { ...p, pakete: p.pakete?.map((x) => ({ ...x, automatisierungen: Object.fromEntries(Object.entries(x.automatisierungen).sort(([a], [b]) => a.localeCompare(b))) })) ?? null });
      assert.equal(schreibeEinrichtungsdatei(r.plan!), text, 'dieselbe Datei');
    }
  });

  it('Kopfzeile mit Formatversion, kurze Kommentare, Verweis aufs Schema', () => {
    const text = schreibeEinrichtungsdatei(BEISPIEL);
    assert.match(text, /^ablago-einrichtung: 1$/m);
    assert.match(text, /^# Ohne Passwörter und ohne Schlüssel/m);
    assert.match(text, /^# Aufbau: https:\/\/help\.ablago\.app\/admin\/aktuell\/einrichtungsdatei\/ablago-einrichtung-1\.schema\.json$/m);
    assert.match(text, /^# Richtet Ablago ein/m);
  });

  it('JSON geht auch (gültiges JSON ist gültiges YAML)', () => {
    const r = liesEinrichtungsdatei(JSON.stringify({ 'ablago-einrichtung': 1, ablage: 'Büro Brandt', administrator: { email: 'it@example.com' } }));
    assert.deepEqual(r.fehler, []);
    assert.equal(r.plan?.ablage, 'Büro Brandt');
    assert.equal(r.plan?.benutzer, null);
    assert.equal(r.plan?.pakete, null, 'ohne Liste: im Assistenten wählen');
  });
});

describe('Konfigurationsdatei (#806): keine Geheimnisse', () => {
  it('ein Passwort im Klartext wird abgelehnt – mit Zeile und Feld', () => {
    const f = fehlerVon('ablago-einrichtung: 1\nablage: Familie Beispiel\nadministrator:\n  email: admin@example.org\n  passwort: geheim123\n');
    assert.equal(f.length, 1);
    assert.deepEqual([f[0].zeile, f[0].feld], [5, 'administrator.passwort']);
    assert.match(f[0].text, /Passwörter gehören nicht in die Datei/);
    assert.equal(fehlerVon('ablago-einrichtung: 1\nablage: X\nadministrator:\n  email: a@example.org\n  passwort: ${DMS_ADMIN_PASSWORT}\n').length, 0, 'Verweis geht');
  });

  it('ein Schlüssel hat keinen Platz in der Datei', () => {
    const f = fehlerVon('ablago-einrichtung: 1\nablage: X\nadministrator:\n  email: a@example.org\nschluessel: AAAA\n');
    assert.deepEqual(f.map((x) => [x.zeile, x.feld]), [[5, 'schluessel']]);
    assert.match(f[0].text, /Unbekanntes Feld/);
  });

  it('beim Schreiben bleiben nur Verweise – Passwörter aus der Oberfläche fallen weg', () => {
    const p = planAusEingabe({ ...BEISPIEL, administrator: { ...BEISPIEL.administrator, passwort: 'ein-langes-passwort' }, optional: { ...BEISPIEL.optional, mail: { ...BEISPIEL.optional.mail, passwort: 'mailgeheim' } } });
    const text = schreibeEinrichtungsdatei(p);
    assert.doesNotMatch(text, /ein-langes-passwort|mailgeheim/);
    assert.match(text, /passwort: \$\{DMS_DB_PASSWORT\}/);
    assert.doesNotMatch(text, /DMS_ADMIN_PASSWORT|DMS_MAIL_PASSWORT/);
  });
});

describe('Konfigurationsdatei (#806): Prüfung gegen das Schema', () => {
  it('verständliche Fehler mit Zeile und Feld', () => {
    const f = fehlerVon([
      'ablago-einrichtung: 1', 'ablage: ""', 'administrator:', '  name: Admin', 'erster-benutzer:', '  email: kein-at', 'pakete:', '  - id: texterkennung', '  - name: Ohne Id',
      'optionales:', '  bundesland: XX', '  adresse: ftp://nas', '  e-mail:', '    server: smtp.example.org', '    port: 70000',
    ].join('\n'));
    const kurz = f.map((x) => `${x.zeile} ${x.feld}`);
    assert.deepEqual(kurz, ['2 ablage', '3 administrator.email', '6 erster-benutzer.email', '9 pakete[1].id', '9 pakete[1].name', '11 optionales.bundesland', '12 optionales.adresse', '15 optionales.e-mail.port']);
    assert.match(f[0].text, /nicht leer/);
    assert.match(f[1].text, /Pflicht/);
    assert.match(f[2].text, /E-Mail-Adresse/);
    assert.match(f[4].text, /Unbekanntes Feld/);
    assert.match(f[5].text, /Erlaubt sind: BW/);
    assert.match(f[6].text, /http:\/\//);
    assert.match(f[7].text, /1 bis 65535/);
  });

  it('falsche Version, falsche Art, kaputtes YAML, leere Datei', () => {
    assert.match(fehlerVon('ablago-einrichtung: 2\nablage: X\nadministrator: { email: a@example.org }\n')[0].text, /Formatversion/);
    const typ = fehlerVon('ablago-einrichtung: 1\nablage: X\nadministrator: a@example.org\n')[0];
    assert.deepEqual([typ.zeile, typ.feld], [3, 'administrator']);
    assert.match(typ.text, /Abschnitt mit Feldern/);
    const kaputt = fehlerVon('ablago-einrichtung: 1\nablage: [X\nadministrator:\n');
    assert.equal(kaputt[0].feld, 'Datei');
    assert.ok(kaputt[0].zeile && kaputt[0].zeile >= 2);
    assert.match(kaputt[0].text, /Kein gültiges YAML/);
    assert.match(fehlerVon('   ')[0].text, /leer/);
    assert.match(fehlerVon('ablago-einrichtung: 1\nablage: X\nablage: Y\nadministrator: { email: a@example.org }\n')[0].text, /YAML/, 'doppelte Schlüssel');
  });

  it('Schema und Beispieldatei in Administrator- und Entwicklerhandbuch, versioniert und aktuell', () => {
    for (const d of DOKU) {
      assert.equal(readFileSync(join(WURZEL, d, SCHEMA_DATEI), 'utf8'), schemaText(), `${d}/${SCHEMA_DATEI} – neu erzeugen`);
      const beispiel = readFileSync(join(WURZEL, d, 'beispiel.yaml'), 'utf8');
      assert.equal(beispiel, schreibeEinrichtungsdatei(BEISPIEL), `${d}/beispiel.yaml – neu erzeugen`);
      assert.deepEqual(liesEinrichtungsdatei(beispiel).fehler, []);
      assert.ok(readFileSync(join(WURZEL, `${d}.md`), 'utf8').includes(`\`\`\`yaml\n${beispiel}\`\`\``), `${d}.md zeigt das Beispiel`);
    }
    const schema = JSON.parse(schemaText()) as { $id: string; required: string[]; properties: Record<string, unknown> };
    assert.match(schema.$id, /ablago-einrichtung-1\.schema\.json$/);
    assert.deepEqual(schema.required, ['ablago-einrichtung', 'ablage', 'administrator']);
  });
});

const ordner = () => mkdtemp(join(tmpdir(), 'a803-einrichtung-'));
async function neueEinrichtung(o: { notfallblatt?: () => boolean } = {}) {
  const code = new Einrichtungscode(await ordner());
  const c = await code.bereitstellen();
  const konten = new Konten(speicherKontoRepo(), null, 'http://nas');
  let name: string | null = null;
  const e = new Einrichtung({
    konten, code, einstellungen: speicherEinstellungen(), mandant: { name: async () => name, umbenennen: async (n) => { name = n; } }, schriftzug: async () => {},
    datenbank: () => ({ host: 'db', port: 5432, datenbank: 'dms', benutzer: 'dms' }),
    ...(o.notfallblatt ? { notfallblattAktuell: async () => o.notfallblatt!() } : {}),
  });
  return { e, c, konten };
}

describe('Erst sammeln, dann einrichten (#804)', () => {
  it('Prüfen je Schritt legt nichts an; Gründe stehen beim passenden Schritt', async () => {
    const { e, konten } = await neueEinrichtung();
    const p = e.pruefePlan({ ...BEISPIEL, ablage: '', benutzer: { ...BEISPIEL.benutzer, email: 'ADMIN@example.org' }, optional: { ...BEISPIEL.optional, adresse: 'http://nas/?x=1' } });
    assert.deepEqual(Object.keys(p).sort(), ['ablage', 'administrator', 'benutzer', 'optional']);
    assert.match(p.administrator![0], /Passwort für den Administrator/, 'Passwort steht nie in der Datei – der Assistent fragt');
    assert.match(p.benutzer![0], /andere E-Mail-Adresse/);
    assert.match(p.optional![0], /keine Parameter/);
    assert.deepEqual(e.pruefePlan(BEISPIEL, { administrator: 'ein-langes-passwort' }), {});
    assert.match(e.pruefePlan(BEISPIEL, { administrator: 'kurz' }).administrator![0], /mindestens/);
    assert.equal(await konten.einrichtungNoetig(), true, 'nichts angelegt');
  });

  it('Datei schreiben nimmt die verbundene Datenbank und behält Verweise; Lesen meldet eine andere Datenbank', async () => {
    const { e } = await neueEinrichtung();
    const { text, name } = e.dateiSchreiben({ ...BEISPIEL, datenbank: { host: 'anders', port: 1, datenbank: 'x', benutzer: 'y', passwort: '${DMS_DB_PASSWORT}' } });
    assert.equal(name, 'ablago-einrichtung.yaml');
    assert.match(text, /rechner: db\n  port: 5432\n  name: dms\n  benutzer: dms\n  passwort: \$\{DMS_DB_PASSWORT\}/);
    const r = e.dateiLesen(schreibeEinrichtungsdatei({ ...BEISPIEL, datenbank: { host: 'nas', port: 5433, datenbank: 'ablago', benutzer: 'ablago' } }));
    assert.match(r.hinweise[0], /ablago@nas:5433\/ablago.*dms@db:5432\/dms/);
  });

  it('nur mit Code und nur vor der Einrichtung; danach der Administrator, solange der Assistent offen ist', async () => {
    const { e, c } = await neueEinrichtung();
    await assert.rejects(e.pruefeZugang(undefined, false), /Einrichtungscode eingeben/);
    await assert.rejects(e.pruefeZugang('AAAA-AAAA-AAAA', false), /stimmt nicht/);
    await e.pruefeZugang(c, false);
    await e.einrichten({ mandant: 'Familie Beispiel', name: 'Admin', email: 'admin@example.org', passwort: 'ein-langes-passwort' }, c, { ip: '1', geraet: '' });
    await assert.rejects(e.pruefeZugang(c, false), /bereits abgeschlossen/);
    await e.pruefeZugang(undefined, true);
    await e.merke('fertig', false, 'admin');
    await assert.rejects(e.pruefeZugang(undefined, true), /bereits abgeschlossen/, 'nach dem Abschluss auch für den Administrator zu');
  });

  it('„Einrichtung abschließen“ erst mit heruntergeladenem Notfallblatt', async () => {
    let geladen = false;
    const { e, c } = await neueEinrichtung({ notfallblatt: () => geladen });
    await e.einrichten({ mandant: 'Familie Beispiel', name: 'Admin', email: 'admin@example.org', passwort: 'ein-langes-passwort' }, c, { ip: '1', geraet: '' });
    await e.merke('schluessel', false, 'admin');
    await assert.rejects(e.merke('fertig', false, 'admin'), /Notfallblatt/);
    assert.equal((await e.stand()).offen, true);
    geladen = true;
    assert.equal((await e.merke('fertig', false, 'admin')).offen, false);
  });
});

const echtesFastify = await import('fastify').then((m) => typeof m.default === 'function', () => false);

describe('Schnittstellen des Assistenten über HTTP (#804, #806)', { skip: echtesFastify ? false : 'Fastify nicht installiert' }, () => {
  it('Code nötig, nichts angelegt, Datei hin und zurück; nach der Einrichtung zu', async () => {
    const { baueApp } = await import('../src/http');
    const { Dienst } = await import('../src/dienst');
    const { speicherRepo } = await import('../src/repo-speicher');
    const { speicherDateien } = await import('../src/dateispeicher');
    const dienst = new Dienst(speicherRepo(), speicherDateien(), { einstellungen: speicherEinstellungen() });
    const code = new Einrichtungscode(await ordner());
    const c = await code.bereitstellen();
    const konten = new Konten(speicherKontoRepo(), null, 'http://nas', dienst.benutzerspiegel());
    const einrichtung = new Einrichtung({ konten, code, einstellungen: speicherEinstellungen(), mandant: { name: async () => null, umbenennen: async () => {} }, datenbank: () => ({ host: 'db', port: 5432, datenbank: 'dms', benutzer: 'dms' }) });
    const app = await baueApp(dienst, konten, { einrichtung }) as unknown as { inject(o: object): Promise<{ statusCode: number; body: string; headers: Record<string, unknown> }>; close(): Promise<void> };
    try {
      const post = (url: string, payload: unknown, kopf: Record<string, string> = { 'x-einrichtungscode': c }) => app.inject({ method: 'POST', url, headers: { 'x-dms': '1', ...kopf }, payload });
      assert.equal((await post('/api/einrichtung/pruefen', { plan: BEISPIEL }, {})).statusCode, 403);
      assert.equal((await post('/api/einrichtung/datei/lesen', { text: 'x' }, { 'x-einrichtungscode': 'AAAA-AAAA-AAAA' })).statusCode, 403);
      const pr = JSON.parse((await post('/api/einrichtung/pruefen', { plan: BEISPIEL, passwort: 'ein-langes-passwort' })).body);
      assert.deepEqual(pr.probleme, {});
      const geschrieben = JSON.parse((await post('/api/einrichtung/datei/schreiben', { plan: BEISPIEL })).body) as { text: string };
      const gelesen = JSON.parse((await post('/api/einrichtung/datei/lesen', { text: geschrieben.text })).body) as { plan: Einrichtungsplan; fehler: unknown[] };
      assert.deepEqual(gelesen.fehler, []);
      assert.deepEqual(gelesen.plan, BEISPIEL);
      assert.equal(await konten.einrichtungNoetig(), true, 'bis „Jetzt einrichten“ ist nichts angelegt');
      const e = await post('/api/konto/einrichten', { mandant: 'Familie Beispiel', name: 'Admin', email: 'admin@example.org', passwort: 'ein-langes-passwort' });
      assert.equal(e.statusCode, 201);
      const cookie = String(e.headers['set-cookie']).split(';')[0];
      assert.equal((await post('/api/einrichtung/pruefen', { plan: BEISPIEL })).statusCode, 409, 'Code allein reicht nicht mehr');
      assert.equal((await post('/api/einrichtung/pruefen', { plan: BEISPIEL }, { cookie })).statusCode, 200, 'Administrator, Assistent offen (Ändern nach Fehler)');
      await einrichtung.merke('fertig', false, 'admin');
      assert.equal((await post('/api/einrichtung/datei/lesen', { text: geschrieben.text }, { cookie })).statusCode, 409);
    } finally { await app.close(); }
  });
});
