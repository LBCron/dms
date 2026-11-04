/**
 * Wohin nach der Anmeldung (#721): Administratoren landen in der Werkbank, alle anderen in der Ablage.
 *
 * Ein Konto mit Administrator-Rechten arbeitet im Alltag nicht in der Ablage – deshalb gibt es keine Wahl.
 * Ein Link in die Werkbank (oder nach „Mein Konto“) hat Vorrang; ein Link in die Ablage führt Admins in die
 * Werkbank-Übersicht. Die Ablage bleibt über die Leiste oben jederzeit erreichbar (z. B. für die Fehlersuche).
 */
export const ADMIN_START = '/werkbank';

/** Ziel nach der Anmeldung; `null` = bleiben, wo man ist. */
export function zielNachAnmeldung(rolle: string | undefined, ziel: string | null): string | null {
  if (rolle !== 'admin') return ziel;
  if (ziel && /^\/(werkbank|profil|api-doku)(\/|\?|#|$)/.test(ziel)) return ziel;
  return ADMIN_START;
}

/** Startseite, wenn man „/“ aufruft oder auf das Logo klickt. */
export const startseiteVon = (rolle: string | undefined, ohneStartseite = false) =>
  rolle === 'admin' ? ADMIN_START : ohneStartseite ? '/ablage/eingang' : '/ablage/start';
