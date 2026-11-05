import { BlockList, isIP } from 'node:net';
import { randomBytes } from 'node:crypto';
import { NOTFALL_SPERRE_SEKUNDEN } from '../../shared/src/notfallcode';
import { istPerson, type Benutzer } from '../../shared/src/model';
import { darfVerwalten, hatGesamt } from '../../shared/src/verwaltungsrecht';
import { zeitzone } from '../../shared/src/region';
import { ipBereich, kuerzeIp } from './abruf';
import type { Einstellungen } from './einstellungen';
import { Fachfehler } from './fehler';
import { pruefePasswortRegeln, type Konten } from './konten';
import type { Mailer } from './mail';
import { mailtexte } from './mail';
import { protokoll } from './protokoll';
import type { ProxyVertrauen } from './proxy';
import { t } from './sprache';

/**
 * Notfallzugang mit dem Notfallcode vom Notfallblatt (#815): ausgesperrt, trotzdem wieder hinein – ohne Dateien auf dem
 * NAS (die RESCUE-Datei, #108, bleibt als zweiter Weg). Ablauf auf `/notfall`: Code eingeben → erst danach die Konten
 * mit Verwaltungsrecht zur Wahl → neues Passwort direkt setzen → neues Notfallblatt herunterladen (Pflicht) → anmelden.
 *
 * Bauvorgaben von Sicherheit (#815):
 * - Code nur als Hash (scrypt), Vergleich in konstanter Zeit, gleich viel Arbeit bei richtigem und falschem Code.
 *   Einlösen in derselben Transaktion wie das neue Passwort (`Konten.loeseNotfallcodeEin`).
 * - „Nur aus dem Heimnetz“ (Vorgabe) mit der echten Client-Adresse hinter einem Reverse Proxy (`istHeimnetz`).
 * - Jede Fehleingabe sperrt 30 Sekunden – je Adressbereich (IPv4 einzeln, IPv6 je /64), damit niemand Lena durch eigene
 *   Fehlversuche aussperrt. Über alle Bereiche nur eine gebündelte Meldung; dazu zählt der allgemeine Anmeldeschutz.
 * - Die Benachrichtigung geht an die bisherige Adresse des Kontos und an alle mit Verwaltungsrecht, **bevor** sich
 *   etwas ändert. Danach: Sitzungen beenden, Zwei-Faktor zurücksetzen; verwalten erst nach neuer Anmeldung.
 *   API-Schlüssel des Kontos bleiben, die Meldung nennt sie.
 */

const log = protokoll.modul('konto');
const SPERRE_MS = NOTFALL_SPERRE_SEKUNDEN * 1000;
/** Gebündelte Meldung: ab so vielen Fehlversuchen in einer Stunde, höchstens einmal je Stunde. */
export const FEHLVERSUCHE_MELDEN = 5;
const STUNDE = 60 * 60_000;
/** Das neue Notfallblatt nach dem Einlösen: so lange herunterladbar (nur im Arbeitsspeicher). */
export const BLATT_MINUTEN = 15;
const BEREICHE_MAX = 10_000;
const EINSTELLUNG = 'notfallzugang';
const BENUTZT = 'notfallcode_benutzt';

/* ---------- Heimnetz ---------- */

const PRIVAT = new BlockList();
for (const [netz, maske] of [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['127.0.0.0', 8], ['169.254.0.0', 16]] as const) PRIVAT.addSubnet(netz, maske, 'ipv4');
for (const [netz, maske] of [['::1', 128], ['fe80::', 10], ['fc00::', 7]] as const) PRIVAT.addSubnet(netz, maske, 'ipv6');

/** Private Adresse (Heimnetz, Loopback, Link-Local, IPv6 ULA)? IPv4 in IPv6 (::ffff:…) zählt als IPv4. */
export function istPrivat(ip: string | undefined): boolean {
  const a = (ip ?? '').replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1').replace(/%.*$/, '').trim();
  const f = isIP(a);
  return !!f && PRIVAT.check(a, f === 6 ? 'ipv6' : 'ipv4');
}

