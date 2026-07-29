// Verifies the start menu: handicap + course selection, course switching,
// and that SG numbers respond to handicap changes.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5199/map";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

// fresh visit: menu should appear with all four courses
await page.goto(URL);
await page.waitForSelector("text=What's your handicap?", { timeout: 30000 });
const menuText = await page.evaluate(() => document.body.textContent);
console.log("menu shown:", true);
console.log("courses listed:", ["Suntree CC — Challenge", "Suntree CC — Classic", "Chaska Town Course", "Sparrows Point CC"].map((n) => menuText.includes(n)));
console.log("sparrows disabled note:", menuText.includes("Not yet mapped"));
await page.screenshot({ path: "/tmp/menu.png" });

// pick scratch, start Suntree Challenge
await page.locator("button", { hasText: /^Scratch$/ }).click();
await page.locator("button", { hasText: /Suntree CC — Challenge/ }).click();
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
console.log("saved hcp:", await page.evaluate(() => localStorage.getItem("swikle-hcp")),
  "course:", await page.evaluate(() => localStorage.getItem("swikle-course")));

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

// reopen menu via header chip, set 20, resume same course
await page.locator("button", { hasText: /^You:/ }).first().click();
await page.waitForSelector("text=What's your handicap?");
await page.locator("button", { hasText: /^20$/ }).click();
await page.locator("button", { hasText: /Suntree CC — Challenge/ }).click();
await page.waitForTimeout(1000);
// re-select hole 5 (course resume keeps hole? aims reset -> hole persists only if same course)
if (!(await page.locator("text=Expected score").count())) {
  await page.locator("button", { hasText: /^5Par 5$/ }).first().click();
  await page.waitForTimeout(3000);
}
const at20 = await grab();
console.log("20 hcp:", JSON.stringify(at20));

const hcpOk =
  atScratch.expected && at20.expected &&
  Number(at20.expected) > Number(atScratch.expected) + 0.5 &&
  at20.baselineNote === "20";
console.log(hcpOk ? "HCP RESPONSE: PASS" : "HCP RESPONSE: FAIL");

// switch to Chaska Town via Courses button
await page.locator("button", { hasText: /^Courses$/ }).click();
await page.waitForSelector("text=Pick a course");
await page.locator("button", { hasText: /Chaska Town Course/ }).click();
await page.waitForTimeout(4000);
const chaskaText = await page.evaluate(() => document.body.textContent);
console.log("chaska header:", chaskaText.includes("Chaska Town Course"));
await page.locator("button", { hasText: /^7Par 5$/ }).first().click();
await page.waitForTimeout(4500);
const chaska7 = await grab();
console.log("chaska hole 7 (par 5):", JSON.stringify(chaska7));
await page.screenshot({ path: "/tmp/chaska-h7.png" });
const chaskaOk = chaska7.expected != null && chaska7.yards.length >= 2;
console.log(chaskaOk ? "CHASKA: PASS" : "CHASKA: FAIL");

// deep link skips menu
await page.goto(URL.split("?")[0] + "?course=chaska-town");
await page.waitForSelector("gmp-map-3d", { timeout: 30000 });
await page.waitForTimeout(1500);
const menuCount = await page.locator("text=Pick a course").count();
console.log("deep link skips menu (should be 0):", menuCount);

console.log(hcpOk && chaskaOk && menuCount === 0 ? "\nPASS" : "\nFAIL");
await browser.close();
