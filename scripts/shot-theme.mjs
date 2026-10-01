// Usage: PROFILE=dir node scripts/shot-theme.mjs <url> <out.png> <w> <h> <dark|light>
import { chromium } from '@playwright/test';
const [url, out, w, h, scheme] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(process.env.PROFILE, { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', viewport: { width: Number(w), height: Number(h) }, colorScheme: scheme });
const page = ctx.pages()[0];
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
await ctx.close();
