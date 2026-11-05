import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

/**
 * Ablage der eigentlichen Dateien, adressiert über ihren SHA-256.
 * Dateien werden nie verändert, nur angelegt und (wenn kein Dokument
 * mehr darauf zeigt) gelöscht.
 */
export interface Dateispeicher {
  schreibe(sha256: string, inhalt: Buffer): Promise<void>;
  /**
   * Eine fertige Datei (Upload als Strom, #746) übernehmen: umbenennen statt neu schreiben. Die Datei ist danach weg
   * (übernommen oder, wenn der Inhalt schon da war, gelöscht). Fehlt die Methode, liest der Aufrufer die Datei und
   * schreibt sie.
   */
  uebernimm?(sha256: string, datei: string): Promise<void>;
  lies(sha256: string): Promise<Readable | Buffer>;
  loesche(sha256: string): Promise<void>;
}

const pruefeSha = (sha: string) => {
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error('Ungültiger Prüfwert');
  return sha;
};

/** Dateisystem: <wurzel>/<haushalt>/<ab>/<sha256> */
export function ordnerSpeicher(wurzel: string, haushaltId: string): Dateispeicher {
  const pfad = (sha: string) => join(wurzel, haushaltId, pruefeSha(sha).slice(0, 2), sha);
  return {
    async schreibe(sha, inhalt) {
      const ziel = pfad(sha);
      if (await stat(ziel).then(() => true, () => false)) return; // gleicher Inhalt liegt schon da
      await mkdir(join(ziel, '..'), { recursive: true });
      const tmp = `${ziel}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, inhalt, { flag: 'wx' });
      await rename(tmp, ziel); // erst vollständig geschrieben, dann sichtbar
    },
    async uebernimm(sha, datei) {
      const ziel = pfad(sha);
      if (await stat(ziel).then(() => true, () => false)) { await rm(datei, { force: true }); return; }
      await mkdir(join(ziel, '..'), { recursive: true });
      // Rechte wie bei writeFile (temporäre Uploads sind 0600).
      await chmod(datei, 0o644);
      try { await rename(datei, ziel); } catch (e) {
        // Anderes Laufwerk (eigenes Volume für files/hochladen): kopieren, dann wie oben erst vollständig sichtbar.
        if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
        const tmp = `${ziel}.${process.pid}.${Date.now()}.tmp`;
        await copyFile(datei, tmp);
        await rename(tmp, ziel);
        await rm(datei, { force: true });
      }
    },
    async lies(sha) { return createReadStream(pfad(sha)); },
    async loesche(sha) { await rm(pfad(sha), { force: true }); },
  };
}

export function speicherDateien(): Dateispeicher & { anzahl(): number } {
  const m = new Map<string, Buffer>();
  return {
    async schreibe(sha, inhalt) { m.set(pruefeSha(sha), Buffer.from(inhalt)); },
    async uebernimm(sha, datei) { m.set(pruefeSha(sha), await readFile(datei)); await rm(datei, { force: true }); },
    async lies(sha) { const b = m.get(sha); if (!b) throw new Error('Datei fehlt'); return b; },
    async loesche(sha) { m.delete(sha); },
    anzahl: () => m.size,
  };
}

/** Vor jedem Schreiben prüfen, z. B. ob noch genug Speicherplatz frei ist (#116). */
export function mitPruefung(s: Dateispeicher, vorher: () => Promise<void>): Dateispeicher {
  return {
    async schreibe(sha, inhalt) { await vorher(); await s.schreibe(sha, inhalt); },
    ...(s.uebernimm ? { uebernimm: async (sha: string, datei: string) => { await vorher(); await s.uebernimm!(sha, datei); } } : {}),
    lies: (sha) => s.lies(sha),
    loesche: (sha) => s.loesche(sha),
  };
}
