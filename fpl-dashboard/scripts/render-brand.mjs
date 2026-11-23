// Render the site icon and link-preview images into public/ (run by hand when the branding changes).
//
//   node scripts/render-brand.mjs
//
// Writes public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png (180x180),
// public/og/site.png and public/og/cfb.png (1200x630, the image shown when a link is shared).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');
mkdirSync(join(PUB, 'og'), { recursive: true });

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b2545"/>
  <text x="32" y="47" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#ffffff">S</text>
</svg>`;
writeFileSync(join(PUB, 'favicon.svg'), ICON);

const card = ({ title, subtitle, items, url }) => `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000;
         display: flex; flex-direction: column; justify-content: space-between; padding: 72px 80px; border-top: 18px solid #0b2545; }
  h1 { font-size: 88px; letter-spacing: -1px; }
  h2 { font-size: 38px; font-weight: normal; color: #333; margin-top: 18px; }
  ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 14px 18px; }
  li { font-size: 28px; border: 2px solid #b8c0ca; background: #f4f6f9; padding: 8px 16px; border-radius: 4px; }
  .url { font-size: 30px; color: #0645ad; }
</style></head><body>
  <div><h1>${title}</h1><h2>${subtitle}</h2></div>
  <ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>
  <div class="url">${url}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [file, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${ICON.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(PUB, file), omitBackground: true });
}

await page.setViewportSize({ width: 1200, height: 630 });
const cards = {
  'og/site.png': {
    title: 'swikle.com',
    subtitle: 'Fantasy Premier League, golf and college football, by the numbers',
    items: ['FPL league', 'Golf rounds & handicaps', 'College football ratings', 'Resume Builder'],
    url: 'swikle.com',
  },
  'og/cfb.png': {
    title: 'CFB Team Metrics',
    subtitle: 'College football records, splits and resumes, 2004 to today',
    items: ['Ratings', 'Resume Builder', 'Game control', 'Box scores', 'Player stats', 'History since 2004'],
    url: 'swikle.com/cfb',
  },
};
for (const [file, c] of Object.entries(cards)) {
  await page.setContent(card(c));
  await page.screenshot({ path: join(PUB, file) });
}
await browser.close();
console.log('render-brand: wrote favicon.svg, favicon-32.png, apple-touch-icon.png, og/site.png, og/cfb.png');
