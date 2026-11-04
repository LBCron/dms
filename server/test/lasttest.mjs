/**
 * Lasttest in drei Stufen (#544, #563): viele gleichzeitige HTTP-Anfragen gegen ein laufendes DMS. Kein Test für
 * jeden PR – von Hand, im Workflow „Lasttest“ (wöchentlich und vor größeren Releases) oder von Betreibern gegen
 * eine eigene Test-Installation (Administratorhandbuch → Lasttest selbst durchführen). Ohne Abhängigkeiten: nur
 * `fetch` von Node.js. Im Image als Befehl `dms-lasttest`.
 *
 *   node server/test/lasttest.mjs klein|mittel|gross|alle [--ziel http://127.0.0.1:3000] [Optionen]
 *
 * | Stufe  | bildet ab                     | Last                                         | Daten          | Ziel (CI-Grenze)                    |
 * | klein  | Haushalt (2–5 Personen)       | 25 gleichzeitig                              | 5.000 Mappen   | p95 < 0,3 s (0,3 s), keine Fehler   |
 * | mittel | Kleinbetrieb (10–15 Personen) | 100 gleichzeitig, großer Export nebenher     | 50.000 Mappen  | p95 < 1 s (2,86 s), Fehler < 0,1 %  |
 * | gross  | Belastungsgrenze              | +25 alle 2 Minuten bis p95 > 3 s, Fehler > 1 % oder Überlastschutz greift; danach 1000 gleichzeitig | 200.000 Mappen | gemessen wird die Grenze; Pflicht: kein Absturz, Erholung |
 *
 * klein und mittel sind eine Qualitätszusage mit Ziel und CI-Grenze: Das Ziel (p95) steht im Bericht; verfehlt heißt
 * „beschleunigen“ (Folge-Issue), nicht rot. Mit `--grenzen` richtet sich der Exit-Code (1) nach der CI-Grenze, die
 * aus dem ersten Lauf auf den Rechnern von GitHub stammt (+ 20 %) und nur strenger wird. groß ist eine Messung: Die
 * Grenze steht im Bericht; mit `--vorher <json>` warnt der Test, wenn sie mehr als 20 % unter der des letzten
 * Laufs liegt. Pflichten von groß (keine Anfrage ohne Antwort, Arbeitsspeicher begrenzt, Erholung, Anmeldeschutz)
 * zählen wie bisher als Grenzen.
 *
 * Schutz der echten Ablage: Ist das DMS frisch, richtet der Test es selbst ein (Lasttest-Konten, Beispiele,
 * Demo-Mappen). Ist es schon eingerichtet, misst er nur, wenn er sich mit seinen eigenen Konten anmelden kann und
 * höchstens ECHTE_MAPPEN_MAX Mappen keine Demo-Mappen sind – sonst bricht er ab, bevor er etwas anlegt. Fehlen
 * Demo-Mappen für die Stufe, legt er sie dazu (je Lauf höchstens 50.000).
 *
 * Lasttest-Modus (#612): Startet das DMS mit DMS_LASTTEST=klein|mittel|gross|alle, startet es dieses Skript selbst
 * (als Kindprozess) und zeigt Fortschritt und Ergebnis im Browser. Dafür meldet das Skript seine Schritte über den
 * IPC-Kanal (`process.send`), wenn es einen gibt – auf der Konsole ändert sich nichts. `--pruefen` prüft nur, ob das
 * Ziel eine frische oder eine eigene Test-Installation ist (Exit-Code 0) oder nicht (2), und legt nichts an.
 *
 * Optionen: --ziel <URL> (sonst DMS_URL, sonst http://127.0.0.1:$PORT), --dauer <s je Durchgang> (120),
 * --schritt-dauer <s je Schritt von groß> (120), --bis <n> (groß: höchstens so viele gleichzeitig),
 * --code <Einrichtungscode> (sonst aus /data/geheim/EINRICHTUNGSCODE), --geraet <Text>, --speicher <HDD|SSD|NVMe>,
 * --bericht <Datei> (Markdown), --json <Datei>, --vorher <Datei> (JSON eines früheren Laufs), --grenzen,
 * --gleichzeitig <n> [--ohne-export] (ein einzelner Durchgang), --einrichten [--mappen <n>] (nur einrichten).
 *
 * Gemischtes Profil wie im Alltag: Startseite, Liste einer Ansicht, Mappe öffnen, Suche, Vorschaubild,
 * Dokument herunterladen – Administrator und Mitglieder gemischt. Jede „Person“ des Tests schickt eine
 * Anfrage nach der anderen; „100 gleichzeitig“ heißt: 100 Anfragen sind ständig unterwegs. Bekommt sie 503,
 * wartet sie, wie `Retry-After` sagt (wie ein ordentliches Programm), und macht dann weiter.
 * Grenzen und ihre Begründung: Entwicklerhandbuch → Leistung → Lasttest.
 */
