// Render between game updates without restarting interpolation on each React
// render. Game frames remain authoritative for seeking and fast-forwarding.
export function createAnimationClock() {
  let shot = null,
    phase = null,
    started = 0,
    progress = 0,
    released = null;
  return (state, now, { frameMs, swingMs, reduced = false }) => {
    const changedShot = state.shot !== shot;
    if (changedShot || state.phase !== phase) {
      if (changedShot) released = null;
      shot = state.shot;
      phase = state.phase;
      started = now;
      progress = phase === "flight" ? state.frame || 0 : 0;
      if (phase === "flight") released = now - progress * frameMs;
    }
    const elapsed = Math.max(0, now - started);
    const last = Math.max(0, (shot?.frames?.length || 1) - 1);
    if (phase === "flight") {
      progress = Math.min(
        last,
        Math.max(
          progress,
          state.frame || 0,
          reduced ? 0 : (now - released) / frameMs,
        ),
      );
    } else if (phase === "settle") progress = last;
    const poseTime = !shot
      ? 0
      : phase === "swing"
        ? Math.min(1, elapsed / swingMs)
        : released !== null
          ? Math.min(2.25, 1 + (now - released) / swingMs)
          : phase === "settle"
            ? 2.25
            : 0;
    return {
      progress,
      poseTime: reduced ? (poseTime >= 1 ? 2.25 : 0) : poseTime,
      elapsed,
    };
  };
}
