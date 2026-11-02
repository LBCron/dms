-- Volltext je Dokumentsprache (#400): Die Sprache steht als eigenes Feld am Dokument (dokumente.sprache, Migration 048,
-- Tesseract-Kennung wie „fra“); setzen können sie die Texterkennung, die API v1 und Pakete (ab Etappe 07 das Paket
-- Texterkennung 2.0). Der Suchindex nimmt schon seit 048 die Konfiguration der Sprache (dms_konfig) – hier bekommen
-- die vorhandenen Dokumente ihre Sprache aus dem Hinweis der Texterkennung (ocr_info, „· Sprache: fra (87 %)“, #395).
--
-- Nur Sprachen, die das DMS kennt, und nur andere als Deutsch: Leer heißt Deutsch, so baut das Update nur den
-- Suchindex dieser Dokumente neu (Trigger dokumente_suchindex), nicht den aller.
UPDATE dokumente d SET sprache = x.s
FROM (SELECT id, substring(ocr_info FROM '· Sprache: ([a-z_]{3,10})') AS s FROM dokumente WHERE sprache IS NULL AND ocr_info LIKE '%· Sprache: %') x
WHERE d.id = x.id AND x.s IN ('eng', 'fra', 'spa', 'ita', 'nld', 'tur', 'pol', 'por', 'rus', 'ukr', 'ara');

-- Welche Sprachen eine Ablage hat (für die Suchanfrage je Sprache): schnell über einen Teilindex.
CREATE INDEX dokumente_sprache ON dokumente (haushalt_id, sprache) WHERE sprache IS NOT NULL;
