#!/usr/bin/env bash
# Visual QA helper: runs scripts/screenshot.ts inside the Playwright Docker image
# (the host may lack Chromium's system libraries). Screenshots land in /tmp/shots.
#   scripts/shot.sh /scorecards list.png [width] [height]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p /tmp/shots
docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -e FULL="${FULL:-0}" \
  -e APP_URL="${APP_URL:-http://localhost:5173}" \
  -v "$PWD":/work -v /tmp/shots:/shots -w /work \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  node --import tsx scripts/screenshot.ts "$1" "/shots/$2" "${3:-1440}" "${4:-900}"
