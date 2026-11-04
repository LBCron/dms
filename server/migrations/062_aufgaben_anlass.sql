-- Ein Weg für Aufgaben (#724): Anlass einer Aufgabe (Datum, Post, Abwesenheit) – fällt er weg, erledigt sie sich selbst.
-- Kern und Automatisierungen teilen ihn (shared/src/model.ts, AufgabenAnlass).
ALTER TABLE aufgaben ADD COLUMN anlass jsonb;

-- Fristen: je Mappe, Feld, Datum und Empfänger höchstens eine (bisher je Mappe, Feld und Datum). Eine Automatisierung
-- „Datum erreicht“ kann so mehrere Personen erinnern; dieselbe Person bekommt nie zwei (auch nicht neben der eingebauten).
DROP INDEX IF EXISTS aufgaben_frist_idx;
CREATE UNIQUE INDEX aufgaben_frist_idx ON aufgaben (mappe_id, feld_key, datum, coalesce(empfaenger_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE art = 'frist';
