#!/usr/bin/env python3
"""One box score file per completed game, for the site's game pages.

    bash pipeline/fetch_box.sh      # ESPN team/player box scores and quarter scores into data/raw/box
    python pipeline/boxscores.py    # after build.py and history.py

Writes data/box/<game_id>.json for every game in data/json/games.json (2026) and data/history/games.json
(2020-2025):

    {game_id, season, date, week, season_type, note, venue, neutral,
     away: {id, name, score, fbs, lines: [q1, q2, ...]}, home: {...},
     team_stats: [[label, away value, home value], ...],
     players: {category: {cols: [labels], away: [[name, v...], ...], home: [...]}}}

Values are kept as ESPN shows them (strings such as "21/32" or "22:45"). Quarter scores are left out of a
game when they do not add up to the final score.
"""
import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "box"
OUT = ROOT / "data" / "box"
SEASONS = range(2020, 2027)

TEAM_STATS = [
    ("First downs", "firstDowns"),
    ("3rd down", "thirdDownEff"),
    ("4th down", "fourthDownEff"),
    ("Total yards", "totalYards"),
    ("Passing yards", "netPassingYards"),
    ("Comp/Att", "completionAttempts"),
    ("Yards per pass", "yardsPerPass"),
    ("Rushing yards", "rushingYards"),
    ("Rushing attempts", "rushingAttempts"),
    ("Yards per rush", "yardsPerRushAttempt"),
    ("Penalties-yards", "totalPenaltiesYards"),
    ("Turnovers", "turnovers"),
    ("Fumbles lost", "fumblesLost"),
    ("Interceptions thrown", "interceptions"),
    ("Time of possession", "possessionTime"),
]

# category -> (columns as (label, field), field to sort by, descending)
PLAYER_CATS = {
    "passing": ([("C/ATT", "completions/passingAttempts"), ("YDS", "passingYards"), ("AVG", "yardsPerPassAttempt"),
                 ("TD", "passingTouchdowns"), ("INT", "interceptions"), ("QBR", "adjQBR")], "passingYards"),
    "rushing": ([("CAR", "rushingAttempts"), ("YDS", "rushingYards"), ("AVG", "yardsPerRushAttempt"),
                 ("TD", "rushingTouchdowns"), ("LONG", "longRushing")], "rushingYards"),
    "receiving": ([("REC", "receptions"), ("YDS", "receivingYards"), ("AVG", "yardsPerReception"),
                   ("TD", "receivingTouchdowns"), ("LONG", "longReception")], "receivingYards"),
    "fumbles": ([("FUM", "fumbles"), ("LOST", "fumblesLost"), ("REC", "fumblesRecovered")], "fumbles"),
    "defensive": ([("TOT", "totalTackles"), ("SOLO", "soloTackles"), ("SACKS", "sacks"), ("TFL", "tacklesForLoss"),
                   ("PD", "passesDefended"), ("QB HUR", "hurries"), ("TD", "defensiveTouchdowns")], "totalTackles"),
    "interceptions": ([("INT", "interceptions"), ("YDS", "interceptionYards"), ("TD", "interceptionTouchdowns")], "interceptions"),
    "kickReturns": ([("NO", "kickReturns"), ("YDS", "kickReturnYards"), ("AVG", "yardsPerKickReturn"),
                     ("LONG", "longKickReturn"), ("TD", "kickReturnTouchdowns")], "kickReturnYards"),
    "puntReturns": ([("NO", "puntReturns"), ("YDS", "puntReturnYards"), ("AVG", "yardsPerPuntReturn"),
                     ("LONG", "longPuntReturn"), ("TD", "puntReturnTouchdowns")], "puntReturnYards"),
    "kicking": ([("FG", "fieldGoalsMade/fieldGoalAttempts"), ("PCT", "fieldGoalPct"), ("LONG", "longFieldGoalMade"),
                 ("XP", "extraPointsMade/extraPointAttempts"), ("PTS", "totalKickingPoints")], "totalKickingPoints"),
    "punting": ([("NO", "punts"), ("YDS", "puntYards"), ("AVG", "grossAvgPuntYards"), ("TB", "touchbacks"),
                 ("IN 20", "puntsInside20"), ("LONG", "longPunt")], "puntYards"),
}


def warn(msg):
    print(f"WARNING: {msg}", file=sys.stderr)


