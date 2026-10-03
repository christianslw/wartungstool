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

/* --- Inline-Vorschläge: sofort anzeigen, mit Pfeil-rechts/Tab übernehmen --- */
/** Vorgeschlagenen Suchtext übernehmen und die Suche sofort ausführen. */
function akzeptiereVorschlag(text) {
  const input = $('#search');
  input.value = text;
  sucheInAlle(text);
  input.focus();
  try { input.setSelectionRange(text.length, text.length); } catch (e) {}
  renderSuggest();
}
$('#search').addEventListener('input', () => renderSuggest());
$('#search').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'Tab') return;
  const input = e.target, v = suchVorschlag(input.value);
  if (!v) return;
  // Nur am Textende bestätigen – sonst normal Cursor bewegen/Tab weitergeben.
  if (input.selectionStart !== null && input.selectionStart !== input.value.length) return;
  e.preventDefault();
  akzeptiereVorschlag(v.text);
});
['keyup', 'click', 'focus', 'blur'].forEach(ev =>
  $('#search').addEventListener(ev, () => renderSuggest()));

/* --- Merkmale aus der Liste in die Volltextsuche ziehen ------------------- */
/* Die ziehbaren Merkmale werden in 50-render.js mit dragAttr() ausgezeichnet
   (Standortnummer, Standortname, Tätigkeit, Zuständige Person). Der eigene
   dataTransfer-Typ trennt sie vom Verschieben der Tabs. */
const DRAG_TYPE = 'application/x-wt-merkmal';
let dragWert = '';
function dropMark(on) {
  const box = $('#searchBox');
  if (box && box.classList) box.classList.toggle('drop-active', !!on);
}
function attrDragMark(on) {
  const b = document.body;
  if (b && b.classList) b.classList.toggle('dragging-attr', !!on);
}

/** Gedropptes Merkmal als Suchbegriff übernehmen (Suche leer: setzen, sonst
    ergänzen – die Volltextsuche verknüpft mehrere Begriffe mit UND). */
function suchePerDrag(v) {
  const wert = String(v || '').trim();
  if (!wert) return;
  const current = String(state.query || $('#search').value || '').trim();
  const next = !current ? wert
    : (norm(current).indexOf(norm(wert)) >= 0 ? current : current + ' ' + wert);
  sucheInAlle(next);
  $('#search').value = next;
  $('#search').focus();
}

$('#tableHost').addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el) return;
  dragWert = el.dataset.drag || '';
  if (!dragWert) return;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy';
    try { e.dataTransfer.setData(DRAG_TYPE, dragWert); e.dataTransfer.setData('text/plain', dragWert); } catch (err) {}
  }
  if (el.classList) el.classList.add('drag-src');
  attrDragMark(true);
});
$('#tableHost').addEventListener('dragend', e => {
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (el && el.classList) el.classList.remove('drag-src');
  dragWert = '';
  attrDragMark(false);
  dropMark(false);
});

$('#searchBox').addEventListener('dragover', e => {
  const typen = (e.dataTransfer && e.dataTransfer.types) ? Array.from(e.dataTransfer.types) : [];
  if (!dragWert && typen.indexOf(DRAG_TYPE) < 0) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  dropMark(true);
});
$('#searchBox').addEventListener('dragleave', e => { if (e.target === e.currentTarget) dropMark(false); });
$('#searchBox').addEventListener('drop', e => {
  e.preventDefault();
  dropMark(false);
  attrDragMark(false);
  const v = (e.dataTransfer && e.dataTransfer.getData(DRAG_TYPE)) || dragWert;
  dragWert = '';
  suchePerDrag(v);
});

/* --- Tabs: wählen, anpinnen, umbenennen, schließen, neu anlegen --------- */
let tabMenuEl = null;

/* Kleine Symbole, die nur in Menüs gebraucht werden (viewBox 0 0 32 32). */
const ICON_DOT = '<circle cx="16" cy="16" r="9"/>';
const ICON_SHAPES = '<path d="M16 4l4.6 8h-9.2z"/><circle cx="10" cy="22" r="4"/><rect x="18" y="17" width="9" height="9" rx="2"/>';

/** Ein Eintrag im Kontextmenü: Icon + Beschriftung (+ optionale rechte Notiz). */
const ctxItem = (attrs, label, icon, { danger = false, meta = '', on = false } = {}) => {
  const cls = [danger ? 'danger' : '', on ? 'on' : ''].filter(Boolean).join(' ');
  return '<button type="button" ' + attrs + (cls ? ' class="' + cls + '"' : '') + '>' +
    '<span class="ctx-ic">' + (icon ? svg(icon, 16) : '') + '</span>' +
    '<span class="ctx-label">' + esc(label) + '</span>' +
    (meta ? '<span class="ctx-meta">' + esc(meta) + '</span>' : '') +
  '</button>';
};

