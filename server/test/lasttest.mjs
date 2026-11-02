/**
 * Lasttest (#544): viele gleichzeitige HTTP-Anfragen gegen ein laufendes DMS. Kein Test für jeden PR –
 * von Hand oder im Workflow „Lasttest“ (wöchentlich und vor größeren Releases). Ohne Abhängigkeiten:
 * nur `fetch` von Node.js.
 *
 *   # einmal: frisches DMS einrichten (Administrator, Beispiele, Demo-Mappen mit einigen Dokumenten,
 *   # zwei Mitglieder mit und ohne Rolle, Regeln wie in einem Haushalt)
 *   DMS_URL=http://127.0.0.1:3100 node server/test/lasttest.mjs --einrichten --mappen 50000
 *   # messen: Stufe „normal“ (100 gleichzeitig, ohne und mit großem Export) und „Überlast“ (500, 1000)
 *   DMS_URL=http://127.0.0.1:3100 node server/test/lasttest.mjs --stufe alle --dauer 120 --bericht bericht.md
 *
 * Optionen: --stufe normal|ueberlast|alle, --dauer <Sekunden je Durchgang> (Standard 120), --gleichzeitig <n>
 * (nur ein Durchgang mit n), --ohne-export, --bericht <Datei> (Markdown), --json <Datei>, --grenzen (Exit-Code 1
 * bei überschrittenen Grenzen). Beim Einrichten: --mappen <n> (Standard 50000), --dokumente <Anteil in %> (2).
 *
 * Gemischtes Profil wie im Alltag: Startseite, Liste einer Ansicht, Mappe öffnen, Suche, Vorschaubild,
 * Dokument herunterladen – Administrator und Mitglieder gemischt. Jede „Person“ des Tests schickt eine
 * Anfrage nach der anderen; „100 gleichzeitig“ heißt: 100 Anfragen sind ständig unterwegs. Bekommt sie 503,
 * wartet sie, wie `Retry-After` sagt (wie ein ordentliches Programm), und macht dann weiter.
 * Grenzen und ihre Begründung: Entwicklerhandbuch → Leistung → Lasttest.
 */
