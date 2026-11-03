import { existsSync } from 'node:fs';
import { auskuenfteIn, auskunftOrdner } from './auskunft';
import { liesMail, verbindeImap } from './imap';
import { Postfaecher } from './postfach';
import { PostfachOAuth } from './postfach-oauth';
import { Anmeldesperre } from './anmeldesperre';
import { Zweifaktor } from './zweifaktor';
import { Konsolenzugang, lokaleUrl } from './konsole';
import { Oidc } from './oidc';
import { Eingangsordner } from './eingangsordner';
import { Webdav } from './webdav';
import { pgWebhookRepo, Webhooks } from './webhook';
import { einbettenAus } from './koepfe';
import { proxyVertrauen } from './proxy';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migriere, verbinde, verbindungenAus, Verbindungswarten } from './db';
import { Dienst } from './dienst';
import { mitPruefung, ordnerSpeicher } from './dateispeicher';
import { Speicherplatz, type SpeicherplatzDeps } from './speicherplatz';
import { baueApp } from './http';
import { Konten } from './konten';
import { pgKontoRepo } from './konto-repo';
import { Messung, pgMessSpeicher } from './messung';
import { protokoll } from './protokoll';
import { pgSystemQuelle } from './system';
import { Designs, pgDesignRepo } from './designs';
import { ApiSchluesselDienst, pgApiSchluesselRepo } from './apischluessel';
import { pgRepo } from './repo-pg';
import { Betrieb, pgBetriebSpeicher } from './betrieb';
import { Tresor } from './tresor';
import { pruefeOrdner, SCHLUESSELDATEI } from './ordner';
import { alsUrl, ANBINDUNG_DATEI, AnbindungVerwaltung, ausUrl, ausVariablen, liesAnbindung, pruefeAnbindung, schreibeAnbindung, type Anbindung } from './anbindung';
import { Einrichtungscode } from './einrichtungscode';
import { einrichtungsmodus } from './einrichtungsmodus';
import { Einrichtung } from './einrichtung';
import { bestimmeMandant, mandantNamen } from './mandant';
import { ordnerAblage, Vorschaubilder } from './vorschau';
import { Dateiumwandlung, fassungsOrdner, ordnerFassungen, zieheFassungenUm } from './dateiumwandlung';
import { Archivfassung, archivOrdner, ordnerArchiv, woerterOrdner } from './archivfassung';
import { Texterkennung } from './texterkennung';
import { Paketlaeufer } from './laeufer/verwaltung';
import { hatSchnittstelle } from '../../shared/src/pakete';
import { adressfelder } from '../../shared/src/paketeinstellungen';
import { beendeArbeiter, richteArbeiterEin } from './arbeit';
import { maxAnfragenAus, Ueberlastschutz } from './ueberlast';
import { Systemlast } from './systemlast';
import { liesErweiterungen, sichereErweiterungen } from './erweiterungen';
import { Paketverwaltung } from './pakete';
import { Aufgabenmail } from './aufgabenmail';
import { Fehlermeldungen, pgFehlerRepo } from './fehlermeldungen';
import { Wartung } from './wartung';
import { Notfallzugang } from './notfall';
import { anAlleAdmins } from './mail';
import { arch, release, type } from 'node:os';
import { pgDatenquelle } from './datenbankabzug';
import { pgEinstellungen } from './einstellungen';
import { Sicherung } from './sicherung';
import { eigeneVersion } from './system';
import { Wiederherstellung } from './wiederherstellung';
import { heuteIn } from '../../shared/src/sichten';
import { VARIABLEN_GRUND } from '../../shared/src/umgebungsvariablen';
import { createServer, type Server } from 'node:http';
import { Lasttestmodus, lasttestAus, lasttestSkript, pruefeZiel } from './lasttestmodus';
import { erkenneSpeicherart } from './speicherart';

const pfad = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const env = process.env;

const cfg = {
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '0.0.0.0',
  web: env.WEB_DIR ?? pfad('../../web/dist'),
  migrationen: env.MIGRATIONS_DIR ?? pfad('../migrations'),
  /** Mandant (früher HAUSHALT_ID): steht nach dem Verbinden fest (#119). */
  haushalt: '',
  proxy: proxyVertrauen(env.TRUST_PROXY),
  /** Einbetten in fremde Seiten (#239). */
  einbetten: einbettenAus(env.DMS_EINBETTEN),
};

const log = protokoll.modul('system');
// Feste Ordner (#115): nur über die Volumes der Compose-Datei zugeordnet.
const ordnerPruefung = pruefeOrdner(env, pfad('../../data'));
const { ordner } = ordnerPruefung;
const version = env.DMS_VERSION ?? 'Entwicklung';
log.info(`DMS startet (Version ${version})`, { node: process.version, port: cfg.port, protokoll: protokoll.stufe, proxy: cfg.proxy.text });
if (cfg.proxy.fehler) log.warn(cfg.proxy.fehler);
if (cfg.einbetten.fehler) log.warn(cfg.einbetten.fehler);
// Lasttest-Modus (#612): DMS_LASTTEST=klein|mittel|gross|alle – nur in einer eigenen Test-Installation (unten geprüft).
const lasttest = lasttestAus(env);
if (lasttest.fehler) log.warn(lasttest.fehler);
/** Grund, warum der Lasttest trotz DMS_LASTTEST nicht läuft (echte Ablage) – für die Werkbank-Übersicht. */
let lasttestAbbruch: string | null = null;

