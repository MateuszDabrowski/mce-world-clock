/* Persistence — localStorage wrappers with quota-safe writes */

const CLOCKS_KEY = 'clocks';
const CUSTOM_NAMES_KEY = 'customTzNames';
const BLOCKERS_KEY = 'clockforceBlockers';

/**
 * Safely write to localStorage, catching quota errors.
 * @param {string} key
 * @param {*} value — will be JSON-stringified
 * @returns {boolean} true on success
 */
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`localStorage write failed for key "${key}" (quota exceeded or storage unavailable)`);
    return false;
  }
}

/**
 * Safely read and parse JSON from localStorage.
 * @param {string} key
 * @param {*} fallback — returned on parse failure
 * @returns {*}
 */
function safeGetItem(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// --- Clocks ---

export function loadClocks() {
  let list = safeGetItem(CLOCKS_KEY, []);

  // Deduplicate by timezone
  const seen = new Map();
  for (const c of list) {
    if (c && typeof c.timezone === 'string' && !seen.has(c.timezone)) {
      seen.set(c.timezone, c);
    }
  }
  list = Array.from(seen.values());

  // Ensure local clock always present
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!list.some(c => c.isLocal)) {
    list.unshift({ timezone: localTz, isLocal: true });
  }

  // Default fallback
  if (list.length === 0) {
    list = [
      { timezone: localTz, isLocal: true },
      { timezone: 'Etc/GMT+6', isLocal: false }
    ];
  }

  saveClocks(list);
  return list;
}

export function saveClocks(list) {
  safeSetItem(CLOCKS_KEY, list);
}

// --- Custom timezone names ---

export function loadCustomNames() {
  return safeGetItem(CUSTOM_NAMES_KEY, {});
}

export function saveCustomName(tz, name) {
  const names = loadCustomNames();
  if (name) {
    names[tz] = name;
  } else {
    delete names[tz];
  }
  safeSetItem(CUSTOM_NAMES_KEY, names);
}

export function getCustomName(tz) {
  return loadCustomNames()[tz] || null;
}

// --- Time Blocks (saved timeframe ranges) ---

export function loadBlockers() {
  return safeGetItem(BLOCKERS_KEY, []);
}

export function saveBlockers(blockers) {
  safeSetItem(BLOCKERS_KEY, blockers);
}

export function addBlocker(blocker) {
  const blockers = loadBlockers();
  blockers.push(blocker);
  saveBlockers(blockers);
  return blockers;
}

export function removeBlocker(index) {
  const blockers = loadBlockers();
  blockers.splice(index, 1);
  saveBlockers(blockers);
  return blockers;
}
