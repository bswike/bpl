#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fetch FPL rosters + weekly points + live status + player costs + global ownership + bench points into a single CSV.

Usage examples:
  python3 fpl_scrape_rosters.py --gw 1 --entries 394273
  python3 fpl_scrape_rosters.py --gw 1 --entries 394273 123456 999999
  python3 fpl_scrape_rosters.py --gw 1 --entries-file league_ids.txt
  python3 fpl_scrape_rosters.py --gw 1 --entries 394273 --cookie "pl_profile=...; pl_user=...; ..."

Output:
  fpl_rosters_points_gw{gw}.csv (with global ownership data and accurate bench points)
"""

import argparse
import csv
import sys
from typing import Dict, Any, List, Optional
import requests

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
ENTRY_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/"
PICKS_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/event/{gw}/picks/"
LIVE_URL_TPL  = "https://fantasy.premierleague.com/api/event/{gw}/live/"
FIXTURES_URL_TPL = "https://fantasy.premierleague.com/api/fixtures/?event={gw}"
HISTORY_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/history/" # <-- ADDED

ELEMENT_TYPE = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

def make_session(cookie: Optional[str]) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; FPLRosterBot/1.2)", # Incremented version
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

    # Enhanced to include global ownership data
    elements = {}
    for e in data["elements"]:
        player_name = f'{e["first_name"]} {e["second_name"]}'
        elements[e["id"]] = {
            **e,
            "cost": e["now_cost"] / 10.0,
            "player_name": player_name,
            "global_ownership": float(e["selected_by_percent"]),
            "global_captain_percent": float(e.get("ep_next", 0)),  # Expected points next (proxy for captain popularity)
        }

    return {
        "elements": elements,
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

# <-- ADDED function to get history -->
def get_history(session: requests.Session, entry_id: int) -> Dict[str, Any]:
    """Fetches the manager's season history, including chip usage."""
    r = session.get(HISTORY_URL_TPL.format(entry_id=entry_id), timeout=20)
    r.raise_for_status()
    return r.json()

def get_live_snap(session: requests.Session, gw: int) -> Dict[int, Dict[str, int]]:
    """
    Returns {element_id: {"points": int, "minutes": int}}
    """
    r = session.get(LIVE_URL_TPL.format(gw=gw), timeout=20)
    r.raise_for_status()
    data = r.json()
    out: Dict[int, Dict[str, int]] = {}
    for e in data.get("elements", []):
        pid = e["id"]
        stats = e.get("stats", {})
        out[pid] = {
            "points": int(stats.get("total_points", 0) or 0),
            "minutes": int(stats.get("minutes", 0) or 0),
        }
    return out

def get_fixtures(session: requests.Session, gw: int) -> List[Dict[str, Any]]:
    r = session.get(FIXTURES_URL_TPL.format(gw=gw), timeout=20)
    r.raise_for_status()
    return r.json()