import { randomInt } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const arg = (n, std) => { const i = process.argv.indexOf(n); return i < 0 ? std : process.argv[i + 1]; };
const hat = (n) => process.argv.includes(n);
const BASIS = (arg('--ziel') ?? process.env.DMS_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(/\/$/, '');

/** Wie lange eine Anfrage höchstens auf ihre Antwort wartet; danach zählt sie als „ohne Antwort“. */
const ANTWORT_MAX_MS = 60_000;
/** Konten des Lasttests (Persona-Namen, reservierte Domain). Nur in einer Test-Installation. */
const BENUTZER = {
  admin: ['lena@example.org', 'lasttest-passwort-1'],
  mitRolle: ['jonas@example.org', 'lasttest-passwort-2'],
  ohneRolle: ['petra@example.org', 'lasttest-passwort-3'],
};
/** Konto nur für die Prüfung des Anmeldeschutzes. */
const SPERRKONTO = ['markus@example.org', 'lasttest-passwort-4'];
/** Name des Haushalts, den der Test anlegt. */
const HAUSHALT = 'Lasttest';
/** So viele Mappen dürfen keine Demo-Mappen sein (Beispiele, Rolle); mehr sieht nach einer echten Ablage aus. */
const ECHTE_MAPPEN_MAX = 200;
/** Demo-Mappen je Lauf (Werkbank → Demo-Daten erlaubt höchstens 50.000). */
const DEMO_JE_LAUF = 50_000;

/**
 * Stufen (#563). Startwerte des Maintainers; nachgeschärft wird nur strenger. Die Ziele von klein und mittel
 * sind deutlich strenger als die Grenzen von #544 (p95 ≤ 5 s bzw. 6 s, Fehler ≤ 1 %).
 *
 * `ziel`: was das Projekt zusagen möchte (p95 und Fehlerquote). Ein verfehltes p95-Ziel steht im Bericht und führt
 * zu einem Folge-Issue „Beschleunigen“, macht den Lauf aber nicht rot.
 * `ciGrenze`: p95, ab dem `--grenzen` mit Exit-Code 1 endet (Entscheidung Thomas, #563): erster Lauf auf den
 * Rechnern von GitHub + 20 %, danach nur strenger, höchstens bis zum Ziel. Erster Lauf (Run 41448183378,
 * DMS 0.139.0): klein p95 95 ms → bleibt beim Ziel 300 ms; mittel p95 2384 ms → 2860 ms. Nach dem Beschleunigen
 * (#615; Run 41549943703, DMS 0.146.0): mittel p95 586 ms, + 20 % = 703 ms liegt unter dem Ziel → CI-Grenze = Ziel 1000 ms
 * (Frage 53). Damit sind Ziel und CI-Grenze bei klein und mittel gleich.
 * Fehlerquote, 503 und Export gelten unverändert als Grenze.
 */
export const STUFEN = {
  klein: { bildet: 'Haushalt (2–5 Personen)', gleichzeitig: 25, mappen: 5_000, export: false, ziel: { p95Ms: 300, fehlerquote: 0 }, ciGrenze: { p95Ms: 300 } },
  mittel: { bildet: 'Kleinbetrieb (10–15 Personen)', gleichzeitig: 100, mappen: 50_000, export: true, ziel: { p95Ms: 1000, fehlerquote: 0.001 }, ciGrenze: { p95Ms: 1000 } },
  gross: { bildet: 'Belastungsgrenze', mappen: 200_000, vorstufen: [5, 10], start: 25, schritt: 25, schrittSekunden: 120, hoechstens: 2000, abbruch: { p95Ms: 3000, fehlerquote: 0.01 }, ueberlast: 1000, verschlechterung: 0.2 },
};
/** Pflichten der großen Stufe (wie „Überlast“ in #544): kein Absturz, begrenzter Speicher, Erholung, Anmeldeschutz. */
export const PFLICHT = { ohneAntwort: 0, speicherMb: 1536, erholungMs: 30_000, erholungP95Ms: 1000 };
/** Anteil der Demo-Mappen mit einem Brief als PDF (Vorschaubild, Herunterladen, Export). */
const DOKUMENTE_ANTEIL = Number(arg('--dokumente', 2));

/* ---------- HTTP ---------- */

async function anfrage(m, pfad, o = {}) {
  const r = await fetch(BASIS + pfad, {
    method: m,
    headers: { 'x-dms': '1', ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(o.koepfe ?? {}) },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    signal: AbortSignal.timeout(o.zeit ?? ANTWORT_MAX_MS),
  });
  return r;
}

async function json(m, pfad, o = {}) {
  const r = await anfrage(m, pfad, o);
  const t = await r.text();
  if (!r.ok) throw new Error(`${m} ${pfad}: ${r.status} ${t.slice(0, 300)}`);
  return { daten: t ? JSON.parse(t) : null, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}

async function anmelden([email, passwort]) {
  const { cookie } = await json('POST', '/api/konto/anmelden', { body: { email, passwort } });
  if (!cookie) throw new Error(`Anmeldung ${email}: kein Sitzungs-Cookie`);
  return cookie;
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Schritt an den Lasttest-Modus melden (#612): nur mit IPC-Kanal (Kindprozess des DMS), sonst nichts. Nie mit
 * Zugangsdaten oder Adressen – die Seite im Browser zeigt, was hier ankommt.
 */
const melde = (e) => new Promise((fertig) => {
  if (!process.send || !process.connected) return fertig();
  process.send({ ...e, zeit: Date.now() }, () => fertig());
});

/* ---------- Einrichten und Schutz der echten Ablage ---------- */

async function code() {
  if (arg('--code')) return arg('--code');
  for (const d of [process.env.DMS_GEHEIM, '/data/geheim'].filter(Boolean)) {
    try { return (await readFile(`${d}/EINRICHTUNGSCODE`, 'utf8')).trim(); } catch { /* weiter */ }
  }
  return undefined;
}

/** Demo-Mappen (Teil von höchstens 50.000) erzeugen und auf das Ende warten. */
async function demo(c, anzahl, nr) {
  const t0 = Date.now();
  await json('POST', '/api/werkbank/demo', { ...c, body: { anzahl, startwert: `lasttest-563-${nr}`, dokumente: DOKUMENTE_ANTEIL > 0 ? { anteil: DOKUMENTE_ANTEIL, von: 1, bis: 1, mischung: { brief: 100, mehrseitig: 0, scan: 0, bild: 0, gross: 0 } } : null } });
  for (;;) {
    const { daten: a } = await json('GET', '/api/werkbank/auftrag', c);
    if (a && typeof a.fertig === 'number') melde({ art: 'demo', fertig: a.fertig, gesamt: a.gesamt ?? anzahl });
    if (!a || a.status === 'fertig') break;
    if (a.status === 'fehler') throw new Error(a.fehler);
    await warte(2000);
  }
  console.log(`${anzahl} Demo-Mappen in ${Math.round((Date.now() - t0) / 1000)} s erzeugt.`);
}

/** Frisches DMS: Konten, Beispiele, Rolle, Mitglieder, Regeln wie in einem Haushalt (wie ladezeiten.mjs, #477). */
async function einrichten() {
  melde({ art: 'schritt', schritt: 'einrichten' });
  const [email, passwort] = BENUTZER.admin;
  const c0 = await code();
  const { cookie: admin } = await json('POST', '/api/konto/einrichten', { body: { mandant: HAUSHALT, email, name: 'Lena (Lasttest)', passwort }, koepfe: c0 ? { 'x-einrichtungscode': c0 } : {} });
  const c = { cookie: admin };
  await json('POST', '/api/werkbank/einrichtung/schritt', { ...c, body: { schritt: 'fertig' } }).catch(() => {});
  await json('POST', '/api/beispiele', c);
  const { daten: typen } = await json('GET', '/api/typen', c);
  const { daten: rolle } = await json('POST', '/api/mappen', { ...c, body: { typId: typen.find((t) => t.system === 'rolle').id, werte: { name: 'Steuern und Finanzen' } } });
  for (const [name, [e, p], rollen] of [['Jonas (Lasttest)', BENUTZER.mitRolle, [rolle.id]], ['Petra (Lasttest)', BENUTZER.ohneRolle, []], ['Markus (Sperrprobe)', SPERRKONTO, []]]) {
    const { daten: einladung } = await json('POST', '/api/benutzer', { ...c, body: { email: e, name, rolle: 'mitglied', rollen } });
    await json('POST', '/api/konto/passwort-setzen', { body: { schluessel: einladung.link.split('/passwort/')[1], passwort: p } });
  }
  const nichtRolle = { art: 'rolle', rollen: [rolle.id], nicht: true };
  for (const t of typen.filter((x) => !x.system)) {
    const regeln = [
      { id: 'r1', name: 'Steuern und Finanzen darf alles', wenn: [{ art: 'rolle', rollen: [rolle.id] }], dann: { D: 'erteilen', P: 'erteilen' }, stopp: false },
      { id: 'r2', name: 'Mit Aufgabe bearbeiten', wenn: [{ art: 'aufgabe' }], dann: { U: 'erteilen' }, stopp: false },
    ];
    if (t.name === 'Zahlung') regeln.push({ id: 'r3', name: 'Zahlungen nur Steuern', wenn: [nichtRolle], dann: { R: 'entziehen' }, stopp: true });
    if (t.name === 'Rechnung' || t.name === 'Vertrag') regeln.push({ id: 'r4', name: 'Große Beträge nur Steuern', wenn: [nichtRolle, { art: 'feld', bedingung: { art: 'feld', feld: 'betrag', op: 'groesser', wert: { art: 'fest', wert: 500 } } }], dann: { R: 'entziehen' }, stopp: true });
    await json('PUT', `/api/werkbank/berechtigungen/${t.id}`, { ...c, body: { berechtigungen: { grund: { C: true, R: true, U: true, D: false, P: false }, regeln }, bestaetigt: true } });
  }
  console.log('Test-Installation eingerichtet.');
  return admin;
}

const zaehle = async (c) => {
  const { daten } = await json('GET', '/api/werkbank/demo', c);
  return { demo: daten.reduce((a, t) => a + t.demo, 0), gesamt: daten.reduce((a, t) => a + t.gesamt, 0) };
};

/**
 * Schutz der echten Ablage, ohne etwas anzulegen: frisch (noch nicht eingerichtet) → `{ frisch: true }`; eingerichtet
 * vom Lasttest (eigene Konten) mit höchstens ECHTE_MAPPEN_MAX Mappen, die keine Demo-Mappen sind → Sitzung und
 * Bestand; sonst Abbruch. Dieselbe Prüfung vor jeder Messung und im Lasttest-Modus vor dem Start (#612).
 */
export async function pruefen() {
  const { daten: status } = await json('GET', '/api/konto/status');
  if (status.einrichtungNoetig) return { frisch: true };
  let admin;
  try { admin = await anmelden(BENUTZER.admin); } catch {
    throw new Abbruch('Dieses DMS ist schon eingerichtet, aber nicht vom Lasttest. Der Lasttest läuft nur gegen eine eigene, frische Test-Installation – nie gegen deine echte Ablage (Handbuch: Lasttest selbst durchführen).');
  }
  const z = await zaehle({ cookie: admin });
  if (z.gesamt - z.demo > ECHTE_MAPPEN_MAX) {
    throw new Abbruch(`Hier liegen ${z.gesamt - z.demo} Mappen, die keine Demo-Mappen sind – das sieht nach einer echten Ablage aus. Der Lasttest bricht ab und legt nichts an.`);
  }
  return { frisch: false, admin, bestand: z };
}

/**
 * Vor jeder Messung: frisch → einrichten; sonst nur mit den Konten des Tests und fast nur Demo-Mappen – sonst
 * Abbruch, ohne etwas anzulegen. Danach fehlende Demo-Mappen für die Stufe dazulegen.
 */
async function sicherstellen(mappen) {
  melde({ art: 'schritt', schritt: 'pruefen' });
  const p = await pruefen();
  const admin = p.frisch ? await einrichten() : p.admin;
  const c = { cookie: admin };
  let z = p.frisch ? await zaehle(c) : p.bestand;
  let neu = false;
  for (let nr = 1; z.demo < mappen; nr++) {
    const n = Math.min(DEMO_JE_LAUF, mappen - z.demo);
    console.log(`Lege ${n} Demo-Mappen an (für ${mappen} insgesamt) …`);
    melde({ art: 'schritt', schritt: 'demo', anzahl: n, mappen });
    const vorher = z.demo; neu = true;
    await demo(c, n, `${mappen}-${nr}`);
    z = await zaehle(c);
    if (z.demo <= vorher) throw new Error('Es sind keine Demo-Mappen dazugekommen – Werkbank → Demo-Daten prüfen.');
  }
  if (neu) await ruhe(c);
  return z;
}

/**
 * Nach neuen Demo-Mappen arbeitet das DMS im Hintergrund (Texterkennung der Briefe, Vorschaubilder, Statistik).
 * Gemessen wird erst, wenn das vorbei ist – höchstens 15 Minuten warten.
 */
async function ruhe(c) {
  melde({ art: 'schritt', schritt: 'hintergrund' });
  const t0 = Date.now();
  for (;;) {
    const { daten: u } = await json('GET', '/api/werkbank/uebersicht', c).catch(() => ({ daten: null }));
    const offen = u?.texterkennung ? (u.texterkennung.wartet ?? 0) + (u.texterkennung.laeuft ?? 0) : 0;
    const { daten: l } = await json('GET', '/api/werkbank/last', c).catch(() => ({ daten: null }));
    if (!offen && (l?.schleife?.p99 ?? 0) < 100) break;
    if (Date.now() - t0 > 15 * 60_000) { console.log('  Hintergrundarbeit läuft noch – es wird trotzdem gemessen.'); break; }
    await warte(5000);
  }
  console.log(`Hintergrundarbeit abgewartet (${Math.round((Date.now() - t0) / 1000)} s).`);
}

class Abbruch extends Error {}

/* ---------- Vorbereiten: Sitzungen, Ansichten, Mappen, Dokumente ---------- */

const zufall = (a) => a[Math.floor(Math.random() * a.length)];

async function vorbereiten() {
  melde({ art: 'schritt', schritt: 'vorbereiten' });
  const sitzungen = {};
  for (const [k, z] of Object.entries(BENUTZER)) sitzungen[k] = await anmelden(z);
  const admin = { cookie: sitzungen.admin };
  const { daten: typen } = await json('GET', '/api/typen', admin);
  const ansichten = typen.filter((t) => !t.system).map((t) => t.id);
  const mappen = [];
  for (const id of ansichten) {
    const { daten } = await json('GET', `/api/mappen?sicht=${id}&von=0&anzahl=200`, admin);
    for (const m of daten.mappen) mappen.push(m.id);
  }
  // Dokumente: alle PDFs (ab 0 MB), wie Werkbank → Systemzustand → Verkleinern sie listet.
  const { daten: gross } = await json('GET', '/api/werkbank/verkleinern?ab=0', { ...admin, zeit: 300_000 });
  const dokumente = (gross.eintraege ?? gross.dokumente ?? []).map((d) => ({ id: d.id, mappe: d.mappeId, typ: d.typId }));
  const groesste = ansichten.map((id) => ({ id, n: 0 }));
  for (const g of groesste) g.n = (await json('GET', `/api/mappen?sicht=${g.id}&von=0&anzahl=1`, admin)).daten.gesamt ?? 0;
  groesste.sort((a, b) => b.n - a.n);
  // Großer Export: PDF der ersten 1000 Mappen der größten Ansicht (je Mappe eine Seite, Übersicht als Tabelle),
  // PDF der Mappen mit Dokumenten aus der Ansicht mit den meisten (Dokumente eingebunden), ZIP der größten Ansicht.
  const exportPdf = (await json('GET', `/api/mappen?sicht=${groesste[0].id}&von=0&anzahl=1000`, admin)).daten.mappen.map((m) => m.id);
  const jeTyp = new Map();
  for (const d of dokumente) { if (!jeTyp.has(d.typ)) jeTyp.set(d.typ, new Set()); jeTyp.get(d.typ).add(d.mappe); }
  const [dokSicht, dokMappen] = [...jeTyp.entries()].sort((a, b) => b[1].size - a[1].size)[0] ?? [null, new Set()];
  return { sitzungen, ansichten, mappen, dokumente, exportSicht: groesste[0], exportPdf, dokSicht, dokMappen: [...dokMappen] };
}

/* ---------- Profil ---------- */

const WOERTER = ['Rechnung', 'Vertrag', 'Versicherung', 'Strom', 'Auto', 'Miete', 'Steuer', 'Garantie', 'Wasser', 'Handy'];

/** Gewichte des gemischten Profils (Anteil der Anfragen). */
export const PROFIL = [
  ['Startseite', 15], ['Liste', 25], ['Mappe öffnen', 25], ['Suche', 15], ['Vorschaubild', 10], ['Herunterladen', 10],
];

function naechsteAnfrage(v) {
  // Administrator und Mitglieder gemischt: ein Drittel Administrator.
  const wer = zufall(['admin', 'mitRolle', 'ohneRolle']);
  const cookie = v.sitzungen[wer];
  let x = Math.random() * 100;
  let art = PROFIL[0][0];
  for (const [a, g] of PROFIL) { if ((x -= g) < 0) { art = a; break; } }
  const doc = v.dokumente.length ? zufall(v.dokumente) : null;
  switch (art) {
    case 'Startseite': return { art, cookie, pfad: zufall(['/api/startseite', '/api/sichten', '/api/termine/naechster', '/api/typen']) };
    case 'Liste': return { art, cookie, pfad: `/api/mappen?sicht=${zufall(v.ansichten)}&von=${50 * Math.floor(Math.random() * 10)}&anzahl=50` };
    case 'Mappe öffnen': return { art, cookie, pfad: `/api/mappen/${zufall(v.mappen)}` };
    case 'Suche': return { art, cookie, pfad: `/api/mappen?sicht=${zufall(v.ansichten)}&suche=${encodeURIComponent(zufall(WOERTER))}&von=0&anzahl=50` };
    // Dokumente: als Administrator (Mitglieder sehen manche Mappen nicht – das wäre ein 404, kein Fehler des Servers).
    case 'Vorschaubild': return doc ? { art, cookie: v.sitzungen.admin, pfad: `/api/dokumente/${doc.id}/vorschau` } : { art: 'Liste', cookie, pfad: `/api/mappen?sicht=${zufall(v.ansichten)}&von=0&anzahl=50` };
    default: return doc ? { art, cookie: v.sitzungen.admin, pfad: `/api/dokumente/${doc.id}/inhalt` } : { art: 'Mappe öffnen', cookie, pfad: `/api/mappen/${zufall(v.mappen)}` };
  }
}

/* ---------- Messung ---------- */

const quantil = (a, q) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const rund = (x) => (x === null || x === undefined ? null : Math.round(x));

/** Werte des Servers (Werkbank → Systemzustand, Datenbank-Anbindung): Ereignisschleife, Speicher, Warten auf Verbindungen. */
async function serverStand(cookie) {
  const t0 = performance.now();
  try {
    const { daten: s } = await json('GET', '/api/werkbank/last', { cookie, zeit: 10_000 });
    return { ...s, antwortMs: performance.now() - t0 };
  } catch {
    // Ältere Fassungen (vor #544): Systemzustand.
    try {
      const { daten: s } = await json('GET', '/api/werkbank/systemlast', { cookie, zeit: 10_000 });
      const w = s.schleife?.aktuell ?? s.schleife?.vorher;
      return { schleife: w ? { p99: w.p99, max: w.max } : null, speicherMb: s.anteile?.dms ? s.anteile.dms / 1024 ** 2 : null, antwortMs: performance.now() - t0 };
    } catch (e) { return { fehler: e.message, antwortMs: performance.now() - t0 }; }
  }
}

/**
 * Ein Durchgang: `n` Personen schicken `dauer` Sekunden lang Anfragen; optional läuft nebenher ein großer
 * Export nach dem anderen (als Administrator).
 */
async function durchgang(v, { name, n, dauer, mitExport }) {
  const ende = Date.now() + dauer * 1000;
  const zeiten = []; const jeArt = {};
  const z = { anfragen: 0, ok: 0, abgewiesen: 0, client: 0, fehler: 0, ohneAntwort: 0, retryAfter: 0, status: {} };
  const server = [];
  const exporte = [];
  let laeuft = true;

  async function person() {
    while (Date.now() < ende) {
      const a = naechsteAnfrage(v);
      const t0 = performance.now();
      try {
        const r = await anfrage('GET', a.pfad, { cookie: a.cookie });
        await r.arrayBuffer();
        const ms = performance.now() - t0;
        z.anfragen++; z.status[r.status] = (z.status[r.status] ?? 0) + 1;
        if (r.status === 503) {
          // Wie ein ordentliches Programm: so lange warten, wie Retry-After sagt (höchstens 10 s).
          z.abgewiesen++;
          const w = Number(r.headers.get('retry-after'));
          if (w) { z.retryAfter++; await warte(Math.min(10, w) * 1000 * (0.5 + Math.random())); }
          continue;
        }
        zeiten.push(ms); (jeArt[a.art] ??= []).push(ms);
        if (r.status >= 500) z.fehler++; else if (r.status >= 400) z.client++; else z.ok++;
      } catch (e) {
        z.anfragen++;
        if (e.name === 'TimeoutError' || e.name === 'AbortError') { z.ohneAntwort++; (z.ohneAntwortJe ??= {})[a.art] = (z.ohneAntwortJe[a.art] ?? 0) + 1; } else { z.fehler++; const g = String(e.cause?.code ?? e.name); (z.fehlerJe ??= {})[g] = (z.fehlerJe[g] ?? 0) + 1; }
        // Verbindung abgelehnt (Server weg?): kurz warten, sonst dreht die Schleife leer.
        await warte(100);
      }
    }
  }

  async function messen() {
    while (laeuft) {
      server.push({ t: Date.now(), ...(await serverStand(v.sitzungen.admin)) });
      await warte(2000);
    }
  }

  async function exportieren() {
    const admin = v.sitzungen.admin;
    const arten = [
      { art: 'pdf', body: { format: 'pdf', sicht: v.exportSicht.id, ids: v.exportPdf, uebersicht: true }, mappen: v.exportPdf.length },
      ...(v.dokSicht ? [{ art: 'pdf+dok', body: { format: 'pdf', sicht: v.dokSicht, ids: v.dokMappen, uebersicht: true }, mappen: v.dokMappen.length }] : []),
      { art: 'zip', body: { format: 'zip', sicht: v.exportSicht.id }, mappen: v.exportSicht.n },
    ];
    let i = 0;
    while (Date.now() < ende) {
      const a = arten[i++ % arten.length];
      const t0 = performance.now();
      try {
        const r = await anfrage('POST', '/api/export', { cookie: admin, body: a.body, zeit: 600_000 });
        const b = await r.arrayBuffer();
        exporte.push({ art: a.art, status: r.status, ms: performance.now() - t0, mb: b.byteLength / 1024 ** 2, mappen: a.mappen });
      } catch (e) { exporte.push({ art: a.art, status: e.name, ms: performance.now() - t0, mb: 0, mappen: a.mappen }); }
    }
  }

  const start = Date.now();
  const mess = messen();
  const ex = mitExport ? exportieren() : Promise.resolve();
  await Promise.all(Array.from({ length: n }, person));
  await ex;
  laeuft = false;
  await mess;
  const sek = (Date.now() - start) / 1000;
  const sv = server.filter((s) => !s.fehler);
  const max = (k) => { const w = sv.map(k).filter((x) => typeof x === 'number'); return w.length ? Math.max(...w) : null; };
  const ergebnis = {
    name, n, dauer: Math.round(sek), mitExport,
    anfragen: z.anfragen, jeSekunde: Math.round(z.anfragen / sek), ok: z.ok, client: z.client, fehler: z.fehler, abgewiesen: z.abgewiesen, retryAfter: z.retryAfter, ohneAntwort: z.ohneAntwort, status: z.status,
    ohneAntwortJe: z.ohneAntwortJe ?? {}, fehlerJe: z.fehlerJe ?? {},
    fehlerquote: z.anfragen ? (z.fehler + z.ohneAntwort) / z.anfragen : 0,
    median: rund(quantil(zeiten, 0.5)), p95: rund(quantil(zeiten, 0.95)), p99: rund(quantil(zeiten, 0.99)), max: rund(zeiten.length ? Math.max(...zeiten) : null),
    jeArt: Object.fromEntries(Object.entries(jeArt).map(([k, w]) => [k, { anzahl: w.length, median: rund(quantil(w, 0.5)), p95: rund(quantil(w, 0.95)) }])),
    schleifeP99: max((s) => s.schleife?.p99), schleifeMax: max((s) => s.schleife?.max),
    dbWartenP95: rund(quantil(sv.map((s) => s.datenbank?.wartenJetzt).filter((x) => typeof x === 'number'), 0.95)), dbWartenMax: rund(max((s) => s.datenbank?.wartenJetzt)),
    dbVerbindungen: sv.find((s) => s.datenbank)?.datenbank?.verbindungen ?? null, ueberlastGrenze: sv.find((s) => s.anfragen)?.anfragen?.max ?? null,
    speicherMbStart: rund(sv[0]?.speicherMb), speicherMbMax: rund(max((s) => s.speicherMb)), speicherMbEnde: rund(sv.at(-1)?.speicherMb),
    // Ganzer Container (#696) beim höchsten Stand dieses Durchgangs, mit Aufteilung; null, wenn nicht lesbar.
    container: (() => { const m = sv.filter((s) => typeof s.container?.mb === 'number').sort((a, b) => b.container.mb - a.container.mb)[0]?.container; return m ? { mb: m.mb, programmeMb: m.programmeMb, zwischenspeicherMb: m.zwischenspeicherMb, datenbankMb: m.datenbankMb } : null; })(),
    serverAusfaelle: server.length - sv.length,
    exporte: exporte.map((e) => ({ ...e, ms: Math.round(e.ms), mb: Math.round(e.mb * 10) / 10 })),
  };
  return ergebnis;
}

/** Nach der Überlast: wie schnell antwortet das DMS wieder normal? */
async function erholung(v) {
  const t0 = Date.now();
  for (;;) {
    const zeiten = [];
    let fehler = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      for (let i = 0; i < 4; i++) {
        const a = naechsteAnfrage(v);
        const s = performance.now();
        try { const r = await anfrage('GET', a.pfad, { cookie: a.cookie, zeit: 10_000 }); await r.arrayBuffer(); if (r.status >= 500) fehler++; zeiten.push(performance.now() - s); } catch { fehler++; }
      }
    }));
    const p95 = quantil(zeiten, 0.95);
    if (!fehler && p95 !== null && p95 <= PFLICHT.erholungP95Ms) return { ms: Date.now() - t0, p95: Math.round(p95) };
    if (Date.now() - t0 > 120_000) return { ms: null, p95: p95 === null ? null : Math.round(p95), fehler };
    await warte(1000);
  }
}

/**
 * Anmeldeschutz unter Last (#240): falsche Passwörter für ein eigenes Konto, von einer eigenen (vorgetäuschten)
 * Adresse über X-Forwarded-For – so sperrt der Test nicht die eigene. Erwartet: nach der Grenze ist auch das
 * richtige Passwort gesperrt.
 */
async function anmeldeschutz() {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 251)}`;
  const koepfe = { 'x-forwarded-for': ip };
  // Abgewiesen (503) zählt nicht als Versuch: wiederholen, bis das DMS das Passwort wirklich geprüft hat.
  const versuch = async (passwort) => {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await anfrage('POST', '/api/konto/anmelden', { body: { email: SPERRKONTO[0], passwort }, koepfe, zeit: 30_000 });
        await r.text();
        if (r.status !== 503) return r.status;
        await warte(Math.min(5000, 1000 * Number(r.headers.get('retry-after') ?? 1)));
      } catch (e) { if (i === 59) return e.name; await warte(1000); }
    }
    return 503;
  };
  const status = [];
  for (let i = 0; i < 6; i++) status.push(await versuch(`falsch-${i}`));
  const richtig = await versuch(SPERRKONTO[1]);
  return { falsch: status, richtig, wirkt: richtig === 429 && !status.includes(200) };
}

/* ---------- Stufen ---------- */

const f = (x) => (x === null || x === undefined ? '–' : String(x));
const sek = (ms) => (ms / 1000).toFixed(1).replace('.', ',');
const prozent = (q) => `${(q * 100).toFixed(2).replace('.', ',')} %`;

/**
 * klein oder mittel: ein Durchgang mit fester Last. `verfehlt` (CI-Grenze, Fehler, 503, Export) bestimmt den
 * Exit-Code, `zielVerfehlt` (p95 über dem Ziel, aber unter der CI-Grenze) steht nur im Bericht.
 */
export function pruefeFesteStufe(name, e) {
  const s = STUFEN[name];
  const verfehlt = [];
  const zielVerfehlt = [];
  if (e.p95 !== null && e.p95 >= s.ciGrenze.p95Ms) verfehlt.push(`${name}: p95 ${e.p95} ms ≥ CI-Grenze ${s.ciGrenze.p95Ms} ms (Ziel < ${s.ziel.p95Ms} ms)`);
  else if (e.p95 !== null && e.p95 >= s.ziel.p95Ms) zielVerfehlt.push(`${name}: p95 ${e.p95} ms ≥ Ziel ${s.ziel.p95Ms} ms (CI-Grenze ${s.ciGrenze.p95Ms} ms eingehalten)`);
  if (s.ziel.fehlerquote === 0 ? e.fehler + e.ohneAntwort > 0 : e.fehlerquote >= s.ziel.fehlerquote) {
    verfehlt.push(`${name}: Fehlerquote ${prozent(e.fehlerquote)} (${e.fehler} Fehler, ${e.ohneAntwort} ohne Antwort) – erlaubt ${s.ziel.fehlerquote === 0 ? 'keine' : `< ${prozent(s.ziel.fehlerquote)}`}`);
  }
  if (e.abgewiesen) verfehlt.push(`${name}: ${e.abgewiesen} Anfragen abgewiesen (503) – bei ${s.gleichzeitig} gleichzeitig darf der Überlastschutz nicht greifen`);
  if (e.exporte.some((x) => x.status !== 200)) verfehlt.push(`${name}: Export fehlgeschlagen (${e.exporte.filter((x) => x.status !== 200).map((x) => x.status).join(', ')})`);
  return { stufe: name, art: 'zusage', durchgang: e, verfehlt, zielVerfehlt };
}

async function festeStufe(v, name, dauer, lauf) {
  const s = STUFEN[name];
  return pruefeFesteStufe(name, await lauf({ name, n: s.gleichzeitig, dauer, mitExport: s.export && !hat('--ohne-export') }));
}

/** Ziel und CI-Grenze in einem Satz, z. B. „Ziel p95 < 1000 ms, CI-Grenze 1000 ms, Fehler < 0,10 %“. */
export function zielText(name) {
  const s = STUFEN[name];
  return `Ziel p95 < ${s.ziel.p95Ms} ms, CI-Grenze ${s.ciGrenze.p95Ms} ms, ${s.ziel.fehlerquote === 0 ? 'keine Fehler' : `Fehler < ${prozent(s.ziel.fehlerquote)}`}`;
}

/** Kurzurteil einer festen Stufe. */
const urteil = (e) => (e.verfehlt.length ? 'CI-Grenze verfehlt' : e.zielVerfehlt.length ? 'Ziel verfehlt, CI-Grenze eingehalten' : 'Ziel eingehalten');

/**
 * groß: Last stufenweise steigern, bis p95 > 3 s, Fehler > 1 % oder der Überlastschutz greift. Die Grenze ist die
 * höchste Zahl gleichzeitiger Anfragen, bei der das noch nicht passiert ist. Danach 1000 gleichzeitig (wie
 * „Überlast“ in #544) mit Anmeldeschutz nebenher, dann Erholung.
 */
async function grosseStufe(v, lauf, dauer) {
  const s = STUFEN.gross;
  const schrittDauer = Number(arg('--schritt-dauer', s.schrittSekunden));
  const bis = Number(arg('--bis', s.hoechstens));
  const start = Number(arg('--start', s.start));
  const schritt = Number(arg('--schritt', s.schritt));
  // Vorgabe 5, 10, dann ab 25 in 25er-Schritten – damit auch eine Grenze unter 25 eine echte Zahl ist (#563).
  // Mit --start beginnt die Steigerung genau dort.
  const stufenfolge = [...(hat('--start') ? [] : s.vorstufen.filter((n) => n < start && n <= bis))];
  for (let n = start; n <= bis; n += schritt) stufenfolge.push(n);
  const schritte = [];
  let grenze = null; let grund = null;
  for (const n of stufenfolge) {
    const e = await lauf({ name: `groß ${n}`, n, dauer: schrittDauer, mitExport: false });
    schritte.push(e);
    grund = e.serverAusfaelle > 2 ? 'Server nicht erreichbar'
      : e.abgewiesen > 0 ? 'Überlastschutz greift (503)'
        : e.fehlerquote > s.abbruch.fehlerquote ? `Fehlerquote ${prozent(e.fehlerquote)} > 1 %`
          : e.p95 !== null && e.p95 > s.abbruch.p95Ms ? `p95 ${e.p95} ms > 3 s` : null;
    if (grund) break;
    grenze = e;
  }
  if (!grund) grund = `höchste geprüfte Last (${bis} gleichzeitig) ohne Abbruch`;
  const schutz = anmeldeschutz();
  const ueberlast = await lauf({ name: `Überlast ${s.ueberlast}`, n: s.ueberlast, dauer: Math.min(dauer, 60), mitExport: false });
  const anmelde = await schutz;
  const erholt = await erholung(v);
  const verfehlt = [];
  for (const e of [...schritte, ueberlast]) {
    if (e.ohneAntwort > PFLICHT.ohneAntwort) verfehlt.push(`${e.name}: ${e.ohneAntwort} Anfragen ohne Antwort nach ${ANTWORT_MAX_MS / 1000} s`);
    if (e.speicherMbMax !== null && e.speicherMbMax > PFLICHT.speicherMb) verfehlt.push(`${e.name}: Arbeitsspeicher ${e.speicherMbMax} MB > ${PFLICHT.speicherMb} MB`);
  }
  if (ueberlast.serverAusfaelle > 2) verfehlt.push(`${ueberlast.name}: Server ${ueberlast.serverAusfaelle}-mal nicht erreichbar`);
  if (erholt.ms === null || erholt.ms > PFLICHT.erholungMs) verfehlt.push(`Erholung nach der Überlast: ${erholt.ms === null ? 'keine' : `${erholt.ms} ms`} > ${PFLICHT.erholungMs} ms`);
  if (!anmelde.wirkt) verfehlt.push('Anmeldeschutz wirkt unter Last nicht');
  return {
    stufe: 'gross', art: 'messung', schritte, ueberlast, erholung: erholt, anmeldeschutz: anmelde, verfehlt,
    // Schon der erste Schritt zu viel: Grenze 0 heißt „unter dem ersten Schritt“.
    grenze: grenze ? { gleichzeitig: grenze.n, jeSekunde: grenze.jeSekunde, p95: grenze.p95 } : { gleichzeitig: 0, jeSekunde: 0, p95: null, unter: stufenfolge[0] ?? start },
    grund,
  };
}

/** Grenze gegenüber dem letzten Lauf: mehr als 20 % schlechter → Warnung (kein Abbruch). */
async function vergleiche(gross) {
  const datei = arg('--vorher');
  if (!datei || !gross) return null;
  let alt;
  try { alt = JSON.parse(await readFile(datei, 'utf8')); } catch { return null; }
  const vorher = alt?.stufen?.find?.((s) => s.stufe === 'gross')?.grenze?.gleichzeitig;
  if (!vorher) return null;
  const jetzt = gross.grenze.gleichzeitig;
  const schlechter = (vorher - jetzt) / vorher;
  return { vorher, jetzt, schlechter, warnung: schlechter > STUFEN.gross.verschlechterung };
}

/* ---------- Bericht und Ergebnisblock ---------- */

function bericht(ergebnisse, x) {
  const z = [];
  z.push(`## Lasttest (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '');
  // Ohne Adresse des Ziels: Der Bericht soll sich ohne Netzadressen weitergeben lassen (#563).
  z.push(`Bestand: ${x.bestand.gesamt} Mappen (${x.bestand.demo} Demo-Mappen), in den Listen ${x.mappen}, Dokumente ${x.dokumente}.${x.exportPdf ? ` Export nebenher (mittel), einer nach dem anderen: PDF von ${x.exportPdf} Mappen mit Übersicht, PDF von ${x.exportDok} Mappen mit ihren Dokumenten, ZIP der größten Ansicht (${x.exportZip} Mappen).` : ''}`, '');
  z.push('| Durchgang | Gleichzeitig | Anfragen | je s | Median ms | p95 ms | p99 ms | Fehlerquote | abgewiesen (503) | ohne Antwort | Schleife p99/max ms | DB warten p95/max ms | Speicher MB Start/max/Ende |');
  z.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
  for (const l of x.laeufe) {
    z.push(`| ${l.name} | ${l.n} | ${l.anfragen} | ${l.jeSekunde} | ${f(l.median)} | ${f(l.p95)} | ${f(l.p99)} | ${prozent(l.fehlerquote)} | ${l.abgewiesen}${l.abgewiesen ? ` (${l.retryAfter} mit Retry-After)` : ''} | ${l.ohneAntwort} | ${f(rund(l.schleifeP99))} / ${f(rund(l.schleifeMax))} | ${f(rund(l.dbWartenP95))} / ${f(rund(l.dbWartenMax))} | ${f(l.speicherMbStart)} / ${f(l.speicherMbMax)} / ${f(l.speicherMbEnde)} |`);
  }
  for (const l of x.laeufe.filter((y) => y.exporte.length)) {
    z.push('', `Exporte im Durchgang „${l.name}“: ${l.exporte.map((e) => `${e.art.toUpperCase()} ${e.status} ${(e.ms / 1000).toFixed(1)} s ${e.mb} MB`).join(' · ')}`);
  }
  for (const e of ergebnisse) {
    if (e.art === 'zusage') {
      const s = STUFEN[e.stufe];
      z.push('', `**${e.stufe}** (${s.bildet}, ${s.gleichzeitig} gleichzeitig${s.export ? ', Export nebenher' : ''}): ${zielText(e.stufe)} – p95 ${f(e.durchgang.p95)} ms: ${e.verfehlt.length ? 'CI-Grenze VERFEHLT' : urteil(e)}.`);
      z.push('', `Median und p95 je Art (${e.stufe}):`, '', ...Object.entries(e.durchgang.jeArt).map(([k, w]) => `- ${k}: ${w.anzahl} Anfragen, Median ${w.median} ms, p95 ${w.p95} ms`));
    } else {
      z.push('', e.grenze.unter
        ? `**groß** (Belastungsgrenze): schon **${e.grenze.unter} gleichzeitige Anfragen** sind zu viel: ${e.grund}.`
        : `**groß** (Belastungsgrenze): Grenze bei **${e.grenze.gleichzeitig} gleichzeitigen Anfragen** (${e.grenze.jeSekunde} Anfragen je Sekunde, p95 ${f(e.grenze.p95)} ms); danach: ${e.grund}.`);
      z.push(`Schritte: ${e.schritte.map((d) => `${d.n} → p95 ${f(d.p95)} ms`).join(' · ')}.`);
      if (x.vergleich) z.push(`Letzter Lauf: ${x.vergleich.vorher} gleichzeitig – ${x.vergleich.warnung ? `**WARNUNG: ${Math.round(x.vergleich.schlechter * 100)} % schlechter**` : `Abweichung ${Math.round(-x.vergleich.schlechter * 100)} %`}.`);
      z.push(`Erholung nach ${STUFEN.gross.ueberlast} gleichzeitig: ${e.erholung.ms === null ? 'nicht innerhalb von 120 s' : `nach ${sek(e.erholung.ms)} s`} (p95 ${f(e.erholung.p95)} ms).`);
      z.push(`Anmeldeschutz unter Last: falsche Passwörter → ${e.anmeldeschutz.falsch.join(', ')}; danach richtiges Passwort → ${e.anmeldeschutz.richtig} – ${e.anmeldeschutz.wirkt ? 'wirkt' : 'WIRKT NICHT'}.`);
    }
  }
  const verfehlt = ergebnisse.flatMap((e) => e.verfehlt);
  const ziel = ergebnisse.flatMap((e) => e.zielVerfehlt ?? []);
  if (verfehlt.length) z.push('', '**CI-Grenze oder Pflicht verfehlt:**', '', ...verfehlt.map((v) => `- ${v}`));
  else if (x.geprueft) z.push('', 'Alle CI-Grenzen und Pflichten eingehalten.');
  if (ziel.length) z.push('', '**Ziel verfehlt** (der Lauf wird deshalb nicht rot; Folge-Issue „Beschleunigen“, #563):', '', ...ziel.map((v) => `- ${v}`));
  return z.join('\n');
}

