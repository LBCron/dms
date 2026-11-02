-- Dokumente in mehreren Sprachen (#579): Sprache je Seite, Hauptsprache plus „enthält auch“, Suche in allen Sprachen.
--
-- Bisher hatte ein Dokument genau eine Sprache (dokumente.sprache, #400); der Suchindex nahm deren Wortstämme. Jetzt:
-- - sprache bleibt die Hauptsprache (die mit dem meisten Text),
-- - weitere_sprachen: die übrigen Sprachen („Deutsch, enthält auch Französisch“), setzbar über die API,
-- - seitensprachen: je Seite, wo sie im Volltext beginnt (Zeichen ab 0) und in welcher Sprache sie steht – auf
--   Mischseiten zwei, z. B. [{"ab":0,"sprachen":["deu"]},{"ab":1834,"sprachen":["fra"]}],
-- - teilen_hinweis_aus: der Hinweis „Ab Seite 2 beginnt vermutlich ein eigenes Schreiben – Post teilen?“ ist
--   weggeklickt.
--
-- Der Suchindex nimmt mit Seitensprachen je Seite die Wortstämme ihrer Sprache(n), sonst den ganzen Text in der
-- Hauptsprache und jeder weiteren Sprache. Alle drei Spalten sind leer für den Bestand – ADD COLUMN ohne Vorgabe
-- schreibt die Tabelle nicht um, und der Suchindex vorhandener Dokumente bleibt, wie er ist (kein Neuaufbau). Nur
-- der Trigger rechnet für neue und geänderte Dokumente mit den neuen Spalten.
ALTER TABLE dokumente
  ADD COLUMN weitere_sprachen text[],
  ADD COLUMN seitensprachen jsonb,
  ADD COLUMN teilen_hinweis_aus boolean;

-- Suchindex eines Dokuments: je Sprache (Konfiguration) einmal to_tsvector über den Text ihrer Seiten – nicht je
-- Seite, damit ein Dokument mit 1000 Seiten nicht 1000 Vektoren aneinanderhängt. Seiten ohne Sprache zählen zur
-- Hauptsprache; Text vor der ersten Seite gehört zur ersten.
CREATE FUNCTION dms_suchindex_text(volltext text, sprache text, weitere text[], seiten jsonb) RETURNS tsvector
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $f$
DECLARE
  v tsvector;
  r record;
  k text;
BEGIN
  IF volltext IS NULL THEN RETURN NULL; END IF;
  IF seiten IS NOT NULL AND jsonb_typeof(seiten) = 'array' AND jsonb_array_length(seiten) > 0 THEN
    v := ''::tsvector;
    FOR r IN
      WITH s AS (
        SELECT x.i, CASE WHEN x.i = 1 THEN 0 ELSE greatest(0, (x.e->>'ab')::integer) END AS ab,
          CASE WHEN jsonb_typeof(x.e->'sprachen') = 'array' THEN x.e->'sprachen' ELSE '[]'::jsonb END AS sp
        FROM jsonb_array_elements(seiten) WITH ORDINALITY AS x(e, i)
      ), t AS (
        SELECT s.i, s.sp, substr(volltext, s.ab + 1, greatest(0, coalesce(lead(s.ab) OVER (ORDER BY s.i) - s.ab, 2147483646))) AS text FROM s
      )
      SELECT dms_konfig(l.k) AS konfig, string_agg(t.text, E'\n\n' ORDER BY t.i) AS text
      FROM t, LATERAL (
        SELECT y FROM jsonb_array_elements_text(t.sp) AS y
        UNION ALL SELECT sprache WHERE jsonb_array_length(t.sp) = 0
      ) AS l(k)
      WHERE btrim(t.text) <> ''
      GROUP BY 1
    LOOP
      v := v || to_tsvector(r.konfig, dms_suchtext(r.text));
    END LOOP;
    RETURN v;
  END IF;
  v := to_tsvector(dms_konfig(sprache), dms_suchtext(volltext));
  IF weitere IS NOT NULL THEN
    FOREACH k IN ARRAY weitere LOOP
      IF dms_konfig(k) <> dms_konfig(sprache) THEN v := v || to_tsvector(dms_konfig(k), dms_suchtext(volltext)); END IF;
    END LOOP;
  END IF;
  RETURN v;
END $f$;

CREATE OR REPLACE FUNCTION dms_suchindex() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.suchindex := dms_suchindex_text(NEW.volltext, NEW.sprache, NEW.weitere_sprachen, NEW.seitensprachen);
  RETURN NEW;
END $f$;
DROP TRIGGER dokumente_suchindex ON dokumente;
CREATE TRIGGER dokumente_suchindex BEFORE INSERT OR UPDATE OF volltext, sprache, weitere_sprachen, seitensprachen, suchindex ON dokumente
  FOR EACH ROW EXECUTE FUNCTION dms_suchindex();

-- Ausschnitt mit Treffer (ts_headline) für mehrsprachige Dokumente: mit den Wortstämmen der Sprache, in der die
-- Anfrage den Text trifft – sonst markierte „cheval“ das Wort „chevaux“ nicht, wenn Deutsch die Hauptsprache ist.
-- Einsprachige Dokumente wie bisher (nur ts_headline).
CREATE FUNCTION dms_ausschnitt(sprache text, weitere text[], volltext text, q tsquery, optionen text) RETURNS text
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $f$
DECLARE k text;
BEGIN
  IF weitere IS NOT NULL THEN
    FOREACH k IN ARRAY array_prepend(sprache, weitere) LOOP
      IF to_tsvector(dms_konfig(k), dms_suchtext(volltext)) @@ q THEN RETURN ts_headline(dms_konfig(k), volltext, q, optionen); END IF;
    END LOOP;
  END IF;
  RETURN ts_headline(dms_konfig(sprache), volltext, q, optionen);
END $f$;

-- Welche weiteren Sprachen eine Ablage hat (für die Suchanfrage je Sprache): nur die wenigen mehrsprachigen Dokumente.
CREATE INDEX dokumente_weitere_sprachen ON dokumente (haushalt_id) WHERE weitere_sprachen IS NOT NULL;
-- Statistik der neuen Spalte, damit PostgreSQL den Teilindex gleich nimmt (sonst bis zum nächsten ANALYZE ein
-- Lauf über alle Dokumente; bei 75.000 Dokumenten etwa 35 statt 0,1 ms). Nur diese Spalte – Sekundenbruchteile.
ANALYZE dokumente (weitere_sprachen);
