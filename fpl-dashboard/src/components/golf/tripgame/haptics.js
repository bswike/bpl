// Vibration feedback that respects the reduce-motion setting.
// Haptics honour the OS reduce-motion setting; a no-op where vibrate is absent.
export function haptic(pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch {
    // decorative only
  }
}
