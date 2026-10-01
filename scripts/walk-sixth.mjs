// Continue a walkthrough profile until the Sixth is ready, then sing it.
// Usage: PROFILE=<dir from walkthrough> node scripts/walk-sixth.mjs <shots-dir>
import { chromium } from '@playwright/test';
import path from 'node:path';

const SHOTS = process.argv[2] ?? 'shots';
const BASE = 'http://localhost:5173/';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const profile = process.env.PROFILE;
let ctx, page;
async function open(fx, url) {
  if (ctx) await ctx.close();
  ctx = await chromium.launchPersistentContext(profile, {
    executablePath: EXE, viewport: { width: 1280, height: 900 },
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.resolve('tests/fixtures', fx + '.wav')}%noloop`],
    permissions: ['microphone'],
  });
  page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await page.goto(BASE + url);
  await page.waitForLoadState('networkidle');
}
async function sing(seconds) {
  await page.getByRole('button', { name: 'Sing', exact: true }).click();
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Done'); return b && !b.disabled; }, null, { timeout: 20000 });
  await page.waitForTimeout(seconds * 1000);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('.verdict').first().waitFor({ timeout: 30000 });
  return page.locator('.verdict').first().textContent();
}
const secs = { 'amazing-grace': 21, 'danny-boy': 17.5, 'swing-low': 25, shenandoah: 29, 'simple-gifts': 22.5, 'scarborough-fair': 16.5, greensleeves: 17, 'motherless-child': 18, 'auld-lang-syne': 25.5, saints: 18 };
const plan = ['amazing-grace-3', 'danny-boy-2', 'danny-boy-3', 'swing-low-2', 'swing-low-3', 'shenandoah-2', 'shenandoah-3', 'simple-gifts-2', 'simple-gifts-3'];
for (const fx of plan) {
  const id = fx.replace(/-\d$/, '');
  await open(fx, `#/song/${id}/sing`);
  console.log(fx, '→', await sing(secs[id]));
}
await page.goto(BASE + '#/sixth');
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/20-sixth-ready.png`, fullPage: true });
const ask = page.getByRole('button', { name: 'Ask the coach for the Sixth' });
if (!(await ask.count())) {
  console.log('NOT READY:', await page.locator('.criteria').textContent());
  process.exit(1);
}
await ask.click();
await page.waitForTimeout(500);
const hyp = await page.locator('.card .verdict').first().textContent();
console.log('Hypothesis:', hyp);
const id = Object.keys(secs).find((k) => hyp.includes({ 'scarborough-fair': 'Scarborough', greensleeves: 'Greensleeves', 'motherless-child': 'Motherless', 'auld-lang-syne': 'Auld Lang', saints: 'Saints' }[k] ?? '§'));
await page.screenshot({ path: `${SHOTS}/21-sixth-proposed.png`, fullPage: true });
await open(`${id}-sixth`, '#/sixth');
console.log('Sixth take:', await sing(secs[id]));
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/22-sixth-verdict.png`, fullPage: true });
console.log((await page.locator('.card').first().textContent()).slice(0, 600));
await ctx.close();
