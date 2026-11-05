# Maintenance mode {#wartungsmodus}

Before an update or a restore, nobody should be working at the same time – otherwise changes get lost. Maintenance mode under **Workbench → Maintenance → Maintenance mode** takes care of this in two stages. On the same page, below it, are the [maintenance operations](texterkennung.md#wartungsoperationen).

--8<-- "ausgeblendet-organisation.md"

Even without an entry in the sidebar you reach it via the button **To maintenance mode** on the page [Restoring](wiederherstellen.md) and via the overview's notices.

![Maintenance mode in the workbench](bilder/werkbank-wartungsmodus.png)

On the left in the sidebar, next to maintenance mode, it says **announced** as long as it isn't in effect yet, and **on** as soon as it is active.

## Switching on {#einschalten}

1. Optionally enter a **text for everyone**, e.g. "Update to the new version".
2. Choose the **start** – preset is *now + 30 minutes*; with **+15 min**, **+30 min** and **+1 hr** you quickly set it from now. At this time everyone else is signed out. It may not be in the past and at most 24 hours in the future, because from the announcement onwards only administrators can sign in.
3. Optionally the **expected end** – it must be after the start.
4. **Announce maintenance**.

Below the fields, a sentence sums up the effect, e.g. "From now on everyone sees a notice with a countdown; only people who may administer Ablago can sign in. At 12:45 everyone else will be signed out. Expected end 13:45."

## Lock right now { #jetzt-sofort-sperren }

For emergencies, e.g. a **security incident** (a password or device has fallen into the wrong hands, you see unknown sign-ins): the red button **Lock right now** skips the announcement. After a confirmation

- all other sessions end immediately, including those of other administrators,
- the interface answers with **503**,
- you yourself stay signed in.

Text for everyone and expected end are taken over if you filled them in; they aren't required. The [log](fehlersuche.md#protokoll) says "Maintenance mode locked immediately", and **Status** says "locked immediately" – so you can tell it apart from an announced maintenance.

Then tidy up calmly, e.g. change affected passwords, block an account under **Workbench → Users**, require two-factor sign-in or [change the key](verschluesselung.md#schlussel-wechseln) – and then **End maintenance**.

## Stage 1: announced {#stufe-1-angekundigt}

- Everyone signed in immediately sees – without reloading the page – a banner with a countdown: "Maintenance – you will be signed out in 29 minutes. Please save your work."
- Saving works until the very end.
- Only people who may administer can sign in anew; the sign-in page shows the notice.

![Banner for a member](bilder/wartung-banner.png)

## Stage 2: active {#stufe-2-aktiv}

At the chosen start – or immediately with **Sign everyone out now** or [Lock right now](#jetzt-sofort-sperren):

- All sessions except yours end, including those of other administrators (they can sign in again).
- The sign-in page shows the maintenance notice with text and expected end; only people who may administer can sign in.
- The [interface](api.md) (`/api/v1`) answers with **503** and `Retry-After` (seconds until the expected end, otherwise 15 minutes) – scripts should try again later.
- The background work pauses:
    - text recognition,
    - deadlines and reminders and the daily summary of tasks,
    - tidying up the recycle bin,
    - the scheduled [backup](sicherung.md) and the test restore,
    - fetching from the [mailboxes](postfaecher.md) and the [inbox folder](eingangsordner.md).

Under **Signed-in sessions** you see who is currently signed in with which device and when they were last active.

## Switching off {#ausschalten}

**End maintenance** switches the mode off; everyone can sign in again, and the background work continues. The mode survives a restart of Ablago – so after an update it is still on until you end it.

!!! note "Automatically when storage is full"
    If free space reaches the set limit, Ablago switches maintenance mode on itself – with 5 minutes' notice and the text "Storage space limit reached". You have to end it yourself as soon as there is space again (see [System status](speicherplatz.md#im-ernstfall)).

On, off and signing out are recorded in the [log](fehlersuche.md#protokoll) (module *system*).

!!! tip "Before every update"
    Under **Workbench → Backup**, create a backup with **Back up now**. Then announce maintenance, update the image from the start (see [Updating](aktualisieren.md)), check briefly, then **End maintenance**.
