// Match rules and tuning constants shared across the trip game.
export const FIREBALL_HOLES = new Set([4, 8, 12, 16]);

export const CART_GIRL_HOLES = new Set([6, 14]);

export const PLAYBACK_SAFETY_MS = 28000;

export const DEFAULT_PLAYER_STATE = Object.freeze({ buzz: 0, morale: 50 });

export const MATCH_SAVE_KEY = "tripGameMatch.v1";

export const AIM_STEP = 0.155;

export const AIM_MAX = 0.93;
