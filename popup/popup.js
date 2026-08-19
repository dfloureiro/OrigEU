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

  const detailSelect = document.getElementById('detail');
  detailSelect.value = settings.detail === 'short' ? 'short' : 'long';
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