/** Was der Server über sich sagt (ohne Adressen und Namen). */
async function umgebung(cookie) {
  const s = await json('GET', '/api/werkbank/system', { cookie }).then((r) => r.daten, () => null);
  const l = await json('GET', '/api/werkbank/systemlast', { cookie }).then((r) => r.daten, () => null);
  // Das CPU-Modell kennt nur der Rechner, auf dem der Test läuft – also nur, wenn er im selben Container bzw. auf
  // demselben Gerät läuft (Ziel 127.0.0.1/localhost).
  const lokal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(BASIS);
  return {
    version: s?.dms?.version ?? null,
    image: s?.dms?.variante === 'komplett' ? 'dms-komplett' : s?.laufzeit?.container ? 'dms' : 'ohne Container',
    datenbank: l ? (l.datenbankImContainer ? 'im Container' : 'getrennt') : null,
    architektur: s?.laufzeit?.architektur ?? null,
    cpu: lokal ? cpus()[0]?.model?.replace(/\s+/g, ' ').trim() ?? null : null,
    kerne: l?.kerne ?? null, kerneBegrenzt: l?.kerneBegrenzt ?? null, rechnerKerne: l?.hostKerne ?? null,
    ramGb: l?.speicher?.grenze ? Math.round((l.speicher.grenze / 1024 ** 3) * 10) / 10 : null, ramBegrenzt: l ? !l.speicher.ohneGrenze : null,
    grenzen: l?.grenzen ? Object.fromEntries(Object.entries(l.grenzen).map(([k, g]) => [g.variable, `${g.wert}${g.quelle === 'umgebung' ? ' (gesetzt)' : ''}`])) : null,
  };
}

