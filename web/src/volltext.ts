import type { OcrStand } from '../../shared/src/model';
import { volltextHerkunft } from '../../shared/src/volltext';
import { t } from './sprache';

/** Woher der Volltext eines Dokuments kommt (#458), als kurzer Text – oder null, wenn es nichts zu sagen gibt. */
export function herkunftText(o: OcrStand | null | undefined): string | null {
  const h = volltextHerkunft(o);
  if (!h) return null;
  switch (h.art) {
    case 'pdf': return t('volltext.herkunft.pdf');
    case 'paket': return t('volltext.herkunft.paket', { paket: h.paket });
    case 'wartet': return h.paket ? t('volltext.herkunft.wartet', { paket: h.paket }) : t('volltext.herkunft.wartet-ohne');
    case 'eingebaut': return t('volltext.herkunft.eingebaut');
    case 'api': return t('volltext.herkunft.api');
  }
}
