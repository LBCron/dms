/**
 * Paket selbst erstellen (#374): gewählte Mappentypen und Ansichten dieses DMS als .zip im Format der
 * Registry (manifest.yaml, inhalt/…, README, CHANGELOG, LICENSE, tests/erwartung.yaml).
 *
 * - Nur, was das Paketformat heute kann; was nicht hineinpasst, steht als Hinweis in der Prüfung.
 * - Typen und Ansichten aus installierten Paketen werden nicht kopiert, sondern Abhängigkeit (>= installierte Version).
 * - Verweise auf Benutzer, Rolle und Ablageort werden dms:…; auf eigene, nicht gewählte Typen: „mit aufnehmen“.
 * - Ansichten dürfen ohne ihre Mappentypen ins Paket (#656): Der Typ bleibt über seine Kennung erhalten (`fremde_typen`),
 *   die Prüfung warnt nur.
 * - Keine Mappendaten außer ausdrücklich gewählten Beispiel-Mappen; nie Passwörter, nie Benutzer, keine Ids.
 * - Vor dem Download dieselbe Prüfung wie beim Hochladen (liesPaket).
 *
 * `baue` ist eine reine Funktion (testbar ohne DMS); die Klasse holt den Stand aus dem Dienst.
 */
import { stringify } from 'yaml';
import { istLeer, standardliste, trefferlistenVon, type Feld, type Mappe, type Mappentyp, type Register } from '../../shared/src/model';
import { kreisImStandard } from '../../shared/src/nummernkreis';
import { BEREICH, DMS_WORTLISTEN_AB, inMB, PAKET_ID, VERSION, WORTLISTEN_MAX, vergleicheVersion, type InstalliertesPaket } from '../../shared/src/pakete';
import { liesWortgruppe } from '../../shared/src/suche';
import type { Synonymgruppe } from './repo';
import { BESCHREIBUNG_LAENGE, EIGENE_LIZENZ, GITHUB, istFreieLizenz, KEINE_LIZENZ, LIZENZ_VORGABE, LIZENZEN, LIZENZNAME_LAENGE, LIZENZTEXT_MAX, lizenzVerweis, NAME_LAENGE, naechsteVersion, naechsteVersionen, type ErstellenStand, type Fehlend, type PaketEntwurf, type PaketErstellenEingabe, type PaketPruefung, type SelbstErstellt, type SelbstErstelltDetail, type VersionsArt, type VersionsLage } from '../../shared/src/paketerstellung';
import type { Bedingung, Sicht, WertAngabe } from '../../shared/src/sichten';
import type { Dienst } from './dienst';
import { t } from './sprache';
import { Fachfehler } from './fehler';
import { LIZENZTEXTE } from './lizenztexte';
import { ARCHIV_MAX, DMS_TYPEN, DMS_VERWEISE_AB, FREMDE_TYPEN_AB, liesPaket, liesZip, type FremderTyp, type Handelnder } from './pakete';
import { protokoll } from './protokoll';
import { typBild, typUnterschiede, type TypUnterschiede } from '../../shared/src/typvergleich';
import { zipPuffer } from './zip';

const log = protokoll.modul('werkbank');

/** Ab dieser Version verstehen DMS Verweise zwischen Beispielen (#347). */
const BEISPIELVERWEISE_AB = '0.79.0';
/**
 * Mindestversion von Ablago (#651): Grundlage ist die Version, mit der „Paket erstellen“ kam; jede benutzte
 * Funktion kann sie anheben. Neue Funktionen im Paketformat bitte hier eintragen (Entwicklerhandbuch → Pakete).
 */
export const MINDEST_GRUNDLAGE = '0.86.0';
export const MINDEST_FUNKTIONEN = {
  dmsVerweise: { ab: DMS_VERWEISE_AB, grund: 'Verweise auf Mappentypen von Ablago' },
  beispielVerweise: { ab: BEISPIELVERWEISE_AB, grund: 'Verweise zwischen Beispielen' },
  erkennung: { ab: '0.113.0', grund: 'Erkennung an Feldern („Aus Dokument ausfüllen“)' },
  feldformate: { ab: '0.121.0', grund: 'Feldformate und Datumsgrenzen' },
  wortlisten: { ab: DMS_WORTLISTEN_AB, grund: 'Wortlisten' },
  fremdeTypen: { ab: FREMDE_TYPEN_AB, grund: 'Ansichten mit Mappentypen, die nicht im Paket sind' },
} as const;
export type MindestFunktion = keyof typeof MINDEST_FUNKTIONEN;
/** Minor-Versionen, die es nie gab (übersprungen); erscheinen nicht in der Auswahl. */
const NIE_ERSCHIENEN = new Set(['0.157.0']);
const DMS_ANGABE = /^>=(\d+)\.(\d+)\.0$/;

/** Mindestversion aus den benutzten Funktionen: höchste Untergrenze und die Gründe dafür. */
export function mindestversion(genutzt: Iterable<MindestFunktion>): { version: string; gruende: string[] } {
  let v = MINDEST_GRUNDLAGE;
  const alle = [...new Set(genutzt)].map((k) => MINDEST_FUNKTIONEN[k]);
  for (const f of alle) if (vergleicheVersion(f.ab, v) > 0) v = f.ab;
  return { version: v, gruende: alle.filter((f) => vergleicheVersion(f.ab, MINDEST_GRUNDLAGE) > 0).sort((a, b) => vergleicheVersion(b.ab, a.ab)).map((f) => `${f.grund} (ab ${f.ab})`) };
}

/** Wählbare Angaben „>=X.Y.0“ von der Mindestversion bis zur eigenen Version, älteste zuerst. */
export function dmsOptionen(mindest: string, eigene: string): string[] {
  const [ma, mb] = mindest.split('.').map(Number);
  const e = eigene.replace(/^v/, '').split('-')[0];
  if (!VERSION.test(e)) return [`>=${ma}.${mb}.0`];
  const [ea, eb] = e.split('.').map(Number);
  const r: string[] = [];
  const dazu = (a: number, b: number) => { const v = `${a}.${b}.0`; if (!NIE_ERSCHIENEN.has(v)) r.push(`>=${v}`); };
  if (ma === ea) for (let b = mb; b <= eb; b++) dazu(ma, b);
  else if (ma < ea) {
    // Über eine Hauptversion hinweg: die Minor-Versionen der alten kennt Ablago nicht – nur die Mindestversion.
    dazu(ma, mb);
    for (let a = ma + 1; a <= ea; a++) for (let b = 0; b <= (a === ea ? eb : 0); b++) dazu(a, b);
  }
  return r.length ? r : [`>=${ma}.${mb}.0`];
}

