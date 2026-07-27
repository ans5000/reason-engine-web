(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v03';
  const SESSION_KEY = 'reason-engine-atlas-regulatory-session-v091';
  const CHANNELS = ['supportingEvidence', 'contradictingEvidence', 'positiveOutcomes', 'negativeOutcomes', 'conflicts'];
  const evaluator = globalThis.AtlasRegulation;
  let scheduled = 0;

  if (!evaluator) {
    console.error('Atlas Regulatory Evaluator v0.9.1 is missing.');
    return;
  }

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch { return null; }
  };
  const write = (library) => localStorage.setItem(KEY, JSON.stringify(library));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const now = () => new Date().toISOString();

  function sessionId() {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  }

  function record(atlas, type, text) {
    atlas.history ||= [];
    atlas.history.push({ id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: now(), type, text });
    atlas.updatedAt = now();
  }

  function ensureInputs(atlas) {
    let changed = false;
    const activeSession = sessionId();

    (atlas.routes || []).filter((route) => route.pathOrigin === 'desired_path').forEach((route) => {
      route.regulatoryProfile ||= evaluator.PROFILE.name;
      route.regulatoryRefs ||= {};
      CHANNELS.forEach((channel) => {
        if (!Array.isArray(route.regulatoryRefs[channel])) route.regulatoryRefs[channel] = [];
      });

      const legacyUses = Math.max(1, Number(route.pathUses) || 1);
      route.activation ||= {};
      const previousObserved = Math.max(0, Number(route.regulatoryRuntime?.lastObservedPathUses) || 0);
      route.activation.useCount = Math.max(legacyUses, Number(route.activation.useCount) || 0);
      route.activation.sessionIds = Array.isArray(route.activation.sessionIds) ? [...new Set(route.activation.sessionIds.map(String))] : [];
      route.activation.firstUsedAt ||= route.createdAt || now();
      route.activation.lastUsedAt ||= route.lastUsedAt || route.createdAt || now();

      if (previousObserved === 0 || legacyUses > previousObserved) {
        if (!route.activation.sessionIds.includes(activeSession)) route.activation.sessionIds.push(activeSession);
        route.activation.lastUsedAt = route.lastUsedAt || now();
        route.regulatoryRuntime = { lastObservedPathUses: legacyUses };
        changed = true;
      }
    });

    return changed;
  }

  function failedCenterChecks(result) {
    return Object.entries(result.matrix || {}).filter(([, passed]) => !passed).map(([name]) => name);
  }

  function removeUnqualifiedCandidates(atlas) {
    const state = atlas.pathGrowth;
    if (!state || !Array.isArray(state.centerCandidates)) return false;
    const before = state.centerCandidates.length;
    state.centerCandidates = state.centerCandidates.filter((fieldId) => evaluator.evaluateCenterCandidate(atlas, fieldId).isCandidate);
    return before !== state.centerCandidates.length;
  }

  function applyRouteView(atlas) {
    const nodes = [...document.querySelectorAll('[data-routes] .route')];
    (atlas.routes || []).forEach((route, index) => {
      if (route.pathOrigin !== 'desired_path') return;
      const evaluation = evaluator.evaluateRoute(atlas, route);
      const node = nodes[index];
      if (!node) return;
      const visualState = evaluation.regulationState === 'consolidated'
        ? 'road'
        : evaluation.eligibleForVisualThickening ? 'path' : 'trace';
      node.dataset.pathState = visualState;
      node.dataset.activityState = evaluation.activityState || 'inactive';
      node.dataset.regulationState = evaluation.regulationState || 'unreviewed';
      node.dataset.epistemicBand = evaluation.epistemicBand || 'unassessed';
      node.dataset.visualMeaning = 'activation_only';
      node.setAttribute('aria-label', `Aktivität: ${evaluation.activityState}. Regulation: ${evaluation.regulationState}. Evidenz: ${evaluation.epistemicBand}.`);
    });
  }

  function toast(text) {
    let node = document.querySelector('[data-atlas-toast]');
    if (!node) {
      node = document.createElement('div');
      node.dataset.atlasToast = '';
      node.className = 'atlas-toast';
      document.body.append(node);
    }
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  function refresh() {
    const library = read();
    const atlas = current(library);
    if (!atlas) return;

    const inputsChanged = ensureInputs(atlas);
    const candidatesChanged = removeUnqualifiedCandidates(atlas);
    if (candidatesChanged) record(atlas, 'center_candidate_regulation_reset', 'Nicht ausreichend geprüfte Zentrumskandidaten wurden zur weiteren Prüfung zurückgesetzt.');
    if (inputsChanged || candidatesChanged) write(library);

    applyRouteView(atlas);
    document.documentElement.dataset.atlasRegulatoryEvaluator = 'loaded';
    document.documentElement.dataset.atlasRegulatoryProfile = evaluator.PROFILE.name;
  }

  function schedule() {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(refresh);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-center-emergence]') : null;
    if (!target) return;
    const library = read();
    const atlas = current(library);
    const result = atlas && evaluator.evaluateCenterCandidate(atlas, target.dataset.centerEmergence);
    if (result?.isCandidate) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (atlas?.pathGrowth?.centerCandidates) {
      atlas.pathGrowth.centerCandidates = atlas.pathGrowth.centerCandidates.filter((id) => id !== target.dataset.centerEmergence);
      record(atlas, 'center_emergence_blocked', `Zentrumskandidat blockiert: ${failedCenterChecks(result || { matrix: {} }).join(', ') || 'Prüfmatrix nicht erfüllt'}.`);
      write(library);
    }
    target.remove();
    toast('Noch kein Zentrum: Die Regulatory-Prüfmatrix ist nicht vollständig erfüllt.');
  }, true);

  const routes = document.querySelector('[data-routes]');
  const fields = document.querySelector('[data-fields]');
  if (routes) new MutationObserver(schedule).observe(routes, { childList: true });
  if (fields) new MutationObserver(schedule).observe(fields, { childList: true });
  window.addEventListener('pageshow', schedule);
  window.addEventListener('storage', (event) => { if (event.key === KEY) schedule(); });
  setTimeout(refresh, 160);

  globalThis.AtlasRegulatoryRuntime = Object.freeze({ refresh, profile: evaluator.PROFILE.name });
})();
