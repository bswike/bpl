#!/usr/bin/env python3
"""Per-game inputs for the site's Resume Builder (current season).

    python pipeline/resume.py      # after build.py; needs data/raw/box/player_box_2026.parquet (fetch_box.sh 2026)

Writes data/json/resume.json:

    {season, ap_released, cfp_released, games_through, fpi_as_of, fpi_source, teams: [{id, team, conf, w, l, pct, ap, cfp, tal, srs, fpi, fpi_rank, sor, sos, games: [[opp_id, opp, result, margin, site,
     opp_ap_then, opp_qb_out, own_qb_out], ...]}]}

opp_ap_then is the opponent's AP rank going into the game. opp_qb_out is 1 when the opponent's usual starting QB did
not lead it in pass attempts that game, own_qb_out the same for the row's team: a team's starter is the passer who led in attempts in the most of its games.
That is an approximation (a mid-season change of starter makes the earlier games count as "starter out"). FCS
opponents have no starter data and get 0.

fpi / fpi_rank / sor / sos come from ESPN's Football Power Index: sor is ESPN's strength-of-record rank
("accomplishment"), sos its strength-of-schedule rank (games played). Two copies are fetched by fetch_raw.sh, the
weekly snapshot in cfbfastR-cfb-data (data/raw/cfb_fpi_weekly_<season>.parquet) and ESPN's own FPI page data
(data/raw/espn_fpi_<season>.json, refreshed daily); the newer one is used. fpi_as_of says when ESPN last updated it
and fpi_source which copy it was.
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

    # ESPN FPI, strength of record and strength of schedule: the newer of the weekly snapshot in cfbfastR-cfb-data and
    # ESPN's own FPI page data (both fetched by fetch_raw.sh; the page data is refreshed daily)
    sources = []  # (last updated, source label, {team id: numbers})
    weekly_path = ROOT / "data" / "raw" / f"cfb_fpi_weekly_{SEASON}.parquet"
    if weekly_path.exists():
        f = pd.read_parquet(weekly_path)
        f = f[(f.season_type == 2) & (f.week == f[f.season_type == 2].week.max())]
        sources.append((str(f.last_updated.max())[:16], "weekly snapshot (cfbfastR-cfb-data)", {
            int(r.team_id): {"fpi": round(float(r.fpi), 1), "fpi_rank": int(r.fpirank),
                             "sor": int(r.accomplishmentrank) or None, "sos": int(r.avgsosrank) or None} for r in f.itertuples()}))
    page_path = ROOT / "data" / "raw" / f"espn_fpi_{SEASON}.json"
    if page_path.exists():
        page = json.loads(page_path.read_text())
        if page.get("requestedSeason", {}).get("year") == SEASON:
            col = {c["name"]: {n: i for i, n in enumerate(c["names"])} for c in page["categories"]}
            rows = {}
            for t in page["teams"]:
                v = {c["name"]: c["values"] for c in t["categories"]}
                rows[int(t["team"]["id"])] = {
                    "fpi": round(float(v["fpi"][col["fpi"]["fpi"]]), 1), "fpi_rank": int(v["fpi"][col["fpi"]["fpirank"]]),
                    "sor": int(v["resume"][col["resume"]["accomplishmentrank"]]) or None, "sos": int(v["resume"][col["resume"]["avgsosrank"]]) or None}
            sources.append((page["lastUpdated"][:16], "ESPN FPI page", rows))
    fpi, fpi_as_of, fpi_source = {}, None, None
    if sources:
        updated, fpi_source, fpi = max(sources, key=lambda s: s[0])
        fpi_as_of = updated[:10]
        missing = sorted(t["team"] for t in teams if t["team_id"] not in fpi)
        assert not missing, f"{fpi_source} has no FPI numbers for {missing}"

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
           "games_through": meta["games_through"], "fpi_as_of": fpi_as_of, "fpi_source": fpi_source, "teams": []}
    for t in teams:
        out["teams"].append({
            "id": t["team_id"], "team": t["team"], "conf": t["conference"], "w": t["wins"], "l": t["losses"],
            "pct": t["win_pct"], "ap": t["ap_rank"], "cfp": t["cfp_rank"], "tal": t["talent_rank"], "srs": t["srs"],
            **fpi.get(t["team_id"], {"fpi": None, "fpi_rank": None, "sor": None, "sos": None}), "games": by_team.get(t["team_id"], []),
        })
    (ROOT / "data" / "json" / "resume.json").write_text(json.dumps(out, separators=(",", ":")))
    n_out = sum(g[6] for t in out["teams"] for g in t["games"])
    print(f"resume.json: {len(out['teams'])} teams; {n_out} team-games against an opponent without its usual starting QB")


if __name__ == "__main__":
    main()
