/* Wartungstool · JS · Rendering der Ansichten */
/* ==========================================================================
   UI-Rendering mit Circular Progress Rings
   ========================================================================== */
function render() {
  renderSource();
  renderHead();
  renderToolbar();
  renderProgress();
  renderBody();
}

/** Gesamtfortschritt der Wartungen oben als Balken. */
function renderProgress() {
  const f = fortschritt();
  const el = $('#progressStrip');
  if (!el) return;
  $('#psBar').style.width = f.pct + '%';
  $('#psLabel').textContent = f.personal ? 'Meine Wartungen' : 'Alle Wartungen';
  $('#psValue').textContent = f.done + ' / ' + f.total + ' · ' + f.pct + '%';
  el.classList.toggle('done', f.total > 0 && f.done === f.total);
}

/** Datenquelle dezent in der Fußzeile anzeigen (statt prominent im Kopf). */
function renderSource() {
  const el = $('#srcStatus');
  el.classList.toggle('api', store === ApiStore);
  el.classList.toggle('offline', !state.online);
  el.classList.toggle('busy', state.loading);
  $('#srcText').textContent = state.loading ? 'Lade …'
    : (!state.online ? 'Offline'
      : (store === ApiStore ? 'SQL-Backend'
        : (hasDataFile() ? 'Stammdaten: daten.js' : 'Testbestand')));
}

function renderHead() {
  $('#userName').textContent = state.user || 'Name hinterlegen';
  $('#userNudge').hidden = !!state.user;
  renderTabs();
}

/** Tab-Leiste: Standard- und eigene Tabs, Favoriten zuerst. */
function renderTabs() {
  syncActiveTab();
  const host = $('#tabBar');
  if (!host) return;
  host.innerHTML = orderedTabs().map(t => {
    const act = t.id === TABS.active;
    return '<div class="scope-tab' + (t.fav ? ' fav' : '') + (t.builtin ? '' : ' custom') + '" role="tab" tabindex="0"' +
      ' data-tab="' + esc(t.id) + '" aria-selected="' + act + '" title="' + esc(t.name) + '">' +
      (t.fav ? '<span class="tab-star" title="Favorit">★</span>' : '') +
      '<span class="tab-name">' + esc(t.name) + '</span>' +
      '<span class="n">' + tabCount(t) + '</span>' +
      '<button type="button" class="tab-menu" data-tabmenu="' + esc(t.id) + '" title="Tab-Optionen" aria-label="Tab-Optionen">⋯</button>' +
    '</div>';
  }).join('') + '<button type="button" class="scope-add" id="tabAdd" title="Neue Ansicht hinzufügen">＋</button>';
}

