/* App entry point — module orchestration */

import * as theme from './theme.js';
import * as clocks from './clocks.js';
import * as mce from './mce.js';
import * as toolbar from './toolbar.js';
import * as sidebarTz from './sidebar-tz.js';
import * as sidebarScripts from './sidebar-scripts.js';
import * as timeline from './timeline.js';
import * as saveload from './saveload.js';

// Toast notification
let toastTimeout;
function showToast(msg) {
  const el = document.getElementById('notification-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add('hidden'), 3000);
}

// Load shared state from URL if present (before module init)
saveload.loadFromURL();

// Initialize modules in order
theme.init();

clocks.init({
  onClocksChange: () => {
    sidebarTz.refresh();
    toolbar.updateResetVisibility();
    timeline.render();
  },
  toast: showToast,
  onClockClick: (tz) => toolbar.setPickerTz(tz)
});

mce.init({
  showScripts: (iana, isLocal) => sidebarScripts.showForTimezone(iana, isLocal)
});

sidebarTz.init();
sidebarTz.setOnRename(() => {
  clocks.rerender();
  timeline.render();
});
sidebarScripts.init();
toolbar.setToast(showToast);
toolbar.init();
