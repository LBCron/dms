/**
 * Löschkonzept aus dem DMS erzeugen (#469): Gliederung wie die Vorlage im Admin-Handbuch
 * (docs/handbuch/vorlagen/loeschkonzept.md, #389), Abschnitt 2 „Datenarten und Fristen“ aus den
 * Mappentypen, den Datenschutz-Einstellungen (#396) und dem Archivmodus (#212). Was das DMS nicht
 * wissen kann, bleibt als [eckige Klammer]. Nur Typen, Einstellungen und Fristen – nie Inhalte aus Mappen.
 * Reine Funktionen: der Server rendert daraus PDF und .docx, die Werkbank zeigt die Lücken.
 */
import { FRISTEN, type Archiv } from './archiv';
import type { Datenschutz } from './auskunft';
import { BELIEBIGER_TYP, type Feld, type Systemtyp } from './model';

export interface LoeschkonzeptTyp { id: string; name: string; felder: Feld[]; archiv?: Archiv | null; system?: Systemtyp | null }

export interface LoeschkonzeptQuelle {
  typen: LoeschkonzeptTyp[];
  datenschutz: Datenschutz;
  /** Aufbewahrung im Papierkorb in Tagen; 0 = kein Papierkorb. */
  papierkorbTage: number;
  /** Historie endgültig gelöschter Mappen in Tagen. */
  historieTage: number;
  /** Zeitplan der Sicherung; null = Sicherungen nicht eingerichtet. */
  sicherung: { aktiv: boolean; haeufigkeit: 'taeglich' | 'woechentlich'; aufbewahrung: { taeglich: number; woechentlich: number; monatlich: number } } | null;
  /** So lange liegen erzeugte Auskünfte bereit. */
  auskunftTage: number;
  /** Löschprotokoll (#470): Aufbewahrung in Jahren; fehlt = (noch) keins. */
  loeschprotokoll?: { jahre: number } | null;
  version: string;
  /** Stand als JJJJ-MM-TT. */
  stand: string;
  mandant: string;
}

/** Eine Zeile in Abschnitt 2. */
export interface Datenart {
  typId: string; typ: string;
  /** Warum die Zeile da ist: betrifft selbst eine Person, verweist auf eine, oder hat einen Zweck. */
  bezug: 'person' | 'verweis' | 'zweck';
  betroffene: string; zweck: string; frist: string; grund: string; stichtag: string; sperre: string; loeschweg: string;
}

/** Was fehlt und im DMS ergänzt werden kann (Werkbank → Datenschutz-Auskünfte bzw. Mappentypen). */
/** Ein Verweisfeld, über das ein Mappentyp Personendaten enthält (z. B. Konto → „Inhaber“ → Person, #664). */
export interface Personenverweis { feld: string; ziel: string }
/** Warum ein Mappentyp im Löschkonzept steht (#664). */
export interface Personenbezug { bezug: 'person' | 'verweis' | 'zweck'; verweise: Personenverweis[] }

/**
 * Was fehlt und im DMS ergänzt werden kann (Werkbank → Datenschutz-Auskünfte bzw. Mappentypen). Je Mappentyp
 * genau eine Lücke (#664) mit Grund und den fehlenden Angaben.
 */
export type Luecke =
  | { art: 'typ'; typId: string; typ: string; bezug: Personenbezug['bezug']; verweise: Personenverweis[]; fehlt: ('zweck' | 'frist')[]; text: string }
  | { art: 'verantwortlicher' | 'keine'; typId?: undefined; typ?: undefined; text: string }

export type Block =
  | { art: 'absatz'; text: string }
  | { art: 'punkte'; punkte: string[] }
  | { art: 'tabelle'; kopf: string[]; zeilen: string[][]; /** relative Spaltenbreiten */ breiten: number[] }
  | { art: 'hinweis'; titel: string; punkte: string[] };
export interface Abschnitt { titel: string; bloecke: Block[] }
export interface Loeschkonzept { titel: string; untertitel: string; stand: string; vorbemerkung: string; abschnitte: Abschnitt[]; luecken: Luecke[]; datenarten: Datenart[] }