/** Köpfe, mit denen ein Reverse Proxy die echte Adresse weitergibt. */
const WEITERGELEITET = ['x-forwarded-for', 'forwarded', 'x-real-ip'];

/**
 * Kommt die Anfrage aus dem Heimnetz (#815, Bauvorgabe Sicherheit)? Hinter einem Reverse Proxy kämen sonst alle
 * Anfragen scheinbar vom Proxy, also aus dem Heimnetz – dann wäre /notfall aus dem Internet offen. Darum:
 * - Mit Proxy-Angabe (X-Forwarded-For) gilt die Adresse, die Ablago nach `TRUST_PROXY` daraus bestimmt hat (`ip`).
 * - Kommt eine Proxy-Angabe an, obwohl kein Proxy vertrauenswürdig ist (`TRUST_PROXY=false`), gilt die Anfrage als
 *   „nicht Heimnetz“; ebenso mit `TRUST_PROXY=true` (die Angabe könnte jeder setzen) und mit Köpfen, die Ablago nicht
 *   auswertet (Forwarded, X-Real-IP ohne X-Forwarded-For).
 */
export function istHeimnetz(a: { ip: string; kopf?: (name: string) => string | undefined }, vertrauen: ProxyVertrauen | undefined): boolean {
  const weiter = WEITERGELEITET.filter((k) => !!a.kopf?.(k)?.trim());
  if (weiter.length) {
    if (vertrauen === false || vertrauen === undefined || vertrauen === true) return false;
    if (!weiter.includes('x-forwarded-for')) return false;
  }
  return istPrivat(a.ip);
}

/* ---------- Sperre je Adressbereich ---------- */

/** 30 Sekunden je Fehleingabe, je Adressbereich; dazu höchstens eine Prüfung gleichzeitig je Bereich. */
export class NotfallSperre {
  private bis = new Map<string, number>();
  private laeuft = new Set<string>();
  constructor(private jetzt: () => number = Date.now) {}

  /** Noch gesperrt? Dann die Wartezeit in Sekunden, sonst 0. */
  rest(bereich: string): number {
    const b = this.bis.get(bereich);
    if (!b) return 0;
    const ms = b - this.jetzt();
    if (ms <= 0) { this.bis.delete(bereich); return 0; }
    return Math.ceil(ms / 1000);
  }

  fehlschlag(bereich: string) {
    while (this.bis.size >= BEREICHE_MAX) this.bis.delete(this.bis.keys().next().value as string);
    this.bis.set(bereich, this.jetzt() + SPERRE_MS);
  }

  /** Platz für eine Prüfung in diesem Bereich (parallele Anfragen kommen sonst an der Sperre vorbei); null = belegt. */
  belege(bereich: string): (() => void) | null {
    if (this.laeuft.has(bereich)) return null;
    this.laeuft.add(bereich);
    let frei = false;
    return () => { if (!frei) { frei = true; this.laeuft.delete(bereich); } };
  }
}

/* ---------- Ablauf ---------- */

export interface NotfallAnfrage { ip: string; kopf?: (name: string) => string | undefined }
export interface NotfallEinstellung { internet: boolean; von: string | null; am: string | null }
/** Ein benutzter Notfallcode: steht in der Werkbank, bis ihn jemand mit „Gesamte Verwaltung“ als gelesen markiert. */
export interface NotfallBenutzt { id: string; benutzerId: string; name: string; email: string; am: string; gelesen?: { von: string; am: string } }

export interface NotfallDeps {
  konten: Konten;
  einstellungen: Einstellungen;
  mailer: () => Mailer | null;
  /** TRUST_PROXY (#234): wem Ablago die Proxy-Angaben glaubt. */
  proxy?: ProxyVertrauen;
  /** Zahl der API-Schlüssel einer Person – die Meldung nennt sie (sie bleiben gültig). */
  apiSchluessel?: (benutzerId: string) => Promise<number>;
  /** Nach dem Einlösen: Das Notfallblatt gilt nicht mehr (Hinweis in der Werkbank, bis ein neues da ist). */
  codeBenutzt?: () => Promise<void>;
  jetzt?: () => number;
}

