(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v02';
  const REOPEN = 'reason-engine-atlas-reopen-v04';
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
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (error) { console.warn('Atlas v0.4 could not read local data.', error); return null; }
  };
  const write = (library) => localStorage.setItem(KEY, JSON.stringify(library));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const short = (text, limit = 46) => {
    const first = text.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0];
    const words = first.split(' ').slice(0, 8).join(' ');
    return words.length > limit ? `${words.slice(0, limit - 1)}…` : words || 'Neuer Eintrag';
  };
  const classify = (text) => {
    const value = text.toLowerCase();
    if (value.includes('?') || /\b(unklar|weiß nicht|offen|keine ahnung)\b/.test(value)) return 'open';
    if (/\b(vielleicht|vermutlich|wahrscheinlich|ich glaube|ich denke|könnte|dürfte)\b/.test(value)) return 'assumption';
    if (/\b(entschieden|entscheidung|wir machen|wir nehmen|festgelegt|muss|soll|verantwortlich ist)\b/.test(value)) return 'decision';
    return 'known';
  };
  const label = (kind) => ({ open: 'offene Frage', assumption: 'Annahme', decision: 'vorläufige Entscheidung', known: 'direkte Aussage' }[kind] || 'Eintrag');
  const point = (index) => {
    const positions = [[50,10],[88,34],[87,68],[50,88],[12,68],[12,34],[35,27],[68,28],[68,67],[34,68]];
    const value = positions[index % positions.length];
    return { x: value[0], y: value[1] };
  };
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
    let target = question && atlas.nodes.find((node) => node.topic === question.key || node.title === question.title);

    if (!target && question) {
      const position = point(atlas.nodes.length - 1);
      target = { id: id('node'), topic: question.key, title: question.title, body: 'Noch nicht geklärt.', kind: 'open', confirmed: false, source: 'Vorgeschlagener Klärungsraum', x: position.x, y: position.y };
      atlas.nodes.push(target);
    }

    atlas.messages.push({ id: id('message'), role: 'user', text });
    if (target && target.body === 'Noch nicht geklärt.') {
      target.topic = question.key;
      target.body = text;
      target.kind = kind;
      target.confirmed = false;
      target.source = `Antwort im Gespräch auf: ${question.text}`;
      record(atlas, 'topic_answered', `Antwort dem Klärungsraum „${target.title}“ zugeordnet.`);
    } else {
      const position = point(atlas.nodes.length - 1);
      target = { id: id('node'), topic: question?.key || null, title: short(text), body: text, kind, confirmed: false, source: 'Direkte ergänzende Eingabe im Gespräch', x: position.x, y: position.y };
      atlas.nodes.push(target);
      record(atlas, 'message', `Ergänzender Gesprächseintrag als ${label(kind)} aufgenommen.`);
    }

    const conflicts = markConflicts(atlas, target);
    atlas.messages.push({ id: id('message'), role: 'engine', text: `Ich habe die Antwort als ${label(kind)} eingeordnet und dem aktuellen Klärungsraum zugeordnet.${conflicts ? ' Ein möglicher Widerspruch wurde zur Prüfung markiert.' : ''}` });
    atlas.step = Math.min(atlas.step + 1, QUESTIONS.length);
    atlas.messages.push({ id: id('message'), role: 'engine', text: atlas.step < QUESTIONS.length ? QUESTIONS[atlas.step].text : 'Der erste Gesprächsbogen ist vollständig. Prüfe die Einträge und exportiere anschließend das Entscheidungsdossier.' });
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
  const section = (title, entries) => `## ${title}\n\n${entries.length ? entries.map((node) => `- **${node.title}** [${node.confirmed ? 'bestätigt' : 'unbestätigt'}${node.conflict ? ', Widerspruchshinweis' : ''}]\n  ${node.body}\n  Herkunft: ${node.source}`).join('\n') : 'Noch keine Einträge.'}\n`;

  document.querySelector('[data-export-dossier]')?.addEventListener('click', () => {
    const library = read();
    const atlas = current(library);
    if (!atlas) return;
    const byKind = (kind) => atlas.nodes.filter((node) => node.kind === kind);
    const dossier = `# Entscheidungsdossier: ${atlas.title}\n\nErstellt: ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}\nAtlas App: v0.4.0\nDatenschema: v0.2\n\n## Ausgangspunkt\n\n${atlas.problem}\n\n${section('Bestätigte Aussagen', atlas.nodes.filter((node) => node.kind === 'known' && node.confirmed))}\n${section('Unbestätigte Aussagen', atlas.nodes.filter((node) => node.kind === 'known' && !node.confirmed))}\n${section('Annahmen', byKind('assumption'))}\n${section('Offene Fragen', byKind('open'))}\n${section('Entscheidungen', byKind('decision'))}\n${section('Zu prüfende Widerspruchshinweise', atlas.nodes.filter((node) => node.conflict))}\n## Transparenzgrenze\n\nDieses Dossier wurde lokal aus einem regelbasierten Atlas erzeugt. Einordnungen und Widerspruchshinweise sind keine verifizierten Tatsachen und keine KI-Bewertung. Browserdaten und Exportdateien sind technisch nicht manipulationssicher.\n`;
    record(atlas, 'dossier_exported', 'Entscheidungsdossier als Markdown exportiert.');
    write(library);
    download(`${atlas.title.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '') || 'atlas'}-entscheidungsdossier.md`, dossier);
  });

  const decorate = () => {
    const atlas = current(read());
    const buttons = [...document.querySelectorAll('[data-nodes] .node')];
    if (!atlas || buttons.length !== atlas.nodes.length) return;
    buttons.forEach((button, index) => {
      const node = atlas.nodes[index];
      button.classList.toggle('conflict', Boolean(node.conflict));
      if (node.conflict) {
        const badge = button.querySelector('.node-kind');
        if (badge && !badge.textContent.includes('Widerspruch')) badge.textContent += ' · Widerspruchshinweis';
      }
    });
  };
  const nodeRoot = document.querySelector('[data-nodes]');
  if (nodeRoot) new MutationObserver(decorate).observe(nodeRoot, { childList: true });

  setTimeout(() => {
    if (sessionStorage.getItem(REOPEN) === 'true') {
      sessionStorage.removeItem(REOPEN);
      document.querySelector('.atlas-card-open')?.click();
    }
    decorate();
  }, 0);
})();