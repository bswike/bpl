#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fetch FPL transfers for one or more entries, mapped to player names/teams.

Usage examples:
  # one team, a single GW
  python3 fpl_transfer_watcher.py --gw 1 --entries 394273

  # many teams
  python3 fpl_transfer_watcher.py --gw 1 --entries 394273 123456 999999

  # from a file (one entry id per line, '#' allowed for comments)
  python3 fpl_transfer_watcher.py --gw 1 --entries-file league_ids.txt

  # private teams? pass your cookie string
  python3 fpl_transfer_watcher.py --gw 1 --entries 394273 --cookie "pl_profile=...; pl_user=...; ..."

Output:
  transfers_gw{gw}.csv with columns:
    entry_id, entry_team_name, manager_name, event, time,
    element_out_id, element_out_name, element_out_team,
    element_in_id, element_in_name, element_in_team,
    element_out_cost, element_in_cost, delta_cost
"""

import argparse
import csv
import sys
from typing import Dict, Any, List, Optional
import requests
from datetime import datetime

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
ENTRY_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/"
TRANSFERS_URL_TPL = "https://fantasy.premierleague.com/api/entry/{entry_id}/transfers/"

def make_session(cookie: Optional[str]) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; FPLTransferBot/1.0)",
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

def get_transfers(session: requests.Session, entry_id: int) -> List[Dict[str, Any]]:
    r = session.get(TRANSFERS_URL_TPL.format(entry_id=entry_id), timeout=20)
    r.raise_for_status()
    return r.json()

def load_entries(args) -> List[int]:
    ids: List[int] = []
    if args.entries:
        ids.extend(args.entries)
    if args.entries_file:
        with open(args.entries_file, "r", encoding="utf-8") as f:
            for line in f:
                core = line.split("#")[0].strip()
                if core.isdigit():
                    ids.append(int(core))
    if not ids:
        print("No entry IDs provided. Use --entries or --entries-file.", file=sys.stderr)
        sys.exit(1)
    return sorted(set(ids))

def fmt_player(el: Dict[str, Any]) -> str:
    return f'{el["first_name"]} {el["second_name"]}'

def main():
    ap = argparse.ArgumentParser(description="Scrape FPL transfers for entries.")
    ap.add_argument("--gw", type=int, required=True, help="Gameweek number to filter on (e.g., 1)")
    ap.add_argument("--entries", type=int, nargs="*", help="List of entry IDs")
    ap.add_argument("--entries-file", type=str, help="Path to text file with one entry ID per line")
    ap.add_argument("--cookie", type=str, default=None, help="Optional Cookie header for private teams")
    ap.add_argument("--out", type=str, default=None, help="Output CSV (default: transfers_gw{gw}.csv)")
    args = ap.parse_args()

    out_path = args.out or f"transfers_gw{args.gw}.csv"
    entry_ids = load_entries(args)
    session = make_session(args.cookie)

    try:
        refs = get_bootstrap(session)
    except requests.HTTPError as e:
        print(f"Failed to fetch bootstrap-static: {e}", file=sys.stderr)
        sys.exit(2)

    elements = refs["elements"]
    teams = refs["teams"]

    fieldnames = [
        "entry_id", "entry_team_name", "manager_name",
        "event", "time",
        "element_out_id", "element_out_name", "element_out_team",
        "element_in_id", "element_in_name", "element_in_team",
        "element_out_cost", "element_in_cost", "delta_cost"
    ]

    rows: List[Dict[str, Any]] = []

    for eid in entry_ids:
        try:
            entry = get_entry(session, eid)
            transfers = get_transfers(session, eid)
        except requests.HTTPError as e:
            print(f"[entry {eid}] fetch failed: {e}", file=sys.stderr)
            continue

        team_name = entry.get("name")
        manager_name = (entry.get("player_first_name", "") + " " + entry.get("player_last_name", "")).strip()

        # Filter to this GW
        transfers_this_gw = [t for t in transfers if int(t.get("event", -1)) == args.gw]

        for t in transfers_this_gw:
            out_el = elements.get(t["element_out"])
            in_el  = elements.get(t["element_in"])

            if not out_el or not in_el:
                # If bootstrap is out of sync (rare), skip
                continue

            out_team = teams.get(out_el["team"], {}).get("name", out_el["team"])
            in_team  = teams.get(in_el["team"], {}).get("name", in_el["team"])

            # Costs are in tenths of a million in the API (e.g., 45 = £4.5m)
            out_cost = t.get("element_out_cost")
            in_cost  = t.get("element_in_cost")

            # Human-friendly (float millions)
            def to_million(x):
                try:
                    return float(x) / 10.0
                except Exception:
                    return ""

            delta = (to_million(in_cost) - to_million(out_cost)) if (out_cost is not None and in_cost is not None) else ""

            # Normalize time
            ts = t.get("time")
            # Leave as-is (ISO) so you can sort in sheets/BI tools

            rows.append({
                "entry_id": eid,
                "entry_team_name": team_name,
                "manager_name": manager_name,
                "event": t.get("event"),
                "time": ts,
                "element_out_id": out_el["id"],
                "element_out_name": fmt_player(out_el),
                "element_out_team": out_team,
                "element_in_id": in_el["id"],
                "element_in_name": fmt_player(in_el),
                "element_in_team": in_team,
                "element_out_cost": to_million(out_cost),
                "element_in_cost": to_million(in_cost),
                "delta_cost": delta
            })

    if not rows:
        print("No transfers found for the provided entries and GW. (They might not have made moves yet.)")
    else:
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for r in rows:
                w.writerow(r)
        print(f"Wrote {len(rows)} rows to {out_path}")

if __name__ == "__main__":
    main()
