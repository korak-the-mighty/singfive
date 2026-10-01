// The whole FIVE experience, with a synthetic singer as the microphone.
//
// Chromium plays a WAV file as the microphone input. A new file means a new
// browser launch, so the test uses one persistent profile (IndexedDB survives)
// and relaunches per take. Run `npm run fixtures` first.

import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.FIVE_URL ?? 'http://localhost:5173/';
const EXE = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const profile = mkdtempSync(path.join(tmpdir(), 'five-e2e-'));
const fixture = (n: string) => path.resolve('tests/fixtures', `${n}.wav`);

let ctx: BrowserContext | null = null;
let page: Page;
const errors: string[] = [];

async function open(fixtureName: string, url: string, viewport = { width: 1280, height: 900 }) {
  if (ctx) await ctx.close();
  ctx = await chromium.launchPersistentContext(profile, {
    executablePath: EXE,
    viewport,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fixture(fixtureName)}%noloop`,
      '--autoplay-policy=no-user-gesture-required',
    ],
    permissions: ['microphone'],
  });
  page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + url);
}

async function sing(seconds: number) {
  await page.getByRole('button', { name: 'Sing', exact: true }).click();
  const done = page.getByRole('button', { name: 'Done', exact: true });
  await expect(done).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(seconds * 1000);
  await done.click();
  await page.locator('.verdict').first().waitFor({ timeout: 30_000 });
  return (await page.locator('.verdict').first().textContent()) ?? '';
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(12 * 60_000);

test('choose five, sing them, get a profile, sing again, practice, change a song', async () => {
  test.skip(!existsSync(fixture('amazing-grace-1')), 'Run `npm run fixtures` first.');

  // Choose five.
  await open('amazing-grace-1', '');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('your five songs');
  const confirm = page.getByRole('button', { name: /Pick 5 more/ });
  await expect(confirm).toBeDisabled();
  for (const t of ['Amazing Grace', 'Danny Boy', 'When the Saints Go Marching In', 'Shenandoah', 'Simple Gifts']) {
    await page.locator('.song-card', { hasText: t }).first().click();
  }
  await page.getByRole('button', { name: 'These are my five' }).click();
  await page.waitForURL(/first\/0/);

  // First sing: record, review, keep, next.
  const plan: [string, number, number][] = [
    ['amazing-grace-1', 0, 19.5],
    ['danny-boy-1', 1, 17],
    ['saints-1', 2, 15],
    ['shenandoah-1', 3, 28],
    ['simple-gifts-1', 4, 20],
  ];
  for (const [fx, i, secs] of plan) {
    if (i > 0) await open(fx, `#/first/${i}`);
    const verdict = await sing(secs + 1.5);
    expect(verdict).not.toMatch(/couldn’t/);
    if (fx === 'shenandoah-1') await expect(page.locator('main')).toContainText(/went flat/);
    if (fx === 'saints-1') await expect(page.locator('main')).toContainText(/sped up/);
    await page.getByRole('button', { name: /Keep this one/ }).first().click();
    await page.waitForTimeout(600);
  }

  // The first profile: real evidence, tagged honestly.
  await page.waitForURL(/first-read/, { timeout: 30_000 });
  await expect(page.getByText('What we already know about your voice')).toBeVisible();
  await expect(page.getByText(/We’ve heard you sing from/)).toBeVisible();
  await expect(page.locator('.tag.unsure').first()).toBeVisible();
  await expect(page.getByText(/sped up/).first()).toBeVisible();

  // Home is YOUR FIVE SONGS.
  await page.getByRole('link', { name: 'Go to your five songs' }).click();
  await expect(page.locator('.five-row')).toHaveCount(5);

  // Sing one again: a steadier take is heard as better, and becomes the best.
  await open('amazing-grace-2', '#/song/amazing-grace/sing');
  const again = await sing(21);
  expect(again).toMatch(/better than before/);
  await expect(page.getByText(/steadier/).first()).toBeVisible();
  await expect(page.getByText('This is your best take now')).toBeVisible();

  // The song page keeps its history and can compare takes.
  await page.goto(BASE + '#/song/amazing-grace');
  await expect(page.locator('.takes li')).toHaveCount(2);
  for (const b of await page.getByRole('button', { name: 'Compare' }).all()) await b.click();
  await expect(page.locator('.card .verdict')).toContainText(/better/);

  // Listen blind.
  await page.getByRole('link', { name: /Listen blind/ }).click();
  await page.getByRole('button', { name: 'I prefer A' }).click();
  await expect(page.locator('.verdict')).toContainText(/You chose A/);

  // Practice, because of Shenandoah.
  await open('shenandoah-practice', '#/song/shenandoah');
  await page.getByRole('link', { name: /^Practice:/ }).click();
  await expect(page.getByText(/Because/).first()).toBeVisible();
  await sing(4);
  await expect(page.locator('.verdict').first()).not.toContainText(/couldn’t follow/);

  // Change a song: audition Swing Low for the Saints' place.
  await open('swing-low-audition', '#/change/saints');
  await page.locator('.song-card', { hasText: 'Swing Low' }).getByRole('link', { name: 'Audition it' }).click();
  await sing(24.8);
  await page.getByRole('button', { name: /Put Swing Low/ }).click();
  await page.waitForURL(/song\/swing-low/);
  await page.goto(BASE + '#/');
  await expect(page.locator('.five-row', { hasText: 'Swing Low' })).toHaveCount(1);
  await expect(page.locator('.five-row', { hasText: 'Saints' })).toHaveCount(0);
  // History is kept.
  await page.goto(BASE + '#/voice');
  await expect(page.getByText(/took the place of When the Saints/)).toBeVisible();
  await page.goto(BASE + '#/song/saints');
  await expect(page.getByText(/was in your five until/)).toBeVisible();

  // Honesty: a different melody is not judged as the song.
  await open('wrong-melody', '#/song/danny-boy/sing', { width: 390, height: 844 });
  const wrong = await sing(16);
  expect(wrong).toMatch(/couldn’t follow the melody/);

  expect(errors).toEqual([]);
  await ctx?.close();
});
