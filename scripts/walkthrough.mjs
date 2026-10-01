// Drive the real app with a synthetic singer as the microphone, step by step,
// saving screenshots. Usage: node scripts/walkthrough.mjs <shots-dir> [baseUrl]

import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SHOTS = process.argv[2] ?? 'shots';
const BASE = process.argv[3] ?? 'http://localhost:5173/';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const profile = process.env.PROFILE ?? mkdtempSync(path.join(tmpdir(), 'five-e2e-'));
console.log('profile', profile);
const fixture = (n) => path.resolve('tests/fixtures', `${n}.wav`);

let ctx;
let page;
async function open(fixtureName, url, viewport = { width: 1280, height: 900 }) {
  if (ctx) await ctx.close();
  ctx = await chromium.launchPersistentContext(profile, {
    executablePath: EXE,
    viewport,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fixture(fixtureName)}%noloop`, '--autoplay-policy=no-user-gesture-required'],
    permissions: ['microphone'],
  });
  page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text()));
  await page.goto(BASE + url);
  await page.waitForLoadState('networkidle');
}
const shot = (name, full = true) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });

async function sing(seconds) {
  await page.getByRole('button', { name: 'Sing', exact: true }).click();
  const done = page.getByRole('button', { name: 'Done', exact: true });
  await done.waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Done');
    return b && !b.disabled;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(seconds * 1000);
  await done.click();
  await page.locator('.verdict').first().waitFor({ timeout: 30000 });
}

const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);

// 1. Choose five.
await open('amazing-grace-1', '');
await shot('01-start', false);
for (const t of ['Amazing Grace', 'Danny Boy', 'When the Saints Go Marching In', 'Shenandoah', 'Simple Gifts']) {
  await page.locator('.song-card', { hasText: t }).first().click();
}
await shot('02-picked', false);
await page.getByRole('button', { name: 'These are my five' }).click();
await page.waitForURL(/first\/0/);
log('chose five');
await shot('03-first-sing', false);

// 2. Sing each of the five.
const plan = [
  ['amazing-grace-1', 0, 19.5],
  ['danny-boy-1', 1, 17],
  ['saints-1', 2, 15],
  ['shenandoah-1', 3, 28],
  ['simple-gifts-1', 4, 20],
];
for (const [fx, i, secs] of plan) {
  if (i > 0) await open(fx, `#/first/${i}`);
  await sing(secs + 1.5);
  log(`sang song ${i + 1}: ${await page.locator('.verdict').first().textContent()}`);
  await shot(`04-review-${i + 1}`);
  await page.getByRole('button', { name: /Keep this one/ }).first().click();
  await page.waitForTimeout(800);
}
await page.waitForURL(/first-read/, { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('05-first-read');
log('first read: ' + (await page.locator('.lead.it').first().textContent()));

// 3. Home.
await page.getByRole('link', { name: 'Go to your five songs' }).click();
await page.waitForTimeout(800);
await shot('06-home');
log('home');

// 4. Song page and sing again (steadier take).
await open('amazing-grace-2', '#/song/amazing-grace/sing');
await sing(19.5 + 1.5);
log('sang again: ' + (await page.locator('.verdict').first().textContent()));
await shot('07-sing-again');
await page.goto(BASE + '#/song/amazing-grace');
await page.waitForTimeout(800);
await shot('08-song-page');

// 5. Audition a new song for a slot.
await open('swing-low-audition', '#/change/saints');
await shot('09-change', false);
await page.locator('.song-card', { hasText: 'Swing Low' }).getByRole('link', { name: 'Audition it' }).click();
await page.waitForTimeout(500);
await sing(23.3 + 1.5);
await page.waitForTimeout(500);
await shot('10-audition');
log('audition done');
await page.getByRole('button', { name: /Put Swing Low/ }).click();
await page.waitForURL(/song\/swing-low/);
await page.waitForTimeout(800);
await shot('11-after-swap');
await page.goto(BASE + '#/voice');
await page.waitForTimeout(1200);
await shot('12-voice');
await page.goto(BASE + '#/sixth');
await page.waitForTimeout(800);
await shot('13-sixth');

// 6. Phone layout.
await open('wrong-melody', '', { width: 390, height: 844 });
await page.waitForTimeout(800);
await shot('14-home-mobile');
await page.goto(BASE + '#/song/danny-boy/sing');
await page.waitForTimeout(500);
await shot('15-sing-mobile', false);
// A take that doesn't follow the melody (Greensleeves sung for Danny Boy).
await sing(16);
await shot('16-wrong-melody-mobile');
log('wrong melody: ' + (await page.locator('.verdict').first().textContent()));
await ctx.close();
log('done');
