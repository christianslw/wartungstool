/* Wartungstool · JS · Favoriten (angeheftete Standorte)
   ---------------------------------------------------------------------------
   Reine Anzeigepräferenz: Standorte lassen sich in der Liste anpinnen; sie
   erscheinen dann oben auf Zuhause. Gespeichert wird nur der Ortsschlüssel
   (groupKey) in localStorage – keine Stammdaten. */

const FAV_KEY = CONFIG.storageKey + '.favorites';

function loadFavorites() {
  try {
    const a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(a) ? a.filter(x => typeof x === 'string') : [];
  } catch (e) { return []; }
}

function saveFavorites() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); } catch (e) {}
}

function istFavorit(key) { return state.favorites.indexOf(key) >= 0; }

function toggleFavorit(key) {
  if (!key) return;
  const i = state.favorites.indexOf(key);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(key);
  saveFavorites();
  render();
}

/** Favorisierte Standorte als Gruppen (offene zuerst). */
function favoritGruppen(srcList = state.items) {
  return sortGroups(groupItems(srcList, 'object')).filter(g => istFavorit(g.key));
}

/** Standort aus Zuhause heraus in der Liste öffnen (nur dieser Standort). */
function openFavorit(key) {
  if ((activeTab() || {}).home) openStandard('all');
  state.bereich = 'wartung';
  state.group = 'object';
  state.view = 'list';
  state.expanded = new Set([key]);
  state.query = '';
  state.objekt = (state.items.find(i => groupKey(i) === key) || {}).objekt_name || '';
  render();
}
