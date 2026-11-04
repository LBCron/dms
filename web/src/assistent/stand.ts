import { useSyncExternalStore } from 'react';
import type { DateiFehler, Einrichtungsplan, PlanDatenbank, Planprobleme, PlanPaket, PlanVerbindung, Sammelschritt } from '../../../shared/src/einrichtungsplan';
import type { AblaufErgebnis } from '../../../shared/src/pakete';
import type { PaketWahl } from '../werkbank/PaketAblauf';
import { t } from '../sprache';

/**
 * Was der Einrichtungsassistent sammelt (#804), bevor „Jetzt einrichten“ etwas anlegt. Der Stand liegt im Speicher
 * und – ohne Passwörter und ohne Einstellungen der Pakete – in sessionStorage, damit Neuladen nichts verliert. Ein
 * Abbruch vor „Jetzt einrichten“ hinterlässt so keine halbe Einrichtung: Angelegt ist bis dahin nichts.
 *
 * Regel (#803): Übernommen wird nur, was sichtbar im Formular steht. Leer gelassene optionale Felder bleiben leer,
 * es gibt keine versteckten Vorgaben.
 */

export type Ansicht = Sammelschritt | 'zusammenfassung';
export interface MailSammlung { aktiv: boolean; host: string; port: number; verbindung: PlanVerbindung; benutzer: string; absender: string; selbstsigniert: boolean; /** Im Formular ein Passwort eingegeben (der Wert selbst nur im Speicher). */ mitPasswort: boolean }

/** Ausführen bei „Jetzt einrichten“: in dieser Reihenfolge, jede Stufe einzeln wiederholbar. */
export const STUFEN = ['ablage', 'schluessel', 'adresse', 'region', 'mail', 'benutzer', 'beispiele', 'pakete'] as const;
export type Stufe = (typeof STUFEN)[number];
export interface StufeStand { zustand: 'wartet' | 'laeuft' | 'fertig' | 'ausgelassen' | 'fehler'; meldung?: string }
export interface Lauf {
  stufen: Record<Stufe, StufeStand>;
  laeuft: boolean;
  /** Einladungslink des ersten Benutzers, wenn keine Mail verschickt wurde. */
  einladung?: { name: string; link: string | null; mailVerschickt: boolean };
  pakete?: AblaufErgebnis;
  /** Alles durch: Abschlussseite mit Notfallblatt. */
  fertig: boolean;
  /** Ohne gespeicherten Stand neu geöffnet (anderer Browser): nur noch Schlüssel und Notfallblatt. */
  unterbrochen?: boolean;
}

export interface Sammlung {
  ablage: string;
  administrator: { name: string; email: string };
  benutzer: { name: string; email: string; aufgabenOhneEmpfaenger: boolean };
  /** Pakete: gesammelte Antworten; null = keine bzw. übersprungen. */
  pakete: PaketWahl | null;
  /** Aus einer Datei, noch nicht bestätigt (#806). */
  paketeVorgabe: PlanPaket[] | null;
  optional: { adresse: string; bundesland: string; beispiele: boolean; mail: MailSammlung | null };
  /** Schritte, die schon einmal mit „Weiter“ verlassen wurden. */
  besucht: Ansicht[];
  ansicht: Ansicht;
  /** Nach „Ändern“ oder dem Laden einer Datei: „Weiter“ springt zum nächsten Schritt, der nicht passt, sonst zur Zusammenfassung. */
  zurZusammenfassung: boolean;
  probleme: Planprobleme;
  /** Aus der Datei: Verweise statt Passwörtern (bleiben beim Speichern erhalten) und die Datenbank. */
  verweise: { administrator?: string; mail?: string; datenbank?: string };
  datenbank: PlanDatenbank | null;
  /** Hinweise beim Laden, z. B. eine andere Datenbank in der Datei. */
  hinweise: string[];
  /** Datei geladen, aber erst nach der Datenbank geprüft (Einrichtungsmodus). */
  pruefungOffen: boolean;
}

export interface Assistentenstand {
  /** Neu einrichten gewählt (sonst Wahl Neu/Sicherung). */
  neu: boolean;
  sammlung: Sammlung;
  lauf: Lauf | null;
  /** Ein Schritt, der während des Laufs geändert wird (nach einem Fehler). */
  aendern: Ansicht | null;
  dateiFehler: DateiFehler[];
}

/** Nur im Speicher – nie in sessionStorage. */
export const geheim: { administrator: string; mail: string; paketEinstellungen: PaketWahl['eingabe']['einstellungen'] | undefined } = { administrator: '', mail: '', paketEinstellungen: undefined };

export const leereSammlung = (): Sammlung => ({
  ablage: '', administrator: { name: '', email: '' }, benutzer: { name: '', email: '', aufgabenOhneEmpfaenger: true },
  pakete: null, paketeVorgabe: null,
  // Vorschlag, sichtbar im Feld: die Adresse, unter der Ablago gerade aufgerufen wird (#803).
  optional: { adresse: typeof location === 'undefined' ? '' : location.origin, bundesland: '', beispiele: false, mail: null },
  besucht: [], ansicht: 'ablage', zurZusammenfassung: false, probleme: {}, verweise: {}, datenbank: null, hinweise: [], pruefungOffen: false,
});
const leer = (): Assistentenstand => ({ neu: false, sammlung: leereSammlung(), lauf: null, aendern: null, dateiFehler: [] });

