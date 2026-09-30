/* Wartungstool · JS · Detailpanel, Anhänge, Combo-Box */
/* ==========================================================================
   Details, Dialoge & Outlook/ICS Dispatch
   ========================================================================== */
function openPanel(id, opts = {}) {
  const it = state.items.find(x => String(x.id) === String(id));
  if (!it) return;
  state.panelId = String(id);

  const s = statusOf(it), d = dueInfo(it.bis);
  const val = (v, mono) => v ? '<dd' + (mono ? ' class="t-mono"' : '') + '>' + esc(v) + '</dd>' : '<dd class="empty-val">nicht angegeben</dd>';
  const line = (label, v, mono) => '<div class="row"><dt>' + label + '</dt>' + val(v, mono) + '</div>';

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML =
    '<div class="panel" role="dialog" aria-modal="true" aria-label="Details zur Wartungsposition">' +
      '<header>' +
        '<h2>' + esc(it.objekt_name || 'Wartungsposition') + '</h2>' +
        '<button class="td-act" data-x aria-label="Schließen">' + svg(ICON.close, 16) + '</button>' +
      '</header>' +
      '<div class="body">' +
        '<div class="notice">' + svg(ICON.info, 16) + '<span>Stammdaten sind schreibgeschützt und werden in der Datenbank gepflegt. Änderbar sind Erledigung und Notiz.</span></div>' +
        '<div class="sect"><h3>Objekt</h3>' +
          line('Objektart', it.objekt_art) +
          line('Objekt-Nr.', it.objekt_nr, true) +
          line('Objektname', it.objekt_name) +
        '</div>' +
        '<div class="sect"><h3>Auftrag</h3>' +
          line('Tätigkeit', it.taetigkeit) +
          line('Beschreibung', it.beschreibung) +
          line('Kommentar', it.kommentar) +
          line('Frist bis', it.bis, true) +
          '<div class="row"><dt>Friststatus</dt><dd><span class="due ' + d.cls + '">' + esc(d.text) + '</span></dd></div>' +
          line('Zuständig', it.zustaendig) +
        '</div>' +
        '<div class="sect"><h3>Erledigung</h3>' +
          '<div class="tgl-row">' +
            '<div class="t"><b>Erledigt</b><span>Datum und Person werden protokolliert</span></div>' +
            '<button class="tgl" role="switch" aria-checked="' + !!it.erledigt + '" id="panelDone"></button>' +
          '</div>' +
          '<div id="doneFields" style="display:' + (it.erledigt ? 'block' : 'none') + '">' +
            '<div class="row"><dt>Erledigt am</dt><dd id="pDoneAm" class="t-mono">' + esc(it.erledigt_am || '–') + '</dd></div>' +
            '<div class="row"><dt>Erledigt durch</dt><dd id="pDoneBy">' + esc(it.erledigt_durch || '–') + '</dd></div>' +
            '<div class="fld" style="margin-top:12px">' +
              '<label for="panelNote">Notiz / Feststellung</label>' +
              '<textarea class="inp" id="panelNote" placeholder="z. B. RCD defekt">' + esc(it.erledigt_notiz || '') + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sect"><h3>Anhänge</h3><div id="panelAtt"></div></div>' +
      '</div>' +
      '<div class="foot">' +
        '<button class="btn btn-tertiary" id="panelTermin">' + svg(ICON.calendar, 14) + 'Termin planen</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-tertiary" data-x>Schließen</button>' +
        '<button class="btn btn-primary" id="panelSave" disabled>Notiz speichern</button>' +
      '</div>' +
    '</div>';

  const close = () => { scrim.remove(); state.panelId = null; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey);

  scrim.addEventListener('click', async (e) => {
    if (e.target === scrim || e.target.closest('[data-x]')) return close();
    if (e.target.closest('#panelDone')) {
      const now = !state.items.find(x => String(x.id) === String(id)).erledigt;
      if (now && !await ensureUser()) return;
      if (now) {
        const data = await completionDialog(state.items.find(x => String(x.id) === String(id)));
        if (!data) return;
        await apply(id, data, scrim);
      } else {
        await apply(id, { erledigt: false, erledigt_am: '', erledigt_durch: '' }, scrim);
      }
    }
    if (e.target.closest('#panelSave')) {
      const v = scrim.querySelector('#panelNote').value;
      await finish(id, { erledigt_notiz: v });
      scrim.querySelector('#panelSave').disabled = true;
    }
    if (e.target.closest('#panelTermin')) dispatchTermin(findByKey('w:' + id));
  });

  async function apply(pid, patch, scope) {
    const updated = await finish(pid, patch);
    if (!updated) return;
    scope.querySelector('#panelDone').setAttribute('aria-checked', String(!!updated.erledigt));
    scope.querySelector('#doneFields').style.display = updated.erledigt ? 'block' : 'none';
    scope.querySelector('#pDoneAm').textContent = updated.erledigt_am || '–';
    scope.querySelector('#pDoneBy').textContent = updated.erledigt_durch || '–';
    if (!updated.erledigt) scope.querySelector('#panelNote').value = '';
    scope.querySelector('#panelSave').disabled = true;
  }

  const ta = scrim.querySelector('#panelNote');
  ta.addEventListener('input', () => { scrim.querySelector('#panelSave').disabled = ta.value === (it.erledigt_notiz || ''); });

  $('#overlay').appendChild(scrim);
  renderAttachments(scrim, 'wartung', id);
  setTimeout(() => {
    if (opts.focusNote && it.erledigt) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 30);
}

const fmtBytes = (n) => {
  n = Number(n) || 0;
  return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' kB' : (n / 1048576).toFixed(1) + ' MB';
};

async function renderAttachments(scope, art, id) {
  const host = scope.querySelector('#panelAtt');
  if (!host) return;

  if (!store.supportsAttachments) {
    host.innerHTML = '<div class="t-helper">Anhänge benötigen das SQL-Backend.</div>';
    return;
  }
  host.innerHTML = '<div class="t-helper">Lade Anhänge …</div>';
  let list;
  try { list = (await store.listAttachments(art, id)) || []; } catch (e) { list = []; }

  host.innerHTML = (list.length
    ? '<ul class="atts">' + list.map(a =>
        '<li><a class="att" href="' + esc(store.attachmentUrl(art, id, a.id)) + '" target="_blank" rel="noopener">' +
        svg(ICON.notes, 14) + '<span>' + esc(a.dateiname) + '</span></a>' +
        '<span class="att-meta">' + fmtBytes(a.groesse) + '</span>' +
        '<button class="btn btn-sm btn-ghost" data-attdel="' + esc(a.id) + '">' + svg(ICON.close, 12) + '</button></li>').join('') + '</ul>'
    : '<div class="t-helper">Noch keine Anhänge hinterlegt.</div>') +
    '<label class="btn btn-sm btn-tertiary" style="margin-top:8px">' +
      svg(ICON.plus, 14) + 'Datei anhängen' +
      '<input type="file" id="panelFile" hidden></label>';

  const fileEl = host.querySelector('#panelFile');
  fileEl.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await store.uploadAttachment(art, id, f, '');
      toast('Anhang hinzugefügt', { tone: 'success' });
      renderAttachments(scope, art, id);
    } catch (err) { toast('Fehler beim Hochladen', { tone: 'error' }); }
  });

  host.querySelectorAll('[data-attdel]').forEach(b => b.addEventListener('click', async () => {
    try {
      await store.removeAttachment(art, id, b.dataset.attdel);
      toast('Anhang gelöscht', { tone: 'success' });
      renderAttachments(scope, art, id);
    } catch (err) { toast('Fehler beim Löschen', { tone: 'error' }); }
  }));
}

