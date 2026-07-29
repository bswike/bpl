// Repro script for the drive-slider duplication bug on /map.
// Usage: node scripts/repro-slider.mjs [url]
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map?course=suntree-challenge";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto(URL);
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
console.log("map element present");

const counts = () =>
  page.evaluate(() => {
    const map = document.querySelector("gmp-map-3d");
    const byTag = {};
    for (const el of map.children) byTag[el.tagName.toLowerCase()] = (byTag[el.tagName.toLowerCase()] || 0) + 1;
    return byTag;
  });

// select hole 1 (first hole button in bottom strip after "All")
await page.waitForSelector("text=Par 4", { timeout: 30000 });
await page.locator("button", { hasText: /^1Par 4$/ }).first().click();
await page.waitForTimeout(3500);
console.log("after selecting hole 1:", await counts());

// sweep the slider 180 -> 320 like a drag (many input events)
const slider = page.locator('input[type="range"]');
await slider.waitFor({ timeout: 5000 });
await page.evaluate(() => {
  const input = document.querySelector('input[type="range"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  for (let v = 180; v <= 320; v += 5) {
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.waitForTimeout(1500);
console.log("after slider sweep:", await counts());

// sweep again to amplify any leak
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const input = document.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    for (let v = 320; v >= 180; v -= 5) {
      setter.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1500);
console.log("after 3 more sweeps:", await counts());

await page.screenshot({ path: "/tmp/map-after-sweeps.png" });
console.log("screenshot: /tmp/map-after-sweeps.png");
await browser.close();
