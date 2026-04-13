/* Toolbar — dropdown menus, hamburger menu, button wiring */

import * as clocks from './clocks.js';
import * as sidebarTz from './sidebar-tz.js';
import * as sidebarScripts from './sidebar-scripts.js';
import * as mce from './mce.js';
import * as timeline from './timeline.js';
import * as saveload from './saveload.js';
import { getOffsetString, timezoneDatabase, getTzByIana } from './timezones.js';

let toastFn = null;
let _setViewFn = null;
export function setToast(fn) { toastFn = fn; }

export function init() {
  // Setup dropdown menus
  setupDropdown('btn-mce');
  setupDropdown('btn-saveload');

  // MCE menu actions
  wireAction('btn-convert-date', () => openMceDateModal());
  wireAction('btn-generate-scripts', () => openScriptPicker());

  // Save/Load actions
  wireAction('btn-save-browser', () => saveload.saveToBrowser(toastFn));
  wireAction('btn-load-browser', () => saveload.loadFromBrowser(toastFn));
  wireAction('btn-export-json', () => saveload.exportJSON());
  wireAction('btn-import-json', () => saveload.importJSON(toastFn));

  wireAction('btn-share-url', () => saveload.shareURL(toastFn));
  wireAction('btn-share-icon', () => saveload.shareURL(toastFn));

  // View mode segmented control
  setupViewToggle();

  // Time format toggle (24h / 12h / Mix)
  setupFormatToggle();

  // Center datetime controls
  setupDatetimeControls();

  // Reset button
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      clocks.resetToLive();
      timeline.clearRange();
      updateDatetimeInputs();
      updateResetVisibility();
      timeline.render();
      hideModal('mce-modal');
    });
  }

  // Sidebar toggles (tz sidebar now driven by navbar search input)
  wireAction('btn-toggle-scripts', () => sidebarScripts.toggle());

  // About modal
  wireAction('btn-about', () => showModal('about-modal'));
  wireAction('btn-close-about', () => hideModal('about-modal'));
  wireAction('about-modal-overlay', () => hideModal('about-modal'));

  // MCE modal close
  wireAction('btn-close-mce-modal', () => hideModal('mce-modal'));
  wireAction('mce-modal-overlay', () => hideModal('mce-modal'));

  // MCE apply button
  const applyBtn = document.getElementById('mce-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', handleMceApply);
  }

  const mceInput = document.getElementById('mce-datetime-input');
  if (mceInput) {
    mceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleMceApply();
    });
  }

  // Script timezone picker modal
  wireAction('btn-close-script-picker', () => hideModal('script-picker-modal'));
  wireAction('script-picker-overlay', () => hideModal('script-picker-modal'));

  // Hamburger menu
  setupHamburger();

  // Mobile: shorter placeholder for search
  if (window.matchMedia('(max-width: 768px)').matches) {
    const searchInput = document.getElementById('tz-navbar-search');
    if (searchInput) searchInput.placeholder = 'Timezones';
  }

  // Initial state
  updateResetVisibility();
  updateDatetimeInputs();
  startDatetimeTick();

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.md-toolbar__dropdown--open').forEach(dd => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('md-toolbar__dropdown--open');
        const trigger = dd.querySelector('[aria-haspopup]');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

export function updateResetVisibility() {
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.classList.toggle('hidden', !clocks.isOverrideActive());
  }
}

function setupFormatToggle() {
  const btns = {
    '24h': document.getElementById('btn-fmt-24h'),
    '12h': document.getElementById('btn-fmt-12h'),
    'mix': document.getElementById('btn-fmt-mix')
  };

  function setFormat(fmt) {
    Object.entries(btns).forEach(([key, b]) => {
      if (b) {
        b.classList.toggle('md-toolbar__view-btn--active', key === fmt);
        b.setAttribute('aria-checked', key === fmt ? 'true' : 'false');
      }
    });
    clocks.setTimeFormat(fmt);
    updateDatetimeInputs();
    timeline.render();
  }

  if (btns['24h']) btns['24h'].addEventListener('click', () => setFormat('24h'));
  if (btns['12h']) btns['12h'].addEventListener('click', () => setFormat('12h'));
  if (btns['mix']) btns['mix'].addEventListener('click', () => setFormat('mix'));

  // Restore saved format
  const saved = clocks.getTimeFormat();
  Object.entries(btns).forEach(([key, b]) => {
    if (b) {
      b.classList.toggle('md-toolbar__view-btn--active', key === saved);
      b.setAttribute('aria-checked', key === saved ? 'true' : 'false');
    }
  });
}