/** Art der Änderung seit dem letzten Export: entfernt → größere, neu → neue Inhalte, sonst Korrektur. */
export function erkenneArt(e: PaketErstellenEingabe, entwurf: PaketEntwurf | null, felderJetzt: Record<string, string[]>, namen: Map<string, string>): { art: VersionsArt | null; grund: string | null } {
  if (!entwurf) return { art: null, grund: null };
  const weg = (alt: string[], neu: string[]) => alt.filter((x) => !neu.includes(x));
  const typWeg = weg(entwurf.typen, e.typen), sichtWeg = weg(entwurf.sichten, e.sichten);
  const name = (id: string) => namen.get(id) ?? 'ein Mappentyp';
  if (typWeg.length) return { art: 'gross', grund: `Mappentyp „${name(typWeg[0])}“ nicht mehr dabei` };
  if (sichtWeg.length) return { art: 'gross', grund: `Ansicht „${name(sichtWeg[0])}“ nicht mehr dabei` };
  const alt = entwurf.felder;
  if (alt) for (const [tid, keys] of Object.entries(alt)) {
    if (!e.typen.includes(tid) || !felderJetzt[tid]) continue;
    const f = weg(keys, felderJetzt[tid]);
    if (f.length) return { art: 'gross', grund: `Feld „${f[0]}“ in „${name(tid)}“ entfernt` };
  }
  const typNeu = weg(e.typen, entwurf.typen), sichtNeu = weg(e.sichten, entwurf.sichten);
  if (typNeu.length) return { art: 'inhalt', grund: `Mappentyp „${name(typNeu[0])}“ neu dabei` };
  if (sichtNeu.length) return { art: 'inhalt', grund: `Ansicht „${name(sichtNeu[0])}“ neu dabei` };
  if (alt) {
    for (const tid of e.typen) {
      const f = felderJetzt[tid] ? weg(felderJetzt[tid], alt[tid] ?? []) : [];
      if (f.length) return { art: 'inhalt', grund: `Feld „${f[0]}“ in „${name(tid)}“ neu` };
    }
    return { art: 'korrektur', grund: 'Keine Felder, Mappentypen oder Ansichten hinzugekommen oder entfernt' };
  }
  return { art: null, grund: null };
}
const SCHLUESSEL = /^[a-z][a-z0-9_]{0,39}$/;
/** Etwas, das wie eine Id aussieht (Mappe, Benutzer, Rolle) – gehört nie in ein Paket. */
const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const mitId = (v: unknown) => ID.test(JSON.stringify(v) ?? '');
const ENTWUERFE_MAX = 20;
/** Gemerkte Archive je selbst erstelltem Paket (#652): die letzten Versionen, je höchstens 5 MB (Einstellung, in der Sicherung). */
const ARCHIVE_JE_PAKET = 10;
const ARCHIV_MERKEN_MAX = 5 * 1024 * 1024;
type GemerktesArchiv = { version: string; erstellt: string; zip: string };
const BEISPIELMAPPEN_MAX = 200;

/** Alles, was die Erzeugung aus dem DMS braucht. */
export interface ErstellenDaten {
  typen: Mappentyp[];
  sichten: Sicht[];
  pakete: InstalliertesPaket[];
  /** Mappentypen, auf die Pakete mit dms:… verweisen dürfen: Id → Kennung (benutzer, rolle, ablageort). */
  dmsTypen: Map<string, string>;
  /** Gewählte Beispiel-Mappen (nur aus gewählten eigenen Typen). */
  mappen: Mappe[];
  /** Alle Gruppen gleichbedeutender Wörter (#661); eigene haben die Quelle „werkbank“. */
  wortlisten?: Synonymgruppe[];
  dmsVersion: string;
  /** Zuletzt exportierter Entwurf mit derselben Id. */
  entwurf: PaketEntwurf | null;
  /** Alle gemerkten Entwürfe (#656): unter welcher Kennung ein eigener Typ in einem früher exportierten Paket steckt. */
  entwuerfe?: PaketEntwurf[];
  jetzt: Date;
}

/** Höchste Version, die der Empfänger schon haben kann: Entwurf oder hochgeladene letzte Version. */
export function bekannteVersion(e: PaketErstellenEingabe, entwurf: PaketEntwurf | null): string | null {
  const l = [entwurf?.version, e.bekannteVersion?.trim()].filter((v): v is string => !!v && VERSION.test(v)).sort(vergleicheVersion);
  return l.pop() ?? null;
}

export interface Bau {
  probleme: string[];
  fehlend: Array<Fehlend & { noetig: boolean }>;
  hinweise: string[];
  abhaengigkeiten: Record<string, string>;
  inhalt: PaketPruefung['inhalt'];
  /** Kennungen im Paket je Id im DMS (zum Merken). */
  schluessel: Record<string, string>;
  /** Dateien des Pakets (ohne Ordner davor). */
  dateien: Array<{ name: string; daten: Buffer }>;
  /** #651: Version und Mindestversion. */
  version: VersionsLage;
  /** Feldschlüssel je exportiertem Typ (zum Merken, #651). */
  felder: Record<string, string[]>;
  /** Lizenzangabe im Manifest. */
  lizenz: string;
}

/** Null, undefined, leere Texte und „false“ weglassen – das Schema kennt kein null. */
function ohneLeere<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && !v.length))) as Partial<T>;
}

/** Eine freie Kennung: Basis gekürzt, bei Bedarf mit _2, _3 … */
function frei(basis: string, max: number, belegt: Set<string>): string {
  let b = basis.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '');
  if (!b) b = 'typ';
  b = b.slice(0, max).replace(/_+$/, '') || 'typ';
  let k = b;
  for (let n = 2; belegt.has(k); n++) k = `${b.slice(0, max - String(n).length - 1)}_${n}`;
  belegt.add(k);
  return k;
}

/** Untergrenze eines Versionsbereichs, z. B. „>=0.75.0“ → 0.75.0. */
const untergrenze = (bereich: string) => BEREICH.exec(bereich.trim())?.[2] ?? null;
/** Text für eine Markdown-Tabellenzelle: Backslash zuerst, dann „|“ escapen, Zeilenumbrüche weg. */
const zelle = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/**
 * Baut das Paket: prüft die Auswahl und die Angaben, löst Verweise auf und erzeugt die Dateien.
 * Gibt immer ein Ergebnis zurück; `probleme` bzw. nötige `fehlend` verhindern den Export.
 */
