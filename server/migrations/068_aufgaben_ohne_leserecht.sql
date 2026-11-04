-- Aufgaben bei Personen ohne Leserecht (#798): von wann bis wann eine Aufgabe bei jemandem lag, der die Mappe nach den
-- Berechtigungen nicht lesen darf – offene und vergangene Fälle für die Übersicht in der Werkbank. Dazu das Leserecht
-- auf Zeit, das der Admin je Fall geben kann: Es gilt nur für diese Mappe und nur, solange die Aufgabe offen bei dieser
-- Person liegt (der Zugriff prüft das bei jeder Anfrage gegen die Aufgabe). Vergabe und Entzug stehen in der Historie der Mappe.
-- Ohne Fremdschlüssel auf Aufgabe und Mappe: Vergangene Fälle bleiben stehen, auch wenn es beides nicht mehr gibt.
CREATE TABLE aufgaben_ohne_leserecht (
  id             uuid PRIMARY KEY,
  haushalt_id    uuid NOT NULL REFERENCES haushalte(id),
  aufgabe_id     uuid NOT NULL,
  mappe_id       uuid NOT NULL,
  benutzer_id    uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  aufgabentext   text NOT NULL,
  beginn         timestamptz NOT NULL DEFAULT now(),
  ende           timestamptz,
  ende_grund     text CHECK (ende_grund IN ('erledigt', 'geloescht', 'weitergegeben', 'lesbar')),
  leserecht_seit timestamptz,
  leserecht_von  uuid REFERENCES benutzer(id) ON DELETE SET NULL
);
-- Je Aufgabe und Person höchstens ein offener Fall (mehrere Server gleichen gleichzeitig ab).
CREATE UNIQUE INDEX aufgaben_ohne_leserecht_offen_idx ON aufgaben_ohne_leserecht (aufgabe_id, benutzer_id) WHERE ende IS NULL;
-- Leserecht auf Zeit beim Bilden des Zugriffs (jede Anfrage) schnell finden.
CREATE INDEX aufgaben_ohne_leserecht_recht_idx ON aufgaben_ohne_leserecht (haushalt_id, benutzer_id) WHERE ende IS NULL AND leserecht_seit IS NOT NULL;
CREATE INDEX aufgaben_ohne_leserecht_zeit_idx ON aufgaben_ohne_leserecht (haushalt_id, beginn DESC);
