// One physics for every ball on the hole. The human's metered strokes, the
// CPU's sampled swings and the skip-hole autopilot all resolve through
// simulateStroke, so both sides face the same water, trees, sand and greens.
import { defaultLiveClub } from "./clubs.js";
import { clamp } from "./geometry.js";
import { ACC_GOOD, judgeSwing, meterZoneFor } from "./meter.js";
import { forLabelOf, makePuttRead, resolveLivePutt } from "./putting.js";
import { carryProfile, powerForCarry, resolveLiveStroke } from "./shotPhysics.js";
import { windEffect } from "./wind.js";
import { makeShot } from "./shotTheater.js";
import { aimOffsetOf, skillOf } from "../tripGameEngine.js";

// How a CPU golfer taps the meter. Full swings are sampled in oval units
// (1 = the edge of the GOOD zone, which resolveLiveStroke maps to the edge of
// the golfer's dispersion oval), so the handicap pattern carries the skill
// difference and the meter's difficulty scaling does not double-count it.
// Putts get an aim error that grows with distance, as real make rates do.
export const CPU_TUNING = {
  lineSpread: 0.58, // sigma in oval units, scratch
  lineSpreadPerSkill: 0.32,
  depthSpread: 0.85, // sigma in depth units (1 = 0.09 of power)
  depthSpreadPerSkill: 0.4,
  wildChance: 0.006,
  wildChancePerSkill: 0.035,
  puttAimTicks: 1.3, // sigma in ticks for an 8-footer, scratch
  puttAimPerSkill: 0.6,
  puttAimDistancePower: 1.35,
  puttPace: 0.22, // sigma as a fraction of the pace band width, 12-footer, scratch
  puttPacePerSkill: 0.3,
  puttLine: 0.04,
  puttLinePerSkill: 0.1,
};

export function createBall(projection) {
  return {
    pos: projection.tee,
    lie: "Tee",
    strokes: 0,
    feet: null,
    puttCount: 0,
    sceneCarry: null,
    holed: false,
    club: null,
    puttRead: null,
    aimTicks: null,
    teeLanding: null,
    remainingUnits: Math.hypot(projection.pin[0] - projection.tee[0], projection.pin[1] - projection.tee[1]),
  };
}

/** A side is done when it holes out or picks up at par + 4. */
export function ballDone(ball, hole) {
  return Boolean(ball.holed) || ball.strokes >= hole.par + 4;
}

export function ballGross(ball, hole) {
  return clamp(ball.holed ? ball.strokes : hole.par + 4, 1, hole.par + 4);
}

/**
 * Plays one stroke for `ball` and returns the next ball state, the raw
 * physics result and a shot ready for the theater. Pure: no React, no sound.
 */