const datumText = (d: Date) => d.toLocaleString('de-DE', { timeZone: zeitzone(), dateStyle: 'long', timeStyle: 'short' });

export class Notfallcode {
  readonly sperre: NotfallSperre;
  private fehlversuche: number[] = [];
  private gemeldet = 0;
  private blaetter = new Map<string, { benutzerId: string; name: string; bis: number; pdf?: Buffer }>();
  private jetzt: () => number;

  constructor(private d: NotfallDeps) {
    this.jetzt = d.jetzt ?? Date.now;
    this.sperre = new NotfallSperre(this.jetzt);
  }

  async einstellung(): Promise<NotfallEinstellung> {
    const e = (await this.d.einstellungen.lies(EINSTELLUNG)) as Partial<NotfallEinstellung> | null;
    return { internet: e?.internet === true, von: e?.von ?? null, am: e?.am ?? null };
  }

  /** „Notfallzugang aus dem Internet erlauben“ – eine heikle Handlung (frische Anmeldung, verwaltungsbereiche.ts). */
  async setzeEinstellung(eingabe: { internet?: unknown }, von: string): Promise<NotfallEinstellung> {
    const internet = eingabe.internet === true;
    const alt = await this.einstellung();
    if (alt.internet === internet) return alt;
    const neu: NotfallEinstellung = { internet, von, am: new Date(this.jetzt()).toISOString() };
    await this.d.einstellungen.schreibe(EINSTELLUNG, neu);
    log.warn(internet ? 'Notfallzugang aus dem Internet erlaubt' : 'Notfallzugang nur noch aus dem Heimnetz', { von, imVerwaltungsmodus: true });
    return neu;
  }

  /** Stand für die Seite /notfall: geht es von hier, und wie lange ist die Eingabe noch gesperrt? Verrät sonst nichts. */
  async stand(a: NotfallAnfrage): Promise<{ erlaubt: boolean; warten: number }> {
    const heimnetz = istHeimnetz(a, this.d.proxy);
    return { erlaubt: heimnetz || (await this.einstellung()).internet, warten: this.sperre.rest(ipBereich(a.ip)) };
  }

  /** Vor jeder Prüfung: von hier erlaubt, nicht gesperrt, Anmeldeschutz. Liefert den Bereich und den belegten Platz. */
  private async vorher(a: NotfallAnfrage): Promise<{ bereich: string; frei: () => void }> {
    if (!(await this.stand(a)).erlaubt) throw new Fachfehler(403, t('konten.notfall.fehler.heimnetz'), { heimnetz: false });
    const bereich = ipBereich(a.ip);
    const warten = this.sperre.rest(bereich);
    if (warten) throw new Fachfehler(429, t('konten.notfall.fehler.warten', { sekunden: warten }), { warten });
    await this.d.konten.sperre.pruefe('notfallzugang', a.ip);
    const frei = this.sperre.belege(bereich);
    if (!frei) throw new Fachfehler(429, t('konten.notfall.fehler.warten', { sekunden: NOTFALL_SPERRE_SEKUNDEN }), { warten: NOTFALL_SPERRE_SEKUNDEN });
    return { bereich, frei };
  }

