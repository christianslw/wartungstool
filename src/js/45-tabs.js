/* Wartungstool · JS · Tabs (benannte Ansichten, clientseitig)
   ---------------------------------------------------------------------------
   Der Home-Tab (Landing) ist Vorgabe-Standard und beim Aufruf aktiv. Dazu die
   Standard-Tabs (Zuhause · Alle · Wartungen · Eigene To-Dos) und beliebig viele
   eigene Tabs. Jeder Tab merkt sich seine Filter- und Ansichtseinstellungen;
   alles liegt in localStorage und bleibt ueber Sitzungen erhalten.

   Tabs sind frei verschiebbar (der Standard-Tab bleibt ganz links) und - mit
   Ausnahme des Standard-Tabs - alle schliessbar. Die vier Standard-Tabs sind
   immer im "+"-Menue unter "Standard Tabs" aufrufbar; eigene Tabs lassen sich
   per "Tab speichern" in eine Ablage (max. 5) legen, die letzten geschlossenen
   stehen unter "Zuletzt geschlossen". */

const TABS_KEY = CONFIG.storageKey + '.tabs';
const MAX_SAVED_TABS = 5;
const MAX_RECENT_TABS = 5;

/* Felder, die ein Tab als Einstellungen speichert. */
const TAB_SETTING_KEYS = [
  'bereich', 'status', 'query', 'art', 'objekt', 'taetigkeit', 'personen', 'mine',
  'zeitraumJahr', 'von', 'bis', 'group', 'view', 'sortKey', 'sortDir'
];

const HOME_TAB = { id: 'home', name: 'Zuhause', home: true, icon: 'home' };
const STANDARD_TABS = [
  { id: 'all', name: 'Alle', bereich: 'alle', icon: 'list' },
  { id: 'wartung', name: 'Wartungen', bereich: 'wartung', icon: 'bolt' },
  { id: 'todo', name: 'Eigene To-Dos', bereich: 'todo', icon: 'check' }
];

const TAB_DEFAULTS = {
  status: 'alle', query: '', art: '', objekt: '', taetigkeit: '', personen: [], mine: false,
  zeitraumJahr: '', von: '', bis: '', group: 'object', view: 'list', sortKey: 'status', sortDir: 'asc'
};

const tabSettings = (bereich, extra) =>
  Object.assign({}, TAB_DEFAULTS, { bereich, personen: [] }, extra || {});

const standardTabDef = (id) => (id === 'home' ? HOME_TAB : STANDARD_TABS.find((t) => t.id === id));

function normalizeTab(t) {
  t.builtin = !!t.builtin;
  t.home = !!t.home;
  t.fav = !!t.fav;
  t.color = t.color || '';
  if (!t.icon || !TAB_ICONS[t.icon]) {
    t.icon = t.home ? 'home'
      : t.id === 'all' ? 'list'
        : t.id === 'wartung' ? 'bolt'
          : t.id === 'todo' ? 'check' : 'list';
  }
  t.settings = Object.assign({}, TAB_DEFAULTS, t.settings || {});
  if (!Array.isArray(t.settings.personen)) t.settings.personen = [];
  return t;
}

const tabRecord = (t) => ({ name: t.name, fav: !!t.fav, home: !!t.home, color: t.color || '', icon: t.icon || '', settings: Object.assign({}, t.settings) });

/** Standard-Tab (Zuhause/Alle/…) neu anlegen. */
function makeStandardTab(def) {
  return normalizeTab({
    id: def.id, name: def.name, home: !!def.home, builtin: true, icon: def.icon,
    settings: tabSettings(def.bereich || 'alle', def.home ? { view: 'home', group: 'none' } : null)
  });
}

function defaultTabs() {
  return {
    active: 'home', def: 'home',
    list: [makeStandardTab(HOME_TAB)].concat(STANDARD_TABS.map(makeStandardTab)),
    saved: [], recent: []
  };
}

function dedupeList(arr, max) {
  const out = [];
  for (const s of arr || []) {
    if (!s || !s.name) continue;
    if (!out.some((x) => x.name === s.name)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function loadTabs() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(TABS_KEY) || 'null'); } catch (e) {}
  if (!p || !Array.isArray(p.list) || !p.list.length) return defaultTabs();

  const recent = (Array.isArray(p.recent) ? p.recent : []).slice();
  // Migration: frueher geschlossene Tabs in "Zuletzt geschlossen" uebernehmen.
  for (const t of p.list) if (t && t.closed) recent.unshift(tabRecord(t));
  p.list = p.list.filter((t) => t && !t.closed).map(normalizeTab);
  p.saved = dedupeList(p.saved, MAX_SAVED_TABS);
  p.recent = dedupeList(recent, MAX_RECENT_TABS);

  if (!p.list.length) p.list.push(makeStandardTab(HOME_TAB));
  if (!p.def || !standardTabDef(p.def)) p.def = p.list.some((t) => t.home) ? 'home' : p.list[0].id;
  if (!p.active || !p.list.some((t) => t.id === p.active)) p.active = p.list[0].id;
  return p;
}

let TABS = loadTabs();

function saveTabs() {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(TABS)); } catch (e) {}
}

function activeTab() {
  return TABS.list.find((t) => t.id === TABS.active) || TABS.list[0];
}
const homeOpen = () => TABS.list.some((t) => t.home);

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

