// Verifies the handicap flow: first-visit modal, saving, and that SG numbers
// and expected score respond to handicap changes.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

// fresh visit: modal should appear
await page.goto(URL);
await page.waitForSelector("text=What's your handicap?", { timeout: 30000 });
console.log("modal shown on first visit: yes");
await page.screenshot({ path: "/tmp/hcp-modal.png" });

// pick scratch, save
await page.locator("button", { hasText: /^Scratch$/ }).click();
await page.locator("button", { hasText: /^Save$/ }).click();
await page.waitForTimeout(500);
console.log("saved:", await page.evaluate(() => localStorage.getItem("swikle-hcp")));

// open hole 5, capture expected score at scratch
await page.locator("button", { hasText: /^5Par 5$/ }).first().click();
await page.waitForTimeout(4000);
const grab = async () => {
  const t = await page.evaluate(() => document.body.textContent);
  return {
    expected: t.match(/Expected score(\d+\.\d\d)/)?.[1],
    yards: [...t.matchAll(/(\d+) yds[+-]/g)].map((m) => m[1]),
    baselineNote: t.match(/SG vs your (\d+)-hcp baseline/)?.[1],
  };
};
const atScratch = await grab();
console.log("scratch:", JSON.stringify(atScratch));

// change to 20 via the header chip
await page.locator("button", { hasText: /^You:/ }).first().click();
await page.waitForSelector("text=What's your handicap?");
await page.locator("button", { hasText: /^20$/ }).click();
await page.locator("button", { hasText: /^Save$/ }).click();
await page.waitForTimeout(800);
const at20 = await grab();
console.log("20 hcp:", JSON.stringify(at20));
await page.screenshot({ path: "/tmp/hcp-20.png" });

const ok =
  atScratch.expected && at20.expected &&
  Number(at20.expected) > Number(atScratch.expected) + 0.5 &&
  at20.baselineNote === "20" &&
  JSON.stringify(atScratch.yards) !== JSON.stringify(at20.yards); // shorter default drive
console.log(ok ? "\nPASS" : "\nFAIL");

// reload: no modal, handicap persisted
await page.reload();
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.waitForTimeout(1500);
const modalAfterReload = await page.locator("text=What's your handicap?").count();
console.log("modal after reload (should be 0):", modalAfterReload);
await browser.close();
