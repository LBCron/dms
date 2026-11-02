import { useEffect, useState } from 'react';
import { kernTyp } from '../../../shared/src/dateiumwandlung';
import { vorschauUrl } from '../api';
import { t } from '../sprache';

/**
 * Kleines Vorschaubild der ersten Seite (#332), 40 × 52 px.
 * Gibt es (noch) keins, steht dort ein Dateisymbol mit der Endung. Direkt nach dem Hochladen
 * entsteht das Bild im Hintergrund – deshalb zwei weitere Versuche nach kurzer Zeit.
 * Andere Dateitypen (#577) haben eins, wenn ein Paket sie umgewandelt hat: ein Versuch; das Bild ist als Vorschau
 * aus der umgewandelten Fassung gekennzeichnet.
 */

const endung = (name: string, mime: string) => {
  const e = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1];
  if (e) return e.toUpperCase();
  return mime === 'application/pdf' ? 'PDF' : mime.startsWith('image/') ? 'BILD' : 'DATEI';
};

export function Vorschaubild({ d }: { d: { id: string; name: string; mime: string; sha256: string } }) {
  const moeglich = kernTyp(d.mime);
  const [versuch, setVersuch] = useState(0);
  // Ohne erkannten Dateityp (octet-stream) gibt es auch keine Fassung: gleich das Dateisymbol.
  const ohne = d.mime === 'application/octet-stream';
  const [fehlt, setFehlt] = useState(ohne);
  useEffect(() => { setVersuch(0); setFehlt(ohne); }, [d.id, d.sha256, moeglich, ohne]);
  useEffect(() => {
    if (!fehlt || !moeglich || versuch >= 2) return;
    const t = setTimeout(() => { setVersuch((v) => v + 1); setFehlt(false); }, 2500 * (versuch + 1));
    return () => clearTimeout(t);
  }, [fehlt, moeglich, versuch]);
  return fehlt
    ? <span className="vorschaubild ohne" aria-hidden="true">{endung(d.name, d.mime)}</span>
    : <img className="vorschaubild" src={vorschauUrl(d, versuch)} alt="" title={moeglich ? undefined : t('volltext.vorschau.fassung')} width={40} height={52} loading="lazy" decoding="async" onError={() => setFehlt(true)} />;
}
