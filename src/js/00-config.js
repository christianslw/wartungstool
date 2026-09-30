/* Wartungstool · JS · Konfiguration & URL-Optionen */
const CONFIG = {
  storageKey : 'wartungstool.v1',
  userKey    : 'wartungstool.v1.user',
  setKey     : 'wartungstool.v1.settings',
  dataSource : 'local',
  apiBase    : '/api',
  currentUser: '',
  soonDays   : 30,
  theme      : 'light',
  dispoMail  : 'dispo.sendertechnik@swr.de'
};

(function readUrlConfig() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('api'))        { CONFIG.dataSource = 'api'; CONFIG.apiBase = p.get('api') || '/api'; }
    else if (p.has('local')) { CONFIG.dataSource = 'local'; }
    if (p.get('user')) CONFIG.currentUser = p.get('user');
  } catch {}
})();