/**
 * Platzhalter für Gerät und Speicher im Ergebnisblock des Lasttest-Modus (#612): Die Seite im Browser setzt dort ein,
 * was man ins Feld „Beschreibe dein Gerät“ tippt bzw. welche Speicherart erkannt oder gewählt ist.
 */
export const PLATZHALTER = { geraet: '{{geraet}}', speicher: '{{speicher}}' };

/**
 * Ergebnis zum Kopieren (#563): ohne personenbezogene Daten, ohne Adressen, Rechner- oder Haushaltsnamen. Gerät
 * und Speicher trägt man mit --geraet und --speicher ein (oder im Formular „Messergebnis Lasttest“); im
 * Lasttest-Modus stehen dort die PLATZHALTER.
 */
export function ergebnisblock(ergebnisse, x, u, angaben = { geraet: arg('--geraet'), speicher: arg('--speicher') }) {
  const kz = ['```text', 'Messergebnis Lasttest (#563)'];
  const nv = 'bitte ergänzen';
  kz.push(`Ablago-Version: ${f(u.version)} · Image: ${u.image} · Datenbank: ${f(u.datenbank)}`);
  kz.push(`Gerät/Modell: ${angaben.geraet ?? nv}`);
  kz.push(`CPU: ${u.cpu ?? nv} · ${f(u.kerne)} Kerne für Ablago${u.kerneBegrenzt ? ' (Grenze des Containers)' : ''}, Rechner ${f(u.rechnerKerne)} · ${f(u.architektur)}`);
  kz.push(`RAM: ${u.ramGb === null ? nv : `${String(u.ramGb).replace('.', ',')} GB${u.ramBegrenzt ? ' (Grenze des Containers)' : ''}`} · Speicher: ${angaben.speicher ?? `${nv} (HDD/SSD/NVMe)`}`);
  kz.push(`Bestand: ${x.bestand.gesamt} Mappen, ${x.dokumente} Dokumente (PDF)`);
  if (u.grenzen) kz.push(`Einstellungen: ${Object.entries(u.grenzen).map(([k, w]) => `${k}=${w}`).join(', ')}`);
  for (const e of ergebnisse) {
    if (e.art === 'zusage') {
      const d = e.durchgang;
      kz.push(`${e.stufe.padEnd(6)} ${String(d.n).padStart(4)} gleichzeitig: p50 ${f(d.median)} ms, p95 ${f(d.p95)} ms, p99 ${f(d.p99)} ms, Fehler ${prozent(d.fehlerquote)} – ${urteil(e)} (Ziel < ${STUFEN[e.stufe].ziel.p95Ms} ms, CI-Grenze ${STUFEN[e.stufe].ciGrenze.p95Ms} ms)`);
    } else {
      kz.push(`groß   Grenze: ${e.grenze.unter ? `unter ${e.grenze.unter}` : e.grenze.gleichzeitig} gleichzeitig (${e.grenze.jeSekunde}/s, p95 ${f(e.grenze.p95)} ms), Abbruch: ${e.grund}; Erholung ${e.erholung.ms === null ? 'keine' : `${sek(e.erholung.ms)} s`}`);
    }
  }
  const alle = x.laeufe;
  const spitze = Math.max(0, ...alle.map((l) => l.speicherMbMax ?? 0));
  const schleife = Math.max(0, ...alle.map((l) => l.schleifeP99 ?? 0));
  kz.push(`Arbeitsspeicher Ablago höchstens: ${spitze} MB · Ereignisschleife p99 höchstens: ${Math.round(schleife)} ms`);
  kz.push(containerZeile(alle));
  kz.push(`Gemessen: ${new Date().toISOString().slice(0, 10)}`, '```');
  return kz.join('\n');
}

