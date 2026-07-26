(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v03';
  const REOPEN_KEY = 'reason-engine-atlas-reopen-v07';
  const DIAGNOSTIC_KEY = 'reason-engine-atlas-truth-gate-diagnostic';
  const TRUSTED_STATES = new Set(['confirmed', 'decided']);
  const SOURCE_SUFFIXES = [
    /; vom Nutzer bestätigt$/,
    /; vom Nutzer als korrekt erfasst bestätigt$/
  ];
  const DERIVED_KEYS = [
    'confirmedAt', 'verifiedAt', 'checkedAt', 'auditStatus',
    'evidenceStatus', 'conflict', 'conflictWith'
  ];

  const nativeSetItem = Storage.prototype.setItem;
  const nativeAlert = window.alert.bind(window);
  const pendingResetFields = new Set();
  let importContext = null;
  let importResetCount = 0;
  let importGuardTimer = null;
  let reloadQueued = false;

  function now() {
    return new Date().toISOString();
  }

  function makeId(prefix = 'event') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      return value?.version === '0.3' && Array.isArray(value.atlases) ? value : null;
    } catch (error) {
      console.warn('Atlas truth gate could not read local data.', error);
      return null;
    }
  }

  function stripConfirmation(source = '') {
    return SOURCE_SUFFIXES.reduce((value, pattern) => value.replace(pattern, ''), source);
  }

  function isTrusted(field) {
    return Boolean(field?.confirmed || TRUSTED_STATES.has(field?.state));
  }

  function hasDerivedAuthority(field) {
    return DERIVED_KEYS.some((key) => Object.prototype.hasOwnProperty.call(field || {}, key));
  }

  function signature(field) {
    return `${field?.title || ''}\u0000${field?.body || ''}\u0000${field?.fieldType || ''}`;
  }

  function clearDerivedAuthority(field) {
    DERIVED_KEYS.forEach((key) => { delete field[key]; });
  }

  function resetAuthority(field) {
    const hadAuthority = isTrusted(field);
    field.state = /noch nicht geklärt/i.test(field.body || '') ? 'empty' : 'provisional';
    field.confirmed = false;
    field.source = stripConfirmation(field.source || '');
    clearDerivedAuthority(field);
    return hadAuthority;
  }

  function record(atlas, type, text, details = {}) {
    atlas.history ||= [];
    atlas.history.push({ id: makeId(), at: now(), type, text, ...details });
    atlas.updatedAt = now();
  }

  function preserveOrRecordReset(beforeAtlas, nextAtlas, field) {
    nextAtlas.history ||= [];
    const alreadyPresent = nextAtlas.history.some((event) => event.type === 'field_truth_reset' && event.fieldId === field.id);
    if (alreadyPresent) return;
    const prior = beforeAtlas?.history?.find((event) => event.type === 'field_truth_reset' && event.fieldId === field.id);
    if (prior) {
      nextAtlas.history.push(prior);
      return;
    }
    record(nextAtlas, 'field_truth_reset', `Prüfstatus von „${field.title}“ nach einer inhaltlichen Änderung aufgehoben.`, { fieldId: field.id });
  }

  function sanitizeSemanticEdits(beforeLibrary, nextLibrary) {
    const comparisons = [];
    if (!beforeLibrary?.atlases || !nextLibrary?.atlases) return { resets: 0, comparisons };
    const beforeAtlases = new Map(beforeLibrary.atlases.map((atlas) => [atlas.id, atlas]));
    let resets = 0;

    nextLibrary.atlases.forEach((nextAtlas) => {
      const beforeAtlas = beforeAtlases.get(nextAtlas.id);
      if (!beforeAtlas || !Array.isArray(nextAtlas.fields)) return;
      const beforeFields = new Map((beforeAtlas.fields || []).map((field) => [field.id, field]));

      nextAtlas.fields.forEach((nextField) => {
        if (nextField.id === 'root') return;
        const beforeField = beforeFields.get(nextField.id);
        if (!beforeField) return;
        const key = `${nextAtlas.id}:${nextField.id}`;
        const beforeSignature = signature(beforeField);
        const nextSignature = signature(nextField);
        const semanticChanged = beforeSignature !== nextSignature;
        const beforeTrusted = isTrusted(beforeField);
        const nextTrusted = isTrusted(nextField);
        const pending = pendingResetFields.has(key);
        const derived = hasDerivedAuthority(beforeField) || hasDerivedAuthority(nextField);
        const mustReset = pending || (semanticChanged && (beforeTrusted || nextTrusted || derived));
        comparisons.push({ atlasId: nextAtlas.id, fieldId: nextField.id, semanticChanged, beforeTrusted, nextTrusted, pending, derived, mustReset, beforeSignature, nextSignature });
        if (!mustReset) return;

        resetAuthority(nextField);
        pendingResetFields.add(key);
        preserveOrRecordReset(beforeAtlas, nextAtlas, nextField);
        resets += 1;
      });
    });

    return { resets, comparisons };
  }

  function sanitizeImportedLibrary(library) {
    if (!library || !Array.isArray(library.atlases) || !importContext) return 0;
    let resets = 0;

    library.atlases.forEach((atlas) => {
      if (importContext.existingIds.has(atlas.id) || !Array.isArray(atlas.fields)) return;
      let atlasResets = 0;
      atlas.fields.forEach((field) => {
        if (field.id === 'root') return;
        if (resetAuthority(field)) {
          resets += 1;
          atlasResets += 1;
        } else {
          clearDerivedAuthority(field);
        }
      });
      if (atlasResets) {
        record(atlas, 'import_trust_reset', `${atlasResets} importierte Prüf- oder Entscheidungsstatus wurden verworfen und müssen lokal erneut geprüft werden.`);
      }
    });

    importResetCount = resets;
    return resets;
  }

  function queueWorkspaceReload() {
    if (reloadQueued) return;
    reloadQueued = true;
    queueMicrotask(() => {
      sessionStorage.setItem(REOPEN_KEY, 'true');
      location.reload();
    });
  }

  Storage.prototype.setItem = function setItemWithTruthGate(key, value) {
    if (this !== localStorage || key !== LIBRARY_KEY) return nativeSetItem.call(this, key, value);

    try {
      const beforeLibrary = readLibrary();
      const nextLibrary = JSON.parse(value);
      const semanticResult = sanitizeSemanticEdits(beforeLibrary, nextLibrary);
      let importedResets = 0;
      if (importContext) {
        clearTimeout(importGuardTimer);
        importedResets = sanitizeImportedLibrary(nextLibrary);
        importContext = null;
      }
      sessionStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify({ at: now(), editResets: semanticResult.resets, importedResets, comparisons: semanticResult.comparisons }));
      const result = nativeSetItem.call(this, key, JSON.stringify(nextLibrary));
      if (semanticResult.resets) queueWorkspaceReload();
      return result;
    } catch (error) {
      sessionStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify({ at: now(), error: String(error?.stack || error) }));
      console.error('Atlas truth gate could not validate a storage write.', error);
      importContext = null;
      return nativeSetItem.call(this, key, value);
    }
  };

  window.alert = (message) => {
    if (importResetCount && /importiert/i.test(String(message))) {
      const count = importResetCount;
      importResetCount = 0;
      nativeAlert(`${message}\n\n${count} importierte Prüf- oder Entscheidungsstatus wurden nicht übernommen. Diese Felder sind wieder vorläufig und müssen lokal erneut geprüft werden.`);
      return;
    }
    nativeAlert(message);
  };

  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('[data-import-input]')) return;
    const library = readLibrary();
    importContext = { existingIds: new Set((library?.atlases || []).map((atlas) => atlas.id)) };
    clearTimeout(importGuardTimer);
    importGuardTimer = setTimeout(() => { importContext = null; }, 15000);
  }, true);

  function relabelCheckedState() {
    document.querySelectorAll('option[value="confirmed"]').forEach((option) => {
      if (option.textContent !== 'geprüft') option.textContent = 'geprüft';
    });
    document.querySelectorAll('.hex-field[data-state="confirmed"]').forEach((field) => {
      if (field.dataset.stateLabel !== 'geprüft') field.dataset.stateLabel = 'geprüft';
    });
    const label = document.querySelector('[data-field-dialog-label]');
    if (label?.textContent.includes('bestätigt')) label.textContent = label.textContent.replaceAll('bestätigt', 'geprüft');
  }

  new MutationObserver(relabelCheckedState).observe(document.documentElement, { childList: true, subtree: true });
  relabelCheckedState();
})();
