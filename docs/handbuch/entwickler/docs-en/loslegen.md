# Getting started {#loslegen}

## Prerequisites { #voraussetzungen }

- **Node.js 24** (LTS) and npm
- **Docker** (for PostgreSQL 17; or your own PostgreSQL installation)
- optionally **poppler-utils** for the text layer of PDFs, thumbnails and redacting (text recognition is a package, see [Packages with code](pakete-code.md#texterkennung))
- optionally **Python 3** with `mkdocs-material` for the manuals

## Fetching and starting the project { #projekt-holen-und-starten }

```sh
git clone https://github.com/motom001/dms.git && cd dms
npm install
docker compose up -d db         # only the database
DATABASE_URL=postgres://dms:dms@localhost:5432/dms npm run dev
```

`npm run dev` in the root folder starts server (port 3000) and interface together; the interface runs on http://localhost:5173 and forwards `/api` and `/hilfe` to the server. Individually it works with `npm run dev -w server` and `npm run dev -w web`.

Without Docker for Ablago itself, the server creates its fixed folders (`files`, `geheim`, `sicherung`) under `./data` in the project. `DMS_DATENWURZEL=/other/folder` moves them. At the first start with a working connection, the server takes over `DATABASE_URL` into the file `./data/geheim/datenbank.json`. Afterwards the file applies; the variable is no longer needed. For another database, delete the file or change it under **Workbench → Database connection**.

On the first visit, the setup assistant guides you through setup. The server prints the setup code in the terminal; it is also in a file under `./data/geheim`.

The [console](https://help.ablago.app/benutzer/aktuell/en/begriffe/#konsole) (`dms` in the container) also exists locally: after `npm run build -w server`, `node server/dist/dms.js` shows the commands. It talks to the running server.

Everything together as a container: `docker compose up --build`, then http://localhost:8080.

### Two images from one Dockerfile { #zwei-images-aus-einem-dockerfile }

The `Dockerfile` has two targets (#208):

| Target | Image | Content |
| --- | --- | --- |
| `dms` (default) | `ghcr.io/motom001/dms` | only Ablago; PostgreSQL runs next to it (recommended) |
| `komplett` | `ghcr.io/motom001/dms-komplett` | Ablago and PostgreSQL 17 in one container, started via `deploy/komplett/start.sh` (tini) |

```sh
docker build -t dms .                                  # slim
docker build --target komplett -t dms-komplett .       # with PostgreSQL
deploy/komplett-probe.sh dms-komplett                  # test as in CI: setup, restart, stop, crash, version check
deploy/vorlagen-probe.sh dms                           # NAS templates with the slim image
```

Apart from `deploy/komplett/start.sh`, `deploy/` is excluded from the Docker build (`.dockerignore`). CI builds both images for amd64 and arm64, with a test on every pull request; on `main` and every week (new Alpine packages) both are published.

## Checking { #prufen }

| Command | What |
| --- | --- |
| `npm test` | all server tests (Node test runner) |
| `TEST_DATABASE_URL=postgres://… npm test` | additionally the tests against PostgreSQL – **empties the schema of the given database**, so only use a throwaway database |
| `npm run typecheck` | TypeScript for `shared`, `server` and `web` |
| `npm run build` | build interface and server as in the image |

CI on GitHub runs all of this, builds both images (`dms`, `dms-komplett`) for amd64 and arm64, records the manuals' screenshots and checks the interface at iPhone size.

## Manuals { #handbucher }

```sh
pip install -r docs/handbuch/requirements.txt   # the same versions as CI and image
mkdocs serve -f docs/handbuch/benutzer/mkdocs.yml
mkdocs serve -f docs/handbuch/benutzer/mkdocs.en.yml   # the English version (#730)
```

The images (`bilder/*.png`) are created in CI with `docs/handbuch/screenshots/aufnehmen.mjs` and aren't in the repository. So they are missing locally; you can ignore the warnings about them. English screenshots go to `bilder/en/` (`DMS_SPRACHE=en`); until they exist, English pages show the German ones with a notice.

### Offline help in the image { #offline-hilfe-im-image }

In the section `hilfe`, the Dockerfile builds all four manuals and the start page with `docs/handbuch/werkzeuge/offline.py` and puts them into `web/dist/hilfe`; the server delivers them under `/hilfe/`. For this, every manual has `mkdocs.offline.yml` (inherits from `mkdocs.yml`) with the hook `werkzeuge/offline_hook.py`:

- Screenshots (`bilder/…`) become a notice with a link to the same page online (`/dms/<handbuch>/vX.Y/…`).
- Links `https://help.ablago.app/<handbuch>/aktuell/…` point to `/hilfe/<handbuch>/…`; templates stay online, `api/openapi.json` points to your own installation.
- No version selection, no fonts from the internet, no source maps.
- English (#730): `mkdocs.en.offline.yml` builds the English version from `docs-en/` into `/hilfe/<handbuch>/en/`, with English search. Missing English pages and images come from the German folder via `werkzeuge/sprache_hook.py`.

Locally: `python3 docs/handbuch/werkzeuge/offline.py /tmp/hilfe`. At the end the script checks that every link to `/hilfe/…` hits a page; CI additionally checks all targets of the context help. Without built manuals (`npm run dev`), the server redirects `/hilfe/…` to the online version of the release.