/** Standard-Tab oeffnen (anlegen, falls geschlossen) und aktivieren. */
function openStandard(id) {
  const def = standardTabDef(id);
  if (!def) return;
  let t = TABS.list.find((x) => x.id === id);
  if (!t) { t = makeStandardTab(def); TABS.list.push(t); }
  applyTabState(t);
  saveTabs();
  render();
  return id;
}
/** Home-Tab oeffnen/aktivieren (Komfort-Alias). */
function addHomeTab() { return openStandard('home'); }

/** Intern: Tab entfernen; aktiven Tab weiterziehen, nie ganz leer lassen. */
function removeTabInternal(id) {
  TABS.list = TABS.list.filter((x) => x.id !== id);
  if (TABS.active === id) {
    const next = TABS.list[0];
    if (next) applyTabState(next);
  }
  if (!TABS.list.length) openStandard('home');
  else saveTabs();
}

/** Tab schliessen (alle schliessbar; Standard-Tabs bleiben im "+"-Menue). */
function closeTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  if (!standardTabDef(id)) {
    const rec = tabRecord(t);
    TABS.recent = [rec].concat((TABS.recent || []).filter((s) => s.name !== rec.name)).slice(0, MAX_RECENT_TABS);
  }
  removeTabInternal(id);
  render();
}

/** Tab speichern: in die Ablage (max. 5) legen, dann entfernen. */
function saveTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  const rec = tabRecord(t);
  TABS.saved = [rec].concat((TABS.saved || []).filter((s) => s.name !== rec.name)).slice(0, MAX_SAVED_TABS);
  removeTabInternal(id);
  render();
}

/** Neuen, eigenen Tab anlegen: uebernimmt die aktuellen Einstellungen; ein als
    Standard markiertes Preset gibt Gruppe/Sortierung/Ansicht vor. */
function addTab(name) {
  syncActiveTab();
  const clean = String(name || '').trim() || 'Neue Ansicht';
  const id = newTabId(clean);
  const settings = tabSnapshot();
  const ps = loadPresets();
  const def = (ps.list || []).find((p) => p.name === ps.def);
  if (def) {
    settings.group = def.group || settings.group;
    settings.view = def.view || settings.view;
    settings.sortKey = def.sortKey || settings.sortKey;
    settings.sortDir = def.sortDir || settings.sortDir;
  }
  TABS.list.push(normalizeTab({ id, name: clean, settings }));
  TABS.active = id;
  saveTabs();
  render();
  return id;
}

function newTabId(_name) {
  let id = 't' + Date.now().toString(36);
  while (TABS.list.some((t) => t.id === id)) id += 'x';
  return id;
}

/** Einen gespeicherten (oder zuletzt geschlossenen) Tab wieder oeffnen. */
function openRecord(rec) {
  if (!rec) return;
  const id = newTabId(rec.name);
  const t = normalizeTab({ id, name: rec.name, home: !!rec.home, fav: !!rec.fav, color: rec.color || '', icon: rec.icon || '', settings: Object.assign({}, rec.settings) });
  TABS.list.push(t);
  applyTabState(t);
  saveTabs();
  render();
  return id;
}
function reopenSaved(name) {
  const i = (TABS.saved || []).findIndex((s) => s.name === name);
  if (i < 0) return;
  const rec = TABS.saved[i];
  TABS.saved.splice(i, 1);
  saveTabs();
  return openRecord(rec);
}
function reopenRecent(name) {
  const i = (TABS.recent || []).findIndex((s) => s.name === name);
  if (i < 0) return;
  const rec = TABS.recent[i];
  TABS.recent.splice(i, 1);
  saveTabs();
  return openRecord(rec);
}

function renameTab(id, name) {
  const t = TABS.list.find((x) => x.id === id);
  const clean = String(name || '').trim();
  if (!t || !clean) return;
  t.name = clean;
  saveTabs();
  render();
}

/** Tabs frei verschieben; der Standard-Tab bleibt ganz links. */
function moveTab(dragId, targetId, after) {
  if (!dragId || !targetId || dragId === targetId) return;
  if (dragId === TABS.def) return;
  const arr = TABS.list.slice();
  const from = arr.findIndex((t) => t.id === dragId);
  if (from < 0) return;
  if (targetId === TABS.def) after = false;
  const [item] = arr.splice(from, 1);
  const to = arr.findIndex((t) => t.id === targetId);
  if (to < 0) { arr.splice(from, 0, item); return; }
  arr.splice(after ? to + 1 : to, 0, item);
  const di = arr.findIndex((t) => t.id === TABS.def);
  if (di > 0) { const [d] = arr.splice(di, 1); arr.unshift(d); }
  TABS.list = arr;
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

/** Akzentfarbe eines Tabs setzen ('' = Standard/Blau). */
function setTabColor(id, color) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  t.color = color || '';
  saveTabs();
  render();
}

/** Symbol eines Tabs setzen (Schluessel aus TAB_ICONS). */
function setTabIcon(id, icon) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t || !TAB_ICONS[icon]) return;
  t.icon = icon;
  saveTabs();
  render();
}

/** Tab als Standard festlegen (nur einer; erneutes Setzen hebt auf). */
function setDefaultTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  TABS.def = TABS.def === id ? '' : id;
  saveTabs();
  render();
}

/** Sichtbare Tabs: Standard-Tab ganz links, sonst freie Reihenfolge. */
function orderedTabs() {
  const def = TABS.def;
  return TABS.list.slice().sort((a, b) => (a.id === def ? -1 : 0) - (b.id === def ? -1 : 0));
}

/** Anzahl Positionen in einem Tab (Home zeigt die offenen Wartungen). */
function tabCount(t) {
  if (t.home) { const f = fortschritt(); return f.total - f.done; }
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
