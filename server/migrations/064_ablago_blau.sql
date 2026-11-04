-- #699: Mitgelieferte Designs auf das Ablago-Blau (#1F4E79) aus marke/ umstellen.
-- Nur Designs, die noch den alten Vorgabewert tragen; eigene Farben bleiben unberührt.
UPDATE designs SET primaer = '#1F4E79' WHERE primaer = '#1D5A8A';
