/**
 * Inhaltlicher Vergleich eines Mappentyps mit dem Stand, den ein Paket mitgebracht hat (#653).
 * Statt „irgendwann nach der Installation gespeichert“ zählt nur, was sich wirklich unterscheidet:
 * Felder (hinzugefügt, entfernt, geändert), Register, Beschreibung, Titel.
 */
import type { Feld, Mappentyp } from './model';

/** Was vom Mappentyp verglichen wird – ohne Ids anderer Typen (Verweisziele bleiben als Id, die bleibt im selben DMS gleich). */
export interface TypBild {
  name: string; beschreibung: string; titelVorlage: string;
  felder: Array<{ key: string; label: string; werte: Record<string, unknown> }>;
  register: Array<{ key: string; name: string; werte: Record<string, unknown> }>;
}

/** Eigenschaften eines Felds, die eine inhaltliche Änderung sind (Name extra, damit „umbenannt“ lesbar wird). */
const FELD = ['typ', 'pflicht', 'eindeutig', 'hilfe', 'standard', 'minLen', 'maxLen', 'muster', 'min', 'max', 'nachkomma', 'waehrung', 'optionen', 'mehrfach', 'zielTyp', 'verweisart', 'frist', 'auswahlFilter', 'erkennung', 'format', 'landFeld'] as const;
const NAMEN: Record<string, string> = {
  typ: 'Art', pflicht: 'Pflicht', eindeutig: 'eindeutig', hilfe: 'Hilfetext', standard: 'Vorgabe', minLen: 'Mindestlänge', maxLen: 'Höchstlänge', muster: 'Muster',
  min: 'Untergrenze', max: 'Obergrenze', nachkomma: 'Nachkommastellen', waehrung: 'Währung', optionen: 'Auswahlwerte', mehrfach: 'Mehrfachauswahl', zielTyp: 'Ziel',
  verweisart: 'Verweisart', frist: 'Frist', auswahlFilter: 'Auswahlfilter', erkennung: 'Erkennung', format: 'Format', landFeld: 'Land-Feld',
  name: 'Name', art: 'Art', felder: 'Felder', quellen: 'Quellen',
};
/** Leere Werte (undefined, null, false, '', []) gelten als „nicht gesetzt“ – Speichern ohne Änderung zählt nicht. */
const leer = (v: unknown) => v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && !v.length);
const sauber = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => !leer(v)).sort(([a], [b]) => a.localeCompare(b)));
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function typBild(t: Mappentyp): TypBild {
  const feld = (f: Feld) => ({ key: f.key, label: f.label, werte: sauber(Object.fromEntries(FELD.map((k) => [k, (f as unknown as Record<string, unknown>)[k]]))) });
  return {
    name: t.name, beschreibung: t.beschreibung ?? '', titelVorlage: t.titelVorlage ?? '',
    felder: t.felder.filter((f) => !f.system).map(feld),
    register: t.register.map((r) => ({ key: r.key, name: r.name, werte: sauber({ art: r.art, felder: r.felder, quellen: r.quellen }) })),
  };
}

export interface TypUnterschiede {
  /** Kurzfassung, z. B. „+2 Felder · 1 Feld geändert“. */
  kurz: string;
  /** Je Unterschied ein lesbarer Satz. */
  liste: string[];
}

/** Unterschiede vom Paketstand zum heutigen Stand; null = inhaltlich gleich. */
export function typUnterschiede(alt: TypBild, neu: TypBild): TypUnterschiede | null {
  const liste: string[] = [];
  let plus = 0, minus = 0, anders = 0, register = 0;
  const altF = new Map(alt.felder.map((f) => [f.key, f] as const));
  const neuF = new Map(neu.felder.map((f) => [f.key, f] as const));
  for (const f of neu.felder) if (!altF.has(f.key)) { plus++; liste.push(`Feld „${f.label}“ hinzugefügt`); }
  for (const f of alt.felder) if (!neuF.has(f.key)) { minus++; liste.push(`Feld „${f.label}“ entfernt`); }
  for (const f of neu.felder) {
    const a = altF.get(f.key);
    if (!a) continue;
    const was: string[] = [];
    if (a.label !== f.label) was.push(`umbenannt von „${a.label}“`);
    for (const k of new Set([...Object.keys(a.werte), ...Object.keys(f.werte)])) if (!gleich(a.werte[k], f.werte[k])) was.push(NAMEN[k] ?? k);
    if (was.length) { anders++; liste.push(`Feld „${f.label}“: ${was.join(', ')}`); }
  }
  const altR = new Map(alt.register.map((r) => [r.key, r] as const));
  const neuR = new Map(neu.register.map((r) => [r.key, r] as const));
  for (const r of neu.register) {
    const a = altR.get(r.key);
    if (!a) { register++; liste.push(`Register „${r.name}“ hinzugefügt`); continue; }
    const was = [...(a.name !== r.name ? [`umbenannt von „${a.name}“`] : []), ...[...new Set([...Object.keys(a.werte), ...Object.keys(r.werte)])].filter((k) => !gleich(a.werte[k], r.werte[k])).map((k) => NAMEN[k] ?? k)];
    if (was.length) { register++; liste.push(`Register „${r.name}“: ${was.join(', ')}`); }
  }
  for (const r of alt.register) if (!neuR.has(r.key)) { register++; liste.push(`Register „${r.name}“ entfernt`); }
  if (alt.name !== neu.name) liste.push(`Name „${alt.name}“ → „${neu.name}“`);
  if (alt.beschreibung !== neu.beschreibung) liste.push('Beschreibung geändert');
  if (alt.titelVorlage !== neu.titelVorlage) liste.push('Titel geändert');
  if (!liste.length) return null;
  const teile = [
    plus ? `+${plus} ${plus === 1 ? 'Feld' : 'Felder'}` : '',
    minus ? `−${minus} ${minus === 1 ? 'Feld' : 'Felder'}` : '',
    anders ? `${anders} ${anders === 1 ? 'Feld' : 'Felder'} geändert` : '',
    register ? `${register} ${register === 1 ? 'Register' : 'Register'} geändert` : '',
  ].filter(Boolean);
  return { kurz: teile.length ? teile.join(' · ') : 'Angaben geändert', liste };
}
