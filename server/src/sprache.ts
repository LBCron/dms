/**
 * Texte des Servers aus den Sprachdateien (#473): E-Mails, Fehlermeldungen der API, später PDFs.
 * Neue oder geänderte Texte kommen in `shared/src/sprachen/de/<bereich>.json` und werden hier mit
 * `t('<bereich>.<schluessel>', { platzhalter })` abgerufen; ein neuer Bereich wird unten ergänzt.
 */
import { uebersetzer } from '../../shared/src/sprache';
import anmeldung from '../../shared/src/sprachen/de/anmeldung.json';
import mail from '../../shared/src/sprachen/de/mail.json';
import mappen from '../../shared/src/sprachen/de/mappen.json';
import pakete from '../../shared/src/sprachen/de/pakete.json';
import systemzustand from '../../shared/src/sprachen/de/systemzustand.json';
import werkbank from '../../shared/src/sprachen/de/werkbank.json';
import api from '../../shared/src/sprachen/de/api.json';

export const t = uebersetzer({ api, anmeldung, mail, mappen, pakete, systemzustand, werkbank });
