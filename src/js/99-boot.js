/* Wartungstool · JS · Start */
async function init() {
  applyTheme();
  try { state.user = localStorage.getItem(CONFIG.userKey) || ''; } catch {}
  state.favorites = loadFavorites();
  // Beim Aufruf der Seite ist der als Standard festgelegte Tab aktiv
  // (Vorgabe: Zuhause); ein geschlossener Standard-Tab wird dabei geoeffnet.
  if (TABS.def && !TABS.list.some(t => t.id === TABS.def)) {
    const def = standardTabDef(TABS.def);
    if (def) TABS.list.push(makeStandardTab(def));
  }
  const defTab = TABS.list.find(t => t.id === TABS.def) || TABS.list.find(t => t.home) || TABS.list[0];
  if (defTab) TABS.active = defTab.id;
  applyTabState(activeTab());
  store = CONFIG.dataSource === 'api' ? ApiStore : LocalStore;
  state.loading = true; render();

  try {
    const { items } = await store.load();
    state.items = items;
    state.online = true;
    try { state.todos = await store.loadTodos(); } catch (e2) { state.todos = []; }
    try { state.abschaltungen = await store.loadAbschaltungen(); } catch (e3) { state.abschaltungen = []; }
  } catch (e) {
    store = LocalStore;
    const { items } = await LocalStore.load();
    state.items = items;
    state.todos = await LocalStore.loadTodos();
    try { state.abschaltungen = await LocalStore.loadAbschaltungen(); } catch (e3) { state.abschaltungen = []; }
    state.online = false;
  }
  state.loading = false;
  render();
  abschaltungNotifs();
}

init();
