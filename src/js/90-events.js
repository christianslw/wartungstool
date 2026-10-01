/* Wartungstool · JS · Event-Verdrahtung */
/* ==========================================================================
   Event-Verdrahtung
   ========================================================================== */
$('#tableHost').addEventListener('click', async e => {
  const termLoc = e.target.closest('[data-termloc]');
  if (termLoc) {
    e.stopPropagation();
    const g = groupItems(aktuelleListe(), 'object').find(x => x.key === termLoc.dataset.termloc);
    if (g) dispatchTermin(terminZielStandort(g));
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

/* Volltextsuche: nur im Home-Tab (ohne Liste) nach "Alle" springen, sonst in
   der aktuellen Ansicht suchen. */
function sucheInAlle(v) {
  const at = activeTab();
  if (at && at.home) {
    const all = TABS.list.find(t => t.id === 'all');
    if (all) applyTabState(all);
  }
  state.query = v;
  render();
}
$('#search').addEventListener('input', debounce(e => sucheInAlle(e.target.value), 110));
$('#searchClear').addEventListener('click', () => { $('#search').value = ''; state.query = ''; render(); $('#search').focus(); });

/* --- Tabs: wählen, anpinnen, umbenennen, schließen, neu anlegen --------- */
let tabMenuEl = null;
function closeTabMenu() {
  if (tabMenuEl && tabMenuEl.remove) tabMenuEl.remove();
  tabMenuEl = null;
}
function openTabMenu(id, x, y) {
  closeTabMenu();
  const t = TABS.list.find(z => z.id === id);
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML =
    '<button type="button" data-tabact="color">Farbe …</button>' +
    '<button type="button" data-tabact="icon">Symbol …</button>' +
    '<div class="ctx-sep"></div>' +
    '<button type="button" data-tabact="default">' + (TABS.def === t.id ? 'Standard aufheben' : 'Als Standard festlegen') + '</button>' +
    '<button type="button" data-tabact="fav">' + (t.fav ? 'Favorit entfernen' : 'Als Favorit markieren') + '</button>' +
    '<button type="button" data-tabact="save">Tab speichern</button>' +
    '<button type="button" data-tabact="rename">Umbenennen</button>' +
    '<button type="button" data-tabact="close">Tab schließen</button>';
  el.style.left = Math.max(4, x || 0) + 'px';
  el.style.top = Math.max(4, y || 0) + 'px';
  el.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-tabact]');
    if (!b) return;
    const act = b.dataset.tabact;
    const cx = ev.clientX || x, cy = ev.clientY || y;
    if (act === 'color') { closeTabMenu(); return openPicker(id, cx, cy, 'color'); }
    if (act === 'icon') { closeTabMenu(); return openPicker(id, cx, cy, 'icon'); }
    closeTabMenu();
    if (act === 'default') setDefaultTab(id);
    else if (act === 'fav') toggleFavTab(id);
    else if (act === 'save') { saveTab(id); toastTab('Tab gespeichert', t.name); }
    else if (act === 'close') closeTab(id);
    else if (act === 'rename') {
      const r = await modal({
        title: 'Tab umbenennen',
        bodyHtml: '<div class="fld"><label for="tName">Name</label><input class="inp" id="tName" value="' + esc(t.name) + '"></div>',
        primary: 'Speichern',
        collect: (s) => ({ name: s.querySelector('#tName').value.trim() }),
        validate: (d) => d.name ? null : 'Bitte einen Namen angeben.'
      });
      if (r && r.name) renameTab(id, r.name);
    }
  });
  document.body.appendChild(el);
  tabMenuEl = el;
}

