-- Gemeinsamer Ereigniskatalog (#670): Was im DMS passiert – Mappe angelegt, geändert, gelöscht, Frist erreicht,
-- Benutzer abwesend, Volltext fertig … – für Automatisierungen (#674), Pakete und künftig Webhooks (#671).
--
-- 1. Ereignisse (Ausgangskorb): in derselben Transaktion wie die Änderung geschrieben, danach an die Abnehmer im DMS
--    verteilt (mindestens einmal; die Ereignis-Id erkennt eine Wiederholung). Nur Ids, Art, Feldschlüssel und Datum –
--    nie Feldwerte oder Titel.
--    ausloeser: wer es ausgelöst hat ({art: benutzer|paket|automatisierung|system, id, konto, kette}) – damit erkennt eine
--      Automatisierung ihre eigenen Änderungen (keine Selbstauslösung).
--    buendel: Schlüssel zum Zusammenfassen (z. B. mappe.geaendert|<mappe>): solange faellig in der Zukunft liegt und noch
--      niemand verteilt, kommen weitere Änderungen in dasselbe Ereignis.
--    gesperrt_bis: Frist, in der ein Server ein geholtes Ereignis verteilen muss (FOR UPDATE SKIP LOCKED, mehrere Server).
CREATE TABLE ereignisse (
  id            uuid PRIMARY KEY,
  nr            bigserial,
  haushalt_id   uuid NOT NULL REFERENCES haushalte(id),
  art           text NOT NULL,
  daten         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ausloeser     jsonb NOT NULL DEFAULT '{}'::jsonb,
  buendel       text,
  erstellt      timestamptz NOT NULL DEFAULT now(),
  faellig       timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis  timestamptz,
  versuche      int NOT NULL DEFAULT 0,
  fehler        text,
  verteilt      timestamptz
);
CREATE INDEX ereignisse_offen ON ereignisse (haushalt_id, faellig, nr) WHERE verteilt IS NULL;
CREATE INDEX ereignisse_buendel ON ereignisse (haushalt_id, buendel) WHERE verteilt IS NULL AND buendel IS NOT NULL;
CREATE INDEX ereignisse_verteilt ON ereignisse (haushalt_id, verteilt) WHERE verteilt IS NOT NULL;

-- 2. Fristen (#670): „Frist erreicht“ je Mappe, Feld, Datum und Zeitpunkt (Vorlauf bzw. Fristtag) genau einmal – auch
--    wenn der Fristen-Lauf auf zwei Servern zugleich läuft oder nach einem Neustart wiederholt wird.
CREATE TABLE frist_meldungen (
  haushalt_id  uuid NOT NULL REFERENCES haushalte(id),
  mappe_id     uuid NOT NULL,
  feld         text NOT NULL,
  datum        date NOT NULL,
  zeitpunkt    text NOT NULL CHECK (zeitpunkt IN ('vorlauf', 'faellig')),
  erstellt     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (haushalt_id, mappe_id, feld, datum, zeitpunkt)
);
