/* Wartungstool · JS · Filter, Gruppierung, Kennzahlen */
function statusMatch(it, s) {
  if (s === 'alle') return true;
  if (s === 'open') return !it.erledigt;
  if (s === 'done') return !!it.erledigt;
  return statusOf(it) === s;
}

function filtered(srcList, s = state) {
  const q = norm(s.query);
  return srcList.filter(it => {
    if (!matchesQuery(it, q)) return false;
    if (s.art && it.objekt_art !== s.art) return false;
    if (s.objekt && it.objekt_name !== s.objekt) return false;
    if (s.taetigkeit && it.taetigkeit !== s.taetigkeit) return false;
    if (s.personen && s.personen.length && !s.personen.includes(it.zustaendig)) return false;
    if (s.mine && (!state.user || norm(it.zustaendig) !== norm(state.user))) return false;
    if (!statusMatch(it, s.status)) return false;
    if (!zeitraumMatch(it, s)) return false;
    return true;
  });
}

/** Positionen eines Bereichs (ohne Filter). */
function bereichListe(bereich) {
  if (bereich === 'todo') return state.todos.map(markToDo);
  if (bereich === 'wartung') return state.items;
  return state.items.concat(state.todos.map(markToDo));
}

function aktuelleListe() {
  return filtered(bereichListe(state.bereich));
}

/** Zeitraumfilter: Jahr und/oder von-/bis-Datum (bezogen auf die Frist `bis`). */
function zeitraumMatch(it, s) {
  if (!s.zeitraumJahr && !s.von && !s.bis) return true;
  const d = parseDate(it.bis);
  if (!d) return false;
  if (s.zeitraumJahr && String(d.getFullYear()) !== String(s.zeitraumJahr)) return false;
  const von = parseDate(s.von), bis = parseDate(s.bis);
  if (von && d < von) return false;
  if (bis && d > bis) return false;
  return true;
}

function countsForScope(scope) {
  let list = [];
  if (scope === 'todo') list = state.todos;
  else if (scope === 'wartung') list = state.items;
  else list = state.items.concat(state.todos);

  const c = { alle: list.length, done: 0, over: 0, soon: 0, open: 0, mine: 0 };
  for (const it of list) {
    const s = statusOf(it);
    if (s === 'over') c.over++;
    else if (s === 'soon') c.soon++;
    if (it.erledigt) c.done++;
    else c.open++;
    if (!it.erledigt && state.user && norm(it.zustaendig) === norm(state.user)) c.mine++;
  }
  return c;
}

const groupKey = (it) => (it.objekt_nr || '') + '|' + (it.objekt_name || '');

/* ==========================================================================
   Drei Schritte: Gruppieren · Sortieren · Ansicht
   --------------------------------------------------------------------------
   state.group  'object' | 'task' | 'status' | 'none'
   state.view   'list' | 'tiles' | 'blobs'
   state.sortKey 'status' | 'due' | 'object' | 'name'   (+ state.sortDir)
   ========================================================================== */

const GROUP_DEFS = [
  { key: 'object', label: 'Standort' },
  { key: 'task',   label: 'Tätigkeit' },
  { key: 'status', label: 'Status' },
  { key: 'none',   label: 'Ohne Gruppierung' }
];

const SORT_DEFS = [
  { key: 'status', label: 'Status' },
  { key: 'due',    label: 'Frist' },
  { key: 'object', label: 'Standort (Nr.)' },
  { key: 'name',   label: 'Standort (Name)' }
];

/* Statusgruppen in fester Reihenfolge (schlimmste zuerst). */
const STATUS_GROUPS = [
  { key: 'over', label: 'Überfällig',    tone: 'late' },
  { key: 'soon', label: 'Bald fällig',   tone: 'soon' },
  { key: 'open', label: 'Im Zeitraum',   tone: '' },
  { key: 'plan', label: 'Später geplant', tone: '' },
  { key: 'done', label: 'Erledigt',      tone: 'done' }
];
const statusTone = (key) => (STATUS_GROUPS.find(g => g.key === key) || {}).tone || '';
const STATUS_RANK = { over: 0, soon: 1, open: 2, plan: 3, done: 4 };
const statusRank = (it) => STATUS_RANK[statusOf(it)] ?? 2;

const dueValue = (it) => { const d = parseDate(it.bis); return d ? d.getTime() : Number.POSITIVE_INFINITY; };

function itemSortValue(it, key) {
  if (key === 'object') return it.objekt_nr || '';
  if (key === 'name')   return norm(it.objekt_name || '');
  if (key === 'due')    return dueValue(it);
  return statusRank(it);
}

