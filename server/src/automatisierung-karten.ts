import { feldLabel } from '../../shared/src/beschriftung';
import type { DannKarte } from '../../shared/src/automatisierung';
import { formatiere, type AufgabenAnlass, type Feld } from '../../shared/src/model';
import { heuteIn, verschiebe } from '../../shared/src/sichten';
import { uebersetzer } from '../../shared/src/sprache';
import texte from '../../shared/src/sprachen/de/automatisierung.json';
import { DANN_AUSFUEHRER, type KartenKontext } from './automatisierung';
import { Fachfehler } from './fehler';
import { t } from './sprache';

/**
 * Dann-Karten der Automatisierungen, Stufe 1 (#676).
 *
 * - **Feld ändern:** setzt nur die gewählten Felder (wie beim gleichzeitigen Bearbeiten, #609) – über denselben Weg
 *   wie das Formular (`aendereMappe` mit dem Zugriff des Systemkontos): Feldformate, Pflicht, Auswahllisten und
 *   Verweisziele werden geprüft, Archivmodus und Fristsperre nie umgangen. Text mit Platzhaltern wie beim Titel;
 *   bei Datumsfeldern `heute` bzw. `heute+7` / `heute-3`. Die Historie zeigt „durch Automatisierung ‚…‘“.
 * - **Aufgabe / Benachrichtigung:** an Personen, alle aktiven Mitglieder einer Rolle oder die Person(en) in einem
 *   Feld der Mappe. Text mit Platzhaltern – je Empfänger mit dessen Rechten (#795; der, der sie nach der Vertretung
 *   wirklich bekommt): Was er nicht sehen darf, steht als „(nicht sichtbar)“ da. Wer die Mappe nicht lesen darf, bekommt
 *   die Aufgabe trotzdem an der Mappe, sieht aber nur einen Hinweis und die Fälligkeit (#798); der Admin sieht den Fall
 *   in der Werkbank. Der Testlauf nennt, wer etwas nicht sehen darf.
 */
const uebersetzer2 = uebersetzer({ automatisierung: texte });

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
  if (k.art !== 'feld') throw new Fachfehler(500, t('meldungen.automatisierungkarten.falsche-karte'));
  if (!c.mappe || !c.typ) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.feld.ohne-mappe'));
  const werte: Record<string, unknown> = {};
  for (const [key, roh] of Object.entries(k.werte)) {
    const f = c.typ.felder.find((x) => x.key === key);
    if (!f || f.typ === 'passwort') continue;
    werte[key] = await wertFuer(f, roh, c);
  }
  const zeile = Object.entries(werte).map(([key, v]) => { const f = c.typ!.felder.find((x) => x.key === key)!; return `${feldLabel(f)} = ${formatiere(f, v as never) || '–'}`; }).join(', ');
  if (c.trocken) return uebersetzer2('automatisierung.karte.feld.trocken', { felder: zeile });
  await c.dienst.aendereMappe(c.mappe.id, { werte }, c.konto.id, c.z, c.anlass);
  return uebersetzer2('automatisierung.karte.feld.ergebnis', { felder: zeile });
};

