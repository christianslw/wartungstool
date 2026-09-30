/* Wartungstool · JS · Programmatische Aktionen
   ---------------------------------------------------------------------------
   Bewusst benannte Funktionen statt an jeder Stelle verstreuter
   "state.x = ...; render()". Damit lassen sich Gruppierung, Sortierung, Ansicht
   und Bereich auch aus der Konsole oder aus Tests heraus umschalten
   (siehe window.WT in 95-debug.js). */

/** Ansicht wechseln: 'list' | 'tiles' | 'blobs'. */
function setView(v) {
  if (state.view === v) return;
  state.view = v;
  render();
}

/** Gruppierung wechseln: 'object' | 'task' | 'status' | 'none'. */
function setGroup(g) {
  if (state.group === g) return;
  state.group = g;
  state.expanded = new Set();
  render();
}

/** Sortierung wählen: key 'status'|'due'|'object'|'name', optional Richtung. */
function setSort(key, dir) {
  if (key) state.sortKey = key;
  if (dir) state.sortDir = dir;
  render();
}

function toggleSortDir() {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  render();
}

/** Bereich wechseln: 'alle' | 'wartung' | 'todo'. */
function setBereich(b) {
  if (state.bereich === b) return;
  state.bereich = b;
  render();
}

/** Alle Gruppen auf- (true) oder zuklappen (false). */
function setAllExpanded(on) {
  state.expanded = on
    ? new Set(groupItems(aktuelleListe(), state.group).map(g => g.key))
    : new Set();
  render();
}

/** Kennzahlen der Liste eines Bereichs: { alle, over, soon, open, done, mine }. */
function aktuelleZahlen(scope = state.bereich) {
  return countsForScope(scope);
}

/** Gesamtfortschritt der Wartungen: eigene, sonst alle. */
function fortschritt() {
  const basis = state.items;
  const list = state.user ? basis.filter(i => norm(i.zustaendig) === norm(state.user)) : basis;
  const total = list.length;
  const done = list.filter(i => i.erledigt).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0, personal: !!state.user };
}