export function baue(e: PaketErstellenEingabe, d: ErstellenDaten): Bau {
  const probleme: string[] = [];
  const hinweise: string[] = [];
  const fehlend: Bau['fehlend'] = [];
  const abh: Record<string, string> = {};
  const typById = new Map(d.typen.map((t) => [t.id, t] as const));
  const sichtById = new Map(d.sichten.map((s) => [s.id, s] as const));
  const id = e.id.trim();

  // Herkunft: welche Typen und Ansichten gehören zu einem installierten Paket?
  const typPaket = new Map<string, { p: InstalliertesPaket; s: string }>();
  const sichtPaket = new Map<string, { p: InstalliertesPaket; s: string }>();
  for (const p of d.pakete) {
    for (const [s, tid] of Object.entries(p.typen)) typPaket.set(tid, { p, s });
    for (const [s, sid] of Object.entries(p.sichten)) sichtPaket.set(sid, { p, s });
  }
  const geaendert = (t: Mappentyp) => { const h = typPaket.get(t.id); return !!h && aenderung(t, h.p).geaendert; };
  const einmal = new Set<string>();
  const hinweis = (h: string) => { if (!einmal.has(h)) { einmal.add(h); hinweise.push(h); } };
  const abhaengig = (p: InstalliertesPaket) => {
    const b = `>=${p.version}`;
    if (!abh[p.id] || vergleicheVersion(p.version, untergrenze(abh[p.id]) ?? '0.0.0') > 0) abh[p.id] = b;
  };
  const ausPaket = (art: string, name: string, p: InstalliertesPaket, t?: Mappentyp) => {
    abhaengig(p);
    hinweis(`${art} „${name}“ kommt aus dem Paket „${p.name}“ – wird als Abhängigkeit eingetragen (${p.id} >=${p.version}), nicht kopiert.`);
    if (t && geaendert(t)) hinweis(`Änderungen an „${t.name}“ (${p.name}) gehören nicht zu deinem Paket – beim Empfänger gilt der Typ, wie das Paket „${p.name}“ ihn bringt. Brauchst du die Änderungen, lege dafür einen eigenen Typ an.`);
  };

  // 1. Angaben
  if (!PAKET_ID.test(id)) probleme.push('Id: nur Kleinbuchstaben, Ziffern und _, beginnt mit einem Buchstaben, 2 bis 20 Zeichen (z. B. vertraege_familie).');
  else if (id === 'dms') probleme.push('Id: „dms“ ist für Verweise auf Mappentypen von Ablago reserviert.');
  else if (d.pakete.some((p) => p.id === id)) probleme.push(`Id: Das Paket „${id}“ ist in dieser Installation installiert. Wähle eine andere Id – ein eigenes Paket darf kein installiertes überdecken.`);
  const name = e.name.trim();
  if (name.length < NAME_LAENGE.min || name.length > NAME_LAENGE.max) probleme.push(`Name: ${NAME_LAENGE.min} bis ${NAME_LAENGE.max} Zeichen.`);
  if (!VERSION.test(e.version.trim())) probleme.push('Version: drei Zahlen, z. B. 1.0.0.');
  const beschreibung = e.beschreibung.trim().replace(/\s+/g, ' ');
  if (beschreibung.length < BESCHREIBUNG_LAENGE.min || beschreibung.length > BESCHREIBUNG_LAENGE.max) probleme.push(`Beschreibung: ${BESCHREIBUNG_LAENGE.min} bis ${BESCHREIBUNG_LAENGE.max} Zeichen, ein, zwei Sätze.`);
  const autor = { name: e.autor.name.trim(), github: e.autor.github.trim().replace(/^@/, '') };
  if (!autor.name) probleme.push('Autor: Bitte deinen Namen angeben (steht auch in LICENSE).');
  if (autor.github && !GITHUB.test(autor.github)) probleme.push('GitHub: nur Buchstaben, Ziffern und Bindestrich.');
  if (!autor.github) hinweis('Ohne GitHub-Namen lässt sich das Paket installieren, aber nicht in die Registry einreichen (dort ist er Pflicht).');
  // Lizenz (#651): freie aus der Liste, eigene (Name + Text → LICENSE) oder keine.
  const art = e.lizenzArt ?? 'frei';
  let lizenz = '';
  if (art === 'frei') {
    if (!istFreieLizenz(e.lizenz)) probleme.push(`Lizenz: bitte eine freie Lizenz aus der Liste wählen (${LIZENZEN.join(', ')}), eine eigene angeben oder „Keine Lizenz“.`);
    else lizenz = e.lizenz;
  } else if (art === 'eigen') {
    const n = (e.lizenzName ?? '').trim();
    if (n.length < LIZENZNAME_LAENGE.min || n.length > LIZENZNAME_LAENGE.max) probleme.push(`Lizenz: Name der eigenen Lizenz mit ${LIZENZNAME_LAENGE.min} bis ${LIZENZNAME_LAENGE.max} Zeichen.`);
    if (!(e.lizenzText ?? '').trim()) probleme.push('Lizenz: Bitte den Text der eigenen Lizenz eingeben oder eine Datei wählen – er kommt als LICENSE ins Paket.');
    else if ((e.lizenzText ?? '').length > LIZENZTEXT_MAX) probleme.push(`Lizenz: Der Lizenztext ist zu lang (höchstens ${LIZENZTEXT_MAX.toLocaleString('de-DE')} Zeichen).`);
    lizenz = lizenzVerweis(n);
  } else lizenz = KEINE_LIZENZ;
  if (art !== 'frei') hinweis(`${art === 'eigen' ? 'Mit einer eigenen Lizenz' : 'Ohne Lizenz'} lässt sich das Paket in jeder Ablago-Installation installieren, kommt so aber nicht in den offiziellen Katalog – dort gelten nur freie Lizenzen (${LIZENZEN.join(', ')}).`);
  // Version (#651): ausgewählt, immer höher als die zuletzt bekannte.
  const version = e.version.trim();
  const bekannt = bekannteVersion(e, d.entwurf);
  if (!VERSION.test(version)) probleme.push('Version: drei Zahlen, z. B. 1.0.0.');
  else if (bekannt && vergleicheVersion(version, bekannt) <= 0) probleme.push(`Version: ${bekannt} ${d.entwurf && d.entwurf.version === bekannt ? 'hast du schon erstellt' : 'gibt es schon'}. Damit der Empfänger aktualisieren kann, braucht es eine höhere Version (z. B. ${naechsteVersion(bekannt)}).`);
  else if (!e.vonHand && bekannt && !Object.values(naechsteVersionen(bekannt)).includes(version)) probleme.push(`Version: bitte eine der Möglichkeiten wählen (${Object.values(naechsteVersionen(bekannt)).join(', ')}) – andere nur im Expertenmodus von Hand.`);
  else if (!e.vonHand && !bekannt && version !== '1.0.0' && version !== '0.1.0') probleme.push('Version: Ein neues Paket beginnt mit 1.0.0 (im Expertenmodus auch 0.1.0 für „noch nicht fertig“).');
  const dms = e.dms.trim();

  // 2. Auswahl: eigene Typen werden exportiert, Paket- und Systemtypen nicht.
  const eigene: Mappentyp[] = [];
  for (const tid of new Set(e.typen)) {
    const t = typById.get(tid);
    if (!t) { probleme.push('Ein gewählter Mappentyp existiert nicht mehr. Bitte die Auswahl prüfen.'); continue; }
    const h = typPaket.get(t.id);
    if (d.dmsTypen.has(t.id) || t.system) hinweis(`„${t.name}“ bringt jede Installation von Ablago selbst mit und kommt nicht ins Paket.`);
    else if (h) ausPaket('Der Mappentyp', t.name, h.p, t);
    else eigene.push(t);
  }
  const schluessel: Record<string, string> = {};
  const max = 40 - (PAKET_ID.test(id) ? id.length : 20) - 1;
  const belegtT = new Set<string>();
  // Gemerkte Kennungen zuerst, damit sie über Versionen gleich bleiben (sonst gäbe es beim Update neue Typen).
  for (const t of eigene) {
    const alt = d.entwurf?.schluessel[t.id];
    if (alt && SCHLUESSEL.test(alt) && alt.length <= max && !belegtT.has(alt)) { belegtT.add(alt); schluessel[t.id] = alt; }
  }
  for (const t of eigene) if (!schluessel[t.id]) schluessel[t.id] = frei(t.schluessel || t.name, max, belegtT);

  /** Verweis auf einen Typ: eigener → Kennung, Paket → paket:kennung, DMS → dms:…; sonst null. */
  let dmsVerweise = false;
  const ziel = (typId: string | undefined, wo: string): string | null => {
    if (!typId) { probleme.push(`${wo}: ohne Ziel.`); return null; }
    if (schluessel[typId]) return schluessel[typId];
    const k = d.dmsTypen.get(typId);
    if (k && DMS_TYPEN[k]) { dmsVerweise = true; return `dms:${k}`; }
    const t = typById.get(typId);
    const h = typPaket.get(typId);
    if (h && t) { ausPaket('Der Mappentyp', t.name, h.p, t); return `${h.p.id}:${h.s}`; }
    if (!t) { probleme.push(`${wo}: Den Ziel-Mappentyp gibt es nicht mehr.`); return null; }
    if (t.system) { probleme.push(`${wo}: verweist auf „${t.name}“. Darauf kann ein Paket nicht verweisen (erlaubt: ${Object.values(DMS_TYPEN).join(', ')}).`); return null; }
    if (!fehlend.some((f) => f.id === t.id)) fehlend.push({ art: 'typ', id: t.id, name: t.name, grund: wo, noetig: true });
    return null;
  };

  // 3. Mappentypen
  const paketTypen = eigene.map((t) => {
    const wo = (was: string) => `„${t.name}“ → ${was}`;
    const felder = t.felder.filter((f) => !f.system).map((f) => {
      // ausText (#534) gehört zu einem Update aus der Registry, nicht in ein selbst erstelltes Paket.
      const { zielTyp, system: _s, auswahlFilter, frist, standard, ausText: _a, ...rest } = f as Feld;
      const x: Record<string, unknown> = ohneLeere(rest as Record<string, unknown>);
      if (f.typ === 'referenz') x.ziel = ziel(zielTyp, wo(`Feld „${f.label}“`)) ?? undefined;
      else delete x.verweisart;
      if (frist) x.frist = ohneLeere(frist as unknown as Record<string, unknown>);
      if (standard !== undefined && standard !== null && standard !== '') {
        if (kreisImStandard(standard)) hinweis(`${wo(`Feld „${f.label}“`)}: Der Nummernkreis gehört nicht zum Paketformat. Das Feld kommt ohne Nummernkreis ins Paket; richte ihn beim Empfänger unter Werkbank → Nummernkreise ein und trage ihn am Feld ein.`);
        else if (mitId(standard)) hinweis(`${wo(`Feld „${f.label}“`)}: Der Standardwert zeigt auf eine Mappe dieser Installation und kommt nicht ins Paket.`);
        else x.standard = standard;
      }
      if (auswahlFilter?.length) {
        if (mitId(auswahlFilter)) hinweis(`${wo(`Feld „${f.label}“`)}: Der Auswahlfilter nennt Mappen dieser Installation und kommt nicht ins Paket.`);
        else x.auswahlFilter = auswahlFilter;
      }
      if (x.ziel === undefined) delete x.ziel;
      return x;
    });
    const register = t.register.map((r: Register) => {
      const quellen = r.quellen?.map((q) => ({ typ: ziel(q.typId, wo(`Register „${r.name}“`)), feld: q.feldKey })).filter((q): q is { typ: string; feld: string } => !!q.typ);
      return ohneLeere({ key: r.key, name: r.name, art: r.art, felder: r.art === 'felder' ? (r.felder ?? []).filter((k) => felder.some((f) => f.key === k)) : undefined, quellen, versionierung: r.versionierung, versionenBehalten: r.versionenBehalten });
    });
    // volltext: false ausdrücklich behalten (Standard ist ja); ohneLeere ließe es weg.
    t.register.forEach((r, i) => { if (r.volltext === false) (register[i] as Record<string, unknown>).volltext = false; });
    const liste = standardliste(t);
    if (trefferlistenVon(t).length > 1) hinweis(`„${t.name}“: Nur die Standard-Trefferliste „${liste.name}“ kommt ins Paket; weitere Trefferlisten kennt das Paketformat nicht.`);
    const weg = [t.berechtigungen ? 'Berechtigungen' : '', t.archiv ? 'Archivmodus' : '', t.erstellenErlaubt === false || t.loeschenErlaubt === false ? 'Anlegen/Löschen gesperrt' : ''].filter(Boolean);
    if (weg.length) hinweis(`„${t.name}“: ${weg.join(', ')} gehören nicht zum Paketformat und kommen nicht mit.`);
    // Das Schema verlangt beschreibung und felder auch leer.
    return {
      schluessel: schluessel[t.id], name: t.name, beschreibung: t.beschreibung ?? '',
      ...ohneLeere({ titelVorlage: t.titelVorlage || undefined }), felder, register, ...ohneLeere({ trefferliste: liste.spalten.length ? liste.spalten : undefined }),
    };
  });

  // 4. Ansichten
  const eigeneSichten: Sicht[] = [];
  for (const sid of new Set(e.sichten)) {
    const s = sichtById.get(sid);
    if (!s) { probleme.push('Eine gewählte Ansicht existiert nicht mehr. Bitte die Auswahl prüfen.'); continue; }
    const h = sichtPaket.get(s.id);
    if (h) ausPaket('Die Ansicht', s.name, h.p);
    else eigeneSichten.push(s);
  }
  const belegtS = new Set<string>();
  for (const s of eigeneSichten) {
    const alt = d.entwurf?.schluessel[s.id];
    if (alt && SCHLUESSEL.test(alt) && !belegtS.has(alt) && !Object.values(schluessel).includes(alt)) { belegtS.add(alt); schluessel[s.id] = alt; }
  }
  for (const s of eigeneSichten) if (!schluessel[s.id]) schluessel[s.id] = frei(s.name, 40, belegtS);
  const fest = (w: WertAngabe | undefined): unknown => (!w ? undefined : w.art === 'fest' ? w.wert : w);
  let fremdeTypen = false;
  const paketSichten = eigeneSichten.map((s) => {
    let eltern: string | undefined;
    if (s.elternId) {
      const ep = sichtById.get(s.elternId);
      if (ep && schluessel[ep.id] && eigeneSichten.includes(ep)) eltern = schluessel[ep.id];
      else if (ep && sichtPaket.has(ep.id)) hinweis(`Ansicht „${s.name}“ steht unter „${ep.name}“ aus einem Paket – im Paket steht sie auf der obersten Ebene.`);
      else if (ep) {
        hinweis(`Ansicht „${s.name}“ steht unter „${ep.name}“, die nicht gewählt ist – im Paket steht sie auf der obersten Ebene.`);
        if (!fehlend.some((f) => f.id === ep.id)) fehlend.push({ art: 'sicht', id: ep.id, name: ep.name, grund: `Elternansicht von „${s.name}“`, noetig: false });
      }
    }
    // Eigene, nicht gewählte Typen (#656): nur ein Hinweis – der Typ bleibt über seine Kennung in der Ansicht.
    const fremd: FremderTyp[] = [];
    const typen = s.typen.map((tid) => {
      const t = typById.get(tid);
      if (t && !schluessel[tid] && !d.dmsTypen.has(tid) && !t.system && !typPaket.has(tid)) {
        const frueher = (d.entwuerfe ?? []).find((x) => x.id !== id && x.schluessel[tid]);
        fremd.push({ kennung: frueher ? `${frueher.id}_${frueher.schluessel[tid]}` : t.schluessel || frei(t.name, 40, new Set()), name: t.name });
        hinweis(`Ansicht „${s.name}“ zeigt Mappen vom Typ „${t.name}“. „${t.name}“ kommt nicht ins Paket – beim Empfänger muss es „${t.name}“ schon geben, sonst bleibt die Ansicht leer oder wird nicht installiert.`);
        if (!fehlend.some((f) => f.id === t.id)) fehlend.push({ art: 'typ', id: t.id, name: t.name, grund: `Vorsicht: steckt in der Ansicht „${s.name}“ – muss beim Empfänger vorhanden sein`, noetig: false });
        return null;
      }
      return ziel(tid, `Ansicht „${s.name}“`);
    }).filter((t): t is string => !!t);
    if (fremd.length) fremdeTypen = true;
    const bedingungen = s.bedingungen.flatMap((b: Bedingung) => {
      if (b.art !== 'feld') { hinweis(`Ansicht „${s.name}“: Bedingungen auf Anzahlen, Favoriten oder Fristen kennt das Paketformat nicht; sie fehlen im Paket.`); return []; }
      const w = (b.op === 'zwischen' || b.op === 'ausserhalb') && b.bis ? [fest(b.wert), fest(b.bis)] : fest(b.wert);
      if (mitId(w)) { hinweis(`Ansicht „${s.name}“: Eine Bedingung nennt Mappen oder Benutzer dieser Installation und kommt nicht ins Paket.`); return []; }
      return [w === undefined ? { feld: b.feld, operator: b.op } : { feld: b.feld, operator: b.op, wert: w }];
    });
    if (s.trefferliste && s.trefferliste !== 'standard') hinweis(`Ansicht „${s.name}“: zeigt im Paket die Standard-Trefferliste.`);
    if (s.berechtigungen) hinweis(`Ansicht „${s.name}“: Berechtigungen an der Ansicht kommen nicht ins Paket.`);
    return ohneLeere({ schluessel: schluessel[s.id], name: s.name, beschreibung: s.beschreibung || undefined, eltern, typen, fremde_typen: fremd, bedingungen });
  });
  // Elternansichten zuerst (liest sich besser; das DMS sortiert ohnehin).
  const sortiert: typeof paketSichten = [];
  const offen = [...paketSichten];
  while (offen.length) {
    const i = offen.findIndex((s) => !s.eltern || sortiert.some((x) => x.schluessel === s.eltern) || !offen.some((x) => x.schluessel === s.eltern));
    sortiert.push(...offen.splice(i < 0 ? 0 : i, 1));
  }

  // 5. Beispiele: nur ausdrücklich gewählte Mappen der eigenen Typen, ohne Passwörter und ohne Ids.
  const exportiert = new Map(eigene.map((t) => [t.id, t] as const));
  const bsp = d.mappen.filter((m) => exportiert.has(m.typId) && !m.systemKennung);
  if (d.mappen.length > bsp.length) hinweis('Beispiel-Mappen gehen nur aus gewählten eigenen Mappentypen; die übrigen sind weggelassen.');
  const bspKey = new Map(bsp.map((m, i) => [m.id, `beispiel_${i + 1}`] as const));
  let beispielVerweise = false;
  let ohneZiel = 0;
  const beispiele = bsp.map((m) => {
    const t = exportiert.get(m.typId)!;
    const werte: Record<string, unknown> = {};
    for (const f of t.felder) {
      const w = m.werte[f.key];
      if (f.system || f.typ === 'passwort' || istLeer(w)) continue;
      if (f.typ === 'referenz') {
        const l = (Array.isArray(w) ? w : [w]).filter((x): x is string => typeof x === 'string');
        const z = l.filter((x) => bspKey.has(x)).map((x) => ({ beispiel: bspKey.get(x)! }));
        ohneZiel += l.length - z.length;
        if (z.length) { beispielVerweise = true; werte[f.key] = f.mehrfach ? z : z[0]; }
        continue;
      }
      if (f.typ === 'betrag' && w && typeof w === 'object' && 'betrag' in w) {
        const b = w as { betrag: unknown; waehrung?: string };
        werte[f.key] = (b.waehrung ?? 'EUR') === (f.waehrung || 'EUR') && typeof b.betrag === 'number' ? b.betrag : { betrag: b.betrag, waehrung: b.waehrung };
        continue;
      }
      if (mitId(w)) continue;
      werte[f.key] = w;
    }
    return { typ: schluessel[t.id], schluessel: bspKey.get(m.id)!, werte };
  });
  if (ohneZiel) hinweis(`Beispiel-Mappen: ${ohneZiel === 1 ? 'Ein Verweis zeigt' : `${ohneZiel} Verweise zeigen`} auf Mappen, die keine gewählten Beispiele sind, und ${ohneZiel === 1 ? 'bleibt' : 'bleiben'} leer.`);
  if (bsp.length) hinweis(`${bsp.length} Beispiel-Mappen aus deiner Auswahl kommen ins Paket – nimm nur Mappen mit erfundenen Daten. Dokumente, Notizen und Aufgaben kommen nicht mit.`);

  // 6. Wortlisten (#661): nur eigene Gruppen; aus Paketen nicht kopiert. Doppelte Wörter in einer Gruppe zusammengefasst.
  const wortlisten: Array<{ woerter: string[] }> = [];
  for (const wid of new Set(e.wortlisten ?? [])) {
    const g = (d.wortlisten ?? []).find((x) => x.id === wid);
    if (!g) { probleme.push('Eine gewählte Wortliste gibt es nicht mehr. Bitte die Auswahl prüfen.'); continue; }
    if (g.quelle !== 'werkbank') {
      const p = d.pakete.find((x) => x.id === g.quelle);
      if (p && abh[p.id]) hinweis(`Die Wortliste „${g.woerter.join(', ')}“ kommt über das Paket „${p.name}“ als Abhängigkeit mit, nicht kopiert.`);
      else hinweis(`Die Wortliste „${g.woerter.join(', ')}“ gehört zum Paket „${p?.name ?? g.quelle}“ und kommt nicht ins Paket.`);
      continue;
    }
    const w = liesWortgruppe(g.woerter).woerter;
    if (w.length >= 2) wortlisten.push({ woerter: w });
  }
  if (wortlisten.length > WORTLISTEN_MAX) probleme.push(`Wortlisten: höchstens ${WORTLISTEN_MAX} Gruppen.`);
  if (wortlisten.length) hinweis(`${wortlisten.length === 1 ? 'Eine Gruppe' : `${wortlisten.length} Gruppen`} gleichbedeutender Wörter kommen ins Paket – beim Empfänger stehen sie unter Werkbank → Suche bei „aus Paketen“.`);

  if (!paketTypen.length && !paketSichten.length && !wortlisten.length) probleme.push('Wähle mindestens einen eigenen Mappentyp, eine eigene Ansicht oder eine eigene Wortliste – was aus Paketen kommt, kommt nur als Abhängigkeit mit.');
  // Nötige Ablago-Version (#651): Mindestversion aus den benutzten Funktionen, Angabe aus der Auswahl.
  const genutzt: MindestFunktion[] = [];
  if (dmsVerweise) genutzt.push('dmsVerweise');
  if (beispielVerweise) genutzt.push('beispielVerweise');
  if (fremdeTypen) genutzt.push('fremdeTypen');
  if (wortlisten.length) genutzt.push('wortlisten');
  if (paketTypen.some((t) => (t.felder as Array<Record<string, unknown>>).some((f) => 'erkennung' in f))) genutzt.push('erkennung');
  if (paketTypen.some((t) => (t.felder as Array<Record<string, unknown>>).some((f) => 'format' in f || 'landFeld' in f || (f.typ === 'datum' && ('min' in f || 'max' in f))))) genutzt.push('feldformate');
  const mindest = mindestversion(genutzt);
  const optionen = dmsOptionen(mindest.version, d.dmsVersion);
  const unten = untergrenze(dms);
  if (!dms) probleme.push('Ablago-Version: bitte auswählen, ab welcher Version das Paket läuft.');
  else if (!BEREICH.test(dms) || !unten) probleme.push('Ablago-Version: z. B. >=0.121.0.');
  else if (vergleicheVersion(unten, mindest.version) < 0) probleme.push(`Ablago-Version: Das Paket nutzt ${mindest.gruende.join(', ') || 'Funktionen'} und braucht mindestens >=${mindest.version}.`);
  else if (!e.vonHand && !DMS_ANGABE.test(dms)) probleme.push('Ablago-Version: bitte eine Version aus der Auswahl (>=X.Y.0) – andere Schreibweisen nur im Expertenmodus.');
  else if (!e.vonHand && !optionen.includes(dms)) probleme.push(`Ablago-Version: ${dms} gibt es nicht zur Auswahl (von >=${mindest.version} bis zu dieser Installation).`);
  const felderJetzt: Record<string, string[]> = Object.fromEntries(eigene.map((t) => [t.id, t.felder.filter((f) => !f.system).map((f) => f.key)]));
  const namen = new Map<string, string>([...d.typen.map((t) => [t.id, t.name] as const), ...d.sichten.map((s) => [s.id, s.name] as const)]);
  const ea = erkenneArt(e, d.entwurf, felderJetzt, namen);
  const versionLage: VersionsLage = { bekannt, art: ea.art, artGrund: ea.grund, mindest: mindest.version, gruende: mindest.gruende, dmsOptionen: optionen };
  const fehlt = fehlend.filter((f) => f.noetig);
  if (fehlt.length) probleme.push(`Es wird auf Mappentypen verwiesen, die nicht gewählt sind: ${fehlt.map((f) => `„${f.name}“`).join(', ')}. Nimm sie mit auf oder entferne den Verweis.`);

  const inhalt: Bau['inhalt'] = {
    typen: paketTypen.map((t) => ({ schluessel: String(t.schluessel), name: String(t.name) })),
    sichten: sortiert.map((s) => ({ schluessel: String(s.schluessel), name: String(s.name), eltern: (s.eltern as string | undefined) ?? null })),
    beispiele: beispiele.length,
    ...(wortlisten.length ? { wortlisten: wortlisten.length } : {}),
  };
  if (probleme.length) return { probleme, fehlend, hinweise, abhaengigkeiten: abh, inhalt, schluessel, dateien: [], version: versionLage, felder: felderJetzt, lizenz };

  // 6. Dateien
  const y = (v: unknown) => Buffer.from(stringify(v, { version: '1.1', lineWidth: 0 }));
  const manifest = {
    schema: 1, id, name, version, beschreibung, autor, lizenz, dms, abhaengigkeiten: abh,
    inhalt: { mappentypen: 'inhalt/mappentypen.yaml', sichten: 'inhalt/sichten.yaml', ...(beispiele.length ? { beispiele: 'inhalt/beispiele.yaml' } : {}), ...(wortlisten.length ? { wortlisten: 'inhalt/wortlisten.yaml' } : {}) },
  };
  const datum = d.jetzt.toISOString().slice(0, 10);
  const text = aenderungsText(e, d.entwurf);
  const verlauf = (d.entwurf ? [{ version: d.entwurf.version, datum: d.entwurf.exportiert.slice(0, 10), text: d.entwurf.aenderungen || 'Aus Ablago exportiert.' }, ...d.entwurf.verlauf] : [])
    .filter((v) => vergleicheVersion(v.version, version) < 0);
  const changelog = ['# Änderungen', '', `## ${version}`, '', ...text.split('\n').map((z) => (z.trim().startsWith('-') ? z : `- ${z}`)).filter((z) => z.trim() !== '-'),
    ...verlauf.flatMap((v) => ['', `## ${v.version}`, '', ...v.text.split('\n').map((z) => (z.trim().startsWith('-') ? z : `- ${z}`)).filter((z) => z.trim() !== '-')]), ''].join('\n');
  const typName = new Map(paketTypen.map((t) => [String(t.schluessel), String(t.name)] as const));
  const readme = [
    `# ${name}`, '', beschreibung, '', '## Inhalt', '',
    ...(paketTypen.length ? ['| Mappentyp | Felder |', '| --- | --- |', ...paketTypen.map((t) => `| ${zelle(String(t.name))} | ${zelle((t.felder as Array<{ label: string }>).map((f) => f.label).join(', ') || '–')} |`), ''] : []),
    ...(sortiert.length ? [`**Ansichten:** ${sortiert.map((s) => (s.eltern ? `${sortiert.find((x) => x.schluessel === s.eltern)?.name} → ${s.name}` : s.name)).join(', ')}`, ''] : []),
    ...(wortlisten.length ? [`**Wortlisten:** ${wortlisten.length === 1 ? 'eine Gruppe' : `${wortlisten.length} Gruppen`} gleichbedeutender Wörter für die Suche`, ''] : []),
    ...(beispiele.length ? [`**Beispiele:** ${beispiele.length} Beispiel-Mappen (${[...new Set(beispiele.map((b) => typName.get(b.typ)))].join(', ')}), auf Wunsch bei der Installation.`, ''] : []),
    '## Voraussetzungen', '', `- Ablago ${dms}`,
    ...(Object.keys(abh).length ? Object.entries(abh).map(([k, v]) => `- Paket \`${k}\` ${v}`) : ['- keine weiteren Pakete']), '',
    '## Rechte und Netzwerkzugriff', '', 'Dieses Paket enthält keinen Code. Es legt nur Mappentypen und Ansichten an.', '',
    '## Lizenz', '', art === 'frei' ? `${lizenz} – der volle Text steht in LICENSE.` : art === 'eigen' ? `${(e.lizenzName ?? '').trim()} – der volle Text steht in LICENSE. Keine freie Lizenz.` : 'Keine Lizenz angegeben – alle Rechte beim Urheber.', '',
    '## Herkunft', '', `Erstellt mit „Paket erstellen“ in Ablago (Werkbank → Pakete) am ${datum}${autor.name ? ` von ${autor.name}` : ''}.`, '',
  ].join('\n');
  const jahr = String(d.jetzt.getFullYear());
  const lizenzDatei = art === 'frei' ? (LIZENZTEXTE[lizenz] ?? '').replace('{jahr}', jahr).replace('{name}', autor.name)
    : art === 'eigen' ? `${(e.lizenzText ?? '').replace(/\r\n/g, '\n').trim()}\n`
    : `Copyright (c) ${jahr} ${autor.name}\n\nFür dieses Paket ist keine Lizenz angegeben. Ohne Lizenz bleiben alle Rechte beim Urheber: Empfänger dürfen das Paket nutzen, wie es ihnen erlaubt wurde, es aber nicht ohne Weiteres weitergeben oder verändern.\n`;
  const erwartung = { mappentypen: inhalt.typen.map((t) => t.schluessel), sichten: inhalt.sichten.map((s) => s.schluessel), beispiele: beispiele.length, ...(wortlisten.length ? { wortlisten: wortlisten.length } : {}) };
  const dateien = [
    { name: 'manifest.yaml', daten: Buffer.from(`# Erstellt mit „Paket erstellen“ in Ablago. Format: https://github.com/motom001/dms-registry\n${stringify(manifest, { version: '1.1', lineWidth: 0 })}`) },
    { name: 'inhalt/mappentypen.yaml', daten: y(paketTypen) },
    { name: 'inhalt/sichten.yaml', daten: y(sortiert) },
    ...(beispiele.length ? [{ name: 'inhalt/beispiele.yaml', daten: y(beispiele) }] : []),
    ...(wortlisten.length ? [{ name: 'inhalt/wortlisten.yaml', daten: y(wortlisten) }] : []),
    { name: 'README.md', daten: Buffer.from(readme) },
    { name: 'CHANGELOG.md', daten: Buffer.from(changelog) },
    { name: 'LICENSE', daten: Buffer.from(lizenzDatei) },
    { name: 'tests/erwartung.yaml', daten: y(erwartung) },
  ];
  return { probleme, fehlend, hinweise, abhaengigkeiten: abh, inhalt, schluessel, dateien, version: versionLage, felder: felderJetzt, lizenz };
}

