import { useMemo, useState, useEffect } from "react";
import { groupBy } from "./data";
import { Card } from "./ui";

/** Birdie Tracker: per-course "birdie bingo" — which holes you've birdied,
 *  all-time or in a given year. Uses only rounds with hole-by-hole data. */

const FlagIcon = ({ className = "w-3 h-3" }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M4 1.5a.75.75 0 0 1 1.5 0V2l6.8 2.2a.5.5 0 0 1 .03.94L5.5 7.6v6.9a.75.75 0 0 1-1.5 0v-13Z" />
  </svg>
);

function holeStats(rounds, hole) {
  const plays = [];
  for (const r of rounds) {
    const h = r.hd.find((x) => x.hole_number === hole);
    if (!h) continue;
    const raw = h.raw_score || h.adjusted_gross_score;
    if (!raw || !h.par) continue;
    plays.push({ date: r.date, year: r.year, score: raw, par: h.par });
  }
  const birdies = plays.filter((p) => p.score === p.par - 1);
  const eagles = plays.filter((p) => p.score <= p.par - 2);
  return {
    hole,
    par: plays.length ? plays[plays.length - 1].par : null,
    plays,
    birdies,
    eagles,
    best: plays.length ? Math.min(...plays.map((p) => p.score)) : null,
    avg: plays.length ? plays.reduce((s, p) => s + p.score, 0) / plays.length : null,
  };
}

function joinHoles(nums) {
  if (nums.length === 1) return `hole ${nums[0]}`;
  if (nums.length === 2) return `holes ${nums[0]} and ${nums[1]}`;
  return `holes ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
}

function HoleCell({ h, selected, onClick }) {
  const state = h.eagles.length
    ? "eagle"
    : h.birdies.length
      ? "birdie"
      : h.plays.length
        ? "played"
        : "unplayed";
  const base =
    "relative rounded-xl px-1 pt-2 pb-1.5 text-center cursor-pointer transition-all duration-200 border";
  const styles = {
    eagle:
      "bg-gradient-to-b from-[#e3c04f] to-[#c49a2c] border-[#b08a24] text-white shadow-sm hover:shadow-md",
    birdie:
      "bg-gradient-to-b from-[#ef6355] to-[#d63c2e] border-[#b8321f] text-white shadow-sm hover:shadow-md",
    played: "bg-white border-gray-200 text-gray-700 hover:border-gray-300",
    unplayed: "bg-gray-50 border-dashed border-gray-200 text-gray-300",
  };
  const n = h.birdies.length + h.eagles.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${styles[state]} ${
        selected ? "ring-2 ring-green-700 ring-offset-1" : ""
      }`}
    >
      <div className="text-base font-bold font-mono leading-none">{h.hole}</div>
      <div
        className={`text-[9px] mt-0.5 ${
          state === "eagle" || state === "birdie" ? "text-white/80" : "text-gray-400"
        }`}
      >
        {h.par ? `Par ${h.par}` : "—"}
      </div>
      <div className="h-4 mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold">
        {state === "eagle" || state === "birdie" ? (
          <>
            <FlagIcon className="w-2.5 h-2.5" />
            {n > 1 && <span>×{n}</span>}
          </>
        ) : state === "played" ? (
          <span className="text-gray-400 font-normal">best {h.best}</span>
        ) : null}
      </div>
      {h.eagles.length > 0 && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-[#b08a24] text-[#b08a24] text-[9px] font-bold flex items-center justify-center shadow-sm">
          ★
        </div>
      )}
    </button>
  );
}

