// Small text formatters for the game UI.

import { AIM_MAX } from "./constants.js";
import { aimOffsetOf } from "../tripGameEngine.js";
export function aimText(aim) {
  const offset = aimOffsetOf(aim);
  const yards = Math.round((offset / AIM_MAX) * 25);
  if (yards === 0) return "CENTER";
  return `${Math.abs(yards)}Y ${yards < 0 ? "LEFT" : "RIGHT"}`;
}

export function lastName(name) {
  return String(name || "").trim().split(/\s+/).at(-1) || name;
}

export function signedPercent(value) {
  const points = Math.round((Number(value) || 0) * 100);
  return `${points > 0 ? "+" : ""}${points}%`;
}

export function celebrationFor(result) {
  if (result.humanBucket.id === "birdie") return { label: "BIRDIE BLAST!", icon: "★", tone: "birdie" };
  if (result.winner === "human" && result.humanBucket.id === "par") return { label: "CLUTCH PAR!", icon: "!", tone: "win" };
  if (result.winner === "human") return { label: "HOLE STOLEN!", icon: "▲", tone: "win" };
  if (result.winner === "tie") return { label: "CLUTCH HALF!", icon: "=", tone: "tie" };
  if (result.humanBucket.id === "triple") return { label: "BLOW-UP HOLE!", icon: "×", tone: "bust" };
  return { label: "CPU STRIKES!", icon: "▼", tone: "loss" };
}

export function scoreMark(gross, par) {
  if (gross == null || !Number.isFinite(gross)) return "empty";
  const rel = gross - par;
  if (rel <= -2) return "eagle";
  if (rel === -1) return "birdie";
  if (rel === 0) return "par";
  if (rel === 1) return "bogey";
  return "blow";
}
