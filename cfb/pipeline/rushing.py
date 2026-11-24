"""Rushing splits from play-by-play: how far runs get, short yardage, and quarterback runs.

A run here is a play the feed flags as a rush with a ball carrier. Not counted: sacks (the feed types them
separately; college box scores fold them into rushing), kneel-downs, snaps that got away and were charged to
the team, and plays wiped out by a penalty. A stat correction sometimes enters a play twice (same sequence
number, down, distance and spot); the last entry is kept.

What the feed lacks: the kind of run. There is no label for zone, power, counter, draw, option or sweep, and a
quarterback scramble is written exactly like a designed quarterback run. The text does say left, middle or
right, but that mostly reflects the home stat crew, not the offense: the share of runs marked "middle" ranges
from 35% to 90% by stadium, a team's home and away shares correlate only 0.43, and visitors' shares in a
stadium track the home team's (0.61). Direction is therefore not used.

What is measured instead (the standard college rushing measures):
- Success: the run gained 50% of the yards to go on first down, 70% on second, all of them on third or
  fourth, or scored.
- Stuff: a run for no gain or a loss. Opportunity: a run of 4 or more yards. Explosive: 10 or more.
- Line yards: the part of a run credited to the blocking. Losses count 120%, yards 0-4 in full, yards 5-10 at
  half, nothing beyond 10. Highlight yards are the rest of a run that gained 4 or more (half of yards 5-10,
  everything past 10), shown per opportunity: what the runner added once the blocking did its job.
- Short yardage: runs on third or fourth down with 2 or fewer yards to go, or on first or second down with
  goal to go from the 2 or closer; converted if the run gained the yards to go or scored.
- Quarterback runs: runs by a player with at least QB_MIN_PASS_ATT pass attempts on the season. Scrambles and
  designed runs together; sacks are not in them.
"""
from pathlib import Path

import numpy as np
import pandas as pd

PBP_COLUMNS = [
    "game_id", "game_play_number", "sequenceNumber", "period.number", "start.down", "start.distance", "start.yardsToEndzone",
    "pos_team_id", "def_pos_team_id", "type.text", "text", "rush", "pass", "kneel_down", "penalty_no_play",
    "yds_rushed", "rush_td", "EPA", "rusher_player_id", "rusher_player_name",
]
QB_MIN_PASS_ATT = 10                  # season pass attempts that make a ball carrier a quarterback
MIN_CARRIES_PER_TEAM_GAME = 8         # a rusher is listed with this many carries per game his team has played
SUMS = ["att", "yds", "epa", "succ", "stuff", "opp", "expl", "line_yds", "hilite_yds", "short_att", "short_conv"]
CACHE_COLUMNS = ["game_id", "off_id", "def_id", "rusher_id", "rusher", *SUMS]


def build_rushing(pbp_path):
    """Return (per-game sums, notes): one row per game, offense, defense and ball carrier."""
    d = pd.read_parquet(pbp_path, columns=PBP_COLUMNS).sort_values(["game_id", "game_play_number"])
    same_play = ["game_id", "sequenceNumber", "period.number", "start.down", "start.distance", "start.yardsToEndzone", "pos_team_id", "type.text"]
    is_run = (d["rush"] == 1) & (d["pass"] != 1) & (d.penalty_no_play != True)  # noqa: E712
    repeated = d.duplicated(same_play, keep="last")
    r = d[is_run & ~repeated]
    kneel = r.kneel_down == True  # noqa: E712
    # a snap that got away is charged to the team: the feed has no player id for it and the text names the team
    # ("Baylor rush middle for 14 yards loss") where a run names a numbered player ("#4 A.Ison rush middle")
    rid = pd.to_numeric(r.rusher_player_id, errors="coerce")
    names_runner = r.text.fillna("").str.contains(r"#\d+ ?\S[^#]{0,30}? rush", regex=True)
    team = ~kneel & (rid.isna() | (rid < 0)) & ~names_runner
    notes = {"repeated_plays_dropped": int((is_run & repeated).sum()), "kneel_downs_left_out": int(kneel.sum()), "team_rushes_left_out": int(team.sum())}
    r = r[~kneel & ~team]
    notes.update(games=int(r.game_id.nunique()), runs=int(len(r)))

    y, down, dist = r.yds_rushed.astype(float), r["start.down"], r["start.distance"]
    scored = r.rush_td == True  # noqa: E712
    needed = np.where(down == 1, 0.5 * dist, np.where(down == 2, 0.7 * dist, dist))
    line = np.where(y < 0, 1.2 * y, np.where(y <= 4, y, np.where(y <= 10, 4 + 0.5 * (y - 4), 7.0)))
    short = ((down >= 3) & (dist <= 2)) | ((down <= 2) & (dist <= 2) & (r["start.yardsToEndzone"] <= 2))
    out = pd.DataFrame({
        "game_id": r.game_id.astype(int), "off_id": r.pos_team_id.astype(int), "def_id": r.def_pos_team_id.astype(int),
        "rusher_id": pd.to_numeric(r.rusher_player_id, errors="coerce").fillna(-1).clip(lower=-1).astype(int), "rusher": r.rusher_player_name.fillna(""),
        "att": 1, "yds": y, "epa": r.EPA.astype(float),
        "succ": ((y >= needed) | scored).astype(int), "stuff": (y <= 0).astype(int), "opp": (y >= 4).astype(int), "expl": (y >= 10).astype(int),
        "line_yds": line, "hilite_yds": np.where(y >= 4, y - line, 0.0),
        "short_att": short.astype(int), "short_conv": (short & ((y >= dist) | scored)).astype(int),
    })
    # one spelling per ball carrier (the feed mixes full names with "J.Smith" on plays it could not match)
    spelling = out[out.rusher_id >= 0].groupby("rusher_id").rusher.agg(lambda s: s.value_counts().index[0])
    out["rusher"] = out.rusher_id.map(spelling).fillna(out.rusher)
    sums = out.groupby(["game_id", "off_id", "def_id", "rusher_id", "rusher"], as_index=False).sum()
    sums["yds"] = sums.yds.round().astype(int)
    for c in ("epa", "line_yds", "hilite_yds"):
        sums[c] = sums[c].round(4)
    return sums[CACHE_COLUMNS], notes