function renderToolbar() {
  const c = countsForScope(state.bereich);
  const segs = [
    { key: 'alle', label: 'Alle' },
    { key: 'over', label: 'Überfällig' },
    { key: 'soon', label: 'Bald' },
    { key: 'open', label: 'Offen' },
    { key: 'done', label: 'Erledigt' }
  ];
  $('#statusChips').innerHTML = segs.map(s => {
    const isAct = state.status === s.key;
    const count = c[s.key] ?? 0;
    return '<button class="seg-btn" data-status="' + s.key + '" aria-pressed="' + isAct + '">' +
      s.label + ' <span class="n">' + count + '</span></button>';
  }).join('');

  $('#chipMineN').textContent = c.mine;
  $('#chipMineN').hidden = !state.user;
  $('#chipMine').classList.toggle('on', state.mine);

  // Zusammenfassen: ein Knopf, darunter die Leiste mit allen Optionen.
  const anyFilter = !!(state.query || state.taetigkeit || state.personen.length || state.mine ||
    state.status !== 'alle' || state.zeitraumJahr || state.von || state.bis);
  $('#viewActiveDot').hidden = !anyFilter;
  $('#btnViewPanel').classList.toggle('has-active', anyFilter);
  $('#btnViewPanel').setAttribute('aria-expanded', String(state.filterOpen));
  $('#viewPanel').hidden = !state.filterOpen;

  const fill = (sel, values, current, placeholder) => {
    const el = $(sel);
    el.innerHTML = '<option value="">' + placeholder + '</option>' + values.map(v =>
      '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  };
  fill('#fltTask', uniq(bereichListe(state.bereich).map(i => i.taetigkeit)), state.taetigkeit, 'alle Tätigkeiten');

  const jsel = $('#fltJahr');
  jsel.innerHTML = '<option value="">alle Jahre</option>' + tabYears().map(y =>
    '<option value="' + y + '"' + (String(y) === String(state.zeitraumJahr) ? ' selected' : '') + '>' + y + '</option>').join('');
  const von = $('#fltVon'), bis = $('#fltBis');
  if (document.activeElement !== von) von.value = state.von || '';
  if (document.activeElement !== bis) bis.value = state.bis || '';

  // Drei Schritte: Gruppieren · Sortieren · Ansicht (+ Presets)
  $('#groupSel').innerHTML = GROUP_DEFS.map(g =>
    '<option value="' + g.key + '"' + (g.key === state.group ? ' selected' : '') + '>' + g.label + '</option>').join('');
  $('#sortSel').innerHTML = SORT_DEFS.map(s =>
    '<option value="' + s.key + '"' + (s.key === state.sortKey ? ' selected' : '') + '>' + s.label + '</option>').join('');
  const dirBtn = $('#sortDir');
  dirBtn.textContent = state.sortDir === 'asc' ? '↑' : '↓';
  dirBtn.title = state.sortDir === 'asc' ? 'aufsteigend (klicken: absteigend)' : 'absteigend (klicken: aufsteigend)';
  $$('#viewSwitch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));

  const ps = loadPresets();
  $('#presetSel').innerHTML = '<option value="">Preset …</option>' + ps.list.map(p =>
    '<option value="' + esc(p.name) + '">' + (p.name === ps.def ? '★ ' : '') + esc(p.name) + '</option>').join('');
  $('#presetDefault').classList.toggle('on', !!ps.def);

  const personHost = $('#fltUser');
  if (personHost && personHost.dataset.open !== '1') {
    comboBox(personHost, {
      options: uniq(bereichListe(state.bereich).map(i => i.zustaendig)),
      selected: state.personen, multi: true,
      placeholder: state.personen.length ? '' : 'alle Personen',
      onChange: (vals) => { state.personen = vals; render(); }
    });
  }

  const any = state.query || state.taetigkeit || state.status !== 'alle' || state.mine ||
    state.personen.length || state.zeitraumJahr || state.von || state.bis;
  $('#btnReset').hidden = !any;
  $('#resultInfo').textContent = aktuelleListe().length + ' Positionen sichtbar';

  const act = $('#viewAction');
  if (state.view === 'list' && (state.group === 'object' || state.group === 'task')) {
    const groups = groupItems(aktuelleListe(), state.group);
    const allOpen = groups.length > 0 && groups.every(g => state.expanded.has(g.key));
    act.innerHTML = '<button class="btn btn-sm btn-ghost" data-expand="' + (allOpen ? 'none' : 'all') + '">' +
      (allOpen ? 'Alle einklappen' : 'Alle ausklappen') + '</button>';
  } else {
    act.innerHTML = '';
  }
}

function renderBody() {
  const host = $('#tableHost');
  if (state.loading) {
    host.innerHTML = Array.from({ length: 10 }, () => '<div style="height:38px;border-bottom:1px solid var(--border-subtle);background:var(--layer-01);opacity:.4"></div>').join('');
    return;
  }
  const list = aktuelleListe();
  if (!list.length) {
    host.innerHTML = '<div style="padding:48px 16px;text-align:center;color:var(--text-helper)"><h3>Keine Positionen gefunden</h3><p style="font-size:12px;margin-top:6px">Überprüfen Sie die Filter oder das Suchfeld.</p></div>';
    return;
  }
  if (state.view === 'tiles') { host.innerHTML = viewTiles(list); return; }
  if (state.view === 'blobs') { host.innerHTML = viewBlobs(list); return; }
  if (state.group === 'none') { host.innerHTML = viewTable(list); return; }
  if (state.group === 'status') { host.innerHTML = viewTimeline(list); return; }
  host.innerHTML = viewGroupedList(list);
}

function tickControl(it) {
  const done = !!it.erledigt;
  return '<button class="tick' + (done ? ' on' : '') + '" data-tick="' + esc(keyOf(it)) + '" title="' + (done ? 'Erledigung zurücknehmen' : 'Als erledigt protokollieren') + '">' +
    svg(ICON.check, 14, 'tk-check') + svg(ICON.undo, 12, 'tk-undo') + '</button>';
}

function erledigtInfo(it) {
  if (!it.erledigt) return '<span class="loc-user">' + esc(it.zustaendig || '–') + '</span>';
  const note = String(it.erledigt_notiz || '').trim();
  return '<div class="ecell"><span class="ecell-sub">' + esc(it.erledigt_am || '') + ' · ' + esc(it.erledigt_durch || 'Erledigt') + '</span>' +
    (note ? '<span class="ecell-note" title="' + esc(note) + '">' + esc(note) + '</span>' : '<button class="btn-note" data-note="' + esc(keyOf(it)) + '">' + svg(ICON.notes, 11) + ' Notiz</button>') +
    '</div>';
}

function dueCell(it) {
  const s = statusOf(it), d = dueInfo(it.bis);
  return '<div class="loc-due"><span class="c-main">' + esc(it.bis || '–') + '</span><span class="c-sub ' + (s === 'over' ? 'due late' : (s === 'soon' ? 'due soon' : '')) + '">' + esc(d.text) + '</span></div>';
}

function linearProgress(pct) {
  const w = Math.max(0, Math.min(100, pct));
  return '<div class="loc-mini-track"><i style="width:' + w + '%"></i></div>';
}

function viewGroupedList(list) {
  const groups = sortGroups(groupItems(list, state.group));
  return '<div class="locs">' + groups.map(g => {
    const st = groupStats(g);
    const isOpen = state.expanded.has(g.key);
    let cls = 'loc';
    if (isOpen) cls += ' open';
    if (st.over) cls += ' is-overdue';
    else if (st.open > 0) cls += ' is-soon';
    else cls += ' is-finished';

    const rows = sortItems(g.items).map(it => workRow(it, state.group === 'task')).join('');
    const nrCell = state.group === 'object'
      ? '<span class="loc-nr">' + esc(g.nr || '–') + '</span>'
      : '<span class="loc-nr"><span class="tag gray mini">' + (state.group === 'task' ? 'Tätigkeit' : 'Gruppe') + '</span></span>';

    return '<section class="' + cls + '">' +
      '<div class="loc-head" data-loc="' + esc(g.key) + '" role="button" tabindex="0">' +
        '<span class="loc-caret">' + svg(ICON.chevR, 14) + '</span>' +
        nrCell +
        '<div class="loc-title-col">' +
          '<span class="loc-name">' + esc(g.label) + '</span>' +
          (st.over ? '<span class="urgency-badge late">' + st.over + ' überfällig</span>' : '') +
          (st.open === 0 ? '<span class="urgency-badge done">Erledigt</span>' : '') +
        '</div>' +
        '<span class="loc-preview-col">' + esc(groupPreview(g)) + '</span>' +
        '<div class="loc-summary-col"><b>' + st.open + '/' + st.total + ' offen</b></div>' +
        '<div class="loc-progress-col">' + linearProgress(st.pct) + '<span>' + st.done + '/' + st.total + '</span></div>' +
        '<div class="loc-acts-col">' + (state.group === 'object' ? '<button class="td-act" data-termloc="' + esc(g.key) + '" title="Sammeltermin disponieren">' + svg(ICON.calendar, 15) + '</button>' : '') + '</div>' +
      '</div>' +
      (isOpen ? '<div class="loc-rows">' + rows + '</div>' : '') +
    '</section>';
  }).join('') + '</div>';
}

/** Kacheln: eine Karte je Gruppe mit Fortschrittsring und offenen Positionen. */
function viewTiles(list) {
  const groups = state.group === 'status' ? groupItems(list, 'status') : sortGroups(groupItems(list, state.group));
  return '<div class="tiles">' + groups.map(g => {
    const st = groupStats(g);
    const isOpen = state.expanded.has(g.key);
    const rows = isOpen ? sortItems(g.items).map(it => workRow(it, true)).join('') : '';
    return '<section class="tile' + (isOpen ? ' open' : '') + (st.open === 0 ? ' done' : '') + (st.over ? ' over' : '') + '">' +
      '<button class="tile-head" data-loc="' + esc(g.key) + '">' +
        '<span class="tile-ring" style="--pct:' + st.pct + '"><b>' + st.pct + '%</b></span>' +
        '<span class="tile-label" title="' + esc(g.label) + '">' + esc(g.label) + '</span>' +
        '<span class="tile-sub">' + st.open + ' offen · ' + st.done + '/' + st.total + '</span>' +
        (st.over ? '<span class="urgency-badge late">' + st.over + ' überfällig</span>' : '') +
      '</button>' +
      (isOpen ? '<div class="tile-rows">' + rows + '</div>' : '') +
    '</section>';
  }).join('') + '</div>';
}

/** Blasen: Kreis je Gruppe, Größe = Anzahl, Füllung = Fortschritt. */
function viewBlobs(list) {
  const groups = state.group === 'status' ? groupItems(list, 'status') : sortGroups(groupItems(list, state.group));
  const max = Math.max(1, groups.map(g => g.items.length).reduce((m, n) => Math.max(m, n), 1));
  const blobs = groups.map(g => {
    const st = groupStats(g);
    const size = 76 + Math.round(Math.sqrt(g.items.length / max) * 60);
    const isOpen = state.expanded.has(g.key);
    return '<button class="blob' + (isOpen ? ' open' : '') + (st.open === 0 ? ' done' : '') + (st.over ? ' over' : '') + '"' +
      ' data-loc="' + esc(g.key) + '" style="--size:' + size + 'px;--pct:' + st.pct + '" title="' + esc(g.label) + '">' +
      '<span class="blob-pct">' + st.pct + '%</span>' +
      '<span class="blob-label">' + esc(g.label) + '</span>' +
      '<span class="blob-sub">' + st.open + '/' + st.total + '</span>' +
    '</button>';
  }).join('');
  const detail = groups.filter(g => state.expanded.has(g.key)).map(g => {
    const st = groupStats(g);
    return '<section class="blob-detail"><h3>' + esc(g.label) + ' <span class="t-helper">' + st.open + ' offen</span></h3>' +
      sortItems(g.items).map(it => workRow(it, true)).join('') + '</section>';
  }).join('');
  return '<div class="blobs">' + blobs + '</div>' + detail;
}

function workRow(it, showObject) {
  const k = esc(keyOf(it));
  return '<div class="loc-row' + (it.erledigt ? ' done' : '') + (istToDo(it) ? ' ist-todo' : '') + '" data-id="' + k + '">' +
    tickControl(it) +
    '<span class="loc-nr" style="opacity:.6">' + esc(it.objekt_nr || '') + '</span>' +
    '<div class="loc-task"><span class="c-main" title="' + esc(it.taetigkeit) + '">' + esc(it.taetigkeit || '–') + '</span>' + (showObject ? '<span class="c-sub">' + esc(it.objekt_name) + '</span>' : '') + '</div>' +
    '<span class="loc-note" title="' + esc(it.kommentar) + '">' + esc(it.kommentar || '–') + '</span>' +
    dueCell(it) +
    erledigtInfo(it) +
    '<div class="loc-acts-col">' +
      '<button class="td-act" data-term="' + k + '" title="Termin planen">' + svg(ICON.calendar, 14) + '</button>' +
      (istToDo(it) ? '<button class="td-act" data-todoedit="' + k + '" title="Bearbeiten">' + svg(ICON.edit, 14) + '</button>' : '<button class="td-act" data-open="' + k + '" title="Details">' + svg(ICON.chevR, 14) + '</button>') +
    '</div>' +
  '</div>';
}

function viewTable(list) {
  const rows = list.map(it => {
    const k = esc(keyOf(it));
    return '<tr data-id="' + k + '" class="' + (it.erledigt ? 'done' : '') + '">' +
      '<td style="width:36px">' + tickControl(it) + '</td>' +
      '<td><span class="c-main">' + esc(it.objekt_name || '–') + '</span><span class="c-sub">' + esc(it.objekt_nr || '') + '</span></td>' +
      '<td><span class="c-main">' + esc(it.taetigkeit || '–') + '</span></td>' +
      '<td>' + dueCell(it) + '</td>' +
      '<td>' + erledigtInfo(it) + '</td>' +
      '<td style="text-align:right"><button class="td-act" data-term="' + k + '">' + svg(ICON.calendar, 14) + '</button></td>' +
    '</tr>';
  }).join('');
  return '<div class="tbl-wrap"><table class="cds"><thead><tr><th></th><th>Standort</th><th>Tätigkeit</th><th>Frist</th><th>Zuständig / Erledigt</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function viewTimeline(list) {
  const groups = groupItems(list, 'status');
  return '<div class="plan">' + groups.map(g => {
    const isOpen = !state.collapsed.has('plan:' + g.key);
    const st = groupStats(g);
    const items = sortItems(g.items);
    return '<section class="plan-sec' + (isOpen ? ' open' : '') + '">' +
      '<button class="plan-head" data-plan="' + esc(g.key) + '"><span class="plan-caret">' + svg(ICON.chevR, 14) + '</span>' +
      '<span class="urgency-badge ' + statusTone(g.key.slice(3)) + '">' + g.label + '</span>' +
      '<span class="plan-sub">' + st.open + '/' + st.total + ' offen</span></button>' +
      (isOpen ? '<div class="loc-rows">' + items.map(i => workRow(i, true)).join('') + '</div>' : '') +
    '</section>';
  }).join('') + '</div>';
}
