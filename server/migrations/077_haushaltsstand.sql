-- Stand des Haushalts in der Datenbank (#741, #742; der Teil „Haushaltsstand“ aus #744): Zahlen, an denen
-- Zwischenspeicher erkennen, ob sich seit dem Merken etwas geändert hat – in jedem Prozess und auf jedem Server gleich.
-- Ein zweiter Prozess ist damit höchstens langsamer, nie falsch.
--
--   haushaltsstand.lesen   Mappentypen, Ansichten, Pakete und Einstellungen des Haushalts. Zählt per Trigger in
--                          derselben Transaktion wie die Änderung (beim Abschluss, DEFERRABLE INITIALLY DEFERRED): Wer
--                          den neuen Stand sieht, sieht auch die neuen Daten. Das gilt auch für Änderungen an Ablago
--                          vorbei (von Hand, Wiederherstellung).
--   haushaltsstand_zahlen  Zahlen der Ansichten, Termine und neue Post (#512, #528, #625). Zählt der Server nach jeder
--                          Änderung über das Repo, die Zahlen ändern kann (zaehlerspeicher.ts, OHNE_FOLGEN). Eine
--                          Sequenz: Viele gleichzeitige Änderungen warten nicht auf eine gesperrte Zeile (Lasttest).
--
-- Beide beginnen bei der Uhrzeit in Mikrosekunden statt bei 0: Wird das Schema neu angelegt (Tests, Wiederherstellung),
-- trifft kein gemerkter alter Stand. Ohne Fremdschlüssel auf haushalte: Der Trigger läuft beim Abschluss auch dann,
-- wenn dieselbe Transaktion den Haushalt löscht.
CREATE TABLE haushaltsstand (
  haushalt_id uuid PRIMARY KEY,
  lesen       bigint NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000000)::bigint
);
INSERT INTO haushaltsstand (haushalt_id) SELECT id FROM haushalte ON CONFLICT DO NOTHING;

CREATE SEQUENCE haushaltsstand_zahlen;
SELECT setval('haushaltsstand_zahlen', (extract(epoch FROM clock_timestamp()) * 1000000)::bigint);

CREATE FUNCTION dms_lesestand() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO haushaltsstand (haushalt_id)
    VALUES (CASE WHEN TG_OP = 'DELETE' THEN OLD.haushalt_id ELSE NEW.haushalt_id END)
    ON CONFLICT (haushalt_id) DO UPDATE SET lesen = haushaltsstand.lesen + 1;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER mappentypen_lesestand AFTER INSERT OR UPDATE OR DELETE ON mappentypen
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms_lesestand();
CREATE CONSTRAINT TRIGGER sichten_lesestand AFTER INSERT OR UPDATE OR DELETE ON sichten
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms_lesestand();
CREATE CONSTRAINT TRIGGER pakete_lesestand AFTER INSERT OR UPDATE OR DELETE ON pakete
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms_lesestand();
CREATE CONSTRAINT TRIGGER einstellungen_lesestand AFTER INSERT OR UPDATE OR DELETE ON einstellungen
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms_lesestand();

-- TRUNCATE kennt keine Zeilen: dann zählen alle Haushalte.
CREATE FUNCTION dms_lesestand_alle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE haushaltsstand SET lesen = lesen + 1;
  RETURN NULL;
END $$;
CREATE TRIGGER mappentypen_lesestand_leeren AFTER TRUNCATE ON mappentypen FOR EACH STATEMENT EXECUTE FUNCTION dms_lesestand_alle();
CREATE TRIGGER sichten_lesestand_leeren AFTER TRUNCATE ON sichten FOR EACH STATEMENT EXECUTE FUNCTION dms_lesestand_alle();
CREATE TRIGGER pakete_lesestand_leeren AFTER TRUNCATE ON pakete FOR EACH STATEMENT EXECUTE FUNCTION dms_lesestand_alle();
CREATE TRIGGER einstellungen_lesestand_leeren AFTER TRUNCATE ON einstellungen FOR EACH STATEMENT EXECUTE FUNCTION dms_lesestand_alle();
