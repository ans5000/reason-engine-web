import fs from 'node:fs';
import { chromium } from 'playwright';

const branchBase = process.env.BRANCH_ATLAS;
const liveBase = process.env.LIVE_ATLAS;
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';
const branchMarker = 'atlas-app-v0.5.1-2026-07-26';
const liveMarker = isPullRequest ? 'atlas-app-v0.5.0-2026-07-26' : branchMarker;

async function openNewAtlas(page, base, marker) {
  await page.goto(`${base}?verify=${process.env.GITHUB_SHA}`, { waitUntil: 'networkidle', timeout: 60000 });
  const actual = await page.locator('meta[name="reason-engine-build"]').getAttribute('content');
  if (actual !== marker) throw new Error(`${base} returned ${actual}, expected ${marker}`);
  if (await page.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') throw new Error(`${base} is indexable`);
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
}

async function smokeLive(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await openNewAtlas(page, liveBase, liveMarker);
  if (await page.locator('[data-nodes] .node').count() < 5) throw new Error('Production Atlas did not create its initial map');
  await page.screenshot({ path: 'artifacts/atlas-live.png', fullPage: true, animations: 'disabled' });
  await context.close();
}

async function verifyBranch(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const origin = new URL(branchBase).origin;
  const external = [];
  const writes = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });

  await openNewAtlas(page, branchBase, branchMarker);
  const initialCount = await page.locator('[data-nodes] .node').count();
  await page.locator('[data-tab="chat"]').click();
  await page.locator('#chat-input').fill('Die Haustechnik ist verantwortlich.');
  await page.locator('[data-chat-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  if (await page.locator('[data-nodes] .node').count() !== initialCount + 1) throw new Error('A conversation input did not create exactly one new hex');

  let target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
  await target.click();
  await page.locator('[data-confirm-node]').click();
  target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
  if (await target.getAttribute('data-confirmed') !== 'true') throw new Error('Checked state was not applied');

  await page.evaluate(() => {
    const key = 'reason-engine-atlas-library-v02';
    const library = JSON.parse(localStorage.getItem(key));
    const atlas = library.atlases.find((item) => item.id === library.currentId);
    const targetNode = atlas.nodes.find((node) => node.body === 'Die Haustechnik ist verantwortlich.');
    const partner = atlas.nodes.find((node) => node.id !== targetNode.id && node.kind !== 'root');
    targetNode.conflict = true;
    targetNode.conflictWith = [partner.id];
    partner.conflict = true;
    partner.conflictWith = [targetNode.id];
    localStorage.setItem(key, JSON.stringify(library));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card-open').click();
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
  await target.click();
  await page.locator('[data-node-body]').fill('Die Haustechnik und die Gärtnerei sind gemeinsam verantwortlich.');
  await page.locator('button[value="save"]').click();

  target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
  if (await target.getAttribute('data-confirmed') !== 'false') throw new Error('Editing retained checked state');
  const editedState = await page.evaluate(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02')));
  const editedAtlas = editedState.atlases.find((item) => item.id === editedState.currentId);
  const editedNode = editedAtlas.nodes.find((node) => node.body.includes('Gärtnerei'));
  if (editedNode.conflict || editedNode.conflictWith) throw new Error('Editing retained stale conflict metadata');
  if (editedAtlas.nodes.some((node) => node.conflictWith?.includes(editedNode.id))) throw new Error('A partner retained a stale conflict reference');
  if (!editedAtlas.history.some((event) => event.type === 'confirmation_invalidated')) throw new Error('Checked reset was not recorded');
  if (!editedAtlas.history.some((event) => event.type === 'conflict_review_reset')) throw new Error('Conflict reset was not recorded');

  const dossierPath = `${process.cwd()}/artifacts/atlas-v051-dossier.md`;
  const [dossier] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-export-dossier]').click(),
  ]);
  await dossier.saveAs(dossierPath);
  const dossierText = fs.readFileSync(dossierPath, 'utf8');
  if (!dossierText.includes('Atlas App: v0.5.1')) throw new Error('Dossier reports the wrong app version');
  if (!dossierText.includes('Gebiet: Beteiligte')) throw new Error('Dossier lost safe district metadata');

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  const forgedBackup = {
    kind: 'reason-engine-atlas-backup',
    version: '0.3',
    atlases: [{
      title: 'Manipulierter Import',
      problem: 'Prüfung der Importgrenze.',
      messages: [],
      history: [],
      nodes: [
        { id: 'root', title: 'Manipulierter Import', body: 'Ausgangspunkt', kind: 'root', confirmed: true },
        { id: 'forged', topic: 'stakeholders', district: 'Beteiligte', title: 'Gefälschte Bestätigung', body: 'Bestätigt aus Datei.', kind: 'known', confirmed: true, conflict: true, conflictWith: ['root'], source: 'Manipulierte JSON-Datei', createdAt: new Date().toISOString() }
      ]
    }]
  };
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import-input]').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forgedBackup)) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02'))?.atlases?.length === 2);
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02')).atlases.find((atlas) => atlas.title === 'Manipulierter Import'));
  const forged = imported.nodes.find((node) => node.title === 'Gefälschte Bestätigung');
  if (forged.confirmed !== false || forged.conflict || forged.conflictWith) throw new Error('Imported authority survived normalization');
  if (forged.topic !== 'stakeholders' || forged.district !== 'Beteiligte') throw new Error('Safe hex metadata was lost during import');
  if (!imported.history.some((event) => event.type === 'confirmation_invalidated')) throw new Error('Imported checked reset was not recorded');
  if (!imported.history.some((event) => event.type === 'conflict_review_reset')) throw new Error('Imported conflict reset was not recorded');

  if (external.length) throw new Error(`External Atlas requests: ${external.join(', ')}`);
  if (writes.length) throw new Error(`Atlas network writes: ${writes.join(', ')}`);
  await page.screenshot({ path: 'artifacts/atlas-v051-truth.png', fullPage: true, animations: 'disabled' });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyBranch(browser);
  await smokeLive(browser);
} finally {
  await browser.close();
}