/**
 * „Arbeitsspeicher Container höchstens: 1950 MB (davon Programme 1700 MB, Dateizwischenspeicher 250 MB; PostgreSQL
 * 600 MB)“ (#696) – der Wert, den die NAS für den Container anzeigt. Ohne lesbare cgroup: „nicht verfügbar“.
 */
export function containerZeile(laeufe) {
  const c = laeufe.map((l) => l.container).filter((x) => x && typeof x.mb === 'number').sort((a, b) => b.mb - a.mb)[0];
  if (!c) return 'Arbeitsspeicher Container höchstens: nicht verfügbar';
  const teile = [c.programmeMb != null ? `Programme ${c.programmeMb} MB` : null, c.zwischenspeicherMb != null ? `Dateizwischenspeicher ${c.zwischenspeicherMb} MB` : null].filter(Boolean);
  const db = c.datenbankMb != null ? `PostgreSQL ${c.datenbankMb} MB` : null;
  const klammer = [teile.length ? `davon ${teile.join(', ')}` : null, db].filter(Boolean).join('; ');
  return `Arbeitsspeicher Container höchstens: ${c.mb} MB${klammer ? ` (${klammer})` : ''}`;
}

/* ---------- Ablauf ---------- */

async function messen(stufen) {
  const dauer = Number(arg('--dauer', 120));
  const laeufe = [];
  const lauf = async (o) => {
    console.log(`Durchgang „${o.name}“: ${o.n} gleichzeitig, ${o.dauer} s …`);
    melde({ art: 'durchgang', name: o.name, n: o.n, dauer: o.dauer });
    const e = await durchgang(v, o);
    console.log(`  p95 ${e.p95} ms, Fehlerquote ${prozent(e.fehlerquote)}, abgewiesen ${e.abgewiesen}, ohne Antwort ${e.ohneAntwort}`);
    melde({ art: 'durchgang-fertig', name: o.name, n: o.n, p95: e.p95, fehlerquote: e.fehlerquote });
    laeufe.push(e); await warte(5000); return e;
  };
  const ergebnisse = [];
  let v = null; let bestand = null; let x = null;
  for (const s of stufen) {
    melde({ art: 'stufe', stufe: s, nr: stufen.indexOf(s) + 1, von: stufen.length });
    bestand = await sicherstellen(STUFEN[s].mappen);
    v = await vorbereiten();
    console.log(`Stufe ${s}: ${bestand.gesamt} Mappen; vorbereitet: ${v.mappen.length} Mappen, ${v.dokumente.length} Dokumente, ${v.ansichten.length} Ansichten.`);
    x = { ...(x ?? {}), mappen: v.mappen.length, dokumente: v.dokumente.length, ...(STUFEN[s].export ? { exportPdf: v.exportPdf.length, exportDok: v.dokMappen.length, exportZip: v.exportSicht.n } : {}) };
    ergebnisse.push(s === 'gross' ? await grosseStufe(v, lauf, dauer) : await festeStufe(v, s, dauer, lauf));
  }
  x = { ...x, bestand, laeufe, geprueft: hat('--grenzen') };
  x.vergleich = await vergleiche(ergebnisse.find((e) => e.stufe === 'gross'));
  const u = await umgebung(v.sitzungen.admin);
  const text = `${bericht(ergebnisse, x)}\n\n### Ergebnis zum Kopieren\n\nOhne Namen und Adressen – zum Einfügen in das Formular „Messergebnis Lasttest“.\n\n${ergebnisblock(ergebnisse, x, u)}`;
  console.log(`\n${text}`);
  await melde({ art: 'ergebnis', bericht: bericht(ergebnisse, x), vorlage: ergebnisblock(ergebnisse, x, u, PLATZHALTER), verfehlt: ergebnisse.some((e) => e.verfehlt.length) });
  if (x.vergleich?.warnung) {
    const w = `Belastungsgrenze ${Math.round(x.vergleich.schlechter * 100)} % schlechter als beim letzten Lauf (${x.vergleich.vorher} → ${x.vergleich.jetzt} gleichzeitig).`;
    console.log(process.env.GITHUB_ACTIONS ? `::warning title=Lasttest groß::${w}` : `WARNUNG: ${w}`);
  }
  for (const z of ergebnisse.flatMap((e) => e.zielVerfehlt ?? [])) console.log(process.env.GITHUB_ACTIONS ? `::notice title=Lasttest Ziel verfehlt::${z}` : `HINWEIS: Ziel verfehlt – ${z}`);
  if (arg('--bericht')) await writeFile(arg('--bericht'), `${text}\n`);
  if (arg('--json')) await writeFile(arg('--json'), JSON.stringify({ stufen: ergebnisse.map(({ durchgang: _d, schritte: _s, ueberlast: _u, ...r }) => r), laeufe, umgebung: u, bestand, vergleich: x.vergleich }, null, 2));
  if (x.geprueft && ergebnisse.some((e) => e.verfehlt.length)) process.exitCode = 1;
}

