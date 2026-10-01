// The microphone is refused: FIVE must say so clearly, and nothing breaks.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--deny-permission-prompts'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto('http://localhost:5173/');
for (const t of ['Amazing Grace', 'Danny Boy', 'Greensleeves', 'Shenandoah', 'Simple Gifts']) await page.locator('.song-card', { hasText: t }).first().click();
await page.getByRole('button', { name: 'These are my five' }).click();
await page.getByRole('button', { name: 'Sing', exact: true }).click();
await page.locator('[role=alert]').waitFor({ timeout: 15000 });
console.log('ALERT:', await page.locator('[role=alert]').textContent());
await page.screenshot({ path: process.argv[2] });
await browser.close();
