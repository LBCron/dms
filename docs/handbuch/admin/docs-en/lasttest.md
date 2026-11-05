# Running the load test yourself {#lasttest-selbst-durchfuhren}

How much does Ablago cope with **on your device**? The computers on which the project measures every week are not a NAS. With the load test you measure yourself – for instance before buying a new device, before a move or when Ablago seems slow to you. You can report the result voluntarily; the table [What Ablago copes with](verkraftet.md) is made from these reports.

!!! warning "Only in a test container of its own – never in your real installation"
    The load test creates a household of its own with load-test accounts and up to 200,000 demo folders (level `extrem`: up to 1 million), changes demo folders when saving, tries out wrong passwords (to check [sign-in protection](anmeldeschutz.md)) and loads the device to its limit for minutes. Start a **new container of its own** for it and delete it again afterwards. The load test checks this itself: if Ablago is already set up and not by the load test, or there are more than 200 folders that aren't demo folders, it stops **before** it creates anything. If the variable `DMS_LASTTEST` is accidentally set in your real installation, Ablago therefore keeps running completely normally; the [Workbench overview](uebersicht.md) then reports that the load test didn't start and that you should remove the variable.

## The levels {#die-stufen}

| Level | represents | Load | Data | Target |
| --- | --- | --- | --- | --- |
| `klein` | household (2–5 people) | 25 simultaneous requests, mixed as in everyday life | 5,000 folders | 95 % of answers faster than 0.3 s, no errors |
| `mittel` | small business (10–15 people) | 100 at once, plus one large export after another | 50,000 folders | 95 % faster than 1 s, less than 0.1 % errors |
| `gross` | load limit | more simultaneous requests every 2 minutes (5, 10, 25, 50, 75 …) until 95 % no longer stay below 3 s, more than 1 % fail or the [overload protection](technik.md#last) kicks in; then briefly 1000 at once | 200,000 folders | no fixed value – what is measured is **where the limit lies**; required: no crash, recovering by itself |
| `extrem` | very large stock | like `gross` | 500,000 or 1,000,000 folders | like `gross` – a measurement, not a target; only if you choose it explicitly (not in `alle`) |

**With saving:** every level first measures exactly as before – reading only. Then follows a second run **with saving**: the same number of simultaneous requests (with `gross` and `extrem` as many as the limit was), about 10 % of them writing – changing a folder, setting a star, creating or deleting a note, creating and completing a task – and 5 % the first page of a folder's history (#800). It is a line of its own in the result, e.g. `mittel + Speichern`, and has no target (yet). Afterwards the load test undoes its changes so that the next level measures the same data. That way the existing lines stay comparable with older measurements.

**Target and CI limit:** the **target** is what the project wants to promise. The weekly measurement on GitHub's computers additionally checks a **CI limit**: the first run there plus 20 % – for `klein` 0.3 s (like the target), for `mittel` first 2.86 s, since the speed-up (#615) 1 s like the target. Only if it is missed does the run turn red; over time it only becomes stricter, until it reaches the target. The runs with saving and the level `extrem` have no CI limit. A missed target means: the project has to make Ablago faster there. What GitHub's computers and reported devices manage is under [What Ablago copes with](verkraftet.md).

"Mixed as in everyday life" means: start page, lists, opening folders, searching, thumbnails and downloading documents, as an administrator and as a member. 25 simultaneous requests correspond to about 2–5 people clicking right now – one click triggers several requests.

## Prerequisites {#voraussetzungen}

- Ablago from version 0.144.0 for the way in the browser (from 0.132.0 the [way for advanced users](#fur-fortgeschrittene) works).
- Space for the test container: about 1 GB for `klein` and `mittel`, 3–5 GB for `gross`, for `extrem` about 3 GB (500,000 folders) or 5 GB (1 million), and enough memory (4 GB or more).
- Quiet on the device: if a NAS backup, a media server or downloads run alongside, you measure them too. Also pause your own Ablago meanwhile if nobody is working with it right now.

## Step by step – in the Docker interface and the browser {#schritt-fur-schritt-in-der-docker-oberflache-und-im-browser}

You need **no console, no folders and no commands** – only a new container with **one** environment variable.

1. **Create a container** – in your NAS's Docker interface (e.g. *Docker* on UGREEN, *Container Manager* on Synology, *Container Station* on QNAP) create a new container from the image:

    | Setting | Value |
    | --- | --- |
    | Image | `ghcr.io/motom001/dms-komplett:stabil` (Ablago and database in one container) |
    | Name | e.g. `dms-lasttest` |
    | Port | a free port of the NAS, e.g. `8099`, to port `3000` in the container |
    | Environment variable | `DMS_LASTTEST` = `klein` (or `mittel`, `gross`, `alle`, `extrem` – see [The levels](#die-stufen)) |
    | Folders (volumes) | **none** |
    | Restart policy | off or "never" |

    Without connected folders everything runs inside the container and disappears with it – your folders on the NAS stay untouched.

2. **Open the page** – in the browser `http://<address of the NAS>:8099`, e.g. `http://nas.home.arpa:8099`. Instead of the sign-in you see the page **Load test**: which level is running, what is happening right now (setting up the test DMS, creating demo folders, measuring) and the **estimated remaining time**. The page also works on the phone.

    ![Load test page in the browser](bilder/lasttest-seite.png)

3. **Describe the device** – under **Describe your device** enter model and equipment, e.g. `UGREEN DXP4800 Plus, 16 GB RAM`. **No names, addresses or computer names** – the text is in the result you publish. What you type is in the result block immediately. Below it the **storage type** (HDD, SSD or NVMe): the test recognises it as far as that is possible from inside the container; otherwise you choose it – "don't know" works too. The test enters CPU model, cores and memory itself.

4. **Wait** – `klein` takes about 5–8 minutes, `mittel` 18–35 minutes (creating 50,000 folders), `gross` 35–70 minutes (creating 200,000 folders, then 2 minutes per step), `alle` correspondingly longer; this includes a good 2 minutes per level for the run with saving. `extrem` needs 1–2.5 hours on fast hardware with 500,000 folders and about twice as long with a million – on a small NAS clearly longer too. You can close the page and open it again later.

    Further variables, only if you need them: `DMS_LASTTEST_MAPPEN` = `1000000` measures `extrem` with a million instead of 500,000 folders; `DMS_LASTTEST_SPEICHERN` = `nein` leaves out the runs with saving; `DMS_LASTTEST_DAUER` changes the seconds per run (default 120).

5. **Copy the result** – at the end there is the block **Load test result** with **Copy** and **Download as file**, the links to the form and to the collective issue [#576](https://github.com/motom001/dms/issues/576) and – expandable – the whole report. How to read and report the result is described [below](#ergebnis-lesen).

    ![Load test page with the result to copy](bilder/lasttest-ergebnis.png)

6. **End the test** – **End test and shut down container**. If you haven't copied or downloaded the result yet, the page asks at this point and offers **Copy result** or **Shut down anyway**. Afterwards it says "Thank you for measuring with us!": the container shuts down, you can close the page; the result stays visible and copyable on the page. Started with `--rm`, the container is gone afterwards; otherwise delete it in the Docker interface and, if needed, the image too.

??? note "This is what the page looks like in dark mode and on the phone"
    ![Load test page, dark appearance](bilder/lasttest-seite-dunkel.png)

    ![Load test page on the phone](bilder/lasttest-handy.png)

### With one command in the console {#mit-einem-befehl-in-der-konsole}

The same in one line – `--rm` deletes the container as soon as you end the test on the page:

```sh
docker run -d --rm --name dms-lasttest -p 8099:3000 -e DMS_LASTTEST=klein ghcr.io/motom001/dms-komplett:stabil
```

Then continue with step 2. You delete the image if needed with `docker image rm ghcr.io/motom001/dms-komplett:stabil`.

### Measuring a specific disk {#einen-bestimmten-datentrager-messen}

Without folders, everything is where Docker keeps its containers – on many NAS the system SSD or the first storage volume. If you want to measure another disk specifically (e.g. the hard disks instead of the system SSD), connect **an empty folder** on this disk to `/data` in the container – that is the only reason for a folder:

```sh
docker run -d --rm --name dms-lasttest -p 8099:3000 -e DMS_LASTTEST=klein \
  -v /volume1/dms-lasttest:/data ghcr.io/motom001/dms-komplett:stabil
```

The test then recognises the storage type of this disk, and the result is additionally in this folder as a file under `ergebnis/`. Delete the folder after the test.

### Where else the result is {#wo-das-ergebnis-sonst-noch-steht}

If you closed the page before copying the result: it is also in the container's **logs** (in the Docker interface under *Log* or *Logs*) and as a file in the container under `/data/ergebnis/lasttest-<level>.md` – with device and storage as soon as you have entered them on the page. If the container restarts after ending (restart policy), it doesn't measure again but shows the result again.

## For advanced users {#fur-fortgeschrittene}

The load test is in the image as the command `dms-lasttest`. That way you measure without the page in the browser – for instance the variant with a separate database, with your own options or from another computer.

1. **Start a test installation** – with its own name, its own port and its own empty folders, e.g.:

    ```sh
    docker run -d --name dms-test -p 8099:3000 \
      -v /path/to/dms-test/files:/data/files \
      -v /path/to/dms-test/geheim:/data/geheim \
      -v /path/to/dms-test/sicherung:/data/sicherung \
      -v /path/to/dms-test/postgres:/data/postgres \
      ghcr.io/motom001/dms-komplett:stabil
    ```

    If you want to measure the variant with a separate database, take your template (Compose file) as a project of its own, e.g. `dms-test`, with other folders and another port – the way in the browser with `DMS_LASTTEST` also works there. Don't set it up – the load test does that.

2. **Start a level** – in the test container, i.e. on the same device:

    ```sh
    docker exec -it dms-test dms-lasttest klein --geraet "Model of your device" --speicher SSD
    ```

    Instead of `klein`, `mittel`, `gross`, `alle` (the three one after another) or `extrem` work (with `--mappen 1000000` a million instead of 500,000 folders). At the first start the load test sets up the fresh Ablago itself; it reads the setup code from the folder `geheim`. If folders are missing for a larger level, it adds the demo folders and waits until Ablago has finished its background work. `dms-lasttest --pruefen` only checks whether the load test would be allowed to run here and creates nothing.

3. **Read the result** – at the end there is a report and below it the block **Load test result**.

4. **Clean up:** stop and delete the test container (`docker rm -f dms-test`), delete the test installation's folders.

Options: `--geraet "…"` and `--speicher HDD|SSD|NVMe` enter device and storage into the result block (otherwise it says "please add"). `--dauer <seconds>` changes the measuring time of `klein` and `mittel` (default 120; in the way via the browser with the variable `DMS_LASTTEST_DAUER`). `--start`, `--schritt` and `--schritt-dauer` change the ramp of `gross` (default: 5 and 10, then from 25 in steps of 25, 120 seconds each; with `--start` it begins exactly there), `--bis <n>` limits it. `--ohne-speichern` leaves out the runs with saving. `--bericht <file>` saves the report.

Running the load test on another computer against the test installation also works (`--ziel http://…:8099`); then the CPU model is missing in the result, and the network is measured too.

### With a separate database (Compose) {#mit-getrennter-datenbank-compose}

In load test mode with `dms-komplett`, Ablago, PostgreSQL and the load generator run in the same container and share cores and memory – so the limit measured is not purely the limit of the device. With a separate database, PostgreSQL runs in a container of its own (on the same device). An example as a project of its own, e.g. `dms-test` – with its own port and **a volume for `/data`** and one for the database:

```yaml
# Load test with a separate database – only as a test project of its own, never next to your real Library.
services:
  db:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: dms
      POSTGRES_USER: dms
      POSTGRES_PASSWORD: lasttest
    volumes:
      - lasttest-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dms -d dms"]
      interval: 5s
      retries: 10

  app:
    image: ghcr.io/motom001/dms:stabil
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://dms:lasttest@db:5432/dms
      DMS_LASTTEST: klein
    volumes:
      # Documents, keys, result – belongs to the database above and must stay or go together with it.
      - lasttest-data:/data
    ports:
      - "8099:3000"

volumes:
  lasttest-postgres:
  lasttest-data:
```

Start with `docker compose up -d`, then continue with step 2 above (page in the browser). `restart: unless-stopped` restarts Ablago after a crash; after **End test and shut down container** the container also restarts and shows the result again. Clean up with `docker compose down -v` – that also deletes both volumes.

!!! warning "Database and files belong together"
    With the volumes, the database **and** the documents are kept between two runs; the next run reuses the demo folders. If you leave out the volumes, **both** containers have to be recreated before every run – `docker compose down`, then `docker compose up -d`. If only the `app` container is recreated, the database stays but the documents' files are missing. Ablago keeps running (the affected documents answer with “The file for this document is missing”), but the measurement counts errors instead of load. The load test checks this at the start and warns with “Documents without a file: n – is `/data` mounted as a volume?”.

## Reading the result {#ergebnis-lesen}

- **p50, p95, p99:** half, 95 % or 99 % of the answers came faster than this value. p95 is the most important: it shows what it feels like when things are sluggish.
- **Error rate:** share of requests with a server error or no answer at all. Rejected requests ("very busy right now", 503) count separately.
- **Target met / missed** (`klein`, `mittel`): whether your device manages the targets of the table above. Missed doesn't mean broken – Ablago is then slower with so many simultaneous requests than the project aims for. The report also names the project's **CI limit** (e.g. "target p95 < 1000 ms, CI limit 1000 ms"); it applies to the measurement on GitHub's computers, not to your device. Especially if your device misses the target, your report in the collective issue [#576](https://github.com/motom001/dms/issues/576) helps.
- **Limit** (`gross`, `extrem`): this many simultaneous requests the device still manages with 95 % of answers below 3 s, plus the requests per second. Below that it says why the next step was too much, and how fast Ablago recovered after 1000 simultaneous requests. In load test mode, Ablago, PostgreSQL and the load generator that sends the requests run in the same container and share its cores and memory – the limit is the limit of this set-up, not of the device alone.
- **… + Speichern:** the same load with about 10 % writing requests – p50, p95, p99 and error rate as in the line above, behind it in brackets p50 and p95 of the writing requests only. The distance to the line above shows how much saving slows down the others' reading. The line *With saving: memory …* only applies to these runs; *Ablago memory at most* counts, as before, only the runs without saving.
- **extrem demo data:** how long creating the demo folders took, how long Ablago had to work in the background afterwards and how large database and documents are.
- **Ablago memory at most:** this much the Ablago process itself occupied. The project's requirement of **at most 1.5 GB** (at `gross`) refers to this: this number only depends on Ablago, not on how much the device has left for database and caches.
- **Container memory at most:** this much the **whole container** needed – this number matches what your NAS's Docker interface shows. It is usually clearly higher than "Ablago at most": with `dms-komplett`, PostgreSQL runs in the same container and keeps data in memory (in brackets as *PostgreSQL*), and the operating system includes the **file cache**, which it releases again immediately when needed. *Programs* is the part that is really occupied. Node.js only returns memory late after the load, which is why the NAS's display stays high for a while after the test too. If the value can't be read in the container, it says "not available".
- **Event loop p99** (how long requests had to wait at most because the server was computing) shows, together with the memory, where it gets tight. Notes on the settings for this are under [System health → Settings and bottlenecks](speicherplatz.md#einstellungen-und-engpasse).
- **Engpass …** (bottleneck, #874, indented under a level; for `gross`, for the step at the limit): where things got stuck in this run, across all of Ablago's processes. *Warten auf DB-Verbindung* (waiting for a DB connection) – how long queries waited for a free database connection (p95 as the upper bound of a class, e.g. "≤ 20 ms", and the longest value). *Verbindungen belegt bis … von …* (connections in use) – how many were working at the same time, in brackets how many queries were waiting at most. *Sperren* (locks) – how many database sessions were waiting for a lock at the same time and how long the longest one did (samples every 2 seconds). *CPU* – computing time of PostgreSQL (only if it runs in the same container), Ablago and the whole container over the run, in per cent of **one** core (200 % = two cores fully used). *Neustarts von Prozessen* (restarts of processes) – how often a process crashed and restarted, with number and code or signal (SIGKILL usually means the kernel ended it because of too little memory). *Speicher je Prozess* (memory per process) – at most, per process (*Hauptprozess* – main process – only distributes, then *Prozess 1:*, *Prozess 2:* …), in brackets the share of Node.js's heap (*Halde*), e.g. "Hauptprozess 32 MB, Prozess 1: 1588 MB (Halde 977), Prozess 2: 862 MB (Halde 370)". If there were errors, a line **Fehler …** (errors) below names their kind: status (e.g. 500, 502), broken connections (e.g. ECONNRESET) and requests without an answer; for `gross` also for the step at which it stopped (*Engpass … (Abbruch)*). If waiting for connections is high while PostgreSQL's CPU isn't full, connections are missing; if the CPU is full, more connections or processes don't help.

## Reporting the result {#ergebnis-zuruckmelden}

The block **Load test result** contains **no personal data** and **no addresses, computer or household names** – only Ablago version, image, where the database runs, device (what you write into the device field), CPU, cores, memory, kind of storage, number of folders and documents, per level p50/p95/p99 and error rate (without and with saving), the limit, the peak memory, the event loop and for each run the bottleneck (connections, locks, computing time, memory per process). Copy it unchanged (on the page with **Copy**) into the form [Load test result](https://github.com/motom001/dms/issues/new?template=messergebnis-lasttest.yml) on GitHub or as a comment into the collective issue [#576](https://github.com/motom001/dms/issues/576), where all measurements come together. The contribution is public; everything is voluntary – Ablago itself reports nothing.
