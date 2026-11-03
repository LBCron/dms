-- Webhooks (#627): das DMS meldet geänderte Zahlen eines Benutzers (neue Post, Zu erledigen, Fristen) an eine Adresse.
--
-- 1. Webhooks je Benutzer. Das Geheimnis für die Signatur ist mit dem Schlüssel des DMS verschlüsselt („dms1$…“,
--    wie Postfach-Passwörter und OIDC-Client-Secret) und wird beim Schlüsselwechsel mit umgeschlüsselt.
--    gemeldet_stand: Stand der Zahlen (zaehlerstaende.stand), der zuletzt in den Ausgangskorb ging – in der Datenbank,
--    damit nach einem Neustart oder auf einem zweiten Server nichts doppelt oder gar nicht gemeldet wird.
--    gesendet: Beginn des letzten Versuchs (für den Mindestabstand zwischen zwei Meldungen, Zusammenfassen).
CREATE TABLE webhooks (
  id              uuid PRIMARY KEY,
  haushalt_id     uuid NOT NULL REFERENCES haushalte(id),
  benutzer_id     uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  name            text NOT NULL,
  url             text NOT NULL,
  geheimnis       text NOT NULL,
  ereignisse      text[] NOT NULL DEFAULT '{zaehler.geaendert}',
  aktiv           boolean NOT NULL DEFAULT true,
  -- Warum abgeschaltet: {grund: 'fehler'|'admin', zeit, von?, text?}; null = nicht abgeschaltet.
  abgeschaltet    jsonb,
  gemeldet_stand  bigint,
  gesendet        timestamptz,
  fehler_folge    int NOT NULL DEFAULT 0,
  -- Letzte Zustellung oder Probe: {zeit, ok, status, fehler, art, ms}; ohne Inhalte.
  letzte          jsonb,
  erstellt        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhooks_benutzer ON webhooks (haushalt_id, benutzer_id);

-- 2. Ausgangskorb: höchstens eine offene Meldung je Webhook (neuere Zahlen ersetzen die Daten der offenen).
--    ereignis_id: Ereignis-Id für den Empfänger (Wiederholung erkennen); sie wechselt, sobald sich die Daten einer
--    schon einmal versuchten Meldung ändern. zustand: offen | zugestellt | aufgegeben | verworfen.
--    Keine Inhalte: daten enthält nur Zahlen, Stand und Zeit.
CREATE TABLE webhook_meldungen (
  id           uuid PRIMARY KEY,
  haushalt_id  uuid NOT NULL REFERENCES haushalte(id),
  webhook_id   uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  ereignis_id  uuid NOT NULL,
  art          text NOT NULL,
  daten        jsonb NOT NULL DEFAULT '{}'::jsonb,
  zustand      text NOT NULL DEFAULT 'offen' CHECK (zustand IN ('offen', 'zugestellt', 'aufgegeben', 'verworfen')),
  erstellt     timestamptz NOT NULL DEFAULT now(),
  faellig      timestamptz NOT NULL DEFAULT now(),
  versuche     int NOT NULL DEFAULT 0,
  status       int,
  fehler       text,
  erledigt     timestamptz
);
CREATE UNIQUE INDEX webhook_meldungen_eine_offene ON webhook_meldungen (webhook_id) WHERE zustand = 'offen';
CREATE INDEX webhook_meldungen_faellig ON webhook_meldungen (haushalt_id, faellig) WHERE zustand = 'offen';
CREATE INDEX webhook_meldungen_verlauf ON webhook_meldungen (webhook_id, erstellt DESC);
