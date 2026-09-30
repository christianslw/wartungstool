/* Wartungstool · JS · Einstellungen & Design */
const settings = Object.assign(
  { theme: CONFIG.theme, dispoMail: CONFIG.dispoMail, user: '' },
  (() => { try { return JSON.parse(localStorage.getItem(CONFIG.setKey) || '{}'); } catch { return {}; } })()
);
function saveSettings() {
  try { localStorage.setItem(CONFIG.setKey, JSON.stringify(settings)); } catch {}
}

function applyTheme() {
  const t = settings.theme === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme;
  document.documentElement.dataset.theme = t;
}