def build_team_fixture_index(fixtures: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    """
    Map team_id -> list of fixtures in this GW (handles DGWs gracefully).
    """
    idx: Dict[int, List[Dict[str, Any]]] = {}
    for f in fixtures:
        for key in ("team_h", "team_a"):
            tid = f.get(key)
            if tid:
                idx.setdefault(tid, []).append(f)
    return idx

def choose_fixture_status(team_id: int, team_fixtures: Dict[int, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Pick the most relevant fixture for status:
    - Prefer an in-progress fixture
    - Else the next not-started fixture
    - Else the last finished fixture (if all are done)
    """
    flist = team_fixtures.get(team_id, [])
    if not flist:
        return {"started": False, "finished": False, "kickoff_time": None, "opponent_team": None}

    # Normalize flags
    def norm(f):
        started = bool(f.get("started"))
        finished = bool(f.get("finished") or f.get("finished_provisional"))
        return started, finished

    # 1) in-progress
    for f in flist:
        started, finished = norm(f)
        if started and not finished:
            return {
                "started": True,
                "finished": False,
                "kickoff_time": f.get("kickoff_time"),
                "opponent_team": f["team_a"] if f["team_h"] == team_id else f["team_h"],
            }
    # 2) not-started (pick the earliest)
    not_started = [f for f in flist if not norm(f)[0] and not norm(f)[1]]
    if not_started:
        f = sorted(not_started, key=lambda x: (x.get("kickoff_time") or ""))[0]
        return {
            "started": False,
            "finished": False,
            "kickoff_time": f.get("kickoff_time"),
            "opponent_team": f["team_a"] if f["team_h"] == team_id else f["team_h"],
        }
    # 3) all finished -> pick the most recent
    finished_list = [f for f in flist if norm(f)[1]]
    f = sorted(finished_list, key=lambda x: (x.get("kickoff_time") or ""))[-1]
    return {
        "started": True,
        "finished": True,
        "kickoff_time": f.get("kickoff_time"),
        "opponent_team": f["team_a"] if f["team_h"] == team_id else f["team_h"],
    }

def derive_status(minutes: int, fstat: Dict[str, Any]) -> str:
    if minutes and minutes > 0:
        return "played"
    if fstat.get("finished"):
        return "dnp"
    if fstat.get("started"):
        return "in_progress"
    return "not_started"

# <-- MODIFIED function signature to accept history -->
def rows_from_picks(entry: Dict[str, Any],
                    picks: Dict[str, Any],
                    history: Dict[str, Any], # <-- ADDED history
                    dicts: Dict[str, Any],
                    live_snap: Dict[int, Dict[str, int]],
                    team_fixtures: Dict[int, List[Dict[str, Any]]],
                    gw: int) -> List[Dict[str, Any]]:
    elements = dicts["elements"]
    teams = dicts["teams"]

    entry_id = entry.get("id") or picks.get("entry")
    team_name = entry.get("name")
    manager_name = (entry.get("player_first_name", "") + " " + entry.get("player_last_name", "")).strip()

    rows: List[Dict[str, Any]] = []
    team_total = 0
    team_value = 0  # Track total team value

    # <-- ADDED Bench Boost Detection -->
    is_bench_boost_active = False
    for chip in history.get('chips', []):
        if chip.get('name') == 'bboost' and chip.get('event') == gw:
            is_bench_boost_active = True
            break
    # <-- END Bench Boost Detection -->

    # <-- ADDED Bench Points calculation variables -->
    calculated_bench_points = 0
    # <-- END Bench Points calculation variables -->

    pick_list = picks.get("picks", []) # Get picks once

    for p in pick_list:
        el = elements.get(p["element"])
        if not el:
            continue

        club_id = el["team"]
        club = teams.get(club_id, {}).get("name", club_id)

        snap = live_snap.get(el["id"], {"points": 0, "minutes": 0})
        raw_pts = snap["points"]
        minutes = snap["minutes"]

        applied = raw_pts * p["multiplier"]
        team_total += applied # Team total always includes all points during BB

        # Add player cost to team value
        player_cost = el.get("cost", 0)
        team_value += player_cost

        fstat = choose_fixture_status(club_id, team_fixtures)
        opp_name = teams.get(fstat.get("opponent_team"), {}).get("name")

        status = derive_status(minutes, fstat)

        # Calculate value ratio (points per million)
        value_ratio = raw_pts / player_cost if player_cost > 0 else 0

        # <-- ADDED: Calculate bench points based on BB status -->
        # Standard calculation if BB is NOT active
        if not is_bench_boost_active and p["multiplier"] == 0:
            calculated_bench_points += raw_pts
        # <-- END Bench points calculation -->

        rows.append({
            "entry_id": entry_id,
            "entry_team_name": team_name,
            "manager_name": manager_name,
            "gameweek": gw,
            "element_id": el["id"],
            "player": el["player_name"],
            "position": ELEMENT_TYPE.get(el["element_type"], str(el["element_type"])),
            "club": club,
            "player_cost": player_cost,
            "value_ratio": round(value_ratio, 2),
            "global_ownership": el["global_ownership"],
            "global_captain_percent": el["global_captain_percent"],
            "multiplier": p["multiplier"],
            "is_captain": p["is_captain"],
            "is_vice_captain": p["is_vice_captain"],
            "points_gw": raw_pts,
            "points_applied": applied,
            "minutes": minutes,
            "status": status,
            "opponent_team": opp_name,
            "kickoff_time": fstat.get("kickoff_time"),
            "fixture_started": fstat.get("started"),
            "fixture_finished": fstat.get("finished"),
        })

    # <-- ADDED: Calculate actual bench points if Bench Boost was active -->
    if is_bench_boost_active:
        bench_player_ids = set()
        for p in pick_list:
            if 12 <= p["position"] <= 15:
                 bench_player_ids.add(p["element"])

        for player_id in bench_player_ids:
            snap = live_snap.get(player_id, {"points": 0})
            calculated_bench_points += snap["points"]
    # <-- END BB calculation -->

    # Summary row with team value and calculated bench points
    team_value_ratio = team_total / team_value if team_value > 0 else 0
    rows.append({
        "entry_id": entry_id,
        "entry_team_name": team_name,
        "manager_name": manager_name,
        "gameweek": gw,
        "element_id": "",
        "player": "TOTAL",
        "position": "",
        "club": "",
        "player_cost": team_value,
        "value_ratio": round(team_value_ratio, 2),
        "global_ownership": "",
        "global_captain_percent": "",
        "multiplier": "",
        "is_captain": "",
        "is_vice_captain": "",
        "points_gw": "",
        "points_applied": team_total,
        "minutes": "",
        "status": "",
        "opponent_team": "",
        "kickoff_time": "",
        "fixture_started": "",
        "fixture_finished": "",
        "bench_points": calculated_bench_points # <-- ADDED calculated bench points
    })

    return rows

def parse_args():
    ap = argparse.ArgumentParser(description="Scrape FPL rosters + GW points + live status + player costs + global ownership + bench points to CSV.")
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
                if not line:
                    continue
                # allow comments
                core = line.split("#")[0].strip()
                if core.isdigit():
                    ids.append(int(core))
    if not ids:
        print("No entry IDs provided. Use --entries or --entries-file.", file=sys.stderr)
        sys.exit(1)
    return sorted(set(ids))

def main():
    args = parse_args()
    out_path = args.out or f"fpl_rosters_points_gw{args.gw}.csv"
    entry_ids = load_entries(args)

    session = make_session(args.cookie)

    # Reference data (now includes global ownership)
    try:
        dicts = get_bootstrap(session)
        print(f"✅ Fetched global ownership data for {len(dicts['elements'])} players")
    except requests.HTTPError as e:
        print(f"Failed to fetch bootstrap-static: {e}", file=sys.stderr)
        sys.exit(2)

    # Live points + minutes
    try:
        live_snap = get_live_snap(session, args.gw)
        print(f"✅ Fetched live gameweek data")
    except requests.HTTPError as e:
        print(f"Failed to fetch event/{args.gw}/live: {e}", file=sys.stderr)
        sys.exit(2)

    # Fixtures for status
    try:
        fixtures = get_fixtures(session, args.gw)
        team_fixtures = build_team_fixture_index(fixtures)
        print(f"✅ Fetched fixture data")
    except requests.HTTPError as e:
        print(f"Failed to fetch fixtures for GW{args.gw}: {e}", file=sys.stderr)
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

        # <-- ADDED Fetching history -->
        try:
            history = get_history(session, eid)
        except requests.HTTPError as e:
            print(f"[entry {eid}] history fetch failed: {e}", file=sys.stderr)
            history = {} # Continue with empty history if fetch fails
        # <-- END Fetching history -->

        # <-- MODIFIED Call to pass history -->
        all_rows.extend(rows_from_picks(entry, picks, history, dicts, live_snap, team_fixtures, args.gw))

    if not all_rows:
        print("No rows collected. Check entry IDs, GW, or cookie auth.", file=sys.stderr)
        sys.exit(3)

    # <-- MODIFIED Fieldnames to include bench_points -->
    fieldnames = [
        "entry_id", "entry_team_name", "manager_name", "gameweek",
        "element_id", "player", "position", "club",
        "player_cost", "value_ratio", "global_ownership", "global_captain_percent",
        "multiplier", "is_captain", "is_vice_captain",
        "points_gw", "points_applied", "bench_points", # <-- ADDED bench_points here
        "minutes", "status", "opponent_team", "kickoff_time",
        "fixture_started", "fixture_finished",
    ]
    # <-- END Fieldnames modification -->

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore') # Use extrasaction='ignore'
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    print(f"✅ Wrote {len(all_rows)} rows to {out_path}")
    print(f"📊 Enhanced with global ownership data and accurate bench points!")

if __name__ == "__main__":
    main()