/** Eintrag im CHANGELOG für diese Version; ohne Angabe ein Standardtext. */
const aenderungsText = (e: PaketErstellenEingabe, entwurf: PaketEntwurf | null) => e.aenderungen.trim() || (entwurf ? 'Neue Version aus Ablago exportiert.' : 'Erste Fassung.');

/** Eingabe aus der Anfrage vereinheitlichen. */
export function liesEingabe(x: unknown): PaketErstellenEingabe {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))].slice(0, max) : []);
  const a = (o.autor && typeof o.autor === 'object' ? o.autor : {}) as Record<string, unknown>;
  return {
    typen: ids(o.typen, 500), sichten: ids(o.sichten, 500), beispiele: ids(o.beispiele, 100), wortlisten: ids(o.wortlisten, 1000),
    id: t(o.id, 40), name: t(o.name, 200), version: t(o.version, 40), beschreibung: t(o.beschreibung, 1000),
    autor: { name: t(a.name, 200), github: t(a.github, 100) }, lizenz: t(o.lizenz, 40), dms: t(o.dms, 60), aenderungen: t(o.aenderungen, 2000),
    lizenzArt: o.lizenzArt === 'eigen' || o.lizenzArt === 'keine' ? o.lizenzArt : 'frei',
    ...(typeof o.lizenzName === 'string' ? { lizenzName: t(o.lizenzName, 200) } : {}),
    ...(typeof o.lizenzText === 'string' ? { lizenzText: o.lizenzText.slice(0, LIZENZTEXT_MAX + 1) } : {}),
    ...(typeof o.bekannteVersion === 'string' && VERSION.test(o.bekannteVersion) ? { bekannteVersion: o.bekannteVersion } : {}),
    ...(o.vonHand === true ? { vonHand: true } : {}),
  };
}

