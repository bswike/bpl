"""Game control from play-by-play: time spent leading, average lead, garbage-time-free margin.

ESPN play feeds contain misordered plays and stale score fields, so each game's score
timeline is rebuilt quarter by quarter and anchored to the official quarter scores:

1. Plays are sorted by game clock within each quarter.
2. Each play's posted score is clipped to the official score range for that quarter.
3. A robust non-decreasing fit (L1 isotonic regression) removes remaining outliers.
4. Any points the plays never showed are credited at the end of the quarter.

Only regulation time is measured. Overtime has no clock, so it affects final and
garbage-time-free margins but not the time-based numbers.
"""
import re

import numpy as np
import pandas as pd

PBP_COLUMNS = [
    "game_id", "game_play_number", "sequenceNumber", "period", "clock.minutes", "clock.seconds",
    "homeScore", "awayScore", "homeTeamId", "awayTeamId",
]


def is_garbage_time(period: int, margin: int) -> bool:
    """A lead of 38+ in the 2nd quarter, 28+ in the 3rd, or 22+ in the 4th."""
    m = abs(margin)
    return (period == 2 and m >= 38) or (period == 3 and m >= 28) or (period >= 4 and m >= 22)


def iso_l1(values):
    """Non-decreasing fit minimising absolute error (pool adjacent violators with block medians)."""
    blocks = []
    for v in values:
        blocks.append([v])
        while len(blocks) > 1 and np.median(blocks[-2]) > np.median(blocks[-1]):
            last = blocks.pop()
            blocks[-1].extend(last)
    out = []
    for blk in blocks:
        med = sorted(blk)[(len(blk) - 1) // 2]  # lower median, so it is an observed score
        out.extend([med] * len(blk))
    return np.array(out)


def quarter_scores(text: str):
    """Parse the linescore cell of the schedule file into a list of points per period."""
    return [int(float(x)) for x in re.findall(r"'value': ([0-9.]+)", text)]


def timeline(plays: pd.DataFrame, home_q, away_q):
    """Score step function over regulation, as a list of (start_second, home, away, quarter)."""
    official = [(0, 0)] + [(sum(home_q[:q]), sum(away_q[:q])) for q in (1, 2, 3, 4)]
    segs, forced = [], 0
    for q in (1, 2, 3, 4):
        pq = plays[plays["period"] == q]
        clock = np.clip((pq["clock.minutes"] * 60 + pq["clock.seconds"]).to_numpy(), 0, 900)
        t = (q - 1) * 900 + (900 - clock)
        order = np.lexsort((pq["sequenceNumber"].to_numpy(), t))
        t = t[order]
        h = np.clip(pq["homeScore"].to_numpy()[order], official[q - 1][0], official[q][0])
        a = np.clip(pq["awayScore"].to_numpy()[order], official[q - 1][1], official[q][1])
        if len(t):
            h, a = iso_l1(list(h)), iso_l1(list(a))
        cur = official[q - 1]
        segs.append(((q - 1) * 900.0, cur[0], cur[1], q))
        for ti, hi, ai in zip(t, h, a):
            if (hi, ai) != cur:
                cur = (int(hi), int(ai))
                segs.append((float(ti), cur[0], cur[1], q))
        if cur != official[q]:
            forced += (official[q][0] - cur[0]) + (official[q][1] - cur[1])
    segs.append((3600.0, official[4][0], official[4][1], 4))
    return segs, forced, official


def build_game_control(pbp_path, completed_games: pd.DataFrame, strict: bool = True):
    """Return (one row per team per game, notes dict).

    completed_games: schedule rows of completed games, with id, date, week, home_id, away_id,
    home_score, away_score, home_linescores, away_linescores.
    strict: raise on a game whose quarter scores do not add up. When False, the game is left out
    and listed in notes["skipped_games"] (used for past seasons, where a stray game should not
    stop the whole build).
    """
    pbp = pd.read_parquet(pbp_path, columns=PBP_COLUMNS)
    done = completed_games.set_index("id")
    rows = []
    notes = {"games": 0, "games_with_untimed_points": 0, "untimed_points": 0, "overtime_games": 0}
    if not strict:
        notes["skipped_games"] = []
    for gid, plays in pbp.groupby("game_id", sort=False):
        if gid not in done.index:
            continue
        s = done.loc[gid]
        home, away = int(s.home_id), int(s.away_id)
        fh, fa = int(s.home_score), int(s.away_score)
        hq, aq = quarter_scores(str(s.home_linescores)), quarter_scores(str(s.away_linescores))
        if not (len(hq) >= 4 and len(aq) >= 4 and sum(hq) == fh and sum(aq) == fa):
            if strict:
                raise ValueError(f"quarter scores do not add up to the final score for game {gid}")
            notes["skipped_games"].append(int(gid))
            continue
        segs, forced, official = timeline(plays, hq, aq)
        notes["games"] += 1
        if forced:
            notes["games_with_untimed_points"] += 1
            notes["untimed_points"] += forced
        overtime = len(hq) > 4
        if overtime:
            notes["overtime_games"] += 1

        lead = tied = trail = integral = garbage_secs = 0.0
        ng_home = ng_away = 0
        max_m = min_m = 0
        for k in range(len(segs) - 1):
            t0, h, a, q = segs[k]
            t1 = segs[k + 1][0]
            if k > 0:
                ph, pa = segs[k - 1][1], segs[k - 1][2]
                if (h, a) != (ph, pa) and not is_garbage_time(q, ph - pa):
                    ng_home += h - ph
                    ng_away += a - pa
            m = h - a
            dt = max(0.0, t1 - t0)
            if m > 0:
                lead += dt
            elif m < 0:
                trail += dt
            else:
                tied += dt
            integral += m * dt
            if dt > 0 and is_garbage_time(q, m):
                garbage_secs += dt
            max_m, min_m = max(max_m, m), min(min_m, m)
        last_h, last_a = segs[-2][1], segs[-2][2]
        if official[4] != (last_h, last_a) and not is_garbage_time(4, last_h - last_a):
            ng_home += official[4][0] - last_h
            ng_away += official[4][1] - last_a
        if overtime:
            ng_home += fh - official[4][0]
            ng_away += fa - official[4][1]
        end_reg = official[4][0] - official[4][1]
        max_m, min_m = max(max_m, fh - fa, end_reg), min(min_m, fh - fa, end_reg)
        if abs(lead + tied + trail - 3600) > 1e-6:
            raise ValueError(f"timeline for game {gid} does not cover 60 minutes")

        for team, opp, sign in ((home, away, 1), (away, home, -1)):
            rows.append({
                "game_id": int(gid), "team_id": team, "opp_id": opp,
                "lead_s": lead if sign == 1 else trail, "tied_s": tied, "trail_s": trail if sign == 1 else lead,
                "avg_lead": sign * integral / 3600,
                "final_margin": sign * (fh - fa), "ng_margin": sign * (ng_home - ng_away),
                "max_lead": max_m if sign == 1 else -min_m, "max_deficit": -min_m if sign == 1 else max_m,
                "garbage_s": garbage_secs, "overtime": overtime, "win": sign * (fh - fa) > 0,
                "untimed_points": forced,
            })
    return pd.DataFrame(rows), notes
