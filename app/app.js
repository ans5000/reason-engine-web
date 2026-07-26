(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v03';
  const V02_KEY = 'reason-engine-atlas-library-v02';
  const V01_KEY = 'reason-engine-atlas-v01';
  const ONBOARDING_KEY = 'reason-engine-atlas-onboarded-v03';
  const BOARD = { width: 1600, height: 1100, size: 110 };
  const TYPE_LABELS = {
    problem: 'Problemkern',
    statement: 'Aussage',
    assumption: 'Annahme',
    question: 'Offene Frage',
    decision: 'Entscheidung',
    resource: 'Ressource',
    risk: 'Risiko',
    process: 'Prozessschritt',
    actor: 'Beteiligter Bereich',
    rule: 'Regel / Grenze'
  };
  const STATE_LABELS = {
    empty: 'ungeklärt',
    provisional: 'vorläufig',
    confirmed: 'bestätigt',
    critical: 'kritisch',
    decided: 'entschieden'
  };
  const ROUTE_LABELS = {
    supports: 'unterstützt',
    depends: 'hängt ab von',
    leads: 'führt zu',
    blocks: 'blockiert',
    decides: 'entscheidet über',
    confirms: 'bestätigt durch'
  };
  const EXAMPLE = 'Wir müssen ungefähr 50 Weihnachtsbäume im Krankenhaus verteilen. Bisher werden die Standorte auf einem alten Holzbrett notiert, auf dem noch Häkchen aus mehreren Jahren stehen. Änderungen gehen verloren, Zuständigkeiten sind unklar und am Ende weiß niemand sicher, ob jeder Baum am richtigen Ort steht.';
  const PLAN = [
    { key: 'actors', title: 'Beteiligte', fieldType: 'actor', question: 'Wer ist an diesem Problem beteiligt oder davon betroffen?' },
    { key: 'outcome', title: 'Ziel / Ergebnis', fieldType: 'statement', question: 'Was wäre ein gutes, überprüfbares Ergebnis?' },
    { key: 'rules', title: 'Regeln / Grenzen', fieldType: 'rule', question: 'Welche Regeln, Grenzen oder Ressourcen müssen berücksichtigt werden?' },
    { key: 'process', title: 'Ablauf heute', fieldType: 'process', question: 'Wie läuft der Prozess heute tatsächlich ab, Schritt für Schritt?' },
    { key: 'friction', title: 'Engpass', fieldType: 'risk', question: 'Wo entsteht momentan der größte Verlust, Konflikt oder Zeitaufwand?' },
    { key: 'decision', title: 'Nächste Entscheidung', fieldType: 'decision', question: 'Welche Entscheidung muss als Nächstes getroffen werden?' }
  ];
  const RING_ONE = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const screens = $$('[data-screen]');
  const workspace = $('[data-screen="workspace"]');
  const problemInput = $('#problem-input');
  const chatInput = $('#chat-input');
  const messages = $('[data-messages]');
  const fieldsLayer = $('[data-fields]');
  const routesLayer = $('[data-routes]');
  const mapBoard = $('[data-map-board]');
  const mapCanvas = $('[data-map-canvas]');
  const stage = $('[data-stage]');
  const title = $('[data-title]');
  const atlasList = $('[data-atlas-list]');
  const emptyLibrary = $('[data-empty-library]');
  const historyList = $('[data-history]');
  const fieldCount = $('[data-field-count]');
  const routeCount = $('[data-route-count]');
  const dialog = $('[data-field-dialog]');
  const fieldForm = $('[data-field-form]');
  const fieldDialogLabel = $('[data-field-dialog-label]');
  const fieldTitle = $('[data-field-title]');
  const fieldBody = $('[data-field-body]');
  const fieldType = $('[data-field-type]');
  const fieldState = $('[data-field-state]');
  const fieldPosition = $('[data-field-position]');
  const fieldSource = $('[data-field-source]');
  const routeEditor = $('[data-route-editor]');
  const routeTarget = $('[data-route-target]');
  const routeType = $('[data-route-type]');
  const routeList = $('[data-route-list]');

  let library = loadLibrary();
  let currentId = library.currentId || null;
  let selectedFieldId = null;
  let fieldMode = 'edit';
  let zoom = window.matchMedia('(max-width: 700px)').matches ? 0.72 : 0.9;

  function makeId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function currentAtlas() {
    return library.atlases.find((atlas) => atlas.id === currentId) || null;
  }

  function loadLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      if (stored?.version === '0.3' && Array.isArray(stored.atlases)) return stored;
    } catch (error) {
      console.warn('Atlas library v0.3 could not be read.', error);
    }

    const fromV02 = migrateV02();
    if (fromV02) return fromV02;

    const fromV01 = migrateV01();
    if (fromV01) return fromV01;

    return { version: '0.3', currentId: null, atlases: [] };
  }

  function migrateV02() {
    try {
      const previous = JSON.parse(localStorage.getItem(V02_KEY));
      if (!previous || previous.version !== '0.2' || !Array.isArray(previous.atlases)) return null;
      const atlases = previous.atlases.map((atlas) => migrateAtlas(atlas, 'v0.2'));
      const migrated = { version: '0.3', currentId: previous.currentId || atlases[0]?.id || null, atlases };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
      localStorage.removeItem(V02_KEY);
      return migrated;
    } catch (error) {
      console.warn('Atlas v0.2 migration failed.', error);
      return null;
    }
  }

  function migrateV01() {
    try {
      const previous = JSON.parse(localStorage.getItem(V01_KEY));
      if (!previous || previous.version !== '0.1') return null;
      const atlas = migrateAtlas({ ...previous, id: makeId('atlas') }, 'v0.1');
      const migrated = { version: '0.3', currentId: atlas.id, atlases: [atlas] };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
      localStorage.removeItem(V01_KEY);
      return migrated;
    } catch (error) {
      console.warn('Atlas v0.1 migration failed.', error);
      return null;
    }
  }

  function migrateAtlas(previous, sourceVersion) {
    const previousFields = Array.isArray(previous.fields) ? previous.fields : (Array.isArray(previous.nodes) ? previous.nodes : []);
    const occupied = new Set();
    const fields = previousFields.map((item) => {
      const isRoot = item.id === 'root' || item.fieldType === 'problem' || item.kind === 'root';
      const coordinate = isRoot ? { q: 0, r: 0 } : nextCoordinateFromSet(occupied);
      occupied.add(coordKey(coordinate.q, coordinate.r));
      const mappedType = isRoot ? 'problem' : mapLegacyType(item.fieldType || item.kind);
      const body = item.body || 'Noch nicht geklärt.';
      const state = isRoot ? 'confirmed' : mapLegacyState(item.state, item.confirmed, mappedType, body);
      return {
        id: isRoot ? 'root' : (item.id || makeId('field')),
        key: item.key || null,
        title: item.title || 'Unbenanntes Feld',
        body,
        fieldType: mappedType,
        state,
        confirmed: isRoot || state === 'confirmed' || state === 'decided',
        source: item.source || `Aus ${sourceVersion} übernommen`,
        q: coordinate.q,
        r: coordinate.r
      };
    });

    if (!fields.some((field) => field.id === 'root')) {
      fields.unshift({
        id: 'root',
        key: 'problem',
        title: previous.title || short(previous.problem || 'Neuer Atlas'),
        body: previous.problem || 'Ausgangspunkt nicht dokumentiert.',
        fieldType: 'problem',
        state: 'confirmed',
        confirmed: true,
        source: 'Aus vorheriger Atlas-Version übernommen',
        q: 0,
        r: 0
      });
    }

    const root = fields.find((field) => field.id === 'root');
    root.q = 0;
    root.r = 0;

    const routes = normalizeRoutes(previous.routes, fields);
    const history = Array.isArray(previous.history) ? [...previous.history] : [];
    history.push({ id: makeId('event'), at: now(), type: 'migrated', text: `Atlas aus ${sourceVersion} in die Feldkarte v0.3 übernommen.` });

    return {
      ...previous,
      id: previous.id || makeId('atlas'),
      version: '0.3',
      title: previous.title || root.title,
      problem: previous.problem || root.body,
      createdAt: previous.createdAt || now(),
      updatedAt: now(),
      step: Number.isInteger(previous.step) ? previous.step : 0,
      messages: Array.isArray(previous.messages) ? previous.messages : [],
      fields,
      routes,
      history
    };
  }

  function normalizeRoutes(previousRoutes, fields) {
    const ids = new Set(fields.map((field) => field.id));
    const valid = Array.isArray(previousRoutes)
      ? previousRoutes.filter((route) => ids.has(route.from) && ids.has(route.to) && route.from !== route.to)
        .map((route) => ({ id: route.id || makeId('route'), from: route.from, to: route.to, type: ROUTE_LABELS[route.type] ? route.type : 'supports' }))
      : [];
    if (valid.length) return valid;
    return fields.filter((field) => field.id !== 'root').map((field) => ({ id: makeId('route'), from: 'root', to: field.id, type: 'supports' }));
  }

  function mapLegacyType(value) {
    return {
      known: 'statement',
      statement: 'statement',
      assumption: 'assumption',
      open: 'question',
      question: 'question',
      decision: 'decision',
      resource: 'resource',
      risk: 'risk',
      process: 'process',
      actor: 'actor',
      rule: 'rule'
    }[value] || 'statement';
  }

  function mapLegacyState(value, confirmed, type, body) {
    if (STATE_LABELS[value]) return value;
    if (confirmed) return type === 'decision' ? 'decided' : 'confirmed';
    if (/noch nicht geklärt/i.test(body)) return 'empty';
    return 'provisional';
  }

  function nextCoordinateFromSet(occupied, indexHint = 0) {
    const candidates = allCoordinates(6);
    const start = Math.max(0, indexHint % candidates.length);
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidate = candidates[(start + offset) % candidates.length];
      if (!occupied.has(coordKey(candidate.q, candidate.r))) return candidate;
    }
    return { q: 0, r: 0 };
  }

  function allCoordinates(maxRing = 6) {
    const result = [];
    for (let radius = 1; radius <= maxRing; radius += 1) {
      const ring = [];
      for (let q = -radius; q <= radius; q += 1) {
        for (let r = -radius; r <= radius; r += 1) {
          const s = -q - r;
          if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) === radius) ring.push({ q, r });
        }
      }
      ring.sort((a, b) => {
        const pa = axialToPixel(a.q, a.r);
        const pb = axialToPixel(b.q, b.r);
        const aa = Math.atan2(pa.y - BOARD.height / 2, pa.x - BOARD.width / 2);
        const ab = Math.atan2(pb.y - BOARD.height / 2, pb.x - BOARD.width / 2);
        return aa - ab;
      });
      result.push(...ring);
    }
    return result;
  }

  function nextCoordinate(atlas) {
    const occupied = new Set(atlas.fields.map((field) => coordKey(field.q, field.r)));
    return nextCoordinateFromSet(occupied);
  }

  function coordKey(q, r) {
    return `${q},${r}`;
  }

  function axialToPixel(q, r) {
    const x = BOARD.width / 2 + BOARD.size * 1.5 * q;
    const y = BOARD.height / 2 + BOARD.size * Math.sqrt(3) * (r + q / 2);
    return { x, y };
  }

  function ringOf(q, r) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
  }

  function saveLibrary() {
    library.currentId = currentId;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  function showScreen(name) {
    screens.forEach((screen) => { screen.hidden = screen.dataset.screen !== name; });
    window.scrollTo(0, 0);
  }

  function short(text, limit = 58) {
    const first = text.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0];
    const words = first.split(' ').slice(0, 8).join(' ');
    return words.length > limit ? `${words.slice(0, limit - 1)}…` : words || 'Neuer Atlas';
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function record(atlas, type, text) {
    atlas.history ||= [];
    atlas.history.push({ id: makeId('event'), at: now(), type, text });
    atlas.updatedAt = now();
  }

  function initialAtlas(text) {
    const atlasTitle = short(text);
    const fields = [{
      id: 'root',
      key: 'problem',
      title: atlasTitle,
      body: text,
      fieldType: 'problem',
      state: 'confirmed',
      confirmed: true,
      source: 'Ursprüngliche Problembeschreibung',
      q: 0,
      r: 0
    }];

    PLAN.forEach((item, index) => {
      const [q, r] = RING_ONE[index];
      fields.push({
        id: makeId('field'),
        key: item.key,
        title: item.title,
        body: 'Noch nicht geklärt.',
        fieldType: item.fieldType,
        state: 'empty',
        confirmed: false,
        source: 'Vorgeschlagenes Startfeld',
        q,
        r
      });
    });

    const routes = fields.filter((field) => field.id !== 'root').map((field) => ({
      id: makeId('route'),
      from: 'root',
      to: field.id,
      type: 'supports'
    }));

    const atlas = {
      id: makeId('atlas'),
      version: '0.3',
      createdAt: now(),
      updatedAt: now(),
      title: atlasTitle,
      problem: text,
      step: 0,
      messages: [
        { id: makeId('message'), role: 'engine', text: 'Ich habe den Problemkern und sechs erste Nachbarfelder angelegt. Alle leeren Felder sind nur Arbeitsräume, keine behaupteten Tatsachen.' },
        { id: makeId('message'), role: 'engine', text: PLAN[0].question }
      ],
      fields,
      routes,
      history: []
    };
    record(atlas, 'created', 'Feldkarte aus der ursprünglichen Problembeschreibung angelegt.');
    return atlas;
  }

  function classifyFieldType(text) {
    const value = text.toLowerCase();
    if (value.includes('?') || /\b(unklar|weiß nicht|offen|keine ahnung)\b/.test(value)) return 'question';
    if (/\b(vielleicht|vermutlich|wahrscheinlich|ich glaube|ich denke|könnte|dürfte)\b/.test(value)) return 'assumption';
    if (/\b(entschieden|entscheidung|wir machen|wir nehmen|festgelegt|muss|soll)\b/.test(value)) return 'decision';
    if (/\b(risiko|problem|engpass|fehler|verlust|konflikt|gefährlich)\b/.test(value)) return 'risk';
    if (/\b(material|budget|zeit|gerät|fahrzeug|ressource)\b/.test(value)) return 'resource';
    if (/\b(zuerst|danach|anschließend|ablauf|schritt)\b/.test(value)) return 'process';
    if (/\b(team|abteilung|person|chef|mitarbeiter|gärtnerei|haustechnik)\b/.test(value)) return 'actor';
    return 'statement';
  }

  function addConversationEntry(text) {
    const atlas = currentAtlas();
    if (!atlas) return;

    atlas.messages.push({ id: makeId('message'), role: 'user', text });
    const planItem = PLAN[atlas.step];

    if (planItem) {
      let field = atlas.fields.find((item) => item.key === planItem.key);
      if (!field) {
        const point = nextCoordinate(atlas);
        field = {
          id: makeId('field'),
          key: planItem.key,
          title: planItem.title,
          body: text,
          fieldType: planItem.fieldType,
          state: 'provisional',
          confirmed: false,
          source: 'Direkte Antwort im Gespräch',
          q: point.q,
          r: point.r
        };
        atlas.fields.push(field);
        atlas.routes.push({ id: makeId('route'), from: 'root', to: field.id, type: 'supports' });
      } else {
        field.body = field.state === 'empty' ? text : `${field.body}\n\n${text}`;
        field.state = 'provisional';
        field.confirmed = false;
        field.source = 'Direkte Antwort im Gespräch';
      }
      record(atlas, 'field_filled', `Feld „${field.title}“ aus dem Gespräch gefüllt.`);
      atlas.messages.push({ id: makeId('message'), role: 'engine', text: `Ich habe deine Antwort im Feld „${field.title}“ abgelegt. Sie bleibt vorläufig, bis du sie bestätigst.` });
      atlas.step = Math.min(atlas.step + 1, PLAN.length);
      atlas.messages.push({
        id: makeId('message'),
        role: 'engine',
        text: atlas.step < PLAN.length
          ? PLAN[atlas.step].question
          : 'Der erste Rundgang ist vollständig. Du kannst Felder öffnen, korrigieren, bestätigen und mit Wegen verbinden.'
      });
    } else {
      const point = nextCoordinate(atlas);
      const detectedType = classifyFieldType(text);
      const field = {
        id: makeId('field'),
        key: null,
        title: short(text, 44),
        body: text,
        fieldType: detectedType,
        state: 'provisional',
        confirmed: false,
        source: 'Direkte Eingabe im Gespräch',
        q: point.q,
        r: point.r
      };
      atlas.fields.push(field);
      atlas.routes.push({ id: makeId('route'), from: 'root', to: field.id, type: 'supports' });
      record(atlas, 'field_created', `Neues Feld „${field.title}“ aus dem Gespräch angelegt.`);
      atlas.messages.push({ id: makeId('message'), role: 'engine', text: `Ich habe daraus ein neues Feld vom Typ „${TYPE_LABELS[detectedType]}“ angelegt. Auch dieses Feld ist noch vorläufig.` });
    }

    saveLibrary();
    renderWorkspace();
  }

  function renderLibrary() {
    atlasList.replaceChildren();
    emptyLibrary.hidden = library.atlases.length > 0;
    library.atlases
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .forEach((atlas) => {
        const card = document.createElement('article');
        card.className = 'atlas-card';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'atlas-card-open';
        open.innerHTML = `
          <small>ATLAS v${escapeText(atlas.version || '0.3')}</small>
          <strong>${escapeText(atlas.title)}</strong>
          <p>${escapeText(atlas.problem)}</p>
          <span>${atlas.fields?.length || 0} Felder · ${atlas.routes?.length || 0} Wege · ${formatDate(atlas.updatedAt || atlas.createdAt)}</span>
        `;
        open.addEventListener('click', () => openAtlas(atlas.id));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'atlas-card-delete';
        remove.textContent = 'Löschen';
        remove.addEventListener('click', () => deleteAtlas(atlas.id));

        card.append(open, remove);
        atlasList.append(card);
      });
  }

  function escapeText(value) {
    const node = document.createElement('span');
    node.textContent = value ?? '';
    return node.innerHTML;
  }

  function openAtlas(id) {
    currentId = id;
    saveLibrary();
    showScreen('workspace');
    setActiveTab('atlas');
    renderWorkspace();
    requestAnimationFrame(centerMap);
  }

  function renderWorkspace() {
    const atlas = currentAtlas();
    if (!atlas) return;
    title.textContent = atlas.title;
    fieldCount.textContent = `${atlas.fields.length} ${atlas.fields.length === 1 ? 'Feld' : 'Felder'}`;
    routeCount.textContent = `${atlas.routes.length} ${atlas.routes.length === 1 ? 'Weg' : 'Wege'}`;
    renderMessages(atlas);
    renderMap(atlas);
    renderHistory(atlas);
  }

  function renderMessages(atlas) {
    messages.replaceChildren();
    atlas.messages.forEach((message) => {
      const article = document.createElement('article');
      article.className = `message ${message.role}`;
      const label = document.createElement('small');
      label.textContent = message.role === 'engine' ? 'Reason Engine' : 'Du';
      const text = document.createElement('p');
      text.textContent = message.text;
      article.append(label, text);
      messages.append(article);
    });
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function renderMap(atlas) {
    fieldsLayer.replaceChildren();
    routesLayer.replaceChildren();
    routesLayer.setAttribute('viewBox', `0 0 ${BOARD.width} ${BOARD.height}`);
    mapBoard.style.width = `${BOARD.width}px`;
    mapBoard.style.height = `${BOARD.height}px`;

    atlas.routes.forEach((route) => {
      const from = atlas.fields.find((field) => field.id === route.from);
      const to = atlas.fields.find((field) => field.id === route.to);
      if (!from || !to) return;
      const a = axialToPixel(from.q, from.r);
      const b = axialToPixel(to.q, to.r);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const inset = Math.min(96, distance * 0.42);
      const start = { x: a.x + (dx / distance) * inset, y: a.y + (dy / distance) * inset };
      const end = { x: b.x - (dx / distance) * inset, y: b.y - (dy / distance) * inset };
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', `route route-${route.type}`);
      const bed = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      bed.setAttribute('x1', start.x);
      bed.setAttribute('y1', start.y);
      bed.setAttribute('x2', end.x);
      bed.setAttribute('y2', end.y);
      bed.setAttribute('class', 'route-bed');
      const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      core.setAttribute('x1', start.x);
      core.setAttribute('y1', start.y);
      core.setAttribute('x2', end.x);
      core.setAttribute('y2', end.y);
      core.setAttribute('class', 'route-core');
      group.append(bed, core);
      routesLayer.append(group);
    });

    atlas.fields.forEach((field) => {
      const point = axialToPixel(field.q, field.r);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `hex-field${field.id === 'root' ? ' root' : ''}`;
      button.dataset.type = field.fieldType;
      button.dataset.state = field.state;
      button.dataset.stateLabel = STATE_LABELS[field.state] || field.state;
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
      const kind = document.createElement('span');
      kind.className = 'field-kind';
      kind.textContent = TYPE_LABELS[field.fieldType] || 'Feld';
      const heading = document.createElement('strong');
      heading.textContent = field.title;
      const body = document.createElement('p');
      body.textContent = field.body;
      const ring = document.createElement('small');
      ring.textContent = field.id === 'root' ? 'Zentrum' : `Ring ${ringOf(field.q, field.r)}`;
      button.append(kind, heading, body, ring);
      button.addEventListener('click', () => openField(field.id));
      fieldsLayer.append(button);
    });

    applyZoom();
  }

  function renderHistory(atlas) {
    historyList.replaceChildren();
    [...(atlas.history || [])].reverse().forEach((event) => {
      const item = document.createElement('li');
      const type = document.createElement('small');
      type.textContent = event.type;
      const text = document.createElement('p');
      text.textContent = event.text;
      const time = document.createElement('time');
      time.dateTime = event.at;
      time.textContent = formatDate(event.at);
      item.append(type, text, time);
      historyList.append(item);
    });
  }

  function applyZoom() {
    zoom = Math.min(1.25, Math.max(0.58, zoom));
    mapBoard.style.transform = `scale(${zoom})`;
    mapCanvas.style.width = `${BOARD.width * zoom}px`;
    mapCanvas.style.height = `${BOARD.height * zoom}px`;
  }

  function centerMap() {
    const root = axialToPixel(0, 0);
    stage.scrollTo({
      left: Math.max(0, root.x * zoom - stage.clientWidth / 2),
      top: Math.max(0, root.y * zoom - stage.clientHeight / 2),
      behavior: 'smooth'
    });
  }

  function openField(fieldId) {
    const atlas = currentAtlas();
    const field = atlas?.fields.find((item) => item.id === fieldId);
    if (!field) return;

    selectedFieldId = fieldId;
    fieldMode = 'edit';
    fieldDialogLabel.textContent = `${TYPE_LABELS[field.fieldType]} · ${STATE_LABELS[field.state]}`;
    fieldTitle.value = field.title;
    fieldBody.value = field.body;
    fieldType.value = field.fieldType === 'problem' ? 'statement' : field.fieldType;
    fieldType.disabled = field.id === 'root';
    fieldState.value = field.state;
    fieldState.disabled = field.id === 'root';
    fieldPosition.textContent = field.id === 'root' ? 'Zentrum' : `Ring ${ringOf(field.q, field.r)} · Koordinate ${field.q}/${field.r}`;
    fieldSource.textContent = field.source;
    $('[data-confirm-field]').hidden = field.id === 'root' || field.state === 'confirmed' || field.state === 'decided';
    $('[data-delete-field]').hidden = field.id === 'root';
    routeEditor.hidden = false;
    renderRouteEditor(atlas, field);
    dialog.showModal();
  }

  function openNewField() {
    selectedFieldId = null;
    fieldMode = 'create';
    fieldDialogLabel.textContent = 'NEUES ATLAS-FELD';
    fieldTitle.value = '';
    fieldBody.value = '';
    fieldType.value = 'statement';
    fieldType.disabled = false;
    fieldState.value = 'provisional';
    fieldState.disabled = false;
    const point = nextCoordinate(currentAtlas());
    fieldPosition.textContent = `Nächster freier Platz · Ring ${ringOf(point.q, point.r)}`;
    fieldSource.textContent = 'Manuell in der Feldkarte angelegt';
    $('[data-confirm-field]').hidden = true;
    $('[data-delete-field]').hidden = true;
    routeEditor.hidden = true;
    dialog.showModal();
    requestAnimationFrame(() => fieldTitle.focus());
  }

  function renderRouteEditor(atlas, field) {
    routeTarget.replaceChildren();
    atlas.fields.filter((item) => item.id !== field.id).forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      routeTarget.append(option);
    });

    routeList.replaceChildren();
    const connected = atlas.routes.filter((route) => route.from === field.id || route.to === field.id);
    if (!connected.length) {
      const empty = document.createElement('li');
      empty.className = 'route-empty';
      empty.textContent = 'Noch keine Wege.';
      routeList.append(empty);
      return;
    }

    connected.forEach((route) => {
      const outgoing = route.from === field.id;
      const otherId = outgoing ? route.to : route.from;
      const other = atlas.fields.find((item) => item.id === otherId);
      if (!other) return;
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${outgoing ? '→' : '←'} ${other.title} · ${ROUTE_LABELS[route.type]}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'lösen';
      remove.addEventListener('click', () => removeRoute(route.id));
      item.append(text, remove);
      routeList.append(item);
    });
  }

  function addRoute() {
    const atlas = currentAtlas();
    if (!atlas || !selectedFieldId || !routeTarget.value || routeTarget.value === selectedFieldId) return;
    const exists = atlas.routes.some((route) =>
      (route.from === selectedFieldId && route.to === routeTarget.value) ||
      (route.from === routeTarget.value && route.to === selectedFieldId)
    );
    if (exists) return;
    const from = atlas.fields.find((field) => field.id === selectedFieldId);
    const to = atlas.fields.find((field) => field.id === routeTarget.value);
    atlas.routes.push({ id: makeId('route'), from: selectedFieldId, to: routeTarget.value, type: routeType.value });
    record(atlas, 'route_created', `Weg „${from.title} ${ROUTE_LABELS[routeType.value]} ${to.title}“ angelegt.`);
    saveLibrary();
    renderRouteEditor(atlas, from);
    renderWorkspace();
  }

  function removeRoute(routeId) {
    const atlas = currentAtlas();
    const route = atlas?.routes.find((item) => item.id === routeId);
    if (!atlas || !route) return;
    const from = atlas.fields.find((field) => field.id === route.from);
    const to = atlas.fields.find((field) => field.id === route.to);
    atlas.routes = atlas.routes.filter((item) => item.id !== routeId);
    record(atlas, 'route_deleted', `Weg zwischen „${from?.title || 'Feld'}“ und „${to?.title || 'Feld'}“ entfernt.`);
    saveLibrary();
    const selected = atlas.fields.find((field) => field.id === selectedFieldId);
    if (selected) renderRouteEditor(atlas, selected);
    renderWorkspace();
  }

  function saveFieldFromDialog() {
    const atlas = currentAtlas();
    if (!atlas) return;
    const nextTitle = fieldTitle.value.trim();
    const nextBody = fieldBody.value.trim();
    if (!nextTitle || !nextBody) return;

    if (fieldMode === 'create') {
      const point = nextCoordinate(atlas);
      const field = {
        id: makeId('field'),
        key: null,
        title: nextTitle,
        body: nextBody,
        fieldType: fieldType.value,
        state: fieldState.value,
        confirmed: ['confirmed', 'decided'].includes(fieldState.value),
        source: 'Manuell in der Feldkarte angelegt',
        q: point.q,
        r: point.r
      };
      atlas.fields.push(field);
      atlas.routes.push({ id: makeId('route'), from: 'root', to: field.id, type: 'supports' });
      record(atlas, 'field_created', `Feld „${nextTitle}“ manuell in Ring ${ringOf(point.q, point.r)} angelegt.`);
    } else {
      const field = atlas.fields.find((item) => item.id === selectedFieldId);
      if (!field) return;
      const before = JSON.stringify({ title: field.title, body: field.body, fieldType: field.fieldType, state: field.state });
      field.title = nextTitle;
      field.body = nextBody;
      if (field.id !== 'root') {
        field.fieldType = fieldType.value;
        field.state = fieldState.value;
        field.confirmed = ['confirmed', 'decided'].includes(field.state);
      }
      const after = JSON.stringify({ title: field.title, body: field.body, fieldType: field.fieldType, state: field.state });
      if (before !== after) record(atlas, 'field_edited', `Feld „${field.title}“ bearbeitet.`);
      if (field.id === 'root') {
        atlas.title = field.title;
        atlas.problem = field.body;
      }
    }

    saveLibrary();
    renderWorkspace();
  }

  function confirmSelectedField() {
    const atlas = currentAtlas();
    const field = atlas?.fields.find((item) => item.id === selectedFieldId);
    if (!field || field.id === 'root' || ['confirmed', 'decided'].includes(field.state)) return;
    field.state = field.fieldType === 'decision' ? 'decided' : 'confirmed';
    field.confirmed = true;
    field.source = `${field.source}; vom Nutzer bestätigt`;
    record(atlas, 'field_confirmed', `Feld „${field.title}“ als ${STATE_LABELS[field.state]} markiert.`);
    saveLibrary();
    dialog.close();
    renderWorkspace();
  }

  function deleteSelectedField() {
    const atlas = currentAtlas();
    const field = atlas?.fields.find((item) => item.id === selectedFieldId);
    if (!field || field.id === 'root' || !confirm(`Feld „${field.title}“ entfernen?`)) return;
    atlas.fields = atlas.fields.filter((item) => item.id !== selectedFieldId);
    atlas.routes = atlas.routes.filter((route) => route.from !== selectedFieldId && route.to !== selectedFieldId);
    record(atlas, 'field_deleted', `Feld „${field.title}“ samt seiner Wege entfernt. Gesprächsnachrichten bleiben erhalten.`);
    saveLibrary();
    dialog.close();
    renderWorkspace();
  }

  function deleteAtlas(id = currentId) {
    const atlas = library.atlases.find((item) => item.id === id);
    if (!atlas || !confirm(`Atlas „${atlas.title}“ vollständig aus diesem Browser löschen?`)) return;
    library.atlases = library.atlases.filter((item) => item.id !== id);
    if (currentId === id) currentId = null;
    saveLibrary();
    showScreen('library');
    renderLibrary();
  }

  function exportAtlas() {
    const atlas = currentAtlas();
    if (!atlas) return;
    record(atlas, 'exported', 'Atlas mit Feldern, Wegen und Verlauf als JSON exportiert.');
    saveLibrary();
    const blob = new Blob([JSON.stringify({ ...atlas, exportedAt: now() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug(atlas.title) || 'atlas'}-v0.3.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    renderHistory(atlas);
  }

  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '');
  }

  function setActiveTab(tab) {
    $$('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    $$('[data-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab));
    workspace.dataset.side = tab === 'history' ? 'history' : 'chat';
    if (tab === 'chat') chatInput.focus();
    if (tab === 'atlas') requestAnimationFrame(centerMap);
  }

  $('[data-enter]').addEventListener('click', () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    showScreen('library');
    renderLibrary();
  });

  $$('[data-new-atlas]').forEach((button) => button.addEventListener('click', () => {
    problemInput.value = '';
    showScreen('problem');
    problemInput.focus();
  }));

  $$('[data-back-library]').forEach((button) => button.addEventListener('click', () => {
    showScreen('library');
    renderLibrary();
  }));

  $('[data-example]').addEventListener('click', () => {
    problemInput.value = EXAMPLE;
    problemInput.focus();
  });

  $('[data-problem-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = problemInput.value.trim();
    if (text.length < 20) return;
    const atlas = initialAtlas(text);
    library.atlases.push(atlas);
    currentId = atlas.id;
    saveLibrary();
    showScreen('workspace');
    setActiveTab('atlas');
    renderWorkspace();
    requestAnimationFrame(centerMap);
  });

  $('[data-chat-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    addConversationEntry(text);
  });

  $('[data-add-field]').addEventListener('click', openNewField);
  $('[data-export]').addEventListener('click', exportAtlas);
  $('[data-delete-atlas]').addEventListener('click', () => deleteAtlas());
  $('[data-confirm-field]').addEventListener('click', confirmSelectedField);
  $('[data-delete-field]').addEventListener('click', deleteSelectedField);
  $('[data-add-route]').addEventListener('click', addRoute);
  $('[data-center-map]').addEventListener('click', centerMap);
  $('[data-zoom-in]').addEventListener('click', () => { zoom += 0.1; applyZoom(); });
  $('[data-zoom-out]').addEventListener('click', () => { zoom -= 0.1; applyZoom(); });

  fieldForm.addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    saveFieldFromDialog();
    dialog.close();
  });

  $$('[data-tab]').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }

  if (localStorage.getItem(ONBOARDING_KEY) === 'true' || library.atlases.length > 0) {
    showScreen('library');
    renderLibrary();
  } else {
    showScreen('intro');
  }
})();
