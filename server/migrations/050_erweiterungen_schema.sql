-- Datenbank-Erweiterungen ins eigene Schema erweiterungen_dms (#562).
--
-- Beim Wiederherstellen spielt das DMS die Sicherung in ein neues Schema ein, tauscht es gegen public und löscht das
-- alte Schema später mit CASCADE. pg_trgm lag seit Migration 030 im Schema public und verschwand dabei: Danach fehlten
-- die Ähnlichkeitsfunktionen, die Tippfehler-Suche („Meintest du …?“) blieb still aus und die Suche nach Wortteilen
-- lief ohne Trigramm-Index. unaccent liegt seit #356 (Migration 048) in erweiterungen_dms – pg_trgm zieht nach.
--
-- Umgezogen wird nur aus Schemas, die eine Wiederherstellung austauscht oder löscht (public, dms_*). Liegt eine
-- Erweiterung woanders (z. B. vom Anbieter einer verwalteten Datenbank im Schema „extensions“), bleibt sie dort.
-- Fehlt pg_trgm (etwa nach einer früheren Wiederherstellung), legt diese Migration sie neu an. Ohne Rechte bleibt
-- alles, wie es ist – das DMS zeigt das dann im Systemzustand an.

DO $$
DECLARE
  s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF s = 'erweiterungen_dms' OR (s IS NOT NULL AND s <> 'public' AND s NOT LIKE 'dms\_%') THEN RETURN; END IF;
  BEGIN
    CREATE SCHEMA IF NOT EXISTS erweiterungen_dms;
    IF s IS NULL THEN
      CREATE EXTENSION pg_trgm SCHEMA erweiterungen_dms;
    ELSE
      ALTER EXTENSION pg_trgm SET SCHEMA erweiterungen_dms;
    END IF;
  EXCEPTION WHEN others THEN
    -- Kein Recht für ein eigenes Schema: wenigstens im aktuellen anlegen (wie Migration 030).
    IF s IS NULL THEN
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'pg_trgm nicht angelegt, die Tippfehler-Suche bleibt aus: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'pg_trgm nicht ins Schema erweiterungen_dms umgezogen: %', SQLERRM;
    END IF;
  END;
END $$;

-- unaccent: Seit 048 im eigenen Schema – außer sie lag schon vorher in public (z. B. vom Betreiber angelegt). Dann
-- umziehen und dms_falte neu anlegen, deren Text das Schema nennt. Die Suchkonfigurationen verweisen auf das
-- Wörterbuch selbst und bleiben gültig.
DO $$
DECLARE
  s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent';
  IF s IS NULL OR s = 'erweiterungen_dms' OR (s <> 'public' AND s NOT LIKE 'dms\_%') THEN RETURN; END IF;
  CREATE SCHEMA IF NOT EXISTS erweiterungen_dms;
  ALTER EXTENSION unaccent SET SCHEMA erweiterungen_dms;
  IF pg_get_functiondef('dms_falte(text)'::regprocedure) LIKE '%unaccent%' THEN
    CREATE OR REPLACE FUNCTION dms_falte(t text) RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $g$
      SELECT erweiterungen_dms.unaccent('erweiterungen_dms.unaccent'::regdictionary, coalesce($1, ''))
    $g$;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'unaccent nicht ins Schema erweiterungen_dms umgezogen: %', SQLERRM;
END $$;

-- Trigramm-Indizes mit dem Schema der Operatorklasse: Beim Wiederherstellen laufen die Migrationen mit dem neuen
-- Schema als einzigem Suchpfad – dort fänden 030 und 048 gin_trgm_ops nicht mehr. Fehlen sie (auch nach einer
-- früheren Wiederherstellung), entstehen sie hier; das kann bei großen Ablagen einige Minuten dauern.
DO $$
DECLARE
  s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF s IS NULL THEN RETURN; END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS dokumente_volltext_trgm_idx ON dokumente USING gin (volltext %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS suchwoerter_trgm ON suchwoerter USING gin (wort %I.gin_trgm_ops)', s);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Trigramm-Indizes nicht angelegt: %', SQLERRM;
END $$;
