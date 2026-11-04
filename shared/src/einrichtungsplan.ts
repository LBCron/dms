/**
 * Einrichtungsplan (#804, #806): alles, was der Einrichtungsassistent sammelt, bevor er mit „Jetzt einrichten“
 * etwas anlegt – und was in der Konfigurationsdatei steht. Weboberfläche und Server teilen diese Form.
 *
 * Geheimnisse gehören nie hierher: Passwörter stehen höchstens als Verweis auf eine Umgebungsvariable da
 * (`${DMS_ADMIN_PASSWORT}`), für eine spätere Einrichtung ohne Oberfläche. Den Schlüssel erzeugt Ablago immer neu.
 */

/** Formatversion der Konfigurationsdatei (Kopfzeile `ablago-einrichtung: 1`). */
export const EINRICHTUNG_FORMAT = 1;

/** Verweis auf eine Umgebungsvariable statt eines Passworts, z. B. `${DMS_ADMIN_PASSWORT}`. */
export const VERWEIS_MUSTER = '^\\$\\{[A-Z][A-Z0-9_]{0,63}\\}$';
export const istVerweis = (v: unknown): v is string => typeof v === 'string' && new RegExp(VERWEIS_MUSTER).test(v);

export type PlanVerbindung = 'starttls' | 'ssl' | 'keine';
export const PLAN_VERBINDUNGEN: readonly PlanVerbindung[] = ['starttls', 'ssl', 'keine'];

export interface PlanDatenbank { host: string; port: number; datenbank: string; benutzer: string; /** nur ein Verweis */ passwort?: string }
export interface PlanMail {
  aktiv: boolean; host: string; port: number; verbindung: PlanVerbindung; benutzer: string; absender: string; selbstsigniert: boolean;
  /** nur ein Verweis */
  passwort?: string;
}
export interface PlanPaket {
  id: string;
  /** Beispiel-Mappen des Pakets anlegen. */
  beispiele: boolean;
  /** Mitgelieferte Automatisierungen (#712): Schlüssel → eingeschaltet. */
  automatisierungen: Record<string, boolean>;
}

export interface Einrichtungsplan {
  datenbank: PlanDatenbank | null;
  /** Name der Ablage (Mandant). */
  ablage: string;
  administrator: { name: string; email: string; /** nur ein Verweis */ passwort?: string };
  /** null: kein erster Benutzer. */
  benutzer: { name: string; email: string; /** Aufgaben ohne Empfänger an diesen Benutzer (#719). */ aufgabenOhneEmpfaenger: boolean } | null;
  /** null: noch nicht festgelegt bzw. übersprungen; []: bewusst keine. */
  pakete: PlanPaket[] | null;
  optional: {
    /** null: keine Adresse gepflegt – Links nutzen die Adresse der Anfrage. */
    adresse: string | null;
    /** Bundesland für die Feiertage (#726); null: keins. */
    bundesland: string | null;
    /** Beispiel-Mappentypen laden. */
    beispiele: boolean;
    mail: PlanMail | null;
  };
}

/** Ein Fehler in der Datei: Zeile (ab 1, wenn bekannt), Feld wie `administrator.email` oder `pakete[1].id`, Text. */
export interface DateiFehler { zeile: number | null; feld: string; text: string }

/** Die Schritte, die der Assistent sammelt – in dieser Reihenfolge. */
export const SAMMELSCHRITTE = ['ablage', 'administrator', 'benutzer', 'pakete', 'optional'] as const;
export type Sammelschritt = (typeof SAMMELSCHRITTE)[number];
/** Was in einem Schritt nicht passt – je Schritt die Gründe. */
export type Planprobleme = Partial<Record<Sammelschritt, string[]>>;
