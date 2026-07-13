#!/usr/bin/env python3
"""
Golf trip Monte Carlo: gross match play fairness, North (blue) vs South (red).
Model: per-hole score distributions (rel. to par) interpolated between anchor
handicaps, calibrated to published amateur scoring data (Stagner/Broadie-style):
mean round ~ index + 3, round SD ~2.8 (scratch) to ~4.3 (20+). Round-to-round
form modeled as noise on effective handicap. Match play = hole-by-hole.
Alternate shot approximated as synthetic player: avg(pair) + 1.5 + 0.12*|gap|.
"""
import numpy as np

rng = np.random.default_rng(17)

ANCH_H = np.array([-5.0, 0.0, 10.0, 20.0, 30.0])
ANCH_P = np.array(
    [
        [0.008, 0.190, 0.630, 0.155, 0.015, 0.002, 0.000],  # +5 (extrapolation anchor)
        [0.004, 0.140, 0.600, 0.220, 0.031, 0.004, 0.001],  # scratch
        [0.001, 0.050, 0.360, 0.420, 0.130, 0.032, 0.007],  # 10
        [0.0005, 0.018, 0.210, 0.400, 0.245, 0.093, 0.0335],  # 20
        [0.0002, 0.006, 0.105, 0.325, 0.315, 0.160, 0.0888],  # 30
    ]
)
ANCH_P /= ANCH_P.sum(1, keepdims=True)
CATS = np.arange(-2, 5)  # eagle .. quad+
N = 20000


def hole_probs(h):
    h = np.clip(h, -5, 30)
    out = np.empty((h.size, 7))
    for j in range(7):
        out[:, j] = np.interp(h, ANCH_H, ANCH_P[:, j])
    return out / out.sum(1, keepdims=True)


def sim_rounds(index, n=N):
    sd = 1.2 + 0.05 * max(index, 0)
    eff = index + rng.normal(0, sd, n)
    p = hole_probs(eff)
    c = np.cumsum(p, 1)
    u = rng.random((n, 18))
    idx = (u[:, :, None] > c[:, None, :]).sum(2)
    return CATS[idx]


def match(hA, hB):
    a, b = sim_rounds(hA), sim_rounds(hB)
    wa, wb = (a < b).sum(1), (b < a).sum(1)
    return (wa > wb).mean(), (wa == wb).mean(), (wb > wa).mean()


def fourball(pA, pB):
    a = np.minimum(sim_rounds(pA[0]), sim_rounds(pA[1]))
    b = np.minimum(sim_rounds(pB[0]), sim_rounds(pB[1]))
    wa, wb = (a < b).sum(1), (b < a).sum(1)
    return (wa > wb).mean(), (wa == wb).mean(), (wb > wa).mean()


def altshot_h(p):
    return 0.5 * (p[0] + p[1]) + 1.5 + 0.12 * abs(p[0] - p[1])


blue = [
    ("Kunkel", 4.0, 3.2),
    ("Zeider", 8.2, 8.2),
    ("Gonsoroski", 8.8, 8.8),
    ("Appold", 11.3, 8.0),
    ("Wilson", 11.5, 11.5),
    ("Ervin", 13.6, 12.1),
    ("Reynolds", 13.6, 13.6),
    ("Mahony", 18.4, 18.4),
    ("Kintz", 19.9, 18.0),
    ("Bullock", 20.3, 18.6),
    ("Solomon", 20.7, 20.7),
    ("Laureys", 25.6, 25.6),
]
red = [
    ("Kennedy", 4.5, 4.5),
    ("Carnrike", 7.2, 7.0),
    ("Munoz", 7.4, 7.4),
    ("Lacy", 9.8, 9.8),
    ("Tomek", 11.9, 11.9),
    ("Uber", 13.3, 13.3),
    ("Swikle", 13.7, 11.9),
    ("Magee", 13.7, 13.3),
    ("VanNice", 14.2, 12.4),
    ("Velasquez", 14.6, 11.7),
    ("Ramos", 18.2, 16.2),
    ("Haubert", 18.7, 18.4),
]


def session_dist(match_probs, n=200000):
    """Distribution of Blue points given list of (pW,pH,pL)."""
    pts = np.zeros(n)
    for w, h, l in match_probs:
        u = rng.random(n)
        pts += np.where(u < w, 1.0, np.where(u < w + h, 0.5, 0.0))
    return pts


