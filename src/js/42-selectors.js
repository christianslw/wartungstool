/* Wartungstool · JS · Filter, Gruppierung, Kennzahlen */
function statusMatch(it, s) {
  if (s === 'alle') return true;
  if (s === 'open') return !it.erledigt;
  if (s === 'done') return !!it.erledigt;
  return statusOf(it) === s;
}

function filtered(srcList) {
  const q = norm(state.query);
  return srcList.filter(it => {
    if (!matchesQuery(it, q)) return false;
    if (state.art && it.objekt_art !== state.art) return false;
    if (state.objekt && it.objekt_name !== state.objekt) return false;
    if (state.taetigkeit && it.taetigkeit !== state.taetigkeit) return false;
    if (state.personen.length && !state.personen.includes(it.zustaendig)) return false;
    if (state.mine && (!state.user || norm(it.zustaendig) !== norm(state.user))) return false;
    if (!statusMatch(it, state.status)) return false;
    return true;
  });
}

function aktuelleListe() {
  let list = [];
  if (state.bereich === 'todo') list = state.todos.map(markToDo);
  else if (state.bereich === 'wartung') list = state.items;
  else list = state.items.concat(state.todos.map(markToDo));
  return filtered(list);
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
function filteredGroups(list) {
  const m = new Map();
  for (const it of list) {
    const k = (it.objekt_nr || it.objekt_name) ? groupKey(it) : '~ohne';
    if (!m.has(k)) m.set(k, { nr: it.objekt_nr || '', name: it.objekt_name || 'Ohne Standortbezug', items: [] });
    m.get(k).items.push(it);
  }
  return Array.from(m.entries());
}

function locRank(g) {
  let over = 0, soon = 0, open = 0;
  for (const it of g.items) {
    if (it.erledigt) continue;
    const s = statusOf(it);
    if (s === 'over') over++; else if (s === 'soon') soon++; else open++;
  }
  return { over, soon, open };
}
