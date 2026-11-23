#!/usr/bin/env bash
# Refresh the raw feeds in data/raw from the public sportsdataverse repositories.
# Needs git. Downloads only the four files used here (the play-by-play file is about 55 MB).
set -euo pipefail

SEASON=2026
RAW="$(cd "$(dirname "$0")/.." && pwd)/data/raw"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$RAW"

clone() {  # blob-less, no-checkout clone: only the files requested below are downloaded
  git clone --quiet --depth 1 --filter=blob:none --no-checkout "https://github.com/sportsdataverse/$1" "$TMP/$1"
}
fetch() {  # fetch <repo> <path in repo> <output file>
  git -C "$TMP/$1" show "HEAD:$2" > "$RAW/$3.tmp"
  mv "$RAW/$3.tmp" "$RAW/$3"
  echo "updated data/raw/$3"
}

clone cfbfastR-cfb-raw
clone cfbfastR-cfb-data
fetch cfbfastR-cfb-raw  "cfb/schedules/csv/cfb_schedule_${SEASON}.csv"                    "cfb_schedule_${SEASON}.csv"
fetch cfbfastR-cfb-raw  "cfb/standings/json/fbs/${SEASON}.json"                           "fbs_standings_${SEASON}.json"
fetch cfbfastR-cfb-data "cfb/poll_analytics/parquet/cfb_poll_analytics_${SEASON}.parquet" "cfb_poll_analytics_${SEASON}.parquet"
fetch cfbfastR-cfb-data "cfb/pbp/parquet/play_by_play_${SEASON}.parquet"                  "play_by_play_${SEASON}.parquet"

echo "Done. Now update data/manual/ if a new AP poll or CFP ranking is out, then run: python pipeline/build.py"