/**
 * Weicht ein Typ aus einem Paket von dessen Stand ab (#653)? Mit gespeichertem Paketstand inhaltlich (Speichern ohne
 * Änderung zählt nicht), sonst – bei älteren Installationen – wie bisher nach der Zeit, ohne Einzelheiten.
 */
export function aenderung(t: Mappentyp, p: InstalliertesPaket): { geaendert: boolean; unterschiede: TypUnterschiede | null } {
  const stand = p.typStand?.[t.id];
  if (stand) { const u = typUnterschiede(stand, typBild(t)); return { geaendert: !!u, unterschiede: u }; }
  return { geaendert: t.geaendert > (p.aktualisiert ?? p.installiert), unterschiede: null };
}

/** Paket erstellen im DMS: Stand, Prüfung, Export; gemerkt werden die Angaben (Einstellung). */
export class Paketerstellung {
  constructor(private d: Dienst, private o: { version: () => string }) {}

  private async dmsTypen(): Promise<Map<string, string>> {
    const s = await this.d.sichereSystem();
    const a = await this.d.ablageortTyp();
    return new Map<string, string>([[s.benutzer.id, 'benutzer'], [s.rolle.id, 'rolle'], ...(a ? [[a.id, 'ablageort'] as [string, string]] : [])]);
  }