def run_all(blue_idx, red_idx, label):
    print(f"\n================ SCENARIO: {label} ================")
    B = [(n, i) for (n, _, _), i in zip(blue, blue_idx)]
    R = [(n, i) for (n, _, _), i in zip(red, red_idx)]

    # ---- singles ladder ----
    print("\n-- GROSS SINGLES (laddered) --")
    singles = []
    for (bn, bh), (rn, rh) in zip(B, R):
        w, h, l = match(bh, rh)
        singles.append((w, h, l))
        print(
            f"{bn:11s} {bh:4.1f} vs {rn:10s} {rh:4.1f} | "
            f"Blue {w:.0%}  halve {h:.0%}  Red {l:.0%}"
        )
    exp = sum(w + 0.5 * h for w, h, l in singles)
    pts = session_dist(singles)
    print(
        f"Singles: E[Blue pts]={exp:.2f}/12, P(Blue session win)={(pts > 6).mean():.0%}, "
        f"tie={(pts == 6).mean():.0%}"
    )
    coin = sum(1 for w, h, l in singles if 0.40 <= w / (w + l) <= 0.60)
    print(f"Coin-flip matches (fav<=60%): {coin}/12")

    # ---- four-ball pairing strategies ----
    def fb_session(bp, rp, tag):
        bp = sorted(bp, key=lambda p: min(p[0][1], p[1][1]))
        rp = sorted(rp, key=lambda p: min(p[0][1], p[1][1]))
        res = []
        print(f"\n-- FOUR-BALL, {tag} --")
        for pb, pr in zip(bp, rp):
            w, h, l = fourball((pb[0][1], pb[1][1]), (pr[0][1], pr[1][1]))
            res.append((w, h, l))
            print(
                f"{pb[0][0]}/{pb[1][0]} ({pb[0][1]:.1f}/{pb[1][1]:.1f}) vs "
                f"{pr[0][0]}/{pr[1][0]} ({pr[0][1]:.1f}/{pr[1][1]:.1f}) | "
                f"Blue {w:.0%} halve {h:.0%} Red {l:.0%}"
            )
        e = sum(w + 0.5 * h for w, h, l in res)
        coin = sum(1 for w, h, l in res if 0.40 <= w / (w + l) <= 0.60)
        print(f"E[Blue pts]={e:.2f}/6, coin-flips {coin}/6")
        return res

    sw_b = [(B[i], B[11 - i]) for i in range(6)]  # strong+weak
    sw_r = [(R[i], R[11 - i]) for i in range(6)]
    adj_b = [(B[2 * i], B[2 * i + 1]) for i in range(6)]  # adjacent (mid+mid)
    adj_r = [(R[2 * i], R[2 * i + 1]) for i in range(6)]
    fbA = fb_session(sw_b, sw_r, "strong+weak pairs, matched by low man")
    fb_session(adj_b, adj_r, "adjacent pairs (like-with-like)")

    # ---- day 2: top-6 alternate shot + bottom-12 four-ball ----
    print("\n-- DAY 2 SPLIT --")
    as_res = []
    for i in range(0, 6, 2):
        hb = altshot_h((B[i][1], B[i + 1][1]))
        hr = altshot_h((R[i][1], R[i + 1][1]))
        w, h, l = match(hb, hr)
        as_res.append((w, h, l))
        print(
            f"AltShot {B[i][0]}/{B[i + 1][0]} (eff {hb:.1f}) vs "
            f"{R[i][0]}/{R[i + 1][0]} (eff {hr:.1f}) | "
            f"Blue {w:.0%} halve {h:.0%} Red {l:.0%}"
        )
    bot_b = [(B[6 + i], B[11 - i]) for i in range(3)]
    bot_r = [(R[6 + i], R[11 - i]) for i in range(3)]
    b4_res = []
    for pb, pr in zip(bot_b, bot_r):
        w, h, l = fourball((pb[0][1], pb[1][1]), (pr[0][1], pr[1][1]))
        b4_res.append((w, h, l))
        print(
            f"4ball {pb[0][0]}/{pb[1][0]} vs {pr[0][0]}/{pr[1][0]} | "
            f"Blue {w:.0%} halve {h:.0%} Red {l:.0%}"
        )

    # ---- full trip ----
    trip = fbA + as_res + b4_res + singles
    pts = session_dist(trip)
    print(
        f"\nTRIP (24 pts): E[Blue]={sum(w + 0.5 * h for w, h, l in trip):.2f}, "
        f"P(Blue win)={(pts > 12).mean():.0%}, tie={(pts == 12).mean():.0%}, "
        f"P(Red win)={(pts < 12).mean():.0%}"
    )


def main():
    cur_b = [p[1] for p in blue]
    cur_r = [p[1] for p in red]
    run_all(cur_b, cur_r, "current indexes")

    blend_b = [round(0.7 * p[1] + 0.3 * p[2], 1) for p in blue]
    blend_r = [round(0.7 * p[1] + 0.3 * p[2], 1) for p in red]
    run_all(blend_b, blend_r, "capability blend (70% current / 30% low)")

    # ---- fair spot calculation: what head start makes the cup ~50/50? ----
    print("\n================ FAIR SPOT (current indexes) ================")

    # rebuild current-index trip match probs
    B = [(n_, i) for (n_, i, _) in blue]
    R = [(n_, i) for (n_, i, _) in red]
    singles = [match(b[1], r[1]) for b, r in zip(B, R)]
    sw_b = [(B[i], B[11 - i]) for i in range(6)]
    sw_r = [(R[i], R[11 - i]) for i in range(6)]
    fbA = [
        fourball((pb[0][1], pb[1][1]), (pr[0][1], pr[1][1]))
        for pb, pr in zip(sw_b, sw_r)
    ]
    as_res = [
        match(altshot_h((B[i][1], B[i + 1][1])), altshot_h((R[i][1], R[i + 1][1])))
        for i in range(0, 6, 2)
    ]
    bot = [
        fourball((B[6 + i][1], B[11 - i][1]), (R[6 + i][1], R[11 - i][1]))
        for i in range(3)
    ]
    trip = fbA + as_res + bot + singles

    pts = session_dist(trip)
    for spot in [0, 1, 1.5, 2, 2.5, 3, 3.5, 4]:
        adj = pts + spot
        print(
            f"Blue starts +{spot:>3}: P(Blue)={(adj > 12).mean():.0%}  "
            f"tie={(adj == 12).mean():.0%}  P(Red)={(adj < 12).mean():.0%}"
        )

    spts = session_dist(singles)
    print("\nSingles-only session (12 pts):")
    for spot in [0, 1, 1.5, 2]:
        adj = spts + spot
        print(
            f"Blue starts +{spot:>3}: P(Blue)={(adj > 6).mean():.0%}  "
            f"tie={(adj == 6).mean():.0%}  P(Red)={(adj < 6).mean():.0%}"
        )


if __name__ == "__main__":
    main()
