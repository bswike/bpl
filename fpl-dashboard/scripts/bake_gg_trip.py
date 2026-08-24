#!/usr/bin/env python3
# Scrapes the Golf Genius trip portal (GGID gtripnj26) and bakes results into
# public/data/golftrip-nj26.json for the /golftrip page.
#
# Usage: python3 scripts/bake_gg_trip.py

import html as htmlmod
import http.cookiejar
import json
import re
import time
import urllib.request
from datetime import date
from pathlib import Path

BASE = "https://www.golfgenius.com"
GGID = "gtripnj26"
LEAGUE = "12538093532713337087"
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "golftrip-nj26.json"

WIDGETS = {
    "points": f"{BASE}/leagues/{LEAGUE}/widgets/season_points?page_id=13005150146655174918",
    "teams": f"{BASE}/leagues/{LEAGUE}/widgets/team_standings?page_id=13005154129901797640",
    "players": f"{BASE}/leagues/{LEAGUE}/widgets/players?page_id=12538093566536204534",
    "stats": f"{BASE}/leagues/{LEAGUE}/widgets/player_stats?page_id=12538093569522548988",
    "results": f"{BASE}/leagues/{LEAGUE}/widgets/tournament_results?shared=false",
}

# pretty labels for rounds (option labels in the portal are truncated)
ROUND_META = {
    "12538967499066065276": {"ord": 1, "label": "Crystal Springs — 2v2 Matchplay", "course": "Crystal Springs GC", "date": "Fri, Aug 21"},
    "12538968697496158591": {"ord": 2, "label": "Wild Turkey — 2v2 Pinehurst", "course": "Wild Turkey GC", "date": "Fri, Aug 21"},
    "12538967509098840445": {"ord": 3, "label": "Black Bear — 2v2 Scramble / Pinehurst", "course": "Black Bear GC", "date": "Sat, Aug 22"},
    "12538968708502012288": {"ord": 4, "label": "Black Bear — 1v1 Matchplay", "course": "Black Bear GC", "date": "Sat, Aug 22"},
}

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36")]


def get(url):
    time.sleep(0.7)
    with opener.open(url, timeout=60) as r:
        return r.read().decode("utf-8", errors="ignore")


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmlmod.unescape(s)
    return re.sub(r"\s+", " ", s).replace("\xa0", " ").strip()


def clean(doc):
    return re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", " ", doc, flags=re.S)


def table_rows(doc):
    """All <tr> bodies in the doc (styles/scripts removed)."""
    return re.findall(r"<tr[^>]*>(.*?)</tr>", clean(doc), re.S)