/** Block-Kachel im Menü-Raster: Icon über der Beschriftung. */
const ctxBlock = (attrs, label, icon, { accent = '', wide = false } = {}) =>
  '<button type="button" ' + attrs + ' class="ctx-block' + (wide ? ' wide' : '') + '"' +
    (accent ? ' style="--tab-accent:' + esc(accent) + '"' : '') + '>' +
    '<span class="ctx-ic">' + (icon ? svg(icon, 16) : '') + '</span>' +
    '<span class="ctx-block-label">' + esc(label) + '</span>' +
  '</button>';

function closeTabMenu() {
  if (tabMenuEl && tabMenuEl.remove) tabMenuEl.remove();
  tabMenuEl = null;
  const pb = $('#presetBtn');
  if (pb) pb.setAttribute('aria-expanded', 'false');
  const sb = $('#btnSort');
  if (sb) sb.setAttribute('aria-expanded', 'false');
  const gb = $('#btnGroup');
  if (gb) gb.setAttribute('aria-expanded', 'false');
}
function openTabMenu(id, x, y) {
  closeTabMenu();
  const t = TABS.list.find(z => z.id === id);
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'ctx-menu edit';
  const accent = t.color || '';
  el.innerHTML =
    '<div class="ctx-head">' +
      '<span class="ctx-head-ic"' + (accent ? ' style="--tab-accent:' + esc(accent) + '"' : '') + '>' + svg(TAB_ICONS[t.icon] || TAB_ICONS.list, 15) + '</span>' +
      '<span class="ctx-head-name">' + esc(t.name) + '</span>' +
      (TABS.def === t.id ? '<span class="ctx-head-sub">Standard</span>' : (t.fav ? '<span class="ctx-head-sub">★ Favorit</span>' : '')) +
    '</div>' +
    '<div class="ctx-title">Darstellung</div>' +
    '<div class="ctx-grid">' +
      ctxBlock('data-tabact="color"', 'Farbe', ICON_DOT) +
      ctxBlock('data-tabact="icon"', 'Symbol', ICON_SHAPES) +
    '</div>' +
    '<div class="ctx-title">Verhalten</div>' +
    ctxItem('data-tabact="default"', TABS.def === t.id ? 'Standard aufheben' : 'Als Standard festlegen', TAB_ICONS.pin, { on: TABS.def === t.id, meta: TABS.def === t.id ? '✓' : '' }) +
    ctxItem('data-tabact="fav"', t.fav ? 'Favorit entfernen' : 'Als Favorit markieren', TAB_ICONS.star, { on: t.fav, meta: t.fav ? '★' : '' }) +
    '<div class="ctx-sep"></div>' +
    ctxItem('data-tabact="save"', 'Tab speichern', ICON.download) +
    ctxItem('data-tabact="rename"', 'Umbenennen', ICON.edit) +
    '<div class="ctx-sep"></div>' +
    ctxItem('data-tabact="close"', 'Tab schließen', ICON.close, { danger: true });
  el.style.left = Math.max(4, Math.min(x || 0, (window.innerWidth || 0) - 260)) + 'px';
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
  el.className = 'ctx-menu grid2';
  const stdBlock = (def) => ctxBlock('data-tabstd="' + esc(def.id) + '"', def.name, TAB_ICONS[def.icon] || TAB_ICONS.list);
  const recBlock = (attr, rec) => ctxBlock('data-' + attr + '="' + esc(rec.name) + '"', rec.name,
    (rec.icon && TAB_ICONS[rec.icon]) ? TAB_ICONS[rec.icon] : (attr === 'tabopen' ? TAB_ICONS.folder : TAB_ICONS.clock),
    { accent: rec.color || '' });
  el.innerHTML =
    '<div class="ctx-title">Standard Tabs</div>' +
    '<div class="ctx-grid">' + stdBlock(HOME_TAB) + STANDARD_TABS.map(stdBlock).join('') + '</div>' +
    (saved.length ? '<div class="ctx-title">Eigene Tabs</div><div class="ctx-grid">' +
      saved.map(s => recBlock('tabopen', s)).join('') + '</div>' : '') +
    (recent.length ? '<div class="ctx-title">Zuletzt geschlossen</div><div class="ctx-grid">' +
      recent.map(r => recBlock('tabrecent', r)).join('') + '</div>' : '') +
    '<div class="ctx-sep"></div>' +
    ctxBlock('data-tabnew="1"', 'Neue Ansicht …', ICON.plus, { wide: true });
  el.style.left = Math.max(4, Math.min(x || 0, (window.innerWidth || 0) - 260)) + 'px';
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
/** Vorlagen (Presets) als Menü am Toolbar-Knopf. */
function openPresetMenu(x, y) {
  closeTabMenu();
  const ps = loadPresets();
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML =
    '<div class="ctx-title">Vorlagen</div>' +
    (ps.list.length
      ? ps.list.map(p =>
          '<div class="preset-row">' +
            '<button type="button" class="preset-star' + (p.name === ps.def ? ' on' : '') + '" data-presetdef="' + esc(p.name) + '" title="Als Standard festlegen">' + (p.name === ps.def ? '★' : '☆') + '</button>' +
            '<button type="button" class="preset-apply" data-preset="' + esc(p.name) + '">' + esc(p.name) + '</button>' +
            '<button type="button" class="preset-del" data-presetdel="' + esc(p.name) + '" title="Löschen">×</button>' +
          '</div>').join('')
      : '<div class="ctx-empty">Noch keine Vorlagen</div>') +
    '<div class="ctx-sep"></div>' +
    ctxItem('data-presetsave="1"', 'Aktuelle Kombination speichern …', ICON.plus);
  el.style.left = Math.max(4, Math.min(x || 0, (window.innerWidth || 0) - 260)) + 'px';
  el.style.top = Math.max(4, y || 0) + 'px';
  el.addEventListener('click', (ev) => {
    const del = ev.target.closest('[data-presetdel]');
    if (del) { deletePreset(del.dataset.presetdel); closeTabMenu(); render(); toast('Vorlage gelöscht', { tone: 'warning', detail: del.dataset.presetdel }); return; }
    const st = ev.target.closest('[data-presetdef]');
    if (st) {
      const def = setDefaultPreset(st.dataset.presetdef);
      closeTabMenu(); render();
      toast(def ? 'Als Standard gesetzt' : 'Standard entfernt', { tone: 'success', detail: st.dataset.presetdef });
      return;
    }
    const ap = ev.target.closest('[data-preset]');
    if (ap) { const p = loadPresets().list.find(z => z.name === ap.dataset.preset); closeTabMenu(); if (p) applyPreset(p); return; }
    if (ev.target.closest('[data-presetsave]')) { closeTabMenu(); savePresetDialog(); }
  });
  document.body.appendChild(el);
  tabMenuEl = el;
  const pb = $('#presetBtn');
  if (pb) pb.setAttribute('aria-expanded', 'true');
}

/** Dialog zum Speichern der aktuellen Kombination als Vorlage. */
function savePresetDialog() {
  const g = GROUP_DEFS.find(x => x.key === state.group);
  const vorschlag = (g ? g.label : state.group) + ' · ' + state.view;
  return modal({
    title: 'Vorlage speichern',
    bodyHtml: '<p class="t-helper" style="margin-bottom:10px">Gruppieren, Sortieren und Ansicht dieser Kombination benennen.</p>' +
      '<div class="fld"><label for="pName">Name</label><input class="inp" id="pName" value="' + esc(vorschlag) + '"></div>',
    primary: 'Speichern',
    collect: (s) => ({ name: s.querySelector('#pName').value.trim() }),
    validate: (d) => d.name ? null : 'Bitte einen Namen angeben.'
  }).then((r) => { if (r && r.name) { saveCurrentPreset(r.name); render(); toast('Vorlage gespeichert', { tone: 'success', detail: r.name }); } });
}

document.addEventListener('mousedown', (e) => {
  if (!e.target || !e.target.closest) return;
  if (tabMenuEl && !e.target.closest('.ctx-menu') &&
      !e.target.closest('#btnSort') && !e.target.closest('#btnGroup') && !e.target.closest('#presetBtn')) closeTabMenu();
  if (state.filterOpen && !e.target.closest('#viewPanel') && !e.target.closest('#btnViewPanel')) {
    state.filterOpen = false; renderToolbar();
  }
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

/* Sortieren/Gruppieren als Popover an der Pille - dieselbe Menü-Mechanik wie
   die Tab-/Vorlagenmenüs, damit Außenklick und Escape überall greifen. */
function popMenu(anchor, html) {
  closeTabMenu();
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML = html;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 8, bottom: 40, right: 200 };
  el.style.left = Math.max(8, Math.round(r.left)) + 'px';
  el.style.top = Math.round((r.bottom || 40) + 6) + 'px';
  document.body.appendChild(el);
  tabMenuEl = el;
  return el;
}
function openSortMenu(anchor) {
  const el = popMenu(anchor,
    '<div class="ctx-title">Sortieren</div>' +
    SORT_DEFS.map(s => '<button type="button" class="' + (s.key === state.sortKey ? 'on' : '') + '" data-sortkey="' + s.key + '">' +
      (s.key === state.sortKey ? '✓ ' : '') + esc(s.label) + '</button>').join('') +
    '<div class="ctx-sep"></div>' +
    '<button type="button" data-sortdir="1">Richtung: ' + (state.sortDir === 'asc' ? 'aufsteigend ↑' : 'absteigend ↓') + '</button>');
  $('#btnSort').setAttribute('aria-expanded', 'true');
  el.addEventListener('click', ev => {
    const k = ev.target.closest('[data-sortkey]');
    if (k) { closeTabMenu(); setSort(k.dataset.sortkey); return; }
    if (ev.target.closest('[data-sortdir]')) { closeTabMenu(); toggleSortDir(); }
  });
}
function openGroupMenu(anchor) {
  const el = popMenu(anchor,
    '<div class="ctx-title">Gruppieren</div>' +
    GROUP_DEFS.map(g => '<button type="button" class="' + (g.key === state.group ? 'on' : '') + '" data-groupkey="' + g.key + '">' +
      (g.key === state.group ? '✓ ' : '') + esc(g.label) + '</button>').join(''));
  $('#btnGroup').setAttribute('aria-expanded', 'true');
  el.addEventListener('click', ev => {
    const k = ev.target.closest('[data-groupkey]');
    if (k) { closeTabMenu(); setGroup(k.dataset.groupkey); }
  });
}
$('#btnSort').addEventListener('click', e => { e.stopPropagation(); openSortMenu(e.currentTarget); });
$('#btnGroup').addEventListener('click', e => { e.stopPropagation(); openGroupMenu(e.currentTarget); });
$('#presetBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (tabMenuEl) { closeTabMenu(); return; }
  const r = e.currentTarget.getBoundingClientRect();
  openPresetMenu(r.left, r.bottom + 4);
});

/* Filter-Popover an der Filter-Pille verankern. */
function positionFilterPanel() {
  const el = $('#btnViewPanel');
  const b = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  if (!b) return;
  const p = $('#viewPanel');
  p.style.top = Math.round(b.bottom + 6) + 'px';
  p.style.right = Math.max(8, Math.round((window.innerWidth || 0) - b.right)) + 'px';
}
$('#btnViewPanel').addEventListener('click', () => {
  state.filterOpen = !state.filterOpen;
  if (state.filterOpen) positionFilterPanel();
  renderToolbar();
});
$('#filterClose').addEventListener('click', () => { state.filterOpen = false; renderToolbar(); });

$('#viewPanel').addEventListener('change', e => {
  if (e.target.id === 'fltTask') state.taetigkeit = e.target.value;
  if (e.target.id === 'fltJahr') { state.zeitraumJahr = e.target.value; state.zeitraumJahrManual = true; }
  render();
});
$('#viewPanel').addEventListener('input', e => {
  if (e.target.id === 'fltVon') { e.target.value = maskDate(e.target.value); state.von = e.target.value; render(); }
  if (e.target.id === 'fltBis') { e.target.value = maskDate(e.target.value); state.bis = e.target.value; render(); }
});
$('#btnReset').addEventListener('click', resetFilters);

/* Entfernbare Filter-Chips unter der Toolbar. */
$('#chipBar').addEventListener('click', e => {
  const b = e.target.closest('[data-clear]');
  if (!b) return;
  const k = b.dataset.clear;
  if (k === 'all') return resetFilters();
  if (k === 'query') { state.query = ''; $('#search').value = ''; }
  else if (k === 'status') state.status = 'alle';
  else if (k === 'mine') state.mine = false;
  else if (k === 'personen') state.personen = [];
  else if (k === 'taetigkeit') state.taetigkeit = '';
  else if (k === 'zeitraum') { state.zeitraumJahr = aktuellesJahr(); state.zeitraumJahrManual = false; state.von = ''; state.bis = ''; }
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
  if (a === 'jsonview') exportJsonView();
  if (a === 'keyboard') shortcutsDialog();
  if (a === 'settings') settingsDialog();
});

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (tabMenuEl) { closeTabMenu(); return; }
    if (state.filterOpen) { state.filterOpen = false; renderToolbar(); return; }
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