// Unerwartete Fehler außerhalb von Anfragen nicht verschlucken.
process.on('unhandledRejection', (e) => protokoll.schreibe('error', 'system', 'Unbehandelter Fehler', { fehler: e instanceof Error ? e.stack : String(e) }));

for (const f of ordnerPruefung.fehler) console.error(f);
if (ordnerPruefung.fehler.length) {
  log.error('Start abgebrochen: frühere Variable für einen Ordner mit abweichendem Wert', { variablen: ordnerPruefung.fehler.length });
  process.exit(1);
}
for (const v of ordnerPruefung.ueberfluessig) log.warn(`${v} ist nicht mehr nötig und kann aus der Compose-Datei entfernt werden. ${VARIABLEN_GRUND.ordner}`);

for (const o of Object.values(ordner)) await mkdir(o, { recursive: true });

// Datenbank-Anbindung (#119): Datei unter /data/geheim, führend; sonst DATABASE_URL übernehmen;
// sonst (oder wenn sie nicht funktioniert) der Einrichtungsassistent im Browser.
// App-Stores (#176): DMS_EINRICHTUNGSCODE=aus – ohne Code einrichten.
const einrichtungscode = new Einrichtungscode(ordner.geheim, Date.now, env.DMS_EINRICHTUNGSCODE === 'aus');
// Vorlagen für NAS-Systeme (#184): nur DMS_DB_PASSWORT statt einer ganzen DATABASE_URL.
const umgebung = ausUrl(env.DATABASE_URL) ?? ausVariablen(env);
if (env.DMS_DB_PASSWORT?.startsWith('HIER-')) log.warn('DMS_DB_PASSWORT ist noch das Beispiel aus der Vorlage – bitte in der Compose-Datei ein eigenes Passwort eintragen und das Projekt neu erstellen');
if (env.DATABASE_URL && !umgebung) log.error('DATABASE_URL ist keine gültige postgres://-Adresse und wird ignoriert');
let anbindung: Anbindung | null = null;
try { anbindung = await liesAnbindung(ordner.geheim); } catch (e) { log.error('Datei der Datenbank-Anbindung nicht lesbar', { fehler: (e as Error).message }); }
const quelle = anbindung ? 'datei' as const : umgebung ? 'umgebung' as const : null;
const kandidat = anbindung ?? umgebung;
let verbunden = false;
let startfehler: string | null = null;
if (kandidat) {
  // Der Datenbank-Container braucht nach dem Start manchmal einen Moment.
  for (let versuch = 1; versuch <= 5; versuch++) {
    const p = await pruefeAnbindung(kandidat);
    if (p.ok) { verbunden = true; break; }
    startfehler = p.text;
    log.warn(`Datenbank nicht verbunden (Versuch ${versuch}/5): ${p.text}`, { technisch: p.technisch });
    if (p.art !== 'nicht_erreichbar') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
if (verbunden && !anbindung && umgebung) {
  await schreibeAnbindung(ordner.geheim, umgebung);
  anbindung = umgebung;
  if (env.DATABASE_URL) log.info(`DATABASE_URL in ${ANBINDUNG_DATEI} übernommen – die Variable ist nicht mehr nötig und kann aus der Compose-Datei entfernt werden. ${VARIABLEN_GRUND.datenbank}`);
  else log.info(`Datenbank-Anbindung aus DMS_DB_PASSWORT in ${ANBINDUNG_DATEI} übernommen`);
}
if (!verbunden) {
  anbindung = await einrichtungsmodus({
    geheim: ordner.geheim, code: einrichtungscode, vorbelegt: kandidat, quelle, fehler: startfehler,
    port: cfg.port, host: cfg.host, webDir: cfg.web, proxy: cfg.proxy.trust, einbetten: cfg.einbetten, wiederholenMs: kandidat ? 10_000 : undefined,
  });
}
const db = anbindung!;
const datenbankUrl = alsUrl(db);
// Verbindungen zur Datenbank (#544): Vorgabe 10, für größere Installationen DMS_DB_VERBINDUNGEN.
const verbindungsZahl = verbindungenAus(env);
if (verbindungsZahl.fehler) log.warn(verbindungsZahl.fehler);
const sql = verbinde(datenbankUrl, verbindungsZahl.max);
await migriere(sql, cfg.migrationen, (m) => protokoll.modul('datenbank').info(m));
const [{ server_version: pgVersion }] = await sql`SHOW server_version`;
protokoll.modul('datenbank').info('Datenbank verbunden', { postgres: pgVersion, host: db.host, datenbank: db.datenbank, verbindungen: `${verbindungsZahl.max}${verbindungsZahl.quelle === 'umgebung' ? ' (DMS_DB_VERBINDUNGEN)' : ''}` });
const verbindungswarten = new Verbindungswarten(sql, verbindungsZahl.max, verbindungsZahl.quelle);
verbindungswarten.start();
// Überlastschutz (#544): mehr als DMS_MAX_ANFRAGEN gleichzeitig (Vorgabe 250) → sofort 503 mit Retry-After.
const ueberlastZahl = maxAnfragenAus(env);
if (ueberlastZahl.fehler) log.warn(ueberlastZahl.fehler);
const ueberlast = new Ueberlastschutz(ueberlastZahl.max, ueberlastZahl.quelle);
const mandant = await bestimmeMandant(sql, db, env, (a) => schreibeAnbindung(ordner.geheim, a));
cfg.haushalt = mandant.id;
if (mandant.hinweis) log.warn(mandant.hinweis);

// E-Mail-Versand und Adresse des DMS stehen in der Werkbank (#37); frühere Umgebungsvariablen
// werden beim ersten Start nach dem Update einmalig übernommen.
// Schlüssel für verschlüsselte Zugangsdaten (#39): eine Datei, nie in der Datenbank.
const tresor = new Tresor(pgBetriebSpeicher(sql, cfg.haushalt), join(ordner.geheim, SCHLUESSELDATEI));
await tresor.laden();
const betrieb = new Betrieb(pgBetriebSpeicher(sql, cfg.haushalt), `http://localhost:${cfg.port}`, tresor);
await betrieb.laden();
await betrieb.uebernimmAlteVariablen(env);

// Jeder Datenbankzugriff der Repos wird gezählt und gestoppt (Entwicklermodus, lange Zugriffe).
const messung = new Messung(pgMessSpeicher(sql, cfg.haushalt));
await messung.start();
messung.auslastung.start();
// Arbeiter für PDF und große Exporte (#542): ein kleiner Pool von Fäden neben dem Hauptfaden.
const arbeiter = richteArbeiterEin(env, { vorwaermen: true });
if (arbeiter.fehler) log.warn(arbeiter.fehler);
log.info(arbeiter.groesse ? `Arbeiter für PDF und Exporte: ${arbeiter.groesse}${arbeiter.quelle === 'umgebung' ? ' (DMS_ARBEITER)' : ` (Vorgabe bei ${arbeiter.kerne} Kernen)`}` : 'Arbeiter für PDF und Exporte ausgeschaltet (DMS_ARBEITER=0): PDF-Arbeiten laufen im Hauptfaden');
// Speicherplatz (#116): an der Grenze ist das Hochladen gesperrt; Wartung und Mail kommen unten dazu.
const spDeps: SpeicherplatzDeps = { einstellungen: pgEinstellungen(sql, cfg.haushalt) };
const speicherplatz = new Speicherplatz(ordner, spDeps);
const hochladen = () => speicherplatz.pruefeHochladen();
const dienst = new Dienst(messung.umhuelle(pgRepo(sql, cfg.haushalt), 'mappen'), mitPruefung(ordnerSpeicher(ordner.dateien, cfg.haushalt), hochladen), {
  tresor, einstellungen: pgBetriebSpeicher(sql, cfg.haushalt),
});
// Benutzer erscheinen als Mappen (#26); die Konten halten sie auf dem neuesten Stand.
const konten = new Konten(messung.umhuelle(pgKontoRepo(sql, cfg.haushalt), 'konto'), () => betrieb.mailer(), () => betrieb.adresseFuerLinks(), dienst.benutzerspiegel());
dienst.verbindeKonten(konten.papierkorbHaken());
// Texterkennung im Hintergrund (#45); dieselbe Datenbank, eigener Messbereich.
// Wartungsmodus (#102): überdauert einen Neustart; pausiert die Hintergrundarbeiten.
const wartung = new Wartung(pgBetriebSpeicher(sql, cfg.haushalt), konten);
await wartung.laden();
wartung.start();
// Notfallzugang über eine RESCUE-Datei neben der Schlüsseldatei (#108).
const anAdmins = async (betreff: string, text: string) => { await anAlleAdmins(await konten.listeBenutzer(), betrieb.mailer(), betreff, text); };
spDeps.wartung = wartung;
spDeps.anAdmins = anAdmins;
// Anmeldeschutz (#240): Sperren in der Datenbank, einstellbar in der Werkbank.
const anmeldesperre = new Anmeldesperre(pgEinstellungen(sql, cfg.haushalt), anAdmins);
konten.verbindeSperre(anmeldesperre);
// Zwei-Faktor-Anmeldung (#242): Geheimnis verschlüsselt mit dem Schlüssel des DMS.
konten.verbindeZweifaktor(new Zweifaktor(pgEinstellungen(sql, cfg.haushalt), (k) => tresor.verschluessele(k), (w) => tresor.entschluessele(w)));
const notfall = new Notfallzugang(join(dirname(tresor.datei), 'RESCUE'), konten, pgBetriebSpeicher(sql, cfg.haushalt), anAdmins);
// Sicherungen (#103–#105): eigenes Volume, verschlüsselt mit dem Schlüssel der Werkbank.
const sicherung = new Sicherung(ordner.sicherung, ordner.dateien, cfg.haushalt, {
  tresor, einstellungen: pgEinstellungen(sql, cfg.haushalt), daten: pgDatenquelle(sql),
  umgebung: async () => ({ dms: eigeneVersion(), node: process.versions.node, system: `${type()} ${release()}`, architektur: arch() }),
  wartungAktiv: () => wartung.aktiv, anAdmins,
});
// Wiederherstellen und Probe (#107, #109): eigenes Schema, erst nach allen Prüfungen umschalten.
const wiederherstellung = new Wiederherstellung({
  url: datenbankUrl, sql, migrationen: cfg.migrationen, dateiWurzel: ordner.dateien, sicherung, tresor,
  laufzeit: async () => ({ dms: eigeneVersion(), postgres: String(pgVersion), architektur: arch(), haushaltId: cfg.haushalt, migrationen: (await readdir(cfg.migrationen)).filter((f) => f.endsWith('.sql')).sort() }),
  wartungAktiv: () => wartung.aktiv,
  einrichtungNoetig: () => konten.einrichtungNoetig(),
  // Im Container startet Docker (restart: unless-stopped) das DMS gleich wieder.
  neustart: () => { log.warn('Neustart nach der Wiederherstellung'); void beenden(); },
  // Gehört die Sicherung zu einem anderen Mandanten, gilt nach dem Neustart dessen Id (#119).
  mandantUebernehmen: async (id) => { await schreibeAnbindung(ordner.geheim, { ...db, mandant: id }); },
  pruefeCode: (c) => einrichtungscode.pruefe(c),
  anAdmins,
});
sicherung.sperre = () => wiederherstellung.laeuft();
await wiederherstellung.raeumeAuf();
// Erweiterungen der Suche (#562): pg_trgm anlegen bzw. umziehen, wenn sie fehlt; sonst Hinweis im Protokoll.
await sichereErweiterungen(sql, protokoll.modul('datenbank')).catch((e) => log.warn('Erweiterungen der Datenbank nicht geprüft', { fehler: (e as Error).message }));
const abschluss = await pgEinstellungen(sql, cfg.haushalt).lies('wiederherstellung_abschluss') as { sicherung?: string } | null;
if (abschluss) log.warn('Gestartet nach einer Wiederherstellung', { sicherung: abschluss.sicherung });
const texterkennung = new Texterkennung(messung.umhuelle(pgRepo(sql, cfg.haushalt), 'texterkennung'), ordnerSpeicher(ordner.dateien, cfg.haushalt), pgBetriebSpeicher(sql, cfg.haushalt));
dienst.verbindeTexterkennung(texterkennung);
texterkennung.pause = () => wartung.aktiv;
wartung.beimAusschalten(() => texterkennung.anstossen());
// Vorschaubilder der ersten Seite (#332): außerhalb des Haushaltsordners, damit sie nicht in die Sicherung gehen.
const vorschau = new Vorschaubilder(ordnerAblage(join(ordner.dateien, 'vorschau', cfg.haushalt)), ordnerSpeicher(ordner.dateien, cfg.haushalt));
dienst.verbindeVorschau(vorschau);
vorschau.pause = () => wartung.aktiv;
wartung.beimAusschalten(() => vorschau.anstossen());
// Dateien umwandeln (#577): Fassungen aus Paketen mit dms:umwandeln im Haushaltsordner – sie gehen mit in die
// Sicherung (seit 0.140.1; vorher lagen sie daneben und ziehen beim Start um). Daraus Vorschaubild und Volltext.
await zieheFassungenUm(ordner.dateien, cfg.haushalt).catch((e) => log.warn('Umgewandelte Fassungen nicht verschoben', { fehler: (e as Error).message }));
const umwandlung = new Dateiumwandlung(dienst.umwandlungAnbindung(ordnerFassungen(fassungsOrdner(ordner.dateien, cfg.haushalt)), vorschau));
dienst.verbindeUmwandlung(umwandlung, vorschau);
vorschau.fassung = (sha) => umwandlung.lies(sha);
texterkennung.umwandlung = { lies: (sha) => umwandlung.lies(sha), paketFuer: (m) => umwandlung.paketFuer(m), anfordern: (d) => umwandlung.anfordern(d) };
// Volltext aus Paketen (#614): Dateitypen, für die ein Paket mit dms:volltext den Text liefert.
texterkennung.volltextPaket = dienst.paketVolltext;
// Archivfassung (PDF/A, #631): Pakete mit dms:archivfassung legen sie im Haushaltsordner ab (Sicherung, Vollexport);
// Wortpositionen der Texterkennung daneben. Der Kern meldet Dokumente erst mit feststehendem Volltext.
const archivfassung = new Archivfassung(dienst.archivAnbindung(ordnerArchiv(archivOrdner(ordner.dateien, cfg.haushalt), woerterOrdner(ordner.dateien, cfg.haushalt))));
dienst.verbindeArchivfassung(archivfassung);
// Tägliche Zusammenfassung der offenen Aufgaben (#54).
const typName = async (id: string | undefined) => (await dienst.listeTypen()).find((t) => t.id === id)?.name ?? '';
const aufgabenmail = new Aufgabenmail({
  benutzer: () => konten.listeBenutzer(),
  einstellungenVon: (b) => konten.einstellungen(b),
  // Aufgaben zu Mappen, die der Empfänger nicht lesen darf, ohne Titel (#127).
  aufgabenVon: async (b) => dienst.meineAufgaben(b, await dienst.zugriff(b)),
  typName,
}, () => betrieb.mailer(), () => betrieb.adresseFuerLinks(), pgBetriebSpeicher(sql, cfg.haushalt));
const designs = new Designs(messung.umhuelle(pgDesignRepo(sql, cfg.haushalt), 'designs'), mitPruefung(ordnerSpeicher(ordner.dateien, `${cfg.haushalt}/designs`), hochladen));
// Einrichtungsassistent (#119): Mandant und Administrator mit Code, danach die weiteren Schritte.
const einrichtungNoetig = await konten.einrichtungNoetig();
if (einrichtungNoetig) await einrichtungscode.bereitstellen();
else if (existsSync(einrichtungscode.datei)) await einrichtungscode.entfernen();
const einrichtung = new Einrichtung({
  konten, code: einrichtungNoetig ? einrichtungscode : null, einstellungen: pgEinstellungen(sql, cfg.haushalt),
  mandant: mandantNamen(sql, cfg.haushalt), schriftzug: (t) => designs.setzeSchriftzug(t),
});
// Eingangsordner (#195): /eingang, wenn eingebunden; nur eine Instanz übernimmt (Sperre in PostgreSQL).
let eingangSperre: Promise<boolean> | null = null;
const eingangsordner = new Eingangsordner(env.DMS_EINGANG ?? '/eingang', {
  dienst, einstellungen: pgEinstellungen(sql, cfg.haushalt),
  benutzer: () => konten.listeBenutzer(),
  pause: () => (wartung.aktiv ? 'Wartungsmodus' : wiederherstellung.laeuft() ? 'Wiederherstellung läuft' : null),
  sperre: () => (eingangSperre ??= (async () => {
    // Eine eigene Verbindung hält die Sperre, solange das DMS läuft.
    const v = await sql.reserve();
    const [r] = await v`SELECT pg_try_advisory_lock(4711195) AS ok`;
    if (!r.ok) { v.release(); eingangSperre = null; }
    return r.ok as boolean;
  })()),
});
// Postfächer (#196): Mails per IMAP abholen; nur eine Instanz ruft ab.
let postSperre: Promise<boolean> | null = null;
// Anmeldung per OAuth 2.0 (#358): Token verschlüsselt mit dem Schlüssel des DMS.
const postfachOAuth = new PostfachOAuth({ einstellungen: pgEinstellungen(sql, cfg.haushalt), verschluessele: (k) => tresor.verschluessele(k), entschluessele: (w) => tresor.entschluessele(w), anAdmins });
const postfaecher = new Postfaecher({
  dienst, einstellungen: pgEinstellungen(sql, cfg.haushalt), verbinde: verbindeImap, lies: liesMail, oauth: postfachOAuth,
  verschluessele: (k) => tresor.verschluessele(k), entschluessele: (w) => tresor.entschluessele(w),
  pause: () => (wartung.aktiv ? 'Wartungsmodus' : wiederherstellung.laeuft() ? 'Wiederherstellung läuft' : null),
  platz: () => speicherplatz.pruefeHochladen(),
  anAdmins,
  sperre: () => (postSperre ??= (async () => {
    const v = await sql.reserve();
    const [r] = await v`SELECT pg_try_advisory_lock(4711196) AS ok`;
    if (!r.ok) { v.release(); postSperre = null; }
    return r.ok as boolean;
  })()),
});
const anbindungVerwaltung = new AnbindungVerwaltung(ordner.geheim, db, umgebung, () => { void beenden(); });
// Befehl dms im Container (#244).
const konsole = new Konsolenzugang();
// Anmeldung über einen Anbieter (#241); Client-Secret verschlüsselt mit dem Schlüssel des DMS.
const oidc = new Oidc({ einstellungen: pgEinstellungen(sql, cfg.haushalt), verschluessele: (k) => tresor.verschluessele(k), entschluessele: (w) => tresor.entschluessele(w) });
konten.verbindeAnbieter(() => oidc.bereit());
// Nach dem Schlüsselwechsel das zwischengespeicherte Client-Secret neu lesen (#410).
tresor.beimWechsel(async () => oidc.vergiss());
// Paket-Läufer (#338): Pakete mit Code in einem eigenen Prozess; ihre API-Anfragen laufen über app.inject.
const apiSchluessel = new ApiSchluesselDienst(messung.umhuelle(pgApiSchluesselRepo(sql), 'apischluessel'));
let appFuerPakete: Awaited<ReturnType<typeof baueApp>> | null = null;
const paketlaeufer: Paketlaeufer = new Paketlaeufer({
  dienst, konten, schluessel: apiSchluessel,
  api: async (q) => {
    if (!appFuerPakete) return { status: 503, kopf: {}, body: Buffer.from('DMS startet noch.') };
    const r = await appFuerPakete.inject({ method: q.methode as 'GET', url: q.pfad, headers: q.kopf, payload: q.body, remoteAddress: '127.0.0.1' });
    return { status: r.statusCode, kopf: Object.fromEntries(Object.entries(r.headers).map(([k, v]) => [k, String(v)])), body: r.rawPayload };
  },
  einstellungen: (id): Promise<Record<string, unknown>> => pakete.einstellungenFuerPaket(id).catch(() => ({})),
  speicher: { lies: (id) => dienst.paketSpeicher(id), schreibe: (id, w) => dienst.setzePaketSpeicher(id, w) },
  pausiert: () => wartung.aktiv,
});
const pakete: Paketverwaltung = new Paketverwaltung(dienst, {
  version: eigeneVersion,
  benutzer: async () => (await konten.listeBenutzer()).filter((b) => b.aktiv !== false).map((b) => ({ id: b.id, name: b.name || b.email })),
  laeufer: paketlaeufer,
});
// Ereignis „Volltext fertig“ (#336, #458) nach dem Schritt des Kerns – auch ohne Text, damit ein Paket für die
// Texterkennung übernehmen kann; nicht bei Fehler, ausgelassen oder abgebrochen.
texterkennung.nachher = (d, e, k) => {
  if (e.stand !== 'fertig' && e.stand !== 'paket') return;
  // Umgewandelte Datei (#577): mime ist der Typ der Fassung, original der des Dokuments.
  void dienst.volltextFertig({ dokument: d.id, mappe: d.mappeId }, { quelle: 'kern', text: k.text, mime: k.mime ?? d.mime, ...(k.original ? { original: k.original } : {}), seiten: e.seiten ?? null, neu: k.neu, seitenOhneText: k.seitenOhneText });
};
// Texterkennung als Paket (#458): das installierte Paket mit dms:texterkennung.
texterkennung.paket = () => dienst.texterkennungPaket();
// Sicherung außer Haus (#585): Pakete mit dms:sicherung-lesen bekommen jede fertige Sicherung (Ereignis sicherung.fertig),
// lesen die verschlüsselte Datei in Stücken und melden je Sicherung zurück. Adresse: die bestätigte aus den Einstellungen.
sicherung.extern = {
  pakete: async () => Promise.all((await dienst.listePakete()).filter((p) => hatSchnittstelle(p.laeufer, 'dms:sicherung-lesen')).map(async (p) => {
    const werte = p.einstellungen ? (await dienst.paketEinstellungen(p.id))?.werte ?? {} : {};
    const adresse = p.einstellungen ? adressfelder(p.einstellungen).map((f) => werte[f.schluessel]).find((v): v is string => typeof v === 'string' && !!v) ?? null : null;
    return { id: p.id, name: p.name, adresse };
  })),
  melde: (daten) => dienst.melde('sicherung.fertig', { ...daten }, undefined, null, (p) => hatSchnittstelle(p.laeufer, 'dms:sicherung-lesen')),
};
dienst.sicherungAufgegeben = (paket, name, fehler) => sicherung.externAufgegeben(paket, name, fehler);
wartung.beimAusschalten(() => void paketlaeufer.stelleZu());
// Systemzustand → Auslastung (#409): CPU, Arbeitsspeicher, Netzwerk jede Minute, nur im Arbeitsspeicher.
const systemlast = new Systemlast({ laeufer: () => paketlaeufer.pid, postgres: process.env.DMS_VARIANTE === 'komplett', schleife: () => !!messung.auslastung.warnung() });
systemlast.start();

// Webhooks (#627): melden geänderte Zahlen eines Benutzers (wie GET /api/v1/ich/zaehler) an freigegebene Ziele.
// Geheimnis verschlüsselt mit dem Schlüssel des DMS; regelmäßige Läufe nur auf dem Server mit der Sperre.
let webhookSperre: Promise<boolean> | null = null;
const webhooks = new Webhooks({
  repo: messung.umhuelle(pgWebhookRepo(sql, cfg.haushalt), 'webhooks'),
  einstellungen: pgEinstellungen(sql, cfg.haushalt),
  verschluessele: (k) => tresor.verschluessele(k), entschluessele: (w) => tresor.entschluessele(w),
  zahlen: async (b) => { const r = await dienst.zaehlerAbruf(await dienst.zugriff(b)); return { ...r.zahlen, stand: r.stand, geaendert: r.geaendert }; },
  benutzer: (id) => konten.benutzerMitId(id),
  pause: () => (wartung.aktiv ? 'Wartungsmodus' : wiederherstellung.laeuft() ? 'Wiederherstellung läuft' : null),
  anAdmins,
  sperre: () => (webhookSperre ??= (async () => {
    const v = await sql.reserve();
    const [r] = await v`SELECT pg_try_advisory_lock(4711197) AS ok`;
    if (!r.ok) { v.release(); webhookSperre = null; }
    return r.ok as boolean;
  })()),
});
dienst.beiAenderung(() => webhooks.anstossen());
// WebDAV-Laufwerk (#346): Anmeldung mit API-Schlüssel, im Standard aus (Werkbank → WebDAV-Laufwerk).
const webdav = new Webdav({ dienst, konten, schluessel: apiSchluessel, einstellungen: pgEinstellungen(sql, cfg.haushalt), adresse: () => betrieb.adresseFuerLinks(), wartung });
const app = await baueApp(dienst, konten, {
  webdav,
  webhooks,
  pakete,
  paketlaeufer,
  konsole,
  oidc,
  einbetten: cfg.einbetten,
  webDir: cfg.web,
  sicher: () => betrieb.cookieNurHttps(),
  proxy: cfg.proxy.trust,
  messung,
  system: pgSystemQuelle(sql, cfg.haushalt),
  designs,
  einrichtung,
  anbindung: anbindungVerwaltung,
  mandantHinweis: mandant.hinweis,
  mandantName: () => mandantNamen(sql, cfg.haushalt).name(),
  apiSchluessel,
  betrieb,
  tresor,
  texterkennung,
  vorschau,
  aufgabenmail,
  // Screenshots der Fehlermeldungen getrennt von den Dokumenten (#70).
  wartung,
  notfall,
  sicherung,
  wiederherstellung,
  speicherplatz,
  systemlast,
  ueberlast,
  verbindungen: verbindungswarten,
  erweiterungen: () => liesErweiterungen(sql),
  eingangsordner,
  postfaecher,
  postfachOAuth,
  ordner: ordnerPruefung,
  lasttestAbbruch: () => lasttestAbbruch,
  fehlermeldungen: new Fehlermeldungen(pgFehlerRepo(sql, cfg.haushalt), ordnerSpeicher(ordner.dateien, `${cfg.haushalt}/fehlermeldungen`)),
});

const kurz = betrieb.kurz();
log.info(`E-Mail-Versand: ${kurz.mail === 'aus' ? 'aus – Links werden in der Benutzerverwaltung angezeigt (einrichten in Werkbank → E-Mail und Adresse)' : kurz.mail}`);
log.info(`Adresse für Links: ${kurz.adresse}`);
const nachgezogen = await dienst.titelNachziehen();
if (nachgezogen) log.info(`Titel von ${nachgezogen} Mappen berechnet`);
// Systemtypen Benutzer und Rolle anlegen und jedem Benutzer seine Mappe geben (auch nach einem Update).
await dienst.gleicheBenutzerAb(await konten.listeBenutzer());
// Schlüssel für Mappentypen (#145), einmalig nach dem Update.
await dienst.typSchluesselNachziehen();
// Haken „Neue Mappen/Löschen erlauben“ → Berechtigungen (#146), einmalig nach dem Update.
await dienst.hakenUeberfuehren();
const geprueft = await dienst.passungNachziehen();
if (geprueft) log.info(`Mappen von ${geprueft} Mappentypen gegen ihre Definition geprüft`);
// Papierkorb (#43): Abgelaufenes stündlich endgültig löschen.
// Auskünfte (#396): nach 7 Tagen weg – im selben stündlichen Lauf.
const papierkorb = async () => { if (!wartung.aktiv) await dienst.raeumePapierkorbAuf(); await auskuenfteIn(auskunftOrdner(sicherung.ordner)); };
const papierkorbLauf = () => papierkorb().catch((e) => log.error('Papierkorb aufräumen fehlgeschlagen', { fehler: (e as Error).message }));
await papierkorbLauf();
setInterval(papierkorbLauf, 60 * 60 * 1000).unref();
// Abwesenheit (#78): Abgelaufenes beenden, „abwesend“ an den Benutzer-Mappen nachziehen.
const abwesenheiten = () => konten.abwesenheitenPruefen().catch((e) => log.error('Abwesenheiten prüfen fehlgeschlagen', { fehler: (e as Error).message }));
await abwesenheiten();
setInterval(abwesenheiten, 60 * 60 * 1000).unref();
// Anmeldeschutz (#368): höchstens eine Sammelmeldung am Tag über die Sperren des Vortags.
const sperrMeldung = () => anmeldesperre.meldeTaeglich().catch((e) => log.error('Sammelmeldung Anmeldeschutz fehlgeschlagen', { fehler: (e as Error).message }));
await sperrMeldung();
setInterval(sperrMeldung, 15 * 60 * 1000).unref();
// Fristen und Erinnerungen (#129, #131): einmal am Tag – gleich nach Mitternacht bzw. beim Start –, vor der Zusammenfassung.
let fristenTag = '';
const fristen = async () => {
  const heute = heuteIn();
  if (wartung.aktiv || heute === fristenTag) return;
  const r = await dienst.fristenLauf(heute);
  fristenTag = heute;
  if (r.angelegt || r.erledigt || r.erinnerungen) log.info('Fristen und Erinnerungen geprüft', r);
};
await fristen().catch((e) => log.error('Fristen prüfen fehlgeschlagen', { fehler: (e as Error).message }));
setInterval(() => void fristen().then(() => (wartung.aktiv ? 0 : aufgabenmail.pruefe()))
  .catch((e) => log.error('Fristen oder Aufgaben-Mail fehlgeschlagen', { fehler: (e as Error).message })), 5 * 60 * 1000).unref();
if (einrichtungNoetig) log.warn(`Noch kein Benutzer vorhanden: Öffne das DMS im Browser (Port ${cfg.port}) und richte es mit dem Einrichtungscode ein.`);

appFuerPakete = app;
await texterkennung.start();
await paketlaeufer.start().catch((e: unknown) => log.error('Paket-Läufer startet nicht', { fehler: (e as Error).message }));
notfall.start();
sicherung.start();
speicherplatz.start();
await eingangsordner.start();
postfaecher.start();
webhooks.start();
// Wörterverzeichnis der Suche (#575): neue Wörter aus dem Eingang übernehmen – entkoppelt von Mappen und Texterkennung.
let woerterFehler = '';
setInterval(() => {
  if (wiederherstellung.laeuft()) return;
  void dienst.woerterEinarbeiten().then(() => { woerterFehler = ''; }, (e) => {
    // Nur einmal je Fehlerbild melden, nicht alle fünf Sekunden.
    if ((e as Error).message !== woerterFehler) log.warn('Wörterverzeichnis: neue Wörter nicht übernommen', { fehler: (e as Error).message });
    woerterFehler = (e as Error).message;
  });
}, 5000).unref();
setInterval(() => void wiederherstellung.tick().catch((e) => log.error('Zeitplan der Probe gestört', { fehler: (e as Error).message })), 60_000).unref();

// Lasttest-Modus (#612): Das DMS läuft nur intern (127.0.0.1, freier Port) – dorthin misst das Skript. Unter dem Port des
// Containers steht nur die Seite mit Fortschritt und Ergebnis. Vorher prüft das Skript ohne etwas anzulegen, ob dies eine
// frische oder eine eigene Test-Installation ist; sonst läuft das DMS normal weiter und meldet den Abbruch.
let lasttestSeite: Lasttestmodus | null = null;
let intern: Server | null = null;
if (lasttest.wahl) {
  const skript = lasttestSkript(env, [pfad('../../lasttest/lasttest.mjs'), pfad('../test/lasttest.mjs')]);
  if (!skript) lasttestAbbruch = 'Das Skript des Lasttests (dms-lasttest) fehlt in diesem Image.';
  else {
    await app.ready();
    const s = createServer(app.routing);
    // Wie der Server des DMS (Fastify): dieselben Wartezeiten für Verbindungen.
    s.keepAliveTimeout = app.server.keepAliveTimeout; s.requestTimeout = app.server.requestTimeout; s.headersTimeout = app.server.headersTimeout;
    await new Promise<void>((r) => s.listen({ port: 0, host: '127.0.0.1', backlog: 2048 }, () => r()));
    intern = s;
    const adresse = s.address();
    const ziel = `http://127.0.0.1:${typeof adresse === 'object' && adresse ? adresse.port : 0}`;
    const skriptEnv = { ...env, DMS_GEHEIM: ordner.geheim };
    const p = await pruefeZiel(skript, ziel, skriptEnv);
    if (p.ok) {
      const daten = dirname(ordner.geheim);
      lasttestSeite = new Lasttestmodus({
        wahl: lasttest.wahl, dauer: lasttest.dauer, skript, ziel, ergebnisOrdner: join(daten, 'ergebnis'), env: skriptEnv,
        speicherart: erkenneSpeicherart(daten), port: cfg.port, host: cfg.host, webDir: cfg.web, proxy: cfg.proxy.trust, einbetten: cfg.einbetten,
        beenden: () => beenden(),
      });
    } else {
      lasttestAbbruch = p.grund;
      await new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()); });
      intern = null;
    }
  }
  if (lasttestAbbruch) log.error(`DMS_LASTTEST ist gesetzt, der Lasttest startet aber nicht: ${lasttestAbbruch} Das DMS läuft normal weiter – entferne die Variable.`);
}

