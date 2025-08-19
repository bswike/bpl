#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fetch FPL rosters + weekly points + live status + player costs + global ownership + ALL players into a single CSV.

This version includes ALL FPL players (not just league picks) so we can find true "Global Misses"

Usage examples:
  python3 fpl_scrape_all_players.py --gw 1 --entries 394273
  python3 fpl_scrape_all_players.py --gw 1 --entries 394273 123456 999999
  python3 fpl_scrape_all_players.py --gw 1 --entries-file league_ids.txt

Output:
  fpl_all_players_gw{gw}.csv (with ALL players + league ownership data)
"""

import argparse
import csv
import sys
from typing import Dict, Any, List, Optional, Set
import requests

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
ENTRY_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/"
PICKS_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/event/{gw}/picks/"
LIVE_URL_TPL  = "https://fantasy.premierleague.com/api/event/{gw}/live/"
FIXTURES_URL_TPL = "https://fantasy.premierleague.com/api/fixtures/?event={gw}"

ELEMENT_TYPE = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

def make_session(cookie: Optional[str]) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; FPLRosterBot/1.1)",
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
    
    # Enhanced to include global ownership data for ALL players
    elements = {}
    for e in data["elements"]:
        player_name = f'{e["first_name"]} {e["second_name"]}'
        elements[e["id"]] = {
            **e, 
            "cost": e["now_cost"] / 10.0,
            "player_name": player_name,
            "global_ownership": float(e["selected_by_percent"]),
            "global_captain_percent": float(e.get("ep_next", 0)),
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

def collect_league_picks(entry_ids: List[int], session: requests.Session, gw: int) -> Set[int]:
    """
    Collect all element_ids that appear in the league
    """
    league_picks: Set[int] = set()
    
    for eid in entry_ids:
        try:
            picks = get_picks(session, eid, gw)
            for p in picks.get("picks", []):
                league_picks.add(p["element"])
        except requests.HTTPError as e:
            print(f"[entry {eid}] picks fetch failed: {e}", file=sys.stderr)
            continue
    
    return league_picks

def calculate_league_ownership(entry_ids: List[int], session: requests.Session, gw: int) -> Dict[int, Dict[str, Any]]:
    """
    Calculate ownership stats for each player in the league
    """
    player_ownership: Dict[int, Dict[str, Any]] = {}
    
    for eid in entry_ids:
        try:
            entry = get_entry(session, eid)
            picks = get_picks(session, eid, gw)
            
            manager_name = (entry.get("player_first_name", "") + " " + entry.get("player_last_name", "")).strip()
            
            for p in picks.get("picks", []):
                element_id = p["element"]
                if element_id not in player_ownership:
                    player_ownership[element_id] = {
                        "owner_count": 0,
                        "captain_count": 0,
                        "managers": []
                    }
                
                player_ownership[element_id]["owner_count"] += 1
                player_ownership[element_id]["managers"].append(manager_name)
                
                if p["is_captain"]:
                    player_ownership[element_id]["captain_count"] += 1
                    
        except requests.HTTPError as e:
            print(f"[entry {eid}] fetch failed: {e}", file=sys.stderr)
            continue
    
    # Calculate percentages
    total_managers = len(entry_ids)
    for element_id in player_ownership:
        ownership = player_ownership[element_id]
        ownership["league_ownership_percent"] = round((ownership["owner_count"] / total_managers) * 100, 1)
        ownership["league_captain_percent"] = round((ownership["captain_count"] / total_managers) * 100, 1)
    
    return player_ownership

def create_all_players_data(dicts: Dict[str, Any], 
                          live_snap: Dict[int, Dict[str, int]],
                          team_fixtures: Dict[int, List[Dict[str, Any]]],
                          league_ownership: Dict[int, Dict[str, Any]],
                          gw: int) -> List[Dict[str, Any]]:
    """
    Create rows for ALL FPL players, not just league picks
    """
    elements = dicts["elements"]
    teams = dicts["teams"]
    
    rows: List[Dict[str, Any]] = []
    
    for element_id, el in elements.items():
        club_id = el["team"]
        club = teams.get(club_id, {}).get("name", club_id)
        
        snap = live_snap.get(element_id, {"points": 0, "minutes": 0})
        raw_pts = snap["points"]
        minutes = snap["minutes"]
        
        player_cost = el.get("cost", 0)
        value_ratio = raw_pts / player_cost if player_cost > 0 else 0
        
        fstat = choose_fixture_status(club_id, team_fixtures)
        opp_name = teams.get(fstat.get("opponent_team"), {}).get("name")
        status = derive_status(minutes, fstat)
        
        # Get league ownership data (0 if not owned)
        ownership_data = league_ownership.get(element_id, {
            "owner_count": 0,
            "captain_count": 0,
            "league_ownership_percent": 0,
            "league_captain_percent": 0,
            "managers": []
        })
        
        rows.append({
            "element_id": element_id,
            "player": el["player_name"],
            "position": ELEMENT_TYPE.get(el["element_type"], str(el["element_type"])),
            "club": club,
            "player_cost": player_cost,
            "value_ratio": round(value_ratio, 2),
            "global_ownership": el["global_ownership"],
            "global_captain_percent": el["global_captain_percent"],
            "league_ownership": ownership_data["league_ownership_percent"],
            "league_captain_percent": ownership_data["league_captain_percent"],
            "league_owner_count": ownership_data["owner_count"],
            "league_owners": "; ".join(ownership_data["managers"]) if ownership_data["managers"] else "",
            "points_gw": raw_pts,
            "minutes": minutes,
            "status": status,
            "opponent_team": opp_name,
            "kickoff_time": fstat.get("kickoff_time"),
            "fixture_started": fstat.get("started"),
            "fixture_finished": fstat.get("finished"),
        })
    
    return rows

def parse_args():
    ap = argparse.ArgumentParser(description="Scrape ALL FPL players + league ownership data to CSV.")
    ap.add_argument("--gw", type=int, required=True, help="Gameweek number (e.g., 1)")
    ap.add_argument("--entries", type=int, nargs="*", help="List of entry IDs")
    ap.add_argument("--entries-file", type=str, help="Path to text file with one entry ID per line")
    ap.add_argument("--cookie", type=str, default=None, help="Optional Cookie header for private teams")
    ap.add_argument("--out", type=str, default=None, help="Output CSV (default: fpl_all_players_gw{gw}.csv)")
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
    out_path = args.out or f"fpl_all_players_gw{args.gw}.csv"
    entry_ids = load_entries(args)

    session = make_session(args.cookie)

    # Get ALL FPL player data
    try:
        dicts = get_bootstrap(session)
        print(f"✅ Fetched data for {len(dicts['elements'])} total FPL players")
    except requests.HTTPError as e:
        print(f"Failed to fetch bootstrap-static: {e}", file=sys.stderr)
        sys.exit(2)

    # Live points + minutes for all players
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

    # Calculate league ownership for all players
    print(f"🔍 Calculating league ownership across {len(entry_ids)} managers...")
    league_ownership = calculate_league_ownership(entry_ids, session, args.gw)
    league_picks_count = len([p for p in league_ownership.values() if p["owner_count"] > 0])
    print(f"✅ Your league drafted {league_picks_count} unique players")

    # Create data for ALL FPL players
    all_rows = create_all_players_data(dicts, live_snap, team_fixtures, league_ownership, args.gw)

    fieldnames = [
        "element_id", "player", "position", "club",
        "player_cost", "value_ratio", "global_ownership", "global_captain_percent",
        "league_ownership", "league_captain_percent", "league_owner_count", "league_owners",
        "points_gw", "minutes", "status", "opponent_team", "kickoff_time",
        "fixture_started", "fixture_finished",
    ]
    
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    # Summary stats
    total_players = len(all_rows)
    league_owned = len([r for r in all_rows if r["league_ownership"] > 0])
    global_misses = len([r for r in all_rows if r["league_ownership"] == 0 and r["global_ownership"] >= 15 and r["points_gw"] >= 5])
    
    print(f"✅ Wrote {total_players} total FPL players to {out_path}")
    print(f"📊 League owned: {league_owned} players")
    print(f"😬 Potential global misses: {global_misses} players")
    print(f"🧠 Perfect for League Intelligence analysis!")

if __name__ == "__main__":
    main()