-- Zustand zwischen Anfragen in der Datenbank (#744): Was bisher nur im Arbeitsspeicher eines Prozesses lag – Fehlversuche,
-- Sperren, Einmal-Tickets (zweiter Anmeldeschritt, OIDC, Postfach-OAuth, Abrufseite), Merker „kurz hintereinander nur
-- einmal“ und der Stand des Haushalts –, gilt so für alle Prozesse und Server derselben Datenbank.
--
-- Je Eintrag: Art (wofür), Schlüssel (bei Geheimnissen nur ein Hash), Zähler, Wert (Geheimes mit dem Schlüssel des DMS
-- verschlüsselt) und Ablauf. `bis` NULL heißt „bis jemand ihn löscht“ (z. B. dauerhafte IP-Sperre). Abgelaufene Einträge
-- gelten nicht mehr und räumt ein regelmäßiger Lauf weg. Nicht in der Sicherung (wie die Sitzungen).
CREATE TABLE kurzzustand (
  haushalt_id  uuid NOT NULL REFERENCES haushalte(id) ON DELETE CASCADE,
  art          text NOT NULL,
  schluessel   text NOT NULL,
  anzahl       bigint NOT NULL DEFAULT 0,
  wert         jsonb,
  bis          timestamptz,
  PRIMARY KEY (haushalt_id, art, schluessel)
);
CREATE INDEX kurzzustand_bis ON kurzzustand (bis) WHERE bis IS NOT NULL;

-- Bisherige Sperren des Anmeldeschutzes (#240) aus den Einstellungen übernehmen: gesperrte IP-Adressen und Konten.
INSERT INTO kurzzustand (haushalt_id, art, schluessel, wert, bis)
SELECT e.haushalt_id, 'anmeldung-ip-sperre', s->>'ip', jsonb_build_object('seit', s->>'seit', 'grund', COALESCE(s->>'grund', '')),
       CASE WHEN s->>'bis' IS NULL THEN NULL ELSE (s->>'bis')::timestamptz END
FROM einstellungen e,
     jsonb_array_elements(CASE WHEN jsonb_typeof(e.wert->'ips') = 'array' THEN e.wert->'ips' ELSE '[]'::jsonb END) s
WHERE e.schluessel = 'anmeldesperren' AND COALESCE(s->>'ip', '') <> ''
ON CONFLICT DO NOTHING;

-- Konten: früher „E-Mail|IP“, jetzt „IP|E-Mail“ (Entsperren einer IP löscht alle Konten dieser IP auf einmal).
INSERT INTO kurzzustand (haushalt_id, art, schluessel, anzahl, bis)
SELECT e.haushalt_id, 'anmeldung-konto', regexp_replace(k.key, '^(.*)\|([^|]*)$', '\2|\1'),
       COALESCE((k.value->>'anzahl')::bigint, 0), to_timestamp(COALESCE((k.value->>'bis')::double precision, 0) / 1000.0)
FROM einstellungen e,
     jsonb_each(CASE WHEN jsonb_typeof(e.wert->'konten') = 'object' THEN e.wert->'konten' ELSE '{}'::jsonb END) k
WHERE e.schluessel = 'anmeldesperren' AND k.key LIKE '%|%' AND jsonb_typeof(k.value) = 'object'
ON CONFLICT DO NOTHING;

DELETE FROM einstellungen WHERE schluessel = 'anmeldesperren';
