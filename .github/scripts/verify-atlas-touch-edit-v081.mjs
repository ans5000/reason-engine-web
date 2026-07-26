import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.ATLAS_TOUCH_BASE || 'https://reasonengine.de/app/index.html';
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function createAtlas(page) {
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden])').waitFor();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field[data-field-id]').length >= 7);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 1366 },
  hasTouch: true,
  isMobile: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();

try {
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}touch=${process.env.GITHUB_SHA || Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await createAtlas(page);

  const target = page.locator('[data-fields] .hex-field[data-type="decision"]').first();
  await target.scrollIntoViewIfNeeded();
  await target.focus();
  await page.waitForTimeout(200);

  const hit = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const toolbox = element.parentElement?.querySelector('.hex-toolbox');
    const tool = toolbox?.querySelector('.hex-tool');
    return {
      x,
      y,
      topTag: top?.tagName || null,
      topClass: top?.className || null,
      targetHit: top === element || element.contains(top),
      toolboxOpacity: toolbox ? getComputedStyle(toolbox).opacity : null,
      toolboxPointerEvents: toolbox ? getComputedStyle(toolbox).pointerEvents : null,
      toolPointerEvents: tool ? getComputedStyle(tool).pointerEvents : null,
    };
  });

  if (hit.toolboxOpacity !== '1') throw new Error(`Touch toolbox did not become visible: ${JSON.stringify(hit)}`);
  if (hit.toolboxPointerEvents !== 'none') throw new Error(`Toolbox still captures the whole hex: ${JSON.stringify(hit)}`);
  if (hit.toolPointerEvents !== 'auto') throw new Error(`Visible tool buttons are not interactive: ${JSON.stringify(hit)}`);
  if (!hit.targetHit) throw new Error(`Focused hex center is intercepted: ${JSON.stringify(hit)}`);

  await page.mouse.click(hit.x, hit.y);
  await page.locator('[data-field-dialog]').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(artifacts, 'atlas-touch-edit-dialog.png'), fullPage: true, animations: 'disabled' });
  fs.writeFileSync(path.join(artifacts, 'atlas-touch-edit-metrics.json'), `${JSON.stringify(hit, null, 2)}\n`);
  console.log(JSON.stringify({ result: 'PASS', ...hit }));
} finally {
  await context.close();
  await browser.close();
}
