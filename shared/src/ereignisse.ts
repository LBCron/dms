/**
 * Gemeinsamer Ereigniskatalog (#670): was im DMS passiert, an einer Stelle beschrieben – für Automatisierungen
 * (Wenn-Karten, #674), Pakete mit Code (`code.ereignisse`) und Webhooks (#627, #671).
 *
 * - **Nur Ids, Art, Feldschlüssel und Datum** – nie Feldwerte, Titel oder Namen. Wer mehr wissen will, liest mit seinen
 *   eigenen Rechten nach (Paket: bestätigte Rechte, Automatisierung: Systemkonto, #673).
 * - **Mindestens einmal, mit Ereignis-Id:** Der Kern schreibt ein Ereignis in derselben Transaktion wie die Änderung
 *   (Tabelle `ereignisse`) und verteilt es danach; wer es bekommt, erkennt eine Wiederholung an der Id.
 * - **Bündeln:** Viele schnelle Änderungen an derselben Mappe werden ein Ereignis (`buendelS`), die geänderten
 *   Feldschlüssel zusammengeführt. Demo-Daten, Importe und Wiederherstellungen lösen nichts aus.
 *
 * Texte (Name, Beschreibung) stehen in `shared/src/sprachen/de/ereignisse.json` unter `name.<art>` und `text.<art>` (Unterstrich als Bindestrich, `ereignisSchluessel`).
 */

/** Wozu ein Ereignis gehört – zugleich der Kontext einer Wenn-Karte (welche Platzhalter es gibt). */
export type Ereignisgruppe = 'mappe' | 'zeit' | 'person' | 'benutzer' | 'verarbeitung' | 'zaehler';

export interface Katalogeintrag {
  gruppe: Ereignisgruppe;
  /** Angaben im Ereignis (nur Ids, Schlüssel, Datum, Zahlen). */
  felder: readonly string[];
  /** Können Pakete es abonnieren (`code.ereignisse`)? */
  paket?: boolean;
  /** Für Pakete nur zu Mappentypen, die im Manifest unter `code.mappentypen` stehen (Stufe 1: eigene Typen). */
  mappentyp?: boolean;
  /** Können Webhooks es melden? */
  webhook?: boolean;
  /** Zusammenfassen: schnelle Folgen zur selben Mappe binnen so vieler Sekunden werden ein Ereignis. */
  buendelS?: number;
}

export const EREIGNISKATALOG = {
  // Mappen
  'mappe.angelegt': { gruppe: 'mappe', felder: ['mappe', 'typ'], paket: true, mappentyp: true },
  'mappe.geaendert': { gruppe: 'mappe', felder: ['mappe', 'typ', 'felder'], paket: true, mappentyp: true, buendelS: 5 },
  'mappe.verknuepft': { gruppe: 'mappe', felder: ['mappe', 'typ', 'von', 'vonTyp', 'feld'] },
  'dokument.hochgeladen': { gruppe: 'mappe', felder: ['dokument', 'mappe', 'typ', 'mime', 'groesse'], paket: true },
  'mappe.notiz': { gruppe: 'mappe', felder: ['mappe', 'typ', 'notiz'] },
  'mappe.geloescht': { gruppe: 'mappe', felder: ['mappe', 'typ'], paket: true, mappentyp: true },
  'mappe.geloescht_verknuepft': { gruppe: 'mappe', felder: ['mappe', 'typ', 'vorgang', 'start'] },
  'mappe.endgueltig_geloescht': { gruppe: 'mappe', felder: ['mappe', 'typ'] },
  'mappe.wiederhergestellt': { gruppe: 'mappe', felder: ['mappe', 'typ'], paket: true, mappentyp: true },
  // Zeit
  'frist.erreicht': { gruppe: 'zeit', felder: ['mappe', 'typ', 'feld', 'datum', 'zeitpunkt', 'empfaenger'], paket: true, mappentyp: true },
  // Für Personen
  'aufgabe.neu': { gruppe: 'person', felder: ['aufgabe', 'mappe', 'typ', 'empfaenger', 'aufgabenart'] },
  'post.angelegt': { gruppe: 'person', felder: ['mappe', 'kanal', 'fuer'], paket: true },
  'favorit.neu': { gruppe: 'person', felder: ['benutzer', 'mappe', 'typ'] },
  // Benutzer
  'benutzer.abwesenheit_gesetzt': { gruppe: 'benutzer', felder: ['benutzer', 'von', 'bis', 'vertreter'] },
  'benutzer.abwesenheit_beendet': { gruppe: 'benutzer', felder: ['benutzer'] },
  'benutzer.gesperrt': { gruppe: 'benutzer', felder: ['benutzer', 'zeitpunkt', 'fehlversuche', 'bis', 'ip'] },
  'benutzer.deaktiviert': { gruppe: 'benutzer', felder: ['benutzer'] },
  'benutzer.aktiviert': { gruppe: 'benutzer', felder: ['benutzer'] },
  // Verarbeitung
  'volltext.fertig': { gruppe: 'verarbeitung', felder: ['dokument', 'mappe', 'typ', 'quelle'], paket: true },
  'datei.umgewandelt': { gruppe: 'verarbeitung', felder: ['dokument', 'mappe', 'typ', 'paket'] },
  'archivfassung.erstellt': { gruppe: 'verarbeitung', felder: ['dokument', 'mappe', 'typ', 'paket'] },
  'erkennung.fertig': { gruppe: 'verarbeitung', felder: ['mappe', 'typ', 'dokument'] },
  // Zahlen eines Benutzers (Webhooks, #627)
  'zaehler.geaendert': { gruppe: 'zaehler', felder: ['zahlen', 'stand'], webhook: true },
} as const satisfies Record<string, Katalogeintrag>;

