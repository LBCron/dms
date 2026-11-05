-- Beschriftungen je Sprache (#728): Name und Beschreibung von Mappentypen und Ansichten in weiteren Sprachen.
--
-- Felder, Register und Trefferlisten liegen schon als JSON im Mappentyp; ihre Beschriftungen stehen dort mit. Für die
-- Angaben in eigenen Spalten (Name, Beschreibung) kommt je eine JSON-Spalte dazu: Sprache → { name, beschreibung }.
-- NULL heißt „keine Beschriftungen“ – es gilt der Ausgangstext.
--
-- An gespeicherten Werten ändert sich nichts: Die Optionen eines Auswahlfelds sind schon ihr eigener fester Wert, und
-- jede Mappe speichert weiter genau diesen Wert. Keine Zeile wird umgeschrieben.
ALTER TABLE mappentypen ADD COLUMN beschriftungen jsonb;
ALTER TABLE sichten ADD COLUMN beschriftungen jsonb;
