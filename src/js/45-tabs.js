/* Wartungstool · JS · Tabs (benannte Ansichten, clientseitig)
   ---------------------------------------------------------------------------
   Die drei Standard-Tabs (Alle · Wartungen · Eigene To-Dos) plus beliebig
   viele eigene Tabs. Jeder Tab merkt sich seine Filter- und Ansichts-
   einstellungen; alles liegt in localStorage und bleibt ueber Sitzungen
   erhalten. Tabs lassen sich als Favorit anpinnen (vorne) und - sofern nicht
   Standard - schliessen. */

const TABS_KEY = CONFIG.storageKey + '.tabs';

/* Felder, die ein Tab als Einstellungen speichert. */
const TAB_SETTING_KEYS = [
  'bereich', 'status', 'query', 'art', 'objekt', 'taetigkeit', 'personen', 'mine',
  'zeitraumJahr', 'von', 'bis', 'group', 'view', 'sortKey', 'sortDir'
];

const STANDARD_TABS = [
  { id: 'all', name: 'Alle', bereich: 'alle' },
  { id: 'wartung', name: 'Wartungen', bereich: 'wartung' },
  { id: 'todo', name: 'Eigene To-Dos', bereich: 'todo' }
];

const TAB_DEFAULTS = {
  status: 'alle', query: '', art: '', objekt: '', taetigkeit: '', personen: [], mine: false,
  zeitraumJahr: '', von: '', bis: '', group: 'object', view: 'list', sortKey: 'status', sortDir: 'asc'
};

function defaultTabs() {
  return {
    active: 'all',
    list: STANDARD_TABS.map((t) => ({
      id: t.id, name: t.name, builtin: true, fav: false,
      settings: Object.assign({}, TAB_DEFAULTS, { bereich: t.bereich, personen: [] })
    }))
  };
}

function loadTabs() {
  try {
    const p = JSON.parse(localStorage.getItem(TABS_KEY) || 'null');
    if (p && Array.isArray(p.list) && p.list.length && p.active) return p;
  } catch (e) {}
  return defaultTabs();
}

let TABS = loadTabs();

function saveTabs() {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(TABS)); } catch (e) {}
}

function activeTab() {
  return TABS.list.find((t) => t.id === TABS.active) || TABS.list[0];
}

/** Aktuellen Zustand in den aktiven Tab schreiben (bei jedem Rendern). */
function syncActiveTab() {
  const t = activeTab();
  if (!t) return;
  t.settings = tabSnapshot();
  saveTabs();
}

/** Momentane Filter-/Ansichtseinstellungen als flaches Objekt. */
function tabSnapshot(src = state) {
  const s = {};
  for (const k of TAB_SETTING_KEYS) s[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
  return s;
}

/** Zustand aus einem Tab uebernehmen (ohne rendern). */
function applyTabState(t) {
  if (!t) return;
  const s = Object.assign({}, TAB_DEFAULTS, t.settings);
  for (const k of TAB_SETTING_KEYS) state[k] = Array.isArray(s[k]) ? s[k].slice() : s[k];
  state.expanded = new Set();
  state.collapsed = new Set();
  TABS.active = t.id;
  saveTabs();
}

function applyTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  applyTabState(t);
  render();
}

/** Neuen Tab anlegen: uebernimmt die aktuellen Einstellungen; ein als
    Standard markiertes Preset gibt Gruppe/Sortierung/Ansicht vor. */
function addTab(name) {
  syncActiveTab();
  const clean = String(name || '').trim() || 'Neue Ansicht';
  let id = 't' + Date.now().toString(36);
  while (TABS.list.some((t) => t.id === id)) id += 'x';
  const settings = tabSnapshot();
  const ps = loadPresets();
  const def = (ps.list || []).find((p) => p.name === ps.def);
  if (def) {
    settings.group = def.group || settings.group;
    settings.view = def.view || settings.view;
    settings.sortKey = def.sortKey || settings.sortKey;
    settings.sortDir = def.sortDir || settings.sortDir;
  }
  TABS.list.push({ id, name: clean, builtin: false, fav: false, settings });
  TABS.active = id;
  saveTabs();
  render();
  return id;
}

function renameTab(id, name) {
  const t = TABS.list.find((x) => x.id === id);
  const clean = String(name || '').trim();
  if (!t || !clean) return;
  t.name = clean;
  saveTabs();
  render();
}

function closeTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t || t.builtin) return;
  TABS.list = TABS.list.filter((x) => x.id !== id);
  if (TABS.active === id) {
    const next = TABS.list[0];
    if (next) applyTabState(next);
  }
  saveTabs();
  render();
}

function toggleFavTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  t.fav = !t.fav;
  saveTabs();
  render();
}

/** Tabs in Anzeige-Reihenfolge: Favoriten zuerst (stabile Sortierung). */
function orderedTabs() {
  return TABS.list.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
}

/** Anzahl Positionen in einem Tab (mit dessen Einstellungen). */
function tabCount(t) {
  return filtered(bereichListe(t.settings.bereich), t.settings).length;
}

/** Verfuegbare Jahre fuer den Zeitraumfilter (aus den Fristen). */
function tabYears() {
  const years = new Set();
  for (const it of state.items.concat(state.todos)) {
    const d = parseDate(it.bis);
    if (d) years.add(d.getFullYear());
  }
  return Array.from(years).sort((a, b) => a - b);
}
