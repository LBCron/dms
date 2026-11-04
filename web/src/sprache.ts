/**
 * Texte der Weboberfläche aus den Sprachdateien (#473). Neue oder geänderte Texte kommen in
 * `shared/src/sprachen/de/<bereich>.json` und werden mit `t('<bereich>.<schluessel>', { platzhalter })`
 * abgerufen; ein neuer Bereich wird unten ergänzt. Anleitung: Entwicklerhandbuch → Aufbau → Texte.
 */
import { uebersetzer } from '../../shared/src/sprache';
import aehnlich from '../../shared/src/sprachen/de/aehnlich.json';
import api from '../../shared/src/sprachen/de/api.json';
import anmeldung from '../../shared/src/sprachen/de/anmeldung.json';
import termine from '../../shared/src/sprachen/de/termine.json';
import automatisierung from '../../shared/src/sprachen/de/automatisierung.json';
import pakete from '../../shared/src/sprachen/de/pakete.json';
import erkennung from '../../shared/src/sprachen/de/erkennung.json';
import felder from '../../shared/src/sprachen/de/felder.json';
import fragen from '../../shared/src/sprachen/de/fragen.json';
import ereignisse from '../../shared/src/sprachen/de/ereignisse.json';
import konten from '../../shared/src/sprachen/de/konten.json';
import lasttest from '../../shared/src/sprachen/de/lasttest.json';
import mappen from '../../shared/src/sprachen/de/mappen.json';
import profil from '../../shared/src/sprachen/de/profil.json';
import spalten from '../../shared/src/sprachen/de/spalten.json';
import suche from '../../shared/src/sprachen/de/suche.json';
import systemzustand from '../../shared/src/sprachen/de/systemzustand.json';
import volltext from '../../shared/src/sprachen/de/volltext.json';
import webhook from '../../shared/src/sprachen/de/webhook.json';
import werkbank from '../../shared/src/sprachen/de/werkbank.json';

export const t = uebersetzer({ aehnlich, api, anmeldung, automatisierung, erkennung, ereignisse, felder, fragen, konten, lasttest, mappen, pakete, profil, spalten, suche, systemzustand, termine, volltext, webhook, werkbank });
