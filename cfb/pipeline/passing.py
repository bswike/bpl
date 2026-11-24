"""Passing by throw depth, from play-by-play.

Since late October 2025 ESPN's play text is the official stat-crew wording, which says where each pass was
caught or aimed. That gives air yards: how far past the line of scrimmage the ball travelled. This module
turns the play-by-play file into pass attempts with a depth and adds them up by offense, defense and passer.

Pass attempts: plays the feed flags as an attempt, minus intentional grounding (the feed types it as a sack,
as official scoring does) and minus plays wiped out by a penalty. Season totals land within about 0.2% of the
box scores; single games can be off by one where a penalty leaves the play standing.

Depth of a throw:
- Completions and incompletions use the feed's `air_yards` (spot caught or thrown to, minus the line of scrimmage).
- Interceptions carry no target spot, only where the ball was picked off; that spot stands in for the target.
  The text names the spot with a stat-crew abbreviation ("SAM48"), so each game's abbreviations are matched to
  teams from the plays whose spot the feed already resolved.
- About one touchdown pass in nine keeps ESPN's scoring-summary sentence and has no spot. Those, spikes and the
  odd game still in ESPN's old wording have no depth: they count in the totals but not in the depth buckets.

The feed has no label for screens, shovel passes, scrambles, play action or routes. "At or behind the line" is
exactly that: it holds screens, swing passes and checkdowns together.

A stat correction sometimes enters a play twice (same sequence number, down, distance and spot); the last entry
is kept.
"""
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

PBP_COLUMNS = [
    "game_id", "game_play_number", "sequenceNumber", "period.number", "start.down", "start.distance", "start.yardsToEndzone",
    "pos_team_id", "def_pos_team_id", "type.text", "text", "pass_attempt", "completion", "int", "penalty_no_play",
    "yds_receiving", "air_yards", "air_yardsToEndzone", "EPA", "passer_player_id", "passer_player_name",
]

# Fine depth bins by air yards (upper edges, inclusive). The expected-completion baseline is the FBS completion rate
# in each of these; the four buckets shown on the site are pairs of them.
BIN_EDGES = [-5, 0, 4, 9, 14, 19, 29]           # bins: <=-5, -4..0, 1..4, 5..9, 10..14, 15..19, 20..29, 30+
BUCKETS = [("behind", (0, 1)), ("short", (2, 3)), ("mid", (4, 5)), ("deep", (6, 7))]
BUCKET_LABELS = {"behind": "at or behind the line of scrimmage", "short": "1-9 air yards", "mid": "10-19 air yards", "deep": "20+ air yards"}
AIR_RANGE = (-20, 75)                           # a spot outside this is a feed error; the throw gets no depth
MIN_ATT_PER_TEAM_GAME = 12                      # a passer is listed with this many attempts per game his team has played

CACHE_COLUMNS = ["game_id", "off_id", "def_id", "passer_id", "passer", "bin", "att", "cmp", "yds", "air", "cmp_air", "epa", "ints"]

_SPOT = re.compile(r"(?:caught at|thrown to)\s+`?([A-Za-z&'.\- ]*?[A-Za-z])\s?(\d{1,2})\b")
_PICK = re.compile(r"intercepted by .*? at\s+`?([A-Za-z&'.\- ]*?[A-Za-z])\s?(\d{1,2})\b")


def _abbreviation_owners(plays):
    """{(game_id, abbreviation): team whose side of the field it names}, learned from plays with a resolved spot."""
    votes = defaultdict(Counter)
    known = plays[plays.air_yardsToEndzone.notna()]
    for gid, text, off, de, yte in zip(known.game_id, known.text, known.pos_team_id, known.def_pos_team_id, known.air_yardsToEndzone):
        m = _SPOT.search(text or "")
        if not m:
            continue
        n = int(m.group(2))
        if n == 50:
            continue
        key = (gid, m.group(1).strip().upper())
        if yte == n:            # n yards from the goal line the offense is attacking: the defense's side
            votes[key][de] += 1
        elif yte == 100 - n:    # the offense's own side
            votes[key][off] += 1
    return {k: v.most_common(1)[0][0] for k, v in votes.items()}


