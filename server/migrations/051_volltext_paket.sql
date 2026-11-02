-- Texterkennung als Paket (#458): Neuer Stand „paket“ – der Kern hat die Textebene gelesen (poppler) und wartet,
-- bis das Paket mit der Schnittstelle dms:texterkennung den Volltext schreibt (oder meldet, dass es nichts zu tun gibt).
-- Text aus dem PDF bleibt dabei in volltext stehen, die Suche findet ihn schon.
ALTER TABLE dokumente DROP CONSTRAINT IF EXISTS dokumente_ocr_stand_check;
ALTER TABLE dokumente ADD CONSTRAINT dokumente_ocr_stand_check
  CHECK (ocr_stand IN ('keiner', 'wartet', 'laeuft', 'fertig', 'fehler', 'ausgelassen', 'paket'));
