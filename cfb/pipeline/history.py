#!/usr/bin/env python3
"""Past seasons (2004-2025) for the team history pages.

    bash pipeline/fetch_history.sh   # once: feeds into data/raw/history (not committed)
    python pipeline/history.py

Applies the 2026 definitions to each completed season, with two differences that suit a finished season:
- Postseason games (bowls and playoff) count. Records are full-season records; post_w/post_l split them out.
- "AP-ranked at least once" spans every AP poll of that season, preseason through the final (post-bowl) poll.
- "Currently ranked" means ranked in the season's last poll, which is the post-bowl AP poll.

Writes data/history/team_seasons.{csv,json}, data/history/games.{csv,json} and data/history/meta.json.
Per-game game-control numbers are cached in data/derived/history so the build runs without play-by-play.
"""
import datetime as dt
import json
import re
from collections import Counter
import sys
import unicodedata
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game_control import build_game_control  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "history"
MANUAL = ROOT / "data" / "manual"
DERIVED = ROOT / "data" / "derived" / "history"
OUT = ROOT / "data" / "history"

SEASONS = list(range(2004, 2026))
ET = ZoneInfo("America/New_York")
CONF_LABEL = {"CUSA": "C-USA", "FBS Indep.": "Ind"}
# conference names in cfb_schedules -> the site's labels
ALT_CONF_LABEL = {"Mid-American": "MAC", "Conference USA": "C-USA", "American Athletic": "American",
                  "FBS Independents": "Ind", "FCS Independents": "Ind", "Western Athletic": "WAC"}
NOTRE_DAME = 87
SITES = ["Home", "Away", "Neutral"]

# 247 names that do not match any ESPN name for the team after normalising.
TALENT_ALIASES = {
    "louisiana monroe": "UL Monroe",
    "san jose state": "San José State",
    "hawaii": "Hawai'i",
    "miami": "Miami",
    "miami oh": "Miami (OH)",
}


def warn(msg):
    print(f"WARNING: {msg}", file=sys.stderr)


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ").replace("'", "")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def power_conferences(season):
    """BCS automatic-qualifier conferences through 2013 (Big East included), Power 5 2014-2023, Power 4 after."""
    base = {"ACC", "Big 12", "Big Ten", "SEC"}
    if season <= 2013:  # the American kept the Big East's BCS automatic bid in 2013, its first season under that name
        return base | {"Pac-10", "Pac-12", "Big East"} | ({"American"} if season == 2013 else set())
    return base | ({"Pac-12"} if season <= 2023 else set())


def load_talent():
    out = {}
    for line in (MANUAL / "talent_247_history.txt").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        season, updated, names = line.split("|")
        out[int(season)] = (updated, names.split(";"))
    return out


def fill_missing_games(season, sched):
    """Add completed games that the raw schedule lacks, from the second schedule source.

    The raw 2022 schedule has no week 3 or week 12 games. cfb_schedules uses the same ESPN game ids;
    quarter scores come from the linescores table and are written in the raw file's format.
    """
    alt_path, lines_path = RAW / f"cfb_schedules_{season}.parquet", RAW / f"linescores_{season}.parquet"
    if not (alt_path.exists() and lines_path.exists()):
        warn(f"{season}: no second schedule source; run pipeline/fetch_history.sh")
        return sched, 0
    alt = pd.read_parquet(alt_path)
    # no fbs_participant filter: it misses teams moving up to FBS (Old Dominion 2013); FBS games are picked later
    alt = alt[(alt.completed == True) & alt.season_type.isin(["regular", "postseason"])  # noqa: E712
              & alt.home_points.notna() & alt.away_points.notna()]
    alt = alt[~alt.game_id.astype(int).isin(set(sched.id.astype(int)))]
    if alt.empty:
        return sched, 0
    lines = pd.read_parquet(lines_path)
    lines["value"] = pd.to_numeric(lines["value"], errors="coerce")
    q = {k: g.sort_values("period")["value"].tolist() for k, g in lines.groupby(["game_id", "team_id"])}

    def linescore(gid, tid):
        return str([{"value": float(v)} for v in q.get((gid, tid), [])])

    add = pd.DataFrame({
        "id": alt.game_id.astype(int), "date": alt.start_date, "week": alt.week.astype(int),
        "season_type": alt.season_type.map({"regular": 2, "postseason": 3}),
        "status_type_completed": True, "neutral_site": alt.neutral_site.astype(bool),
        "notes_headline": alt.notes, "home_id": alt.home_id.astype(int), "away_id": alt.away_id.astype(int),
        "home_location": alt.home_team, "away_location": alt.away_team,
        "home_score": alt.home_points.astype(int), "away_score": alt.away_points.astype(int),
        "home_linescores": [linescore(g, h) for g, h in zip(alt.game_id, alt.home_id)],
        "away_linescores": [linescore(g, a) for g, a in zip(alt.game_id, alt.away_id)],
    })
    return pd.concat([sched, add], ignore_index=True), len(add)


