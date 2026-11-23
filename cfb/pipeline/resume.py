#!/usr/bin/env python3
"""Per-game inputs for the site's Resume Builder (current season).

    python pipeline/resume.py      # after build.py; needs data/raw/box/player_box_2026.parquet (fetch_box.sh 2026)

Writes data/json/resume.json:

    {season, ap_released, teams: [{id, team, conf, w, l, pct, ap, cfp, tal, srs, games: [[opp_id, opp, result, margin, site,
     opp_ap_then, opp_qb_out, own_qb_out], ...]}]}

opp_ap_then is the opponent's AP rank going into the game. opp_qb_out is 1 when the opponent's usual starting QB did
not lead it in pass attempts that game, own_qb_out the same for the row's team: a team's starter is the passer who led in attempts in the most of its games.
That is an approximation (a mid-season change of starter makes the earlier games count as "starter out"). FCS
opponents have no starter data and get 0.
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SEASON = 2026


def main():
    teams = json.loads((ROOT / "data" / "json" / "team_summary.json").read_text())
    games = json.loads((ROOT / "data" / "json" / "games.json").read_text())
    meta = json.loads((ROOT / "data" / "json" / "meta.json").read_text())
    fbs = {t["team_id"] for t in teams}

    # starting QB per FBS team, and who led each game in pass attempts
    pb = pd.read_parquet(ROOT / "data" / "raw" / "box" / f"player_box_{SEASON}.parquet")
    p = pb[(pb.category == "passing") & (pb.athlete_id > 0)].copy()
    p["att"] = pd.to_numeric(p["completions/passingAttempts"].astype(str).str.split("/").str[1], errors="coerce")
    lead = p.sort_values("att", ascending=False).groupby(["game_id", "team_id"]).head(1)
    starts = lead.groupby(["team_id", "athlete_id"]).size().reset_index(name="n")
    starts = starts.sort_values(["team_id", "n"], ascending=[True, False]).groupby("team_id").head(1)
    starter = {int(t): int(a) for t, a in zip(starts.team_id, starts.athlete_id)}
    led_by = {(int(g), int(t)): int(a) for g, t, a in zip(lead.game_id, lead.team_id, lead.athlete_id)}

    # each team's AP rank going into each game, to look up the opponent's
    rank_in = {(g["game_id"], g["team_id"]): g["ap_rank_in"] for g in games}

    by_team = {}
    for g in games:
        opp = g["opp_id"]
        def qb_out(team):
            if team in fbs and team in starter and (g["game_id"], team) in led_by:
                return int(led_by[(g["game_id"], team)] != starter[team])
            return 0
        by_team.setdefault(g["team_id"], []).append(
            [opp, g["opp"], g["result"], g["margin"], g["site"][0], rank_in.get((g["game_id"], opp)), qb_out(opp), qb_out(g["team_id"])])

    out = {"season": SEASON, "ap_released": meta["ap_poll"]["released"], "cfp_released": meta["cfp"]["released"],
           "games_through": meta["games_through"], "teams": []}
    for t in teams:
        out["teams"].append({
            "id": t["team_id"], "team": t["team"], "conf": t["conference"], "w": t["wins"], "l": t["losses"],
            "pct": t["win_pct"], "ap": t["ap_rank"], "cfp": t["cfp_rank"], "tal": t["talent_rank"], "srs": t["srs"], "games": by_team.get(t["team_id"], []),
        })
    (ROOT / "data" / "json" / "resume.json").write_text(json.dumps(out, separators=(",", ":")))
    n_out = sum(g[6] for t in out["teams"] for g in t["games"])
    print(f"resume.json: {len(out['teams'])} teams; {n_out} team-games against an opponent without its usual starting QB")


if __name__ == "__main__":
    main()
