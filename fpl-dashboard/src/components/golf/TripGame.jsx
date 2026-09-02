import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CLUBS,
  SCORE_BUCKETS,
  SHAPES,
  aimOffsetOf,
  buildHoleOdds,
  buildTripGameModel,
  chooseCpuPlayer,
  courseHandicap,
  defaultDecision,
  findBestDecision,
  formatOdds,
  holePops,
  makeSeededRandom,
  matchCloseout,
  resolveMatchHole,
  skillOf,
} from "./tripGameEngine.js";
import {
  clinkSound,
  contactSound,
  crowdSwell,
  holeWinSound,
  holeoutSound,
  lockPowerSound,
  nearMissSound,
  riskArmedSound,
  setMeterAudioEnabled,
  splashSound,
  startHeartbeat,
  startPowerSweep,
  stopAll,
  stopHeartbeat,
  stopPowerSweep,
  swingJudgmentSound,
  unlockMeterAudio,
  updatePowerSweep,
  yardRollTick,
  yardRollFinal,
  zoneTick,
} from "./meterAudio";
import {
  AIM_MAX,
  AIM_STEP,
  CART_GIRL_HOLES,
  DEFAULT_PLAYER_STATE,
  FIREBALL_HOLES,
  MATCH_SAVE_KEY,
  PLAYBACK_SAFETY_MS,
} from "./tripgame/constants.js";
import {
  clamp,
  curvedPath,
  pathFromPoints,
  quadPoint,
  seededUnit,
  sidePoint,
} from "./tripgame/geometry.js";
import { buildTreeSprites, projectHole } from "./tripgame/projection.js";
import {
  blendCamera,
  cameraContains,
  computeMapCamera,
  pointNearGreen,
} from "./tripgame/camera.js";
import {
  LIVE_CARRY_SWEET,
  LIVE_CLUBS,
  defaultLiveClub,
  liveClubOf,
} from "./tripgame/clubs.js";
import {
  computeShotTarget,
  placeTeeLanding,
  resolveLiveStroke,
  shapeBend,
  shapeDrift,
  shotPatternFor,
} from "./tripgame/shotPhysics.js";
import {
  FLIGHT_FRAME_MS,
  buildShotSequence,
  framesToPath,
  makeShot,
  mergeMatchPlayShots,
} from "./tripgame/shotTheater.js";
import {
  PUTT_TICK_UNITS,
  forLabelOf,
  makePuttRead,
  resolveLivePutt,
} from "./tripgame/putting.js";
import {
  ACC_GOOD,
  ACC_GREAT,
  ACC_PURE,
  BASE_ACC_SPEED,
  BASE_POWER_SPEED,
  CLUB_METER_SPEED,
  CLUB_ZONE_SCALE,
  CLUTCH_SPEED,
  LIE_METER_MODS,
  POWER_METER_MAX,
  POWER_SWEET_MAX,
  POWER_SWEET_MIN,
  RED_BET_SPEED,
  RED_BET_ZONE_SCALE,
  SKILL_SPEED_PENALTY,
  SKILL_ZONE_MIN,
  SKILL_ZONE_RANGE,
  buzzTierOf,
  jittersFor,
  judgeSwing,
  meterStore,
  yardTierOf,
  zoneStyle,
} from "./tripgame/meter.js";
import { haptic } from "./tripgame/haptics.js";
import {
  aimText,
  celebrationFor,
  lastName,
  scoreMark,
  signedPercent,
} from "./tripgame/format.js";
import "./TripGame.css";

const ARCHIVE_FILES = ["/data/golftrip-nj26.json", "/data/golftrip-2025.json"];

// ---- Putting model: read the green, aim against the break, control pace ----

function ScoreOdds({ odds, label = "MODEL" }) {
  if (!odds) return null;
  return (
    <div className="trip-game-odds">
      <div className="trip-game-section-label">
        <span>{label}</span>
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
    </div>
  );
}

function CaptainRead({ read }) {
  if (!read) return null;
  const bestClub = CLUBS.find((club) => club.id === read.bestDecision.club);
  const bestShape = SHAPES.find((shape) => shape.id === read.bestDecision.shape);
  return (
    <div
      key={read.planKey}
      className={`trip-game-captain-read is-${read.tone}`}
      aria-label={`${read.label}. Player fit rank ${read.playerRank} of ${read.rosterSize}.`}
    >
      <div className="trip-game-read-call">
        <small>CAPTAIN READ</small>
        <b>{read.label}</b>
        <span>
          PICK #{read.playerRank}/{read.rosterSize}
        </span>
      </div>
      <div className="trip-game-read-metrics">
        <span>
          <b>{signedPercent(read.scoringDelta)}</b>
          SCORING
        </span>
        <span>
          <b>{signedPercent(read.bigNumberDelta)}</b>
          BIG NO.
        </span>
        <span>
          <b>{read.quality}%</b>
          PLAN FIT
        </span>
      </div>
      <div className="trip-game-caddie-tip">
        {read.quality >= 94 && !read.fireball
          ? "★ BEST LINE"
          : read.fireball
            ? "🔥 UP SIDE / RISK"
            : `${bestClub?.short || bestClub?.label} · ${bestShape?.label.toUpperCase()} · ${aimText(read.bestDecision.aim)}`}
      </div>
    </div>
  );
}

/**
 * Arcade golf ball: dimpled, spinning, with a shine dot and (for earned
 * tiers) a twinkling glint. Nested groups keep deformation (squash/stretch)
 * separate from the spin layer, per the classic squash-and-stretch rig.
 */
// Optional photo skins for the ball: drop square-cropped renders into
// public/ball-pure.png and public/ball-white.png. Probed once — the photo
// layer only renders when the file really exists, because a broken SVG
// <image> paints a broken-image glyph, not nothing.
const BALL_IMAGES = { pure: false, white: false, checked: false };
const ballImageListeners = new Set();

function checkBallImages() {
  if (BALL_IMAGES.checked || typeof window === "undefined") return;
  BALL_IMAGES.checked = true;
  [
    ["pure", "/ball-pure.png"],
    ["white", "/ball-white.png"],
  ].forEach(([key, src]) => {
    const probe = new window.Image();
    probe.onload = () => {
      BALL_IMAGES[key] = true;
      ballImageListeners.forEach((listener) => listener());
    };
    probe.src = src;
  });
}

