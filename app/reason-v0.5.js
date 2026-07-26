(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v02';
  const REOPEN = 'reason-engine-atlas-reopen-v05';
  const QUESTIONS = [
    { key: 'stakeholders', title: 'Beteiligte', text: 'Wer ist an diesem Problem beteiligt oder davon betroffen?' },
    { key: 'outcome', title: 'Gewünschtes Ergebnis', text: 'Was wäre ein gutes, überprüfbares Ergebnis?' },
    { key: 'constraints', title: 'Rahmenbedingungen', text: 'Welche Regeln, Grenzen oder Ressourcen müssen berücksichtigt werden?' },
    { key: 'process', title: 'Heutiger Ablauf', text: 'Wie läuft der Prozess heute tatsächlich ab, Schritt für Schritt?' },
    { key: 'friction', title: 'Größter Verlust', text: 'Wo entsteht momentan der größte Verlust, Konflikt oder Zeitaufwand?' },
    { key: 'next-decision', title: 'Nächste Entscheidung', text: 'Welche Entscheidung muss als Nächstes getroffen werden?' }
  ];

  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = () => new Date().toISOString();
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch (error) { console.warn('Atlas v0.5 could not read local data.', error); return null; }
  };
  const write = (library) => localStorage.setItem(KEY, JSON.stringify(library));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const short = (text, limit = 54) => {
    const first = text.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0];
    const words = first.split(' ').slice(0, 9).join(' ');
    return words.length > limit ? `${words.slice(0, limit - 1)}…` : words || 'Neues Feld';
  };
  const classify = (text) => {
    const value = text.toLowerCase();
    if (value.includes('?') || /\b(unklar|weiß nicht|offen|keine ahnung)\b/.test(value)) return 'open';
    if (/\b(vielleicht|vermutlich|wahrscheinlich|ich glaube|ich denke|könnte|dürfte)\b/.test(value)) return 'assumption';
    if (/\b(entschieden|entscheidung|wir machen|wir nehmen|festgelegt|muss|soll|verantwortlich ist)\b/.test(value)) return 'decision';
    return 'known';
  };
  const label = (kind) => ({ open: 'offene Frage', assumption: 'Annahme', decision: 'vorläufige Entscheidung', known: 'direkte Aussage' }[kind] || 'Eintrag');
  const record = (atlas, type, text) => {
    atlas.history ||= [];
    atlas.history.push({ id: id('event'), at: now(), type, text });
    atlas.updatedAt = now();
  };
  const words = (text) => {
    const stop = new Set(['aber','auch','dann','dass','eine','einem','einen','einer','eines','für','haben','hier','immer','ist','kein','keine','mit','nicht','oder','sind','und','vom','von','wird','wir','zum','zur']);
    return new Set(text.toLowerCase().replace(/[^a-zäöüß0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3 && !stop.has(word)));
  };
  const negated = (text) => /\b(nicht|kein|keine|niemals|nie|ohne|stimmt nicht|falsch)\b/i.test(text);
  const markConflicts = (atlas, candidate) => {
    const candidateWords = words(candidate.body);
    if (candidateWords.size < 2 || candidate.kind === 'open') return 0;
    const conflicts = atlas.nodes.filter((node) => {
      if (node.id === candidate.id || node.kind === 'root' || node.kind === 'open') return false;
      const overlap = [...candidateWords].filter((word) => words(node.body).has(word)).length;
      return overlap >= 2 && negated(candidate.body) !== negated(node.body);
    });
    if (!conflicts.length) return 0;
    candidate.conflict = true;
    candidate.conflictWith = [...new Set([...(candidate.conflictWith || []), ...conflicts.map((node) => node.id)])];
    conflicts.forEach((node) => {
      node.conflict = true;
      node.conflictWith = [...new Set([...(node.conflictWith || []), candidate.id])];
    });
    record(atlas, 'conflict_flagged', `Möglicher Widerspruch bei „${candidate.title}“ markiert. Regelbasierter Hinweis, keine inhaltliche Entscheidung.`);
    return conflicts.length;
  };

  document.querySelector('[data-chat-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.querySelector('#chat-input');
    const text = input?.value.trim();
    const library = read();
    const atlas = current(library);
    if (!text || !atlas) return;

    atlas.nodes ||= [];
    atlas.messages ||= [];
    atlas.step = Number.isInteger(atlas.step) ? atlas.step : 0;
    const question = QUESTIONS[Math.min(atlas.step, QUESTIONS.length - 1)];
    const kind = classify(text);
    const node = {
      id: id('node'),
      topic: question?.key || 'free',
      district: question?.title || 'Freier Raum',
      title: short(text),
      body: text,
      kind,
      confirmed: false,
      source: question ? `Antwort im Gespräch auf: ${question.text}` : 'Direkte Eingabe im Gespräch',
      createdAt: now(),
      x: 50,
      y: 50
    };

    atlas.nodes.push(node);
    atlas.messages.push({ id: id('message'), role: 'user', text });
    const conflicts = markConflicts(atlas, node);
    atlas.messages.push({
      id: id('message'),
      role: 'engine',
      text: `Ein neues Hex ist entstanden: „${node.title}“. Es wurde als ${label(kind)} dem Gebiet „${node.district}“ zugeordnet.${conflicts ? ' Ein möglicher Widerspruch wurde zur Prüfung markiert.' : ''}`
    });
    atlas.step = Math.min(atlas.step + 1, QUESTIONS.length);
    atlas.messages.push({
      id: id('message'),
      role: 'engine',
      text: atlas.step < QUESTIONS.length ? QUESTIONS[atlas.step].text : 'Der erste Gesprächsbogen ist vollständig. Jede weitere Eingabe erweitert den Atlas um ein neues Hex.'
    });
    record(atlas, 'hex_created', `Neues Hex „${node.title}“ im Gebiet „${node.district}“ angelegt und automatisch gefüllt.`);
    write(library);
    input.value = '';
    sessionStorage.setItem(REOPEN, 'true');
    location.reload();
  }, true);

  const download = (filename, content) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  const section = (title, entries) => `## ${title}\n\n${entries.length ? entries.map((node) => `- **${node.title}** [${node.confirmed ? 'geprüft' : 'unbestätigt'}${node.conflict ? ', Widerspruchshinweis' : ''}]\n  Gebiet: ${node.district || node.topic || 'nicht zugeordnet'}\n  ${node.body}\n  Herkunft: ${node.source}`).join('\n') : 'Noch keine Einträge.'}\n`;

  document.querySelector('[data-export-dossier]')?.addEventListener('click', () => {
    const library = read();
    const atlas = current(library);
    if (!atlas) return;
    const byKind = (kind) => atlas.nodes.filter((node) => node.kind === kind);
    const dossier = `# Entscheidungsdossier: ${atlas.title}\n\nErstellt: ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}\nAtlas App: v0.5.1\nDatenschema: v0.2\n\n## Ausgangspunkt\n\n${atlas.problem}\n\n${section('Geprüfte Aussagen', atlas.nodes.filter((node) => node.kind === 'known' && node.confirmed))}\n${section('Unbestätigte Aussagen', atlas.nodes.filter((node) => node.kind === 'known' && !node.confirmed))}\n${section('Annahmen', byKind('assumption'))}\n${section('Offene Fragen', byKind('open'))}\n${section('Entscheidungen', byKind('decision'))}\n${section('Zu prüfende Widerspruchshinweise', atlas.nodes.filter((node) => node.conflict))}\n## Transparenzgrenze\n\nDieses Dossier wurde lokal aus einem regelbasierten Hex-Atlas erzeugt. Einordnungen, Gebietszuordnungen, Prüfstatus und Widerspruchshinweise sind keine verifizierten Tatsachen und keine KI-Bewertung. Browserdaten und Exportdateien sind technisch nicht manipulationssicher.\n`;
    record(atlas, 'dossier_exported', 'Entscheidungsdossier als Markdown exportiert.');
    write(library);
    download(`${atlas.title.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '') || 'atlas'}-entscheidungsdossier.md`, dossier);
  });

  const spiral = (count) => {
    const cells = [{ q: 0, r: 0 }];
    const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    for (let radius = 1; cells.length < count; radius += 1) {
      let q = -radius;
      let r = radius;
      for (const [dq, dr] of directions) {
        for (let step = 0; step < radius && cells.length < count; step += 1) {
          cells.push({ q, r });
          q += dq;
          r += dr;
        }
      }
    }
    return cells;
  };

  const decorate = () => {
    const atlas = current(read());
    const root = document.querySelector('[data-nodes]');
    const stage = document.querySelector('.stage');
    const buttons = [...document.querySelectorAll('[data-nodes] .node')];
    if (!atlas || !root || !stage || buttons.length !== atlas.nodes.length) return;

    root.classList.add('hex-map');
    stage.classList.add('hex-stage');
    const cells = spiral(buttons.length);
    const scale = window.innerWidth < 700 ? 118 : 154;
    const vertical = scale * 0.86;
    buttons.forEach((button, index) => {
      const node = atlas.nodes[index];
      const cell = cells[index];
      const x = (cell.q + cell.r / 2) * scale;
      const y = cell.r * vertical;
      button.style.left = `calc(50% + ${x}px)`;
      button.style.top = `calc(50% + ${y}px)`;
      button.dataset.topic = node.topic || 'unassigned';
      button.dataset.district = node.district || '';
      button.classList.toggle('conflict', Boolean(node.conflict));
      button.classList.toggle('new-hex', Boolean(node.createdAt && Date.now() - new Date(node.createdAt).getTime() < 12000));
      if (node.conflict) {
        const badge = button.querySelector('.node-kind');
        if (badge && !badge.textContent.includes('Widerspruch')) badge.textContent += ' · Widerspruch';
      }
      if (node.district && !button.querySelector('.hex-district')) {
        const district = document.createElement('span');
        district.className = 'hex-district';
        district.textContent = node.district;
        button.prepend(district);
      }
    });
  };

  const nodeRoot = document.querySelector('[data-nodes]');
  if (nodeRoot) new MutationObserver(decorate).observe(nodeRoot, { childList: true });
  window.addEventListener('resize', decorate);

  setTimeout(() => {
    if (sessionStorage.getItem(REOPEN) === 'true') {
      sessionStorage.removeItem(REOPEN);
      document.querySelector('.atlas-card-open')?.click();
      setTimeout(() => document.querySelector('[data-tab="atlas"]')?.click(), 0);
    }
    decorate();
  }, 0);
})();
