-- Inhalte übersetzen auf Knopfdruck (#732): Jede Person kann den Knopf „Übersetzung anzeigen“ für sich abschalten
-- (Mein Konto). Vorgabe an – angeboten wird er ohnehin nur, wenn ein Paket mit dem Recht dms:uebersetzen läuft und der
-- Administrator es nicht für alle abgeschaltet hat (Einstellung „uebersetzen“ in der Tabelle einstellungen).
-- Die Übersetzungen selbst stehen nur im Zwischenspeicher (Tabelle kurzzustand, Art „uebersetzung“), nie an der Mappe.
ALTER TABLE benutzer ADD COLUMN uebersetzen boolean NOT NULL DEFAULT true;
