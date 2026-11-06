-- Termine schneller (#918): Vorfilter für die Datumswerte der Mappen und ein zweiter Stand für die Zahlen.
--
-- 1. fristtermine: je Mappe und Feld ein Datumswert (Text JJJJ-MM-TT, genau wie in werte) und sein Monat als Zahl
--    (Jahr · 12 + Monat − 1). Die Termine in „Zu erledigen“ und auf der Startseite fragen hier, welche Mappen im
--    Zeitraum einen Termin haben **können** – auch bei wiederkehrenden Fristen (Abgleich des Monats mit dem Rhythmus,
--    server/src/repo-pg.ts `fristKandidaten`) – und holen nur deren Titel und Datumswerte, nicht die ganze Mappe. Den
--    Termin selbst rechnet der Server danach wie bisher aus Datum und Rhythmus des Mappentyps (shared/src/fristen.ts).
--
--    Gepflegt per Trigger in derselben Transaktion wie die Mappe: anlegen, ändern, Typ wechseln, löschen (Papierkorb,
--    endgültig – über den Fremdschlüssel), wiederherstellen, Import, Demo-Daten, Wiederherstellen einer Sicherung
--    (COPY löst die Trigger aus; die Tabelle selbst gehört nicht in die Sicherung, datenbankabzug.ts OHNE_INHALT) und
--    Änderungen von Hand. Die Tabelle hängt nur an den Werten der Mappe, nicht an den Feldern des Typs: Es stehen alle
--    Werte darin, die wie ein Datum aussehen. Welche Felder Fristen sind und in welchem Rhythmus sie wiederkehren,
--    kommt bei jeder Abfrage aus dem Typ – eine Änderung am Typ braucht hier nichts. Kein nächtlicher Lauf.
--
--    monat ist NULL, wenn der Wert zwar wie ein Datum aussieht, das Rechnen mit Monaten aber nicht sicher ist (Monat
--    nicht 01–12, Tag 00, Jahr vor 0100) – solche Mappen sind immer Kandidaten; entschieden wird beim Rechnen.
CREATE FUNCTION dms_fristmonat(d text) RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT CASE WHEN substr(d, 6, 2) BETWEEN '01' AND '12' AND substr(d, 9, 2) BETWEEN '01' AND '31' AND substr(d, 1, 4) >= '0100'
    THEN substr(d, 1, 4)::integer * 12 + substr(d, 6, 2)::integer - 1 END
$f$;

CREATE TABLE fristtermine (
  mappe_id    uuid NOT NULL REFERENCES mappen(id) ON DELETE CASCADE,
  haushalt_id uuid NOT NULL,
  typ_id      uuid NOT NULL,
  feld        text NOT NULL,
  datum       text COLLATE "C" NOT NULL,
  monat       integer,
  PRIMARY KEY (mappe_id, feld)
);
CREATE INDEX fristtermine_datum_idx ON fristtermine (haushalt_id, typ_id, feld, datum);

CREATE FUNCTION dms_fristtermine() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN DELETE FROM fristtermine WHERE mappe_id = OLD.id; END IF;
  INSERT INTO fristtermine (mappe_id, haushalt_id, typ_id, feld, datum, monat)
    SELECT NEW.id, NEW.haushalt_id, NEW.typ_id, e.key, e.value #>> '{}', dms_fristmonat(e.value #>> '{}')
    FROM jsonb_each(NEW.werte) e
    WHERE jsonb_typeof(e.value) = 'string' AND (e.value #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
  RETURN NULL;
END $$;
CREATE TRIGGER mappen_fristtermine_neu AFTER INSERT ON mappen FOR EACH ROW EXECUTE FUNCTION dms_fristtermine();
CREATE TRIGGER mappen_fristtermine_aenderung AFTER UPDATE ON mappen FOR EACH ROW
  WHEN (OLD.werte IS DISTINCT FROM NEW.werte OR OLD.typ_id IS DISTINCT FROM NEW.typ_id OR OLD.haushalt_id IS DISTINCT FROM NEW.haushalt_id)
  EXECUTE FUNCTION dms_fristtermine();

-- Bestand füllen.
INSERT INTO fristtermine (mappe_id, haushalt_id, typ_id, feld, datum, monat)
  SELECT m.id, m.haushalt_id, m.typ_id, e.key, e.value #>> '{}', dms_fristmonat(e.value #>> '{}')
  FROM mappen m, jsonb_each(m.werte) e
  WHERE jsonb_typeof(e.value) = 'string' AND (e.value #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- 2. Mappenstand (#918): wie haushaltsstand_zahlen (Migration 077), zählt aber nicht bei Favoriten. Die Zahlen je
--    Mappentyp und Ansicht, die Zahl der Treffer einer Liste und die Termine ohne „nur Favoriten“ gelten, solange er
--    gleich bleibt – ein Stern rechnet sie nicht für alle neu. Beginnt wie dort bei der Uhrzeit in Mikrosekunden.
CREATE SEQUENCE haushaltsstand_mappen;
SELECT setval('haushaltsstand_mappen', (extract(epoch FROM clock_timestamp()) * 1000000)::bigint);
