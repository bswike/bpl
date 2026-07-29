// E2E: drag shot-aim handles on hole 5 (par 5) and verify live SG updates,
// camera stability, and no overlay leaks.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.addInitScript(() => localStorage.setItem("swikle-hcp", "12"));
await page.goto(URL);
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.locator("button", { hasText: /^5Par 5$/ }).first().click();
await page.waitForTimeout(4500);

const panelText = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll(".pointer-events-auto")].map((e) => e.textContent).join(" ");
  return rows;
});

const state = () => page.evaluate(() => {
  const map = window.__tgv.map;
  const markers = [...map.querySelectorAll("gmp-marker-3d")];
  // handles are altitude=1 markers
  const handles = markers
    .filter((m) => m.position?.altitude === 1)
    .map((m) => [m.position.lat, m.position.lng]);
  const r = document.querySelector("gmp-map-3d").getBoundingClientRect();
  const px = handles.map((h) => {
    const p = window.__tgv.groundToScreen(h, window.__tgv.cameraState().centerAlt);
    return p ? [p[0] + r.x, p[1] + r.y] : null;
  });
  return {
    handles,
    px,
    center: { lat: map.center.lat, lng: map.center.lng },
    counts: { polys: map.querySelectorAll("gmp-polygon-3d").length, markers: markers.length, lines: map.querySelectorAll("gmp-polyline-3d").length },
  };
});

const before = await state();
console.log("hole 5 handles:", before.handles.length, "| overlays:", JSON.stringify(before.counts));
const beforePanel = await panelText();
const sgMatchesBefore = beforePanel.match(/[+-]\d\.\d\d/g);
console.log("SG values before:", sgMatchesBefore);

// drag first handle (drive aim) 120px to the left (toward trouble)
const h0 = before.px[0];
if (!h0) { console.log("FAIL: no screen position for handle 0"); process.exit(1); }
await page.mouse.move(h0[0], h0[1]);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(h0[0] - i * 10, h0[1], { steps: 2 });
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.waitForTimeout(800);

const after = await state();
const afterPanel = await panelText();
const sgMatchesAfter = afterPanel.match(/[+-]\d\.\d\d/g);
console.log("SG values after drag:", sgMatchesAfter);

const movedM = Math.hypot(
  (after.handles[0][0] - before.handles[0][0]) * 111320,
  (after.handles[0][1] - before.handles[0][1]) * 111320 * 0.88
);
console.log("handle moved:", movedM.toFixed(1), "m");
console.log("camera center moved:", (Math.hypot(after.center.lat - before.center.lat, after.center.lng - before.center.lng) * 111320).toFixed(1), "m");
console.log("overlays after:", JSON.stringify(after.counts));
await page.screenshot({ path: "/tmp/drag-sg.png" });

// checks
const ok =
  after.handles.length === before.handles.length &&
  movedM > 20 &&
  JSON.stringify(sgMatchesBefore) !== JSON.stringify(sgMatchesAfter) &&
  JSON.stringify(after.counts) === JSON.stringify(before.counts);
console.log(ok ? "\nPASS" : "\nFAIL");

// also exercise: drag green-aim (last handle) and reset
const last = after.px[after.px.length - 1];
if (last) {
  await page.mouse.move(last[0], last[1]);
  await page.mouse.down();
  await page.mouse.move(last[0] + 40, last[1] + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  console.log("after green-aim drag:", await page.evaluate(() => document.body.textContent.match(/Expected score(\d\.\d\d)/)?.[1] ?? "?"));
}
await page.locator("button", { hasText: "Reset shots" }).click();
await page.waitForTimeout(500);
const resetState = await state();
console.log("after reset, overlays:", JSON.stringify(resetState.counts));
await page.screenshot({ path: "/tmp/drag-sg-reset.png" });
await browser.close();
