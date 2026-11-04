# PC oder Mini-PC mit Linux

!!! info "Geprüft: Image automatisch, Gerät noch nicht"
    Das Image prüfen die Rechner von GitHub bei jeder Änderung auf amd64 und arm64. Von einem bestimmten Gerät gibt es hier noch keine Meldung. Was das heißt, steht unter [Geprüfte Plattformen](plattformen.md).

Ein alter Bürorechner, ein ausgedienter Laptop oder ein kleiner Mini-PC mit Intel- oder AMD-Prozessor reicht für Ablago gut aus. Diese Seite ist auch die Grundlage für [virtuelle Maschinen](proxmox.md). Für den Raspberry Pi gibt es eine eigene [Anleitung Schritt für Schritt](raspberry-pi.md) mit Einrichtungsskript.

**Du brauchst:** 2 GB Arbeitsspeicher oder mehr, etwa 20 GB für System und Programme, dazu Platz für deine Dokumente und Sicherungen. Eine SSD macht Ablago spürbar schneller.

## 1. Linux installieren

Ein schlankes Server-System ohne Desktop genügt, z. B. **[Debian](https://www.debian.org/distrib/)** oder **[Ubuntu Server](https://ubuntu.com/download/server)** (LTS). Beim Installieren den **SSH-Server** mit auswählen, dann kannst du den Rechner später ohne Bildschirm vom eigenen PC aus bedienen.

## 2. Docker installieren

Docker empfiehlt für einen Rechner, der dauerhaft läuft, die **eigene Paketquelle von Docker**: Dann kommt Docker über die Programmverwaltung `apt` und wird mit dem System zusammen aktualisiert. Die Befehle unten stammen unverändert aus der offiziellen Anleitung von Docker für [Debian](https://docs.docker.com/engine/install/debian/) bzw. [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Kopiere die Kästen einzeln und warte jeweils, bis die Eingabezeile wieder erscheint. Die Raspberry-Pi-Anleitung [erklärt jede Zeile](raspberry-pi.md#52-docker-installieren).

**Erstens: Werkzeuge bereitlegen** (Debian und Ubuntu gleich):

```sh
--8<-- "docker-apt-1-werkzeuge.txt"
```

**Zweitens: die Paketquelle von Docker eintragen** – für **Debian**:

```sh
--8<-- "docker-apt-2-debian.txt"
```

… oder für **Ubuntu**:

```sh
--8<-- "docker-apt-2-ubuntu.txt"
```

**Drittens: Docker installieren** (Debian und Ubuntu gleich) und deinem Benutzer erlauben, Docker ohne `sudo` zu benutzen:

```sh
--8<-- "docker-apt-3-pakete.txt"
```

```sh
sudo usermod -aG docker $USER   # danach einmal ab- und wieder anmelden
docker compose version          # prüft, ob Compose dabei ist
```

Andere Distributionen (Fedora, RHEL, …) haben eigene Anleitungen in der [Docker-Dokumentation](https://docs.docker.com/engine/install/).

??? note "Für Fortgeschrittene: das Installationsskript von Docker"
    Docker bietet auch ein Skript an, das alles oben in einem Rutsch erledigt:

    ```sh
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    ```

    Docker selbst empfiehlt das Skript aber **nur für Test- und Entwicklungsumgebungen**, nicht für einen Rechner, der dauerhaft läuft. Für deinen Rechner mit echten Unterlagen nimm deshalb den Weg oben. Das Skript richtet dieselbe Paketquelle ein; Updates kommen danach ebenfalls über `apt`.

**Offizielle Anleitung:** [Docker Engine installieren](https://docs.docker.com/engine/install/) · [Docker ohne sudo benutzen](https://docs.docker.com/engine/install/linux-postinstall/)

## 3. Ablago starten { #3-dms-starten }

**Empfohlen: zwei Container** (Ablago und PostgreSQL, siehe [Ein oder zwei Container?](index.md#ein-oder-zwei-container)):

```sh
mkdir -p ~/dms && cd ~/dms
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/motom001/dms/main/deploy/nas/docker-compose.yml
sed -i 's#/volume1/docker/dms#./daten#' docker-compose.yml
echo "DB_PASSWORD=$(openssl rand -hex 24)" > .env
docker compose up -d
docker compose logs app | grep -A1 Einrichtungscode
```

**Alternative: ein Container** ([dms-komplett](komplett.md), z. B. zum Ausprobieren), ohne `.env` und Passwort:

```sh
mkdir -p ~/dms && cd ~/dms
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/motom001/dms/main/deploy/komplett/docker-compose.yml
docker compose up -d
docker compose logs dms | grep -A1 Einrichtungscode
```

Bei zwei Containern liegen die Daten damit in `~/dms/daten`, bei dms-komplett direkt in `~/dms` (`files`, `geheim`, `sicherung`, `postgres`). Hast du für Dokumente oder Sicherungen eine eigene Platte, trägst du deren Pfade in der `docker-compose.yml` ein. Weiter geht es im Browser unter `http://<Rechner>:8080`, wie unter [Jeder Server mit Docker](docker.md) beschrieben.

## 4. Den Rechner zum Server machen

- **Nicht schlafen gehen:** Ein Server-System ohne Desktop schläft normalerweise nicht. Auf einem Laptop oder mit Desktop schaltest du den Ruhezustand ab:
  ```sh
  sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
  ```
  Beim Laptop zusätzlich in `/etc/systemd/logind.conf` `HandleLidSwitch=ignore` setzen, damit er bei geschlossenem Deckel weiterläuft.
- **Nach Stromausfall wieder an:** Im BIOS/UEFI die Einstellung *Restore on AC Power Loss* (o. ä.) auf *Power On* stellen. Die Container starten danach von selbst wieder.
- **Feste Adresse:** Im Router dem Rechner immer dieselbe IP-Adresse geben (DHCP-Reservierung). Dann bleibt die Adresse von Ablago gleich.
- **Updates des Systems:** Unter Debian und Ubuntu übernimmt das Paket `unattended-upgrades` die Sicherheitsupdates.

## Sicherung

Die Sicherungen von Ablago landen im Ordner `sicherung` auf demselben Rechner. Fällt die Platte aus, sind sie mit weg. Kopiere den Ordner deshalb regelmäßig woandershin, z. B. auf eine USB-Platte, ein NAS oder in einen Cloudspeicher (etwa mit `rclone`). Mehr dazu unter [Sicherung](https://help.ablago.app/admin/aktuell/sicherung/).
