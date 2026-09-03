// The trophy case: the numbers golfers brag about at the bar, kept across
// rounds in localStorage. Pure functions here; the component loads and saves.
export const RECORDS_KEY = "tripGameRecords.v1";

export const EMPTY_RECORDS = Object.freeze({
  v: 1,
  longestDrive: null, // { yards, player, course, hole }
  closestApproach: null, // { feet, player, course, hole, fromYards }
  longestPutt: null, // { feet, player, course, hole }
  bestStreak: null, // { count, player }
  biggestWin: null, // { label, margin, course, team }
  aces: 0,
  eagles: 0,
  holesOut: 0,
  rounds: 0,
});

export function loadRecords(storage) {
  try {
    const raw = storage?.getItem(RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.v === 1 ? { ...EMPTY_RECORDS, ...parsed } : { ...EMPTY_RECORDS };
  } catch {
    return { ...EMPTY_RECORDS };
  }
}

export function saveRecords(storage, records) {
  try {
    storage?.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // best effort
  }
}

/**
 * Applies one event and reports whether it set a record. Events:
 *  { type: "drive", yards, player, course, hole }
 *  { type: "approach", feet, fromYards, player, course, hole }
 *  { type: "putt", feet, player, course, hole }
 *  { type: "streak", count, player }
 *  { type: "holeOut", ace: boolean, eagle: boolean }
 *  { type: "win", label, margin, course, team }
 *  { type: "round" }
 */
export function noteRecord(records, event) {
  const next = { ...records };
  let record = null;
  switch (event.type) {
    case "drive":
      if (event.yards >= 200 && (!next.longestDrive || event.yards > next.longestDrive.yards)) {
        next.longestDrive = { yards: event.yards, player: event.player, course: event.course, hole: event.hole };
        record = { kind: "longestDrive", label: `LONGEST DRIVE · ${event.yards}Y` };
      }
      break;
    case "approach":
      if (event.fromYards >= 40 && (!next.closestApproach || event.feet < next.closestApproach.feet)) {
        next.closestApproach = { feet: event.feet, fromYards: event.fromYards, player: event.player, course: event.course, hole: event.hole };
        record = { kind: "closestApproach", label: `CLOSEST APPROACH · ${event.feet} FT` };
      }
      break;
    case "putt":
      if (event.feet >= 6 && (!next.longestPutt || event.feet > next.longestPutt.feet)) {
        next.longestPutt = { feet: event.feet, player: event.player, course: event.course, hole: event.hole };
        record = { kind: "longestPutt", label: `LONGEST PUTT · ${event.feet} FT` };
      }
      break;
    case "streak":
      if (event.count >= 3 && (!next.bestStreak || event.count > next.bestStreak.count)) {
        next.bestStreak = { count: event.count, player: event.player };
        record = { kind: "bestStreak", label: `STRIPING STREAK · ${event.count}` };
      }
      break;
    case "holeOut":
      if (event.ace) {
        next.aces += 1;
        record = { kind: "ace", label: `ACE #${next.aces}` };
      } else if (event.eagle) {
        next.eagles += 1;
        record = { kind: "eagle", label: `EAGLE #${next.eagles}` };
      } else {
        next.holesOut += 1;
      }
      break;
    case "win":
      if (!next.biggestWin || event.margin > next.biggestWin.margin) {
        next.biggestWin = { label: event.label, margin: event.margin, course: event.course, team: event.team };
        record = { kind: "biggestWin", label: `BIGGEST WIN · ${event.label}` };
      }
      break;
    case "round":
      next.rounds += 1;
      break;
    default:
      break;
  }
  return { records: next, record };
}