def _core(t):
    """Stat columns from one row of summed counts."""
    n = int(t.att)
    return {
        "att": n, "ypc": round(t.yds / n, 2), "epa": round(t.epa / n, 3), "succ_pct": round(t.succ / n, 4),
        "stuff_pct": round(t.stuff / n, 4), "opp_pct": round(t.opp / n, 4), "expl_pct": round(t.expl / n, 4),
        "line_ypc": round(t.line_yds / n, 2), "hilite_ypo": round(t.hilite_yds / t.opp, 2) if t.opp else None,
        "short_att": int(t.short_att), "short_conv_pct": round(t.short_conv / t.short_att, 4) if t.short_att else None,
    }


def _team(g, qb_ids):
    """A team's row: every run, plus the quarterback / everyone-else split."""
    row = _core(g[SUMS].sum())
    is_qb = g.rusher_id.isin(qb_ids)
    for key, part in (("back", g[~is_qb]), ("qb", g[is_qb])):
        t = part[SUMS].sum()
        n = int(t.att)
        row[f"{key}_att"] = n
        row[f"{key}_ypc"] = round(t.yds / n, 2) if n else None
        row[f"{key}_epa"] = round(t.epa / n, 3) if n else None
    row["qb_share"] = round(row["qb_att"] / row["att"], 4)
    return row


def rushing_tables(sums, fbs, name, qb_ids):
    """Offense, defense and ball-carrier tables from the cached sums, plus the all-games numbers for meta.json.

    fbs: ids of the FBS teams; name: team id -> team name; qb_ids: athlete ids counted as quarterbacks.
    """
    offense = pd.DataFrame([{"team_id": t, "team": name[t], **_team(g, qb_ids)} for t, g in sums[sums.off_id.isin(fbs)].groupby("off_id")])
    defense = pd.DataFrame([{"team_id": t, "team": name[t], **_team(g, qb_ids)} for t, g in sums[sums.def_id.isin(fbs)].groupby("def_id")])
    team_games = sums.groupby("off_id").game_id.nunique()
    rows = []
    for pid, g in sums[sums.off_id.isin(fbs) & (sums.rusher_id >= 0)].groupby("rusher_id"):
        team = int(g.groupby("off_id").att.sum().idxmax())
        if g.att.sum() < MIN_CARRIES_PER_TEAM_GAME * team_games[team]:
            continue
        rows.append({"athlete_id": int(pid), "player": g.rusher.iloc[0], "team_id": team, "team": name[team],
                     "is_qb": int(pid) in qb_ids, **_core(g[SUMS].sum())})
    players = pd.DataFrame(rows).sort_values("att", ascending=False).reset_index(drop=True)

    for t in (offense, defense):
        assert (t.back_att + t.qb_att == t.att).all()
    everything = _team(sums, qb_ids)
    overall = {k: everything[k] for k in ("att", "ypc", "epa", "succ_pct", "stuff_pct", "opp_pct", "expl_pct", "line_ypc", "hilite_ypo",
                                          "short_att", "short_conv_pct", "qb_share", "qb_ypc", "qb_epa", "back_ypc", "back_epa")}
    return offense, defense, players, overall


def box_check(sums, player_box_path, qb_ids, fbs):
    """Compare non-quarterbacks' carries with the box scores (their lines hold no sacks or kneel-downs).

    Returns None when the box file is not there.
    """
    if not Path(player_box_path).exists():
        return None
    box = pd.read_parquet(player_box_path, columns=["category", "athlete_id", "team_id", "game_id", "rushingAttempts", "rushingYards"])
    box = box[box.category == "rushing"]
    box = pd.DataFrame({"game_id": box.game_id.astype(int), "team_id": box.team_id.astype(int), "aid": box.athlete_id.astype("int64"),
                        "box_att": pd.to_numeric(box.rushingAttempts), "box_yds": pd.to_numeric(box.rushingYards)})
    box = box[(box.aid > 0) & ~box.aid.isin(qb_ids) & box.team_id.isin(fbs)]
    mine = sums[(sums.rusher_id >= 0) & ~sums.rusher_id.isin(qb_ids) & sums.off_id.isin(fbs)]
    mine = mine.groupby(["game_id", "rusher_id"])[["att", "yds"]].sum().reset_index().rename(columns={"rusher_id": "aid"})
    m = box.merge(mine, on=["game_id", "aid"], how="outer").fillna(0)
    season = m.groupby("aid")[["att", "box_att"]].sum()
    regulars = season[season.box_att >= 80]
    return {
        "player_games_compared": int(len(m)),
        "player_games_within_one_carry": round(float(((m.att - m.box_att).abs() <= 1).mean()), 4),
        "carries": int(m.att.sum()), "carries_box": int(m.box_att.sum()),
        "yards": int(m.yds.sum()), "yards_box": int(m.box_yds.sum()),
        "largest_season_gap_pct_80_carries": round(float(((regulars.att - regulars.box_att).abs() / regulars.box_att).max()) * 100, 2),
    }
