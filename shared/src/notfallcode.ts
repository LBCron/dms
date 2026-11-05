/**
 * Notfallcode vom Notfallblatt (#815): ausgesperrt, trotzdem wieder hinein – über `https://<adresse>/notfall`.
 *
 * - Ein eigener Code, nicht der Schlüssel: Der Schlüssel entschlüsselt alle Sicherungen und wird nie im Browser
 *   eingegeben.
 * - 28 Zeichen aus 32 gut unterscheidbaren (ohne 0/O und 1/I), also 140 Bit – Raten bringt nichts. In Gruppen zu
 *   vier Zeichen, Groß- und Kleinschreibung, Leerzeichen und Bindestriche zählen bei der Eingabe nicht.
 * - Gilt nur einmal. Danach ist ein neues Notfallblatt Pflicht (mit neuem Code).
 */

/** Erlaubte Zeichen: Ziffern 2–9 und Großbuchstaben ohne I und O – 32 Zeichen, also genau 5 Bit je Zeichen. */
export const NOTFALLCODE_ZEICHEN = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const NOTFALLCODE_LAENGE = 28;
export const NOTFALLCODE_GRUPPE = 4;
/** Nach jeder Fehleingabe ist die Eingabe so lange gesperrt – je Adressbereich (IPv4 einzeln, IPv6 je /64). */
export const NOTFALL_SPERRE_SEKUNDEN = 30;

/** Eingabe vereinheitlichen: Großbuchstaben, ohne Leerzeichen und Bindestriche. null = kann kein Notfallcode sein. */
export function normiereNotfallcode(x: unknown): string | null {
  if (typeof x !== 'string' || x.length > 100) return null;
  const c = x.toUpperCase().replace(/[\s\-–_.]+/g, '');
  if (c.length !== NOTFALLCODE_LAENGE) return null;
  for (const z of c) if (!NOTFALLCODE_ZEICHEN.includes(z)) return null;
  return c;
}

/** Zum Abschreiben in Gruppen: „ABCD-EFGH-…“. */
export const notfallcodeInGruppen = (c: string) => (c.match(new RegExp(`.{1,${NOTFALLCODE_GRUPPE}}`, 'g')) ?? []).join('-');
