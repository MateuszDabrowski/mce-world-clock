/* Timeline display — horizontal timezone comparison with draggable time indicator */

import * as clocks from './clocks.js';
import { updateDatetimeInputs, updateResetVisibility, getPickerTz, setPickerTz } from './toolbar.js';
import { timezoneDatabase, getTzByIana, getOffsetMinutes, getOffsetString, getTimezoneShortCode } from './timezones.js';
import { getCustomName, saveCustomName, loadBlockers, saveBlockers, addBlocker, removeBlocker } from './persistence.js';

const TOTAL_HOURS = 168; // 7 days

let visible = false;
let dragState = null;
let animId = null;
let savedRange = null; // { startFraction, endFraction } — persists across re-renders
let cleanupDragListeners = null; // cleanup function for document-level drag listeners
let savedScrollLeft = null; // preserve scroll position across re-renders

const BLOCKER_POS_KEY = 'clockforceBlockerPosition';

function getBlockerRowPosition() {
  const v = localStorage.getItem(BLOCKER_POS_KEY);
  return v !== null ? parseInt(v, 10) : Infinity; // default: after all timezone rows
}

function saveBlockerRowPosition(pos) {
  localStorage.setItem(BLOCKER_POS_KEY, String(pos));
}

function setupBlockerRowDrag(handle, fixedPanel, wrapper, tzCount) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const blockerFixed = fixedPanel.querySelector('.md-tl__fixed-row--blocker');
    const blockerScroll = wrapper.querySelector('.md-tl__row--blocker');
    if (!blockerFixed || !blockerScroll) return;

    // Collect all row positions (excluding blocker)
    const fixedRows = [...fixedPanel.querySelectorAll('.md-tl__fixed-row:not(.md-tl__fixed-row--blocker)')];
    const scrollRows = [...wrapper.querySelectorAll('.md-tl__row:not(.md-tl__row--blocker)')];

    // Get row midpoints for determining drop position
    const rowMids = fixedRows.map(r => {
      const rect = r.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });

    // Create drop indicator line
    const dropLine = document.createElement('div');
    dropLine.className = 'md-tl__drop-indicator';
    fixedPanel.parentElement.appendChild(dropLine);

    let dropIdx = -1;
    blockerFixed.style.opacity = '0.5';
    blockerScroll.style.opacity = '0.5';
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (me) => {
      const mouseY = me.clientY;

      // Find insertion index
      let newIdx = fixedRows.length; // default: after all
      for (let i = 0; i < rowMids.length; i++) {
        if (mouseY < rowMids[i]) {
          newIdx = i;
          break;
        }
      }
      dropIdx = newIdx;

      // Position the drop indicator
      let lineY;
      if (newIdx === 0 && fixedRows.length > 0) {
        lineY = fixedRows[0].getBoundingClientRect().top;
      } else if (newIdx < fixedRows.length) {
        lineY = fixedRows[newIdx].getBoundingClientRect().top;
      } else if (fixedRows.length > 0) {
        const lastRect = fixedRows[fixedRows.length - 1].getBoundingClientRect();
        lineY = lastRect.bottom;
      } else {
        lineY = fixedPanel.getBoundingClientRect().top;
      }

      const containerRect = fixedPanel.parentElement.getBoundingClientRect();
      dropLine.style.top = `${lineY - containerRect.top}px`;
      dropLine.style.display = 'block';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      dropLine.remove();
      blockerFixed.style.opacity = '';
      blockerScroll.style.opacity = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (dropIdx >= 0) {
        saveBlockerRowPosition(dropIdx);
        render();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* Approximate latitudes and longitudes for sunrise/sunset calculation */
const tzCoords = {
  'Etc/GMT+12': [0, -180], 'Etc/GMT+11': [-14, -165], 'Pacific/Pago_Pago': [-14, -170.7],
  'Pacific/Honolulu': [21.3, -157.8], 'America/Anchorage': [61.2, -149.9],
  'America/Los_Angeles': [34.1, -118.2], 'America/Denver': [39.7, -105.0], 'America/Phoenix': [33.4, -112.1],
  'America/Chicago': [41.9, -87.6], 'America/Regina': [50.4, -104.6],
  'America/New_York': [40.7, -74.0], 'America/Halifax': [44.6, -63.6], 'America/St_Johns': [47.6, -52.7],
  'America/Sao_Paulo': [-23.5, -46.6], 'America/Bogota': [4.7, -74.1],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'Atlantic/Azores': [38.7, -27.2], 'Atlantic/Cape_Verde': [15.0, -23.5],
  'Europe/London': [51.5, -0.1], 'Europe/Paris': [48.9, 2.3], 'Europe/Berlin': [52.5, 13.4],
  'Europe/Warsaw': [52.2, 21.0], 'Europe/Athens': [37.9, 23.7], 'Europe/Moscow': [55.8, 37.6],
  'Africa/Cairo': [30.0, 31.2], 'Africa/Johannesburg': [-26.2, 28.0],
  'Asia/Jerusalem': [31.8, 35.2], 'Asia/Riyadh': [24.7, 46.7], 'Asia/Dubai': [25.3, 55.3],
  'Asia/Tehran': [35.7, 51.4], 'Asia/Karachi': [24.9, 67.0], 'Asia/Kolkata': [22.6, 88.4],
  'Asia/Dhaka': [23.8, 90.4], 'Asia/Yekaterinburg': [56.8, 60.6],
  'Asia/Bangkok': [13.8, 100.5], 'Asia/Novosibirsk': [55.0, 82.9],
  'Asia/Shanghai': [31.2, 121.5], 'Asia/Krasnoyarsk': [56.0, 92.9], 'Asia/Irkutsk': [52.3, 104.3],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Yakutsk': [62.0, 129.7], 'Asia/Vladivostok': [43.1, 131.9],
  'Asia/Magadan': [59.6, 150.8],
  'Australia/Darwin': [-12.5, 130.8], 'Australia/Adelaide': [-34.9, 138.6],
  'Australia/Brisbane': [-27.5, 153.0], 'Australia/Sydney': [-33.9, 151.2], 'Australia/Perth': [-31.9, 115.9],
  'Pacific/Guam': [13.4, 144.8], 'Pacific/Auckland': [-36.8, 174.8],
  'Pacific/Tongatapu': [-21.2, -175.2], 'Pacific/Fiji': [-18.1, 178.4],
  'UTC': [51.5, 0], 'Etc/GMT+6': [30.0, -90.0]
};

const SVG_SUN = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><circle cx="8" cy="8" r="3.5"/><line x1="8" y1="1" x2="8" y2="3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="8" x2="3.5" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12.5" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.05" y1="3.05" x2="4.82" y2="4.82" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11.18" y1="11.18" x2="12.95" y2="12.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.05" y1="12.95" x2="4.82" y2="11.18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11.18" y1="4.82" x2="12.95" y2="3.05" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const SVG_MOON = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.1 10.2A6.5 6.5 0 0 1 5.8 2.9a6.5 6.5 0 1 0 7.3 7.3z"/></svg>';

function getSunTimes(latitude, longitude, dayOfYear, tzOffsetHours) {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const B = deg2rad * (360 / 365) * (dayOfYear - 81);
  const declination = 23.45 * Math.sin(B);
  const decRad = declination * deg2rad;
  const latRad = latitude * deg2rad;
  const zenithRad = 90.833 * deg2rad;
  const cosOmega = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decRad)) /
                   (Math.cos(latRad) * Math.cos(decRad));
  if (cosOmega < -1) return { sunrise: 0, sunset: 24 };
  if (cosOmega > 1) return { sunrise: 12, sunset: 12 };
  const omega = Math.acos(cosOmega) * rad2deg;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const standardMeridian = tzOffsetHours * 15;
  const solarNoon = 12 - eot / 60 + (standardMeridian - longitude) / 15;
  return { sunrise: solarNoon - omega / 15, sunset: solarNoon + omega / 15 };
}

