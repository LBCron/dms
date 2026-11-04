-- Fehlgeschlagene Läufe „nicht wiederholen“ (#707): Der Lauf bleibt fehlgeschlagen und im Verlauf stehen, verschwindet
-- aber aus dem Hinweis „… fehlgeschlagen“ und aus „Alle wiederholen“ – mit Person und Zeitpunkt. Nichts wird gelöscht.
ALTER TABLE automatisierung_laeufe ADD COLUMN nicht_wiederholt_von uuid;
ALTER TABLE automatisierung_laeufe ADD COLUMN nicht_wiederholt_zeit timestamptz;
