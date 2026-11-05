# PC or mini PC with Linux {#pc-oder-mini-pc-mit-linux}

!!! info "Tested: image automatically, device not yet"
    GitHub's machines test the image with every change on amd64 and arm64. There is no report from a particular device here yet. What that means is described under [Tested platforms](plattformen.md).

An old office computer, a retired laptop or a small mini PC with an Intel or AMD processor is quite enough for Ablago. This page is also the basis for [virtual machines](proxmox.md). For the Raspberry Pi there is a separate [step-by-step guide](raspberry-pi.md) with a setup script.

**You need:** 2 GB of memory or more, about 20 GB for the system and programs, plus space for your documents and backups. An SSD makes Ablago noticeably faster.

## 1. Install Linux {#1-linux-installieren}

A lean server system without a desktop is enough, e.g. **[Debian](https://www.debian.org/distrib/)** or **[Ubuntu Server](https://ubuntu.com/download/server)** (LTS). During installation, also select the **SSH server**; then you can later operate the computer without a screen from your own PC.

## 2. Install Docker {#2-docker-installieren}

For a computer that runs permanently, Docker recommends **Docker's own package source**: then Docker comes through the package manager `apt` and is updated together with the system. The commands below are taken unchanged from Docker's official guide for [Debian](https://docs.docker.com/engine/install/debian/) or [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Copy the boxes one at a time and wait each time until the prompt appears again. The Raspberry Pi guide [explains every line](raspberry-pi.md#52-docker-installieren).

**First: get the tools ready** (the same on Debian and Ubuntu):

```sh
--8<-- "docker-apt-1-werkzeuge.txt"
```

**Second: add Docker's package source** – for **Debian**:

```sh
--8<-- "docker-apt-2-debian.txt"
```

… or for **Ubuntu**:

```sh
--8<-- "docker-apt-2-ubuntu.txt"
```

**Third: install Docker** (the same on Debian and Ubuntu) and allow your user to use Docker without `sudo`:

```sh
--8<-- "docker-apt-3-pakete.txt"
```

```sh
sudo usermod -aG docker $USER   # then sign out and in again once
docker compose version          # checks that Compose is included
```

Other distributions (Fedora, RHEL, …) have their own guides in the [Docker documentation](https://docs.docker.com/engine/install/).

??? note "For advanced users: Docker's installation script"
    Docker also offers a script that does everything above in one go:

    ```sh
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    ```

    Docker itself recommends the script **only for test and development environments**, though, not for a computer that runs permanently. For your computer with real paperwork, take the way above. The script sets up the same package source; updates then also come via `apt`.

**Official guide:** [Install Docker Engine](https://docs.docker.com/engine/install/) · [Use Docker without sudo](https://docs.docker.com/engine/install/linux-postinstall/)

## 3. Start Ablago { #3-dms-starten }

**Recommended: two containers** (Ablago and PostgreSQL, see [One or two containers?](index.md#ein-oder-zwei-container)):

```sh
mkdir -p ~/dms && cd ~/dms
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/motom001/dms/main/deploy/nas/docker-compose.yml
sed -i 's#/volume1/docker/dms#./daten#' docker-compose.yml
echo "DB_PASSWORD=$(openssl rand -hex 24)" > .env
docker compose up -d
docker compose logs app | grep -A1 Einrichtungscode
```

**Alternative: one container** ([dms-komplett](komplett.md), e.g. for trying out), without `.env` and password:

```sh
mkdir -p ~/dms && cd ~/dms
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/motom001/dms/main/deploy/komplett/docker-compose.yml
docker compose up -d
docker compose logs dms | grep -A1 Einrichtungscode
```

With two containers, the data is then in `~/dms/daten`; with dms-komplett directly in `~/dms` (`files`, `geheim`, `sicherung`, `postgres`). If you have a separate disk for documents or backups, enter its paths in `docker-compose.yml`. Continue in the browser at `http://<computer>:8080`, as described under [Any server with Docker](docker.md).

## 4. Turn the computer into a server {#4-den-rechner-zum-server-machen}

- **Don't go to sleep:** a server system without a desktop normally doesn't sleep. On a laptop or with a desktop, switch off sleep mode:
  ```sh
  sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
  ```
  On a laptop, also set `HandleLidSwitch=ignore` in `/etc/systemd/logind.conf` so it keeps running with the lid closed.
- **On again after a power cut:** in the BIOS/UEFI, set *Restore on AC Power Loss* (or similar) to *Power On*. The containers then start again by themselves.
- **Fixed address:** in your router, always give the computer the same IP address (DHCP reservation). Then Ablago's address stays the same.
- **System updates:** on Debian and Ubuntu, the package `unattended-upgrades` takes care of security updates.

## Backup {#sicherung}

Ablago's backups end up in the `sicherung` folder on the same computer. If the disk fails, they are gone too. So copy the folder elsewhere regularly, e.g. to a USB disk, a NAS or cloud storage (for instance with `rclone`). The backups are encrypted, so cloud storage only sees unreadable files. Exports are not included: a [full export](https://help.ablago.app/admin/aktuell/en/export/) is unencrypted and is therefore kept in its own [export folder](https://help.ablago.app/admin/aktuell/en/export/#export-ordner), never with the backups. More under [Backup](https://help.ablago.app/admin/aktuell/en/sicherung/).
