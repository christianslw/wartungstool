/* Wartungstool · JS · Kalender (Monats- und Jahresansicht)
   ---------------------------------------------------------------------------
   Vierte Ansicht neben Liste/Kacheln/Blasen. Zeigt je Tag:
     · überfällige, bald fällige und offene Punkte (auf ihrer Frist `bis`)
     · erledigte Punkte (auf dem Erledigungsdatum `erledigt_am`)
     · Abschaltungen (Sendestandort, Zeitraum, betroffene Dienste)
   Wochenenden und Feiertage (RLP + BW) sind schraffiert/rot hinterlegt.
   Monat/Jahr sind über den Kopf wählbar; zusätzlich gibt es eine Jahresansicht.

   Abschaltungen kommen spaeter aus dem Backend; im Dev-/Offline-Betrieb
   liefert sie der LocalStore (siehe 32-store-local.js, devSeedAbschaltungen). */

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const KAL_MAX = 4;                 // Chips je Tag, Rest als "+N"
const KAL_NOTIF_TAGE = 14;         // Vorlauf fuer Abschaltungs-Hinweise

/* Kategorien: Status-Kategorien + Abschaltungen. Reihenfolge = Dringlichkeit. */
const KAL_CATS = [
  { key: 'over', stateKey: 'kalOver', label: 'Überfällig' },
  { key: 'soon', stateKey: 'kalSoon', label: 'Bald fällig' },
  { key: 'open', stateKey: 'kalOpen', label: 'Offen' },
  { key: 'done', stateKey: 'kalDone', label: 'Erledigt' },
  { key: 'abs',  stateKey: 'kalAbs',  label: 'Abschaltungen' }
];
/* statusOf() → Kategorie: geplant zählt als offen. */
const KAL_STATUS = { over: 'kalOver', soon: 'kalSoon', open: 'kalOpen', plan: 'kalOpen', done: 'kalDone' };

/* ---------------------------------------------------------------- Modell */
const ABSA_FIELDS = { objekt_nr: '', objekt_name: '', sender: '', von: '', bis: '', dienste: [], arbeiten: '' };

/** Abschaltung eines Sendestandorts auf ein einheitliches Modell bringen. */
function normalizeAbschaltung(r, idx = 0) {
  const dienste = Array.isArray(r && r.dienste)
    ? r.dienste.map(String)
    : String((r && r.dienste) || '').split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  return Object.assign({}, ABSA_FIELDS, r, { id: (r && r.id) ?? (idx + 1), dienste });
}

/** Datum mit optionaler Uhrzeit ("TT.MM.JJJJ" oder "TT.MM.JJJJ HH:MM") → Date. */
function parseDateTime(s) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  return (d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) ? d : null;
}

/** Dev-Beispiel-Abschaltungen: relativ zu heute, damit im Dev-Betrieb sofort
    etwas zu sehen ist. ponytail: statischer Beispielbestand – durch echte
    Backend-Daten (/api/abschaltungen) ersetzen, sobald vorhanden. */
function devSeedAbschaltungen() {
  const d = new Date();
  const tag = (n) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return p2(x.getDate()) + '.' + p2(x.getMonth() + 1) + '.' + x.getFullYear();
  };
  return [
    { id: 1, objekt_nr: '9200', objekt_name: 'Bad Mergentheim', sender: 'Sender Bad Mergentheim',
      von: tag(2) + ' 06:00', bis: tag(2) + ' 14:00', dienste: ['DAB+', 'DVB-T2', 'UKW'],
      arbeiten: 'Beispiel – Erneuerung der Sendeantenne' },
    { id: 2, objekt_nr: '8600', objekt_name: 'Weinsberg', sender: 'Sender Weinsberg',
      von: tag(9) + ' 22:00', bis: tag(10) + ' 05:00', dienste: ['UKW'],
      arbeiten: 'Beispiel – Wartung der Senderanlage' }
  ];
}

