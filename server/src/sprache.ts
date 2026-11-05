/**
 * Texte des Servers aus den Sprachdateien (#473): E-Mails, Fehlermeldungen der API, später PDFs.
 * Neue oder geänderte Texte kommen in `shared/src/sprachen/de/<bereich>.json` und werden hier mit
 * `t('<bereich>.<schluessel>', { platzhalter })` abgerufen; ein neuer Bereich wird unten ergänzt.
 */
import { uebersetzer } from '../../shared/src/sprache';
import einrichtung from '../../shared/src/sprachen/de/einrichtung.json';
import anmeldung from '../../shared/src/sprachen/de/anmeldung.json';
import mail from '../../shared/src/sprachen/de/mail.json';
import konten from '../../shared/src/sprachen/de/konten.json';
import mappen from '../../shared/src/sprachen/de/mappen.json';
import pakete from '../../shared/src/sprachen/de/pakete.json';
import systemzustand from '../../shared/src/sprachen/de/systemzustand.json';
import werkbank from '../../shared/src/sprachen/de/werkbank.json';
import api from '../../shared/src/sprachen/de/api.json';
import webhook from '../../shared/src/sprachen/de/webhook.json';
import automatisierung from '../../shared/src/sprachen/de/automatisierung.json';
import start from '../../shared/src/sprachen/de/start.json';

export const t = uebersetzer({ api, anmeldung, einrichtung, konten, mail, mappen, pakete, start, systemzustand, webhook, werkbank });
/** Texte der Automatisierungen (#678: Ergebnis der Dann-Karten, die der Server bereitstellt). */
export const tAuto = uebersetzer({ automatisierung });