  /** Was es zur Auswahl gibt, gemerkte Entwürfe und Vorschläge für den nächsten Export. */
  async stand(): Promise<ErstellenStand> {
    const [typen, sichten, pakete, dmsTypen, entwuerfe] = [await this.d.listeTypen(), await this.d.listeSichten(), await this.d.listePakete(), await this.dmsTypen(), await this.d.paketEntwuerfe()];
    const herkunft = (map: (p: InstalliertesPaket) => Record<string, string>, id: string) => {
      const p = pakete.find((x) => Object.values(map(x)).includes(id));
      return p ? { id: p.id, name: p.name, version: p.version } : null;
    };
    // Nötige Ablago-Version bleibt leer: Die Oberfläche setzt die ermittelte Mindestversion aus der Prüfung (#651).
    const leer: PaketErstellenEingabe = { typen: [], sichten: [], beispiele: [], wortlisten: [], id: '', name: '', version: '1.0.0', beschreibung: '', autor: { name: '', github: '' }, lizenz: LIZENZ_VORGABE, lizenzArt: 'frei', dms: '', aenderungen: '' };
    return {
      typen: typen.filter((t) => !t.system && !dmsTypen.has(t.id)).map((t) => {
        const p = pakete.find((x) => Object.values(x.typen).includes(t.id));
        const a = p ? aenderung(t, p) : { geaendert: false, unterschiede: null };
        return { id: t.id, name: t.name, beschreibung: t.beschreibung ?? '', paket: herkunft((x) => x.typen, t.id), geaendert: a.geaendert, ...(a.geaendert ? { unterschiede: a.unterschiede } : {}) };
      }).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      sichten: sichten.map((s) => ({ id: s.id, name: s.name, elternId: s.elternId ?? null, paket: herkunft((x) => x.sichten, s.id) })),
      wortlisten: (await this.d.sucheStand()).synonyme.map((g) => ({ id: g.id, woerter: g.woerter, paket: g.quelle === 'werkbank' ? null : { id: g.quelle, name: g.paketName ?? g.quelle } })),
      entwuerfe,
      dms: this.o.version(),
      // #652: nie ungefragt vorbelegen – „Neue Version von …“ wählt man im ersten Schritt.
      vorschlag: leer,
    };
  }

