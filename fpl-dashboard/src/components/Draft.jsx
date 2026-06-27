import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Trophy,
  Save,
  RotateCcw,
  ChevronRight,
  X,
  ClipboardList,
  Eye,
  Loader2,
  Users,
} from "lucide-react";

// ----- bracket model -------------------------------------------------------
// 6 levels of slots: [32, 16, 8, 4, 2, 1]. Level 0 holds the entrant names
// (editable). Each higher level is filled by picking a winner of the match
// below it. Third-place is contested by the two semifinal losers.
const SIZES = [32, 16, 8, 4, 2, 1];
const COLS = [
  { lvl: 0, label: "Round of 32" },
  { lvl: 1, label: "Round of 16" },
  { lvl: 2, label: "Quarterfinals" },
  { lvl: 3, label: "Semifinals" },
  { lvl: 4, label: "Final" },
];

function emptyRounds() {
  return SIZES.map((s) => Array(s).fill(null));
}

// Keep higher rounds consistent: a slot must be one of its two children, else
// it (and anything it fed) is cleared. Runs bottom-up so changes cascade.
function sanitize(rounds) {
  const r = rounds.map((a) => a.slice());
  for (let lvl = 1; lvl <= 5; lvl++) {
    for (let m = 0; m < r[lvl].length; m++) {
      const occ = r[lvl][m];
      if (occ == null) continue;
      const a = r[lvl - 1][2 * m];
      const b = r[lvl - 1][2 * m + 1];
      if (occ !== a && occ !== b) r[lvl][m] = null;
    }
  }
  return r;
}

function thirdContenders(rounds) {
  const loser = (a, b, w) => {
    if (a == null || b == null || w == null) return null;
    return w === a ? b : a;
  };
  return [
    loser(rounds[3][0], rounds[3][1], rounds[4][0]),
    loser(rounds[3][2], rounds[3][3], rounds[4][1]),
  ];
}