function HoleDetail({ h }) {
  if (!h) return null;
  if (!h.plays.length) {
    return (
      <div className="text-sm text-gray-500">
        Hole {h.hole} — never played in this selection.
      </div>
    );
  }
  const made = [...h.eagles, ...h.birdies].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-bold text-gray-900">
          Hole {h.hole} · Par {h.par}
        </span>
        <span className="text-xs text-gray-500">
          played {h.plays.length}× · avg {h.avg.toFixed(2)} · best {h.best}
        </span>
      </div>
      {made.length ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {made.map((p, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full text-white ${
                p.score <= p.par - 2 ? "bg-[#c49a2c]" : "bg-[#d63c2e]"
              }`}
            >
              <FlagIcon className="w-2.5 h-2.5" />
              {p.score <= p.par - 2 ? "Eagle" : "Birdie"} · {p.date}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-1.5">
          No birdies here yet — closest is a {h.best} (par {h.par}).
        </p>
      )}
    </div>
  );
}

export default function BirdiesTab({ rounds }) {
  const tracked = useMemo(() => rounds.filter((r) => r.hd), [rounds]);

  const courses = useMemo(() => {
    const grouped = groupBy(tracked, (r) => r.courseKey);
    return Object.entries(grouped)
      .map(([key, rs]) => ({
        key,
        name: rs[0].courseName,
        rounds: rs,
        birdies: rs.reduce((s, r) => s + r.counts.birdie + r.counts.eagle, 0),
      }))
      .sort((a, b) => b.rounds.length - a.rounds.length);
  }, [tracked]);

  const [courseKey, setCourseKey] = useState(null);
  const [year, setYear] = useState("all");
  const [selHole, setSelHole] = useState(null);

  useEffect(() => {
    if (courses.length && !courses.some((c) => c.key === courseKey)) {
      setCourseKey(courses[0].key);
      setYear("all");
      setSelHole(null);
    }
  }, [courses, courseKey]);

  const course = courses.find((c) => c.key === courseKey);

  const years = useMemo(() => {
    if (!course) return [];
    const byYear = groupBy(course.rounds, (r) => r.year);
    return Object.entries(byYear)
      .map(([yr, rs]) => ({
        year: yr,
        birdies: rs.reduce((s, r) => s + r.counts.birdie + r.counts.eagle, 0),
      }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [course]);

  const selRounds = useMemo(() => {
    if (!course) return [];
    return year === "all" ? course.rounds : course.rounds.filter((r) => r.year === year);
  }, [course, year]);

  const holes = useMemo(() => {
    if (!selRounds.length) return [];
    const maxHole = Math.max(...selRounds.flatMap((r) => r.hd.map((h) => h.hole_number)));
    const n = maxHole > 9 ? 18 : 9;
    return Array.from({ length: n }, (_, i) => holeStats(selRounds, i + 1));
  }, [selRounds]);

  if (!courses.length) {
    return (
      <Card>
        <p className="text-center text-gray-400 py-10">
          No rounds with hole-by-hole data yet — post scores hole-by-hole in GHIN to
          start tracking birdies.
        </p>
      </Card>
    );
  }
  if (!course) return null;

  const playedHoles = holes.filter((h) => h.plays.length);
  const birdied = playedHoles.filter((h) => h.birdies.length || h.eagles.length);
  const missing = playedHoles
    .filter((h) => !h.birdies.length && !h.eagles.length)
    .map((h) => h.hole);
  const totalBirdies = holes.reduce((s, h) => s + h.birdies.length + h.eagles.length, 0);
  const scope = year === "all" ? "All-time" : year;

  let summary;
  if (!playedHoles.length) {
    summary = `No hole-by-hole rounds at ${course.name} in ${scope.toLowerCase()}.`;
  } else if (!missing.length) {
    summary = `${scope}: you've birdied every hole you've played at ${course.name}. 🎉`;
  } else if (birdied.length && missing.length <= 5) {
    summary = `${scope}: birdied every hole but ${joinHoles(missing).replace(/^holes? /, "")} at ${course.name}.`;
  } else {
    summary = `${scope}: birdied ${birdied.length} of ${playedHoles.length} holes played at ${course.name}.`;
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-0 flex-1 basis-64">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
              Course
            </label>
            <select
              value={courseKey || ""}
              onChange={(e) => {
                setCourseKey(e.target.value);
                setYear("all");
                setSelHole(null);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 min-w-0"
            >
              {courses.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name} — {c.birdies} birdie{c.birdies === 1 ? "" : "s"} in{" "}
                  {c.rounds.length} rd{c.rounds.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[{ year: "all", birdies: course.birdies }, ...years].map((y) => (
              <button
                key={y.year}
                type="button"
                onClick={() => {
                  setYear(y.year);
                  setSelHole(null);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                  year === y.year
                    ? "bg-green-800 border-green-800 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-600"
                }`}
              >
                {y.year === "all" ? "All time" : y.year}
                <span className={year === y.year ? "text-green-200" : "text-gray-400"}>
                  {" "}
                  · {y.birdies}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm font-semibold text-green-900">{summary}</p>
          <p className="text-xs text-gray-400 font-mono">
            {birdied.length}/{playedHoles.length} holes · {totalBirdies} total
          </p>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-600 to-[#d4af37] transition-all duration-500"
            style={{
              width: playedHoles.length
                ? `${(birdied.length / playedHoles.length) * 100}%`
                : 0,
            }}
          />
        </div>

        <div className="grid grid-cols-3 min-[430px]:grid-cols-6 lg:grid-cols-9 gap-2">
          {holes.map((h) => (
            <HoleCell
              key={h.hole}
              h={h}
              selected={selHole === h.hole}
              onClick={() => setSelHole(selHole === h.hole ? null : h.hole)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#d63c2e]" /> Birdied
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#c49a2c]" /> Eagled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-white border border-gray-300" /> Played, no
            birdie yet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-dashed border-gray-300" />{" "}
            Not played
          </span>
        </div>

        {selHole && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <HoleDetail h={holes.find((h) => h.hole === selHole)} />
          </div>
        )}
      </Card>

      <BirdieLog rounds={selRounds} scope={scope} courseName={course.name} />
    </div>
  );
}

function BirdieLog({ rounds, scope, courseName }) {
  const entries = useMemo(() => {
    const out = [];
    for (const r of rounds) {
      for (const h of r.hd) {
        const raw = h.raw_score || h.adjusted_gross_score;
        if (!raw || !h.par || raw >= h.par) continue;
        out.push({
          date: r.date,
          hole: h.hole_number,
          par: h.par,
          score: raw,
          eagle: raw <= h.par - 2,
          roundScore: r.ags,
          holes: r.holes,
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.hole - b.hole);
  }, [rounds]);

  if (!entries.length) return null;
  return (
    <Card title={`Birdie log · ${courseName} · ${scope}`}>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 text-[10px] uppercase tracking-wide">
              <th className="pb-2">Date</th>
              <th className="pb-2 px-1.5 text-center">Hole</th>
              <th className="pb-2 px-1.5 text-center">Par</th>
              <th className="pb-2 px-1.5 text-center">Score</th>
              <th className="pb-2 px-1.5 text-left">Result</th>
              <th className="pb-2 px-1.5 text-right">Round</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-1.5 font-mono text-xs text-gray-600">{e.date}</td>
                <td className="py-1.5 px-1.5 text-center font-mono font-bold">{e.hole}</td>
                <td className="py-1.5 px-1.5 text-center text-gray-600">{e.par}</td>
                <td className="py-1.5 px-1.5 text-center font-mono font-bold text-gray-900">
                  {e.score}
                </td>
                <td className="py-1.5 px-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${
                      e.eagle ? "bg-[#c49a2c]" : "bg-[#d63c2e]"
                    }`}
                  >
                    <FlagIcon className="w-2 h-2" />
                    {e.eagle ? "Eagle" : "Birdie"}
                  </span>
                </td>
                <td className="py-1.5 px-1.5 text-right font-mono text-gray-600">
                  {e.roundScore}
                  {e.holes === 9 && <span className="text-[9px] text-amber-600"> (9)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
