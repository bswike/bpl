import { useState, useEffect, useMemo, useRef } from "react";
import {
  Home,
  BarChart3,
  MapPin,
  Bird,
  Settings,
  CircleUserRound,
  Search,
} from "lucide-react";
import { buildModel } from "./golf/data";
import { Avatar } from "./golf/ui";
import FeedTab from "./golf/FeedTab";
import ProfileTab from "./golf/ProfileTab";
import OverviewTab from "./golf/OverviewTab";
import CoursesTab from "./golf/CoursesTab";
import BirdiesTab from "./golf/BirdiesTab";

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
  const [share, setShare] = useState(false);

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
          publish: share,
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
          <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              disabled={loading}
              className="mt-0.5 accent-green-700"
            />
            <span>
              Share my rounds to the public feed{" "}
              <span className="text-xs text-gray-400 block">
                Your name, scores, and courses become visible to anyone. You can
                remove yourself anytime from settings.
              </span>
            </span>
          </label>
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
  ["home", "Home"],
  ["overview", "Overview"],
  ["birdies", "Birdie Tracker"],
  ["courses", "Courses"],
  ["profile", "Profile"],
];

// Tabs without the global year/holes filter bar (they have their own controls
// or, like the feed and profile, are meant to feel like a standalone app).
const NO_FILTER_TABS = new Set(["home", "birdies", "profile"]);

const BOTTOM_NAV = [
  ["home", "Home", Home],
  ["overview", "Stats", BarChart3],
  ["birdies", "Birdies", Bird],
  ["courses", "Courses", MapPin],
  ["profile", "Profile", CircleUserRound],
];

