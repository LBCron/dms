/**
 * Die gemeinsame PDF-Stelle (#541). Alle Arbeiten an PDFs mit pdf-lib laufen über diesen Ordner; nur
 * hier wird pdf-lib eingebunden (die Prüfung `test/pdf-stelle.test.ts` sperrt Importe anderswo). Ein
 * späterer Austausch der Bibliothek trifft damit nur diesen Ordner.
 *
 * Die Vorgänge nehmen und liefern einfache Daten (Bytes, Zahlen, Texte, Listen) – keine Objekte der
 * Bibliothek. So lassen sie sich auch in einem Arbeiter-Faden ausführen (#542).
 *
 * Aufbau:
 * - `seiten.ts`        Seiten zählen, drehen, löschen, umsortieren, teilen, zusammenfügen, Fotos als Seiten
 * - `stempel.ts`       Stempel und Fußzeile (Weitergeben, #394), Bild als A4-Seite
 * - `verkleinern.ts`   Bilder herunterrechnen, Struktur aufräumen (#393)
 * - `schwaerzen.ts`    Seiten neu aufbauen, Bereiche schwärzen, Textebene ohne geschwärzte Wörter (#392)
 * - `schreiber.ts`     Textdokumente nach Plan (Auskunft, Löschkonzept, Löschprotokoll)
 * - `export.ts`        PDF mehrerer Mappen (#152)
 * - `aufkleber.ts`     Aufkleberbogen mit Barcode (#345)
 * - `demo-dokumente.ts` Demo-Dokumente für Wachstumstests (#248)
 * - `einfach.ts`      sehr kleiner Schreiber für Textseiten ohne Bibliothek (Notfallblatt, #106)
 * - `bild.ts`, `puffer.ts`, `text.ts` kleine Helfer (Bildart, EXIF, Umgehung #456, WinAnsi)
 */
export { pdfAus, type Absatz, type Schrift } from './einfach';
export { bildArt, exifAusrichtung, jpegMasse } from './bild';
export { eigenerPuffer } from './puffer';
export { groesseText, pdfSicher } from './text';
export { baueSeiten, bilderZuPdf, bildSeitePdf, fuegeZusammen, seitenInfo, teileSeiten, type SeitenWahl } from './seiten';
export { bildAlsA4Pdf, stempelePdf, type StempelAuftrag } from './stempel';
export {
  analysiere as analysiereVerkleinern, hatQpdf, operatoren, verkleinere as verkleinerePdf,
  type Analyse as VerkleinerAnalyse, type Ergebnis as VerkleinerErgebnis,
} from './verkleinern';
export {
  ANSICHT_PX, SCHWAERZEN_DPI, analysiere as analysiereSchwaerzen, arbeitsPdf, liesBbox, liesTsv, maleSchwarz, pnmKopf, schwaerze,
  seitenbild as schwaerzSeitenbild, textAus, verbleibende, type Analyse as SchwaerzAnalyse, type Ergebnis as SchwaerzErgebnis,
} from './schwaerzen';
export { planer, textdokumentPdf, type Anweisung, type Textdokument } from './schreiber';
export { mappenPdfZeichnen, type MappenPdfDaten, type PdfMappenSeite } from './export';
export { aufkleberbogenPdf, type Aufkleberbogen } from './aufkleber';
export { erzeugeDokument, kannRastern, png, type ErzeugtesDokument, type MappenInhalt } from './demo-dokumente';
