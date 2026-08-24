import { chromium } from "playwright";

const base = "http://localhost:5199/golftrip";
const browser = await chromium.launch();

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await page.screenshot({ path: `/tmp/golftrip-${name}-standings.png`, fullPage: name === "mobile" ? false : true });

  // expand top player row
  await page.locator("tbody tr").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/golftrip-${name}-expanded.png` });

  await page.getByRole("button", { name: /Rounds/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/golftrip-${name}-rounds.png`, fullPage: true });

  await page.getByRole("button", { name: /Stats/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/golftrip-${name}-stats.png`, fullPage: true });

  console.log(name, "errors:", errors.length ? errors : "none");
  await page.close();
}
await browser.close();
