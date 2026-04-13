/* Save/Load — Browser slots, JSON export/import, URL sharing */
/* Modals follow Diagramforce UX patterns */

import * as clocks from './clocks.js';
import { loadCustomNames, saveCustomName, loadBlockers, saveBlockers } from './persistence.js';

const SAVE_SLOTS_KEY = 'clockforceSaves';

function getState() {
  return {
    clocks: clocks.getClocks(),
    timeFormat: clocks.getTimeFormat(),
    customNames: loadCustomNames(),
    viewMode: localStorage.getItem('viewMode') || 'timeline',
    blockers: loadBlockers()
  };
}

function applyState(state) {
  if (!state || !state.clocks) return false;

  localStorage.setItem('clocks', JSON.stringify(state.clocks));
  if (state.timeFormat) localStorage.setItem('timeFormat', state.timeFormat);
  if (state.viewMode) localStorage.setItem('viewMode', state.viewMode);

  if (state.customNames) {
    localStorage.setItem('customTzNames', JSON.stringify(state.customNames));
  }

  if (state.blockers) {
    saveBlockers(state.blockers);
  }

  location.reload();
  return true;
}

// --- Browser save slots ---

function getSaveSlots() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || {};
  } catch { return {}; }
}

function setSaveSlots(slots) {
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
}

// --- Save to Browser (dynamic modal) ---

export function saveToBrowser(toast) {
  // Remove existing save modal if any
  document.querySelector('.md-save-modal')?.remove();

  const defaultName = `Clockforce ${new Date().toLocaleDateString()}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'md-save-modal md-modal';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');

  wrapper.innerHTML = `
    <div class="md-modal__overlay"></div>
    <div class="md-modal__dialog" style="width:440px">
      <div class="md-modal__header">
        <h2 class="md-modal__title">Save to Browser</h2>
        <button class="md-toolbar__button md-save-modal__close" aria-label="Close">
          <svg class="md-toolbar__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        </button>
      </div>
      <div class="md-modal__body" style="padding: var(--spacing-md) var(--spacing-lg)">
        <p style="margin:0 0 var(--spacing-sm);color:var(--text-secondary);font-size:var(--font-size-sm)">
          Enter a name for this configuration:
        </p>
        <input type="text" class="md-save-modal__name md-modal__row-name" value="${escHtml(defaultName)}" spellcheck="false" style="width:100%;padding:8px 10px">
      </div>
      <div class="md-modal__footer">
        <button class="md-modal__btn md-modal__btn--secondary md-save-modal__close-btn">Cancel</button>
        <button class="md-modal__btn md-modal__btn--primary md-save-modal__save-btn">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  const nameInput = wrapper.querySelector('.md-save-modal__name');
  const ac = new AbortController();
  const close = () => { wrapper.remove(); ac.abort(); };

  // Close handlers
  wrapper.querySelector('.md-modal__overlay').addEventListener('click', close, { signal: ac.signal });
  wrapper.querySelector('.md-save-modal__close').addEventListener('click', close, { signal: ac.signal });
  wrapper.querySelector('.md-save-modal__close-btn').addEventListener('click', close, { signal: ac.signal });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: ac.signal });

  // Save handler
  const doSave = () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }

    const slots = getSaveSlots();
    slots[name] = { state: getState(), savedAt: new Date().toISOString() };
    setSaveSlots(slots);
    close();
    if (toast) toast(`Saved "${name}"`);
  };

  wrapper.querySelector('.md-save-modal__save-btn').addEventListener('click', doSave);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSave();
  });

  // Focus and select input
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 50);
}

// --- Load from Browser (pre-defined modal in HTML) ---

export function loadFromBrowser(toast) {
  const slots = getSaveSlots();
  const names = Object.keys(slots);

  const modal = document.getElementById('load-modal');
  const bodyEl = document.getElementById('load-modal-list');
  if (!modal || !bodyEl) return;

  bodyEl.innerHTML = '';

  // Remove previous footer if any
  modal.querySelector('.md-modal__footer--load')?.remove();

  if (names.length === 0) {
    bodyEl.innerHTML = '<p class="md-modal__empty">No saved configurations found.</p>';
  } else {
    names.forEach(name => {
      const save = slots[name];
      const date = new Date(save.savedAt);
      const clockCount = save.state?.clocks?.length || 0;

      const row = document.createElement('div');
      row.className = 'md-modal__row';

      row.innerHTML = `
        <span class="md-modal__row-info">
          <span class="md-modal__row-label">${escHtml(name)}</span>
          <span class="md-modal__row-meta">${date.toLocaleString()} · ${clockCount} timezone${clockCount !== 1 ? 's' : ''}</span>
        </span>
        <span class="md-modal__row-actions">
          <button class="md-modal__btn md-modal__btn--primary md-load-btn" style="font-size:var(--font-size-xs);padding:4px 10px">Load</button>
          <button class="md-modal__btn--icon md-delete-btn" title="Delete save" aria-label="Delete save">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </button>
        </span>
      `;

      // Load button
      row.querySelector('.md-load-btn').addEventListener('click', () => {
        applyState(save.state);
      });

      // Delete button
      row.querySelector('.md-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        delete slots[name];
        setSaveSlots(slots);
        row.remove();
        // Check if empty
        if (Object.keys(slots).length === 0) {
          bodyEl.innerHTML = '<p class="md-modal__empty">No saved configurations found.</p>';
        }
        if (toast) toast(`Deleted "${name}"`);
      });

      bodyEl.appendChild(row);
    });
  }

  // Show modal
  modal.classList.remove('md-modal--hidden');

  // Close handlers — use AbortController for clean listener removal
  if (modal._closeAC) modal._closeAC.abort();
  const ac = new AbortController();
  modal._closeAC = ac;

  const closeModal = () => {
    modal.classList.add('md-modal--hidden');
    ac.abort();
  };

  const closeBtn = document.getElementById('btn-close-load-modal');
  const overlay = document.getElementById('load-modal-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closeModal, { signal: ac.signal });
  if (overlay) overlay.addEventListener('click', closeModal, { signal: ac.signal });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  }, { signal: ac.signal });
}

