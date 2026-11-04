#!/usr/bin/env bash
# Darf :stabil auf diese Version wandern? (#714)
#   stabil-pruefen.sh <version> <neu: true|false> <Datei der Release-Notes> [Labels des PR, mit Komma getrennt]
# Exit 0 = ja; Exit 1 = nein (Grund auf stdout). Image-Bau, Signatur und Update-Test prüft der Workflow selbst.
set -u
v="${1:-}"; neu="${2:-false}"; notizen="${3:-}"; labels=",${4:-},"
nein() { echo "kein :stabil – $*"; exit 1; }
[ "$neu" = true ] || nein "kein neues Release (Stand von main ohne neue Versionsnummer oder Text-Änderung)"
[[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || nein "'$v' ist keine Versionsnummer X.Y.Z (Vorabversionen wandern nie)"
if [ -z "$notizen" ] || [ ! -s "$notizen" ]; then nein "keine Release-Notes ($notizen)"; fi
case "$labels" in *,nicht-stabil,*) nein "der Maintainer hält die Version mit dem Label 'nicht-stabil' zurück";; esac
echo ":stabil wandert auf $v"
