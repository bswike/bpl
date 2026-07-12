import { useMemo, useState } from "react";
import { aggregate, fmtToPar } from "./data";
import { Avatar, Card, HolesBadge, Scorecard } from "./ui";
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

function TrophyRoundDetail({ round: r }) {
  const birdies = r.counts ? r.counts.birdie + r.counts.eagle : null;
  return (
    <div className="mb-2.5 rounded-xl bg-gray-50 border border-gray-100 p-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
        <span className="font-semibold text-gray-900 truncate">{r.courseName}</span>
        <HolesBadge holes={r.holes} />
        <span className="text-xs text-gray-400 font-mono">
          {r.date}
          {r.tee ? ` · ${r.tee}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-mono text-gray-600">
        <span>
          Score <b className="text-gray-900">{r.ags}</b>
        </span>
        <span>
          To par <b>{fmtToPar(r.toPar)}</b>
        </span>
        {r.diff != null && (
          <span>
            Diff <b>{r.diff.toFixed(1)}</b>
          </span>
        )}
        {r.counts && (
          <>
            <span className="text-red-500">
              Birdies+ <b>{birdies}</b>
            </span>
            <span className="text-green-700">
              Pars <b>{r.counts.par}</b>
            </span>
            <span className="text-blue-600">
              Bogeys <b>{r.counts.bogey}</b>
            </span>
            <span className="text-purple-600">
              Double+ <b>{r.counts.double + r.counts.triple}</b>
            </span>
          </>
        )}
      </div>
      {r.hd && (
        <div className="mt-1">
          <Scorecard round={r} />
        </div>
      )}
    </div>
  );
}

function Trophy({ icon, title, detail, round, open, onToggle }) {
  const clickable = !!round;
  return (
    <div className="border-b border-gray-50 last:border-0">
      <div
        className={`flex items-center gap-3 py-2.5 ${clickable ? "cursor-pointer" : ""}`}
        onClick={clickable ? onToggle : undefined}
      >
        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-400 truncate">{detail}</div>
        </div>
        {clickable && (
          <span className="text-gray-300 text-xs shrink-0">{open ? "▾" : "▸"}</span>
        )}
      </div>
      {open && round && <TrophyRoundDetail round={round} />}
    </div>
  );
}

export default function ProfileTab({ golfer, rounds, onBack }) {
  const [openTrophy, setOpenTrophy] = useState(null);
  const career = useMemo(() => aggregate(rounds), [rounds]);
  const currentYear = rounds[0]?.year;
  const season = useMemo(
    () => aggregate(rounds.filter((r) => r.year === currentYear)),
    [rounds, currentYear]
  );

  const trophies = useMemo(() => {
    const out = [];

    const aceTotal = rounds.reduce((s, r) => s + (r.counts?.ace || 0), 0);
    if (aceTotal > 0) {
      const aceRound = rounds.find((r) => r.counts?.ace); // rounds are newest-first
      const aceHole = aceRound.hd.find(
        (h) => (h.raw_score || h.adjusted_gross_score) === 1
      );
      out.push({
        icon: "🎯",
        title: `${aceTotal} hole-in-one${aceTotal === 1 ? "" : "s"}`,
        detail: `${aceHole ? `Hole ${aceHole.hole_number} · ` : ""}${aceRound.courseName} · ${aceRound.date}`,
        round: aceRound,
      });
    }

    // Best round only counts full-length courses (par 70+) with all 18 holes
    // actually played — no executive courses, no scaled-up partial rounds.
    const bestRound = rounds
      .filter((r) => r.played === 18 && !(r.par != null && r.par < 70))
      .reduce((a, b) => (a == null || b.ags < a.ags ? b : a), null);
    if (bestRound) {
      out.push({
        icon: "🏆",
        title: `Best round: ${bestRound.ags} (${fmtToPar(bestRound.toPar)})`,
        detail: `${bestRound.courseName} · ${bestRound.date}`,
        round: bestRound,
      });
    }
    if (career.bestDiff != null) {
      const diffRound = rounds.find((r) => r.diff === career.bestDiff);
      out.push({
        icon: "📉",
        title: `Best differential: ${career.bestDiff.toFixed(1)}`,
        detail: diffRound
          ? `${diffRound.courseName} · ${diffRound.date}`
          : "Lowest handicap differential posted",
        round: diffRound,
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
        round: mostBirdies.r,
      });
    }
    // Aces are celebrated above, so only count eagles beyond them here.
    const eagles = career.counts.eagle - aceTotal;
    if (eagles > 0) {
      const eagleRound = rounds.find((r) => r.counts?.eagle > (r.counts?.ace || 0));
      out.push({
        icon: "🦅",
        title: `${eagles} career eagle${eagles === 1 ? "" : "s"}`,
        detail: eagleRound ? `${eagleRound.courseName} · ${eagleRound.date}` : "",
        round: eagleRound,
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
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm bg-transparent border-none cursor-pointer text-green-800 font-semibold px-1 hover:underline"
        >
          ← Back to feed
        </button>
      )}
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
          <Trophy
            key={t.title}
            {...t}
            open={openTrophy === t.title}
            onToggle={() => setOpenTrophy(openTrophy === t.title ? null : t.title)}
          />
        ))}
        <p className="text-[11px] text-gray-400 mt-2">Tap a trophy to see the round.</p>
      </Card>

      <RoundsTab rounds={rounds} />
    </div>
  );
}