def build_passing(pbp_path):
    """Return (per-game sums, notes).

    One row per game, offense, defense, passer and depth bin (bin -1 = no depth), with attempts, completions,
    yards, air yards, air yards on completions, EPA and interceptions. Everything the tables need adds up from
    these rows, so they are cached in data/derived and the build runs without the play-by-play file.
    """
    d = pd.read_parquet(pbp_path, columns=PBP_COLUMNS).sort_values(["game_id", "game_play_number"])
    same_play = ["game_id", "sequenceNumber", "period.number", "start.down", "start.distance", "start.yardsToEndzone", "pos_team_id", "type.text"]
    is_pass = (d.pass_attempt == 1) & (d["type.text"] != "Sack") & (d.penalty_no_play != True)  # noqa: E712
    repeated = d.duplicated(same_play, keep="last")
    p = d[is_pass & ~repeated].copy()
    notes = {"games": int(p.game_id.nunique()), "attempts": int(len(p)), "repeated_plays_dropped": int((is_pass & repeated).sum())}

    # ---- depth: the feed's air yards, else the interception spot
    air = p.air_yards.astype(float)
    owners = _abbreviation_owners(p)
    picks = p[(p["int"] == 1) & air.isna()]
    placed = {}
    for idx, gid, text, off, de, los in zip(picks.index, picks.game_id, picks.text, picks.pos_team_id, picks.def_pos_team_id, picks["start.yardsToEndzone"]):
        m = _PICK.search(text or "")
        if not m or pd.isna(los):
            continue
        n = int(m.group(2))
        who = owners.get((gid, m.group(1).strip().upper()))
        if n == 50:
            yte = 50
        elif who == de:
            yte = n
        elif who == off:
            yte = 100 - n
        else:
            continue
        placed[idx] = float(los) - yte
    air = air.where(air.notna(), pd.Series(placed, dtype=float).reindex(p.index))
    air = air.where((air >= AIR_RANGE[0]) & (air <= AIR_RANGE[1]))
    notes.update(interceptions=int((p["int"] == 1).sum()), interceptions_placed=len(placed), attempts_with_depth=int(air.notna().sum()))

    cmp_ = (p.completion == 1).astype(int)
    out = pd.DataFrame({
        "game_id": p.game_id.astype(int), "off_id": p.pos_team_id.astype(int), "def_id": p.def_pos_team_id.astype(int),
        "passer_id": pd.to_numeric(p.passer_player_id, errors="coerce").fillna(-1).astype(int),
        "passer": p.passer_player_name.fillna(""),
        "bin": np.where(air.notna(), np.searchsorted(BIN_EDGES, air.fillna(0), side="left"), -1),
        "att": 1, "cmp": cmp_, "yds": p.yds_receiving.fillna(0).where(cmp_ == 1, 0),
        "air": air.fillna(0), "cmp_air": air.fillna(0).where(cmp_ == 1, 0),
        "epa": p.EPA.astype(float), "ints": (p["int"] == 1).astype(int),
    })
    # one spelling per passer: the feed mixes "Malik Washington" with "M.Washington" on plays it could not match
    spelling = out[out.passer_id >= 0].groupby("passer_id").passer.agg(lambda s: s.value_counts().index[0])
    out["passer"] = out.passer_id.map(spelling).fillna("")
    sums = out.groupby(["game_id", "off_id", "def_id", "passer_id", "passer", "bin"], as_index=False).sum()
    for c in ("yds", "air", "cmp_air"):
        sums[c] = sums[c].round().astype(int)
    sums["epa"] = sums.epa.round(4)
    return sums[CACHE_COLUMNS], notes


