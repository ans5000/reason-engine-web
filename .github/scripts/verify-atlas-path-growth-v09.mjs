import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.ATLAS_PATH_BASE || 'https://reasonengine.de/app/index.html';
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function atlas(page) {
  return page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    return library.atlases.find((item) => item.id === library.currentId);
  });
}

async function createAtlas(page) {
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.atlasPathGrowth === 'loaded');
}

async function acceptFrom(page, sourceId) {
  const suggestionId = await page.evaluate((id) => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const current = library.atlases.find((item) => item.id === library.currentId);
    return current.pathGrowth.suggestions.find((item) => item.sourceFieldId === id && item.status === 'active')?.id;
  }, sourceId);
  if (!suggestionId) throw new Error(`No Next Hex for ${sourceId}`);
  await page.locator(`.next-hex[data-suggestion-id="${suggestionId}"]`).evaluate((node) => node.click());
  await page.locator('[data-next-hex-dialog]').waitFor({ state: 'visible' });
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('[data-next-accept]').click(),
  ]);
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.atlasPathGrowth === 'loaded');
  const current = await atlas(page);
  const route = current.routes.filter((item) => item.from === sourceId && item.pathOrigin === 'desired_path').at(-1);
  if (!route) throw new Error(`Desired Path was not created from ${sourceId}`);
  return route.to;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();

try {
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}path=${process.env.GITHUB_SHA || Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await createAtlas(page);

  await page.locator('.hex-field[data-type="decision"]').first().evaluate((node) => node.click());
  await page.locator('[data-field-dialog]').waitFor({ state: 'visible' });
  await page.locator('[data-field-body]').fill('Wir entscheiden den nächsten kleinen Schritt und prüfen das Ergebnis morgen.');
  await page.locator('[data-field-form] button[value="save"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.next-hex.active').length >= 1);

  let current = await atlas(page);
  const decisionId = current.fields.find((field) => field.fieldType === 'decision').id;
  const suggested = current.pathGrowth.suggestions.filter((item) => item.sourceFieldId === decisionId && item.status === 'active').length;
  if (suggested < 1 || suggested > 3) throw new Error(`Expected 1-3 Next Hexes, received ${suggested}`);

  const first = await acceptFrom(page, decisionId);
  current = await atlas(page);
  let firstRoute = current.routes.find((route) => route.to === first && route.pathOrigin === 'desired_path');
  if (firstRoute.pathState !== 'trace' || firstRoute.pathUses !== 1) throw new Error(`New route is not a trace: ${JSON.stringify(firstRoute)}`);

  await page.locator(`.hex-field[data-field-id="${first}"]`).evaluate((node) => node.click());
  await page.locator('[data-field-dialog]').waitFor({ state: 'visible' });
  const body = await page.locator('[data-field-body]').inputValue();
  await page.locator('[data-field-body]').fill(`${body}\n\nIm Alltag erneut benutzt.`);
  await page.locator('[data-field-form] button[value="save"]').click();
  await page.waitForFunction((id) => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const current = library.atlases.find((item) => item.id === library.currentId);
    const route = current.routes.find((item) => item.to === id && item.pathOrigin === 'desired_path');
    return route?.pathUses >= 2 && route.pathState === 'path';
  }, first);

  const second = await acceptFrom(page, first);
  const third = await acceptFrom(page, second);
  await page.waitForFunction((id) => document.querySelector(`[data-center-emergence="${CSS.escape(id)}"]`), third);
  await page.locator(`[data-center-emergence="${third}"]`).click();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction((id) => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const current = library.atlases.find((item) => item.id === library.currentId);
    return current.fields.find((field) => field.id === id)?.isCenter === true && current.pathGrowth.centers.includes(id);
  }, third);

  current = await atlas(page);
  const result = {
    result: 'PASS',
    suggestions: suggested,
    desiredRoutes: current.routes.filter((route) => route.pathOrigin === 'desired_path').length,
    reinforcedState: current.routes.find((route) => route.to === first)?.pathState,
    emergentCenter: current.fields.find((field) => field.id === third)?.title,
  };
  await page.screenshot({ path: path.join(artifacts, 'atlas-path-growth-v09.png'), fullPage: true, animations: 'disabled' });
  fs.writeFileSync(path.join(artifacts, 'atlas-path-growth-v09.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await context.close();
  await browser.close();
}
