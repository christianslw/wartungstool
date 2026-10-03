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

/** Alle Filter auf den Ausgangszustand setzen (Suche, Status, Person, Zeitraum). */
function resetFilters() {
  state.query = ''; state.status = 'alle'; state.taetigkeit = ''; state.mine = false;
  state.personen = []; state.zeitraumJahr = aktuellesJahr(); state.zeitraumJahrManual = false;
  state.von = ''; state.bis = '';
  const s = $('#search'); if (s) s.value = '';
  render();
}

/** Bereich wechseln: 'alle' | 'wartung' | 'todo'.
    Aktiviert den zugehörigen Standard-Tab, falls vorhanden. */
function setBereich(b) {
  if (state.bereich === b) return;
  const t = TABS.list.find(x => x.builtin && x.settings.bereich === b);
  if (t) { applyTabState(t); render(); return; }
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

/** Vorname aus "Nachname, Vorname" (oder aus einem einfachen Namen). */
function vorname(name = state.user) {
  const s = String(name || '').trim();
  if (!s) return '';
  const teile = s.split(',');
  return (teile.length > 1 ? teile[1] : s.split(' ')[0]).trim();
}

/** Tageszeitabhaengiger Gruss mit Vornamen. */
function gruss(name = state.user) {
  const h = new Date().getHours();
  const zeit = h < 11 ? 'Guten Morgen' : (h < 18 ? 'Guten Tag' : 'Guten Abend');
  const v = vorname(name);
  return zeit + (v ? ', ' + v : '');
}

/** Verbleibende Arbeitstage (Mo–Fr) bis Jahresende, Standard 5 Werktage/Woche. */
function arbeitstageImJahr(heute = new Date()) {
  const cur = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const ende = new Date(heute.getFullYear(), 11, 31);
  let n = 0;
  while (cur <= ende) {
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
