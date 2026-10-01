/* Wartungstool · JS · Tabs (benannte Ansichten, clientseitig)
   ---------------------------------------------------------------------------
   Der Home-Tab (Landing) ist beim Aufruf der Seite aktiv. Dazu die drei
   Standard-Tabs (Alle · Wartungen · Eigene To-Dos) und beliebig viele eigene
   Tabs. Jeder Tab merkt sich seine Filter- und Ansichtseinstellungen; alles
   liegt in localStorage und bleibt ueber Sitzungen erhalten.

   Schliessen entfernt einen Tab. Ueber "Tab speichern" (Drei-Punkte-Menue)
   wandert er in eine kleine Ablage (max. 5) und laesst sich im "+"-Menue
   wieder oeffnen - so waechst nichts endlos an. */

const TABS_KEY = CONFIG.storageKey + '.tabs';
const MAX_SAVED_TABS = 5;

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

const tabSettings = (bereich, extra) =>
  Object.assign({}, TAB_DEFAULTS, { bereich, personen: [] }, extra || {});

function normalizeTab(t) {
  t.builtin = !!t.builtin;
  t.home = !!t.home;
  t.fav = !!t.fav;
  t.settings = Object.assign({}, TAB_DEFAULTS, t.settings || {});
  if (!Array.isArray(t.settings.personen)) t.settings.personen = [];
  return t;
}

function defaultTabs() {
  return {
    active: 'home',
    list: [
      normalizeTab({ id: 'home', name: 'Zuhause', home: true, settings: tabSettings('alle', { view: 'home', group: 'none' }) }),
      normalizeTab({ id: 'all', name: 'Alle', builtin: true, settings: tabSettings('alle') }),
      normalizeTab({ id: 'wartung', name: 'Wartungen', builtin: true, settings: tabSettings('wartung') }),
      normalizeTab({ id: 'todo', name: 'Eigene To-Dos', builtin: true, settings: tabSettings('todo') })
    ],
    saved: []
  };
}

function loadTabs() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(TABS_KEY) || 'null'); } catch (e) {}
  if (!p || !Array.isArray(p.list) || !p.list.length) return defaultTabs();

  // Migration: frueher als "geschlossen" markierte Tabs in die Ablage uebernehmen.
  const saved = (Array.isArray(p.saved) ? p.saved : []).slice();
  for (const t of p.list) {
    if (t && t.closed) saved.unshift({ name: t.name, fav: !!t.fav, home: !!t.home, settings: t.settings });
  }
  p.saved = dedupeSaved(saved).slice(0, MAX_SAVED_TABS);
  p.list = p.list.filter((t) => t && !t.closed).map(normalizeTab);

  if (!p.list.some((t) => t.home)) {
    p.list.unshift(normalizeTab({ id: 'home', name: 'Zuhause', home: true, settings: tabSettings('alle', { view: 'home', group: 'none' }) }));
  }
  for (const st of STANDARD_TABS) {
    if (!p.list.some((t) => t.id === st.id)) {
      p.list.push(normalizeTab({ id: st.id, name: st.name, builtin: true, settings: tabSettings(st.bereich) }));
    }
  }
  if (!p.active || !p.list.some((t) => t.id === p.active)) p.active = p.list[0].id;
  return p;
}

function dedupeSaved(arr) {
  const out = [];
  for (const s of arr) {
    if (!s || !s.name) continue;
    if (!out.some((x) => x.name === s.name)) out.push(s);
  }
  return out;
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

/** Home-Tab anlegen bzw. aktivieren (Landing). */
function addHomeTab() {
  let t = TABS.list.find((x) => x.home);
  if (!t) {
    t = normalizeTab({ id: 'home', name: 'Zuhause', home: true, settings: tabSettings('alle', { view: 'home', group: 'none' }) });
    TABS.list.unshift(t);
  }
  applyTabState(t);
  saveTabs();
  return t;
}
const homeOpen = () => TABS.list.some((t) => t.home);

/** Neuen, eigenen Tab anlegen: uebernimmt die aktuellen Einstellungen; ein als
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
  TABS.list.push(normalizeTab({ id, name: clean, settings }));
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

/** Intern: Tab entfernen; aktiven Tab weiterziehen, nie ganz leer lassen. */
function removeTab(id) {
  TABS.list = TABS.list.filter((x) => x.id !== id);
  if (TABS.active === id) {
    const next = TABS.list[0];
    if (next) applyTabState(next);
  }
  if (!TABS.list.length) addHomeTab();
  saveTabs();
}

/** Tab schliessen (nur eigene/Home; Standard-Ansichten bleiben). */
function closeTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t || t.builtin) return;
  removeTab(id);
  render();
}

/** Tab speichern: legt eine wieder-oeffenbare Ablage an (max. 5), dann zu. */
function saveTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t || t.builtin) return;
  const rec = { name: t.name, fav: !!t.fav, home: !!t.home, settings: Object.assign({}, t.settings) };
  TABS.saved = [rec].concat((TABS.saved || []).filter((s) => s.name !== rec.name)).slice(0, MAX_SAVED_TABS);
  removeTab(id);
  render();
}

/** Gespeicherten Tab wieder oeffnen (aus der Ablage entfernen). */
function reopenSaved(name) {
  const i = (TABS.saved || []).findIndex((s) => s.name === name);
  if (i < 0) return;
  const s = TABS.saved[i];
  TABS.saved.splice(i, 1);
  let id = 't' + Date.now().toString(36) + i;
  while (TABS.list.some((t) => t.id === id)) id += 'x';
  const t = normalizeTab({ id, name: s.name, home: !!s.home, fav: !!s.fav, settings: Object.assign({}, s.settings) });
  TABS.list.push(t);
  applyTabState(t);
  saveTabs();
  render();
  return id;
}

function toggleFavTab(id) {
  const t = TABS.list.find((x) => x.id === id);
  if (!t) return;
  t.fav = !t.fav;
  saveTabs();
  render();
}

/** Tabs in Anzeige-Reihenfolge: Favoriten zuerst. */
function orderedTabs() {
  return TABS.list.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
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
