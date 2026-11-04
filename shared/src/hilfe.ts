/**
 * Kontextbezogene Hilfe (#110), Handbuch je Version (#111), offline im DMS (#219).
 *
 * Eine Tabelle: welche Stelle der Oberfläche auf welche Seite und welchen Abschnitt im Handbuch
 * zeigt. Die CI prüft gegen das gebaute Handbuch, dass jede Seite und jeder Anker existiert
 * (docs/handbuch/werkzeuge/hilfe-pruefen.ts) – eine umbenannte Überschrift fällt sofort auf.
 */

export const HANDBUCH_BASIS = 'https://help.ablago.app';
export type Handbuch = 'admin' | 'benutzer';
export interface Hilfeziel { handbuch: Handbuch; /** Seite mit Schrägstrich am Ende, z. B. „aufgaben/“. */ seite: string; anker?: string; /** „Hilfe zu …“ */ titel: string }

const admin = (seite: string, titel: string, anker?: string): Hilfeziel => ({ handbuch: 'admin', seite, titel, anker });
const benutzer = (seite: string, titel: string, anker?: string): Hilfeziel => ({ handbuch: 'benutzer', seite, titel, anker });

export const HILFE = {
  // Werkbank: Bereiche
  // Einrichtungsassistent (#278): je Schritt der passende Abschnitt – immer online, s. hilfeOnlineUrl.
  'einrichtung.code': admin('installation/', 'Einrichtungscode', 'einrichtungscode'),
  'einrichtung.datenbank': admin('installation/', 'Datenbank', 'datenbank'),
  'einrichtung.wahl': admin('installation/', 'Neu einrichten oder wiederherstellen', 'neu-einrichten-oder-wiederherstellen'),
  'einrichtung.mandant': admin('installation/', 'Name deiner Ablage', 'haushalt'),
  'einrichtung.administrator': admin('installation/', 'Administrator', 'administrator'),
  'einrichtung.benutzer': admin('installation/', 'Erster Benutzer', 'erster-benutzer'),
  'einrichtung.schluessel': admin('installation/', 'Schlüssel und Notfallblatt', 'schlussel-und-notfallblatt'),
  'einrichtung.pakete': admin('installation/', 'Pakete dazuholen', 'pakete-dazuholen'),
  'einrichtung.optional': admin('installation/', 'Optionales', 'optionales'),
  'einrichtung.fertig': admin('installation/', 'Fertig', 'fertig'),
  'werkbank.uebersicht': admin('uebersicht/', 'Übersicht', 'ubersicht'),
  'werkbank.ansicht': admin('uebersicht/', 'Werkbank anpassen', 'werkbank-anpassen'),
  'werkbank.typen': admin('mappentypen/', 'Mappentypen'),
  'werkbank.titelfilter': admin('mappentypen/', 'Platzhalter formatieren', 'platzhalter-formatieren'),
  'werkbank.sichten': admin('sichten/', 'Ansichten'),
  'werkbank.benutzer': admin('benutzer/', 'Benutzern und Rollen'),
  'werkbank.aufgabenempfaenger': admin('benutzer/', 'Aufgaben ohne Empfänger', 'aufgaben-ohne-empfanger'),
  'werkbank.systemkonten': admin('benutzer/', 'Systemkonten', 'systemkonten'),
  'werkbank.berechtigungen': admin('berechtigungen/', 'Berechtigungen'),
  'benutzer.wasSieht': admin('benutzer/', 'Was sieht ein Benutzer?', 'was-sieht-ein-benutzer'),
  'berechtigungen.grund': admin('berechtigungen/', 'Standard', 'standard'),
  'berechtigungen.regeln': admin('berechtigungen/', 'Regeln', 'regeln'),
  'berechtigungen.testlauf': admin('berechtigungen/', 'Testlauf', 'testlauf'),
  'werkbank.pakete_am_typ': admin('berechtigungen/', 'Pakete am Mappentyp', 'pakete-am-mappentyp'),
  'werkbank.aufgaben': admin('aufgaben/', 'Benachrichtigungen und Aufgaben', 'tagliche-zusammenfassung'),
  'werkbank.favoriten': admin('aufgaben/', 'Favoriten benachrichtigen', 'favoriten-benachrichtigen'),
  'werkbank.betrieb': admin('installation/', 'E-Mail und Adresse', 'e-mail-und-adresse'),
  'werkbank.verschluesselung': admin('verschluesselung/', 'Verschlüsselung'),
  'werkbank.designs': admin('designs/', 'Designs'),
  'werkbank.papierkorb': admin('papierkorb/', 'Papierkorb'),
  'werkbank.texterkennung': admin('texterkennung/', 'Texterkennung'),
  'werkbank.texterkennung.sprachpakete': admin('texterkennung/', 'Weitere Sprachen', 'weitere-sprachen'),
  'werkbank.texterkennung.umwandlung': admin('texterkennung/', 'Andere Dateitypen', 'andere-dateitypen'),
  'werkbank.texterkennung.archivfassung': admin('texterkennung/', 'Archivfassung (PDF/A)', 'archivfassung-pdfa'),
  'werkbank.eingangsordner': admin('eingangsordner/', 'Eingangsordner'),
  'werkbank.webdav': admin('webdav/', 'WebDAV-Laufwerk'),
  'werkbank.webhooks': admin('webhooks/', 'Webhooks'),
  'werkbank.postfaecher': admin('postfaecher/', 'Postfächer'),
  'werkbank.postfaecher.oauth': admin('postfaecher/', 'Anmeldung mit OAuth', 'anmeldung-mit-oauth'),
  'werkbank.nummernkreise': admin('nummernkreise/', 'Nummernkreise'),
  'werkbank.pakete': admin('pakete/', 'Pakete'),
  'werkbank.pakete.katalog': admin('pakete/', 'Im Katalog ansehen', 'im-katalog-ansehen'),
  'werkbank.pakete.sammeldatei': admin('pakete/', 'Pakete ohne Internet installieren', 'pakete-ohne-internet-installieren'),
  'werkbank.pakete.ablauf': admin('pakete/', 'Mehrere Pakete in einem Schritt installieren', 'mehrere-pakete-in-einem-schritt-installieren'),
  'werkbank.pakete.erstellen': admin('pakete/', 'Paket aus deinem Ablago erstellen', 'paket-aus-deinem-dms-erstellen'),
  'werkbank.pakete.umwandeln': admin('pakete/', 'Text in Verweise umwandeln', 'text-in-verweise-umwandeln'),
  // Herkunft eines Pakets (#594): signierter Katalog, eigener Katalog mit Schlüssel.
  'werkbank.pakete.herkunft': admin('pakete/', 'Herkunft: signiert oder nicht', 'herkunft-signiert-oder-nicht'),
  'werkbank.pakete.schluessel': admin('pakete/', 'Katalog mit eigenem Schlüssel', 'katalog-mit-eigenem-schlussel'),
  // Rechte-Vorschau eines Pakets mit Code (#449): je Recht und je Ereignis ein Abschnitt.
  'pakete.recht.lesen': admin('pakete/', 'dem Recht „Mappen lesen“', 'recht-mappen-lesen'),
  'pakete.recht.schreiben': admin('pakete/', 'dem Recht „Mappen anlegen und ändern“', 'recht-mappen-anlegen-und-andern'),
  'pakete.recht.dokumente': admin('pakete/', 'den Rechten an Dokumenten', 'recht-dokumente'),
  'pakete.vektoren': admin('pakete/', 'der Ähnlichkeit (Vektoren)', 'aehnlichkeit'),
  'pakete.recht.vektoren': admin('pakete/', 'dem Recht „Vektoren zu Dokumenten“', 'recht-vektoren'),
  'pakete.recht.netz': admin('pakete/', 'dem Zugriff auf Netzwerk und Internet', 'recht-netzwerk-und-internet'),
  'pakete.recht.antworten': admin('pakete/', 'dem Recht „Fragen an die Ablage beantworten“', 'recht-antworten'),
  'pakete.recht.erkennen': admin('pakete/', 'dem Recht „Felder aus Dokumenten vorschlagen“', 'recht-erkennen'),
  'pakete.recht.texterkennung': admin('pakete/', 'dem Recht „Texterkennung übernehmen“', 'recht-texterkennung'),
  'pakete.recht.umwandeln': admin('pakete/', 'dem Recht „Dateien umwandeln“', 'recht-umwandeln'),
  'pakete.recht.volltext': admin('pakete/', 'dem Recht „Volltext liefern“', 'recht-volltext'),
  'pakete.recht.archivfassung': admin('pakete/', 'dem Recht „Archivfassung ablegen“', 'recht-archivfassung'),
  'pakete.recht.sicherung': admin('pakete/', 'dem Recht „Sicherung lesen“', 'recht-sicherung-lesen'),
  'pakete.erkennung': admin('pakete/', 'der Erkennung durch ein Paket', 'erkennung-durch-ein-paket'),
  'pakete.recht.adresse': admin('pakete/', 'der Dienst-Adresse eines Pakets', 'dienst-adresse'),
  'pakete.fragen': admin('pakete/', '„Frag deine Ablage“ (Höchstmenge je Frage)', 'frag-deine-ablage'),
  'pakete.ereignisse': admin('pakete/', 'den Ereignissen für Pakete', 'ereignisse'),
  'pakete.ereignis.post_angelegt': admin('pakete/', 'dem Ereignis „Neue Post ist angelegt“', 'ereignis-post-angelegt'),
  'pakete.ereignis.dokument_hochgeladen': admin('pakete/', 'dem Ereignis „Ein Dokument wurde hochgeladen“', 'ereignis-dokument-hochgeladen'),
  'pakete.ereignis.texterkennung_fertig': admin('pakete/', 'dem Ereignis „Texterkennung fertig“', 'ereignis-texterkennung-fertig'),
  'pakete.ereignis.volltext_fertig': admin('pakete/', 'dem Ereignis „Volltext fertig“', 'ereignis-volltext-fertig'),
  'pakete.ereignis.einstellungen_geaendert': admin('pakete/', 'dem Ereignis „Einstellungen geändert“', 'ereignis-einstellungen-geandert'),
  'pakete.ereignis.datei_umwandeln': admin('pakete/', 'dem Ereignis „Datei umwandeln“', 'ereignis-datei-umwandeln'),
  'pakete.ereignis.datei_volltext': admin('pakete/', 'dem Ereignis „Datei braucht Volltext“', 'ereignis-datei-volltext'),
  'pakete.ereignis.datei_archivfassung': admin('pakete/', 'dem Ereignis „Archivfassung erstellen“', 'ereignis-datei-archivfassung'),
  'pakete.ereignis.sicherung_fertig': admin('pakete/', 'dem Ereignis „Sicherung fertig“', 'ereignis-sicherung-fertig'),
  'pakete.ereignis.mappe': admin('pakete/', 'den Ereignissen zu Mappen', 'ereignis-mappe'),
  'pakete.ereignis.frist_erreicht': admin('pakete/', 'dem Ereignis „Frist erreicht“', 'ereignis-frist-erreicht'),
  'mappentyp.archiv': admin('archiv/', 'Archivmodus und Aufbewahrung'),
  'werkbank.stempel': admin('stempel/', 'Stempel-Vorlagen'),
  'werkbank.automatisierungen': admin('automatisierungen/', 'Automatisierungen'),
  'werkbank.suche': admin('suche/', 'Suche: Tippfehler und gleichbedeutende Wörter'),
  'mappentyp.stempel': admin('stempel/', 'Stempel je Mappentyp', 'stempel-je-mappentyp'),
  'werkbank.vollexport': admin('export/', 'Daten exportieren'),
  'werkbank.vollexport.kontakte': admin('export/', 'Kontakte als vCard', 'kontakte-als-vcard'),
  'werkbank.aufbewahrung': admin('archiv/', '„Aufbewahrung abgelaufen“', 'nach-der-frist-aufbewahrung-abgelaufen'),
  'werkbank.datenschutz': admin('datenschutz/', 'Datenschutz in Ablago'),
  'werkbank.datenschutz.anrede': admin('datenschutz/', 'Anrede in Unterlagen für Dritte', 'anrede'),
  'werkbank.auskunft': admin('datenschutz/', 'Auskunft nach Art. 15 DSGVO', 'auskunft-nach-art-15-dsgvo'),
  'werkbank.auskunft.zustellen': admin('datenschutz/', 'Auskunft zustellen', 'auskunft-zustellen'),
  'werkbank.loeschkonzept': admin('loeschkonzept/', 'Löschkonzept aus Ablago erzeugen', 'aus-dem-dms-erzeugen'),
  'werkbank.loeschprotokoll': admin('datenschutz/', 'Löschprotokoll', 'loschprotokoll'),
  'werkbank.dateienpruefen': admin('archiv/', 'Alle Dateien prüfen', 'alle-dateien-prufen'),
  'werkbank.auswahlfilter': admin('mappentypen/', 'Auswahlfilter am Verweisfeld', 'auswahl-einschranken'),
  'werkbank.nummernkreise.nachtragen': admin('nummernkreise/', 'Nummern nachträglich vergeben', 'nummern-nachtraglich-vergeben'),
  'werkbank.aufkleber': admin('nummernkreise/', 'Aufkleber für Archivnummern', 'archivnummern-und-aufkleber'),
  'werkbank.region': admin('region/', 'Region'),
  'werkbank.anmeldeschutz': admin('anmeldeschutz/', 'Anmeldeschutz'),
  'werkbank.anbieter': admin('anmeldeschutz/', 'Anmeldung über einen Anbieter', 'anmeldung-uber-einen-anbieter-openid-connect'),
  'werkbank.zweifaktor': admin('anmeldeschutz/', 'Zwei-Faktor-Anmeldung', 'zwei-faktor-anmeldung'),
  'werkbank.wartung': admin('texterkennung/', 'Wartungsoperationen', 'wartungsoperationen'),
  'werkbank.wartung.volltext': admin('texterkennung/', 'Volltext neu erzeugen', 'volltext-neu-erzeugen'),
  'werkbank.wartung.absender': admin('texterkennung/', 'Absender bereinigen', 'absender-bereinigen'),
  'werkbank.wartung.formate': admin('texterkennung/', 'Angaben, die nicht zum Format passen', 'angaben-die-nicht-zum-format-passen'),
  'werkbank.protokoll': admin('fehlersuche/', 'Protokoll', 'protokoll'),
  'werkbank.fehlermeldungen': admin('fehlersuche/', 'Gemeldete Fehler', 'gemeldete-fehler'),
  'werkbank.datenbank': admin('installation/', 'Lange Datenbankzugriffe', 'lange-datenbankzugriffe'),
  'werkbank.technik': admin('fehlersuche/', 'Technik', 'technik'),
  'werkbank.demo': admin('demo/', 'Demo-Daten'),
  'werkbank.sicherung': admin('sicherung/', 'Sicherung'),
  'werkbank.wiederherstellung': admin('wiederherstellen/', 'Wiederherstellen'),
  'werkbank.wartungsmodus': admin('wartungsmodus/', 'Wartungsmodus'),
  'wartungsmodus.sofort': admin('wartungsmodus/', 'Jetzt sofort sperren', 'jetzt-sofort-sperren'),
  'werkbank.speicherplatz': admin('speicherplatz/', 'Systemzustand'),
  'werkbank.auslastung': admin('speicherplatz/', 'Auslastung', 'auslastung'),
  'werkbank.grenzen': admin('technik/', 'Viele gleichzeitige Anfragen', 'last'),
  'werkbank.erweiterungen': admin('suche/', 'Erweiterungen der Datenbank', 'erweiterungen-der-datenbank'),
  'werkbank.verkleinern': admin('speicherplatz/', 'Große PDFs verkleinern', 'grosse-pdfs-verkleinern'),
  'werkbank.anbindung': admin('installation/', 'der Datenbank-Anbindung', 'datenbank-anbindung'),
  // Werkbank: Zwischenüberschriften langer Seiten
  'mappentyp.felder': admin('mappentypen/', 'Feldern', 'felder'),
  'mappentyp.register': admin('mappentypen/', 'Registern', 'register'),
  'mappentyp.trefferlisten': admin('mappentypen/', 'Trefferlisten', 'trefferlisten'),
  'mappentyp.ziehen': admin('mappentypen/', 'Ziehen statt klicken', 'ziehen-statt-klicken'),
  'sicht.trefferliste': admin('sichten/', 'der Trefferliste einer Ansicht', 'trefferliste'),
  'sicht.bedingungen': admin('sichten/', 'Bedingungen', 'bedingungen'),
  'sicht.berechtigungen': admin('sichten/', 'Berechtigungen an Ansichten', 'berechtigungen'),
  'benutzer.abwesenheit': admin('benutzer/', 'Abwesenheit', 'abwesenheit'),
  'benutzer.sperren': admin('benutzer/', 'Zugang sperren', 'zugang-sperren'),
  'verschluesselung.schluessel': admin('verschluesselung/', 'Schlüssel', 'schlussel-erzeugen'),
  'verschluesselung.wechseln': admin('verschluesselung/', 'Schlüssel wechseln', 'schlussel-wechseln'),
  'verschluesselung.arten': admin('verschluesselung/', 'Was verschlüsselt ist', 'was-verschlusselt-ist'),
  'sicherung.zeitplan': admin('sicherung/', 'Zeitplan und Aufbewahrung', 'zeitplan-und-aufbewahrung'),
  'sicherung.speicher': admin('sicherung/', 'Speicherplatz', 'speicherplatz'),
  'sicherung.ort': admin('sicherung/', 'Speicherort', 'speicherort'),
  'sicherung.notfallblatt': admin('sicherung/', 'Notfallblatt', 'notfallblatt'),
  'sicherung.extern': admin('sicherung-ausser-haus/', 'Sicherung außer Haus'),
  'sicherung.probe': admin('wiederherstellen/', 'Probe-Wiederherstellung', 'probe-wiederherstellung'),
  // Ablage und Profil: Benutzerhandbuch
  'ablage.eingang': benutzer('eingang/', 'Zu erledigen und Aufgaben'),
  'ablage.start': benutzer('startseite/', 'Startseite'),
  'profil.laufwerk': benutzer('laufwerk/', 'Als Laufwerk einbinden'),
  'stempel.weitergeben': benutzer('versenden/', 'Weitergeben mit Stempel', 'weitergeben-mit-stempel'),
  'ablage.email': benutzer('versenden/', 'mehreren Mappen per E-Mail', 'mehrere-mappen-per-e-mail'),
  'ablage.anstehend': benutzer('eingang/', 'Anstehend', 'anstehend'),
  'ablage.erinnern': benutzer('eingang/', 'Erinnern', 'erinnern'),
  'mappentyp.erkennungstyp': admin('mappentypen/', 'Erkennung', 'erkennung'),
  'mappentyp.erkennung': admin('mappentypen/', 'Für die Erkennung nutzen', 'fur-die-erkennung-nutzen'),
  'mappentyp.frist': admin('mappentypen/', 'Erinnerungen an Datumsfeldern', 'fristen-erinnerungen-an-datumsfeldern'),
  'mappentyp.format': admin('mappentypen/', 'Formate und Datumsgrenzen', 'formate-und-datumsgrenzen'),
  'ablage.favoriten': benutzer('ablage/', 'Favoriten', 'favoriten'),
  'ablage.papierkorb': benutzer('ablage/', 'Papierkorb', 'papierkorb'),
  'mappe.mitVerknuepften': benutzer('mappen/', 'Mit verknüpften Mappen löschen', 'mit-verknupften-mappen-loschen'),
  'ablage.sicht': benutzer('ablage/', 'Ansichten und Listen', 'die-liste'),
  'ablage.erweitertesuche': benutzer('ablage/', 'Erweiterte Suche', 'erweiterte-suche'),
  'ablage.aehnlich': benutzer('dokumente/', 'ähnlichen Dokumenten', 'aehnliche-dokumente'),
  'ablage.fragen': benutzer('startseite/', '„Frag deine Ablage“', 'frag-deine-ablage'),
  'ablage.suchvolltext': benutzer('ablage/', 'Volltext in der erweiterten Suche', 'volltext-in-dokumenten-und-notizen'),
  'ablage.post': benutzer('post/', 'Post'),
  'post.zuordnen': benutzer('post/', 'Zuordnen', 'zuordnen'),
  'mappe.ausdokument': benutzer('mappen/', 'Aus Dokument ausfüllen', 'aus-dokument-ausfullen'),
  'post.erkennung': benutzer('post/', 'Vorschläge beim Zuordnen', 'vorschlage-beim-zuordnen'),
  'dokumente.sortieren': benutzer('dokumente/', 'Sortieren von Dokumenten', 'sortieren'),
  'dokumente.mehrere': benutzer('dokumente/', 'mehreren Dokumenten auf einmal', 'mehrere-auf-einmal'),
  'dokumente.versionen': benutzer('versionen/', 'Versionen verstehen'),
  'dokumente.seiten': benutzer('dokumente/', 'PDF bearbeiten', 'pdf-bearbeiten'),
  'dokumente.verkleinern': benutzer('dokumente/', 'PDF verkleinern', 'pdf-verkleinern'),
  'dokumente.schwaerzen': benutzer('dokumente/', 'Schwärzen', 'schwaerzen'),
  'versenden.verkleinert': benutzer('versenden/', 'Verkleinert weitergeben', 'verkleinert-weitergeben'),
  'dokumente.archivnummer': benutzer('dokumente/', 'Archivnummer', 'archivnummer'),
  'dokumente.sprachen': benutzer('dokumente/', 'Dokumente in mehreren Sprachen', 'mehrere-sprachen'),
  'dokumente.archivfassung': benutzer('dokumente/', 'Archivfassung (PDF/A)', 'archivfassung-pdfa'),
  'profil.rechte': benutzer('profil/', 'deinen Rechten', 'meine-rechte'),
  'profil.abwesenheit': benutzer('profil/', 'Abwesenheit', 'abwesenheit'),
  'profil.export': benutzer('profil/', 'Meine Daten exportieren', 'meine-daten-exportieren'),
  'profil.zweifaktor': benutzer('profil/', 'Zwei-Faktor-Anmeldung', 'zwei-faktor-anmeldung'),
  'profil.benachrichtigungen': benutzer('profil/', 'Benachrichtigungen', 'benachrichtigungen'),
  'profil.webhooks': benutzer('hausautomatisierung/', 'Sofort melden (Webhook)', 'sofort-melden-webhook'),
  'profil.favoriten': benutzer('ablage/', 'Favoriten als Abo', 'favoriten-als-abo'),
} as const satisfies Record<string, Hilfeziel>;
export type Hilfeort = keyof typeof HILFE;