function setupViewToggle() {
  const btns = {
    timeline: document.getElementById('btn-view-timeline'),
    clocks: document.getElementById('btn-view-clocks')
  };

  function setView(mode) {
    // Normalise legacy values: 'analog'/'digital' → 'clocks'
    if (mode === 'analog' || mode === 'digital') mode = 'clocks';

    Object.values(btns).forEach(b => {
      if (b) { b.classList.remove('md-toolbar__view-btn--active'); b.setAttribute('aria-checked', 'false'); }
    });
    if (btns[mode]) { btns[mode].classList.add('md-toolbar__view-btn--active'); btns[mode].setAttribute('aria-checked', 'true'); }

    if (mode === 'timeline') {
      timeline.show();
    } else {
      timeline.hide();
    }

    localStorage.setItem('viewMode', mode);
  }

  if (btns.timeline) btns.timeline.addEventListener('click', () => setView('timeline'));
  if (btns.clocks) btns.clocks.addEventListener('click', () => setView('clocks'));

  // Restore saved view mode
  const savedView = localStorage.getItem('viewMode') || 'timeline';
  setView(savedView);

  // Store for hamburger menu use
  _setViewFn = setView;
}

// Track selected timezone for datetime picker (defaults to local)
let pickerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function getPickerTz() { return pickerTz; }

export function setPickerTz(tz) {
  pickerTz = tz;
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const label = document.getElementById('datetime-tz-label');
  if (label) {
    if (tz === localTz) {
      label.textContent = 'Local';
    } else {
      const tzData = getTzByIana(tz);
      const displayName = tzData ? tzData.label : tz.replace(/_/g, ' ');
      label.textContent = displayName.length > 20 ? displayName.substring(0, 18) + '…' : displayName;
    }
  }
  updateDatetimeInputs();
  timeline.render();
}

function setupDatetimeControls() {
  const dateInput = document.getElementById('toolbar-date-input');
  const timeInput = document.getElementById('toolbar-time-input');
  const tzBtn = document.getElementById('datetime-tz-btn');
  const tzLabel = document.getElementById('datetime-tz-label');
  const tzMenu = document.getElementById('datetime-tz-menu');
  const applyBtn = document.getElementById('btn-apply-datetime');
  if (!dateInput || !timeInput) return;

  const applyOverride = () => {
    const dateVal = dateInput.value;
    const timeVal = timeInput.value;
    if (!dateVal || !timeVal) return;

    const [y, mo, d] = dateVal.split('-').map(Number);
    let h, m;

    // Parse time — supports both "HH:MM" (24h) and "h:mm AM/PM" (12h)
    const ampmMatch = timeVal.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      h = parseInt(ampmMatch[1], 10);
      m = parseInt(ampmMatch[2], 10);
      const isPM = ampmMatch[3].toUpperCase() === 'PM';
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
    } else {
      [h, m] = timeVal.split(':').map(Number);
    }

    if (isNaN(y) || isNaN(mo) || isNaN(d) || isNaN(h) || isNaN(m)) return;

    clocks.activateProbe(pickerTz, h, m, y, mo - 1, d);
    updateResetVisibility();
    if (applyBtn) applyBtn.classList.add('hidden');
    timeline.render();
  };

  // Show Apply button on input change instead of auto-applying
  const showApply = () => {
    if (applyBtn) applyBtn.classList.remove('hidden');
  };

  dateInput.addEventListener('change', showApply);
  timeInput.addEventListener('change', showApply);

  if (applyBtn) {
    applyBtn.addEventListener('click', applyOverride);
  }

  // Timezone selector for picker
  if (tzBtn && tzMenu) {
    tzBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      populateTzMenu();
      tzMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!tzMenu.contains(e.target) && e.target !== tzBtn) {
        tzMenu.classList.add('hidden');
      }
    });
  }
}

function populateTzMenu() {
  const tzMenu = document.getElementById('datetime-tz-menu');
  if (!tzMenu) return;
  tzMenu.replaceChildren();

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clockList = clocks.getClocks();

  clockList.forEach(clockData => {
    const tz = clockData.timezone;
    const tzData = getTzByIana(tz);
    const displayName = tzData ? tzData.label : tz.replace(/_/g, ' ');
    const offsetStr = getOffsetString(tz);

    const btn = document.createElement('button');
    btn.className = 'md-datetime-picker__tz-option';
    if (tz === pickerTz) btn.classList.add('md-datetime-picker__tz-option--active');
    btn.textContent = `${displayName} (${offsetStr})`;
    btn.addEventListener('click', () => {
      tzMenu.classList.add('hidden');
      setPickerTz(tz);
    });
    tzMenu.appendChild(btn);
  });
}

