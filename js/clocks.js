/* Clock rendering, animation, and state management */

import { timezoneDatabase, getTzByIana, getOffsetMinutes, getOffsetString, getTimezoneShortCode } from './timezones.js';
import { saveClocks, loadClocks, getCustomName, saveCustomName } from './persistence.js';

// State
let clocks = [];
let overrideTime = null;
let probeSource = null;
let animFrameId = null;
let timeFormat = '24h'; // '24h' | '12h' | 'mix'

// Timezones that conventionally use 12-hour format
const tz12h = new Set([
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Halifax',
  'America/St_Johns', 'America/Regina', 'America/Bogota',
  'Europe/London', 'Europe/Dublin',
  'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Karachi',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
  'Australia/Perth', 'Australia/Adelaide', 'Australia/Darwin',
  'Pacific/Auckland', 'Pacific/Fiji',
  'Asia/Manila', 'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai',
]);

// Callbacks
let onClocksChanged = null;
let onToast = null;
let onClockClicked = null;

export function init({ onClocksChange, toast, onClockClick }) {
  onClocksChanged = onClocksChange;
  onToast = toast;
  onClockClicked = onClockClick || null;
  clocks = loadClocks();
  timeFormat = localStorage.getItem('timeFormat') || 'mix';

  // Ensure local and Salesforce/MCE clocks always exist
  ensureDefaultClocks();

  renderClocks();
  requestAnimationFrame(tick);
}

function ensureDefaultClocks() {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!clocks.some(c => c.isLocal)) {
    clocks.unshift({ timezone: localTz, isLocal: true });
  }
  if (!clocks.some(c => c.timezone === 'Etc/GMT+6')) {
    clocks.push({ timezone: 'Etc/GMT+6', isLocal: false });
  }
  saveClocks(clocks);
}

export function getClocks() { return clocks; }
export function getOverrideTime() { return overrideTime; }
export function isOverrideActive() { return overrideTime !== null; }
export function getTimeFormat() { return timeFormat; }
export function getUse24h() { return timeFormat === '24h'; }
export function getUse24hForTz(tz) {
  if (timeFormat === '24h') return true;
  if (timeFormat === '12h') return false;
  // mix: use 12h for countries that conventionally use it
  return !tz12h.has(tz);
}


export function setTimeFormat(fmt) {
  timeFormat = fmt;
  localStorage.setItem('timeFormat', fmt);
  renderClocks();
}

export function addClock(timezone) {
  if (clocks.some(c => c.timezone === timezone)) return false;
  clocks.push({ timezone, isLocal: false });
  saveClocks(clocks);
  renderClocks();
  if (onClocksChanged) onClocksChanged();
  return true;
}

export function removeClock(index) {
  clocks.splice(index, 1);
  saveClocks(clocks);
  renderClocks();
  if (onClocksChanged) onClocksChanged();
}

export function rerender() {
  renderClocks();
}

export function setOverrideTime(time) {
  overrideTime = time;
  probeSource = null;
  renderClocks();
}

export function activateProbe(timezone, hour, minute, year, month, day) {
  let y, mo, d;

  if (year !== undefined && month !== undefined && day !== undefined) {
    y = year;
    mo = month;
    d = day;
  } else {
    // Use current date in the target timezone
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(now);
    const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);
    y = getPart('year');
    mo = getPart('month') - 1;
    d = getPart('day');
  }

  const tentative = new Date(Date.UTC(y, mo, d, hour, minute, 0));
  const offsetMs = getOffsetMinutes(timezone, tentative) * 60000;
  overrideTime = new Date(tentative.getTime() - offsetMs);
  probeSource = { timezone, hour, minute, year: y, month: mo, day: d };
  renderClocks();
}

export function resetToLive() {
  overrideTime = null;
  probeSource = null;
  renderClocks();
  requestAnimationFrame(tick);
}

