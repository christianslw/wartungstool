/* Wartungstool · JS · Formatierung, Status, Dialog-Grundlagen */
const norm = (v) => String(v ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();

function matchesQuery(it, q) {
  if (!q) return true;
  const hay = norm([it.objekt_art, it.objekt_nr, it.objekt_name, it.beschreibung, it.taetigkeit,
    it.kommentar, it.zustaendig, it.erledigt ? 'erledigt abgeschlossen' : 'offen',
    it.erledigt_am, it.erledigt_durch, it.erledigt_notiz].join(' '));
  return q.split(/\s+/).filter(Boolean).every(t => hay.includes(t));
}

function parseDate(s) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return (d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) ? d : null;
}
const p2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => d ? p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() : '';
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
/** Aktuelles Kalenderjahr als Zeichenkette (Vorgabe des Jahresfilters). */
const aktuellesJahr = () => String(new Date().getFullYear());
const dayDiff = (a, b) => Math.round((a - b) / 86400000);
const isoStamp = () => { const d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()); };

function maskDate(v) {
  const d = String(v).replace(/[^\d]/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 4);
  if (d.length > 4) out += '.' + d.slice(4, 8);
  return out;
}

function dueInfo(bis) {
  const d = parseDate(bis);
  if (!d) return { text: bis ? 'bis ' + bis : 'ohne Frist', cls: 'ok' };
  const n = dayDiff(d, today());
  if (n < 0)  return { text: 'überfällig seit ' + Math.abs(n) + ' T', cls: 'late' };
  if (n === 0) return { text: 'heute fällig', cls: 'late' };
  if (n === 1) return { text: 'morgen fällig', cls: 'soon' };
  if (n <= CONFIG.soonDays) return { text: 'noch ' + n + ' T', cls: 'soon' };
  return { text: 'noch ' + n + ' T', cls: 'ok' };
}

function statusOf(it) {
  if (it.erledigt) return 'done';
  const bis = parseDate(it.bis), ab = parseDate(it.ab), t = today();
  if (bis && bis < t) return 'over';
  if (bis && dayDiff(bis, t) <= CONFIG.soonDays) return 'soon';
  if (ab && ab > t) return 'plan';
  return 'open';
}
const STATUS = {
  done: { label: 'Erledigt',    tone: 'green'  },
  over: { label: 'Überfällig',  tone: 'red'    },
  soon: { label: 'Bald fällig', tone: 'yellow' },
  open: { label: 'Offen',       tone: 'blue'   },
  plan: { label: 'Geplant',     tone: 'gray'   }
};
const STATUS_ORDER = { over: 0, soon: 1, open: 2, plan: 3, done: 4 };

const uniq = (a) => Array.from(new Set(a.filter(v => v !== undefined && v !== null && String(v).trim() !== '')))
  .sort((x, y) => String(x).localeCompare(String(y), 'de'));

function download(name, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function toast(text, { tone = 'info', detail = '', ms = 4000, action, actionLabel } = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  const ico = { success: ICON.check, warning: ICON.warn, error: ICON.warn, info: ICON.info }[tone] || ICON.info;
  el.innerHTML = '<span class="ti">' + svg(ico, 14) + '</span>' +
    '<span class="txt">' + esc(text) + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</span>' +
    (action ? '<button class="btn btn-sm btn-ghost act">' + esc(actionLabel || 'Rückgängig') + '</button>' : '') +
    '<button class="x" aria-label="Schließen">' + svg(ICON.close, 12) + '</button>';
  if (action) el.querySelector('.act').onclick = () => { action(); el.remove(); };
  el.querySelector('.x').onclick = () => el.remove();
  $('#toasts').appendChild(el);
  if (ms) setTimeout(() => el.remove(), ms);
}

function modal({ title, bodyHtml, primary = 'Speichern', secondary = 'Abbrechen', danger = false,
                 collect, validate, onMount, tertiary, onTertiary }) {
  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<header><h3>' + esc(title) + '</h3>' +
          '<button class="close" data-x aria-label="Schließen">' + svg(ICON.close, 16) + '</button></header>' +
        '<div class="body">' + bodyHtml + '</div>' +
        '<div class="foot">' +
          (tertiary ? '<button class="btn btn-ghost" data-tertiary>' + esc(tertiary) + '</button>' : '') +
          '<span style="flex:1"></span>' +
          (secondary ? '<button class="btn btn-tertiary" data-cancel>' + esc(secondary) + '</button>' : '') +
          '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(primary) + '</button>' +
        '</div>' +
      '</div>';
    const done = (v) => { scrim.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const tryOk = () => {
      const data = collect ? collect(scrim) : null;
      const err = validate ? validate(data) : null;
      if (err) { toast(err, { tone: 'warning' }); return; }
      done(data);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tryOk(); }
    };
    scrim.addEventListener('click', e => {
      if (e.target === scrim || e.target.closest('[data-x]') || e.target.closest('[data-cancel]')) done(null);
      else if (e.target.closest('[data-tertiary]')) {
        if (onTertiary && onTertiary(scrim) === false) return;
        tryOk();
      }
      else if (e.target.closest('[data-ok]')) tryOk();
    });
    document.addEventListener('keydown', onKey);
    $('#overlay').appendChild(scrim);
    if (onMount) onMount(scrim);
    else { const f = scrim.querySelector('input,textarea'); if (f) setTimeout(() => f.focus(), 30); }
  });
}
