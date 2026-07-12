import { useState, useEffect, useCallback } from "react";
import { Search, Flag, CalendarDays, MapPin, Loader2, RefreshCw, Lock, ChevronDown } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (ym) => {
  const [y, m] = ym.split("-");
  return `${MONTHS[+m - 1]} ${y}`;
};
const fmtDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${todayISO().slice(0, 4)}-01-01`;
function daysInclusive(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Rounds() {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cov, setCov] = useState(null);

  const loadCoverage = useCallback(async () => {
    try {
      const r = await fetch(`/api/rounds?from=${yearStart()}&to=${todayISO()}`);
      const j = await r.json();
      setCov(j.coverage);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadCoverage(); }, [loadCoverage]);

  const run = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams({ name: name.trim(), from, to });
      const res = await fetch(`/api/rounds?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed");
      setData(json);
    } catch (e) {
      setError(e.message); setData(null);
    } finally {
      setLoading(false);
    }
  }, [name, from, to]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-3 mb-1">
          <Flag className="w-7 h-7 text-emerald-400" />
          <h1 className="text-2xl font-bold">Rounds Played</h1>
        </header>
        <p className="text-slate-400 text-sm mb-6">
          Count anyone's Suntree tee times over a date range.
          {cov?.cacheMinDay && (
            <> Cache covers <span className="text-slate-300">{fmtDay(cov.cacheMinDay)} – {fmtDay(cov.cacheMaxDay)}</span>.</>
          )}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); run(); }}
          className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Member name (e.g. Everett Kennedy)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm
                         focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-3">
            <label className="flex-1 text-xs text-slate-400">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                           focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
            </label>
            <label className="flex-1 text-xs text-slate-400">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                           focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                       rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Looking up…" : "Look up rounds"}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-950/50 border border-red-800 text-red-200 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {data && <Results data={data} />}

        <RefreshPanel cov={cov} onDone={() => { loadCoverage(); if (name.trim()) run(); }} />
      </div>
    </div>
  );
}

function RefreshPanel({ cov, onDone }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [since, setSince] = useState(yearStart());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function refresh(e) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const login = await fetch("/api/rounds-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const lj = await login.json().catch(() => ({}));
      if (!login.ok) throw new Error(lj.error || "Login failed");
      setPassword(""); // don't keep it around after the handshake

      // The server scrapes up to ~10 days per request and tells us where it
      // stopped (nextFrom); we keep going from exactly there so no day is
      // skipped, even when a request runs out of time mid-chunk.
      const target = todayISO();
      const totalDays = daysInclusive(since, target);
      setProgress({ done: 0, total: totalDays });
      let cursor = since;
      let doneDays = 0;
      let guard = 0;
      let stuck = 0;
      let skipped = 0;
      while (cursor && cursor <= target) {
        if (++guard > 1200) throw new Error("Refresh didn't finish — try again.");

        let j;
        try {
          const r = await fetch("/api/rounds-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: cursor, to: target }),
          });
          if (r.status === 401) throw new Error("__session__");
          if (!r.ok) throw new Error(`__http_${r.status}__`);
          j = await r.json();
        } catch (reqErr) {
          // Only a genuine session expiry should stop the whole run.
          if (reqErr.message === "__session__") {
            throw new Error("Your Suntree session expired — log in and try again.");
          }
          // A dropped connection ("Failed to fetch") or a 5xx is transient over
          // a long run — and any days the server finished before the hiccup are
          // already cached. Pause and retry the same point a few times, then
          // skip past it, so one blip can't abort a refresh that's working.
          if (++stuck >= 6) { cursor = addDays(cursor, 1); stuck = 0; skipped++; continue; }
          await new Promise((res2) => setTimeout(res2, 1500));
          continue;
        }

        doneDays += j.scraped?.length || 0;
        setProgress({ done: Math.min(doneDays, totalDays), total: totalDays });

        const prev = cursor;
        const next = j.nextFrom;
        if (!next) { cursor = null; break; }        // reached the end
        if (next > prev) { cursor = next; stuck = 0; continue; } // made progress
        // No forward progress: a day keeps failing server-side (usually
        // transient throttling). Retry a few times, then skip it so one bad
        // day can't stall the whole refresh.
        if (++stuck >= 4) { cursor = addDays(prev, 1); stuck = 0; skipped++; }
        else await new Promise((res2) => setTimeout(res2, 1200));
      }
      setMsg(
        `Updated ${fmtDay(since)} – ${fmtDay(target)}.` +
        (skipped ? ` (${skipped} day${skipped === 1 ? "" : "s"} couldn't be read — refresh again to retry.)` : "")
      );
      onDone?.();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mt-6 bg-slate-800/40 border border-slate-700 rounded-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300"
      >
        <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-emerald-400" /> Update the data</span>
        <ChevronDown className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form onSubmit={refresh} className="px-4 pb-4 space-y-3 border-t border-slate-700/60 pt-3">
          <p className="text-xs text-slate-400 flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Log in with your Suntree account to pull the latest tee sheets into the shared cache. Your password is
            used once to sign in and never stored.
          </p>
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Suntree username" autoComplete="username"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Suntree password" autoComplete="current-password"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          <label className="block text-xs text-slate-400">
            Refresh since
            <input type="date" value={since} onChange={(e) => setSince(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                         focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
          </label>

          {busy && progress.total > 0 && (
            <div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-slate-400 mt-1">Scraping tee sheets… {progress.done}/{progress.total} days</div>
            </div>
          )}
          {msg && <div className="text-xs text-emerald-300">{msg}</div>}
          {err && <div className="text-xs text-red-300">{err}</div>}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed
                       rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {busy ? "Refreshing…" : "Log in & refresh"}
          </button>
          {cov?.cacheMaxDay && !busy && (
            <p className="text-xs text-slate-500 text-center">Cache currently through {fmtDay(cov.cacheMaxDay)}.</p>
          )}
        </form>
      )}
    </div>
  );
}