const beenden = async () => {
  log.info('DMS wird beendet');
  await lasttestSeite?.stop();
  if (intern) { const s = intern; await new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()); }); }
  texterkennung.stop();
  await paketlaeufer.stop();
  vorschau.stop();
  wartung.stop();
  notfall.stop();
  sicherung.stop();
  speicherplatz.stop();
  webhooks.stop();
  await konsole.entferne();
  await app.close();
  await beendeArbeiter();
  verbindungswarten.stop();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on('SIGTERM', beenden);
process.on('SIGINT', beenden);

// Warteschlange für neue Verbindungen (#544): Bei Überlast nimmt der Server sie verzögert an; mit 511 (Vorgabe von Node)
// bekamen einzelne Programme gar keine Verbindung mehr.
if (lasttestSeite) await lasttestSeite.start();
else await app.listen({ port: cfg.port, host: cfg.host, backlog: 2048 });
const konsolenAdresse = lasttestSeite && intern ? (() => { const a = intern.address(); return `http://127.0.0.1:${typeof a === 'object' && a ? a.port : cfg.port}`; })() : lokaleUrl(cfg.port, cfg.host);
await konsole.schreibe(konsolenAdresse)
  .catch((e) => log.warn('Konsolenzugang nicht angelegt – der Befehl dms geht nicht', { datei: konsole.datei, fehler: (e as Error).message }));
