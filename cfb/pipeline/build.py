#!/usr/bin/env python3
"""Build every table for the 2026 college football team-metrics project.

    python pipeline/build.py

Reads data/raw (feeds) and data/manual (hand-entered reference values), then writes
data/csv/*.csv, data/json/*.json, data/json/meta.json and docs/data-dictionary.md.
Run pipeline/fetch_raw.sh first to refresh the feeds.
"""
import datetime as dt
import json
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game_control import build_game_control  # noqa: E402
from ratings import ratings  # noqa: E402
from schema import SCHEMA  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW, MANUAL, DERIVED = ROOT / "data" / "raw", ROOT / "data" / "manual", ROOT / "data" / "derived"
OUT_CSV, OUT_JSON, DOCS = ROOT / "data" / "csv", ROOT / "data" / "json", ROOT / "docs"

SEASON = 2026
ET = ZoneInfo("America/New_York")
W_COLLEY = 0.7          # model blend: schedule-adjusted record vs capped scoring margin
MARGIN_CAP = 24
CONFERENCES = {1: "ACC", 4: "Big 12", 5: "Big Ten", 8: "SEC", 9: "Pac-12", 18: "Ind", 12: "C-USA",
               151: "American", 17: "Mountain West", 15: "MAC", 37: "Sun Belt"}
POWER = {"ACC", "Big 12", "Big Ten", "SEC"}
NOTRE_DAME = 87
SITES = ["Home", "Away", "Neutral"]
TIER_LABELS = {1: "1-25", 2: "26-50", 3: "51+"}


def warn(msg):
    print(f"WARNING: {msg}", file=sys.stderr)


def collect_standings(node, found):
    """Walk ESPN's standings JSON and collect team id -> overall record text."""
    if isinstance(node, dict):
        if "team" in node and isinstance(node.get("stats"), list):
            stats = {s.get("name") or s.get("type"): s for s in node["stats"]}
            found[int(node["team"]["id"])] = (stats.get("overall") or {}).get("displayValue")
        for v in node.values():
            collect_standings(v, found)
    elif isinstance(node, list):
        for v in node:
            collect_standings(v, found)


