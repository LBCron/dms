import './styles.css';
import { browserSprache, gemerkteSprache, ladeSprache } from './sprache';

/**
 * Start der Oberfläche. Zuerst die Sprache (#729): Der Server nennt die der angemeldeten Person, sonst die mitgeschickte
 * (zuletzt benutzte bzw. die des Browsers), sonst die der Installation. Erst danach kommen die übrigen Module – viele
 * bilden ihre Texte schon beim Laden.
 */
async function sprachwahl(): Promise<string> {
  const vorschlag = gemerkteSprache() ?? browserSprache();
  try {
    const r = await fetch('/api/sprache', { credentials: 'same-origin', cache: 'no-store', headers: { 'x-dms': '1', ...(vorschlag ? { 'x-sprache': vorschlag } : {}) } });
    if (r.ok) return ((await r.json()) as { sprache: string }).sprache;
  } catch { /* Server nicht erreichbar: weiter mit dem Gemerkten */ }
  return gemerkteSprache() ?? 'de';
}

async function starte() {
  await ladeSprache(await sprachwahl()).catch(() => {});
  const { zeige } = await import('./start');
  zeige();
}
void starte();