  /** Angaben eines gemerkten Entwurfs mit höherer Version und aktueller DMS-Version. */
  ausEntwurf(e: PaketEntwurf): PaketErstellenEingabe {
    return {
      typen: e.typen, sichten: e.sichten, beispiele: e.beispiele, wortlisten: e.wortlisten ?? [], id: e.id, name: e.name, version: naechsteVersion(e.version), beschreibung: e.beschreibung, autor: e.autor,
      lizenz: e.lizenz, lizenzArt: e.lizenzArt ?? 'frei', ...(e.lizenzName ? { lizenzName: e.lizenzName } : {}), ...(e.lizenzText ? { lizenzText: e.lizenzText } : {}), dms: '', aenderungen: '',
    };
  }

  private async daten(e: PaketErstellenEingabe): Promise<ErstellenDaten> {
    const typen = await this.d.listeTypen();
    const gewaehlt = new Set(e.beispiele);
    const mappen = gewaehlt.size ? (await Promise.all(e.typen.filter((t) => typen.some((x) => x.id === t)).map((t) => this.d.listeMappen(t)))).flat().filter((m) => gewaehlt.has(m.id)) : [];
    return {
      typen, sichten: await this.d.listeSichten(), pakete: await this.d.listePakete(), dmsTypen: await this.dmsTypen(), mappen, wortlisten: (await this.d.sucheStand()).synonyme,
      dmsVersion: this.o.version(), entwurf: (await this.d.paketEntwuerfe()).find((x) => x.id === e.id.trim()) ?? null, entwuerfe: await this.d.paketEntwuerfe(), jetzt: new Date(),
    };
  }

  /** Baut das Paket und prüft das Archiv wie beim Hochladen. */
  private async baueUndPruefe(e: PaketErstellenEingabe): Promise<{ bau: Bau; zip: Buffer | null; daten: ErstellenDaten }> {
    const daten = await this.daten(e);
    const bau = baue(e, daten);
    if (bau.probleme.length) return { bau, zip: null, daten };
    const id = e.id.trim();
    const zip = zipPuffer(bau.dateien.map((f) => ({ name: `${id}/${f.name}`, daten: f.daten })), daten.jetzt);
    if (zip.length > ARCHIV_MAX) { bau.probleme.push(t('pakete.groesse.erstellenZuGross', { groesse: inMB(zip.length), max: inMB(ARCHIV_MAX) })); return { bau, zip: null, daten }; }
    try {
      const p = liesPaket(liesZip(zip));
      if (p.manifest.id !== id || p.typen.length !== bau.inhalt.typen.length || p.sichten.length !== bau.inhalt.sichten.length) throw new Error('Inhalt weicht ab.');
    } catch (x) {
      const g = (x as Fachfehler).details as { gruende?: string[] } | undefined;
      bau.probleme.push(`Die Prüfung wie beim Hochladen schlägt fehl: ${(x as Error).message}${g?.gruende ? ` ${g.gruende.join(' ')}` : ''}`);
      return { bau, zip: null, daten };
    }
    return { bau, zip, daten };
  }

  /** Automatische Prüfung mit Hinweisen und den Mappen, aus denen Beispiele gewählt werden können. */
  async pruefe(eingabe: unknown): Promise<PaketPruefung> {
    const e = liesEingabe(eingabe);
    const { bau, zip, daten } = await this.baueUndPruefe(e);
    const eigene = daten.typen.filter((t) => e.typen.includes(t.id) && !t.system && !daten.dmsTypen.has(t.id) && !daten.pakete.some((p) => Object.values(p.typen).includes(t.id)));
    const beispielMappen = await Promise.all(eigene.map(async (t) => {
      const alle = (await this.d.listeMappen(t.id)).filter((m) => !m.systemKennung).sort((a, b) => (a.titel ?? '').localeCompare(b.titel ?? '', 'de'));
      return { typId: t.id, typ: t.name, mappen: alle.slice(0, BEISPIELMAPPEN_MAX).map((m) => ({ id: m.id, titel: m.titel || '(ohne Titel)', demo: !!m.demo })), mehr: alle.length > BEISPIELMAPPEN_MAX };
    }));
    return {
      probleme: bau.probleme, fehlend: bau.fehlend.map(({ noetig: _n, ...f }) => f), hinweise: bau.hinweise, abhaengigkeiten: bau.abhaengigkeiten,
      inhalt: bau.inhalt, beispielMappen, einspielbar: !!zip, datei: zip ? { name: `${e.id.trim()}-${e.version.trim()}.zip`, bytes: zip.length } : null,
      version: bau.version,
    };
  }

