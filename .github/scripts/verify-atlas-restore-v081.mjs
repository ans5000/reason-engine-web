import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.ATLAS_BASE;
const expectedMarker = 'atlas-app-v0.8.1-2026-07-26';
const artifacts = path.resolve('artifacts');
const backupPath = path.join(artifacts, 'atlas-v081-backup.json');
fs.mkdirSync(artifacts, { recursive: true });

async function gotoExpected(page) {
  let lastMarker = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await page.goto(`${base}?restore=${process.env.GITHUB_SHA}&attempt=${attempt}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    lastMarker = await page.locator('meta[name="reason-engine-build"]').getAttribute('content');
    if (lastMarker === expectedMarker) return;
    await page.waitForTimeout(10000);
  }
  throw new Error(`Expected ${expectedMarker}, received ${lastMarker}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1180, height: 900 },
  acceptDownloads: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const origin = new URL(base).origin;
const externalRequests = [];
const writeRequests = [];
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.origin !== origin) externalRequests.push(request.url());
  if (!['GET', 'HEAD'].includes(request.method())) writeRequests.push(`${request.method()} ${request.url()}`);
});

try {
  await gotoExpected(page);
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-fields] .hex-field[data-field-id]').length >= 7);

  const checkedField = page.locator('[data-fields] .hex-field:not(.root)').first();
  const checkedTitle = (await checkedField.locator('strong').textContent())?.trim();
  await checkedField.click();
  await page.locator('[data-confirm-field]').click();
  await page.locator('[data-fields] .hex-field:not(.root)').first().waitFor();

  const original = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const atlas = library.atlases.find((item) => item.id === library.currentId);
    return {
      fieldCount: atlas.fields.length,
      routeCount: atlas.routes.length,
      trustedCount: atlas.fields.filter((field) => field.id !== 'root' && (field.confirmed || ['confirmed', 'decided'].includes(field.state))).length,
      coordinates: atlas.fields.map((field) => `${field.title}:${field.q}/${field.r}`),
    };
  });
  if (original.trustedCount < 1) throw new Error('Acceptance setup did not create a checked field');

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  await page.locator('[data-screen="library"]:not([hidden])').waitFor();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-screen="library"]:not([hidden]) [data-export-library]').click(),
  ]);
  await download.saveAs(backupPath);

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (backup.kind !== 'reason-engine-atlas-backup' || backup.version !== '0.3') throw new Error('Backup envelope is invalid');
  if (backup.atlases?.[0]?.fields?.length !== original.fieldCount) throw new Error('Backup lost fields');
  if (backup.atlases?.[0]?.routes?.length !== original.routeCount) throw new Error('Backup lost routes');

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden])').waitFor();
  if (await page.locator('.atlas-card').count()) throw new Error('Library was not empty after clearing storage');

  let importDialog = '';
  page.once('dialog', async (dialog) => {
    importDialog = dialog.message();
    await dialog.accept();
  });
  await page.locator('[data-import-input]').setInputFiles(backupPath);
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card').waitFor({ timeout: 30000 });
  if (!importDialog.includes('nicht übernommen')) throw new Error(`Restore disclosure is incomplete: ${importDialog}`);
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card-open').first().click();
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  await page.waitForFunction((count) => document.querySelectorAll('[data-fields] .hex-field').length === count, original.fieldCount);

  const restored = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('reason-engine-atlas-library-v03'));
    const atlas = library.atlases.find((item) => item.id === library.currentId);
    return {
      fieldCount: atlas.fields.length,
      routeCount: atlas.routes.length,
      trustedCount: atlas.fields.filter((field) => field.id !== 'root' && (field.confirmed || ['confirmed', 'decided'].includes(field.state))).length,
      coordinates: atlas.fields.map((field) => `${field.title}:${field.q}/${field.r}`),
      history: atlas.history,
    };
  });

  if (restored.fieldCount !== original.fieldCount) throw new Error(`Restore changed field count ${original.fieldCount} → ${restored.fieldCount}`);
  if (restored.routeCount !== original.routeCount) throw new Error(`Restore changed route count ${original.routeCount} → ${restored.routeCount}`);
  if (restored.trustedCount !== 0) throw new Error('Restore retained imported authority');
  if (JSON.stringify(restored.coordinates) !== JSON.stringify(original.coordinates)) throw new Error('Restore changed field coordinates');
  if (!restored.history.some((event) => event.type === 'import_trust_reset')) throw new Error('Restore trust reset is missing from history');
  if (!restored.history.some((event) => event.type === 'imported')) throw new Error('Restore import event is missing from history');
  if (!checkedTitle) throw new Error('Checked field title was not captured');

  if (externalRequests.length) throw new Error(`Atlas made external requests: ${externalRequests.join(', ')}`);
  if (writeRequests.length) throw new Error(`Atlas made network writes: ${writeRequests.join(', ')}`);
  await page.screenshot({ path: path.join(artifacts, 'atlas-v081-restored.png'), fullPage: true, animations: 'disabled' });
} finally {
  await context.close();
  await browser.close();
}
