-- Zahl „Zu erledigen“ schneller (#928): offene Aufgaben je Empfänger mit ihrer Mappe. Die Zählung (repo-pg.ts
-- `eingangSql`) liest daraus ohne Zugriff auf die Tabelle die Mappen mit offenen Aufgaben für eine Person bzw. ohne
-- Empfänger (empfaenger_id IS NULL steht im Index). Der bisherige Index (haushalt_id, empfaenger_id) bleibt für die
-- Listen der offenen Aufgaben.
CREATE INDEX IF NOT EXISTS aufgaben_offen_empfaenger_idx ON aufgaben (empfaenger_id, mappe_id) WHERE erledigt IS NULL;
