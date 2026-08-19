export const SETTINGS_KEY = 'origeu_settings';
// detail: 'long' shows spelled-out badge text (e.g. "OrigEU ❤️ Portugal 🇵🇹"),
// 'short' shows just the flag/icon, as the badge originally looked.
// hideUnknown: off by default — badges for brands not yet in the database
// show a "❓ Unknown" badge same as any other status, since that's also
// what invites someone to click it and suggest the brand. Turning this on
// hides just that one status, independent of the main `eu` on/off toggle.
export const DEFAULT_SETTINGS = { eu: true, detail: 'long', hideUnknown: false };

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
