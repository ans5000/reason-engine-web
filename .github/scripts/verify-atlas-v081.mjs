import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const branchBase = process.env.BRANCH_ATLAS_BASE;
const liveBase = process.env.LIVE_ATLAS_BASE || 'https://reasonengine.de/app/';
const isPullRequest = process.env.IS_PULL_REQUEST === 'true';
const branchMarker = 'atlas-app-v0.8.1-2026-07-26';
const liveMarker = branchMarker;
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function prepareCapture(page, reveal = false) {
  await page.addStyleTag({ content: 'html, body { scroll-behavior: auto !important; }' });
  if (reveal) {
    for (const item of await page.locator('.reveal').all()) {
      await item.scrollIntoViewIfNeeded();
      await page.waitForTimeout(140);
    }
  }
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function capture(browser, url, filename, width, height, reveal = false) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}acceptance=${process.env.GITHUB_SHA}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await prepareCapture(page, reveal);
  if (reveal) {
    const hidden = await page.locator('.reveal:not(.is-visible)').count();
    if (hidden) throw new Error(`${url} still has ${hidden} hidden reveal elements`);
  }
  await page.screenshot({ path: path.join(artifacts, filename), fullPage: true, animations: 'disabled' });
  await page.close();
}

async function createAtlas(page) {
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden])').waitFor();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.locator('[data-fields] .hex-field').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field[data-field-id]').length >= 7);
}