/* ------------------------------------------------------------- Feiertage
   Gesetzliche Feiertage der Länder Rheinland-Pfalz und Baden-Württemberg
   (Vereinigungsmenge; beide teilen Fronleichnam und Allerheiligen, BW hat
   zusätzlich Heilige Drei Könige). Bewegliche Feste über die Osterformel –
   gilt für jedes Jahr, ist also immer aktuell. ponytail: fest auf RLP+BW –
   weitere Länder bräuchten eigene Regeln. */
const FEIERTAG_FIX = [
  [1, 1, 'Neujahr'], [5, 1, 'Tag der Arbeit'], [10, 3, 'Tag der Deutschen Einheit'],
  [12, 25, '1. Weihnachtstag'], [12, 26, '2. Weihnachtstag'],
  [1, 6, 'Heilige Drei Könige'], [11, 1, 'Allerheiligen']
];
const FEIERTAG_OSTERN = [
  [-2, 'Karfreitag'], [1, 'Ostermontag'], [39, 'Christi Himmelfahrt'],
  [50, 'Pfingstmontag'], [60, 'Fronleichnam']
];
const FEIERTAGE_CACHE = new Map();

/** Ostersonntag (Gauß/Meeus). */
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

/** Feiertage eines Jahres als Map "JJJJ-MM-TT" → Name. */
function feiertage(year) {
  if (FEIERTAGE_CACHE.has(year)) return FEIERTAGE_CACHE.get(year);
  const map = new Map();
  for (const [m, d, name] of FEIERTAG_FIX) map.set(year + '-' + p2(m) + '-' + p2(d), name);
  const e = easterSunday(year);
  for (const [off, name] of FEIERTAG_OSTERN)
    map.set(isoDay(new Date(e.getFullYear(), e.getMonth(), e.getDate() + off)), name);
  FEIERTAGE_CACHE.set(year, map);
  return map;
}
function feiertagName(d) { return feiertage(d.getFullYear()).get(isoDay(d)) || ''; }