const SPEICHER = 'dms:assistent';
function lies(): Assistentenstand {
  try {
    const x = JSON.parse(sessionStorage.getItem(SPEICHER) ?? 'null') as Assistentenstand | null;
    if (x && x.sammlung) {
      // Neu geladen, während eine Stufe lief: Sie gilt als unterbrochen und lässt sich erneut versuchen.
      const lauf = x.lauf ? { ...x.lauf, laeuft: false, stufen: Object.fromEntries(Object.entries(x.lauf.stufen).map(([k, v]) => [k, v.zustand === 'laeuft' ? { zustand: 'fehler', meldung: t('einrichtung.lauf.neugeladen') } : v])) as Lauf['stufen'] } : null;
      return { ...leer(), ...x, sammlung: { ...leereSammlung(), ...x.sammlung }, lauf };
    }
  } catch { /* privates Fenster o. Ä. */ }
  return leer();
}
let zustand: Assistentenstand = lies();
const hoerer = new Set<() => void>();

function speichere() {
  try {
    // Einstellungen der Pakete können Geheimnisse enthalten (Art „geheim“) – sie bleiben nur im Speicher.
    const s = zustand.sammlung;
    const ohne: Assistentenstand = s.pakete ? { ...zustand, sammlung: { ...s, pakete: { ...s.pakete, eingabe: { ...s.pakete.eingabe, einstellungen: undefined } } } } : zustand;
    sessionStorage.setItem(SPEICHER, JSON.stringify(ohne));
  } catch { /* egal */ }
}

export function setzeStand(f: (s: Assistentenstand) => Assistentenstand) {
  zustand = f(zustand);
  speichere();
  for (const h of hoerer) h();
}
export const setzeSammlung = (f: (s: Sammlung) => Sammlung) => setzeStand((x) => ({ ...x, sammlung: f(x.sammlung) }));
export const holeStand = () => zustand;

/** Alles vergessen (nach „Einrichtung abschließen“ oder „Neu einrichten“ abgewählt). */
export function vergiss() {
  geheim.administrator = ''; geheim.mail = ''; geheim.paketEinstellungen = undefined;
  try { sessionStorage.removeItem(SPEICHER); } catch { /* egal */ }
  zustand = leer();
  for (const h of hoerer) h();
}

export function useAssistent(): Assistentenstand {
  return useSyncExternalStore((h) => { hoerer.add(h); return () => hoerer.delete(h); }, () => zustand);
}

/* ---------- Sammlung ⇄ Plan (#806) ---------- */

export function planAus(s: Sammlung, db: PlanDatenbank | null = s.datenbank): Einrichtungsplan {
  const m = s.optional.mail;
  const be = s.benutzer.email.trim() || s.benutzer.name.trim() ? { name: s.benutzer.name.trim(), email: s.benutzer.email.trim(), aufgabenOhneEmpfaenger: s.benutzer.aufgabenOhneEmpfaenger } : null;
  return {
    datenbank: db ? { ...db, ...(s.verweise.datenbank ? { passwort: s.verweise.datenbank } : {}) } : null,
    ablage: s.ablage.replace(/\s+/g, ' ').trim(),
    administrator: { name: s.administrator.name.trim(), email: s.administrator.email.trim(), ...(s.verweise.administrator ? { passwort: s.verweise.administrator } : {}) },
    benutzer: be,
    pakete: s.pakete ? s.pakete.pakete.map((p) => ({ id: p.id, beispiele: p.beispiele, automatisierungen: p.automatisierungen }))
      : s.paketeVorgabe ?? (s.besucht.includes('pakete') ? [] : null),
    optional: {
      adresse: s.optional.adresse.trim() || null, bundesland: s.optional.bundesland || null, beispiele: s.optional.beispiele,
      mail: m ? { aktiv: m.aktiv, host: m.host.trim(), port: m.port, verbindung: m.verbindung, benutzer: m.benutzer.trim(), absender: m.absender.trim(), selbstsigniert: m.selbstsigniert, ...(s.verweise.mail ? { passwort: s.verweise.mail } : {}) } : null,
    },
  };
}

/** Eine geladene Datei als Sammlung: alles sichtbar vorbelegt, Passwörter fehlen (fragt der Assistent ab). */
export function sammlungAus(p: Einrichtungsplan, hinweise: string[]): Sammlung {
  const m = p.optional.mail;
  return {
    ...leereSammlung(),
    ablage: p.ablage,
    administrator: { name: p.administrator.name, email: p.administrator.email },
    benutzer: p.benutzer ?? { name: '', email: '', aufgabenOhneEmpfaenger: true },
    paketeVorgabe: p.pakete,
    optional: {
      adresse: p.optional.adresse ?? '', bundesland: p.optional.bundesland ?? '', beispiele: p.optional.beispiele,
      mail: m ? { aktiv: m.aktiv, host: m.host, port: m.port, verbindung: m.verbindung, benutzer: m.benutzer, absender: m.absender, selbstsigniert: m.selbstsigniert, mitPasswort: false } : null,
    },
    besucht: ['ablage', 'administrator', 'benutzer', ...(p.pakete ? ['pakete' as const] : []), 'optional'],
    zurZusammenfassung: true,
    verweise: { administrator: p.administrator.passwort, mail: m?.passwort, datenbank: p.datenbank?.passwort },
    datenbank: p.datenbank,
    hinweise,
  };
}
