import { useEffect, useMemo, useRef, useState } from "react";
import {
  AIMS,
  CLUBS,
  SCORE_BUCKETS,
  SHAPES,
  buildHoleOdds,
  buildTripGameModel,
  chooseCpuPlayer,
  courseHandicap,
  defaultDecision,
  formatOdds,
  makeSeededRandom,
  resolveMatchHole,
  scoreLabel,
} from "./tripGameEngine.js";
import "./TripGame.css";

const ARCHIVE_FILES = ["/data/golftrip-nj26.json", "/data/golftrip-2025.json"];
const FIREBALL_HOLES = new Set([4, 8, 12, 16]);
const FEATURE_ORDER = { water: 0, fairway: 1, bunker: 2, green: 3, tee: 4 };
const DEFAULT_PLAYER_STATE = Object.freeze({ buzz: 0, morale: 50 });

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function lastName(name) {
  return String(name || "").trim().split(/\s+/).at(-1) || name;
}

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function pathFromPoints(points, close = true) {
  if (!points?.length) return "";
  const commands = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")}${close ? " Z" : ""}`;
}

function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < (points?.length || 0); index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return total;
}

function pointAlongPolyline(points, distance) {
  if (!points?.length) return { point: [0, 0], tangent: [0, -1] };
  if (points.length === 1) return { point: points[0], tangent: [0, -1] };
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    if (remaining <= length) {
      const ratio = remaining / length;
      return {
        point: [start[0] + dx * ratio, start[1] + dy * ratio],
        tangent: [dx / length, dy / length],
      };
    }
    remaining -= length;
  }
  const end = points.at(-1);
  const previous = points.at(-2);
  const dx = end[0] - previous[0];
  const dy = end[1] - previous[1];
  const length = Math.hypot(dx, dy) || 1;
  return { point: end, tangent: [dx / length, dy / length] };
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildTreeSprites(projection, holeNumber) {
  const length = polylineLength(projection.line);
  if (!length) return [];
  const rows = clamp(Math.round(projection.height / 44), 6, 13);
  const trees = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = 0.08 + (row / Math.max(1, rows - 1)) * 0.82;
    const axis = pointAlongPolyline(projection.line, length * progress);
    const perpendicular = [-axis.tangent[1], axis.tangent[0]];
    for (const side of [-1, 1]) {
      const seed = holeNumber * 101 + row * 17 + (side > 0 ? 7 : 3);
      if (seededUnit(seed) < 0.13) continue;
      const corridor = clamp(projection.width * 0.22, 18, 43);
      const offset = corridor + seededUnit(seed + 1) * 13;
      const along = (seededUnit(seed + 2) - 0.5) * 12;
      const x = axis.point[0] + perpendicular[0] * offset * side + axis.tangent[0] * along;
      const y = axis.point[1] + perpendicular[1] * offset * side + axis.tangent[1] * along;
      if (x < 5 || x > projection.width - 5 || y < 8 || y > projection.height - 8) continue;
      trees.push({
        x,
        y,
        size: 4.2 + seededUnit(seed + 3) * 3.6,
        variant: Math.floor(seededUnit(seed + 4) * 3),
      });
    }
  }
  return trees;
}

function fallbackProjection(hole) {
  const bend = hole.number % 2 ? -18 : 18;
  const waterSide = hole.number % 3 === 0 ? "right" : hole.number % 4 === 0 ? "left" : null;
  const features = [
    {
      type: "fairway",
      points: [
        [70, 216],
        [103, 172],
        [90 + bend, 116],
        [92, 48],
        [69, 42],
        [58 + bend, 112],
        [48, 176],
      ],
    },
    { type: "green", points: [[63, 43], [73, 29], [93, 32], [101, 47], [92, 58], [73, 57]] },
    { type: "tee", points: [[65, 216], [96, 216], [94, 229], [66, 229]] },
    { type: "bunker", points: [[51, 61], [62, 50], [67, 65], [56, 73]] },
  ];
  if (waterSide) {
    const left = waterSide === "left";
    features.push({
      type: "water",
      points: left
        ? [[0, 118], [39, 110], [47, 150], [24, 180], [0, 173]]
        : [[119, 103], [160, 91], [160, 174], [132, 165], [112, 132]],
    });
  }
  return {
    width: 160,
    height: 240,
    features,
    line: [[80, 222], [80 + bend, 125], [82, 43]],
    tee: [80, 222],
    pin: [82, 43],
    dangerSide: waterSide,
    primaryHazard: waterSide ? "water" : "bunker",
    hasWater: Boolean(waterSide),
    hazardLabel: waterSide ? `WATER ${waterSide.toUpperCase()}` : "BUNKERS LEFT",
    official: null,
    elevation: null,
    source: "prototype",
  };
}