/* ---------------------------------------------------------------- Ereignisse */
const isoDay = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const uhrzeit = (s) => { const m = /(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? p2(+m[1]) + ':' + m[2] : ''; };

/** Alle Kalendereintraege des aktuellen Bereichs, gefiltert nach Suche und
    Kategorien. Jeder Eintrag: { tag: Date, art, item? , abs? }. */
function kalenderEvents() {
  const q = norm(state.query);
  const evs = [];
  for (const it of bereichListe(state.bereich)) {
    if (!matchesQuery(it, q)) continue;
    if (it.erledigt) {
      if (!state.kalDone) continue;
      const d = parseDate(it.erledigt_am) || parseDate(it.bis);
      if (d) evs.push({ tag: d, art: 'done', item: it });
    } else {
      const s = statusOf(it);
      if (!state[KAL_STATUS[s] || 'kalOpen']) continue;
      const d = parseDate(it.bis);
      if (d) evs.push({ tag: d, art: s === 'plan' ? 'open' : s, item: it });
    }
  }
  if (state.kalAbs) {
    for (const a of state.abschaltungen || []) {
      const von = parseDateTime(a.von), bis = parseDateTime(a.bis) || von;
      if (!von) continue;
      if (q && !matchesQuery({ objekt_nr: a.objekt_nr, objekt_name: a.objekt_name,
        taetigkeit: a.arbeiten, kommentar: (a.sender || '') + ' ' + a.dienste.join(' '), erledigt: false }, q)) continue;
      const ende = new Date(bis.getFullYear(), bis.getMonth(), bis.getDate());
      for (const d = new Date(von.getFullYear(), von.getMonth(), von.getDate()); d <= ende; d.setDate(d.getDate() + 1)) {
        evs.push({ tag: new Date(d), art: 'abs', abs: a });
      }
    }
  }
  return evs;
}

const evRank = (e) => e.art === 'abs' ? 0 : e.art === 'done' ? 4 : (STATUS_RANK[e.art] ?? 2);

/* ---------------------------------------------------------------- Chips */
/** Abschaltungs-Chip; mit `frac` bekommt er Position/Höhe im Tagesrechteck. */
function kalChip(e, frac) {
  if (e.art === 'abs') {
    const a = e.abs;
    const title = [(a.objekt_nr ? a.objekt_nr + ' ' : '') + (a.objekt_name || ''), a.sender,
      a.von + (a.bis ? ' – ' + a.bis : ''), (a.dienste || []).join(', '), a.arbeiten]
      .filter(Boolean).join(' · ');
    const style = frac ? ' style="top:' + (frac.top * 100).toFixed(1) + '%;height:' + (frac.h * 100).toFixed(1) + '%"' : '';
    return '<button class="kal-ev ev-abs' + (frac ? ' kal-timed' : '') + '" data-kalabs="' + esc(a.id) + '" title="' + esc(title) + '"' + style + '>' +
      '<span class="t">' + esc((a.dienste || []).join(' · ') || a.objekt_name || 'Abschaltung') + '</span>' +
      '<span class="sub">' + esc(a.objekt_nr || uhrzeit(a.von)) + '</span></button>';
  }
  const it = e.item;
  const title = [(it.objekt_nr ? it.objekt_nr + ' ' : '') + it.objekt_name, it.taetigkeit,
    it.erledigt ? 'erledigt ' + (it.erledigt_am || '') : 'fällig ' + (it.bis || ''),
    istToDo(it) ? 'To-Do' : ''].filter(Boolean).join(' · ');
  return '<button class="kal-ev ev-' + e.art + '" data-kalitem="' + esc(keyOf(it)) + '" title="' + esc(title) + '">' +
    '<span class="t">' + esc(it.taetigkeit || it.objekt_name || '–') + '</span>' +
    '<span class="sub">' + esc(it.objekt_nr || '') + '</span></button>';
}

/* ---------------------------------------------------------------- Kopfleiste */
function kalBarHtml(evs) {
  const y = state.kalJahr, m = state.kalMonat;
  const imZeitraum = (e) => state.kalView === 'year'
    ? e.tag.getFullYear() === y
    : (e.tag.getFullYear() === y && e.tag.getMonth() === m);
  const cnt = (art) => evs.filter(e => e.art === art && imZeitraum(e)).length;
  const navBtn = (dir, label, cls) =>
    '<button class="td-act ' + cls + '" data-kalnav="' + dir + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + svg(ICON.chevR, 14) + '</button>';
  const vt = (v, l) => '<button class="kal-vbtn' + (state.kalView === v ? ' on' : '') + '" data-kalview="' + v + '" aria-pressed="' + (state.kalView === v) + '">' + l + '</button>';
  const titel = state.kalView === 'year' ? String(y) : MONATE[m] + ' ' + y;

  return '<div class="kal-bar">' +
    '<div class="kal-nav">' +
      navBtn('prev', state.kalView === 'year' ? 'Voriges Jahr' : 'Voriger Monat', 'kal-prev') +
      '<span class="kal-pick-host">' +
        '<button class="kal-title" data-kaltitle="1" aria-haspopup="dialog" aria-expanded="' + state.kalPicker + '" title="Monat und Jahr wählen">' + titel + '</button>' +
        (state.kalPicker ? kalPickerHtml() : '') +
      '</span>' +
      navBtn('next', state.kalView === 'year' ? 'Nächstes Jahr' : 'Nächster Monat', '') +
      '<button class="kal-today" data-kalnav="today" title="Zum heutigen Tag">Heute</button>' +
    '</div>' +
    '<div class="kal-view">' + vt('month', 'Monat') + vt('year', 'Jahr') + '</div>' +
    '<div class="kal-cats">' + KAL_CATS.map(c =>
      '<button class="kal-cat" data-kalcat="' + c.key + '" aria-pressed="' + !!state[c.stateKey] + '" title="Kategorie ein-/ausblenden">' +
      '<span class="dot"></span><span class="t">' + esc(c.label) + '</span> <span class="n">' + cnt(c.key) + '</span></button>').join('') +
    '</div>' +
  '</div>';
}

/** Monat/Jahr-Auswahl als Pop-up an der Titelzeile. */
function kalPickerHtml() {
  const y = state.kalJahr;
  return '<div class="kal-pick">' +
    '<div class="kal-pick-head">' +
      '<button class="td-act kal-prev" data-kalyear="-1" title="Voriges Jahr" aria-label="Voriges Jahr">' + svg(ICON.chevR, 14) + '</button>' +
      '<span class="kal-pick-y">' + y + '</span>' +
      '<button class="td-act" data-kalyear="1" title="Nächstes Jahr" aria-label="Nächstes Jahr">' + svg(ICON.chevR, 14) + '</button>' +
    '</div>' +
    '<div class="kal-pick-grid">' + MONATE.map((n, i) =>
      '<button class="kal-pick-m' + (i === state.kalMonat ? ' on' : '') + '" data-kalmonth="' + i + '">' + n + '</button>').join('') +
    '</div>' +
  '</div>';
}

/* ---------------------------------------------------------------- Monatsansicht */

/** Anteil des Tages (0..1), den eine Abschaltung an diesem Tag belegt: aus
    von/bis anteilig zur Tageshöhe; ohne Uhrzeit (ganztägig) der ganze Tag. */
function absTagesanteil(a, day) {
  const start0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (!/:/.test(String(a.von || '')) && !/:/.test(String(a.bis || ''))) return { top: 0, h: 1 };
  const end0 = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const von = parseDateTime(a.von) || start0;
  const bis = parseDateTime(a.bis) || von;
  const s = Math.max(start0, Math.min(von, end0));
  const e = Math.max(s, Math.min(bis > von ? bis : end0, end0));
  if (e <= s) return null;
  const top = (s - start0) / 86400000;
  return { top, h: Math.max(0.05, (e - s) / 86400000) };
}

function kalMonthHtml(evs, y, m) {
  const byDay = new Map();
  for (const e of evs) {
    const k = isoDay(e.tag);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));   // Montag als Wochenstart
  const heuteKey = isoDay(new Date());

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = isoDay(d);
    const dayEvs = (byDay.get(key) || []).slice().sort((a, b) => evRank(a) - evRank(b));
    const ft = feiertagName(d);
    const wknd = d.getDay() === 0 || d.getDay() === 6;
    const cls = 'kal-cell' + (d.getMonth() === m ? '' : ' out') + (key === heuteKey ? ' today' : '') +
      (ft ? ' feiertag' : (wknd ? ' wknd' : ''));
    const max = state.kalDayMax || KAL_MAX;
    const absEvs = dayEvs.filter(e => e.art === 'abs');
    const chipEvs = dayEvs.filter(e => e.art !== 'abs');
    const mehr = chipEvs.length > max ? '<span class="kal-more">+' + (chipEvs.length - max) + '</span>' : '';
    const absChips = absEvs.map(e => kalChip(e, absTagesanteil(e.abs, d))).join('');
    cells += '<div class="' + cls + '"' + (ft ? ' title="' + esc(ft) + '"' : '') + '>' +
      '<span class="kal-daynum">' + d.getDate() + '</span>' +
      (ft ? '<span class="kal-holiday">' + esc(ft) + '</span>' : '') +
      '<div class="kal-evs">' + chipEvs.slice(0, max).map(e => kalChip(e)).join('') + mehr + '</div>' +
      '<div class="kal-abs">' + absChips + '</div></div>';
  }
  return '<div class="kal-grid">' +
    WOCHENTAGE.map((w, i) => '<div class="kal-dow' + (i >= 5 ? ' wknd' : '') + '">' + w + '</div>').join('') +
    cells + '</div>' +
    (state.kalAbs && !(state.abschaltungen || []).length
      ? '<p class="t-helper">Keine Abschaltungen vorhanden.</p>' : '');
}

