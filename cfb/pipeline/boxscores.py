#!/usr/bin/env python3
"""Box scores and player pages for the site.

    bash pipeline/fetch_box.sh      # ESPN team/player box scores and quarter scores into data/raw/box
    python pipeline/boxscores.py    # after build.py and history.py

Writes data/box/<game_id % 2000>.json ({game_id: box score}) for every game in data/json/games.json (2026) and data/history/games.json
(2020-2025), and data/players/<shard>.json with every player's season totals and game logs (shard = athlete id
mod 1000, so a player page loads one ~100 KB file instead of ~70,000 separate files). Box score:

    {game_id, season, date, week, season_type, note, venue, neutral,
     away: {id, name, score, fbs, lines: [q1, q2, ...]}, home: {...},
     team_stats: [[label, away value, home value], ...],
     players: {category: {cols: [labels], away: [[name, athlete id, v...], ...], home: [...]}}}

Player shard: {athlete id: {name, seasons: [{season, team_id, team, games: [[game_id, date, week, site, opp_id,
opp, opp_fbs, result, score], ...], cats: {category: {rows: [[game_id, v...], ...], total: [v...]}}}]}}.
Team-total rows (negative athlete ids) are kept in box scores but get no player page.

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
PLAYERS = ROOT / "data" / "players"
SHARDS = 1000
BOX_SHARDS = 2000  # box scores are grouped too: data/box/<game_id % 2000>.json, ~35 KB each
SEASONS = range(2004, 2027)

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


# How each column adds up over a season, aligned with PLAYER_CATS columns:
# "sum", "max", "frac" (a/b added part by part), ("ratio", num col, den col), ("ratio_frac", num col, frac col),
# ("pct", frac col) and None (not totalled, e.g. QBR).
TOTALS = {
    "passing": ["frac", "sum", ("ratio_frac", 1, 0), "sum", "sum", None],
    "rushing": ["sum", "sum", ("ratio", 1, 0), "sum", "max"],
    "receiving": ["sum", "sum", ("ratio", 1, 0), "sum", "max"],
    "fumbles": ["sum", "sum", "sum"],
    "defensive": ["sum"] * 7,
    "interceptions": ["sum", "sum", "sum"],
    "kickReturns": ["sum", "sum", ("ratio", 1, 0), "max", "sum"],
    "puntReturns": ["sum", "sum", ("ratio", 1, 0), "max", "sum"],
    "kicking": ["frac", ("pct", 0), "max", "frac", "sum"],
    "punting": ["sum", "sum", ("ratio", 1, 0), "sum", "sum", "max"],
}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fmt(x, digits=None):
    if x is None:
        return ""
    if digits is not None:
        return f"{x:.{digits}f}"
    return str(int(x)) if float(x).is_integer() else f"{x:g}"


def season_total(cat, rows):
    """One totals row for a category from per-game value lists."""
    out = []
    for i, kind in enumerate(TOTALS[cat]):
        col = [r[i] for r in rows]
        if kind == "sum":
            vals = [num(v) for v in col if num(v) is not None]
            out.append(fmt(sum(vals)) if vals else "")
        elif kind == "max":
            vals = [num(v) for v in col if num(v) is not None]
            out.append(fmt(max(vals)) if vals else "")
        elif kind == "frac":
            parts = [str(v).split("/") for v in col if "/" in str(v)]
            out.append(f"{sum(int(a) for a, _ in parts)}/{sum(int(b) for _, b in parts)}" if parts else "")
        else:
            out.append(None)  # derived below, once the sums exist
    for i, kind in enumerate(TOTALS[cat]):
        if isinstance(kind, tuple):
            if kind[0] == "ratio":
                n, d = num(out[kind[1]]), num(out[kind[2]])
                out[i] = fmt(n / d, 1) if n is not None and d else ""
            elif kind[0] == "ratio_frac":
                n, d = num(out[kind[1]]), num(out[kind[2]].split("/")[1]) if out[kind[2]] else None
                out[i] = fmt(n / d, 1) if n is not None and d else ""
            elif kind[0] == "pct":
                a, b = (num(x) for x in out[kind[1]].split("/")) if out[kind[1]] else (None, None)
                out[i] = fmt(100 * a / b, 1) if b else ""
        elif kind is None:
            out[i] = ""
    return out


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
    for d in (OUT, PLAYERS):
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.json"):
            old.unlink()
    box_shards = {}
    players = {}  # athlete id -> {"name", "seasons": {season: {"teams": {}, "games": {}, "cats": {}}}}
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
        lines = {k: g.sort_values("period")["value"].tolist() for k, g in ls.groupby(["game_id", "team_id"])}
        # player rows grouped in plain Python: game -> category -> team -> [row dicts]
        pgroups = {}
        for r in pb.to_dict("records"):
            pgroups.setdefault(r["game_id"], {}).setdefault(r["category"], {}).setdefault(r["team_id"], []).append(r)

        for gid in [g for g, rs in games.items() if rs[0]["season"] == season]:
            rs = games[gid]
            t = tb_by.get(gid)
            if t is None or len(t) != 2:
                missing.append(gid)
                continue
            first = rs[0]
            neutral = first["site"] == "Neutral"
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

            # each side's view of the game, for player game logs
            view = {}
            for side, other in (("away", "home"), ("home", "away")):
                me, op = sides[side], sides[other]
                won = (me["score"] or 0) > (op["score"] or 0)
                site = "n" if neutral else ("vs" if side == "home" else "@")
                week = "P" if first.get("season_type") == "Postseason" else first["week"]
                view[side] = [gid, first["date"], week, site, op["id"], op["name"], op["fbs"], "W" if won else "L", f"{me['score']}-{op['score']}"]

            out_players = {}
            g = pgroups.get(gid, {})
            for cat, (cols, sort_field) in PLAYER_CATS.items():
                if cat not in g:
                    continue
                block = {"cols": [lab for lab, _ in cols], "away": [], "home": []}
                idx = 2 + [f for _, f in cols].index(sort_field)
                for side in ("away", "home"):
                    tid = sides[side]["id"]
                    for r in g[cat].get(tid, []):
                        aid = int(r["athlete_id"])
                        vals = [cell(r.get(f)) for _, f in cols]
                        block[side].append([r["athlete_name"], aid if aid > 0 else None, *vals])
                        if aid > 0:
                            p = players.setdefault(aid, {"name": r["athlete_name"], "seasons": {}})
                            p["name"] = r["athlete_name"]
                            ps = p["seasons"].setdefault(season, {"teams": {}, "games": {}, "cats": {}})
                            ps["teams"][tid] = ps["teams"].get(tid, 0) + 1
                            ps["games"][gid] = view[side]
                            ps["cats"].setdefault(cat, []).append([gid, *vals])
                    block[side].sort(key=lambda x: sort_num(x[idx]), reverse=True)
                out_players[cat] = block

            out = {
                "game_id": gid, "season": season, "date": first["date"], "week": first["week"],
                "season_type": first.get("season_type", "Regular"), "note": first.get("note"),
                "venue": first.get("venue"), "neutral": neutral,
                "away": sides["away"], "home": sides["home"], "team_stats": team_stats, "players": out_players,
            }
            box_shards.setdefault(gid % BOX_SHARDS, {})[str(gid)] = out
            written += 1
    for k, data in box_shards.items():
        (OUT / f"{k}.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote {written} box scores in {len(box_shards)} files to {OUT}; {no_lines} without usable quarter scores; {len(missing)} games with no team box score")
    if missing:
        warn(f"no team box score for {len(missing)} games, e.g. {missing[:5]}")

    # ------------------------------------------------------------ player shards
    team_names = {}
    for rs in games.values():
        for r in rs:
            team_names[r["team_id"]] = r["team"]
            team_names.setdefault(r["opp_id"], r["opp"])
    shards = {}
    for aid, p in players.items():
        seasons = []
        for season in sorted(p["seasons"]):
            ps = p["seasons"][season]
            tid = max(ps["teams"], key=ps["teams"].get)
            glist = sorted(ps["games"].values(), key=lambda v: v[1])
            order = {v[0]: k for k, v in enumerate(glist)}
            cats = {}
            for cat, rows in ps["cats"].items():
                rows.sort(key=lambda r: order[r[0]])
                cats[cat] = {"rows": rows, "total": season_total(cat, [r[1:] for r in rows])}
            seasons.append({"season": season, "team_id": tid, "team": team_names.get(tid, str(tid)), "games": glist, "cats": cats})
        shards.setdefault(aid % SHARDS, {})[str(aid)] = {"name": p["name"], "seasons": seasons}
    for k, data in shards.items():
        (PLAYERS / f"{k}.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    (PLAYERS / "meta.json").write_text(json.dumps({"shards": SHARDS, "cols": {c: [lab for lab, _ in cols] for c, (cols, _) in PLAYER_CATS.items()}}))
    print(f"Wrote {len(players)} players in {len(shards)} shards to {PLAYERS}")


if __name__ == "__main__":
    main()