/** Ein einzelner Durchgang mit n gleichzeitig (Entwicklung, z. B. vorher/nachher). */
async function einzeln(n) {
  const bestand = await sicherstellen(Number(arg('--mappen', STUFEN.mittel.mappen)));
  const v = await vorbereiten();
  const e = await durchgang(v, { name: `${n} gleichzeitig`, n, dauer: Number(arg('--dauer', 120)), mitExport: !hat('--ohne-export') });
  console.log(JSON.stringify({ bestand, ...e, exporte: e.exporte.length }, null, 2));
}

const ALT = { normal: 'mittel', ueberlast: 'gross' };
// Nur als Programm starten, nicht beim Import (Test der Grenzen: lasttest-grenzen.test.ts).
const direkt = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (direkt) {
  const wahl = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : arg('--stufe', hat('--einrichten') ? 'einrichten' : 'alle');
  try {
    if (hat('--pruefen')) {
      const p = await pruefen();
      console.log(p.frisch ? 'Frische Installation – der Lasttest richtet sie selbst ein.' : `Test-Installation des Lasttests (${p.bestand.demo} Demo-Mappen).`);
    } else if (wahl === 'einrichten' || hat('--einrichten')) console.log(await sicherstellen(Number(arg('--mappen', STUFEN.mittel.mappen))));
    else if (arg('--gleichzeitig')) await einzeln(Number(arg('--gleichzeitig')));
    else {
      const stufe = ALT[wahl] ?? wahl;
      const stufen = stufe === 'alle' ? ['klein', 'mittel', 'gross'] : [stufe];
      if (!stufen.every((s) => s in STUFEN)) throw new Abbruch(`Unbekannte Stufe „${wahl}“. Möglich: klein, mittel, gross, alle.`);
      await messen(stufen);
    }
  } catch (e) {
    if (!(e instanceof Abbruch)) { await melde({ art: 'fehler', text: e instanceof Error ? e.message : String(e) }); throw e; }
    await melde({ art: 'abbruch', text: e.message });
    console.error(`Abbruch: ${e.message}`);
    process.exitCode = 2;
  }
}
