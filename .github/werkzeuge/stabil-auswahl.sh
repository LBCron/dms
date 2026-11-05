#!/usr/bin/env bash
# Auf welche Version wandert :stabil? (#907)
#   stabil-auswahl.sh <bisher stabil, z. B. 0.200.0> [jetzt, Sekunden seit 1970]  < Liste
# Liste auf stdin, eine Zeile je Release (Reihenfolge egal), durch Tabulator getrennt:
#   <version>  <veröffentlicht, ISO 8601>  <Labels des PR, mit Komma getrennt>
# Gewählt wird die höchste Version über der bisherigen, die mindestens MINDESTALTER Sekunden alt ist
# (Standard 86400 = 24 Stunden; 0 beim Sofort-Weg mit dem Label „sofort-stabil“) und die Regeln von
# stabil-pruefen.sh erfüllt (X.Y.Z, Release-Notes unter NOTIZEN/v<version>.md, kein Label „nicht-stabil“).
# Ist die höchste zurückgehalten, kommt die nächstältere dran – nie eine unter oder gleich der bisherigen.
# Exit 0 = Version auf stdout; Exit 1 = nichts zu tun (Gründe auf stderr).
set -u
bisher="${1:-}"; jetzt="${2:-$(date -u +%s)}"
mindestalter="${MINDESTALTER:-86400}"; notizen="${NOTIZEN:-docs/releases}"
pruefen="$(dirname "$0")/stabil-pruefen.sh"
# a > b nach Versionsnummer?
groesser() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]; }

kandidaten=$(mktemp); trap 'rm -f "$kandidaten"' EXIT
while IFS=$'\t' read -r v zeit labels; do
  v="${v#v}"
  [ -n "$v" ] || continue
  if [ -n "$bisher" ] && ! groesser "$v" "$bisher"; then continue; fi
  printf '%s\t%s\t%s\n' "$v" "$zeit" "$labels" >> "$kandidaten"
done
[ -s "$kandidaten" ] || { echo "nichts zu tun – keine Version über ${bisher:-?}" >&2; exit 1; }

while IFS=$'\t' read -r v zeit labels; do
  t=$(date -u -d "$zeit" +%s 2>/dev/null) || { echo "$v: Zeitpunkt „$zeit“ unlesbar" >&2; continue; }
  if [ $((jetzt - t)) -lt "$mindestalter" ]; then echo "$v: jünger als $((mindestalter / 3600)) Stunden" >&2; continue; fi
  if grund=$("$pruefen" "$v" true "$notizen/v$v.md" "$labels"); then echo "$v"; exit 0; fi
  echo "$v: $grund" >&2
done < <(sort -t $'\t' -k1,1 -V -r "$kandidaten")
echo "nichts zu tun – keine passende Version über ${bisher:-?}" >&2
exit 1
