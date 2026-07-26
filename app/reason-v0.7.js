(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v03';
  const REOPEN = 'reason-engine-atlas-reopen-v07';
  const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const PLAN = [
    { key: 'actors', title: 'Beteiligte', fieldType: 'actor', question: 'Wer ist an diesem Problem beteiligt oder davon betroffen?' },
    { key: 'outcome', title: 'Ziel / Ergebnis', fieldType: 'statement', question: 'Was wäre ein gutes, überprüfbares Ergebnis?' },
    { key: 'rules', title: 'Regeln / Grenzen', fieldType: 'rule', question: 'Welche Regeln, Grenzen oder Ressourcen müssen berücksichtigt werden?' },
    { key: 'process', title: 'Ablauf heute', fieldType: 'process', question: 'Wie läuft der Prozess heute tatsächlich ab, Schritt für Schritt?' },
    { key: 'friction', title: 'Engpass', fieldType: 'risk', question: 'Wo entsteht momentan der größte Verlust, Konflikt oder Zeitaufwand?' },
    { key: 'decision', title: 'Nächste Entscheidung', fieldType: 'decision', question: 'Welche Entscheidung muss als Nächstes getroffen werden?' }
  ];

  const workspace = document.querySelector('[data-screen="workspace"]');
  if (workspace) {
    workspace.dataset.side = 'chat';
    workspace.innerHTML = `
      <header class="workspace-head">
        <div class="workspace-title">
          <button class="back-link" type="button" data-back-library>← Alle Atlanten</button>
          <p class="eyebrow">AKTUELLER ATLAS</p>
          <h1 data-title>Neuer Atlas</h1>
        </div>
        <div class="actions workspace-actions">
          <button class="secondary" data-add-field>Feld hinzufügen</button>
          <button class="secondary" data-export-dossier>Dossier exportieren</button>
          <button class="secondary" data-export>Atlas exportieren</button>
          <button class="danger" data-delete-atlas>Atlas löschen</button>
        </div>
      </header>
      <section class="city-guide" data-city-guide aria-label="Stadtführer">
        <div><small>ORT</small><strong data-guide-location>Problemkern</strong></div>
        <div><small>ZIEL</small><strong data-guide-destination>Erster Rundgang</strong></div>
        <div><small>ROUTE</small><strong data-guide-route>Problemkern → Beteiligte</strong></div>
        <div><small>TOR</small><strong data-guide-gate>Erste Frage beantworten</strong></div>
        <div><small>BLOCKER</small><strong data-guide-blocker>keiner erkannt</strong></div>
        <div><small>STATUS</small><strong data-guide-status>UNTERWEGS</strong></div>
        <button type="button" data-guide-focus>Zum Tor</button>
      </section>
      <nav class="tabs" aria-label="Atlas-Ansichten">
        <button class="active" data-tab="atlas">Karte</button>
        <button data-tab="chat">Gespräch</button>
        <button data-tab="history">Verlauf</button>
      </nav>
      <div class="workgrid">
        <section class="panel atlas-panel active" data-panel="atlas">
          <header class="panel-head map-head">
            <div><p class="eyebrow">FELDKARTE</p><h2>Atlas</h2></div>
            <div class="map-meta">
              <p class="map-stats"><span data-field-count>0 Felder</span><span data-route-count>0 Wege</span></p>
              <div class="map-tools">
                <button type="button" data-zoom-out aria-label="Karte verkleinern">−</button>
                <button type="button" data-center-map>Zentrieren</button>
                <button type="button" data-zoom-in aria-label="Karte vergrößern">+</button>
              </div>
            </div>
          </header>
          <div class="map-legend">
            <span data-legend="statement">Aussage</span><span data-legend="actor">Beteiligte</span>
            <span data-legend="process">Ablauf</span><span data-legend="question">Offen</span>
            <span data-legend="risk">Risiko</span><span data-legend="decision">Entscheidung</span>
          </div>
          <div class="stage" data-stage>
            <div class="map-canvas" data-map-canvas>
              <div class="map-board" data-map-board>
                <svg class="routes" data-routes aria-hidden="true"></svg>
                <div class="fields" data-fields data-nodes></div>
              </div>
            </div>
          </div>
        </section>
        <aside class="panel history-panel" data-panel="history">
          <header class="panel-head"><div><p class="eyebrow">ÄNDERUNGSSPUR</p><h2>Verlauf</h2></div><span class="prototype">append-only in der Oberfläche</span></header>
          <p class="integrity-note">Neue Ereignisse werden in der Oberfläche angehängt. Lokal gespeicherte Browserdaten sind technisch nicht manipulationssicher.</p>
          <ol class="history-list" data-history></ol>
        </aside>
        <aside class="panel chat-panel active-side" data-panel="chat">
          <header class="panel-head"><div><p class="eyebrow">STADTFÜHRUNG</p><h2>Gespräch</h2></div><span class="prototype">jede Eingabe wird ein Hex</span></header>
          <div class="messages" data-messages aria-live="polite"></div>
          <form class="composer" data-chat-form>
            <textarea id="chat-input" rows="3" maxlength="1200" required placeholder="Erzähle weiter. Aus jeder Eingabe entsteht sofort ein neues Feld …"></textarea>
            <button class="primary" type="submit">Neues Hex anlegen</button>
          </form>
        </aside>
      </div>`;
  }

  const oldDialog = document.querySelector('[data-node-dialog]');
  if (oldDialog) {
    oldDialog.outerHTML = `
      <dialog data-field-dialog>
        <form method="dialog" data-field-form>
          <button class="close" value="cancel" aria-label="Dialog schließen">×</button>
          <p class="eyebrow" data-field-dialog-label>ATLAS-FELD</p>
          <label for="field-title">Titel</label><input id="field-title" data-field-title maxlength="90" required>
          <label for="field-body">Inhalt</label><textarea id="field-body" data-field-body rows="6" maxlength="1600" required></textarea>
          <div class="form-grid">
            <div><label for="field-type">Feldtyp</label><select id="field-type" data-field-type>
              <option value="statement">Aussage</option><option value="assumption">Annahme</option>
              <option value="question">Offene Frage</option><option value="decision">Entscheidung</option>
              <option value="resource">Ressource</option><option value="risk">Risiko</option>
              <option value="process">Prozessschritt</option><option value="actor">Beteiligter Bereich</option>
              <option value="rule">Regel / Grenze</option>
            </select></div>
            <div><label for="field-state">Zustand</label><select id="field-state" data-field-state>
              <option value="empty">Leer / ungeklärt</option><option value="provisional">Vorläufig</option>
              <option value="confirmed">Bestätigt</option><option value="critical">Kritisch</option>
              <option value="decided">Entschieden</option>
            </select></div>
          </div>
          <dl><div><dt>Position</dt><dd data-field-position></dd></div><div><dt>Herkunft</dt><dd data-field-source></dd></div></dl>
          <section class="route-editor" data-route-editor>
            <div class="route-editor-head"><div><p class="eyebrow">WEGE UND ABHÄNGIGKEITEN</p><h3>Verbindungen</h3></div></div>
            <div class="route-create">
              <select data-route-target aria-label="Zielfeld"></select>
              <select data-route-type aria-label="Beziehungstyp"><option value="supports">unterstützt</option><option value="depends">hängt ab von</option><option value="leads">führt zu</option><option value="blocks">blockiert</option><option value="decides">entscheidet über</option><option value="confirms">bestätigt durch</option></select>
              <button class="secondary" type="button" data-add-route>Weg anlegen</button>
            </div>
            <ul class="route-list" data-route-list></ul>
          </section>
          <div class="actions dialog-actions"><button class="danger" type="button" data-delete-field>Entfernen</button><span></span><button class="secondary" type="button" data-confirm-field>Bestätigen</button><button class="primary" value="save">Speichern</button></div>
        </form>
      </dialog>`;
  }

  const orbital = document.querySelector('.orbital');
  if (orbital) {
    orbital.className = 'hex-intro';
    orbital.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><b></b>';
  }

  const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = () => new Date().toISOString();
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch (error) { console.warn('Atlas v0.7 could not read local data.', error); return null; }
  };
  const write = (library) => localStorage.setItem(KEY, JSON.stringify(library));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const coordKey = (q, r) => `${q},${r}`;
  const distance = (a, b) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs((-a.q - a.r) - (-b.q - b.r)));
  const short = (text, limit = 52) => {
    const first = text.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0];
    const words = first.split(' ').slice(0, 9).join(' ');
    return words.length > limit ? `${words.slice(0, limit - 1)}…` : words || 'Neues Feld';
  };
  const classify = (text, fallback = 'statement') => {
    const value = text.toLowerCase();
    if (value.includes('?') || /\b(unklar|weiß nicht|offen|keine ahnung)\b/.test(value)) return 'question';
    if (/\b(vielleicht|vermutlich|wahrscheinlich|ich glaube|ich denke|könnte|dürfte)\b/.test(value)) return 'assumption';
    if (/\b(entschieden|entscheidung|wir machen|wir nehmen|festgelegt|muss|soll|verantwortlich ist)\b/.test(value)) return 'decision';
    if (/\b(risiko|problem|engpass|fehler|verlust|konflikt|gefährlich)\b/.test(value)) return 'risk';
    if (/\b(material|budget|zeit|gerät|fahrzeug|ressource)\b/.test(value)) return 'resource';
    if (/\b(zuerst|danach|anschließend|ablauf|schritt)\b/.test(value)) return 'process';
    if (/\b(team|abteilung|person|chef|mitarbeiter|gärtnerei|haustechnik)\b/.test(value)) return 'actor';
    return fallback;
  };
  const typeLabel = (type) => ({ statement: 'Aussage', assumption: 'Annahme', question: 'offene Frage', decision: 'Entscheidung', resource: 'Ressource', risk: 'Risiko', process: 'Prozessschritt', actor: 'Beteiligte', rule: 'Regel' }[type] || 'Feld');
  const record = (atlas, type, text) => {
    atlas.history ||= [];
    atlas.history.push({ id: makeId('event'), at: now(), type, text });
    atlas.updatedAt = now();
  };

  const stopWords = new Set(['aber', 'auch', 'dann', 'dass', 'eine', 'einem', 'einen', 'einer', 'eines', 'für', 'haben', 'hier', 'immer', 'ist', 'kein', 'keine', 'mit', 'nicht', 'oder', 'sind', 'und', 'vom', 'von', 'wird', 'wir', 'zum', 'zur']);
  const words = (text) => new Set(text.toLowerCase().replace(/[^a-zäöüß0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3 && !stopWords.has(word)));
  const negated = (text) => /\b(nicht|kein|keine|niemals|nie|ohne|stimmt nicht|falsch)\b/i.test(text);

  function markConflicts(atlas, candidate) {
    const candidateWords = words(candidate.body);
    if (candidateWords.size < 2 || candidate.fieldType === 'question') return 0;
    const conflicts = atlas.fields.filter((field) => {
      if (field.id === candidate.id || field.id === 'root' || field.fieldType === 'question' || field.state === 'empty') return false;
      const overlap = [...candidateWords].filter((word) => words(field.body).has(word)).length;
      return overlap >= 2 && negated(candidate.body) !== negated(field.body);
    });
    if (!conflicts.length) return 0;
    candidate.conflict = true;
    candidate.conflictWith = [...new Set([...(candidate.conflictWith || []), ...conflicts.map((field) => field.id)])];
    conflicts.forEach((field) => {
      field.conflict = true;
      field.conflictWith = [...new Set([...(field.conflictWith || []), candidate.id])];
    });
    record(atlas, 'conflict_flagged', `Möglicher Widerspruch bei „${candidate.title}“ markiert. Regelbasierter Hinweis, keine inhaltliche Entscheidung.`);
    return conflicts.length;
  }

  function freeCoordinateNear(atlas, parent) {
    const occupied = new Set(atlas.fields.map((field) => coordKey(field.q, field.r)));
    for (const [dq, dr] of DIRECTIONS) {
      const candidate = { q: parent.q + dq, r: parent.r + dr };
      if (!occupied.has(coordKey(candidate.q, candidate.r))) return candidate;
    }
    const candidates = [];
    for (let radius = 1; radius <= 8; radius += 1) {
      for (let q = -radius; q <= radius; q += 1) {
        for (let r = -radius; r <= radius; r += 1) {
          const s = -q - r;
          if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) !== radius) continue;
          if (occupied.has(coordKey(q, r))) continue;
          candidates.push({ q, r });
        }
      }
    }
    candidates.sort((a, b) => distance(a, parent) - distance(b, parent) || distance(a, { q: 0, r: 0 }) - distance(b, { q: 0, r: 0 }) || a.q - b.q || a.r - b.r);
    return candidates[0] || { q: parent.q + 1, r: parent.r };
  }

  function districtForFreeEntry(atlas, fieldType) {
    const keyByType = { actor: 'actors', process: 'process', risk: 'friction', rule: 'rules', resource: 'rules', decision: 'decision', statement: 'outcome', assumption: 'outcome', question: 'outcome' };
    const key = keyByType[fieldType] || 'outcome';
    return atlas.fields.find((field) => field.key === key) || atlas.fields.find((field) => field.id === 'root');
  }

  function updateDistrictSummary(atlas, district) {
    if (!district || district.id === 'root') return;
    const count = atlas.fields.filter((field) => field.districtKey === district.key).length;
    district.body = `${count} ${count === 1 ? 'Eintrag' : 'Einträge'} in diesem Bezirk.`;
    district.state = count ? 'provisional' : 'empty';
    district.confirmed = false;
    district.source = 'Automatisch geführter Bezirk';
  }

  function computeGuide(atlas, currentField = null) {
    const step = Math.min(Number.isInteger(atlas.step) ? atlas.step : 0, PLAN.length);
    const next = PLAN[step] || null;
    const critical = atlas.fields.filter((field) => field.state === 'critical').length;
    const conflicts = atlas.fields.filter((field) => field.conflict).length;
    const blocker = critical ? `${critical} kritische ${critical === 1 ? 'Stelle' : 'Stellen'}` : conflicts ? `${conflicts} Widerspruchs${conflicts === 1 ? 'hinweis' : 'hinweise'}` : 'keiner erkannt';
    const location = currentField?.title || atlas.guide?.location || atlas.fields.find((field) => field.id === 'root')?.title || 'Problemkern';
    const destination = next?.title || 'Prüfung und Entscheidung';
    const route = `${location} → ${destination}`;
    const gate = next?.question || 'Vorläufige Felder prüfen, bestätigen und die nächste Entscheidung markieren.';
    const status = critical ? 'BLOCKIERT' : next ? 'UNTERWEGS' : 'PRÜFUNG';
    atlas.guide = { location, destination, route, gate, blocker, status, currentFieldId: currentField?.id || atlas.guide?.currentFieldId || 'root', updatedAt: now() };
    return atlas.guide;
  }

  document.querySelector('[data-chat-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.querySelector('#chat-input');
    const text = input?.value.trim();
    const library = read();
    const atlas = current(library);
    if (!text || !atlas) return;

    atlas.fields ||= [];
    atlas.routes ||= [];
    atlas.messages ||= [];
    atlas.step = Math.min(Number.isInteger(atlas.step) ? atlas.step : 0, PLAN.length);

    const activePlan = PLAN[atlas.step] || null;
    const detectedType = classify(text, activePlan?.fieldType || 'statement');
    const district = activePlan
      ? atlas.fields.find((field) => field.key === activePlan.key) || atlas.fields.find((field) => field.id === 'root')
      : districtForFreeEntry(atlas, detectedType);
    const point = freeCoordinateNear(atlas, district);
    const field = {
      id: makeId('field'),
      key: null,
      districtKey: district?.key || 'problem',
      district: district?.title || 'Problemkern',
      title: short(text),
      body: text,
      fieldType: detectedType,
      state: 'provisional',
      confirmed: false,
      source: activePlan ? `Antwort im Rundgang auf: ${activePlan.question}` : 'Freie Eingabe nach dem ersten Rundgang',
      createdAt: now(),
      q: point.q,
      r: point.r
    };

    atlas.fields.push(field);
    atlas.routes.push({ id: makeId('route'), from: district?.id || 'root', to: field.id, type: activePlan ? 'supports' : 'leads' });
    updateDistrictSummary(atlas, district);
    atlas.messages.push({ id: makeId('message'), role: 'user', text });
    const conflictCount = markConflicts(atlas, field);
    record(atlas, 'hex_created', `Neues Hex „${field.title}“ im Bezirk „${field.district}“ angelegt und automatisch gefüllt.`);

    if (activePlan) atlas.step = Math.min(atlas.step + 1, PLAN.length);
    const nextPlan = PLAN[atlas.step] || null;
    computeGuide(atlas, field);
    atlas.messages.push({ id: makeId('message'), role: 'engine', text: `Ein neues Hex ist entstanden: „${field.title}“. Es wurde als ${typeLabel(detectedType)} dem Bezirk „${field.district}“ zugeordnet und bleibt vorläufig.${conflictCount ? ' Ein möglicher Widerspruch wurde als Prüfhinweis markiert.' : ''}` });
    atlas.messages.push({ id: makeId('message'), role: 'engine', text: nextPlan ? `Nächstes Tor: ${nextPlan.question}` : 'Der erste Rundgang ist vollständig. Jede weitere Eingabe erzeugt weiterhin ein neues Hex. Prüfe nun die Felder und markiere die nächste Entscheidung.' });

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
  const section = (title, fields) => `## ${title}\n\n${fields.length ? fields.map((field) => `- **${field.title}** [${field.state}${field.conflict ? ', Widerspruchshinweis' : ''}]\n  Bezirk: ${field.district || 'nicht zugeordnet'}\n  ${field.body}\n  Herkunft: ${field.source}`).join('\n') : 'Noch keine Einträge.'}\n`;

  document.querySelector('[data-export-dossier]')?.addEventListener('click', () => {
    const library = read();
    const atlas = current(library);
    if (!atlas) return;
    const fields = atlas.fields.filter((field) => field.id !== 'root' && !field.key);
    const guide = computeGuide(atlas);
    const dossier = `# Entscheidungsdossier: ${atlas.title}\n\nErstellt: ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}\nAtlas App: v0.7.0\nDatenschema: v0.3\n\n## Stadtführer\n\n- Ort: ${guide.location}\n- Ziel: ${guide.destination}\n- Route: ${guide.route}\n- Tor: ${guide.gate}\n- Blocker: ${guide.blocker}\n- Status: ${guide.status}\n\n## Ausgangspunkt\n\n${atlas.problem}\n\n${section('Bestätigte Felder', fields.filter((field) => ['confirmed', 'decided'].includes(field.state)))}\n${section('Vorläufige Felder', fields.filter((field) => field.state === 'provisional'))}\n${section('Annahmen', fields.filter((field) => field.fieldType === 'assumption'))}\n${section('Offene Fragen', fields.filter((field) => field.fieldType === 'question'))}\n${section('Risiken', fields.filter((field) => field.fieldType === 'risk' || field.state === 'critical'))}\n${section('Entscheidungen', fields.filter((field) => field.fieldType === 'decision'))}\n${section('Zu prüfende Widerspruchshinweise', fields.filter((field) => field.conflict))}\n## Transparenzgrenze\n\nDieses Dossier wurde lokal aus einer regelbasierten Feldkarte erzeugt. Einordnungen, Routen und Widerspruchshinweise sind keine verifizierten Tatsachen und keine KI-Bewertung. Browserdaten und Exportdateien sind technisch nicht manipulationssicher.\n`;
    record(atlas, 'dossier_exported', 'Entscheidungsdossier mit Stadtführer-Status als Markdown exportiert.');
    write(library);
    download(`${atlas.title.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '') || 'atlas'}-entscheidungsdossier.md`, dossier);
  });

  function renderGuide() {
    const library = read();
    const atlas = current(library);
    const guideRoot = document.querySelector('[data-city-guide]');
    if (!atlas || !guideRoot || document.querySelector('[data-screen="workspace"]')?.hidden) return;
    const guide = computeGuide(atlas, atlas.fields.find((field) => field.id === atlas.guide?.currentFieldId));
    const values = {
      location: guide.location,
      destination: guide.destination,
      route: guide.route,
      gate: guide.gate,
      blocker: guide.blocker,
      status: guide.status
    };
    Object.entries(values).forEach(([key, value]) => {
      const target = document.querySelector(`[data-guide-${key}]`);
      if (target) target.textContent = value;
    });
    guideRoot.dataset.status = guide.status.toLowerCase();
    write(library);
  }

  function decorateFields() {
    const library = read();
    const atlas = current(library);
    const buttons = [...document.querySelectorAll('[data-fields] .hex-field')];
    if (!atlas || buttons.length !== atlas.fields.length) return;
    buttons.forEach((button, index) => {
      const field = atlas.fields[index];
      button.dataset.district = field.district || '';
      button.classList.toggle('guide-current', field.id === atlas.guide?.currentFieldId);
      button.classList.toggle('conflict', Boolean(field.conflict));
      if (field.district && !field.key && !button.querySelector('.hex-district')) {
        const label = document.createElement('span');
        label.className = 'hex-district';
        label.textContent = field.district;
        button.prepend(label);
      }
      if (field.conflict) {
        const badge = button.querySelector('.field-kind');
        if (badge && !badge.textContent.includes('Widerspruch')) badge.textContent += ' · Widerspruch';
      }
    });
  }

  document.querySelector('[data-guide-focus]')?.addEventListener('click', () => {
    document.querySelector('[data-tab="chat"]')?.click();
    requestAnimationFrame(() => document.querySelector('#chat-input')?.focus());
  });

  const fieldRoot = document.querySelector('[data-fields]');
  if (fieldRoot) new MutationObserver(() => { decorateFields(); renderGuide(); }).observe(fieldRoot, { childList: true });

  setTimeout(() => {
    if (sessionStorage.getItem(REOPEN) === 'true') {
      sessionStorage.removeItem(REOPEN);
      document.querySelector('.atlas-card-open')?.click();
      setTimeout(() => document.querySelector('[data-tab="atlas"]')?.click(), 0);
    }
    decorateFields();
    renderGuide();
  }, 0);
})();
