// Tiny WebAudio synth for the swing meter. No asset files — every cue is
// generated. All calls are safe before unlock and silently no-op when the
// browser blocks audio or sound is toggled off.

let ctx = null;
let enabled = true;
let sweep = null;
let noiseBuffer = null;

function audio() {
  if (!enabled || typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx.state === "closed" ? null : ctx;
  } catch {
    return null;
  }
}

export function setMeterAudioEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopPowerSweep();
}

// Call from a user gesture so the context is allowed to start.
export function unlockMeterAudio() {
  audio();
}

function tone({ freq, type = "square", at = 0, duration = 0.08, peak = 0.06, glideTo = null, attack = 0.004 }) {
  const ac = audio();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  } catch {
    // decorative only
  }
}

function noise({ at = 0, duration = 0.1, peak = 0.08, filterFrom = 2600, filterTo = 400, type = "lowpass", attack = 0.003 }) {
  const ac = audio();
  if (!ac) return;
  try {
    if (!noiseBuffer) {
      noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime + at;
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = noiseBuffer;
    src.loop = true;
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterTo), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.03);
  } catch {
    // decorative only
  }
}

// Rising engine hum while the power bar charges.
export function startPowerSweep() {
  const ac = audio();
  if (!ac || sweep) return;
  try {
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 52;
    filter.type = "lowpass";
    filter.frequency.value = 240;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.028, ac.currentTime + 0.08);
    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start();
    sweep = { osc, filter, gain };
  } catch {
    sweep = null;
  }
}

export function updatePowerSweep(pct) {
  if (!sweep || !ctx) return;
  try {
    const clamped = Math.min(1, Math.max(0, pct));
    sweep.osc.frequency.setTargetAtTime(52 + clamped * 150, ctx.currentTime, 0.02);
    sweep.filter.frequency.setTargetAtTime(240 + clamped * 2700, ctx.currentTime, 0.02);
  } catch {
    // decorative only
  }
}

export function stopPowerSweep() {
  if (!sweep || !ctx) {
    sweep = null;
    return;
  }
  try {
    const t0 = ctx.currentTime;
    sweep.gain.gain.setTargetAtTime(0.0001, t0, 0.03);
    sweep.osc.stop(t0 + 0.15);
  } catch {
    // decorative only
  }
  sweep = null;
}

// Slow lub-dub heartbeat for clutch shots — the match is on the line.
let heartbeat = null;

export function startHeartbeat() {
  if (heartbeat || typeof window === "undefined") return;
  const thump = () => {
    tone({ freq: 58, type: "sine", duration: 0.14, peak: 0.09, attack: 0.01 });
    tone({ freq: 52, type: "sine", at: 0.22, duration: 0.12, peak: 0.07, attack: 0.01 });
  };
  thump();
  heartbeat = window.setInterval(thump, 950);
}

export function stopHeartbeat() {
  if (heartbeat && typeof window !== "undefined") window.clearInterval(heartbeat);
  heartbeat = null;
}

// Danger sting when power locks inside the red band — the bet is placed.
export function riskArmedSound() {
  tone({ freq: 196, type: "sawtooth", duration: 0.12, peak: 0.055 });
  tone({ freq: 233.08, type: "sawtooth", at: 0.1, duration: 0.16, peak: 0.05 });
}

// Geiger-style tick when the needle or bar crosses into a scoring zone.
export function zoneTick(kind) {
  if (kind === "pure") tone({ freq: 1560, duration: 0.045, peak: 0.05 });
  else if (kind === "warn") tone({ freq: 210, type: "sawtooth", duration: 0.09, peak: 0.05 });
  else tone({ freq: 990, duration: 0.04, peak: 0.035 });
}

export function lockPowerSound(overswung) {
  tone({ freq: overswung ? 480 : 620, type: "triangle", duration: 0.07, peak: 0.07 });
  tone({ freq: 140, type: "sine", duration: 0.1, peak: 0.06 });
}

