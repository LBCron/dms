import { t } from './sprache';
/**
 * Sicherheits-Header für alle Antworten (#239): Schutz gegen Einbetten (Clickjacking),
 * MIME-Raten, verräterische Referrer; HSTS bei HTTPS; für die Oberfläche eine
 * Content-Security-Policy. Ein Reverse-Proxy muss dieselben Header nicht noch einmal setzen.
 *
 * Einbetten in fremde Seiten (z. B. ein Dashboard): DMS_EINBETTEN mit erlaubten Ursprüngen,
 * durch Leerzeichen oder Komma getrennt, z. B. „https://ha.example.org https://nas:8123“.
 */

export interface Einbetten { urspruenge: string[]; fehler: string | null }

const URSPRUNG = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;

export function einbettenAus(wert: string | undefined): Einbetten {
  const teile = (wert ?? '').split(/[\s,]+/).map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const gut = teile.filter((t) => URSPRUNG.test(t));
  const schlecht = teile.filter((t) => !URSPRUNG.test(t));
  return { urspruenge: gut, fehler: schlecht.length ? `DMS_EINBETTEN: ${schlecht.join(', ')} ist kein Ursprung wie https://example.org oder http://nas:8123 – ignoriert.` : null };
}

/** Strenge Richtlinie für die Oberfläche: nur eigene Skripte; Inline-Styles erlaubt (Designs, React). */
const OBERFLAECHE = [
  t('meldungen.koepfe.default-src-self'), t('meldungen.koepfe.script-src-self'), t('meldungen.koepfe.style-src-self-unsafe'), t('meldungen.koepfe.img-src-self-data'),
  t('meldungen.koepfe.font-src-self-data'), t('meldungen.koepfe.connect-src-self'), t('meldungen.koepfe.frame-src-self-blob'), t('meldungen.koepfe.worker-src-self-blob'),
  t('meldungen.koepfe.object-src-none'), t('meldungen.koepfe.base-uri-self'), t('meldungen.koepfe.form-action-self'),
];

export interface Antwort { pfad: string; https: boolean; html: boolean; csp: boolean }

export function sicherheitsKoepfe(a: Antwort, e: Einbetten): Record<string, string> {
  const vorfahren = t('meldungen.koepfe.frame-ancestors-self', { map: e.urspruenge.map((u) => ` ${u}`).join('') });
  const k: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'permissions-policy': t('meldungen.koepfe.geolocation-microphone-payment-usb'),
  };
  // X-Frame-Options kennt keine Liste – mit erlaubten Ursprüngen gilt nur frame-ancestors.
  if (!e.urspruenge.length) k['x-frame-options'] = 'SAMEORIGIN';
  if (a.https) k['strict-transport-security'] = 'max-age=31536000';
  if (!a.csp) {
    // Die Handbücher (/hilfe, mkdocs) brauchen eigene Inline-Skripte: dort nur frame-ancestors.
    if (a.html && !a.pfad.startsWith('/hilfe')) k['content-security-policy'] = [...OBERFLAECHE, vorfahren].join('; ');
    else k['content-security-policy'] = vorfahren;
  }
  return k;
}
