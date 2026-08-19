export const SETTINGS_KEY = 'origeu_settings';
// detail: 'long' shows spelled-out badge text (e.g. "OrigEU ❤️ Portugal 🇵🇹"),
// 'short' shows just the flag/icon, as the badge originally looked.
export const DEFAULT_SETTINGS = { eu: true, detail: 'long' };

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
}

export async function setSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
