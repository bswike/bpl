#!/usr/bin/env python3
# Scrapes a Golf Genius trip portal and bakes results into public/data/.
#
# Usage:
#   python3 scripts/bake_gg_trip.py          # Crystal Springs '26
#   python3 scripts/bake_gg_trip.py 2025     # Gull Lake '25

import html as htmlmod
import http.cookiejar
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

BASE = "https://www.golfgenius.com"
DATA = Path(__file__).resolve().parent.parent / "public" / "data"

TRIPS = {
    "nj26": {
        "id": "nj26",
        "ggid": "gtripnj26",
        "league": "12538093532713337087",
        "out": DATA / "golftrip-nj26.json",
        "name": "Crystal Springs '26",
        "dates": "Aug 20–23, 2026",
        "location": "Crystal Springs Resort · Hamburg, NJ",
        "widgets": {
            "points": "season_points?page_id=13005150146655174918",
            "teams": "team_standings?page_id=13005154129901797640",
            "players": "players?page_id=12538093566536204534",
            "stats": "player_stats?page_id=12538093569522548988",
            "results": "tournament_results?shared=false",
        },
        "points_page": "13005150146655174918",
        "rounds": {
            "12538967499066065276": {"ord": 1, "label": "Crystal Springs — 2v2 Matchplay", "course": "Crystal Springs GC", "date": "Fri, Aug 21", "slug": "crystal-springs"},
            "12538968697496158591": {"ord": 2, "label": "Wild Turkey — 2v2 Pinehurst", "course": "Wild Turkey GC", "date": "Fri, Aug 21", "slug": "wild-turkey"},
            "12538967509098840445": {"ord": 3, "label": "Black Bear — 2v2 Scramble / Pinehurst", "course": "Black Bear GC", "date": "Sat, Aug 22", "slug": "black-bear"},
            "12538968708502012288": {"ord": 4, "label": "Black Bear — 1v1 Matchplay", "course": "Black Bear GC", "date": "Sat, Aug 22", "slug": "black-bear"},
            "12538967519366496638": {"ord": 5, "label": "Ballyowen — Open Game", "course": "Ballyowen GC", "date": "Sun, Aug 23"},
        },
    },
    "2025": {
        "id": "2025",
        "ggid": "2024southgotthewin",
        "league": "11813537078585606364",
        "out": DATA / "golftrip-2025.json",
        "name": "Gull Lake '25",
        "dates": "Sep 4–7, 2025",
        "location": "Gull Lake View · Augusta, MI",
        "widgets": {
            "points": "season_points?page_id=11813537115529036075",
            "teams": "team_standings?page_id=11830973749937586480",
            "players": "players?page_id=11813537112643354918",
            "stats": "player_stats?page_id=11813537116401451308",
            "results": "tournament_results?shared=false",
        },
        "points_page": "11813537115529036075",
        "rounds": {
            "11813567159731241074": {"ord": 1, "label": "2v2 Stableford", "course": "Gull Lake View", "date": "Thu, Sep 4"},
            "11813567948193284211": {"ord": 2, "label": "2v2 Scramble", "course": "Gull Lake View", "date": "Thu, Sep 4"},
            "11813568699175026804": {"ord": 3, "label": "Fri — 2v2 Matchplay", "course": "Gull Lake View", "date": "Fri, Sep 5"},
            "11813569017573032053": {"ord": 4, "label": "Fri — 2v2 Pinehurst", "course": "Gull Lake View", "date": "Fri, Sep 5"},
            "11813569274566426742": {"ord": 5, "label": "Sat — 2v2 Matchplay", "course": "Gull Lake View", "date": "Sat, Sep 6"},
            "11813569556188774519": {"ord": 6, "label": "1v1 Matchplay", "course": "Gull Lake View", "date": "Sat, Sep 6"},
            "11813569796841160824": {"ord": 7, "label": "Stroke Play", "course": "Gull Lake View", "date": "Sun, Sep 7"},
        },
    },
}

TRIP_KEY = sys.argv[1] if len(sys.argv) > 1 else "nj26"
if TRIP_KEY not in TRIPS:
    sys.exit(f"Unknown trip {TRIP_KEY!r}. Choose: {', '.join(TRIPS)}")