/** Auswahl-Popup fuer Farbe oder Symbol eines Tabs. */
function openPicker(id, x, y, kind) {
  closeTabMenu();
  const t = TABS.list.find(z => z.id === id);
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML = '<div class="ctx-title">' + (kind === 'color' ? 'Farbe' : 'Symbol') + '</div>' +
    (kind === 'color'
      ? '<div class="ctx-swatches">' + TAB_COLORS.map(c =>
          '<button type="button" class="swatch' + ((t.color || '') === c.color ? ' on' : '') + '" data-tabcolor="' + esc(c.color) + '" title="' + esc(c.label) + '"' +
          (c.color ? ' style="background:' + esc(c.color) + '"' : '') + '></button>').join('') + '</div>'
      : '<div class="ctx-icons">' + Object.keys(TAB_ICONS).map(k =>
          '<button type="button" class="ico' + (t.icon === k ? ' on' : '') + '" data-tabicon="' + esc(k) + '" title="' + esc(k) + '">' + svg(TAB_ICONS[k], 14) + '</button>').join('') + '</div>');
  el.style.left = Math.max(4, x || 0) + 'px';
  el.style.top = Math.max(4, y || 0) + 'px';
  el.addEventListener('click', (ev) => {
    const sw = ev.target.closest('[data-tabcolor]');
    if (sw) { setTabColor(id, sw.dataset.tabcolor); closeTabMenu(); return; }
    const ic = ev.target.closest('[data-tabicon]');
    if (ic) { setTabIcon(id, ic.dataset.tabicon); closeTabMenu(); return; }
  });
  document.body.appendChild(el);
  tabMenuEl = el;
}
function toastTab(text, detail) {
  try { toast(text, { tone: 'success', detail: detail }); } catch (e) {}
}

/** "+"-Menü: Standard Tabs, eigene Tabs, zuletzt geschlossene, neue Ansicht. */
function openAddMenu(x, y) {
  closeTabMenu();
  const saved = TABS.saved || [];
  const stdNames = new Set([HOME_TAB.name].concat(STANDARD_TABS.map(s => s.name)));
  const recent = (TABS.recent || []).filter(r => !stdNames.has(r.name));
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML =
    '<div class="ctx-title">Standard Tabs</div>' +
    '<button type="button" data-tabstd="home">' + esc(HOME_TAB.name) + '</button>' +
    STANDARD_TABS.map(s => '<button type="button" data-tabstd="' + esc(s.id) + '">' + esc(s.name) + '</button>').join('') +
    (saved.length ? '<div class="ctx-sep"></div><div class="ctx-title">Eigene Tabs</div>' +
      saved.map(s => '<button type="button" data-tabopen="' + esc(s.name) + '">' + (s.fav ? '★ ' : '') + esc(s.name) + '</button>').join('') : '') +
    (recent.length ? '<div class="ctx-sep"></div><div class="ctx-title">Zuletzt geschlossen</div>' +
      recent.map(s => '<button type="button" data-tabrecent="' + esc(s.name) + '">' + esc(s.name) + '</button>').join('') : '') +
    '<div class="ctx-sep"></div>' +
    '<button type="button" data-tabnew="1">＋ Neue Ansicht …</button>';
  el.style.left = Math.max(4, x || 0) + 'px';
  el.style.top = Math.max(4, y || 0) + 'px';
  el.addEventListener('click', (ev) => {
    const std = ev.target.closest('[data-tabstd]');
    if (std) { closeTabMenu(); return openStandard(std.dataset.tabstd); }
    const op = ev.target.closest('[data-tabopen]');
    if (op) { closeTabMenu(); return reopenSaved(op.dataset.tabopen); }
    const rc = ev.target.closest('[data-tabrecent]');
    if (rc) { closeTabMenu(); return reopenRecent(rc.dataset.tabrecent); }
    if (ev.target.closest('[data-tabnew]')) { closeTabMenu(); return newTabDialog(); }
  });
  document.body.appendChild(el);
  tabMenuEl = el;
}
function newTabDialog() {
  return modal({
    title: 'Neue Ansicht',
    bodyHtml: '<p class="t-helper" style="margin-bottom:10px">Eigener Tab: übernimmt die aktuellen Filter und die Ansicht und bleibt gespeichert.</p>' +
      '<div class="fld"><label for="tName">Name</label><input class="inp" id="tName" value="Neue Ansicht"></div>',
    primary: 'Anlegen',
    collect: (s) => ({ name: s.querySelector('#tName').value.trim() }),
    validate: (d) => d.name ? null : 'Bitte einen Namen angeben.'
  }).then((r) => { if (r && r.name) { addTab(r.name); toast('Tab angelegt', { tone: 'success', detail: r.name }); } });
}
document.addEventListener('mousedown', (e) => {
  if (tabMenuEl && e.target.closest && !e.target.closest('.ctx-menu')) closeTabMenu();
});

