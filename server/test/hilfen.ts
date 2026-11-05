/** Hilfen für Tests (keine eigenen Tests). */

/** Ein einfaches PDF mit Textebene (Helvetica), Text je Zeile. */
/** Einseitiges PDF mit Textebene; drehung (z. B. 90) setzt /Rotate der Seite (#395). */
export function pdfMitText(zeilen: string[], groesse = 24, drehung = 0): Buffer {
  const inhalt = `BT /F1 ${groesse} Tf 72 720 Td ${zeilen.map((z, i) => `${i ? `0 -${groesse * 1.4} Td ` : ''}(${z.replace(/[()\\]/g, '\\$&')}) Tj`).join(' ')} ET`;
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]${drehung ? ` /Rotate ${drehung}` : ''} /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(inhalt, 'latin1')} >>\nstream\n${inhalt}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let text = '%PDF-1.4\n';
  const versatz: number[] = [];
  objekte.forEach((o, i) => { versatz.push(Buffer.byteLength(text, 'latin1')); text += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(text, 'latin1');
  text += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${versatz.map((v) => `${String(v).padStart(10, '0')} 00000 n \n`).join('')}`;
  text += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, 'latin1');
}

/**
 * Verwaltungsmodus (#819) für Tests, die Handler direkt aufrufen: Die gespeicherte Person hat nur ihr Verwaltungsrecht;
 * wie im laufenden Modus wirkt sie mit `rolle: 'admin'`.
 */
export const imModus = <T extends { rolle?: string }>(b: T): T & { rolle: 'admin' } => ({ ...b, rolle: 'admin' as const });
/** Wie früher der Admin: Personen mit Verwaltungsrecht rufen Handler in diesen Tests im Verwaltungsmodus auf. */
export const wieImModus = <T extends { rolle?: string; verwaltung?: string[] }>(b: T): T => (b?.verwaltung?.length ? imModus(b) : b);
