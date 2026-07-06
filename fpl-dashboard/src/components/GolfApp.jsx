import { useState, useEffect, useMemo, useRef } from "react";
import { buildModel } from "./golf/data";
import OverviewTab from "./golf/OverviewTab";
import RoundsTab from "./golf/RoundsTab";
import CoursesTab from "./golf/CoursesTab";

const STORAGE_KEY = "golf-ghin-export";

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.scores?.length ? data : null;
  } catch {
    return null;
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded — persistence is best-effort */
  }
}

function LandingPage({ onLoad }) {
  const fileRef = useRef();
  const [tab, setTab] = useState("login");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ghinNumber, setGhinNumber] = useState("");

  const processFile = (file) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.scores?.length) {
          setError("No scores found in file.");
          return;
        }
        onLoad(data);
      } catch {
        setError("Could not parse JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setLoadingMsg("Authenticating with GHIN...");
    try {
      const res = await fetch("/api/ghin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ghinNumber: ghinNumber.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      setLoadingMsg("Processing scores...");
      const data = await res.json();
      if (!data.scores?.length)
        throw new Error("No scores found for this GHIN number.");
      onLoad(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const tabBtn =
    "flex-1 py-2.5 text-sm font-medium transition-colors border-none cursor-pointer";
  const tabInactive = "bg-gray-50 text-gray-500 hover:text-gray-700";
  const tabActive = "bg-green-50 text-green-800 font-semibold";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full min-w-0 mx-auto">
      <div className="text-5xl mb-1 text-center">⛳</div>
      <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight">
        Golf Stats
      </h1>
      <p className="text-xs text-gray-500 text-center uppercase tracking-widest mt-1">
        Sign in with GHIN or upload an export
      </p>

      <div className="flex mt-6 rounded-lg overflow-hidden border border-gray-200">
        <button
          type="button"
          className={`${tabBtn} ${tab === "login" ? tabActive : tabInactive}`}
          onClick={() => {
            setTab("login");
            setError(null);
          }}
        >
          Sign In to GHIN
        </button>
        <button
          type="button"
          className={`${tabBtn} ${tab === "file" ? tabActive : tabInactive}`}
          onClick={() => {
            setTab("file");
            setError(null);
          }}
        >
          Upload File
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={handleLogin} className="mt-5 space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GHIN email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GHIN number{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={ghinNumber}
              onChange={(e) => setGhinNumber(e.target.value)}
              placeholder="Only if you have several golfers or auto-detect fails"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? loadingMsg : "Fetch My Scores"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Credentials go to GHIN only; nothing is stored on this server.
          </p>
        </form>
      )}

      {tab === "file" && (
        <div className="mt-5 space-y-4 text-left">
          <button
            type="button"
            className={`w-full border-2 border-dashed rounded-xl py-10 px-4 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-2xl mb-2 opacity-50">📂</div>
            <div className="font-semibold text-gray-800">
              Drop <span className="text-green-700">ghin-scores.json</span> here
            </div>
            <div className="text-xs text-gray-400 mt-1">or click to browse</div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) processFile(e.target.files[0]);
              }}
            />
          </button>
          <p className="text-xs text-gray-400 text-center">
            A JSON export downloaded from this site (or the standalone fetcher)
            works here.
          </p>
        </div>
      )}
    </div>
  );
}

const TABS = [
  ["overview", "Overview"],
  ["rounds", "Rounds"],
  ["courses", "Courses"],
];

export default function GolfApp() {
  const [data, setData] = useState(loadSaved);
  const [tab, setTab] = useState("overview");
  const [year, setYear] = useState("all");
  const [holesFilter, setHolesFilter] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prevHtml = html.style.overflowX;
    const prevBody = body.style.overflowX;
    const prevRoot = root?.style.overflowX ?? "";
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    if (root) {
      root.style.overflowX = "hidden";
      root.style.maxWidth = "100%";
    }
    return () => {
      html.style.overflowX = prevHtml;
      body.style.overflowX = prevBody;
      if (root) {
        root.style.overflowX = prevRoot;
        root.style.maxWidth = "";
      }
    };
  }, []);

  const model = useMemo(() => (data ? buildModel(data) : null), [data]);

  // Year + holes filters applied everywhere; year-by-year tables get holes-only.
  const holesRounds = useMemo(() => {
    if (!model) return [];
    return holesFilter === "all"
      ? model.rounds
      : model.rounds.filter((r) => r.holes === Number(holesFilter));
  }, [model, holesFilter]);

  const rounds = useMemo(
    () => (year === "all" ? holesRounds : holesRounds.filter((r) => r.year === year)),
    [holesRounds, year]
  );

  const handleLoad = (d) => {
    setData(d);
    save(d);
    setTab("overview");
    setYear("all");
    setHolesFilter("all");
    setSelectedCourse(null);
  };

  const reset = () => {
    setData(null);
    setSelectedCourse(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghin-scores-${data.golfer?.ghin_number || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
        <header className="bg-green-800 text-white shrink-0 w-full min-w-0">
          <div className="max-w-5xl mx-auto px-4 py-6 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">⛳ Golf Stats</h1>
            <p className="text-green-200 text-sm mt-0.5">
              Analyze your GHIN scores — courses, holes, trends
            </p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-10 min-w-0 w-full">
          <LandingPage onLoad={handleLoad} />
        </div>
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 shrink-0">
          Golf Stats — Not affiliated with the USGA or GHIN
        </footer>
      </main>
    );
  }

  const g = model.golfer;

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
      <header className="bg-green-800 text-white shrink-0 w-full min-w-0">
        <div className="max-w-5xl mx-auto px-4 pt-5 pb-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                ⛳ {g.first_name ? `${g.first_name} ${g.last_name}` : "Golf Stats"}
              </h1>
              <p className="text-green-200 text-xs sm:text-sm">
                GHIN #{g.ghin_number ?? "—"}
                {g.club_name ? ` · ${g.club_name}` : ""} · {model.rounds.length} rounds
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {g.handicap_index != null && (
                <div className="text-right mr-1">
                  <div className="text-2xl sm:text-3xl font-bold leading-none">
                    {g.handicap_index}
                  </div>
                  <div className="text-green-200 text-[10px] uppercase tracking-wide">
                    Index
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleDownload}
                className="text-xs sm:text-sm bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg transition-colors cursor-pointer border-none text-white"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-xs sm:text-sm bg-green-900 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors cursor-pointer border-none text-white"
              >
                New export
              </button>
            </div>
          </div>

          <nav className="flex gap-1 mt-4 -mb-4">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-none cursor-pointer transition-colors ${
                  tab === k
                    ? "bg-[#f8faf8] text-green-900"
                    : "bg-green-700/40 text-green-100 hover:bg-green-700"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full min-w-0 mx-auto px-4 py-5">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="all">All years</option>
            {model.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
            {[
              ["all", "All"],
              ["18", "18 holes"],
              ["9", "9 holes"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setHolesFilter(k)}
                className={`px-3 py-1.5 text-xs font-medium border-none cursor-pointer ${
                  holesFilter === k
                    ? "bg-green-100 text-green-900 font-semibold"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-1">
            {rounds.length} of {model.rounds.length} rounds
          </span>
        </div>

        {tab === "overview" && <OverviewTab rounds={rounds} yearRounds={holesRounds} />}
        {tab === "rounds" && <RoundsTab rounds={rounds} />}
        {tab === "courses" && (
          <CoursesTab rounds={rounds} selected={selectedCourse} onSelect={setSelectedCourse} />
        )}
      </div>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 shrink-0">
        Golf Stats — Not affiliated with the USGA or GHIN
      </footer>
    </main>
  );
}
