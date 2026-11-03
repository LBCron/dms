/**
 * Was ein Arbeiter erledigen kann (#542): alle PDF-Vorgänge der PDF-Stelle (#541) und die Tabellen großer
 * Exporte (Excel, CSV). Jeder Vorgang nimmt und liefert einfache Daten. Diese Datei lädt nur der Arbeiter –
 * oder der Hauptfaden selbst, wenn der Pool ausgeschaltet ist (`DMS_ARBEITER=0`).
 */
import { mappenPdfZeichnen } from '../pdf/export';
import { aufkleberbogenPdf } from '../pdf/aufkleber';
import { liesPdfA, textebeneWoerter } from '../pdf/archiv';
import { erzeugeDokument, type MappenInhalt } from '../pdf/demo-dokumente';
import { textdokumentPdf } from '../pdf/schreiber';
import { analysiere as analysiereSchwaerzen, arbeitsPdf, schwaerze, seitenbild as schwaerzSeitenbild } from '../pdf/schwaerzen';
import { baueSeiten, bilderZuPdf, bildSeitePdf, fuegeZusammen, seitenInfo, teileSeiten } from '../pdf/seiten';
import { bildAlsA4Pdf, stempelePdf } from '../pdf/stempel';
import { analysiere as analysiereVerkleinern, verkleinere as verkleinerePdf } from '../pdf/verkleinern';
import { csvAus, xlsxAus, type Zelle } from '../xlsx';
import { Zufall } from '../zufall';
import type { Dokumentart } from '../../../shared/src/demodaten';

/** Demo-Dokument mit dem Stand des Zufalls: Der Hauptfaden übernimmt den neuen Stand danach. */
async function demoDokument(zustand: { startwert: string; s: number }, art: Dokumentart, m: MappenInhalt, kennung: string, rastern: boolean) {
  const z = Zufall.aus(zustand);
  const dokument = await erzeugeDokument(z, art, m, kennung, rastern);
  return { dokument, zustand: z.zustand() };
}

/** Tabelle eines Exports als Excel und/oder CSV. */
function exportTabellen(t: { titel: string; kopf: string[]; text?: string[][]; werte?: Zelle[][] }) {
  return { xlsx: t.werte ? xlsxAus(t.titel, t.kopf, t.werte) : null, csv: t.text ? csvAus(t.kopf, t.text) : null };
}

export const VORGAENGE = {
  seitenInfo, baueSeiten, teileSeiten, fuegeZusammen, bilderZuPdf, bildSeitePdf,
  stempelePdf, bildAlsA4Pdf,
  analysiereVerkleinern, verkleinerePdf,
  analysiereSchwaerzen, schwaerze, schwaerzSeitenbild, arbeitsPdf,
  textdokumentPdf, mappenPdfZeichnen, aufkleberbogenPdf,
  liesPdfA, textebeneWoerter,
  demoDokument, exportTabellen,
};

export type Vorgaenge = typeof VORGAENGE;
export type Vorgang = keyof Vorgaenge;
