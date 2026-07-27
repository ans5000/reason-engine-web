(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v03';
  const BACKUP_KIND = 'reason-engine-atlas-backup';
  const FIELD_TYPES = new Set(['problem', 'statement', 'assumption', 'question', 'decision', 'resource', 'risk', 'process', 'actor', 'rule']);
  const FIELD_STATES = new Set(['empty', 'provisional', 'confirmed', 'critical', 'decided']);
  const ROUTE_TYPES = new Set(['supports', 'depends', 'leads', 'blocks', 'decides', 'confirms']);
  const PATH_STATES = new Set(['trace', 'path', 'road']);
  const SUGGESTION_STATES = new Set(['active', 'deferred']);
  const LEGACY_TYPES = { root: 'problem', known: 'statement', open: 'question' };
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
      if (stored?.version === '0.3' && Array.isArray(stored.atlases)) return stored;
    } catch (error) {
      console.warn('Atlas library could not be read for backup.', error);
    }
    return { version: '0.3', currentId: null, atlases: [] };
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

  function legacyNodes(atlas) {
    return (atlas.fields || []).map((field) => ({
      id: field.id,
      title: field.title,
      body: field.body,
      kind: field.id === 'root' ? 'root' : ({ statement: 'known', question: 'open' }[field.fieldType] || field.fieldType),
      confirmed: Boolean(field.confirmed || field.state === 'confirmed' || field.state === 'decided'),
      source: field.source,
      q: field.q,
      r: field.r
    }));
  }

  function exportLibrary() {
    const library = loadLibrary();
    downloadJson(`reason-engine-atlas-sicherung-${new Date().toISOString().slice(0, 10)}.json`, {
      kind: BACKUP_KIND,
      version: '0.3',
      exportedAt: now(),
      atlases: library.atlases.map((atlas) => ({ ...atlas, nodes: legacyNodes(atlas) }))
    });
  }

  function ringCoordinates(maxRing = 10) {
    const result = [];
    for (let radius = 1; radius <= maxRing; radius += 1) {
      for (let q = -radius; q <= radius; q += 1) {
        for (let r = -radius; r <= radius; r += 1) {
          const s = -q - r;
          if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) === radius) result.push({ q, r });
        }
      }
    }
    return result;
  }

  const FALLBACK_COORDS = ringCoordinates();

  function coordinate(raw, index, occupied, isRoot) {
    if (isRoot) return { q: 0, r: 0 };
    const q = Number(raw?.q);
    const r = Number(raw?.r);
    if (Number.isInteger(q) && Number.isInteger(r) && Math.abs(q) <= 10 && Math.abs(r) <= 10 && !occupied.has(`${q},${r}`)) return { q, r };
    return FALLBACK_COORDS.find((item) => !occupied.has(`${item.q},${item.r}`)) || { q: index + 1, r: 0 };
  }

  function normalizeType(raw, isRoot) {
    if (isRoot) return 'problem';
    const requested = LEGACY_TYPES[raw?.fieldType || raw?.kind] || raw?.fieldType || raw?.kind;
    return FIELD_TYPES.has(requested) && requested !== 'problem' ? requested : 'statement';
  }

  function normalizeState(raw, isRoot, type, body) {
    if (isRoot) return 'confirmed';
    if (FIELD_STATES.has(raw?.state)) return raw.state;
    if (raw?.confirmed) return type === 'decision' ? 'decided' : 'confirmed';
    if (/noch nicht geklärt/i.test(body)) return 'empty';
    return 'provisional';
  }

  function normalizeFields(rawAtlas) {
    const rawFields = Array.isArray(rawAtlas?.fields) && rawAtlas.fields.length
      ? rawAtlas.fields
      : Array.isArray(rawAtlas?.nodes) ? rawAtlas.nodes : [];
    const occupied = new Set();
    const idMap = new Map();
    const fields = rawFields.slice(0, 250).map((raw, index) => {
      const oldId = asText(raw?.id, `legacy-${index}`);
      const isRoot = index === 0 || oldId === 'root' || raw?.fieldType === 'problem' || raw?.kind === 'root';
      const id = isRoot ? 'root' : makeId('field');
      const point = coordinate(raw, index, occupied, isRoot);
      occupied.add(`${point.q},${point.r}`);
      idMap.set(oldId, id);
      const body = asText(raw?.body, isRoot ? asText(rawAtlas?.problem, 'Importierter Ausgangspunkt') : 'Ohne Inhalt').slice(0, 1600);
      const type = normalizeType(raw, isRoot);
      const state = normalizeState(raw, isRoot, type, body);
      const field = {
        id,
        key: asText(raw?.key, '') || null,
        title: asText(raw?.title, isRoot ? 'Importierter Ausgangspunkt' : 'Importiertes Feld').slice(0, 90),
        body,
        fieldType: type,
        state,
        confirmed: isRoot || state === 'confirmed' || state === 'decided',
        source: asText(raw?.source, 'Aus JSON-Sicherung importiert').slice(0, 240),
        q: point.q,
        r: point.r
      };
      if (raw?.pathOrigin === 'desired_path') field.pathOrigin = 'desired_path';
      if (Number.isInteger(raw?.pathDepth) && raw.pathDepth >= 0 && raw.pathDepth <= 100) field.pathDepth = raw.pathDepth;
      if (raw?.isCenter === true && !isRoot) field.isCenter = true;
      const parent = asText(raw?.parentFieldId);
      const center = asText(raw?.centerId);
      if (parent) field._legacyParentFieldId = parent;
      if (center) field._legacyCenterId = center;
      return field;
    });

    if (!fields.some((field) => field.id === 'root')) {
      fields.unshift({
        id: 'root', key: 'problem', title: 'Importierter Ausgangspunkt',
        body: asText(rawAtlas?.problem, 'Importierter Atlas').slice(0, 1600),
        fieldType: 'problem', state: 'confirmed', confirmed: true,
        source: 'Aus JSON-Sicherung importiert', q: 0, r: 0
      });
      idMap.set('root', 'root');
    }

    fields.forEach((field) => {
      if (field._legacyParentFieldId) {
        field.parentFieldId = idMap.get(field._legacyParentFieldId) || null;
        delete field._legacyParentFieldId;
      }
      if (field._legacyCenterId) {
        field.centerId = idMap.get(field._legacyCenterId) || 'root';
        delete field._legacyCenterId;
      }
    });
    return { fields, idMap };
  }

  function normalizeRoutes(rawAtlas, fields, idMap) {
    const fieldIds = new Set(fields.map((field) => field.id));
    const seen = new Set();
    const routes = [];
    if (Array.isArray(rawAtlas?.routes)) {
      rawAtlas.routes.slice(0, 500).forEach((raw) => {
        const from = idMap.get(asText(raw?.from)) || asText(raw?.from);
        const to = idMap.get(asText(raw?.to)) || asText(raw?.to);
        if (!fieldIds.has(from) || !fieldIds.has(to) || from === to) return;
        const routeKey = [from, to].sort().join('|');
        if (seen.has(routeKey)) return;
        seen.add(routeKey);
        const route = { id: makeId('route'), from, to, type: ROUTE_TYPES.has(raw?.type) ? raw.type : 'supports' };
        if (raw?.pathOrigin === 'desired_path') {
          route.pathOrigin = 'desired_path';
          route.pathState = PATH_STATES.has(raw?.pathState) ? raw.pathState : 'trace';
          route.pathUses = Math.min(999, Math.max(1, Number(raw?.pathUses) || 1));
          route.createdAt = asDate(raw?.createdAt);
          route.lastUsedAt = asDate(raw?.lastUsedAt, route.createdAt);
        }
        routes.push(route);
      });
    }
    if (!routes.length) {
      fields.filter((field) => field.id !== 'root').forEach((field) => routes.push({ id: makeId('route'), from: 'root', to: field.id, type: 'supports' }));
    }
    return routes;
  }

  function normalizePathGrowth(rawAtlas, fields, idMap) {
    const raw = rawAtlas?.pathGrowth;
    if (!raw || typeof raw !== 'object') return undefined;
    const ids = new Set(fields.map((field) => field.id));
    const remap = (fieldId) => idMap.get(asText(fieldId)) || asText(fieldId);
    const centers = ['root'];
    (Array.isArray(raw.centers) ? raw.centers : []).forEach((fieldId) => {
      const mapped = remap(fieldId);
      if (ids.has(mapped) && !centers.includes(mapped)) centers.push(mapped);
    });
    const centerCandidates = [];
    (Array.isArray(raw.centerCandidates) ? raw.centerCandidates : []).forEach((fieldId) => {
      const mapped = remap(fieldId);
      if (ids.has(mapped) && mapped !== 'root' && !centers.includes(mapped) && !centerCandidates.includes(mapped)) centerCandidates.push(mapped);
    });
    const suggestions = [];
    (Array.isArray(raw.suggestions) ? raw.suggestions : []).slice(0, 250).forEach((item) => {
      const sourceFieldId = remap(item?.sourceFieldId);
      const q = Number(item?.q);
      const r = Number(item?.r);
      if (!ids.has(sourceFieldId) || !Number.isInteger(q) || !Number.isInteger(r) || Math.abs(q) > 10 || Math.abs(r) > 10) return;
      const fieldType = FIELD_TYPES.has(item?.fieldType) && item.fieldType !== 'problem' ? item.fieldType : 'statement';
      suggestions.push({
        id: makeId('next'),
        sourceFieldId,
        title: asText(item?.title, 'Nächstes Hex').slice(0, 90),
        body: asText(item?.body, 'Noch nicht geklärt.').slice(0, 1600),
        fieldType,
        routeType: ROUTE_TYPES.has(item?.routeType) ? item.routeType : 'leads',
        status: SUGGESTION_STATES.has(item?.status) ? item.status : 'active',
        q,
        r,
        createdAt: asDate(item?.createdAt),
        generatedFromSignature: asText(item?.generatedFromSignature).slice(0, 3600)
      });
    });
    const lastSignatures = {};
    if (raw.lastSignatures && typeof raw.lastSignatures === 'object') {
      Object.entries(raw.lastSignatures).forEach(([oldId, value]) => {
        const mapped = remap(oldId);
        if (ids.has(mapped) && typeof value === 'string') lastSignatures[mapped] = value.slice(0, 3600);
      });
    }
    return {
      version: '0.1',
      suggestions,
      centers,
      centerCandidates,
      lastSignatures,
      showDeferred: Boolean(raw.showDeferred)
    };
  }

  function normalizeAtlas(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Ein Atlas ist kein gültiges Objekt.');
    const rawProblem = asText(raw.problem || raw.body, 'Importierter Atlas');
    const { fields, idMap } = normalizeFields(raw);
    const root = fields.find((field) => field.id === 'root');
    const title = asText(raw.title, root?.title || rawProblem.split(/[.!?]/)[0] || 'Importierter Atlas').slice(0, 90);
    if (root) {
      root.title ||= title;
      root.body ||= rawProblem;
    }

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

    const atlas = {
      id: makeId('atlas'),
      version: '0.3',
      createdAt: asDate(raw.createdAt),
      updatedAt: now(),
      title,
      problem: rawProblem,
      step: Number.isInteger(raw.step) ? Math.min(6, Math.max(0, raw.step)) : 0,
      messages,
      fields,
      routes: normalizeRoutes(raw, fields, idMap),
      history
    };
    const pathGrowth = normalizePathGrowth(raw, fields, idMap);
    if (pathGrowth) atlas.pathGrowth = pathGrowth;
    return atlas;
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 5_000_000) throw new Error('Die Sicherung ist größer als 5 MB.');
    const parsed = JSON.parse(await file.text());
    const source = parsed?.kind === BACKUP_KIND && Array.isArray(parsed.atlases)
      ? parsed.atlases
      : Array.isArray(parsed?.atlases) ? parsed.atlases : [parsed];
    if (!source.length || source.length > 100) throw new Error('Die Sicherung enthält keine gültigen oder zu viele Atlanten.');

    const imported = source.map(normalizeAtlas);
    const library = loadLibrary();
    library.atlases.push(...imported);
    library.currentId = imported[0].id;
    saveLibrary(library);
    alert(`${imported.length} Atlas${imported.length === 1 ? '' : 'se'} wurde${imported.length === 1 ? '' : 'n'} importiert.`);
    location.reload();
  }

  const fieldsRoot = document.querySelector('[data-fields]');
  const markCompatibilityNodes = () => fieldsRoot?.querySelectorAll('.hex-field').forEach((field) => field.classList.add('node'));
  if (fieldsRoot) new MutationObserver(markCompatibilityNodes).observe(fieldsRoot, { childList: true });

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
