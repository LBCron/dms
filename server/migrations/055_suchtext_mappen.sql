-- Suche in Mappen unter Last (#615): Titel und Werte gefaltet als gespeicherte Spalte.
--
-- Die Suche in einer Ansicht vergleicht Titel und jeden Wert einer Mappe ohne Umlaute, Groß-/Kleinschreibung und
-- Bindestriche (#356). Bisher faltete PostgreSQL dafür bei jeder Suche jede Mappe der Ansicht neu (unaccent je Titel
-- und je Wert, jsonb_each_text je Mappe) – bei 20 000 Mappen rund 200 ms Rechenzeit je Abfrage, und eine Suche
-- braucht zwei bis fünf davon. Unter Last (Lasttest mittel, #563) war das der größte Brocken.
--
-- suchtext enthält dieselben gefalteten Texte (Titel, dann jeder Wert außer Passwörtern, die mit „dms1$“ beginnen),
-- je durch einen Zeilenumbruch getrennt. Die Suche prüft zuerst „suchtext enthält den Begriff“ – eine notwendige
-- Bedingung: Was im Titel oder einem Wert vorkommt, kommt auch in suchtext vor – und danach wie bisher genau je
-- Titel und Wert. So ändern sich die Treffer nicht; gefaltet wird nur noch für die wenigen Mappen, die den Begriff
-- enthalten. Ist suchtext leer (NULL), prüft die Suche wie bisher.
--
-- Ein Trigger hält die Spalte aktuell (auch beim Wiederherstellen aus dem Papierkorb und aus einer Sicherung, die
-- die Spalte nicht enthält). Die Sicherung lässt sie weg (abgeleitet wie dokumente.suchindex).

CREATE FUNCTION dms_mappe_suchtext(titel text, werte jsonb) RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $f$
  SELECT concat_ws(E'\n', replace(lower(dms_falte($1)), '-', ''),
    (SELECT string_agg(replace(lower(dms_falte(e.value)), '-', ''), E'\n') FROM jsonb_each_text($2) e WHERE e.value NOT LIKE 'dms1$%'))
$f$;

ALTER TABLE mappen ADD COLUMN suchtext text;
UPDATE mappen SET suchtext = dms_mappe_suchtext(titel, werte);

CREATE FUNCTION dms_mappe_suchtext_setzen() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.suchtext := dms_mappe_suchtext(NEW.titel, NEW.werte);
  RETURN NEW;
END $f$;
CREATE TRIGGER mappen_suchtext BEFORE INSERT OR UPDATE OF titel, werte, suchtext ON mappen
  FOR EACH ROW EXECUTE FUNCTION dms_mappe_suchtext_setzen();
