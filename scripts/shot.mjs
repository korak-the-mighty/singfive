// Usage: [PROFILE=dir] node scripts/shot.mjs <url> <out.png> [width] [height] [fullPage]
import { chromium } from '@playwright/test';
const [url, out, w = '1200', h = '900', full = '1'] = process.argv.slice(2);
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const viewport = { width: Number(w), height: Number(h) };
let ctx, browser;
if (process.env.PROFILE) ctx = await chromium.launchPersistentContext(process.env.PROFILE, { executablePath: exe, viewport });
else {
  browser = await chromium.launch({ executablePath: exe });
  ctx = await browser.newContext({ viewport });
}
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: full === '1' });
await ctx.close();
if (browser) await browser.close();