/* ---------------------------------------------------------------- Jahresansicht
   Je Monatskachel die offenen Punkte auflisten – so viele, wie laut
   fitKalHeight() auf den Bildschirm passen; der Rest wird "+N weitere".
   Dezente Trennlinien zwischen den Punkten, eine unter dem Monatskopf. */
function kalYearHtml(evs, y) {
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const e of evs) {
    if (e.tag.getFullYear() !== y) continue;
    if (e.art !== 'over' && e.art !== 'soon' && e.art !== 'open') continue;
    byMonth[e.tag.getMonth()].push(e);
  }
  const heute = new Date();
  const cap = Math.max(1, state.kalYearMax || 8);
  return '<div class="kal-ygrid">' + MONATE.map((name, i) => {
    const now = heute.getFullYear() === y && heute.getMonth() === i;
    const month = byMonth[i].slice().sort((a, b) => (evRank(a) - evRank(b)) || (a.tag - b.tag));
    const overflow = month.length > cap;
    const shown = overflow ? month.slice(0, cap - 1) : month;
    const rows = shown.map(e => {
      const it = e.item;
      return '<span class="kal-yrow r-' + e.art + '">' +
        '<span class="t" title="' + esc([it.taetigkeit, it.objekt_nr, it.objekt_name].filter(Boolean).join(' · ')) + '">' +
          esc(it.taetigkeit || it.objekt_name || '–') + '</span>' +
        '<span class="n">' + esc(it.objekt_nr || '') + '</span></span>';
    }).join('') + (overflow
      ? '<span class="kal-yrow more">+' + (month.length - shown.length) + ' weitere</span>' : '');
    return '<button class="kal-ycell' + (now ? ' now' : '') + '" data-kalmonthtile="' + i + '">' +
      '<span class="kal-yhead"><span class="kal-ym">' + name + '</span>' +
      '<span class="kal-yn">' + month.length + ' offen</span></span>' +
      (rows ? '<span class="kal-ypoints">' + rows + '</span>' : '<span class="kal-yempty">–</span>') +
      '</button>';
  }).join('') + '</div>' +
    (state.kalAbs && !(state.abschaltungen || []).length
      ? '<p class="t-helper">Keine Abschaltungen vorhanden.</p>' : '');
}

