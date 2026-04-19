/* Right sidebar — Timezone picker with navbar search */

import { getProcessedTimezones, findMatchingAlias, findMatchingAbbr } from './timezones.js';
import * as clocks from './clocks.js';
import { getCustomName, saveCustomName } from './persistence.js';
import { setupDragHandle } from './drag-handle.js';

// SVG icons
const ICON_ADD = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10.5,9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_REMOVE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"/></svg>';

let onRenameCallback = null;

export function setOnRename(cb) { onRenameCallback = cb; }

let processedTimezones = [];

export function init() {
  processedTimezones = getProcessedTimezones();

  // Navbar search input drives sidebar filtering
  const searchInput = document.getElementById('tz-navbar-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      // Open sidebar when user starts typing
      if (e.target.value.length > 0 && !isVisible()) show();
      renderTimezoneList(e.target.value);
    });
    searchInput.addEventListener('focus', () => {
      if (!isVisible()) show();
    });
  }

  // Close button
  const closeBtn = document.getElementById('btn-close-tz');
  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  renderTimezoneList();

  // Mobile drag handle for resizing sidebar height
  setupDragHandle('tz-panel', 80, 0.7);
}

export function show() {
  const panel = document.getElementById('tz-panel');
  if (!panel) return;
  panel.classList.remove('md-timezones--hidden');
  refresh();
}

export function hide() {
  const panel = document.getElementById('tz-panel');
  if (!panel) return;
  panel.classList.add('md-timezones--hidden');
}

export function refresh() {
  const searchInput = document.getElementById('tz-navbar-search');
  renderTimezoneList(searchInput ? searchInput.value : '');
}

function renderTimezoneList(filter = '') {
  const listEl = document.getElementById('tz-list');
  const countEl = document.getElementById('tz-count');
  if (!listEl) return;

  listEl.replaceChildren();
  const lowerFilter = filter.toLowerCase();
  const usedTimezones = clocks.getClocks().map(c => c.timezone);
  let visibleCount = 0;

  // If query looks like a timezone abbreviation (2-5 letters), prefer exact-abbreviation matches
  const abbrQuery = /^[a-zA-Z]{2,5}$/.test(filter) ? `^${lowerFilter}^` : null;
  const hasAbbrMatches = abbrQuery && processedTimezones.some(d => d.searchStr.includes(abbrQuery));

  processedTimezones.forEach(data => {
    if (lowerFilter) {
      if (hasAbbrMatches) {
        // When a query matches actual abbreviations, restrict results to those only
        if (!data.searchStr.includes(abbrQuery)) return;
      } else if (!data.searchStr.includes(lowerFilter)) {
        return;
      }
    }

    const isUsed = usedTimezones.includes(data.id);
    const clockIndex = isUsed ? clocks.getClocks().findIndex(c => c.timezone === data.id) : -1;
    const isProtected = isUsed && (clocks.getClocks()[clockIndex]?.isLocal || data.id === 'Etc/GMT+6');
    const li = document.createElement('li');
    li.className = 'md-tz-item' + (isUsed ? ' md-tz-item--added' : '') + (isProtected ? ' md-tz-item--protected' : '');
    li.tabIndex = (isUsed && isProtected) ? -1 : 0;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', isUsed ? 'true' : 'false');
    li.setAttribute('aria-label', `${data.city} ${data.offsetLabel}${isUsed ? ' (added)' : ''}`);

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'md-tz-item__icon';
    if (isUsed && !isProtected) {
      iconSpan.classList.add('md-tz-item__icon--remove');
      iconSpan.innerHTML = ICON_REMOVE;
    } else if (isUsed) {
      iconSpan.classList.add('md-tz-item__icon--added');
      iconSpan.innerHTML = ICON_CLOCK;
    } else {
      iconSpan.classList.add('md-tz-item__icon--add');
      iconSpan.innerHTML = ICON_ADD;
    }
    li.appendChild(iconSpan);

    // Label container
    const labelWrap = document.createElement('span');
    labelWrap.className = 'md-tz-item__label-wrap';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'md-tz-item__label';
    labelSpan.textContent = data.city;
    labelWrap.appendChild(labelSpan);

    // Check for alias or abbreviation match — show "Shared by {searchTerm}" note
    if (lowerFilter && !data.city.toLowerCase().includes(lowerFilter)) {
      const matchedAlias = findMatchingAlias(data.aliases, filter);
      const matchedAbbr = matchedAlias ? null : findMatchingAbbr(data.id, filter);
      const match = matchedAlias || matchedAbbr;
      if (match) {
        const aliasNote = document.createElement('span');
        aliasNote.className = 'md-tz-item__alias';
        aliasNote.textContent = `Shared by ${match}`;
        labelWrap.appendChild(aliasNote);
      }
    }

    li.appendChild(labelWrap);

    // Show custom name for any timezone that has one
    const customName = getCustomName(data.id);
    if (customName) {
      const aliasNote = document.createElement('span');
      aliasNote.className = 'md-tz-item__alias';
      aliasNote.textContent = `"${customName}"`;
      labelWrap.appendChild(aliasNote);
    }

    // Edit/rename icon for all timezones (except protected)
    if (!isProtected) {
      const editIcon = document.createElement('span');
      editIcon.className = 'md-tz-item__icon md-tz-item__icon--edit';
      editIcon.innerHTML = ICON_EDIT;
      editIcon.title = 'Rename timezone';
      editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(li, data.id, data.city);
      });
      li.appendChild(editIcon);
    }

    const offsetSpan = document.createElement('span');
    offsetSpan.className = 'md-tz-item__offset';
    offsetSpan.textContent = data.offsetLabel;
    li.appendChild(offsetSpan);

    if (!isUsed) {
      const selectAction = () => {
        if (li._renaming) return;
        clocks.addClock(data.id);
        refresh();
      };
      li.addEventListener('click', selectAction);
      li.addEventListener('keydown', (e) => {
        if (li._renaming) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAction(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); li.previousElementSibling?.focus(); }
      });
    } else if (!isProtected) {
      const removeAction = () => {
        if (li._renaming) return;
        // Look up fresh index to avoid stale reference
        const currentIdx = clocks.getClocks().findIndex(c => c.timezone === data.id);
        if (currentIdx < 0) return;
        clocks.removeClock(currentIdx);
        refresh();
      };
      li.addEventListener('click', removeAction);
      li.addEventListener('keydown', (e) => {
        if (li._renaming) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeAction(); }
      });
    }

    listEl.appendChild(li);
    visibleCount++;
  });

  if (countEl) countEl.textContent = visibleCount;
}

export function toggle() {
  if (isVisible()) hide();
  else show();
}

export function isVisible() {
  const panel = document.getElementById('tz-panel');
  return panel && !panel.classList.contains('md-timezones--hidden');
}

function startRename(li, tzId, defaultName) {
  // Prevent the li's add/remove click handler while renaming
  li._renaming = true;

  const labelWrap = li.querySelector('.md-tz-item__label-wrap');
  if (!labelWrap) return;

  const currentCustom = getCustomName(tzId) || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'md-tz-item__rename-input';
  input.value = currentCustom;
  input.placeholder = defaultName;
  input.setAttribute('aria-label', `Rename ${defaultName}`);

  // Stop all clicks on input from bubbling to li (prevents add/remove)
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('mousedown', (e) => e.stopPropagation());

  // Replace label content with input
  labelWrap.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    const val = input.value.trim();
    saveCustomName(tzId, val || null);
    li._renaming = false;
    refresh();
    if (onRenameCallback) onRenameCallback();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
}
