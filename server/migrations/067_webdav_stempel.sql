-- #722: Stempel beim Lesen über das WebDAV-Laufwerk. Die mitgelieferte Vorlage „Aus Ablago (Laufwerk)“
-- (Id „webdav“, wie STANDARD_VORLAGEN in shared/src/stempel.ts) kommt zu gespeicherten Vorlagen dazu – ohne
-- gespeicherte Vorlagen gelten ohnehin die Standardvorlagen samt dieser. Die Einstellung des Laufwerks bekommt
-- „stempel“: „webdav“, wo sie noch keine Angabe dazu hat (eingeschaltet, abschaltbar in der Werkbank).
UPDATE einstellungen
SET wert = jsonb_set(wert, '{vorlagen}', (wert->'vorlagen') || jsonb_build_array(jsonb_build_object(
  'id', 'webdav', 'name', 'Aus Ablago (Laufwerk)', 'text', 'Aus Ablago · {datum}', 'lage', 'fuss',
  'deckkraft', 0.6, 'seiten', 'alle', 'seitenzahlen', false, 'archivnummer', false)))
WHERE schluessel = 'stempel'
  AND jsonb_typeof(wert->'vorlagen') = 'array'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(wert->'vorlagen') v WHERE v->>'id' = 'webdav');

UPDATE einstellungen
SET wert = wert || '{"stempel": "webdav"}'::jsonb
WHERE schluessel = 'webdav' AND jsonb_typeof(wert) = 'object' AND NOT (wert ? 'stempel');
