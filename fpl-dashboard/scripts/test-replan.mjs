// E2E: dropping an aim point re-plans the rest of the chain.
// - par 4 hole 1: dragging the drive to ~30 yds must INSERT a layup (2 -> 3 aims)
// - all legs must stay within the player's reach
// - small green-aim nudge must NOT add shots
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5199/map?course=suntree-challenge";
const MAX_LEG_YDS = 250; // 12-hcp reach + slack

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.addInitScript(() => localStorage.setItem("swikle-hcp", "12"));
await page.goto(BASE);
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.locator("button", { hasText: /^1Par 4$/ }).first().click();
await page.waitForTimeout(4500);

const ydsBetween = (a, b) =>
  Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)) / 0.9144;

const state = () => page.evaluate(() => {
  const map = window.__tgv.map;
  const handles = [...map.querySelectorAll("gmp-marker-3d")]
    .filter((m) => m.position?.altitude === 1)
    .map((m) => [m.position.lat, m.position.lng]);
  const r = document.querySelector("gmp-map-3d").getBoundingClientRect();
  const px = handles.map((h) => {
    const p = window.__tgv.groundToScreen(h, window.__tgv.cameraState().centerAlt);
    return p ? [p[0] + r.x, p[1] + r.y] : null;
  });
  return { handles, px, expected: Number(document.body.textContent.match(/Expected score(\d+\.\d\d)/)?.[1] ?? NaN) };
});

const holeInfo = await page.evaluate(async () => {
  const d = await fetch("/data/suntree-challenge.json").then((r) => r.json());
  const h = d.holes.find((x) => x.num === 1);
  return { tee: h.tees[0].pos, pin: h.pin };
});

const legYds = (handles) => {
  const pts = [holeInfo.tee, ...handles];
  return pts.slice(1).map((p, i) => Math.round(ydsBetween(pts[i], p)));
};

const before = await state();
console.log("before: aims", before.handles.length, "legs", JSON.stringify(legYds(before.handles)), "expected", before.expected);

// drop point ~30 yds from the tee toward the pin
const dropPx = await page.evaluate((info) => {
  const { tee, pin } = info;
  const f = 27.4 / Math.hypot((pin[0] - tee[0]) * 111320, (pin[1] - tee[1]) * 111320 * 0.88);
  const pt = [tee[0] + (pin[0] - tee[0]) * f, tee[1] + (pin[1] - tee[1]) * f];
  const r = document.querySelector("gmp-map-3d").getBoundingClientRect();
  const p = window.__tgv.groundToScreen(pt, window.__tgv.cameraState().centerAlt);
  return [p[0] + r.x, p[1] + r.y];
}, holeInfo);

const h0 = before.px[0];
await page.mouse.move(h0[0], h0[1]);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(h0[0] + ((dropPx[0] - h0[0]) * i) / 10, h0[1] + ((dropPx[1] - h0[1]) * i) / 10, { steps: 2 });
  await page.waitForTimeout(25);
}
await page.mouse.up();
await page.waitForTimeout(1000);

const after = await state();
const legs = legYds(after.handles);
console.log("after 30-yd drive: aims", after.handles.length, "legs", JSON.stringify(legs), "expected", after.expected);
await page.screenshot({ path: "/tmp/replan-par4.png" });

const grew = after.handles.length > before.handles.length;
const firstShort = legs[0] <= 60;
const legsReachable = legs.every((l) => l <= MAX_LEG_YDS);
const endsAtPin = ydsBetween(after.handles[after.handles.length - 1], holeInfo.pin) < 3;
const worse = after.expected > before.expected + 0.5;
console.log("aims grew:", grew, "| first short:", firstShort, "| all legs reachable:", legsReachable, "| ends at pin:", endsAtPin, "| expected worse:", worse);

// small nudge of the green aim: shot count must not change
const px2 = (await state()).px;
const last = px2[px2.length - 1];
await page.mouse.move(last[0], last[1]);
await page.mouse.down();
await page.mouse.move(last[0] + 30, last[1] + 15, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(800);
const afterNudge = await state();
const nudgeOk = afterNudge.handles.length === after.handles.length;
console.log("after green nudge: aims", afterNudge.handles.length, "| unchanged:", nudgeOk);

await page.locator("button", { hasText: "Reset shots" }).click();
await page.waitForTimeout(800);
const reset = await state();
console.log("after reset: aims", reset.handles.length, "expected", reset.expected);

console.log(grew && firstShort && legsReachable && endsAtPin && worse && nudgeOk && reset.handles.length === before.handles.length ? "\nPASS" : "\nFAIL");
await browser.close();
