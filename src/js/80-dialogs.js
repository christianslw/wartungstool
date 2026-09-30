/* Wartungstool · JS · To-Do- und Erledigungs-Dialoge */
/* ==========================================================================
   To-Do und Erledigungs-Dialoge
   ========================================================================== */
const TODO_FIELDS = {
  taetigkeit: '', objekt_nr: '', objekt_name: '', kommentar: '', ab: '', bis: '',
  zustaendig: '', erledigt: false, erledigt_am: '', erledigt_durch: '', erledigt_notiz: '',
  objekt_art: 'To-Do'
};
const normalizeTodo = (r) => markToDo(Object.assign({}, TODO_FIELDS, r, {
  id: r.id ?? null,
  erledigt: r.erledigt === true || r.erledigt === 1 || r.erledigt === '1' || r.erledigt === 'true'
}));

const istBereichTodo = () => state.bereich === 'todo';
const istBereichAlle = () => state.bereich === 'alle';

function todoDialog(key) {
  const t = key == null ? null : (findByKey(key) || null);
  const d = t ? Object.assign({}, t) : Object.assign({}, TODO_FIELDS, {
    zustaendig: state.user || '', bis: fmtDate(new Date(Date.now() + 14 * 86400000))
  });
  const objList = objects();

  return modal({
    title: t ? 'To-Do bearbeiten' : 'Neues To-Do',
    tertiary: t ? 'Löschen' : null,
    bodyHtml:
      '<div class="fld"><label for="tText">Aufgabe</label>' +
        '<input class="inp" id="tText" value="' + esc(d.taetigkeit) + '"></div>' +
      '<div class="fld"><label for="tObjekt">Standortbezug (optional)</label>' +
        '<div class="combo-host" id="tObjekt"></div></div>' +
      '<div class="fld"><label for="tFaellig">Frist</label>' +
        '<input class="inp" id="tFaellig" value="' + esc(d.bis) + '"></div>' +
      '<div class="fld"><label for="tPerson">Zuständig</label>' +
        '<div class="combo-host" id="tPerson"></div></div>' +
      '<div class="fld"><label for="tNote">Anmerkung</label>' +
        '<textarea class="inp" id="tNote">' + esc(d.kommentar) + '</textarea></div>',
    primary: t ? 'Speichern' : 'To-Do anlegen',
    collect: (s) => {
      const bezug = s.querySelector('#tObjekt').dataset.value.trim();
      const nr = (bezug.match(/^(\S+)\s*(.*)$/) || ['', '', '']);
      return {
        id: t ? t.id : null,
        taetigkeit: s.querySelector('#tText').value.trim(),
        objekt_nr: nr[1] || '',
        objekt_name: nr[2] || '',
        bis: s.querySelector('#tFaellig').value.trim(),
        zustaendig: s.querySelector('#tPerson').dataset.value.trim(),
        kommentar: s.querySelector('#tNote').value.trim()
      };
    },
    validate: (x) => !x.taetigkeit ? 'Bitte die Aufgabe beschreiben.' : null,
    onMount: (s) => {
      comboBox(s.querySelector('#tObjekt'), {
        options: objList.map(o => o.nr + ' ' + o.name), selected: d.objekt_nr ? d.objekt_nr + ' ' + d.objekt_name : '',
        multi: false, placeholder: 'ohne Bezug'
      });
      comboBox(s.querySelector('#tPerson'), {
        options: uniq([state.user].concat(state.items.map(i => i.zustaendig)).filter(Boolean)),
        selected: d.zustaendig, multi: false, placeholder: 'Name, Vorname'
      });
    },
    onTertiary: () => { if (t) deleteTodo(t.id); return false; }
  });
}

function objects() {
  const m = new Map();
  for (const it of state.items) {
    const k = groupKey(it);
    if (!m.has(k)) m.set(k, { nr: it.objekt_nr, name: it.objekt_name });
  }
  return Array.from(m.values()).sort((a, b) => (a.nr || '').localeCompare(b.nr || '', 'de', { numeric: true }));
}

