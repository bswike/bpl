import { useMemo, useState } from "react";
import { fmtToPar, RESULT_COLORS, resultKey, groupBy } from "./data";
import { Avatar, Scorecard, HolesBadge } from "./ui";

/** Activity-feed home. Entries may span multiple golfers (the public feed):
 *  each entry is a round tagged with `.golfer` and `.ownerId`. */

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

function FeedCard({ round: r, badges, onProfile }) {
  const [open, setOpen] = useState(false);
  const [kudos, setKudos] = useState(() => !!readKudos()[r.id]);
  const birdies = r.counts ? r.counts.birdie + r.counts.eagle : null;

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar golfer={r.golfer} size="sm" onClick={() => onProfile(r.ownerId)} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {r.golfer.first_name} {r.golfer.last_name}
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

export default function FeedTab({ entries, ownGolfer, onProfile, onSignIn }) {
  const [shown, setShown] = useState(12);

  // Achievement badges, computed independently per golfer.
  const badges = useMemo(() => {
    const map = {};
    for (const list of Object.values(groupBy(entries, (r) => r.ownerId))) {
      const r18 = list.filter((r) => r.holes === 18);
      const bestEver = r18.length ? Math.min(...r18.map((r) => r.ags)) : null;
      const bestByYear = {};
      const bestByCourse = {};
      const courseCount = {};
      for (const r of r18) {
        bestByYear[r.year] = Math.min(bestByYear[r.year] ?? Infinity, r.ags);
        bestByCourse[r.courseKey] = Math.min(bestByCourse[r.courseKey] ?? Infinity, r.ags);
        courseCount[r.courseKey] = (courseCount[r.courseKey] || 0) + 1;
      }
      for (const r of list) {
        const out = [];
        if (r.holes === 18) {
          if (r.ags === bestEver) out.push("🏆 All-time best");
          else if (r.ags === bestByYear[r.year]) out.push(`🎖️ Best of ${r.year}`);
          else if (r.ags === bestByCourse[r.courseKey] && courseCount[r.courseKey] >= 3)
            out.push("📍 Course best");
        }
        if (r.counts?.eagle) out.push("🦅 Eagle!");
        if (r.counts && r.counts.birdie >= 2) out.push(`🐦 ${r.counts.birdie} birdies`);
        map[r.id] = out;
      }
    }
    return map;
  }, [entries]);

  const thisYear = useMemo(() => {
    if (!ownGolfer) return null;
    const mine = entries.filter((r) => r.ownerId === "me");
    const yr = mine[0]?.year;
    if (!yr) return null;
    const ys = mine.filter((r) => r.year === yr);
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
  }, [entries, ownGolfer]);

  if (!entries.length) {
    return <p className="text-center text-gray-400 py-12">No rounds to show yet.</p>;
  }

  // Guests see the first two posts; the rest is blurred behind a sign-in gate.
  const guest = !ownGolfer;
  const GUEST_VISIBLE = 2;
  if (guest) {
    const visible = entries.slice(0, GUEST_VISIBLE);
    const teaser = entries.slice(GUEST_VISIBLE, GUEST_VISIBLE + 3);
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {visible.map((r) => (
          <FeedCard
            key={`${r.ownerId}-${r.id}`}
            round={r}
            badges={badges[r.id] || []}
            onProfile={onProfile}
          />
        ))}
        {teaser.length > 0 && (
          <div className="relative">
            <div
              className="space-y-4 blur-[6px] opacity-60 pointer-events-none select-none"
              aria-hidden="true"
            >
              {teaser.map((r) => (
                <FeedCard
                  key={`${r.ownerId}-${r.id}`}
                  round={r}
                  badges={badges[r.id] || []}
                  onProfile={() => {}}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-start justify-center pt-14 bg-gradient-to-b from-transparent via-[#f8faf8]/60 to-[#f8faf8]">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg px-6 py-5 text-center max-w-xs mx-4">
                <div className="text-2xl mb-1">⛳</div>
                <div className="text-sm font-bold text-gray-900">
                  There's more where that came from
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sign in with GHIN to see the full feed and your own stats.
                </p>
                {onSignIn && (
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="mt-3 text-xs uppercase tracking-wider bg-green-700 hover:bg-green-600 text-white px-5 py-2 rounded-full border-none cursor-pointer transition-colors"
                  >
                    Sign in to GHIN
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {thisYear && (
        <button
          type="button"
          onClick={() => onProfile("me")}
          className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-green-600/40 transition-colors text-left"
        >
          <Avatar golfer={ownGolfer} size="sm" />
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

      {entries.slice(0, shown).map((r) => (
        <FeedCard
          key={`${r.ownerId}-${r.id}`}
          round={r}
          badges={badges[r.id] || []}
          onProfile={onProfile}
        />
      ))}

      {shown < entries.length && (
        <button
          type="button"
          onClick={() => setShown(shown + 12)}
          className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-green-800 cursor-pointer hover:bg-green-50 transition-colors"
        >
          Show more rounds ({entries.length - shown} left)
        </button>
      )}
    </div>
  );
}