export type KatalogArt = keyof typeof EREIGNISKATALOG;
export const KATALOG_ARTEN = Object.keys(EREIGNISKATALOG) as KatalogArt[];
export const istKatalogArt = (a: string): a is KatalogArt => Object.prototype.hasOwnProperty.call(EREIGNISKATALOG, a);
/** Teil des Sprachschlüssels zu einer Art (`name.<teil>`, `text.<teil>`): Unterstrich ist in Schlüsseln Mehrzahlformen vorbehalten. */
type Bindestrich<S extends string> = S extends `${infer A}_${infer B}` ? `${A}-${Bindestrich<B>}` : S;
export const ereignisSchluessel = <A extends KatalogArt>(a: A) => a.replace(/_/g, '-') as Bindestrich<A>;
export const katalogeintrag = (a: KatalogArt): Katalogeintrag => EREIGNISKATALOG[a];
/** Ereignisse, die Pakete nur zu Typen aus `code.mappentypen` bekommen (#670). */
export const MAPPENTYP_EREIGNISSE = KATALOG_ARTEN.filter((a) => (EREIGNISKATALOG[a] as Katalogeintrag).mappentyp);
/** Ereignisse, die Webhooks melden können (heute nur die Zahlen, #627). */
export const WEBHOOK_KATALOG = KATALOG_ARTEN.filter((a) => (EREIGNISKATALOG[a] as Katalogeintrag).webhook);

/** Wer ein Ereignis ausgelöst hat – damit erkennt eine Automatisierung ihre eigenen Änderungen (#674). */
export interface Ausloeser {
  art: 'benutzer' | 'paket' | 'automatisierung' | 'system';
  /** Benutzer-Id, Paket-Id bzw. Id der Automatisierung. */
  id?: string | null;
  /** Konto, unter dem es geschah (Benutzer, Dienstkonto, Systemkonto). */
  konto?: string | null;
  /** Tiefe einer Kette von Automatisierungen (0 = direkt ausgelöst). */
  kette?: number;
}

/** Ein Ereignis, wie es Abnehmer im DMS bekommen. */
export interface KatalogEreignis { id: string; art: KatalogArt; daten: Record<string, unknown>; ausloeser: Ausloeser; erstellt: string }

/** Geänderte Feldschlüssel zweier Ereignisse zusammenführen (Bündeln). */
export function mischeFelder(alt: Record<string, unknown>, neu: Record<string, unknown>): Record<string, unknown> {
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return { ...alt, ...neu, felder: [...new Set([...liste(alt.felder), ...liste(neu.felder)])].sort() };
}
