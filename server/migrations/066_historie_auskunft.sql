-- Verzeichnis der Auskünfte (#668): Einträge der Art „auskunft“ schnell finden, ohne die ganze Historie zu lesen.
CREATE INDEX IF NOT EXISTS historie_auskunft_idx ON historie (haushalt_id, zeit DESC) WHERE art = 'auskunft';
