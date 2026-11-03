/**
 * Automatisierungen (#672, #674): kleine Abläufe ohne Code – **Wenn · Und · Dann** (Sonst kommt mit #677).
 *
 * - **Genau eine Wenn-Karte** – ein Ereignis aus dem Katalog (#670) oder „Datum in N Tagen“. Sie legt den Kontext
 *   fest: die Mappe und ihren Mappentyp. Dessen Felder stehen in Und und Dann als Bedingungen und Platzhalter bereit.
 * - **Und** – Bedingungen aus dem Baukasten der Ansichten (`sichten.ts`), dazu „Mappe ist in Ansicht …“ und
 *   „Mappe ist in den Favoriten von …“; jede umkehrbar, Gruppen „alle“ / „eine davon“ (eine Ebene tief).
 * - **Dann** – Karten in ihrer Reihenfolge. Die Karten selbst führt der Server aus (`automatisierung-karten.ts`).
 *
 * Gespeichert wird nur, was hier steht; `bereinigeAutomatisierung` schneidet alles andere ab. Was zu einer
 * Automatisierung nicht (mehr) passt (Mappentyp gelöscht, Feld fehlt …), meldet `automatisierungsProbleme` –
 * sie wird dann rot und angehalten, die Arbeit im DMS blockiert das nie („Bearbeiten geht vor Automatisierung“).
 */
import { EREIGNISKATALOG, KATALOG_ARTEN, type KatalogArt } from './ereignisse';
import type { Feld, Mappentyp } from './model';
import { bedingungsProblem, bereinigeBedingungen, type Bedingung, type Sicht } from './sichten';

/** Grenzen (Zahl der Automatisierungen, Karten je Bereich, Länge der Texte, Laufzeit, Bremse). */
export const AUTOMATISIERUNG_GRENZEN = {
  automatisierungen: 200,
  bedingungen: 20,
  karten: 20,
  name: 120,
  text: 2000,
  /** Kette von Automatisierungen, die einander auslösen (0 = direkt ausgelöst). */
  tiefe: 3,
  /** Bremse: höchstens so viele Läufe je Minute und Automatisierung, sonst angehalten. */
  laeufeJeMinute: 30,
  /** Ein Lauf darf so lange dauern. */
  laufzeitS: 60,
  /** Verlauf je Automatisierung: so viele Läufe bzw. Tage bleiben stehen. */
  verlauf: 200,
  verlaufTage: 30,
  /** „Datum in N Tagen“: so viele Tage holt der Zeitplan nach (NAS war aus). */
  nachholenTage: 31,
} as const;

/** Reihenfolge (1–99): kleiner = früher; Vorgaben je Herkunft. */
export const REIHENFOLGE = { min: 1, max: 99, eigen: 50, dms: 10, paket: 30 } as const;

/** Ereignisse, die eine Wenn-Karte sein können: alle mit einer Mappe als Kontext (Benutzer sind Mappen). */
export const WENN_EREIGNISSE = KATALOG_ARTEN.filter((a) => EREIGNISKATALOG[a].gruppe !== 'zaehler');
export type WennEreignis = Exclude<KatalogArt, 'zaehler.geaendert'>;

export type WennKarte =
  /** Ein Ereignis des Katalogs; typ = nur Mappen dieses Typs (leer = alle), felder = nur bei Änderung dieser Felder. */
  | { art: WennEreignis; typ?: string | null; felder?: string[] }
  /** Datumsfeld einer Mappe ist in N Tagen erreicht (negativ: vor N Tagen), geprüft täglich zur Uhrzeit. */
  | { art: 'datum'; typ: string; feld: string; tage: number; uhrzeit: string };

/** Wer gemeint ist: eine Person, alle aktiven Mitglieder einer Rolle oder die Person(en) in einem Feld der Mappe. */
export type Empfaenger =
  | { art: 'person'; id: string }
  | { art: 'rolle'; id: string }
  | { art: 'feld'; feld: string };

export type UndKarte =
  | { art: 'bedingung'; bedingung: Bedingung; nicht?: boolean }
  | { art: 'ansicht'; sicht: string; nicht?: boolean }
  | { art: 'favorit'; von: Empfaenger; nicht?: boolean }
  | { art: 'gruppe'; modus: 'alle' | 'eine'; karten: UndKarte[]; nicht?: boolean };

export interface UndBereich { modus: 'alle' | 'eine'; karten: UndKarte[] }