function comboBox(host, { options = [], selected = [], multi = false, placeholder = 'suchen …', onChange }) {
  if (!host) return;
  if (host.__comboCleanup) host.__comboCleanup();
  const sel = multi ? (Array.isArray(selected) ? selected.slice() : []) : [];
  let single = multi ? '' : (Array.isArray(selected) ? (selected[0] || '') : (selected || ''));
  let query = '', active = -1;

  host.innerHTML =
    '<div class="combo">' +
      '<div class="combo-field">' +
        '<span class="combo-chips"></span>' +
        '<input class="combo-input" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false">' +
        '<span class="combo-carets">' + svg(ICON.chevD, 14) + '</span>' +
      '</div>' +
      '<div class="combo-list" role="listbox" hidden></div>' +
    '</div>';

  const field = host.querySelector('.combo-field');
  const input = host.querySelector('.combo-input');
  const list = host.querySelector('.combo-list');
  const chips = host.querySelector('.combo-chips');

  const currentValues = () => multi ? sel : (single ? [single] : []);
  const filtered = () => {
    const q = norm(query);
    return options.filter(o => !currentValues().includes(o) && (!q || norm(o).includes(q)));
  };

  const syncValue = () => {
    host.dataset.value = multi ? sel.join(' | ') : single;
    input.placeholder = multi && sel.length ? '' : (single ? '' : placeholder);
  };

  function renderChips() {
    chips.innerHTML = currentValues().map(v =>
      '<span class="combo-chip" data-v="' + esc(v) + '">' + esc(v) +
      '<button type="button" class="combo-x" data-del="' + esc(v) + '">' + svg(ICON.close, 10) + '</button></span>').join('');
  }

  function renderList() {
    const f = filtered();
    active = Math.max(-1, Math.min(f.length - 1, active));
    list.innerHTML = f.length
      ? f.map((o, i) => '<button type="button" class="combo-opt' + (i === active ? ' on' : '') + '" data-i="' + i + '">' + esc(o) + '</button>').join('')
      : '<div style="padding:6px 10px;font-size:11px;color:var(--text-helper)">kein Treffer</div>';
  }

  function open() {
    if (!list.hidden) return;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    host.dataset.open = '1';
    renderList();
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    host.dataset.open = '';
    query = ''; input.value = ''; active = -1;
  }
  const commit = (vals) => {
    if (multi) { sel.length = 0; sel.push(...vals); }
    else single = vals[0] || '';
    syncValue(); renderChips(); renderList();
    if (onChange) onChange(multi ? sel.slice() : single);
  };

  field.addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); commit(currentValues().filter(v => v !== del.dataset.del)); return; }
    if (!e.target.closest('.combo-x')) { open(); input.focus(); }
  });
  input.addEventListener('focus', open);
  input.addEventListener('input', () => { query = input.value; active = -1; open(); renderList(); });
  input.addEventListener('keydown', e => {
    const f = filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); active = Math.min(f.length - 1, active + 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); renderList(); }
    else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (active >= 0 && f[active]) commit(multi ? sel.concat([f[active]]) : [f[active]]);
      else if (input.value.trim()) commit(multi ? sel.concat([input.value.trim()]) : [input.value.trim()]);
      if (!multi) close(); else { query = ''; input.value = ''; renderList(); }
    }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'Backspace' && !input.value && currentValues().length) {
      const v = currentValues(); v.pop(); commit(v);
    }
  });
  list.addEventListener('mousedown', e => {
    const o = e.target.closest('.combo-opt');
    if (!o) return;
    e.preventDefault();
    commit(multi ? sel.concat([filtered()[+o.dataset.i]]) : [filtered()[+o.dataset.i]]);
    if (!multi) close(); else { query = ''; input.value = ''; input.focus(); renderList(); }
  });

  const onDoc = (e) => { if (!host.contains(e.target)) close(); };
  document.addEventListener('mousedown', onDoc);
  host.__comboCleanup = () => document.removeEventListener('mousedown', onDoc);
  syncValue(); renderChips();
}