def build_season(season, talent_lists):
    sched = pd.read_csv(RAW / f"cfb_schedule_{season}.csv", low_memory=False)
    polls = pd.read_parquet(RAW / f"cfb_poll_analytics_{season}.parquet")
    teams = pd.read_parquet(RAW / f"cfb_teams_{season}.parquet")
    teams["team_id"] = teams.team_id.astype(int)
    notes = {"season": season}
    sched, filled = fill_missing_games(season, sched)
    if filled:
        notes["games_filled_from_second_source"] = filled

    # ------------------------------------------------------------ FBS teams and names
    # is_fbs also flags all-star teams; they have no conference.
    fbs_rows = teams[(teams.is_fbs == True) & teams.conference_short_name.notna()]  # noqa: E712
    # ...and some seasons (2015) flag all-star squads with a conference too, so keep teams that played a game.
    played = sched[sched.season_type.isin([2, 3]) & (sched.status_type_completed == True)]  # noqa: E712
    played = set(played.home_id.astype(int)) | set(played.away_id.astype(int))
    fbs_rows = fbs_rows[fbs_rows.team_id.isin(played)]
    fbs = set(fbs_rows.team_id)
    conf = {int(r.team_id): CONF_LABEL.get(r.conference_short_name, r.conference_short_name) for r in fbs_rows.itertuples()}
    # ESPN's team feed gives some teams their current conference in past seasons (Utah, TCU and BYU in the 2010
    # "Big 12", Boise State in the 2012 "Pac-12"). cfb_schedules names each team's conference per game, which is
    # right for those cases, so use the conference a team played most of its regular-season games under.
    alt_path = RAW / f"cfb_schedules_{season}.parquet"
    if alt_path.exists():
        alt = pd.read_parquet(alt_path, columns=["season_type", "home_id", "home_conference", "away_id", "away_conference"])
        alt = alt[alt.season_type == "regular"]
        seen_conf = {}
        for tid, cf in list(zip(alt.home_id, alt.home_conference)) + list(zip(alt.away_id, alt.away_conference)):
            if isinstance(cf, str):
                seen_conf.setdefault(int(tid), Counter())[cf] += 1
        changed = 0
        for tid in conf:
            if tid in seen_conf:
                label = seen_conf[tid].most_common(1)[0][0]
                label = ALT_CONF_LABEL.get(label, label)
                changed += label != conf[tid]
                conf[tid] = label
        notes["conference_fixes"] = changed
    name = {}
    for side in ("home", "away"):
        for tid, loc in zip(sched[f"{side}_id"], sched[f"{side}_location"]):
            name.setdefault(int(tid), loc)
    for r in teams.itertuples():
        name.setdefault(int(r.team_id), r.location)
    notes["fbs_teams"] = len(fbs)

    # ------------------------------------------------------------ talent (247 composite, re-ranked among FBS)
    has_talent = season in talent_lists  # 247's composite starts in 2015
    updated, order = talent_lists.get(season, (None, []))
    lookup = {}
    for r in fbs_rows.itertuples():
        for v in (r.location, r.short_display_name, r.school, r.nickname, getattr(r, "alt_name1", None), getattr(r, "alt_name2", None), getattr(r, "alt_name3", None)):
            if isinstance(v, str) and v:
                lookup.setdefault(norm(v), int(r.team_id))
    for k, v in TALENT_ALIASES.items():
        hit = [int(r.team_id) for r in fbs_rows.itertuples() if r.location == v]
        if hit:
            lookup[k] = hit[0]
    talent_rank, seen = {}, set()
    for n in order:
        tid = lookup.get(norm(n))
        if tid is None or tid in seen:
            continue
        seen.add(tid)
        talent_rank[tid] = len(talent_rank) + 1
    notes["talent_last_updated"] = updated
    notes["talent_unranked_fbs"] = sorted(name[t] for t in fbs - set(talent_rank)) if has_talent else None

    def tier(t):
        if not has_talent:
            return None
        r = talent_rank.get(t)  # FCS teams and teams 247 does not list land in 76+
        return 4 if r is None else 1 if r <= 25 else 2 if r <= 50 else 3 if r <= 75 else 4

    # ------------------------------------------------------------ games
    done = sched[sched.season_type.isin([2, 3]) & (sched.status_type_completed == True)].copy()  # noqa: E712
    done = done[done.home_id.isin(fbs) | done.away_id.isin(fbs)]
    notes["completed_games"] = int(len(done))

    # ------------------------------------------------------------ AP and CFP
    ap = polls[(polls.poll == "ap") & polls["rank"].notna()].copy()
    ap["key"] = list(zip(ap.season_type.astype(int), ap.week.astype(int)))
    pre = {int(t): int(r) for t, r in zip(ap[ap.key == (2, 1)].team_id, ap[ap.key == (2, 1)]["rank"])}
    if not pre:  # the feed lacks the preseason poll: recover it from week-1 game ranks, as for 2026
        w1 = sched[(sched.season_type == 2) & (sched.week == 1)]
        for side in ("home", "away"):
            for tid, rk in zip(w1[f"{side}_id"], w1[f"{side}_current_rank"]):
                if pd.notna(rk) and rk <= 25:
                    pre[int(tid)] = int(rk)
        notes["ap_preseason_source"] = "week-1 game ranks"
        if len(pre) != 25:
            warn(f"{season}: preseason AP poll recovered {len(pre)} teams, expected 25")
    else:
        notes["ap_preseason_source"] = "poll feed"
    polls_by_team = {}
    for t, r in pre.items():
        polls_by_team.setdefault(t, []).append(r)
    for r in ap[ap.key != (2, 1)].itertuples():
        polls_by_team.setdefault(int(r.team_id), []).append(int(r.rank))
    ever_ranked = set(polls_by_team)
    final_key = max(ap.key)
    final_ap = {int(t): int(r) for t, r in zip(ap[ap.key == final_key].team_id, ap[ap.key == final_key]["rank"])}
    notes["ap_polls"] = int(ap.key.nunique() + (0 if (2, 1) in set(ap.key) else 1))
    notes["ap_final"] = "post-bowl poll" if final_key[0] == 3 else f"week {final_key[1]} poll"
    notes["teams_ap_ranked"] = len(ever_ranked)

    cfp = polls[(polls.poll == "cfp") & polls["rank"].notna()].copy()
    cfp_final, k = {}, None
    if len(cfp):
        cfp["key"] = list(zip(cfp.season_type.astype(int), cfp.week.astype(int)))
        k = max(cfp.key)
        cfp_final = {int(t): int(r) for t, r in zip(cfp[cfp.key == k].team_id, cfp[cfp.key == k]["rank"])}

    # ------------------------------------------------------------ each team's rank going into each game
    # Poll week N is the poll in effect for week N games (week 1 = preseason). A week with no poll in the feed uses
    # the most recent earlier one; postseason games use the last regular-season poll / committee ranking.
    def by_week(df):
        out = {}
        for r in df[df.season_type.astype(int) == 2].itertuples():
            out.setdefault(int(r.week), {})[int(r.team_id)] = int(r.rank)
        return out
    ap_week = by_week(ap)
    ap_week[1] = dict(pre)
    cfp_week = by_week(cfp) if len(cfp) else {}

    def rank_in(weeks, team, week, post):
        keys = [k for k in weeks if post or k <= week]
        return weeks[max(keys)].get(team) if keys else None

    # ------------------------------------------------------------ latest poll ("currently ranked")
    # The last poll of the season. The AP poll after the bowls comes out after the committee's final ranking
    # (selection day), so it wins whenever the feed has it; otherwise the later of the two by (season type, week).
    if final_key[0] == 3 or not cfp_final or final_key >= k:
        cur_rank, latest = final_ap, {"poll": "AP", "label": notes["ap_final"]}
    else:
        cur_rank, latest = cfp_final, {"poll": "CFP", "label": "final committee ranking"}
    notes["latest_poll"] = latest

    # ------------------------------------------------------------ game control
    pbp = RAW / f"play_by_play_{season}.parquet"
    cache = DERIVED / f"game_control_{season}.csv"
    if pbp.exists():
        gc_games, gc_notes = build_game_control(pbp, done[["id", "date", "week", "home_id", "away_id", "home_score", "away_score", "home_linescores", "away_linescores"]], strict=False)
        DERIVED.mkdir(parents=True, exist_ok=True)
        gc_games.to_csv(cache, index=False)
        (DERIVED / f"game_control_notes_{season}.json").write_text(json.dumps(gc_notes, indent=2))
    else:
        warn(f"{season}: no play-by-play file; using the cached game-control numbers")
        gc_games = pd.read_csv(cache, float_precision="round_trip")
        gc_notes = json.loads((DERIVED / f"game_control_notes_{season}.json").read_text())
    gc = {(int(r.game_id), int(r.team_id)): r for r in gc_games.itertuples()}
    no_control = sorted(set(done.id.astype(int)) - set(gc_games.game_id.astype(int)))
    notes["game_control"] = {**gc_notes, "games_without_control": len(no_control)}

    # ------------------------------------------------------------ records and game log
    def blank():
        return dict(n=0, w=0, l=0, pw=0, pl=0, rw=0, rl=0, uw=0, ul=0, cw=0, cl=0, t={1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0]},
                    margin=0, cn=0, lead=0.0, tied=0.0, trail=0.0, avg=0.0, ng=0.0, nt=0, cb=0, bl=0)

    season_tot, by_site, rows = {}, {}, []
    for g in done.itertuples():
        gid, home, away = int(g.id), int(g.home_id), int(g.away_id)
        hs, as_ = int(g.home_score), int(g.away_score)
        if hs == as_:
            warn(f"{season}: game {gid} ended level; skipped")
            continue
        date = pd.Timestamp(g.date).tz_convert(ET).date().isoformat() if pd.Timestamp(g.date).tzinfo else pd.Timestamp(g.date).tz_localize("UTC").tz_convert(ET).date().isoformat()
        neutral = bool(g.neutral_site)
        post = int(g.season_type) == 3
        note = g.notes_headline if isinstance(getattr(g, "notes_headline", None), str) else None
        for team, opp, pf, pa, site in ((home, away, hs, as_, "Neutral" if neutral else "Home"), (away, home, as_, hs, "Neutral" if neutral else "Away")):
            if team not in fbs:
                continue
            win = pf > pa
            c = gc.get((gid, team))
            for b in (season_tot.setdefault(team, blank()), by_site.setdefault((team, site), blank())):
                b["n"] += 1
                b["w" if win else "l"] += 1
                if post:
                    b["pw" if win else "pl"] += 1
                b[("r" if opp in ever_ranked else "u") + ("w" if win else "l")] += 1
                if opp in cur_rank:
                    b["c" + ("w" if win else "l")] += 1
                if has_talent:
                    b["t"][tier(opp)][0 if win else 1] += 1
                b["margin"] += pf - pa
                if c is not None:
                    b["cn"] += 1
                    b["lead"] += c.lead_s
                    b["tied"] += c.tied_s
                    b["trail"] += c.trail_s
                    b["avg"] += c.avg_lead
                    b["ng"] += c.ng_margin
                    b["nt"] += int(win and c.max_deficit == 0)
                    b["cb"] += int(win and c.max_deficit >= 10)
                    b["bl"] += int((not win) and c.max_lead >= 10)
            rows.append(dict(
                season=season, game_id=gid, date=date, week=int(g.week), season_type="Postseason" if post else "Regular", note=note,
                team_id=team, team=name[team], opp_id=opp, opp=name.get(opp, str(opp)), opp_is_fbs=opp in fbs,
                site=site, result="W" if win else "L", points_for=pf, points_against=pa, margin=pf - pa,
                overtime=bool(c.overtime) if c is not None else None,
                ap_rank_in=rank_in(ap_week, team, int(g.week), post), cfp_rank_in=rank_in(cfp_week, team, int(g.week), post),
                opp_ever_ap_ranked=opp in ever_ranked, opp_cur_rank=cur_rank.get(opp), opp_talent_rank=talent_rank.get(opp), opp_talent_tier=tier(opp),
                led_pct=round(c.lead_s / 3600, 4) if c is not None else None,
                tied_pct=round(c.tied_s / 3600, 4) if c is not None else None,
                trailed_pct=round(c.trail_s / 3600, 4) if c is not None else None,
                avg_lead=round(c.avg_lead, 2) if c is not None else None,
                biggest_lead=int(c.max_lead) if c is not None else None,
                biggest_deficit=int(c.max_deficit) if c is not None else None,
                ng_margin=int(c.ng_margin) if c is not None else None))

    def control(b):
        if not b["cn"]:
            return dict(lead_pct=None, tied_pct=None, trail_pct=None, avg_lead=None, ng_margin_pg=None)
        s = b["cn"] * 3600
        return dict(lead_pct=round(b["lead"] / s, 4), tied_pct=round(b["tied"] / s, 4), trail_pct=round(b["trail"] / s, 4),
                    avg_lead=round(b["avg"] / b["cn"], 2), ng_margin_pg=round(b["ng"] / b["cn"], 2))

    def cats(b):
        return {"vs_ap_ranked_w": b["rw"], "vs_ap_ranked_l": b["rl"], "vs_ap_unranked_w": b["uw"], "vs_ap_unranked_l": b["ul"],
                "vs_cur_ranked_w": b["cw"], "vs_cur_ranked_l": b["cl"],
                **({"vs_talent_t1_w": b["t"][1][0], "vs_talent_t1_l": b["t"][1][1], "vs_talent_t2_w": b["t"][2][0], "vs_talent_t2_l": b["t"][2][1]}
                   if has_talent else {"vs_talent_t1_w": None, "vs_talent_t1_l": None, "vs_talent_t2_w": None, "vs_talent_t2_l": None}),
                "vs_talent_t3_w": b["t"][3][0] if has_talent else None, "vs_talent_t3_l": b["t"][3][1] if has_talent else None,
                "vs_talent_t4_w": b["t"][4][0] if has_talent else None, "vs_talent_t4_l": b["t"][4][1] if has_talent else None}

    power = power_conferences(season)
    out = []
    for t in sorted(season_tot, key=lambda t: name[t]):
        s = season_tot[t]
        site = {k: by_site.get((t, k), blank()) for k in SITES}
        assert sum(site[k]["w"] for k in SITES) == s["w"] and sum(site[k]["l"] for k in SITES) == s["l"]
        ranks = polls_by_team.get(t, [])
        out.append({
            "season": season, "team_id": t, "team": name[t], "conference": conf[t],
            "in_power_set": conf[t] in power or t == NOTRE_DAME,
            "wins": s["w"], "losses": s["l"], "post_w": s["pw"], "post_l": s["pl"],
            "ap_pre_rank": pre.get(t), "ap_final_rank": final_ap.get(t), "ap_best_rank": min(ranks) if ranks else None,
            "ap_polls_ranked": len(ranks), "ever_ap_ranked": t in ever_ranked, "cfp_final_rank": cfp_final.get(t),
            "talent_rank": talent_rank.get(t), "talent_tier": tier(t),
            **cats(s),
            "home_w": site["Home"]["w"], "home_l": site["Home"]["l"], "away_w": site["Away"]["w"], "away_l": site["Away"]["l"],
            "neutral_w": site["Neutral"]["w"], "neutral_l": site["Neutral"]["l"],
            **control(s), "margin_pg": round(s["margin"] / s["n"], 2), "control_games": s["cn"],
            "games_never_trailed": s["nt"], "comeback_wins_10": s["cb"], "blown_leads_10": s["bl"],
            "_lead_raw": s["lead"] / (s["cn"] * 3600) if s["cn"] else None,
            "sites": {k: {"games": site[k]["n"], "wins": site[k]["w"], "losses": site[k]["l"], **cats(site[k]), **control(site[k])} for k in SITES if site[k]["n"]},
        })
    df = pd.DataFrame(out)
    df["lead_pct_rank"] = df._lead_raw.rank(ascending=False, method="min").astype("Int64")
    df = df.drop(columns="_lead_raw")
    missing = fbs - set(season_tot)
    if missing:
        notes["fbs_teams_without_games"] = sorted(name[t] for t in missing)
    return df, pd.DataFrame(rows), notes