def cell(v):
    """Box score value as display text; '' for missing."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:g}"
    return str(v)


def sort_num(v):
    try:
        return float(str(v).split("/")[0])
    except ValueError:
        return -1.0


def our_games():
    """Completed games from the site's tables: game_id -> header info and each FBS side's row."""
    rows = json.loads((ROOT / "data" / "json" / "games.json").read_text())
    for r in rows:
        r.setdefault("season", 2026)
        r.setdefault("season_type", "Regular")
    rows += json.loads((ROOT / "data" / "history" / "games.json").read_text())
    games = {}
    for r in rows:
        games.setdefault(r["game_id"], []).append(r)
    return games


def main():
    games = our_games()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    written, no_lines, missing = 0, 0, []
    for season in SEASONS:
        paths = [RAW / f"{n}_{season}.parquet" for n in ("team_box", "player_box", "linescores")]
        if not all(p.exists() for p in paths):
            warn(f"{season}: box score files missing; run pipeline/fetch_box.sh")
            continue
        tb, pb, ls = (pd.read_parquet(p) for p in paths)
        for df in (tb, pb, ls):
            df["game_id"] = df.game_id.astype(int)
            df["team_id"] = df.team_id.astype(int)
        ls["value"] = pd.to_numeric(ls["value"], errors="coerce")
        tb_by = {k: g for k, g in tb.groupby("game_id")}
        pb_by = {k: g for k, g in pb.groupby("game_id")}
        lines = {k: g.sort_values("period")["value"].tolist() for k, g in ls.groupby(["game_id", "team_id"])}

        season_ids = [gid for gid, rs in games.items() if rs[0]["season"] == season]
        for gid in season_ids:
            rs = games[gid]
            t = tb_by.get(gid)
            if t is None or len(t) != 2:
                missing.append(gid)
                continue
            first = rs[0]
            neutral = first["site"] == "Neutral"
            # names and scores from the site's own game rows (FBS side; the opponent fields cover an FCS side)
            info = {}
            for r in rs:
                info[r["team_id"]] = {"name": r["team"], "score": r["points_for"], "fbs": True}
                info.setdefault(r["opp_id"], {"name": r["opp"], "score": r["points_against"], "fbs": bool(r["opp_is_fbs"])})
            sides = {}
            for s in t.itertuples():
                side = "home" if s.home_away == "home" else "away"
                tid = int(s.team_id)
                base = info.get(tid, {"name": s.team_name, "score": None, "fbs": False})
                q = [int(v) for v in lines.get((gid, tid), []) if not math.isnan(v)]
                sides[side] = {"id": tid, **base, "lines": q}
            if set(sides) != {"home", "away"}:
                missing.append(gid)
                continue
            if any(sum(sides[k]["lines"]) != sides[k]["score"] or len(sides[k]["lines"]) < 4 for k in sides):
                no_lines += 1
                for k in sides:
                    sides[k]["lines"] = []
            by_side = {("home" if s.home_away == "home" else "away"): s._asdict() for s in t.itertuples()}
            team_stats = [[label, cell(by_side["away"].get(f)), cell(by_side["home"].get(f))] for label, f in TEAM_STATS]

            players = {}
            p = pb_by.get(gid)
            if p is not None:
                for cat, (cols, sort_field) in PLAYER_CATS.items():
                    c = p[p.category == cat]
                    if c.empty:
                        continue
                    block = {"cols": [lab for lab, _ in cols], "away": [], "home": []}
                    for side in ("away", "home"):
                        mine = c[c.team_id == sides[side]["id"]]
                        rows_out = [[r["athlete_name"], *[cell(r.get(f)) for _, f in cols]] for r in mine.to_dict("records")]
                        idx = 1 + [f for _, f in cols].index(sort_field)
                        rows_out.sort(key=lambda x: sort_num(x[idx]), reverse=True)
                        block[side] = rows_out
                    players[cat] = block

            out = {
                "game_id": gid, "season": season, "date": first["date"], "week": first["week"],
                "season_type": first.get("season_type", "Regular"), "note": first.get("note"),
                "venue": first.get("venue"), "neutral": neutral,
                "away": sides["away"], "home": sides["home"], "team_stats": team_stats, "players": players,
            }
            (OUT / f"{gid}.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
            written += 1
    print(f"Wrote {written} box scores to {OUT}; {no_lines} without usable quarter scores; {len(missing)} games with no team box score")
    if missing:
        warn(f"no team box score for {len(missing)} games, e.g. {missing[:5]}")


if __name__ == "__main__":
    main()
