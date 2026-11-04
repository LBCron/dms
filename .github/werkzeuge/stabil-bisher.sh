#!/usr/bin/env bash
# Bisheriger stabiler Stand eines Images (#714): :stabil, solange es das noch nicht gibt das letzte Release.
#   stabil-bisher.sh <dms|dms-komplett>   →   z. B. ghcr.io/motom001/dms-komplett:stabil
set -euo pipefail
ref="ghcr.io/motom001/${1:?Image angeben}"
if docker buildx imagetools inspect "$ref:stabil" >/dev/null 2>&1; then echo "$ref:stabil"; exit 0; fi
v=$(gh api repos/motom001/dms/releases/latest -q .tag_name)
echo "$ref:${v#v}"