export function updateDatetimeInputs() {
  const dateInput = document.getElementById('toolbar-date-input');
  const timeInput = document.getElementById('toolbar-time-input');
  if (!dateInput || !timeInput) return;

  const ref = clocks.getOverrideTime() || new Date();
  const tz = pickerTz;
  const use24h = clocks.getUse24hForTz(tz);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(ref);
  const getPart = (type) => parts.find(p => p.type === type)?.value;

  const y = getPart('year');
  const mo = getPart('month').padStart(2, '0');
  const d = getPart('day').padStart(2, '0');
  const h24 = parseInt(getPart('hour'), 10);
  const m = getPart('minute').padStart(2, '0');

  dateInput.value = `${y}-${mo}-${d}`;

  if (use24h) {
    timeInput.type = 'time';
    timeInput.value = `${h24.toString().padStart(2, '0')}:${m}`;
  } else {
    timeInput.type = 'text';
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    timeInput.value = `${h12}:${m} ${ampm}`;
  }
}

let _datetimeTickId = null;

function startDatetimeTick() {
  if (_datetimeTickId !== null) clearInterval(_datetimeTickId);
  _datetimeTickId = setInterval(() => {
    if (!clocks.isOverrideActive()) {
      updateDatetimeInputs();
    }
  }, 10000);
}

function setupDropdown(triggerId) {
  const trigger = document.getElementById(triggerId);
  if (!trigger) return;
  const dropdown = trigger.closest('.md-toolbar__dropdown');
  if (!dropdown) return;

  const updateExpanded = () => {
    const isOpen = dropdown.classList.contains('md-toolbar__dropdown--open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.md-toolbar__dropdown--open').forEach(dd => {
      if (dd !== dropdown) {
        dd.classList.remove('md-toolbar__dropdown--open');
        // Update aria-expanded on the other trigger
        const otherTrigger = dd.querySelector('[aria-haspopup]');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      }
    });
    dropdown.classList.toggle('md-toolbar__dropdown--open');
    updateExpanded();
  });

  // Keyboard navigation within menu
  const menuItems = dropdown.querySelectorAll('.md-toolbar__menu-item');
  menuItems.forEach((item, idx) => {
    item.addEventListener('click', () => {
      dropdown.classList.remove('md-toolbar__dropdown--open');
      updateExpanded();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = menuItems[idx + 1] || menuItems[0];
        next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = menuItems[idx - 1] || menuItems[menuItems.length - 1];
        prev.focus();
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('md-toolbar__dropdown--open');
        updateExpanded();
        trigger.focus();
      }
    });
  });
}

