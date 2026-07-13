import { useMemo, useState } from "react";
import { Card } from "./ui";
import { DEFAULT_BLUE, DEFAULT_RED, runTripSim } from "./tripSim";

function rosterFromDefaults(team) {
  const src = team === "a" ? DEFAULT_BLUE : DEFAULT_RED;
  return src.map(([name, current, low]) => ({ name, current, low }));
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
        {label}
      </div>
      <div className="text-lg font-bold font-mono text-gray-900">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function MatchLine({ left, right, w, h, l, pct }) {
  return (
    <div className="text-[11px] font-mono text-gray-600 py-1 border-b border-gray-50 last:border-0">
      <span className="text-sky-700">{left}</span>
      <span className="text-gray-400"> vs </span>
      <span className="text-rose-700">{right}</span>
      <span className="text-gray-400">
        {" "}
        · Blue {pct(w)} halve {pct(h)} Red {pct(l)}
      </span>
    </div>
  );
}

export default function TripSimPanel({
  teamAName = "North",
  teamBName = "South",
  blueRoster,
  redRoster,
}) {
  const [mode, setMode] = useState("current");
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const blue = useMemo(() => {
    if (blueRoster?.length >= 4) return blueRoster;
    return rosterFromDefaults("a");
  }, [blueRoster]);

  const red = useMemo(() => {
    if (redRoster?.length >= 4) return redRoster;
    return rosterFromDefaults("b");
  }, [redRoster]);

  const usingDefaults =
    (!blueRoster || blueRoster.length < 4) || (!redRoster || redRoster.length < 4);

  const run = () => {
    setRunning(true);
    setOpen(true);
    // Yield so the spinner paints before the sim blocks the main thread.
    setTimeout(() => {
      const out = runTripSim(blue, red, { mode });
      setResult(out.error ? { error: out.error } : out);
      setRunning(false);
    }, 30);
  };

  return (
    <Card
      title="Cup simulator"
      right={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[10px] font-semibold">
            {[
              ["current", "Index"],
              ["blend", "Blend"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`px-2 py-1 border-none cursor-pointer transition-colors ${
                  mode === k
                    ? "bg-green-700 text-white"
                    : "bg-white text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-700 text-white border-none cursor-pointer disabled:opacity-50"
          >
            {running ? "Running…" : "Simulate"}
          </button>
        </div>
      }
    >
      <p className="text-[11px] text-gray-400 mb-3">
        Monte Carlo gross match play — {teamAName} ({blue.length}) vs {teamBName} (
        {red.length}). Hole-by-hole model calibrated to amateur scoring data.
        {usingDefaults && " Using default rosters until each team has 4+ indexed players."}
      </p>

      {result?.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {result && !result.error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat
              label="E points"
              value={result.trip.expected.toFixed(2)}
              sub={`of ${result.trip.points}`}
            />
            <Stat
              label={`${teamAName} win`}
              value={result.pct(result.trip.blueWin)}
              sub={`tie ${result.pct(result.trip.tie)}`}
            />
            <Stat
              label={`${teamBName} win`}
              value={result.pct(result.trip.redWin)}
            />
            <Stat
              label="Fair spot"
              value={
                result.fairSpots.find((s) => s.blue >= 0.45 && s.blue <= 0.55)
                  ?.spot != null
                  ? `+${result.fairSpots.find((s) => s.blue >= 0.45 && s.blue <= 0.55).spot}`
                  : "~+3"
              }
              sub="for ~50/50 cup"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
              Fair spot (full trip)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px] font-mono text-gray-600">
              {result.fairSpots.map((s) => (
                <div key={s.spot}>
                  +{s.spot}: {teamAName} {result.pct(s.blue)}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs text-gray-500 bg-transparent border-none cursor-pointer p-0 hover:text-gray-700"
          >
            {open ? "Hide match details ▴" : "Match details ▾"}
          </button>

          {open && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                  Singles ladder
                </div>
                {result.singles.map((m, i) => (
                  <MatchLine
                    key={i}
                    left={`${m.blue.name} ${m.blue.h.toFixed(1)}`}
                    right={`${m.red.name} ${m.red.h.toFixed(1)}`}
                    w={m.w}
                    h={m.h}
                    l={m.l}
                    pct={result.pct}
                  />
                ))}
                <div className="text-[10px] text-gray-400 mt-1">
                  E[{teamAName}]={result.expSingles.toFixed(2)}/{result.size} · coin-flips{" "}
                  {result.singlesCoin}/{result.size}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                  Day 1 four-ball (strong + weak)
                </div>
                {result.fourball.map((m, i) => (
                  <MatchLine
                    key={i}
                    left={`${m.blue[0].name}/${m.blue[1].name}`}
                    right={`${m.red[0].name}/${m.red[1].name}`}
                    w={m.w}
                    h={m.h}
                    l={m.l}
                    pct={result.pct}
                  />
                ))}
              </div>

              {result.altshot.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                    Alt shot (top {result.altshot.length * 2})
                  </div>
                  {result.altshot.map((m, i) => (
                    <MatchLine
                      key={i}
                      left={`${m.blue[0].name}/${m.blue[1].name} (${m.hb.toFixed(1)})`}
                      right={`${m.red[0].name}/${m.red[1].name} (${m.hr.toFixed(1)})`}
                      w={m.w}
                      h={m.h}
                      l={m.l}
                      pct={result.pct}
                    />
                  ))}
                </div>
              )}

              {result.botFourball.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                    Bottom four-ball
                  </div>
                  {result.botFourball.map((m, i) => (
                    <MatchLine
                      key={i}
                      left={`${m.blue[0].name}/${m.blue[1].name}`}
                      right={`${m.red[0].name}/${m.red[1].name}`}
                      w={m.w}
                      h={m.h}
                      l={m.l}
                      pct={result.pct}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