def cells(tr):
    return [strip_tags(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]


def money(s):
    m = re.search(r"\$\s*([\d,]+\.?\d*)", s)
    return float(m.group(1).replace(",", "")) if m else None


def player_name(td_html):
    """Player name is the first link text in a cell; falls back to first line."""
    m = re.search(r"<a[^>]*>(.*?)</a>", td_html, re.S)
    return strip_tags(m.group(1)) if m else strip_tags(td_html)


# --- tournament page parsers -------------------------------------------------

def parse_matches(doc):
    doc = clean(doc)
    matches = []
    for attrs, body in re.findall(r"<tr class='aggregate-row[^']*'([^>]*)>(.*?)</tr>", doc, re.S):
        name_m = re.search(r"data-expanded-aggregate-name='([^']*)'", attrs)
        if not name_m:
            continue
        agg = htmlmod.unescape(name_m.group(1))
        m = re.match(r"(.+?) \((.*?)\) vs (.+?) \((.*?)\)$", agg)
        if not m:
            continue
        team_l, players_l, team_r, players_r = m.groups()
        tds = re.findall(r"<td[^>]*class='([^']*)'[^>]*>(.*?)</td>", body, re.S)
        points = [strip_tags(t) for c, t in tds if "points" in c.split()]
        result = ""
        for c, t in tds:
            cs = c.split()
            if "score" in cs and "hidden-web" not in cs:
                result = strip_tags(t)
                break
        name_tds = [(c, t) for c, t in tds if "name-match-play" in c]
        winner = "tie"
        if len(name_tds) >= 2:
            if "winning-z" in name_tds[0][0]:
                winner = "left"
            elif "winning-z" in name_tds[1][0]:
                winner = "right"
        matches.append({
            "teamL": team_l.strip(),
            "playersL": [p.strip() for p in players_l.split("+")],
            "teamR": team_r.strip(),
            "playersR": [p.strip() for p in players_r.split("+")],
            "result": result if result and result != "\u00a0" else ("Tied" if winner == "tie" else ""),
            "winner": winner,
            "ptsL": float(points[0]) if points else None,
            "ptsR": float(points[-1]) if len(points) > 1 else None,
        })
    totals = None
    for tr in table_rows(doc):
        cs = cells(tr)
        if "TOTAL" in cs:
            nums = [c for c in cs if re.fullmatch(r"-?\d+\.?\d*", c)]
            if len(nums) >= 2:
                totals = {"L": float(nums[0]), "R": float(nums[1])}
    return matches, totals


def parse_skins(doc):
    rows = []
    for tr in table_rows(doc):
        cs = [c for c in cells(tr) if c]
        if len(cs) >= 3 and re.fullmatch(r"\d+", cs[-3] if len(cs) > 3 else cs[1]) and any(c.startswith("$") for c in cs):
            # [name(+club), skins, $purse, details]
            name = player_name(re.search(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S).group(1))
            ints = [c for c in cs if re.fullmatch(r"\d+", c)]
            purse = next((money(c) for c in cs if c.startswith("$")), None)
            details = cs[-1] if ("on " in cs[-1] or "," in cs[-1]) and not cs[-1].startswith("$") else ""
            if name and ints:
                rows.append({"player": name, "skins": int(ints[0]), "purse": purse, "details": details})
    return rows


def parse_leaderboard(doc, kind):
    """quota: [pos, player, +/-, gross, purse]; netlow: [pos, player, toPar, r1, r2, total, purse]"""
    rows = []
    for tr in table_rows(doc):
        raw_tds = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
        cs = [strip_tags(c) for c in raw_tds]
        nz = [c for c in cs if c]
        if len(nz) < 3 or not re.fullmatch(r"T?\d+", nz[0]):
            continue
        name = ""
        for td in raw_tds:
            m = re.search(r"<a[^>]*>(.*?)</a>", td, re.S)
            if m and strip_tags(m.group(1)):
                name = strip_tags(m.group(1))
                break
        if not name:
            name = nz[1]
        purse = next((money(c) for c in nz if c.startswith("$")), None)
        nums = [c for c in nz[1:] if re.fullmatch(r"[+-]?\d+", c)]
        if kind == "quota":
            rows.append({
                "pos": nz[0],
                "player": name,
                "quota": int(nums[0]) if nums else None,
                "gross": int(nums[1]) if len(nums) > 1 else None,
                "purse": purse,
            })
        else:  # netlow
            to_par = next((c for c in nz if re.fullmatch(r"[+-]\d+|E", c)), None)
            rows.append({
                "pos": nz[0],
                "player": name,
                "toPar": to_par,
                "rounds": [int(n) for n in nums[-3:-1]] if len(nums) >= 3 else [],
                "total": int(nums[-1]) if nums else None,
                "purse": purse,
            })
    return rows


def parse_list(doc):
    """CTP / Longest Drive winner lists: [pos?, player(+club), purse, details]"""
    rows = []
    for tr in table_rows(doc):
        raw_tds = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
        cs = [strip_tags(c) for c in raw_tds]
        nz = [c for c in cs if c and c != "\u00a0"]
        if not nz or nz[0] in ("Pos.", "Player") or "No results" in " ".join(nz) or "Total Purse" in nz[0]:
            continue
        name = ""
        for td in raw_tds:
            m = re.search(r"<a[^>]*>(.*?)</a>", td, re.S)
            if m and strip_tags(m.group(1)):
                name = strip_tags(m.group(1))
                break
        if not name:
            # winner rows often have no player link: skip pos-ish first cell, take next
            cand = [c for c in nz if not re.fullmatch(r"T?\d+|None", c) and not c.startswith("$")]
            name = cand[0].split("  ")[0].strip() if cand else ""
            # cell may include the club on the same line; keep just the name part
            name = re.sub(r"\s{2,}.*$", "", name)
        purse = next((money(c) for c in nz if c.startswith("$")), None)
        # winner rows always carry a purse; everything else here is portal chrome
        if not name or purse is None:
            continue
        details = nz[-1] if nz[-1] != name and not nz[-1].startswith("$") else ""
        rows.append({"player": name, "purse": purse, "details": details})
    return rows


def parse_teamnet(doc):
    """Team net leaderboards (e.g. back-nine pairs): [pos, players, toPar, total, purse]"""
    rows = []
    for tr in table_rows(doc):
        cs = [c for c in cells(tr) if c and c != "\u00a0"]
        if len(cs) < 4 or not re.fullmatch(r"T?\d+", cs[0]):
            continue
        pair = next((c for c in cs if " + " in c), None)
        to_par = next((c for c in cs if re.fullmatch(r"[+-]\d+|E", c)), None)
        ints = [c for c in cs[1:] if re.fullmatch(r"\d+", c)]
        purse = next((money(c) for c in cs if c.startswith("$")), None)
        if pair:
            rows.append({
                "pos": cs[0],
                "players": [p.strip() for p in pair.split("+")],
                "toPar": to_par,
                "total": int(ints[-1]) if ints else None,
                "purse": purse,
            })
    return rows


def classify_and_parse(doc):
    text = strip_tags(clean(doc))
    if "aggregate-row" in doc:
        matches, totals = parse_matches(doc)
        if matches:
            return "match", {"matches": matches, "totals": totals}
    if "+/- Quota" in text:
        return "quota", {"rows": parse_leaderboard(doc, "quota")}
    if re.search(r"\bSkins\b.*\bPurse\b", text):
        return "skins", {"rows": parse_skins(doc)}
    if "To Par" in text and re.search(r"\bR1\b", text):
        return "netlow", {"rows": parse_leaderboard(doc, "netlow")}
    if "To Par" in text and " + " in text:
        return "teamnet", {"rows": parse_teamnet(doc)}
    if "No results yet" in text:
        return "empty", {}
    return "list", {"rows": parse_list(doc)}


# --- main ---------------------------------------------------------------------

print("Establishing session...")
get(f"{BASE}/ggid/{GGID}")

print("Fetching widgets...")
w = {k: get(u) for k, u in WIDGETS.items()}

# roster: name -> handicap index
roster = {}
for tr in table_rows(w["players"]):
    cs = [c for c in cells(tr) if c]
    if len(cs) == 2 and re.fullmatch(r"[+]?\d+\.\d", cs[1]):
        roster[cs[0]] = cs[1]

# trip standings: name -> purse, avg net
standings = {}
for tr in table_rows(w["points"]):
    cs = [c for c in cells(tr) if c]
    if len(cs) >= 3 and cs[1].startswith("$"):
        standings[cs[0]] = {"purse": money(cs[1]), "avgNet": float(cs[2])}

# team standings
teams = []
for tr in table_rows(w["teams"]):
    cs = [c for c in cells(tr) if c]
    if len(cs) >= 5 and cs[0] in ("North", "South"):
        teams.append({
            "name": cs[0],
            "points": float(cs[1]),
            "participation": float(cs[2]),
            "total": float(cs[3]),
            "purse": money(cs[4]),
        })

# scoring distribution: name -> [eagle, birdie, par, bogey, double, triple+]
dist = {}
for tr in table_rows(w["stats"]):
    cs = [c for c in cells(tr) if c]
    if len(cs) == 7 and all(re.fullmatch(r"\d+", c) for c in cs[1:]):
        dist[cs[0]] = [int(c) for c in cs[1:]]

# rounds + tournaments
options = re.findall(r'<option[^>]*value="(\d+)"[^>]*>(.*?)</option>', w["results"])
print(f"Rounds found: {len(options)}")
rounds = []
seen_tids = {}
for rid, opt_label in options:
    page = get(f"{BASE}/leagues/{LEAGUE}/widgets/tournament_results?round={rid}&shared=false")
    tids = []
    for m in re.finditer(r'/v2tournaments/(\d+)\?[^"]*round_index=(\d+)[^"]*"[^>]*>([^<]{3,80})', page):
        tid, ri, name = m.group(1), m.group(2), strip_tags(m.group(3))
        if tid not in [t[0] for t in tids]:
            tids.append((tid, ri, name))
    meta = ROUND_META.get(rid, {"ord": 99, "label": strip_tags(opt_label), "course": "", "date": ""})
    rnd = {"id": rid, **meta, "tournaments": []}
    for tid, ri, name in tids:
        if tid in seen_tids:
            kind, data = seen_tids[tid]
        else:
            doc = get(f"{BASE}/v2tournaments/{tid}?called_from=widgets%2Ftournament_results&player_stats_for_portal=true&round_index={ri}")
            kind, data = classify_and_parse(doc)
            seen_tids[tid] = (kind, data)
            print(f"  [{meta['label'][:34]:36}] {name[:42]:44} -> {kind} ({len(data.get('matches', data.get('rows', []))) if data else 0})")
        rnd["tournaments"].append({"id": tid, "name": name, "type": kind, **data})
    rounds.append(rnd)

# --- aggregate per-player ------------------------------------------------------
players = {}


def resolve(name):
    """Winner cells sometimes append the club to the name; match against roster."""
    if name in roster:
        return name
    for r in roster:
        if name.startswith(r):
            return r
    return name


def P(name):
    name = resolve(name)
    if name not in players:
        players[name] = {
            "name": name, "team": None, "hi": roster.get(name),
            "purse": standings.get(name, {}).get("purse", 0.0),
            "avgNet": standings.get(name, {}).get("avgNet"),
            "w": 0, "l": 0, "t": 0, "matchPts": 0.0,
            "skins": 0, "skinsPurse": 0.0, "skinDetails": [],
            "ctps": [], "matches": [],
            "dist": dist.get(name),
        }
    return players[name]


# normalize club-suffixed names in round rows so the UI shows clean names
for rnd in rounds:
    for t in rnd["tournaments"]:
        for row in t.get("rows", []):
            if "player" in row:
                row["player"] = resolve(row["player"])

netlow = None
for rnd in rounds:
    for t in rnd["tournaments"]:
        if t["type"] == "match":
            for m in t["matches"]:
                for side, other, res in (("L", "R", "left"), ("R", "L", "right")):
                    for pl in m[f"players{side}"]:
                        p = P(pl)
                        p["team"] = m[f"team{side}"]
                        if m["winner"] == "tie":
                            p["t"] += 1
                            outcome = "T"
                        elif m["winner"] == res:
                            p["w"] += 1
                            outcome = "W"
                        else:
                            p["l"] += 1
                            outcome = "L"
                        if m[f"pts{side}"] is not None:
                            p["matchPts"] += m[f"pts{side}"]
                        partner = [x for x in m[f"players{side}"] if x != pl]
                        p["matches"].append({
                            "round": rnd["label"], "format": t["name"], "outcome": outcome,
                            "result": m["result"],
                            "partner": partner[0] if partner else None,
                            "opp": " + ".join(m[f"players{other}"]),
                        })
        elif t["type"] == "skins":
            for r in t["rows"]:
                p = P(r["player"])
                p["skins"] += r["skins"]
                p["skinsPurse"] += r["purse"] or 0
                if r["details"]:
                    p["skinDetails"].append(f"{rnd['course']}: {r['details']}")
        elif t["type"] == "list":
            for r in t["rows"]:
                P(r["player"])["ctps"].append({"event": t["name"], "round": rnd["course"], "purse": r.get("purse"), "details": r["details"]})
        elif t["type"] == "netlow" and netlow is None:
            netlow = {"name": t["name"], "rows": t["rows"]}

# roster players who never appear in results still get a row
for name in roster:
    P(name)

out = {
    "trip": {
        "name": "Crystal Springs '26",
        "ggid": GGID,
        "dates": "Aug 20\u201323, 2026",
        "location": "Crystal Springs Resort \u00b7 Hamburg, NJ",
        "fetched": date.today().isoformat(),
    },
    "teams": teams,
    "players": sorted(players.values(), key=lambda p: -(p["purse"] or 0)),
    "rounds": sorted(rounds, key=lambda r: r.get("ord", 99)),
    "netlow": netlow,
}
OUT.write_text(json.dumps(out))
mp = sum(1 for r in rounds for t in r["tournaments"] if t["type"] == "match")
print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")
print(f"players={len(players)} teams={len(teams)} rounds={len(rounds)} matchTournaments={mp}")
for t in teams:
    print(f"  {t['name']}: {t['total']} pts, ${t['purse']}")
