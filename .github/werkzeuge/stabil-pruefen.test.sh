#!/usr/bin/env bash
# Test für stabil-pruefen.sh (#714): kein Release → kein :stabil, und die übrigen Bedingungen.
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
rm -f "$n" "$leer"; [ "$f" = 0 ] && echo "stabil-pruefen: alle Fälle richtig"; exit $f
