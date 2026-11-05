-- Verwaltungsrecht an der Person und Verwaltungsmodus (#818, #819): Es gibt kein Konto „Administrator“ mehr.
-- Verwalten ist ein Recht an der Person: '{}' = verwaltet nicht, '{*}' = Gesamte Verwaltung (auch künftige Bereiche),
-- sonst die Werkbank-Bereiche der ersten Ebene (Pfad unter /werkbank). Dienst- und Systemkonten bekommen es nie.
ALTER TABLE benutzer ADD COLUMN verwaltung text[] NOT NULL DEFAULT '{}';
ALTER TABLE benutzer ADD CONSTRAINT benutzer_verwaltung_person CHECK (art = 'person' OR verwaltung = '{}');

-- Umstellung: Vorhandene Admin-Konten werden normale Benutzer mit „Gesamte Verwaltung“; die Systemrolle entfällt.
-- (Die frühere Rollen-Mappe „Administrator“ löst der Server beim Start: siehe Dienst.loeseFruehereAdminrolle.)
UPDATE benutzer SET verwaltung = '{*}' WHERE rolle = 'admin' AND art = 'person';
-- Die Spalte rolle liest Ablago nicht mehr (nur noch für ältere Sicherungen und Downgrade-Prüfungen da).
UPDATE benutzer SET rolle = 'mitglied' WHERE rolle = 'admin';

-- Verwaltungsmodus als Zustand der Sitzung auf dem Server (Bauvorgabe Sicherheit, #810):
--   anmeldung_voll       Anmeldung mit allen eingerichteten Faktoren (nicht: verlängerte, vertretene Sitzung)
--   verwaltung_seit      Beginn des laufenden Modus, NULL = kein Modus
--   verwaltung_aktiv     letzte Aktivität im Modus (endet nach 15 Minuten ohne)
--   verwaltung_bestaetigt  Tagesmerker: heute in diesem Browser schon erneut angemeldet (endet um Mitternacht,
--                        mit Abmelden, Passwortwechsel, Änderung der Zwei-Faktor-Anmeldung, Entzug des Rechts)
--   frisch               letzte frische Anmeldung für heikle Handlungen (gilt 10 Minuten)
ALTER TABLE sitzungen
  ADD COLUMN anmeldung_voll timestamptz,
  ADD COLUMN verwaltung_seit timestamptz,
  ADD COLUMN verwaltung_aktiv timestamptz,
  ADD COLUMN verwaltung_bestaetigt timestamptz,
  ADD COLUMN frisch timestamptz;

-- Historie (#820): „Im Verwaltungsmodus angesehen“ – für die Liste in der Werkbank schnell finden. Diese Einträge
-- bleiben auch beim Aufräumen der Historie endgültig gelöschter Mappen stehen (nicht löschbar).
CREATE INDEX historie_verwaltungsmodus_idx ON historie (haushalt_id, zeit DESC) WHERE art = 'verwaltungsmodus';
