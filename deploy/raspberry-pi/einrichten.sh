#!/usr/bin/env bash
# Ablago auf dem Raspberry Pi einrichten (#578) – aus https://github.com/motom001/dms (deploy/raspberry-pi)
# Anleitung Schritt für Schritt: https://help.ablago.app/installieren/aktuell/raspberry-pi/
#
# Aufruf als normaler Benutzer, NICHT mit sudo:
#   bash einrichten.sh                  Ablago im Ordner ~/dms
#   bash einrichten.sh /mnt/ssd/dms     Ablago in einem anderen Ordner, z. B. auf einer zusätzlichen SSD
#
# Was das Skript tut:
#   1. Es prüft: 64-Bit-System (arm64), Arbeitsspeicher, freien Platz und ob Docker mit Compose da ist.
#   2. Es legt den Ordner an, lädt die Vorlage docker-compose.yml (zwei Container: Ablago und Datenbank)
#      und schreibt daneben eine Datei .env mit einem zufälligen Passwort für die Datenbank.
#   3. Es lädt die Programme (Images), startet Ablago und zeigt Adresse und Einrichtungscode.
#
# Was es NICHT tut: Es installiert nichts am System und ändert keine Einstellungen. Fehlt Docker,
# nennt es die offizielle Anleitung und hört auf.
#
# Mehrfach ausführen schadet nicht: Eine vorhandene docker-compose.yml und .env bleiben, wie sie sind,
# und deine Daten bleiben unberührt. Gibt es neuere Images, startet es Ablago damit neu.
# Deutsche Anführungszeichen in den Meldungen sind gewollt.
# shellcheck disable=SC1111
set -euo pipefail

VORLAGE_URL="${DMS_VORLAGE_URL:-https://raw.githubusercontent.com/motom001/dms/main/deploy/raspberry-pi/docker-compose.yml}"
ANLEITUNG="https://help.ablago.app/installieren/aktuell/raspberry-pi/"
DOCKER_ANLEITUNG="https://docs.docker.com/engine/install/debian/"
PORT=8080
MIN_RAM_MB=1500     # darunter (Pi mit 1 GB) läuft Ablago nicht verlässlich
EMPF_RAM_MB=3500    # ab 4 GB ist Luft für Texterkennung und Sicherung
MIN_FREI_GB=5       # für Datenbank, erste Dokumente und Sicherungen
EMPF_FREI_GB=30
MIN_DOCKER_GB=3     # für die Images unter /var/lib/docker

ok()      { printf '  OK: %s\n' "$*"; }
hinweis() { printf '  Hinweis: %s\n' "$*"; }
info()    { printf '  %s\n' "$*"; }
abbruch() {
  printf '\nAbbruch: %s\n' "$1" >&2
  shift
  for zeile in "$@"; do printf '  %s\n' "$zeile" >&2; done
  printf '\nNichts ist kaputt. Behebe das und starte das Skript dann noch einmal.\nAnleitung: %s\n' "$ANLEITUNG" >&2
  exit 1
}

case "${1:-}" in
  -h|--hilfe|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  -*) abbruch "Unbekannte Angabe: $1" "Aufruf: bash einrichten.sh [Ordner]" ;;
esac
ZIEL="${1:-$HOME/dms}"

printf '\nDMS einrichten\n\n1. Gerät prüfen\n'

if [ "$(id -u)" -eq 0 ]; then
  abbruch "Bitte ohne sudo starten:  bash einrichten.sh" \
    "Das Skript fragt selbst nach deinem Passwort, wenn es Docker nur mit sudo erreicht."
fi

if [ -r /proc/device-tree/model ]; then
  info "Gerät: $(tr -d '\0' </proc/device-tree/model)"
fi

arch=$(uname -m)
case "$arch" in
  aarch64|arm64) ;;
  armv6l|armv7l|armhf)
    abbruch "Auf dem Gerät läuft ein 32-Bit-System ($arch). Ablago braucht 64 Bit." \
      "Spiel mit dem Raspberry Pi Imager „Raspberry Pi OS Lite (64-bit)“ neu auf (Schritt 2 der Anleitung)." \
      "Ein Raspberry Pi 3, Zero oder älter reicht für Ablago nicht – du brauchst einen Pi 4 oder 5." ;;
  x86_64|amd64)
    abbruch "Das ist kein Raspberry Pi, sondern ein PC (x86_64)." \
      "Für einen PC gibt es eine eigene Anleitung: https://help.ablago.app/installieren/aktuell/linux/" ;;
  *)
    abbruch "Unbekannte Architektur: $arch. Das Skript ist für den Raspberry Pi 4 und 5 mit 64-Bit-System." ;;