  /**
   * „Letzte Version des Pakets hochladen“ (#651): Ablago kennt die zuletzt weitergegebene Version nicht
   * (z. B. auf einem anderen Gerät erstellt). Liest nur Id, Name und Version aus dem Archiv; installiert nichts.
   */
  liesLetzteVersion(daten: unknown): { id: string; name: string; version: string } {
    if (!Buffer.isBuffer(daten) || !daten.length) throw new Fachfehler(422, 'Bitte die .zip-Datei des Pakets wählen.');
    if (daten.length > ARCHIV_MAX) throw new Fachfehler(422, t('pakete.groesse.erstellenZuGross', { groesse: inMB(daten.length), max: inMB(ARCHIV_MAX) }));
    const m = liesPaket(liesZip(daten)).manifest;
    return { id: m.id, name: m.name, version: m.version };
  }

  private async archive(id: string): Promise<GemerktesArchiv[]> {
    const v = await this.d.paketArchive(id);
    return Array.isArray(v) ? v.filter((x): x is GemerktesArchiv => !!x && typeof x.version === 'string' && typeof x.zip === 'string') : [];
  }

  /** Selbst erstellte Pakete für die Paketverwaltung (#652), zuletzt erstellte zuerst. */
  async selbstErstellt(): Promise<SelbstErstellt[]> {
    const liste = [...await this.d.paketEntwuerfe()].sort((a, b) => b.exportiert.localeCompare(a.exportiert));
    return Promise.all(liste.map(async (e) => this.kurz(e, await this.archive(e.id))));
  }
  private kurz(e: PaketEntwurf, archive: GemerktesArchiv[]): SelbstErstellt {
    return {
      id: e.id, name: e.name, version: e.version, erstellt: e.exportiert, von: e.von, lizenz: e.lizenz,
      versionen: archive.map((a) => ({ version: a.version, erstellt: a.erstellt, bytes: Math.floor((a.zip.length * 3) / 4) })),
    };
  }

  /** Was damals erstellt wurde und was sich seitdem geändert hat (#652). */
  async selbstErstelltDetail(id: string): Promise<SelbstErstelltDetail> {
    const e = (await this.d.paketEntwuerfe()).find((x) => x.id === id);
    if (!e) throw new Fachfehler(404, 'Dieses selbst erstellte Paket gibt es nicht (mehr).');
    const [typen, sichten] = [await this.d.listeTypen(), await this.d.listeSichten()];
    return {
      ...this.kurz(e, await this.archive(id)), beschreibung: e.beschreibung, dms: e.dms, autor: e.autor, aenderungen: e.aenderungen, verlauf: e.verlauf,
      typen: e.typen.map((tid) => { const t = typen.find((x) => x.id === tid); return { id: tid, name: t?.name ?? null, geaendert: !!t && t.geaendert > e.exportiert }; }),
      sichten: e.sichten.map((sid) => ({ id: sid, name: sichten.find((x) => x.id === sid)?.name ?? null })),
      beispiele: e.beispiele.length,
    };
  }

  /** Eine erstellte Version noch einmal als ZIP (#652) – genau so, wie sie erstellt wurde. */
  async archiv(id: string, version: string): Promise<{ name: string; daten: Buffer }> {
    const a = (await this.archive(id)).find((x) => x.version === version);
    if (!a) throw new Fachfehler(404, `Version ${version} von „${id}“ ist nicht mehr gespeichert. Erstelle eine neue Version.`);
    return { name: `${id}-${version}.zip`, daten: Buffer.from(a.zip, 'base64') };
  }

  /** „Aus der Liste nehmen“ (#652): vergisst Entwurf und gemerkte Archive – Mappentypen und Ansichten bleiben. */
  async ausListeNehmen(id: string, von: Handelnder): Promise<SelbstErstellt[]> {
    const alle = await this.d.paketEntwuerfe();
    if (!alle.some((x) => x.id === id)) throw new Fachfehler(404, 'Dieses selbst erstellte Paket gibt es nicht (mehr).');
    await this.d.setzePaketEntwuerfe(alle.filter((x) => x.id !== id));
    await this.d.setzePaketArchive(id, null);
    log.info('Selbst erstelltes Paket aus der Liste genommen', { von: von.email, paket: id });
    return this.selbstErstellt();
  }

  /**
   * „Paket erstellen“ (#652): erstellt das Paket – es erscheint unter „Installiert“ als selbst erstellt –,
   * merkt die Angaben für die nächste Version und das Archiv zum späteren Herunterladen.
   */
  async erstelle(eingabe: unknown, von: Handelnder): Promise<SelbstErstellt & { name: string; datei: string; bytes: number }> {
    const r = await this.exportiere(eingabe, von);
    const e = (await this.d.paketEntwuerfe()).find((x) => r.name.startsWith(`${x.id}-`))!;
    return { ...this.kurz(e, await this.archive(e.id)), datei: r.name, bytes: r.daten.length };
  }

  /** Export als .zip: nur, wenn die Prüfung bestanden ist; merkt die Angaben für den nächsten Export. */
  async exportiere(eingabe: unknown, von: Handelnder): Promise<{ name: string; daten: Buffer }> {
    const e = liesEingabe(eingabe);
    const { bau, zip, daten } = await this.baueUndPruefe(e);
    if (!zip) throw new Fachfehler(422, 'Das Paket lässt sich so nicht exportieren.', { gruende: bau.probleme });
    const id = e.id.trim();
    const entwurf: PaketEntwurf = {
      ...e, id, version: e.version.trim(), aenderungen: aenderungsText(e, daten.entwurf), felder: { ...(daten.entwurf?.felder ?? {}), ...bau.felder },
      schluessel: { ...(daten.entwurf?.schluessel ?? {}), ...bau.schluessel },
      verlauf: daten.entwurf ? [{ version: daten.entwurf.version, datum: daten.entwurf.exportiert.slice(0, 10), text: daten.entwurf.aenderungen || 'Aus Ablago exportiert.' }, ...daten.entwurf.verlauf].filter((v) => vergleicheVersion(v.version, e.version.trim()) < 0).slice(0, 50) : [],
      exportiert: daten.jetzt.toISOString(), von: von.email,
    };
    const rest = (await this.d.paketEntwuerfe()).filter((x) => x.id !== id);
    await this.d.setzePaketEntwuerfe([entwurf, ...rest].slice(0, ENTWUERFE_MAX));
    // Archiv merken (#652), damit „Als ZIP herunterladen“ später genau diese Version liefert.
    if (zip.length <= ARCHIV_MERKEN_MAX) {
      const alt = (await this.archive(id)).filter((a) => a.version !== entwurf.version);
      await this.d.setzePaketArchive(id, [{ version: entwurf.version, erstellt: entwurf.exportiert, zip: zip.toString('base64') }, ...alt].slice(0, ARCHIVE_JE_PAKET));
    }
    for (const weg of rest.length + 1 > ENTWUERFE_MAX ? rest.slice(ENTWUERFE_MAX - 1) : []) await this.d.setzePaketArchive(weg.id, null);
    log.info('Paket erstellt', { von: von.email, paket: id, version: entwurf.version, typen: bau.inhalt.typen.length, sichten: bau.inhalt.sichten.length, beispiele: bau.inhalt.beispiele, abhaengigkeiten: Object.keys(bau.abhaengigkeiten) });
    return { name: `${id}-${entwurf.version}.zip`, daten: zip };
  }
}