import { randomInt } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const BASIS = (process.env.DMS_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const arg = (n, std) => { const i = process.argv.indexOf(n); return i < 0 ? std : process.argv[i + 1]; };
const hat = (n) => process.argv.includes(n);

/** Wie lange eine Anfrage höchstens auf ihre Antwort wartet; danach zählt sie als „ohne Antwort“. */
const ANTWORT_MAX_MS = 60_000;
const BENUTZER = {
  admin: ['anna@beispiel.de', 'last-passwort-1'],
  mitRolle: ['ben@beispiel.de', 'last-passwort-2'],
  ohneRolle: ['clara@beispiel.de', 'last-passwort-3'],
};
/** Konto nur für die Prüfung des Anmeldeschutzes. */
const SPERRKONTO = ['dora@beispiel.de', 'last-passwort-4'];

/**
 * Grenzen (#544): großzügig, damit nur echte Verschlechterungen auffallen – GitHub-Rechner schwanken.
 * Begründung im Entwicklerhandbuch (Leistung → Lasttest).
 */
export const GRENZEN = {
  normal: { p95Ms: 5000, fehlerquote: 0.01 },
  normalMitExport: { p95Ms: 6000, fehlerquote: 0.01 },
  ueberlast: { ohneAntwort: 0, speicherMb: 1536, erholungMs: 30_000, erholungP95Ms: 1000 },
};

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

/* ---------- Einrichten ---------- */

async function einrichten() {
  const mappen = Number(arg('--mappen', 50_000));
  const anteil = Number(arg('--dokumente', 2));
  const [email, passwort] = BENUTZER.admin;
  const { cookie: admin } = await json('POST', '/api/konto/einrichten', { body: { mandant: 'Familie Lasttest', email, name: 'Anna Admin', passwort } });
  const c = { cookie: admin };
  await json('POST', '/api/werkbank/einrichtung/schritt', { ...c, body: { schritt: 'fertig' } }).catch(() => {});
  await json('POST', '/api/beispiele', c);
  // Demo-Mappen, ein kleiner Teil mit einem Brief als PDF (für Vorschaubild, Herunterladen und den Export).
  const t0 = Date.now();
  await json('POST', '/api/werkbank/demo', { ...c, body: { anzahl: mappen, startwert: 'lasttest-544', dokumente: anteil > 0 ? { anteil, von: 1, bis: 1, mischung: { brief: 100, mehrseitig: 0, scan: 0, bild: 0, gross: 0 } } : null } });
  for (;;) {
    const { daten: a } = await json('GET', '/api/werkbank/auftrag', c);
    if (!a || a.status === 'fertig') break;
    if (a.status === 'fehler') throw new Error(a.fehler);
    await warte(2000);
  }
  console.log(`${mappen} Demo-Mappen in ${Math.round((Date.now() - t0) / 1000)} s erzeugt.`);
  const { daten: typen } = await json('GET', '/api/typen', c);
  const { daten: rolle } = await json('POST', '/api/mappen', { ...c, body: { typId: typen.find((t) => t.system === 'rolle').id, werte: { name: 'Steuern und Finanzen' } } });
  for (const [name, [e, p], rollen] of [['Mitglied mit Rolle', BENUTZER.mitRolle, [rolle.id]], ['Mitglied ohne Rolle', BENUTZER.ohneRolle, []], ['Sperrprobe', SPERRKONTO, []]]) {
    const { daten: einladung } = await json('POST', '/api/benutzer', { ...c, body: { email: e, name, rolle: 'mitglied', rollen } });
    await json('POST', '/api/konto/passwort-setzen', { body: { schluessel: einladung.link.split('/passwort/')[1], passwort: p } });
  }
  // Regeln wie in einem Haushalt (wie ladezeiten.mjs, #477): ergeben für Mitglieder einen Lesefilter in SQL.
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
  console.log('Eingerichtet.');
}

/* ---------- Vorbereiten: Sitzungen, Ansichten, Mappen, Dokumente ---------- */

const zufall = (a) => a[Math.floor(Math.random() * a.length)];

async function vorbereiten() {
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
    case 'Startseite': return { art, cookie, pfad: zufall(['/api/startseite', '/api/sichten', '/api/anstehend', '/api/typen']) };
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
    if (!fehler && p95 !== null && p95 <= GRENZEN.ueberlast.erholungP95Ms) return { ms: Date.now() - t0, p95: Math.round(p95) };
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

/* ---------- Bericht ---------- */

function bericht(laeufe, x) {
  const z = [];
  z.push(`## Lasttest (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '');
  z.push(`Ziel: ${BASIS}. Mappen in den Listen: ${x.mappen}, Dokumente: ${x.dokumente}. Export nebenher, einer nach dem anderen: PDF von ${x.exportPdf} Mappen mit Übersicht, PDF von ${x.exportDok} Mappen mit ihren Dokumenten, ZIP der größten Ansicht (${x.exportZip} Mappen).`, '');
  z.push('| Durchgang | Gleichzeitig | Anfragen | je s | Median ms | p95 ms | p99 ms | Fehlerquote | abgewiesen (503) | ohne Antwort | Schleife p99/max ms | DB warten p95/max ms | Speicher MB Start/max/Ende |');
  z.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
  const f = (x) => (x === null || x === undefined ? '–' : String(x));
  for (const l of laeufe) {
    z.push(`| ${l.name} | ${l.n} | ${l.anfragen} | ${l.jeSekunde} | ${f(l.median)} | ${f(l.p95)} | ${f(l.p99)} | ${(l.fehlerquote * 100).toFixed(2)} % | ${l.abgewiesen}${l.abgewiesen ? ` (${l.retryAfter} mit Retry-After)` : ''} | ${l.ohneAntwort} | ${f(rund(l.schleifeP99))} / ${f(rund(l.schleifeMax))} | ${f(rund(l.dbWartenP95))} / ${f(rund(l.dbWartenMax))} | ${f(l.speicherMbStart)} / ${f(l.speicherMbMax)} / ${f(l.speicherMbEnde)} |`);
  }
  for (const l of laeufe.filter((x) => x.exporte.length)) {
    z.push('', `Exporte im Durchgang „${l.name}“: ${l.exporte.map((e) => `${e.art.toUpperCase()} ${e.status} ${(e.ms / 1000).toFixed(1)} s ${e.mb} MB`).join(' · ')}`);
  }
  z.push('', 'Median und p95 je Art (normal, ohne Export):', '');
  const n = laeufe.find((l) => l.name === 'normal');
  if (n) for (const [k, w] of Object.entries(n.jeArt)) z.push(`- ${k}: ${w.anzahl} Anfragen, Median ${w.median} ms, p95 ${w.p95} ms`);
  if (x.erholung) z.push('', `Erholung nach der Überlast: ${x.erholung.ms === null ? 'nicht innerhalb von 120 s' : `nach ${(x.erholung.ms / 1000).toFixed(1)} s`} (p95 ${f(x.erholung.p95)} ms).`);
  if (x.anmeldeschutz) z.push(`Anmeldeschutz unter Last: falsche Passwörter → ${x.anmeldeschutz.falsch.join(', ')}; danach richtiges Passwort → ${x.anmeldeschutz.richtig} – ${x.anmeldeschutz.wirkt ? 'wirkt' : 'WIRKT NICHT'}.`);
  if (x.verstoesse.length) z.push('', '**Grenzen überschritten:**', '', ...x.verstoesse.map((v) => `- ${v}`));
  else if (x.geprueft) z.push('', 'Alle Grenzen eingehalten.');
  return z.join('\n');
}

function pruefe(laeufe, x) {
  const v = [];
  for (const l of laeufe) {
    if (l.name.startsWith('normal')) {
      const g = l.mitExport ? GRENZEN.normalMitExport : GRENZEN.normal;
      if (l.p95 !== null && l.p95 > g.p95Ms) v.push(`${l.name}: p95 ${l.p95} ms > ${g.p95Ms} ms`);
      if (l.fehlerquote > g.fehlerquote) v.push(`${l.name}: Fehlerquote ${(l.fehlerquote * 100).toFixed(2)} % > ${g.fehlerquote * 100} %`);
      if (l.abgewiesen) v.push(`${l.name}: ${l.abgewiesen} Anfragen abgewiesen (503) – bei 100 gleichzeitig darf der Überlastschutz nicht greifen`);
      if (l.exporte.some((e) => e.status !== 200)) v.push(`${l.name}: Export fehlgeschlagen (${l.exporte.filter((e) => e.status !== 200).map((e) => e.status).join(', ')})`);
    } else {
      if (l.ohneAntwort > GRENZEN.ueberlast.ohneAntwort) v.push(`${l.name}: ${l.ohneAntwort} Anfragen ohne Antwort nach ${ANTWORT_MAX_MS / 1000} s`);
      if (l.speicherMbMax !== null && l.speicherMbMax > GRENZEN.ueberlast.speicherMb) v.push(`${l.name}: Arbeitsspeicher ${l.speicherMbMax} MB > ${GRENZEN.ueberlast.speicherMb} MB`);
      if (l.serverAusfaelle > 2) v.push(`${l.name}: Server ${l.serverAusfaelle}-mal nicht erreichbar`);
    }
  }
  if (x.erholung && (x.erholung.ms === null || x.erholung.ms > GRENZEN.ueberlast.erholungMs)) v.push(`Erholung nach der Überlast: ${x.erholung.ms === null ? 'keine' : `${x.erholung.ms} ms`} > ${GRENZEN.ueberlast.erholungMs} ms`);
  if (x.anmeldeschutz && !x.anmeldeschutz.wirkt) v.push('Anmeldeschutz wirkt unter Last nicht');
  return v;
}

/* ---------- Ablauf ---------- */

async function messen() {
  const stufe = arg('--stufe', 'alle');
  const dauer = Number(arg('--dauer', 120));
  const v = await vorbereiten();
  console.log(`Vorbereitet: ${v.mappen.length} Mappen, ${v.dokumente.length} Dokumente, ${v.ansichten.length} Ansichten; größte Ansicht ${v.exportSicht.n} Mappen.`);
  const laeufe = [];
  const x = { mappen: v.mappen.length, dokumente: v.dokumente.length, exportPdf: v.exportPdf.length, exportDok: v.dokMappen.length, exportZip: v.exportSicht.n, verstoesse: [], geprueft: hat('--grenzen') };
  const lauf = async (o) => { console.log(`Durchgang „${o.name}“: ${o.n} gleichzeitig, ${o.dauer} s …`); const e = await durchgang(v, o); console.log(`  p95 ${e.p95} ms, Fehlerquote ${(e.fehlerquote * 100).toFixed(2)} %, abgewiesen ${e.abgewiesen}, ohne Antwort ${e.ohneAntwort}`); laeufe.push(e); await warte(5000); };
  if (arg('--gleichzeitig')) await lauf({ name: `${arg('--gleichzeitig')} gleichzeitig`, n: Number(arg('--gleichzeitig')), dauer, mitExport: !hat('--ohne-export') });
  else {
    if (stufe === 'normal' || stufe === 'alle') {
      await lauf({ name: 'normal', n: 100, dauer, mitExport: false });
      if (!hat('--ohne-export')) await lauf({ name: 'normal mit Export', n: 100, dauer, mitExport: true });
    }
    if (stufe === 'ueberlast' || stufe === 'alle') {
      const schutz = anmeldeschutz();
      await lauf({ name: 'Überlast 500', n: 500, dauer: Math.min(dauer, 60), mitExport: false });
      x.anmeldeschutz = await schutz;
      await lauf({ name: 'Überlast 1000', n: 1000, dauer: Math.min(dauer, 60), mitExport: false });
      x.erholung = await erholung(v);
    }
  }
  x.verstoesse = pruefe(laeufe, x);
  const text = bericht(laeufe, x);
  console.log(`\n${text}`);
  if (arg('--bericht')) await writeFile(arg('--bericht'), `${text}\n`);
  if (arg('--json')) await writeFile(arg('--json'), JSON.stringify({ laeufe, ...x }, null, 2));
  if (x.geprueft && x.verstoesse.length) process.exitCode = 1;
}

if (hat('--einrichten')) await einrichten();
else await messen();
