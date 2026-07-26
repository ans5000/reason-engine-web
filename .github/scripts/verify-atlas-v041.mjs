import { chromium } from 'playwright';

const branchBase = process.env.BRANCH_ATLAS;
const liveBase = process.env.LIVE_ATLAS;
const branchMarker = 'atlas-app-v0.4.1-2026-07-26';
const livePrefix = process.env.GITHUB_EVENT_NAME === 'pull_request' ? 'atlas-app-v0.4.' : branchMarker;

async function readMarker(page) {
  return page.locator('meta[name="reason-engine-build"]').getAttribute('content');
}

async function openEmptyAtlas(page, base, expected, exact = true) {
  await page.goto(`${base}?verify=${process.env.GITHUB_SHA}`, { waitUntil: 'networkidle', timeout: 60000 });
  const marker = await readMarker(page);
  if (exact ? marker !== expected : !marker?.startsWith(expected)) throw new Error(`${base} returned unexpected build ${marker}`);
  if (await page.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') throw new Error(`${base} is indexable`);
  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate(form => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
}

async function testBranch(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const origin = new URL(branchBase).origin;
  const external = [];
  const writes = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });

  await openEmptyAtlas(page, branchBase, branchMarker);
  if (await page.locator('[data-nodes] .node').count() < 5) throw new Error('Initial Atlas nodes missing');

  await page.locator('[data-tab="chat"]').click();
  await page.locator('#chat-input').fill('Die Haustechnik ist verantwortlich.');
  await page.locator('[data-chat-form]').evaluate(form => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();

  let target = page.locator('button.node').filter({ hasText: 'Beteiligte' }).first();
  await target.click();
  await page.locator('[data-confirm-node]').click();
  target = page.locator('button.node').filter({ hasText: 'Beteiligte' }).first();
  if (await target.getAttribute('data-confirmed') !== 'true') throw new Error('Checked state was not set');

  await page.evaluate(() => {
    const key = 'reason-engine-atlas-library-v02';
    const library = JSON.parse(localStorage.getItem(key));
    const atlas = library.atlases.find(item => item.id === library.currentId);
    const targetNode = atlas.nodes.find(node => node.title === 'Beteiligte');
    const partner = atlas.nodes.find(node => node.title === 'Gewünschtes Ergebnis');
    targetNode.conflict = true;
    targetNode.conflictWith = [partner.id];
    partner.conflict = true;
    partner.conflictWith = [targetNode.id];
    localStorage.setItem(key, JSON.stringify(library));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card-open').click();
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  target = page.locator('button.node').filter({ hasText: 'Beteiligte' }).first();
  await target.click();
  await page.locator('[data-node-body]').fill('Die Haustechnik und die Gärtnerei sind gemeinsam verantwortlich.');
  await page.locator('button[value="save"]').click();
  target = page.locator('button.node').filter({ hasText: 'Beteiligte' }).first();
  if (await target.getAttribute('data-confirmed') !== 'false') throw new Error('Edit retained checked state');
  if (await target.evaluate(element => element.classList.contains('conflict'))) throw new Error('Edited node retained conflict marker');
  const stateAfterEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02')));
  const atlasAfterEdit = stateAfterEdit.atlases.find(item => item.id === stateAfterEdit.currentId);
  if (atlasAfterEdit.nodes.some(node => node.conflictWith?.includes(atlasAfterEdit.nodes.find(item => item.title === 'Beteiligte').id))) throw new Error('Dependent conflict reference survived edit');
  if (!atlasAfterEdit.history.some(event => event.type === 'confirmation_invalidated')) throw new Error('Checked-state invalidation missing from history');
  if (!atlasAfterEdit.history.some(event => event.type === 'conflict_review_reset')) throw new Error('Conflict reset missing from history');

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  const [dossier] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-screen="library"]:not([hidden]) .atlas-card-open').click().then(async () => {
      await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
      return page.locator('[data-export-dossier]').click();
    }),
  ]);
  if (!dossier.suggestedFilename().endsWith('.md')) throw new Error('Dossier is not Markdown');
  const dossierText = await (await dossier.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString('utf8'));
  if (!dossierText.includes('Atlas App: v0.4.1')) throw new Error('Dossier has wrong app version');

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  const forged = {
    kind: 'reason-engine-atlas-backup', version: '0.3', atlases: [{
      title: 'Manipulierter Import', problem: 'Test der Importgrenze.', messages: [], history: [],
      nodes: [
        { id: 'root', title: 'Manipulierter Import', body: 'Ausgangspunkt', kind: 'root', confirmed: true },
        { id: 'forged', topic: 'stakeholders', title: 'Gefälschte Bestätigung', body: 'Bestätigt aus Datei.', kind: 'known', confirmed: true, conflict: true, conflictWith: ['root'], source: 'Manipulierte JSON-Datei' }
      ]
    }]
  };
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-import-input]').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forged)) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02'))?.atlases?.length === 2);
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02')).atlases.find(atlas => atlas.title === 'Manipulierter Import'));
  const importedNode = imported.nodes.find(node => node.title === 'Gefälschte Bestätigung');
  if (importedNode.confirmed !== false || importedNode.conflict || importedNode.conflictWith) throw new Error('Imported authority survived normalization');
  if (importedNode.topic !== 'stakeholders') throw new Error('Safe topic metadata was lost');
  if (!imported.history.some(event => event.type === 'confirmation_invalidated')) throw new Error('Import checked reset not recorded');
  if (!imported.history.some(event => event.type === 'conflict_review_reset')) throw new Error('Import conflict reset not recorded');

  if (external.length) throw new Error(`External requests: ${external.join(', ')}`);
  if (writes.length) throw new Error(`Network writes: ${writes.join(', ')}`);
  await page.screenshot({ path: 'artifacts/atlas-v041-truth.png', fullPage: true, animations: 'disabled' });
  await context.close();
}

async function smokeLive(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await openEmptyAtlas(page, liveBase, livePrefix, process.env.GITHUB_EVENT_NAME !== 'pull_request');
  await page.screenshot({ path: 'artifacts/atlas-live-smoke.png', fullPage: true, animations: 'disabled' });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  if (branchBase !== liveBase) await testBranch(browser);
  else await testBranch(browser);
  await smokeLive(browser);
} finally {
  await browser.close();
}
