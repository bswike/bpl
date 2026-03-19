const REGION_MAP = {
  "East": "E",
  "West": "W",
  "South": "S",
  "Midwest": "MW",
};

const ROUND_MAP = {
  "1st Round": 1,
  "2nd Round": 2,
  "Sweet 16": 3,
  "Elite 8": 4,
  "Elite Eight": 4,
  "Final Four": 5,
  "National Championship": 6,
  "Championship": 6,
};

const TOURNAMENT_DATES = [
  "20260319", "20260320",
  "20260321", "20260322",
  "20260326", "20260327",
  "20260328", "20260329",
  "20260404",
  "20260406",
];

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseRegion(notes) {
  if (!notes || !notes.length) return null;
  const headline = notes[0]?.headline || "";
  for (const [full, abbr] of Object.entries(REGION_MAP)) {
    if (headline.includes(full)) return abbr;
  }
  return null;
}

function parseRound(notes) {
  if (!notes || !notes.length) return 0;
  const headline = notes[0]?.headline || "";
  for (const [label, num] of Object.entries(ROUND_MAP)) {
    if (headline.includes(label)) return num;
  }
  return 0;
}

function parseEvent(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors || [];
  if (competitors.length < 2) return null;

  const home = competitors.find(c => c.homeAway === "home") || competitors[0];
  const away = competitors.find(c => c.homeAway === "away") || competitors[1];

  const region = parseRegion(comp.notes);
  const round = parseRound(comp.notes);
  const status = comp.status?.type?.state || "pre";

  const homeSeed = home.curatedRank?.current ?? null;
  const awaySeed = away.curatedRank?.current ?? null;

  return {
    id: event.id,
    region,
    round,
    homeSeed,
    awaySeed,
    homeTeam: home.team?.displayName || "",
    awayTeam: away.team?.displayName || "",
    homeAbbr: home.team?.abbreviation || "",
    awayAbbr: away.team?.abbreviation || "",
    homeScore: parseInt(home.score) || 0,
    awayScore: parseInt(away.score) || 0,
    homeWinner: !!home.winner,
    awayWinner: !!away.winner,
    status,
    clock: comp.status?.displayClock || "",
    period: comp.status?.period || 0,
    detail: comp.status?.type?.shortDetail || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const today = getTodayStr();
    const datesToFetch = TOURNAMENT_DATES.filter(d => d <= today);

    if (datesToFetch.length === 0) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ games: [], message: "Tournament hasn't started yet" });
    }

    const fetches = datesToFetch.map(async (date) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=${date}&limit=100`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.events || []).map(parseEvent).filter(Boolean);
    });

    const results = await Promise.all(fetches);
    const games = results.flat();

    const hasLive = games.some(g => g.status === "in");
    const cacheTime = hasLive ? 20 : 120;
    res.setHeader("Cache-Control", `s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`);

    return res.status(200).json({ games, fetched: new Date().toISOString() });
  } catch (err) {
    console.error("Scores API error:", err);
    res.setHeader("Cache-Control", "s-maxage=10");
    return res.status(500).json({ error: "Failed to fetch scores", games: [] });
  }
}