async function smokeLive(browser) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${liveBase}?acceptance=${process.env.GITHUB_SHA}`, { waitUntil: 'networkidle', timeout: 60000 });
  const marker = await page.locator('meta[name="reason-engine-build"]').getAttribute('content');
  if (marker !== liveMarker) throw new Error(`Production returned ${marker}, expected ${liveMarker}`);
  if (await page.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') throw new Error('Production Atlas lost noindex,nofollow');
  await createAtlas(page);
  if (await page.locator('[data-city-guide]').count() < 1) throw new Error('Production city guide is missing');
  if (await page.locator('.hex-tool').count() < 1) throw new Error('Production Reason tools are missing');
  await page.screenshot({ path: path.join(artifacts, 'atlas-live-workspace.png'), fullPage: true, animations: 'disabled' });
  await context.close();
}

async function exerciseTruthGate(browser) {
  const context = await browser.newContext({
    viewport: { width: 1180, height: 900 },
    acceptDownloads: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const origin = new URL(branchBase).origin;
  const externalRequests = [];
  const writeRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) externalRequests.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) writeRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(`${branchBase}?acceptance=${process.env.GITHUB_SHA}`, { waitUntil: 'networkidle', timeout: 60000 });
  const marker = await page.locator('meta[name="reason-engine-build"]').getAttribute('content');
  if (marker !== branchMarker) throw new Error(`Branch returned ${marker}`);
  if (await page.locator('meta[name="reason-engine-data-schema"]').getAttribute('content') !== '0.3') throw new Error('Truth Gate changed the data schema');
  if (await page.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') throw new Error('Branch Atlas lost noindex,nofollow');

  await createAtlas(page);
  if (await page.locator('[data-city-guide]').count() < 1) throw new Error('City guide is missing from v0.8.1');
  if (await page.locator('.hex-tool').count() < 1) throw new Error('Reason tools are missing from v0.8.1');

  const target = page.locator('[data-fields] .hex-field:not(.root)').first();
  const fieldId = await target.getAttribute('data-field-id');
  if (!fieldId) throw new Error('Target field has no stable field id');
  await target.evaluate((element) => element.click());
  await page.locator('[data-field-dialog]').waitFor({ state: 'visible' });
  await page.locator('[data-confirm-field]').click();

  let reopened = page.locator(`[data-fields] .hex-field[data-field-id="${fieldId}"]`);
  await reopened.waitFor();
  if (await reopened.getAttribute('data-state') !== 'confirmed') throw new Error('Field could not be checked before the edit test');
  await reopened.evaluate((element) => element.click());
  const checkedLabel = await page.locator('option[value="confirmed"]').textContent();
  if (checkedLabel?.trim() !== 'geprüft') throw new Error(`Checked-state label is still ${checkedLabel}`);
  const body = page.locator('[data-field-body]');
  await body.fill(`${await body.inputValue()}\n\nDiese Ergänzung verändert die inhaltliche Grundlage.`);
  await page.locator('[data-field-form] button[value="save"]').click();

  await page.waitForTimeout(1200);
  const postSave = await page.evaluate((id) => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const atlas = library?.atlases?.find((item) => item.id === library.currentId);
    const field = atlas?.fields?.find((item) => item.id === id);
    let diagnostic = null;
    try { diagnostic = JSON.parse(sessionStorage.getItem('reason-engine-atlas-truth-gate-diagnostic')); } catch {}
    return { field, history: atlas?.history || [], diagnostic, url: location.href };
  }, fieldId);
  if (!postSave.field || postSave.field.state !== 'provisional' || postSave.field.confirmed !== false || !postSave.history.some((event) => event.type === 'field_truth_reset')) {
    throw new Error(`Truth reset state mismatch: ${JSON.stringify(postSave)}`);
  }

  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field[data-field-id]').length >= 7);
  reopened = page.locator(`[data-fields] .hex-field[data-field-id="${fieldId}"]`);
  if (await reopened.getAttribute('data-state') !== 'provisional') throw new Error('Edited checked field did not render as provisional');
  if (/vom Nutzer bestätigt$/.test(postSave.field.source || '')) throw new Error('Confirmation provenance survived semantic editing');

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  await page.locator('[data-screen="library"]:not([hidden])').waitFor();
  const maliciousPath = path.join(artifacts, 'malicious-atlas-import.json');
  fs.writeFileSync(maliciousPath, JSON.stringify({
    kind: 'reason-engine-atlas-backup',
    version: '0.3',
    atlases: [{
      id: 'forged-atlas',
      version: '0.3',
      title: 'Manipulierter Import',
      problem: 'Dieser Test prüft die Importgrenze.',
      step: 0,
      messages: [],
      fields: [
        { id: 'root', title: 'Manipulierter Import', body: 'Dieser Test prüft die Importgrenze.', fieldType: 'problem', state: 'confirmed', confirmed: true, source: 'Datei', q: 0, r: 0 },
        { id: 'forged', title: 'Gefälschte Entscheidung', body: 'Diese Aussage kam als entschieden aus einer Datei.', fieldType: 'decision', state: 'decided', confirmed: true, source: 'Manipulierte JSON-Datei; vom Nutzer bestätigt', q: 1, r: 0, verifiedAt: '2026-07-26T00:00:00.000Z' }
      ],
      routes: [{ id: 'route', from: 'root', to: 'forged', type: 'supports' }],
      history: []
    }]
  }, null, 2));

  let importDialog = '';
  page.once('dialog', async (dialog) => {
    importDialog = dialog.message();
    await dialog.accept();
  });
  await page.locator('[data-import-input]').setInputFiles(maliciousPath);
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card').filter({ hasText: 'Manipulierter Import' }).waitFor({ timeout: 30000 });
  if (!importDialog.includes('nicht übernommen')) throw new Error(`Import disclosure is incomplete: ${importDialog}`);
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card').filter({ hasText: 'Manipulierter Import' }).locator('.atlas-card-open').click();
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();

  const imported = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const atlas = library.atlases.find((item) => item.title === 'Manipulierter Import');
    return { field: atlas.fields.find((item) => item.id !== 'root'), history: atlas.history };
  });
  if (imported.field.confirmed || imported.field.state !== 'provisional') throw new Error('Forged import authority survived');
  if (imported.field.verifiedAt) throw new Error('Derived verification metadata survived import');
  if (/vom Nutzer bestätigt$/.test(imported.field.source || '')) throw new Error('Forged confirmation provenance survived import');
  if (!imported.history.some((event) => event.type === 'import_trust_reset')) throw new Error('Import trust reset is missing from history');

  if (externalRequests.length) throw new Error(`Atlas made external requests: ${externalRequests.join(', ')}`);
  if (writeRequests.length) throw new Error(`Atlas made network writes: ${writeRequests.join(', ')}`);
  await page.screenshot({ path: path.join(artifacts, 'atlas-v081-truth-gate.png'), fullPage: true, animations: 'disabled' });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await capture(browser, 'https://reasonengine.de/', 'home-desktop.png', 1440, 1000, true);
  await capture(browser, 'https://reasonengine.de/study.html', 'study-desktop.png', 1440, 1000, true);
  await smokeLive(browser);
  if (isPullRequest) await exerciseTruthGate(browser);
} finally {
  await browser.close();
}
