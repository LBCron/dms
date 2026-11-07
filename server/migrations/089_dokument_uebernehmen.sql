-- Dokument übernehmen, Fundament (#937, #938).
--
-- Mappentyp (#937): „Kann aus Post angelegt werden“ (aus_post) und „Woran man ihn erkennt“ (erkennbar_an).
-- aus_post NULL heißt Vorgabe: an, wenn der Typ ein Dokumentenregister hat (shared/src/model.ts, kannAusPost);
-- Systemtypen nie. Gespeichert wird nur, was der Administrator ausdrücklich wählt.
ALTER TABLE mappentypen ADD COLUMN aus_post boolean;
ALTER TABLE mappentypen ADD COLUMN erkennbar_an text NOT NULL DEFAULT '';

-- Feld (#938): Der Haken „Für die Erkennung nutzen“ heißt jetzt „Aus Dokument füllen“; seine Daten (erkennung mit
-- Art und Erkennungshinweis) bleiben unverändert. Mappen wiederfinden (Absender, Zielmappe, Doppelte) geht künftig über
-- den eigenen Haken „Zum Wiederfinden nutzen“ (wiederfinden). Damit nichts verloren geht, bekommen ihn die Felder, über
-- die Ablago bisher Mappen wiedergefunden hat: markiert, Text oder Zahl, und ihre Art ist ein Merkmal – eingestellt
-- (Nummer, IBAN, USt-IdNr., E-Mail, Internet, Telefon, Mobil, Fax, Name) oder geschätzt aus Format, Kennung und
-- Bezeichnung wie in artVon (shared/src/erkennung.ts). Langtexte fallen weg – der Haken gilt nur für Text, Zahl und Verweis.
UPDATE mappentypen t SET felder = (
  SELECT jsonb_agg(
    CASE WHEN f ? 'erkennung' AND jsonb_typeof(f->'erkennung') = 'object' AND f->>'typ' IN ('text', 'zahl') AND NOT (f ? 'wiederfinden') AND (
      f->'erkennung'->>'art' IN ('nummer', 'iban', 'ustid', 'email', 'internet', 'telefon', 'mobil', 'fax', 'name')
      OR (f->'erkennung'->>'art' IS NULL AND (
        (f->>'typ' = 'text' AND f->>'format' IN ('email', 'telefon', 'internetseite', 'iban'))
        OR (coalesce(f->>'format', '') NOT IN ('plz') AND (
          -- Kontaktangaben gehen in artVon allem anderen vor.
          s.norm ~ '\m(e ?mail|iban|ust|ust id|ustid|umsatzsteuer\w*|vat|mobil|handy|mobile|fax|telefax|telefon|tel|phone|fon|internet\w*|webseite|website|homepage|domain|url)\M'
          OR (NOT s.norm ~ '\m(hausnummer|hausnr|hnr|strasse|str|anschrift|adresse|plz|postleitzahl|ort|stadt|wohnort|vorname|nachname|familienname|funktion|position|stelle)\M' AND (
            s.norm ~ '\m(\w*nummer|\w*nr|kennzeichen|fahrgestell\w*|aktenzeichen|zeichen|kennung|fin|vin)\M'
            OR (f->>'typ' = 'text' AND s.norm ~ '\m(name|firma|kuerzel|bezeichnung)\M'))))))))
    THEN f || '{"wiederfinden": true}'::jsonb ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(t.felder) WITH ORDINALITY AS x(f, i)
  CROSS JOIN LATERAL (SELECT regexp_replace(
    replace(replace(replace(replace(lower(coalesce(f->>'key', '') || ' ' || coalesce(f->>'label', '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]+', ' ', 'g') AS norm) s
)
WHERE t.system IS NULL AND jsonb_typeof(t.felder) = 'array' AND jsonb_array_length(t.felder) > 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.felder) e WHERE e ? 'erkennung');
