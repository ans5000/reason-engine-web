(() => {
  'use strict';

  const workspace = document.querySelector('[data-screen="workspace"]');
  const stage = document.querySelector('[data-stage]');
  const fields = document.querySelector('[data-fields]');
  if (!workspace || !stage || !fields) return;

  let scheduledFrame = 0;
  let retryTimer = 0;

  function centerMapImmediately() {
    if (workspace.hidden) return false;
    const root = fields.querySelector('.hex-field.root');
    if (!root || !stage.clientWidth || !stage.clientHeight) return false;

    const stageRect = stage.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const rootCenterX = rootRect.left + rootRect.width / 2;
    const rootCenterY = rootRect.top + rootRect.height / 2;
    const stageCenterX = stageRect.left + stageRect.width / 2;
    const stageCenterY = stageRect.top + stageRect.height / 2;

    stage.scrollLeft = Math.max(0, stage.scrollLeft + rootCenterX - stageCenterX);
    stage.scrollTop = Math.max(0, stage.scrollTop + rootCenterY - stageCenterY);
    document.documentElement.dataset.atlasViewportCentered = 'true';
    return true;
  }

  function scheduleCenter() {
    cancelAnimationFrame(scheduledFrame);
    clearTimeout(retryTimer);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = requestAnimationFrame(() => {
        centerMapImmediately();
        retryTimer = window.setTimeout(centerMapImmediately, 120);
      });
    });
  }

  new MutationObserver(() => {
    if (!workspace.hidden) scheduleCenter();
  }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });

  new MutationObserver(() => {
    if (!workspace.hidden && fields.querySelector('.hex-field.root')) scheduleCenter();
  }).observe(fields, { childList: true });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-center-map], [data-tab="atlas"], .atlas-card-open')) scheduleCenter();
  });

  document.querySelector('[data-problem-form]')?.addEventListener('submit', scheduleCenter);
  window.addEventListener('pageshow', scheduleCenter);
  window.addEventListener('resize', scheduleCenter);

  document.documentElement.dataset.atlasViewportCenter = 'loaded';
  scheduleCenter();
})();