// --- JSON export/import ---

export function exportJSON() {
  const state = getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clockforce-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(toast) {
  const input = document.getElementById('json-import-input');
  if (!input) return;

  // Use one-shot handler to avoid stale closures
  input.onchange = (e) => {
    input.onchange = null;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const state = JSON.parse(ev.target.result);
        if (!state || !Array.isArray(state.clocks) || state.clocks.length === 0) {
          if (toast) toast('Invalid Clockforce file');
          return;
        }
        // Validate each clock entry has a timezone string
        if (!state.clocks.every(c => c && typeof c.timezone === 'string')) {
          if (toast) toast('Invalid clock data in file');
          return;
        }
        applyState(state);
      } catch {
        if (toast) toast('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    input.value = '';
  };
  input.click();
}

// --- Share as URL (dynamic modal with copyable link) ---

export function shareURL(toast) {
  const state = getState();
  const compact = {
    c: state.clocks.map(c => ({ t: c.timezone, l: c.isLocal || false })),
    f: state.timeFormat,
    v: state.viewMode,
    n: state.customNames,
    b: state.blockers.length > 0 ? state.blockers : undefined
  };

  const encoded = btoa(JSON.stringify(compact));
  const url = `${location.origin}${location.pathname}?cfg=${encodeURIComponent(encoded)}`;

  showShareModal(url);
}

function showShareModal(url) {
  document.querySelector('.md-share-modal')?.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'md-share-modal md-modal';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');

  wrapper.innerHTML = `
    <div class="md-modal__overlay"></div>
    <div class="md-modal__dialog" style="width:520px">
      <div class="md-modal__header">
        <h2 class="md-modal__title">Share Configuration</h2>
        <button class="md-toolbar__button md-share-modal__close-x" aria-label="Close">
          <svg class="md-toolbar__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        </button>
      </div>
      <div class="md-modal__body" style="padding:var(--spacing-md) var(--spacing-lg)">
        <p style="margin:0 0 var(--spacing-sm);color:var(--text-secondary);font-size:var(--font-size-sm);line-height:1.5">
          Anyone with this link can open a copy of your clock configuration:
        </p>
        <input type="text" class="md-share-modal__url" readonly spellcheck="false">
      </div>
      <div class="md-modal__footer">
        <button class="md-modal__btn md-modal__btn--secondary md-share-modal__close-btn">Close</button>
        <button class="md-modal__btn md-modal__btn--primary md-share-modal__copy-btn">Copy Link</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  const urlInput = wrapper.querySelector('.md-share-modal__url');
  urlInput.value = url;

  const ac = new AbortController();
  const close = () => { wrapper.remove(); ac.abort(); };
  const copyBtn = wrapper.querySelector('.md-share-modal__copy-btn');

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(url).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.style.borderColor = '#43A047';
      copyBtn.style.background = '#43A047';
      copyBtn.style.color = '#fff';
      setTimeout(close, 600);
    }).catch(() => {
      urlInput.select();
    });
  }, { signal: ac.signal });

  wrapper.querySelector('.md-share-modal__close-btn').addEventListener('click', close, { signal: ac.signal });
  wrapper.querySelector('.md-share-modal__close-x').addEventListener('click', close, { signal: ac.signal });
  wrapper.querySelector('.md-modal__overlay').addEventListener('click', close, { signal: ac.signal });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: ac.signal });

  // Select the URL text for easy manual copy
  setTimeout(() => urlInput.select(), 50);
}

// --- Load from URL on init ---

export function loadFromURL() {
  const params = new URLSearchParams(location.search);
  const cfg = params.get('cfg');
  if (!cfg) return false;

  try {
    const compact = JSON.parse(atob(decodeURIComponent(cfg)));

    // Validate structure
    if (!compact || !Array.isArray(compact.c) || compact.c.length === 0) return false;

    const validFormats = ['24h', '12h', 'mix'];
    const validViews = ['analog', 'digital', 'timeline', 'clocks'];

    const state = {
      clocks: compact.c
        .filter(c => c && typeof c.t === 'string' && c.t.length > 0 && c.t.length < 100)
        .map(c => ({ timezone: c.t, isLocal: !!c.l })),
      timeFormat: validFormats.includes(compact.f) ? compact.f : '24h',
      viewMode: validViews.includes(compact.v) ? compact.v : 'timeline',
      customNames: (compact.n && typeof compact.n === 'object' && !Array.isArray(compact.n)) ? compact.n : {},
      blockers: Array.isArray(compact.b) ? compact.b.filter(b =>
        b && typeof b.name === 'string' && typeof b.startFraction === 'number' && typeof b.endFraction === 'number'
      ) : []
    };

    if (state.clocks.length === 0) return false;

    localStorage.setItem('clocks', JSON.stringify(state.clocks));
    localStorage.setItem('timeFormat', state.timeFormat);
    localStorage.setItem('viewMode', state.viewMode);
    localStorage.setItem('customTzNames', JSON.stringify(state.customNames));
    if (state.blockers.length > 0) saveBlockers(state.blockers);

    history.replaceState(null, '', location.pathname);
    return true;
  } catch {
    return false;
  }
}

// --- Utility ---

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