async function saveTodo(data) {
  const saved = await store.saveTodo(data);
  const n = normalizeTodo(saved);
  const i = state.todos.findIndex(x => String(x.id) === String(n.id));
  if (i >= 0) state.todos[i] = n; else state.todos.push(n);
  render();
  return n;
}

async function deleteTodo(id) {
  await store.removeTodo(id);
  state.todos = state.todos.filter(x => String(x.id) !== String(id));
  render();
  toast('To-Do gelöscht', { tone: 'warning' });
}

async function todoDone(key, on) {
  const t = findByKey(key);
  if (!t) return;
  if (on && !await ensureUser()) return;
  await saveTodo(Object.assign({}, t, on
    ? { erledigt: true, erledigt_am: fmtDate(new Date()), erledigt_durch: state.user }
    : { erledigt: false, erledigt_am: '', erledigt_durch: '' }));
  toast(on ? 'To-Do erledigt' : 'To-Do wieder offen', { tone: on ? 'success' : 'warning' });
}

function completionDialog(it) {
  const known = uniq(state.items.map(i => i.zustaendig));
  const persons = uniq([state.user].concat(known).filter(Boolean));
  return modal({
    title: 'Wartung abschließen',
    bodyHtml:
      '<p class="t-body" style="margin-bottom:4px">' + esc(it.objekt_name || '') + '</p>' +
      '<p class="t-helper" style="margin-bottom:12px">' + esc(it.taetigkeit || '') + '</p>' +
      '<div class="fld"><label for="mDate">Erledigt am</label>' +
        '<input class="inp" id="mDate" value="' + esc(fmtDate(new Date())) + '"></div>' +
      '<div class="fld"><label for="mBy">Erledigt durch</label>' +
        '<div class="combo-host" id="mBy" data-value="' + esc(state.user) + '"></div></div>' +
      '<div class="fld"><label for="mNote">Abschlusskommentar</label>' +
        '<textarea class="inp" id="mNote"></textarea></div>',
    primary: 'Abschluss speichern',
    collect: (s) => ({
      erledigt: true,
      erledigt_am: s.querySelector('#mDate').value.trim() || fmtDate(new Date()),
      erledigt_durch: s.querySelector('#mBy').dataset.value.trim() || state.user,
      erledigt_notiz: s.querySelector('#mNote').value.trim()
    }),
    onMount: (s) => {
      comboBox(s.querySelector('#mBy'), { options: persons, selected: state.user, multi: false });
    }
  });
}

async function finish(id, patch) {
  const it = state.items.find(x => String(x.id) === String(id));
  if (!it) return null;
  const before = Object.assign({}, it);
  Object.assign(it, patch);
  render();
  try {
    const saved = await store.complete(id, patch);
    Object.assign(it, saved);
    state.online = true;
  } catch (e) {
    Object.assign(it, before);
    state.online = false;
    render();
    toast('Fehler beim Speichern', { tone: 'error' });
    return null;
  }
  return it;
}

async function markDone(id) {
  const it = state.items.find(x => String(x.id) === String(id));
  if (!it) return;
  if (!await ensureUser()) return;
  const data = await completionDialog(it);
  if (!data) return;
  await finish(id, data);
  toast('Wartung abgeschlossen', { tone: 'success' });
}

async function reopen(id) {
  await finish(id, { erledigt: false, erledigt_am: '', erledigt_durch: '' });
  toast('Erledigung zurückgenommen', { tone: 'warning' });
}

async function ensureUser() {
  if (state.user) return true;
  const r = await userDialog('Name für die Protokollierung', 'Übernehmen',
    'Der Name wird bei jeder Erledigung als „erledigt durch" gespeichert.', CONFIG.currentUser || '');
  if (!r) return false;
  applyUser(r.name);
  return true;
}

