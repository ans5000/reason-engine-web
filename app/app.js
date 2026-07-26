(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v02';
  const LEGACY_KEY = 'reason-engine-atlas-v01';
  const ONBOARDING_KEY = 'reason-engine-atlas-onboarded-v02';
  const EXAMPLE = 'Wir müssen ungefähr 50 Weihnachtsbäume im Krankenhaus verteilen. Bisher werden die Standorte auf einem alten Holzbrett notiert, auf dem noch Häkchen aus mehreren Jahren stehen. Änderungen gehen verloren, Zuständigkeiten sind unklar und am Ende weiß niemand sicher, ob jeder Baum am richtigen Ort steht.';
  const QUESTIONS = [
    'Wer ist an diesem Problem beteiligt oder davon betroffen?',
    'Was wäre ein gutes, überprüfbares Ergebnis?',
    'Welche Regeln, Grenzen oder Ressourcen müssen berücksichtigt werden?',
    'Wie läuft der Prozess heute tatsächlich ab, Schritt für Schritt?',
    'Wo entsteht momentan der größte Verlust, Konflikt oder Zeitaufwand?',
    'Welche Entscheidung muss als Nächstes getroffen werden?'
  ];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const screens = $$('[data-screen]');
  const problemInput = $('#problem-input');
  const chatInput = $('#chat-input');
  const messages = $('[data-messages]');
  const nodes = $('[data-nodes]');
  const lines = $('[data-lines]');
  const title = $('[data-title]');
  const atlasList = $('[data-atlas-list]');
  const emptyLibrary = $('[data-empty-library]');
  const historyList = $('[data-history]');
  const dialog = $('[data-node-dialog]');
  const nodeForm = $('[data-node-form]');
  const nodeDialogLabel = $('[data-node-dialog-label]');
  const nodeTitle = $('[data-node-title]');
  const nodeBody = $('[data-node-body]');
  const nodeKind = $('[data-node-kind]');
  const nodeStatus = $('[data-node-status]');
  const nodeSource = $('[data-node-source]');

  let library = loadLibrary();
  let currentId = library.currentId || null;
  let selectedNodeId = null;
  let nodeMode = 'edit';

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
      if (stored?.version === '0.2' && Array.isArray(stored.atlases)) return stored;
    } catch (error) {
      console.warn('Atlas library could not be read.', error);
    }

    const migrated = migrateLegacy();
    if (migrated) return migrated;
    return { version: '0.2', currentId: null, atlases: [] };
  }

  function migrateLegacy() {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (!legacy || legacy.version !== '0.1') return null;
      const atlas = {
        ...legacy,
        id: makeId('atlas'),
        version: '0.2',
        updatedAt: now(),
        history: [{ id: makeId('event'), at: now(), type: 'migrated', text: 'Atlas aus v0.1 übernommen.' }]
      };
      const migrated = { version: '0.2', currentId: atlas.id, atlases: [atlas] };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    } catch (error) {
      console.warn('Legacy migration failed.', error);
      return null;
    }
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

  function position(index) {
    const positions = [[50, 10], [88, 34], [87, 68], [50, 88], [12, 68], [12, 34], [35, 27], [68, 28], [68, 67], [34, 68]];
    const point = positions[index % positions.length];
    return { x: point[0], y: point[1] };
  }

  function record(atlas, type, text) {
    atlas.history ||= [];
    atlas.history.push({ id: makeId('event'), at: now(), type, text });
    atlas.updatedAt = now();
  }

  function initialAtlas(text) {
    const atlasTitle = short(text);
    const atlas = {
      id: makeId('atlas'),
      version: '0.2',
      createdAt: now(),
      updatedAt: now(),
      title: atlasTitle,
      problem: text,
      step: 0,
      messages: [
        { id: makeId('message'), role: 'engine', text: 'Ich habe den Ausgangspunkt als vorläufigen Problemraum angelegt. Nichts davon gilt automatisch als bestätigt.' },
        { id: makeId('message'), role: 'engine', text: QUESTIONS[0] }
      ],
      nodes: [
        { id: 'root', title: atlasTitle, body: text, kind: 'root', confirmed: true, source: 'Ursprüngliche Problembeschreibung', x: 50, y: 48 },
        { id: makeId('node'), title: 'Beteiligte', body: 'Noch nicht geklärt.', kind: 'open', confirmed: false, source: 'Vorgeschlagener Klärungsraum', x: 18, y: 18 },
        { id: makeId('node'), title: 'Gewünschtes Ergebnis', body: 'Noch nicht geklärt.', kind: 'open', confirmed: false, source: 'Vorgeschlagener Klärungsraum', x: 78, y: 18 },
        { id: makeId('node'), title: 'Rahmenbedingungen', body: 'Noch nicht geklärt.', kind: 'open', confirmed: false, source: 'Vorgeschlagener Klärungsraum', x: 18, y: 76 },
        { id: makeId('node'), title: 'Nächste Entscheidung', body: 'Noch nicht geklärt.', kind: 'open', confirmed: false, source: 'Vorgeschlagener Klärungsraum', x: 78, y: 76 }
      ],
      history: []
    };
    record(atlas, 'created', 'Atlas aus der ursprünglichen Problembeschreibung angelegt.');
    return atlas;
  }

  function classify(text) {
    const value = text.toLowerCase();
    if (value.includes('?') || /\b(unklar|weiß nicht|offen|keine ahnung)\b/.test(value)) return 'open';
    if (/\b(vielleicht|vermutlich|wahrscheinlich|ich glaube|ich denke|könnte|dürfte)\b/.test(value)) return 'assumption';
    if (/\b(entschieden|entscheidung|wir machen|wir nehmen|festgelegt|muss|soll|verantwortlich ist)\b/.test(value)) return 'decision';
    return 'known';
  }

  function label(kind, confirmed = false) {
    const labels = {
      root: 'Ausgangspunkt',
      known: confirmed ? 'Aussage · bestätigt' : 'Aussage · unbestätigt',
      assumption: confirmed ? 'Annahme · bestätigt' : 'Annahme · unbestätigt',
      open: 'Offene Frage',
      decision: confirmed ? 'Entscheidung · bestätigt' : 'Entscheidung · unbestätigt'
    };
    return labels[kind] || 'Eintrag';
  }

  function addConversationEntry(text) {
    const atlas = currentAtlas();
    if (!atlas) return;
    const kind = classify(text);
    const point = position(atlas.nodes.length - 1);
    const node = { id: makeId('node'), title: short(text, 46), body: text, kind, confirmed: false, source: 'Direkte Eingabe im Gespräch', x: point.x, y: point.y };
    atlas.nodes.push(node);
    atlas.messages.push({ id: makeId('message'), role: 'user', text });
    const acknowledgements = {
      open: 'Ich habe das als offene Frage markiert, nicht als Tatsache.',
      assumption: 'Ich habe das als Annahme markiert. Sie bleibt sichtbar unbestätigt.',
      decision: 'Ich habe das als vorläufige Entscheidung markiert. Sie ist noch nicht bestätigt.',
      known: 'Ich habe das als direkte Aussage aufgenommen. Sie ist noch nicht bestätigt.'
    };
    atlas.messages.push({ id: makeId('message'), role: 'engine', text: acknowledgements[kind] });
    atlas.step = Math.min(atlas.step + 1, QUESTIONS.length);
    atlas.messages.push({ id: makeId('message'), role: 'engine', text: atlas.step < QUESTIONS.length ? QUESTIONS[atlas.step] : 'Der erste Gesprächsbogen ist vollständig. Öffne Atlas-Einträge, um sie zu prüfen, zu bearbeiten oder zu bestätigen.' });
    record(atlas, 'message', `Gesprächseintrag als „${label(kind)}“ aufgenommen.`);
    saveLibrary();
    renderWorkspace();
  }

  function renderLibrary() {
    atlasList.replaceChildren();
    const ordered = [...library.atlases].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    emptyLibrary.hidden = ordered.length > 0;
    atlasList.hidden = ordered.length === 0;

    ordered.forEach((atlas) => {
      const card = document.createElement('article');
      card.className = 'atlas-card';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'atlas-card-open';
      open.innerHTML = `<small>${formatDate(atlas.updatedAt)}</small><strong></strong><p></p><span>${atlas.nodes.length} Einträge · ${atlas.history?.length || 0} Änderungen</span>`;
      open.querySelector('strong').textContent = atlas.title;
      open.querySelector('p').textContent = atlas.problem;
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

  function formatDate(value) {
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function openAtlas(id) {
    currentId = id;
    saveLibrary();
    showScreen('workspace');
    setActiveTab('atlas');
    renderWorkspace();
  }

  function renderWorkspace() {
    const atlas = currentAtlas();
    if (!atlas) {
      showScreen('library');
      renderLibrary();
      return;
    }
    title.textContent = atlas.title;
    renderMessages(atlas);
    renderNodes(atlas);
    renderHistory(atlas);
  }

  function renderMessages(atlas) {
    messages.replaceChildren();
    atlas.messages.forEach((message) => {
      const article = document.createElement('article');
      article.className = `message ${message.role}`;
      const who = document.createElement('small');
      who.textContent = message.role === 'engine' ? 'Reason Engine' : 'Du';
      const text = document.createElement('p');
      text.textContent = message.text;
      article.append(who, text);
      messages.append(article);
    });
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function renderNodes(atlas) {
    nodes.replaceChildren();
    lines.replaceChildren();
    atlas.nodes.forEach((node) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `node${node.kind === 'root' ? ' root' : ''}`;
      button.dataset.kind = node.kind;
      button.dataset.confirmed = String(Boolean(node.confirmed));
      button.style.left = `${node.x}%`;
      button.style.top = `${node.y}%`;
      button.style.transform = 'translate(-50%,-50%)';
      const kind = document.createElement('span');
      kind.className = 'node-kind';
      kind.textContent = label(node.kind, node.confirmed);
      const heading = document.createElement('strong');
      heading.textContent = node.title;
      const body = document.createElement('p');
      body.textContent = node.body;
      button.append(kind, heading, body);
      button.addEventListener('click', () => openNode(node.id));
      nodes.append(button);

      if (node.id !== 'root') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '50%');
        line.setAttribute('y1', '48%');
        line.setAttribute('x2', `${node.x}%`);
        line.setAttribute('y2', `${node.y}%`);
        lines.append(line);
      }
    });
  }

  function renderHistory(atlas) {
    historyList.replaceChildren();
    [...(atlas.history || [])].reverse().forEach((event) => {
      const item = document.createElement('li');
      const time = document.createElement('time');
      time.dateTime = event.at;
      time.textContent = formatDate(event.at);
      const text = document.createElement('p');
      text.textContent = event.text;
      const type = document.createElement('small');
      type.textContent = event.type;
      item.append(type, text, time);
      historyList.append(item);
    });
  }

  function openNode(nodeId) {
    const atlas = currentAtlas();
    const node = atlas?.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    selectedNodeId = nodeId;
    nodeMode = 'edit';
    nodeDialogLabel.textContent = label(node.kind, node.confirmed);
    nodeTitle.value = node.title;
    nodeBody.value = node.body;
    nodeKind.value = node.kind === 'root' ? 'known' : node.kind;
    nodeKind.disabled = node.kind === 'root';
    nodeStatus.textContent = node.confirmed ? 'Bestätigt' : 'Vorläufig / unbestätigt';
    nodeSource.textContent = node.source;
    $('[data-confirm-node]').hidden = node.kind === 'root' || node.confirmed;
    $('[data-delete-node]').hidden = node.kind === 'root';
    dialog.showModal();
  }

  function openNewNode() {
    selectedNodeId = null;
    nodeMode = 'create';
    nodeDialogLabel.textContent = 'NEUER ATLAS-EINTRAG';
    nodeTitle.value = '';
    nodeBody.value = '';
    nodeKind.value = 'known';
    nodeKind.disabled = false;
    nodeStatus.textContent = 'Vorläufig / unbestätigt';
    nodeSource.textContent = 'Manuell im Atlas angelegt';
    $('[data-confirm-node]').hidden = true;
    $('[data-delete-node]').hidden = true;
    dialog.showModal();
    requestAnimationFrame(() => nodeTitle.focus());
  }

  function saveNodeFromDialog() {
    const atlas = currentAtlas();
    if (!atlas) return;
    const nextTitle = nodeTitle.value.trim();
    const nextBody = nodeBody.value.trim();
    if (!nextTitle || !nextBody) return;

    if (nodeMode === 'create') {
      const point = position(atlas.nodes.length - 1);
      atlas.nodes.push({ id: makeId('node'), title: nextTitle, body: nextBody, kind: nodeKind.value, confirmed: false, source: 'Manuell im Atlas angelegt', x: point.x, y: point.y });
      record(atlas, 'node_created', `Eintrag „${nextTitle}“ manuell angelegt.`);
    } else {
      const node = atlas.nodes.find((item) => item.id === selectedNodeId);
      if (!node) return;
      const before = `${node.title}|${node.body}|${node.kind}`;
      node.title = nextTitle;
      node.body = nextBody;
      if (node.kind !== 'root') node.kind = nodeKind.value;
      if (`${node.title}|${node.body}|${node.kind}` !== before) record(atlas, 'node_edited', `Eintrag „${node.title}“ bearbeitet.`);
      if (node.id === 'root') {
        atlas.title = node.title;
        atlas.problem = node.body;
      }
    }
    saveLibrary();
    renderWorkspace();
  }

  function confirmSelectedNode() {
    const atlas = currentAtlas();
    const node = atlas?.nodes.find((item) => item.id === selectedNodeId);
    if (!node || node.kind === 'root' || node.confirmed) return;
    node.confirmed = true;
    node.source = `${node.source}; vom Nutzer bestätigt`;
    record(atlas, 'node_confirmed', `Eintrag „${node.title}“ bestätigt.`);
    saveLibrary();
    dialog.close();
    renderWorkspace();
  }

  function deleteSelectedNode() {
    const atlas = currentAtlas();
    const node = atlas?.nodes.find((item) => item.id === selectedNodeId);
    if (!node || node.id === 'root' || !confirm(`Eintrag „${node.title}“ entfernen?`)) return;
    atlas.nodes = atlas.nodes.filter((item) => item.id !== selectedNodeId);
    record(atlas, 'node_deleted', `Eintrag „${node.title}“ entfernt. Gesprächsnachrichten bleiben erhalten.`);
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
    record(atlas, 'exported', 'Atlas als JSON exportiert.');
    saveLibrary();
    const blob = new Blob([JSON.stringify({ ...atlas, exportedAt: now() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug(atlas.title) || 'atlas'}.json`;
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
    if (tab === 'chat') chatInput.focus();
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
  });
  $('[data-chat-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    addConversationEntry(text);
  });
  $('[data-add-node]').addEventListener('click', openNewNode);
  $('[data-export]').addEventListener('click', exportAtlas);
  $('[data-delete-atlas]').addEventListener('click', () => deleteAtlas());
  $('[data-confirm-node]').addEventListener('click', confirmSelectedNode);
  $('[data-delete-node]').addEventListener('click', deleteSelectedNode);
  nodeForm.addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    saveNodeFromDialog();
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
