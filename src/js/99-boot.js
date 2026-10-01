/* Wartungstool · JS · Start */
async function init() {
  applyTheme();
  try { state.user = localStorage.getItem(CONFIG.userKey) || ''; } catch {}
  // Beim Aufruf der Seite ist der Home-Tab aktiv (falls nicht geschlossen).
  const homeTab = TABS.list.find(t => t.home && !t.closed);
  if (homeTab) TABS.active = homeTab.id;
  applyTabState(activeTab());
  store = CONFIG.dataSource === 'api' ? ApiStore : LocalStore;
  state.loading = true; render();

  try {
    const { items } = await store.load();
    state.items = items;
    state.online = true;
    try { state.todos = await store.loadTodos(); } catch (e2) { state.todos = []; }
  } catch (e) {
    store = LocalStore;
    const { items } = await LocalStore.load();
    state.items = items;
    state.todos = await LocalStore.loadTodos();
    state.online = false;
  }
  state.loading = false;
  render();
}

init();
