# TrueNAS

!!! info "Tested: template automatically, device not yet"
    The template on this page is started as a trial on GitHub's machines with every change (Linux with Docker, amd64). There is no report from a real device yet. What that means is described under [Tested platforms](plattformen.md).

This is how you set up Ablago on **TrueNAS Community Edition 24.10 or newer**. These versions run apps with Docker.

!!! info "Soon in the app catalogue?"
    Ablago is meant to go into TrueNAS's app catalogue ([#182](https://github.com/motom001/dms/issues/182)). Until then, it works as a *Custom App* with the template.

## 1. Create a dataset and folders {#1-datensatz-und-ordner-anlegen}

1. **Datasets:** in the pool that holds your apps (`tank` in the template), create a dataset `apps/dms` with the template *Apps*.
2. In this dataset, create four folders: `postgres`, `files`, `geheim`, `sicherung`. You can do this e.g. via an SMB share or the shell under **System → Shell**:
   ```sh
   mkdir -p /mnt/tank/apps/dms/{postgres,files,geheim,sicherung}
   ```

!!! tip "Intake folder for the scanner"
    Also create a fifth folder `eingang` next to them. The template mounts it, and some NAS abort on start if a mounted folder is missing. It becomes the [Intake folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/): every file your scanner or the NAS puts there becomes new post. Share it on the NAS for the scanner. If you don't need a scanner, it simply stays empty.

## 2. Create the app {#2-app-anlegen}

1. **Apps → Discover Apps → ⋮ → Install via YAML**.
2. **Name:** `dms`.
3. Paste the content of the template [`deploy/truenas/docker-compose.yml`](https://github.com/motom001/dms/blob/main/deploy/truenas/docker-compose.yml).
4. **Enter the password:** in the line `x-passwort:`, replace `HIER-EIN-LANGES-PASSWORT-EINTRAGEN` with a long password made of letters and numbers. If your pool is not called `tank`, replace `/mnt/tank/` in the paths.
5. **Save**.

!!! warning "Change the password before the first start"
    The database takes over the password only on the very first start.

## 3. Set up {#3-einrichten}

1. Open `http://<TrueNAS>:8080` in your browser.
2. The **setup code** is shown under **Apps → `dms` → Workloads → `app` → Logs**. It is also in `/mnt/tank/apps/dms/geheim/EINRICHTUNGSCODE`.
3. The wizard does not ask for the database; it is already connected.

--8<-- "assistent-weiter.md"

## Updates and backup {#updates-und-sicherung}

- **Updates:** **Apps → `dms` → Update** (or *Pull Images* and restart). The data stays in the dataset.
- **Off-site backup:** copy the `sicherung` folder to another place with a **Cloud Sync Task** or **Replication**. The backups are encrypted, so cloud storage only sees unreadable files. Exports are not included: a [full export](https://help.ablago.app/admin/aktuell/en/export/) is unencrypted and is therefore kept in its own [export folder](https://help.ablago.app/admin/aktuell/en/export/#export-ordner), never with the backups. Snapshots of the dataset are extra protection, but don't replace a copy off site.

!!! info "Pictures to follow"
    This guide has no screenshots yet. If a menu item looks different for you, feel free to write it in an [issue](https://github.com/motom001/dms/issues).
