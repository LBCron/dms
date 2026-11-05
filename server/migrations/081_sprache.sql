-- Sprache je Person (#729): gewählt in Mein Konto aus den erlaubten Sprachen (Werkbank → Sprachen).
-- NULL heißt „wie die Installation“ – so ändert das Update für niemanden etwas. Die erlaubten Sprachen und die
-- Sprache der Installation stehen in der Einstellung „sprachen“ (Tabelle einstellungen), dafür braucht es keine Spalte.
ALTER TABLE benutzer ADD COLUMN sprache text;
