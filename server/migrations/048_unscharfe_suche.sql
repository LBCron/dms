-- Unscharfe Suche (#356) – zusammen entworfen mit „Volltext je Dokumentsprache“ (#400), damit der Suchindex der
-- Dokumente nur einmal neu gebaut wird.
--
-- 1. Umlaute, Akzente und ß: Die Erweiterung unaccent ist ab PostgreSQL 13 „vertrauenswürdig“ – der Eigentümer der
--    Datenbank darf sie ohne Superuser anlegen; postgres:17 (Debian) und postgresql17-contrib (Alpine, dms-komplett)
--    bringen sie mit. Fehlt sie, faltet das DMS selbst (translate) – nur etwas weniger vollständig.
-- 2. Eigene Suchkonfigurationen je Sprache (dms_german, dms_english …): unaccent vor dem Wortstamm.
-- 3. Bindestriche: Der Index kennt „Kfz-Versicherung“ auch als „Kfzversicherung“ (dms_suchtext).
-- 4. Sprache je Dokument (#400): Spalte sprache (Tesseract-Kennung, z. B. „fra“); leer = Deutsch. Der Suchindex nimmt
--    schon jetzt die Konfiguration der Sprache (dms_konfig); gefüllt wird die Spalte mit #400.
-- 5. Wörterverzeichnis für „Meintest du …?“ und Tippfehler (Trigramm-Ähnlichkeit, pg_trgm aus Migration 030).
-- 6. Gleichbedeutende Wörter (Synonyme): eigene Gruppen aus der Werkbank und Wortlisten aus Paketen.

-- unaccent in ein eigenes Schema: Beim Wiederherstellen tauscht das DMS das Schema public aus und löscht das alte
-- später mit CASCADE – läge die Erweiterung dort, verschwänden mit ihr die Suchkonfigurationen (und das Schreiben
-- von Dokumenten scheiterte am Trigger). Ohne Recht für ein eigenes Schema: im aktuellen.
DO $$
BEGIN
  BEGIN
    CREATE SCHEMA IF NOT EXISTS erweiterungen_dms;
    CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA erweiterungen_dms;
  EXCEPTION WHEN others THEN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  END;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'unaccent nicht angelegt, das DMS faltet Umlaute selbst: %', SQLERRM;
END $$;

ALTER TABLE dokumente ADD COLUMN sprache text;

-- Faltung ohne Erweiterung: häufige Akzente und Umlaute auf den Grundbuchstaben, ß → ss (wie unaccent).
CREATE FUNCTION dms_falte_fest(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT replace(replace(replace(translate($1,
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿŁłŚśŹźŻżĆćŃńĄąĘęŠšŽžČčŘřĞğİıŞş',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyyLlSsZzZzCcNnAaEeSsZzCcRrGgIiSs'),
    'ß', 'ss'), 'Œ', 'OE'), 'œ', 'oe')
$f$;

DO $$
DECLARE
  schema text;
  -- Konfiguration → Wortstamm-Wörterbuch; simple für Sprachen ohne Wortstämme (Polnisch, Ukrainisch).
  k record;
BEGIN
  SELECT n.nspname INTO schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent';
  IF schema IS NOT NULL THEN
    -- Abfrage-Seite und Titel/Werte (nicht im Index): unaccent selbst.
    EXECUTE format('CREATE FUNCTION dms_falte(t text) RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $g$ SELECT %I.unaccent(%L::regdictionary, coalesce($1, %L)) $g$',
      schema, schema || '.unaccent', '');
  ELSE
    CREATE FUNCTION dms_falte(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $g$ SELECT dms_falte_fest(coalesce($1, '')) $g$;
  END IF;
  FOR k IN SELECT * FROM (VALUES ('german', 'german_stem'), ('english', 'english_stem'), ('french', 'french_stem'), ('spanish', 'spanish_stem'),
      ('italian', 'italian_stem'), ('dutch', 'dutch_stem'), ('turkish', 'turkish_stem'), ('portuguese', 'portuguese_stem'),
      ('russian', 'russian_stem'), ('arabic', 'arabic_stem'), ('simple', 'simple')) AS v(basis, stamm) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = k.basis) THEN CONTINUE; END IF;
    EXECUTE format('CREATE TEXT SEARCH CONFIGURATION %I (COPY = %I)', 'dms_' || k.basis, k.basis);
    IF schema IS NOT NULL THEN
      EXECUTE format('ALTER TEXT SEARCH CONFIGURATION %I ALTER MAPPING FOR word, hword, hword_part WITH %I.unaccent, %I',
        'dms_' || k.basis, schema, k.stamm);
    END IF;
  END LOOP;
  -- Ohne arabische Konfiguration (ältere PostgreSQL): Arabisch ohne Wortstämme.
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'dms_arabic') THEN
    CREATE TEXT SEARCH CONFIGURATION dms_arabic (COPY = dms_simple);
  END IF;
  -- Text für den Index: mit unaccent faltet die Konfiguration, sonst dms_falte_fest. Dazu Wörter mit Bindestrich
  -- noch einmal ohne („Kfz-Versicherung“ → „Kfzversicherung“), damit beide Schreibweisen einander finden.
  EXECUTE format($h$
    CREATE FUNCTION dms_suchtext(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $g$
      SELECT %s || coalesce(' ' || (
        SELECT string_agg(DISTINCT replace(m[1], '-', ''), ' ')
        FROM regexp_matches(coalesce($1, ''), '([0-9A-Za-zÀ-ÖØ-öø-ɏЀ-ӿ]+(?:-[0-9A-Za-zÀ-ÖØ-öø-ɏЀ-ӿ]+)+)', 'g') m), '')
    $g$ $h$, CASE WHEN schema IS NOT NULL THEN 'coalesce($1, '''')' ELSE 'dms_falte_fest(coalesce($1, ''''))' END);
END $$;

-- Sprache eines Dokuments (Tesseract-Kennung, #400) → Suchkonfiguration; wie TEXTSPRACHEN in shared/src/textsprache.ts.
CREATE FUNCTION dms_konfig(sprache text) RETURNS regconfig LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT (CASE $1
    WHEN 'eng' THEN 'dms_english' WHEN 'fra' THEN 'dms_french' WHEN 'spa' THEN 'dms_spanish' WHEN 'ita' THEN 'dms_italian'
    WHEN 'nld' THEN 'dms_dutch' WHEN 'tur' THEN 'dms_turkish' WHEN 'por' THEN 'dms_portuguese' WHEN 'rus' THEN 'dms_russian'
    WHEN 'ara' THEN 'dms_arabic' WHEN 'pol' THEN 'dms_simple' WHEN 'ukr' THEN 'dms_simple'
    ELSE 'dms_german' END)::regconfig
$f$;

-- Der eine Neuaufbau des Suchindex: Sprache des Dokuments, Umlaute, Bindestriche. Als gespeicherte Spalte statt als
-- Ausdrucksindex: Bei häufigen Wörtern prüft PostgreSQL viele Zeilen nach (verlustbehaftete Bitmap) und müsste dann
-- jeden Volltext neu zerlegen – mit der Spalte nicht. Ein Trigger hält sie aktuell (auch beim Wiederherstellen aus dem
-- Papierkorb und aus einer Sicherung, die die Spalte nicht enthält).
DROP INDEX IF EXISTS dokumente_volltext_idx;
ALTER TABLE dokumente ADD COLUMN suchindex tsvector;
UPDATE dokumente SET suchindex = to_tsvector(dms_konfig(sprache), dms_suchtext(volltext)) WHERE volltext IS NOT NULL;
CREATE INDEX dokumente_suchindex ON dokumente USING gin (suchindex);
CREATE FUNCTION dms_suchindex() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.suchindex := CASE WHEN NEW.volltext IS NULL THEN NULL ELSE to_tsvector(dms_konfig(NEW.sprache), dms_suchtext(NEW.volltext)) END;
  RETURN NEW;
END $f$;
CREATE TRIGGER dokumente_suchindex BEFORE INSERT OR UPDATE OF volltext, sprache, suchindex ON dokumente FOR EACH ROW EXECUTE FUNCTION dms_suchindex();

-- Wörterverzeichnis (gefaltet, klein): Grundlage für „Meintest du …?“ und für Tippfehler. Es wächst mit Titeln,
-- Werten und Volltexten (Trigger); veraltete Wörter stören nicht (sie liefern nur keinen Treffer) und verschwinden
-- beim Neuaufbau in der Werkbank.
CREATE TABLE suchwoerter (
  haushalt_id uuid NOT NULL,
  wort        text NOT NULL,
  anzahl      integer NOT NULL DEFAULT 1,
  PRIMARY KEY (haushalt_id, wort)
);
DO $$
BEGIN
  EXECUTE 'CREATE INDEX suchwoerter_trgm ON suchwoerter USING gin (wort gin_trgm_ops)';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Trigramm-Index für das Wörterverzeichnis nicht angelegt: %', SQLERRM;
END $$;

-- Wörter eines Textes: gefaltet, klein, 4 bis 40 Zeichen, keine reinen Zahlen.
CREATE FUNCTION dms_woerter(t text) RETURNS TABLE (wort text, anzahl bigint) LANGUAGE sql STABLE PARALLEL SAFE AS $f$
  SELECT w, count(*) FROM regexp_split_to_table(lower(dms_falte(left($1, 1000000))), '[^0-9a-zа-яёіїєґ]+') w
  WHERE length(w) BETWEEN 4 AND 40 AND w !~ '^[0-9]+$' GROUP BY w
$f$;
CREATE FUNCTION dms_woerter_merken(h uuid, t text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO suchwoerter (haushalt_id, wort, anzahl)
  SELECT h, w.wort, w.anzahl FROM dms_woerter(t) w
  ON CONFLICT (haushalt_id, wort) DO UPDATE SET anzahl = suchwoerter.anzahl + excluded.anzahl
$f$;
-- Text einer Mappe: Titel und Werte als Text (ohne Passwörter, die mit „dms1$“ beginnen).
CREATE FUNCTION dms_mappentext(titel text, werte jsonb) RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT coalesce($1, '') || ' ' || coalesce((SELECT string_agg(e.value, ' ') FROM jsonb_each_text($2) e WHERE e.value NOT LIKE 'dms1$%'), '')
$f$;
CREATE FUNCTION dms_woerter_mappe() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.titel IS NOT DISTINCT FROM OLD.titel AND NEW.werte IS NOT DISTINCT FROM OLD.werte THEN RETURN NEW; END IF;
  PERFORM dms_woerter_merken(NEW.haushalt_id, dms_mappentext(NEW.titel, NEW.werte));
  RETURN NEW;
END $f$;
CREATE FUNCTION dms_woerter_dokument() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.volltext IS NULL OR (TG_OP = 'UPDATE' AND NEW.volltext IS NOT DISTINCT FROM OLD.volltext) THEN RETURN NEW; END IF;
  PERFORM dms_woerter_merken(NEW.haushalt_id, NEW.volltext);
  RETURN NEW;
END $f$;
CREATE TRIGGER mappen_suchwoerter AFTER INSERT OR UPDATE OF titel, werte ON mappen FOR EACH ROW EXECUTE FUNCTION dms_woerter_mappe();
CREATE TRIGGER dokumente_suchwoerter AFTER INSERT OR UPDATE OF volltext ON dokumente FOR EACH ROW EXECUTE FUNCTION dms_woerter_dokument();

-- Neuaufbau (Migration und Werkbank): alles aus dem Bestand eines Mandanten.
CREATE FUNCTION dms_woerter_neu(h uuid) RETURNS integer LANGUAGE plpgsql AS $f$
DECLARE n integer;
BEGIN
  DELETE FROM suchwoerter WHERE haushalt_id = h;
  INSERT INTO suchwoerter (haushalt_id, wort, anzahl)
  SELECT h, w.wort, sum(w.anzahl)::integer FROM (
    SELECT x.* FROM mappen m, dms_woerter(dms_mappentext(m.titel, m.werte)) x WHERE m.haushalt_id = h
    UNION ALL
    SELECT x.* FROM dokumente d, dms_woerter(d.volltext) x WHERE d.haushalt_id = h AND d.volltext IS NOT NULL
  ) w GROUP BY w.wort;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;
SELECT dms_woerter_neu(h) FROM (SELECT DISTINCT haushalt_id AS h FROM mappen) x;

-- Gleichbedeutende Wörter: Wer eines sucht, findet auch die anderen der Gruppe. quelle = „werkbank“ oder die Id
-- des Pakets, das die Wortliste mitbringt (Paketformat: inhalt.wortlisten).
CREATE TABLE synonyme (
  id          uuid PRIMARY KEY,
  haushalt_id uuid NOT NULL,
  woerter     text[] NOT NULL,
  quelle      text NOT NULL DEFAULT 'werkbank',
  erstellt    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonyme_haushalt ON synonyme (haushalt_id, quelle);
