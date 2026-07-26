(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v02';
  const BACKUP_KIND = 'reason-engine-atlas-backup';
  const ALLOWED_KINDS = new Set(['root', 'known', 'assumption', 'open', 'decision']);
  const importInput = document.querySelector('[data-import-input]');

  function makeId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function asText(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
  }

  function asDate(value, fallback = now()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  function loadLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      if (stored?.version === '0.2' && Array.isArray(stored.atlases)) return stored;
    } catch (error) {
      console.warn('Atlas library could not be read for backup.', error);
    }
    return { version: '0.2', currentId: null, atlases: [] };
  }

  function saveLibrary(library) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportLibrary() {
    const library = loadLibrary();
    downloadJson(`reason-engine-atlas-sicherung-${new Date().toISOString().slice(0, 10)}.json`, {
      kind: BACKUP_KIND,
      version: '0.3',
      exportedAt: now(),
      atlases: library.atlases
    });
  }

  function position(index) {
    const positions = [[50, 10], [88, 34], [50, 90], [12, 34], [88, 68], [12, 68], [35, 27], [68, 28], [68, 67], [34, 68]];
    const dynamicIndex = Math.max(0, index - 5);
    const point = positions[dynamicIndex % positions.length];
    return { x: point[0], y: point[1] };
  }

  function normalizeNode(raw, index) {
    const requestedKind = ALLOWED_KINDS.has(raw?.kind) ? raw.kind : 'known';
    const isRoot = index === 0 || raw?.id === 'root' || requestedKind === 'root';
    const fallback = position(index);
    const importedConfirmation = !isRoot && Boolean(raw?.confirmed);
    const originalSource = asText(raw?.source, 'Aus JSON-Sicherung importiert').slice(0, 200);
    return {
      id: isRoot ? 'root' : makeId('node'),
      topic: isRoot ? null : asText(raw?.topic, '').slice(0, 80) || null,
      title: asText(raw?.title, isRoot ? 'Importierter Ausgangspunkt' : 'Importierter Eintrag').slice(0, 90),
      body: asText(raw?.body, 'Ohne Inhalt').slice(0, 1600),
      kind: isRoot ? 'root' : requestedKind,
      confirmed: isRoot,
      source: importedConfirmation
        ? `${originalSource}; früherer Prüfstatus beim Import aufgehoben`.slice(0, 240)
        : originalSource,
      x: Number.isFinite(Number(raw?.x)) ? Math.min(95, Math.max(5, Number(raw.x))) : fallback.x,
      y: Number.isFinite(Number(raw?.y)) ? Math.min(95, Math.max(5, Number(raw.y))) : fallback.y
    };
  }

  function normalizeAtlas(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Ein Atlas ist kein gültiges Objekt.');
    const rawProblem = asText(raw.problem || raw.body, 'Importierter Atlas');
    const title = asText(raw.title, rawProblem.split(/[.!?]/)[0] || 'Importierter Atlas').slice(0, 90);
    const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
    const hadImportedConfirmations = rawNodes.some((node, index) => index > 0 && node?.kind !== 'root' && Boolean(node?.confirmed));
    const hadImportedConflicts = rawNodes.some((node) => Boolean(node?.conflict || node?.conflictWith?.length));
    const nodes = rawNodes.length ? rawNodes.slice(0, 250).map(normalizeNode) : [normalizeNode({ id: 'root', title, body: rawProblem }, 0)];
    if (!nodes.some((node) => node.id === 'root')) nodes.unshift(normalizeNode({ id: 'root', title, body: rawProblem }, 0));

    const messages = Array.isArray(raw.messages) ? raw.messages.slice(0, 500).map((message) => ({
      id: makeId('message'),
      role: message?.role === 'user' ? 'user' : 'engine',
      text: asText(message?.text, 'Leerer importierter Eintrag').slice(0, 1200)
    })) : [];

    const history = Array.isArray(raw.history) ? raw.history.slice(-1000).map((event) => ({
      id: makeId('event'),
      at: asDate(event?.at),
      type: asText(event?.type, 'imported').slice(0, 60),
      text: asText(event?.text, 'Importierter Verlaufseintrag').slice(0, 500)
    })) : [];

    history.push({ id: makeId('event'), at: now(), type: 'imported', text: 'Atlas aus einer lokalen JSON-Sicherung importiert.' });
    if (hadImportedConfirmations) {
      history.push({ id: makeId('event'), at: now(), type: 'confirmation_invalidated', text: 'Importierte Prüfstatus wurden nicht übernommen und müssen erneut geprüft werden.' });
    }
    if (hadImportedConflicts) {
      history.push({ id: makeId('event'), at: now(), type: 'conflict_review_reset', text: 'Importierte Widerspruchshinweise wurden nicht übernommen und müssen lokal neu berechnet werden.' });
    }

    return {
      id: makeId('atlas'),
      version: '0.2',
      createdAt: asDate(raw.createdAt),
      updatedAt: now(),
      title,
      problem: rawProblem,
      step: Number.isInteger(raw.step) ? Math.min(6, Math.max(0, raw.step)) : 0,
      messages,
      nodes,
      history
    };
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 5_000_000) throw new Error('Die Sicherung ist größer als 5 MB.');
    const parsed = JSON.parse(await file.text());
    const source = parsed?.kind === BACKUP_KIND && Array.isArray(parsed.atlases)
      ? parsed.atlases
      : Array.isArray(parsed?.atlases)
        ? parsed.atlases
        : [parsed];

    if (!source.length || source.length > 100) throw new Error('Die Sicherung enthält keine gültige oder zu viele Atlanten.');

    const imported = source.map(normalizeAtlas);
    const library = loadLibrary();
    library.atlases.push(...imported);
    library.currentId = imported[0].id;
    saveLibrary(library);
    alert(`${imported.length} Atlas${imported.length === 1 ? '' : 'se'} wurde${imported.length === 1 ? '' : 'n'} importiert. Prüfstatus und Widerspruchshinweise aus Dateien werden aus Sicherheitsgründen nicht übernommen.`);
    location.reload();
  }

  document.querySelector('[data-export-library]')?.addEventListener('click', exportLibrary);
  document.querySelectorAll('[data-import-library]').forEach((button) => button.addEventListener('click', () => importInput?.click()));
  importInput?.addEventListener('change', async () => {
    try {
      await importFile(importInput.files?.[0]);
    } catch (error) {
      console.error('Atlas import failed.', error);
      alert(`Import fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      importInput.value = '';
    }
  });
})();