def _stats(g, rate):
    """Stat columns for one group of cache rows (a team's offense, a team's defense or a passer)."""
    by = g.groupby("bin")[["att", "cmp", "yds", "air", "cmp_air", "epa"]].sum()
    known = by[by.index >= 0]
    att, d_att = int(by.att.sum()), int(known.att.sum())
    row = {
        "att": att, "cmp_pct": round(by.cmp.sum() / att, 4), "ypa": round(by.yds.sum() / att, 2), "epa": round(by.epa.sum() / att, 3),
        "ints": int(g.ints.sum()), "depth_att": d_att,
        "adot": None, "air_share": None, "yac": None, "cmp_oe": None,
    }
    if d_att:
        expected = sum(n * rate[b] for b, n in known.att.items())
        row["adot"] = round(known.air.sum() / d_att, 2)
        row["cmp_oe"] = round((known.cmp.sum() - expected) / d_att, 4)
        if known.yds.sum() > 0:
            row["air_share"] = round(known.cmp_air.sum() / known.yds.sum(), 4)
        if known.cmp.sum():
            row["yac"] = round((known.yds.sum() - known.cmp_air.sum()) / known.cmp.sum(), 2)
    for name, bins in BUCKETS:
        b = known[known.index.isin(bins)]
        n = int(b.att.sum())
        row[f"{name}_att"] = n
        row[f"{name}_share"] = round(n / d_att, 4) if d_att else None
        row[f"{name}_cmp_pct"] = round(b.cmp.sum() / n, 4) if n else None
        row[f"{name}_epa"] = round(b.epa.sum() / n, 3) if n else None
    return row


def passing_tables(sums, fbs, name):
    """Offense, defense and passer tables from the cached sums, plus the all-games numbers for meta.json.

    fbs: ids of the FBS teams; name: team id -> team name. The completion baseline uses every pass in the file,
    FCS opponents' included, because those throws count for the FBS defenses that faced them.
    """
    league = sums[sums.bin >= 0].groupby("bin")[["att", "cmp"]].sum()
    rate = (league.cmp / league.att).to_dict()

    offense = pd.DataFrame([{"team_id": t, "team": name[t], **_stats(g, rate)} for t, g in sums[sums.off_id.isin(fbs)].groupby("off_id")])
    defense = pd.DataFrame([{"team_id": t, "team": name[t], **_stats(g, rate)} for t, g in sums[sums.def_id.isin(fbs)].groupby("def_id")])
    team_games = sums.groupby("off_id").game_id.nunique()
    rows = []
    for pid, g in sums[sums.off_id.isin(fbs) & (sums.passer_id >= 0)].groupby("passer_id"):
        team = int(g.groupby("off_id").att.sum().idxmax())
        if g.att.sum() < MIN_ATT_PER_TEAM_GAME * team_games[team]:
            continue
        rows.append({"athlete_id": int(pid), "player": g.passer.iloc[0], "team_id": team, "team": name[team], **_stats(g, rate)})
    players = pd.DataFrame(rows).sort_values("att", ascending=False).reset_index(drop=True)

    for t in (offense, defense, players):
        assert (t.depth_att <= t.att).all()
        assert ((t[[f"{b}_att" for b, _ in BUCKETS]].sum(axis=1)) == t.depth_att).all()
    everything = _stats(sums, rate)
    overall = {
        "attempts": everything["att"], "with_depth_pct": round(everything["depth_att"] / everything["att"], 4),
        "adot": everything["adot"], "air_share": everything["air_share"], "yac": everything["yac"],
        "buckets": {b: {"label": BUCKET_LABELS[b], "share": everything[f"{b}_share"], "cmp_pct": everything[f"{b}_cmp_pct"], "epa": everything[f"{b}_epa"]}
                    for b, _ in BUCKETS},
    }
    return offense, defense, players, overall


def box_check(sums, team_box_path, fbs):
    """Compare FBS teams' pass attempts with the box scores. Returns None when the box file is not there."""
    if not Path(team_box_path).exists():
        return None
    box = pd.read_parquet(team_box_path, columns=["team_id", "game_id", "completionAttempts"])
    box["box_att"] = box.completionAttempts.str.split("/").str[1].astype(int)
    box = box.assign(team_id=box.team_id.astype(int), game_id=box.game_id.astype(int))
    box = box[box.team_id.isin(fbs)]
    mine = sums.groupby(["game_id", "off_id"]).att.sum().rename("att").reset_index().rename(columns={"off_id": "team_id"})
    m = box.merge(mine, on=["game_id", "team_id"], how="inner")
    season = m.groupby("team_id")[["att", "box_att"]].sum()
    gap = (season.att - season.box_att).abs() / season.box_att
    return {
        "team_games_compared": int(len(m)),
        "team_games_within_one_attempt": round(float(((m.att - m.box_att).abs() <= 1).mean()), 4),
        "season_attempts": int(m.att.sum()), "season_attempts_box": int(m.box_att.sum()),
        "largest_team_season_gap_pct": round(float(gap.max()) * 100, 2),
    }