DANN_AUSFUEHRER.aufgabe = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'aufgabe') throw new Fachfehler(500, t('meldungen.automatisierungkarten.falsche-karte'));
  if (!c.mappe) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.aufgabe.ohne-mappe'));
  const text = (await c.fuelle(k.text)).trim();
  if (!text) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.aufgabe.leer'));
  const an = [...new Set((await Promise.all(k.empfaenger.map((e) => c.personen(e)))).flat())];
  // Nur Personen aus dem Ereignis und keine dabei (z. B. Abwesenheit ohne Vertreter): nichts zu tun, kein Fehler.
  if (!an.length && k.empfaenger.length && k.empfaenger.every((e) => e.art === 'ereignis')) return uebersetzer2('automatisierung.karte.aufgabe.niemand-ereignis');
  if (!an.length) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.aufgabe.niemand'));
  const datum = k.als === 'aufgabe' && k.faellig !== null && k.faellig !== undefined ? verschiebe(heuteIn(), k.faellig) : null;
  const als = k.als === 'aufgabe' ? uebersetzer2('automatisierung.karte.aufgabe.als-aufgabe') : uebersetzer2('automatisierung.karte.aufgabe.als-benachrichtigung');
  if (c.trocken) {
    // Testlauf (#795): je Empfänger mit seinen Rechten – wer etwas nicht sehen darf, steht dabei.
    const teils: string[] = []; const gar: string[] = [];
    for (const id of an) {
      const wer = (await c.dienst.aufgabenEmpfaenger(id)).an;
      const f = await c.fuelleFuer(k.text, wer);
      if (!f.mappe) gar.push(await c.dienst.name(wer)); else if (f.verborgen) teils.push(await c.dienst.name(wer));
    }
    return [uebersetzer2('automatisierung.karte.aufgabe.trocken', { als, anzahl: an.length, text }),
      ...(teils.length ? [uebersetzer2('automatisierung.karte.aufgabe.trocken.nicht-sichtbar', { anzahl: teils.length, namen: teils.join(', ') })] : []),
      ...(gar.length ? [uebersetzer2('automatisierung.karte.aufgabe.trocken.ohne-leserecht', { anzahl: gar.length, namen: gar.join(', ') })] : [])].join(' ');
  }
  // Anlass (#724): Die Aufgabe erledigt sich selbst, wenn er wegfällt. Aus „Datum erreicht“ wird sie eine Frist.
  const w = c.automatisierung.wenn;
  const auto = c.automatisierung.id;
  const frist = k.als === 'aufgabe' && w.art === 'datum' && typeof c.daten.datum === 'string' ? { feld: w.feld, datum: c.daten.datum } : null;
  const aufgabenAnlass: AufgabenAnlass | null = k.als !== 'aufgabe' ? null
    : w.art === 'datum' ? { art: 'datum', feld: w.feld, wiederholung: w.wiederholung ?? null, automatisierung: auto }
      : w.art === 'post.angelegt' ? { art: 'post', automatisierung: auto }
        : w.art === 'benutzer.abwesenheit_gesetzt' ? { art: 'abwesenheit', benutzer: c.mappe.id, automatisierung: auto } : null;
  let ohneLeserecht = 0; let vorhanden = 0; let admins = 0;
  // Platzhalter je Empfänger mit dessen Rechten (#795) – fürs Konto leer ist er schon oben abgefangen.
  const fuer = async (wer: string | null) => (await c.fuelleFuer(k.text, wer)).text.trim() || text;
  for (const id of an) {
    const r = await c.dienst.aufgabeAusAutomatisierung({ mappeId: c.mappe.id, empfaengerId: id, text: fuer, datum: frist ? null : datum, von: c.konto.id, buendeln: k.als === 'benachrichtigung' ? auto : null, anlass: c.anlass, aufgabenAnlass, frist });
    if (r.ohneLeserecht) ohneLeserecht++;
    if (r.vorhanden) vorhanden++;
    if (!r.an) admins++;
  }
  return ((an.length - vorhanden ? uebersetzer2('automatisierung.karte.aufgabe.ergebnis', { als, anzahl: an.length - vorhanden }) : '')
    + (ohneLeserecht ? ` ${uebersetzer2('automatisierung.karte.aufgabe.ohne-leserecht', { anzahl: ohneLeserecht })}` : '')
    + (vorhanden ? ` ${uebersetzer2('automatisierung.karte.aufgabe.vorhanden', { anzahl: vorhanden })}` : '')
    + (admins ? ` ${uebersetzer2('automatisierung.karte.aufgabe.an-admins', { anzahl: admins })}` : '')).trim();
};

/* ---------- Benachrichtigungen (#678, Paket „Benachrichtigungen“) ---------- */

DANN_AUSFUEHRER.zusammenfassung = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'zusammenfassung') throw new Fachfehler(500, t('meldungen.automatisierungkarten.falsche-karte'));
  const benutzer = typeof c.daten.benutzer === 'string' ? c.daten.benutzer : null;
  if (!benutzer) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.zusammenfassung.ohne-benutzer'));
  if (!c.dienst.zusammenfassungAn) throw new Fachfehler(500, uebersetzer2('automatisierung.karte.zusammenfassung.fehlt'));
  const r = await c.dienst.zusammenfassungAn(benutzer, c.trocken);
  return r.grund;
};

DANN_AUSFUEHRER.favoriten = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'favoriten') throw new Fachfehler(500, t('meldungen.automatisierungkarten.falsche-karte'));
  if (!c.mappe) throw new Fachfehler(422, uebersetzer2('automatisierung.karte.favoriten.ohne-mappe'));
  const von = typeof c.daten.von === 'string' ? c.daten.von : null;
  if (!von) return uebersetzer2('automatisierung.karte.favoriten.niemand');
  if (c.trocken) return uebersetzer2('automatisierung.karte.favoriten.trocken');
  const n = await c.dienst.favoritenMelden(c.mappe.id, von);
  return n ? uebersetzer2('automatisierung.karte.favoriten.ergebnis', { anzahl: n }) : uebersetzer2('automatisierung.karte.favoriten.niemand');
};

DANN_AUSFUEHRER.anmeldeschutz = async (k: DannKarte, c: KartenKontext) => {
  if (k.art !== 'anmeldeschutz') throw new Fachfehler(500, t('meldungen.automatisierungkarten.falsche-karte'));
  if (!c.dienst.anmeldeschutzMelden) throw new Fachfehler(500, uebersetzer2('automatisierung.karte.anmeldeschutz.fehlt'));
  return (await c.dienst.anmeldeschutzMelden(k.was, c.daten, c.trocken)).grund;
};