function BallSprite({ r = 2.6, spin = "none", tier = null, launch = false, angle = 0 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [, bumpImages] = useState(0);
  useEffect(() => {
    checkBallImages();
    const listener = () => bumpImages((n) => n + 1);
    ballImageListeners.add(listener);
    return () => ballImageListeners.delete(listener);
  }, []);
  const dimple = Math.max(0.28, r * 0.15);
  const pure = tier === "pure" || tier === "fire";
  const photoReady = pure ? BALL_IMAGES.pure : BALL_IMAGES.white;
  return (
    <g
      className={`trip-game-ball-deform${launch ? " is-launching" : ""}`}
      transform={angle ? `rotate(${angle})` : undefined}
    >
      <defs>
        <radialGradient id={`ballg${uid}`} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="52%" stopColor="#f6f8ee" />
          <stop offset="84%" stopColor="#d3dac9" />
          <stop offset="100%" stopColor="#a9b3a0" />
        </radialGradient>
        <clipPath id={`ballc${uid}`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={`url(#ballg${uid})`} className="trip-game-ball-base" />
      <g clipPath={`url(#ballc${uid})`}>
        <g className={`trip-game-ball-spin${spin === "fast" ? " is-fast" : spin === "roll" ? " is-roll" : ""}`}>
          <circle cx={-r * 0.38} cy={-r * 0.12} r={dimple} />
          <circle cx={r * 0.12} cy={-r * 0.42} r={dimple * 0.9} />
          <circle cx={r * 0.36} cy={r * 0.22} r={dimple} />
          <circle cx={-r * 0.12} cy={r * 0.44} r={dimple * 0.9} />
          <circle cx={r * 0.42} cy={-r * 0.28} r={dimple * 0.75} />
          <circle cx={-r * 0.44} cy={r * 0.3} r={dimple * 0.75} />
          <circle cx={0} cy={r * 0.05} r={dimple * 0.85} />
          {pure && (
            <g className="trip-game-ball-swoosh">
              <path
                d={`M ${-r},${-r * 0.1} A ${r * 1.02} ${r * 1.02} 0 0 1 ${r * 0.96},${-r * 0.44}`}
                className="is-edge"
                strokeWidth={r * 0.46}
              />
              <path
                d={`M ${-r},${-r * 0.1} A ${r * 1.02} ${r * 1.02} 0 0 1 ${r * 0.96},${-r * 0.44}`}
                className="is-blue"
                strokeWidth={r * 0.32}
              />
              <path
                d={`M ${-r * 0.92},${r * 0.52} A ${r * 1.08} ${r * 1.08} 0 0 0 ${r},${r * 0.12}`}
                className="is-edge"
                strokeWidth={r * 0.42}
              />
              <path
                d={`M ${-r * 0.92},${r * 0.52} A ${r * 1.08} ${r * 1.08} 0 0 0 ${r},${r * 0.12}`}
                className="is-green"
                strokeWidth={r * 0.3}
              />
            </g>
          )}
          {photoReady && (
            <image
              href={pure ? "/ball-pure.png" : "/ball-white.png"}
              x={-r * 1.12}
              y={-r * 1.12}
              width={r * 2.24}
              height={r * 2.24}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
        </g>
      </g>
      <circle className="trip-game-ball-shine" cx={-r * 0.32} cy={-r * 0.34} r={Math.max(0.5, r * 0.26)} />
      <circle r={r} className="trip-game-ball-rim" />
      {pure && (
        <path
          className={`trip-game-ball-glint${tier === "fire" ? " is-fire" : ""}`}
          d={`M0,${-r - 1.6} L0.6,${-r + 0.2} L${r + 1.6},${-r + 0.8} L0.6,${-r + 1.4} Z`}
          transform={`translate(${r * 0.4} ${-r * 0.2}) scale(0.9)`}
        />
      )}
    </g>
  );
}

function GolferSprite({ at, toward, hat = "red", pose = "idle", putting = false, scale = 1.25 }) {
  const flipped = toward ? toward[0] < at[0] : false;
  const poseClass =
    pose === "swing"
      ? " trip-game-swinger is-swinging"
      : pose === "through"
        ? " trip-game-swinger is-through"
        : pose === "celebrate"
          ? " trip-game-swinger is-through is-celebrating"
          : pose === "slump"
            ? " trip-game-swinger is-through is-slumping"
            : "";
  return (
    <g
      className={`trip-game-golfer is-${hat}${poseClass}${putting && pose !== "idle" ? " is-putting" : ""}`}
      transform={`translate(${at[0]} ${at[1]}) scale(${flipped ? -scale : scale} ${scale})`}
    >
      <ellipse className="trip-game-swinger-shadow" cx="0" cy="1.4" rx="5.4" ry="1.7" />
      <g transform="translate(-4.8 -15)">
        <g className="trip-game-golfer-body">
          <rect className="trip-game-golfer-legs" x="1" y="10" width="3" height="5.5" />
          <rect className="trip-game-golfer-legs" x="5.8" y="10" width="3" height="5.5" />
          <rect className="trip-game-golfer-shirt" x="0.4" y="4.6" width="9" height="5.8" />
          <rect className="trip-game-golfer-skin" x="2.4" y="0.2" width="5" height="4.6" />
          <rect
            className={`trip-game-golfer-cap${hat === "blue" ? " is-blue" : ""}`}
            x="1.8"
            y="-1.8"
            width="6.2"
            height="2.4"
          />
          {hat === "blue" && <rect className="trip-game-golfer-cap is-blue" x="7.2" y="-0.2" width="2.2" height="1.1" />}
          <g className="trip-game-swing-arm">
            <rect className="trip-game-golfer-club" x="8.2" y="4.8" width="1.4" height="10.5" />
            <rect className="trip-game-club-head" x="7.4" y="14.4" width="3.2" height="2" />
          </g>
        </g>
      </g>
    </g>
  );
}

function PuttingScene({ shot, phase, frame, side, preview = false, read = null, aimTicks = 0 }) {
  const info = preview ? read : shot?.putt || { breakDir: 0, slope: 0 };
  const breakDir = clamp(info?.breakDir || 0, -1, 1);
  const slope = clamp(info?.slope || 0, -1, 1);
  const cup = [85, 36];
  const start = info?.start || [85, 96];
  const end = preview ? cup : info?.end || (shot?.final ? cup : [cup[0] - breakDir * 2.5, cup[1] + 7]);
  const feet = clamp(info?.feet || Math.round((shot?.yards || 1) * 3), 1, 48);
  const effFeet = info?.effFeet || feet;
  const stimp = info?.stimp || null;
  const startDist = Math.hypot(start[0] - cup[0], start[1] - cup[1]);
  const control = [
    (start[0] + end[0]) / 2 + breakDir * clamp(startDist * 0.45, 2, 24),
    (start[1] + end[1]) / 2 + 2,
  ];
  const lastFrame = Math.max(1, (shot?.frames?.length || 8) - 1);
  const t = preview || phase === "swing" ? 0 : phase === "flight" ? clamp((frame || 0) / lastFrame, 0, 1) : 1;
  const eased = 1 - Math.pow(1 - t, 1.75);
  const ball = quadPoint(start, control, end, eased);
  const dropped = !preview && shot?.final && phase === "settle";
  const rolled = !preview && phase !== "swing";
  const breakLabel = breakDir > 0.12 ? "L → R" : breakDir < -0.12 ? "R → L" : "STRAIGHT";
  const slopeLabel = slope > 0.12 ? "UPHILL" : slope < -0.12 ? "DOWNHILL" : "FLAT";
  const severity = Math.abs(breakDir) + Math.abs(slope) * 0.5;
  const severityClass = severity > 1 ? " is-steep" : severity > 0.5 ? " is-mid" : "";
  // The player's chosen start line: a straight ray from the ball through the
  // aim point — the game never bends it for you.
  const aimPoint = [cup[0] + aimTicks * PUTT_TICK_UNITS, cup[1]];
  const aimShown = preview || (info?.aimTicks != null && !dropped);
  const aimTarget = preview ? aimPoint : [cup[0] + (info?.aimTicks || 0) * PUTT_TICK_UNITS, cup[1]];
  const flowing = Math.hypot(breakDir, slope) > 0.12;
  const angle = (Math.atan2(slope, breakDir || 0.0001) * 180) / Math.PI;
  const arrows = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      arrows.push([36 + col * 33 + (row % 2) * 14, 40 + row * 25]);
    }
  }
  return (
    <div className="trip-game-putt-scene" aria-hidden="true">
      <svg viewBox="0 0 170 128" className="trip-game-putt-svg" role="img" aria-label="Putting green close-up">
        <defs>
          <clipPath id="trip-putt-green">
            <ellipse cx="85" cy="64" rx="78" ry="52" />
          </clipPath>
        </defs>
        <ellipse cx="85" cy="66" rx="82" ry="55" className="trip-game-putt-fringe" />
        <ellipse cx="85" cy="64" rx="78" ry="52" className="trip-game-putt-green" />
        <g clipPath="url(#trip-putt-green)" className="trip-game-putt-stripes">
          {Array.from({ length: 5 }, (_, index) => (
            <rect key={index} x="0" y={12 + index * 22} width="170" height="11" />
          ))}
        </g>
        <path d="M18,84 Q85,72 152,86" className="trip-game-putt-contour" />
        <path d="M28,48 Q85,58 142,46" className="trip-game-putt-contour" />
        {flowing && (
          <g
            className={`trip-game-putt-arrows${severityClass}`}
            style={{ "--flow-x": `${breakDir * 7}px`, "--flow-y": `${slope * 7}px` }}
          >
            {arrows.map(([x, y], index) => (
              <path
                key={index}
                d="M-3.4,-3 L3.4,0 L-3.4,3 Z"
                transform={`translate(${x} ${y}) rotate(${angle.toFixed(1)})`}
                style={{ animationDelay: `${(index % 4) * 0.22}s` }}
              />
            ))}
          </g>
        )}
        {aimShown && (
          <>
            <path
              d={`M${start[0].toFixed(1)},${start[1].toFixed(1)} L${aimTarget[0].toFixed(1)},${aimTarget[1].toFixed(1)}`}
              className="trip-game-putt-aim-line"
            />
            <g className="trip-game-putt-aim-marker" transform={`translate(${aimTarget[0].toFixed(1)} ${aimTarget[1].toFixed(1)})`}>
              <path d="M0,-3.4 L3,0 L0,3.4 L-3,0 Z" />
            </g>
          </>
        )}
        {!preview && (
          <path
            d={`M${start[0].toFixed(1)},${start[1].toFixed(1)} Q${control[0].toFixed(1)},${control[1].toFixed(1)} ${end[0].toFixed(1)},${end[1].toFixed(1)}`}
            className={`trip-game-putt-line${phase === "swing" ? " is-preview" : ""}`}
          />
        )}
        <g transform={`translate(${cup[0]} ${cup[1]})`} className="trip-game-putt-cup">
          <ellipse rx="4.6" ry="2.7" className="trip-game-putt-cup-rim" />
          <ellipse rx="3.4" ry="1.9" className="trip-game-putt-cup-hole" />
          <rect x="-0.7" y="-24" width="1.4" height="22" className="trip-game-putt-pin" />
          <path d="M0.7,-24 L9,-20.5 L0.7,-17 Z" className="trip-game-putt-pin-flag" />
        </g>
        <GolferSprite
          at={[start[0] + 7, start[1] + 1]}
          toward={cup}
          hat={side === "cpu" ? "blue" : "red"}
          pose={preview ? "idle" : phase === "swing" ? "swing" : dropped ? "celebrate" : "through"}
          putting
          scale={0.9}
        />
        {!dropped && (
          <g transform={`translate(${ball[0].toFixed(1)} ${ball[1].toFixed(1)})`}>
            <ellipse cx="0" cy="1.4" rx="2.4" ry="1" className="trip-game-putt-ball-shadow" />
            <BallSprite r={2.2} spin={rolled ? "roll" : "none"} />
          </g>
        )}
        {dropped && (
          <g transform={`translate(${cup[0]} ${cup[1]})`} className="trip-game-putt-drop">
            <circle r="5" className="trip-game-putt-drop-ring" />
            <path
              d="M0,-8 L2.3,-2.4 L8,-2.4 L3.4,1.2 L5.4,7 L0,3.4 L-5.4,7 L-3.4,1.2 L-8,-2.4 L-2.3,-2.4 Z"
              className="trip-game-putt-drop-star"
            />
          </g>
        )}
      </svg>
      <div className={`trip-game-putt-hud${side === "cpu" ? " is-cpu" : ""}`}>
        <span>{side === "cpu" ? "THEM" : "YOU"}</span>
        <b>{feet} FT</b>
        <em>
          {effFeet !== feet ? `PLAYS ${effFeet} · ` : ""}
          {breakLabel} · {slopeLabel}
        </em>
        {stimp && <i className={`trip-game-putt-stimp is-${stimp.toLowerCase()}`}>{stimp} GREEN</i>}
      </div>
      {!preview && !dropped && side === "cpu" && info?.for && (
        <div className={`trip-game-putt-for is-${info.for.tone}`}>
          <span>{info.for.text}</span>
        </div>
      )}
      {shot?.lip && phase === "settle" && <div className="trip-game-putt-in is-lip">LIP OUT!</div>}
      {dropped && <div className="trip-game-putt-in">IN!</div>}
    </div>
  );
}

function HoleMap({
  projection,
  hole,
  decision,
  result,
  playback,
  intro,
  onIntroDismiss,
  odds,
  canAct,
  intelLeft,
  intelRight,
  kickMeter,
  popCall,
  swingFx,
  shake,
  soundControl,
  kickTier,
  clutch,
  party = 0,
  partySurge = false,
  liveStatus,
  livePos,
  livePreview,
  clubReel,
  puttPreview,
  playerHi = 12,
  onAimStep,
  onCycle,
}) {
  const aimOffset = aimOffsetOf(decision.aim);
  const aimHoldRef = useRef(null);
  const cameraRef = useRef(null);
  const wrapRef = useRef(null);
  const [viewAspect, setViewAspect] = useState(null);

  // Measure the on-screen frame so cameras can fill it edge-to-edge.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box && box.height > 0) setViewAspect(box.width / box.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function stopAimHold() {
    if (!aimHoldRef.current) return;
    window.clearTimeout(aimHoldRef.current.delay);
    if (aimHoldRef.current.repeat) window.clearInterval(aimHoldRef.current.repeat);
    aimHoldRef.current = null;
  }

  function startAimHold(direction) {
    stopAimHold();
    onAimStep(direction);
    const delay = window.setTimeout(() => {
      if (aimHoldRef.current) aimHoldRef.current.repeat = window.setInterval(() => onAimStep(direction), 85);
    }, 300);
    aimHoldRef.current = { delay, repeat: null };
    window.addEventListener("pointerup", stopAimHold, { once: true });
  }

  useEffect(() => () => stopAimHold(), []);
  useEffect(() => {
    cameraRef.current = null;
  }, [hole.number]);

  const shotDecision = result?.shotDecision || decision;
  const shape = SHAPES.find((item) => item.id === shotDecision.shape) || SHAPES[1];
  const { club, lineLength, targetYards, perpendicular, target } = computeShotTarget(projection, hole, shotDecision);
  const drift = shapeDrift(projection, shape);
  const previewTarget = [target[0] + perpendicular[0] * drift, target[1] + perpendicular[1] * drift];
  const bend = shapeBend(projection, shape);
  const shotPath = curvedPath(projection.tee, previewTarget, bend);
  // A hole played shot by shot knows exactly where the tee ball finished.
  const landing = result
    ? result.teeLanding?.point || placeTeeLanding(projection, hole, shotDecision, result.humanLanding).point
    : null;
  // Shot-by-shot mode: between swings the ball sits at its real lie, not the
  // tee — suppress the tee-planning overlays and focus the camera there.
  const planning = !playback && !result && !livePos;
  const activeShot = playback ? playback.shots[Math.min(playback.index, playback.shots.length - 1)] : null;
  const shotFlipped = activeShot ? activeShot.to[0] < activeShot.from[0] : false;
  const flightFrames = activeShot?.frames || [];
  const flightFrameIndex = playback ? clamp(playback.frame || 0, 0, Math.max(0, flightFrames.length - 1)) : 0;
  const flightFrame = flightFrames[flightFrameIndex] || null;
  const flownFrames = playback?.phase === "flight" ? flightFrames.slice(0, flightFrameIndex + 1) : [];
  // Comet trail on the metered tee shot: gold for PURE, green for GREAT,
  // flames for a red-band bet that paid off. Human shots only — the CPU
  // never swings your meter.
  const firstHumanIndex = playback ? playback.shots.findIndex((shot) => shot.side !== "cpu") : -1;
  const firstCpuIndex = playback ? playback.shots.findIndex((shot) => shot.side === "cpu") : -1;
  const trailTier =
    playback?.index === firstHumanIndex && (kickTier === "pure" || kickTier === "great" || kickTier === "fire")
      ? kickTier
      : null;
  const firstOfSide = playback ? playback.index === firstHumanIndex || playback.index === firstCpuIndex : false;
  const sideShotNumber =
    playback && activeShot
      ? playback.shots.slice(0, playback.index + 1).filter((shot) => shot.side === activeShot.side).length
      : 0;
  // Where the waiting player's ball rests while the other side plays.
  const otherSidePlayed =
    playback && activeShot && playback.shots.slice(0, playback.index).some((shot) => shot.side !== activeShot.side);
  const nextOtherShot =
    playback && activeShot
      ? playback.shots.slice(playback.index + 1).find((shot) => shot.side !== activeShot.side)
      : null;
  const restingBall = otherSidePlayed && nextOtherShot ? nextOtherShot.from : null;
  const remainingYards = hole.yards ? Math.max(0, Math.round(hole.yards - targetYards)) : null;
  const trees = projection.trees || buildTreeSprites(projection, hole.number);
  const mapId = `trip-hole-${hole.number}`;
  const ballPoint = flightFrame ? [flightFrame.gx, flightFrame.gy] : activeShot ? (playback.phase === "settle" ? activeShot.to : activeShot.from) : null;
  const onGreenCam = Boolean(
    activeShot &&
      (activeShot.kind === "putt" ||
        activeShot.final ||
        (ballPoint &&
          pointNearGreen(ballPoint, projection) &&
          activeShot.kind !== "drive" &&
          activeShot.kind !== "tee" &&
          activeShot.kind !== "splash")),
  );
  const targetCam = computeMapCamera({
    projection,
    playback,
    landing,
    activeShot,
    flightFrame,
    liveFocus: livePos || null,
    aspect: viewAspect,
  });
  const firstFlightFrame = playback?.phase === "flight" && (playback.frame || 0) === 0;
  const ballAir = flightFrame ? [flightFrame.x, flightFrame.y] : null;
  const ballEscaping = Boolean(
    playback?.phase === "flight" && ballAir && cameraRef.current && !cameraContains(cameraRef.current, ballAir, 18),
  );
  // Static views (planning, club select) have no continuous re-renders to
  // carry a slow lerp — snap straight to their framing.
  const cameraEase = !playback
    ? 1
    : firstFlightFrame || ballEscaping
      ? 1
      : playback.phase === "flight"
        ? 0.84
        : playback.phase === "swing" && playback.index === 0
          ? 1
          : 0.5;
  cameraRef.current = blendCamera(cameraRef.current, targetCam, cameraRef.current ? cameraEase : 1);
  const camera = cameraRef.current;
  const fullFramed = camera.w > projection.width * 0.9 && camera.h > projection.height * 0.9;

  return (
    <div
      ref={wrapRef}
      className={`trip-game-map-wrap ${playback ? "is-resolving is-flyover" : ""} ${onGreenCam ? "is-green-zoom" : ""}${shake ? " is-shaking" : ""}${clutch ? " is-clutch" : ""}${party > 0 ? ` is-party-${party}` : ""}${partySurge ? " is-party-surge" : ""}`}
      style={shake ? { "--shake-amp": `${shake.amp}px` } : undefined}
    >
      <div className="trip-game-map-hud">
        <span className={`trip-game-par-pill is-par-${hole.par}`}>PAR {hole.par}</span>
        <span>{projection.hazardLabel}</span>
        <span>
          {onGreenCam
            ? "ON THE GREEN"
            : playback
              ? "FLYOVER"
              : `${club.short} ${targetYards}Y · ${remainingYards != null ? `${remainingYards}Y LEFT` : "TEE PLAN"}`}
        </span>
        {soundControl}
      </div>
      {liveStatus && <div className="trip-game-live-status">{liveStatus}</div>}
      {popCall}
      {playback && activeShot && (
        <div className={`trip-game-playcap${activeShot.side === "cpu" ? " is-cpu" : ""}`} aria-live="polite">
          <small>
            {activeShot.side === "cpu" ? "THEM" : "YOU"} · SHOT {activeShot.shotNumber ?? sideShotNumber}
            {activeShot.yards ? ` · ${activeShot.yards}Y` : ""}
          </small>
          <b>{activeShot.caption}</b>
        </div>
      )}
      {odds && (
        <div className="trip-game-map-landing" aria-label="Landing odds for this exact aim">
          <span>
            FRWY <b>{formatOdds(odds.landing.fairway)}</b>
          </span>
          <span>
            RGH <b>{formatOdds(odds.landing.rough)}</b>
          </span>
          <span>
            BNKR <b>{formatOdds(odds.landing.bunker)}</b>
          </span>
          <span className={odds.landing.penalty >= 0.12 ? "is-danger" : ""}>
            PNLTY <b>{formatOdds(odds.landing.penalty)}</b>
          </span>
        </div>
      )}
      <svg
        className="trip-game-map"
        viewBox={`${camera.x.toFixed(2)} ${camera.y.toFixed(2)} ${camera.w.toFixed(2)} ${camera.h.toFixed(2)}`}
        preserveAspectRatio={fullFramed ? "xMidYMid meet" : "xMidYMid slice"}
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
        <g className="trip-game-tree-layer" aria-hidden="true">
          {trees.map((tree, index) => (
            <g
              key={`${tree.x.toFixed(1)}-${tree.y.toFixed(1)}-${index}`}
              className={`trip-game-tree trip-game-tree--${tree.variant}`}
              transform={`translate(${tree.x.toFixed(1)} ${tree.y.toFixed(1)}) scale(${(tree.size / 6).toFixed(2)})`}
            >
              {tree.variant === 1 ? (
                <>
                  <ellipse className="trip-game-tree-shadow" cx="1.5" cy="5" rx="5" ry="1.8" />
                  <rect className="trip-game-tree-trunk" x="-1" y="1" width="2" height="4.5" />
                  <circle className="trip-game-tree-back" cx="0" cy="-2.5" r="5.2" />
                  <circle className="trip-game-tree-front" cx="-1.4" cy="-3.6" r="3.4" />
                </>
              ) : (
                <>
                  <ellipse className="trip-game-tree-shadow" cx="1.5" cy="5.5" rx="4.6" ry="1.7" />
                  <rect className="trip-game-tree-trunk" x="-0.9" y="2" width="1.8" height="3.8" />
                  <path className="trip-game-tree-back" d="M0,-11 L-5,-4.5 L-2.6,-4.5 L-6,1.5 L6,1.5 L2.6,-4.5 L5,-4.5 Z" />
                  <path className="trip-game-tree-front" d="M0,-9 L-3.4,-3.5 L-1.8,-3.5 L-4.2,1.5 L0,1.5 Z" />
                </>
              )}
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
        {planning && (
          <>
            <path d={shotPath} className="trip-game-shot-line" />
            <DispersionOval
              origin={projection.tee}
              center={previewTarget}
              pattern={shotPatternFor(playerHi, targetYards)}
              scale={hole.yards && lineLength ? lineLength / hole.yards : 1}
            />
            <g className="trip-game-target" transform={`translate(${previewTarget[0]} ${previewTarget[1]})`}>
              <circle r="5.5" />
              <path d="M-8 0 H8 M0 -8 V8" />
            </g>
            <text
              x={clamp(previewTarget[0] + 7, 8, projection.width - 44)}
              y={clamp(previewTarget[1] - 7, 10, projection.height - 8)}
              className="trip-game-carry-label"
            >
              {targetYards}Y
            </text>
          </>
        )}
        {!playback && !livePos && (
          <>
            <GolferSprite at={sidePoint(projection.tee, projection.pin, -8)} toward={projection.pin} hat="red" scale={1.15} />
            <GolferSprite at={sidePoint(projection.tee, projection.pin, 8)} toward={projection.pin} hat="blue" scale={1.15} />
          </>
        )}
        {!playback && (hole.number === 1 || hole.number === 18) && (
          <g className="trip-game-gallery" aria-hidden="true">
            {[-1, 0, 1].map((slot) => {
              const anchor =
                hole.number === 1
                  ? sidePoint(projection.tee, projection.pin, -18)
                  : sidePoint(projection.pin, projection.tee, 16);
              const spread = hole.number === 1 ? 7 : 9;
              return (
                <GolferSprite
                  key={slot}
                  at={[anchor[0] + slot * spread, anchor[1] + Math.abs(slot) * 2.5]}
                  toward={hole.number === 1 ? projection.tee : projection.pin}
                  hat={slot === 0 ? "blue" : "red"}
                  scale={0.85}
                />
              );
            })}
          </g>
        )}
        {!playback && livePos && (
          <>
            <path
              d={curvedPath(livePos, projection.pin, 0)}
              className="trip-game-aim-ahead"
            />
            {livePreview &&
              (() => {
                const scale = hole.yards && lineLength ? lineLength / hole.yards : 1;
                const carryUnits = livePreview.carryYards * scale;
                const dx = projection.pin[0] - livePos[0];
                const dy = projection.pin[1] - livePos[1];
                const norm = Math.hypot(dx, dy) || 1;
                const point = [livePos[0] + (dx / norm) * carryUnits, livePos[1] + (dy / norm) * carryUnits];
                return (
                  <>
                    <DispersionOval origin={livePos} center={point} pattern={livePreview.pattern} scale={scale} />
                    <g className="trip-game-target" transform={`translate(${point[0]} ${point[1]})`}>
                      <circle r="5.5" />
                      <path d="M-8 0 H8 M0 -8 V8" />
                    </g>
                    <text
                      x={clamp(point[0] + 7, 8, projection.width - 44)}
                      y={clamp(point[1] - 7, 10, projection.height - 8)}
                      className="trip-game-carry-label"
                    >
                      {livePreview.short} {livePreview.carryYards}Y
                    </text>
                  </>
                );
              })()}
            <GolferSprite at={sidePoint(livePos, projection.pin, 7)} toward={projection.pin} hat="red" scale={1.25} />
            <g transform={`translate(${livePos[0]} ${livePos[1]})`}>
              <ellipse className="trip-game-theater-shadow" cx="0" cy="1.2" rx="3" ry="1.4" />
              <BallSprite r={2.4} />
            </g>
          </>
        )}
        <g className="trip-game-flag" transform={`translate(${projection.pin[0]} ${projection.pin[1]})`}>
          <rect className="trip-game-flag-base" x="-3" y="0" width="6" height="2" />
          <rect className="trip-game-flag-pole" x="-1" y="-14" width="2" height="15" />
          <path className="trip-game-flag-cloth" d="M1,-14 L11,-10 L1,-6 Z" />
        </g>
        {playback && activeShot && (
          <g className="trip-game-theater">
            {playback.shots
              .slice(0, playback.index)
              .filter((shot) => shot.side === activeShot.side)
              .map((shot, index) => (
                <circle key={index} cx={shot.to[0]} cy={shot.to[1]} r="1.5" className="trip-game-crumb" />
              ))}
            {restingBall && (
              <g
                className={`trip-game-resting-ball ${activeShot.side === "cpu" ? "is-human" : "is-cpu"}`}
                transform={`translate(${restingBall[0]} ${restingBall[1]})`}
              >
                <circle r="3.4" className="trip-game-resting-ring" />
                <circle r="1.9" className="trip-game-resting-core" />
              </g>
            )}
            <GolferSprite
              at={
                firstOfSide
                  ? sidePoint(projection.tee, projection.pin, 8)
                  : sidePoint(activeShot.from, activeShot.to, 10)
              }
              toward={firstOfSide ? projection.pin : activeShot.to}
              hat={activeShot.side === "cpu" ? "red" : "blue"}
              pose={playback.phase === "settle" && activeShot.final ? "slump" : "idle"}
              scale={1.2}
            />
            <GolferSprite
              at={activeShot.from}
              toward={activeShot.to}
              hat={activeShot.side === "cpu" ? "blue" : "red"}
              pose={
                playback.phase === "swing"
                  ? "swing"
                  : playback.phase === "settle"
                    ? activeShot.final
                      ? "celebrate"
                      : activeShot.kind === "splash" || activeShot.kind === "ob"
                        ? "slump"
                        : "through"
                    : "through"
              }
              putting={activeShot.kind === "putt"}
              scale={1.3}
            />
            {playback.phase === "flight" && (
              <g className="trip-game-impact" transform={`translate(${activeShot.from[0] + (shotFlipped ? -6 : 6)} ${activeShot.from[1] - 4})`}>
                <path d="M0,-5 L1.6,-1.6 L5,0 L1.6,1.6 L0,5 L-1.6,1.6 L-5,0 L-1.6,-1.6 Z" />
              </g>
            )}
            {activeShot.terrible && playback.phase !== "settle" && (
              <g transform={`translate(${activeShot.from[0]} ${activeShot.from[1] - 26})`}>
                <g className="trip-game-terrible">
                  <rect x="-2.2" y="-9" width="4.4" height="11" />
                  <rect x="-2.2" y="4.4" width="4.4" height="4.4" />
                </g>
              </g>
            )}
            {playback.phase === "swing" && (
              <g className="trip-game-theater-ball-wrap" transform={`translate(${activeShot.from[0]} ${activeShot.from[1]})`}>
                <ellipse className="trip-game-theater-shadow" cx="0" cy="1.2" rx="3" ry="1.4" />
                <BallSprite r={2.6} />
              </g>
            )}
            {playback.phase === "flight" && flightFrame && (
              <>
                {activeShot.air && activeShot.airPath && (
                  <path d={activeShot.airPath} className="trip-game-air-arc" />
                )}
                <path
                  d={curvedPath([flightFrame.gx, flightFrame.gy], activeShot.to, 0)}
                  className="trip-game-aim-ahead"
                />
                <g className="trip-game-target trip-game-shot-ahead" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                  <circle r="5.2" />
                  <path d="M-7 0 H7 M0 -7 V7" />
                </g>
                {flownFrames.length > 1 && (
                  <path
                    d={framesToPath(flownFrames, activeShot.air)}
                    className={`trip-game-air-trail-line${trailTier ? ` is-${trailTier}` : ""}`}
                  />
                )}
                {flownFrames.slice(0, -1).map((frame, index) => (
                  <circle
                    key={`trail-${index}`}
                    cx={frame.x}
                    cy={frame.y}
                    r={
                      (activeShot.air ? 1.35 : 1.05) *
                      (trailTier === "pure" || trailTier === "fire" ? 1.5 : trailTier === "great" ? 1.2 : 1)
                    }
                    className={`trip-game-air-trail${trailTier ? ` is-${trailTier}` : ""}`}
                  />
                ))}
                <ellipse
                  className="trip-game-theater-shadow"
                  cx={flightFrame.gx}
                  cy={flightFrame.gy}
                  rx={flightFrame.shadow}
                  ry={flightFrame.shadow * 0.52}
                />
                {activeShot.air && flightFrame.lift > 6 && (
                  <line
                    className="trip-game-drop-line"
                    x1={flightFrame.x}
                    y1={flightFrame.y + flightFrame.size + 1}
                    x2={flightFrame.gx}
                    y2={flightFrame.gy}
                  />
                )}
                <g className="trip-game-theater-ball-wrap" transform={`translate(${flightFrame.x} ${flightFrame.y})`}>
                  {activeShot.air && flightFrame.lift > 8 && (
                    <g className="trip-game-motion-ticks" transform={`rotate(${shotFlipped ? 30 : -30})`}>
                      <rect x={-flightFrame.size - 7} y="-0.6" width="4.2" height="1.2" />
                      <rect x={-flightFrame.size - 11} y="-3.1" width="3.4" height="1.1" />
                      <rect x={-flightFrame.size - 11} y="1.8" width="3.4" height="1.1" />
                    </g>
                  )}
                  <BallSprite
                    r={flightFrame.size}
                    spin="fast"
                    tier={trailTier}
                    launch={flightFrameIndex === 0}
                    angle={shotFlipped ? 24 : -24}
                  />
                </g>
              </>
            )}
            {playback.phase === "settle" && activeShot.kind === "splash" && (
              <g className="trip-game-splash" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                <circle r="3" />
                <circle r="6" />
                <circle r="9" />
              </g>
            )}
            {playback.phase === "settle" && activeShot.kind !== "splash" && !activeShot.final && (
              <g className="trip-game-ball-settle" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                <BallSprite r={2.3} />
              </g>
            )}
            {playback.phase === "settle" &&
              activeShot.air &&
              activeShot.kind !== "splash" &&
              activeShot.kind !== "putt" &&
              !activeShot.final && (
                <g className="trip-game-land-puff" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                  <circle r="2.4" />
                  <circle r="1.7" />
                </g>
              )}
            {playback.phase === "settle" && activeShot.final && (
              <g className="trip-game-holeout" transform={`translate(${activeShot.to[0]} ${activeShot.to[1] - 4})`}>
                <path d="M0,-8 L2.3,-2.4 L8,-2.4 L3.4,1.2 L5.4,7 L0,3.4 L-5.4,7 L-3.4,1.2 L-8,-2.4 L-2.3,-2.4 Z" />
              </g>
            )}
          </g>
        )}
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
      {playback && activeShot?.kind === "putt" && (
        <PuttingScene shot={activeShot} phase={playback.phase} frame={playback.frame} side={activeShot.side} />
      )}
      {!playback && puttPreview}
      {!playback && clubReel}
      {intro && (
        <button type="button" className="trip-game-hole-intro" onClick={onIntroDismiss} aria-label="Dismiss hole intro">
          <small>HOLE {hole.number}</small>
          <b className={`is-par-${hole.par}`}>PAR {hole.par}</b>
          <span>
            {hole.yards ? `${hole.yards} YDS · ` : ""}SI {hole.si}
          </span>
        </button>
      )}
      {(intelLeft || intelRight) && (
        <div className="trip-game-map-intel">
          <div className="trip-game-map-intel-left">{intelLeft}</div>
          <div className="trip-game-map-intel-right">{intelRight}</div>
        </div>
      )}
      {kickMeter}
      {swingFx && (
        <div
          key={swingFx.id}
          className={`trip-game-judgment is-${swingFx.tier}${swingFx.nearMiss ? " is-near-miss" : ""}${swingFx.redBet && swingFx.tier === "pure" ? " is-fire" : ""}`}
          aria-hidden="true"
        >
          <b>{swingFx.label}</b>
          <small>{swingFx.sub}</small>
          {swingFx.streak >= 2 && <em>STRIPING ×{swingFx.streak}</em>}
          {swingFx.buzzBonus && <em className="is-buzz">🍺 SUPER SHOT</em>}
        </div>
      )}
      {swingFx?.tier === "pure" && <div key={`flash-${swingFx.id}`} className="trip-game-pure-flash" aria-hidden="true" />}
      {playback &&
        activeShot &&
        activeShot.kind !== "putt" &&
        (playback.phase === "flight" || playback.phase === "settle") &&
        Number.isFinite(activeShot.yards) && (
          <YardageTicker
            key={playback.index}
            yards={activeShot.yards}
            rollMs={Math.max(0, (activeShot.frames?.length || 8) - 1) * FLIGHT_FRAME_MS}
          />
        )}
      {canAct && (
        <div className="trip-game-pad">
          <div className="trip-game-pad-aim">
            <button
              type="button"
              className={aimOffset <= -AIM_MAX + 0.01 ? "is-maxed" : ""}
              onPointerDown={(event) => {
                event.preventDefault();
                startAimHold(-1);
              }}
              onPointerUp={stopAimHold}
              onPointerLeave={stopAimHold}
              onPointerCancel={stopAimHold}
              onContextMenu={(event) => event.preventDefault()}
              aria-label="Aim left (hold to sweep)"
            >
              ◀
            </button>
            <span>
              <small>AIM</small>
              <b>{aimText(aimOffset)}</b>
            </span>
            <button
              type="button"
              className={aimOffset >= AIM_MAX - 0.01 ? "is-maxed" : ""}
              onPointerDown={(event) => {
                event.preventDefault();
                startAimHold(1);
              }}
              onPointerUp={stopAimHold}
              onPointerLeave={stopAimHold}
              onPointerCancel={stopAimHold}
              onContextMenu={(event) => event.preventDefault()}
              aria-label="Aim right (hold to sweep)"
            >
              ▶
            </button>
          </div>
          <div className="trip-game-pad-menus">
            <button type="button" onClick={() => onCycle("club")} aria-label="Next club">
              <small>CLUB</small>
              <b>{club.short}</b>
            </button>
            <button type="button" onClick={() => onCycle("shape")} aria-label="Next shape">
              <small>SHAPE</small>
              <b>{shape.label.toUpperCase()}</b>
            </button>
          </div>
        </div>
      )}
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

function KickMeter({ phase, power: previewPower = 0, accuracy: previewAccuracy = 0, onTap, judgment, streak, mods }) {
  const tick = useSyncExternalStore(meterStore.subscribe, meterStore.get, meterStore.get);
  const power = phase === "preview" ? previewPower : tick.power;
  const accuracy = phase === "preview" ? previewAccuracy : tick.accuracy;
  const powerPct = clamp(power / POWER_METER_MAX, 0, 1);
  const preview = phase === "preview";
  const powerLocked = phase !== "power" && !preview;
  const accLive = phase === "accuracy";
  const locked = phase === "locked";
  const zoneScale = mods?.zoneScale || 1;
  const redBet = Boolean(mods?.redBet);
  const clutch = Boolean(mods?.clutch);
  const off = Math.abs(accuracy);
  const heat = !accLive
    ? ""
    : off <= ACC_PURE * zoneScale * 1.2
      ? " is-burning"
      : off <= ACC_GREAT * zoneScale
        ? " is-hot"
        : off <= ACC_GOOD * zoneScale
          ? " is-near"
          : "";
  const bandMin = mods?.paceBand ? mods.paceBand.min : POWER_SWEET_MIN;
  const bandMax = mods?.paceBand ? mods.paceBand.max : POWER_SWEET_MAX;
  const inSweet = !powerLocked && power >= bandMin && power <= bandMax;
  const inRed = power > bandMax;
  const streakClass = streak >= 4 ? " is-streak-fire" : streak >= 2 ? " is-streak-hot" : "";
  return (
    <>
      {!locked && !preview && (
        <button
          type="button"
          className="trip-game-kick-catch"
          onClick={onTap}
          aria-label={phase === "power" ? (mods?.paceBand ? "Tap to lock pace" : "Tap to lock power") : "Tap to lock accuracy"}
        />
      )}
      <div
        className={`trip-game-kick is-${phase}${judgment ? ` is-judged is-${judgment.tier}` : ""}${streakClass}${redBet ? " is-red-bet" : ""}${mods?.jitters && !mods.jitters.calmed && !locked ? " is-jittery" : ""}`}
        aria-hidden="true"
      >
        {mods?.jitters &&
          (mods.jitters.calmed ? (
            <div className="trip-game-kick-courage">🍺 LIQUID COURAGE</div>
          ) : (
            <div className="trip-game-kick-jitters">😰 {mods.jitters.label}</div>
          ))}
        {clutch && <div className="trip-game-kick-clutch">♥ CLUTCH TIME</div>}
        {redBet && <div className="trip-game-kick-bet">🔥 RISK ON</div>}
        {streak >= 2 && (
          <div className="trip-game-kick-streak">
            {streak >= 4 ? "🔥" : "●"} STRIPING ×{streak}
          </div>
        )}
        <div className={`trip-game-kick-col ${powerLocked ? "is-locked" : ""}`}>
          <small>{mods?.paceBand ? "PACE" : "PWR"}</small>
          <div className={`trip-game-kick-track${inSweet ? " is-charged" : ""}`}>
            {!mods?.paceBand && <i className="trip-game-kick-redzone" />}
            <i
              className="trip-game-kick-goodzone"
              style={
                mods?.paceBand
                  ? {
                      bottom: `${(mods.paceBand.min / POWER_METER_MAX) * 100}%`,
                      height: `${((mods.paceBand.max - mods.paceBand.min) / POWER_METER_MAX) * 100}%`,
                    }
                  : undefined
              }
            />
            <b
              className={`trip-game-kick-fill${inRed && (!powerLocked || redBet) ? " is-red" : ""}`}
              style={{ height: `${powerPct * 100}%` }}
            />
            <em style={{ bottom: `${powerPct * 100}%` }} />
          </div>
        </div>
        <div className={`trip-game-kick-acc ${accLive || locked ? "is-live" : ""}`}>
          <small>ACC</small>
          <div className="trip-game-kick-acc-track">
            <i className="trip-game-kick-zone-good" style={zoneStyle(ACC_GOOD, zoneScale)} />
            <i className="trip-game-kick-zone-great" style={zoneStyle(ACC_GREAT, zoneScale)} />
            <i className="trip-game-kick-zone-pure" style={zoneStyle(ACC_PURE, zoneScale)} />
            <s className="trip-game-kick-acc-center" />
            <b className={heat} style={{ left: `${50 + accuracy * 46}%` }} />
          </div>
          <span>
            <em>L</em>
            <em>R</em>
          </span>
        </div>
        <strong>
          {locked
            ? judgment?.label || "..."
            : preview
              ? "GET READY..."
              : phase === "power"
                ? mods?.club === "putter"
                  ? "TAP PACE"
                  : "TAP POWER"
                : mods?.club === "putter"
                  ? "TAP LINE"
                  : redBet
                    ? "TAP ACCURACY · RISK ON"
                    : "TAP ACCURACY"}
        </strong>
      </div>
    </>
  );
}

function YardageTicker({ yards, rollMs }) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(yards) || yards <= 0) return undefined;
    let frame = 0;
    let lastTick = 0;
    const start = performance.now();
    const duration = Math.max(600, rollMs || 900);
    const loop = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.1);
      setShown(Math.round(yards * eased));
      if (t < 1) {
        if (now - lastTick > 64) {
          lastTick = now;
          yardRollTick();
        }
        frame = requestAnimationFrame(loop);
      } else {
        setDone(true);
        yardRollFinal(yardTierOf(yards));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [yards, rollMs]);
  if (!Number.isFinite(yards) || yards <= 0) return null;
  const tier = yardTierOf(shown);
  const digits = String(clamp(shown, 0, 999)).padStart(3, "0").split("");
  return (
    <div className={`trip-game-yardage is-${tier}${done ? " is-done" : ""}`} aria-hidden="true">
      <div className="trip-game-yardage-digits">
        {digits.map((digit, index) => (
          <span key={index}>{digit}</span>
        ))}
        <small>YDS</small>
      </div>
      {done && tier === "bomb" && <b className="trip-game-yardage-tag">BOMB!</b>}
    </div>
  );
}

// Ryder-Cup-style hole ladder: one pip per hole, filled in the winning
// team's color as the match unfolds.
function HoleLadder({ history, humanTeam, cpuTeam, currentHole }) {
  const byHole = Object.fromEntries(history.map((row) => [row.hole, row]));
  return (
    <div className="trip-game-hole-ladder" aria-label="Hole-by-hole match ladder">
      {Array.from({ length: 18 }, (_, index) => {
        const number = index + 1;
        const row = byHole[number];
        const tone = !row
          ? number === currentHole
            ? "live"
            : "open"
          : row.winner === "tie"
            ? "halved"
            : (row.winner === "human" ? humanTeam : cpuTeam).toLowerCase();
        return <i key={number} className={`is-${tone}`} />;
      })}
    </div>
  );
}

/**
 * The golfer's dispersion oval, drawn at the target: outer ring = where most
 * of their shots finish, inner gold ring = the pure-strike zone. Rotated
 * along the shot line; the oval sits slightly short of center because
 * amateur misses skew short.
 */
function DispersionOval({ origin, center, pattern, scale }) {
  if (!pattern || !origin || !center) return null;
  const angle = (Math.atan2(center[1] - origin[1], center[0] - origin[0]) * 180) / Math.PI;
  const lateralU = pattern.lateral * scale;
  const depthU = ((pattern.short + pattern.long) / 2) * scale;
  const offset = ((pattern.long - pattern.short) / 2) * scale;
  if (lateralU < 1.5 || depthU < 1.5) return null;
  const starScale = clamp(Math.min(depthU, lateralU) * 0.13, 0.6, 1.7);
  return (
    <g transform={`translate(${center[0].toFixed(1)} ${center[1].toFixed(1)}) rotate(${angle.toFixed(1)})`}>
      <ellipse cx={offset.toFixed(1)} rx={depthU.toFixed(1)} ry={lateralU.toFixed(1)} className="trip-game-oval-outer" />
      <g className="trip-game-oval-pure-wrap" transform={`translate(${(offset * 0.4).toFixed(1)} 0)`}>
        <ellipse rx={(depthU * 0.42).toFixed(1)} ry={(lateralU * 0.42).toFixed(1)} className="trip-game-oval-pure" />
        <g transform={`scale(${starScale.toFixed(2)})`}>
          <path
            d="M0,-3 L0.9,-0.9 L3,-0.9 L1.3,0.5 L2,2.8 L0,1.4 L-2,2.8 L-1.3,0.5 L-3,-0.9 L-0.9,-0.9 Z"
            className="trip-game-oval-star"
          />
        </g>
      </g>
    </g>
  );
}

function PopDots({ count }) {
  const pops = Math.max(0, Number(count) || 0);
  if (!pops) return null;
  return (
    <i className={`trip-game-pop-dot${pops > 1 ? " is-double" : ""}`} aria-hidden="true">
      {pops > 1 ? <em /> : null}
    </i>
  );
}

function PopCall({ pops }) {
  if (!pops) return null;
  if (pops.human > 0) {
    return (
      <div className="trip-game-pop-chip is-pop" title="You get a handicap stroke on this hole">
        <i className="trip-game-pop-dot" />
        <b>POP</b>
        {pops.human > 1 ? <em>×{pops.human}</em> : null}
      </div>
    );
  }
  if (pops.cpu > 0) {
    return (
      <div className="trip-game-pop-chip is-give" title="You give a handicap stroke on this hole">
        <b>GIVE</b>
      </div>
    );
  }
  return (
    <div className="trip-game-pop-chip is-even" title="No handicap stroke on this hole">
      <b>EVEN</b>
    </div>
  );
}

function OpponentCard({ opponent, course, team }) {
  if (!opponent?.profile) {
    return (
      <div className="trip-game-vs-card">
        <small>VS {team}</small>
        <b>…</b>
      </div>
    );
  }
  const player = opponent.profile;
  return (
    <div className="trip-game-vs-card">
      <small>VS {team}</small>
      <b>{lastName(player.name)}</b>
      <span>CH {courseHandicap(player.hi, course)}</span>
    </div>
  );
}

function CaptainWheel({ players, selectedKey, usage, maxUses, disabled, onPick, course, team }) {
  const ranked = [...players]
    .filter((player) => (usage[player.key] || 0) < maxUses)
    .sort((left, right) => left.hi - right.hi);
  const list = ranked.length ? ranked : [...players].sort((left, right) => left.hi - right.hi);
  const index = Math.max(0, list.findIndex((player) => player.key === selectedKey));
  const selected = list[index] || null;
  const wheelRef = useRef(null);
  const dragRef = useRef(null);
  const lastTickRef = useRef(0);

  function step(direction) {
    if (disabled || list.length < 2) return;
    const player = list[(index + direction + list.length) % list.length];
    if (player) onPick(player);
  }

  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const now = performance.now();
      if (now - lastTickRef.current < 90) return;
      lastTickRef.current = now;
      step(event.deltaY > 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  });

  return (
    <div
      ref={wheelRef}
      className={`trip-game-vs-card is-you ${disabled ? "is-locked" : ""}`}
      onPointerDown={(event) => {
        dragRef.current = event.clientY;
      }}
      onPointerUp={(event) => {
        if (dragRef.current == null) return;
        const delta = event.clientY - dragRef.current;
        dragRef.current = null;
        if (Math.abs(delta) < 14) return;
        step(delta > 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <small>YOU {String(team || "").toUpperCase()}</small>
      <b>{selected ? lastName(selected.name) : "…"}</b>
      <span>CH {selected && course ? courseHandicap(selected.hi, course) : "—"}</span>
      <div className="trip-game-wheel-controls">
        <button
          type="button"
          disabled={disabled || list.length < 2}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(-1)}
          aria-label="Previous golfer"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={disabled || list.length < 2}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(1)}
          aria-label="Next golfer"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

function PlaybackPanel({ result, shots, shotIndex, onSkip }) {
  const shot = shots[Math.min(shotIndex, shots.length - 1)];
  const cpuSide = shot?.side === "cpu";
  // Only count this side's shots so far — the total would spoil the score.
  const sideShotCount = shots.slice(0, shotIndex + 1).filter((item) => item.side === shot?.side).length;
  return (
    <div className={`trip-game-playback${cpuSide ? " is-cpu" : ""}`} role="status" aria-live="polite">
      <small>{cpuSide ? `${result.cpu ? lastName(result.cpu.name).toUpperCase() : "CPU"} ANSWERS` : "NOW ON THE TEE"}</small>
      <b>{lastName((cpuSide ? result.cpu : result.human).name).toUpperCase()}</b>
      <div className="trip-game-playback-pips" aria-hidden="true">
        {Array.from({ length: sideShotCount }, (_, index) => (
          <span key={index} className={index === sideShotCount - 1 ? "is-live" : "is-done"}>
            {index + 1}
          </span>
        ))}
      </div>
      <p>{shot?.caption || "..."}</p>
      {result.kick && !cpuSide && (
        <em className="trip-game-kick-read">
          PWR {Math.round(result.kick.power * 100)} · ACC{" "}
          {result.kick.accuracy > 0.12 ? "RIGHT" : result.kick.accuracy < -0.12 ? "LEFT" : "CENTER"}
        </em>
      )}
      <button type="button" onClick={onSkip}>
        SKIP ▶▶
      </button>
    </div>
  );
}

function courseCardHoles(course) {
  const holes = course?.holes || [];
  return Array.from({ length: 18 }, (_, index) => {
    const hole = holes.find((item) => item.number === index + 1) || holes[index];
    return { number: index + 1, par: Number(hole?.par) || 4 };
  });
}

function ScorecardNine({ holes, historyByHole, liveHole, sideKey, sideGross, sidePops }) {
  return (
    <div className="trip-game-scorecard-nine" role="table">
      <div className="trip-game-scorecard-row is-hole">
        <span>HOLE</span>
        {holes.map((hole) => (
          <b key={hole.number} className={hole.number === liveHole ? "is-live" : ""}>
            {hole.number}
          </b>
        ))}
      </div>
      <div className="trip-game-scorecard-row is-par">
        <span>PAR</span>
        {holes.map((hole) => (
          <b key={hole.number}>{hole.par}</b>
        ))}
      </div>
      {["human", "cpu"].map((side) => (
        <div key={side} className={`trip-game-scorecard-row is-score is-${side}`}>
          <span>{side === "human" ? sideKey.human : sideKey.cpu}</span>
          {holes.map((hole) => {
            const row = historyByHole[hole.number];
            const gross = row ? sideGross(row, side) : null;
            const pops = row ? sidePops(row, side) : 0;
            const mark = scoreMark(gross, hole.par);
            const won = row && ((side === "human" && row.winner === "human") || (side === "cpu" && row.winner === "cpu"));
            return (
              <b
                key={hole.number}
                className={`is-${mark}${won ? " is-won" : ""}${pops ? " has-pop" : ""}${hole.number === liveHole ? " is-live" : ""}`}
              >
                {gross == null ? "—" : gross}
                <PopDots count={pops} />
              </b>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ScorecardModal({
  course,
  history,
  match,
  result,
  holeNumber,
  humanTeam,
  cpuTeam,
  onContinue,
  finalHole,
  closeout,
}) {
  const holes = courseCardHoles(course);
  const historyByHole = Object.fromEntries(history.map((row) => [row.hole, row]));
  const celebration = celebrationFor(result);
  const diff = match.human - match.cpu;
  const matchCall = diff === 0 ? "AS" : `${Math.abs(diff)} UP`;
  const leading = diff > 0 ? humanTeam : diff < 0 ? cpuTeam : null;
  const sideKey = {
    human: humanTeam.toLowerCase() === "south" ? "STH" : "NTH",
    cpu: cpuTeam.toLowerCase() === "south" ? "STH" : "NTH",
  };
  return (
    <div className="trip-game-scorecard-backdrop" role="presentation">
      <div className="trip-game-scorecard" role="dialog" aria-modal="true" aria-labelledby="scorecard-title">
        <div className="trip-game-scorecard-head">
          <small>{course?.label || "CAPTAIN'S CUP"}</small>
          <b className={leading ? `is-${leading.toLowerCase()}` : "is-square"}>{leading ? `${leading.toUpperCase()} ${matchCall}` : matchCall}</b>
          <span>
            THRU {history.length}
            {match.ties ? ` · ${match.ties} HALVED` : ""}
          </span>
        </div>
        <h3 id="scorecard-title">SCORECARD</h3>
        <div className={`trip-game-scorecard-call is-${celebration.tone}`}>
          <strong>
            {celebration.label}
            {result.conceded ? " · PICKED UP" : ""}
          </strong>
          <span>
            {lastName(result.human.name).toUpperCase()} {result.humanGross}
            {result.humanStroke ? "●" : ""} · {lastName(result.cpu.name).toUpperCase()} {result.cpuGross}
            {result.cpuStroke ? "●" : ""}
          </span>
        </div>
        <ScorecardNine
          holes={holes.slice(0, 9)}
          historyByHole={historyByHole}
          liveHole={holeNumber}
          sideKey={sideKey}
          sideGross={(row, side) => (side === "human" ? row.humanGross : row.cpuGross)}
          sidePops={(row, side) => (side === "human" ? row.humanStroke : row.cpuStroke)}
        />
        <ScorecardNine
          holes={holes.slice(9)}
          historyByHole={historyByHole}
          liveHole={holeNumber}
          sideKey={sideKey}
          sideGross={(row, side) => (side === "human" ? row.humanGross : row.cpuGross)}
          sidePops={(row, side) => (side === "human" ? row.humanStroke : row.cpuStroke)}
        />
        <div className="trip-game-scorecard-board">
          <div className={`is-${humanTeam.toLowerCase()} ${diff > 0 ? "is-leading" : ""}`}>
            <small>{humanTeam.toUpperCase()}</small>
            <b>{diff > 0 ? `${diff} UP` : diff < 0 ? `${Math.abs(diff)} DN` : "AS"}</b>
            <span>THRU {history.length}</span>
          </div>
          <em>VS</em>
          <div className={`is-${cpuTeam.toLowerCase()} ${diff < 0 ? "is-leading" : ""}`}>
            <small>{cpuTeam.toUpperCase()}</small>
            <b>{diff < 0 ? `${Math.abs(diff)} UP` : diff > 0 ? `${diff} DN` : "AS"}</b>
            <span>THRU {history.length}</span>
          </div>
        </div>
        {closeout?.decided && <div className="trip-game-scorecard-closeout">MATCH DECIDED · {closeout.label}</div>}
        <button type="button" className="trip-game-primary-button" onClick={onContinue}>
          {finalHole ? "FINAL RESULTS" : "CONTINUE"}
        </button>
      </div>
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

function BuyRoundOffer({ opponent, onAccept, onDecline }) {
  const name = opponent ? lastName(opponent.name) : "They";
  return (
    <div className="trip-game-modal-backdrop" role="presentation">
      <div className="trip-game-modal trip-game-modal--round" role="dialog" aria-modal="true" aria-labelledby="buy-round-title">
        <div className="trip-game-modal-sprite" aria-hidden="true">
          <span>🍻</span>
        </div>
        <p className="trip-game-modal-kicker">OPPONENT EVENT</p>
        <h3 id="buy-round-title">{name.toUpperCase()} OFFERS TO BUY A ROUND</h3>
        <p>
          You&apos;re running away with this match, and {name} just waved down the cart. Accept and the whole place starts
          rocking. Decline... and they take it personally.
        </p>
        <div className="trip-game-modal-options">
          <button type="button" onClick={onAccept}>
            <b>CHEERS 🍺</b>
            <span>Buzz +18 · stadium pulses harder</span>
          </button>
          <button type="button" onClick={onDecline}>
            <b>DECLINE</b>
            <span>They&apos;re insulted · their game locks in</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CartGirlOffer({ player, onDrink, onHydrate }) {
  return (
    <div className="trip-game-modal-backdrop" role="presentation">
      <div className="trip-game-modal trip-game-modal--cart" role="dialog" aria-modal="true" aria-labelledby="cart-girl-title">
        <div className="trip-game-modal-sprite" aria-hidden="true">
          <span>🛺</span>
        </div>
        <p className="trip-game-modal-kicker">COURSE ENCOUNTER</p>
        <h3 id="cart-girl-title">THE CART GIRL APPEARS!</h3>
        <p>
          {lastName(player.name)} has a choice. Take the short morale pop now, or hydrate and lower the chance of a late-round
          meltdown.
        </p>
        <div className="trip-game-modal-options">
          <button type="button" onClick={onDrink}>
            <b>GRAB A COLD ONE</b>
            <span>Buzz +14 · morale +8</span>
          </button>
          <button type="button" onClick={onHydrate}>
            <b>HYDRATE</b>
            <span>Buzz -12 · morale +5</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupScreen({
  model,
  courseId,
  setCourseId,
  team,
  setTeam,
  swingMode,
  setSwingMode,
  archiveState,
  geometryState = {},
  resume = null,
  onResume,
  onStart,
}) {
  const resumeDiff = resume ? resume.match.human - resume.match.cpu : 0;
  const resumeCall =
    resumeDiff === 0
      ? "ALL SQUARE"
      : `${(resumeDiff > 0 ? resume.captainTeam : resume.captainTeam === "South" ? "North" : "South").toUpperCase()} ${Math.abs(resumeDiff)} UP`;
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
                PAR {course.par} ·{" "}
                {!course.geometry
                  ? "PROTOTYPE MAP"
                  : geometryState[course.slug] === "error"
                    ? "MAP FAILED · PROTOTYPE"
                    : geometryState[course.slug] === "loading"
                      ? "LOADING MAP…"
                      : "REAL MAP"}
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
      <div className="trip-game-setup-block">
        <div className="trip-game-section-label">
          <span>3. SWING STYLE</span>
          <span>SKIP ANY HOLE IN-GAME</span>
        </div>
        <div className="trip-game-team-grid">
          <button
            type="button"
            className={swingMode === "full" ? "is-selected" : ""}
            onClick={() => setSwingMode("full")}
          >
            <b>EVERY SHOT</b>
            <span>METER ON DRIVES · APPROACHES · PUTTS</span>
          </button>
          <button
            type="button"
            className={swingMode === "single" ? "is-selected" : ""}
            onClick={() => setSwingMode("single")}
          >
            <b>ONE SWING</b>
            <span>TEE METER ONLY · MODEL PLAYS IT OUT</span>
          </button>
        </div>
      </div>
      <div className="trip-game-model-status">
        <span className={`trip-game-status-light is-${archiveState}`} />
        {archiveState === "loading"
          ? "LOADING 2025 + 2026 PLAYER HISTORY..."
          : `${model.dataSummary.trips} TRIPS · ${model.dataSummary.historicalPlayers} PROFILES · ODDS READY`}
      </div>
      {resume && (
        <button type="button" className="trip-game-primary-button trip-game-start-button trip-game-resume-button" onClick={onResume}>
          RESUME · HOLE {Math.min(18, resume.holeIndex + 1)} · {resumeCall} ▶
        </button>
      )}
      <button
        type="button"
        className="trip-game-primary-button trip-game-start-button"
        disabled={!courseId || !team || !model.courses.length}
        onClick={onStart}
      >
        {resume ? "NEW CAPTAIN ROUND ▶" : "START CAPTAIN ROUND ▶"}
      </button>
      <p className="trip-game-disclaimer">
        Turf and hazard shapes use OpenStreetMap geometry. Trees and mowing texture are illustrative; unscouted shot shapes remain
        modeled until player profiles are entered.
      </p>
    </div>
  );
}

function FinishScreen({ match, history, team, cpuTeam, closeout, onRematch, onSetup }) {
  const winner = match.human > match.cpu ? team : match.cpu > match.human ? cpuTeam : null;
  const diff = match.human - match.cpu;
  return (
    <div className="trip-game-finish">
      <p className="trip-game-modal-kicker">
        {closeout?.decided ? `MATCH CLOSED OUT AFTER ${closeout.holesPlayed} HOLES` : "ROUND COMPLETE"}
      </p>
      <h2 className={winner ? `is-${winner.toLowerCase()}` : ""}>
        {winner ? `${winner.toUpperCase()} WINS${closeout?.label ? ` ${closeout.label}` : ` ${Math.abs(diff)} UP`}` : "MATCH HALVED"}
      </h2>
      <div className="trip-game-final-score">
        <div className={`is-${team.toLowerCase()} ${diff > 0 ? "is-leading" : ""}`}>
          <span>{team.toUpperCase()}</span>
          <b>{diff > 0 ? `${diff} UP` : diff < 0 ? `${Math.abs(diff)} DN` : "AS"}</b>
        </div>
        <em>FINAL</em>
        <div className={`is-${cpuTeam.toLowerCase()} ${diff < 0 ? "is-leading" : ""}`}>
          <span>{cpuTeam.toUpperCase()}</span>
          <b>{diff < 0 ? `${Math.abs(diff)} UP` : diff > 0 ? `${diff} DN` : "AS"}</b>
        </div>
      </div>
      <HoleLadder history={history} humanTeam={team} cpuTeam={cpuTeam} currentHole={0} />
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
  const [decision, setDecision] = useState({ club: "driver", aim: 0, shape: "straight", fireball: false });
  const [usage, setUsage] = useState({});
  const [cpuUsage, setCpuUsage] = useState({});
  const [playerState, setPlayerState] = useState({});
  const [match, setMatch] = useState({ human: 0, cpu: 0, ties: 0 });
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [closeout, setCloseout] = useState(null);
  const [resolutionPhase, setResolutionPhase] = useState("idle");
  const [playbackShots, setPlaybackShots] = useState(null);
  const [playbackStep, setPlaybackStep] = useState({ index: 0, phase: "swing", frame: 0 });
  const [holeIntro, setHoleIntro] = useState(false);
  const [hype, setHype] = useState(0);
  const [streak, setStreak] = useState(0);
  const [geometryBySlug, setGeometryBySlug] = useState({});
  const [inventory, setInventory] = useState({ fireball: 1 });
  const [eventOffer, setEventOffer] = useState(null);
  const [eventHandled, setEventHandled] = useState({});
  const [pickLocked, setPickLocked] = useState(false);
  const [eventNote, setEventNote] = useState(null);
  const [cpuOpponent, setCpuOpponent] = useState(null);
  const [meterPhase, setMeterPhase] = useState(null);
  const [fastForward, setFastForward] = useState(false);
  const fastForwardRef = useRef(false);
  const [roundSalt, setRoundSalt] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [geometryState, setGeometryState] = useState({});
  const holdTimerRef = useRef(null);
  const swingTokenRef = useRef(0);
  const [savedMatch, setSavedMatch] = useState(() => {
    try {
      const raw = window.localStorage.getItem(MATCH_SAVE_KEY);
      const snapshot = raw ? JSON.parse(raw) : null;
      return snapshot && snapshot.v === 1 && Array.isArray(snapshot.history) ? snapshot : null;
    } catch {
      return null;
    }
  });
  const [swingFx, setSwingFx] = useState(null);
  const [shakeFx, setShakeFx] = useState(null);
  const [swingStreak, setSwingStreak] = useState(0);
  const [meterMods, setMeterMods] = useState({ zoneScale: 1, redBet: false, clutch: false, club: null });
  const meterModsRef = useRef({ speed: BASE_ACC_SPEED, clubSpeed: 1, zoneScale: 1, redBet: false, clutch: false });
  const [swingMode, setSwingMode] = useState(() => {
    try {
      return window.localStorage.getItem("tripGameSwingMode") === "full" ? "full" : "single";
    } catch {
      return "single";
    }
  });
  const [liveInfo, setLiveInfo] = useState(null);
  const [liveClubId, setLiveClubId] = useState(null);
  const [puttAim, setPuttAim] = useState(0);
  const [partySurge, setPartySurge] = useState(false);
  const partyTimerRef = useRef(null);
  const buyRoundRef = useRef(false);
  const cpuEdgeRef = useRef(false);
  const liveRef = useRef(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem("tripGameSound") !== "off";
    } catch {
      return true;
    }
  });
  const meterLiveRef = useRef({ power: 0, accuracy: 0, powerDir: 1, accDir: 1 });
  const meterLockRef = useRef(null);
  const meterTapAtRef = useRef(0);
  const resolvingRef = useRef(false);
  const randomRef = useRef(makeSeededRandom(Date.now()));
  const resolutionTimerRef = useRef(null);
  const pendingCommitRef = useRef(null);

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

  useEffect(
    () => () => {
      if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      if (partyTimerRef.current) window.clearTimeout(partyTimerRef.current);
      stopAll();
    },
    [],
  );

  useEffect(() => {
    setMeterAudioEnabled(soundOn);
    try {
      window.localStorage.setItem("tripGameSound", soundOn ? "on" : "off");
    } catch {
      // best effort
    }
  }, [soundOn]);

  useEffect(() => {
    try {
      window.localStorage.setItem("tripGameSwingMode", swingMode);
    } catch {
      // best effort
    }
  }, [swingMode]);

  // Game Boy style keyboard play on desktop. The handler lives in a ref so the
  // listener is attached once per screen instead of on every render (which,
  // while the meter ran, meant every frame).
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (event) => {
    const live = liveRef.current;
    const confirmKey = event.key === " " || event.key === "Enter";
    const onButton = event.target instanceof HTMLElement && event.target.tagName === "BUTTON";
    if (meterPhase && confirmKey) {
      if (event.repeat) return;
      event.preventDefault();
      tapMeter();
      return;
    }
    if (meterPhase) return;
    if (resolutionPhase === "result" && confirmKey) {
      if (event.repeat) return;
      event.preventDefault();
      nextHole();
      return;
    }
    if (event.key === "Escape" && live && !result && (resolutionPhase === "liveshot" || resolutionPhase === "idle")) {
      event.preventDefault();
      skipLiveHole();
      return;
    }
    if (confirmKey && !onButton && resolutionPhase === "idle" && !result && !eventOffer) {
      if (event.repeat) return;
      event.preventDefault();
      playHole();
      return;
    }
    if (live?.awaitingHuman && live.feet != null && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      adjustPuttAim(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (live?.awaitingHuman && live.feet == null && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      cycleLiveClub(event.key === "ArrowUp" ? 1 : -1);
      return;
    }
    // Once the ball is in play the tee aim is history: arrows must not edit it.
    if (live) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stepAim(event.key === "ArrowLeft" ? -1 : 1);
  };
  useEffect(() => {
    if (screen !== "play") return undefined;
    const onKey = (event) => keyHandlerRef.current?.(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  useEffect(() => {
    // "locked" is the hit-stop phase: the needle stays frozen where it was tapped.
    if (meterPhase !== "power" && meterPhase !== "accuracy") return undefined;
    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const live = meterLiveRef.current;
      if (meterPhase === "power") {
        const band = meterModsRef.current.paceBand;
        const putterMode = Boolean(band);
        const before = live.power;
        live.power += dt * (meterModsRef.current.powerSpeed || BASE_POWER_SPEED) * live.powerDir;
        updatePowerSweep(live.power / POWER_METER_MAX);
        const bandMin = band ? band.min : POWER_SWEET_MIN;
        const bandMax = band ? band.max : POWER_SWEET_MAX;
        if ((before < bandMin && live.power >= bandMin) || (before > bandMin && live.power <= bandMin)) zoneTick("good");
        if ((before < bandMax && live.power >= bandMax) || (before > bandMax && live.power <= bandMax)) zoneTick("warn");
        // Every bar ping-pongs now. Putts settle wherever the bar sits after
        // 3 passes; a full swing left alone slams to MAX SEND after ~3.5.
        let commitPower = null;
        if (live.power >= POWER_METER_MAX) {
          live.power = POWER_METER_MAX;
          live.powerDir = -1;
          live.powerBounces = (live.powerBounces || 0) + 1;
          if (!putterMode && live.powerBounces >= 7) commitPower = POWER_METER_MAX;
        } else if (live.power <= 0 && live.powerDir < 0) {
          live.power = 0;
          live.powerDir = 1;
          live.powerBounces = (live.powerBounces || 0) + 1;
        }
        if (putterMode && commitPower == null && (live.powerBounces || 0) >= 6) commitPower = live.power;
        if (commitPower != null) {
          live.accuracy = -1;
          live.accDir = 1;
          meterLockRef.current = { power: commitPower };
          stopPowerSweep();
          lockPowerSound(commitPower > bandMax);
          armAccuracyPhase(commitPower);
          meterStore.set(commitPower, -1);
          setMeterPhase("accuracy");
          return;
        }
      } else if (meterPhase === "accuracy") {
        // Lead-in: the needle waits at the left post for a beat so the first
        // centre pass is always tappable, whatever the handicap speed.
        if ((live.accHold || 0) > 0) {
          live.accHold -= dt;
          frame = requestAnimationFrame(loop);
          return;
        }
        const beforeOff = Math.abs(live.accuracy);
        // A few drinks deep, the needle surges and slows — good luck.
        const drunkWobble = meterModsRef.current.buzzWobble ? 1 + Math.sin(now / 150) * 0.35 : 1;
        live.accuracy += live.accDir * dt * meterModsRef.current.speed * drunkWobble;
        if (live.accuracy >= 1) {
          live.accuracy = 1;
          live.accDir = -1;
        } else if (live.accuracy <= -1) {
          live.accuracy = -1;
          live.accDir = 1;
        }
        const offNow = Math.abs(live.accuracy);
        const zoneScale = meterModsRef.current.zoneScale || 1;
        if (offNow <= ACC_PURE * zoneScale && beforeOff > ACC_PURE * zoneScale) zoneTick("pure");
        else if (offNow <= ACC_GREAT * zoneScale && beforeOff > ACC_GREAT * zoneScale) zoneTick("good");
      }
      meterStore.set(live.power, live.accuracy);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [meterPhase]);

  // Advance the cartoon shot playback: swing -> frame-by-frame flight -> settle.
  // Runs both the full-hole replay ("playback") and single live shots ("liveshot").
  // Latest closures live in a ref so the step clock only re-arms when the step
  // changes, not on every unrelated re-render.
  const playbackRef = useRef(null);
  playbackRef.current = { result, swingFx, handleLiveShotDone, finishPlayback };
  useEffect(() => {
    if ((resolutionPhase !== "playback" && resolutionPhase !== "liveshot") || !playbackShots) return undefined;
    const shot = playbackShots[playbackStep.index];
    if (!shot) {
      if (resolutionPhase === "liveshot") playbackRef.current.handleLiveShotDone();
      else playbackRef.current.finishPlayback();
      return undefined;
    }
    const lastFrame = Math.max(0, (shot.frames?.length || 1) - 1);
    const duration =
      playbackStep.phase === "swing"
        ? shot.kind === "putt"
          ? 320
          : 420
        : playbackStep.phase === "flight"
          ? FLIGHT_FRAME_MS
          : shot.kind === "splash"
            ? 700
            : shot.final
              ? 640
              : 300;
    const timer = window.setTimeout(() => {
      if (playbackStep.phase === "swing") {
        // Club meets ball: crack + screenshake, scaled by how hard they swung.
        // The meter-earned effects belong to the human tee ball, wherever the
        // match-play order put it.
        const humanTee = playbackStep.index === playbackShots.findIndex((item) => item.side !== "cpu");
        const { result: latestResult, swingFx: latestFx } = playbackRef.current;
        const kickPower = shot.kickPower ?? (humanTee ? latestResult?.kick?.power ?? 0.9 : 0.62);
        contactSound({
          power: kickPower,
          putt: shot.kind === "putt",
          pure: humanTee && latestFx?.tier === "pure",
        });
        if (humanTee && shot.kind !== "putt") {
          setShakeFx({ amp: Math.round(3 + clamp(kickPower, 0, 1.15) * 5), id: Date.now() });
          window.setTimeout(() => setShakeFx(null), 320);
          // A flushed drive gets the gallery murmuring while it hangs up there.
          if (latestFx?.tier === "pure" || latestFx?.tier === "great") {
            crowdSwell(latestFx.tier === "pure" ? 1 : 0.55);
          }
        }
      }
      if (playbackStep.phase === "flight" && (playbackStep.frame || 0) >= lastFrame) {
        // Ball is about to land.
        if (shot.kind === "splash") splashSound();
        else if (shot.kind === "ob") zoneTick("warn");
        else if (shot.final) holeoutSound();
      }
      setPlaybackStep((current) => {
        if (current.phase === "swing") return { ...current, phase: "flight", frame: 0 };
        if (current.phase === "flight") {
          if ((current.frame || 0) < lastFrame) return { ...current, frame: (current.frame || 0) + 1 };
          return { ...current, phase: "settle" };
        }
        return { index: current.index + 1, phase: "swing", frame: 0 };
      });
    }, fastForwardRef.current ? Math.min(duration, 40) : duration);
    return () => window.clearTimeout(timer);
  }, [resolutionPhase, playbackShots, playbackStep]);

  // Hole intro card auto-dismisses after a beat.
  useEffect(() => {
    if (!holeIntro) return undefined;
    const timer = window.setTimeout(() => setHoleIntro(false), 2100);
    return () => window.clearTimeout(timer);
  }, [holeIntro]);

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
    setGeometryState((current) => ({ ...current, [course.slug]: "loading" }));
    fetch(course.geometry)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geometry) => {
        if (!live) return;
        setGeometryBySlug((current) => ({ ...current, [course.slug]: geometry }));
        setGeometryState((current) => ({ ...current, [course.slug]: "ready" }));
      })
      .catch(() => {
        if (!live) return;
        setGeometryBySlug((current) => ({ ...current, [course.slug]: null }));
        setGeometryState((current) => ({ ...current, [course.slug]: "error" }));
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
      hazardSeverity: projection.hazardSeverity,
      preferredShape: projection.preferredShape,
      shapeSeverity: projection.shapeSeverity,
      stimpSalt: roundSalt,
    };
  }, [baseHole, projection, roundSalt]);

  const cpuTeam = captainTeam === "South" ? "North" : "South";
  const humanRoster = model.players.filter((player) => player.team === captainTeam);
  const cpuRoster = model.players.filter((player) => player.team === cpuTeam);
  const maxUses = Math.max(2, Math.ceil(18 / Math.max(1, humanRoster.length)));
  const cpuMaxUses = Math.max(2, Math.ceil(18 / Math.max(1, cpuRoster.length)));

  useEffect(() => {
    if (screen !== "play" || !course || !hole || !cpuRoster.length) return;
    const pick = chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
      random: randomRef.current,
    });
    setCpuOpponent(pick || null);
    // Lock once per hole so the matchup is visible before the captain picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hole change only
  }, [screen, holeIndex, course?.id, hole?.number]);

  const selected = humanRoster.find((player) => player.key === selectedKey) || null;
  const selectedState = selected ? playerState[selected.key] || DEFAULT_PLAYER_STATE : DEFAULT_PLAYER_STATE;

  useEffect(() => {
    if (screen !== "play" || selectedKey || !hole || result || resolutionPhase !== "idle") return;
    const available = humanRoster
      .filter((player) => (usage[player.key] || 0) < maxUses)
      .sort((left, right) => left.hi - right.hi);
    const player = available[0];
    if (!player) return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
  }, [screen, holeIndex, hole, selectedKey, humanRoster, usage, maxUses, result, resolutionPhase]);
  const odds = useMemo(
    () => (selected && course && hole ? buildHoleOdds({ profile: selected, course, hole, decision, state: selectedState }) : null),
    [course, decision, hole, selected, selectedState],
  );
  const livePops = useMemo(
    () => (selected && cpuOpponent?.profile && course && hole ? holePops(selected, cpuOpponent.profile, course, hole) : null),
    [selected, cpuOpponent, course, hole],
  );
  const holeRanking = useMemo(() => {
    if (!course || !hole) return [];
    return model.players
      .filter((player) => player.team === captainTeam)
      .map((player) => {
        const playerCondition = playerState[player.key] || DEFAULT_PLAYER_STATE;
        const plan = findBestDecision({ profile: player, course, hole, state: playerCondition });
        return { key: player.key, expected: plan.best.odds.expectedGross };
      })
      .sort((left, right) => left.expected - right.expected);
  }, [captainTeam, course, hole, model.players, playerState]);
  const captainRead = useMemo(() => {
    if (!selected || !course || !hole || !odds) return null;
    const baselineDecision = defaultDecision(selected, hole);
    const baselineOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision: baselineDecision,
      state: selectedState,
    });
    const { best, worst } = findBestDecision({ profile: selected, course, hole, state: selectedState });
    const range = Math.max(0.01, worst.odds.expectedGross - best.odds.expectedGross);
    const rawQuality = 1 - clamp((odds.expectedGross - best.odds.expectedGross) / range, 0, 1);
    const quality = Math.round(rawQuality * 100);
    const scoring = odds.probs[0] + odds.probs[1];
    const baselineScoring = baselineOdds.probs[0] + baselineOdds.probs[1];
    const bigNumber = odds.probs[3] + odds.probs[4];
    const baselineBigNumber = baselineOdds.probs[3] + baselineOdds.probs[4];
    const playerRank = Math.max(1, holeRanking.findIndex((player) => player.key === selected.key) + 1);
    const fireball = Boolean(decision.fireball);
    const label = fireball
      ? "CHAOS MODE!"
      : quality >= 94
        ? "PERFECT READ!"
        : quality >= 76
          ? "SMART PLAY!"
          : quality >= 52
            ? "LIVE OPTION"
            : "DANGER ZONE!";
    const tone = fireball ? "chaos" : quality >= 94 ? "perfect" : quality >= 76 ? "smart" : quality >= 52 ? "live" : "danger";
    return {
      label,
      tone,
      quality,
      scoringDelta: scoring - baselineScoring,
      bigNumberDelta: bigNumber - baselineBigNumber,
      expectedSaved: baselineOdds.expectedGross - odds.expectedGross,
      bestDecision: best.decision,
      playerRank,
      rosterSize: holeRanking.length,
      fireball,
      planKey: `${decision.club}-${decision.shape}-${decision.aim}-${fireball ? "fireball" : "normal"}`,
    };
  }, [course, decision, hole, holeRanking, odds, selected, selectedState]);
  const scoreDifference = match.human - match.cpu;
  const holesRemaining = 18 - history.length;
  const dormie = scoreDifference !== 0 && Math.abs(scoreDifference) === holesRemaining;
  const leadingTeam = scoreDifference > 0 ? captainTeam : scoreDifference < 0 ? cpuTeam : null;
  const matchCall = leadingTeam ? `${leadingTeam.toUpperCase()} ${Math.abs(scoreDifference)} UP` : "AS";
  const liveClubEntry = liveClubId ? liveClubOf(liveClubId) : null;
  // Show the upcoming swing's meter (zones, pace band, jitters) BEFORE the
  // player commits — so they can read it, then pull the trigger.
  const previewMeterMods = (() => {
    if (meterPhase || result || resolutionPhase !== "idle" || !selected || screen !== "play") return null;
    const live = liveRef.current;
    if (live?.awaitingHuman) {
      if (live.feet != null && live.puttRead) {
        return computeMeterMods({
          club: "putter",
          lie: "Green",
          paceBand: live.puttRead.paceBand,
          needle: live.puttRead.needle,
          context: "putt",
        });
      }
      return computeMeterMods({ club: liveClubId || live.club, lie: live.lie, context: "approach" });
    }
    if (!live && !liveInfo) return computeMeterMods({ club: decision.club, context: "tee" });
    return null;
  })();
  const livePreview =
    liveClubEntry && liveRef.current?.awaitingHuman
      ? (() => {
          const carryYards = Math.round(liveClubEntry.carry * LIVE_CARRY_SWEET * (Number(decision.carryBoost) || 1));
          return {
            short: liveClubEntry.short,
            carryYards,
            pattern: shotPatternFor(selected?.hi ?? 12, carryYards),
          };
        })()
      : null;

  function initializePlayerState() {
    return Object.fromEntries(model.players.map((player) => [player.key, { buzz: 0, morale: 50 }]));
  }

  function startRound() {
    if (!course || !captainTeam) return;
    if (resolutionTimerRef.current) {
      window.clearTimeout(resolutionTimerRef.current);
      resolutionTimerRef.current = null;
    }
    setScreen("play");
    setHoleIndex(0);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: 0, shape: "straight", fireball: false });
    setUsage({});
    setCpuUsage({});
    setPlayerState(initializePlayerState());
    setMatch({ human: 0, cpu: 0, ties: 0 });
    setHistory([]);
    setResult(null);
    setCloseout(null);
    setResolutionPhase("idle");
    setPlaybackShots(null);
    setHoleIntro(true);
    pendingCommitRef.current = null;
    setHype(0);
    setStreak(0);
    setSwingStreak(0);
    liveRef.current = null;
    setLiveInfo(null);
    buyRoundRef.current = false;
    cpuEdgeRef.current = false;
    setPartySurge(false);
    setInventory({ fireball: 1 });
    setEventOffer(null);
    setEventHandled({});
    setPickLocked(false);
    setEventNote(null);
    setCpuOpponent(null);
    setMeterPhase(null);
    resolvingRef.current = false;
    meterLockRef.current = null;
    randomRef.current = makeSeededRandom(Date.now());
    setRoundSalt(Date.now() % 997);
    setSwingFx(null);
    setShakeFx(null);
    setMeterMods({ zoneScale: 1, redBet: false, clutch: false, club: null });
    setLiveClubId(null);
    setPuttAim(0);
    setFastForward(false);
    fastForwardRef.current = false;
    cancelPendingSwing();
    try {
      window.localStorage.removeItem(MATCH_SAVE_KEY);
    } catch {
      // best effort
    }
  }

  // Pick the saved match back up on the hole after the last one committed.
  function resumeMatch() {
    const snapshot = savedMatch;
    if (!snapshot) return;
    setCourseId(snapshot.courseId);
    setCaptainTeam(snapshot.captainTeam);
    setSwingMode(snapshot.swingMode === "full" ? "full" : "single");
    startRound();
    setHoleIndex(clamp(Number(snapshot.holeIndex) || 0, 0, 17));
    setUsage(snapshot.usage || {});
    setCpuUsage(snapshot.cpuUsage || {});
    setPlayerState(snapshot.playerState || initializePlayerState());
    setMatch(snapshot.match || { human: 0, cpu: 0, ties: 0 });
    setHistory(snapshot.history || []);
    setHype(Number(snapshot.hype) || 0);
    setStreak(Number(snapshot.streak) || 0);
    setSwingStreak(Number(snapshot.swingStreak) || 0);
    setInventory(snapshot.inventory || { fireball: 1 });
    setEventHandled(snapshot.eventHandled || {});
    buyRoundRef.current = Boolean(snapshot.buyRound);
    cpuEdgeRef.current = Boolean(snapshot.cpuEdge);
    setRoundSalt(Number(snapshot.roundSalt) || 0);
    setSavedMatch(null);
  }

  // Drops a swing still in its hit-stop: SKIP, NEXT HOLE, a restart or an
  // unmount must never let the old tap commit into a fresh hole.
  function cancelPendingSwing() {
    swingTokenRef.current += 1;
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function toggleFastForward() {
    const next = !fastForwardRef.current;
    fastForwardRef.current = next;
    setFastForward(next);
  }

  function pickPlayer(player) {
    if (result || pickLocked || resolutionPhase !== "idle") return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
    setEventNote(null);
    setMeterPhase(null);
    resolvingRef.current = false;
    meterLockRef.current = null;
    haptic(8);
  }

  function stepAim(direction) {
    if (!selected || result || resolutionPhase !== "idle" || meterPhase) return;
    setDecision((current) => ({
      ...current,
      aim: clamp(aimOffsetOf(current.aim) + direction * AIM_STEP, -AIM_MAX, AIM_MAX),
    }));
    haptic(4);
  }

  function cycleDecision(type) {
    if (!selected || result || resolutionPhase !== "idle" || meterPhase) return;
    setDecision((current) => {
      const options = type === "club" ? CLUBS.filter((item) => item.minPar <= (hole?.par || 3)) : SHAPES;
      if (!options.length) return current;
      const index = Math.max(0, options.findIndex((item) => item.id === current[type]));
      return { ...current, [type]: options[(index + 1) % options.length].id };
    });
    haptic(4);
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

  function triggerPartySurge() {
    clinkSound();
    crowdSwell(0.85);
    setPartySurge(true);
    if (partyTimerRef.current) window.clearTimeout(partyTimerRef.current);
    partyTimerRef.current = window.setTimeout(() => setPartySurge(false), 2600);
    haptic([20, 40, 20, 40, 60]);
  }

  // CPU state, with the "declined our round" edge applied when earned.
  function cpuStateOf(key) {
    const base = playerState[key] || DEFAULT_PLAYER_STATE;
    if (!cpuEdgeRef.current) return base;
    return { ...base, morale: (base.morale ?? 50) + 25 };
  }

  function acceptFireball() {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, { buzz: 22, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote("FIREBALL ACCEPTED · EARLY BOOST / TIPPING RISK");
    setEventOffer(null);
    triggerPartySurge();
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

  function chooseCartGirl(drink) {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, drink ? { buzz: 14, morale: 8 } : { buzz: -12, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote(
      drink ? "COLD ONE ACQUIRED · SHORT MORALE POP / MORE BUZZ" : "HYDRATION PLAY · BUZZ DOWN / CONTROL RESTORED",
    );
    setEventOffer(null);
    if (drink) triggerPartySurge();
  }

  // Unlimited fireball shots: slam one whenever you like. The stadium loves
  // it; your meter does not.
  function takeFireballShot() {
    if (!selected || result) return;
    updateCondition(selected.key, { buzz: 22, morale: 3 });
    setEventNote("FIREBALL DOWN THE HATCH · BUZZ CLIMBING");
    triggerPartySurge();
  }

  function acceptBuyRound() {
    if (!eventOffer) return;
    if (selected) updateCondition(selected.key, { buzz: 18, morale: 6 });
    setEventNote("ROUND ACCEPTED · CROWD'S ROCKING / METER'S SWIMMING");
    setEventOffer(null);
    triggerPartySurge();
  }

  function declineBuyRound() {
    if (!eventOffer) return;
    cpuEdgeRef.current = true;
    setEventNote("ROUND DECLINED · THEY'RE INSULTED AND LOCKED IN");
    setEventOffer(null);
  }

  // Contextual meter mods: shorter clubs swing an easier (slower, wider)
  // needle, better players get wider zones, higher handicaps a faster meter,
  // bad lies tighten everything, drinks and nerves push both ways, and a
  // match-deciding hole drops into clutch time. Pure computation — also used
  // to render the preview meter before the swing starts.
  function computeMeterMods(options = {}) {
    const clubId = options.club || decision.club;
    const liveClub = liveClubOf(clubId);
    const lieMod = LIE_METER_MODS[options.lie] || { zone: 1, speed: 1 };
    const skill = skillOf(selected?.hi);
    const stimpNeedle = options.needle || 1;
    const buzz = buzzTierOf(selectedState?.buzz);
    // Nerves on the big stages — offset by liquid courage.
    const jitters = jittersFor(hole?.number, options.context || "tee", selectedState?.buzz || 0);
    const jitterZone = jitters ? 1 - 0.2 * jitters.intensity : 1;
    const jitterSpeed = jitters ? 1 + 0.25 * jitters.intensity : 1;
    const skillSpeed = (1 + (1 - skill) * SKILL_SPEED_PENALTY) * lieMod.speed * stimpNeedle * buzz.speed * jitterSpeed;
    const baseZone =
      (liveClub?.zone ?? CLUB_ZONE_SCALE[clubId] ?? 1) *
      (SKILL_ZONE_MIN + skill * SKILL_ZONE_RANGE) *
      lieMod.zone *
      buzz.zone *
      jitterZone;
    const clubSpeed = liveClub?.speed ?? CLUB_METER_SPEED[clubId] ?? 1;
    const clutch = dormie || hole?.number === 18;
    return {
      speed: BASE_ACC_SPEED * clubSpeed * skillSpeed * (clutch ? CLUTCH_SPEED : 1),
      powerSpeed: BASE_POWER_SPEED * skillSpeed * (clutch ? 0.85 : 1),
      clubSpeed,
      skillSpeed,
      baseZone,
      zoneScale: baseZone,
      redBet: false,
      clutch,
      club: clubId,
      paceBand: options.paceBand || null,
      buzzWobble: buzz.wobble,
      buzzBonus: buzz.bonus,
      jitters,
    };
  }

  function startKickMeter(options = {}) {
    setHoleIntro(false);
    resolvingRef.current = false;
    meterLiveRef.current = { power: 0, accuracy: -1, powerDir: 1, accDir: 1, powerBounces: 0 };
    meterLockRef.current = null;
    meterTapAtRef.current = 0;
    const mods = computeMeterMods(options);
    const { baseZone, clutch, club: clubId, paceBand, jitters } = mods;
    if (jitters && !jitters.calmed) crowdSwell(0.35);
    meterModsRef.current = mods;
    setMeterMods({
      zoneScale: baseZone,
      redBet: false,
      clutch,
      club: clubId,
      paceBand,
      jitters,
    });
    meterStore.set(0, -1);
    setSwingFx(null);
    setMeterPhase("power");
    unlockMeterAudio();
    startPowerSweep();
    if (clutch) startHeartbeat();
    haptic(8);
  }

  // Called the instant power locks: if it landed in the red band, the bet is
  // on — zones shrink and the needle speeds up, visibly, before the second tap.
  function armAccuracyPhase(lockedPower) {
    const live = meterModsRef.current;
    // A charged putt is a pace problem, not a fire bet.
    const redBet = live.club !== "putter" && lockedPower > POWER_SWEET_MAX;
    live.redBet = redBet;
    live.zoneScale = (live.baseZone ?? 1) * (redBet ? RED_BET_ZONE_SCALE : 1);
    live.speed =
      BASE_ACC_SPEED *
      (live.clubSpeed ?? 1) *
      (live.skillSpeed ?? 1) *
      (live.clutch ? CLUTCH_SPEED : 1) *
      (redBet ? RED_BET_SPEED : 1);
    meterLiveRef.current.accHold = 0.16;
    setMeterMods((current) => ({ ...current, zoneScale: live.zoneScale, redBet, clutch: live.clutch, club: live.club }));
    if (redBet) riskArmedSound();
  }

  function tapMeter() {
    if (!meterPhase || meterPhase === "locked" || resolvingRef.current) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - meterTapAtRef.current < 220) return;
    meterTapAtRef.current = now;
    if (meterPhase === "power") {
      const live = meterLiveRef.current;
      live.accuracy = -1;
      live.accDir = 1;
      meterLockRef.current = { power: live.power };
      stopPowerSweep();
      lockPowerSound(live.power > POWER_SWEET_MAX);
      armAccuracyPhase(live.power);
      setMeterPhase("accuracy");
      haptic(10);
      return;
    }
    const power = meterLockRef.current?.power ?? meterLiveRef.current.power;
    const accuracy = meterLiveRef.current.accuracy;
    meterLockRef.current = { power, accuracy };
    resolvingRef.current = true;
    stopHeartbeat();
    // Hit-stop: freeze the needle where it was tapped, flash the judgment,
    // then release into the swing after a tier-scaled beat.
    const judgment = judgeSwing(power, accuracy, meterModsRef.current);
    // Striping streak: consecutive GREAT-or-better swings. PUREs climb the
    // chord up the scale; any lesser strike resets it.
    const nextStreak = judgment.tier === "pure" || judgment.tier === "great" ? swingStreak + 1 : 0;
    setSwingStreak(nextStreak);
    setSwingFx({ ...judgment, power, accuracy, streak: nextStreak, id: now });
    setAnnounce(judgment.label ? `${judgment.label}${judgment.sub ? `. ${judgment.sub}` : ""}` : "");
    setMeterPhase("locked");
    swingJudgmentSound(judgment.tier, judgment.tier === "pure" ? nextStreak - 1 : 0);
    if (judgment.nearMiss) nearMissSound();
    haptic(judgment.tier === "pure" ? [18, 26, 46] : judgment.tier === "great" ? 26 : judgment.tier === "wild" ? [8, 36] : 12);
    const token = ++swingTokenRef.current;
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (token !== swingTokenRef.current) return;
      setMeterPhase(null);
      commitSwing({ power, accuracy, judgment });
    }, judgment.hold);
  }

  function commitSwing(meter) {
    if (swingMode === "full") {
      if (!liveRef.current) setupLiveHole();
      applyLiveSwing(meter);
      return;
    }
    resolveHole(meter);
  }

  // ---- Shot-by-shot mode: you swing the meter for every stroke, and the
  // ---- CPU answers stroke for stroke in true match-play order.

  function setupLiveHole() {
    if (!selected || !hole || !course || !projection || result) return;
    const humanOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision,
      state: playerState[selected.key],
    });
    const cpuPick =
      cpuOpponent ||
      chooseCpuPlayer({
        players: cpuRoster,
        usage: cpuUsage,
        maxUses: cpuMaxUses,
        course,
        hole,
        stateByPlayer: playerState,
        random: randomRef.current,
      });
    if (!cpuPick) return;
    const cpuDecision = cpuPick.decision || defaultDecision(cpuPick.profile, hole);
    const cpuOdds = buildHoleOdds({
      profile: cpuPick.profile,
      course,
      hole,
      decision: cpuDecision,
      state: cpuStateOf(cpuPick.profile.key),
    });
    // Sample the CPU's whole hole up front so it can be interleaved live.
    const cpuSample = resolveMatchHole({
      human: selected,
      cpu: cpuPick.profile,
      humanOdds,
      cpuOdds,
      course,
      hole,
      random: randomRef.current,
      humanGrossOverride: hole.par,
    });
    const cpuShots = buildShotSequence({
      projection,
      hole,
      decision: cpuDecision,
      gross: cpuSample.cpuGross,
      landingLabel: cpuSample.cpuLanding,
      side: "cpu",
      seedSalt: 5,
    }).map((shot, index) => ({ ...shot, shotNumber: index + 1 }));
    const lastWinner = [...history].reverse().find((row) => row.winner !== "tie")?.winner;
    const { lineLength, target: teeTarget } = computeShotTarget(projection, hole, decision);
    liveRef.current = {
      pos: projection.tee,
      lie: "Tee",
      strokes: 0,
      feet: null,
      puttCount: 0,
      sceneCarry: null,
      holed: false,
      club: decision.club,
      kick: null,
      humanOdds,
      swungDecision: decision,
      yardsScale: hole.yards && lineLength ? lineLength / hole.yards : 1,
      cpuPick,
      cpuOdds,
      cpuGross: cpuSample.cpuGross,
      cpuShots,
      cpuIndex: 0,
      cpuHonors: lastWinner === "cpu",
      teeTarget,
      teeLanding: null,
      remainingUnits: null,
      conceded: false,
    };
    setPickLocked(true);
    setLiveInfo(liveStatusOf());
  }

  function applyLiveSwing(meter) {
    const live = liveRef.current;
    if (!live) return;
    if (live.strokes === 0) {
      // Record the tee swing: it flavors the odds bookkeeping and the result card.
      const swung = { ...decision, power: meter.power, accuracy: meter.accuracy };
      live.swungDecision = swung;
      live.kick = { power: meter.power, accuracy: meter.accuracy };
      live.humanOdds = buildHoleOdds({ profile: selected, course, hole, decision: swung, state: playerState[selected.key] });
    }
    const judgment = meter.judgment || judgeSwing(meter.power, meter.accuracy, meterModsRef.current);
    advanceLiveState(meter, judgment, true);
    setLiveInfo(liveStatusOf());
  }

  // Decides who acts next under match-play rules: honors on the tee, both
  // balls in play after the tee shots, then whoever is away plays.
  function advanceMatchFlow() {
    const live = liveRef.current;
    if (!live || result || !projection) return;
    const humanDone = live.holed || live.strokes >= hole.par + 4;
    const cpuDone = live.cpuIndex >= live.cpuShots.length;
    if (humanDone && cpuDone) {
      completeLiveHole();
      return;
    }
    // Match play: once they're in and your best possible net can't beat it, pick up.
    if (cpuDone && !humanDone && selected && live.cpuPick) {
      const pops = holePops(selected, live.cpuPick.profile, course, hole);
      const humanBestNet = live.strokes + 1 - pops.human;
      const cpuNet = live.cpuGross - pops.cpu;
      if (humanBestNet > cpuNet) {
        live.conceded = true;
        completeLiveHole();
        return;
      }
    }
    if (live.cpuHonors) {
      if (live.cpuIndex === 0) {
        playNextCpuShot();
        return;
      }
      if (live.strokes === 0) {
        beginHumanTurn();
        return;
      }
    } else {
      if (live.strokes === 0) {
        beginHumanTurn();
        return;
      }
      if (live.cpuIndex === 0) {
        playNextCpuShot();
        return;
      }
    }
    if (humanDone) {
      playNextCpuShot();
      return;
    }
    if (cpuDone) {
      beginHumanTurn();
      return;
    }
    const pin = projection.pin;
    const humanDist = live.remainingUnits ?? Math.hypot(live.pos[0] - pin[0], live.pos[1] - pin[1]);
    const cpuFrom = live.cpuShots[live.cpuIndex].from;
    const cpuDist = Math.hypot(cpuFrom[0] - pin[0], cpuFrom[1] - pin[1]);
    if (cpuDist >= humanDist) playNextCpuShot();
    else beginHumanTurn();
  }

  // Human's turn: the meter NEVER auto-starts — every stroke waits for the
  // player. The tee arms off the PLAY press; approaches pause for club
  // selection; putts pause until PUTT is pressed.
  function beginHumanTurn() {
    const live = liveRef.current;
    if (!live || !projection) return;
    if (live.strokes === 0) {
      startNextLiveSwing();
      return;
    }
    if (live.feet != null) {
      // Build the green read once so aiming, the meter's pace band, and the
      // resolution all agree on the same break/slope/speed.
      live.puttRead = makePuttRead({
        hole,
        puttCount: live.puttCount,
        feet: live.feet,
        sceneCarry: live.sceneCarry,
      });
      live.aimTicks = 0;
      setPuttAim(0);
      live.awaitingHuman = true;
      setLiveClubId(null);
      setLiveInfo(liveStatusOf());
      return;
    }
    const scale = live.yardsScale || 1;
    const remaining = Math.hypot(projection.pin[0] - live.pos[0], projection.pin[1] - live.pos[1]) / scale;
    live.club = defaultLiveClub(remaining, live.lie);
    live.awaitingHuman = true;
    setLiveClubId(live.club);
    setLiveInfo(liveStatusOf());
  }

  function cycleLiveClub(direction = 1) {
    const live = liveRef.current;
    if (!live || !live.awaitingHuman) return;
    const index = LIVE_CLUBS.findIndex((club) => club.id === live.club);
    const next = LIVE_CLUBS[(index + direction + LIVE_CLUBS.length) % LIVE_CLUBS.length];
    live.club = next.id;
    setLiveClubId(next.id);
    zoneTick("good");
  }

  function playNextCpuShot() {
    const live = liveRef.current;
    if (!live) return;
    const shot = live.cpuShots[live.cpuIndex];
    if (!shot) {
      advanceMatchFlow();
      return;
    }
    live.cpuIndex += 1;
    setPlaybackShots([shot]);
    setPlaybackStep({ index: 0, phase: "swing", frame: 0 });
    setResolutionPhase("liveshot");
  }

  function advanceLiveState(meter, judgment, animate) {
    const live = liveRef.current;
    if (!live || !projection) return;
    const yardsScale = live.yardsScale;
    const from = live.pos;
    let shot = null;
    if (live.feet != null) {
      const read =
        live.puttRead ||
        makePuttRead({ hole, puttCount: live.puttCount, feet: live.feet, sceneCarry: live.sceneCarry });
      const aimTicks = live.aimTicks ?? Math.round(read.requiredTicks);
      const result = resolveLivePutt({ read, aimTicks, meter, puttCount: live.puttCount });
      live.strokes += 1;
      live.puttCount += 1;
      const end = result.made
        ? [85, 36]
        : [
            85 + result.missSide * (2.5 + Math.min(5, Math.abs(result.lineErr) * 2.2)),
            36 + clamp(result.leaveFeet * 2.5, 3.5, 44),
          ];
      live.sceneCarry = result.made ? null : end;
      live.puttRead = null;
      live.aimTicks = null;
      if (result.made) {
        live.holed = true;
        live.feet = null;
      } else {
        live.feet = Math.max(1, Math.round(result.leaveFeet));
      }
      live.remainingUnits = result.made ? 0 : (live.feet / 3) * yardsScale;
      // Teach the read: show what the putt actually needed.
      if (animate) {
        const neededLabel = `NEEDED ${Math.abs(result.effRequired).toFixed(1)} ${result.effRequired > 0 ? "R" : "L"}`;
        const paceLabel = `PACE ${result.paceErr >= 0 ? "+" : ""}${Math.round(result.paceErr * 100)}`;
        setSwingFx((current) =>
          current
            ? { ...current, sub: result.made ? `${paceLabel} · PURE READ` : `${neededLabel} · ${paceLabel}` }
            : current,
        );
      }
      shot = {
        ...makeShot({
          from,
          to: result.made ? projection.pin : from,
          kind: "putt",
          final: result.made,
          yardsScale,
          caption: result.lip ? "LIPS OUT!" : null,
        }),
        putt: { ...read, start: read.start, end, aimTicks, for: forLabelOf(live.strokes - hole.par) },
        lip: result.lip,
        side: "human",
        kickPower: meter.power,
        shotNumber: live.strokes,
      };
      if (animate && result.lip) nearMissSound();
    } else {
      const res = resolveLiveStroke({
        projection,
        hole,
        from,
        lie: live.lie,
        meter,
        judgment,
        clubId: live.club,
        // Buzzed flush = super shot: the ball goes extra.
        carryBoost: (decision.carryBoost || 1) * (judgment.buzzBonus ? meterModsRef.current.buzzBonus || 1 : 1),
        drunk: Boolean(meterModsRef.current.buzzWobble),
        yardsScale,
        // The tee ball flies at the planned target on the hole line (which
        // already carries the aim); par-3 tee balls and approaches aim at the pin.
        lineTarget: live.strokes === 0 && hole.par > 3 ? live.teeTarget : null,
        aimUnits:
          live.strokes === 0 && hole.par <= 3 ? aimOffsetOf(decision.aim) * clamp(projection.width * 0.12, 10, 22) : 0,
        fireball: Boolean(decision.fireball),
        rng: randomRef.current,
        hi: selected?.hi ?? 12,
        zoneScale: meterModsRef.current.zoneScale || 1,
        seedSalt: hole.number * 13 + live.strokes * 7 + 2,
      });
      if (live.strokes === 0) {
        live.teeLanding = {
          point: res.to,
          type:
            res.kind === "ob" || res.kind === "splash"
              ? "Penalty area"
              : res.nextLie === "Bunker" || res.nextLie === "Rough"
                ? res.nextLie
                : "Fairway",
        };
      }
      live.strokes += 1 + (res.penalty || 0);
      live.pos = res.nextPos || res.to;
      live.lie = res.nextLie || live.lie;
      live.remainingUnits = res.holed ? 0 : Math.hypot(projection.pin[0] - live.pos[0], projection.pin[1] - live.pos[1]);
      if (res.holed) live.holed = true;
      if (res.feet != null) {
        live.feet = res.feet;
        live.puttCount = 0;
        live.sceneCarry = null;
      }
      shot = {
        ...makeShot({
          from,
          to: res.to,
          kind: res.kind,
          final: Boolean(res.holed),
          bend: res.bend ?? 0,
          yardsScale,
          caption: res.caption,
          ground: res.ground,
        }),
        side: "human",
        kickPower: meter.power,
        shotNumber: live.strokes,
        terrible: judgment.tier === "wild",
      };
    }
    if (animate && shot) {
      setPlaybackShots([shot]);
      setPlaybackStep({ index: 0, phase: "swing", frame: 0 });
      setResolutionPhase("liveshot");
    }
  }

  function liveStatusOf() {
    const live = liveRef.current;
    if (!live || !projection) return null;
    if (live.holed) return { label: `HOLED IN ${live.strokes}` };
    const scale = live.yardsScale || 1;
    const remaining =
      live.feet != null
        ? `${live.feet} FT LEFT`
        : `${Math.max(1, Math.round(Math.hypot(projection.pin[0] - live.pos[0], projection.pin[1] - live.pos[1]) / scale))}Y LEFT`;
    if (live.strokes === 0) return { label: `ON THE TEE · ${remaining}` };
    return { label: `STROKE ${live.strokes} · ${live.feet != null ? "ON THE GREEN" : live.lie.toUpperCase()} · ${remaining}` };
  }

  function handleLiveShotDone() {
    setPlaybackShots(null);
    setResolutionPhase("idle");
    const live = liveRef.current;
    if (!live) return;
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    resolutionTimerRef.current = window.setTimeout(() => advanceMatchFlow(), 700);
  }

  function startNextLiveSwing() {
    const live = liveRef.current;
    if (!live || result || live.holed || live.strokes >= hole.par + 4) return;
    const scale = live.yardsScale || 1;
    const clubId =
      live.strokes === 0
        ? hole.par <= 3
          ? defaultLiveClub(hole.yards || 150, "Fairway")
          : decision.club
        : live.feet != null
          ? "putter"
          : live.club ||
            defaultLiveClub(Math.hypot(projection.pin[0] - live.pos[0], projection.pin[1] - live.pos[1]) / scale, live.lie);
    live.club = clubId;
    live.awaitingHuman = false;
    setLiveClubId(null);
    startKickMeter({
      club: clubId,
      lie: live.feet != null ? "Green" : live.lie,
      paceBand: live.feet != null ? live.puttRead?.paceBand : null,
      needle: live.feet != null ? live.puttRead?.needle : 1,
      context: live.strokes === 0 ? "tee" : live.feet != null ? "putt" : "approach",
    });
  }

  function adjustPuttAim(direction) {
    const live = liveRef.current;
    if (!live || !live.awaitingHuman || live.feet == null) return;
    const next = clamp((live.aimTicks ?? 0) + direction, -8, 8);
    live.aimTicks = next;
    setPuttAim(next);
    zoneTick("good");
  }

  function completeLiveHole() {
    const live = liveRef.current;
    if (!live || !selected || !hole || !course) return;
    liveRef.current = null;
    setLiveInfo(null);
    const humanGross = clamp(
      live.holed ? live.strokes : live.conceded ? live.strokes + 1 : hole.par + 4,
      1,
      hole.par + 4,
    );
    const resolved = resolveMatchHole({
      human: selected,
      cpu: live.cpuPick.profile,
      humanOdds: live.humanOdds,
      cpuOdds: live.cpuOdds,
      course,
      hole,
      random: randomRef.current,
      humanGrossOverride: humanGross,
      cpuGrossOverride: live.cpuGross,
      humanLandingOverride: live.teeLanding?.type ?? null,
    });
    // Every shot was already animated live — commit straight to the scorecard.
    stageHoleResult({
      resolved,
      cpuPick: live.cpuPick,
      humanOdds: live.humanOdds,
      cpuOdds: live.cpuOdds,
      visualDecision: live.swungDecision,
      kick: live.kick,
      shots: [],
      teeLanding: live.teeLanding,
      conceded: Boolean(live.conceded),
    });
  }

  function skipLiveHole() {
    const live = liveRef.current;
    if (!live || result) return;
    if (resolutionTimerRef.current) {
      window.clearTimeout(resolutionTimerRef.current);
      resolutionTimerRef.current = null;
    }
    setMeterPhase(null);
    stopPowerSweep();
    stopHeartbeat();
    setSwingFx(null);
    resolvingRef.current = false;
    setPlaybackShots(null);
    cancelPendingSwing();
    // Simulate the rest of the hole with steady, decent swings — picking a
    // sensible club each time — and fast-forward the CPU's remaining answer.
    let guard = 0;
    while (!live.holed && live.strokes < hole.par + 4 && guard < 14) {
      guard += 1;
      if (live.feet == null && live.strokes > 0) {
        const scale = live.yardsScale || 1;
        const remaining = Math.hypot(projection.pin[0] - live.pos[0], projection.pin[1] - live.pos[1]) / scale;
        live.club = defaultLiveClub(remaining, live.lie);
      }
      let power = 0.88;
      if (live.feet != null) {
        // Putts are paced to the read (with some slop), or every skipped hole is a three-putt.
        live.puttRead =
          live.puttRead || makePuttRead({ hole, puttCount: live.puttCount, feet: live.feet, sceneCarry: live.sceneCarry });
        live.aimTicks = null;
        const band = live.puttRead.paceBand;
        power = (band.min + band.max) / 2 + (seededUnit(hole.number * 53 + live.strokes * 7) - 0.5) * (band.max - band.min) * 1.8;
      }
      const accuracy = (seededUnit(hole.number * 91 + live.strokes * 13) - 0.5) * 0.24;
      const meter = { power, accuracy };
      advanceLiveState(meter, judgeSwing(meter.power, accuracy, { zoneScale: meterModsRef.current.baseZone || 1 }), false);
    }
    live.cpuIndex = live.cpuShots.length;
    completeLiveHole();
  }

  function playHole() {
    if (meterPhase) {
      tapMeter();
      return;
    }
    if (liveRef.current && !result) {
      if (liveRef.current.awaitingHuman) {
        startNextLiveSwing();
        return;
      }
      // The post-shot timer would fire a second advance on top of this one.
      if (resolutionTimerRef.current) {
        window.clearTimeout(resolutionTimerRef.current);
        resolutionTimerRef.current = null;
      }
      advanceMatchFlow();
      return;
    }
    if (!selected || !odds || !hole || !course || result || resolutionPhase !== "idle") return;
    if (CART_GIRL_HOLES.has(hole.number) && !eventHandled[holeIndex]) {
      setEventOffer({ type: "cart-girl", playerKey: selected.key, player: selected });
      return;
    }
    const seanInGroup = humanRoster.some((player) => player.key === "sean wilson");
    if (
      seanInGroup &&
      selected.key !== "sean wilson" &&
      FIREBALL_HOLES.has(hole.number) &&
      !eventHandled[holeIndex]
    ) {
      setEventOffer({ type: "fireball", playerKey: selected.key, player: selected });
      return;
    }
    // Blowing them out? They'll offer to buy a round — a trap either way.
    if (scoreDifference >= 2 && !buyRoundRef.current && cpuOpponent) {
      buyRoundRef.current = true;
      setEventOffer({ type: "buy-round", playerKey: selected.key, player: selected });
      return;
    }
    if (swingMode === "full") {
      setupLiveHole();
      advanceMatchFlow();
      return;
    }
    startKickMeter();
  }

  function resolveHole(meter) {
    if (!selected || !hole || !course || result || resolutionPhase !== "idle") return;
    const swung = {
      ...decision,
      power: meter.power,
      accuracy: meter.accuracy,
    };
    const visualDecision = {
      ...swung,
      aim: clamp(aimOffsetOf(decision.aim) + meter.accuracy * 0.45, -AIM_MAX, AIM_MAX),
    };
    const currentHumanOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision: swung,
      state: playerState[selected.key],
    });
    const cpuPick = cpuOpponent || chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
      random: randomRef.current,
    });
    if (!cpuPick) return;
    const cpuOdds = buildHoleOdds({
      profile: cpuPick.profile,
      course,
      hole,
      decision: cpuPick.decision || defaultDecision(cpuPick.profile, hole),
      state: cpuStateOf(cpuPick.profile.key),
    });
    const resolved = resolveMatchHole({
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds,
      course,
      hole,
      random: randomRef.current,
      remapHumanLanding: projection
        ? (wanted) => placeTeeLanding(projection, hole, visualDecision, wanted).type
        : undefined,
    });
    const humanShots = projection
      ? buildShotSequence({
          projection,
          hole,
          decision: visualDecision,
          gross: resolved.humanGross,
          landingLabel: resolved.humanLanding,
          side: "human",
        })
      : [];
    const cpuShots = projection
      ? buildShotSequence({
          projection,
          hole,
          decision: cpuPick.decision || defaultDecision(cpuPick.profile, hole),
          gross: resolved.cpuGross,
          landingLabel: resolved.cpuLanding,
          side: "cpu",
          seedSalt: 5,
        })
      : [];
    // Match-play order: last hole's winner has honors (retained through ties),
    // then whoever is away plays until they're inside the opponent.
    const lastWinner = [...history].reverse().find((row) => row.winner !== "tie")?.winner;
    const shots =
      lastWinner === "cpu"
        ? mergeMatchPlayShots(cpuShots, humanShots, projection?.pin)
        : mergeMatchPlayShots(humanShots, cpuShots, projection?.pin);
    stageHoleResult({
      resolved,
      cpuPick,
      humanOdds: currentHumanOdds,
      cpuOdds,
      visualDecision,
      kick: { power: meter.power, accuracy: meter.accuracy },
      shots,
    });
  }

  // Shared tail of a resolved hole: hype/streak accounting, pending commit,
  // and kicking off the playback. Used by both swing modes.
  function stageHoleResult({ resolved, cpuPick, humanOdds, cpuOdds, visualDecision, kick, shots, teeLanding = null, conceded = false }) {
    const completeResult = {
      ...resolved,
      human: selected,
      cpu: cpuPick.profile,
      humanOdds,
      cpuOdds,
      decisionRead: captainRead,
      kick,
    };
    const nextStreak = resolved.winner === "human" ? streak + 1 : resolved.winner === "tie" ? streak : 0;
    const qualityBonus = Math.round(((captainRead?.quality || 50) / 100) * 12);
    const resultBonus = resolved.winner === "human" ? 14 : resolved.winner === "tie" ? 7 : 2;
    const scoreBonus = resolved.humanBucket.id === "birdie" ? 12 : resolved.humanBucket.id === "par" ? 5 : 0;
    const streakBonus = Math.min(8, Math.max(0, nextStreak - 1) * 3);
    const hypeGain = clamp(4 + qualityBonus + resultBonus + scoreBonus + streakBonus, 6, 40);
    const powerUpEarned = hype + hypeGain >= 100;
    const nextHype = powerUpEarned ? hype + hypeGain - 100 : hype + hypeGain;
    completeResult.hypeGain = hypeGain;
    completeResult.streak = nextStreak;
    completeResult.powerUpEarned = powerUpEarned;
    completeResult.shotDecision = visualDecision;
    completeResult.teeLanding = teeLanding;
    completeResult.conceded = conceded;
    const nextCloseout = matchCloseout({
      humanWins: match.human + (resolved.winner === "human" ? 1 : 0),
      cpuWins: match.cpu + (resolved.winner === "cpu" ? 1 : 0),
      holesPlayed: holeIndex + 1,
    });
    pendingCommitRef.current = {
      resolved,
      cpuPick,
      selectedKey: selected.key,
      selectedName: selected.name,
      holeNumber: hole.number,
      usedFireball: Boolean(decision.fireball),
      nextStreak,
      nextHype,
      powerUpEarned,
      nextCloseout,
    };
    setPlaybackShots(shots);
    setPlaybackStep({ index: 0, phase: "swing", frame: 0 });
    setResult(completeResult);
    setResolutionPhase("playback");
    haptic(10);
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    const safetyMs = Math.max(
      PLAYBACK_SAFETY_MS,
      shots.reduce((total, shot) => total + 420 + (shot.frames?.length || 8) * FLIGHT_FRAME_MS + 700, 4000),
    );
    resolutionTimerRef.current = window.setTimeout(() => finishPlayback(), safetyMs);
  }

  function finishPlayback() {
    const pending = pendingCommitRef.current;
    if (!pending) return;
    pendingCommitRef.current = null;
    if (resolutionTimerRef.current) {
      window.clearTimeout(resolutionTimerRef.current);
      resolutionTimerRef.current = null;
    }
    const { resolved, cpuPick, nextStreak, nextHype, powerUpEarned, nextCloseout } = pending;
    setResolutionPhase("result");
    setPlaybackShots(null);
    {
      const nextHuman = match.human + (resolved.winner === "human" ? 1 : 0);
      const nextCpu = match.cpu + (resolved.winner === "cpu" ? 1 : 0);
      const call =
        nextHuman === nextCpu
          ? "all square"
          : `${nextHuman > nextCpu ? captainTeam : cpuTeam} ${Math.abs(nextHuman - nextCpu)} up`;
      setAnnounce(
        `Hole ${pending.holeNumber}: ${
          resolved.winner === "human" ? "you win the hole" : resolved.winner === "cpu" ? "they win the hole" : "halved"
        }, ${resolved.humanGross} to ${resolved.cpuGross}. ${call}.`,
      );
    }
    setUsage((current) => ({ ...current, [pending.selectedKey]: (current[pending.selectedKey] || 0) + 1 }));
    setCpuUsage((current) => ({ ...current, [cpuPick.profile.key]: (current[cpuPick.profile.key] || 0) + 1 }));
    setMatch((current) => ({
      human: current.human + (resolved.winner === "human" ? 1 : 0),
      cpu: current.cpu + (resolved.winner === "cpu" ? 1 : 0),
      ties: current.ties + (resolved.winner === "tie" ? 1 : 0),
    }));
    setHistory((current) => [
      ...current,
      {
        hole: pending.holeNumber,
        winner: resolved.winner,
        human: pending.selectedName,
        cpu: cpuPick.profile.name,
        humanGross: resolved.humanGross,
        cpuGross: resolved.cpuGross,
        humanStroke: resolved.humanStroke,
        cpuStroke: resolved.cpuStroke,
      },
    ]);
    setHype(nextHype);
    setStreak(nextStreak);
    if (nextCloseout.decided) setCloseout(nextCloseout);
    setInventory((current) => ({
      ...current,
      fireball: Math.max(0, current.fireball - (pending.usedFireball ? 1 : 0)) + (powerUpEarned ? 1 : 0),
    }));
    if (resolved.winner === "human") holeWinSound();
    haptic(resolved.winner === "human" ? [35, 30, 65] : 25);
  }

  function nextHole() {
    if (holeIndex >= 17 || closeout?.decided) {
      setScreen("finish");
      return;
    }
    setHoleIndex((current) => current + 1);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: 0, shape: "straight", fireball: false });
    setResult(null);
    setResolutionPhase("idle");
    setPlaybackShots(null);
    setHoleIntro(true);
    pendingCommitRef.current = null;
    setEventOffer(null);
    setPickLocked(false);
    setEventNote(null);
    setCpuOpponent(null);
    setMeterPhase(null);
    setSwingFx(null);
    setShakeFx(null);
    setMeterMods({ zoneScale: 1, redBet: false, clutch: false, club: null });
    stopHeartbeat();
    resolvingRef.current = false;
    meterLockRef.current = null;
    liveRef.current = null;
    setLiveInfo(null);
    setPuttAim(0);
    setLiveClubId(null);
    setPartySurge(false);
    cancelPendingSwing();
  }

  // Save the match at every hole boundary so a reload can resume from the setup screen.
  const saveRef = useRef(null);
  saveRef.current = () => {
    if (screen !== "play" || !course || !captainTeam) return;
    try {
      if (!history.length) return;
      if (closeout?.decided || history.length >= 18) {
        window.localStorage.removeItem(MATCH_SAVE_KEY);
        return;
      }
      const snapshot = {
        v: 1,
        savedAt: Date.now(),
        tripId: data?.trip?.id ?? null,
        courseId: course.id,
        captainTeam,
        swingMode,
        holeIndex: history.length,
        usage,
        cpuUsage,
        playerState,
        match,
        history,
        hype,
        streak,
        swingStreak,
        inventory,
        eventHandled,
        buyRound: buyRoundRef.current,
        cpuEdge: cpuEdgeRef.current,
        roundSalt,
      };
      window.localStorage.setItem(MATCH_SAVE_KEY, JSON.stringify(snapshot));
    } catch {
      // best effort
    }
  };
  useEffect(() => {
    saveRef.current?.();
  }, [history.length, screen, closeout]);

  const resumable =
    savedMatch &&
    savedMatch.tripId === (data?.trip?.id ?? null) &&
    savedMatch.history.length > 0 &&
    savedMatch.history.length < 18 &&
    model.courses.some((entry) => entry.id === savedMatch.courseId)
      ? savedMatch
      : null;

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
    <section
      className={`trip-game${screen === "play" ? " trip-game--play" : ""}`}
      aria-label="Captain's Cup pixel golf game"
    >
      <div className="trip-game-sr-only" role="status" aria-live="assertive">
        {announce}
      </div>
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
            swingMode={swingMode}
            setSwingMode={setSwingMode}
            archiveState={archiveState}
            geometryState={geometryState}
            resume={resumable}
            onResume={resumeMatch}
            onStart={startRound}
          />
        )}
        {screen === "finish" && (
          <FinishScreen
            match={match}
            history={history}
            team={captainTeam}
            cpuTeam={cpuTeam}
            closeout={closeout}
            onRematch={startRound}
            onSetup={() => setScreen("setup")}
          />
        )}
        {screen === "play" && course && hole && projection && (
          <>
            <div className="trip-game-scorebar">
              <div className={`trip-game-score-team is-${captainTeam.toLowerCase()}${scoreDifference > 0 ? " is-leading" : ""}`}>
                <span>YOU · {captainTeam.toUpperCase()}</span>
                <em className="trip-game-score-pips" aria-label={`${match.human} holes won`}>
                  {Array.from({ length: match.human }, (_, index) => (
                    <i key={index} />
                  ))}
                </em>
              </div>
              <div className="trip-game-hole-box">
                <small>HOLE</small>
                <b>{String(hole.number).padStart(2, "0")}</b>
                <span className={`trip-game-par-pill is-par-${hole.par}`}>PAR {hole.par}</span>
              </div>
              <div className={`trip-game-score-team is-${cpuTeam.toLowerCase()}${scoreDifference < 0 ? " is-leading" : ""}`}>
                <span>CPU · {cpuTeam.toUpperCase()}</span>
                <em className="trip-game-score-pips" aria-label={`${match.cpu} holes won`}>
                  {Array.from({ length: match.cpu }, (_, index) => (
                    <i key={index} />
                  ))}
                </em>
              </div>
            </div>
            <div className="trip-game-match-state">
              <b
                key={matchCall}
                className={`trip-game-match-call ${leadingTeam ? `is-${leadingTeam.toLowerCase()}` : "is-square"}`}
              >
                {matchCall}
              </b>
              <HoleLadder history={history} humanTeam={captainTeam} cpuTeam={cpuTeam} currentHole={hole.number} />
              <span className={`trip-game-match-thru${dormie ? " is-dormie" : ""}`}>
                {dormie ? "DORMIE" : `THRU ${history.length}`}
              </span>
            </div>
            <div className={`trip-game-hype ${resolutionPhase === "rolling" ? "is-charging" : ""}`}>
              <span>HYPE</span>
              <div className="trip-game-hype-track">
                <i style={{ width: `${hype}%` }} />
              </div>
              <b>{hype}/100</b>
              {streak >= 2 && <em>HEAT ×{streak}</em>}
            </div>
            {selected && buzzTierOf(selectedState.buzz).pulse > 0 && (
              <div className={`trip-game-buzz-row is-${buzzTierOf(selectedState.buzz).id}`}>
                <span>🍺 BUZZ</span>
                <div className="trip-game-buzz-track">
                  <i style={{ width: `${clamp(selectedState.buzz, 0, 100)}%` }} />
                </div>
                <b>{buzzTierOf(selectedState.buzz).label}</b>
              </div>
            )}
            <div className="trip-game-play-grid">
              <HoleMap
                projection={projection}
                hole={hole}
                decision={decision}
                result={resolutionPhase === "result" ? result : null}
                playback={
                  (resolutionPhase === "playback" || resolutionPhase === "liveshot") && playbackShots?.length
                    ? { shots: playbackShots, index: playbackStep.index, phase: playbackStep.phase, frame: playbackStep.frame }
                    : null
                }
                liveStatus={liveInfo && !result ? liveInfo.label : null}
                livePos={liveInfo && !result && liveRef.current ? liveRef.current.pos : null}
                playerHi={selected?.hi ?? 12}
                livePreview={livePreview}
                puttPreview={
                  liveInfo && !result && liveRef.current?.feet != null && liveRef.current?.puttRead ? (
                    <PuttingScene preview read={liveRef.current.puttRead} aimTicks={puttAim} side="human" />
                  ) : null
                }
                clubReel={
                  liveInfo && !result && liveRef.current?.awaitingHuman && liveRef.current?.feet != null ? (
                    <div className="trip-game-club-reel is-aim" role="group" aria-label="Putt aim">
                      <button type="button" onClick={() => adjustPuttAim(-1)} aria-label="Aim left">
                        ◀
                      </button>
                      <div className="trip-game-club-reel-window">
                        <span>AIM</span>
                        <b key={puttAim}>
                          {puttAim === 0 ? "CENTER" : `${Math.abs(puttAim)} ${puttAim > 0 ? "R" : "L"}`}
                          <em>{liveRef.current.puttRead.feet} FT</em>
                        </b>
                        <span>{liveRef.current.puttRead.stimp}</span>
                      </div>
                      <button type="button" onClick={() => adjustPuttAim(1)} aria-label="Aim right">
                        ▶
                      </button>
                    </div>
                  ) : livePreview && liveClubEntry
                    ? (() => {
                        const reelIndex = LIVE_CLUBS.findIndex((clubItem) => clubItem.id === liveClubId);
                        const prevClub = LIVE_CLUBS[(reelIndex - 1 + LIVE_CLUBS.length) % LIVE_CLUBS.length];
                        const nextClub = LIVE_CLUBS[(reelIndex + 1) % LIVE_CLUBS.length];
                        return (
                          <div className="trip-game-club-reel" role="group" aria-label="Club selection">
                            <button type="button" onClick={() => cycleLiveClub(-1)} aria-label="Previous club">
                              ◀
                            </button>
                            <div className="trip-game-club-reel-window">
                              <span>{prevClub.short}</span>
                              <b key={liveClubId}>
                                {liveClubEntry.short}
                                <em>{livePreview.carryYards}Y</em>
                              </b>
                              <span>{nextClub.short}</span>
                            </div>
                            <button type="button" onClick={() => cycleLiveClub(1)} aria-label="Next club">
                              ▶
                            </button>
                          </div>
                        );
                      })()
                    : null
                }
                intro={holeIntro && resolutionPhase === "idle" && !result && !meterPhase && !liveInfo}
                onIntroDismiss={() => setHoleIntro(false)}
                odds={resolutionPhase === "idle" && !result && !meterPhase && !liveInfo ? odds : null}
                canAct={Boolean(selected) && resolutionPhase === "idle" && !result && !meterPhase && !liveInfo}
                intelLeft={
                  resolutionPhase === "idle" && !result && !meterPhase && !liveInfo ? <ScoreOdds odds={odds} label={swingMode === "full" ? "ONE-SWING MODEL" : "MODEL"} /> : null
                }
                intelRight={
                  resolutionPhase === "idle" && !result && !meterPhase && !liveInfo ? <CaptainRead read={captainRead} /> : null
                }
                kickMeter={
                  meterPhase ? (
                    <KickMeter
                      phase={meterPhase}
                      onTap={tapMeter}
                      judgment={meterPhase === "locked" ? swingFx : null}
                      streak={swingStreak}
                      mods={meterMods}
                    />
                  ) : previewMeterMods ? (
                    <KickMeter phase="preview" power={0} accuracy={0} streak={swingStreak} mods={previewMeterMods} />
                  ) : null
                }
                swingFx={swingFx}
                shake={shakeFx}
                clutch={Boolean(meterPhase) && meterMods.clutch}
                party={selected ? buzzTierOf(selectedState.buzz).pulse : 0}
                partySurge={partySurge}
                kickTier={
                  swingFx
                    ? swingFx.redBet && (swingFx.tier === "pure" || swingFx.tier === "great")
                      ? "fire"
                      : swingFx.tier
                    : null
                }
                soundControl={
                  <button
                    type="button"
                    className={`trip-game-sound-chip${soundOn ? " is-on" : ""}`}
                    onClick={() => setSoundOn((current) => !current)}
                    aria-label={soundOn ? "Mute game sound" : "Unmute game sound"}
                  >
                    {soundOn ? "♪ ON" : "♪ OFF"}
                  </button>
                }
                popCall={
                  livePops && resolutionPhase === "idle" && !result && !meterPhase && !liveInfo ? (
                    <div className={`trip-game-pop-banner is-${livePops.human ? "pop" : livePops.cpu ? "give" : "even"}`}>
                      {livePops.human > 0 ? (
                        <>
                          <i className="trip-game-pop-dot" />
                          <b>YOU GET A POP</b>
                          <span>SI {hole.si} · CH {courseHandicap(selected.hi, course)} vs CH {courseHandicap(cpuOpponent.profile.hi, course)}</span>
                        </>
                      ) : livePops.cpu > 0 ? (
                        <>
                          <b>GIVING A STROKE</b>
                          <span>SI {hole.si} · THEY GET A POP</span>
                        </>
                      ) : (
                        <>
                          <b>NO POP</b>
                          <span>SI {hole.si} · EVEN</span>
                        </>
                      )}
                    </div>
                  ) : null
                }
                onAimStep={stepAim}
                onCycle={cycleDecision}
              />
              {resolutionPhase === "idle" && !result && (
                <div className="trip-game-action-bar">
                  <OpponentCard opponent={cpuOpponent} course={course} team={cpuTeam} />
                  <CaptainWheel
                    players={humanRoster}
                    selectedKey={selectedKey}
                    usage={usage}
                    maxUses={maxUses}
                    disabled={pickLocked || Boolean(meterPhase)}
                    onPick={pickPlayer}
                    course={course}
                    team={captainTeam}
                  />
                  <PopCall pops={livePops} />
                  <button
                    type="button"
                    className={`trip-game-fireball-chip ${decision.fireball ? "is-selected" : ""}`}
                    disabled={!selected || inventory.fireball < 1 || Boolean(meterPhase)}
                    onClick={() => setDecision((current) => ({ ...current, fireball: !current.fireball }))}
                  >
                    🔥 {inventory.fireball}
                  </button>
                  <button
                    type="button"
                    className="trip-game-fireball-chip is-shot"
                    disabled={!selected || Boolean(meterPhase)}
                    onClick={takeFireballShot}
                  >
                    🥃 SHOT
                  </button>
                  {liveInfo && (
                    <button type="button" className="trip-game-skip-chip" onClick={skipLiveHole}>
                      SKIP ▶▶
                    </button>
                  )}
                  <button
                    type="button"
                    className={`trip-game-primary-button ${meterPhase ? "is-kick" : ""} ${livePops?.human ? "has-pop" : ""}`}
                    disabled={!selected}
                    onClick={meterPhase ? tapMeter : playHole}
                  >
                    {meterPhase === "power"
                      ? meterMods.club === "putter"
                        ? "TAP PACE"
                        : "TAP POWER"
                      : meterPhase === "accuracy"
                        ? meterMods.club === "putter"
                          ? "TAP LINE"
                          : "TAP ACCURACY"
                        : meterPhase === "locked"
                          ? swingFx?.label || "..."
                          : liveInfo
                            ? liveRef.current?.feet != null
                              ? "PUTT ▶"
                              : "SWING ▶"
                            : selected
                              ? `PLAY ${lastName(selected.name).toUpperCase()}${livePops?.human ? " ●" : livePops?.cpu ? " GIVE" : ""} ▶`
                              : "PLAY ▶"}
                  </button>
                </div>
              )}
              {resolutionPhase === "liveshot" && liveInfo && (
                <>
                  <button
                    type="button"
                    className={`trip-game-skip-chip is-floating is-fast${fastForward ? " is-on" : ""}`}
                    onClick={toggleFastForward}
                    aria-pressed={fastForward}
                  >
                    FAST {fastForward ? "ON" : "▶▶"}
                  </button>
                  <button type="button" className="trip-game-skip-chip is-floating" onClick={skipLiveHole}>
                    SKIP HOLE ▶▶
                  </button>
                </>
              )}
              {eventNote && resolutionPhase === "idle" && !result && <div className="trip-game-event-note">{eventNote}</div>}
              {resolutionPhase === "playback" && result && !(playbackStep.index === 0 && playbackStep.phase === "swing") && (
                <div className="trip-game-stage-overlay">
                  <PlaybackPanel
                    result={result}
                    shots={playbackShots || []}
                    shotIndex={playbackStep.index}
                    onSkip={finishPlayback}
                  />
                </div>
              )}
              {resolutionPhase === "result" && result && (
                <ScorecardModal
                  course={course}
                  history={history}
                  match={match}
                  result={result}
                  holeNumber={hole.number}
                  humanTeam={captainTeam}
                  cpuTeam={cpuTeam}
                  onContinue={nextHole}
                  finalHole={holeIndex === 17 || Boolean(closeout?.decided)}
                  closeout={closeout}
                />
              )}
            </div>
            <div className="trip-game-bottom-status">
              <span>
                VS{" "}
                {cpuOpponent?.profile
                  ? `${lastName(cpuOpponent.profile.name).toUpperCase()} · CH ${courseHandicap(cpuOpponent.profile.hi, course)}`
                  : "…"}
              </span>
              <span>
                HOLES LEFT {18 - hole.number} · TIES {match.ties}
              </span>
            </div>
          </>
        )}
      </div>
      {eventOffer?.type === "fireball" && (
        <FireballOffer player={eventOffer.player} onAccept={acceptFireball} onDecline={declineFireball} />
      )}
      {eventOffer?.type === "cart-girl" && (
        <CartGirlOffer
          player={eventOffer.player}
          onDrink={() => chooseCartGirl(true)}
          onHydrate={() => chooseCartGirl(false)}
        />
      )}
      {eventOffer?.type === "buy-round" && (
        <BuyRoundOffer opponent={cpuOpponent?.profile} onAccept={acceptBuyRound} onDecline={declineBuyRound} />
      )}
    </section>
  );
}
