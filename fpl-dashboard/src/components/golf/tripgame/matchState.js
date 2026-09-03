// Match and hole state for the trip game as one reducer: a new round, a
// resumed round and the next hole each reset the same fields in one place,
// and committing a hole is one transition instead of eight setters.
import { clamp } from "./geometry.js";

export const DEFAULT_DECISION = Object.freeze({ club: "driver", aim: 0, shape: "straight", fireball: false });

/** Everything that starts fresh on every hole. */
export const HOLE_RESET = Object.freeze({
  selectedKey: null,
  decision: DEFAULT_DECISION,
  result: null,
  resolutionPhase: "idle",
  playbackShots: null,
  playbackStep: { index: 0, phase: "swing", frame: 0 },
  holeIntro: true,
  eventOffer: null,
  pickLocked: false,
  eventNote: null,
  cpuOpponent: null,
  liveInfo: null,
  liveClubId: null,
  puttAim: 0,
  spin: "none",
  powerArmed: false,
});

/** Everything that starts fresh on a new round. */
export const ROUND_RESET = Object.freeze({
  holeIndex: 0,
  usage: {},
  cpuUsage: {},
  playerState: {},
  match: { human: 0, cpu: 0, ties: 0 },
  history: [],
  closeout: null,
  hype: 0,
  streak: 0,
  swingStreak: 0,
  inventory: { fireball: 1 },
  eventHandled: {},
  roundSalt: 0,
  powerShots: 3,
  seed: 0,
});

export const INITIAL_MATCH = Object.freeze({ screen: "setup", ...ROUND_RESET, ...HOLE_RESET, holeIntro: false });

export function matchReducer(state, action) {
  switch (action.type) {
    case "START_ROUND":
      return {
        ...state,
        ...ROUND_RESET,
        ...HOLE_RESET,
        screen: "play",
        playerState: action.playerState || {},
        roundSalt: Number(action.roundSalt) || 0,
        seed: Number(action.seed) || 0,
      };
    case "RESUME": {
      const snapshot = action.snapshot || {};
      return {
        ...state,
        ...ROUND_RESET,
        ...HOLE_RESET,
        screen: "play",
        holeIndex: clamp(Number(snapshot.holeIndex) || 0, 0, 17),
        usage: snapshot.usage || {},
        cpuUsage: snapshot.cpuUsage || {},
        playerState: snapshot.playerState || action.playerState || {},
        match: snapshot.match || ROUND_RESET.match,
        history: Array.isArray(snapshot.history) ? snapshot.history : [],
        hype: Number(snapshot.hype) || 0,
        streak: Number(snapshot.streak) || 0,
        swingStreak: Number(snapshot.swingStreak) || 0,
        inventory: snapshot.inventory || ROUND_RESET.inventory,
        eventHandled: snapshot.eventHandled || {},
        roundSalt: Number(snapshot.roundSalt) || 0,
        powerShots: Number.isFinite(Number(snapshot.powerShots)) ? Number(snapshot.powerShots) : 3,
        seed: Number(snapshot.seed) || 0,
      };
    }
    case "NEXT_HOLE":
      return { ...state, ...HOLE_RESET, holeIndex: state.holeIndex + 1 };
    case "FINISH":
      return { ...state, screen: "finish" };
    case "SETUP":
      return { ...state, screen: "setup" };
    case "STAGE_RESULT":
      return {
        ...state,
        result: action.result,
        playbackShots: action.shots,
        playbackStep: { index: 0, phase: "swing", frame: 0 },
        resolutionPhase: "playback",
      };
    case "COMMIT_HOLE": {
      const { winner, humanKey, cpuKey, row, hype, streak, closeout, fireballUsed, powerUpEarned } = action;
      return {
        ...state,
        resolutionPhase: "result",
        playbackShots: null,
        usage: { ...state.usage, [humanKey]: (state.usage[humanKey] || 0) + 1 },
        cpuUsage: { ...state.cpuUsage, [cpuKey]: (state.cpuUsage[cpuKey] || 0) + 1 },
        match: {
          human: state.match.human + (winner === "human" ? 1 : 0),
          cpu: state.match.cpu + (winner === "cpu" ? 1 : 0),
          ties: state.match.ties + (winner === "tie" ? 1 : 0),
        },
        history: [...state.history, row],
        hype,
        streak,
        closeout: closeout || state.closeout,
        inventory: {
          ...state.inventory,
          fireball: Math.max(0, state.inventory.fireball - (fireballUsed ? 1 : 0)) + (powerUpEarned ? 1 : 0),
        },
      };
    }
    case "PATCH":
      return { ...state, ...(typeof action.patch === "function" ? action.patch(state) : action.patch) };
    default:
      return state;
  }
}