function getDayOfYear(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(date);
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const m = parseInt(parts.find(p => p.type === 'month').value, 10);
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const jan1 = new Date(y, 0, 1);
    const target = new Date(y, m - 1, d);
    return Math.floor((target - jan1) / 86400000) + 1;
  } catch (e) {
    return 102;
  }
}

export function isVisible() { return visible; }
export function clearRange() { savedRange = null; }

export function toggle() {
  visible = !visible;
  const container = document.getElementById('timeline-container');
  const clockGrid = document.getElementById('clock-grid');
  if (container) container.classList.toggle('hidden', !visible);
  if (clockGrid) clockGrid.classList.toggle('hidden', visible);
  if (visible) render();
}

export function show() {
  visible = true;
  const container = document.getElementById('timeline-container');
  const clockGrid = document.getElementById('clock-grid');
  if (container) container.classList.remove('hidden');
  if (clockGrid) clockGrid.classList.add('hidden');
  render();
}

export function hide() {
  visible = false;
  const container = document.getElementById('timeline-container');
  const clockGrid = document.getElementById('clock-grid');
  if (container) container.classList.add('hidden');
  if (clockGrid) clockGrid.classList.remove('hidden');
}

export function render() {
  if (!visible) return;
  const container = document.getElementById('timeline-container');
  if (!container) return;

  // Preserve scroll position across re-renders
  const prevScroll = container.querySelector('.md-tl__scroll');
  if (prevScroll) savedScrollLeft = prevScroll.scrollLeft;

  // Clean up previous document-level listeners to prevent leaks
  if (cleanupDragListeners) {
    cleanupDragListeners();
    cleanupDragListeners = null;
  }
  cancelAnimationFrame(animId);

  const ref = clocks.getOverrideTime() || new Date();
  const clockList = clocks.getClocks();
  const use24h = clocks.getUse24h();
  const pickerTz = getPickerTz();

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localOffsetMins = getOffsetMinutes(localTz, ref);

  container.replaceChildren();

  // Compute current local hour for past-marking (always use real time, not override)
  const realNow = new Date();
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: localTz, hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(realNow);
  const currentLocalH = parseInt(localParts.find(p => p.type === 'hour')?.value || '0', 10)
    + parseInt(localParts.find(p => p.type === 'minute')?.value || '0', 10) / 60;

  // Split layout: fixed left panel + scrollable right panel
  const fixedPanel = document.createElement('div');
  fixedPanel.className = 'md-tl__fixed';

  const scrollPanel = document.createElement('div');
  scrollPanel.className = 'md-tl__scroll';

  const wrapper = document.createElement('div');
  wrapper.className = 'md-tl';

  const rowData = [];

  clockList.forEach(clockData => {
    const tz = clockData.timezone;
    const offsetMins = getOffsetMinutes(tz, ref);
    const tzData = getTzByIana(tz);
    const defaultName = tzData ? tzData.label : tz.replace(/_/g, ' ');
    const customName = getCustomName(tz);
    const displayName = customName || defaultName;
    const isSalesforce = tz === 'Etc/GMT+6';

    const diffMins = offsetMins - localOffsetMins;
    const diffHours = diffMins / 60;
    const offsetStr = getOffsetString(tz, ref);
    const tzShort = getTimezoneShortCode(tz, ref);

    let season = '';
    try {
      const jan = new Date(ref.getFullYear(), 0, 15);
      const jul = new Date(ref.getFullYear(), 6, 15);
      const janOffset = getOffsetMinutes(tz, jan);
      const julOffset = getOffsetMinutes(tz, jul);
      if (janOffset === julOffset) {
        season = 'No DST';
      } else {
        const long = ref.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'long' });
        season = long.toLowerCase().includes('daylight') || long.toLowerCase().includes('summer') ? 'Summer' : 'Winter';
      }
    } catch {
      // DST detection not supported for this timezone
    }

    const coords = tzCoords[tz] ?? [45, 0];
    const doy = getDayOfYear(ref, tz);
    const tzOffsetHours = offsetMins / 60;
    const sunTimes = getSunTimes(coords[0], coords[1], doy, tzOffsetHours);

    const isActive = tz === pickerTz;

    // --- Fixed row: label + info ---
    const fixedRow = document.createElement('div');
    fixedRow.className = 'md-tl__fixed-row' + (isActive ? ' md-tl__fixed-row--active' : '');
    fixedRow.dataset.timezone = tz;

    const label = document.createElement('div');
    label.className = 'md-tl__label';
    label.style.cursor = 'pointer';
    label.title = `Set picker to ${displayName}`;
    label.tabIndex = 0;
    label.setAttribute('role', 'button');
    label.setAttribute('aria-label', `Set picker to ${displayName}`);

    label.addEventListener('click', () => { setPickerTz(tz); });
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickerTz(tz); }
    });

    const nameRow = document.createElement('div');
    nameRow.className = 'md-tl__tz-name-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'md-tl__tz-name';
    nameSpan.textContent = displayName;
    nameSpan.title = tz;
    nameRow.appendChild(nameSpan);

    if (tzShort && !isSalesforce) {
      const shortSpan = document.createElement('span');
      shortSpan.className = 'md-tl__tz-short';
      shortSpan.textContent = tzShort;
      nameRow.appendChild(shortSpan);
    }

    if (clockData.isLocal) {
      const icon = document.createElement('span');
      icon.className = 'md-tl__tz-icon';
      icon.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 2L2 7.5V14h4.5v-4h3v4H14V7.5L8 2z"/></svg>';
      icon.title = 'Local timezone';
      nameRow.appendChild(icon);
    } else if (isSalesforce) {
      const icon = document.createElement('span');
      icon.className = 'md-tl__tz-icon';
      icon.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.2 6.7C12.7 4.4 10.6 2.7 8 2.7c-1.9 0-3.6 1.1-4.4 2.7C1.6 5.6 0 7.3 0 9.3c0 2.2 1.8 4 4 4h8.7c1.8 0 3.3-1.5 3.3-3.3 0-1.8-1.4-3.2-3.1-3.3z"/></svg>';
      icon.title = 'Salesforce / MCE';
      nameRow.appendChild(icon);
    }
    label.appendChild(nameRow);

    const detailSpan = document.createElement('div');
    detailSpan.className = 'md-tl__tz-detail';
    detailSpan.textContent = `${offsetStr} · ${season}`;
    label.appendChild(detailSpan);

    fixedRow.appendChild(label);

    const infoCell = document.createElement('div');
    infoCell.className = 'md-tl__info';
    fixedRow.appendChild(infoCell);

    fixedPanel.appendChild(fixedRow);

    // --- Scroll row: strip only ---
    const row = document.createElement('div');
    row.className = 'md-tl__row' + (isActive ? ' md-tl__row--active' : '');
    row.dataset.timezone = tz;

    const strip = document.createElement('div');
    strip.className = 'md-tl__strip';

    const sunriseH = Math.floor(sunTimes.sunrise);
    const sunsetH = Math.floor(sunTimes.sunset);

    for (let localH = 0; localH < TOTAL_HOURS; localH++) {
      const tzHour = ((localH + diffHours) % 24 + 24) % 24;
      const cell = document.createElement('div');
      cell.className = 'md-tl__hour';

      const hourText = document.createElement('span');
      hourText.className = 'md-tl__hour-text';
      hourText.textContent = formatHour(tzHour, clocks.getUse24hForTz(tz));
      cell.appendChild(hourText);

      const tzHourFloor = Math.floor(tzHour);
      if (tzHourFloor === 0) {
        const tzDateStr = getDateAtLocalHour(ref, tz, localH, diffHours);
        const tzDayStr = getDayNameAtLocalHour(ref, tz, localH);
        const dateLabel = document.createElement('span');
        dateLabel.className = 'md-tl__hour-date';
        dateLabel.textContent = tzDateStr;
        cell.appendChild(dateLabel);
        const dayLabel = document.createElement('span');
        dayLabel.className = 'md-tl__hour-date';
        dayLabel.textContent = tzDayStr;
        cell.appendChild(dayLabel);
        cell.classList.add('md-tl__hour--midnight');
      }

      // Mark fully past hours (exclude the current hour)
      if (localH < Math.floor(currentLocalH)) {
        cell.classList.add('md-tl__hour--past');
      }

      if (tzHour >= sunTimes.sunrise && tzHour < sunTimes.sunset) {
        cell.classList.add('md-tl__hour--day');
      } else {
        cell.classList.add('md-tl__hour--night');
      }

      if (tzHourFloor === sunriseH) {
        cell.classList.add('md-tl__hour--dawn');
        const sym = document.createElement('span');
        sym.className = 'md-tl__sun-symbol';
        sym.innerHTML = SVG_SUN;
        sym.title = `Sunrise ~${formatTimeDecimal(sunTimes.sunrise)}`;
        cell.appendChild(sym);
      } else if (tzHourFloor === sunsetH) {
        cell.classList.add('md-tl__hour--dusk');
        const sym = document.createElement('span');
        sym.className = 'md-tl__moon-symbol';
        sym.innerHTML = SVG_MOON;
        sym.title = `Sunset ~${formatTimeDecimal(sunTimes.sunset)}`;
        cell.appendChild(sym);
      }

      strip.appendChild(cell);
    }

    row.appendChild(strip);
    wrapper.appendChild(row);
    rowData.push({ tz, displayName, diffHours, use24h: clocks.getUse24hForTz(tz) });
  });

  // Time Block row — positioned among timezone rows based on saved position
  const blockers = loadBlockers();
  const blockerRowElements = { fixedRow: null, scrollRow: null };
  if (blockers.length > 0) {
    // Fixed panel: blocker label + info
    const blockerFixedRow = document.createElement('div');
    blockerFixedRow.className = 'md-tl__fixed-row md-tl__fixed-row--blocker';

    const blockerLabel = document.createElement('div');
    blockerLabel.className = 'md-tl__label md-tl__label--blocker';

    // Drag handle for reordering
    const dragHandle = document.createElement('span');
    dragHandle.className = 'md-tl__blocker-drag-handle';
    dragHandle.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';
    dragHandle.title = 'Drag to reorder';
    blockerLabel.appendChild(dragHandle);

    const blockerTitle = document.createElement('span');
    blockerTitle.className = 'md-tl__tz-name';
    blockerTitle.textContent = `Time Blocks (${blockers.length})`;
    blockerTitle.style.cursor = 'default';
    blockerLabel.appendChild(blockerTitle);
    blockerFixedRow.appendChild(blockerLabel);

    const blockerInfo = document.createElement('div');
    blockerInfo.className = 'md-tl__info md-tl__info--blocker';

    // Calculate total duration of all time blocks
    const totalFraction = blockers.reduce((sum, b) => sum + (b.endFraction - b.startFraction), 0);
    const totalMinutes = Math.round(totalFraction * TOTAL_HOURS * 60);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;
    const totalLabel = document.createElement('span');
    totalLabel.className = 'md-tl__blocker-total-label';
    totalLabel.textContent = 'Total';
    const totalValue = document.createElement('span');
    totalValue.className = 'md-tl__blocker-total-value';
    totalValue.textContent = totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`;
    blockerInfo.appendChild(totalLabel);
    blockerInfo.appendChild(totalValue);
    blockerFixedRow.appendChild(blockerInfo);

    // Scroll panel: blocker strip
    const blockerRow = document.createElement('div');
    blockerRow.className = 'md-tl__row md-tl__row--blocker';

    const blockerStrip = document.createElement('div');
    blockerStrip.className = 'md-tl__strip md-tl__strip--blocker';
    blockerStrip.style.position = 'relative';
    blockerStrip.style.minHeight = '32px';

    for (let localH = 0; localH < TOTAL_HOURS; localH++) {
      const cell = document.createElement('div');
      cell.className = 'md-tl__hour md-tl__hour--blocker-bg';
      if (localH < Math.floor(currentLocalH)) cell.classList.add('md-tl__hour--past');
      blockerStrip.appendChild(cell);
    }

    blockers.forEach((b, idx) => {
      const block = document.createElement('div');
      block.className = 'md-tl__blocker';
      block.style.left = `${b.startFraction * 100}%`;
      block.style.width = `${(b.endFraction - b.startFraction) * 100}%`;
      block.title = b.name;

      const blockLabel = document.createElement('span');
      blockLabel.className = 'md-tl__blocker-name';
      blockLabel.textContent = b.name;
      block.appendChild(blockLabel);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'md-tl__blocker-remove';
      removeBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>';
      removeBtn.title = 'Remove time block';
      removeBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBlocker(idx);
        render();
      });
      block.appendChild(removeBtn);

      // Drag-to-move blocker horizontally; click (no drag) shows preview
      block.addEventListener('mousedown', (e) => {
        if (e.target.closest('.md-tl__blocker-remove')) return;
        e.stopPropagation();
        e.preventDefault();
        const blockerWidth = b.endFraction - b.startFraction;
        const stripRect = blockerStrip.getBoundingClientRect();
        const startMouseX = e.clientX;
        const startLeft = b.startFraction;
        let didDrag = false;

        const onMove = (me) => {
          const dx = me.clientX - startMouseX;
          if (Math.abs(dx) > 3) didDrag = true;
          const dFraction = dx / stripRect.width;
          let newStart = startLeft + dFraction;
          newStart = Math.round(newStart * TOTAL_HOURS * 4) / (TOTAL_HOURS * 4);
          newStart = Math.max(0, Math.min(1 - blockerWidth, newStart));
          block.style.left = `${newStart * 100}%`;
          block._dragFraction = newStart;
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.userSelect = '';
          if (block._dragFraction !== undefined) {
            const allBlockers = loadBlockers();
            allBlockers[idx].startFraction = block._dragFraction;
            allBlockers[idx].endFraction = block._dragFraction + blockerWidth;
            saveBlockers(allBlockers);
            delete block._dragFraction;
          }
          if (!didDrag) {
            showBlockPreview(b.startFraction, b.startFraction + blockerWidth);
          }
        };

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      blockerStrip.appendChild(block);
    });

    blockerRow.appendChild(blockerStrip);

    blockerRowElements.fixedRow = blockerFixedRow;
    blockerRowElements.scrollRow = blockerRow;

    // Insert at saved position
    const savedPos = getBlockerRowPosition();
    const tzFixedRows = fixedPanel.querySelectorAll('.md-tl__fixed-row');
    const tzScrollRows = wrapper.querySelectorAll('.md-tl__row');
    const insertIdx = Math.min(savedPos, tzFixedRows.length);

    if (insertIdx < tzFixedRows.length) {
      fixedPanel.insertBefore(blockerFixedRow, tzFixedRows[insertIdx]);
      wrapper.insertBefore(blockerRow, tzScrollRows[insertIdx]);
    } else {
      fixedPanel.appendChild(blockerFixedRow);
      wrapper.appendChild(blockerRow);
    }

    // Drag handle: reorder Time Blocks row among timezone rows
    setupBlockerRowDrag(dragHandle, fixedPanel, wrapper, clockList.length);
  }

  // Footer row
  const footer = document.createElement('div');
  footer.className = 'md-tl__footer';
  const footerLabel = document.createElement('div');
  footerLabel.className = 'md-tl__footer-label';
  const footerTz = document.createElement('span');
  footerTz.className = 'md-tl__footer-tz';
  const footerTime = document.createElement('span');
  footerTime.className = 'md-tl__footer-time';
  const footerDate = document.createElement('span');
  footerDate.className = 'md-tl__footer-date';
  footerLabel.appendChild(footerTz);
  footerLabel.appendChild(footerDate);
  footerLabel.appendChild(footerTime);
  footer.appendChild(footerLabel);
  wrapper.appendChild(footer);

  // Now() line — always shows real current time
  const nowLine = document.createElement('div');
  nowLine.className = 'md-tl__now-line';
  const nowLabel = document.createElement('span');
  nowLabel.className = 'md-tl__now-label';
  nowLabel.textContent = 'Now()';
  nowLine.appendChild(nowLabel);
  wrapper.appendChild(nowLine);

  // Indicator line
  const indicator = document.createElement('div');
  indicator.className = 'md-tl__indicator';
  const handle = document.createElement('div');
  handle.className = 'md-tl__indicator-handle';
  indicator.appendChild(handle);
  wrapper.appendChild(indicator);

  // Range selection box
  const rangeBox = document.createElement('div');
  rangeBox.className = 'md-tl__range hidden';
  const rangeLabelStart = document.createElement('div');
  rangeLabelStart.className = 'md-tl__range-label md-tl__range-label--start';
  const rangeStartTz = document.createElement('span');
  rangeStartTz.className = 'md-tl__range-tz';
  const rangeStartDate = document.createElement('span');
  rangeStartDate.className = 'md-tl__range-date';
  const rangeStartTime = document.createElement('span');
  rangeStartTime.className = 'md-tl__range-time';
  rangeLabelStart.appendChild(rangeStartTz);
  rangeLabelStart.appendChild(rangeStartDate);
  rangeLabelStart.appendChild(rangeStartTime);

  const rangeLabelEnd = document.createElement('div');
  rangeLabelEnd.className = 'md-tl__range-label md-tl__range-label--end';
  const rangeEndDuration = document.createElement('span');
  rangeEndDuration.className = 'md-tl__range-duration';
  const rangeEndDate = document.createElement('span');
  rangeEndDate.className = 'md-tl__range-date';
  const rangeEndTime = document.createElement('span');
  rangeEndTime.className = 'md-tl__range-time';
  rangeLabelEnd.appendChild(rangeEndDuration);
  rangeLabelEnd.appendChild(rangeEndDate);
  rangeLabelEnd.appendChild(rangeEndTime);

  rangeBox.appendChild(rangeLabelStart);
  rangeBox.appendChild(rangeLabelEnd);

  const rangeHandleStart = document.createElement('div');
  rangeHandleStart.className = 'md-tl__range-handle md-tl__range-handle--start';
  rangeBox.appendChild(rangeHandleStart);

  const rangeHandleEnd = document.createElement('div');
  rangeHandleEnd.className = 'md-tl__range-handle md-tl__range-handle--end';
  rangeBox.appendChild(rangeHandleEnd);

  wrapper.appendChild(rangeBox);

  // Time Block preview overlay — shown when clicking a time block
  const blockPreview = document.createElement('div');
  blockPreview.className = 'md-tl__block-preview hidden';

  const bpLabelStart = document.createElement('div');
  bpLabelStart.className = 'md-tl__block-preview-label md-tl__block-preview-label--start';
  const bpStartTz = document.createElement('span');
  bpStartTz.className = 'md-tl__block-preview-tz';
  const bpStartDate = document.createElement('span');
  bpStartDate.className = 'md-tl__block-preview-date';
  const bpStartTime = document.createElement('span');
  bpStartTime.className = 'md-tl__block-preview-time';
  bpLabelStart.appendChild(bpStartTz);
  bpLabelStart.appendChild(bpStartDate);
  bpLabelStart.appendChild(bpStartTime);

  const bpLabelEnd = document.createElement('div');
  bpLabelEnd.className = 'md-tl__block-preview-label md-tl__block-preview-label--end';
  const bpEndDuration = document.createElement('span');
  bpEndDuration.className = 'md-tl__block-preview-duration';
  const bpEndDate = document.createElement('span');
  bpEndDate.className = 'md-tl__block-preview-date';
  const bpEndTime = document.createElement('span');
  bpEndTime.className = 'md-tl__block-preview-time';
  bpLabelEnd.appendChild(bpEndDuration);
  bpLabelEnd.appendChild(bpEndDate);
  bpLabelEnd.appendChild(bpEndTime);

  blockPreview.appendChild(bpLabelStart);
  blockPreview.appendChild(bpLabelEnd);
  wrapper.appendChild(blockPreview);

  function showBlockPreview(startFraction, endFraction) {
    const stripEl = wrapper.querySelector('.md-tl__strip');
    if (!stripEl) return;
    const stripWidth = stripEl.offsetWidth;
    const left = startFraction * stripWidth;
    const width = (endFraction - startFraction) * stripWidth;

    blockPreview.style.left = `${left}px`;
    blockPreview.style.width = `${width}px`;
    blockPreview.classList.remove('hidden');

    const pickerTz = getPickerTz();
    const pickerRow = rowData.find(r => r.tz === pickerTz);
    if (pickerRow) {
      const u24h = clocks.getUse24hForTz(pickerRow.tz);
      const tStart = fractionToTime(startFraction, pickerRow.diffHours);
      const tEnd = fractionToTime(endFraction, pickerRow.diffHours);
      const startDate = getDateAtFraction(startFraction, pickerRow.tz);
      const endDate = getDateAtFraction(endFraction, pickerRow.tz);

      const durationMin = Math.round(Math.abs(endFraction - startFraction) * TOTAL_HOURS * 60);
      const durH = Math.floor(durationMin / 60);
      const durM = durationMin % 60;
      const durStr = durM > 0 ? `${durH}h ${durM}m` : `${durH}h`;

      bpStartTz.textContent = pickerRow.displayName;
      bpStartDate.textContent = startDate;
      bpStartTime.textContent = formatTime(tStart.h, tStart.m, u24h);

      bpEndDuration.textContent = durStr;
      bpEndDate.textContent = endDate;
      bpEndTime.textContent = formatTime(tEnd.h, tEnd.m, u24h);
    }
  }

  function hideBlockPreview() {
    blockPreview.classList.add('hidden');
  }

  // Save as Time Block button — independent element in wrapper (not inside pointer-events:none rangeBox)
  const blockerBtn = document.createElement('button');
  blockerBtn.className = 'md-tl__range-blocker-btn hidden';
  blockerBtn.textContent = 'Save as Time Block';
  blockerBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
  blockerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!savedRange) return;
    const name = prompt('Time Block name:', 'Available');
    if (!name) return;
    addBlocker({ name, startFraction: savedRange.startFraction, endFraction: savedRange.endFraction });
    render();
  });
  wrapper.appendChild(blockerBtn);

  // Assemble: scroll panel wraps the strip wrapper
  scrollPanel.appendChild(wrapper);
  container.appendChild(fixedPanel);
  container.appendChild(scrollPanel);

  // Sync row heights between fixed and scroll panels
  const fixedRows = fixedPanel.querySelectorAll('.md-tl__fixed-row');
  const scrollRows = wrapper.querySelectorAll('.md-tl__row');
  fixedRows.forEach((fr, i) => {
    if (scrollRows[i]) {
      const h = Math.max(fr.offsetHeight, scrollRows[i].offsetHeight);
      fr.style.minHeight = `${h}px`;
      scrollRows[i].style.minHeight = `${h}px`;
    }
  });

  const firstStrip = wrapper.querySelector('.md-tl__strip');
  positionNowLine(wrapper, firstStrip);
  positionIndicator(wrapper, firstStrip, ref);
  updateFooter(wrapper, firstStrip, ref, rowData, use24h);
  setupDrag(wrapper, fixedPanel, firstStrip, indicator, rangeBox, rowData, use24h, hideBlockPreview);

  // Update info column for initial indicator position
  const initFraction = getCurrentFraction(ref);
  if (savedRange) {
    indicator.classList.add('hidden');
    footerLabel.classList.add('hidden');
    updateInfoColumn(fixedPanel, rowData, null, use24h, true, { start: savedRange.startFraction, end: savedRange.endFraction });
  } else {
    updateInfoColumn(fixedPanel, rowData, initFraction, use24h, false, null);
  }

  // Restore scroll position if re-rendering, otherwise scroll to show 3 hours before current time
  if (savedScrollLeft !== null) {
    scrollPanel.scrollLeft = savedScrollLeft;
    savedScrollLeft = null;
  } else {
    const hourWidth = firstStrip ? firstStrip.offsetWidth / TOTAL_HOURS : 60;
    const currentPx = initFraction * (firstStrip ? firstStrip.offsetWidth : 0);
    const pastPx = 3 * hourWidth; // 3 hours of past visible
    scrollPanel.scrollLeft = Math.max(0, currentPx - pastPx);
  }

  animId = requestAnimationFrame(function tick() {
    if (!visible) return;
    positionNowLine(wrapper, firstStrip);
    if (!clocks.isOverrideActive()) {
      const now = new Date();
      positionIndicator(wrapper, firstStrip, now);
      updateFooter(wrapper, firstStrip, now, rowData, clocks.getUse24h());
      if (!savedRange) updateInfoColumn(fixedPanel, rowData, getCurrentFraction(now), clocks.getUse24h(), false, null);
    }
    animId = requestAnimationFrame(tick);
  });
}

function positionNowLine(wrapper, refStrip) {
  const nowLine = wrapper.querySelector('.md-tl__now-line');
  if (!nowLine || !refStrip) return;

  const realNow = new Date();
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: localTz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  }).formatToParts(realNow);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const s = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  const fraction = (h + m / 60 + s / 3600) / TOTAL_HOURS;
  nowLine.style.left = `${fraction * refStrip.offsetWidth}px`;
}

function positionIndicator(wrapper, refStrip, ref) {
  const indicator = wrapper.querySelector('.md-tl__indicator');
  if (!indicator || !refStrip) return;

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: localTz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  }).formatToParts(ref);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const s = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  const fraction = (h + m / 60 + s / 3600) / TOTAL_HOURS;
  const leftPx = fraction * refStrip.offsetWidth;
  indicator.style.left = `${leftPx}px`;

  // Position footer label to track indicator
  const footerLabel = wrapper.querySelector('.md-tl__footer-label');
  if (footerLabel) footerLabel.style.left = `${leftPx}px`;
}

function updateFooter(wrapper, refStrip, ref, rowData, use24h) {
  const footerTz = wrapper.querySelector('.md-tl__footer-tz');
  const footerTime = wrapper.querySelector('.md-tl__footer-time');
  if (!footerTz || !footerTime || !refStrip) return;

  const pickerTz = getPickerTz();
  const pickerRow = rowData.find(r => r.tz === pickerTz);
  if (!pickerRow) return;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: pickerTz, hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(ref);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  footerTz.textContent = pickerRow.displayName;
  footerTime.textContent = formatTime(h, m, clocks.getUse24hForTz(pickerTz));

  const footerDate = wrapper.querySelector('.md-tl__footer-date');
  if (footerDate) {
    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: pickerTz, weekday: 'short', day: '2-digit', month: 'short'
    }).formatToParts(ref);
    const dateStr = dateParts.map(p => p.value).join('');
    footerDate.textContent = dateStr;
  }

  const footerLabel = wrapper.querySelector('.md-tl__footer-label');
  if (footerLabel) {
    const indicator = wrapper.querySelector('.md-tl__indicator');
    if (indicator) footerLabel.style.left = indicator.style.left;
  }
}

function applyTimeFromFraction(fraction, localTz) {
  const totalMinutes = Math.round(fraction * TOTAL_HOURS * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const dayOffset = Math.floor(totalMinutes / 60 / 24);
  const m = totalMinutes % 60;

  const realNow = new Date(); // always use real time as base, not override
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: localTz, year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(realNow);
  const getPart = (type) => parseInt(dateParts.find(p => p.type === type).value, 10);

  const baseDate = new Date(getPart('year'), getPart('month') - 1, getPart('day'));
  baseDate.setDate(baseDate.getDate() + dayOffset);

  clocks.activateProbe(localTz, h, m, baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  updateDatetimeInputs();
  updateResetVisibility();
}

function setupDrag(wrapper, fixedPanel, refStrip, indicator, rangeBox, rowData, use24h, hideBlockPreview) {
  if (!refStrip) return;

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const footerLabel = wrapper.querySelector('.md-tl__footer-label');
  const blockerBtn = wrapper.querySelector('.md-tl__range-blocker-btn');

  function snapFraction(clientX) {
    const stripRect = refStrip.getBoundingClientRect();
    const rawFraction = (clientX - stripRect.left) / stripRect.width;
    const clamped = Math.max(0, Math.min(1, rawFraction));
    return Math.round(clamped * TOTAL_HOURS * 4) / (TOTAL_HOURS * 4);
  }

  function moveIndicator(fraction) {
    const leftPx = fraction * refStrip.offsetWidth;
    indicator.style.left = `${leftPx}px`;
    if (footerLabel) footerLabel.style.left = `${leftPx}px`;
  }

  function fractionToLocalTime(fraction, tz, diffHours) {
    const totalMinutes = Math.round(fraction * TOTAL_HOURS * 60);
    const localH = Math.floor(totalMinutes / 60);
    const localM = totalMinutes % 60;
    const rawTzH = localH + diffHours;
    const tzH = ((rawTzH % 24) + 24) % 24;
    return { h: Math.floor(tzH), m: localM };
  }

  function updateFooterForFraction(fraction) {
    const footerTz = wrapper.querySelector('.md-tl__footer-tz');
    const footerTime = wrapper.querySelector('.md-tl__footer-time');
    const footerDate = wrapper.querySelector('.md-tl__footer-date');
    if (!footerTz || !footerTime) return;

    const pickerTz = getPickerTz();
    const pickerRow = rowData.find(r => r.tz === pickerTz);
    if (!pickerRow) return;

    const t = fractionToLocalTime(fraction, pickerRow.tz, pickerRow.diffHours);
    footerTz.textContent = pickerRow.displayName;
    footerTime.textContent = formatTime(t.h, t.m, clocks.getUse24hForTz(pickerRow.tz));

    if (footerDate) {
      footerDate.textContent = getDateAtFraction(fraction, pickerRow.tz);
    }

    if (footerLabel) {
      footerLabel.style.left = `${fraction * refStrip.offsetWidth}px`;
    }
  }

  function updateRangeBox(startFraction, endFraction) {
    const stripWidth = refStrip.offsetWidth;
    const minF = Math.min(startFraction, endFraction);
    const maxF = Math.max(startFraction, endFraction);
    const left = minF * stripWidth;
    const right = maxF * stripWidth;
    const width = right - left;

    rangeBox.classList.remove('hidden');
    rangeBox.style.left = `${left}px`;
    rangeBox.style.width = `${width}px`;

    // Position blocker button centered over range
    if (blockerBtn) {
      blockerBtn.classList.remove('hidden');
      const btnLeft = left + width / 2;
      blockerBtn.style.left = `${btnLeft}px`;
      blockerBtn.style.transform = 'translateX(-50%)';
    }

    const pickerTz = getPickerTz();
    const pickerRow = rowData.find(r => r.tz === pickerTz);
    if (!pickerRow) return;

    const u24h = clocks.getUse24hForTz(pickerRow.tz);
    const tStart = fractionToLocalTime(minF, pickerRow.tz, pickerRow.diffHours);
    const tEnd = fractionToLocalTime(maxF, pickerRow.tz, pickerRow.diffHours);

    const durationTotal = Math.round(Math.abs(endFraction - startFraction) * TOTAL_HOURS * 60);
    const durH = Math.floor(durationTotal / 60);
    const durM = durationTotal % 60;
    const durStr = durH > 0 ? `${durH}h${durM > 0 ? ' ' + durM + 'm' : ''}` : `${durM}m`;

    const startTzEl = rangeBox.querySelector('.md-tl__range-label--start .md-tl__range-tz');
    const startTimeEl = rangeBox.querySelector('.md-tl__range-label--start .md-tl__range-time');
    const endDurEl = rangeBox.querySelector('.md-tl__range-duration');
    const endTimeEl = rangeBox.querySelector('.md-tl__range-label--end .md-tl__range-time');

    if (startTzEl) startTzEl.textContent = pickerRow.displayName;
    if (startTimeEl) startTimeEl.textContent = formatTime(tStart.h, tStart.m, u24h);
    if (endDurEl) endDurEl.textContent = durStr;
    if (endTimeEl) endTimeEl.textContent = formatTime(tEnd.h, tEnd.m, u24h);

    const startDateEl = rangeBox.querySelector('.md-tl__range-label--start .md-tl__range-date');
    const endDateEl = rangeBox.querySelector('.md-tl__range-label--end .md-tl__range-date');
    if (startDateEl) startDateEl.textContent = getDateAtFraction(minF, pickerRow.tz);
    if (endDateEl) endDateEl.textContent = getDateAtFraction(maxF, pickerRow.tz);
  }

  // --- Standard drag: click on strip starts new indicator / range ---

  const onStart = (clientX) => {
    hideBlockPreview();
    const fraction = snapFraction(clientX);
    dragState = { active: true, startFraction: fraction, endFraction: fraction, isRange: false };
    indicator.classList.add('md-tl__indicator--dragging');
    document.body.style.userSelect = 'none';
    moveIndicator(fraction);
    applyTimeFromFraction(fraction, localTz);
    updateFooterForFraction(fraction);
    updateInfoColumn(fixedPanel, rowData, fraction, clocks.getUse24h(), false, null);
  };

  const onMove = (clientX) => {
    if (!dragState) return;
    const fraction = snapFraction(clientX);
    dragState.endFraction = fraction;
    const distance = Math.abs(fraction - dragState.startFraction);

    if (distance >= 1 / (TOTAL_HOURS * 4)) {
      dragState.isRange = true;
      indicator.classList.add('hidden');
      if (footerLabel) footerLabel.classList.add('hidden');
      updateRangeBox(dragState.startFraction, fraction);
      const minF = Math.min(dragState.startFraction, fraction);
      const maxF = Math.max(dragState.startFraction, fraction);
      updateInfoColumn(fixedPanel, rowData, null, clocks.getUse24h(), true, { start: minF, end: maxF });
    } else {
      dragState.isRange = false;
      rangeBox.classList.add('hidden');
      if (blockerBtn) blockerBtn.classList.add('hidden');
      indicator.classList.remove('hidden');
      if (footerLabel) footerLabel.classList.remove('hidden');
      moveIndicator(fraction);
      updateFooterForFraction(fraction);
      updateInfoColumn(fixedPanel, rowData, fraction, clocks.getUse24h(), false, null);
    }
  };

  const onEnd = () => {
    if (!dragState) return;
    if (dragState.isRange) {
      savedRange = {
        startFraction: Math.min(dragState.startFraction, dragState.endFraction),
        endFraction: Math.max(dragState.startFraction, dragState.endFraction)
      };
    } else {
      savedRange = null;
      indicator.classList.remove('hidden');
    }
    dragState = null;
    indicator.classList.remove('md-tl__indicator--dragging');
    document.body.style.userSelect = '';
  };

  // --- Range handle resize drag ---

  let resizeState = null;

  const onResizeStart = (edge, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!savedRange) return;
    const fixedFraction = edge === 'start' ? savedRange.endFraction : savedRange.startFraction;
    resizeState = { edge, fixedFraction };
    document.body.style.userSelect = 'none';
  };

  const onResizeMove = (clientX) => {
    if (!resizeState) return;
    const fraction = snapFraction(clientX);
    const minF = Math.min(fraction, resizeState.fixedFraction);
    const maxF = Math.max(fraction, resizeState.fixedFraction);
    if (maxF - minF < 1 / (TOTAL_HOURS * 4)) return;
    savedRange = { startFraction: minF, endFraction: maxF };
    updateRangeBox(minF, maxF);
  };

  const onResizeEnd = () => {
    if (!resizeState) return;
    resizeState = null;
    document.body.style.userSelect = '';
  };

  const handleStart = rangeBox.querySelector('.md-tl__range-handle--start');
  const handleEnd = rangeBox.querySelector('.md-tl__range-handle--end');

  handleStart.addEventListener('mousedown', (e) => onResizeStart('start', e));
  handleEnd.addEventListener('mousedown', (e) => onResizeStart('end', e));

  // Document-level listeners — stored for cleanup on re-render
  const docMouseMove = (e) => {
    if (resizeState) onResizeMove(e.clientX);
    else onMove(e.clientX);
  };
  const docMouseUp = () => {
    if (resizeState) onResizeEnd();
    else onEnd();
  };
  const docTouchMove = (e) => {
    if (resizeState) onResizeMove(e.touches[0].clientX);
    else if (dragState) onMove(e.touches[0].clientX);
  };
  const docTouchEnd = () => {
    if (resizeState) onResizeEnd();
    else onEnd();
  };

  document.addEventListener('mousemove', docMouseMove);
  document.addEventListener('mouseup', docMouseUp);
  document.addEventListener('touchmove', docTouchMove, { passive: true });
  document.addEventListener('touchend', docTouchEnd);

  // Store cleanup function
  cleanupDragListeners = () => {
    document.removeEventListener('mousemove', docMouseMove);
    document.removeEventListener('mouseup', docMouseUp);
    document.removeEventListener('touchmove', docTouchMove);
    document.removeEventListener('touchend', docTouchEnd);
  };

  // Touch support on indicator
  indicator.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientX); });
  indicator.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e.touches[0].clientX); }, { passive: false });

  // Click on strip — new selection
  wrapper.querySelectorAll('.md-tl__strip').forEach(strip => {
    strip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      rangeBox.classList.add('hidden');
      if (blockerBtn) blockerBtn.classList.add('hidden');
      indicator.classList.remove('hidden');
      if (footerLabel) footerLabel.classList.remove('hidden');
      savedRange = null;
      onStart(e.clientX);
    });
  });

  // Restore saved range on re-render
  if (savedRange) {
    updateRangeBox(savedRange.startFraction, savedRange.endFraction);
  }
}

function getCurrentFraction(ref) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: localTz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  }).formatToParts(ref);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const s = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
  return (h + m / 60 + s / 3600) / TOTAL_HOURS;
}

function getDateAtLocalHour(ref, tz, localH, diffHours) {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Always use real current time as base — timeline grid starts from today's midnight
    const realNow = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: localTz, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(realNow);
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const mo = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const localOffset = getOffsetMinutes(localTz, realNow);
    const dayStart = new Date(Date.UTC(y, mo, d, 0, 0) - localOffset * 60000);
    const targetTime = new Date(dayStart.getTime() + localH * 3600000);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, day: '2-digit', month: 'short'
    }).format(targetTime);
  } catch (e) {
    return '';
  }
}

function getDayNameAtLocalHour(ref, tz, localH) {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Always use real current time as base — timeline grid starts from today's midnight
    const realNow = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: localTz, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(realNow);
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const mo = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const localOffset = getOffsetMinutes(localTz, realNow);
    const dayStart = new Date(Date.UTC(y, mo, d, 0, 0) - localOffset * 60000);
    const targetTime = new Date(dayStart.getTime() + localH * 3600000);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short'
    }).format(targetTime);
  } catch (e) {
    return '';
  }
}

function getDateAtFraction(fraction, tz) {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const totalMinutes = Math.round(fraction * TOTAL_HOURS * 60);
    const localH = Math.floor(totalMinutes / 60);
    // Always use real current time as base — timeline grid starts from today's midnight
    const realNow = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: localTz, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(realNow);
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const mo = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const localOffset = getOffsetMinutes(localTz, realNow);
    const dayStart = new Date(Date.UTC(y, mo, d, 0, 0) - localOffset * 60000);
    const targetTime = new Date(dayStart.getTime() + localH * 3600000);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, weekday: 'short', day: '2-digit', month: 'short'
    }).format(targetTime);
  } catch (e) {
    return '';
  }
}

function updateInfoColumn(fixedPanel, rowData, fraction, _use24h, isRange, rangeFractions) {
  const infoCells = fixedPanel.querySelectorAll('.md-tl__fixed-row:not(.md-tl__fixed-row--blocker) .md-tl__info');
  infoCells.forEach((info, i) => {
    if (!rowData[i]) return;
    const { diffHours, use24h: rowUse24h } = rowData[i];
    const u24 = rowUse24h;

    if (isRange && rangeFractions) {
      const tStart = fractionToTime(rangeFractions.start, diffHours);
      const tEnd = fractionToTime(rangeFractions.end, diffHours);
      const startStr = formatTime(tStart.h, tStart.m, u24);
      const endStr = formatTime(tEnd.h, tEnd.m, u24);
      const dayDiff = tEnd.dayOffset - tStart.dayOffset;
      const dateNote = dayDiff !== 0 ? ` <span class="md-tl__info-day">${dayDiff > 0 ? '+' : ''}${dayDiff}d</span>` : '';
      info.innerHTML = `<span class="md-tl__info-time">${startStr}</span><span class="md-tl__info-sep">–</span><span class="md-tl__info-time">${endStr}</span>${dateNote}`;
    } else if (fraction !== null) {
      const t = fractionToTime(fraction, diffHours);
      const timeStr = formatTime(t.h, t.m, u24);
      const dayNote = t.dayOffset !== 0 ? ` <span class="md-tl__info-day">${t.dayOffset > 0 ? '+' : ''}${t.dayOffset}d</span>` : '';
      info.innerHTML = `<span class="md-tl__info-time">${timeStr}</span>${dayNote}`;
    } else {
      info.textContent = '';
    }
  });
}

function fractionToTime(fraction, diffHours) {
  const totalMinutes = Math.round(fraction * TOTAL_HOURS * 60);
  const localH = Math.floor(totalMinutes / 60);
  const localM = totalMinutes % 60;
  const rawTzH = localH + diffHours;
  const tzH = ((rawTzH % 24) + 24) % 24;
  const dayOffset = Math.floor(rawTzH / 24);
  return { h: Math.floor(tzH), m: localM, dayOffset };
}

function formatHour(h, use24h) {
  const hInt = Math.floor(h);
  if (use24h) return hInt.toString().padStart(2, '0');
  const h12 = hInt % 12 || 12;
  const ampm = hInt >= 12 ? 'PM' : 'AM';
  return `${h12}${ampm}`;
}

function formatTime(h, m, use24h) {
  if (use24h) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatTimeDecimal(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
