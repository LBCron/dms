#!/usr/bin/env bash
# Labels der Pull Requests zu einem Commit, mit Komma getrennt (#907, #952).
# Seit #952 entsteht die Version in einem eigenen Commit des Workflows „Version vergeben“, der zu keinem
# Pull Request gehört. Er nennt die Pull Requests im Text („Pull-Request: #123“) – dann gelten deren Labels.
# Aufruf: pr-labels.sh <repo> <sha>   (braucht GH_TOKEN mit pull-requests: read)
set -euo pipefail
repo="$1"; sha="$2"
[[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || { echo "pr-labels.sh: ungültiger Commit: $sha" >&2; exit 2; }
labels=$(gh api "repos/$repo/commits/$sha/pulls" -q '[.[].labels[].name] | join(",")')
anzahl=$(gh api "repos/$repo/commits/$sha/pulls" -q 'length')
if [ "$anzahl" = 0 ]; then
  nummern=$(gh api "repos/$repo/commits/$sha" -q .commit.message | sed -n 's/^Pull-Request: #\([0-9]\{1,7\}\)$/\1/p')
  teile=()
  for n in $nummern; do
    l=$(gh api "repos/$repo/pulls/$n" -q '[.labels[].name] | join(",")')
    [ -n "$l" ] && teile+=("$l")
  done
  labels=$(IFS=,; echo "${teile[*]:-}")
fi
echo "$labels"
