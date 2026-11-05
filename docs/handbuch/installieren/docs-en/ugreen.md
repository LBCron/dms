# UGREEN NAS (UGOS Pro)

!!! success "Tested: tested by the project"
    The project itself tests Ablago on a **UGREEN DXP4800 Plus** (amd64); it also runs there every day, see [How the developer runs it](beispiel.md). The first test was on 02.11.2026 with Ablago 0.143.0 ([measurements](https://github.com/motom001/dms/issues/576#issuecomment-6588590651)); expected to be tested until 31.12.2028, see [Tested platforms](plattformen.md). In addition, the template is started as a trial on GitHub's machines with every change. More under [Tested platforms](plattformen.md).

This is how you set up Ablago on a UGREEN NAS with UGOS Pro. UGREEN's **Docker** app creates Ablago as a *project* from a template.

!!! info "Soon in the App Center?"
    An app for the UGREEN App Center is in progress ([#181](https://github.com/motom001/dms/issues/181)). Until then, it works like this, which is hardly more effort.

How Ablago runs at the developer's home on a UGREEN NAS – with access on the go and an off-site backup – is shown in the example [How the developer runs it](beispiel.md).

!!! note "Alternative: one container"
    The project with two containers below is recommended. For a quick try, **one container** from the image `ghcr.io/motom001/dms-komplett:stabil` also works – without a project and password, see [One container: dms-komplett](komplett.md#in-der-oberflache-eines-nas) and [One or two containers?](index.md#ein-oder-zwei-container).

## 1. Install Docker {#1-docker-installieren}

Install and open the app **Docker** in the **App Center**.

## 2. Create folders {#2-ordner-anlegen}

In the app **Files**, create a folder `dms` in the folder `docker` (created by the Docker app). Inside it, four folders: `postgres`, `files`, `geheim` and `sicherung`.

!!! tip "Intake folder for the scanner"
    Also create a fifth folder `eingang` next to them. The template mounts it, and some NAS abort on start if a mounted folder is missing. It becomes the [Intake folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/): every file your scanner or the NAS puts there becomes new post. Share it on the NAS for the scanner. If you don't need a scanner, it simply stays empty.

## 3. Create the project {#3-projekt-anlegen}

1. **Docker → Project → Create**.
2. **Project name:** `dms`. **Storage path:** the folder `docker/dms`.
3. Paste the content of the template [`deploy/ugreen/docker-compose.yml`](https://github.com/motom001/dms/blob/main/deploy/ugreen/docker-compose.yml) into the field for the Compose configuration.
4. **Enter the password at the very top:** in the line `x-passwort:`, replace `HIER-EIN-LANGES-PASSWORT-EINTRAGEN` with a long password made of letters and numbers.
5. If your Docker folder is not under `/volume1/docker`, adjust the paths. The app **Files** shows the path in the folder's properties.
6. **Deploy** or **Deploy now**.

!!! warning "Change the password before the first start"
    The database takes over the password only on the very first start.

## 4. Set up {#4-einrichten}

1. Open `http://<NAS>:8080` in your browser.
2. The **setup code** is shown under **Docker → Container → `dms-app-1` → Log**, or you open the file `docker/dms/geheim/EINRICHTUNGSCODE` in the app **Files**.
3. The wizard does not ask for the database; it is already connected.

--8<-- "assistent-weiter.md"

## Updates

Open **Docker → Project → `dms`**, stop the project and **deploy** it again with the option to pull the images anew. Depending on the UGOS version, the item is called *Update* or *Recreate*. The data stays in the folders.

## Off-site backup {#sicherung-auer-haus}

Ablago's backups (**Workbench → Backup**) end up in `docker/dms/sicherung`. With UGREEN's app **Backup & Sync** you copy this folder to a USB disk or to cloud storage. The backups are encrypted, so cloud storage only sees unreadable files. Exports are not included: a [full export](https://help.ablago.app/admin/aktuell/en/export/) is unencrypted and is therefore kept in its own [export folder](https://help.ablago.app/admin/aktuell/en/export/#export-ordner), never with the backups.

!!! info "Pictures to follow"
    This guide has no screenshots yet. If a menu item looks different for you, feel free to write it in an [issue](https://github.com/motom001/dms/issues).
