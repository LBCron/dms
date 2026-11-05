# Region

**Workbench → Settings → Region** sets in one place where your Library is at home. The following depend on it:

- the **public holidays** in the calendar and for the [Daily summary](aufgaben.md#tagliche-zusammenfassung),
- "**today**" – for deadlines, lead times, filters like "created today", number sequences with a year and retention periods,
- all **times**: Daily summary, automations with "date reached" and schedules, backups, dates in emails, access copies, stamps and exports.

## Settings {#einstellungen}

- **Country** – for now only Germany; further countries with their public holidays will follow later.
- **State** – for the statutory public holidays. Ablago calculates them itself: the nationwide ones and those of the chosen state, Easter and the days depending on it using Gauss's Easter formula. Public holidays that only apply in individual municipalities – such as the Assumption in parts of Bavaria or the Augsburg Peace Festival – and one-off public holidays are missing. *None – without public holidays* switches them off.
- **Time zone** – default *Europe/Berlin*. The usual time zones of Europe and a few more are available.

Below the settings you see the **public holidays of the current year** as they are stored.

## Good to know {#gut-zu-wissen}

- A new installation is set to *Germany · without state · Europe/Berlin*. The setup wizard doesn't ask about it – if you don't need public holidays, you don't have to do anything.
- Up to version 0.159, the state was under *Notifications and tasks*. An update takes it over from there; the time zone stays *Europe/Berlin*.
- With several servers, a change applies immediately on the server where you save, and on the others after a minute at the latest.
- The setting is in the database and therefore in every [backup](sicherung.md). The [full export](export.md) stores it as `struktur/region.json`, the [interface](api.md) delivers it read-only at `GET /api/v1/region`.
- If you change the time zone, Ablago calculates in the new one from then on. Deadlines already created keep their date; Ablago doesn't catch up on times that have already passed.
