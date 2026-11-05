# QNAP NAS (Container Station)

!!! info "Tested: template automatically, device not yet"
    The template on this page is started as a trial on GitHub's machines with every change (Linux with Docker, amd64). There is no report from a real device yet. What that means is described under [Tested platforms](plattformen.md).

This is how you set up Ablago on a QNAP NAS with QTS 5 or QuTS hero and **Container Station 3**, without the command line.

!!! note "Alternative: one container"
    The project with two containers below is recommended. For a quick try, **one container** from the image `ghcr.io/motom001/dms-komplett:stabil` also works – without a project and password, see [One container: dms-komplett](komplett.md#in-der-oberflache-eines-nas) and [One or two containers?](index.md#ein-oder-zwei-container).

## 1. Install Container Station {#1-container-station-installieren}

Install **Container Station** in the **App Center** and open it once. This creates the shared folder `Container`.

## 2. Create folders {#2-ordner-anlegen}

In **File Station**, create a folder `dms` in the folder `Container`. Inside it, four folders: `postgres`, `files`, `geheim` and `sicherung`.

!!! tip "Inbox folder for the scanner"
    Also create a fifth folder `eingang` next to them. The template mounts it, and some NAS abort on start if a mounted folder is missing. It becomes the [inbox folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/): every file your scanner or the NAS puts there becomes new post. Share it on the NAS for the scanner. If you don't need a scanner, it simply stays empty.

## 3. Create the application {#3-anwendung-erstellen}

1. **Container Station → Applications → Create**.
2. **Application name:** `dms`.
3. Paste the content of the template [`deploy/qnap/docker-compose.yml`](https://github.com/motom001/dms/blob/main/deploy/qnap/docker-compose.yml) into the YAML field.
4. **Enter the password at the very top:** in the line `x-passwort:`, replace `HIER-EIN-LANGES-PASSWORT-EINTRAGEN` with a long password made of letters and numbers.
5. The paths `/share/Container/dms/…` match the folder from step 2. If it is somewhere else, adjust them.
6. **Validate** and **Create**.

!!! warning "Change the password before the first start"
    The database takes over the password only on the very first start.

## 4. Set up {#4-einrichten}

1. Open `http://<NAS>:8080` in your browser.
2. The **setup code** is shown under **Container Station → Containers → `dms-app-1` → Logs**. It is also in the file `Container/dms/geheim/EINRICHTUNGSCODE`.
3. The wizard does not ask for the database; it is already connected.

--8<-- "assistent-weiter.md"

## Updates

**Container Station → Applications → `dms`** → **Action → Recreate**, pulling the images anew. The data stays in the folders.

## Off-site backup {#sicherung-auer-haus}

Ablago's backups (**Workbench → Backup**) end up in `Container/dms/sicherung`. With **Hybrid Backup Sync** you copy the folder to a USB disk, a second NAS or cloud storage. The backups are encrypted, so cloud storage only sees unreadable files. Exports are not included: a [full export](https://help.ablago.app/admin/aktuell/en/export/) is unencrypted and is therefore kept in its own [export folder](https://help.ablago.app/admin/aktuell/en/export/#export-ordner), never with the backups.

!!! info "Pictures to follow"
    This guide has no screenshots yet. If a menu item looks different for you, feel free to write it in an [issue](https://github.com/motom001/dms/issues).