export const LOESCHKONZEPT_TITEL = 'Löschkonzept: Aufbewahren, Sperren und Löschen mit Ablago';
export const FEHLT = (was: string) => `[${was}]`;

const jahre = (n: number) => `${n} ${n === 1 ? 'Jahr' : 'Jahre'}`;
const tage = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;
const datum = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');
const ohneSystem = (t: LoeschkonzeptTyp) => t.system !== 'benutzer' && t.system !== 'rolle';

/** Löschweg nach dem Löschen: Papierkorb mit Frist oder sofort endgültig. */
export function korbText(papierkorbTage: number) {
  return papierkorbTage > 0 ? `Papierkorb → endgültig nach ${tage(papierkorbTage)}` : 'sofort endgültig (kein Papierkorb)';
}

/**
 * Personenbezug je Mappentyp (#664): angekreuzt („betrifft eine Person“), über ein Verweisfeld auf einen
 * angekreuzten Typ, oder nur mit Zweck. Typen ohne Bezug fehlen in der Karte. Benutzer und Rollen zählen nicht.
 */
export function personenbezug(typen: LoeschkonzeptTyp[], datenschutz: Pick<Datenschutz, 'typen'>): Map<string, Personenbezug> {
  const eigene = typen.filter(ohneSystem);
  const name = new Map(typen.map((t) => [t.id, t.name] as const));
  const ds = (id: string) => datenschutz.typen[id] ?? { person: false, zweck: '' };
  const personen = new Set(eigene.filter((t) => ds(t.id).person).map((t) => t.id));
  const karte = new Map<string, Personenbezug>();
  for (const t of eigene) {
    const verweise = t.felder
      .filter((f) => f.typ === 'referenz' && f.zielTyp && (personen.has(f.zielTyp) || (f.zielTyp === BELIEBIGER_TYP && personen.size > 0)) && f.zielTyp !== t.id)
      .map((f) => ({ feld: f.label, ziel: f.zielTyp === BELIEBIGER_TYP ? 'zugeordnete Personen' : name.get(f.zielTyp!) ?? f.zielTyp! }));
    const bezug: Personenbezug['bezug'] | null = personen.has(t.id) ? 'person' : verweise.length ? 'verweis' : ds(t.id).zweck.trim() ? 'zweck' : null;
    if (bezug) karte.set(t.id, { bezug, verweise });
  }
  return karte;
}

