-- Wörterverzeichnis ohne Verklemmung (#575). Bisher schrieben die Trigger aus Migration 048 die Wörter jeder Mappe
-- und jedes Volltexts direkt in suchwoerter (INSERT … ON CONFLICT DO UPDATE). Dabei sperrt PostgreSQL jede
-- getroffene Zeile bis zum Ende der Transaktion – und die Wörter kamen je Vorgang in anderer Reihenfolge. Legte eine
-- Transaktion viele Mappen auf einmal an (Demo-Daten, Import) und speicherte gleichzeitig die Texterkennung ein
-- Ergebnis, warteten beide aufeinander; PostgreSQL brach einen ab (Deadlock), und das Ergebnis der Texterkennung
-- war verloren.
--
-- Jetzt entkoppelt: Die Trigger hängen die Wörter nur noch an einen Eingang an (ohne eindeutigen Schlüssel, also
-- ohne Zeilensperren, die jemand anderes halten könnte). Das DMS arbeitet den Eingang im Hintergrund alle paar
-- Sekunden in suchwoerter ein – immer nur ein Lauf zugleich (Sperre 4711575) und in fester Reihenfolge der Wörter.
-- „Meintest du …?“ kennt neue Wörter damit wenige Sekunden später; die Suche selbst (Suchindex) ist sofort aktuell.

CREATE TABLE suchwoerter_eingang (
  haushalt_id uuid NOT NULL,
  wort        text NOT NULL,
  anzahl      integer NOT NULL
);

CREATE OR REPLACE FUNCTION dms_woerter_merken(h uuid, t text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO suchwoerter_eingang (haushalt_id, wort, anzahl)
  SELECT h, w.wort, w.anzahl FROM dms_woerter(t) w
$f$;

-- Einen Teil des Eingangs einarbeiten (höchstens grenze Zeilen); liefert die Zahl der Zeilen oder -1, wenn gerade
-- ein anderer Lauf (oder der Neuaufbau) arbeitet. Das DMS ruft sie, bis weniger als grenze zurückkommen.
CREATE FUNCTION dms_woerter_einarbeiten(grenze integer DEFAULT 20000) RETURNS integer LANGUAGE plpgsql AS $f$
DECLARE n integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(4711575) THEN RETURN -1; END IF;
  WITH weg AS (
    DELETE FROM suchwoerter_eingang WHERE ctid = ANY(ARRAY(SELECT ctid FROM suchwoerter_eingang LIMIT grenze))
    RETURNING haushalt_id, wort, anzahl
  ), rein AS (
    INSERT INTO suchwoerter (haushalt_id, wort, anzahl)
    SELECT haushalt_id, wort, sum(anzahl)::integer FROM weg GROUP BY haushalt_id, wort ORDER BY haushalt_id, wort
    ON CONFLICT (haushalt_id, wort) DO UPDATE SET anzahl = suchwoerter.anzahl + excluded.anzahl
    RETURNING 1
  )
  SELECT count(*) INTO n FROM weg;
  RETURN n;
END $f$;

-- Neuaufbau (Werkbank): wartet auf einen laufenden Einarbeiten-Lauf; was im Eingang steht, zählt der Neuaufbau aus
-- dem Bestand ohnehin mit.
CREATE OR REPLACE FUNCTION dms_woerter_neu(h uuid) RETURNS integer LANGUAGE plpgsql AS $f$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(4711575);
  DELETE FROM suchwoerter_eingang WHERE haushalt_id = h;
  DELETE FROM suchwoerter WHERE haushalt_id = h;
  INSERT INTO suchwoerter (haushalt_id, wort, anzahl)
  SELECT h, w.wort, sum(w.anzahl)::integer FROM (
    SELECT x.* FROM mappen m, dms_woerter(dms_mappentext(m.titel, m.werte)) x WHERE m.haushalt_id = h
    UNION ALL
    SELECT x.* FROM dokumente d, dms_woerter(d.volltext) x WHERE d.haushalt_id = h AND d.volltext IS NOT NULL
  ) w GROUP BY w.wort ORDER BY w.wort;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;
