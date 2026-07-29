import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
await page.addInitScript(() => localStorage.setItem("swikle-hcp", "12"));

for (const [slug, holeBtn, shot] of [
  ["chaska-town", /^5Par 4$/, "/tmp/chaska-h5.png"],
  ["chaska-town", /^12Par 3$/, "/tmp/chaska-h12.png"],
  ["suntree-challenge", /^5Par 5$/, "/tmp/suntree-h5.png"],
]) {
  await page.goto("http://localhost:5199/map?course=" + slug);
  await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
  await page.waitForTimeout(5000); // let tiles settle
  await page.locator("button", { hasText: holeBtn }).first().click();
  await page.waitForTimeout(7000); // flight + tiles
  await page.screenshot({ path: shot });
  console.log("saved", shot);
}
await browser.close();
