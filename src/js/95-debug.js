/* Wartungstool · JS · Oeffentliche/debug-API (window.WT)
   ---------------------------------------------------------------------------
   Alles, was in der Browser-Konsole nuetzlich ist, an EINER Stelle - statt
   verstreuter Namen im Globalen Namensraum. In der Konsole:

       WT.state.items.length
       WT.view.setView('tiles')
       WT.select.aktuelleZahlen('alle')
       WT.tabs.all().list
       WT.store                 // aktueller Store (Local/Api)
       WT.resetCache()          // localStorage-Bestand verwerfen + neu laden

   Die Struktur spiegelt die Ordner unter src/js/ und ist damit auch die
   Anlaufstelle, wenn spaeter ein bestehendes SQL-Backend angebunden wird:
   alles Datenzugriffsrelevante liegt unter WT.data / WT.stores. */
window.WT = {
  /* Zustand & Konfiguration */
  CONFIG,
  state,
  settings,
  get store() { return store; },

  /* Datenmodell / Export-Mapping (src/js/30-model.js, 31-data-source.js) */
  data: {
    normalize, fromExport, asRecords, isoToDe, intervallText,
    seedData, hasDataFile, dataSignature
  },

  /* Fachliche Auswertung (src/js/20-util.js, 42-selectors.js) */
  model: { statusOf, dueInfo, matchesQuery, keyOf },
  select: { filtered, aktuelleListe, groupItems, sortItems, sortGroups, groupStats, countsForScope, aktuelleZahlen, fortschritt, suchVorschlag },

  /* Darstellung & programmatische Aktionen (src/js/50-render.js, 43-actions.js) */
  view: { render, setView, setGroup, setSort, toggleSortDir, setBereich, setAllExpanded, viewGroupedList, viewTiles, viewBlobs, viewTimeline },

  /* Presets (src/js/44-presets.js) */
  presets: { loadPresets, applyPreset, saveCurrentPreset, deletePreset, setDefaultPreset, applyDefaultPreset },

  /* Tabs (src/js/45-tabs.js) – benannte, gespeicherte Ansichten */
  tabs: {
    all: () => TABS, activeTab, applyTab, openStandard, addTab, renameTab, closeTab, saveTab,
    reopenSaved, reopenRecent, moveTab, addHomeTab, homeOpen, toggleFavTab, setTabColor, setTabIcon,
    setDefaultTab, orderedTabs, tabCount
  },

  /* Stores (src/js/32-store-local.js, 33-store-api.js) – Schnittstelle fuer ein
     bestehendes SQL-Backend: gleiche Methoden wie LocalStore implementieren. */
  stores: { LocalStore, ApiStore },

  /* Eigenen Bestand verwerfen und aus der Quelle neu laden. */
  resetCache() {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.indexOf('wartungstool') === 0) localStorage.removeItem(k);
      }
    } catch (e) {}
    if (typeof init === 'function') return init();
  },

  /* Kurzueberblick fuer die Konsole. */
  dump() {
    return {
      quelle: store === ApiStore ? 'SQL-Backend' : (hasDataFile() ? 'daten.js' : 'Testbestand'),
      online: state.online,
      bereich: state.bereich, tab: (activeTab() || {}).name, ansicht: state.view, status: state.status,
      gruppe: state.group, sortierung: state.sortKey + ' ' + state.sortDir,
      zeitraum: [state.zeitraumJahr, state.von, state.bis].filter(Boolean).join(' '),
      positionen: state.items.length, todos: state.todos.length,
      zahlen: countsForScope(state.bereich)
    };
  }
};