/** Dann-Karten; die Liste wächst mit #676 (Feld, Aufgabe) und Stufe 2 (#677, #671). */
export type DannKarte =
  /** „Danach keine weiteren Automatisierungen ausführen“ – nur für dieses eine Ereignis. */
  | { id: string; art: 'stopp' }
  /** Felder der Mappe setzen: je Feld ein fester Wert oder Text mit Platzhaltern (#676). */
  | { id: string; art: 'feld'; werte: Record<string, unknown> }
  /** Aufgabe (mit Fälligkeit in Tagen) oder Benachrichtigung an Personen, Rollen oder ein Feld (#676). */
  | { id: string; art: 'aufgabe'; empfaenger: Empfaenger[]; text: string; als: 'aufgabe' | 'benachrichtigung'; faellig?: number | null };
export type DannArt = DannKarte['art'];
export const DANN_ARTEN: DannArt[] = ['feld', 'aufgabe', 'stopp'];

export type Herkunft = 'eigen' | 'dms' | 'paket';

/** Warum eine Automatisierung angehalten ist (getrennt von „von Hand aus“). */
export interface Angehalten { grund: 'fehlerhaft' | 'bremse' | 'wiederherstellung'; text: string; zeit: string }

export interface AutomatisierungDaten {
  name: string;
  beschreibung: string;
  reihenfolge: number;
  wenn: WennKarte;
  und: UndBereich;
  dann: DannKarte[];
  /** Stufe 2 (#677): vorgesehen, die Oberfläche zeigt es noch nicht. */
  sonst: DannKarte[];
}

export interface Automatisierung extends AutomatisierungDaten {
  id: string;
  /** Von Hand an/aus. */
  aktiv: boolean;
  angehalten: Angehalten | null;
  herkunft: Herkunft;
  paketId?: string | null;
  /** Fortlaufende Fassung (Änderungsverlauf, Schutz gegen gleichzeitiges Speichern). */
  version: number;
  erstellt: string; erstelltVon: string | null;
  geaendert: string; geaendertVon: string | null;
}

export type LaufZustand = 'laeuft' | 'abgeschlossen' | 'unzutreffend' | 'fehlgeschlagen' | 'uebersprungen' | 'wiederholt';
export type SchrittZustand = 'offen' | 'laeuft' | 'ok' | 'nein' | 'fehler' | 'uebersprungen';
export interface Schritt { teil: 'wenn' | 'und' | 'dann' | 'sonst'; karte?: string; zustand: SchrittZustand; text?: string }

export interface Lauf {
  id: string; automatisierungId: string; ereignisId: string; art: string;
  /** Angaben des Ereignisses (nur Ids, Schlüssel, Datum) – zum Wiederholen. */
  daten: Record<string, unknown>;
  mappeId: string | null;
  zustand: LaufZustand;
  /** Trockenlauf: zeigt nur, was passieren würde. Testlauf: von Hand mit einer gewählten Mappe. */
  trocken: boolean; test: boolean;
  schritte: Schritt[];
  fehler: string | null;
  gestartet: string; beendet: string | null;
  wiederholtVon?: string | null;
}

export interface Fassung { version: number; zeit: string; von: string | null; daten: AutomatisierungDaten & { aktiv: boolean } }

/** Für Liste und Editor: Automatisierung mit Kurzform, Problemen und letztem Lauf. */
export interface AutomatisierungAnsicht extends Automatisierung {
  kurz: string;
  probleme: string[];
  letzterLauf: Pick<Lauf, 'id' | 'zustand' | 'gestartet' | 'fehler'> | null;
  /** Schlüssel des Auslösers (Liste „nach Auslöser“, „läuft als 2. von 3“). */
  ausloeser: string;
}

/* ---------- Kontext ---------- */

/** Was eine Prüfung über das DMS wissen muss. */
export interface Kontextdaten { typen: Mappentyp[]; sichten: Pick<Sicht, 'id' | 'name' | 'typen'>[]; benutzer: Array<{ id: string; name: string; aktiv?: boolean }>; rollen: Array<{ id: string; name: string }> }

/** Mappentyp der Wenn-Karte (null = jeder Typ bzw. Benutzer bei Benutzer-Ereignissen). */
export function kontextTyp(w: WennKarte, typen: Mappentyp[]): Mappentyp | null {
  if (w.art !== 'datum' && EREIGNISKATALOG[w.art].gruppe === 'benutzer') return typen.find((t) => t.system === 'benutzer') ?? null;
  const id = w.art === 'datum' ? w.typ : w.typ;
  return id ? typen.find((t) => t.id === id) ?? null : null;
}