def main():
    talent = load_talent()
    seasons, games, meta = [], [], {"built_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "seasons": {}}
    for season in SEASONS:
        df, g, notes = build_season(season, talent)
        seasons.append(df)
        games.append(g)
        meta["seasons"][str(season)] = notes
        print(f"{season}: {len(df)} FBS teams, {notes['completed_games']} games, talent unranked: {notes['talent_unranked_fbs']}, "
              f"no control: {notes['game_control']['games_without_control']}")
    ts = pd.concat(seasons, ignore_index=True)
    gm = pd.concat(games, ignore_index=True).sort_values(["team", "season", "date"]).reset_index(drop=True)
    nullable = ["ap_pre_rank", "ap_final_rank", "ap_best_rank", "cfp_final_rank", "talent_rank", "lead_pct_rank",
                "opp_talent_rank", "opp_cur_rank", "ap_rank_in", "cfp_rank_in", "biggest_lead", "biggest_deficit", "ng_margin"]
    for df in (ts, gm):
        for c in nullable:
            if c in df:
                df[c] = df[c].astype("Int64")
    OUT.mkdir(parents=True, exist_ok=True)
    ts.drop(columns="sites").to_csv(OUT / "team_seasons.csv", index=False)
    (OUT / "team_seasons.json").write_text(ts.to_json(orient="records", force_ascii=False))
    gm.to_csv(OUT / "games.csv", index=False)
    (OUT / "games.json").write_text(gm.to_json(orient="records", force_ascii=False))
    meta["sources"] = {
        "games_polls_pbp": "ESPN data via https://github.com/sportsdataverse/cfbfastR-cfb-raw and https://github.com/sportsdataverse/cfbfastR-cfb-data",
        "talent": "247Sports Team Talent Composite, https://247sports.com/season/<year>-football/collegeteamtalentcomposite/ (data/manual/talent_247_history.txt)",
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Wrote {len(ts)} team-seasons and {len(gm)} team-games to {OUT}")


if __name__ == "__main__":
    main()
