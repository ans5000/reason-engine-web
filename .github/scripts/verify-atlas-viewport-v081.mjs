import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.ATLAS_VIEWPORT_BASE;
const expectedPatch = 'atlas-viewport-hotfix-2026-07-26';
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });

if (!base) throw new Error('ATLAS_VIEWPORT_BASE is required');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1180, height: 900 },
  serviceWorkers: 'block',
});
const page = await context.newPage();

try {
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}viewport=${process.env.GITHUB_SHA || Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  const patch = await page.locator('meta[name="reason-engine-viewport"]').getAttribute('content');
  if (patch !== expectedPatch) throw new Error(`Viewport patch marker mismatch: ${patch}`);

  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field').length >= 7);

  const metrics = await page.waitForFunction(() => {
    const stage = document.querySelector('[data-stage]');
    const root = document.querySelector('[data-fields] .hex-field.root');
    if (!stage || !root) return false;
    const stageRect = stage.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const stageCenter = { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 };
    const rootCenter = { x: rootRect.left + rootRect.width / 2, y: rootRect.top + rootRect.height / 2 };
    const dx = Math.abs(rootCenter.x - stageCenter.x);
    const dy = Math.abs(rootCenter.y - stageCenter.y);
    const fullyVisible = rootRect.left >= stageRect.left && rootRect.right <= stageRect.right && rootRect.top >= stageRect.top && rootRect.bottom <= stageRect.bottom;
    if (!fullyVisible || dx > 70 || dy > 70) return false;
    return { dx, dy, fullyVisible, stageWidth: stageRect.width, stageHeight: stageRect.height };
  }, { timeout: 10000 });

  fs.writeFileSync(path.join(artifacts, 'atlas-viewport-metrics.json'), JSON.stringify(await metrics.jsonValue(), null, 2));
  await page.screenshot({ path: path.join(artifacts, 'atlas-viewport-centered.png'), fullPage: true, animations: 'disabled' });
} finally {
  await context.close();
  await browser.close();
}