TRIP = TRIPS[TRIP_KEY]
GGID = TRIP["ggid"]
LEAGUE = TRIP["league"]
OUT = TRIP["out"]
ROUND_META = TRIP["rounds"]
WIDGETS = {k: f"{BASE}/leagues/{LEAGUE}/widgets/{q}" for k, q in TRIP["widgets"].items()}
POINTS_PAGE = TRIP["points_page"]

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
        team_l = re.sub(r"^Team\s+", "", team_l.strip())
        team_r = re.sub(r"^Team\s+", "", team_r.strip())
        players_l = [re.sub(r"\s+", " ", p.strip()) for p in players_l.split("+")]
        players_r = [re.sub(r"\s+", " ", p.strip()) for p in players_r.split("+")]
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
        agg1 = re.search(r"data-aggregate-id='(\d+)'", attrs)
        agg2 = re.search(r"data-aggregate2-id='(\d+)'", attrs)
        matches.append({
            "teamL": team_l,
            "playersL": players_l,
            "teamR": team_r,
            "playersR": players_r,
            "result": result if result and result != "\u00a0" else ("Tied" if winner == "tie" else ""),
            "winner": winner,
            "ptsL": float(points[0]) if points else None,
            "ptsR": float(points[-1]) if len(points) > 1 else None,
            "aggs": [agg1.group(1), agg2.group(1)] if agg1 and agg2 else None,
        })
    totals = None
    for tr in table_rows(doc):
        cs = cells(tr)
        if "TOTAL" in cs:
            nums = [c for c in cs if re.fullmatch(r"-?\d+\.?\d*", c)]
            if len(nums) >= 2:
                totals = {"L": float(nums[0]), "R": float(nums[1])}
    return matches, totals


def parse_stableford_matches(doc):
    """Pair-vs-pair Stableford tables (no 'A vs B' label). Consecutive rows are a match."""
    rows = []
    for attrs, body in re.findall(r"<tr class='aggregate-row[^']*'([^>]*)>(.*?)</tr>", doc, re.S):
        name_m = re.search(r"data-aggregate-name='([^']*)'", attrs) or re.search(
            r"data-expanded-aggregate-name='([^']*)'", attrs
        )
        if not name_m:
            continue
        raw = htmlmod.unescape(name_m.group(1))
        tm = re.match(r"(?:Team\s+)?(North|South)\s+\((.+)\)$", raw.strip())
        if not tm:
            continue
        tds = re.findall(r"<td[^>]*class='([^']*)'[^>]*>(.*?)</td>", body, re.S)
        pos = next((strip_tags(t) for c, t in tds if "pos" in c.split()), None)
        score = next((strip_tags(t) for c, t in tds if "score" in c.split()), None)
        points = next((strip_tags(t) for c, t in tds if "points" in c.split()), None)
        agg = re.search(r"data-aggregate-id='(\d+)'", attrs)
        rows.append({
            "team": tm.group(1),
            "players": [re.sub(r"\s+", " ", p.strip()) for p in tm.group(2).split("+")],
            "pos": pos,
            "score": float(score) if score and re.fullmatch(r"-?\d+\.?\d*", score) else None,
            "pts": float(points) if points and re.fullmatch(r"-?\d+\.?\d*", points) else 0.0,
            "agg": agg.group(1) if agg else None,
        })
    matches = []
    totals = {"L": 0.0, "R": 0.0}
    for i in range(0, len(rows) - 1, 2):
        a, b = rows[i], rows[i + 1]
        if a["pts"] > b["pts"]:
            winner = "left"
        elif b["pts"] > a["pts"]:
            winner = "right"
        else:
            winner = "tie"
        sa = int(a["score"]) if a["score"] is not None else ""
        sb = int(b["score"]) if b["score"] is not None else ""
        matches.append({
            "teamL": a["team"],
            "playersL": a["players"],
            "teamR": b["team"],
            "playersR": b["players"],
            "result": f"{sa}–{sb} pts" if sa != "" and sb != "" else "",
            "winner": winner,
            "ptsL": a["pts"],
            "ptsR": b["pts"],
            "aggs": [a["agg"], b["agg"]] if a.get("agg") and b.get("agg") else None,
        })
        totals["L"] += a["pts"]
        totals["R"] += b["pts"]
    return matches, totals if matches else None


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
        # team games list both partners as links in the row; join them all
        links = []
        for td in raw_tds:
            for m in re.finditer(r"<a[^>]*>(.*?)</a>", td, re.S):
                t = strip_tags(m.group(1))
                if t and t not in links:
                    links.append(t)
        name = " + ".join(links) if links else nz[1]
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