  /** Falscher Code: 30 s Sperre für den Bereich, Anmeldeschutz, Protokoll, gebündelte Meldung. */
  private async falsch(a: NotfallAnfrage, bereich: string): Promise<never> {
    this.sperre.fehlschlag(bereich);
    await this.d.konten.sperre.fehlschlag('notfallzugang', a.ip).catch(() => {});
    log.warn('Notfallzugang: falscher Notfallcode', { ip: kuerzeIp(a.ip) });
    const jetzt = this.jetzt();
    this.fehlversuche = [...this.fehlversuche.filter((x) => jetzt - x < STUNDE), jetzt].slice(-1000);
    if (this.fehlversuche.length >= FEHLVERSUCHE_MELDEN && jetzt - this.gemeldet >= STUNDE) {
      this.gemeldet = jetzt;
      const m = mailtexte.notfallFehlversuche(this.fehlversuche.length, kuerzeIp(a.ip));
      await this.anVerwaltende(m).catch((e) => log.warn('Meldung zu Fehlversuchen am Notfallzugang nicht verschickt', { fehler: (e as Error).message }));
      log.warn('Notfallzugang: viele Fehlversuche gemeldet', { anzahl: this.fehlversuche.length });
    }
    throw new Fachfehler(403, t('konten.notfall.fehler.falsch'), { warten: NOTFALL_SPERRE_SEKUNDEN });
  }

  /** Schritt 1: Code prüfen. Erst danach – nie vorher – nennt die Seite die Konten zur Wahl. */
  async pruefe(a: NotfallAnfrage, code: unknown): Promise<{ konten: Array<{ id: string; name: string; email: string }> }> {
    const { bereich, frei } = await this.vorher(a);
    try {
      const hash = await this.d.konten.pruefeNotfallcode(code);
      if (!hash) return await this.falsch(a, bereich);
      log.info('Notfallzugang: Notfallcode richtig, Konto wird gewählt', { ip: kuerzeIp(a.ip) });
      return { konten: (await this.d.konten.notfallKonten()).map((b) => ({ id: b.id, name: b.name || b.email, email: b.email })) };
    } finally { frei(); }
  }

  /**
   * Schritt 2: Code erneut prüfen, zuerst benachrichtigen, dann einlösen (neues Passwort, Sitzungen weg, Zwei-Faktor
   * zurück). Liefert die Adresse fürs Anmelden und einen Schlüssel fürs neue Notfallblatt (15 Minuten).
   */
  async einloesen(a: NotfallAnfrage, e: { code?: unknown; konto?: unknown; passwort?: unknown }): Promise<{ email: string; blatt: string }> {
    const { bereich, frei } = await this.vorher(a);
    try {
      const hash = await this.d.konten.pruefeNotfallcode(e.code);
      if (!hash) return await this.falsch(a, bereich);
      const konto = (await this.d.konten.notfallKonten()).find((b) => b.id === e.konto);
      if (!konto) throw new Fachfehler(404, t('konten.notfall.fehler.konto'));
      // Passwortregeln vor der Meldung: Ein zu kurzes Passwort soll keine Mail auslösen.
      pruefePasswortRegeln(e.passwort);
      // Benachrichtigung zuerst (Bauvorgabe Sicherheit): bisherige Adresse, alle mit Verwaltungsrecht – vor jeder Änderung.
      const am = new Date(this.jetzt());
      await this.meldeBenutzung(konto, am, a.ip);
      const neu = await this.d.konten.loeseNotfallcodeEin(hash, konto.id, e.passwort);
      if (!neu) throw new Fachfehler(409, t('konten.notfall.fehler.benutzt'));
      log.warn('Notfallzugang benutzt: neues Passwort mit dem Notfallcode', { konto: konto.email, ip: kuerzeIp(a.ip), zweifaktor: 'zurückgesetzt', sitzungen: 'beendet' });
      const liste = ((await this.d.einstellungen.lies(BENUTZT)) as NotfallBenutzt[] | null) ?? [];
      const id = randomBytes(6).toString('hex');
      await this.d.einstellungen.schreibe(BENUTZT, [...liste, { id, benutzerId: konto.id, name: konto.name || konto.email, email: konto.email, am: am.toISOString() }].slice(-20));
      await this.d.codeBenutzt?.().catch((x) => log.warn('Notfallblatt nicht als veraltet vermerkt', { fehler: (x as Error).message }));
      return { email: neu.email, blatt: this.blattSchluessel(konto) };
    } finally { frei(); }
  }