export function simulateStroke({
  projection,
  hole,
  ball,
  meter,
  judgment,
  clubId,
  side = "human",
  yardsScale,
  hi = 12,
  carryBoost = 1,
  drunk = false,
  zoneScale = 1,
  aimUnits = 0,
  lineTarget = null,
  fireball = false,
  rng = null,
  seedSalt = 0,
  wind = null,
  spin = "none",
}) {
  const from = ball.pos;
  if (ball.feet != null) {
    const read = ball.puttRead || makePuttRead({ hole, puttCount: ball.puttCount, feet: ball.feet, sceneCarry: ball.sceneCarry });
    const aimTicks = ball.aimTicks ?? Math.round(read.requiredTicks);
    const result = resolveLivePutt({ read, aimTicks, meter, puttCount: ball.puttCount });
    const strokes = ball.strokes + 1;
    const end = result.made
      ? [85, 36]
      : [
          85 + result.missSide * (2.5 + Math.min(5, Math.abs(result.lineErr) * 2.2)),
          36 + clamp(result.leaveFeet * 2.5, 3.5, 44),
        ];
    const feet = result.made ? null : Math.max(1, Math.round(result.leaveFeet));
    const next = {
      ...ball,
      strokes,
      puttCount: ball.puttCount + 1,
      sceneCarry: result.made ? null : end,
      puttRead: null,
      aimTicks: null,
      holed: ball.holed || result.made,
      feet,
      remainingUnits: result.made ? 0 : (feet / 3) * yardsScale,
    };
    const shot = {
      ...makeShot({
        from,
        to: result.made ? projection.pin : from,
        kind: "putt",
        final: result.made,
        yardsScale,
        caption: result.lip ? "LIPS OUT!" : null,
      }),
      putt: { ...read, start: read.start, end, aimTicks, for: forLabelOf(strokes - hole.par) },
      lip: result.lip,
      side,
      kickPower: meter.power,
      shotNumber: strokes,
    };
    return { ball: next, shot, result, putt: true };
  }
  const res = resolveLiveStroke({
    projection,
    hole,
    from,
    lie: ball.lie,
    meter,
    judgment,
    clubId,
    carryBoost,
    drunk,
    yardsScale,
    lineTarget,
    aimUnits,
    fireball,
    rng,
    hi,
    zoneScale,
    seedSalt,
    wind,
    spin,
  });
  const teeLanding =
    ball.strokes === 0
      ? {
          point: res.to,
          type:
            res.kind === "ob" || res.kind === "splash"
              ? "Penalty area"
              : res.nextLie === "Bunker" || res.nextLie === "Rough"
                ? res.nextLie
                : "Fairway",
        }
      : ball.teeLanding;
  const pos = res.nextPos || res.to;
  const next = {
    ...ball,
    strokes: ball.strokes + 1 + (res.penalty || 0),
    pos,
    lie: res.nextLie || ball.lie,
    holed: ball.holed || Boolean(res.holed),
    teeLanding,
    club: clubId,
    remainingUnits: res.holed ? 0 : Math.hypot(projection.pin[0] - pos[0], projection.pin[1] - pos[1]),
  };
  if (res.feet != null) {
    next.feet = res.feet;
    next.puttCount = 0;
    next.sceneCarry = null;
  }
  const shot = {
    ...makeShot({
      from,
      to: res.to,
      carryTo: res.carryTo || null,
      kind: res.kind,
      final: Boolean(res.holed),
      bend: res.bend ?? 0,
      yardsScale,
      caption: res.caption,
      ground: res.ground,
    }),
    side,
    kickPower: meter.power,
    shotNumber: next.strokes,
    terrible: judgment.tier === "wild",
  };
  return { ball: next, shot, result: res, putt: false, fromYards: Math.round(ball.remainingUnits / (yardsScale || 1)) };
}

// Skill deficit on a curve: mid handicaps miss more than a straight line
// through the scratch and 24+ ends would give them (calibrated on Crystal
// Springs: scratch ~76, a 10 ~85, a 20 ~98).
function cpuMiss(hi) {
  return Math.pow(1 - skillOf(hi), 0.7);
}