$('#tabBar').addEventListener('click', e => {
  const menuBtn = e.target.closest('[data-tabmenu]');
  if (menuBtn) {
    e.stopPropagation();
    const r = menuBtn.getBoundingClientRect ? menuBtn.getBoundingClientRect() : { left: 4, bottom: 30 };
    return openTabMenu(menuBtn.dataset.tabmenu, r.left, r.bottom + 4);
  }
  if (e.target.closest('#tabAdd')) {
    const b = e.target.closest('#tabAdd');
    const r = b.getBoundingClientRect ? b.getBoundingClientRect() : { left: 4, bottom: 30 };
    return openAddMenu(r.left, r.bottom + 4);
  }
  const tab = e.target.closest('[data-tab]');
  if (tab) applyTab(tab.dataset.tab);
});
$('#tabBar').addEventListener('contextmenu', e => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  e.preventDefault();
  openTabMenu(tab.dataset.tab, e.clientX || 0, e.clientY || 0);
});
$('#tabBar').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tab = e.target.closest('[data-tab]');
  if (tab) { e.preventDefault(); applyTab(tab.dataset.tab); }
});

/* Tabs frei verschieben (HTML5 Drag & Drop); der Standard-Tab bleibt links. */
let dragTabId = null;
function clearDropMarks() {
  $$('#tabBar .drop-before, #tabBar .drop-after').forEach(x => {
    if (x.classList) { x.classList.remove('drop-before'); x.classList.remove('drop-after'); }
  });
}
const dropAfter = (tab, clientX) => {
  if (!tab.getBoundingClientRect) return false;
  const r = tab.getBoundingClientRect();
  return (clientX || 0) > r.left + r.width / 2;
};
$('#tabBar').addEventListener('dragstart', e => {
  const tab = e.target.closest('[data-tab]');
  if (!tab || tab.dataset.tab === TABS.def) { e.preventDefault(); return; }
  dragTabId = tab.dataset.tab;
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragTabId); }
  tab.classList.add('dragging');
  $('#tabBar').classList.add('dragging-active');
});
$('#tabBar').addEventListener('dragover', e => {
  if (!dragTabId) return;
  const tab = e.target.closest('[data-tab]');
  if (!tab || tab.dataset.tab === dragTabId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  clearDropMarks();
  if (tab.dataset.tab !== TABS.def) tab.classList.add(dropAfter(tab, e.clientX) ? 'drop-after' : 'drop-before');
});
$('#tabBar').addEventListener('drop', e => {
  const tab = e.target.closest('[data-tab]');
  if (!tab || !dragTabId) return;
  e.preventDefault();
  const after = dropAfter(tab, e.clientX);
  clearDropMarks();
  moveTab(dragTabId, tab.dataset.tab, after);
});
$('#tabBar').addEventListener('dragleave', e => {
  if (e.target === e.currentTarget) clearDropMarks();
});
$('#tabBar').addEventListener('dragend', () => {
  dragTabId = null;
  clearDropMarks();
  $('#tabBar').classList.remove('dragging-active');
  $$('#tabBar .dragging').forEach(x => x.classList && x.classList.remove('dragging'));
});

$('#statusChips').addEventListener('click', e => {
  const b = e.target.closest('[data-status]');
  if (b) { state.status = b.dataset.status; render(); }
});
$('#chipMine').addEventListener('click', () => { state.mine = !state.mine; render(); });

$('#viewSwitch').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) setView(b.dataset.view);
});

