#!/usr/bin/env bash
# Probe des Beispiels „lokaler KI-Dienst (Ollama)“ (#564), läuft in der CI (ki-beispiel.yml):
#   1. überall dieselbe Ollama-Version; jede Variante ist gültiges Compose und hat keinen Port nach außen;
#      dms-anbinden.yml passt zu den Vorlagen des DMS
#   2. Variante „nur Prozessor“ mit einem winzigen Modell starten → modell-laden lädt es und endet mit 0
#   3. aus dem Netz dms-ki (wie das DMS): Modellliste, Antwort, strukturierte Ausgabe nach JSON Schema
#      (wie „Aus Dokument ausfüllen“) – vom Host aus ist Ollama nicht erreichbar, dms-ki ist intern
#   4. Variante Intel-Grafik lässt sich bauen und bringt den Vulkan-Treiber mit (starten geht ohne Grafik nicht)
#
#   deploy/beispiele/ki-ollama/probe.sh            Modell für die Probe: PROBE_MODELL (Standard gemma3:270m)
set -euo pipefail
cd "$(dirname "$0")"
MODELL="${PROBE_MODELL:-gemma3:270m}"
CLIENT=alpine:3.22
PROJEKT=probe-ki
VERSION=""
arbeit=$(mktemp -d)
compose() { docker compose -p "$PROJEKT" -f "$arbeit/docker-compose.yml" "$@"; }
aufraeumen() {
  compose down -v >/dev/null 2>&1 || true
  docker image rm -f "dms-beispiel/ollama-intel:$VERSION" >/dev/null 2>&1 || true
  sudo rm -rf "$arbeit" 2>/dev/null || rm -rf "$arbeit" || true
}
trap aufraeumen EXIT
set -E
trap 'echo "::error::ki-ollama: Zeile $LINENO: $BASH_COMMAND (Code $?)"; compose logs --tail 40 2>&1 | sed "s/^/::error::/" || true' ERR
fehler() { echo "::error::ki-ollama: $*"; compose logs --tail 60 2>&1 || true; exit 1; }