function userDialog(title, primary, hint, current) {
  return modal({
    title: title,
    bodyHtml:
      '<p class="t-body" style="margin-bottom:12px">' + hint + '</p>' +
      '<div class="fld"><label for="mUser">Vor- und Nachname</label>' +
      '<input class="inp" id="mUser" value="' + esc(current) + '" placeholder="Name, Vorname"></div>',
    primary: primary,
    collect: (s) => ({ name: s.querySelector('#mUser').value.trim() }),
    validate: (d) => d.name ? null : 'Bitte einen Namen angeben.'
  });
}

function applyUser(name) {
  state.user = name;
  try { localStorage.setItem(CONFIG.userKey, name); } catch {}
  render();
}

function settingsDialog() {
  return modal({
    title: 'Einstellungen',
    primary: 'Speichern',
    bodyHtml:
      '<div class="fld"><label>Design</label>' +
        '<div class="status-seg" id="sTheme">' +
          ['light', 'dark', 'auto'].map(t =>
            '<button type="button" class="seg-btn" data-theme="' + t + '" aria-pressed="' + (settings.theme === t) + '">' +
            ({ light: 'Hell', dark: 'Dunkel', auto: 'Automatisch' })[t] + '</button>').join('') +
        '</div></div>' +
      '<div class="fld"><label for="sMail">Standard-Teilnehmer für Termine</label>' +
        '<input class="inp" id="sMail" value="' + esc(settings.dispoMail) + '"></div>' +
      '<div class="fld"><label for="sUser">Mein Name</label>' +
        '<input class="inp" id="sUser" value="' + esc(state.user) + '"></div>',
    collect: (s) => ({
      theme: s.querySelector('#sTheme button[aria-pressed="true"]').dataset.theme,
      dispoMail: s.querySelector('#sMail').value.trim(),
      user: s.querySelector('#sUser').value.trim()
    }),
    onMount: (s) => {
      s.querySelector('#sTheme').addEventListener('click', e => {
        const b = e.target.closest('[data-theme]'); if (!b) return;
        s.querySelectorAll('#sTheme button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        settings.theme = b.dataset.theme;
        applyTheme();
      });
    }
  }).then((d) => {
    if (!d) return false;
    settings.dispoMail = d.dispoMail || CONFIG.dispoMail;
    settings.theme = d.theme;
    saveSettings();
    applyTheme();
    if (d.user && d.user !== state.user) applyUser(d.user);
    render();
    toast('Einstellungen gespeichert', { tone: 'success' });
    return true;
  });
}

function exportCsv() {
  const list = filtered(state.items);
  const cols = ['id', 'objekt_nr', 'objekt_name', 'taetigkeit', 'kommentar', 'ab', 'bis', 'zustaendig', 'erledigt', 'erledigt_am'];
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [cols.join(';')].concat(list.map(i => cols.map(c => q(i[c])).join(';'))).join('\r\n');
  download('wartungen_' + isoStamp() + '.csv', '\uFEFF' + csv, 'text/csv');
}
function exportJson() {
  download('wartungen_' + isoStamp() + '.json', JSON.stringify(filtered(state.items), null, 2));
}

function shortcutsDialog() {
  const rows = [['/', 'Suche fokussieren'], ['↑ ↓', 'Zeilen durchlaufen'], ['Enter', 'Details öffnen'],
    ['E', 'Position abhaken'], ['M', 'Ansicht wechseln'], ['P', 'Drucken'], ['Esc', 'Schließen']];
  modal({
    title: 'Tastenkürzel',
    primary: 'Schließen',
    bodyHtml: '<dl style="display:grid;grid-template-columns:100px 1fr;gap:6px 12px">' + rows.map(r =>
      '<dt class="t-mono" style="font-size:12px;color:var(--text-secondary)">' + esc(r[0]) + '</dt>' +
      '<dd class="t-body">' + esc(r[1]) + '</dd>').join('') + '</dl>'
  });
}