// The tier payoff at the accuracy tap. PURE gets a signature chord no other
// event in the game reuses — and each consecutive pure-streak step transposes
// it up a whole tone (capped), so a hot streak literally climbs the scale.
export function swingJudgmentSound(tier, streakStep = 0) {
  if (tier === "pure") {
    const lift = Math.pow(2, (Math.min(6, Math.max(0, streakStep)) * 2) / 12);
    noise({ duration: 0.06, peak: 0.07, filterFrom: 5200, filterTo: 1200 });
    tone({ freq: 523.25 * lift, type: "triangle", duration: 0.4, peak: 0.07 });
    tone({ freq: 659.25 * lift, type: "triangle", at: 0.02, duration: 0.4, peak: 0.06 });
    tone({ freq: 783.99 * lift, type: "triangle", at: 0.04, duration: 0.42, peak: 0.06 });
    tone({ freq: 1567.98 * lift, at: 0.09, duration: 0.14, peak: 0.04 });
    tone({ freq: 2093 * lift, at: 0.16, duration: 0.16, peak: 0.03 });
    return;
  }
  if (tier === "great") {
    tone({ freq: 760, duration: 0.07, peak: 0.06 });
    tone({ freq: 1140, at: 0.05, duration: 0.09, peak: 0.05 });
    return;
  }
  if (tier === "good") {
    tone({ freq: 320, type: "triangle", duration: 0.1, peak: 0.06 });
    noise({ duration: 0.07, peak: 0.04, filterFrom: 900, filterTo: 250 });
    return;
  }
  // wild — a sad downward womp
  tone({ freq: 250, type: "sawtooth", duration: 0.22, peak: 0.06, glideTo: 105 });
}

// Rising note that never resolves — the slot-machine near-miss cue, played
// only when the tap just barely missed the PURE sliver.
export function nearMissSound() {
  tone({ freq: 620, type: "triangle", at: 0.18, duration: 0.2, peak: 0.05, glideTo: 930 });
}

// Low crowd murmur that swells while a flushed drive hangs in the air.
export function crowdSwell(intensity = 0.6) {
  noise({
    duration: 1.15,
    peak: 0.028 + intensity * 0.03,
    filterFrom: 480,
    filterTo: 1400,
    type: "bandpass",
    attack: 0.55,
  });
}

// Crowd roar + chime arpeggio when the ball drops in the hole.
export function holeoutSound() {
  tone({ freq: 987.77, type: "triangle", duration: 0.12, peak: 0.05 });
  tone({ freq: 1318.51, type: "triangle", at: 0.09, duration: 0.14, peak: 0.05 });
  tone({ freq: 1975.53, type: "triangle", at: 0.18, duration: 0.24, peak: 0.05 });
  noise({ at: 0.12, duration: 0.9, peak: 0.05, filterFrom: 600, filterTo: 1600, type: "bandpass", attack: 0.12 });
}

// Kerplunk for a ball finding the water.
export function splashSound() {
  tone({ freq: 300, type: "sine", duration: 0.25, peak: 0.06, glideTo: 90 });
  noise({ at: 0.03, duration: 0.4, peak: 0.06, filterFrom: 1800, filterTo: 260 });
}

// Short gallery cheer when the captain's side takes the hole.
export function holeWinSound() {
  noise({ duration: 0.7, peak: 0.05, filterFrom: 700, filterTo: 1500, type: "bandpass", attack: 0.06 });
  tone({ freq: 659.25, type: "triangle", at: 0.05, duration: 0.12, peak: 0.045 });
  tone({ freq: 880, type: "triangle", at: 0.15, duration: 0.18, peak: 0.045 });
}

// Casino-odometer clicks while the yardage counter rolls, and a payoff note
// when it lands — brighter the longer the drive.
export function yardRollTick() {
  tone({ freq: 720, duration: 0.02, peak: 0.018 });
}

export function yardRollFinal(tier) {
  if (tier === "bomb") {
    tone({ freq: 880, type: "triangle", duration: 0.16, peak: 0.06 });
    tone({ freq: 1318.5, type: "triangle", at: 0.07, duration: 0.2, peak: 0.05 });
    tone({ freq: 1760, at: 0.14, duration: 0.2, peak: 0.04 });
    return;
  }
  if (tier === "hot") {
    tone({ freq: 830, type: "triangle", duration: 0.12, peak: 0.05 });
    tone({ freq: 1245, at: 0.06, duration: 0.14, peak: 0.04 });
    return;
  }
  if (tier === "long") {
    tone({ freq: 740, type: "triangle", duration: 0.12, peak: 0.05 });
    return;
  }
  tone({ freq: 520, type: "triangle", duration: 0.1, peak: 0.04 });
}

// Club-on-ball crack when the swing animation connects.
export function contactSound({ power = 0.9, putt = false, pure = false }) {
  if (putt) {
    tone({ freq: 1250, duration: 0.03, peak: 0.03 });
    return;
  }
  const punch = Math.min(1.15, Math.max(0.3, power));
  noise({ duration: 0.09, peak: 0.05 + punch * 0.06, filterFrom: 3600, filterTo: 500 });
  tone({ freq: 170, type: "sine", duration: 0.09, peak: 0.05 + punch * 0.04 });
  if (pure) tone({ freq: 1980, at: 0.01, duration: 0.06, peak: 0.04 });
}
