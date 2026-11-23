#!/usr/bin/env bash
# Download the feeds for past seasons into data/raw/history (not committed; about 330 MB with play-by-play).
#   bash pipeline/fetch_history.sh            # 2004-2025
#   bash pipeline/fetch_history.sh 2023 2024  # just these seasons
# Then run: python pipeline/history.py
set -euo pipefail

SEASONS=("$@")
[ ${#SEASONS[@]} -eq 0 ] && SEASONS=($(seq 2004 2025))
RAW="$(cd "$(dirname "$0")/.." && pwd)/data/raw/history"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$RAW"

clone() {
  git clone --quiet --depth 1 --filter=blob:none --no-checkout "https://github.com/sportsdataverse/$1" "$TMP/$1"
}
fetch() {  # fetch <repo> <path in repo> <output file>
  git -C "$TMP/$1" show "HEAD:$2" > "$RAW/$3.tmp"
  mv "$RAW/$3.tmp" "$RAW/$3"
  echo "updated data/raw/history/$3"
}

clone cfbfastR-cfb-raw
clone cfbfastR-cfb-data
for y in "${SEASONS[@]}"; do
  fetch cfbfastR-cfb-raw  "cfb/schedules/csv/cfb_schedule_${y}.csv"                    "cfb_schedule_${y}.csv"
  fetch cfbfastR-cfb-data "cfb/poll_analytics/parquet/cfb_poll_analytics_${y}.parquet" "cfb_poll_analytics_${y}.parquet"
  fetch cfbfastR-cfb-data "cfb/cfb_teams/parquet/cfb_teams_${y}.parquet"               "cfb_teams_${y}.parquet"
  fetch cfbfastR-cfb-data "cfb/pbp/parquet/play_by_play_${y}.parquet"                  "play_by_play_${y}.parquet"
  # second schedule source + quarter scores: fills games missing from the raw schedule (2022 lacks weeks 3 and 12)
  fetch cfbfastR-cfb-data "cfb/cfb_schedules/parquet/cfb_schedules_${y}.parquet"         "cfb_schedules_${y}.parquet"
  fetch cfbfastR-cfb-data "cfb/linescores/parquet/linescores_${y}.parquet"               "linescores_${y}.parquet"
done
echo "Done. Now run: python pipeline/history.py"