/** Schlüssel des Auslösers: gleiche Schlüssel = laufen nacheinander für dasselbe Ereignis. */
export function ausloeserSchluessel(w: WennKarte): string {
  return w.art === 'datum' ? `datum|${w.typ}|${w.feld}|${w.tage}` : `${w.art}|${w.typ ?? ''}`;
}

/** Feste Platzhalter (außer den Feldern des Mappentyps). */
export const PLATZHALTER_FEST = ['titel', 'mappentyp', 'heute', 'automatisierung', 'datum', 'tage'] as const;

/** Platzhalter, die im Kontext der Wenn-Karte zur Verfügung stehen. */
export function platzhalterFuer(w: WennKarte, typ: Mappentyp | null): Array<{ key: string; label: string }> {
  const fest = [{ key: 'titel', label: 'Titel der Mappe' }, { key: 'mappentyp', label: 'Mappentyp' }, { key: 'heute', label: 'Datum heute' }, { key: 'automatisierung', label: 'Name dieser Automatisierung' }];
  if (w.art === 'datum') fest.push({ key: 'datum', label: 'Erreichtes Datum' }, { key: 'tage', label: 'Tage bis dahin' });
  return [...fest, ...(typ?.felder ?? []).filter((f) => f.typ !== 'passwort').map((f) => ({ key: f.key, label: f.label }))];
}

/* ---------- Eingaben bereinigen ---------- */

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

function bereinigeEmpfaenger(e: unknown): Empfaenger | null {
  const x = (e ?? {}) as Record<string, unknown>;
  if ((x.art === 'person' || x.art === 'rolle') && id(x.id)) return { art: x.art, id: id(x.id) };
  if (x.art === 'feld' && id(x.feld)) return { art: 'feld', feld: id(x.feld) };
  return null;
}

function bereinigeWenn(e: unknown): WennKarte {
  const x = (e ?? {}) as Record<string, unknown>;
  if (x.art === 'datum') {
    const tage = Math.max(-3650, Math.min(3650, Math.trunc(Number(x.tage) || 0)));
    return { art: 'datum', typ: id(x.typ), feld: id(x.feld), tage, uhrzeit: typeof x.uhrzeit === 'string' && UHRZEIT.test(x.uhrzeit) ? x.uhrzeit : '07:00' };
  }
  const art = (WENN_EREIGNISSE as string[]).includes(String(x.art)) ? (x.art as WennEreignis) : 'mappe.angelegt';
  const w: WennKarte = { art, typ: id(x.typ) || null };
  if (art === 'mappe.geaendert' && Array.isArray(x.felder)) w.felder = [...new Set(x.felder.map(id).filter(Boolean))].slice(0, 50);
  return w;
}

function bereinigeUnd(e: unknown, tiefe = 0): UndKarte | null {
  const x = (e ?? {}) as Record<string, unknown>;
  const nicht = x.nicht === true ? { nicht: true } : {};
  if (x.art === 'bedingung') { const [b] = bereinigeBedingungen([x.bedingung]); return b ? { art: 'bedingung', bedingung: b, ...nicht } : null; }
  if (x.art === 'ansicht' && id(x.sicht)) return { art: 'ansicht', sicht: id(x.sicht), ...nicht };
  if (x.art === 'favorit') { const v = bereinigeEmpfaenger(x.von); return v ? { art: 'favorit', von: v, ...nicht } : null; }
  if (x.art === 'gruppe' && tiefe === 0) {
    const karten = (Array.isArray(x.karten) ? x.karten : []).slice(0, AUTOMATISIERUNG_GRENZEN.bedingungen).map((k) => bereinigeUnd(k, 1)).filter((k): k is UndKarte => !!k);
    return { art: 'gruppe', modus: x.modus === 'eine' ? 'eine' : 'alle', karten, ...nicht };
  }
  return null;
}

function bereinigeDann(e: unknown, i: number): DannKarte | null {
  const x = (e ?? {}) as Record<string, unknown>;
  const kid = id(x.id) || `k${i + 1}`;
  if (x.art === 'stopp') return { id: kid, art: 'stopp' };
  if (x.art === 'feld') {
    const w = x.werte && typeof x.werte === 'object' && !Array.isArray(x.werte) ? (x.werte as Record<string, unknown>) : {};
    return { id: kid, art: 'feld', werte: Object.fromEntries(Object.entries(w).slice(0, 50).map(([k, v]) => [id(k), typeof v === 'string' ? v.slice(0, AUTOMATISIERUNG_GRENZEN.text) : v]).filter(([k]) => k)) };
  }
  if (x.art === 'aufgabe') {
    const empfaenger = (Array.isArray(x.empfaenger) ? x.empfaenger : []).slice(0, 20).map(bereinigeEmpfaenger).filter((v): v is Empfaenger => !!v);
    const faellig = x.faellig === null || x.faellig === undefined || x.faellig === '' ? null : Math.max(0, Math.min(3650, Math.trunc(Number(x.faellig) || 0)));
    return { id: kid, art: 'aufgabe', empfaenger, text: text(x.text, AUTOMATISIERUNG_GRENZEN.text), als: x.als === 'benachrichtigung' ? 'benachrichtigung' : 'aufgabe', faellig: x.als === 'benachrichtigung' ? null : faellig };
  }
  return null;
}

