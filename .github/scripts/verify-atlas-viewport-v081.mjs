import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.ATLAS_VIEWPORT_BASE;
const expectedPatch = 'atlas-viewport-hotfix-2026-07-26';
const expectedToolbarPatch = 'atlas-toolbar-hotfix-v0.9.1-2026-07-27';
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

  const toolbarPatch = await page.locator('meta[name="reason-engine-toolbar"]').getAttribute('content');
  if (toolbarPatch !== expectedToolbarPatch) throw new Error(`Toolbar patch marker mismatch: ${toolbarPatch}`);

  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field').length >= 7);

  const metrics = await page.waitForFunction(() => {
    const stage = document.querySelector('[data-stage]');
    const root = document.querySelector('[data-fields] .hex-field.root');
    const toolbar = document.querySelector('.map-tools');
    if (!stage || !root || !toolbar) return false;

    const buttons = [...toolbar.querySelectorAll('button')];
    if (buttons.length < 5) return false;

    const stageRect = stage.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const buttonRects = buttons.map((button) => button.getBoundingClientRect());
    const stageCenter = { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 };
    const rootCenter = { x: rootRect.left + rootRect.width / 2, y: rootRect.top + rootRect.height / 2 };
    const dx = Math.abs(rootCenter.x - stageCenter.x);
    const dy = Math.abs(rootCenter.y - stageCenter.y);
    const fullyVisible = rootRect.left >= stageRect.left && rootRect.right <= stageRect.right && rootRect.top >= stageRect.top && rootRect.bottom <= stageRect.bottom;

    const overlappingPairs = [];
    for (let first = 0; first < buttonRects.length; first += 1) {
      for (let second = first + 1; second < buttonRects.length; second += 1) {
        const a = buttonRects[first];
        const b = buttonRects[second];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 0.5 && overlapY > 0.5) overlappingPairs.push([first, second]);
      }
    }

    const wrappedButtons = buttons
      .map((button, index) => ({
        index,
        text: button.textContent.trim(),
        whiteSpace: getComputedStyle(button).whiteSpace,
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
        clientHeight: button.clientHeight,
        scrollHeight: button.scrollHeight,
      }))
      .filter((button) => button.whiteSpace !== 'nowrap' || button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);

    const toolbarStyle = getComputedStyle(toolbar);
    const toolbarFits = toolbar.scrollWidth <= toolbar.clientWidth + 1;
    const toolbarVisible = toolbarRect.width > 0 && toolbarRect.height > 0;

    if (!fullyVisible || dx > 70 || dy > 70 || toolbarStyle.display !== 'flex' || !toolbarFits || !toolbarVisible || overlappingPairs.length || wrappedButtons.length) return false;

    return {
      dx,
      dy,
      fullyVisible,
      stageWidth: stageRect.width,
      stageHeight: stageRect.height,
      toolbar: {
        display: toolbarStyle.display,
        buttonCount: buttons.length,
        clientWidth: toolbar.clientWidth,
        scrollWidth: toolbar.scrollWidth,
        overlappingPairs,
        wrappedButtons,
        buttons: buttons.map((button, index) => ({
          index,
          text: button.textContent.trim(),
          width: buttonRects[index].width,
          height: buttonRects[index].height,
        })),
      },
    };
  }, { timeout: 10000 });

  fs.writeFileSync(path.join(artifacts, 'atlas-viewport-metrics.json'), JSON.stringify(await metrics.jsonValue(), null, 2));
  await page.screenshot({ path: path.join(artifacts, 'atlas-viewport-centered.png'), fullPage: true, animations: 'disabled' });
} finally {
  await context.close();
  await browser.close();
}
