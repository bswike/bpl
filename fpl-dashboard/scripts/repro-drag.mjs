// Real mouse-drag repro: drag the drive slider slowly and screenshot mid-drag.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map?course=suntree-challenge";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto(URL);
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.locator("button", { hasText: /^1Par 4$/ }).first().click();
await page.waitForTimeout(4000);

const slider = page.locator('input[type="range"]');
const box = await slider.boundingBox();
const y = box.y + box.height / 2;

// drag left-to-right slowly like a user
await page.mouse.move(box.x + 2, y);
await page.mouse.down();
for (let i = 0; i <= 40; i++) {
  await page.mouse.move(box.x + (box.width * i) / 40, y);
  await page.waitForTimeout(30);
  if (i === 20) await page.screenshot({ path: "/tmp/drag-mid.png" });
}
await page.mouse.up();
await page.screenshot({ path: "/tmp/drag-end.png" });

// drag back and forth fast
for (let r = 0; r < 4; r++) {
  await page.mouse.down();
  for (let i = 40; i >= 0; i -= 2) {
    await page.mouse.move(box.x + (box.width * i) / 40, y);
    await page.waitForTimeout(8);
  }
  for (let i = 0; i <= 40; i += 2) {
    await page.mouse.move(box.x + (box.width * i) / 40, y);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
}
await page.screenshot({ path: "/tmp/drag-after-fast.png" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/drag-settled.png" });

const counts = await page.evaluate(() => {
  const map = document.querySelector("gmp-map-3d");
  const byTag = {};
  for (const el of map.children) byTag[el.tagName.toLowerCase()] = (byTag[el.tagName.toLowerCase()] || 0) + 1;
  return byTag;
});
console.log("final DOM counts:", counts);
console.log("slider value:", await page.locator('input[type="range"]').inputValue());
await browser.close();
