# Unraid

!!! info "Tested: template automatically, device not yet"
    The template on this page is started as a trial on GitHub's machines with every change (Linux with Docker, amd64). There is no report from a real device yet. What that means is described under [Tested platforms](plattformen.md).

This is how you set up Ablago on **Unraid 6.12 or newer**. Because Ablago needs two containers (Ablago and the database), the easiest way is the plugin **Docker Compose Manager**.

!!! info "Soon in Community Applications?"
    Ablago is meant to go into *Community Applications* ([#183](https://github.com/motom001/dms/issues/183)). Until then, it works like this.

!!! note "Alternative: one container"
    The project with two containers below is recommended. For a quick try, **one container** from the image `ghcr.io/motom001/dms-komplett:stabil` also works – without a project and password, see [One container: dms-komplett](komplett.md#in-der-oberflache-eines-nas) and [One or two containers?](index.md#ein-oder-zwei-container).

## 1. Install Compose Manager {#1-compose-manager-installieren}

Under **Apps** (Community Applications), search for *Docker Compose Manager* and install it.

## 2. Create a stack {#2-stack-anlegen}

1. **Docker → Compose → Add New Stack**, name `dms`.
2. On the stack, go to **Edit Stack → Compose File** and paste the content of the template [`deploy/unraid/docker-compose.yml`](https://github.com/motom001/dms/blob/main/deploy/unraid/docker-compose.yml).
3. **Enter the password:** in the line `x-passwort:`, replace `HIER-EIN-LANGES-PASSWORT-EINTRAGEN` with a long password made of letters and numbers.
4. **Save Changes**, then **Compose Up**. Unraid creates the folders under `/mnt/user/appdata/dms/` itself.

!!! warning "Change the password before the first start"
    The database takes over the password only on the very first start.

!!! tip "Optional: inbox folder for the scanner"
    The template mounts `/mnt/user/appdata/dms/eingang` as the [inbox folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/): every file your scanner puts there becomes new post. Share the folder as an SMB share for the scanner. Without it, everything works as usual.

## 3. Set up {#3-einrichten}

1. Open `http://<Unraid>:8080` in your browser.
2. The **setup code** is shown in the log of the container `dms-app-1` (**Docker** → the container's icon → **Logs**). It is also in `appdata/dms/geheim/EINRICHTUNGSCODE`.
3. The wizard does not ask for the database; it is already connected.

--8<-- "assistent-weiter.md"

## Updates and backup {#updates-und-sicherung}

- **Updates:** on the stack, **Update Stack** (or *Compose Pull* and *Compose Up*).
- **Off-site backup:** Ablago's backups end up in `appdata/dms/sicherung`. The plugin *Appdata Backup* additionally backs up `appdata`, but only a copy in another place protects against the server failing.

!!! info "Pictures to follow"
    This guide has no screenshots yet. If a menu item looks different for you, feel free to write it in an [issue](https://github.com/motom001/dms/issues).
