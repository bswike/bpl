#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fetch FPL rosters + weekly points into a single CSV.

Usage examples:
  python3 fpl_scrape_rosters_with_points.py --gw 1 --entries 394273
  python3 fpl_scrape_rosters_with_points.py --gw 1 --entries 394273 123456 999999
  python3 fpl_scrape_rosters_with_points.py --gw 1 --entries-file league_ids.txt
  python3 fpl_scrape_rosters_with_points.py --gw 1 --entries 394273 --cookie "pl_profile=...; pl_user=...; ..."

Output:
  fpl_rosters_points_gw{gw}.csv
"""

import argparse
import csv
import sys
from typing import Dict, Any, List
import requests

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
ENTRY_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/"
PICKS_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/event/{gw}/picks/"
LIVE_URL_TPL  = "https://fantasy.premierleague.com/api/event/{gw}/live/"

ELEMENT_TYPE = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

def make_session(cookie: str | None) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; FPLRosterBot/1.0)",
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://fantasy.premierleague.com/"
    })
    if cookie:
        s.headers.update({"Cookie": cookie})
    return s

def get_bootstrap(session: requests.Session) -> Dict[str, Any]:
    r = session.get(BOOTSTRAP_URL, timeout=20)
    r.raise_for_status()
    data = r.json()
    return {
        "elements": {e["id"]: e for e in data["elements"]},
        "teams": {t["id"]: t for t in data["teams"]},
    }

def get_entry(session: requests.Session, entry_id: int) -> Dict[str, Any]:
    r = session.get(ENTRY_URL_TPL.format(entry_id=entry_id), timeout=20)
    r.raise_for_status()
    return r.json()

def get_picks(session: requests.Session, entry_id: int, gw: int) -> Dict[str, Any]:
    r = session.get(PICKS_URL_TPL.format(entry_id=entry_id, gw=gw), timeout=20)
    r.raise_for_status()
    return r.json()

def get_live_points(session: requests.Session, gw: int) -> Dict[int, int]:
    """
    Returns {element_id: total_points_for_the_week}
    """
    r = session.get(LIVE_URL_TPL.format(gw=gw), timeout=20)
    r.raise_for_status()
    data = r.json()
    points = {}
    for e in data.get("elements", []):
        pid = e["id"]
        pts = e["stats"]["total_points"]
        points[pid] = pts
    return points

def rows_from_picks(entry: Dict[str, Any],
                    picks: Dict[str, Any],
                    dicts: Dict[str, Any],
                    live_points: Dict[int, int],
                    gw: int) -> List[Dict[str, Any]]:
    elements = dicts["elements"]
    teams = dicts["teams"]

    entry_id = entry.get("id") or picks.get("entry")
    team_name = entry.get("name")
    manager_name = (entry.get("player_first_name", "") + " " + entry.get("player_last_name", "")).strip()

    rows = []
    team_total = 0

    for p in picks.get("picks", []):
        el = elements.get(p["element"])
        if not el:
            continue
        club = teams.get(el["team"], {}).get("name", el["team"])
        raw_pts = live_points.get(el["id"], 0)
        applied = raw_pts * p["multiplier"]
        team_total += applied

        rows.append({
            "entry_id": entry_id,
            "entry_team_name": team_name,
            "manager_name": manager_name,
            "gameweek": gw,
            "element_id": el["id"],
            "player": f'{el["first_name"]} {el["second_name"]}',
            "position": ELEMENT_TYPE.get(el["element_type"], str(el["element_type"])),
            "club": club,
            "multiplier": p["multiplier"],
            "is_captain": p["is_captain"],
            "is_vice_captain": p["is_vice_captain"],
            "points_gw": raw_pts,
            "points_applied": applied
        })

    # Add a summary total row for this entry (easy to filter by player == "TOTAL")
    rows.append({
        "entry_id": entry_id,
        "entry_team_name": team_name,
        "manager_name": manager_name,
        "gameweek": gw,
        "element_id": "",
        "player": "TOTAL",
        "position": "",
        "club": "",
        "multiplier": "",
        "is_captain": "",
        "is_vice_captain": "",
        "points_gw": "",
        "points_applied": team_total
    })

    return rows

def parse_args():
    ap = argparse.ArgumentParser(description="Scrape FPL rosters + GW points to CSV.")
    ap.add_argument("--gw", type=int, required=True, help="Gameweek number (e.g., 1)")
    ap.add_argument("--entries", type=int, nargs="*", help="List of entry IDs")
    ap.add_argument("--entries-file", type=str, help="Path to text file with one entry ID per line")
    ap.add_argument("--cookie", type=str, default=None, help="Optional Cookie header for private teams")
    ap.add_argument("--out", type=str, default=None, help="Output CSV (default: fpl_rosters_points_gw{gw}.csv)")
    return ap.parse_args()

def load_entries(args) -> List[int]:
    ids: List[int] = []
    if args.entries:
        ids.extend(args.entries)
    if args.entries_file:
        with open(args.entries_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and line.split("#")[0].strip().isdigit():
                    ids.append(int(line.split("#")[0].strip()))
    if not ids:
        print("No entry IDs provided. Use --entries or --entries-file.", file=sys.stderr)
        sys.exit(1)
    return sorted(set(ids))

def main():
    args = parse_args()
    out_path = args.out or f"fpl_rosters_points_gw{args.gw}.csv"
    entry_ids = load_entries(args)

    session = make_session(args.cookie)

    # Reference data
    try:
        dicts = get_bootstrap(session)
    except requests.HTTPError as e:
        print(f"Failed to fetch bootstrap-static: {e}", file=sys.stderr)
        sys.exit(2)

    # Weekly points
    try:
        live_points = get_live_points(session, args.gw)
    except requests.HTTPError as e:
        print(f"Failed to fetch event/{args.gw}/live: {e}", file=sys.stderr)
        sys.exit(2)

    all_rows: List[Dict[str, Any]] = []
    for eid in entry_ids:
        try:
            entry = get_entry(session, eid)
        except requests.HTTPError as e:
            print(f"[entry {eid}] entry fetch failed: {e}", file=sys.stderr)
            continue

        try:
            picks = get_picks(session, eid, args.gw)
        except requests.HTTPError as e:
            print(f"[entry {eid}] picks fetch failed: {e}", file=sys.stderr)
            continue

        all_rows.extend(rows_from_picks(entry, picks, dicts, live_points, args.gw))

    if not all_rows:
        print("No rows collected. Check entry IDs, GW, or cookie auth.", file=sys.stderr)
        sys.exit(3)

    fieldnames = [
        "entry_id", "entry_team_name", "manager_name", "gameweek",
        "element_id", "player", "position", "club",
        "multiplier", "is_captain", "is_vice_captain",
        "points_gw", "points_applied"
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    print(f"Wrote {len(all_rows)} rows to {out_path}")

if __name__ == "__main__":
    main()
