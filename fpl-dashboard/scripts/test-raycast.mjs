// Verifies the courseMapEngine camera model: compares screenToGround()
// predictions against the map's own gmp-click LocationClickEvent positions.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.addInitScript(() => localStorage.setItem("swikle-hcp", "12"));
await page.goto(URL);
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.locator("button", { hasText: /^1Par 4$/ }).first().click();
await page.waitForTimeout(4500); // let the flyover finish

// register click listener
await page.evaluate(() => {
  window.__clicks = [];
  window.__tgv.map.addEventListener("gmp-click", (e) => {
    if (e.position) window.__clicks.push({ lat: e.position.lat, lng: e.position.lng, alt: e.position.altitude });
  });
});

const rect = await page.evaluate(() => {
  const el = document.querySelector("gmp-map-3d");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

// sample a grid of pixels in the central map area (avoid UI panels)
const pixels = [];
for (const fx of [0.35, 0.5, 0.65]) {
  for (const fy of [0.3, 0.45, 0.6]) {
    pixels.push([rect.x + rect.w * fx, rect.y + rect.h * fy]);
  }
}

let worst = 0, sum = 0, n = 0;
for (const [cx, cy] of pixels) {
  const before = await page.evaluate(() => window.__clicks.length);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(400);
  const res = await page.evaluate(
    ([cx, cy, before]) => {
      if (window.__clicks.length <= before) return null;
      const truth = window.__clicks[window.__clicks.length - 1];
      const el = document.querySelector("gmp-map-3d");
      const r = el.getBoundingClientRect();
      const pred = window.__tgv.screenToGround(cx - r.x, cy - r.y, truth.alt);
      if (!pred) return { truth, pred: null };
      // horizontal error in meters
      const dy = (pred[0] - truth.lat) * 111320;
      const dx = (pred[1] - truth.lng) * 111320 * Math.cos((truth.lat * Math.PI) / 180);
      // also check projection round-trip
      const px = window.__tgv.groundToScreen([truth.lat, truth.lng], truth.alt);
      const pxErr = px ? Math.hypot(px[0] - (cx - r.x), px[1] - (cy - r.y)) : null;
      return { truth, err: Math.hypot(dx, dy), pxErr };
    },
    [cx, cy, before]
  );
  if (!res) { console.log(`pixel(${Math.round(cx)},${Math.round(cy)}): no gmp-click fired (UI?)`); continue; }
  if (res.pred === null) { console.log("raycast returned null"); continue; }
  console.log(
    `pixel(${Math.round(cx)},${Math.round(cy)}): alt=${res.truth.alt?.toFixed(1)}m  groundErr=${res.err.toFixed(1)}m  projErr=${res.pxErr?.toFixed(1)}px`
  );
  worst = Math.max(worst, res.err);
  sum += res.err;
  n++;
}
console.log(`\n${n} samples | mean error ${(sum / n).toFixed(1)}m | worst ${worst.toFixed(1)}m`);
await browser.close();