function wireAction(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

/**
 * Show a modal dialog with proper focus management (WCAG 2.4.3).
 * Saves the previously focused element and restores it on close.
 * Traps Tab focus within the modal while open.
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return null;

  const previousFocus = document.activeElement;
  modal.classList.remove('md-modal--hidden');

  // Focus first focusable element inside the modal
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    // Skip overlay, focus the first interactive element in the dialog
    const dialogFocusable = Array.from(focusable).filter(el => !el.classList.contains('md-modal__overlay'));
    if (dialogFocusable.length > 0) dialogFocusable[0].focus();
  }

  // Focus trap
  const trapFocus = (e) => {
    if (e.key !== 'Tab' || modal.classList.contains('md-modal--hidden')) return;
    const focusableEls = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.classList.contains('md-modal__overlay') && el.offsetParent !== null);
    if (focusableEls.length === 0) return;
    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Escape key closes modal
  const escClose = (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('md-modal--hidden')) {
      hideModal(modalId, previousFocus, trapFocus, escClose);
    }
  };

  document.addEventListener('keydown', trapFocus);
  document.addEventListener('keydown', escClose);

  // Store cleanup refs on the modal element
  modal._focusCleanup = { previousFocus, trapFocus, escClose };

  return modal;
}

function hideModal(modalId, previousFocus, trapFocus, escClose) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('md-modal--hidden');

  // Use stored cleanup if no args provided
  const cleanup = modal._focusCleanup || {};
  const pf = previousFocus || cleanup.previousFocus;
  const tf = trapFocus || cleanup.trapFocus;
  const ec = escClose || cleanup.escClose;

  if (tf) document.removeEventListener('keydown', tf);
  if (ec) document.removeEventListener('keydown', ec);
  if (pf && typeof pf.focus === 'function') pf.focus();

  delete modal._focusCleanup;
}

function openMceDateModal() {
  // Switch to Clocks view so converted time is visible on clock faces
  if (_setViewFn) _setViewFn('clocks');

  showModal('mce-modal');
  const input = document.getElementById('mce-datetime-input');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
  const feedback = document.getElementById('mce-feedback');
  if (feedback) feedback.textContent = '';
}

function handleMceApply() {
  const input = document.getElementById('mce-datetime-input');
  const feedback = document.getElementById('mce-feedback');
  if (!input) return;

  const result = mce.applyMceDate(input.value.trim());
  if (feedback) {
    feedback.textContent = result.message;
    feedback.style.color = result.success ? 'var(--brand-blue)' : 'var(--brand-red)';
  }

  if (result.success) {
    updateResetVisibility();
    // Close modal after short delay
    setTimeout(() => hideModal('mce-modal'), 800);
  }
}

function openScriptPicker() {
  const list = document.getElementById('script-tz-list');
  if (!list) return;

  list.replaceChildren();

  clocks.getClocks().forEach(clockData => {
    if (clockData.timezone === 'Etc/GMT+6') return; // Skip Salesforce clock

    const offsetStr = getOffsetString(clockData.timezone);
    const tzData = getTzByIana(clockData.timezone);
    const displayName = tzData ? tzData.label : clockData.timezone.replace(/_/g, ' ');
    const li = document.createElement('li');
    li.className = 'md-script-tz-option';
    li.textContent = `${displayName} (${offsetStr})`;
    li.dataset.timezone = clockData.timezone;
    li.dataset.isLocal = clockData.isLocal ? 'true' : 'false';
    li.tabIndex = 0;

    const selectAction = () => {
      hideModal('script-picker-modal');
      sidebarScripts.showForTimezone(clockData.timezone, clockData.isLocal);
    };

    li.addEventListener('click', selectAction);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAction(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); li.previousElementSibling?.focus(); }
      if (e.key === 'Escape') hideModal('script-picker-modal');
    });

    list.appendChild(li);
  });

  showModal('script-picker-modal');
  setTimeout(() => list.firstElementChild?.focus(), 50);
}

function setupHamburger() {
  const wrap = document.querySelector('.md-toolbar__hamburger-wrap');
  const btn = document.getElementById('btn-hamburger');
  if (!btn || !wrap) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.classList.toggle('md-toolbar__hamburger-wrap--open');
    btn.setAttribute('aria-expanded', wrap.classList.contains('md-toolbar__hamburger-wrap--open'));
  });

  // Hamburger menu item actions + keyboard navigation (WCAG 2.1.1)
  const menuItems = Array.from(wrap.querySelectorAll('.md-toolbar__menu-item[data-action]'));

  const closeMenu = () => {
    wrap.classList.remove('md-toolbar__hamburger-wrap--open');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  };

  const handleAction = (action) => {
    closeMenu();
    switch (action) {
      case 'convert-date': openMceDateModal(); break;
      case 'generate-scripts': openScriptPicker(); break;
      case 'save-browser': saveload.saveToBrowser(toastFn); break;
      case 'load-browser': saveload.loadFromBrowser(toastFn); break;
      case 'share-url': saveload.shareURL(toastFn); break;
      case 'fmt-24h': clocks.setTimeFormat('24h'); updateDatetimeInputs(); timeline.render(); break;
      case 'fmt-12h': clocks.setTimeFormat('12h'); updateDatetimeInputs(); timeline.render(); break;
      case 'fmt-mix': clocks.setTimeFormat('mix'); updateDatetimeInputs(); timeline.render(); break;
      case 'toggle-tz': sidebarTz.toggle(); document.getElementById('tz-navbar-search')?.focus(); break;
      case 'toggle-scripts': sidebarScripts.toggle(); break;
      case 'theme': document.getElementById('btn-theme')?.click(); break;
      case 'about': document.getElementById('btn-about')?.click(); break;
      case 'reset': document.getElementById('btn-reset')?.click(); break;
    }
  };

  menuItems.forEach((item, idx) => {
    item.addEventListener('click', () => handleAction(item.dataset.action));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = menuItems[idx + 1] || menuItems[0];
        next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = menuItems[idx - 1] || menuItems[menuItems.length - 1];
        prev.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      } else if (e.key === 'Home') {
        e.preventDefault();
        menuItems[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        menuItems[menuItems.length - 1].focus();
      }
    });
  });

  // Close hamburger on outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('md-toolbar__hamburger-wrap--open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}