function Results({ data }) {
  const { count, matchedNames, byMonth, byCourse, rounds, suggestions, coverage, query } = data;

  if (count === 0) {
    return (
      <div className="mt-6 bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <p className="text-slate-200">
          No rounds found for <span className="font-semibold">{query.name}</span> in this range.
        </p>
        {coverage.status !== "full" && (
          <p className="text-amber-300/80 text-sm mt-2">
            Heads up: the cache only covers part of this range
            {coverage.cacheMinDay && <> ({fmtDay(coverage.cacheMinDay)} – {fmtDay(coverage.cacheMaxDay)})</>} — days outside it aren't counted yet. Use “Update the data” below to fill them in.
          </p>
        )}
        {suggestions?.length > 0 && (
          <div className="mt-3">
            <p className="text-slate-400 text-sm mb-1">Did you mean:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <span key={s} className="text-xs bg-slate-700/60 border border-slate-600 rounded-full px-2.5 py-1">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="bg-gradient-to-br from-emerald-900/40 to-slate-800/60 border border-emerald-800/50 rounded-xl p-5 text-center">
        <div className="text-5xl font-bold text-emerald-300">{count}</div>
        <div className="text-slate-300 text-sm mt-1">
          round{count === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-slate-100">{matchedNames.join(", ")}</span>
        </div>
        <div className="text-slate-500 text-xs mt-1">
          {fmtDay(query.from)} – {fmtDay(query.to)}
        </div>
        {coverage.status === "partial" && (
          <div className="text-amber-300/80 text-xs mt-2">
            Cache covers {fmtDay(coverage.cacheMinDay)} – {fmtDay(coverage.cacheMaxDay)}; anything outside isn't counted.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Breakdown title="By month" icon={<CalendarDays className="w-4 h-4" />}
          rows={Object.entries(byMonth).sort().map(([k, v]) => [fmtMonth(k), v])} />
        <Breakdown title="By course" icon={<MapPin className="w-4 h-4" />}
          rows={Object.entries(byCourse).sort((a, b) => b[1] - a[1])} />
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs bg-slate-900/50">
            <tr>
              <th className="text-left font-medium px-4 py-2">Date</th>
              <th className="text-left font-medium px-4 py-2">Time</th>
              <th className="text-left font-medium px-4 py-2">Course</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={i} className="border-t border-slate-700/50">
                <td className="px-4 py-2 text-slate-200">{fmtDay(r.date)}</td>
                <td className="px-4 py-2 text-slate-400">{r.time || "—"}</td>
                <td className="px-4 py-2 text-slate-400">{r.course || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Breakdown({ title, icon, rows }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">{icon}{title}</div>
      <div className="space-y-1">
        {rows.map(([label, val]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-300">{label}</span>
            <span className="text-slate-100 font-medium tabular-nums">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
