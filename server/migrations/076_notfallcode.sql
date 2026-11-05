-- Notfallcode vom Notfallblatt (#815): Wer sich ausgesperrt hat, kommt über /notfall mit diesem Code wieder hinein.
-- Gespeichert ist nur ein Hash (scrypt wie beim Abrufcode), nie der Code. Er gilt einmal: Das Einlösen leert die
-- Zeile in derselben Transaktion, in der das neue Passwort gesetzt wird (zwei gleichzeitige Anfragen mit demselben
-- Code: nur eine gewinnt). Ein neuer Code entsteht mit jedem neuen Notfallblatt.
CREATE TABLE notfallcode (
  haushalt_id  uuid PRIMARY KEY REFERENCES haushalte(id) ON DELETE CASCADE,
  hash         text,
  erstellt     timestamptz NOT NULL DEFAULT now()
);