function GolferSearch({ peers, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const results = peers
    .filter((p) => {
      const g = p.golfer || {};
      const hay =
        `${g.first_name || ""} ${g.last_name || ""} ${g.club_name || ""} ${g.ghin_number || ""}`.toLowerCase();
      return !needle || hay.includes(needle);
    })
    .slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Search public golfers"
        onClick={() => setOpen(!open)}
        className={`w-9 h-9 rounded-full flex items-center justify-center border cursor-pointer transition-colors ${
          open
            ? "bg-white/10 border-white/60 text-white"
            : "bg-transparent border-white/25 text-green-50 hover:border-white/60 hover:bg-white/5"
        }`}
      >
        <Search size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 max-w-[82vw] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden text-gray-800">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search public golfers…"
            className="w-full px-4 py-2.5 text-sm border-none outline-none bg-white text-gray-900"
          />
          <div className="max-h-72 overflow-y-auto border-t border-gray-100">
            {peers.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400">
                No public profiles yet — be the first to publish from settings.
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400">No golfers match “{q}”.</p>
            ) : (
              results.map((p) => {
                const g = p.golfer || {};
                const ghin = String(g.ghin_number ?? "");
                return (
                  <button
                    key={ghin}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      onSelect(ghin);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors text-left"
                  >
                    <Avatar golfer={g} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {g.first_name} {g.last_name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {g.club_name ? `${g.club_name} · ` : ""}
                        {p.model.rounds.length} rounds
                        {g.handicap_index != null ? ` · ${g.handicap_index} index` : ""}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsMenu({ onDownload, onReset, published, onPublish, onUnpublish }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item =
    "w-full text-left px-4 py-2.5 text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Settings"
        onClick={() => setOpen(!open)}
        className={`w-9 h-9 rounded-full flex items-center justify-center border cursor-pointer transition-colors ${
          open
            ? "bg-white/10 border-white/60 text-white"
            : "bg-transparent border-white/25 text-green-50 hover:border-white/60 hover:bg-white/5"
        }`}
      >
        <Settings size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 text-gray-800 overflow-hidden">
          {published ? (
            <button
              type="button"
              className={`${item} text-gray-700`}
              onClick={() => {
                setOpen(false);
                onUnpublish();
              }}
            >
              Remove from public feed
              <span className="block text-[11px] text-green-600">
                Currently public
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={`${item} text-gray-700`}
              onClick={() => {
                setOpen(false);
                onPublish();
              }}
            >
              Publish to public feed
              <span className="block text-[11px] text-gray-400">
                Share your rounds with everyone
              </span>
            </button>
          )}
          <button
            type="button"
            className={`${item} text-gray-700 border-t border-gray-100`}
            onClick={() => {
              setOpen(false);
              onDownload();
            }}
          >
            Download JSON
          </button>
          <button
            type="button"
            className={`${item} text-red-600 border-t border-gray-100`}
            onClick={() => {
              setOpen(false);
              onReset();
            }}
          >
            New export…
          </button>
        </div>
      )}
    </div>
  );
}

export default function GolfApp() {
  const [data, setData] = useState(loadSaved);
  const [tab, setTab] = useState("home");
  const [year, setYear] = useState("all");
  const [holesFilter, setHolesFilter] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [publicFeed, setPublicFeed] = useState(null); // null = loading
  const [peer, setPeer] = useState(null); // {golfer, model} of another golfer
  const [showLanding, setShowLanding] = useState(false);
  const [published, setPublished] = useState(false);
  const actedRef = useRef(false); // user published/unpublished this session

  const fetchFeed = (bustCache = false) =>
    fetch(`/api/golf-feed${bustCache ? `?ts=${Date.now()}` : ""}`)
      .then((r) => (r.ok ? r.json() : { golfers: [] }))
      .then((d) => setPublicFeed(d.golfers || []))
      .catch(() => setPublicFeed((prev) => prev || []));

  useEffect(() => {
    fetchFeed();
  }, []);

  const peerModels = useMemo(
    () =>
      (publicFeed || [])
        .map((g) => {
          try {
            return { golfer: g.golfer, model: buildModel(g) };
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    [publicFeed]
  );

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
  const myGhin = String(data?.golfer?.ghin_number ?? "");

  // Merged feed: my local rounds plus everyone else's published rounds.
  const feedEntries = useMemo(() => {
    const entries = [];
    if (model) {
      for (const r of model.rounds)
        entries.push({ ...r, golfer: model.golfer, ownerId: "me" });
    }
    for (const pm of peerModels) {
      const ghin = String(pm.golfer?.ghin_number ?? "");
      if (model && ghin === myGhin) continue; // my published copy — local wins
      for (const r of pm.model.rounds)
        entries.push({ ...r, golfer: pm.golfer, ownerId: ghin });
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [model, peerModels, myGhin]);

  // Am I on the public feed? Trust the feed until the user acts this session.
  useEffect(() => {
    if (actedRef.current || !publicFeed || !myGhin) return;
    setPublished(publicFeed.some((g) => String(g.golfer?.ghin_number ?? "") === myGhin));
  }, [publicFeed, myGhin]);

  const openProfile = (ownerId) => {
    if (ownerId === "me") {
      setTab("profile");
      return;
    }
    const pm = peerModels.find((p) => String(p.golfer?.ghin_number ?? "") === ownerId);
    if (pm) {
      setPeer(pm);
      setTab("peer");
    }
  };

  // From search: my own GHIN opens my local profile, anyone else opens a peer view.
  const selectGolfer = (ghin) => {
    if (data && String(ghin) === myGhin) setTab("profile");
    else openProfile(String(ghin));
  };

  const publishNow = async () => {
    try {
      const res = await fetch("/api/golf-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      actedRef.current = true;
      setPublished(true);
      fetchFeed(true);
    } catch (err) {
      window.alert(`Could not publish: ${err.message}`);
    }
  };

  const unpublishNow = async () => {
    try {
      const res = await fetch("/api/golf-publish", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      actedRef.current = true;
      setPublished(false);
      fetchFeed(true);
    } catch (err) {
      window.alert(`Could not unpublish: ${err.message}`);
    }
  };

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
    setTab("home");
    setYear("all");
    setHolesFilter("all");
    setSelectedCourse(null);
    setShowLanding(false);
    if (d.published) {
      actedRef.current = true;
      setPublished(true);
      fetchFeed(true);
    }
  };

  const reset = () => {
    setData(null);
    setSelectedCourse(null);
    setPeer(null);
    setTab("home");
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
    const showGuestFeed =
      !showLanding && publicFeed !== null && publicFeed.length > 0;
    return (
      <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
        <header className="relative bg-gradient-to-br from-[#0a2417] via-[#123a26] to-[#1d5133] text-white shrink-0 w-full min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 min-w-0 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {showGuestFeed && (
                <GolferSearch peers={peerModels} onSelect={selectGolfer} />
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#d4af37]">
                  Swikle.com
                </p>
                <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mt-1">
                  Golf Stats
                </h1>
                <p className="text-green-100/60 text-sm mt-1.5">
                  {showGuestFeed
                    ? "The public feed — GHIN rounds, out in the open"
                    : "Your GHIN scores — courses, holes, trends"}
                </p>
              </div>
            </div>
            {showGuestFeed && (
              <button
                type="button"
                onClick={() => setShowLanding(true)}
                className="text-[11px] uppercase tracking-wider bg-transparent border border-white/25 hover:border-white/60 hover:bg-white/5 px-4 py-1.5 rounded-full transition-colors cursor-pointer text-green-50"
              >
                Sign in
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
        </header>
        {showGuestFeed ? (
          <div className="flex-1 max-w-5xl w-full min-w-0 mx-auto px-4 py-5">
            {tab === "peer" && peer ? (
              <ProfileTab
                golfer={peer.golfer}
                rounds={peer.model.rounds}
                onBack={() => setTab("home")}
              />
            ) : (
              <FeedTab
                entries={feedEntries}
                ownGolfer={null}
                onProfile={openProfile}
                onSignIn={() => setShowLanding(true)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-w-0 w-full gap-4">
            <LandingPage onLoad={handleLoad} />
            {publicFeed !== null && publicFeed.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLanding(false)}
                className="text-sm bg-transparent border-none cursor-pointer text-green-800 font-semibold hover:underline"
              >
                ← Browse the public feed without signing in
              </button>
            )}
          </div>
        )}
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 shrink-0">
          Golf Stats — Not affiliated with the USGA or GHIN
        </footer>
      </main>
    );
  }

  const g = model.golfer;

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
      <header className="relative bg-gradient-to-br from-[#0a2417] via-[#123a26] to-[#1d5133] text-white shrink-0 w-full min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-7 pb-6 sm:pb-0 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <GolferSearch peers={peerModels} onSelect={selectGolfer} />
              <Avatar
                golfer={g}
                size="md"
                ring={tab === "profile"}
                onClick={() => setTab("profile")}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#d4af37]">
                  Golf Stats
                </p>
                <h1 className="font-serif text-2xl sm:text-[2rem] leading-tight tracking-tight mt-1 truncate">
                  {g.first_name ? `${g.first_name} ${g.last_name}` : "Golf Stats"}
                </h1>
                <p className="text-green-100/60 text-xs sm:text-sm mt-1">
                  GHIN #{g.ghin_number ?? "—"}
                  {g.club_name ? ` · ${g.club_name}` : ""} · {model.rounds.length} rounds
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 pb-0.5 pr-12">
              {g.handicap_index != null && (
                <div className="text-right">
                  <div className="font-serif text-3xl sm:text-4xl leading-none text-[#e8d48a]">
                    {g.handicap_index}
                  </div>
                  <div className="text-green-100/50 text-[9px] uppercase tracking-[0.2em] mt-1">
                    Handicap index
                  </div>
                </div>
              )}
            </div>
            <div className="absolute top-5 right-4 sm:right-6">
              <SettingsMenu
                onDownload={handleDownload}
                onReset={reset}
                published={published}
                onPublish={publishNow}
                onUnpublish={unpublishNow}
              />
            </div>
          </div>

          <nav className="hidden sm:flex gap-7 mt-6">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`pb-3 text-sm bg-transparent cursor-pointer transition-colors tracking-wide ${
                  tab === k
                    ? "text-white font-semibold"
                    : "text-green-100/60 hover:text-white font-medium"
                }`}
                style={{
                  border: "none",
                  borderBottom:
                    tab === k ? "2px solid #d4af37" : "2px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
      </header>

      <div className="flex-1 max-w-5xl w-full min-w-0 mx-auto px-4 pt-5 pb-24 sm:pb-6">
        <div
          className={`flex-wrap items-center gap-2 mb-5 ${
            NO_FILTER_TABS.has(tab) ? "hidden" : "flex"
          }`}
        >
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

        {tab === "home" && (
          <FeedTab entries={feedEntries} ownGolfer={g} onProfile={openProfile} />
        )}
        {tab === "peer" && peer && (
          <ProfileTab
            golfer={peer.golfer}
            rounds={peer.model.rounds}
            onBack={() => setTab("home")}
          />
        )}
        {tab === "profile" && <ProfileTab golfer={g} rounds={model.rounds} />}
        {tab === "overview" && <OverviewTab rounds={rounds} yearRounds={holesRounds} />}
        {tab === "courses" && (
          <CoursesTab rounds={rounds} selected={selectedCourse} onSelect={setSelectedCourse} />
        )}
        {tab === "birdies" && <BirdiesTab rounds={model.rounds} />}
      </div>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex justify-around pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {BOTTOM_NAV.map(([k, label, IconCmp]) => {
          const Icon = IconCmp;
          return (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 bg-transparent border-none cursor-pointer ${
              tab === k ? "text-green-800" : "text-gray-400"
            }`}
          >
            <Icon size={20} strokeWidth={tab === k ? 2.4 : 1.8} />
            <span className="text-[9px] font-semibold">{label}</span>
          </button>
          );
        })}
      </nav>

      <footer className="text-center text-xs text-gray-400 py-4 pb-20 sm:pb-4 border-t border-gray-100 shrink-0">
        Golf Stats — Not affiliated with the USGA or GHIN
      </footer>
    </main>
  );
}
