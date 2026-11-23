#!/usr/bin/env bash
# Download team and player box scores plus quarter scores into data/raw/box (not committed; ~6 MB).
#   bash pipeline/fetch_box.sh            # 2004-2026
#   bash pipeline/fetch_box.sh 2026       # just this season (after new games)
# Then run: python pipeline/boxscores.py
set -euo pipefail

SEASONS=("$@")
[ ${#SEASONS[@]} -eq 0 ] && SEASONS=($(seq 2004 2026))
RAW="$(cd "$(dirname "$0")/.." && pwd)/data/raw/box"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$RAW"

git clone --quiet --depth 1 --filter=blob:none --no-checkout "https://github.com/sportsdataverse/cfbfastR-cfb-data" "$TMP/data"
fetch() {  # fetch <path in repo> <output file>
  git -C "$TMP/data" show "HEAD:$1" > "$RAW/$2.tmp"
  mv "$RAW/$2.tmp" "$RAW/$2"
  echo "updated data/raw/box/$2"
}
for y in "${SEASONS[@]}"; do
  fetch "cfb/team_box/parquet/team_box_${y}.parquet"     "team_box_${y}.parquet"
  fetch "cfb/player_box/parquet/player_box_${y}.parquet" "player_box_${y}.parquet"
  fetch "cfb/linescores/parquet/linescores_${y}.parquet" "linescores_${y}.parquet"
done
echo "Done. Now run: python pipeline/boxscores.py"