/**
 * Online gibt es nur noch „aktuell“ (#846). Ältere Fassungen bringt jede Installation unter /hilfe/ mit.
 */
export const HANDBUCH_ONLINE_ORDNER = 'aktuell';

/**
 * Handbuch im DMS selbst (#219): Das Image bringt die Handbücher seiner Version mit, ohne Internet
 * lesbar unter /hilfe/. Ohne gebaute Handbücher (Entwicklung) leitet der Server auf die Online-Fassung um.
 */
export function handbuchUrl(handbuch: Handbuch, _version: string | null | undefined, seite = ''): string {
  return `/hilfe/${handbuch}/${seite}`;
}

/** Dieselbe Seite online, immer in der aktuellen Fassung (#846). */
export function handbuchOnlineUrl(handbuch: Handbuch, seite = ''): string {
  return `${HANDBUCH_BASIS}/${handbuch}/${HANDBUCH_ONLINE_ORDNER}/${seite}`;
}

/**
 * Hilfe im Einrichtungsassistenten (#278): immer das Online-Handbuch der aktuellen Version –
 * ob ein lokales Handbuch erreichbar ist, steht dort noch nicht fest.
 */
export function hilfeOnlineUrl(ziel: Hilfeziel): string {
  return `${handbuchOnlineUrl(ziel.handbuch, ziel.seite)}${ziel.anker ? `#${ziel.anker}` : ''}`;
}
/** Anleitungen je Plattform: „Wie komme ich an ein DMS?“ */
export const INSTALLIEREN_URL = `${HANDBUCH_BASIS}/installieren/${HANDBUCH_ONLINE_ORDNER}/`;

export function hilfeUrl(ziel: Hilfeziel, version: string | null | undefined): string {
  return `${handbuchUrl(ziel.handbuch, version, ziel.seite)}${ziel.anker ? `#${ziel.anker}` : ''}`;
}

export const HANDBUCH_NAME: Record<Handbuch, string> = { admin: 'Administratorhandbuch', benutzer: 'Benutzerhandbuch' };
