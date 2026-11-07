-- Rundgang bei der ersten Anmeldung (#831): Er startet nur für neue Konten von selbst. Wer sich vor diesem Update schon
-- angemeldet hatte, kennt Ablago – für diese Konten gilt Ablagos Rundgang als gesehen. Konten, die sich noch nie
-- angemeldet haben (offene Einladungen), bekommen ihn bei der ersten Anmeldung. Alle finden ihn unter
-- „Ablago entdecken“. Gemerkt wird je Person in benutzer_einstellungen (Schlüssel entdecken_rundgaenge, server/src/entdecken.ts).
INSERT INTO benutzer_einstellungen (benutzer_id, schluessel, wert)
SELECT id, 'entdecken_rundgaenge', jsonb_build_object('ablago', jsonb_build_object('stand', 'gesehen', 'am', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
FROM benutzer
WHERE letzte_anmeldung IS NOT NULL
ON CONFLICT (benutzer_id, schluessel) DO NOTHING;
