# Troubleshooting and support {#fehlersuche-und-support}

Everything about this is in the workbench under **Maintenance and troubleshooting**. The group contains System status, Log, Reported problems, Maintenance mode, Maintenance operations and Demo data. This page describes the troubleshooting tools and *Technology* (version and updates), which is under **Settings**; [System status](speicherplatz.md), [Maintenance mode](wartungsmodus.md), [Maintenance operations](texterkennung.md#wartungsoperationen) and [Demo data](demo.md) have their own pages. Backup, Restore and Full export are under **Protecting your data**.

*Log* and *Reported problems* belong to the preset **Business**. *Technology* is in every preset.

--8<-- "ausgeblendet-schritt.md"

## Reported problems { #gemeldete-fehler }

Users report problems via **Report a problem** in their menu – with their own description, up to two screenshots and technical details (version, browser, screen size, language, time zone, the last 25 pages visited, the last 10 errors in the browser and failed requests). Passwords, contents of Mappen and cookies are not sent along. The report stays in your Ablago – it never goes to the project. Whoever wants to make a GitHub issue out of it does so themselves.

![Workbench → Reported problems](bilder/werkbank-fehlermeldung.png)

Under **Workbench → Reported problems** are the reports, newest first; the counter in the sidebar and in the overview names the open ones. In the report you see description, screenshots and details and can **mark it as done** (and reopen it) or **delete** it – permanently, including images. Deliberately, there is no reply to the user in Ablago; you handle that your own way.

## Log { #protokoll }

**Workbench → Log** shows what is happening in Ablago – the last 24 hours, at most 10,000 entries, the newest at the top. After a restart the list starts empty; permanently, everything is in the container logs.

![Log](bilder/werkbank-protokoll.png)

Every entry belongs to a **module**, such as *User accounts and sign-in* (`konto`) for sign-ins and locked accounts or *Backup* (`sicherung`). Which modules exist is listed under [Technology → Modules](technik.md#module).

You can filter by level, module, user and text; **Live** updates the list every two seconds. A click on an entry shows all its data, including user and request id.

### Debug mode {#debug-modus}

Switches on additional, detailed messages for **one hour** – such as every single database query. After that (or after a restart) it switches off by itself. The basic level is set by `LOG_LEVEL` (see [Installation](installation.md#einstellungen)).

### Container logs { #container-logs }

Every message appears as a readable line in the container's logs (the log texts are German):

```text
2026-10-28T09:12:33.120Z INFO  [ablage] Mappe angelegt benutzer=lena@example.org typ=Rechnung titel="R-17 vom 01.10.2026"
```

```sh
docker logs <app-container>
```

## Database { #datenbank }

Long database accesses and requests, the **server load** and what is currently running in the database are shown under **Workbench → Settings → Database connection**, below the connection – see [Long database accesses](installation.md#lange-datenbankzugriffe). If Ablago seems slow, look there first – and under **Maintenance and troubleshooting → [System status](speicherplatz.md#auslastung)** to see how busy CPU, memory and network are.

Entries beginning with **Anfrage:** (request) concern a whole request; expanded, they show the **breakdown**: waiting before the handler, database (with the number of accesses), permissions, preparation and JSON. Details at the same time are in the [log](#protokoll) (module *datenbank*).

**Server load:** Ablago handles requests on one thread. If one request calculates for a long time, all others wait that long. The values show how long waiting typically took in the last minute, in 99 % of cases and at most. Below 50 ms is unremarkable; from 100 ms (99 %) a notice appears.

## Timing (developer mode) { #zeitmessung-entwicklermodus }

If a page seems slow, switch on **developer mode** under **My account**. Then Ablago shows at the bottom right for every page request, per request, where the time went, and at the top the total over all requests of the page. It only applies to your account.

| Section | What it is |
|---|---|
| Waiting (browser) | The request is waiting in the browser. It sends at most about 6 requests at the same time to one server; the rest wait. |
| Line | The way there and back without the time in the server – an approximation. It also contains the waiting before the server accepts the request at all; if it is busy, the **load** under Workbench → Database shows it. |
| Waiting (server) | From arrival in the server until processing, e.g. reading the request body. |
| Permissions | Evaluating permissions (building access, read filters, permissions per Mappe), without the database accesses in it. |
| Database | Number and duration of the database accesses. |
| Preparation | The remaining time in the server. |
| JSON | Converting the answer into text in the server. |
| Transfer, parsing, rendering | Sending the answer, reading and drawing it in the browser. |

The values come from the server in the header `Server-Timing` (`vor`, `app`, `db`, `rechte`, `json`, `gesamt`) and from the browser's timing. For the views' numbers (`/api/sichten`) there is additionally `zs`: `treffer` if they came from the cache, `neu` if they were counted – counting happens after every change in the household, otherwise at the latest after 5 minutes (views with a date reference) or 30 minutes and at midnight.

## Technology { #technik }

**Workbench → Maintenance and troubleshooting → System status → Version and updates** shows in the section **Installed** (below *Newer versions*) what is installed: version and state of Ablago, runtime (Node.js, operating system), database, libraries and interface.

![Technology and versions](bilder/werkbank-technik.png)

- **For support:** copy the overview and paste it into a [GitHub issue](https://github.com/motom001/dms/issues/new?template=wunsch.md). Passwords and credentials are not in it.
- **Newer versions:** one push of a button asks whether there are newer versions – at GitHub for Ablago, at endoflife.date for Node.js, PostgreSQL and Alpine, at npm for the libraries. Without a push of the button, Ablago asks nowhere. For Ablago itself, *Current* shows the newest release with its date; if there are further changes on `main` that aren't in any release yet, the notice names them.

How the building blocks fit together is described under [Technology](technik.md).

## Typical problems {#typische-probleme}

??? question "After the update the container doesn't start."
    The container log says why, usually a migration or a missing database connection. The migrations run in a transaction – the database has stayed unchanged. If necessary, go back to the previous version (image tag) and create an issue with the log.

??? question "E-mails don't arrive."
    Under **Workbench → E-mail and address**, first **Check connection**, then **Send test e-mail** – the mail server's message is shown below. Typical: wrong password (many providers need an app password), connection type doesn't match the port (STARTTLS ↔ 587, SSL/TLS ↔ 465), port blocked by the network. The log (module `mail`) records every sending with an error. Also look in the spam folder.

??? question "Ablago is sluggish while someone is exporting or editing many PDFs."
    Heavy work runs in separate [workers](speicherplatz.md#arbeiter-fur-pdf-und-exporte) (#542); other users should hardly notice. Under **Workbench → System status → Load** you see whether the workers are busy, how many jobs are waiting and how high the **server's waiting time** is. If the container's CPU is permanently at the limit, cores are missing – give the container more (`cpus:`) or set `DMS_ARBEITER` lower, so that requests and database get more computing time. If the log says "Hohe Wartezeit des Servers" (high server waiting time) although the workers are idle, something is calculating in the main thread: please report it as an issue, with the log entry.

??? question "A PDF edit or an export aborts with "took longer than 10 minutes" or "more memory than allowed"."
    A job in the worker may take at most 10 minutes and use 1.5 GB of memory – so that a single huge PDF doesn't paralyse Ablago. Export fewer Mappen at once or split a large PDF beforehand ("Pages"). If the worker runs at the container's limit (`mem_limit`), more memory for the container helps.

??? question "Links in e-mails point to localhost."
    Under **Workbench → E-mail and address**, enter the address under which users open Ablago.

??? question "Sign-in doesn't work behind the proxy."
    If Ablago's address (Workbench → E-mail and address) is an `https://` address, the session cookie is only set via HTTPS. Then also open Ablago via HTTPS. If `TRUST_PROXY` is set to `false` or to a list that doesn't contain the proxy, Ablago doesn't believe the proxy that the connection is HTTPS – then remove the variable. See [Behind a reverse proxy](installation.md#hinter-einem-reverse-proxy).

??? question "The log and the sessions always show the same IP address."
    That is the reverse proxy's address: Ablago doesn't believe its information. Look under **Technology** at what `TRUST_PROXY` says. If the proxy has a public address, `TRUST_PROXY` can be set to this address or to `true` – more under [What the proxy tells Ablago](installation.md#was-der-proxy-dem-dms-mitteilt).

??? question "Uploading large files aborts."
    Allow larger requests in the reverse proxy, e.g. for nginx `client_max_body_size 110m;`.

??? question "The interface is unusable after a design change."
    Append `?design=standard` to the address, see [Designs](designs.md#eigenes-css).

??? question "A user reports a problem that I can't reproduce."
    [Sign in as this user](benutzer.md#fehler-nachstellen) and reproduce it there.
