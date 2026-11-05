# One container: dms-komplett {#ein-container-dms-komplett}

!!! info "Tested: automatically on amd64 and arm64"
    `dms-komplett` is started as a trial on GitHub's machines with every change, on amd64 and arm64. There is no report from a particular device yet. What that means is described under [Tested platforms](plattformen.md).

The alternative to two containers: **one container** in which Ablago and its database (PostgreSQL 17) run together. There is no password to enter, no database container and no Compose project unless you want one. The image is called `ghcr.io/motom001/dms-komplett` and runs on amd64 and arm64.

!!! info "Two containers are recommended"
    For long-term operation we recommend two containers (`dms` and `postgres:17`): PostgreSQL then gets security updates independently of Ablago, and both can be run separately. `dms-komplett` is a good fit for **trying out and testing**, for interfaces that can only **"create container from image"**, and for **providers that allow only one container**. The comparison is under [One or two containers?](index.md#ein-oder-zwei-container). You can move between the two at any time via backup and restore, see [Growing and moving](https://help.ablago.app/admin/aktuell/en/wachsen/).

## With Docker Compose {#mit-docker-compose}

```sh
mkdir -p ~/dms && cd ~/dms
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/motom001/dms/main/deploy/komplett/docker-compose.yml
docker compose up -d
docker compose logs dms | grep -A1 Einrichtungscode
```

Docker creates the folders `files`, `geheim`, `sicherung`, `postgres` and – optionally for the scanner – `eingang` ([inbox folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/)) next to the file. On a NAS, replace `./` with the path of your folder, e.g. `/volume1/docker/dms/`.

## With `docker run` {#mit-docker-run}

```sh
docker run -d --name dms --restart unless-stopped --stop-timeout 60 -p 8080:3000 \
  -v /path/to/dms/files:/data/files \
  -v /path/to/dms/geheim:/data/geheim \
  -v /path/to/dms/sicherung:/data/sicherung \
  -v /path/to/dms/postgres:/data/postgres \
  ghcr.io/motom001/dms-komplett:stabil
```

## In a NAS's interface {#in-der-oberflache-eines-nas}

Synology (Container Manager), UGREEN (Docker), QNAP (Container Station) and Unraid can create a container directly from an image:

1. Download the image **`ghcr.io/motom001/dms-komplett:stabil`** or create a container from it.
2. **Port:** local `8080` → container `3000`.
3. **Folders:** create four folders on the NAS and map them – `files` → `/data/files`, `geheim` → `/data/geheim`, `sicherung` → `/data/sicherung`, `postgres` → `/data/postgres`. Optionally a fifth one for the scanner: `eingang` → `/eingang` ([inbox folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/)).
4. **Restart policy:** "always" or "unless-stopped".
5. Start it.

## Set up {#einrichten}

Open `http://<device>:8080`. The wizard asks for the **setup code**. It is in the container's log and in the file `geheim/EINRICHTUNGSCODE`. It does **not** ask for the database; it is already connected.

--8<-- "assistent-weiter.md"

If you already have a DMS with two containers, choose **Restore from a backup** in the wizard and restore a backup from there. This way you move without losing anything.

## Good to know {#gut-zu-wissen}

- **No password:** the database can only be reached inside the container. There is no database port to the outside.
- **Folders:** all four must be on the device (volumes), otherwise they are gone with the next update. The container sets the permissions of `postgres` itself on start.
- **Stopping:** when stopping, the container first shuts down Ablago and then the database cleanly. Give it up to a minute for this (`stop_grace_period` or `--stop-timeout`). If one of the two parts ends unexpectedly, the whole container ends, and Docker restarts it.
- **Updates:** `docker compose pull && docker compose up -d`, or pull the image again and recreate the container. PostgreSQL updates come with the Ablago image; **Workbench → System status → Version and updates** shows whether there is one. With a version number instead of `main`, i.e. `ghcr.io/motom001/dms-komplett:<version>` with a number from the [releases](https://github.com/motom001/dms/releases), the installation stays on that release. With `main`, PostgreSQL is rebuilt weekly; with a fixed version only with the next release.
- **New major version of PostgreSQL:** if a future image brings a new major version (e.g. 18), the container deliberately does not start with the old database and says so in the log. The switch then works via backup and restore, see [Growing and moving](https://help.ablago.app/admin/aktuell/en/wachsen/#neue-hauptversion-von-postgresql).
- **Workbench → System status → Version and updates** shows "dms-komplett (with PostgreSQL in the container)" for the image and "in the container (dms-komplett)" as the location of the database.
- **Console:** for emergencies and operation, the container has the command `dms`, e.g. `docker compose exec dms dms hilfe`. See [Console](https://help.ablago.app/admin/aktuell/en/konsole/).
