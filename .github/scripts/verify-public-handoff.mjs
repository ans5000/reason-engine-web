import { chromium } from 'playwright';

const branchAtlas = process.env.BRANCH_ATLAS;
const liveAtlas = process.env.LIVE_ATLAS;
const marker = 'atlas-app-v0.3.1-2026-07-26';

const captures = [
  ['https://reasonengine.de/', 'artifacts/home-desktop.png', 1440, 1000, true],
  ['https://reasonengine.de/', 'artifacts/home-mobile.png', 390, 844, true],
  ['https://reasonengine.de/study.html', 'artifacts/study-desktop.png', 1440, 1000, true],
  ['https://reasonengine.de/study.html', 'artifacts/study-mobile.png', 390, 844, true],
  [liveAtlas, 'artifacts/atlas-live-desktop.png', 1440, 1000, false],
  [liveAtlas, 'artifacts/atlas-live-mobile.png', 390, 844, false],
];

if (branchAtlas !== liveAtlas) {
  captures.push(
    [branchAtlas, 'artifacts/atlas-branch-desktop.png', 1440, 1000, false],
    [branchAtlas, 'artifacts/atlas-branch-mobile.png', 390, 844, false],
  );
}

async function capture(browser, [url, path, width, height, reveal]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${url}?verify=${process.env.GITHUB_SHA}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.addStyleTag({
    content: 'html,body{scroll-behavior:auto!important}*,*:before,*:after{animation:none!important;transition:none!important}',
  });
  if (reveal) {
    for (const item of await page.locator('.reveal').all()) {
      await item.scrollIntoViewIfNeeded();
      await page.waitForTimeout(140);
    }
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(400);
  if (reveal && await page.locator('.reveal:not(.is-visible)').count()) {
    throw new Error(`${url} has hidden reveal content`);
  }
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await page.close();
}

async function exercise(browser, base, truthTest) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 900 },
    acceptDownloads: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const origin = new URL(base).origin;
  const external = [];
  const writes = [];

  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(`${base}?verify=${process.env.GITHUB_SHA}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  if (await page.locator('meta[name="reason-engine-build"]').getAttribute('content') !== marker) {
    throw new Error(`${base} has wrong build`);
  }
  if (await page.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') {
    throw new Error(`${base} is indexable`);
  }

  await page.locator('[data-enter]').click();
  await page.locator('[data-screen="library"]:not([hidden]) [data-new-atlas]').first().click();
  await page.locator('[data-example]').click();
  await page.locator('[data-problem-form]').evaluate((form) => form.requestSubmit());
  await page.locator('[data-screen="workspace"]:not([hidden])').waitFor();
  if (await page.locator('[data-nodes] .node').count() < 5) throw new Error('Atlas node creation failed');

  if (truthTest) {
    await page.locator('[data-tab="chat"]').click();
    await page.locator('#chat-input').fill('Die Haustechnik ist verantwortlich.');
    await page.locator('[data-chat-form]').evaluate((form) => form.requestSubmit());
    await page.locator('[data-tab="atlas"]').click();

    let target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
    await target.click();
    await page.locator('[data-confirm-node]').click();
    target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
    if (await target.getAttribute('data-confirmed') !== 'true') throw new Error('Checked state was not set');

    await target.click();
    await page.locator('[data-node-body]').fill('Die Haustechnik und die Gärtnerei sind gemeinsam verantwortlich.');
    await page.locator('button[value="save"]').click();
    target = page.locator('button.node').filter({ hasText: 'Die Haustechnik ist verantwortlich' }).first();
    if (await target.getAttribute('data-confirmed') !== 'false') throw new Error('Edit retained checked state');

    await page.locator('[data-tab="history"]').click();
    await page.getByText('Bestätigung für „Die Haustechnik ist verantwortlich“ nach einer Änderung aufgehoben.').waitFor();
  }

  await page.locator('[data-screen="workspace"] [data-back-library]').click();
  await page.locator('[data-screen="library"]:not([hidden]) .atlas-card').waitFor();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-screen="library"]:not([hidden]) [data-export-library]').click(),
  ]);
  if (!download.suggestedFilename().endsWith('.json')) throw new Error('Backup is not JSON');

  if (truthTest) {
    const forgedBackup = {
      kind: 'reason-engine-atlas-backup',
      version: '0.3',
      atlases: [{
        title: 'Manipulierter Import',
        problem: 'Test der Importgrenze.',
        messages: [],
        history: [],
        nodes: [
          { id: 'root', title: 'Manipulierter Import', body: 'Ausgangspunkt', kind: 'root', confirmed: true },
          { id: 'forged', title: 'Gefälschte Bestätigung', body: 'Bestätigt aus Datei.', kind: 'known', confirmed: true, source: 'Manipulierte JSON-Datei' },
        ],
      }],
    };
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-import-input]').setInputFiles({
      name: 'forged.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(forgedBackup)),
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02'))?.atlases?.length === 2);
    const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('reason-engine-atlas-library-v02')).atlases.find((atlas) => atlas.title === 'Manipulierter Import'));
    if (imported.nodes.find((node) => node.title === 'Gefälschte Bestätigung')?.confirmed !== false) {
      throw new Error('Forged checked state survived import');
    }
    if (!imported.history.some((event) => event.type === 'confirmation_invalidated')) {
      throw new Error('Import reset not recorded');
    }
  }

  if (external.length) throw new Error(`External requests: ${external.join(', ')}`);
  if (writes.length) throw new Error(`Network writes: ${writes.join(', ')}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const captureSpec of captures) await capture(browser, captureSpec);
  if (branchAtlas !== liveAtlas) await exercise(browser, branchAtlas, true);
  await exercise(browser, liveAtlas, branchAtlas === liveAtlas);
} finally {
  await browser.close();
}