/** So viele Punktzeilen passen wirklich in eine Zelle des aktuellen
    Bildschirms (Monatsraster: `.kal-evs`, Jahresraster: `.kal-ypoints`); der
    Rest wird als "+N" gezeigt. Die Kapazität wird je Rendern an der gemessenen
    Zellenhöhe ausgerichtet, damit die Punkte ihren Platz anteilig füllen. */
function fitKalHeight() {
  const host = $('#tableHost');
  if (!host || typeof host.querySelectorAll !== 'function') return;
  if (state.kalView === 'year') {
    const box = $$('.kal-ypoints', host).find(b => b.querySelector && b.querySelector('.kal-yrow'));
    const h = box && box.getBoundingClientRect ? box.getBoundingClientRect().height : 0;
    const rh = box && box.querySelector('.kal-yrow').getBoundingClientRect
      ? box.querySelector('.kal-yrow').getBoundingClientRect().height : 0;
    if (!h || !rh) return;
    const max = Math.max(1, Math.floor(h / (rh + 2)));
    if (max !== state.kalYearMax) { state.kalYearMax = max; renderBody(); }
    return;
  }
  const box = $$('.kal-evs', host).find(b => b.querySelector && b.querySelector('.kal-ev'));
  const h = box && box.getBoundingClientRect ? box.getBoundingClientRect().height : 0;
  const rh = box && box.querySelector('.kal-ev').getBoundingClientRect
    ? box.querySelector('.kal-ev').getBoundingClientRect().height : 0;
  if (!h || !rh) return;
  const max = Math.max(1, Math.floor(h / (rh + 2)));
  if (max !== state.kalDayMax) { state.kalDayMax = max; renderBody(); }
}

/* ---------------------------------------------------------------- Einstieg */
function viewCalendar() {
  const evs = kalenderEvents();
  const body = state.kalView === 'year'
    ? kalYearHtml(evs, state.kalJahr)
    : kalMonthHtml(evs, state.kalJahr, state.kalMonat);
  return '<div class="kal kal-' + state.kalView + '">' + kalBarHtml(evs) + body + '</div>';
}

/* ---------------------------------------------------------------- Aktionen */
function toggleKalCategory(k) {
  const cat = KAL_CATS.find(c => c.key === k);
  if (!cat) return;
  state[cat.stateKey] = !state[cat.stateKey];
  render();
}

function kalViewSet(v) {
  if (v !== 'month' && v !== 'year') return;
  state.kalView = v;
  state.kalPicker = false;
  render();
}

function toggleKalPicker() {
  state.kalPicker = !state.kalPicker;
  render();
}