def main():
    sched = pd.read_csv(RAW / f"cfb_schedule_{SEASON}.csv", low_memory=False)
    polls = pd.read_parquet(RAW / f"cfb_poll_analytics_{SEASON}.parquet")
    published = json.loads((MANUAL / "published.json").read_text())
    talent_in = pd.read_csv(MANUAL / f"talent_composite_{SEASON}.csv")
    votes_in = pd.read_csv(MANUAL / "ap_receiving_votes.csv")
    fbs = {}
    collect_standings(json.loads((RAW / f"fbs_standings_{SEASON}.json").read_text()), fbs)

    # ---------------------------------------------------------------- teams
    info = {}
    for side in ("home", "away"):
        cols = [f"{side}_{c}" for c in ("id", "location", "display_name", "abbreviation", "color", "alternate_color", "logo", "logo_dark", "conference_id")]
        for tid, loc, disp, abbr, color, alt, logo, logo_d, conf in sched[cols].itertuples(index=False):
            d = info.setdefault(int(tid), {})
            for k, v in (("team", loc), ("display_name", disp), ("abbreviation", abbr), ("color", color), ("alt_color", alt), ("logo", logo), ("logo_dark", logo_d)):
                if k not in d and pd.notna(v):
                    d[k] = v
            if "conf_id" not in d and pd.notna(conf):
                d["conf_id"] = int(conf)
    name = {t: d["team"] for t, d in info.items()}

    def conf(t):
        return CONFERENCES.get(info[t].get("conf_id"), "")

    def group(t):
        if t == NOTRE_DAME:
            return "Notre Dame"
        c = conf(t)
        return "Power 4" if c in POWER else "Pac-12" if c == "Pac-12" else "Other FBS"

    missing_conf = [name[t] for t in fbs if not conf(t)]
    assert not missing_conf, f"no conference mapping for {missing_conf}"

    # ---------------------------------------------------------------- talent composite
    talent_rank = {int(r.team_id): int(r.talent_rank) for r in talent_in.itertuples()}
    assert set(talent_rank) == set(fbs), "talent file must list exactly the FBS teams in the standings feed"

    def tier(t):
        r = talent_rank.get(t, 999)
        return 1 if r <= 25 else 2 if r <= 50 else 3

    # ---------------------------------------------------------------- AP and CFP polls
    reg = sched[sched.season_type == 2]
    done = reg[reg.status_type_completed == True]  # noqa: E712
    ap = polls[(polls.poll == "ap") & polls["rank"].notna()]
    last_ap_week = int(ap.week.max())

    # The poll feed starts with the first in-season poll. The preseason poll is recovered from the
    # rank shown next to each team in week-1 games. (From November the game feed shows CFP ranks
    # instead of AP ranks, so game-time ranks are only used for week 1.)
    preseason = {}
    week1 = reg[reg.week == 1]
    for side in ("home", "away"):
        for tid, rk in zip(week1[f"{side}_id"], week1[f"{side}_current_rank"]):
            if rk <= 25:
                preseason[int(tid)] = int(rk)
    for tid, rk in published["ap_preseason"].get("rank_fixes", {}).items():
        preseason[int(tid)] = int(rk)
    if len(preseason) != 25:
        warn(f"preseason poll recovered {len(preseason)} teams, expected 25")

    ap_rows = [dict(poll_week=1, label="Preseason", rank=rk, team_id=t, team=name[t], points=None, first_place_votes=None)
               for t, rk in sorted(preseason.items(), key=lambda kv: (kv[1], name[kv[0]]))]
    for r in ap.sort_values(["week", "rank"]).itertuples():
        ap_rows.append(dict(poll_week=int(r.week), label=f"Week {int(r.week)}", rank=int(r.rank), team_id=int(r.team_id), team=name[int(r.team_id)],
                            points=None if pd.isna(r.points) else int(r.points),
                            first_place_votes=None if pd.isna(r.first_place_votes) else int(r.first_place_votes)))
    ap_polls = pd.DataFrame(ap_rows)
    history = ap_polls.groupby("team_id")["rank"].agg(["count", "min"])
    ever_ranked = set(history.index)
    n_polls = ap_polls.poll_week.nunique()

    ap_last = ap[ap.week == last_ap_week].sort_values("rank")
    ap_rank_now = {int(t): int(r) for t, r in zip(ap_last.team_id, ap_last["rank"])}
    ap_points = {int(t): int(p) for t, p in zip(ap_last.team_id, ap_last.points) if pd.notna(p)}
    pub_ap = published.get("ap_latest", {})
    if pub_ap.get("week") == last_ap_week:
        assert [name[int(t)] for t in ap_last.team_id] == pub_ap["top25"], "AP Top 25 in the feed differs from the published order in data/manual/published.json"
    else:
        warn(f"published.json checks AP week {pub_ap.get('week')} but the feed's latest is week {last_ap_week}; update data/manual/published.json")
    votes = votes_in[votes_in.poll_week == last_ap_week].sort_values("points", ascending=False)
    if votes.empty:
        warn(f"no 'receiving votes' entries for AP week {last_ap_week}; the ranking will go straight from the AP Top 25 to the model. Update data/manual/ap_receiving_votes.csv")
    for r in votes.itertuples():
        assert int(r.team_id) not in ap_rank_now, f"{r.team} is both ranked and receiving votes"
        ap_points[int(r.team_id)] = int(r.points)
    ap_receiving = pd.DataFrame([dict(poll_week=last_ap_week, team_id=int(r.team_id), team=name[int(r.team_id)], points=int(r.points)) for r in votes.itertuples()],
                                columns=["poll_week", "team_id", "team", "points"])

    cfp = polls[(polls.poll == "cfp") & polls["rank"].notna()]
    cfp_rankings = pd.DataFrame([dict(cfp_week=int(r.week), rank=int(r.rank), team_id=int(r.team_id), team=name[int(r.team_id)])
                                 for r in cfp.sort_values(["week", "rank"]).itertuples()], columns=["cfp_week", "rank", "team_id", "team"])
    cfp_rank, last_cfp_week = {}, None
    if len(cfp):
        last_cfp_week = int(cfp.week.max())
        cfp_last = cfp[cfp.week == last_cfp_week].sort_values("rank")
        cfp_rank = {int(t): int(r) for t, r in zip(cfp_last.team_id, cfp_last["rank"])}
    pub_cfp = published.get("cfp_latest", {})
    cfp_checked = pub_cfp.get("week") == last_cfp_week
    if cfp_checked:
        assert [name[int(t)] for t in cfp_last.team_id] == pub_cfp["top25"], "CFP Top 25 in the feed differs from the published order in data/manual/published.json"
    elif last_cfp_week is not None:
        warn(f"published.json checks CFP week {pub_cfp.get('week')} but the feed's latest is week {last_cfp_week}; update data/manual/published.json")

    # ---------------------------------------------------------------- each team's rank going into each game
    # Poll week N (CFP week N) is the ranking in effect for week N games; a week without one uses the latest earlier.
    ap_week, cfp_week = {}, {}
    for r in ap_polls.itertuples():
        ap_week.setdefault(int(r.poll_week), {})[int(r.team_id)] = int(r.rank)
    for r in cfp_rankings.itertuples():
        cfp_week.setdefault(int(r.cfp_week), {})[int(r.team_id)] = int(r.rank)

    def rank_in(weeks, team, week):
        keys = [k for k in weeks if k <= week]
        return weeks[max(keys)].get(team) if keys else None

    # ---------------------------------------------------------------- latest poll ("currently ranked")
    # Whichever of the AP poll and the CFP ranking was released last. Release dates come from published.json.
    ap_released, cfp_released = pub_ap.get("released"), pub_cfp.get("released") if cfp_checked else None
    if cfp_released and (not ap_released or cfp_released > ap_released):
        latest_poll = {"poll": "CFP", "week": last_cfp_week, "released": cfp_released}
        cur_rank = dict(cfp_rank)
    else:
        latest_poll = {"poll": "AP", "week": last_ap_week, "released": ap_released}
        cur_rank = dict(ap_rank_now)

    # ---------------------------------------------------------------- game control (per team per game)
    pbp_path = RAW / f"play_by_play_{SEASON}.parquet"
    cache_path = DERIVED / "game_control_by_game.csv"
    if pbp_path.exists():
        gc_games, gc_notes = build_game_control(pbp_path, done[["id", "date", "week", "home_id", "away_id", "home_score", "away_score", "home_linescores", "away_linescores"]])
        DERIVED.mkdir(parents=True, exist_ok=True)
        gc_games.to_csv(cache_path, index=False)
        (DERIVED / "game_control_notes.json").write_text(json.dumps(gc_notes, indent=2))
    else:
        warn("play-by-play file not found; using the cached per-game numbers in data/derived (run pipeline/fetch_raw.sh to recompute)")
        gc_games = pd.read_csv(cache_path, float_precision="round_trip")
        gc_notes = json.loads((DERIVED / "game_control_notes.json").read_text())
    missing = set(done.id.astype(int)) - set(gc_games.game_id.astype(int))
    assert not missing, f"{len(missing)} completed games have no game-control numbers; run pipeline/fetch_raw.sh and rebuild"
    gc_games = gc_games[gc_games.game_id.isin(set(done.id.astype(int)))]
    gc = {(int(r.game_id), int(r.team_id)): r for r in gc_games.itertuples()}

    # ---------------------------------------------------------------- records and the game log
    def blank():
        return dict(n=0, w=0, l=0, rw=0, rl=0, uw=0, ul=0, cw=0, cl=0, t={1: [0, 0], 2: [0, 0], 3: [0, 0]},
                    lead=0.0, tied=0.0, trail=0.0, avg=0.0, ng=0.0, margin=0.0)

    season, by_site, game_rows = {}, {}, []
    for g in done.itertuples():
        gid, home, away = int(g.id), int(g.home_id), int(g.away_id)
        hs, as_ = int(g.home_score), int(g.away_score)
        date = dt.datetime.strptime(g.date, "%Y-%m-%dT%H:%MZ").replace(tzinfo=dt.timezone.utc).astimezone(ET).date().isoformat()
        neutral = bool(g.neutral_site)
        for team, opp, pf, pa, site in ((home, away, hs, as_, "Neutral" if neutral else "Home"), (away, home, as_, hs, "Neutral" if neutral else "Away")):
            win = pf > pa
            c = gc[(gid, team)]
            for bucket in (season.setdefault(team, blank()), by_site.setdefault((team, site), blank())):
                bucket["n"] += 1
                bucket["w" if win else "l"] += 1
                bucket[("r" if opp in ever_ranked else "u") + ("w" if win else "l")] += 1
                if opp in cur_rank:
                    bucket["c" + ("w" if win else "l")] += 1
                bucket["t"][tier(opp)][0 if win else 1] += 1
                bucket["lead"] += c.lead_s
                bucket["tied"] += c.tied_s
                bucket["trail"] += c.trail_s
                bucket["avg"] += c.avg_lead
                bucket["ng"] += c.ng_margin
                bucket["margin"] += pf - pa
            if team in fbs:
                game_rows.append(dict(
                    game_id=gid, date=date, week=int(g.week), team_id=team, team=name[team], opp_id=opp, opp=name[opp], opp_is_fbs=opp in fbs,
                    site=site, venue=g.venue_full_name if pd.notna(g.venue_full_name) else None, result="W" if win else "L",
                    points_for=pf, points_against=pa, margin=pf - pa, overtime=bool(c.overtime),
                    ap_rank_in=rank_in(ap_week, team, int(g.week)), cfp_rank_in=rank_in(cfp_week, team, int(g.week)),
                    opp_ever_ap_ranked=opp in ever_ranked, opp_cur_rank=cur_rank.get(opp), opp_talent_rank=talent_rank.get(opp), opp_talent_tier=tier(opp),
                    led_pct=round(c.lead_s / 3600, 4), tied_pct=round(c.tied_s / 3600, 4), trailed_pct=round(c.trail_s / 3600, 4),
                    avg_lead=round(c.avg_lead, 2), biggest_lead=int(c.max_lead), biggest_deficit=int(c.max_deficit), ng_margin=int(c.ng_margin)))
    for t, rec_text in fbs.items():  # every FBS record must match ESPN's standings feed
        assert f"{season[t]['w']}-{season[t]['l']}" == rec_text, f"{name[t]}: computed {season[t]['w']}-{season[t]['l']}, standings say {rec_text}"
    games = pd.DataFrame(game_rows).sort_values(["team", "date"]).reset_index(drop=True)

    # ---------------------------------------------------------------- model and the full ranking (named top50 for history)
    now, home_edge = ratings(done, fbs, cap=MARGIN_CAP)
    fcs_srs = now.attrs["fcs_srs"]
    now["score"] = W_COLLEY * now.z_colley + (1 - W_COLLEY) * now.z_srs
    now = now.sort_values("score", ascending=False).reset_index(drop=True)
    model = {int(r.id): dict(rank=k + 1, score=float(r.score), colley=float(r.colley), srs=float(r.srs)) for k, r in enumerate(now.itertuples())}

    calibration = None
    if cfp_checked and pub_cfp.get("games_through_cutoff_utc"):
        cal, _ = ratings(done, fbs, cutoff=pub_cfp["games_through_cutoff_utc"], cap=MARGIN_CAP)
        cal["score"] = W_COLLEY * cal.z_colley + (1 - W_COLLEY) * cal.z_srs
        model_25 = {int(t) for t in cal.sort_values("score", ascending=False).head(25).id}
        calibration = dict(committee_week=last_cfp_week, games_before_utc=pub_cfp["games_through_cutoff_utc"],
                           committee_teams_in_model_top25=len(model_25 & set(cfp_rank)),
                           committee_teams_missed=sorted(name[t] for t in set(cfp_rank) - model_25),
                           model_teams_not_ranked=sorted(name[t] for t in model_25 - set(cfp_rank)))

    top = [(rk, t, "AP Top 25") for t, rk in sorted(ap_rank_now.items(), key=lambda kv: kv[1])]
    top += [(len(top) + 1 + k, int(r.team_id), "AP receiving votes") for k, r in enumerate(votes.itertuples())]
    used = {t for _, t, _ in top}
    fill = [int(t) for t in now.id if int(t) not in used]  # every remaining FBS team, in model order
    top += [(len(top) + 1 + k, t, "Projected") for k, t in enumerate(fill)]
    top50_rank = {t: rk for rk, t, _ in top}
    top50_basis = {t: b for _, t, b in top}
    top50 = pd.DataFrame([dict(rank=rk, basis=b, team_id=t, team=name[t], conference=conf(t), wins=season[t]["w"], losses=season[t]["l"],
                               ap_points=ap_points.get(t), cfp_rank=cfp_rank.get(t), model_rank=model[t]["rank"], talent_rank=talent_rank[t]) for rk, t, b in top])

    # ---------------------------------------------------------------- upcoming games and projected spreads
    # Projected margin = SRS difference + fitted home edge (0 at neutral sites). SRS caps each game's margin at
    # MARGIN_CAP when fitting, so blowout projections run small. FCS teams share the pooled FCS rating.
    srs = {t: m["srs"] for t, m in model.items()}
    later = sched[sched.season_type.isin([2, 3]) & (sched.status_type_completed != True)]  # noqa: E712
    upcoming_rows = []
    for g in later.itertuples():
        home, away = int(g.home_id), int(g.away_id)
        neutral = bool(g.neutral_site)
        date = dt.datetime.strptime(g.date, "%Y-%m-%dT%H:%MZ").replace(tzinfo=dt.timezone.utc).astimezone(ET).date().isoformat()
        for team, opp, site in ((home, away, "Neutral" if neutral else "Home"), (away, home, "Neutral" if neutral else "Away")):
            if team not in fbs:
                continue
            known = opp > 0
            margin = None
            if known:
                margin = srs[team] - srs.get(opp, fcs_srs) + (0 if neutral else home_edge if site == "Home" else -home_edge)
            upcoming_rows.append(dict(
                game_id=int(g.id), date=date, kickoff_utc=g.date, week=int(g.week), season_type="Postseason" if int(g.season_type) == 3 else "Regular",
                note=g.notes_headline if isinstance(g.notes_headline, str) else None, team_id=team, team=name[team],
                opp_id=opp if known else None, opp=name.get(opp, "TBD") if known else "TBD", opp_is_fbs=opp in fbs,
                site=site, venue=g.venue_full_name if pd.notna(g.venue_full_name) else None,
                proj_margin=round(margin, 1) if margin is not None else None,
                proj_spread=round(-margin * 2) / 2 if margin is not None else None))
    upcoming = pd.DataFrame(upcoming_rows, columns=list(SCHEMA["upcoming"])[1:]).sort_values(["team", "kickoff_utc"]).reset_index(drop=True)

    # ---------------------------------------------------------------- team summary
    gcf = gc_games[gc_games.team_id.isin(set(fbs))]
    never_trailed = gcf[gcf.max_deficit == 0].groupby("team_id").size()
    comebacks = gcf[gcf.win & (gcf.max_deficit >= 10)].groupby("team_id").size()
    blown = gcf[(~gcf.win) & (gcf.max_lead >= 10)].groupby("team_id").size()
    big_comeback = gcf[gcf.win].groupby("team_id").max_deficit.max()
    big_blown = gcf[~gcf.win].groupby("team_id").max_lead.max()

    def category_cols(b):
        return {"vs_ap_ranked_w": b["rw"], "vs_ap_ranked_l": b["rl"], "vs_ap_unranked_w": b["uw"], "vs_ap_unranked_l": b["ul"],
                "vs_cur_ranked_w": b["cw"], "vs_cur_ranked_l": b["cl"],
                "vs_talent_t1_w": b["t"][1][0], "vs_talent_t1_l": b["t"][1][1], "vs_talent_t2_w": b["t"][2][0], "vs_talent_t2_l": b["t"][2][1],
                "vs_talent_t3_w": b["t"][3][0], "vs_talent_t3_l": b["t"][3][1]}

    def control_cols(b):
        secs = b["n"] * 3600
        return {"lead_pct": round(b["lead"] / secs, 4), "tied_pct": round(b["tied"] / secs, 4), "trail_pct": round(b["trail"] / secs, 4),
                "avg_lead": round(b["avg"] / b["n"], 2), "ng_margin_pg": round(b["ng"] / b["n"], 2)}

    rows = []
    for t in sorted(fbs, key=lambda t: (conf(t), name[t])):
        s, d = season[t], info[t]
        site = {k: by_site.get((t, k), blank()) for k in SITES}
        assert sum(site[k]["w"] for k in SITES) == s["w"] and sum(site[k]["l"] for k in SITES) == s["l"]
        for key in ("rw", "rl", "uw", "ul", "cw", "cl"):
            assert sum(site[k][key] for k in SITES) == s[key]
        rows.append({
            "team_id": t, "team": name[t], "display_name": d.get("display_name"), "abbreviation": d.get("abbreviation"),
            "conference": conf(t), "group": group(t), "in_power_set": group(t) != "Other FBS",
            "color": d.get("color"), "alt_color": d.get("alt_color"), "logo": d.get("logo"), "logo_dark": d.get("logo_dark"),
            "wins": s["w"], "losses": s["l"], "win_pct": round(s["w"] / s["n"], 3),
            "ap_rank": ap_rank_now.get(t), "ap_points": ap_points.get(t),
            "ap_status": "Top 25" if t in ap_rank_now else "Receiving votes" if t in ap_points else None,
            "ap_polls_ranked": int(history["count"].get(t, 0)), "ap_best_rank": int(history["min"][t]) if t in ever_ranked else None,
            "ever_ap_ranked": t in ever_ranked, "cfp_rank": cfp_rank.get(t),
            "talent_rank": talent_rank[t], "talent_tier": tier(t),
            "model_rank": model[t]["rank"], "model_score": round(model[t]["score"], 3), "colley": round(model[t]["colley"], 4), "srs": round(model[t]["srs"], 2),
            "top50_rank": top50_rank.get(t), "top50_basis": top50_basis.get(t),
            **category_cols(s),
            "home_w": site["Home"]["w"], "home_l": site["Home"]["l"], "away_w": site["Away"]["w"], "away_l": site["Away"]["l"],
            "neutral_w": site["Neutral"]["w"], "neutral_l": site["Neutral"]["l"],
            **control_cols(s), "margin_pg": round(s["margin"] / s["n"], 2),
            "games_never_trailed": int(never_trailed.get(t, 0)), "comeback_wins_10": int(comebacks.get(t, 0)), "blown_leads_10": int(blown.get(t, 0)),
            "biggest_deficit_overcome": int(big_comeback[t]) if t in big_comeback.index else None,
            "biggest_lead_lost": int(big_blown[t]) if t in big_blown.index else None,
        })
    summary = pd.DataFrame(rows)
    # rank on unrounded values so that rounding does not create ties
    raw_lead = {t: season[t]["lead"] / (season[t]["n"] * 3600) for t in fbs}
    raw_avg = {t: season[t]["avg"] / season[t]["n"] for t in fbs}
    summary["lead_pct_rank"] = summary.team_id.map(raw_lead).rank(ascending=False, method="min").astype(int)
    summary["avg_lead_rank"] = summary.team_id.map(raw_avg).rank(ascending=False, method="min").astype(int)

    split_rows = []
    for t in sorted(fbs, key=lambda t: (top50_rank.get(t, 999), conf(t), name[t])):
        for k in SITES:
            b = by_site.get((t, k))
            if b:
                split_rows.append({"team_id": t, "team": name[t], "conference": conf(t), "top50_rank": top50_rank.get(t), "site": k,
                                   "games": b["n"], "wins": b["w"], "losses": b["l"], **category_cols(b), **control_cols(b)})
    splits = pd.DataFrame(split_rows)

    # ---------------------------------------------------------------- write
    tables = {"team_summary": summary, "top50": top50, "home_away_splits": splits, "games": games,
              "ap_polls": ap_polls, "ap_receiving_votes": ap_receiving, "cfp_rankings": cfp_rankings, "upcoming": upcoming}
    nullable_ints = {"ap_rank", "ap_points", "ap_best_rank", "cfp_rank", "top50_rank", "biggest_deficit_overcome", "biggest_lead_lost",
                     "opp_talent_rank", "opp_cur_rank", "opp_id", "ap_rank_in", "cfp_rank_in", "points", "first_place_votes"}
    OUT_CSV.mkdir(parents=True, exist_ok=True)
    OUT_JSON.mkdir(parents=True, exist_ok=True)
    for tname, df in tables.items():
        undocumented = [c for c in df.columns if c not in SCHEMA[tname]]
        assert not undocumented, f"{tname}: add descriptions for {undocumented} to pipeline/schema.py"
        for c in df.columns:
            if c in nullable_ints:
                df[c] = df[c].astype("Int64")
        df.to_csv(OUT_CSV / f"{tname}.csv", index=False)
        (OUT_JSON / f"{tname}.json").write_text(df.to_json(orient="records", indent=1, force_ascii=False))

    games_through = games.date.max()
    meta = {
        "season": SEASON,
        "built_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "games_through": games_through,
        "completed_games": int(len(done)),
        "fbs_teams": len(fbs),
        "ap_poll": {"latest_week": last_ap_week, "released": pub_ap.get("released") if pub_ap.get("week") == last_ap_week else None,
                    "polls_this_season": int(n_polls), "teams_ranked_this_season": len(ever_ranked),
                    "preseason_released": published["ap_preseason"].get("released")},
        "cfp": {"latest_week": last_cfp_week, "released": pub_cfp.get("released") if cfp_checked else None,
                "next_release": pub_cfp.get("next_release") if cfp_checked else None,
                "note": "CFP ranks predate any games played after the release date."},
        "talent": {**published.get("talent", {}), "tiers": TIER_LABELS},
        "latest_poll": {**latest_poll, "note": "'Currently ranked' uses this poll: the AP poll or the CFP ranking, whichever was released last."},
        "top50": {"basis_counts": top50.basis.value_counts().to_dict(),
                  "note": "Projected rows are this project's estimate, not a published ranking."},
        "model": {"blend": {"colley": W_COLLEY, "srs": round(1 - W_COLLEY, 2)}, "margin_cap": MARGIN_CAP, "fitted_home_edge_points": round(home_edge, 2),
                  "calibration_vs_cfp_committee": calibration},
        "game_control": {**gc_notes, "garbage_time": "lead of 38+ in the 2nd quarter, 28+ in the 3rd, 22+ in the 4th",
                         "scope": "regulation time only; overtime counts toward margins but not time shares"},
        "sources": {
            "games_and_polls": "ESPN data via https://github.com/sportsdataverse/cfbfastR-cfb-raw and https://github.com/sportsdataverse/cfbfastR-cfb-data",
            "play_by_play": "ESPN play-by-play via https://github.com/sportsdataverse/cfbfastR-cfb-data",
            "talent": published.get("talent", {}).get("url"),
            "ap_receiving_votes": "hand-entered from published AP results (data/manual/ap_receiving_votes.csv)",
        },
    }
    (OUT_JSON / "meta.json").write_text(json.dumps(meta, indent=2))

    lines = ["# Data dictionary", "", "Generated by `pipeline/build.py` from `pipeline/schema.py`. Every table is written to `data/csv/<name>.csv` and `data/json/<name>.json` (an array of row objects). `data/json/meta.json` holds as-of dates, definitions and sources.", ""]
    for tname, df in tables.items():
        lines += [f"## {tname}", "", SCHEMA[tname]["_about"], "", f"{len(df)} rows.", "", "| Column | Meaning |", "|---|---|"]
        lines += [f"| `{c}` | {SCHEMA[tname][c]} |" for c in df.columns]
        lines.append("")
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "data-dictionary.md").write_text("\n".join(lines))

    print(f"Built {len(tables)} tables: games through {games_through}, {len(done)} completed games, {len(fbs)} FBS teams.")
    print("Rows:", {k: len(v) for k, v in tables.items()})


if __name__ == "__main__":
    main()
