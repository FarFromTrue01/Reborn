// Headless Chromium ile oyun içi ekran görüntüleri (QA).
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'screens';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const steps = process.argv[2] || 'title';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 854 }, deviceScaleFactor: Number(process.env.DPR || 2.5), hasTouch: true, isMobile: false });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(URL);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const evalG = (fn, arg) => page.evaluate(fn, arg);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 60000 });
await wait(2500);
await shot('01_title');
const script = await import(`./steps_${steps}.mjs`);
try {
  await script.default({ page, wait, shot, evalG });
} catch (e) {
  console.log('STEP FAILED', e.message);
} finally {
  fs.writeFileSync(`${OUT}/console.log`, logs.join('\n'));
  console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 20).join('\n'));
}
await browser.close();
