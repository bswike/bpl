"""Schedule-adjusted team ratings used for the projected part of the top 50.

Two ratings are computed from completed games:

* Colley: wins and losses only, adjusted for opponent strength (the Colley matrix method).
* SRS: scoring margin capped per game, adjusted for opponent strength, with a fitted home edge.

All FCS opponents are pooled into one node so that FBS-vs-FCS games count without
needing full FCS schedules.
"""
import numpy as np
import pandas as pd


def ratings(games: pd.DataFrame, fbs_ids, cutoff: str | None = None, cap: int = 24):
    """Return (DataFrame of FBS teams with colley, srs and their z-scores, fitted home edge in points).

    games: completed games with home_id, away_id, home_score, away_score, neutral_site, date (ISO, UTC).
    fbs_ids: iterable of FBS team ids.
    cutoff: if given, only games with date < cutoff are used.
    """
    g = games if cutoff is None else games[games.date < cutoff]
    ids = sorted(fbs_ids) + ["FCS"]
    ix = {t: k for k, t in enumerate(ids)}
    n = len(ids)

    def node(t):
        return ix[t] if t in ix else ix["FCS"]

    colley_m = np.zeros((n, n))
    b = np.ones(n)
    design, margins = [], []
    wins = np.zeros(n)
    losses = np.zeros(n)
    for r in g.itertuples():
        h, a = node(int(r.home_id)), node(int(r.away_id))
        if h == a:
            continue
        hs, as_ = int(r.home_score), int(r.away_score)
        colley_m[h, h] += 1
        colley_m[a, a] += 1
        colley_m[h, a] -= 1
        colley_m[a, h] -= 1
        if hs > as_:
            b[h] += 0.5
            b[a] -= 0.5
            wins[h] += 1
            losses[a] += 1
        else:
            b[a] += 0.5
            b[h] -= 0.5
            wins[a] += 1
            losses[h] += 1
        row = np.zeros(n + 1)
        row[h] = 1
        row[a] = -1
        row[n] = 0 if bool(r.neutral_site) else 1
        design.append(row)
        margins.append(max(-cap, min(cap, hs - as_)))
    colley_m += 2 * np.eye(n)
    colley = np.linalg.solve(colley_m, b)

    a_mat = np.vstack([np.array(design), np.r_[np.ones(n), 0]])  # last row: ratings sum to zero
    y = np.r_[np.array(margins, dtype=float), 0]
    sol = np.linalg.lstsq(a_mat, y, rcond=None)[0]

    out = pd.DataFrame({"id": ids, "colley": colley, "srs": sol[:n], "w": wins, "l": losses})
    fcs_srs = float(sol[ix["FCS"]])
    out = out[out.id != "FCS"].copy()
    out.attrs["fcs_srs"] = fcs_srs  # the pooled FCS rating, for projecting games against FCS teams
    for c in ("colley", "srs"):
        out["z_" + c] = (out[c] - out[c].mean()) / out[c].std()
    return out, float(sol[n])