// Box-Muller on the game's seeded rng.
function gaussian(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A CPU golfer's two taps: tighter with skill, with the odd wild one. */
export function cpuMeterSample({ hi, rng, putt = false, paceBand = null, feet = 10, zoneScale = 1, powerCenter = 0.87 }) {
  const miss = cpuMiss(hi);
  const t = CPU_TUNING;
  if (putt) {
    const center = paceBand ? (paceBand.min + paceBand.max) / 2 : 0.6;
    const width = paceBand ? paceBand.max - paceBand.min : 0.15;
    const reach = clamp(Math.sqrt(Math.max(1, feet) / 12), 0.5, 2.5);
    return {
      power: clamp(center + gaussian(rng) * width * (t.puttPace + t.puttPacePerSkill * miss) * reach, 0.2, 1.08),
      accuracy: clamp(gaussian(rng) * (t.puttLine + t.puttLinePerSkill * miss), -1, 1),
    };
  }
  if (rng() < t.wildChance + t.wildChancePerSkill * miss) {
    return {
      power: clamp(powerCenter + gaussian(rng) * 0.08, 0.5, 1.12),
      accuracy: (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.3),
    };
  }
  return {
    power: clamp(powerCenter + gaussian(rng) * 0.09 * (t.depthSpread + t.depthSpreadPerSkill * miss), 0.55, 1.1),
    accuracy: clamp(gaussian(rng) * ACC_GOOD * zoneScale * (t.lineSpread + t.lineSpreadPerSkill * miss), -1, 1),
  };
}

/** Where a CPU golfer aims a putt, in cup-width ticks: the read plus a skill- and distance-sized error. */
export function cpuPuttAim(read, hi, rng) {
  const miss = cpuMiss(hi);
  const t = CPU_TUNING;
  const sigma = t.puttAimTicks * (1 + t.puttAimPerSkill * miss) * Math.pow(Math.max(1, read.feet) / 8, t.puttAimDistancePower);
  return Math.round(read.requiredTicks + gaussian(rng) * sigma);
}

/**
 * One CPU stroke through the shared physics. `cpu` carries the ball plus the
 * golfer's handicap, buzz, tee decision and planned tee target.
 */
export function simulateCpuStroke({ projection, hole, cpu, yardsScale, rng, seedSalt = 0, wind = null }) {
  const ball = { ...cpu.ball };
  if (ball.feet != null) {
    const read = makePuttRead({ hole, puttCount: ball.puttCount, feet: ball.feet, sceneCarry: ball.sceneCarry });
    ball.puttRead = read;
    ball.aimTicks = cpuPuttAim(read, cpu.hi, rng);
    const zoneScale = meterZoneFor({ clubId: "putter", lie: "Green", hi: cpu.hi, buzz: cpu.buzz });
    const meter = cpuMeterSample({ hi: cpu.hi, rng, putt: true, paceBand: read.paceBand, feet: ball.feet, zoneScale });
    const judgment = judgeSwing(meter.power, meter.accuracy, { zoneScale, paceBand: read.paceBand });
    return simulateStroke({ projection, hole, ball, meter, judgment, clubId: "putter", side: "cpu", yardsScale, hi: cpu.hi, zoneScale, rng, seedSalt });
  }
  const remaining = ball.remainingUnits / (yardsScale || 1);
  const carryBoost = cpu.decision.carryBoost || 1;
  // Better players hold greens with backspin on approaches; everyone else just hits it.
  const spin = ball.strokes > 0 && ball.lie !== "Bunker" && skillOf(cpu.hi) > 0.55 && remaining <= 200 ? "back" : "none";
  // Play the wind: the carry the shot needs is the distance divided by what
  // the wind gives or takes along the way.
  const toPin = [projection.pin[0] - ball.pos[0], projection.pin[1] - ball.pos[1]];
  const toPinLength = Math.hypot(toPin[0], toPin[1]) || 1;
  const windMult = wind && wind.mph ? windEffect(wind, [toPin[0] / toPinLength, toPin[1] / toPinLength], Math.max(60, remaining)).carryMult : 1;
  const needed = remaining / windMult;
  // Club from the distance this golfer actually hits it, then swing only as
  // hard as the shot needs: a 60-yard bunker shot is not a full sand wedge.
  const teeClub = hole.par <= 3 ? defaultLiveClub((hole.yards || remaining) / (carryBoost * windMult), "Fairway") : cpu.decision.club;
  const clubId =
    ball.strokes === 0
      ? teeClub
      : defaultLiveClub(needed / (carryBoost * (spin === "back" ? 0.97 : 1) * (ball.lie === "Rough" ? 0.88 : ball.lie === "Bunker" ? 0.8 : 1)), ball.lie);
  const profile = carryProfile({ clubId, lie: ball.lie, carryBoost, fireball: Boolean(cpu.decision.fireball), spin, hi: cpu.hi });
  const fullSend = ball.strokes === 0 && hole.par > 3;
  const powerCenter = fullSend ? 0.87 : powerForCarry(profile, needed);
  const zoneScale = meterZoneFor({ clubId, lie: ball.lie, hi: cpu.hi, buzz: cpu.buzz });
  const meter = cpuMeterSample({ hi: cpu.hi, rng, zoneScale, powerCenter });
  const judgment = judgeSwing(meter.power, meter.accuracy, { zoneScale });
  return simulateStroke({
    projection,
    hole,
    ball,
    meter,
    judgment,
    clubId,
    side: "cpu",
    yardsScale,
    hi: cpu.hi,
    carryBoost,
    zoneScale,
    lineTarget: ball.strokes === 0 && hole.par > 3 ? cpu.teeTarget : null,
    aimUnits: ball.strokes === 0 && hole.par <= 3 ? aimOffsetOf(cpu.decision.aim) * clamp(projection.width * 0.12, 10, 22) : 0,
    fireball: Boolean(cpu.decision.fireball),
    rng,
    seedSalt,
    wind,
    spin,
  });
}
