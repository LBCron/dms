-- Systemkonten (#673): Konten des DMS selbst, die kein Mensch sind – zuerst „Automatisierung“, unter dem
-- Automatisierungen laufen. Wie die Dienstkonten der Pakete (#338): kein Passwort, keine Sitzung, kein API-Schlüssel,
-- in keiner Auswahlliste. art = 'system', systemkonto = feste Kennung (z. B. automatisierung), je Haushalt einmal.
ALTER TABLE benutzer DROP CONSTRAINT IF EXISTS benutzer_art;
ALTER TABLE benutzer ADD CONSTRAINT benutzer_art CHECK (art IN ('person', 'dienst', 'system'));
ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS systemkonto text;
CREATE UNIQUE INDEX IF NOT EXISTS benutzer_systemkonto ON benutzer (haushalt_id, systemkonto) WHERE art = 'system';