const dannListe = (e: unknown) => (Array.isArray(e) ? e : []).slice(0, AUTOMATISIERUNG_GRENZEN.karten).map(bereinigeDann).filter((k): k is DannKarte => !!k)
  // Eindeutige Ids je Karte (Verlauf, Live-Fortschritt).
  .map((k, i, alle) => (alle.findIndex((x) => x.id === k.id) === i ? k : { ...k, id: `${k.id}-${i + 1}` }));

export function bereinigeAutomatisierung(e: unknown): AutomatisierungDaten {
  const x = (e ?? {}) as Record<string, unknown>;
  const und = (x.und ?? {}) as Record<string, unknown>;
  const r = Math.trunc(Number(x.reihenfolge));
  return {
    name: text(x.name, AUTOMATISIERUNG_GRENZEN.name),
    beschreibung: text(x.beschreibung, AUTOMATISIERUNG_GRENZEN.text),
    reihenfolge: Number.isFinite(r) ? Math.max(REIHENFOLGE.min, Math.min(REIHENFOLGE.max, r)) : REIHENFOLGE.eigen,
    wenn: bereinigeWenn(x.wenn),
    und: { modus: und.modus === 'eine' ? 'eine' : 'alle', karten: (Array.isArray(und.karten) ? und.karten : []).slice(0, AUTOMATISIERUNG_GRENZEN.bedingungen).map((k) => bereinigeUnd(k)).filter((k): k is UndKarte => !!k) },
    dann: dannListe(x.dann),
    sonst: dannListe(x.sonst),
  };
}

/* ---------- Prüfen ---------- */

const feldIn = (typ: Mappentyp | null, key: string): Feld | undefined => typ?.felder.find((f) => f.key === key);

function empfaengerProblem(e: Empfaenger, typ: Mappentyp | null, k: Kontextdaten): string | null {
  if (e.art === 'person') { const b = k.benutzer.find((x) => x.id === e.id); return !b ? 'Diese Person gibt es nicht mehr.' : b.aktiv === false ? `${b.name} ist deaktiviert.` : null; }
  if (e.art === 'rolle') return k.rollen.some((x) => x.id === e.id) ? null : 'Diese Rolle gibt es nicht mehr.';
  const f = feldIn(typ, e.feld);
  if (!f) return `Das Feld „${e.feld}“ gibt es im Mappentyp nicht (mehr).`;
  const benutzerTyp = k.typen.find((t) => t.system === 'benutzer');
  return f.typ === 'referenz' && (!f.zielTyp || f.zielTyp === benutzerTyp?.id) ? null : `„${f.label}“ verweist nicht auf Benutzer.`;
}

function undProbleme(u: UndKarte, typ: Mappentyp | null, k: Kontextdaten): string[] {
  if (u.art === 'gruppe') return u.karten.flatMap((x) => undProbleme(x, typ, k));
  if (u.art === 'ansicht') return k.sichten.some((s) => s.id === u.sicht) ? [] : ['Die Ansicht der Bedingung gibt es nicht mehr.'];
  if (u.art === 'favorit') { const p = empfaengerProblem(u.von, typ, k); return p ? [p] : []; }
  if (!typ) return ['Bedingungen auf Felder brauchen einen Mappentyp in der Wenn-Karte.'];
  const p = bedingungsProblem(u.bedingung, [typ]);
  return p ? [p] : [];
}

