/* App entry point — module orchestration */

import * as theme from './theme.js?v=2.3.0';
import * as clocks from './clocks.js?v=2.3.0';
import * as mce from './mce.js?v=2.3.0';
import * as toolbar from './toolbar.js?v=2.3.0';
import * as sidebarTz from './sidebar-tz.js?v=2.3.0';
import * as sidebarScripts from './sidebar-scripts.js?v=2.3.0';
import * as timeline from './timeline.js?v=2.3.0';
import * as saveload from './saveload.js?v=2.3.0';

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
