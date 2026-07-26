(() => {
  'use strict';

  const workspace = document.querySelector('[data-screen="workspace"]');
  const stage = document.querySelector('[data-stage]');
  const mapBoard = document.querySelector('[data-map-board]');
  if (!workspace || !stage || !mapBoard) return;

  let scheduledFrame = 0;

  function centerMapImmediately() {
    if (workspace.hidden) return;
    const root = mapBoard.querySelector('.hex-field.root');
    if (!root || !stage.clientWidth || !stage.clientHeight || !mapBoard.offsetWidth || !mapBoard.offsetHeight) return;

    const boardRect = mapBoard.getBoundingClientRect();
    const scaleX = boardRect.width / mapBoard.offsetWidth;
    const scaleY = boardRect.height / mapBoard.offsetHeight;
    const left = root.offsetLeft * scaleX - stage.clientWidth / 2;
    const top = root.offsetTop * scaleY - stage.clientHeight / 2;

    stage.scrollTo({
      left: Math.max(0, left),
      top: Math.max(0, top),
      behavior: 'auto'
    });
  }

  function scheduleCenter() {
    cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = requestAnimationFrame(centerMapImmediately);
    });
  }

  new MutationObserver(() => {
    if (!workspace.hidden) scheduleCenter();
  }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-center-map], [data-tab="atlas"], .atlas-card-open')) scheduleCenter();
  });

  document.querySelector('[data-problem-form]')?.addEventListener('submit', scheduleCenter);
  window.addEventListener('pageshow', scheduleCenter);
  window.addEventListener('resize', scheduleCenter);

  scheduleCenter();
})();
