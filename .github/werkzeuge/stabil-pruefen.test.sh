#!/usr/bin/env bash
# Test für stabil-pruefen.sh (#714): kein Release → kein :stabil, und die übrigen Bedingungen;
# dazu stabil-auswahl.sh (#907): welche Version im Wochenlauf bzw. mit „sofort-stabil“ wandert.
set -u
cd "$(dirname "$0")" || exit 1; s=./stabil-pruefen.sh; n=$(mktemp); echo "## Behoben" > "$n"; leer=$(mktemp); f=0
erwarte() { local soll=$1; shift; if "$s" "$@" >/dev/null; then ist=0; else ist=1; fi; [ "$ist" = "$soll" ] || { echo "FEHLER: $* → $ist, erwartet $soll"; f=1; }; }
erwarte 0 0.159.0 true "$n" ""
erwarte 0 0.159.1 true "$n" "bug,freigegeben"
erwarte 1 0.159.0 false "$n" ""            # kein Release (main ohne neue Version, Text-PR)
erwarte 1 0.160.0-rc.1 true "$n" ""        # Vorabversion
erwarte 1 main true "$n" ""
erwarte 1 0.159.0 true "$leer" ""          # Release-Notes leer
erwarte 1 0.159.0 true /gibt/es/nicht ""    # Release-Notes fehlen
erwarte 1 0.159.0 true "$n" "bug,nicht-stabil"

# Auswahl (#907): Notizen in einem eigenen Ordner, „jetzt“ fest auf Di 10.11.2026 04:23 UTC.
d=$(mktemp -d); for v in 0.200.0 0.201.0 0.202.0 0.203.0 0.210.0; do echo "## Geändert" > "$d/v$v.md"; done
jetzt=$(date -u -d 2026-11-10T04:23:00Z +%s)
liste=$'v0.203.0\t2026-11-09T20:00:00Z\t\nv0.202.0\t2026-11-08T10:00:00Z\tnicht-stabil\nv0.201.0\t2026-11-07T10:00:00Z\tbug\nv0.200.0\t2026-11-01T10:00:00Z\t'
auswahl() { local soll=$1 bisher=$2 eingabe=$3 ist; ist=$(printf '%b' "$eingabe" | NOTIZEN="$d" MINDESTALTER="${MA:-86400}" ./stabil-auswahl.sh "$bisher" "$jetzt" 2>/dev/null) || ist="-"
  [ "$ist" = "$soll" ] || { echo "FEHLER: Auswahl über $bisher → $ist, erwartet $soll"; f=1; }; }
auswahl 0.201.0 0.200.0 "$liste"   # 0.203.0 zu jung, 0.202.0 zurückgehalten → die nächstältere
auswahl - 0.201.0 "$liste"         # schon stabil: nichts zu tun
auswahl - 0.210.0 "$liste"         # nie zurück
auswahl - 0.202.0 "$liste"         # darüber nur eine zu junge
auswahl - "" ""                    # gar keine Releases
auswahl 0.201.0 0.200.0 $'0.201.0\t2026-11-07T10:00:00Z\t\n0.199.9-rc.1\t2026-11-02T10:00:00Z\t'
auswahl - 0.200.0 $'0.204.0\t2026-11-01T10:00:00Z\t'   # ohne Release-Notes
auswahl 0.201.0 0.200.0 $'0.201.0\t2026-11-07T10:00:00Z\t\n0.202.0-rc.1\t2026-11-08T10:00:00Z\t'   # Vorabversion nie
MA=0 auswahl 0.203.0 0.200.0 "$liste"     # sofort-stabil: ohne Mindestalter
MA=0 auswahl - 0.200.0 $'0.202.0\t2026-11-10T04:00:00Z\tsofort-stabil,nicht-stabil'   # „nicht-stabil“ gewinnt
rm -rf "$d"
rm -f "$n" "$leer"; [ "$f" = 0 ] && echo "stabil-pruefen: alle Fälle richtig"; exit $f
