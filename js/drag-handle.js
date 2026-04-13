/* Shared drag-handle utility for mobile panel resizing (touch + mouse) */

/**
 * Attaches drag-to-resize behaviour to a panel's `.md-drag-handle` element.
 * @param {string} panelId  – DOM id of the panel element
 * @param {number} [minH=80]  – minimum allowed height in px
 * @param {number} [maxFactor=0.8] – maximum height as fraction of viewport
 */
export function setupDragHandle(panelId, minH = 80, maxFactor = 0.8) {
  const panel = document.getElementById(panelId);
  const handle = panel?.querySelector('.md-drag-handle');
  if (!handle || !panel) return;

  let startY = 0;
  let startHeight = 0;

  const onStart = (clientY) => {
    startY = clientY;
    startHeight = panel.offsetHeight;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  };

  const onMove = (clientY) => {
    const delta = startY - clientY;
    const maxH = window.innerHeight * maxFactor;
    const newHeight = Math.max(minH, Math.min(maxH, startHeight + delta));
    panel.style.height = `${newHeight}px`;
  };

  const onEnd = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  // Mouse
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientY);
    const move = (me) => onMove(me.clientY);
    const up = () => { onEnd(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // Touch
  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onStart(e.touches[0].clientY);
    const move = (te) => onMove(te.touches[0].clientY);
    const end = () => { onEnd(); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }, { passive: false });
}