/** Positionen nach Wunsch sortieren; offene stehen immer vor erledigten. */
function sortItems(items, key = state.sortKey, dir = state.sortDir) {
  const arr = items.slice();
  arr.sort((a, b) => {
    const da = a.erledigt ? 1 : 0, db = b.erledigt ? 1 : 0;
    if (da !== db) return da - db;
    const va = itemSortValue(a, key), vb = itemSortValue(b, key);
    let r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de', { numeric: true });
    if (dir === 'desc') r = -r;
    return r || String(a.taetigkeit || '').localeCompare(String(b.taetigkeit || ''), 'de');
  });
  return arr;
}

/** Gruppen für die gewählte Gruppierung. Jede Gruppe: {key,label,nr,name,items}. */
function groupItems(list, group = state.group) {
  if (group === 'none') return [{ key: 'none', label: 'Alle Positionen', nr: '', name: '', items: list.slice() }];
  if (group === 'status') {
    const buckets = new Map();
    for (const it of list) {
      const s = statusOf(it);
      if (!buckets.has(s)) buckets.set(s, []);
      buckets.get(s).push(it);
    }
    return STATUS_GROUPS.filter(d => buckets.has(d.key))
      .map(d => ({ key: 'st:' + d.key, label: d.label, nr: '', name: d.label, items: buckets.get(d.key) }));
  }
  const m = new Map();
  for (const it of list) {
    let key, label, nr = '';
    if (group === 'task') {
      key = 'task:' + (it.taetigkeit || '~');
      label = it.taetigkeit || 'Ohne Tätigkeit';
    } else {
      key = 'loc:' + groupKey(it);
      label = it.objekt_name || 'Ohne Standortbezug';
      nr = it.objekt_nr || '';
    }
    if (!m.has(key)) m.set(key, { key, label, nr, name: it.objekt_name || label, items: [] });
    m.get(key).items.push(it);
  }
  return Array.from(m.values());
}

const groupDone = (g) => g.items.length > 0 && g.items.every(i => i.erledigt);

function groupSortValue(g, key) {
  if (key === 'object') return g.nr || '';
  if (key === 'name')   return norm(g.name || g.label || '');
  if (key === 'status') return Math.min.apply(null, g.items.map(statusRank));
  const src = g.items.some(i => !i.erledigt) ? g.items.filter(i => !i.erledigt) : g.items;
  return Math.min.apply(null, src.map(dueValue));
}

/** Gruppen sortieren; abgeschlossene Gruppen stehen immer unten. */
function sortGroups(groups, key = state.sortKey, dir = state.sortDir) {
  return groups.slice().sort((a, b) => {
    if (key === 'status' && a.key.slice(0, 3) === 'st:' && b.key.slice(0, 3) === 'st:') {
      const ia = STATUS_GROUPS.findIndex(d => 'st:' + d.key === a.key);
      const ib = STATUS_GROUPS.findIndex(d => 'st:' + d.key === b.key);
      return (ia - ib) * (dir === 'desc' ? -1 : 1);
    }
    const da = groupDone(a) ? 1 : 0, db = groupDone(b) ? 1 : 0;
    if (da !== db) return da - db;
    const va = groupSortValue(a, key), vb = groupSortValue(b, key);
    let r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de', { numeric: true });
    if (dir === 'desc') r = -r;
    return r || String(a.label).localeCompare(String(b.label), 'de', { numeric: true });
  });
}

/** Kennzahlen einer Gruppe für Kacheln/Blasen. */
function groupStats(g) {
  const total = g.items.length;
  const done = g.items.filter(i => i.erledigt).length;
  const over = g.items.filter(i => !i.erledigt && statusOf(i) === 'over').length;
  const soon = g.items.filter(i => !i.erledigt && statusOf(i) === 'soon').length;
  return { total, done, open: total - done, over, soon, pct: total ? Math.round(done / total * 100) : 0 };
}

/** Vorschauzeile einer Gruppe (kürzeste Info für den Kopf). */
function groupPreview(g) {
  const open = g.items.filter(i => !i.erledigt);
  const src = open.length ? open : g.items;
  if (state.group === 'task') {
    const names = uniq(src.map(i => (i.objekt_nr ? i.objekt_nr + ' ' + i.objekt_name : i.objekt_name)).filter(Boolean));
    return names.length ? names.slice(0, 3).join(' · ') + (names.length > 3 ? ' +' + (names.length - 3) : '') : '–';
  }
  const tasks = uniq(src.map(i => i.taetigkeit).filter(Boolean));
  return tasks.length ? tasks.slice(0, 2).join(' · ') + (tasks.length > 2 ? ' +' + (tasks.length - 2) : '') : 'Alle erledigt';
}