// ----- one slot row --------------------------------------------------------
function Slot({ level, idx, name, isWinner, editable, onPick, onRename }) {
  const canAdvance = level < 5 && !!name;
  const base =
    "flex items-center gap-1 px-1.5 h-[26px] transition-colors " +
    (isWinner
      ? "bg-emerald-500/15"
      : name
      ? "hover:bg-slate-700/40"
      : "");

  if (editable && level === 0) {
    return (
      <div className={base}>
        <input
          value={name || ""}
          onChange={(e) => onRename(idx, e.target.value)}
          placeholder={`Seed ${idx + 1}`}
          className="flex-1 min-w-0 bg-transparent text-[11px] leading-none text-slate-100 placeholder:text-slate-600 outline-none focus:text-white"
        />
        <button
          type="button"
          disabled={!canAdvance}
          onClick={() => canAdvance && onPick(level, idx)}
          title={canAdvance ? "Advance" : ""}
          className={`shrink-0 rounded p-0.5 ${
            isWinner
              ? "text-emerald-300"
              : canAdvance
              ? "text-slate-500 hover:text-cyan-300"
              : "text-slate-700 cursor-default"
          }`}
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!canAdvance || !editable}
      onClick={() => editable && canAdvance && onPick(level, idx)}
      className={`${base} w-full text-left ${
        editable && canAdvance ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <span
        className={`flex-1 min-w-0 truncate text-[11px] leading-none ${
          isWinner
            ? "text-emerald-200 font-bold"
            : name
            ? "text-slate-200 font-medium"
            : "text-slate-600 italic"
        }`}
      >
        {name || "—"}
      </span>
      {isWinner && (
        <ChevronRight className="w-3 h-3 shrink-0 text-emerald-300" />
      )}
    </button>
  );
}

function MatchCard({ level, m, rounds, editable, onPick, onRename }) {
  const top = rounds[level][2 * m];
  const bot = rounds[level][2 * m + 1];
  const winner = rounds[level + 1] ? rounds[level + 1][m] : null;
  return (
    <div className="flex items-center">
      <div className="w-full rounded-md border border-slate-700/60 bg-slate-800/50 overflow-hidden">
        <Slot
          level={level}
          idx={2 * m}
          name={top}
          isWinner={winner != null && winner === top}
          editable={editable}
          onPick={onPick}
          onRename={onRename}
        />
        <div className="border-t border-slate-700/40" />
        <Slot
          level={level}
          idx={2 * m + 1}
          name={bot}
          isWinner={winner != null && winner === bot}
          editable={editable}
          onPick={onPick}
          onRename={onRename}
        />
      </div>
    </div>
  );
}

function Connectors({ count, colH }) {
  return (
    <div className="flex flex-col shrink-0" style={{ width: 12 }}>
      <div className="h-4 mb-1" />
      <div
        className="flex flex-col justify-around"
        style={{ height: colH }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center" style={{ flex: 1 }}>
            <div
              className="w-full"
              style={{
                height: "50%",
                borderRight: "1px solid #334155",
                borderTop: "1px solid #334155",
                borderBottom: "1px solid #334155",
                borderTopRightRadius: 3,
                borderBottomRightRadius: 3,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- the bracket canvas (shared build + read-only) -----------------------
function BracketCanvas({ rounds, editable, onPick, onRename }) {
  const colH = editable ? 1320 : 1140;
  const champion = rounds[5][0];
  const [la, lb] = thirdContenders(rounds);
  const thirdWin = rounds.__third || null;

  return (
    <div className="overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-2">
      <div className="text-[10px] text-cyan-500/70 font-medium mb-1">
        ← swipe sideways for all rounds →
      </div>
      <div className="flex" style={{ minWidth: 980 }}>
        {COLS.map((col, ci) => {
          const matches = SIZES[col.lvl] / 2;
          const next = COLS[ci + 1];
          return (
            <div key={col.lvl} className="flex shrink-0">
              <div
                className="flex flex-col shrink-0"
                style={{ width: ci === 0 ? 156 : 132 }}
              >
                <div className="text-center text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 h-4">
                  {col.label}
                </div>
                <div
                  className="flex flex-col justify-around px-1"
                  style={{ height: colH }}
                >
                  {Array.from({ length: matches }).map((_, m) => (
                    <MatchCard
                      key={m}
                      level={col.lvl}
                      m={m}
                      rounds={rounds}
                      editable={editable}
                      onPick={onPick}
                      onRename={onRename}
                    />
                  ))}
                </div>
              </div>
              {next && (
                <Connectors count={SIZES[next.lvl] / 2} colH={colH} />
              )}
            </div>
          );
        })}

        {/* Champion column */}
        <div className="flex flex-col shrink-0 pl-2" style={{ width: 150 }}>
          <div className="text-center text-[9px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1 h-4">
            Champion
          </div>
          <div className="flex items-center" style={{ height: colH }}>
            <div
              className={`w-full rounded-lg border px-2 py-3 text-center ${
                champion
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-slate-700/60 bg-slate-800/40"
              }`}
            >
              <Trophy
                className={`w-4 h-4 mx-auto mb-1 ${
                  champion ? "text-amber-300" : "text-slate-600"
                }`}
              />
              <div
                className={`text-xs font-bold break-words ${
                  champion ? "text-amber-200" : "text-slate-600 italic"
                }`}
              >
                {champion || "TBD"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Third-place match */}
      <div className="max-w-xs mt-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
          Third-Place Match
        </div>
        <div className="rounded-md border border-slate-700/60 bg-slate-800/50 overflow-hidden">
          {[la, lb].map((nm, i) => {
            const isWin = thirdWin != null && nm != null && thirdWin === nm;
            const can = editable && !!nm;
            return (
              <div key={i}>
                {i === 1 && <div className="border-t border-slate-700/40" />}
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => can && onPick("third", nm)}
                  className={`flex items-center gap-1 px-1.5 h-[26px] w-full text-left transition-colors ${
                    isWin ? "bg-emerald-500/15" : can ? "hover:bg-slate-700/40" : ""
                  } ${can ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`flex-1 min-w-0 truncate text-[11px] leading-none ${
                      isWin
                        ? "text-emerald-200 font-bold"
                        : nm
                        ? "text-slate-200 font-medium"
                        : "text-slate-600 italic"
                    }`}
                  >
                    {nm || "—"}
                  </span>
                  {isWin && (
                    <Trophy className="w-3 h-3 shrink-0 text-emerald-300" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----- build tab -----------------------------------------------------------
function BuildTab({ onSaved }) {
  const [rounds, setRounds] = useState(emptyRounds);
  const [third, setThird] = useState(null);
  const [title, setTitle] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // expose third pick to the canvas via a non-enumerable prop on rounds copy
  const roundsForCanvas = rounds.slice();
  roundsForCanvas.__third = third;

  const applyRounds = useCallback((next, nextThird) => {
    const clean = sanitize(next);
    setRounds(clean);
    const [la, lb] = thirdContenders(clean);
    const tw = nextThird !== undefined ? nextThird : third;
    setThird(tw === la || tw === lb ? tw : null);
  }, [third]);

  const onPick = useCallback(
    (level, idx) => {
      if (level === "third") {
        setThird((cur) => (cur === idx ? null : idx));
        return;
      }
      setRounds((cur) => {
        const next = cur.map((a) => a.slice());
        const team = next[level][idx];
        if (!team) return cur;
        const m = Math.floor(idx / 2);
        next[level + 1][m] = next[level + 1][m] === team ? null : team;
        const clean = sanitize(next);
        const [la, lb] = thirdContenders(clean);
        setThird((tw) => (tw === la || tw === lb ? tw : null));
        return clean;
      });
    },
    []
  );

  const onRename = useCallback((idx, value) => {
    setRounds((cur) => {
      const next = cur.map((a) => a.slice());
      next[0][idx] = value.trim() ? value : null;
      const clean = sanitize(next);
      const [la, lb] = thirdContenders(clean);
      setThird((tw) => (tw === la || tw === lb ? tw : null));
      return clean;
    });
  }, []);

  const applyBulk = () => {
    const names = bulk
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 32);
    const next = emptyRounds();
    names.forEach((n, i) => (next[0][i] = n));
    applyRounds(next, null);
    setBulkOpen(false);
  };

  const reset = () => {
    if (!confirm("Clear the entire bracket?")) return;
    setRounds(emptyRounds());
    setThird(null);
    setBulk("");
    setMsg(null);
  };

  const filled = rounds[0].filter(Boolean).length;

  const save = async () => {
    if (!title.trim()) {
      setMsg({ type: "err", text: "Add a name for your bracket first." });
      return;
    }
    if (filled < 2) {
      setMsg({ type: "err", text: "Add at least a couple of entrants." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title.trim(),
          bracket: { rounds, third: { winner: third } },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setMsg({ type: "ok", text: "Saved!" });
      onSaved?.(json.id);
    } catch (e) {
      setMsg({ type: "err", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bracket name (e.g. Mike's picks)"
          maxLength={60}
          className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
        />
        <button
          type="button"
          onClick={() => setBulkOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Paste names
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save bracket
        </button>
      </div>

      {msg && (
        <div
          className={`text-xs rounded-lg px-3 py-2 border ${
            msg.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {bulkOpen && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            One entrant per line (up to 32). This fills the Round of 32 from the
            top down and clears existing picks.
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={6}
            placeholder={"Team 1\nTeam 2\nTeam 3\n..."}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/60"
          />
          <button
            type="button"
            onClick={applyBulk}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-600"
          >
            Apply names
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Type entrants into the Round of 32, then tap the{" "}
        <ChevronRight className="inline w-3 h-3" /> (or any later-round name) to
        advance a winner all the way to the final. {filled}/32 entrants added.
      </p>

      <BracketCanvas
        rounds={roundsForCanvas}
        editable
        onPick={onPick}
        onRename={onRename}
      />
    </div>
  );
}

// ----- saved tab -----------------------------------------------------------
function SavedTab({ refreshKey }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [openData, setOpenData] = useState(null);
  const [loadingOne, setLoadingOne] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/draft");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setList(json.brackets || []);
    } catch (e) {
      setErr(String(e.message || e));
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const open = async (id) => {
    setOpenId(id);
    setLoadingOne(true);
    setOpenData(null);
    try {
      const res = await fetch(`/api/draft?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed.");
      setOpenData(json);
    } catch {
      setOpenData(null);
    } finally {
      setLoadingOne(false);
    }
  };

  if (list === null) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && (
        <div className="text-xs rounded-lg px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-300">
          {err}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-center text-slate-500 py-12 text-sm">
          No brackets saved yet. Build one and hit save.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {list.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => open(b.id)}
              className="text-left rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-100 truncate">
                  {b.name}
                </span>
                <Eye className="w-4 h-4 shrink-0 text-slate-500" />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-200 truncate">
                  {b.champion || "No champion picked"}
                </span>
              </div>
              {b.createdAt && (
                <div className="mt-1 text-[10px] text-slate-500">
                  {new Date(b.createdAt).toLocaleString()}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                {openData?.name || "Bracket"}
              </h3>
              {openData?.champion && (
                <p className="text-[11px] text-amber-300 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {openData.champion}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                setOpenData(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4">
            {loadingOne || !openData ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : (
              <ReadOnlyBracket data={openData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyBracket({ data }) {
  const rounds = (data.bracket?.rounds || emptyRounds()).slice();
  rounds.__third = data.bracket?.third?.winner ?? null;
  return (
    <BracketCanvas rounds={rounds} editable={false} onPick={() => {}} onRename={() => {}} />
  );
}

// ----- page shell ----------------------------------------------------------
export default function Draft() {
  const [view, setView] = useState("build");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    setView("saved");
  };

  const tabs = [
    { id: "build", label: "Build", icon: GitBranch },
    { id: "saved", label: "Saved Brackets", icon: Users },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 leading-tight">
              <GitBranch className="w-5 h-5 text-cyan-400" />
              Draft Order Bracket
            </h1>
            <p className="text-[11px] text-slate-500 leading-tight">
              Fill it out, pick winners through, and save it.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <div className="inline-flex p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-4 max-w-full overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {view === "build" ? (
          <BuildTab onSaved={handleSaved} />
        ) : (
          <SavedTab refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
