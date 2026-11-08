-- KI-Dienste und Mappentypen (#796): KI-Pakete (Pakete mit Netz, die Inhalte lesen oder bekommen) bekommen nur Inhalte
-- aus Mappentypen, die für KI-Dienste zugelassen sind (Einstellung ki_typen, Liste „zugelassen“ mit Typ-Ids).
-- Neue Mappentypen stehen nicht darin – sie gehen erst an KI-Pakete, wenn der Administrator sie zulässt.
-- Bestehende Mappentypen bleiben wie bisher zugelassen, damit nichts still aufhört zu gehen; „hinweis“ zeigt in der
-- Werkbank einmal, dass man sie jetzt ausschließen kann. Benutzer-Mappen gehen ohnehin nie an Pakete.
-- Eine frische Installation hat hier noch keine Mappentypen: keine Einstellung, also alles erst nach Zulassung.
INSERT INTO einstellungen (haushalt_id, schluessel, wert)
SELECT h.id, 'ki_typen', jsonb_build_object(
  'zugelassen', (SELECT jsonb_agg(t.id::text ORDER BY t.id) FROM mappentypen t WHERE t.haushalt_id = h.id AND t.system IS DISTINCT FROM 'benutzer'),
  'hinweis', true)
FROM haushalte h
WHERE EXISTS (SELECT 1 FROM mappentypen t WHERE t.haushalt_id = h.id AND t.system IS DISTINCT FROM 'benutzer')
ON CONFLICT (haushalt_id, schluessel) DO NOTHING;