esac
# Ein 64-Bit-Kern mit 32-Bit-System (ältere Raspberry Pi OS) meldet aarch64, Docker zieht dann aber 32-Bit-Images.
if command -v dpkg >/dev/null 2>&1; then
  system=$(dpkg --print-architecture)
  if [ "$system" != arm64 ]; then
    abbruch "Der Kern läuft mit 64 Bit, das System selbst aber mit 32 Bit ($system)." \
      "Spiel mit dem Raspberry Pi Imager „Raspberry Pi OS Lite (64-bit)“ neu auf (Schritt 2 der Anleitung)."
  fi
fi
ok "64-Bit-System (arm64)"

ram_mb=$(( $(awk '/^MemTotal:/ {print $2}' /proc/meminfo) / 1024 ))
if [ "$ram_mb" -lt "$MIN_RAM_MB" ]; then
  abbruch "Zu wenig Arbeitsspeicher: $ram_mb MB. Ablago braucht einen Pi mit mindestens 2 GB, besser 4 GB."
elif [ "$ram_mb" -lt "$EMPF_RAM_MB" ]; then
  hinweis "Arbeitsspeicher $ram_mb MB – das reicht, mit 4 GB oder mehr läuft die Texterkennung aber entspannter."
else
  ok "Arbeitsspeicher $ram_mb MB"
fi

printf '\n2. Ordner prüfen: %s\n' "$ZIEL"
if ! mkdir -p "$ZIEL" 2>/dev/null; then
  abbruch "Der Ordner $ZIEL lässt sich nicht anlegen." \
    "Liegt er auf einer zusätzlichen SSD, gib ihn dir einmal selbst:" \
    "  sudo mkdir -p $ZIEL && sudo chown $(id -un): $ZIEL"
fi
ZIEL=$(cd "$ZIEL" && pwd)
if [ ! -w "$ZIEL" ]; then
  abbruch "Du darfst in $ZIEL nicht schreiben." "Gib ihn dir einmal selbst:  sudo chown $(id -un): $ZIEL"
fi

frei_gb=$(( $(df -Pk "$ZIEL" | awk 'NR==2 {print $4}') / 1024 / 1024 ))
if [ "$frei_gb" -lt "$MIN_FREI_GB" ]; then
  abbruch "Zu wenig freier Platz in $ZIEL: $frei_gb GB. Es sollten mindestens $MIN_FREI_GB GB frei sein, besser $EMPF_FREI_GB GB oder mehr."
elif [ "$frei_gb" -lt "$EMPF_FREI_GB" ]; then
  hinweis "Frei sind $frei_gb GB. Für den Anfang reicht das; Dokumente und Sicherungen brauchen mit der Zeit mehr."
else
  ok "Frei: $frei_gb GB"
fi
docker_gb=$(( $(df -Pk /var/lib | awk 'NR==2 {print $4}') / 1024 / 1024 ))
if [ "$docker_gb" -lt "$MIN_DOCKER_GB" ]; then
  abbruch "Auf dem Startlaufwerk sind nur $docker_gb GB frei. Docker braucht für die Programme etwa $MIN_DOCKER_GB GB."
fi
case "$(df -P "$ZIEL" | awk 'NR==2 {print $1}')" in
  /dev/mmcblk*) hinweis "Der Ordner liegt auf der SD-Karte. Das geht, aber eine SSD ist schneller und hält viel länger (siehe Einkaufsliste in der Anleitung)." ;;
esac

printf '\n3. Docker prüfen\n'
if ! command -v docker >/dev/null 2>&1; then
  abbruch "Docker ist noch nicht installiert." \
    "Installiere es nach der offiziellen Anleitung von Docker für Debian (gilt auch für Raspberry Pi OS 64 Bit):" \
    "  $DOCKER_ANLEITUNG" \
    "Die Kurzfassung steht in Schritt 5 der Anleitung zu Ablago."
fi
DOCKER=(docker)
mit_sudo=""
if ! docker info >/dev/null 2>&1; then
  info "Docker ist nur mit sudo erreichbar – gleich fragt der Pi nach deinem Passwort."
  if sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
    mit_sudo=1
  else
    abbruch "Docker ist installiert, läuft aber nicht." "Starte es mit:  sudo systemctl enable --now docker"
  fi
fi
if ! "${DOCKER[@]}" compose version >/dev/null 2>&1; then
  abbruch "Docker Compose fehlt (Paket docker-compose-plugin)." \
    "Installiere es nach der offiziellen Anleitung von Docker: $DOCKER_ANLEITUNG"
fi
ok "$("${DOCKER[@]}" --version)"

