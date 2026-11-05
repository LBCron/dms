#!/bin/sh
# dms-komplett (#208): PostgreSQL und Ablago in einem Container.
#
# - Erster Start: Datenbank in /data/postgres/daten anlegen (UTF-8, Locale C).
# - PostgreSQL lauscht nur innerhalb des Containers (127.0.0.1) mit „trust“: kein Passwort,
#   von außen nicht erreichbar.
# - Stopp (docker stop): erst Ablago, dann PostgreSQL sauber („fast“) herunterfahren.
# - Endet einer der beiden Prozesse, endet der Container; Docker startet ihn neu.
set -eu

# Für die Probe ohne Container lassen sich Ordner und Startbefehl umstellen.
WURZEL=${DMS_PG_WURZEL:-/data/postgres}
PGDATA="$WURZEL/daten"
SOCKET=${DMS_PG_SOCKET:-/run/postgresql}
LISTE="Wachsen und umziehen: https://help.ablago.app/admin/aktuell/wachsen/"
log() { echo "[dms-komplett] $*"; }

SOLL=$(postgres --version | sed -n 's/.* \([0-9][0-9]*\)\..*/\1/p')
mkdir -p "$PGDATA" "$SOCKET"
# NAS-Freigaben haben oft andere Besitzer: Ordner für postgres richten (nur, wenn nötig).
[ "$(stat -c %U "$PGDATA")" = postgres ] || chown -R postgres:postgres "$WURZEL"
chown postgres:postgres "$WURZEL" "$SOCKET"
chmod 700 "$PGDATA"

if [ -s "$PGDATA/PG_VERSION" ]; then
  IST=$(cat "$PGDATA/PG_VERSION")
  if [ "$IST" != "$SOLL" ]; then
    log "FEHLER: Die Datenbank in /data/postgres stammt von PostgreSQL $IST, dieses Image bringt PostgreSQL $SOLL mit."
    log "Der Container startet nicht, damit nichts kaputtgeht. Umstieg über Sicherung und Wiederherstellung – $LISTE"
    exit 1
  fi
else
  if [ -n "$(ls -A "$PGDATA")" ]; then
    log "FEHLER: /data/postgres/daten ist nicht leer, enthält aber keine Datenbank. Bitte prüfen. $LISTE"
    exit 1
  fi
  log "Erster Start: lege die Datenbank an (PostgreSQL $SOLL)."
  su-exec postgres initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C --auth-local=trust --auth-host=trust >/dev/null
fi

# pg_stat_statements (#894): zählt je Abfrage Anzahl und Rechenzeit – der Lasttest nennt damit die teuersten Abfragen.
# Über die Befehlszeile, damit es auch für schon bestehende Datenbanken in /data/postgres gilt (ohne postgresql.conf
# anzufassen). Kostet wenig (rund 1–2 % Rechenzeit je Abfrage, wenige MB Speicher); Ablago liest die Werte nur im Lasttest.
su-exec postgres postgres -D "$PGDATA" -c listen_addresses=127.0.0.1 -c unix_socket_directories="$SOCKET" \
  -c shared_preload_libraries=pg_stat_statements &
PG=$!
until su-exec postgres pg_isready -q -h 127.0.0.1; do
  kill -0 "$PG" 2>/dev/null || { log "FEHLER: PostgreSQL ist beim Start beendet worden (siehe oben)."; exit 1; }
  sleep 0.5
done

abfrage() { su-exec postgres psql -h 127.0.0.1 -U postgres -tAc "$1"; }
[ "$(abfrage "SELECT 1 FROM pg_roles WHERE rolname = 'dms'")" = 1 ] || { abfrage "CREATE ROLE dms LOGIN SUPERUSER" >/dev/null; log "Rolle dms angelegt."; }
[ "$(abfrage "SELECT 1 FROM pg_database WHERE datname = 'dms'")" = 1 ] || { abfrage "CREATE DATABASE dms OWNER dms" >/dev/null; log "Datenbank dms angelegt."; }
# Erweiterung in der Datenbank von Ablago (#894), im eigenen Schema wie pg_trgm und unaccent (übersteht das
# Wiederherstellen). Gelingt es nicht, startet Ablago trotzdem; der Lasttest nennt dann den Grund.
su-exec postgres psql -h 127.0.0.1 -U postgres -d dms -qtA -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA IF NOT EXISTS erweiterungen_dms AUTHORIZATION dms" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA erweiterungen_dms" >/dev/null 2>&1 \
  || log "Hinweis: Erweiterung pg_stat_statements nicht angelegt – der Lasttest nennt die teuersten Abfragen dann nicht."

# Anbindung für Ablago: nur im Container, ohne Passwort. Der Einrichtungsassistent überspringt damit den Datenbank-Schritt.
# Steht DATABASE_URL nicht in der Compose-Datei, setzt erst dieses Skript sie: dann als „vom Image“ kennzeichnen,
# damit die Werkbank nicht rät, sie aus der Compose-Datei zu entfernen (#805).
# anfang-datenbank-variable (für den Test in server/test/umgebungsvariablen.test.ts)
if [ -z "${DATABASE_URL:-}" ]; then export DMS_DATENBANK_VOM_IMAGE=1; else unset DMS_DATENBANK_VOM_IMAGE; fi
export DATABASE_URL="postgres://dms@127.0.0.1:5432/dms"
# ende-datenbank-variable
${DMS_START:-node --enable-source-maps /app/server/dist/index.js} &
DMS=$!

pg_stopp() {
  if kill -0 "$PG" 2>/dev/null; then
    log "Fahre PostgreSQL herunter."
    kill -INT "$PG" 2>/dev/null || true
    wait "$PG" 2>/dev/null || true
  fi
}

stopp() {
  trap - TERM INT
  log "Stopp: beende Ablago."
  kill -TERM "$DMS" 2>/dev/null || true
  wait "$DMS" 2>/dev/null || true
  pg_stopp
  log "Beendet."
  exit 0
}
trap stopp TERM INT

while kill -0 "$DMS" 2>/dev/null && kill -0 "$PG" 2>/dev/null; do
  sleep 1 & wait $! || true
done

# Einer der beiden Prozesse ist beendet: den anderen sauber beenden, Container endet.
trap - TERM INT
if kill -0 "$DMS" 2>/dev/null; then
  log "FEHLER: PostgreSQL wurde beendet – beende auch Ablago."
  kill -TERM "$DMS" 2>/dev/null || true
  wait "$DMS" 2>/dev/null || true
  exit 1
fi
set +e
wait "$DMS"; CODE=$?
set -e
log "Ablago wurde beendet (Code $CODE)."
pg_stopp
exit "$CODE"
