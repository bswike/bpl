import { useMemo, useState } from "react";
import { fmtToPar, RESULT_COLORS, resultKey } from "./data";
import { Avatar, Scorecard, HolesBadge } from "./ui";

/** Activity-feed home: each round is a card with stats, a hole strip,
 *  achievement badges, and kudos (stored locally). */

const KUDOS_KEY = "golf-kudos";

function readKudos() {
  try {
    return JSON.parse(localStorage.getItem(KUDOS_KEY)) || {};
  } catch {
    return {};
  }
}

function toggleKudos(id) {
  const k = readKudos();
  k[id] = !k[id];
  try {
    localStorage.setItem(KUDOS_KEY, JSON.stringify(k));
  } catch {
    /* best-effort */
  }
  return k[id];
}

function fmtDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value, accent }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
        {label}
      </div>
      <div
        className={`text-xl sm:text-2xl font-bold leading-tight ${
          accent || "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/** Compact colored strip of hole results — the "map" of the round. */
function HoleStrip({ hd }) {
  return (
    <div className="flex gap-[3px] items-end">
      {hd.map((h) => {
        const raw = h.raw_score || h.adjusted_gross_score;
        const k = raw && h.par ? resultKey(raw, h.par) : null;
        return (
          <div
            key={h.hole_number}
            title={`Hole ${h.hole_number}: ${raw ?? "—"} (par ${h.par ?? "—"})`}
            className="flex-1 h-2.5 rounded-sm"
            style={{ background: k ? RESULT_COLORS[k] : "#e5e7eb" }}
          />
        );
      })}
    </div>
  );
}

function FeedCard({ round: r, golfer, badges, onProfile }) {
  const [open, setOpen] = useState(false);
  const [kudos, setKudos] = useState(() => !!readKudos()[r.id]);
  const birdies = r.counts ? r.counts.birdie + r.counts.eagle : null;

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar golfer={golfer} size="sm" onClick={onProfile} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {golfer.first_name} {golfer.last_name}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {fmtDate(r.date)}
            {r.tee ? ` · ${r.tee} tees` : ""}
          </div>
        </div>
      </div>

      <div className="px-4 mt-2.5 flex items-center gap-2 min-w-0">
        <h3 className="text-lg font-bold text-gray-900 leading-snug truncate">
          {r.courseName}
        </h3>
        <HolesBadge holes={r.holes} />
      </div>

      {badges.length > 0 && (
        <div className="px-4 mt-1.5 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="px-4 py-3 flex gap-6 sm:gap-10">
        <Stat label="Score" value={r.ags} />
        <Stat
          label="To par"
          value={fmtToPar(r.toPar)}
          accent={r.toPar != null && r.toPar <= 9 ? "text-green-700" : undefined}
        />
        {r.diff != null && <Stat label="Diff" value={r.diff.toFixed(1)} />}
        {birdies != null && (
          <Stat
            label="Birdies"
            value={birdies}
            accent={birdies > 0 ? "text-[#d63c2e]" : undefined}
          />
        )}
      </div>

      {r.hd && (
        <div className="px-4 pb-3">
          <HoleStrip hd={r.hd} />
        </div>
      )}

      <div className="border-t border-gray-100 px-2 py-1 flex items-center">
        <button
          type="button"
          onClick={() => setKudos(toggleKudos(r.id))}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors ${
            kudos ? "text-green-700 font-semibold" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className={kudos ? "" : "grayscale opacity-60"}>👏</span>
          {kudos ? "1 kudos" : "Kudos"}
        </button>
        {r.hd && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
          >
            {open ? "Hide scorecard ▴" : "Scorecard ▾"}
          </button>
        )}
      </div>

      {open && r.hd && (
        <div className="border-t border-gray-100 px-4 pb-2 bg-gray-50/50">
          <Scorecard round={r} />
        </div>
      )}
    </article>
  );
}

export default function FeedTab({ rounds, golfer, onProfile }) {
  const [shown, setShown] = useState(12);

  // Achievement badges: all-time best, best of year, course best, eagles, birdie hauls.
  const badges = useMemo(() => {
    const r18 = rounds.filter((r) => r.holes === 18);
    const bestEver = r18.length ? Math.min(...r18.map((r) => r.ags)) : null;
    const bestByYear = {};
    const bestByCourse = {};
    const courseCount = {};
    for (const r of r18) {
      bestByYear[r.year] = Math.min(bestByYear[r.year] ?? Infinity, r.ags);
      bestByCourse[r.courseKey] = Math.min(bestByCourse[r.courseKey] ?? Infinity, r.ags);
      courseCount[r.courseKey] = (courseCount[r.courseKey] || 0) + 1;
    }
    const map = {};
    for (const r of rounds) {
      const list = [];
      if (r.holes === 18) {
        if (r.ags === bestEver) list.push("🏆 All-time best");
        else if (r.ags === bestByYear[r.year]) list.push(`🎖️ Best of ${r.year}`);
        else if (r.ags === bestByCourse[r.courseKey] && courseCount[r.courseKey] >= 3)
          list.push("📍 Your course best");
      }
      if (r.counts?.eagle) list.push("🦅 Eagle!");
      if (r.counts && r.counts.birdie >= 2) list.push(`🐦 ${r.counts.birdie} birdies`);
      map[r.id] = list;
    }
    return map;
  }, [rounds]);

  const thisYear = useMemo(() => {
    const yr = rounds[0]?.year;
    if (!yr) return null;
    const ys = rounds.filter((r) => r.year === yr);
    const y18 = ys.filter((r) => r.holes === 18);
    return {
      yr,
      n: ys.length,
      avg: y18.length ? y18.reduce((s, r) => s + r.ags, 0) / y18.length : null,
      birdies: ys.reduce(
        (s, r) => s + (r.counts ? r.counts.birdie + r.counts.eagle : 0),
        0
      ),
    };
  }, [rounds]);

  if (!rounds.length) {
    return (
      <p className="text-center text-gray-400 py-12">No rounds to show.</p>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {thisYear && (
        <button
          type="button"
          onClick={onProfile}
          className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-green-600/40 transition-colors text-left"
        >
          <Avatar golfer={golfer} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Your {thisYear.yr}
            </div>
            <div className="text-sm text-gray-800 truncate">
              <span className="font-bold">{thisYear.n}</span> rounds
              {thisYear.avg != null && (
                <>
                  {" "}
                  · <span className="font-bold">{thisYear.avg.toFixed(1)}</span> avg
                </>
              )}{" "}
              · <span className="font-bold">{thisYear.birdies}</span> birdies
            </div>
          </div>
          <span className="text-gray-300 text-lg">›</span>
        </button>
      )}

      {rounds.slice(0, shown).map((r) => (
        <FeedCard
          key={r.id}
          round={r}
          golfer={golfer}
          badges={badges[r.id] || []}
          onProfile={onProfile}
        />
      ))}

      {shown < rounds.length && (
        <button
          type="button"
          onClick={() => setShown(shown + 12)}
          className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-green-800 cursor-pointer hover:bg-green-50 transition-colors"
        >
          Show more rounds ({rounds.length - shown} left)
        </button>
      )}
    </div>
  );
}