/** „über „Inhaber“ auf Person“, mehrere mit „und“ (#664). */
export function verweisText(v: Personenverweis[]) {
  const teile = v.map((x) => `über „${x.feld}“ auf ${x.ziel}`);
  return teile.length <= 1 ? teile.join('') : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/** Grund, warum ein Mappentyp Personendaten enthält – als Satzteil nach „weil …“. */
export function grundText(b: Personenbezug) {
  return b.bezug === 'person' ? 'du ihn als „betrifft eine Person“ markiert hast'
    : b.bezug === 'verweis' ? `er ${verweisText(b.verweise)} verweist`
    : 'du einen Zweck für ihn hinterlegt hast';
}

/**
 * Datenarten mit Personenbezug: Mappentypen, die eine Person betreffen, die auf einen solchen
 * Mappentyp verweisen (z. B. Rechnung → Kunde) oder für die ein Zweck hinterlegt ist. Benutzer
 * und Rollen stehen in Abschnitt 7. Reihenfolge: Personen zuerst, dann nach Name.
 */
export function datenarten(q: Pick<LoeschkonzeptQuelle, 'typen' | 'datenschutz' | 'papierkorbTage'>): Datenart[] {
  const typen = q.typen.filter(ohneSystem);
  const ds = (id: string) => q.datenschutz.typen[id] ?? { person: false, zweck: '' };
  const karte = personenbezug(q.typen, q.datenschutz);
  const zeilen: Datenart[] = [];
  for (const t of typen) {
    const zweck = ds(t.id).zweck.trim();
    const pb = karte.get(t.id);
    if (!pb) continue;
    const bezug = pb.bezug;
    const betroffene = bezug === 'person' ? `${t.name} (die Person selbst)`
      : bezug === 'verweis' ? pb.verweise.map((v) => `${v.ziel} (über „${v.feld}“)`).join(', ')
      : FEHLT('Betroffene');
    const a = t.archiv ?? null;
    const vorschlag = a ? FRISTEN.find((x) => x.jahre === a.jahre)?.text : undefined;
    const stichtag = a ? `${a.stichtag ? `„${t.felder.find((f) => f.key === a.stichtag)?.label ?? a.stichtag}“` : 'Anlagedatum der Mappe'}, ab Ende des Kalenderjahres` : FEHLT('Beginn der Frist');
    zeilen.push({
      typId: t.id, typ: t.name, bezug, betroffene,
      zweck: zweck || FEHLT('Zweck'),
      frist: a ? jahre(a.jahre) : FEHLT('Frist'),
      grund: FEHLT(vorschlag ? `Grund, z. B. ${vorschlag}` : 'Grund der Frist'),
      stichtag,
      sperre: a ? 'Archivmodus' : 'keine',
      loeschweg: a ? `„Aufbewahrung abgelaufen“ → ${korbText(q.papierkorbTage)}` : `${FEHLT('Ansicht „…“')}, löschen von Hand → ${korbText(q.papierkorbTage)}`,
    });
  }
  const rang = { person: 0, verweis: 1, zweck: 2 } as const;
  return zeilen.sort((x, y) => rang[x.bezug] - rang[y.bezug] || x.typ.localeCompare(y.typ, 'de'));
}

/** Lücken, die das DMS kennt: Datenart ohne Zweck oder Frist, kein Verantwortlicher, gar keine Datenart. */
export function luecken(q: Pick<LoeschkonzeptQuelle, 'typen' | 'datenschutz' | 'papierkorbTage'>, arten = datenarten(q)): Luecke[] {
  const l: Luecke[] = [];
  if (!q.datenschutz.verantwortlicher.trim()) l.push({ art: 'verantwortlicher', text: 'Kein Verantwortlicher hinterlegt – bitte unter Datenschutz-Auskünfte → Einstellungen ergänzen.' });
  if (!arten.length) l.push({ art: 'keine', text: 'Kein Mappentyp betrifft eine Person – lege unter „Personendaten in Mappentypen“ fest, welche Mappentypen Personen betreffen.' });
  const bezug = personenbezug(q.typen, q.datenschutz);
  for (const a of arten) {
    const fehlt: ('zweck' | 'frist')[] = [];
    if (a.zweck === FEHLT('Zweck')) fehlt.push('zweck');
    if (a.frist === FEHLT('Frist')) fehlt.push('frist');
    if (!fehlt.length) continue;
    const b = bezug.get(a.typId) ?? { bezug: a.bezug, verweise: [] };
    const was = fehlt.map((f) => (f === 'zweck' ? 'Zweck' : 'Aufbewahrungsfrist')).join(' · ');
    l.push({ art: 'typ', typId: a.typId, typ: a.typ, bezug: b.bezug, verweise: b.verweise, fehlt,
      text: `${a.typ} – enthält Personendaten, weil ${grundText(b)}. Es fehlen: ${was}.` });
  }
  return l;
}

/** Das ganze Löschkonzept: Abschnitte 1–9 wie die Vorlage, vorbelegt mit dem, was das DMS weiß. */
export function loeschkonzept(q: LoeschkonzeptQuelle): Loeschkonzept {
  const arten = datenarten(q);
  const fehlt = luecken(q, arten);
  const verantwortlicher = q.datenschutz.verantwortlicher.trim().replace(/\n+/g, ', ');
  const ohne = q.typen.filter(ohneSystem).filter((t) => !arten.some((a) => a.typId === t.id)).map((t) => t.name).sort((a, b) => a.localeCompare(b, 'de'));
  const korb = q.papierkorbTage > 0;
  const s = q.sicherung;
  const sicherungText = !s ? 'keine automatischen Sicherungen eingerichtet' : !s.aktiv ? 'automatische Sicherung ausgeschaltet' : [
    s.haeufigkeit === 'taeglich' && s.aufbewahrung.taeglich ? `${s.aufbewahrung.taeglich} tägliche` : '',
    s.aufbewahrung.woechentlich ? `${s.aufbewahrung.woechentlich} wöchentliche` : '',
    s.aufbewahrung.monatlich ? `${s.aufbewahrung.monatlich} monatliche` : '',
  ].filter(Boolean).join(', ') || 'nur die jeweils letzte';

  const abschnitte: Abschnitt[] = [
    { titel: '1. Allgemeines', bloecke: [{ art: 'tabelle', breiten: [1, 2.4], kopf: ['', ''], zeilen: [
      ['Verantwortlicher', verantwortlicher || FEHLT('Name, Anschrift – wie unter Werkbank → Datenschutz-Auskünfte-Auskünfte → Einstellungen')],
      ['Ansprechpartner für Datenschutz', FEHLT('Name, E-Mail – ggf. Datenschutzbeauftragter')],
      ['Verantwortlich für Löschungen', FEHLT('Name')],
      ['Vertretung', FEHLT('Name')],
      ['Eingesetzte Software', `Ablago (Open Source, https://github.com/motom001/dms), Version ${q.version}, selbst betrieben auf ${FEHLT('Gerät / Anbieter')}`],
      ['Geltungsbereich', arten.length ? `Datenarten aus Abschnitt 2: ${arten.map((a) => a.typ).join(', ')}` : FEHLT('Welche Daten: z. B. Mieter und Mietverhältnisse, Kunden, Lieferanten, Beschäftigte …')],
      ['Gültig ab', FEHLT('Datum')],
    ] }] },
    { titel: '2. Datenarten und Fristen', bloecke: [
      { art: 'absatz', text: `Jeder Mappentyp in Ablago ist eine Datenart. Die Tabelle enthält die Mappentypen, die eine Person betreffen, auf eine solche verweisen oder für die ein Zweck hinterlegt ist (Stand ${datum(q.stand)}). Zweck und „betrifft eine Person“ stehen unter Werkbank → Löschkonzept → Personendaten in Mappentypen, Frist und Stichtag im Archivmodus unter Werkbank → Mappentypen.` },
      { art: 'tabelle', breiten: [1.1, 1.3, 1.3, 0.6, 1.1, 1.2, 0.95, 1.4], kopf: ['Datenart (Mappentyp)', 'Betroffene', 'Zweck', 'Frist', 'Grund der Frist', 'Beginn der Frist (Stichtag)', 'Sperre in Ablago', 'Löschweg'],
        zeilen: arten.length ? arten.map((a) => [a.typ, a.betroffene, a.zweck, a.frist, a.grund, a.stichtag, a.sperre, a.loeschweg])
          : [[FEHLT('Mappentyp'), FEHLT('Betroffene'), FEHLT('Zweck'), FEHLT('Frist'), FEHLT('Grund'), FEHLT('Stichtag'), 'keine', FEHLT('Löschweg')]] },
      ...(fehlt.length ? [{ art: 'hinweis' as const, titel: 'Bitte ergänzen', punkte: fehlt.map((x) => x.text) }] : []),
      ...(ohne.length ? [{ art: 'absatz' as const, text: `Ohne Personenbezug (nicht in der Tabelle): ${ohne.join(', ')}. Betrifft einer davon doch Personen, markiere ihn unter Werkbank → Löschkonzept → Personendaten in Mappentypen und erzeuge das Löschkonzept neu.` }] : []),
      { art: 'absatz', text: 'Sperre in Ablago:' },
      { art: 'punkte', punkte: [
        'Archivmodus (Werkbank → Mappentypen → Archivmodus): Mappen und Dokumente dieses Mappentyps lassen sich bis zum Ende der Aufbewahrungsfrist nicht löschen – auch nicht von Administratoren, über den Papierkorb oder die Schnittstelle. Dokumente ändern sich nur als neue Version. Die Frist läuft bis zum 31.12. des Stichtagsjahres plus die Jahre.',
        'Keine: Die Mappen lassen sich jederzeit löschen. Wer das darf, regeln die Berechtigungen (Abschnitt 5).',
      ] },
      { art: 'absatz', text: 'Löschweg:' },
      { art: 'punkte', punkte: [
        'Aufbewahrung abgelaufen: Nach Fristende stehen die Mappen unter Werkbank → Benutzer und Sicherheit → Aufbewahrung abgelaufen. Ablago löscht nie von selbst.',
        `Ansicht: Für Fristen ohne Archivmodus zeigt die Ansicht ${FEHLT('Name')} die fälligen Mappen nach dem Feld ${FEHLT('Datumsfeld')}.`,
      ] },
    ] },
    { titel: '3. Regelmäßiges Löschen', bloecke: [{ art: 'punkte', punkte: [
      `${FEHLT('Wer')} geht ${FEHLT('jährlich, z. B. im Januar')} Werkbank → Aufbewahrung abgelaufen und die Ansichten aus Abschnitt 2 durch und löscht, was weg darf.${q.loeschprotokoll ? ' Ablago hält jede Löschung im Löschprotokoll fest (Abschnitt 8).' : ` ${FEHLT('Wer')} hält fest, wann das geschah (Abschnitt 8).`}`,
      korb ? `Gelöschte Mappen und Dokumente kommen in den Papierkorb (Werkbank → Papierkorb, Aufbewahrung ${tage(q.papierkorbTage)}). Danach löscht Ablago sie mit ihren Dateien und dem Volltext endgültig.`
        : 'Der Papierkorb ist ausgeschaltet: Gelöschte Mappen und Dokumente löscht Ablago sofort endgültig mit ihren Dateien und dem Volltext.',
      `Die Historie endgültig gelöschter Mappen bleibt ${tage(q.historieTage)} (Werkbank → Papierkorb), damit sich nachvollziehen lässt, was mit ihnen geschah. Die Historie lebender Mappen und von Mappen im Archivmodus bleibt immer.`,
    ] }] },
    { titel: '4. Sperren auf Verlangen', bloecke: [
      { art: 'absatz', text: 'Verlangt eine Person die Löschung, aber eine Aufbewahrungsfrist steht entgegen (Art. 17 Abs. 3 DSGVO), werden ihre Daten bis Fristende gesperrt (Art. 18 DSGVO):' },
      { art: 'punkte', punkte: [
        'Mappen im Archivmodus sind gegen Löschen gesperrt (Abschnitt 2).',
        `Zugriff: Der Mappentyp hat das Ja/Nein-Feld ${FEHLT('Gesperrt')}. Eine Regel in den Berechtigungen erlaubt bei „Gesperrt ist ja“ Lesen und Bearbeiten nur der Rolle ${FEHLT('Datenschutz')}. Administratoren sehen weiterhin alles.`,
        'An der Mappe steht eine Notiz mit Datum der Anfrage und dem Ende der Sperre.',
        'Nach Fristende wird gelöscht wie in Abschnitt 3.',
      ] },
    ] },
    { titel: '5. Wer löschen darf', bloecke: [{ art: 'punkte', punkte: [
      `Löschen dürfen ${FEHLT('z. B. nur die Rolle … / alle, die die Mappe bearbeiten dürfen')} (Werkbank → Mappentypen → Berechtigungen, Recht „Löschen“).`,
      'Endgültig löschen und den Papierkorb leeren: jeder Benutzer für das, was er selbst gelöscht hat; Administratoren für alles (Werkbank → Papierkorb).',
      `Administratoren: ${FEHLT('Namen')}. Für sie gelten die Berechtigungen nicht.`,
    ] }] },
    { titel: '6. Kopien außerhalb der Ablage', bloecke: [
      { art: 'absatz', text: 'Gelöschte Daten können noch an diesen Stellen liegen; sie fallen so weg:' },
      { art: 'tabelle', breiten: [1.4, 1.2, 1.6], kopf: ['Wo', 'Wie lange', 'Wie gelöscht'], zeilen: [
        ['Automatische Sicherungen (Werkbank → Sicherung)', sicherungText, 'Ablago entfernt ältere Sicherungen nach jeder automatischen Sicherung'],
        ['Von Hand angelegte Sicherungen', 'bis zum Löschen', `${FEHLT('Wer')} löscht sie ${FEHLT('wann')}`],
        ['Kopie der Sicherungen außer Haus', FEHLT('z. B. die letzten 4 Wochen'), FEHLT('Wer, wie')],
        ['Vollexporte (export/ im Sicherungsordner)', 'bis zum Löschen', `Werkbank → Vollexport → Löschen, ${FEHLT('spätestens nach …')}`],
        ['Persönliche Exporte der Benutzer', 'bis zum nächsten Export des Benutzers', FEHLT('Hinweis an die Benutzer')],
        ['Bereitliegende Auskünfte', `höchstens ${tage(q.auskunftTage).replace('Tagen', 'Tage')}, mit Abruf-Link bis dieser abläuft`, 'Ablago löscht sie selbst'],
        ['Protokoll (Werkbank → Protokoll, Container-Logs)', `24 Stunden in der Werkbank; Container-Logs ${FEHLT('nach Einstellung von Docker')}`, FEHLT('ggf. Log-Rotation einstellen')],
        ['Heruntergeladene Dateien, Ausdrucke, E-Mails', FEHLT('Regel'), FEHLT('Regel')],
      ] },
    ] },
    { titel: '7. Benutzerkonten', bloecke: [{ art: 'punkte', punkte: [
      'Konten, die schon benutzt wurden, werden deaktiviert, nicht gelöscht (Werkbank → Benutzer → Zugang sperren). Der Name bleibt bei „angelegt von“ und in der Historie stehen.',
      'Einladungen, die nie angenommen wurden, werden gelöscht.',
      `${FEHLT('Wer')} deaktiviert Konten von Personen, die gehen, ${FEHLT('am letzten Arbeitstag')}.`,
    ] }] },
    { titel: '8. Nachweis', bloecke: [{ art: 'punkte', punkte: q.loeschprotokoll ? [
      `Ablago führt ein Löschprotokoll (Werkbank → Löschkonzept → Löschprotokoll): je gelöschter Mappe Mappentyp, Id und Nummer, wann, von wem, warum und in welchem Vorgang; je gelöschtem Dokument die Prüfsumme (SHA-256), Größe, Dateityp und Seitenzahl – ohne Titel, Feldwerte und Dateinamen. Es lässt sich nicht ändern, wird als PDF oder CSV ausgegeben und nach ${q.loeschprotokoll.jahre === 1 ? 'einem Jahr' : `${q.loeschprotokoll.jahre} Jahren`} automatisch gekürzt.`,
      'Bei Löschungen auf Verlangen wählt, wer löscht, den Grund „Auf Verlangen der betroffenen Person“.',
      'Auskünfte nach Art. 15 DSGVO stehen mit Nachweis in der Historie der Person (Werkbank → Datenschutz-Auskünfte).',
    ] : [
      `Löschungen auf Verlangen und das regelmäßige Löschen hält ${FEHLT('Wer')} in ${FEHLT('einer Mappe „Datenschutzanfragen“ / einer Liste')} fest: Datum, Anlass, welche Datenarten – ohne die gelöschten Daten selbst.`,
      'Auskünfte nach Art. 15 DSGVO stehen mit Nachweis in der Historie der Person (Werkbank → Datenschutz-Auskünfte).',
    ] }] },
    { titel: '9. Änderungen dieses Löschkonzepts', bloecke: [{ art: 'tabelle', breiten: [1, 2.4, 1.2], kopf: ['Datum', 'Was geändert', 'Wer'], zeilen: [
      [datum(q.stand), `aus Ablago erzeugt (Version ${q.version})`, FEHLT('Name')],
      [FEHLT('Datum'), FEHLT('erste Version'), FEHLT('Name')],
    ] }] },
  ];
  return {
    titel: LOESCHKONZEPT_TITEL,
    untertitel: q.mandant || verantwortlicher || '',
    stand: `Stand ${datum(q.stand)} · aus Ablago ${q.version} erzeugt`,
    vorbemerkung: 'Erzeugt aus den Mappentypen und Einstellungen deines Ablago. Alles in [eckigen Klammern] ersetzt du durch deine Angaben oder streichst es. Das Dokument ist ein Ausgangspunkt, keine Rechtsberatung – stimme Fristen und Gründe mit deiner Steuerberatung bzw. deinem Datenschutzbeauftragten ab. Erzeuge es neu, wenn sich Mappentypen oder Fristen ändern, und halte die Änderungstabelle am Ende aktuell.',
    abschnitte, luecken: fehlt, datenarten: arten,
  };
}
