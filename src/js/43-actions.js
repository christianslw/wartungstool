/* Wartungstool · JS · Programmatische Aktionen
   ---------------------------------------------------------------------------
   Bewusst benannte Funktionen statt an jeder Stelle verstreuter
   "state.x = ...; render()". Damit lassen sich Ansicht/Bereich auch aus der
   Konsole oder aus Tests heraus umschalten (siehe window.WT in 95-debug.js). */

/** Ansicht wechseln: 'objects' | 'plan' | 'table'. */
function setView(v) {
  if (state.view === v) return;
  state.view = v;
  render();
}

/** Bereich wechseln: 'alle' | 'wartung' | 'todo'. */
function setBereich(b) {
  if (state.bereich === b) return;
  state.bereich = b;
  render();
}

/** Alle Standort-/Statusgruppen auf- (true) oder zuklappen (false). */
function setAllExpanded(on) {
  state.expanded = on
    ? new Set(filteredGroups(aktuelleListe()).map(([k]) => k))
    : new Set();
  render();
}

/** Kennzahlen der Liste eines Bereichs: { alle, over, soon, open, done, mine }. */
function aktuelleZahlen(scope = state.bereich) {
  return countsForScope(scope);
}
