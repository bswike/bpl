import { useEffect, useId, useState } from "react";
import "./css/26-elevation-profile.css";
let profileRequest;
function loadProfiles() {
  if (!profileRequest)
    profileRequest = fetch("/data/black-bear-elevation.json")
      .then((response) => {
        if (!response.ok) throw new Error("Elevation data unavailable");
        return response.json();
      })
      .catch((error) => {
        profileRequest = null;
        throw error;
      });
  return profileRequest;
}

export default function ElevationProfile({ holeNumber, teeYards }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [selectedHole, setSelectedHole] = useState(holeNumber);
  const [teeIndex, setTeeIndex] = useState(0);
  const id = useId();
  useEffect(() => {
    let live = true;
    loadProfiles()
      .then((value) => {
        if (live) setData(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    setSelectedHole(holeNumber);
    const hole = data?.holes.find((h) => h.number === holeNumber);
    setTeeIndex(
      Math.max(0, hole?.tees.findIndex((t) => t.yards === teeYards) ?? 0),
    );
  }, [holeNumber, teeYards, data]);
  if (!data) return null;
  const hole =
    data.holes.find((h) => h.number === selectedHole) || data.holes[0];
  const tee = hole.tees[teeIndex] || hole.tees[0];
  const summary = tee.summary;
  const min = Math.floor((summary.lowestFt - 3) / 10) * 10,
    max = Math.ceil((summary.highestFt + 3) / 10) * 10;
  const length = summary.routeLengthM / 0.9144;
  const x = (distance) => 52 + (distance / summary.routeLengthM) * 400;
  const y = (elevation) => 154 - ((elevation - min) / (max - min)) * 108;
  const line = tee.points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(p.distanceM).toFixed(2)},${y(p.elevationFt).toFixed(2)}`,
    )
    .join(" ");
  const net = Math.round(summary.netChangeFt);
  return (
    <div className="trip-elevation">
      <button
        className="trip-elevation-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        ELEVATION PROFILE
      </button>
      {open && (
        <section
          className="trip-elevation-panel"
          id={id}
          aria-label="Black Bear elevation profiles"
        >
          <header>
            <div>
              <small>BLACK BEAR · LIDAR TERRAIN</small>
              <h3>Read the rise and fall</h3>
            </div>
            <button
              type="button"
              aria-label="Close elevation profile"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="trip-elevation-selects">
            <label>
              Hole
              <select
                aria-label="Elevation profile hole"
                value={hole.number}
                onChange={(event) => {
                  setSelectedHole(Number(event.target.value));
                  setTeeIndex(0);
                }}
              >
                {data.holes.map((h) => (
                  <option key={h.number} value={h.number}>
                    Hole {h.number} · Par {h.par}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tee
              <select
                aria-label="Elevation profile tee"
                value={tee.index}
                onChange={(event) => setTeeIndex(Number(event.target.value))}
              >
                {hole.tees.map((t) => (
                  <option key={t.index} value={t.index}>
                    {t.yards} yd tee
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="trip-elevation-stats">
            <b>
              {net > 0 ? "+" : ""}
              {net} ft <span>tee to green</span>
            </b>
            <span>
              {Math.round(summary.teeElevationFt)} ft tee →{" "}
              {Math.round(summary.greenElevationFt)} ft green
            </span>
          </div>
          <svg
            viewBox="0 0 480 202"
            role="img"
            aria-label={`Hole ${hole.number}, ${tee.yards} yard tee elevation profile: ${net} feet net change`}
          >
            <text x="52" y="20" className="trip-elevation-axis-title">
              Ground elevation (ft · NAVD88)
            </text>
            {[min, (min + max) / 2, max].map((tick) => (
              <g key={tick}>
                <path
                  d={`M52,${y(tick)}H452`}
                  className="trip-elevation-grid"
                />
                <text x="44" y={y(tick) + 4} textAnchor="end">
                  {tick}
                </text>
              </g>
            ))}
            <path
              d={`${line}L452,154L52,154Z`}
              className="trip-elevation-area"
            />
            <path d={line} className="trip-elevation-line" />
            <circle cx="52" cy={y(summary.teeElevationFt)} r="3" />
            <circle cx="452" cy={y(summary.greenElevationFt)} r="3" />
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <text
                key={fraction}
                x={52 + 400 * fraction}
                y="173"
                textAnchor="middle"
              >
                {Math.round(length * fraction)}
              </text>
            ))}
            <text
              x="252"
              y="195"
              textAnchor="middle"
              className="trip-elevation-axis-title"
            >
              Distance along mapped route (yd)
            </text>
          </svg>
          <p>
            Source:{" "}
            <a href={data.source.url} target="_blank" rel="noreferrer">
              NJ Northwest lidar, 2017–18
            </a>
            . Approx. 2 ft terrain cells; samples every 5 m or less. Profile
            follows mapped tee routes; route length may differ from scorecard
            yardage. Vertical scale is exaggerated.
          </p>
        </section>
      )}
    </div>
  );
}
