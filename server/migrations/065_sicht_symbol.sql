-- Symbol je Ansicht (#428): Lucide-Name aus der festen Auswahl (shared/src/ansichtsymbole.ts); NULL = ohne Symbol.
ALTER TABLE sichten ADD COLUMN IF NOT EXISTS symbol text;
-- Die mitgelieferte Ansicht „Neue Post“ (#192) bekommt ihr Symbol, wie es bisher fest in der Ablage stand.
UPDATE sichten SET symbol = 'inbox' WHERE symbol IS NULL AND name = 'Neue Post' AND bedingungen::text LIKE '%"stand"%';