def parse_hole_cell(cell):
    """Gross score, stroke-dot count, or 'X' for a pick-up / unplayed hole."""
    dots = cell.count("\u25cf")
    if re.search(r"\bX\b", cell, re.I) and not re.search(r"\d", cell):
        return "X", dots
    digits = re.sub(r"[^0-9]", "", cell)
    return (int(digits) if digits else None), dots


def parse_scorecard(doc, players_l, players_r):
    """Hole-by-hole card from a /tournaments2/details/ page.

    Rows are 'Name (strokes)' with per-hole cells like '●6' (stroke dot +
    gross). A page may only have one side (Stableford); the caller merges.
    A following 'Stableford Points' block is stored on each row as pts."""
    doc = clean(doc)
    best = None
    for tbl in re.findall(r"<table[^>]*>(.*?)</table>", doc, re.S):
        if re.search(r">\s*Out\s*<", tbl) and re.search(r"\(\d+\)", tbl):
            best = tbl
    if not best:
        return None
    header = None
    player_rows = []
    points_rows = []
    mode = "gross"
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", best, re.S):
        cs = [strip_tags(td) for td in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if not cs:
            continue
        if "Out" in cs and "In" in cs and sum(1 for c in cs if c.isdigit()) >= 9:
            header = cs
            continue
        label = cs[0]
        if header and label in ("Stableford Points",) and len(cs) <= 2:
            mode = "points"
            continue
        if header and label in ("Strokes", "Match", "Net Score", "Points") and not re.match(r"^(.*?)\s*\((\d+)\)$", label):
            continue
        m = re.match(r"^(.*?)\s*\((\d+)\)$", label)
        if header and m:
            (player_rows if mode == "gross" else points_rows).append((m.group(1), int(m.group(2)), cs))
    if not header or not player_rows:
        return None
    hole_cols = [(i, int(hl)) for i, hl in enumerate(header) if hl.isdigit() and 1 <= int(hl) <= 18]

    def side_of(name):
        name = re.sub(r"\s+", " ", name)
        if any(p in name for p in players_l):
            return "L"
        if any(p in name for p in players_r):
            return "R"
        return None

    pts_by = {}
    for name, _hcp, cs in points_rows:
        if len(cs) != len(header):
            continue
        pts = [None] * 18
        for i, h in hole_cols:
            raw = cs[i]
            if re.fullmatch(r"-?\d+", raw):
                pts[h - 1] = int(raw)
        pts_by[re.sub(r"\s+", " ", name)] = pts

    rows = []
    seen = set()
    for name, hcp, cs in player_rows:
        name = re.sub(r"\s+", " ", name)
        side = side_of(name)
        if side is None or len(cs) != len(header) or name in seen:
            continue
        seen.add(name)
        gross = [None] * 18
        dots = [0] * 18
        for i, h in hole_cols:
            gross[h - 1], dots[h - 1] = parse_hole_cell(cs[i])
        row = {"side": side, "name": name, "hcp": hcp, "gross": gross, "dots": dots}
        if name in pts_by:
            row["pts"] = pts_by[name]
        rows.append(row)
    if not rows:
        return None
    scoring = "stableford" if any(r.get("pts") for r in rows) else "match"
    return {"rows": rows, "scoring": scoring, "winners": card_winners(rows, scoring)}


def card_winners(rows, scoring):
    winners = [None] * 18
    for h in range(18):
        if scoring == "stableford":
            sums = {}
            for side in ("L", "R"):
                vals = [r["pts"][h] for r in rows if r["side"] == side and r.get("pts") and r["pts"][h] is not None]
                if vals:
                    sums[side] = sum(vals)
            if "L" in sums and "R" in sums:
                winners[h] = "L" if sums["L"] > sums["R"] else "R" if sums["R"] > sums["L"] else "T"
            continue
        nets = {}
        for side in ("L", "R"):
            vals = [
                r["gross"][h] - r["dots"][h]
                for r in rows
                if r["side"] == side and isinstance(r["gross"][h], int)
            ]
            if vals:
                nets[side] = min(vals)
        if "L" in nets and "R" in nets:
            winners[h] = "L" if nets["L"] < nets["R"] else "R" if nets["R"] < nets["L"] else "T"
    return winners


def card_has_both_sides(card):
    return card and any(r["side"] == "L" for r in card["rows"]) and any(r["side"] == "R" for r in card["rows"])


def merge_cards(a, b):
    if not a:
        return b
    if not b:
        return a
    names = {r["name"] for r in a["rows"]}
    rows = a["rows"] + [r for r in b["rows"] if r["name"] not in names]
    scoring = "stableford" if any(r.get("pts") for r in rows) else (a.get("scoring") or b.get("scoring") or "match")
    return {"rows": rows, "scoring": scoring, "winners": card_winners(rows, scoring)}


def load_match_card(mt):
    """Fetch one or both aggregate detail pages and parse a scorecard."""
    aggs = [x for x in (mt.get("aggs") or []) if x]
    if not aggs:
        return None
    a, b = aggs[0], aggs[1] if len(aggs) > 1 else None
    url = f"{BASE}/tournaments2/details/{a}" + (f"?aggregate2_id={b}" if b else "")
    card = parse_scorecard(get(url), mt["playersL"], mt["playersR"])
    if card_has_both_sides(card):
        return card
    if b:
        other = parse_scorecard(get(f"{BASE}/tournaments2/details/{b}"), mt["playersL"], mt["playersR"])
        card = merge_cards(card, other)
    return card if card_has_both_sides(card) else None


def classify_and_parse(doc):
    text = strip_tags(clean(doc))
    if "aggregate-row" in doc:
        matches, totals = parse_matches(doc)
        if matches:
            return "match", {"matches": matches, "totals": totals}
    if "Stableford Points" in text:
        matches, totals = parse_stableford_matches(doc)
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

print(f"Baking {TRIP['name']} ({GGID})...")
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

# trip standings: name -> purse, avg net, member_id (for the purse-breakdown page)
# 2026: name | $purse | avgNet
# 2025: name | times played | $purse | avgGross | avgNet | ...
standings = {}
for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", clean(w["points"]), re.S):
    cs = [c for c in cells(tr) if c]
    purse_i = next((i for i, c in enumerate(cs) if c.startswith("$")), None)
    if purse_i is None or purse_i == 0 or cs[0] in ("Player", "Rank"):
        continue
    rest = [float(c) for c in cs[purse_i + 1:] if re.fullmatch(r"-?\d+\.?\d*", c)]
    avg_net = rest[1] if purse_i >= 2 and len(rest) >= 2 else (rest[0] if rest else None)
    mid = re.search(r"member_info\?member_id=(\d+)", tr)
    standings[cs[0]] = {"purse": money(cs[purse_i]), "avgNet": avg_net, "memberId": mid.group(1) if mid else None}


def purse_category(tournament_name):
    n = tournament_name.lower()
    if "skins" in n:
        return "Skins"
    if "quota" in n:
        return "Quota"
    if "ctp" in n:
        return "CTP"
    if "drive" in n:
        return "Long Drive"
    if "net-low" in n or "net low" in n:
        return "Net-Low"
    return "Other"


def fetch_purse_breakdown(member_id):
    """Official per-tournament purse + per-round gross/net from member_info.

    Round-header rows (with gross/net columns) repeat the sum of their
    sub-rows, so only 2-cell (name, $) rows are counted for the purse —
    that also makes the trip-long net-low count exactly once (it shows $0
    inside rounds and its real payout under 'Completed Multi-Round
    Tournaments'). Header rows themselves give gross/net for the rounds
    with individual scoring (team formats show '---')."""
    doc = get(f"{BASE}/leagues/{LEAGUE}/widgets/season_points/member_info?member_id={member_id}&page_id={POINTS_PAGE}")
    by = {}
    scores = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", clean(doc), re.S):
        cs = [c for c in cells(tr) if c and c != "\u00a0"]
        date_i = next((i for i, c in enumerate(cs) if re.fullmatch(r"[A-Z][a-z]{2} \d{1,2}, \d{4}", c)), None)
        if date_i is not None and len(cs) >= date_i + 5:
            # round header: date | round name | purse | gross | net | holes
            gross, net, holes = cs[-3], cs[-2], cs[-1]
            if re.fullmatch(r"\d+\.?\d*", gross) and re.fullmatch(r"\d+\.?\d*", net):
                scores.append({
                    "round": cs[date_i + 1],
                    "gross": int(float(gross)),
                    "net": int(float(net)),
                    "holes": int(holes) if re.fullmatch(r"\d+", holes) else None,
                })
            continue
        if len(cs) == 3 and cs[1] == "$":  # name | $ | amount rendered as separate cells
            cs = [cs[0], f"${cs[2]}"]
        if len(cs) == 2 and cs[1].startswith("$") and not cs[0].startswith("Total"):
            amt = money(cs[1])
            if amt:
                cat = purse_category(cs[0])
                by[cat] = round(by.get(cat, 0) + amt, 2)
    return by, scores

# team standings — 2026 is "South"/points/...; 2025 is rank/"Team North"/points/...
teams = []
for tr in table_rows(w["teams"]):
    cs = [c for c in cells(tr) if c]
    name = None
    for c in cs:
        t = re.sub(r"^Team\s+", "", c).strip()
        if t in ("North", "South"):
            name = t
            break
    if not name:
        continue
    nums = [float(c) for c in cs if re.fullmatch(r"-?\d+\.?\d*", c)]
    if nums and nums[0] in (1.0, 2.0) and len(nums) >= 4:
        nums = nums[1:]
    if len(nums) < 3:
        continue
    teams.append({
        "name": name,
        "points": nums[0],
        "participation": nums[1],
        "total": nums[2],
        "purse": next((money(c) for c in cs if "$" in c), None),
    })

# official purse breakdown per player (skins / quota / CTP / long drive / net-low)
print(f"Fetching purse breakdowns for {len(standings)} players...")
purse_by = {}
scores_by = {}
for name, s in standings.items():
    if s["memberId"]:
        purse_by[name], scores_by[name] = fetch_purse_breakdown(s["memberId"])
        total = round(sum(purse_by[name].values()), 2)
        ok = "" if abs(total - (s["purse"] or 0)) < 0.02 else f"  MISMATCH vs GG total ${s['purse']}"
        print(f"  {name:24} ${total:<8} scores={[(sc['gross'], sc['net']) for sc in scores_by[name]]}{ok}")

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
    rnd = {"id": rid, **{k: v for k, v in meta.items() if k != "slug"}, "tournaments": []}
    if meta.get("slug"):
        course_file = OUT.parent / f"{meta['slug']}.json"
        if course_file.exists():
            course = json.loads(course_file.read_text())
            pars = {h["num"]: h.get("par") for h in course.get("holes", [])}
            rnd["pars"] = [pars.get(n) for n in range(1, 19)]
    for tid, ri, name in tids:
        if tid in seen_tids:
            kind, data = seen_tids[tid]
        else:
            doc = get(f"{BASE}/v2tournaments/{tid}?called_from=widgets%2Ftournament_results&player_stats_for_portal=true&round_index={ri}")
            kind, data = classify_and_parse(doc)
            if kind == "match":
                for mt in data["matches"]:
                    mt["card"] = load_match_card(mt)
                    mt.pop("aggs", None)
            seen_tids[tid] = (kind, data)
            print(f"  [{meta['label'][:34]:36}] {name[:42]:44} -> {kind} ({len(data.get('matches', data.get('rows', []))) if data else 0})")
        rnd["tournaments"].append({"id": tid, "name": name, "type": kind, **data})
    rounds.append(rnd)

# --- aggregate per-player ------------------------------------------------------
players = {}


def resolve(name):
    """Winner cells sometimes append the club to the name; match against roster."""
    name = re.sub(r"\s+", " ", name).strip()
    if name in roster:
        return name
    for r in roster:
        if name.startswith(r) or re.sub(r"\s+", " ", r) == name:
            return r
    return name


def P(name):
    name = resolve(name)
    if name not in players:
        players[name] = {
            "name": name, "team": None, "hi": roster.get(name),
            "purse": standings.get(name, {}).get("purse", 0.0),
            "purseBy": purse_by.get(name, {}),
            "scores": scores_by.get(name, []),
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
            if "player" in row and " + " not in row["player"]:
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
        elif t["type"] == "netlow" and netlow is None and any(r.get("rounds") for r in t.get("rows", [])):
            netlow = {"name": t["name"], "rows": t["rows"]}

# roster players who never appear in results still get a row
for name in roster:
    P(name)

# GG's team-standings "Total Purse" only counts a subset of games.
# Use the sum of official per-player purses (skins/quota/CTP/LD/net-low).
for t in teams:
    t["purse"] = round(sum(p["purse"] or 0 for p in players.values() if p.get("team") == t["name"]), 2)

out = {
    "trip": {
        "id": TRIP["id"],
        "name": TRIP["name"],
        "ggid": GGID,
        "dates": TRIP["dates"],
        "location": TRIP["location"],
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
