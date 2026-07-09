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

function AddMember({ onSearch, existing, onAdd }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    const found = await onSearch(q.trim(), st.trim());
    setBusy(false);
    setResults(found);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
        Add a golfer (GHIN search)
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setResults(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Name — e.g. Todd Swikle"
          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-900"
        />
        <input
          value={st}
          onChange={(e) =>
            setSt(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())
          }
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="State"
          className="w-16 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-900"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || q.trim().length < 2}
          className="px-3 py-1.5 text-xs uppercase tracking-wider bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg border-none cursor-pointer transition-colors shrink-0"
        >
          {busy ? "…" : "Search"}
        </button>
      </div>
      {results !== null && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">No matches.</p>
          ) : (
            results.map((g) => {
              const already = existing.has(String(g.ghin));
              return (
                <button
                  key={g.ghin}
                  type="button"
                  disabled={already}
                  onClick={() => {
                    onAdd(g);
                    setResults(null);
                    setQ("");
                  }}
                  className="w-full px-3 py-2 bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors text-left disabled:opacity-40 disabled:cursor-default"
                >
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {g.first_name} {g.last_name}
                    {g.state ? (
                      <span className="font-normal text-gray-400"> · {g.state}</span>
                    ) : null}
                    {already && (
                      <span className="font-normal text-green-700 text-xs"> · in league</span>
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
    </div>
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
              <div className="text-sm font-semibold text-gray-900 truncate">
                {row.member.first_name} {row.member.last_name}
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
        };
      }),
    [league, data, myGhin, myRounds]
  );

  const existing = useMemo(
    () => new Set(league.members.map((m) => String(m.ghin))),
    [league.members]
  );

  const addMember = async (g) => {
    try {
      const { league: updated } = await api("POST", {
        action: "update",
        id: league.id,
        addMembers: [g],
      });
      onChanged(updated);
    } catch (err) {
      window.alert(`Could not add: ${err.message}`);
    }
  };

  const removeMember = async (ghin) => {
    try {
      const { league: updated } = await api("POST", {
        action: "update",
        id: league.id,
        removeGhins: [ghin],
      });
      onChanged(updated);
    } catch (err) {
      window.alert(`Could not remove: ${err.message}`);
    }
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
        <h2 className="text-xl font-bold text-gray-900 leading-tight">{league.name}</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {fmtRange(league.start, league.end)} · {league.members.length} golfer
          {league.members.length === 1 ? "" : "s"} · only you can see this
        </p>
      </Card>

      {!ghinToken && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Your GHIN session expired — sign in again to load members' rounds.
        </div>
      )}

      <Leaderboard league={league} rows={rows} />
      <TripFeed league={league} rows={rows} />

      <Card title={`Members · ${league.members.length}`}>
        <div className="space-y-1 mb-3">
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
              {String(m.ghin) !== myGhin && (
                <button
                  type="button"
                  onClick={() => removeMember(m.ghin)}
                  title="Remove from league"
                  className="text-gray-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-lg leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {ghinToken ? (
          <AddMember onSearch={onSearch} existing={existing} onAdd={addMember} />
        ) : (
          <p className="text-xs text-gray-400">
            Sign in to GHIN to add golfers by name.
          </p>
        )}
      </Card>
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
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fmtRange(l.start, l.end)} · {l.members.length} golfer
                    {l.members.length === 1 ? "" : "s"}
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
