-- Zähler-Endpunkt und Schlüssel-Stufe „nur Zähler“ (#625).
--
-- 1. API-Schlüssel bekommen eine dritte Stufe: „zaehler“ darf nur GET /api/v1/ich/zaehler aufrufen.
ALTER TABLE api_schluessel DROP CONSTRAINT IF EXISTS api_schluessel_recht_check;
ALTER TABLE api_schluessel ADD CONSTRAINT api_schluessel_recht_check CHECK (recht IN ('lesen', 'schreiben', 'zaehler'));

-- 2. Stand der Zahlen je Benutzer: zählt hoch, sobald sich die Zahlen (neue Post, Zu erledigen, anstehend,
--    überfällig) beim Abruf vom letzten Abruf unterscheiden. abdruck ist ein Hash nur dieser Zahlen, geaendert
--    der Zeitpunkt, zu dem die Änderung bemerkt wurde. In der Datenbank statt im Arbeitsspeicher, damit der
--    Stand einen Neustart übersteht, auf mehreren Servern derselbe ist und nie zurückspringt.
--    Keine Inhalte (Titel, Namen, Absender), nur dieser Hash.
CREATE TABLE zaehlerstaende (
  benutzer_id uuid PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  haushalt_id uuid NOT NULL,
  stand       bigint NOT NULL DEFAULT 1,
  abdruck     text NOT NULL,
  geaendert   timestamptz NOT NULL DEFAULT now()
);
