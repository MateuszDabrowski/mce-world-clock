/* Left sidebar — Code snippets panel */

import * as mce from './mce.js';
import * as clocks from './clocks.js';
import { getOffsetString } from './timezones.js';
import { highlightSQL, highlightAMPScript, highlightSSJS } from './syntax.js';

let currentScripts = null;
let currentIsLocal = false;
let currentIana = null;

export function init() {
  // Copy buttons
  document.querySelectorAll('.md-script-section__copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const text = document.getElementById(targetId)?.textContent;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.classList.add('md-script-section__copy--copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('md-script-section__copy--copied');
        }, 2000);
      });
    });
  });

  // Close button
  const closeBtn = document.getElementById('btn-close-scripts');
  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  // Dynamic script button (local → dynamic)
  const dynamicBtn = document.getElementById('generate-dynamic-script');
  if (dynamicBtn) {
    dynamicBtn.addEventListener('click', () => {
      if (currentScripts) {
        const activeClocks = clocks.getClocks();
        const clockData = activeClocks.find(c => c.isLocal);
        if (clockData) {
          showForTimezone(clockData.timezone, false);
        }
      }
    });
  }

  // Add DST button (no-DST → DST-aware)
  const addDstBtn = document.getElementById('add-dst-to-scripts');
  if (addDstBtn) {
    addDstBtn.addEventListener('click', () => {
      if (currentIana) {
        showForTimezone(currentIana, currentIsLocal, true);
      }
    });
  }
}

export function showForTimezone(iana, isLocal, forceDST = false) {
  const scripts = mce.generateScriptsForTimezone(iana, isLocal, forceDST);
  currentScripts = scripts;
  currentIsLocal = isLocal;
  currentIana = iana;

  document.getElementById('sql-text').innerHTML = highlightSQL(scripts.sql);
  document.getElementById('ampscript-text').innerHTML = highlightAMPScript(scripts.ampscript);
  document.getElementById('ssjs-text').innerHTML = highlightSSJS(scripts.ssjs);

  // Local notice
  const localNotice = document.getElementById('local-tz-notice');
  if (localNotice) {
    localNotice.classList.toggle('hidden', !isLocal);
  }

  // No-DST notice — show when timezone has no DST and not forcing DST
  const noDstNotice = document.getElementById('no-dst-notice');
  if (noDstNotice) {
    noDstNotice.classList.toggle('hidden', scripts.hasDST || isLocal || forceDST || iana === 'UTC');
  }

  show();
}

export function show() {
  const panel = document.getElementById('scripts-panel');
  if (panel) panel.classList.add('md-scripts--visible');
}

export function hide() {
  const panel = document.getElementById('scripts-panel');
  if (panel) panel.classList.remove('md-scripts--visible');
}

export function isVisible() {
  const panel = document.getElementById('scripts-panel');
  return panel && panel.classList.contains('md-scripts--visible');
}

export function toggle() {
  if (isVisible()) hide();
  else show();
}