function kalJahrVerschieben(step) {
  state.kalJahr += step;
  render();
}

function kalMonatWaehlen(i) {
  state.kalMonat = Number(i);
  state.kalView = 'month';
  state.kalPicker = false;
  render();
}

function kalNav(dir) {
  state.kalPicker = false;
  if (dir === 'today') {
    const n = new Date();
    state.kalJahr = n.getFullYear();
    state.kalMonat = n.getMonth();
  } else if (state.kalView === 'year') {
    state.kalJahr += dir === 'next' ? 1 : -1;
  } else {
    const d = new Date(state.kalJahr, state.kalMonat + (dir === 'next' ? 1 : -1), 1);
    state.kalJahr = d.getFullYear();
    state.kalMonat = d.getMonth();
  }
  render();
}

function openAbschaltung(id) {
  const a = (state.abschaltungen || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const row = (l, v) => '<div class="abs-row"><span class="abs-l">' + esc(l) + '</span><span class="abs-v">' + esc(v || '–') + '</span></div>';
  return modal({
    title: 'Abschaltung',
    bodyHtml: '<div class="abs-det">' +
      row('Standort', (a.objekt_nr ? a.objekt_nr + ' ' : '') + (a.objekt_name || '')) +
      (a.sender ? row('Sender', a.sender) : '') +
      row('Zeitraum', a.von + (a.bis ? ' – ' + a.bis : '')) +
      row('Dienste', (a.dienste || []).join(', ')) +
      row('Arbeiten', a.arbeiten) +
    '</div>',
    primary: 'Schließen', secondary: ''
  });
}

/** Hinweise für anstehende Abschaltungen (max. 3, Vorlauf KAL_NOTIF_TAGE). */
function abschaltungNotifs() {
  const jetzt = new Date();
  const grenze = new Date(jetzt.getTime() + KAL_NOTIF_TAGE * 86400000);
  const kommend = (state.abschaltungen || [])
    .map(a => ({ a, ab: parseDateTime(a.von), bis: parseDateTime(a.bis) || parseDateTime(a.von) }))
    .filter(x => x.ab && x.bis >= jetzt && x.ab <= grenze)
    .sort((x, y) => x.ab - y.ab)
    .slice(0, 3);
  for (const { a } of kommend) {
    const detail = [(a.dienste || []).join(' · '), a.von + (a.bis ? '–' + a.bis : ''), a.arbeiten]
      .filter(Boolean).join('  ·  ');
    toast('Abschaltung ' + (a.objekt_name || a.objekt_nr || a.sender || ''), {
      tone: 'warning', detail, ms: 12000,
      action: () => { if ((activeTab() || {}).home) openStandard('all'); setView('calendar'); },
      actionLabel: 'Kalender'
    });
  }
}

$('#tableHost').addEventListener('click', e => {
  const cat = e.target.closest('[data-kalcat]');
  if (cat) return toggleKalCategory(cat.dataset.kalcat);
  const cv = e.target.closest('[data-kalview]');
  if (cv) return kalViewSet(cv.dataset.kalview);
  const title = e.target.closest('[data-kaltitle]');
  if (title) return toggleKalPicker();
  const nav = e.target.closest('[data-kalnav]');
  if (nav) return kalNav(nav.dataset.kalnav);
  const jahr = e.target.closest('[data-kalyear]');
  if (jahr) return kalJahrVerschieben(Number(jahr.dataset.kalyear) || 0);
  const mon = e.target.closest('[data-kalmonth]');
  if (mon) return kalMonatWaehlen(mon.dataset.kalmonth);
  const tile = e.target.closest('[data-kalmonthtile]');
  if (tile) return kalMonatWaehlen(tile.dataset.kalmonthtile);
  const abs = e.target.closest('[data-kalabs]');
  if (abs) return openAbschaltung(abs.dataset.kalabs);
  const item = e.target.closest('[data-kalitem]');
  if (item) {
    const rec = findByKey(item.dataset.kalitem);
    if (!rec) return;
    return istToDo(rec) ? todoDialog(keyOf(rec)) : openPanel(rec.id);
  }
});