/** Was nicht (mehr) passt – leer, wenn die Automatisierung laufen kann. */
export function automatisierungsProbleme(a: AutomatisierungDaten, k: Kontextdaten): string[] {
  const p: string[] = [];
  if (!a.name) p.push('Bitte einen Namen angeben.');
  const w = a.wenn;
  const typ = kontextTyp(w, k.typen);
  if (w.art === 'datum') {
    if (!typ) p.push('Den Mappentyp der Wenn-Karte gibt es nicht (mehr).');
    else if (feldIn(typ, w.feld)?.typ !== 'datum') p.push(`Das Datumsfeld „${w.feld}“ gibt es im Mappentyp „${typ.name}“ nicht (mehr).`);
  } else if (w.typ && !typ) p.push('Den Mappentyp der Wenn-Karte gibt es nicht (mehr).');
  else if (w.felder?.length && typ) for (const f of w.felder) if (!feldIn(typ, f)) p.push(`Das Feld „${f}“ gibt es im Mappentyp „${typ.name}“ nicht (mehr).`);
  for (const u of a.und.karten) p.push(...undProbleme(u, typ, k));
  if (!a.dann.length) p.push('Bitte mindestens eine Dann-Karte hinzufügen.');
  for (const d of [...a.dann, ...a.sonst]) {
    if (d.art === 'feld') {
      if (!typ) p.push('„Feld ändern“ braucht einen Mappentyp in der Wenn-Karte.');
      else if (!Object.keys(d.werte).length) p.push('„Feld ändern“: bitte mindestens ein Feld wählen.');
      else for (const key of Object.keys(d.werte)) {
        const f = feldIn(typ, key);
        if (!f) p.push(`„Feld ändern“: Das Feld „${key}“ gibt es im Mappentyp „${typ.name}“ nicht (mehr).`);
        else if (f.typ === 'passwort') p.push(`„Feld ändern“: Passwortfelder („${f.label}“) setzt keine Automatisierung.`);
      }
    }
    if (d.art === 'aufgabe') {
      if (!d.text) p.push('„Aufgabe“: bitte beschreiben, was zu tun ist.');
      if (!d.empfaenger.length) p.push('„Aufgabe“: bitte mindestens einen Empfänger wählen.');
      for (const e of d.empfaenger) { const x = empfaengerProblem(e, typ, k); if (x) p.push(`„Aufgabe“: ${x}`); }
    }
  }
  return [...new Set(p)];
}

/* ---------- Kurzform ---------- */

const NAMEN: Record<string, string> = {
  'mappe.angelegt': 'angelegt', 'mappe.geaendert': 'gespeichert', 'mappe.verknuepft': 'verknüpft', 'dokument.hochgeladen': 'Dokument hochgeladen',
  'mappe.notiz': 'Notiz hinzugefügt', 'mappe.geloescht': 'gelöscht', 'mappe.geloescht_verknuepft': 'mit verknüpften gelöscht',
  'mappe.endgueltig_geloescht': 'endgültig gelöscht', 'mappe.wiederhergestellt': 'wiederhergestellt', 'frist.erreicht': 'Frist erreicht',
};

/** „Wenn Vertrag gespeichert → Aufgabe an Verantwortlich“. */
export function kurzform(a: AutomatisierungDaten, k: Pick<Kontextdaten, 'typen' | 'benutzer' | 'rollen'>, ereignisName: (art: string) => string = (x) => NAMEN[x] ?? x): string {
  const typ = kontextTyp(a.wenn, k.typen);
  const w = a.wenn;
  const wenn = w.art === 'datum'
    ? `${typ?.name ?? '?'}: ${feldIn(typ, w.feld)?.label ?? w.feld} ${w.tage === 0 ? 'heute' : w.tage > 0 ? `in ${w.tage} ${w.tage === 1 ? 'Tag' : 'Tagen'}` : `vor ${-w.tage} ${w.tage === -1 ? 'Tag' : 'Tagen'}`}`
    : `${typ && EREIGNISKATALOG[w.art].gruppe !== 'benutzer' ? `${typ.name} ` : ''}${ereignisName(w.art)}`;
  const wer = (e: Empfaenger) => e.art === 'person' ? k.benutzer.find((b) => b.id === e.id)?.name ?? '?' : e.art === 'rolle' ? k.rollen.find((r) => r.id === e.id)?.name ?? '?' : feldIn(typ, e.feld)?.label ?? e.feld;
  const dann = a.dann.map((d) => d.art === 'stopp' ? 'danach keine weiteren'
    : d.art === 'feld' ? `${Object.keys(d.werte).map((x) => feldIn(typ, x)?.label ?? x).join(', ')} setzen`
      : `${d.als === 'aufgabe' ? 'Aufgabe' : 'Benachrichtigung'} an ${d.empfaenger.map(wer).join(', ') || '?'}`).join(', ');
  return `Wenn ${wenn}${a.und.karten.length ? ` und ${a.und.karten.length === 1 ? '1 Bedingung' : `${a.und.karten.length} Bedingungen`}` : ''} → ${dann || '…'}`;
}