  private async meldeBenutzung(konto: Benutzer, am: Date, ip: string) {
    const api = (await this.d.apiSchluessel?.(konto.id).catch(() => 0)) ?? 0;
    const m = mailtexte.notfallBenutzt(konto.name || konto.email, konto.email, datumText(am), kuerzeIp(ip), api);
    const mailer = this.d.mailer();
    if (!mailer) { log.warn('Notfallzugang: kein E-Mail-Versand eingerichtet – niemand wurde benachrichtigt', { konto: konto.email }); return; }
    const an = new Set<string>();
    if (konto.email && !konto.email.endsWith('.invalid')) an.add(konto.email.toLowerCase());
    for (const b of await this.d.konten.listeBenutzer()) if (istPerson(b) && b.aktiv && darfVerwalten(b) && b.email && !b.email.endsWith('.invalid')) an.add(b.email.toLowerCase());
    for (const x of an) {
      try { await mailer.sende(x, m.betreff, m.text); } catch (err) { log.warn('Mail zum Notfallzugang nicht verschickt', { an: x, fehler: (err as Error).message }); }
    }
  }

  private async anVerwaltende(m: { betreff: string; text: string }) {
    const mailer = this.d.mailer();
    if (!mailer) return;
    for (const b of await this.d.konten.listeBenutzer()) {
      if (istPerson(b) && b.aktiv && darfVerwalten(b) && b.email && !b.email.endsWith('.invalid')) await mailer.sende(b.email, m.betreff, m.text);
    }
  }

  /* ---------- Neues Notfallblatt nach dem Einlösen ---------- */

  private blattSchluessel(konto: Benutzer): string {
    const jetzt = this.jetzt();
    for (const [k, v] of this.blaetter) if (v.bis <= jetzt) this.blaetter.delete(k);
    while (this.blaetter.size >= 20) this.blaetter.delete(this.blaetter.keys().next().value as string);
    const s = randomBytes(32).toString('base64url');
    this.blaetter.set(s, { benutzerId: konto.id, name: konto.name || konto.email, bis: jetzt + BLATT_MINUTEN * 60_000 });
    return s;
  }

  /**
   * Das neue Notfallblatt zum Schlüssel aus `einloesen`: beim ersten Abruf erzeugt (mit neuem Notfallcode), danach
   * dasselbe Blatt, bis der Schlüssel abläuft – so gilt immer der Code auf dem heruntergeladenen Blatt.
   */
  async blatt(schluessel: unknown, erzeuge: (von: string) => Promise<Buffer>): Promise<Buffer> {
    const x = typeof schluessel === 'string' ? this.blaetter.get(schluessel) : undefined;
    if (!x || x.bis <= this.jetzt()) throw new Fachfehler(410, t('konten.notfall.fehler.blatt'));
    x.pdf ??= await erzeuge(t('konten.notfall.von', { name: x.name }));
    return x.pdf;
  }

  /* ---------- Hinweis in der Werkbank ---------- */

  /** Benutzte Notfallcodes, die noch niemand als gelesen markiert hat. */
  async offen(): Promise<NotfallBenutzt[]> {
    return (((await this.d.einstellungen.lies(BENUTZT)) as NotfallBenutzt[] | null) ?? []).filter((x) => !x.gelesen);
  }

  /** „Gelesen“: nur „Gesamte Verwaltung“; steht im Protokoll. */
  async gelesen(id: string, ich: Benutzer): Promise<void> {
    if (!hatGesamt(ich)) throw new Fachfehler(403, t('konten.verwaltung.fehler.vergeben'));
    const liste = ((await this.d.einstellungen.lies(BENUTZT)) as NotfallBenutzt[] | null) ?? [];
    const x = liste.find((y) => y.id === id && !y.gelesen);
    if (!x) return;
    x.gelesen = { von: ich.name || ich.email, am: new Date(this.jetzt()).toISOString() };
    await this.d.einstellungen.schreibe(BENUTZT, liste);
    log.info('Hinweis „Notfallzugang benutzt“ gelesen', { konto: x.email, von: ich.email, imVerwaltungsmodus: true });
  }
}
