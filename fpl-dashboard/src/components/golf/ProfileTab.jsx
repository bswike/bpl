import { useMemo } from "react";
import { aggregate, fmtToPar } from "./data";
import { Avatar, Card } from "./ui";
import RoundsTab from "./RoundsTab";

/** Profile: golfer header, season vs career stats, trophy case. */

function StatCol({ label, value, sub }) {
  return (
    <div className="text-center min-w-0">
      <div className="text-2xl font-bold font-mono text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}

function Trophy({ icon, title, detail }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-400 truncate">{detail}</div>
      </div>
    </div>
  );
}

export default function ProfileTab({ golfer, rounds }) {
  const career = useMemo(() => aggregate(rounds), [rounds]);
  const currentYear = rounds[0]?.year;
  const season = useMemo(
    () => aggregate(rounds.filter((r) => r.year === currentYear)),
    [rounds, currentYear]
  );

  const trophies = useMemo(() => {
    const out = [];
    if (career.best18) {
      out.push({
        icon: "🏆",
        title: `Best round: ${career.best18.ags} (${fmtToPar(career.best18.toPar)})`,
        detail: `${career.best18.courseName} · ${career.best18.date}`,
      });
    }
    if (career.bestDiff != null) {
      out.push({
        icon: "📉",
        title: `Best differential: ${career.bestDiff.toFixed(1)}`,
        detail: "Lowest handicap differential posted",
      });
    }
    const mostBirdies = rounds
      .filter((r) => r.counts)
      .reduce(
        (best, r) => {
          const n = r.counts.birdie + r.counts.eagle;
          return n > best.n ? { n, r } : best;
        },
        { n: 0, r: null }
      );
    if (mostBirdies.r) {
      out.push({
        icon: "🐦",
        title: `Most birdies in a round: ${mostBirdies.n}`,
        detail: `${mostBirdies.r.courseName} · ${mostBirdies.r.date}`,
      });
    }
    if (career.counts.eagle > 0) {
      const eagleRound = rounds.find((r) => r.counts?.eagle > 0);
      out.push({
        icon: "🦅",
        title: `${career.counts.eagle} career eagle${career.counts.eagle === 1 ? "" : "s"}`,
        detail: eagleRound ? `${eagleRound.courseName} · ${eagleRound.date}` : "",
      });
    }
    const courses = new Set(rounds.map((r) => r.courseKey));
    out.push({
      icon: "🗺️",
      title: `${courses.size} courses played`,
      detail: `${career.n18} eighteens · ${career.n9} nines`,
    });
    if (career.counts.birdie + career.counts.eagle > 0) {
      out.push({
        icon: "⛳",
        title: `${career.counts.birdie + career.counts.eagle} career birdies or better`,
        detail: `across ${career.trackedRounds} tracked rounds`,
      });
    }
    return out;
  }, [career, rounds]);

  const first = rounds[rounds.length - 1];
  const memberSince = first ? first.year : null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar golfer={golfer} size="lg" ring />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {golfer.first_name} {golfer.last_name}
            </h2>
            <p className="text-sm text-gray-500 truncate">
              {golfer.club_name || "Independent"} · GHIN #{golfer.ghin_number ?? "—"}
            </p>
            {memberSince && (
              <p className="text-xs text-gray-400 mt-0.5">
                Posting scores since {memberSince}
              </p>
            )}
          </div>
          {golfer.handicap_index != null && (
            <div className="text-center shrink-0">
              <div className="font-serif text-3xl text-green-800 leading-none">
                {golfer.handicap_index}
              </div>
              <div className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mt-1">
                Index
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title={`This year · ${currentYear}`}>
        <div className="grid grid-cols-3 gap-2">
          <StatCol label="Rounds" value={season.n} />
          <StatCol
            label="Avg (18)"
            value={season.avg18 != null ? season.avg18.toFixed(1) : "—"}
          />
          <StatCol
            label="Best"
            value={season.best18 ? season.best18.ags : "—"}
            sub={season.best18 ? season.best18.courseName : ""}
          />
        </div>
      </Card>

      <Card title="Career">
        <div className="grid grid-cols-3 gap-2">
          <StatCol label="Rounds" value={career.n} />
          <StatCol
            label="Avg (18)"
            value={career.avg18 != null ? career.avg18.toFixed(1) : "—"}
          />
          <StatCol
            label="Avg diff"
            value={career.avgDiff != null ? career.avgDiff.toFixed(1) : "—"}
          />
        </div>
      </Card>

      <Card title="Trophy case">
        {trophies.map((t) => (
          <Trophy key={t.title} {...t} />
        ))}
      </Card>

      <RoundsTab rounds={rounds} />
    </div>
  );
}
