/* Wartungstool · JS · Event-Verdrahtung */
/* ==========================================================================
   Event-Verdrahtung
   ========================================================================== */
$('#tableHost').addEventListener('click', async e => {
  const termLoc = e.target.closest('[data-termloc]');
  if (termLoc) {
    e.stopPropagation();
    const g = filteredGroups(aktuelleListe()).find(([k]) => k === termLoc.dataset.termloc);
    if (g) dispatchTermin(terminZielStandort(g[1]));
    return;
  }
  const loc = e.target.closest('[data-loc]');
  if (loc && !e.target.closest('.td-act')) {
    const k = loc.dataset.loc;
    state.expanded.has(k) ? state.expanded.delete(k) : state.expanded.add(k);
    return render();
  }
  const plan = e.target.closest('[data-plan]');
  if (plan) {
    const k = 'plan:' + plan.dataset.plan;
    state.collapsed.has(k) ? state.collapsed.delete(k) : state.collapsed.add(k);
    return render();
  }
  const tick = e.target.closest('[data-tick]');
  if (tick) {
    const rec = findByKey(tick.dataset.tick);
    if (!rec) return;
    if (istToDo(rec)) return todoDone(keyOf(rec), !rec.erledigt);
    return rec.erledigt ? reopen(rec.id) : markDone(rec.id);
  }
  const term = e.target.closest('[data-term]');
  if (term) return dispatchTermin(findByKey(term.dataset.term));
  const todoEdit = e.target.closest('[data-todoedit]');
  if (todoEdit) {
    const d = await todoDialog(todoEdit.dataset.todoedit);
    if (d) { await saveTodo(d); toast('To-Do gespeichert', { tone: 'success' }); }
    return;
  }
  const note = e.target.closest('[data-note]');
  if (note) {
    const rec = findByKey(note.dataset.note);
    if (!rec) return;
    return istToDo(rec) ? todoDialog(keyOf(rec)) : openPanel(rec.id, { focusNote: true });
  }
  const open = e.target.closest('[data-open]');
  if (open) return openPanel(findByKey(open.dataset.open).id);
});

$('#search').addEventListener('input', debounce(e => { state.query = e.target.value; render(); }, 110));
$('#searchClear').addEventListener('click', () => { $('#search').value = ''; state.query = ''; render(); $('#search').focus(); });

$('#bereichSwitch').addEventListener('click', e => {
  const b = e.target.closest('[data-bereich]');
  if (b) { state.bereich = b.dataset.bereich; state.status = 'alle'; render(); }
});

$('#statusChips').addEventListener('click', e => {
  const b = e.target.closest('[data-status]');
  if (b) { state.status = b.dataset.status; render(); }
});
$('#chipMine').addEventListener('click', () => { state.mine = !state.mine; render(); });

$('#viewSwitch').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) {
    state.view = b.dataset.view;
    $$('#viewSwitch button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }
});

$('#btnFilterToggle').addEventListener('click', () => {
  state.filterOpen = !state.filterOpen;
  renderToolbar();
});

$('.filter-drawer').addEventListener('change', e => {
  if (e.target.id === 'fltTask') state.taetigkeit = e.target.value;
  if (e.target.id === 'fltSort') state.sort = e.target.value;
  render();
});
$('#btnReset').addEventListener('click', () => {
  state.query = ''; state.status = 'alle'; state.taetigkeit = ''; state.mine = false; state.personen = [];
  $('#search').value = '';
  render();
});

$('.toolbar-row').addEventListener('click', e => {
  const exp = e.target.closest('[data-expand]');
  if (exp) {
    const list = aktuelleListe();
    state.expanded = exp.dataset.expand === 'all' ? new Set(filteredGroups(list).map(([k]) => k)) : new Set();
    render();
  }
});

$('#btnNewTodo').addEventListener('click', async () => {
  const data = await todoDialog(null);
  if (data) { const t = await saveTodo(data); if (t) toast('To-Do angelegt', { tone: 'success', detail: t.taetigkeit }); }
});

$('#btnUser').addEventListener('click', () => userDialog('Name für die Protokollierung', 'Speichern', 'Dieser Name wird bei Erledigungen eingetragen.', state.user).then(r => { if (r) applyUser(r.name); }));
$('#btnPrint').addEventListener('click', () => window.print());

const menu = $('#menuPop');
$('#btnMenu').addEventListener('click', e => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $('#btnMenu').setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', e => {
  if (!e.target.closest('#btnMenu') && !e.target.closest('#menuPop')) {
    menu.hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false');
  }
});
menu.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  menu.hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false');
  const a = b.dataset.act;
  if (a === 'csv') exportCsv();
  if (a === 'json') exportJson();
  if (a === 'keyboard') shortcutsDialog();
  if (a === 'settings') settingsDialog();
});

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); return; }
    if ($('#overlay').children.length) return;
    state.query = ''; state.status = 'alle'; $('#search').value = ''; render();
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  if (e.key === 'p') { window.print(); }
  if (e.key === 'm') {
    const order = ['objects', 'plan', 'table'];
    state.view = order[(order.indexOf(state.view) + 1) % order.length];
    $$('#viewSwitch button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === state.view)));
    render();
  }
});
