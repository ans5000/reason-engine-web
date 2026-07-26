(() => {
  'use strict';

  const LIBRARY_KEY = 'reason-engine-atlas-library-v03';
  const REOPEN_KEY = 'reason-engine-atlas-reopen-v07';
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
  let selectedFieldId = null;
  let importContext = null;
  let importResetCount = 0;
  let importGuardTimer = null;

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

  function writeLibrary(library) {
    nativeSetItem.call(localStorage, LIBRARY_KEY, JSON.stringify(library));
  }

  function currentAtlas(library) {
    return library?.atlases?.find((atlas) => atlas.id === library.currentId) || null;
  }

  function stripConfirmation(source = '') {
    return SOURCE_SUFFIXES.reduce((value, pattern) => value.replace(pattern, ''), source);
  }

  function clearDerivedAuthority(field) {
    DERIVED_KEYS.forEach((key) => { delete field[key]; });
  }

  function resetAuthority(field) {
    const hadAuthority = Boolean(field.confirmed || TRUSTED_STATES.has(field.state));
    field.state = /noch nicht geklärt/i.test(field.body || '') ? 'empty' : 'provisional';
    field.confirmed = false;
    field.source = stripConfirmation(field.source || '');
    clearDerivedAuthority(field);
    return hadAuthority;
  }

  function record(atlas, type, text) {
    atlas.history ||= [];
    atlas.history.push({ id: makeId(), at: now(), type, text });
    atlas.updatedAt = now();
  }

  function sanitizeImportedValue(serialized) {
    const library = JSON.parse(serialized);
    if (!library || !Array.isArray(library.atlases) || !importContext) return serialized;

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
    return JSON.stringify(library);
  }

  Storage.prototype.setItem = function setItemWithTruthGate(key, value) {
    if (this === localStorage && key === LIBRARY_KEY && importContext) {
      clearTimeout(importGuardTimer);
      try {
        value = sanitizeImportedValue(value);
      } catch (error) {
        console.error('Atlas import trust reset failed.', error);
      } finally {
        importContext = null;
      }
    }
    return nativeSetItem.call(this, key, value);
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

  function inferFieldId(button) {
    if (button.dataset.fieldId) return button.dataset.fieldId;
    const library = readLibrary();
    const atlas = currentAtlas(library);
    const buttons = [...document.querySelectorAll('[data-fields] .hex-field')];
    const index = buttons.indexOf(button);
    return index >= 0 ? atlas?.fields?.[index]?.id || null : null;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-fields] .hex-field');
    if (button) selectedFieldId = inferFieldId(button);
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('[data-import-input]')) return;
    const library = readLibrary();
    importContext = { existingIds: new Set((library?.atlases || []).map((atlas) => atlas.id)) };
    clearTimeout(importGuardTimer);
    importGuardTimer = setTimeout(() => { importContext = null; }, 15000);
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-field-form]');
    if (!form || event.submitter?.value !== 'save' || !selectedFieldId) return;

    const beforeLibrary = readLibrary();
    const beforeAtlas = currentAtlas(beforeLibrary);
    const beforeField = beforeAtlas?.fields?.find((field) => field.id === selectedFieldId);
    if (!beforeField || beforeField.id === 'root') return;

    const nextTitle = form.querySelector('[data-field-title]')?.value.trim() || '';
    const nextBody = form.querySelector('[data-field-body]')?.value.trim() || '';
    const nextType = form.querySelector('[data-field-type]')?.value || beforeField.fieldType;
    const semanticChanged = nextTitle !== beforeField.title || nextBody !== beforeField.body || nextType !== beforeField.fieldType;
    if (!semanticChanged) return;

    const wasTrusted = Boolean(beforeField.confirmed || TRUSTED_STATES.has(beforeField.state));
    const fieldId = selectedFieldId;

    setTimeout(() => {
      const library = readLibrary();
      const atlas = currentAtlas(library);
      const field = atlas?.fields?.find((item) => item.id === fieldId);
      if (!field) return;

      const remainedTrusted = Boolean(field.confirmed || TRUSTED_STATES.has(field.state));
      resetAuthority(field);
      record(
        atlas,
        'field_truth_reset',
        wasTrusted || remainedTrusted
          ? `Prüfstatus von „${field.title}“ nach einer inhaltlichen Änderung aufgehoben.`
          : `Abgeleitete Prüfhinweise von „${field.title}“ nach einer inhaltlichen Änderung zurückgesetzt.`
      );
      writeLibrary(library);
      sessionStorage.setItem(REOPEN_KEY, 'true');
      location.reload();
    }, 0);
  }, true);

  function relabelCheckedState() {
    document.querySelectorAll('option[value="confirmed"]').forEach((option) => { option.textContent = 'geprüft'; });
    document.querySelectorAll('.hex-field[data-state="confirmed"]').forEach((field) => { field.dataset.stateLabel = 'geprüft'; });
    const label = document.querySelector('[data-field-dialog-label]');
    if (label?.textContent.includes('bestätigt')) label.textContent = label.textContent.replaceAll('bestätigt', 'geprüft');
  }

  new MutationObserver(relabelCheckedState).observe(document.documentElement, { childList: true, subtree: true });
  relabelCheckedState();
})();
