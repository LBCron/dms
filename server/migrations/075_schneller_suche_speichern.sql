-- Schneller: Suche und Listen über Indizes (#740), Dublettenprüfung über einen Index (#743).
--
-- Die Migrationen laufen in einer gemeinsamen Transaktion (server/src/db.ts) – CREATE INDEX CONCURRENTLY geht dort
-- nicht. Die Indizes entstehen daher gewöhnlich: Lesen geht währenddessen weiter, Schreiben auf mappen wartet, bis
-- sie fertig sind (bei 50 000 Mappen wenige Sekunden). Weil alle Server mit derselben Sperre migrieren, migriert nur
-- einer; die anderen warten und starten danach.

-- 1. suchtext (Migration 055) ist nie leer: einmal nachfüllen, dann NOT NULL. Der Trigger setzt die Spalte bei jedem
--    Schreiben, auch beim Wiederherstellen aus Papierkorb und Sicherung. Die Suche braucht kein „suchtext IS NULL OR“
--    mehr und kann den Trigramm-Index nutzen.
UPDATE mappen SET suchtext = dms_mappe_suchtext(titel, werte) WHERE suchtext IS NULL;
ALTER TABLE mappen ALTER COLUMN suchtext SET DEFAULT '';
ALTER TABLE mappen ALTER COLUMN suchtext SET NOT NULL;

-- 2. Trigramm-Index auf suchtext: „suchtext LIKE '%begriff%'“ sucht damit nur noch in den Mappen, die die
--    Buchstabenfolgen des Begriffs enthalten, statt alle Mappen zu lesen. pg_trgm liegt seit Migration 050 in
--    erweiterungen_dms; fehlt die Erweiterung, bleibt die Suche richtig, nur ohne diesen Index.
DO $$
DECLARE
  s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF s IS NULL THEN RETURN; END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS mappen_suchtext_trgm ON mappen USING gin (suchtext %I.gin_trgm_ops)', s);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Trigramm-Index für mappen.suchtext nicht angelegt: %', SQLERRM;
END $$;

-- 3. Sortieren ohne alle Mappen einer Ansicht zu sortieren. Auf- und absteigend nutzt PostgreSQL denselben Index
--    (rückwärts gelesen). erstellt und geaendert sind NOT NULL.
--    - Ansichten über mehrere Typen nach Titel: (haushalt_id, lower(titel), id)
--    - nach erstellt bzw. geaendert, je Typ und über mehrere Typen
--    Der Index (haushalt_id, typ_id) aus Migration 001 entfällt: (haushalt_id, typ_id, erstellt) deckt ihn mit ab.
CREATE INDEX IF NOT EXISTS mappen_titel_alle_idx ON mappen (haushalt_id, lower(titel), id);
CREATE INDEX IF NOT EXISTS mappen_typ_erstellt_idx ON mappen (haushalt_id, typ_id, erstellt);
CREATE INDEX IF NOT EXISTS mappen_typ_geaendert_idx ON mappen (haushalt_id, typ_id, geaendert);
CREATE INDEX IF NOT EXISTS mappen_erstellt_idx ON mappen (haushalt_id, erstellt);
CREATE INDEX IF NOT EXISTS mappen_geaendert_idx ON mappen (haushalt_id, geaendert);
DROP INDEX IF EXISTS mappen_typ_idx;

-- 4. Dublettenprüfung (#743): „Bereits vergeben“ vergleicht lower(trim(werte ->> feld)) – ohne Index ein Lauf über
--    alle Mappen des Typs, bei jedem Speichern. dms_gleichwerte liefert je Text- und Zahlwert einer Mappe einen
--    Fingerabdruck aus Feldschlüssel und dem so verglichenen Wert (md5 als uuid, 16 Bytes; Passwörter und leere
--    Werte nicht). Der GIN-Index darüber findet die Mappen mit demselben Wert in einem Feld direkt; die Abfrage
--    vergleicht danach wie bisher genau (gleiche Treffer, auch bei einem zufällig gleichen Fingerabdruck).
CREATE FUNCTION dms_gleichwerte(werte jsonb) RETURNS uuid[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT coalesce(array_agg(md5(e.key || E'\x1f' || lower(trim(e.value #>> '{}')))::uuid), '{}')
  FROM jsonb_each($1) e
  WHERE jsonb_typeof(e.value) IN ('string', 'number') AND trim(e.value #>> '{}') <> '' AND (e.value #>> '{}') NOT LIKE 'dms1$%'
$f$;
CREATE INDEX IF NOT EXISTS mappen_gleichwerte_idx ON mappen USING gin (dms_gleichwerte(werte));