function renderClocks() {
  const clockGrid = document.getElementById('clock-grid');
  const clockTemplate = document.getElementById('clock-template');
  if (!clockGrid || !clockTemplate) return;

  clockGrid.replaceChildren();
  const ref = overrideTime || new Date();
  clocks.sort((a, b) => getOffsetMinutes(a.timezone, ref) - getOffsetMinutes(b.timezone, ref));
  saveClocks(clocks);
  clockGrid.setAttribute('data-clock-count', clocks.length);

  clocks.forEach((clockData, index) => {
    const clone = clockTemplate.content.cloneNode(true);
    const card = clone.querySelector('.clock-card');
    const hourHand = clone.querySelector('.hour-hand');
    const minuteHand = clone.querySelector('.minute-hand');
    const secondHand = clone.querySelector('.second-hand');
    const dateDisplay = clone.querySelector('.date-display');
    const timezoneDisplay = clone.querySelector('.timezone-display');
    const removeBtn = clone.querySelector('.remove-btn');
    const homeIcon = clone.querySelector('.home-icon');
    const salesforceIcon = clone.querySelector('.salesforce-icon');
    const analogFace = clone.querySelector('.analog-face');
    const digitalReadout = clone.querySelector('.digital-readout');
    const deleteOverlay = clone.querySelector('.delete-overlay');
    const confirmBtn = clone.querySelector('.confirm-delete');
    const cancelBtn = clone.querySelector('.cancel-delete');

    card.dataset.timezone = clockData.timezone;
    card.dataset.index = index;

    // Controls
    const isSalesforce = clockData.timezone === 'Etc/GMT+6';
    if (clockData.isLocal) {
      homeIcon.style.display = 'block';
      salesforceIcon.style.display = 'none';
      removeBtn.style.display = 'none';
    } else if (isSalesforce) {
      homeIcon.style.display = 'none';
      salesforceIcon.style.display = 'block';
      removeBtn.style.display = 'none';
    } else {
      homeIcon.style.display = 'none';
      salesforceIcon.style.display = 'none';
      removeBtn.style.display = 'flex';

      removeBtn.addEventListener('click', () => {
        deleteOverlay.classList.remove('hidden');
      });

      cancelBtn.addEventListener('click', () => {
        deleteOverlay.classList.add('hidden');
      });

      confirmBtn.addEventListener('click', () => {
        removeClock(index);
      });
    }

    // Highlight the clock that matches the probe source timezone
    if (probeSource && clockData.timezone === probeSource.timezone) {
      card.classList.add('probe-active');
    }

    // Click on clock face or timezone label to switch picker timezone
    if (onClockClicked) {
      const clockContainer = clone.querySelector('.clock-container');
      if (clockContainer) {
        clockContainer.style.cursor = 'pointer';
        clockContainer.addEventListener('click', () => onClockClicked(clockData.timezone));
      }
      if (timezoneDisplay) {
        timezoneDisplay.style.cursor = 'pointer';
        timezoneDisplay.addEventListener('click', () => onClockClicked(clockData.timezone));
      }
    }

    updateSingleClock(
      clockData.timezone, hourHand, minuteHand, secondHand,
      dateDisplay, timezoneDisplay, analogFace, digitalReadout, ref
    );
    clockGrid.appendChild(clone);
  });
}

