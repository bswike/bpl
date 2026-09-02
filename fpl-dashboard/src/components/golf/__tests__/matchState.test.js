import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION, HOLE_RESET, INITIAL_MATCH, matchReducer } from "../tripgame/matchState.js";

const started = matchReducer(INITIAL_MATCH, { type: "START_ROUND", playerState: { a: { buzz: 0 } }, roundSalt: 7 });
const row = { hole: 1, winner: "human", human: "A", cpu: "B", humanGross: 4, cpuGross: 5, humanStroke: 0, cpuStroke: 0 };
const committed = matchReducer(
  { ...started, selectedKey: "a", decision: { ...DEFAULT_DECISION, fireball: true }, result: { x: 1 }, resolutionPhase: "playback", playbackShots: [] },
  { type: "COMMIT_HOLE", winner: "human", humanKey: "a", cpuKey: "b", row, hype: 30, streak: 1, closeout: null, fireballUsed: true, powerUpEarned: false },
);

describe("matchReducer", () => {
  it("starts a round on the play screen with everything reset", () => {
    expect(started.screen).toBe("play");
    expect(started.holeIndex).toBe(0);
    expect(started.holeIntro).toBe(true);
    expect(started.playerState).toEqual({ a: { buzz: 0 } });
    expect(started.roundSalt).toBe(7);
    expect(started.inventory).toEqual({ fireball: 1 });
  });
  it("commits a hole in one transition", () => {
    expect(committed.resolutionPhase).toBe("result");
    expect(committed.playbackShots).toBeNull();
    expect(committed.usage).toEqual({ a: 1 });
    expect(committed.cpuUsage).toEqual({ b: 1 });
    expect(committed.match).toEqual({ human: 1, cpu: 0, ties: 0 });
    expect(committed.history).toEqual([row]);
    expect(committed.hype).toBe(30);
    expect(committed.inventory.fireball).toBe(0);
    expect(committed.closeout).toBeNull();
  });
  it("moves to the next hole keeping the round and resetting the hole", () => {
    const next = matchReducer({ ...committed, liveClubId: "iron7", puttAim: 3 }, { type: "NEXT_HOLE" });
    expect(next.holeIndex).toBe(1);
    expect(next.history).toHaveLength(1);
    expect(next.usage).toEqual({ a: 1 });
    for (const [key, value] of Object.entries(HOLE_RESET)) expect(next[key]).toEqual(value);
  });
  it("records a decided closeout and a power-up", () => {
    const decided = matchReducer(committed, {
      type: "COMMIT_HOLE", winner: "cpu", humanKey: "c", cpuKey: "d", row: { ...row, hole: 2, winner: "cpu" }, hype: 5, streak: 0,
      closeout: { decided: true, label: "1 UP" }, fireballUsed: false, powerUpEarned: true,
    });
    expect(decided.closeout).toEqual({ decided: true, label: "1 UP" });
    expect(decided.match).toEqual({ human: 1, cpu: 1, ties: 0 });
    expect(decided.inventory.fireball).toBe(1);
    expect(matchReducer(decided, { type: "FINISH" }).screen).toBe("finish");
  });
  it("resumes from a snapshot on the hole after the last committed one", () => {
    const resumed = matchReducer(INITIAL_MATCH, {
      type: "RESUME",
      snapshot: { holeIndex: 5, usage: { a: 2 }, cpuUsage: { b: 1 }, match: { human: 3, cpu: 2, ties: 0 }, history: [row, row, row, row, row], hype: 44, streak: 2, swingStreak: 1, inventory: { fireball: 2 }, eventHandled: { 3: true }, roundSalt: 99 },
    });
    expect(resumed.screen).toBe("play");
    expect(resumed.holeIndex).toBe(5);
    expect(resumed.match).toEqual({ human: 3, cpu: 2, ties: 0 });
    expect(resumed.swingStreak).toBe(1);
    expect(resumed.selectedKey).toBeNull();
    expect(resumed.holeIntro).toBe(true);
  });
  it("patches a field with a value or an updater", () => {
    const a = matchReducer(started, { type: "PATCH", patch: { puttAim: 2 } });
    const b = matchReducer(a, { type: "PATCH", patch: (state) => ({ puttAim: state.puttAim + 1 }) });
    expect(b.puttAim).toBe(3);
  });
});