/* Drei Schritte: Gruppieren · Sortieren · Ansicht + Presets */
$('#groupSel').addEventListener('change', e => setGroup(e.target.value));
$('#sortSel').addEventListener('change', e => setSort(e.target.value));
$('#sortDir').addEventListener('click', () => toggleSortDir());
$('#presetSel').addEventListener('change', e => {
  const p = loadPresets().list.find(x => x.name === e.target.value);
  if (p) applyPreset(p);
});
$('#presetSave').addEventListener('click', async () => {
  const vorschlag = GROUP_DEFS.find(g => g.key === state.group).label + ' · ' + state.view;
  const r = await modal({
    title: 'Preset speichern',
    bodyHtml: '<p class="t-helper" style="margin-bottom:10px">Gruppieren, Sortieren und Ansicht dieser Kombination benennen.</p>' +
      '<div class="fld"><label for="pName">Name</label><input class="inp" id="pName" value="' + esc(vorschlag) + '"></div>',
    primary: 'Speichern',
    collect: (s) => ({ name: s.querySelector('#pName').value.trim() }),
    validate: (d) => d.name ? null : 'Bitte einen Namen angeben.'
  });
  if (r && r.name) { saveCurrentPreset(r.name); render(); toast('Preset gespeichert', { tone: 'success', detail: r.name }); }
});
$('#presetDefault').addEventListener('click', () => {
  const name = $('#presetSel').value;
  if (!name) return toast('Bitte zuerst ein Preset wählen', { tone: 'warning' });
  const def = setDefaultPreset(name);
  render();
  toast(def ? 'Als Standard gesetzt' : 'Standard entfernt', { tone: 'success', detail: name });
});
$('#presetDelete').addEventListener('click', () => {
  const name = $('#presetSel').value;
  if (!name) return;
  deletePreset(name);
  render();
  toast('Preset gelöscht', { tone: 'warning', detail: name });
});

$('#btnViewPanel').addEventListener('click', () => {
  state.filterOpen = !state.filterOpen;
  renderToolbar();
});

$('#viewPanel').addEventListener('change', e => {
  if (e.target.id === 'fltTask') state.taetigkeit = e.target.value;
  if (e.target.id === 'fltJahr') state.zeitraumJahr = e.target.value;
  render();
});
$('#viewPanel').addEventListener('input', e => {
  if (e.target.id === 'fltVon') { e.target.value = maskDate(e.target.value); state.von = e.target.value; render(); }
  if (e.target.id === 'fltBis') { e.target.value = maskDate(e.target.value); state.bis = e.target.value; render(); }
});
$('#btnReset').addEventListener('click', () => {
  state.query = ''; state.status = 'alle'; state.taetigkeit = ''; state.mine = false;
  state.personen = []; state.zeitraumJahr = ''; state.von = ''; state.bis = '';
  $('#search').value = '';
  render();
});

$('.toolbar-row').addEventListener('click', e => {
  const exp = e.target.closest('[data-expand]');
  if (exp) {
    const list = aktuelleListe();
    state.expanded = exp.dataset.expand === 'all' ? new Set(groupItems(list, state.group).map(g => g.key)) : new Set();
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
    if (tabMenuEl) { closeTabMenu(); return; }
    if (typing) { e.target.blur(); return; }
    if ($('#overlay').children.length) return;
    state.query = ''; state.status = 'alle'; $('#search').value = ''; render();
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  if (e.key === 'p') { window.print(); }
  if (e.key === 'm') {
    const order = ['list', 'tiles', 'blobs'];
    state.view = order[(order.indexOf(state.view) + 1) % order.length];
    render();
  }
});