echo "::group::Dateien prüfen"
# Eine Version in allen Dateien (amd.yml mit -rocm, intel-grafik.yml als FROM und als eigener Tag).
versionen=$(grep -ho 'ollama/ollama:[0-9][0-9.]*[0-9]' ./*.yml | sort -u)
[ "$(printf '%s\n' "$versionen" | wc -l)" = 1 ] || fehler "verschiedene Ollama-Versionen: $(echo $versionen)"
VERSION=${versionen#ollama/ollama:}
grep -q "image: dms-beispiel/ollama-intel:$VERSION\$" intel-grafik.yml || fehler "intel-grafik.yml: Tag passt nicht zu $VERSION"
grep -q "image: ollama/ollama:$VERSION-rocm\$" amd.yml || fehler "amd.yml: Tag passt nicht zu $VERSION"
echo "Ollama $VERSION"
for zusatz in "" intel-grafik.yml nvidia.yml amd.yml; do
  dateien=(-f docker-compose.yml); [ -z "$zusatz" ] || dateien+=(-f "$zusatz")
  docker compose -p "$PROJEKT" "${dateien[@]}" config -q
  offen=$(docker compose -p "$PROJEKT" "${dateien[@]}" config --format json \
    | jq '[.services[] | select((.ports // []) | length > 0)] | length')
  [ "$offen" = 0 ] || fehler "Port nach außen mit ${zusatz:-docker-compose.yml}"
  echo "ok: docker-compose.yml${zusatz:+ + $zusatz}"
done
for vorlage in nas synology ugreen qnap truenas unraid; do
  netze=$(DB_PASSWORD=probe docker compose -f "../../$vorlage/docker-compose.yml" -f dms-anbinden.yml config --format json \
    | jq -r '.services.app.networks | keys | join(",")')
  [ "$netze" = "default,dms-ki" ] || fehler "dms-anbinden.yml mit $vorlage: Netze $netze"
done
echo "ok: dms-anbinden.yml passt zu den Vorlagen"
echo "::endgroup::"

echo "::group::Nur Prozessor starten (Modell $MODELL)"
cp docker-compose.yml "$arbeit/"
sed -i -E "s#^(x-modell: &modell ).*#\1\"$MODELL\"#" "$arbeit/docker-compose.yml"
grep -q "^x-modell: &modell \"$MODELL\"\$" "$arbeit/docker-compose.yml" || fehler "Modell nicht ersetzt"
compose up -d --quiet-pull
laden=$(compose ps -a -q modell-laden)
[ -n "$laden" ] || fehler "modell-laden wurde nicht gestartet"
code=$(timeout 600 docker wait "$laden") || fehler "modell-laden endet nicht"
compose logs --no-log-prefix modell-laden | tail -3
[ "$code" = 0 ] || fehler "modell-laden endet mit Code $code"
# Zweiter Start: Modell ist schon da, nichts wird geladen.
compose up -d --quiet-pull modell-laden
laden=$(compose ps -a -q modell-laden)
[ "$(timeout 120 docker wait "$laden")" = 0 ] || fehler "modell-laden beim zweiten Start"
compose logs --no-log-prefix modell-laden | grep -q "ist schon da" || fehler "modell-laden lädt beim zweiten Start erneut"
echo "::endgroup::"

echo "::group::Aus dem Netz dms-ki fragen (wie das DMS)"
[ "$(docker network inspect dms-ki -f '{{.Internal}}')" = true ] || fehler "Netz dms-ki ist nicht intern"
frage() { docker run --rm --network dms-ki "$CLIENT" wget -qO- -T 300 "$@"; }
frage http://ollama:11434/v1/models | jq -e --arg m "$MODELL" '[.data[].id] | index($m) != null' >/dev/null \
  || fehler "Modell fehlt in /v1/models"
koerper=$(jq -nc --arg m "$MODELL" '{model: $m, stream: false, max_tokens: 24, messages: [{role: "user", content: "Sag Hallo."}]}')
antwort=$(frage --header 'Content-Type: application/json' --post-data "$koerper" http://ollama:11434/v1/chat/completions)
echo "$antwort" | jq -e '.choices[0].message.content | length > 0' >/dev/null || fehler "keine Antwort: $antwort"
echo "Antwort: $(echo "$antwort" | jq -c '.choices[0].message.content')"
schema='{"type":"object","properties":{"betrag":{"type":"number"},"datum":{"type":"string"}},"required":["betrag","datum"],"additionalProperties":false}'
koerper=$(jq -nc --arg m "$MODELL" --argjson s "$schema" '{model: $m, stream: false, temperature: 0, max_tokens: 256,
  messages: [{role: "user", content: "Rechnung vom 3. März 2026 über 49,90 Euro. Gib Betrag und Datum an."}],
  response_format: {type: "json_schema", json_schema: {name: "felder", schema: $s}}}')
inhalt=$(frage --header 'Content-Type: application/json' --post-data "$koerper" http://ollama:11434/v1/chat/completions \
  | jq -r '.choices[0].message.content')
echo "$inhalt" | jq -e '(.betrag | type) == "number" and (.datum | type) == "string"' >/dev/null \
  || fehler "strukturierte Ausgabe passt nicht zum Schema: $inhalt"
echo "Strukturierte Ausgabe: $inhalt"
if curl -fsS --max-time 3 http://127.0.0.1:11434/ >/dev/null 2>&1; then fehler "Ollama ist vom Host aus erreichbar"; fi
docker stats --no-stream --format '{{.Name}}: {{.MemUsage}}' "$(compose ps -q ollama)"
echo "::endgroup::"

echo "::group::Variante Intel-Grafik bauen"
docker compose -p "$PROJEKT" -f docker-compose.yml -f intel-grafik.yml build ollama
docker run --rm --entrypoint sh "dms-beispiel/ollama-intel:$VERSION" -c 'ls /usr/share/vulkan/icd.d/' | tee /dev/stderr \
  | grep -q intel || fehler "kein Vulkan-Treiber für Intel im gebauten Image"
echo "::endgroup::"
echo "KI-Beispiel in Ordnung."
