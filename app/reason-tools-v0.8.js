(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v03';
  const BOARD = { width: 1600, height: 1100, size: 110 };
  const TOOLS = [
    ['deepdive', 'Deep Dive', 'Vertiefung'],
    ['katet', 'Ka-Tet', 'Diskussion'],
    ['audit', 'Audit', 'Prüfung'],
    ['pilot', 'Pilot', 'Experiment'],
    ['sources', 'Quellen', 'Evidenz'],
    ['relation', 'Relation', 'Verbinden']
  ];
  const ROUTE_LABELS = { supports: 'unterstützt', depends: 'hängt ab von', leads: 'führt zu', blocks: 'blockiert', decides: 'entscheidet über', confirms: 'bestätigt durch' };
  const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  let relationStart = null;
  let observerLock = false;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (value) => localStorage.setItem(KEY, JSON.stringify(value));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const now = () => new Date().toISOString();
  const coordKey = (q, r) => `${q},${r}`;
  const axialToPixel = (q, r) => ({ x: BOARD.width / 2 + BOARD.size * 1.5 * q, y: BOARD.height / 2 + BOARD.size * Math.sqrt(3) * (r + q / 2) });
  const ring = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r));
  const record = (atlas, type, text) => {
    atlas.history ||= [];
    atlas.history.push({ id: makeId('event'), at: now(), type, text });
    atlas.updatedAt = now();
  };

  function nearestFree(atlas, origin, preferred = 0) {
    const occupied = new Set(atlas.fields.map((field) => coordKey(field.q, field.r)));
    for (let radius = 1; radius <= 8; radius += 1) {
      for (let offset = 0; offset < DIRECTIONS.length; offset += 1) {
        const direction = DIRECTIONS[(preferred + offset) % DIRECTIONS.length];
        const q = origin.q + direction[0] * radius;
        const r = origin.r + direction[1] * radius;
        if (!occupied.has(coordKey(q, r))) return { q, r };
      }
    }
    return { q: origin.q + 1, r: origin.r };
  }

  function createField(atlas, source, spec, preferred) {
    const point = nearestFree(atlas, source, preferred);
    const field = {
      id: makeId('field'), key: null, title: spec.title, body: spec.body,
      fieldType: spec.fieldType, state: 'provisional', confirmed: false,
      source: `Reason-Werkzeug auf „${source.title}“`, q: point.q, r: point.r,
      parentFieldId: source.id, tool: spec.tool
    };
    atlas.fields.push(field);
    atlas.routes.push({ id: makeId('route'), from: source.id, to: field.id, type: spec.route || 'leads', tool: spec.tool });
    return field;
  }

  function toolSpecs(tool, field) {
    const name = field.title;
    if (tool === 'deepdive') return [
      { tool, title: `Kernfrage: ${name}`, body: `Welche präzise Frage muss beantwortet werden, damit „${name}“ belastbar wird?`, fieldType: 'question', route: 'depends' },
      { tool, title: `Evidenz für ${name}`, body: `Welche Beobachtungen, Quellen oder Daten stützen dieses Feld tatsächlich?`, fieldType: 'question', route: 'confirms' },
      { tool, title: `Gegenprobe: ${name}`, body: `Welche Beobachtung würde dieses Feld widerlegen oder deutlich schwächen?`, fieldType: 'risk', route: 'blocks' }
    ];
    if (tool === 'katet') return [
      { tool, title: `Ka-Tet · ${name}`, body: `Mehrperspektivische Diskussion: Befürwortung, Gegenposition, Evidenzprüfung und Synthese zu „${name}“.`, fieldType: 'process', route: 'leads' }
    ];
    if (tool === 'audit') return [
      { tool, title: `Audit · ${name}`, body: `Prüfe Behauptung, Evidenzstatus, Gegenargumente, Abhängigkeiten und mögliche Folgen dieses Feldes.`, fieldType: 'risk', route: 'blocks' }
    ];
    if (tool === 'pilot') return [
      { tool, title: `Pilot · ${name}`, body: `Kleinstes reversibles Experiment mit Ziel, Hypothese, Erfolgskriterium, Messwert und Abbruchregel.`, fieldType: 'decision', route: 'leads' }
    ];
    if (tool === 'sources') return [
      { tool, title: `Quellen · ${name}`, body: `Evidenz-Hook: Quellen, Beobachtungen und letzte Überprüfung für dieses Feld dokumentieren.`, fieldType: 'resource', route: 'confirms' }
    ];
    return [];
  }

  function applyTool(tool, fieldId) {
    if (tool === 'relation') return beginRelation(fieldId);
    const library = read();
    const atlas = current(library);
    const field = atlas?.fields.find((item) => item.id === fieldId);
    if (!field) return;
    const created = toolSpecs(tool, field).map((spec, index) => createField(atlas, field, spec, index));
    record(atlas, `tool_${tool}`, `${TOOLS.find((item) => item[0] === tool)?.[1] || tool} auf „${field.title}“ angewendet; ${created.length} Folgefeld(er) erzeugt.`);
    write(library);
    sessionStorage.setItem('reason-engine-atlas-reopen-v07', 'true');
    location.reload();
  }

  function beginRelation(fieldId) {
    relationStart = fieldId;
    document.body.classList.add('relation-picking');
    const field = document.querySelector(`.hex-field[data-field-id="${CSS.escape(fieldId)}"]`);
    field?.classList.add('relation-source');
    showToast('Zielfeld wählen. Es darf überall auf der Karte liegen.');
  }

  function finishRelation(targetId) {
    if (!relationStart || relationStart === targetId) return;
    const type = prompt('Beziehung: supports, depends, leads, blocks, decides oder confirms', 'supports');
    if (!ROUTE_LABELS[type]) { cancelRelation(); return; }
    const library = read();
    const atlas = current(library);
    const from = atlas?.fields.find((field) => field.id === relationStart);
    const to = atlas?.fields.find((field) => field.id === targetId);
    if (!from || !to) return cancelRelation();
    const exists = atlas.routes.some((route) => route.from === from.id && route.to === to.id && route.type === type);
    if (!exists) {
      atlas.routes.push({ id: makeId('route'), from: from.id, to: to.id, type, confidence: 'unrated', createdAt: now(), source: 'manuell über Hex-Werkzeugkasten' });
      record(atlas, 'network_relation_created', `Fernrelation „${from.title} ${ROUTE_LABELS[type]} ${to.title}“ angelegt.`);
      write(library);
    }
    cancelRelation();
    location.reload();
  }

  function cancelRelation() {
    relationStart = null;
    document.body.classList.remove('relation-picking');
    document.querySelectorAll('.relation-source').forEach((node) => node.classList.remove('relation-source'));
  }

  function showToast(text) {
    let toast = document.querySelector('[data-atlas-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.dataset.atlasToast = '';
      toast.className = 'atlas-toast';
      document.body.append(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function makeToolbox(field) {
    const box = document.createElement('div');
    box.className = 'hex-toolbox';
    box.setAttribute('role', 'toolbar');
    box.setAttribute('aria-label', `Werkzeuge für ${field.title}`);
    TOOLS.forEach(([key, label, hint]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `hex-tool tool-${key}`;
      button.draggable = true;
      button.dataset.tool = key;
      button.title = `${label}: ${hint}`;
      button.innerHTML = `<span>${label}</span><small>${hint}</small>`;
      button.addEventListener('click', (event) => { event.stopPropagation(); applyTool(key, field.id); });
      button.addEventListener('dragstart', (event) => {
        event.stopPropagation();
        event.dataTransfer.setData('application/x-atlas-tool', key);
        event.dataTransfer.setData('text/plain', key);
      });
      box.append(button);
    });
    return box;
  }

  function enhanceFields() {
    if (observerLock) return;
    const library = read();
    const atlas = current(library);
    const buttons = [...document.querySelectorAll('[data-fields] .hex-field')];
    if (!atlas || !buttons.length) return;
    observerLock = true;
    buttons.forEach((button, index) => {
      const field = atlas.fields[index];
      if (!field) return;
      button.dataset.fieldId = field.id;
      button.dataset.ring = ring(field.q, field.r);
      if (!button.parentElement?.classList.contains('hex-shell')) {
        const shell = document.createElement('div');
        shell.className = 'hex-shell';
        shell.style.left = button.style.left;
        shell.style.top = button.style.top;
        button.style.left = '0px'; button.style.top = '0px';
        button.parentNode.insertBefore(shell, button);
        shell.append(button, makeToolbox(field));
      }
      button.addEventListener('dragover', (event) => event.preventDefault());
      button.addEventListener('drop', (event) => {
        event.preventDefault(); event.stopPropagation();
        const tool = event.dataTransfer.getData('application/x-atlas-tool') || event.dataTransfer.getData('text/plain');
        if (TOOLS.some(([key]) => key === tool)) applyTool(tool, field.id);
      });
      button.addEventListener('click', (event) => {
        if (!relationStart) return;
        event.preventDefault(); event.stopImmediatePropagation();
        finishRelation(field.id);
      }, true);
    });
    renderNetwork(atlas);
    observerLock = false;
  }

  function renderNetwork(atlas) {
    const board = document.querySelector('[data-map-board]');
    if (!board) return;
    let layer = board.querySelector('[data-network-layer]');
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      layer.setAttribute('class', 'network-layer');
      layer.setAttribute('data-network-layer', '');
      layer.setAttribute('viewBox', `0 0 ${BOARD.width} ${BOARD.height}`);
      board.insertBefore(layer, board.querySelector('[data-fields]'));
    }
    layer.replaceChildren();
    atlas.routes.forEach((route) => {
      const from = atlas.fields.find((field) => field.id === route.from);
      const to = atlas.fields.find((field) => field.id === route.to);
      if (!from || !to) return;
      const a = axialToPixel(from.q, from.r), b = axialToPixel(to.q, to.r);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const bend = Math.min(70, Math.hypot(b.x-a.x, b.y-a.y) * 0.12);
      const cx = mx - (b.y-a.y) / Math.max(1, Math.hypot(b.x-a.x,b.y-a.y)) * bend;
      const cy = my + (b.x-a.x) / Math.max(1, Math.hypot(b.x-a.x,b.y-a.y)) * bend;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
      path.setAttribute('class', `flight-route route-${route.type}`);
      const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hub.setAttribute('cx', cx); hub.setAttribute('cy', cy); hub.setAttribute('r', '8');
      hub.setAttribute('class', `route-hub route-${route.type}`);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', cx + 12); label.setAttribute('y', cy - 10);
      label.setAttribute('class', 'route-label');
      label.textContent = ROUTE_LABELS[route.type] || route.type;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${from.title} ${ROUTE_LABELS[route.type] || route.type} ${to.title}`;
      hub.append(title);
      layer.append(path, hub, label);
    });
  }

  function addNetworkToggle() {
    const tools = document.querySelector('.map-tools');
    if (!tools || tools.querySelector('[data-toggle-network]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.toggleNetwork = '';
    button.className = 'network-toggle active';
    button.textContent = 'Flugnetz';
    button.addEventListener('click', () => {
      const board = document.querySelector('[data-map-board]');
      const active = !board.classList.toggle('network-hidden');
      button.classList.toggle('active', active);
      button.textContent = active ? 'Flugnetz' : 'Netz aus';
    });
    tools.prepend(button);
  }

  const fields = document.querySelector('[data-fields]');
  if (fields) new MutationObserver(() => { enhanceFields(); addNetworkToggle(); }).observe(fields, { childList: true });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && relationStart) cancelRelation(); });
  setTimeout(() => { enhanceFields(); addNetworkToggle(); }, 50);
})();