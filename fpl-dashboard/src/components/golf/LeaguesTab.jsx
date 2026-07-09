import { useEffect, useMemo, useRef, useState } from "react";
import { buildModel, fmtToPar } from "./data";
import { Avatar, Card, HolesBadge } from "./ui";

/** Private mini-leagues (golf trips). v1: owner-only — you create leagues,
 *  add friends found via GHIN search, and see a leaderboard built from
 *  rounds loaded live with your own GHIN token. Nobody else sees any of it. */

const api = async (method, body) => {
  const res = await fetch("/api/golf-leagues", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const TEAM_STYLES = {
  a: {
    dot: "bg-sky-500",
    text: "text-sky-700",
    active: "bg-sky-600 text-white border-sky-600",
    idle: "bg-white text-gray-400 border-gray-200 hover:border-sky-400",
  },
  b: {
    dot: "bg-rose-500",
    text: "text-rose-700",
    active: "bg-rose-600 text-white border-rose-600",
    idle: "bg-white text-gray-400 border-gray-200 hover:border-rose-400",
  },
};

function TeamDot({ team }) {
  if (!team) return null;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${TEAM_STYLES[team].dot}`}
    />
  );
}

/** Form going into the trip: avg handicap differential of the last 5 rounds
 *  before the start date vs the 10 before those. Differentials normalize
 *  9- vs 18-hole rounds, so everyone compares fairly. Lower = better. */
function formStats(rounds, start) {
  const before = start ? rounds.filter((r) => r.date < start) : rounds;
  const diffs = before.map((r) => r.diff).filter((d) => d != null); // newest first
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const recentAvg = avg(diffs.slice(0, 5));
  const priorAvg = avg(diffs.slice(5, 15));
  return {
    recentAvg,
    delta: recentAvg != null && priorAvg != null ? recentAvg - priorAvg : null,
    n: Math.min(diffs.length, 5),
    lastDate: before[0]?.date || null,
  };
}

function trendLabel(delta) {
  if (delta == null) return { text: "not enough rounds", cls: "text-gray-400", arrow: "" };
  if (delta <= -0.3) return { text: `${Math.abs(delta).toFixed(1)} better`, cls: "text-green-600", arrow: "▲" };
  if (delta >= 0.3) return { text: `${delta.toFixed(1)} worse`, cls: "text-red-500", arrow: "▼" };
  return { text: "steady", cls: "text-gray-400", arrow: "◆" };
}

function fmtRange(start, end) {
  if (!start && !end) return "All time";
  const f = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (start && end) return `${f(start)} – ${f(end)}`;
  return start ? `From ${f(start)}` : `Through ${f(end)}`;
}

/* ---------- create league form ---------- */

function CreateLeague({ onCreated, self }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [trip, setTrip] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { league } = await api("POST", {
        action: "create",
        name: name.trim(),
        start: start || undefined,
        end: end || undefined,
        members: self ? [self] : [],
        teams: trip
          ? [{ name: teamA.trim() || "North" }, { name: teamB.trim() || "South" }]
          : undefined,
      });
      setName("");
      setStart("");
      setEnd("");
      setOpen(false);
      onCreated(league);
    } catch (err) {
      window.alert(`Could not create league: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-gray-200 hover:border-green-600/50 rounded-2xl py-4 text-sm font-semibold text-gray-400 hover:text-green-800 bg-transparent cursor-pointer transition-colors"
      >
        + New league
      </button>
    );
  }

  const input =
    "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-green-600";

  return (
    <Card title="New league">
      <div className="space-y-3">
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="League name — e.g. Myrtle Beach 2026"
          maxLength={60}
          autoFocus
        />
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-gray-500">
            Start (optional)
            <input
              type="date"
              className={`${input} mt-1`}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            End (optional)
            <input
              type="date"
              className={`${input} mt-1`}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">
          Set dates for a trip — the leaderboard only counts rounds played in
          the window. Leave blank for an all-time league.
        </p>
        <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trip}
            onChange={(e) => setTrip(e.target.checked)}
            className="mt-0.5 accent-green-700"
          />
          <span>
            Golf trip with two teams{" "}
            <span className="text-xs text-gray-400 block">
              Split the group into two named teams — Ryder Cup style — with
              team form and trip scoring.
            </span>
          </span>
        </label>
        {trip && (
          <div className="flex gap-2">
            <input
              className={input}
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              placeholder="North"
              maxLength={30}
            />
            <input
              className={input}
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              placeholder="South"
              maxLength={30}
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={create}
            disabled={busy || !name.trim()}
            className="px-4 py-2 text-sm font-semibold bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg border-none cursor-pointer transition-colors"
          >
            {busy ? "Creating…" : "Create league"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ---------- add-member search ---------- */

function AddMember({ onSearch, existing, onAdd, compact }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(null);

  const run = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    const found = await onSearch(q.trim(), st.trim());
    setBusy(false);
    setResults(found);
  };

  const pick = async (g) => {
    if (existing.has(String(g.ghin))) return;
    setAdding(g.ghin);
    setResults(null);
    try {
      await onAdd(g);
      setQ("");
      setSt("");
    } finally {
      setAdding(null);
    }
  };

  const shell = compact
    ? "rounded-xl border border-green-200 bg-green-50/40 p-3"
    : "rounded-xl border border-gray-200 bg-gray-50/60 p-3";

  return (
    <div className={shell}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
        Add golfers
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setResults(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Search by name — e.g. Todd Swikle"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-900"
        />
        <input
          value={st}
          onChange={(e) =>
            setSt(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())
          }
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="ST"
          title="Optional state"
          className="w-14 px-2 py-2 text-sm text-center border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-900"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || q.trim().length < 2}
          className="px-3 py-2 text-xs uppercase tracking-wider bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg border-none cursor-pointer transition-colors shrink-0"
        >
          {busy ? "…" : "Search"}
        </button>
      </div>
      {results !== null && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">No matches — try a different spelling or drop the state.</p>
          ) : (
            results.map((g) => {
              const already = existing.has(String(g.ghin));
              const isAdding = adding === g.ghin;
              return (
                <button
                  key={g.ghin}
                  type="button"
                  disabled={already || isAdding}
                  onClick={() => pick(g)}
                  className="w-full px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors text-left disabled:opacity-40 disabled:cursor-default border-b border-gray-50 last:border-0"
                >
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {g.first_name} {g.last_name}
                    {g.state ? (
                      <span className="font-normal text-gray-400"> · {g.state}</span>
                    ) : null}
                    {already && (
                      <span className="font-normal text-green-700 text-xs"> · already in</span>
                    )}
                    {isAdding && (
                      <span className="font-normal text-gray-400 text-xs"> · adding…</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {g.club_name ? `${g.club_name} · ` : ""}GHIN #{g.ghin}
                    {g.handicap_index != null ? ` · ${g.handicap_index} index` : ""}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-2">
        Tap a result to add them. Name or GHIN # works — state is optional.
      </p>
    </div>
  );
}

function MembersCard({
  league,
  myGhin,
  ghinToken,
  onSearch,
  existing,
  onAdd,
  onRemove,
  onAssign,
}) {
  return (
    <Card title={`Golfers · ${league.members.length}`}>
      {ghinToken ? (
        <AddMember onSearch={onSearch} existing={existing} onAdd={onAdd} compact />
      ) : (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-3">
          Sign in to GHIN again to search and add golfers.
        </div>
      )}
      <div className="space-y-1 mt-3">
        {league.members.map((m) => (
          <div key={m.ghin} className="flex items-center gap-3 py-1.5 min-w-0">
            <Avatar golfer={m} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {m.first_name} {m.last_name}
                {String(m.ghin) === myGhin && (
                  <span className="font-normal text-gray-400 text-xs"> · you</span>
                )}
              </div>
              <div className="text-[11px] text-gray-400 truncate">
                {m.club_name ? `${m.club_name} · ` : ""}GHIN #{m.ghin}
              </div>
            </div>
            {league.teams && (
              <div className="flex gap-1 shrink-0">
                {["a", "b"].map((t) => {
                  const on = m.team === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      title={
                        on
                          ? `Remove from ${league.teams[t].name}`
                          : `Put on ${league.teams[t].name}`
                      }
                      onClick={() => onAssign(m.ghin, on ? null : t)}
                      className={`max-w-24 truncate text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border cursor-pointer transition-colors ${
                        on ? TEAM_STYLES[t].active : TEAM_STYLES[t].idle
                      }`}
                    >
                      {league.teams[t].name}
                    </button>
                  );
                })}
              </div>
            )}
            {String(m.ghin) !== myGhin && (
              <button
                type="button"
                onClick={() => onRemove(m.ghin)}
                title="Remove from league"
                className="text-gray-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-lg leading-none px-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- leaderboard ---------- */

function memberStats(rounds, start, end) {
  const inRange = rounds.filter(
    (r) => (!start || r.date >= start) && (!end || r.date <= end)
  );
  const r18 = inRange.filter((r) => r.holes === 18);
  const full18 = r18.filter((r) => r.played === 18);
  const toPars = r18.map((r) => r.toPar).filter((v) => v != null);
  const birdies = inRange.reduce(
    (s, r) => s + (r.counts ? r.counts.birdie + r.counts.eagle : 0),
    0
  );
  return {
    n: inRange.length,
    avgToPar: toPars.length
      ? toPars.reduce((a, b) => a + b, 0) / toPars.length
      : null,
    best: full18.length ? full18.reduce((a, b) => (b.ags < a.ags ? b : a)) : null,
    birdies,
    latest: inRange[0] || null,
  };
}

function Leaderboard({ league, rows }) {
  const ranked = [...rows].sort((a, b) => {
    if (a.stats.n === 0 && b.stats.n === 0) return 0;
    if (a.stats.n === 0) return 1;
    if (b.stats.n === 0) return -1;
    if (a.stats.avgToPar == null) return 1;
    if (b.stats.avgToPar == null) return -1;
    return a.stats.avgToPar - b.stats.avgToPar;
  });
  const medal = ["bg-amber-100 text-amber-800 border-amber-300", "bg-gray-100 text-gray-600 border-gray-300", "bg-orange-100 text-orange-800 border-orange-200"];

  return (
    <Card
      title={`Leaderboard · ${fmtRange(league.start, league.end)}`}
      right={<span className="text-xs text-gray-400">avg to par, 18s</span>}
    >
      {ranked.map((row, i) => {
        const s = row.stats;
        const played = s.n > 0;
        return (
          <div
            key={row.member.ghin}
            className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 min-w-0"
          >
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                played && i < 3 ? medal[i] : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              {played ? i + 1 : "–"}
            </div>
            <Avatar golfer={row.member} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 truncate">
                <span className="truncate">
                  {row.member.first_name} {row.member.last_name}
                </span>
                <TeamDot team={row.member.team} />
              </div>
              <div className="text-[11px] text-gray-400 truncate">
                {row.loading
                  ? "Loading rounds…"
                  : row.error
                    ? row.error
                    : played
                      ? `${s.n} round${s.n === 1 ? "" : "s"}` +
                        (s.best ? ` · best ${s.best.ags}` : "") +
                        (s.birdies ? ` · ${s.birdies} birdies+` : "")
                      : "No rounds in window"}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-bold font-mono text-gray-900">
                {s.avgToPar != null ? fmtToPar(s.avgToPar, { decimals: 1 }) : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

/* ---------- teams: head-to-head card + individual form ---------- */

function teamAgg(rows) {
  const forms = rows.map((r) => r.form.recentAvg).filter((v) => v != null);
  const tripToPars = rows
    .filter((r) => r.stats.n > 0 && r.stats.avgToPar != null)
    .map((r) => r.stats.avgToPar);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    form: avg(forms),
    trip: avg(tripToPars),
    tripRounds: rows.reduce((s, r) => s + r.stats.n, 0),
    heating: rows.filter((r) => r.form.delta != null && r.form.delta <= -0.3).length,
    cooling: rows.filter((r) => r.form.delta != null && r.form.delta >= 0.3).length,
    size: rows.length,
  };
}

function TeamCol({ team, name, rows }) {
  const agg = teamAgg(rows);
  const s = TEAM_STYLES[team];
  return (
    <div className="flex-1 min-w-0 text-center">
      <div className={`flex items-center justify-center gap-1.5 font-bold text-sm ${s.text} truncate`}>
        <TeamDot team={team} />
        <span className="truncate">{name}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-2">
        Trip avg to par
      </div>
      <div className="text-2xl font-bold font-mono text-gray-900">
        {agg.trip != null ? fmtToPar(agg.trip, { decimals: 1 }) : "—"}
      </div>
      <div className="text-[11px] text-gray-400">
        {agg.tripRounds} round{agg.tripRounds === 1 ? "" : "s"}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-2.5">
        Form (avg diff, last 5)
      </div>
      <div className="text-lg font-bold font-mono text-gray-800">
        {agg.form != null ? agg.form.toFixed(1) : "—"}
      </div>
      <div className="text-[11px] mt-0.5">
        {agg.heating > 0 && <span className="text-green-600">▲ {agg.heating} hot</span>}
        {agg.heating > 0 && agg.cooling > 0 && <span className="text-gray-300"> · </span>}
        {agg.cooling > 0 && <span className="text-red-500">▼ {agg.cooling} cold</span>}
        {agg.heating === 0 && agg.cooling === 0 && (
          <span className="text-gray-400">{agg.size} golfer{agg.size === 1 ? "" : "s"}</span>
        )}
      </div>
    </div>
  );
}

function TeamsCard({ league, rows, onRename }) {
  const rowsA = rows.filter((r) => r.member.team === "a");
  const rowsB = rows.filter((r) => r.member.team === "b");
  const unassigned = rows.length - rowsA.length - rowsB.length;
  return (
    <Card
      title="Teams"
      right={
        <button
          type="button"
          onClick={onRename}
          className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
        >
          Rename
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <TeamCol team="a" name={league.teams.a.name} rows={rowsA} />
        <div className="self-center text-[11px] font-bold text-gray-300 uppercase shrink-0 pt-1">
          vs
        </div>
        <TeamCol team="b" name={league.teams.b.name} rows={rowsB} />
      </div>
      {unassigned > 0 && (
        <p className="text-[11px] text-gray-400 mt-3 text-center">
          {unassigned} golfer{unassigned === 1 ? "" : "s"} not on a team yet —
          assign them in Golfers above.
        </p>
      )}
    </Card>
  );
}

function FormRow({ row }) {
  const t = trendLabel(row.form.delta);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 min-w-0">
      <Avatar golfer={row.member} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {row.member.first_name} {row.member.last_name}
        </div>
        <div className="text-[11px] text-gray-400 truncate">
          {row.loading
            ? "Loading rounds…"
            : row.form.n > 0
              ? `last ${row.form.n} · played ${row.form.lastDate}`
              : "no rounds yet"}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base font-bold font-mono text-gray-900">
          {row.form.recentAvg != null ? row.form.recentAvg.toFixed(1) : "—"}
        </div>
        <div className={`text-[11px] font-semibold ${t.cls}`}>
          {t.arrow} {t.text}
        </div>
      </div>
    </div>
  );
}

function rankByForm(rows) {
  return [...rows].sort((a, b) => {
    if (a.form.delta == null && b.form.delta == null) return 0;
    if (a.form.delta == null) return 1;
    if (b.form.delta == null) return -1;
    return a.form.delta - b.form.delta;
  });
}

function FormTeamCol({ team, name, rows }) {
  const ranked = rankByForm(rows);
  const s = TEAM_STYLES[team];
  const agg = teamAgg(rows);
  return (
    <div className="flex-1 min-w-0">
      <div
        className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2 pb-2 border-b ${s.text} border-gray-100`}
      >
        <TeamDot team={team} />
        <span className="truncate">{name}</span>
        {agg.form != null && (
          <span className="ml-auto font-mono normal-case tracking-normal text-gray-500 text-[11px]">
            team {agg.form.toFixed(1)}
          </span>
        )}
      </div>
      {ranked.length === 0 ? (
        <p className="text-xs text-gray-400 py-3">No golfers on this team yet.</p>
      ) : (
        ranked.map((row) => <FormRow key={row.member.ghin} row={row} />)
      )}
    </div>
  );
}

function FormCard({ league, rows }) {
  const heading = league.start
    ? new Date() < new Date(league.start + "T00:00:00")
      ? "Form going into the trip"
      : "Form heading in"
    : "Current form";

  const rowsA = rows.filter((r) => r.member.team === "a");
  const rowsB = rows.filter((r) => r.member.team === "b");
  const unassigned = rows.filter((r) => r.member.team !== "a" && r.member.team !== "b");

  return (
    <Card
      title={heading}
      right={<span className="text-xs text-gray-400">last 5 vs prior 10 diffs</span>}
    >
      {league.teams ? (
        <>
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            <FormTeamCol team="a" name={league.teams.a.name} rows={rowsA} />
            <div className="hidden sm:block w-px bg-gray-100 self-stretch shrink-0" />
            <FormTeamCol team="b" name={league.teams.b.name} rows={rowsB} />
          </div>
          {unassigned.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                Not on a team
              </div>
              {rankByForm(unassigned).map((row) => (
                <FormRow key={row.member.ghin} row={row} />
              ))}
            </div>
          )}
        </>
      ) : (
        rankByForm(rows).map((row) => <FormRow key={row.member.ghin} row={row} />)
      )}
      <p className="text-[11px] text-gray-400 mt-2">
        Avg handicap differential of the 5 most recent rounds
        {league.start ? " before the trip" : ""} — lower is better. The trend
        compares against the 10 rounds before those.
      </p>
    </Card>
  );
}

/* ---------- trip feed: everyone's rounds in the window, newest first ---------- */

function TripFeed({ league, rows }) {
  const rounds = useMemo(() => {
    const all = [];
    for (const row of rows) {
      for (const r of row.rounds || []) {
        if (league.start && r.date < league.start) continue;
        if (league.end && r.date > league.end) continue;
        all.push({ ...r, member: row.member });
      }
    }
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  }, [league, rows]);

  if (!rounds.length) return null;

  return (
    <Card title="Rounds">
      {rounds.map((r) => (
        <div
          key={`${r.member.ghin}-${r.id}`}
          className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 min-w-0"
        >
          <Avatar golfer={r.member} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-900 truncate">
              <span className="font-semibold">{r.member.first_name}</span>{" "}
              <span className="text-gray-500">at</span> {r.courseName}
            </div>
            <div className="text-[11px] text-gray-400">{r.date}</div>
          </div>
          <HolesBadge holes={r.holes} />
          <div className="text-base font-bold font-mono text-gray-900 w-10 text-right shrink-0">
            {r.ags}
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- league detail ---------- */

function LeagueDetail({ league, onBack, onChanged, onDeleted, myGhin, myRounds, ghinToken, onSearch }) {
  // ghin -> { loading, error, rounds }
  const [data, setData] = useState({});
  const loadingRef = useRef(new Set());
  // Always point at the latest roster — prop, optimistic, or server — so rapid
  // adds build on each other instead of a stale React closure.
  const leagueRef = useRef(league);
  useEffect(() => {
    leagueRef.current = league;
  }, [league]);
  // Serialize league writes so rapid clicks don't interleave on the server.
  const mutateRef = useRef(Promise.resolve());

  const mutate = (body, { optimistic } = {}) => {
    if (optimistic) {
      leagueRef.current = optimistic;
      onChanged(optimistic);
    }
    mutateRef.current = mutateRef.current
      .then(async () => {
        const { league: updated } = await api("POST", body);
        leagueRef.current = updated;
        onChanged(updated);
        return updated;
      })
      .catch((err) => {
        window.alert(err.message || "Update failed.");
        throw err;
      });
    return mutateRef.current;
  };

  const saveMembers = (nextMembers, extra = {}) => {
    const cur = leagueRef.current;
    const optimistic = { ...cur, members: nextMembers };
    return mutate(
      { action: "update", id: cur.id, members: nextMembers, ...extra },
      { optimistic }
    );
  };

  useEffect(() => {
    for (const m of league.members) {
      const ghin = String(m.ghin);
      if (ghin === myGhin || data[ghin] || loadingRef.current.has(ghin)) continue;
      if (!ghinToken) continue;
      loadingRef.current.add(ghin);
      setData((prev) => ({ ...prev, [ghin]: { loading: true } }));
      (async () => {
        try {
          const res = await fetch("/api/golf-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: ghinToken, ghinNumber: ghin }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
          setData((prev) => ({
            ...prev,
            [ghin]: { rounds: buildModel(body).rounds },
          }));
        } catch (err) {
          setData((prev) => ({
            ...prev,
            [ghin]: { error: err.message || "Couldn't load rounds" },
          }));
        } finally {
          loadingRef.current.delete(ghin);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.members, ghinToken, myGhin]);

  const rows = useMemo(
    () =>
      league.members.map((m) => {
        const ghin = String(m.ghin);
        const d = ghin === myGhin ? { rounds: myRounds } : data[ghin] || {};
        return {
          member: m,
          rounds: d.rounds || [],
          loading: !!d.loading,
          error: d.error || null,
          stats: memberStats(d.rounds || [], league.start, league.end),
          form: formStats(d.rounds || [], league.start),
        };
      }),
    [league, data, myGhin, myRounds]
  );

  const existing = useMemo(
    () => new Set(league.members.map((m) => String(m.ghin))),
    [league.members]
  );

  const addMember = (g) => {
    const cur = leagueRef.current;
    const m = {
      ghin: String(g.ghin),
      first_name: g.first_name || "",
      last_name: g.last_name || "",
      club_name: g.club_name || null,
    };
    if (cur.members.some((x) => x.ghin === m.ghin)) return Promise.resolve();
    return saveMembers([...cur.members, m]);
  };

  const removeMember = (ghin) =>
    saveMembers(leagueRef.current.members.filter((m) => m.ghin !== String(ghin)));

  const assignTeam = (ghin, team) => {
    const id = String(ghin);
    const next = leagueRef.current.members.map((m) => {
      if (m.ghin !== id) return m;
      const copy = { ...m };
      if (team === "a" || team === "b") copy.team = team;
      else delete copy.team;
      return copy;
    });
    return saveMembers(next);
  };

  const setTeams = (teams) => {
    const cur = leagueRef.current;
    const teamsObj = {
      a: { name: String(teams[0]?.name || "North").slice(0, 30) },
      b: { name: String(teams[1]?.name || "South").slice(0, 30) },
    };
    return mutate(
      { action: "update", id: cur.id, members: cur.members, teams },
      { optimistic: { ...cur, teams: teamsObj } }
    );
  };

  const renameTeams = () => {
    const a = window.prompt("First team name:", league.teams?.a?.name || "North");
    if (a === null) return;
    const b = window.prompt("Second team name:", league.teams?.b?.name || "South");
    if (b === null) return;
    setTeams([{ name: a }, { name: b }]);
  };

  const deleteLeague = async () => {
    if (!window.confirm(`Delete “${league.name}”? This can't be undone.`)) return;
    try {
      await api("DELETE", { id: league.id });
      onDeleted(league.id);
    } catch (err) {
      window.alert(`Could not delete: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm bg-transparent border-none cursor-pointer text-green-800 font-semibold px-1 hover:underline"
        >
          ← All leagues
        </button>
        <button
          type="button"
          onClick={deleteLeague}
          className="text-xs bg-transparent border-none cursor-pointer text-red-500 hover:text-red-600 hover:underline"
        >
          Delete league
        </button>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{league.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {fmtRange(league.start, league.end)} · {league.members.length} golfer
              {league.members.length === 1 ? "" : "s"} · only you can see this
            </p>
          </div>
          {!league.teams && (
            <button
              type="button"
              onClick={() => setTeams([{ name: "North" }, { name: "South" }])}
              className="shrink-0 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 hover:bg-green-100 rounded-full px-3 py-1.5 cursor-pointer transition-colors"
            >
              + Make it a trip
            </button>
          )}
        </div>
      </Card>

      {!ghinToken && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Your GHIN session expired — sign in again to load members' rounds.
        </div>
      )}

      <MembersCard
        league={league}
        myGhin={myGhin}
        ghinToken={ghinToken}
        onSearch={onSearch}
        existing={existing}
        onAdd={addMember}
        onRemove={removeMember}
        onAssign={assignTeam}
      />

      {league.teams && (
        <TeamsCard league={league} rows={rows} onRename={renameTeams} />
      )}
      <Leaderboard league={league} rows={rows} />
      <FormCard league={league} rows={rows} />
      <TripFeed league={league} rows={rows} />
    </div>
  );
}

/* ---------- top level ---------- */

export default function LeaguesTab({ myGhin, myGolfer, myRounds, ghinToken, onSearch }) {
  const [leagues, setLeagues] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("GET")
      .then((d) => setLeagues(d.leagues || []))
      .catch((err) => {
        setLeagues([]);
        setError(err.message);
      });
  }, []);

  const self = myGolfer
    ? {
        ghin: myGhin,
        first_name: myGolfer.first_name,
        last_name: myGolfer.last_name,
        club_name: myGolfer.club_name || null,
      }
    : null;

  const selected = (leagues || []).find((l) => l.id === selectedId) || null;

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto">
        <LeagueDetail
          league={selected}
          myGhin={myGhin}
          myRounds={myRounds}
          ghinToken={ghinToken}
          onSearch={onSearch}
          onBack={() => setSelectedId(null)}
          onChanged={(updated) =>
            setLeagues((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          }
          onDeleted={(id) => {
            setLeagues((prev) => prev.filter((l) => l.id !== id));
            setSelectedId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My leagues</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Private groups and golf trips — visible only to you.
        </p>
      </div>

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {leagues === null ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          {leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-left cursor-pointer hover:border-green-600/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="text-base font-bold text-gray-900 truncate">{l.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {fmtRange(l.start, l.end)} · {l.members.length} golfer
                    {l.members.length === 1 ? "" : "s"}
                    {l.teams && (
                      <>
                        {" · "}
                        <span className="text-sky-600 font-semibold">{l.teams.a.name}</span>
                        <span> vs </span>
                        <span className="text-rose-600 font-semibold">{l.teams.b.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-gray-300 shrink-0">›</span>
              </div>
            </button>
          ))}
          <CreateLeague self={self} onCreated={(l) => {
            setLeagues((prev) => [l, ...(prev || [])]);
            setSelectedId(l.id);
          }} />
        </>
      )}
    </div>
  );
}
