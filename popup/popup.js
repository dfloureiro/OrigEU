import { getSettings, setSettings } from '../lib/settings.js';

const KINDS = ['eu'];

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
  });
}

async function init() {
  applyI18n();
  document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;
  const settings = await getSettings();
  for (const kind of KINDS) {
    const el = document.getElementById(kind);
    el.checked = settings[kind] !== false;
    el.addEventListener('change', () => {
      setSettings({ [kind]: el.checked });
    });
  }

  // Not in KINDS: unlike "eu" (default true, hidden only when explicitly
  // false), this defaults to false and hides only when explicitly true —
  // opposite polarity, so it needs its own checked/change wiring.
  const hideUnknownEl = document.getElementById('hideUnknown');
  hideUnknownEl.checked = settings.hideUnknown === true;
  hideUnknownEl.addEventListener('change', () => {
    setSettings({ hideUnknown: hideUnknownEl.checked });
  });

  // Same opposite-polarity pattern as hideUnknown above: defaults to false,
  // checked only when explicitly true.
  const unBrexitEl = document.getElementById('unBrexit');
  unBrexitEl.checked = settings.unBrexit === true;
  unBrexitEl.addEventListener('change', () => {
    setSettings({ unBrexit: unBrexitEl.checked });
  });

  const detailSelect = document.getElementById('detail');
  detailSelect.value = ['short', 'medium'].includes(settings.detail) ? settings.detail : 'long';
  detailSelect.addEventListener('change', () => {
    setSettings({ detail: detailSelect.value });
  });

  const clearBtn = document.getElementById('clearCache');
  const hint = document.getElementById('clearCacheHint');
  const hintDefault = hint.textContent;
  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;
    clearBtn.textContent = chrome.i18n.getMessage('popupClearingCache');
    try {
      await chrome.runtime.sendMessage({ type: 'ORIGEU_CLEAR_CACHE' });
      hint.textContent = chrome.i18n.getMessage('popupCacheCleared');
    } finally {
      clearBtn.disabled = false;
      clearBtn.textContent = chrome.i18n.getMessage('popupClearCache');
      setTimeout(() => { hint.textContent = hintDefault; }, 4000);
    }
  });
}

init();