cd "$ZIEL"
laeuft=""
if [ -f docker-compose.yml ] && [ -n "$("${DOCKER[@]}" compose ps -q app 2>/dev/null)" ]; then laeuft=1; fi
if [ -z "$laeuft" ] && command -v ss >/dev/null 2>&1 && ss -Hltn "sport = :$PORT" | grep -q .; then
  abbruch "Port $PORT ist schon belegt – auf dem Pi läuft bereits ein anderes Programm mit dieser Adresse." \
    "Halte es an oder ändere in $ZIEL/docker-compose.yml die Zeile \"$PORT:3000\" (z. B. in \"8081:3000\")."
fi

printf '\n4. Vorlage und Passwort\n'
if [ -f docker-compose.yml ]; then
  ok "docker-compose.yml ist schon da und bleibt, wie sie ist"
else
  curl -fsSL -o docker-compose.yml.neu "$VORLAGE_URL" \
    || abbruch "Die Vorlage ließ sich nicht laden: $VORLAGE_URL" "Hat der Pi Internet? Prüfe das Netzwerkkabel."
  mv docker-compose.yml.neu docker-compose.yml
  ok "docker-compose.yml geladen"
fi
if [ -f .env ] && grep -q '^DB_PASSWORD=.' .env; then
  ok ".env mit Datenbank-Passwort ist schon da und bleibt, wie sie ist"
elif [ -d postgres ] && [ -n "$(ls -A postgres 2>/dev/null || sudo ls -A postgres)" ]; then
  abbruch "Im Ordner postgres liegt schon eine Datenbank, aber die Datei .env mit ihrem Passwort fehlt." \
    "Ein neues Passwort würde nicht passen. Stell die alte .env wieder her (z. B. aus deiner Sicherung)."
else
  passwort=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  (umask 077 && printf '# Passwort der Datenbank (#578) – nicht weitergeben, nicht ändern.\nDB_PASSWORD=%s\n' "$passwort" >.env)
  ok ".env mit zufälligem Datenbank-Passwort angelegt (nur für dich lesbar)"
fi
mkdir -p files geheim sicherung eingang

printf '\n5. Programme laden und starten\n'
info "Beim ersten Mal lädt der Pi einige hundert MB – das dauert ein paar Minuten."
"${DOCKER[@]}" compose pull \
  || abbruch "Die Programme ließen sich nicht laden." "Hat der Pi Internet? Prüfe das Netzwerkkabel und versuche es noch einmal."
"${DOCKER[@]}" compose up -d \
  || abbruch "Ablago ließ sich nicht starten." "Die Meldung steht direkt darüber. Häufige Ursachen stehen in der Anleitung unter „Wenn es nicht klappt“."

printf '\n6. Warten, bis Ablago antwortet\n'
status=""
for _ in $(seq 1 100); do
  if status=$(curl -fsS -m 5 "http://127.0.0.1:$PORT/api/konto/status" 2>/dev/null); then break; fi
  status=""
  printf '.'
  sleep 3
done
printf '\n'
if [ -z "$status" ]; then
  abbruch "Ablago antwortet nach 5 Minuten noch nicht." \
    "Sieh ins Protokoll:  cd $ZIEL && ${DOCKER[*]} compose logs app --tail 50" \
    "Häufige Ursachen und Lösungen stehen in der Anleitung unter „Wenn es nicht klappt“."
fi
ok "Ablago läuft"

name=$(hostname)
ip=$(hostname -I 2>/dev/null | awk '{print $1}')
printf '\nFertig! Öffne auf deinem PC, Tablet oder Handy im Browser:\n\n'
printf '    http://%s.local:%s\n' "$name" "$PORT"
[ -n "$ip" ] && printf '    oder http://%s:%s\n' "$ip" "$PORT"
if printf '%s' "$status" | grep -q '"einrichtungNoetig":true'; then
  code=$("${DOCKER[@]}" compose exec -T app cat /data/geheim/EINRICHTUNGSCODE 2>/dev/null || true)
  printf '\nDer Assistent fragt zuerst nach dem Einrichtungscode:\n\n    %s\n' "${code:-(steht gleich im Protokoll: ${DOCKER[*]} compose logs app | grep -A1 Einrichtungscode)}"
else
  printf '\nAblago ist schon eingerichtet – melde dich einfach an.\n'
fi
printf '\nDeine Daten liegen in %s (Datenbank, Dokumente, Schlüssel, Sicherungen).\n' "$ZIEL"
if [ -n "$mit_sudo" ]; then
  printf '\nTipp: Damit Docker ohne sudo geht, einmal  sudo usermod -aG docker %s  und danach ab- und wieder anmelden.\n' "$(id -un)"
fi
