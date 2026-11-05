-- Sprachpakete (#731): Texte und Beschriftungen installierter Sprachpakete. Der Paketeintrag selbst steht wie bei jedem
-- Paket in „pakete“ (mit den Angaben unter daten.sprache); die Texte stehen hier, damit die Liste der Pakete klein bleibt.
-- texte: Bereich → Schlüssel → Text; paketbeschriftungen: Paket → Mappentypen und Ansichten (nur in dieser Sprache).
CREATE TABLE IF NOT EXISTS paket_sprachen (
  haushalt_id          uuid NOT NULL REFERENCES haushalte(id) ON DELETE CASCADE,
  paket_id             text NOT NULL,
  kennung              text NOT NULL,
  texte                jsonb NOT NULL,
  paketbeschriftungen  jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (haushalt_id, paket_id)
);