function projectHole(geometry, hole) {
  const sourceHole = geometry?.holes?.find((entry) => Number(entry.num) === hole.number);
  if (!sourceHole?.line?.length) return fallbackProjection(hole);
  const teeRaw = sourceHole.tees?.[0]?.pos || sourceHole.line[0];
  const pinRaw = sourceHole.pin || sourceHole.line.at(-1);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((teeRaw[0] * Math.PI) / 180);
  const toMeters = ([lat, lng]) => [(lng - teeRaw[1]) * metersPerDegreeLng, (lat - teeRaw[0]) * metersPerDegreeLat];
  const pinMeters = toMeters(pinRaw);
  const angle = Math.PI / 2 - Math.atan2(pinMeters[1], pinMeters[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
  const transformRaw = (point) => rotate(toMeters(point));
  const rawFeatures = (geometry.features || [])
    .filter((feature) => Number(feature.hole) === hole.number && Array.isArray(feature.coords) && feature.coords.length >= 3)
    .map((feature) => ({
      type: feature.type,
      points: feature.coords.map(transformRaw).filter((point) => point.every(Number.isFinite)),
    }))
    .filter((feature) => feature.points.length >= 3);
  const rawLine = sourceHole.line.map(transformRaw).filter((point) => point.every(Number.isFinite));
  const rawTee = transformRaw(teeRaw);
  const rawPin = transformRaw(pinRaw);
  const allPoints = [...rawFeatures.flatMap((feature) => feature.points), ...rawLine, rawTee, rawPin];
  if (!allPoints.length) return fallbackProjection(hole);
  const pad = 14;
  const minX = Math.min(...allPoints.map((point) => point[0])) - pad;
  const maxX = Math.max(...allPoints.map((point) => point[0])) + pad;
  const minY = Math.min(...allPoints.map((point) => point[1])) - pad;
  const maxY = Math.max(...allPoints.map((point) => point[1])) + pad;
  const width = Math.max(50, maxX - minX);
  const height = Math.max(80, maxY - minY);
  const toSvg = ([x, y]) => [x - minX, maxY - y];

  const hazards = rawFeatures.filter((feature) => feature.type === "water" || feature.type === "bunker");
  let hazardPull = 0;
  for (const feature of hazards) {
    const centerX = feature.points.reduce((total, point) => total + point[0], 0) / feature.points.length;
    hazardPull += centerX * (feature.type === "water" ? 2.5 : 1);
  }
  const dangerSide = Math.abs(hazardPull) < 2 ? null : hazardPull < 0 ? "left" : "right";
  const hasWater = hazards.some((feature) => feature.type === "water");
  const primaryHazard = hasWater ? "water" : hazards.length ? "bunker" : null;
  const hazardLabel = primaryHazard
    ? `${primaryHazard === "water" ? "WATER" : "BUNKERS"}${dangerSide ? ` ${dangerSide.toUpperCase()}` : ""}`
    : "NO MAJOR HAZARD";

  return {
    width,
    height,
    features: rawFeatures
      .map((feature) => ({ ...feature, points: feature.points.map(toSvg) }))
      .sort((a, b) => (FEATURE_ORDER[a.type] ?? 9) - (FEATURE_ORDER[b.type] ?? 9)),
    line: rawLine.map(toSvg),
    tee: toSvg(rawTee),
    pin: toSvg(rawPin),
    dangerSide,
    primaryHazard,
    hasWater,
    hazardLabel,
    official: sourceHole,
    elevation: Number(sourceHole.elevM) || null,
    source: "OpenStreetMap / ODbL",
  };
}

function ScoreOdds({ odds }) {
  if (!odds) return <div className="trip-game-empty">PICK A GOLFER TO LOAD ODDS</div>;
  return (
    <div className="trip-game-odds">
      <div className="trip-game-section-label">
        <span>HOLE OUTCOME MODEL</span>
        <span>EXP {odds.expectedGross.toFixed(1)}</span>
      </div>
      <div
        className="trip-game-odds-bar"
        role="img"
        aria-label={SCORE_BUCKETS.map((bucket, index) => `${bucket.label} ${formatOdds(odds.probs[index])}`).join(", ")}
      >
        {SCORE_BUCKETS.map((bucket, index) => (
          <div
            key={bucket.id}
            className={`trip-game-odds-segment trip-game-odds-segment--${bucket.tone}`}
            style={{ flexGrow: Math.max(odds.probs[index], 0.025) }}
            title={`${bucket.label}: ${formatOdds(odds.probs[index])}`}
          >
            <span>{bucket.short}</span>
            <b>{formatOdds(odds.probs[index])}</b>
          </div>
        ))}
      </div>
      <div className="trip-game-landing">
        {Object.entries(odds.landing).map(([label, value]) => (
          <span key={label}>
            {label === "penalty" ? "PENALTY" : label.toUpperCase()} <b>{formatOdds(value)}</b>
          </span>
        ))}
      </div>
      {odds.actualGross != null ? (
        <div className="trip-game-memory">
          ACTUAL TRIP MEMORY: <b>{odds.actualGross}</b> ({scoreLabel(odds.actualRelative)}) · CURRENT MODEL CHANCE{" "}
          <b>{formatOdds(odds.actualChance)}</b>
        </div>
      ) : (
        <div className="trip-game-memory trip-game-memory--muted">NO SCORE ON THIS HOLE · INDEX + HISTORY MODEL</div>
      )}
    </div>
  );
}

function HoleMap({ projection, hole, decision, result }) {
  const aim = AIMS.find((item) => item.id === decision.aim) || AIMS[1];
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const club = CLUBS.find((item) => item.id === decision.club) || CLUBS[0];
  const lineLength = polylineLength(projection.line);
  const targetYards = hole.yards ? Math.min(club.carry, Math.round(hole.yards * 0.96)) : club.carry;
  const targetDistance = hole.yards ? lineLength * (targetYards / hole.yards) : lineLength * (hole.par <= 3 ? 0.94 : 0.58);
  const centerTarget = pointAlongPolyline(projection.line, targetDistance);
  const perpendicular = [-centerTarget.tangent[1], centerTarget.tangent[0]];
  const lateralAim = aim.offset * clamp(projection.width * 0.12, 10, 22);
  const target = [
    centerTarget.point[0] + perpendicular[0] * lateralAim,
    centerTarget.point[1] + perpendicular[1] * lateralAim,
  ];
  const middle = [
    (projection.tee[0] + target[0]) / 2,
    (projection.tee[1] + target[1]) / 2,
  ];
  const bend = shape.bias * clamp(projection.width * 0.32, 20, 48);
  const control = [middle[0] + perpendicular[0] * bend, middle[1] + perpendicular[1] * bend];
  const shotPath = `M${projection.tee[0].toFixed(1)},${projection.tee[1].toFixed(1)} Q${control[0].toFixed(
    1,
  )},${control[1].toFixed(1)} ${target[0].toFixed(1)},${target[1].toFixed(1)}`;
  const dangerDirection = projection.dangerSide === "left" ? -1 : 1;
  const landingDistance =
    result?.humanLanding === "Penalty area"
      ? 31
      : result?.humanLanding === "Bunker"
        ? 19
        : result?.humanLanding === "Rough"
          ? 11
          : 2;
  const landingDirection = result?.humanLanding === "Fairway" ? (hole.number % 2 ? -1 : 1) : dangerDirection;
  const landing = [
    target[0] + perpendicular[0] * landingDistance * landingDirection,
    target[1] + perpendicular[1] * landingDistance * landingDirection,
  ];
  const remainingYards = hole.yards ? Math.max(0, Math.round(hole.yards - targetYards)) : null;
  const trees = buildTreeSprites(projection, hole.number);
  const mapId = `trip-hole-${hole.number}`;

  return (
    <div className="trip-game-map-wrap">
      <div className="trip-game-map-hud">
        <span>{projection.hazardLabel}</span>
        <span>
          {club.short} {targetYards}Y · {remainingYards != null ? `${remainingYards}Y LEFT` : "TEE PLAN"}
        </span>
      </div>
      <svg
        className="trip-game-map"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Top-down map of hole ${hole.number}`}
        role="img"
      >
        <defs>
          <pattern id={`${mapId}-rough`} width="13" height="13" patternUnits="userSpaceOnUse">
            <rect width="13" height="13" fill="transparent" />
            <rect x="2" y="3" width="2" height="2" className="trip-game-rough-pixel" />
            <rect x="9" y="8" width="1.5" height="1.5" className="trip-game-rough-pixel trip-game-rough-pixel--light" />
          </pattern>
          <pattern id={`${mapId}-fairway`} width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="9" height="18" className="trip-game-fairway-stripe" />
            <rect x="9" width="9" height="18" className="trip-game-fairway-stripe trip-game-fairway-stripe--light" />
          </pattern>
          <pattern id={`${mapId}-green`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" className="trip-game-green-cut" />
          </pattern>
          <pattern id={`${mapId}-sand`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.8" className="trip-game-sand-grain" />
            <circle cx="7" cy="6" r="0.55" className="trip-game-sand-grain" />
          </pattern>
          <pattern id={`${mapId}-water`} width="16" height="10" patternUnits="userSpaceOnUse">
            <path d="M-2 3 Q2 0 6 3 T14 3 T22 3 M3 8 Q7 5 11 8 T19 8" className="trip-game-water-ripple" />
          </pattern>
          <filter id={`game-pixel-shadow-${hole.number}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="2" dy="2" stdDeviation="0" floodColor="#07180f" />
          </filter>
        </defs>
        <rect width={projection.width} height={projection.height} className="trip-game-map-rough" />
        <rect width={projection.width} height={projection.height} fill={`url(#${mapId}-rough)`} />
        <circle
          cx={projection.tee[0]}
          cy={projection.tee[1]}
          r={Math.max(0, targetDistance)}
          className="trip-game-carry-arc"
        />
        <g className="trip-game-tree-layer" aria-hidden="true">
          {trees.map((tree, index) => (
            <g
              key={`${tree.x.toFixed(1)}-${tree.y.toFixed(1)}-${index}`}
              className={`trip-game-tree trip-game-tree--${tree.variant}`}
              transform={`translate(${tree.x.toFixed(1)} ${tree.y.toFixed(1)}) scale(${(tree.size / 6).toFixed(2)})`}
            >
              <ellipse className="trip-game-tree-shadow" cx="2" cy="4.5" rx="5.5" ry="2.2" />
              <rect className="trip-game-tree-trunk" x="-1" y="-1" width="2.3" height="7" />
              <path className="trip-game-tree-back" d="M0,-9 L-6,-1 L-3,-1 L-7,4 L7,4 L3,-1 L6,-1 Z" />
              <rect className="trip-game-tree-front" x="-4.5" y="-3.5" width="9" height="6.5" />
            </g>
          ))}
        </g>
        {projection.features.map((feature, index) => (
          <g key={`${feature.type}-${index}`}>
            <path
              d={pathFromPoints(feature.points)}
              className={`trip-game-map-feature trip-game-map-feature--${feature.type}`}
            />
            {["fairway", "green", "bunker", "water"].includes(feature.type) && (
              <path
                d={pathFromPoints(feature.points)}
                className={`trip-game-map-texture trip-game-map-texture--${feature.type}`}
                fill={`url(#${mapId}-${feature.type === "bunker" ? "sand" : feature.type})`}
              />
            )}
          </g>
        ))}
        <path d={pathFromPoints(projection.line, false)} className="trip-game-centerline" />
        <path d={shotPath} className="trip-game-shot-line" />
        <g className="trip-game-target" transform={`translate(${target[0]} ${target[1]})`}>
          <circle r="5.5" />
          <path d="M-8 0 H8 M0 -8 V8" />
        </g>
        <text
          x={clamp(target[0] + 7, 8, projection.width - 44)}
          y={clamp(target[1] - 7, 10, projection.height - 8)}
          className="trip-game-carry-label"
        >
          {targetYards}Y
        </text>
        <g className="trip-game-golfer" transform={`translate(${projection.tee[0] - 5} ${projection.tee[1] - 13})`}>
          <rect x="3" y="0" width="5" height="5" />
          <rect x="2" y="5" width="7" height="7" />
          <rect x="0" y="12" width="4" height="7" />
          <rect x="7" y="12" width="4" height="7" />
        </g>
        <g className="trip-game-flag" transform={`translate(${projection.pin[0]} ${projection.pin[1]})`}>
          <rect x="-1" y="-13" width="2" height="14" />
          <path d="M1,-13 L10,-9 L1,-5 Z" />
          <rect x="-3" y="0" width="6" height="2" />
        </g>
        {result && (
          <g
            className="trip-game-ball-marker"
            transform={`translate(${clamp(landing[0], 5, projection.width - 5)} ${clamp(landing[1], 5, projection.height - 5)})`}
            filter={`url(#game-pixel-shadow-${hole.number})`}
          >
            <circle r="4.5" className="trip-game-ball-halo" />
            <rect x="-2.5" y="-2.5" width="5" height="5" className="trip-game-ball" />
          </g>
        )}
      </svg>
      <div className="trip-game-map-foot">
        <span>
          PAR {hole.par} · {hole.yards ? `${hole.yards} YDS` : "YARDAGE N/A"}
        </span>
        <span>{projection.elevation ? `ELEV ${projection.elevation}M` : ""}</span>
        <span>{projection.source}</span>
      </div>
    </div>
  );
}

function PlayerCard({ player, playerState, course }) {
  if (!player) {
    return (
      <div className="trip-game-player-card trip-game-player-card--empty">
        <span className="trip-game-avatar">?</span>
        <div>
          <b>CAPTAIN, MAKE YOUR PICK</b>
          <small>Each golfer may be used a limited number of times.</small>
        </div>
      </div>
    );
  }
  return (
    <div className="trip-game-player-card">
      <span className="trip-game-avatar">{initials(player.name)}</span>
      <div className="trip-game-player-main">
        <div className="trip-game-player-name">
          <b>{player.name}</b>
          {player.trait && <em>{player.trait}</em>}
        </div>
        <div className="trip-game-player-meta">
          INDEX {player.hi.toFixed(1)} / CH {courseHandicap(player.hi, course)} · MODELED STOCK {player.stockShape.toUpperCase()}
        </div>
      </div>
      <div className="trip-game-ratings">
        <span>
          OVR <b>{player.overall}</b>
        </span>
        <span>
          ATK <b>{player.attack}</b>
        </span>
        <span>
          CTL <b>{player.control}</b>
        </span>
      </div>
      <div className="trip-game-condition">
        <span>
          BUZZ <b>{Math.round(playerState.buzz)}</b>
        </span>
        <span>
          MORALE <b>{Math.round(playerState.morale)}</b>
        </span>
      </div>
    </div>
  );
}

function PlayerPicker({ players, selectedKey, usage, maxUses, disabled, onPick }) {
  return (
    <div className="trip-game-roster">
      <div className="trip-game-section-label">
        <span>CAPTAIN PICK</span>
        <span>MAX {maxUses} USES</span>
      </div>
      <div className="trip-game-roster-grid">
        {players.map((player) => {
          const used = usage[player.key] || 0;
          const spent = used >= maxUses;
          return (
            <button
              key={player.key}
              type="button"
              className={`trip-game-roster-player ${selectedKey === player.key ? "is-selected" : ""}`}
              disabled={disabled || spent}
              onClick={() => onPick(player)}
            >
              <span className="trip-game-roster-avatar">{initials(player.name)}</span>
              <span className="trip-game-roster-name">{lastName(player.name)}</span>
              <span className="trip-game-roster-hi">{player.hi.toFixed(1)}</span>
              <span className="trip-game-use-pips" aria-label={`${used} of ${maxUses} uses`}>
                {Array.from({ length: maxUses }, (_, index) => (
                  <i key={index} className={index < used ? "is-used" : ""} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceRow({ label, choices, value, onChange, disabled, detail }) {
  return (
    <div className="trip-game-choice-row">
      <div className="trip-game-section-label">
        <span>{label}</span>
        {detail && <span>{detail}</span>}
      </div>
      <div className="trip-game-choice-buttons">
        {choices.map((choice) => (
          <button
            type="button"
            key={choice.id}
            className={choice.id === value ? "is-selected" : ""}
            disabled={disabled}
            onClick={() => onChange(choice.id)}
          >
            {choice.short || choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ result, humanTeam, cpuTeam, onNext, finalHole }) {
  const humanWon = result.winner === "human";
  const cpuWon = result.winner === "cpu";
  return (
    <div className="trip-game-result">
      <div className={`trip-game-result-call trip-game-result-call--${result.winner}`}>
        {humanWon ? `${humanTeam.toUpperCase()} WINS THE HOLE` : cpuWon ? `${cpuTeam.toUpperCase()} WINS THE HOLE` : "HOLE HALVED"}
      </div>
      <div className="trip-game-result-matchup">
        <div className={humanWon ? "is-winner" : ""}>
          <span>{result.human.name}</span>
          <b>{result.humanGross}</b>
          <small>
            NET {result.humanNet} · {result.humanLanding.toUpperCase()}
          </small>
        </div>
        <span className="trip-game-result-vs">VS</span>
        <div className={cpuWon ? "is-winner" : ""}>
          <span>{result.cpu.name}</span>
          <b>{result.cpuGross}</b>
          <small>
            NET {result.cpuNet} · {result.cpuLanding.toUpperCase()}
          </small>
        </div>
      </div>
      <div className="trip-game-result-log">
        CPU CAPTAIN SENT {lastName(result.cpu.name).toUpperCase()} · {result.cpuBucket.label.toUpperCase()}
      </div>
      <button type="button" className="trip-game-primary-button" onClick={onNext}>
        {finalHole ? "FINAL RESULTS" : "NEXT HOLE ▶"}
      </button>
    </div>
  );
}

function FireballOffer({ player, onAccept, onDecline }) {
  return (
    <div className="trip-game-modal-backdrop" role="presentation">
      <div className="trip-game-modal" role="dialog" aria-modal="true" aria-labelledby="fireball-title">
        <div className="trip-game-modal-sprite" aria-hidden="true">
          <span>🔥</span>
        </div>
        <p className="trip-game-modal-kicker">WILD EVENT</p>
        <h3 id="fireball-title">SEAN OFFERS A FIREBALL</h3>
        <p>
          {lastName(player.name)}, one shot? A little buzz can help. Pass the tipping point and the model turns sharply against you.
        </p>
        <div className="trip-game-modal-options">
          <button type="button" onClick={onAccept}>
            <b>ACCEPT</b>
            <span>Buzz +22 · morale +5</span>
          </button>
          <button type="button" onClick={onDecline}>
            <b>DECLINE</b>
            <span>Your morale -5 · Sean heats up</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupScreen({ model, courseId, setCourseId, team, setTeam, archiveState, onStart }) {
  return (
    <div className="trip-game-setup">
      <div className="trip-game-title-screen">
        <div className="trip-game-title-flag">★</div>
        <p>CRYSTAL SPRINGS PRESENTS</p>
        <h2>CAPTAIN&apos;S CUP</h2>
        <span>PIXEL GOLF // DATA ENGINE</span>
      </div>
      <div className="trip-game-story">
        You are the captain. Secretly pick one golfer per hole, choose a shot plan, then let the trip model roll it against the
        other side.
      </div>
      <div className="trip-game-setup-block">
        <div className="trip-game-section-label">
          <span>1. SELECT COURSE</span>
          <span>{model.courses.length} READY</span>
        </div>
        <div className="trip-game-course-grid">
          {model.courses.map((course) => (
            <button
              type="button"
              key={course.id}
              className={course.id === courseId ? "is-selected" : ""}
              onClick={() => setCourseId(course.id)}
            >
              <b>{course.label}</b>
              <span>{course.coverage} PLAYER-HOLE SAMPLES</span>
              <small>
                PAR {course.par} · {course.geometry ? "REAL MAP" : "PROTOTYPE MAP"}
              </small>
            </button>
          ))}
        </div>
      </div>
      <div className="trip-game-setup-block">
        <div className="trip-game-section-label">
          <span>2. CAPTAIN A SIDE</span>
          <span>CPU TAKES THE OTHER</span>
        </div>
        <div className="trip-game-team-grid">
          {model.teams.map((name) => (
            <button
              type="button"
              key={name}
              className={`${name === team ? "is-selected" : ""} is-${name.toLowerCase()}`}
              onClick={() => setTeam(name)}
            >
              <b>{name.toUpperCase()}</b>
              <span>{model.players.filter((player) => player.team === name).length} GOLFERS</span>
            </button>
          ))}
        </div>
      </div>
      <div className="trip-game-model-status">
        <span className={`trip-game-status-light is-${archiveState}`} />
        {archiveState === "loading"
          ? "LOADING 2025 + 2026 PLAYER HISTORY..."
          : `${model.dataSummary.trips} TRIPS · ${model.dataSummary.historicalPlayers} PROFILES · ODDS READY`}
      </div>
      <button
        type="button"
        className="trip-game-primary-button trip-game-start-button"
        disabled={!courseId || !team || !model.courses.length}
        onClick={onStart}
      >
        START CAPTAIN ROUND ▶
      </button>
      <p className="trip-game-disclaimer">
        Turf and hazard shapes use OpenStreetMap geometry. Trees and mowing texture are illustrative; shot shape remains modeled
        until scouting profiles are entered.
      </p>
    </div>
  );
}

function FinishScreen({ match, history, team, cpuTeam, onRematch, onSetup }) {
  const winner = match.human > match.cpu ? team : match.cpu > match.human ? cpuTeam : null;
  return (
    <div className="trip-game-finish">
      <p className="trip-game-modal-kicker">ROUND COMPLETE</p>
      <h2>{winner ? `${winner.toUpperCase()} WINS` : "MATCH HALVED"}</h2>
      <div className="trip-game-final-score">
        <div>
          <span>{team.toUpperCase()}</span>
          <b>{match.human}</b>
        </div>
        <em>HOLES</em>
        <div>
          <span>{cpuTeam.toUpperCase()}</span>
          <b>{match.cpu}</b>
        </div>
      </div>
      <div className="trip-game-mini-card">
        {history.map((row) => (
          <div key={row.hole} className={`is-${row.winner}`}>
            <span>{String(row.hole).padStart(2, "0")}</span>
            <span>{lastName(row.human)}</span>
            <b>{row.humanGross}</b>
            <em>{row.winner === "tie" ? "AS" : row.winner === "human" ? "W" : "L"}</em>
            <b>{row.cpuGross}</b>
            <span>{lastName(row.cpu)}</span>
          </div>
        ))}
      </div>
      <div className="trip-game-finish-actions">
        <button type="button" className="trip-game-primary-button" onClick={onRematch}>
          REMATCH
        </button>
        <button type="button" className="trip-game-secondary-button" onClick={onSetup}>
          CHANGE SETUP
        </button>
      </div>
    </div>
  );
}

export default function TripGame({ data }) {
  const [archive, setArchive] = useState([]);
  const [archiveState, setArchiveState] = useState("loading");
  const [courseId, setCourseId] = useState(null);
  const [captainTeam, setCaptainTeam] = useState(null);
  const [screen, setScreen] = useState("setup");
  const [holeIndex, setHoleIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const [decision, setDecision] = useState({ club: "driver", aim: "center", shape: "straight", fireball: false });
  const [usage, setUsage] = useState({});
  const [cpuUsage, setCpuUsage] = useState({});
  const [playerState, setPlayerState] = useState({});
  const [match, setMatch] = useState({ human: 0, cpu: 0, ties: 0 });
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [geometryBySlug, setGeometryBySlug] = useState({});
  const [inventory, setInventory] = useState({ fireball: 1 });
  const [eventOffer, setEventOffer] = useState(null);
  const [eventHandled, setEventHandled] = useState({});
  const [pickLocked, setPickLocked] = useState(false);
  const [eventNote, setEventNote] = useState(null);
  const randomRef = useRef(makeSeededRandom(Date.now()));

  useEffect(() => {
    let live = true;
    Promise.allSettled(
      ARCHIVE_FILES.map((file) =>
        fetch(file).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        }),
      ),
    ).then((results) => {
      if (!live) return;
      const loaded = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      setArchive(loaded);
      setArchiveState(loaded.length === ARCHIVE_FILES.length ? "ready" : "partial");
    });
    return () => {
      live = false;
    };
  }, []);

  const historicalData = useMemo(
    () => archive.filter((dataset) => dataset.trip?.id !== data.trip?.id),
    [archive, data.trip?.id],
  );
  const model = useMemo(() => buildTripGameModel(data, historicalData), [data, historicalData]);

  useEffect(() => {
    if (!model.courses.length) return;
    if (!model.courses.some((course) => course.id === courseId)) setCourseId(model.courses[0].id);
    if (!model.teams.includes(captainTeam)) setCaptainTeam(model.teams[0] || null);
  }, [captainTeam, courseId, model.courses, model.teams]);

  const course = model.courses.find((entry) => entry.id === courseId) || model.courses[0] || null;
  useEffect(() => {
    if (!course?.geometry || Object.prototype.hasOwnProperty.call(geometryBySlug, course.slug)) return;
    let live = true;
    fetch(course.geometry)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geometry) => {
        if (live) setGeometryBySlug((current) => ({ ...current, [course.slug]: geometry }));
      })
      .catch(() => {
        if (live) setGeometryBySlug((current) => ({ ...current, [course.slug]: null }));
      });
    return () => {
      live = false;
    };
  }, [course, geometryBySlug]);

  const baseHole = course?.holes?.[holeIndex] || null;
  const geometry = course ? geometryBySlug[course.slug] : null;
  const projection = useMemo(() => (baseHole ? projectHole(geometry, baseHole) : null), [baseHole, geometry]);
  const hole = useMemo(() => {
    if (!baseHole || !projection) return baseHole;
    return {
      ...baseHole,
      par: Number(projection.official?.par) || baseHole.par,
      si: Number(projection.official?.hcp) || baseHole.si,
      yards: Number(projection.official?.yards) || null,
      dangerSide: projection.dangerSide,
      primaryHazard: projection.primaryHazard,
      hasWater: projection.hasWater,
    };
  }, [baseHole, projection]);

  const cpuTeam = captainTeam === "South" ? "North" : "South";
  const humanRoster = model.players.filter((player) => player.team === captainTeam);
  const cpuRoster = model.players.filter((player) => player.team === cpuTeam);
  const maxUses = Math.max(2, Math.ceil(18 / Math.max(1, humanRoster.length)));
  const cpuMaxUses = Math.max(2, Math.ceil(18 / Math.max(1, cpuRoster.length)));
  const selected = humanRoster.find((player) => player.key === selectedKey) || null;
  const selectedState = selected ? playerState[selected.key] || DEFAULT_PLAYER_STATE : DEFAULT_PLAYER_STATE;
  const odds = useMemo(
    () => (selected && course && hole ? buildHoleOdds({ profile: selected, course, hole, decision, state: selectedState }) : null),
    [course, decision, hole, selected, selectedState],
  );
  const scoreDifference = match.human - match.cpu;
  const matchLabel =
    scoreDifference === 0
      ? "ALL SQUARE"
      : `${Math.abs(scoreDifference)} UP · ${scoreDifference > 0 ? captainTeam?.toUpperCase() : cpuTeam.toUpperCase()}`;

  function initializePlayerState() {
    return Object.fromEntries(model.players.map((player) => [player.key, { buzz: 0, morale: 50 }]));
  }

  function startRound() {
    if (!course || !captainTeam) return;
    setScreen("play");
    setHoleIndex(0);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: "center", shape: "straight", fireball: false });
    setUsage({});
    setCpuUsage({});
    setPlayerState(initializePlayerState());
    setMatch({ human: 0, cpu: 0, ties: 0 });
    setHistory([]);
    setResult(null);
    setInventory({ fireball: 1 });
    setEventOffer(null);
    setEventHandled({});
    setPickLocked(false);
    setEventNote(null);
    randomRef.current = makeSeededRandom(Date.now());
  }

  function pickPlayer(player) {
    if (result || pickLocked) return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
    setEventNote(null);
  }

  function updateCondition(playerKey, update) {
    setPlayerState((current) => {
      const previous = current[playerKey] || { buzz: 0, morale: 50 };
      return {
        ...current,
        [playerKey]: {
          buzz: clamp(previous.buzz + (update.buzz || 0), 0, 100),
          morale: clamp(previous.morale + (update.morale || 0), 0, 100),
        },
      };
    });
  }

  function acceptFireball() {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, { buzz: 22, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote("FIREBALL ACCEPTED · EARLY BOOST / TIPPING RISK");
    setEventOffer(null);
  }

  function declineFireball() {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, { morale: -5 });
    const sean = humanRoster.find((player) => player.key === "sean wilson");
    if (sean) updateCondition(sean.key, { buzz: 12, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote("SHOT DECLINED · YOUR MORALE DIPS / SEAN HEATS UP");
    setEventOffer(null);
  }

  function playHole() {
    if (!selected || !odds || !hole || !course || result) return;
    const seanInGroup = humanRoster.some((player) => player.key === "sean wilson");
    if (
      seanInGroup &&
      selected.key !== "sean wilson" &&
      FIREBALL_HOLES.has(hole.number) &&
      !eventHandled[holeIndex]
    ) {
      setEventOffer({ playerKey: selected.key, player: selected });
      return;
    }
    const currentHumanOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision,
      state: playerState[selected.key],
    });
    const cpuPick = chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
    });
    if (!cpuPick) return;
    const resolved = resolveMatchHole({
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds: cpuPick.odds,
      course,
      hole,
      random: randomRef.current,
    });
    const completeResult = {
      ...resolved,
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds: cpuPick.odds,
    };
    setResult(completeResult);
    setUsage((current) => ({ ...current, [selected.key]: (current[selected.key] || 0) + 1 }));
    setCpuUsage((current) => ({ ...current, [cpuPick.profile.key]: (current[cpuPick.profile.key] || 0) + 1 }));
    setMatch((current) => ({
      human: current.human + (resolved.winner === "human" ? 1 : 0),
      cpu: current.cpu + (resolved.winner === "cpu" ? 1 : 0),
      ties: current.ties + (resolved.winner === "tie" ? 1 : 0),
    }));
    setHistory((current) => [
      ...current,
      {
        hole: hole.number,
        winner: resolved.winner,
        human: selected.name,
        cpu: cpuPick.profile.name,
        humanGross: resolved.humanGross,
        cpuGross: resolved.cpuGross,
      },
    ]);
    if (decision.fireball) setInventory((current) => ({ ...current, fireball: Math.max(0, current.fireball - 1) }));
  }

  function nextHole() {
    if (holeIndex >= 17) {
      setScreen("finish");
      return;
    }
    setHoleIndex((current) => current + 1);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: "center", shape: "straight", fireball: false });
    setResult(null);
    setEventOffer(null);
    setPickLocked(false);
    setEventNote(null);
  }

  if (!model.courses.length && archiveState === "loading") {
    return (
      <section className="trip-game">
        <div className="trip-game-shell trip-game-loading">
          <span className="trip-game-loading-ball" />
          LOADING PIXEL GOLF ENGINE...
        </div>
      </section>
    );
  }

  return (
    <section className="trip-game" aria-label="Captain's Cup pixel golf game">
      <div className="trip-game-shell">
        <header className="trip-game-console-head">
          <span>GG POCKET</span>
          <b>CAPTAIN&apos;S CUP</b>
          <span>DATA PLAY</span>
        </header>
        {screen === "setup" && (
          <SetupScreen
            model={model}
            courseId={courseId}
            setCourseId={setCourseId}
            team={captainTeam}
            setTeam={setCaptainTeam}
            archiveState={archiveState}
            onStart={startRound}
          />
        )}
        {screen === "finish" && (
          <FinishScreen
            match={match}
            history={history}
            team={captainTeam}
            cpuTeam={cpuTeam}
            onRematch={startRound}
            onSetup={() => setScreen("setup")}
          />
        )}
        {screen === "play" && course && hole && projection && (
          <>
            <div className="trip-game-scorebar">
              <div className={`trip-game-score-team is-${captainTeam.toLowerCase()}`}>
                <span>YOU · {captainTeam.toUpperCase()}</span>
                <b>{match.human}</b>
              </div>
              <div className="trip-game-hole-box">
                <small>HOLE</small>
                <b>{String(hole.number).padStart(2, "0")}</b>
                <span>
                  PAR {hole.par} · SI {hole.si}
                </span>
              </div>
              <div className={`trip-game-score-team is-${cpuTeam.toLowerCase()}`}>
                <span>CPU · {cpuTeam.toUpperCase()}</span>
                <b>{match.cpu}</b>
              </div>
            </div>
            <div className="trip-game-match-state">{matchLabel}</div>
            <div className="trip-game-play-grid">
              <HoleMap projection={projection} hole={hole} decision={decision} result={result} />
              <div className="trip-game-command-panel">
                <PlayerCard player={selected} playerState={selectedState} course={course} />
                {result ? (
                  <ResultPanel
                    result={result}
                    humanTeam={captainTeam}
                    cpuTeam={cpuTeam}
                    onNext={nextHole}
                    finalHole={holeIndex === 17}
                  />
                ) : (
                  <>
                    <ScoreOdds odds={odds} />
                    <div className="trip-game-decisions">
                      <ChoiceRow
                        label="CLUB"
                        choices={CLUBS.filter((club) => club.minPar <= hole.par)}
                        value={decision.club}
                        disabled={!selected}
                        onChange={(club) => setDecision((current) => ({ ...current, club }))}
                        detail={CLUBS.find((club) => club.id === decision.club)?.carry ? `~${CLUBS.find((club) => club.id === decision.club).carry}Y` : null}
                      />
                      <ChoiceRow
                        label="SHOT SHAPE"
                        choices={SHAPES}
                        value={decision.shape}
                        disabled={!selected}
                        onChange={(shape) => setDecision((current) => ({ ...current, shape }))}
                        detail={selected ? `STOCK ${selected.stockShape.toUpperCase()}` : null}
                      />
                      <ChoiceRow
                        label="AIM"
                        choices={AIMS}
                        value={decision.aim}
                        disabled={!selected}
                        onChange={(aim) => setDecision((current) => ({ ...current, aim }))}
                        detail={projection.hazardLabel}
                      />
                    </div>
                    <div className="trip-game-items">
                      <button
                        type="button"
                        className={decision.fireball ? "is-selected" : ""}
                        disabled={!selected || inventory.fireball < 1}
                        onClick={() => setDecision((current) => ({ ...current, fireball: !current.fireball }))}
                      >
                        <span>🔥</span>
                        <b>FIREBALL SHOT</b>
                        <small>x{inventory.fireball} · MORE UPSIDE / MORE RISK</small>
                      </button>
                    </div>
                    {eventNote && <div className="trip-game-event-note">{eventNote}</div>}
                    <button type="button" className="trip-game-primary-button" disabled={!selected} onClick={playHole}>
                      {selected ? `PLAY ${lastName(selected.name).toUpperCase()} ▶` : "PICK A GOLFER"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <PlayerPicker
              players={humanRoster}
              selectedKey={selectedKey}
              usage={usage}
              maxUses={maxUses}
              disabled={Boolean(result) || pickLocked}
              onPick={pickPlayer}
            />
            <div className="trip-game-bottom-status">
              <span>CPU PICK: {result ? lastName(result.cpu.name).toUpperCase() : "HIDDEN"}</span>
              <span>
                HOLES LEFT {18 - hole.number} · TIES {match.ties}
              </span>
            </div>
          </>
        )}
      </div>
      {eventOffer && (
        <FireballOffer player={eventOffer.player} onAccept={acceptFireball} onDecline={declineFireball} />
      )}
    </section>
  );
}
