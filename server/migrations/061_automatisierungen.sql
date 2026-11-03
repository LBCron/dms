-- Automatisierungen (#674): Wenn · Und · Dann, ausgeführt unter dem Systemkonto „Automatisierung“ (#673).
--
-- 1. Die Automatisierungen. daten: Wenn-Karte, Und-Bedingungen, Dann- und Sonst-Karten (shared/src/automatisierung.ts).
--    aktiv: von Hand an/aus; angehalten: {grund, text, zeit} – fehlerhaft, Bremse oder nach einer Wiederherstellung.
--    version: fortlaufend, gegen gleichzeitiges Speichern. letzter_tag: bis zu welchem Tag „Datum in N Tagen“
--    geprüft ist (verpasste Tage holt der Zeitplan nach) – in der Datenbank, damit es auch mit mehreren Servern stimmt.
CREATE TABLE automatisierungen (
  id            uuid PRIMARY KEY,
  haushalt_id   uuid NOT NULL REFERENCES haushalte(id),
  name          text NOT NULL,
  reihenfolge   int NOT NULL DEFAULT 50 CHECK (reihenfolge BETWEEN 1 AND 99),
  daten         jsonb NOT NULL,
  aktiv         boolean NOT NULL DEFAULT false,
  angehalten    jsonb,
  herkunft      text NOT NULL DEFAULT 'eigen' CHECK (herkunft IN ('eigen', 'dms', 'paket')),
  paket_id      text,
  version       int NOT NULL DEFAULT 1,
  letzter_tag   date,
  erstellt      timestamptz NOT NULL DEFAULT now(),
  erstellt_von  uuid,
  geaendert     timestamptz NOT NULL DEFAULT now(),
  geaendert_von uuid
);
CREATE INDEX automatisierungen_haushalt ON automatisierungen (haushalt_id, reihenfolge, name);

-- 2. Änderungsverlauf: jede gespeicherte Fassung (wer, wann, was) – „vorherige Fassung wiederherstellen“.
CREATE TABLE automatisierung_fassungen (
  automatisierung_id uuid NOT NULL REFERENCES automatisierungen(id) ON DELETE CASCADE,
  version            int NOT NULL,
  daten              jsonb NOT NULL,
  von                uuid,
  zeit               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automatisierung_id, version)
);

-- 3. Läufe: je Automatisierung und Ereignis genau einer (eindeutig) – kommt ein Ereignis noch einmal (mindestens
--    einmal, #670) oder prüfen zwei Server denselben Tag, entsteht kein zweiter Lauf. schritte: Zustand je Karte
--    (Live-Fortschritt im Editor). daten: nur Ids, Schlüssel, Datum – zum Wiederholen.
CREATE TABLE automatisierung_laeufe (
  id                 uuid PRIMARY KEY,
  haushalt_id        uuid NOT NULL REFERENCES haushalte(id),
  automatisierung_id uuid NOT NULL REFERENCES automatisierungen(id) ON DELETE CASCADE,
  ereignis_id        uuid NOT NULL,
  art                text NOT NULL,
  daten              jsonb NOT NULL DEFAULT '{}'::jsonb,
  mappe_id           uuid,
  zustand            text NOT NULL DEFAULT 'laeuft' CHECK (zustand IN ('laeuft', 'abgeschlossen', 'unzutreffend', 'fehlgeschlagen', 'uebersprungen', 'wiederholt')),
  trocken            boolean NOT NULL DEFAULT false,
  test               boolean NOT NULL DEFAULT false,
  schritte           jsonb NOT NULL DEFAULT '[]'::jsonb,
  fehler             text,
  wiederholt_von     uuid,
  gestartet          timestamptz NOT NULL DEFAULT now(),
  beendet            timestamptz,
  UNIQUE (automatisierung_id, ereignis_id)
);
CREATE INDEX automatisierung_laeufe_verlauf ON automatisierung_laeufe (automatisierung_id, gestartet DESC);
CREATE INDEX automatisierung_laeufe_fehler ON automatisierung_laeufe (haushalt_id, gestartet DESC) WHERE zustand = 'fehlgeschlagen';
