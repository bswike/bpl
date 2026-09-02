import { describe, expect, it } from "vitest";
import { PHASE, phaseOf, primaryLabel } from "../tripgame/phase.js";

const base = { screen: "play", meterPhase: null, resolutionPhase: "idle", result: null, eventOffer: null, live: null, activeSide: null };

describe("phaseOf", () => {
  it("names each stage of a hole", () => {
    expect(phaseOf({ ...base, screen: "setup" })).toBe(PHASE.SETUP);
    expect(phaseOf(base)).toBe(PHASE.PLAN);
    expect(phaseOf({ ...base, eventOffer: { type: "fireball" } })).toBe(PHASE.EVENT);
    expect(phaseOf({ ...base, live: {} })).toBe(PHASE.HUMAN_READY);
    expect(phaseOf({ ...base, meterPhase: "power" })).toBe(PHASE.METER_POWER);
    expect(phaseOf({ ...base, meterPhase: "accuracy", live: {} })).toBe(PHASE.METER_ACCURACY);
    expect(phaseOf({ ...base, meterPhase: "locked" })).toBe(PHASE.METER_LOCKED);
    expect(phaseOf({ ...base, resolutionPhase: "liveshot", live: {}, activeSide: "human" })).toBe(PHASE.SHOT);
    expect(phaseOf({ ...base, resolutionPhase: "liveshot", live: {}, activeSide: "cpu" })).toBe(PHASE.CPU_SHOT);
    expect(phaseOf({ ...base, resolutionPhase: "playback", result: {} })).toBe(PHASE.PLAYBACK);
    expect(phaseOf({ ...base, resolutionPhase: "result", result: {} })).toBe(PHASE.RESULT);
    expect(phaseOf({ ...base, screen: "finish" })).toBe(PHASE.FINISHED);
  });
  it("lets the meter win over everything else while it runs", () => {
    expect(phaseOf({ ...base, meterPhase: "power", eventOffer: {}, live: {} })).toBe(PHASE.METER_POWER);
  });
});

describe("primaryLabel", () => {
  it("reads the phase", () => {
    expect(primaryLabel({ phase: PHASE.METER_POWER, putter: true })).toBe("TAP PACE");
    expect(primaryLabel({ phase: PHASE.METER_ACCURACY })).toBe("TAP ACCURACY");
    expect(primaryLabel({ phase: PHASE.METER_LOCKED, judgmentLabel: "PURE!" })).toBe("PURE!");
    expect(primaryLabel({ phase: PHASE.HUMAN_READY, awaitingPutt: true })).toBe("PUTT ▶");
    expect(primaryLabel({ phase: PHASE.PLAN, selectedName: "KENNEDY", pops: { human: 1 } })).toBe("PLAY KENNEDY ● ▶");
    expect(primaryLabel({ phase: PHASE.PLAN, selectedName: "KENNEDY", pops: { cpu: 1 } })).toBe("PLAY KENNEDY GIVE ▶");
    expect(primaryLabel({ phase: PHASE.PLAN })).toBe("PLAY ▶");
  });
});
