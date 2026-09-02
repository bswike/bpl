// One name for "where are we in the hole", derived from the pieces of state
// the game keeps (screen, meter, resolution, live ball), so the keyboard
// handler and the action button read a phase instead of nested conditions.
export const PHASE = Object.freeze({
  SETUP: "setup",
  PLAN: "plan",
  EVENT: "event",
  HUMAN_READY: "human-ready",
  METER_POWER: "meter-power",
  METER_ACCURACY: "meter-accuracy",
  METER_LOCKED: "meter-locked",
  SHOT: "shot",
  CPU_SHOT: "cpu-shot",
  PLAYBACK: "playback",
  RESULT: "result",
  FINISHED: "finished",
});

export function phaseOf({ screen, meterPhase, resolutionPhase, result, eventOffer, live, activeSide }) {
  if (screen === "setup") return PHASE.SETUP;
  if (screen === "finish") return PHASE.FINISHED;
  if (meterPhase === "power") return PHASE.METER_POWER;
  if (meterPhase === "accuracy") return PHASE.METER_ACCURACY;
  if (meterPhase === "locked") return PHASE.METER_LOCKED;
  if (resolutionPhase === "result" && result) return PHASE.RESULT;
  if (resolutionPhase === "playback") return PHASE.PLAYBACK;
  if (resolutionPhase === "liveshot") return activeSide === "cpu" ? PHASE.CPU_SHOT : PHASE.SHOT;
  if (eventOffer) return PHASE.EVENT;
  if (live) return PHASE.HUMAN_READY;
  return PHASE.PLAN;
}

export const METER_PHASES = new Set([PHASE.METER_POWER, PHASE.METER_ACCURACY, PHASE.METER_LOCKED]);

/** The big button's label for a phase. */
export function primaryLabel({ phase, putter = false, judgmentLabel = null, awaitingPutt = false, selectedName = null, pops = null }) {
  if (phase === PHASE.METER_POWER) return putter ? "TAP PACE" : "TAP POWER";
  if (phase === PHASE.METER_ACCURACY) return putter ? "TAP LINE" : "TAP ACCURACY";
  if (phase === PHASE.METER_LOCKED) return judgmentLabel || "...";
  if (phase === PHASE.HUMAN_READY) return awaitingPutt ? "PUTT ▶" : "SWING ▶";
  if (!selectedName) return "PLAY ▶";
  return `PLAY ${selectedName}${pops?.human ? " ●" : pops?.cpu ? " GIVE" : ""} ▶`;
}