function updateSingleClock(timezone, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalReadout, referenceDate = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false, year: 'numeric', month: 'short', day: 'numeric'
    });

    const parts = formatter.formatToParts(referenceDate);
    const getPart = (type) => parts.find(p => p.type === type)?.value;

    const h = parseInt(getPart('hour'), 10);
    const m = parseInt(getPart('minute'), 10);
    const s = parseInt(getPart('second'), 10);
    const ms = referenceDate.getMilliseconds();

    const card = timezoneDisplay ? timezoneDisplay.closest('.clock-card') : null;
    if (card) {
      const isDay = h >= 6 && h < 18;
      card.classList.toggle('day', isDay);
      card.classList.toggle('night', !isDay);
    }

    const tzUse24h = getUse24hForTz(timezone);

    // Analog hands
    if (hourHand) {
      const sDeg = ((s + ms / 1000) / 60) * 360;
      const mDeg = ((m / 60) * 360) + ((s / 60) * 6);
      const hDeg = ((h / 12) * 360) + ((m / 60) * 30);

      if (secondHand) {
        secondHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
      }
      minuteHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
      hourHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;

      if (dateDisplay) {
        const monthStr = getPart('month').toUpperCase();
        const dayStr = getPart('day');
        dateDisplay.textContent = `${monthStr} ${dayStr}`;
      }
    }

    // Digital readout below clock face
    if (digitalReadout) {
      let displayH = h;
      let ampm = '';
      if (!tzUse24h) {
        ampm = h >= 12 ? ' PM' : ' AM';
        displayH = h % 12 || 12;
      }
      const hStr = tzUse24h ? displayH.toString().padStart(2, '0') : displayH.toString();
      const mStr = m.toString().padStart(2, '0');
      const sStr = s.toString().padStart(2, '0');
      const ampmHtml = ampm ? `<span class="digital-readout__ampm">${ampm}</span>` : '';
      digitalReadout.innerHTML = `${hStr}:${mStr}<span class="digital-readout__blink">:</span>${sStr}${ampmHtml}`;
    }

    // Timezone label
    const tzData = getTzByIana(timezone);
    const defaultName = tzData ? tzData.label : timezone.replace(/_/g, ' ').split('/').join(' / ');
    const customName = getCustomName(timezone);
    const displayName = customName || defaultName;
    const offset = getOffsetString(timezone, referenceDate);

    let season = 'WINTER';
    try {
      const jan = new Date(referenceDate.getFullYear(), 0, 15);
      const jul = new Date(referenceDate.getFullYear(), 6, 15);
      const janOff = getOffsetMinutes(timezone, jan);
      const julOff = getOffsetMinutes(timezone, jul);
      if (janOff === julOff) {
        season = 'No DST';
      } else {
        const long = referenceDate.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'long' });
        season = long.toLowerCase().includes('daylight') || long.toLowerCase().includes('summer') ? 'SUMMER' : 'WINTER';
      }
    } catch {
      // DST detection not supported for this timezone
    }

    if (timezoneDisplay) {
      const nameRow = document.createElement('div');
      nameRow.className = 'timezone-name-row';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'timezone-name-text';
      nameSpan.textContent = displayName;
      nameSpan.title = timezone;
      nameRow.appendChild(nameSpan);
      const tzShort = getTimezoneShortCode(timezone, referenceDate);
      if (tzShort && timezone !== 'Etc/GMT+6') {
        const shortBadge = document.createElement('span');
        shortBadge.className = 'timezone-short';
        shortBadge.textContent = tzShort;
        nameRow.appendChild(shortBadge);
      }
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'timezone-details';
      detailsDiv.textContent = `${offset} \u2022 ${season}`;
      timezoneDisplay.replaceChildren(nameRow, detailsDiv);

      // Double-click to rename
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'timezone-rename-input';
        input.value = customName || '';
        input.placeholder = defaultName;
        input.style.width = '100%';
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          const val = input.value.trim();
          saveCustomName(timezone, val || null);
          renderClocks();
          if (onClocksChanged) onClocksChanged();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') input.blur();
          if (ev.key === 'Escape') { input.value = ''; input.blur(); }
        });
      });
    }
  } catch (err) {
    console.error(`Clock update failed for ${timezone}:`, err);
  }
}

function tick() {
  const ref = overrideTime || new Date();
  const cards = document.querySelectorAll('.clock-card');
  cards.forEach(card => {
    const tz = card.dataset.timezone;
    const hourHand = card.querySelector('.hour-hand');
    const minuteHand = card.querySelector('.minute-hand');
    const secondHand = card.querySelector('.second-hand');
    const dateDisplay = card.querySelector('.date-display');
    const timezoneDisplay = card.querySelector('.timezone-display');
    const analogFace = card.querySelector('.analog-face');
    const digitalReadout = card.querySelector('.digital-readout');
    if (tz) updateSingleClock(tz, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalReadout, ref);
  });

  if (!overrideTime) {
    animFrameId = requestAnimationFrame(tick);
  }
}

