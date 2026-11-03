/**
 * Webhooks (#627): gemeinsame Typen und Regeln für Server und Oberfläche.
 *
 * Ein Webhook gehört einem Benutzer und meldet an eine Adresse, sobald sich dessen Zahlen ändern (dieselben wie
 * `GET /api/v1/ich/zaehler`, #625). Die Meldung enthält nur Art, Ereignis-Id, Zeit und Zahlen – keine Titel,
 * Namen, Absender oder Inhalte. Wer mehr wissen will, holt es per API mit eigenen Rechten.
 */
import { imHeimnetz } from './heimnetz';
import { uebersetzer } from './sprache';
import webhook from './sprachen/de/webhook.json';

const t = uebersetzer({ webhook });

/** Ereignisse der ersten Stufe. `probe` kommt nur über „Probe senden“. */
export const WEBHOOK_EREIGNISSE = ['zaehler.geaendert'] as const;
export type WebhookEreignis = (typeof WEBHOOK_EREIGNISSE)[number] | 'probe';

/** Köpfe der Meldung (klein geschrieben, wie sie Node und die meisten Rahmenwerke liefern). */
export const WEBHOOK_KOPF = {
  signatur: 'x-dms-signatur',
  zeit: 'x-dms-zeit',
  ereignis: 'x-dms-ereignis',
  art: 'x-dms-art',
  versuch: 'x-dms-versuch',
  webhook: 'x-dms-webhook',
} as const;

/** Mindestabstand zweier Meldungen je Webhook: was dazwischen passiert, geht zusammengefasst in die nächste. */
export const WEBHOOK_ABSTAND_S = 30;
/** So lange wartet das DMS nach einer Änderung, bevor es zählt (mehrere Änderungen auf einmal zählen einmal). */
export const WEBHOOK_ANSTOSS_S = 3;
/** Zeitgrenze je Zustellung. */
export const WEBHOOK_ZEITGRENZE_S = 5;
/**
 * Wartezeit vor dem 2., 3., … Versuch in Sekunden; nach dem letzten Versuch gibt das DMS die Meldung auf und
 * schaltet den Webhook ab (zusammen etwa 22 Stunden, 12 Versuche).
 */
export const WEBHOOK_WARTEN_S: readonly number[] = [30, 60, 120, 300, 600, 1800, 3600, 7200, 14400, 21600, 28800];
export const WEBHOOK_VERSUCHE = WEBHOOK_WARTEN_S.length + 1;
/** Höchstens so viele Webhooks je Benutzer. */
export const WEBHOOK_MAX_JE_BENUTZER = 10;

/** Zahlen wie beim Zähler-Endpunkt (#625). */
export interface WebhookZahlen { neuePost: number; zuErledigen: number; anstehend: number; ueberfaellig: number; stand: number; geaendert: string }

/** Rumpf einer Meldung (JSON). `daten` ist bei `probe` und `zaehler.geaendert` gleich aufgebaut. */
export interface WebhookRumpf { art: WebhookEreignis; id: string; zeit: string; daten: WebhookZahlen }

export interface WebhookErgebnis { zeit: string; art: WebhookEreignis; ok: boolean; status: number | null; fehler: string | null; ms: number }
export interface WebhookAbgeschaltet { grund: 'fehler' | 'admin'; zeit: string; von?: string; text?: string }

/** Ein Webhook, wie ihn sein Benutzer und die Werkbank sehen (ohne Geheimnis). */
export interface WebhookAnsicht {
  id: string;
  name: string;
  url: string;
  ereignisse: string[];
  aktiv: boolean;
  abgeschaltet: WebhookAbgeschaltet | null;
  fehlerFolge: number;
  letzte: WebhookErgebnis | null;
  /** Eine Meldung wartet (auch auf eine Wiederholung). */
  offen: { faellig: string; versuche: number } | null;
  erstellt: string;
}
/** In der Werkbank zusätzlich der Benutzer. */
export interface WebhookWerkbank extends WebhookAnsicht { benutzer: { id: string; name: string } }

/** Eine Zeile im Verlauf (ohne Daten). */
export interface WebhookVerlauf { ereignisId: string; art: string; zustand: 'offen' | 'zugestellt' | 'aufgegeben' | 'verworfen'; erstellt: string; erledigt: string | null; versuche: number; status: number | null; fehler: string | null }

export interface WebhookEingabe { name: string; url: string; aktiv?: boolean }

/** Ursprung (Schema, Rechner, Port) einer Adresse, z. B. `https://homey.home.arpa`; null, wenn ungültig. */
export function ursprung(adresse: string): string | null {
  try { const u = new URL(adresse); return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null; } catch { return null; }
}

/**
 * Was gegen diese Ziel-Adresse spricht, oder null: nur `https://`, im Heimnetz auch `http://` (gemeinsame Liste
 * in heimnetz.ts, #595); keine Anmeldedaten in der Adresse, kein `#`-Teil, höchstens 2000 Zeichen.
 */
export function zielProblem(adresse: string): string | null {
  const s = adresse.trim();
  if (!s) return t('webhook.ziel.leer');
  if (s.length > 2000) return t('webhook.ziel.lang');
  let u: URL;
  try { u = new URL(s); } catch { return t('webhook.ziel.ungueltig'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return t('webhook.ziel.schema');
  if (u.protocol === 'http:' && !imHeimnetz(u)) return t('webhook.ziel.http');
  if (u.username || u.password) return t('webhook.ziel.anmeldung');
  if (u.hash) return t('webhook.ziel.hash');
  return null;
}
