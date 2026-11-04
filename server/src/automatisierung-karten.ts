import type { DannKarte } from '../../shared/src/automatisierung';
import { formatiere, type AufgabenAnlass, type Feld } from '../../shared/src/model';
import { heuteIn, verschiebe } from '../../shared/src/sichten';
import { uebersetzer } from '../../shared/src/sprache';
import texte from '../../shared/src/sprachen/de/automatisierung.json';
import { DANN_AUSFUEHRER, type KartenKontext } from './automatisierung';
import { Fachfehler } from './fehler';

/**
 * Dann-Karten der Automatisierungen, Stufe 1 (#676).
 *
 * - **Feld ändern:** setzt nur die gewählten Felder (wie beim gleichzeitigen Bearbeiten, #609) – über denselben Weg
 *   wie das Formular (`aendereMappe` mit dem Zugriff des Systemkontos): Feldformate, Pflicht, Auswahllisten und
 *   Verweisziele werden geprüft, Archivmodus und Fristsperre nie umgangen. Text mit Platzhaltern wie beim Titel;
 *   bei Datumsfeldern `heute` bzw. `heute+7` / `heute-3`. Die Historie zeigt „durch Automatisierung ‚…‘“.
 * - **Aufgabe / Benachrichtigung:** an Personen, alle aktiven Mitglieder einer Rolle oder die Person(en) in einem
 *   Feld der Mappe. Text mit Platzhaltern (Werte mit den Rechten des Systemkontos, Stufe 1). Wer die Mappe nicht lesen
 *   darf, bekommt die Aufgabe an seiner eigenen Benutzer-Mappe – ohne Link auf die Mappe.
 */
const t = uebersetzer({ automatisierung: texte });

/** Wert für ein Feld: Text mit Platzhaltern, Datum auch relativ zu heute; alles andere unverändert. */
async function wertFuer(f: Feld, roh: unknown, c: KartenKontext): Promise<unknown> {
  if (typeof roh !== 'string') return roh;
  if (f.typ === 'datum') {
    const m = /^heute\s*([+-])\s*(\d{1,4})$/.exec(roh.trim()) ?? (roh.trim() === 'heute' ? ['', '+', '0'] : null);
    return m ? verschiebe(heuteIn(), (m[1] === '-' ? -1 : 1) * Number(m[2])) : roh;
  }
  if (f.typ === 'text' || f.typ === 'langtext' || f.typ === 'formatiert') return c.fuelle(roh);
  return roh;
}

DANN_AUSFUEHRER.feld = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'feld') throw new Fachfehler(500, 'falsche Karte');
  if (!c.mappe || !c.typ) throw new Fachfehler(422, t('automatisierung.karte.feld.ohne-mappe'));
  const werte: Record<string, unknown> = {};
  for (const [key, roh] of Object.entries(k.werte)) {
    const f = c.typ.felder.find((x) => x.key === key);
    if (!f || f.typ === 'passwort') continue;
    werte[key] = await wertFuer(f, roh, c);
  }
  const zeile = Object.entries(werte).map(([key, v]) => { const f = c.typ!.felder.find((x) => x.key === key)!; return `${f.label} = ${formatiere(f, v as never) || '–'}`; }).join(', ');
  if (c.trocken) return t('automatisierung.karte.feld.trocken', { felder: zeile });
  await c.dienst.aendereMappe(c.mappe.id, { werte }, c.konto.id, c.z, c.anlass);
  return t('automatisierung.karte.feld.ergebnis', { felder: zeile });
};

DANN_AUSFUEHRER.aufgabe = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'aufgabe') throw new Fachfehler(500, 'falsche Karte');
  if (!c.mappe) throw new Fachfehler(422, t('automatisierung.karte.aufgabe.ohne-mappe'));
  const text = (await c.fuelle(k.text)).trim();
  if (!text) throw new Fachfehler(422, t('automatisierung.karte.aufgabe.leer'));
  const an = [...new Set((await Promise.all(k.empfaenger.map((e) => c.personen(e)))).flat())];
  if (!an.length) throw new Fachfehler(422, t('automatisierung.karte.aufgabe.niemand'));
  const datum = k.als === 'aufgabe' && k.faellig !== null && k.faellig !== undefined ? verschiebe(heuteIn(), k.faellig) : null;
  const als = k.als === 'aufgabe' ? t('automatisierung.karte.aufgabe.als-aufgabe') : t('automatisierung.karte.aufgabe.als-benachrichtigung');
  if (c.trocken) return t('automatisierung.karte.aufgabe.trocken', { als, anzahl: an.length, text });
  // Anlass (#724): Die Aufgabe erledigt sich selbst, wenn er wegfällt. Aus „Datum erreicht“ wird sie eine Frist.
  const w = c.automatisierung.wenn;
  const auto = c.automatisierung.id;
  const frist = k.als === 'aufgabe' && w.art === 'datum' && typeof c.daten.datum === 'string' ? { feld: w.feld, datum: c.daten.datum } : null;
  const aufgabenAnlass: AufgabenAnlass | null = k.als !== 'aufgabe' ? null
    : w.art === 'datum' ? { art: 'datum', feld: w.feld, wiederholung: w.wiederholung ?? null, automatisierung: auto }
      : w.art === 'post.angelegt' ? { art: 'post', automatisierung: auto }
        : w.art === 'benutzer.abwesenheit_gesetzt' ? { art: 'abwesenheit', benutzer: c.mappe.id, automatisierung: auto } : null;
  let ohneLink = 0; let vorhanden = 0; let admins = 0;
  for (const id of an) {
    const r = await c.dienst.aufgabeAusAutomatisierung({ mappeId: c.mappe.id, empfaengerId: id, text, datum: frist ? null : datum, von: c.konto.id, buendeln: k.als === 'benachrichtigung' ? auto : null, anlass: c.anlass, aufgabenAnlass, frist });
    if (r.ohneLink) ohneLink++;
    if (r.vorhanden) vorhanden++;
    if (!r.an) admins++;
  }
  return ((an.length - vorhanden ? t('automatisierung.karte.aufgabe.ergebnis', { als, anzahl: an.length - vorhanden }) : '')
    + (ohneLink ? ` ${t('automatisierung.karte.aufgabe.ohne-link', { anzahl: ohneLink })}` : '')
    + (vorhanden ? ` ${t('automatisierung.karte.aufgabe.vorhanden', { anzahl: vorhanden })}` : '')
    + (admins ? ` ${t('automatisierung.karte.aufgabe.an-admins', { anzahl: admins })}` : '')).trim();
};
