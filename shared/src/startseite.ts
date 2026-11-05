/**
 * Wohin nach der Anmeldung (#721, angepasst an den Verwaltungsmodus #819): `rolle` ist die wirksame Rolle – `admin`
 * nur im Verwaltungsmodus. Im Modus ist die Startseite die Werkbank, ohne Modus die Ablage. Nach einer Anmeldung läuft
 * nie ein Modus, also führt sie immer in die Ablage (oder zum Link, von dem sie ausging).
 *
 * Im Modus hat ein Link in die Werkbank (oder nach „Mein Konto“) Vorrang; die Ablage bleibt über die Leiste oben
 * erreichbar (Fehlersuche).
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
