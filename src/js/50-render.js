/* Wartungstool · JS · Rendering der Ansichten */
/* ==========================================================================
   UI-Rendering mit Circular Progress Rings
   ========================================================================== */
function render() {
  renderSource();
  renderHead();
  renderToolbar();
  renderBody();
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

  $('#nScopeAlle').textContent = state.items.length + state.todos.length;
  $('#nScopeWartung').textContent = state.items.length;
  $('#nScopeTodo').textContent = state.todos.length;

  $$('#bereichSwitch button').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.bereich === state.bereich));
  });
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

  const sortDefault = state.view === 'objects' ? 'loc-critical' : 'due-asc';
  const hasAdvanced = !!(state.taetigkeit || state.personen.length || state.sort !== sortDefault);
  $('#filterActiveDot').hidden = !hasAdvanced;
  $('#btnFilterToggle').classList.toggle('has-active', hasAdvanced);
  $('#btnFilterToggle').setAttribute('aria-expanded', String(state.filterOpen));
  $('#filterDrawer').hidden = !state.filterOpen;

  const fill = (sel, values, current, placeholder) => {
    const el = $(sel);
    el.innerHTML = '<option value="">' + placeholder + '</option>' + values.map(v =>
      '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  };
  fill('#fltTask', uniq(aktuelleListe().map(i => i.taetigkeit)), state.taetigkeit, 'alle Tätigkeiten');
  $('#fltSort').value = state.sort;

  const personHost = $('#fltUser');
  if (personHost && personHost.dataset.open !== '1') {
    const src = istBereichTodo() ? state.todos : (istBereichAlle() ? state.items.concat(state.todos) : state.items);
    comboBox(personHost, {
      options: uniq(src.map(i => i.zustaendig)),
      selected: state.personen, multi: true,
      placeholder: state.personen.length ? '' : 'alle Personen',
      onChange: (vals) => { state.personen = vals; render(); }
    });
  }

  const any = state.query || state.taetigkeit || state.status !== 'alle' || state.mine || state.personen.length;
  $('#btnReset').hidden = !any;
  $('#resultInfo').textContent = aktuelleListe().length + ' Positionen sichtbar';

  const act = $('#viewAction');
  if (state.view === 'objects') {
    const groups = filteredGroups(aktuelleListe());
    const allOpen = groups.length > 0 && groups.every(([k]) => state.expanded.has(k));
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
  host.innerHTML = state.view === 'plan' ? viewTimeline(list)
                 : state.view === 'table' ? viewTable(list)
                 : viewLocations(list);
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

function viewLocations(list) {
  const groups = filteredGroups(list);
  const byNr = (a, b) => (a[1].nr || '').localeCompare(b[1].nr || '', 'de', { numeric: true });
  
  if (state.sort === 'loc-nr') groups.sort(byNr);
  else groups.sort((a, b) => {
    const ra = locRank(a[1]), rb = locRank(b[1]);
    const aDone = (ra.open + ra.over + ra.soon === 0) ? 1 : 0;
    const bDone = (rb.open + rb.over + rb.soon === 0) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (rb.over - ra.over) || (rb.soon - ra.soon) || (rb.open - ra.open) || byNr(a, b);
  });

  return '<div class="locs">' + groups.map(([k, g]) => {
    const r = locRank(g);
    const done = g.items.filter(i => i.erledigt).length;
    const pct = Math.round(done / g.items.length * 100);
    const isOpen = state.expanded.has(k);
    const isFinished = done === g.items.length;
    const isOverdue = r.over > 0;
    const isSoon = !isOverdue && r.soon > 0;

    let cls = 'loc';
    if (isOpen) cls += ' open';
    if (isOverdue) cls += ' is-overdue';
    else if (isSoon) cls += ' is-soon';
    else if (isFinished) cls += ' is-finished';

    const openTasks = g.items.filter(i => !i.erledigt && i.taetigkeit).map(i => i.taetigkeit);
    const preview = openTasks.length ? esc(openTasks.slice(0, 2).join(' · ')) + (openTasks.length > 2 ? ' <span class="more">+' + (openTasks.length - 2) + '</span>' : '') : 'Alle erledigt';
    const rows = g.items.map(it => workRow(it, false)).join('');

    return '<section class="' + cls + '">' +
      '<div class="loc-head" data-loc="' + esc(k) + '" role="button" tabindex="0">' +
        '<span class="loc-caret">' + svg(ICON.chevR, 14) + '</span>' +
        '<span class="loc-nr">' + esc(g.nr || '–') + '</span>' +
        '<div class="loc-title-col">' +
          '<span class="loc-name">' + esc(g.name) + '</span>' +
          (isOverdue ? '<span class="urgency-badge late">' + r.over + ' überfällig</span>' : '') +
          (isSoon ? '<span class="urgency-badge soon">' + r.soon + ' bald</span>' : '') +
          (isFinished ? '<span class="urgency-badge done">Erledigt</span>' : '') +
        '</div>' +
        '<span class="loc-preview-col">' + preview + '</span>' +
        '<div class="loc-summary-col"><b>' + (g.items.length - done) + '/' + g.items.length + ' offen</b>' + (r.over ? ' · <span class="late-count">' + r.over + ' überfällig</span>' : '') + '</div>' +
        '<div class="loc-progress-col">' + linearProgress(pct) + '<span>' + done + '/' + g.items.length + '</span></div>' +
        '<div class="loc-acts-col"><button class="td-act" data-termloc="' + esc(k) + '" title="Sammeltermin disponieren">' + svg(ICON.calendar, 15) + '</button></div>' +
      '</div>' +
      (isOpen ? '<div class="loc-rows">' + rows + '</div>' : '') +
    '</section>';
  }).join('') + '</div>';
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

const PLAN_GROUPS = [
  { key: 'over', label: 'Überfällig', tone: 'late' },
  { key: 'soon', label: 'Bald fällig', tone: 'soon' },
  { key: 'open', label: 'Im Zeitraum', tone: '' },
  { key: 'done', label: 'Erledigt', tone: 'done' }
];

function viewTimeline(list) {
  const buckets = new Map();
  for (const it of list) {
    const k = statusOf(it);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  return '<div class="plan">' + PLAN_GROUPS.filter(g => buckets.has(g.key)).map(g => {
    const items = buckets.get(g.key);
    const open = !state.collapsed.has('plan:' + g.key);
    return '<section class="plan-sec' + (open ? ' open' : '') + '">' +
      '<button class="plan-head" data-plan="' + g.key + '"><span class="plan-caret">' + svg(ICON.chevR, 14) + '</span><span class="urgency-badge ' + g.tone + '">' + g.label + '</span><span class="plan-sub">' + items.length + ' Positionen</span></button>' +
      (open ? '<div class="loc-rows">' + items.map(i => workRow(i, true)).join('') + '</div>' : '') +
    '</section>';
  }).join('') + '</div>';
}
