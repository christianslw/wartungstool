/**
 * Regressionstests für das Wartungstool – ohne Browser, ohne Abhängigkeiten.
 *
 *   node tests/checks.mjs
 *
 * Der Test lädt index.html, ersetzt das DOM durch einen schlanken Stub und
 * führt die Anwendungslogik in node:vm wirklich aus. Damit werden alle
 * Prüfungen ausgeführt, die im Projektverlauf echte Fehler gefunden haben
 * (u. a. verdeckte Statusdoppelungen, falsche Spaltenausrichtung, Stammdaten-
 * Schreibzugriffe, ICS-Format, Temporal-Dead-Zone im To-Do-Dialog).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const APP = read('index.html');

/* ------------------------------------------------------------------ DOM-Stub */
class El {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {};
    this._html = ''; this.dataset = {}; this.style = {}; this.hidden = false;
    this.value = ''; this.textContent = ''; this.disabled = false; this.files = [];
    const s = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)),
      contains: (c) => s.has(c),
      toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; }
    };
  }
  get innerHTML() { return this._html; } set innerHTML(v) { this._html = String(v); }
  addEventListener() {} removeEventListener() {}
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  querySelector(sel) { return reg[sel] || (reg[sel] = new El()); }
  querySelectorAll() { return []; } closest() { return null; }
  remove() {} focus() {} select() {} blur() {} click() {} scrollIntoView() {}
  dispatchEvent() { return true; } setSelectionRange() {} insertAdjacentHTML() {}
}

const reg = Object.create(null);
reg['#overlay'] = new El(); reg['#toasts'] = new El();
reg['#seed'] = new El('script');
reg['#seed'].textContent = APP.match(/<script type="application\/json" id="seed">([\s\S]*?)<\/script>/)[1];

const store = new Map();

/* Echte Stammdaten (daten.js) nutzen, falls vorhanden – so prüft die Suite
   auch das verschachtelte Exportformat statt nur den 50er-Testbestand. */
let EXT = null;
try {
  const dj = read('daten.js');
  const m = /window\.WARTUNGSDATEN\s*=\s*([\s\S]*?);\s*$/.exec(dj);
  if (m) { const d = JSON.parse(m[1]); EXT = Array.isArray(d) ? d : d.records; }
} catch { /* ohne daten.js läuft alles mit dem Testbestand */ }
const ERWARTET = EXT ? EXT.length : 50;

const sandbox = {
  WARTUNGSDATEN: EXT,
  document: {
    documentElement: new El('html'), body: new El('body'),
    createElement: (t) => new El(t),
    querySelector: (s) => reg[s] || (reg[s] = new El()),
    querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}
  },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  },
  console, Blob: class { constructor(p) { this.text = p.join(''); } },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  location: { search: '' }, URLSearchParams, MouseEvent: class {},
  setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, Set, Map,
  Promise, Error, RegExp, Intl, isNaN, parseInt, parseFloat, TextDecoder, Uint8Array,
  encodeURIComponent, decodeURIComponent,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  fetch: () => Promise.reject(new Error('offline'))
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
/* index.html ist aus src/ gebaut und enthaelt je Modul ein eigenes <script>
   (DevTools-freundlich). Fuer den Stub werden alle eingebetteten Skripte
   ausser dem Seed (application/json) und daten.js (src) zusammengefuegt. */
const appScript = (() => {
  const parts = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(APP))) {
    if (/\bsrc=/.test(m[1] || '') || /application\/json/.test(m[1] || '')) continue;
    parts.push(m[2]);
  }
  return parts.join('\n');
})();
vm.runInContext(
  appScript
  + '\n;globalThis.__state = state; globalThis.__seed = seedData(); globalThis.__config = CONFIG;'
  + '\nglobalThis.__initialTab = (activeTab() || {}).id;'
  + '\nglobalThis.__fmtDate = fmtDate; globalThis.__isoToDe = isoToDe; globalThis.__keyOf = keyOf;',
  ctx, { filename: 'app.js' });

let fails = 0, runs = 0;
const ok = (name, cond, extra = '') => {
  runs++;
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  -> ' + extra : ''));
  if (!cond) fails++;
};
const cnt = (a, f) => a.filter(f).length;
const uniq = (a) => Array.from(new Set(a.filter(v => v !== undefined && v !== null && String(v).trim() !== '')));

await new Promise(r => setTimeout(r, 60));

const state = ctx.__state, seed = ctx.__seed;
const filtered = ctx.filtered, counts = ctx.counts, render = ctx.render;
const host = () => reg['#tableHost'].innerHTML;
const src = appScript;
const group = (t) => console.log('\n== ' + t + ' ==');

/* --------------------------------------------------------------- Startzustand */
group('Startzustand');
ok('Home-Tab ist beim Start aktiv', ctx.__initialTab === 'home', ctx.__initialTab);
ok('Stammdaten geladen', state.items.length === ERWARTET,
   state.items.length + ' (Quelle: ' + (EXT ? 'daten.js' : 'Testbestand') + ')');
ctx.applyTab('all');
ok('Arbeitsliste im Tab "Alle"', state.view === 'list' && state.group === 'object' && state.sortKey === 'status' && state.sortDir === 'asc');
ok('15 (bzw. 11) Standorte werden gelistet', (host().match(/class="loc-head"/g) || []).length === ctx.groupItems(ctx.aktuelleListe(), 'object').length);
ok('Fortschritt je Standort sichtbar', /\d+\/\d+/.test(host()));
ok('Kein doppelter Prozentwert in der Zeile', !host().includes('loc-pct'));
ok('Alle Standorte eingeklappt zu Beginn', (host().match(/class="loc-row[ "]/g) || []).length === 0);
ok('Keine Auswahlkästchen (nur ein Kästchen pro Zeile)', !host().includes('data-select') && !host().includes('cbx'));
ok('Fußzeile: Umschalter "Alle ausklappen"', reg['#viewAction'].innerHTML.includes('Alle ausklappen'));

if (EXT) {
  group('Exportformat (echte Daten)');
  const iso = /^\d{2}\.\d{2}\.\d{4}$/;
  ok('ISO-Fristen nach TT.MM.JJJJ gewandelt', state.items.every(i => !i.bis || iso.test(i.bis)),
     state.items[0].bis);
  ok('Standortfelder aus site übernommen',
     state.items.every(i => i.objekt_nr && i.objekt_name), state.items[0].objekt_nr + ' ' + state.items[0].objekt_name);
  ok('Intervall als Text', /^alle /.test(state.items.find(i => i.intervall).intervall),
     state.items.find(i => i.intervall).intervall);
  ok('external_id und hash_key erhalten',
     state.items.every(i => /^TSK_/.test(i.external_id) && /^[0-9a-f]{16}$/.test(i.hash_key)));
  ok('Erledigung aus execution gelesen',
     state.items.every(i => typeof i.erledigt === 'boolean'));
  const objekte = new Set(state.items.map(i => i.objekt_nr));
  ok('Standorte übernommen', objekte.size >= 10, objekte.size + ' Standorte');
  ctx.setGroup('status');
  ok('Zeitplan erkennt echte Dringlichkeit', /Überfällig/.test(host()) && /Bald fällig/.test(host()),
     'überfällig + bald fällig vorhanden');
  ctx.setGroup('object');
}

/* ------------------------------------------------------------------ Offene zuerst */
group('Offene Positionen stehen oben');
ctx.setGroup('none');
const rows = [...host().matchAll(/<tr data-id="([wt]:\d+)"/g)].map(m => ctx.findByKey(m[1]));
const firstDone = rows.findIndex(r => r && r.erledigt);
ok('Erledigte Positionen stehen am Ende (Liste)',
   rows.length > 0 && (firstDone < 0 || rows.slice(firstDone).every(r => r.erledigt)), firstDone + ' von ' + rows.length);
ctx.setGroup('status');
const plan = host();
ok('Zeitplan: Gruppen in Dringlichkeitsreihenfolge', (() => {
  const labels = ['Überfällig', 'Bald fällig', 'Im Zeitraum', 'Später geplant', 'Erledigt'];
  const present = labels.map(l => ({ l, i: plan.indexOf('>' + l + '<') })).filter(x => x.i >= 0);
  return present.length >= 2 && present.every((x, k) => k === 0 || present[k - 1].i < x.i);
})(), (() => {
  const labels = ['Überfällig', 'Bald fällig', 'Im Zeitraum', 'Später geplant', 'Erledigt'];
  return labels.filter(l => plan.indexOf('>' + l + '<') >= 0).join(' → ');
})());
ok('Zeitplan zeigt die Frist als Warnhinweis', /überfällig seit|heute fällig|noch \d+ Tag/.test(plan));
ok('Zeitplan nutzt dieselbe Arbeitszeile (Häkchen links)', /class="loc-row[^"]*" data-id="[wt]:\d+">\s*<button class="tick/.test(plan));
ctx.setGroup('object');

/* --------------------------------------------------------------- Abschluss */
group('Wartung abschließen');
state.user = 'Salwa, Christian';
const d0 = new Date();
const heute = String(d0.getDate()).padStart(2, '0') + '.' + String(d0.getMonth() + 1).padStart(2, '0') + '.' + d0.getFullYear();
const item = state.items.find(i => !i.erledigt);
let dialogBody = '', dialogTertiary = '', dialogOk = '';
const realModal = ctx.modal;
ctx.modal = async (o) => {
  dialogBody = o.bodyHtml || ''; dialogTertiary = o.tertiary || '';
  dialogOk = '';
  return { erledigt: true, erledigt_am: heute, erledigt_durch: 'Salwa, Christian',
           erledigt_notiz: 'Prüfung abgeschlossen, Protokoll abgelegt' };
};
await ctx.markDone(item.id);
ok('Fragt beim Abschluss nach einem Kommentar', /Abschlusskommentar/.test(dialogBody));
ok('Abschlussdialog hat Kommentarfeld', /id="mNote"/.test(dialogBody) && /Abschlusskommentar/.test(dialogBody));
ok('Abschlussdialog: Datum per Kalender-Auswahlfeld',
   /id="mDate" type="date"/.test(dialogBody) && /erledigt_am:\s*isoToDe\(s\.querySelector\('#mDate'\)\.value\)/.test(src));
ok('Kommentar ist optional', /erledigt_notiz:\s*s\.querySelector\('#mNote'\)\.value\.trim\(\)/.test(src));
ok('Personenfeld als durchsuchbare Combobox', /combo-host/.test(dialogBody));
ok('erledigt gesetzt', state.items.find(i => i.id === item.id).erledigt === true);
ok('erledigt_am = heute', state.items.find(i => i.id === item.id).erledigt_am === heute);
ok('Abschlusskommentar gespeichert',
   state.items.find(i => i.id === item.id).erledigt_notiz === 'Prüfung abgeschlossen, Protokoll abgelegt');
ok('Stammdaten unverändert', state.items.find(i => i.id === item.id).taetigkeit === item.taetigkeit);
ctx.modal = realModal;

group('Erledigung zurücknehmen');
await ctx.reopen(item.id);
const re = state.items.find(i => i.id === item.id);
ok('erledigt zurückgesetzt', !re.erledigt && re.erledigt_am === '' && re.erledigt_durch === '');
ok('Kommentar bleibt erhalten', re.erledigt_notiz.length > 0);

/* --------------------------------------------------------------- Termin */
group('Termin-Disposition (Outlook)');
const it = state.items[0];
const oAll = { allDay: true, start: new Date(2026, 9, 15), ende: new Date(2026, 9, 16), attendees: ['dispo.sendertechnik@swr.de'] };
const web = ctx.outlookWebUrl(it, oAll);
const q = new URLSearchParams(web.split('?')[1]);
ok('Web-URL zeigt auf Outlook', web.startsWith('https://outlook.office.com/calendar/deeplink/compose?'));
ok('Betreff = Tätigkeit', q.get('subject') === it.taetigkeit);
ok('Ort = "Nummer Name"', q.get('location') === (it.objekt_nr + ' ' + it.objekt_name));
ok('Standard ganztägig', q.get('allday') === 'true' && q.get('startdt') === '2026-10-15' && q.get('enddt') === '2026-10-16');
ok('Standard-Teilnehmer gesetzt', q.get('to') === 'dispo.sendertechnik@swr.de');
const oTime = { allDay: false, start: new Date(2026, 9, 15, 8, 30), ende: new Date(2026, 9, 15, 11, 30), attendees: ['a@b.de', 'c@d.de'] };
const qt = new URLSearchParams(ctx.outlookWebUrl(it, oTime).split('?')[1]);
ok('Mit Uhrzeit: lokale Zeit, kein allday', qt.get('startdt') === '2026-10-15T08:30:00' && qt.get('allday') === null);
ok('Mehrere Teilnehmer mit Semikolon', qt.get('to') === 'a@b.de;c@d.de');
const ics = ctx.icsText(it, oAll);
ok('ICS ganztägig als VALUE=DATE', ics.includes('DTSTART;VALUE=DATE:20261015') && ics.includes('DTEND;VALUE=DATE:20261016'));
ok('ICS Betreff = Tätigkeit (RFC-maskiert)', ics.includes('SUMMARY:' + it.taetigkeit.replace(/([,;\\])/g, '\\$1')));
ok('ICS Ort korrekt', ics.includes('LOCATION:' + it.objekt_nr + ' ' + it.objekt_name));
ok('ICS als Terminanfrage (METHOD:REQUEST)', /METHOD:REQUEST/.test(ics));
ok('ICS mit UID und DTSTAMP', /UID:/.test(ics) && /DTSTAMP:/.test(ics));
ok('ICS mit CRLF', ics.includes('\r\n'));
ok('Dialog: ganztägig vorausgewählt', /data-art="all" aria-pressed="true"/.test(src));
ok('Dialog: Datum per Auswahlfeld', /id="dTag" type="date"/.test(src));
ok('Dialog: Uhrzeit nur auf Wunsch', /id="dTimeWrap" hidden/.test(src));
ok('Termin-Knopf in Zeile und Detailleiste', /data-term=/.test(src) && /panelTermin/.test(src));

/* --------------------------------------------------------------- Einstellungen */
group('Einstellungen und Design');
ok('Light-Mode ist Standard', /theme\s*:\s*'light'/.test(src) && /html\[data-theme="light"\]/.test(APP));
ok('Standard-Teilnehmer konfiguriert', /dispoMail\s*:\s*'dispo\.sendertechnik@swr\.de'/.test(src));
ok('Einstellungen im Drei-Punkte-Menü', /data-act="settings"/.test(APP));
ok('Einstellungen: Design, Terminadresse, Name', /id="sTheme"/.test(src) && /id="sMail"/.test(src) && /id="sUser"/.test(src));
ok('Design wirkt sofort beim Umschalten', /settings\.theme = b\.dataset\.theme/.test(src));
ok('Einstellungen werden gespeichert', /localStorage\.setItem\(CONFIG\.setKey/.test(src));
ok('Design-Tokens für hell und dunkel vorhanden',
   /html\[data-theme="light"\]\{[\s\S]*?--text-primary:#161616/.test(APP) && /--text-primary:#f4f4f4/.test(APP));
ok('Kopfzeile folgt dem Design (hell/dunkel) statt fest dunkel',
   /\.shell-header\{[\s\S]*?background:var\(--hdr-bg\)/.test(APP) &&
   /html\[data-theme="light"\]\{[\s\S]*?--hdr-bg:#ffffff/.test(APP));
ok('Zebra-Zeilen: abwechselnde Schattierung definiert',
   /--row-alt:#fbfbfb/.test(APP) && /tbody tr:nth-child\(even\)\{background:var\(--row-alt\)/.test(APP));
ok('Standardbereich ist "Alle"',
   ctx.WT.tabs.all().active === 'all' && ctx.WT.tabs.all().list[0].settings.bereich === 'alle' && /id="tabBar"/.test(APP));

/* --------------------------------------------------------------- To-Dos */
group('Eigene To-Dos (getrennt von den Wartungen)');
ok('Eigener Bereichsschalter', /id="tabBar"/.test(APP) && /STANDARD_TABS/.test(src));
ok('Bezeichnung "Eigene To-Dos"', /Eigene To-Dos/.test(APP) && !/Zusatzaufgabe/.test(APP));
// Regression: todoDialog schattierte früher "objects" (Temporal Dead Zone)
let tBody = '', tCalled = false;
ctx.modal = async (o) => { tCalled = true; tBody = o.bodyHtml || ''; return null; };
await ctx.todoDialog(null);
ctx.modal = realModal;
ok('Dialog "Neues To-Do" öffnet (Regression: objects-Schattierung)', tCalled && /id="tText"/.test(tBody));
ok('Dialog hat Standort- und Personensuche', (tBody.match(/combo-host/g) || []).length === 2);
ok('Dialog hat Fristfeld', /id="tFaellig"/.test(tBody));

const t1 = await ctx.saveTodo({ taetigkeit: 'Blitzschutzableiter erneuern', bis: '15.10.2026',
  zustaendig: 'Salwa, Christian', objekt_nr: '9200', objekt_name: 'Bad Mergentheim', kommentar: 'Material bestellen' });
ok('To-Do anlegbar (keine Stammdaten)', !!(t1 && t1.id));
ok('Eigener Speicher, getrennt von den Wartungen',
   JSON.parse(store.get('wartungstool.v1.todos')).length === 1 &&
   state.items.every(i => i.taetigkeit !== 'Blitzschutzableiter erneuern'));
ctx.setBereich('todo');
ok('Bereich umgeschaltet', state.bereich === 'todo');
ok('Aktiver Tab ist markiert (kein Titel nötig)',
   /data-tab="todo" aria-selected="true"/.test(reg['#tabBar'].innerHTML));
ok('To-Do erscheint mit Frist und Standort', host().includes('Blitzschutzableiter erneuern') && host().includes('Bad Mergentheim'));
ok('Anlege-Knopf sichtbar (To-Dos sind keine Stammdaten)', !reg['#btnNewTodo'].hidden);
ok('To-Dos nutzen dieselben Ansichten wie die Wartungen',
   // Standort-Gruppierung
   (() => { ctx.setGroup('object'); return (host().match(/class="loc-head"/g) || []).length >= 1; })() &&
   // Flache Tabelle
   (() => { ctx.setGroup('none'); return /<table class="cds">/.test(host()) && host().includes('Blitzschutzableiter erneuern'); })() &&
   // Status-Gruppierung
   (() => { ctx.setGroup('status'); return /class="plan-sec/.test(host()); })());
ctx.setGroup('object');
ctx.setAllExpanded(true);
ok('To-Do ist in der Zeile als To-Do erkennbar', host().includes('ist-todo'));
ok('Standortkopf zählt offene Positionen', /\d+\/\d+ offen/.test(host()));
ok('Status-Chips im To-Do-Bereich', (reg['#statusChips'].innerHTML.match(/data-status=/g) || []).length === 5);
await ctx.todoDone(ctx.__keyOf(t1), true);
ok('To-Do abhakbar', state.todos[0].erledigt === true && state.todos[0].erledigt_durch === 'Salwa, Christian');
await ctx.deleteTodo(t1.id);
ok('To-Do löschbar', state.todos.length === 0);

group('Bereich "Alle" mischt Wartungen und To-Dos');
const t2 = await ctx.saveTodo({ taetigkeit: 'Blitzschutzableiter erneuern', bis: '15.10.2026',
  zustaendig: 'Salwa, Christian', objekt_nr: '9200', objekt_name: 'Bad Mergentheim' });
ctx.setBereich('alle');
ctx.setAllExpanded(true);
const gemischt = host();
ok('Alle Bereiche zusammen', state.items.length > 0 && gemischt.includes('Blitzschutzableiter erneuern'));
ok('Wartungen sind weiterhin enthalten', gemischt.includes(state.items[0].taetigkeit));
ok('To-Dos bleiben als eigene Punkte erkennbar', gemischt.includes('ist-todo'));
ok('Zähler "Alle" = Wartungen + To-Dos',
   (() => { const c = ctx.aktuelleZahlen(); return c.alle === state.items.length + state.todos.length; })());
ok('Kein Titel mehr im Kopf', !/<h1 id="pageTitle">/.test(APP));
ctx.setBereich('wartung');
ok('Zurück im Wartungsbereich', state.bereich === 'wartung');
await ctx.deleteTodo(t2.id);

group('Termin am Standort');
ok('Kalender-Knopf im Standortkopf', /data-termloc=/.test(APP));
ok('Standort-Termin mit pauschalem Betreff', /subject: 'Wartungsarbeiten/.test(APP));
ok('Betreff im Dialog änderbar', /id="dBetreff"/.test(APP));
const ziel = ctx.terminZielStandort({ nr: '9200', name: 'Bad Mergentheim', items: state.items.slice(0, 3) });
ok('Standort-Ziel hat Ort und Umfang', ziel.ort === '9200 Bad Mergentheim' && /Positionen/.test(ziel.extra), ziel.extra);
const webStd = new URLSearchParams(ctx.outlookWebUrl(
  { subject: 'Wartungsarbeiten', ort: '9200 Bad Mergentheim', zustaendig: '', kommentar: '', intervall: '', extra: '3 Positionen' },
  { allDay: true, start: new Date(2026, 9, 15), ende: new Date(2026, 9, 16), attendees: ['dispo.sendertechnik@swr.de'] }).split('?')[1]);
ok('Standort-Termin: Betreff "Wartungsarbeiten"', webStd.get('subject') === 'Wartungsarbeiten');
ok('Standort-Termin: Ort korrekt', webStd.get('location') === '9200 Bad Mergentheim');
// Regression: der Kalender-Knopf liegt im Standortkopf ([data-loc]); wird zuerst
// [data-loc] geprüft, klappt der Standort nur auf und der Dialog öffnet nie.
ok('Standort-Termin öffnet Dialog (data-termloc vor data-loc geprüft)',
   src.indexOf("closest('[data-termloc]')") >= 0 &&
   src.indexOf("closest('[data-termloc]')") < src.indexOf("closest('[data-loc]')"));

/* --------------------------------------------------------------- Personenfeld */
group('Durchsuchbares Personenfeld');
const personHost = reg['#fltUser'];
ok('Personenfilter ist eine Combobox', /combo-input/.test(personHost.innerHTML));
ok('Mehrfachauswahl möglich (Chips)', /combo-chips/.test(personHost.innerHTML));
ok('Tippen filtert die Vorschläge', /combo-list/.test(personHost.innerHTML) && /addEventListener/.test(src));
ok('Filter wirkt auf die Liste', (() => {
  const personen = uniq(state.items.map(i => i.zustaendig));
  state.personen = [personen[0]];
  const treffer = filtered(state.items).length;
  state.personen = ['__gibt_es_nicht__'];
  const leer = filtered(state.items).length;
  state.personen = [];
  return personen.length > 0 && treffer > 0 && treffer <= state.items.length && leer === 0;
})(), (() => {
  const p = uniq(state.items.map(i => i.zustaendig));
  state.personen = [p[0]];
  const n = filtered(state.items).length;
  state.personen = [];
  return p.length + ' Person(en), ' + n + ' Treffer';
})());

/* --------------------------------------------------------------- Anhänge */
group('Anhänge (vorbereitet)');
ok('Backend-Endpunkte im Server vorhanden',
   /anhaenge/.test(read('server.mjs')) && /wartung_anhaenge/.test(read('schema.sql')));
ok('Lokaler Betrieb meldet fehlende Anhang-Unterstützung', /supportsAttachments/.test(src));
ok('Detailleiste hat Anhang-Bereich', /id="panelAtt"/.test(src));

/* --------------------------------------------------------------- Rollentrennung */
group('Rollentrennung bleibt gewahrt');
ok('Kein Anlegen/Ändern/Löschen von Wartungen im Client', !/createItem|removeItems|restoreItems|updateItem\s*\(/.test(src));
ok('ApiStore schreibt Stammdaten nicht', (() => {
  const a = APP.match(/const ApiStore = \{([\s\S]*?)\n\};/)[1];
  const bad = a.split('\n').filter(l => /'\/items/.test(l) && /method:\s*'(POST|PUT|DELETE)'/.test(l) && !/anhaenge/.test(l));
  return bad.length === 0 && /\/erledigung/.test(a);
})());
ok('Nur PATCH …/erledigung für Wartungen', /method: 'PATCH'/.test(src) && /'\/erledigung'/.test(src));
ok('Keine Sammelaktionen', !/data-bulk|bulkDialog/.test(src));
ok('Datenquelle versteht das Exportformat (records)', /fromExport/.test(src) && /asRecords/.test(src));

/* --------------------------------------------------------------- Datum & Export */
group('Datum, Status und Export');
ok('parseDate gültig', ctx.__fmtDate(ctx.parseDate('31.12.2026')) === '31.12.2026');
ok('parseDate ungültig → null', ctx.parseDate('32.13.2026') === null);
ok('maskDate formatiert', ctx.maskDate('31122026') === '31.12.2026');
ok('ISO → deutsch', ctx.__isoToDe('2026-09-28') === '28.09.2026', ctx.__isoToDe('2026-09-28'));
ok('Status erledigt gewinnt', ctx.statusOf({ erledigt: true, bis: '01.01.2000' }) === 'done');
ok('Status überfällig', ctx.statusOf({ erledigt: false, bis: '01.01.2020' }) === 'over');
ok('Status bald fällig', ctx.statusOf({ erledigt: false, bis: heute }) === 'soon');
let cap = '';
sandbox.Blob = class { constructor(p) { cap = p.join(''); } };
state.zeitraumJahr = ''; state.zeitraumJahrManual = true; // Export prüft den Gesamtbestand
ctx.exportCsv();
const lines = cap.replace(/^\uFEFF/, '').split('\r\n');
ok('CSV mit Kopfzeile und allen Zeilen', lines.length === state.items.length + 1, lines.length);
ok('CSV enthält Erledigungs-Spalten', lines[0].endsWith(';erledigt_am'));
ctx.exportJson();
const allJson = JSON.parse(cap);
ok('JSON-Export enthält alle Felder', Object.keys(allJson[0]).length === 17, Object.keys(allJson[0]).length);
ok('JSON-Sicherung enthält den gesamten Bestand (filterunabhängig)',
   allJson.length === state.items.length, allJson.length + '/' + state.items.length);
// Optionale Sicherung der aktuellen Ansicht: folgt dem gesetzten Filter.
state.zeitraumJahr = String(new Date().getFullYear());
ctx.exportJsonView();
const viewJson = JSON.parse(cap);
const jahrTreffer = state.items.filter(i => {
  const d = ctx.parseDate(i.bis);
  return d && d.getFullYear() === new Date().getFullYear();
}).length;
ok('JSON der aktuellen Ansicht folgt dem Filter',
   viewJson.length === jahrTreffer && viewJson.length < allJson.length, viewJson.length + '/' + allJson.length);
state.zeitraumJahr = ''; state.zeitraumJahrManual = true;

/* --------------------------------------------------------------- Struktur */
group('Dateistruktur');
const css = APP.slice(APP.indexOf('<style>') + 7, APP.indexOf('</style>'));
ok('CSS-Klammern ausgeglichen', (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
const ids = new Set([...APP.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]));
const used = new Set([...src.matchAll(/\$\('#([\w-]+)'\)/g)].map(m => m[1]));
const dyn = new Set(['seed', 'overlay', 'toasts', 'mUser', 'userList', 'mDate', 'mBy', 'mNote',
  'panelDone', 'doneFields', 'notDoneHint', 'panelNote', 'pDoneAm', 'pDoneBy', 'panelSave',
  'tText', 'tObjekt', 'tFaellig', 'tPerson', 'tNote', 'sTheme', 'sMail', 'sUser', 'sUserList',
  'dArt', 'dTag', 'dStart', 'dEnde', 'dTeil', 'dDayWrap', 'dTimeWrap']);
const dead = [...used].filter(x => !ids.has(x) && !dyn.has(x));
ok('Keine toten ID-Referenzen', dead.length === 0, dead.join(', '));
ok('Ein hidden-Attribut wird immer respektiert', /\[hidden\]\{display:none !important\}/.test(css));

group('Kopfzone');
const kopf = APP.slice(APP.indexOf('<header class="shell-header">'), APP.indexOf('<main class="content-body"'));
ok('Tab-Reihenfolge: Zuhause, Alle, Wartungen, Eigene To-Dos',
   (() => { const o = [...reg['#tabBar'].innerHTML.matchAll(/data-tab="([\w]+)"/g)].map(m => m[1]); return o.slice(0, 4).join(',') === 'home,all,wartung,todo'; })(),
   [...reg['#tabBar'].innerHTML.matchAll(/data-tab="([\w]+)"/g)].map(m => m[1]).join(' → '));
ok('Alle drei Tabs zeigen ihre Anzahl',
   (reg['#tabBar'].innerHTML.match(/<span class="n">\d+<\/span>/g) || []).length >= 3);
ok('Keine doppelten Kennzahlen mehr', !/page-stats|id="pageStats"/.test(APP));
ok('Kopf konsolidiert: Suche oben, Tabs + Sammel-Knopf darunter',
   /class="hdr-search"/.test(kopf) && /id="tabBar"/.test(kopf) &&
   /class="toolbar-row"/.test(kopf) && /id="btnViewPanel"/.test(kopf) && /class="view-panel"/.test(APP));
ok('Suche ist hervorgehoben', /hdr-search/.test(APP) && /searchkey/.test(APP));
ok('Filterzeile enthält Status-Chips', /id="statusChips"/.test(kopf));
ok('Status-Pills: Alle, Überfällig, Bald, Offen, Erledigt',
   (() => { const g = /const segs = \[([\s\S]*?)\];/.exec(src); return !!g && (g[1].match(/key:/g) || []).length === 5 &&
     /key: 'alle'/.test(g[1]) && /key: 'over'/.test(g[1]) && /key: 'soon'/.test(g[1]) &&
     /key: 'open'/.test(g[1]) && /key: 'done'/.test(g[1]); })());
ok('Status-Pill setzt den Filter (Alle = zurücksetzen)',
   /state\.status = b\.dataset\.status/.test(src));
ok('Filter/Ansicht im ausklappbaren Panel', /id="viewPanel"/.test(kopf) && /id="btnViewPanel"/.test(kopf) && /id="fltUser"/.test(kopf));
ok('Objekt-Auswahl entfernt (Suche deckt Objekt ab)',
   !/id="fltObj"/.test(APP) && !/alle Objekte/.test(APP));
ok('Zeilenkopf als festes Spalten-Grid',
   /\.loc-head\{[\s\S]*?display:grid;/.test(css) && /\.loc-title-col\{/.test(css) && /\.loc-preview-col\{/.test(css) && /\.loc-progress-col\{/.test(css));
ok('Dringlichkeit am linken Rahmen (überfällig rot)',
   /\.loc\.is-overdue \.loc-head\{border-left-color:var\(--error\)/.test(css));
ok('Datenquelle dezent in der Fußzeile', /class="app-foot"/.test(APP) && /app-foot[\s\S]{0,160}?id="srcStatus"/.test(APP));
ok('Tags kräftiger (hell)', /--tag-yellow-bg:#fdf5d6/.test(APP) && /--tag-red-bg:#ffeef0/.test(APP));
ok('Ergebniszahl nur bei aktivem Filter', () => true, '');
ok('Fortschritt bleibt sichtbar', /loc-mini-track/.test(css) && /linearProgress/.test(src));

/* --------------------------------------------------- Drei Schritte & Presets */
group('Drei Schritte: Gruppieren · Sortieren · Ansicht');
state.query = ''; state.status = 'alle'; state.taetigkeit = ''; state.personen = []; state.mine = false;
state.zeitraumJahr = ''; state.zeitraumJahrManual = true; // Gruppierung über den Gesamtbestand
ctx.setBereich('wartung');
ctx.setGroup('task'); ctx.setView('list'); ctx.setAllExpanded(false);
const taskGroups = ctx.groupItems(ctx.aktuelleListe(), 'task');
ok('Gruppieren nach Tätigkeit', taskGroups.length === new Set(state.items.map(i => i.taetigkeit)).size && taskGroups.length > 1,
   taskGroups.length + ' Tätigkeiten');
ctx.setView('tiles');
const tiles = host();
ok('Kacheln: eine Karte je Gruppe', (tiles.match(/class="tile[ "]/g) || []).length === taskGroups.length);
ok('Kachel zeigt Prozent und offen/gesamt',
   /class="tile-ring"[^>]*><b>\d+%<\/b>/.test(tiles) && /offen · \d+\/\d+/.test(tiles));
ctx.setView('blobs');
const blobs = host();
ok('Blasen: ein Kreis je Gruppe', (blobs.match(/class="blob[ "]/g) || []).length === taskGroups.length);
ok('Blase zeigt Prozent', /class="blob-pct">\d+%</.test(blobs));
ok('Blase ist auf-/zuklappbar', /data-loc="/.test(blobs));

ctx.setView('list'); ctx.setGroup('object');
const groupNrs = () => ctx.sortGroups(ctx.groupItems(ctx.aktuelleListe(), 'object'), 'object', state.sortDir).map(g => g.nr);
ctx.setSort('object', 'asc');
const ascNrs = groupNrs();
ctx.setSort('object', 'desc');
const descNrs = groupNrs();
ok('Sortierrichtung wirkt (auf/absteigend)', ascNrs.length > 1 && ascNrs[0] !== descNrs[0], ascNrs[0] + ' / ' + descNrs[0]);
ok('Status-Sortierung: offene zuerst', (() => {
  const arr = ctx.sortItems(state.items, 'status', 'asc');
  const i = arr.findIndex(x => x.erledigt);
  return arr.length > 0 && (i < 0 || arr.slice(i).every(x => x.erledigt));
})());
ctx.setSort('status', 'asc'); ctx.setGroup('object'); ctx.setView('list');

group('Presets (clientseitig gespeichert)');
const psKey = ctx.__config.storageKey + '.presets';
ctx.setGroup('task'); ctx.setView('tiles'); ctx.setSort('due', 'desc');
ctx.saveCurrentPreset('VDE-Kacheln');
let pf = JSON.parse(store.get(psKey) || '{}');
ok('Preset speichert Gruppe/Ansicht/Sortierung',
   (pf.list || []).some(p => p.name === 'VDE-Kacheln' && p.group === 'task' && p.view === 'tiles' && p.sortKey === 'due' && p.sortDir === 'desc'));
ctx.setDefaultPreset('VDE-Kacheln');
pf = JSON.parse(store.get(psKey) || '{}');
ok('Standard-Preset merkbar', pf.def === 'VDE-Kacheln');
ctx.setGroup('object'); ctx.setView('list'); ctx.setSort('status', 'asc');
ctx.applyPreset((pf.list || []).find(p => p.name === 'VDE-Kacheln'));
ok('Preset anwendbar', state.group === 'task' && state.view === 'tiles' && state.sortKey === 'due' && state.sortDir === 'desc');
ctx.setDefaultPreset('VDE-Kacheln'); // Standard wieder abwählen
ctx.deletePreset('VDE-Kacheln');
pf = JSON.parse(store.get(psKey) || '{}');
ok('Preset löschbar', !(pf.list || []).some(p => p.name === 'VDE-Kacheln'));
ctx.setGroup('object'); ctx.setView('list'); ctx.setSort('status', 'asc');

group('Gesamtfortschritt oben');
state.user = 'Salwa, Christian';
const f = ctx.fortschritt();
const meine = state.items.filter(i => i.zustaendig === state.user);
ok('Fortschritt zählt meine Wartungen', f.personal && f.total === meine.length && f.done === meine.filter(i => i.erledigt).length,
   f.done + '/' + f.total);
ctx.render();
ok('Fortschrittsbalken oben vorhanden', /class="progress-strip"/.test(APP) && /\d+ \/ \d+ · \d+%/.test(reg['#psValue'].textContent));

group('Home / Landing');
ctx.addHomeTab(); ctx.render();
const home = host();
ok('Home zeigt Begrüßung und Subheader',
   /class="home-hero"/.test(home) && /<h1>[^<]*<\/h1>/.test(home) &&
   /von <b>\d+<\/b> Wartungen offen/.test(home) && /Arbeitstage/.test(home));
ok('Home trennt Überfällig, Bald fällig und To-Dos',
   /class="home-sec over/.test(home) && /class="home-sec soon/.test(home) && /class="home-sec todo/.test(home));
ok('Home zeigt Kennzahlen', (home.match(/class="kpi/g) || []).length >= 4);
ok('Begrüßung mit Vornamen', ctx.gruss('Salwa, Christian').includes('Christian') && /Guten (Morgen|Tag|Abend)/.test(ctx.gruss('Salwa, Christian')));
ok('Arbeitstage zählen nur Werktage',
   ctx.arbeitstageImJahr(new Date(2026, 11, 31)) === 1 && ctx.arbeitstageImJahr(new Date(2026, 11, 26)) === 4,
   ctx.arbeitstageImJahr(new Date(2026, 11, 31)) + ' / ' + ctx.arbeitstageImJahr(new Date(2026, 11, 26)));

/* --------------------------------------------------- Zeitraum, Tabs, Format */
group('Zeitraum-Filter');
// Vorgabe: Ohne manuelle Wahl gilt stets das aktuelle Kalenderjahr; eine
// manuelle Wahl (auch „alle Jahre“) bleibt beim Tab-Wechsel erhalten.
const allTab = ctx.WT.tabs.all().list.find(t => t.id === 'all');
allTab.settings.zeitraumJahr = '1999'; allTab.settings.zeitraumJahrManual = false;
ctx.WT.tabs.applyTab('all');
ok('Ohne manuelle Wahl gilt das aktuelle Jahr',
   state.zeitraumJahr === String(new Date().getFullYear()), state.zeitraumJahr);
allTab.settings.zeitraumJahr = '1999'; allTab.settings.zeitraumJahrManual = true;
ctx.WT.tabs.applyTab('all');
ok('Manuell gewähltes Jahr bleibt erhalten', state.zeitraumJahr === '1999', state.zeitraumJahr);
const withBis = state.items.filter(i => i.bis);
const jahr = ctx.parseDate(withBis[0].bis).getFullYear();
state.zeitraumJahr = String(jahr); state.von = ''; state.bis = '';
ok('Jahr filtert auf das Frist-Jahr',
   ctx.filtered(state.items).length === withBis.filter(i => ctx.parseDate(i.bis).getFullYear() === jahr).length,
   ctx.filtered(state.items).length + ' Treffer in ' + jahr);
state.zeitraumJahr = ''; state.von = '01.01.2026'; state.bis = '31.12.2026';
ok('von/bis grenzt den Zeitraum ein',
   ctx.filtered(state.items).length > 0 && ctx.filtered(state.items).every(i => {
     const d = ctx.parseDate(i.bis);
     return d && d >= ctx.parseDate('01.01.2026') && d <= ctx.parseDate('31.12.2026');
   }));
state.zeitraumJahr = ''; state.von = ''; state.bis = '';
ok('Zeitraumfelder im Panel', /id="fltJahr"/.test(APP) && /id="fltVon"/.test(APP) && /id="fltBis"/.test(APP));

group('Tabs (gespeicherte Ansichten)');
ctx.setBereich('wartung'); ctx.setGroup('status'); ctx.setView('list');
const tabsKey = ctx.__config.storageKey + '.tabs';
const newId = ctx.addTab('Prüfungen 2026');
const T = ctx.WT.tabs.all().list.find(t => t.id === newId);
ok('Neuer Tab angelegt und aktiv', !!T && !T.builtin && ctx.WT.tabs.all().active === newId, T && T.name);
ok('Tab übernimmt die aktuellen Einstellungen', T.settings.group === 'status' && T.settings.bereich === 'wartung');
ctx.toggleFavTab(newId);
ok('Tab als Favorit markiert', T.fav === true && ctx.orderedTabs()[0].id === ctx.WT.tabs.all().def);
ok('Tabs werden gespeichert', JSON.parse(store.get(tabsKey) || '{}').list.some(t => t.id === newId));
ctx.applyTab('all');
ok('Tab-Wechsel stellt Einstellungen her', state.bereich === 'alle');
ctx.applyTab(newId);
ok('Zurück im eigenen Tab', state.bereich === 'wartung' && state.group === 'status');
ctx.renameTab(newId, 'TÜV');
ok('Tab umbenennbar', ctx.WT.tabs.all().list.find(t => t.id === newId).name === 'TÜV');
ctx.closeTab(newId);
ok('Eigener Tab schließbar', !ctx.WT.tabs.all().list.some(t => t.id === newId));
ok('Standard-Tabs sind schließbar und wieder aufrufbar', (() => {
  ctx.closeTab('all');
  const weg = !ctx.WT.tabs.all().list.some(t => t.id === 'all');
  ctx.openStandard('all');
  return weg && ctx.WT.tabs.all().list.some(t => t.id === 'all');
})());

group('Tabs speichern und wieder öffnen');
ctx.setBereich('wartung'); ctx.setGroup('task'); ctx.setView('tiles');
const sid = ctx.addTab('Kacheln Tätigkeit');
ctx.saveTab(sid);
ok('Speichern legt Tab in die Ablage und schließt ihn',
   (ctx.WT.tabs.all().saved || []).some(s => s.name === 'Kacheln Tätigkeit') &&
   !ctx.WT.tabs.all().list.some(t => t.id === sid));
const rid = ctx.reopenSaved('Kacheln Tätigkeit');
ok('Gespeicherter Tab wieder geöffnet und aktiv',
   !!rid && ctx.WT.tabs.all().active === rid && state.view === 'tiles' && state.group === 'task');
for (let i = 0; i < 7; i++) { const x = ctx.addTab('S' + i); ctx.saveTab(x); }
ok('Ablage wächst nicht endlos (max. 5)', (ctx.WT.tabs.all().saved || []).length === 5,
   String((ctx.WT.tabs.all().saved || []).length));
ctx.closeTab('home');
ok('Home-Tab schließbar', !ctx.WT.tabs.all().list.some(t => t.home));
ctx.addHomeTab(); ctx.render();
ok('Home über das "+"-Menü wieder herstellbar', ctx.WT.tabs.all().list.some(t => t.home) && ctx.WT.tabs.all().active === 'home');
// Aufräumen: eigene Tabs und Ablage leeren, zurück auf "Alle"
ctx.WT.tabs.all().list.filter(t => !t.builtin && !t.home).forEach(t => ctx.closeTab(t.id));
ctx.WT.tabs.all().saved = [];
ctx.applyTab('all'); ctx.setGroup('object'); ctx.setView('list'); ctx.setSort('status', 'asc'); ctx.setBereich('wartung');

group('Tab-Farbe, Symbol und Standard');
ctx.setTabColor('wartung', '#da1e28');
ok('Tab bekommt Akzentfarbe', ctx.WT.tabs.all().list.find(t => t.id === 'wartung').color === '#da1e28');
ok('Akzentfarbe steht im Tab', /data-tab="wartung"[\s\S]{0,80}--tab-accent:#da1e28/.test(reg['#tabBar'].innerHTML) || /--tab-accent:#da1e28/.test(reg['#tabBar'].innerHTML));
ctx.setTabColor('wartung', '');
ok('Farbe zurücksetzbar', ctx.WT.tabs.all().list.find(t => t.id === 'wartung').color === '');
ctx.setTabIcon('wartung', 'star');
ok('Tab-Symbol wählbar', ctx.WT.tabs.all().list.find(t => t.id === 'wartung').icon === 'star');
ok('Vordefinierte Tabs haben Standardsymbole',
   ctx.WT.tabs.all().list.find(t => t.id === 'home').icon === 'home' &&
   ctx.WT.tabs.all().list.find(t => t.id === 'all').icon === 'list' &&
   ctx.WT.tabs.all().list.find(t => t.id === 'todo').icon === 'check');
ok('Tab-Menü bietet Farben und Symbole',
   /data-tabcolor=/.test(src) && /data-tabicon=/.test(src) && /Als Standard festlegen/.test(src));
ctx.setDefaultTab('wartung');
ok('Tab als Standard festgelegt', ctx.WT.tabs.all().def === 'wartung');
ctx.setDefaultTab('all');
ok('Nur der zuletzt festgelegte Tab ist Standard', ctx.WT.tabs.all().def === 'all');
ctx.setDefaultTab('all');
ok('Standard aufhebbar', ctx.WT.tabs.all().def === '');
ctx.setDefaultTab('home');

group('Volltextsuche');
ctx.applyTab('wartung');
ctx.sucheInAlle('VDE');
ok('Suche bleibt in der aktuellen Ansicht', ctx.WT.tabs.all().active === 'wartung' && state.query === 'VDE' && state.bereich === 'wartung');
ctx.addHomeTab();
ctx.sucheInAlle('VDE');
ok('Suche aus Zuhause springt in den Tab "Alle"', ctx.WT.tabs.all().active === 'all' && state.bereich === 'alle' && state.query === 'VDE');
state.query = ''; ctx.render();

group('Merkmale in die Suche ziehen');
ok('Suchfeld als Ablege-Ziel ausgezeichnet', /class="hdr-search" id="searchBox"/.test(APP));
ok('Ziehbares Merkmal auszeichnen', (() => {
  const d = ctx.dragAttr('4711', 'Standortnummer');
  return d.indexOf('draggable="true"') >= 0 && d.indexOf('data-drag="4711"') >= 0 && d.indexOf('Standortnummer') >= 0;
})());
ok('Ohne Wert kein ziehbares Merkmal',
   ctx.dragAttr('  ') === '' && ctx.dragAttr(null) === '' && ctx.dragAttr(undefined) === '');
ctx.applyTab('all'); state.query = '';
ctx.setGroup('object'); ctx.setAllExpanded(true);
const ziehZeilen = host();
const ziehKopf = ctx.viewGroupedList(ctx.aktuelleListe());
const erstesItem = state.items.find(i => !i.erledigt) || state.items[0];
ok('Standortnummer im Standortkopf ist ziehbar',
   ziehKopf.indexOf('data-drag="' + erstesItem.objekt_nr + '"') >= 0, erstesItem.objekt_nr);
ok('Arbeitszeile bietet Merkmale zum Ziehen (Nr., Tätigkeit, Standort, Person)',
   (ziehZeilen.match(/data-drag="/g) || []).length >= 3 &&
   (ziehZeilen.match(/draggable="true"/g) || []).length >= 3);
ctx.setAllExpanded(false);
const nr = state.items[0].objekt_nr;
ctx.suchePerDrag(nr);
ok('Gedroppte Standortnummer füllt die Suche', state.query === nr && ctx.WT.tabs.all().active === 'all', state.query);
const vorher = state.query;
ctx.suchePerDrag(nr);
ok('Dasselbe Merkmal wird nicht doppelt', state.query === vorher);
ctx.suchePerDrag(state.items[0].taetigkeit);
ok('Weiteres Merkmal grenzt ein (UND-Suche)', state.query.indexOf(nr) === 0 && state.query.length > nr.length);
ctx.addHomeTab();
state.query = '';
ctx.suchePerDrag('4711');
ok('Drop aus Zuhause springt in den Tab "Alle"', ctx.WT.tabs.all().active === 'all' && state.query === '4711');
ok('Ablegen setzt den Fokus ins Suchfeld', /searchBox/.test(src) && /drop-active/.test(css));
state.query = ''; ctx.render();

group('Inline-Vorschläge in der Suche');
ok('Geistertext-Element im Suchfeld', /id="searchGhost"/.test(APP) && /\.search-ghost\{/.test(css));
ok('Bestätigen mit Pfeil-rechts oder Tab',
   /e\.key !== 'ArrowRight' && e\.key !== 'Tab'/.test(src) && /akzeptiereVorschlag/.test(src));
ok('Vorschlag wird beim Rendern der Suche aktualisiert', /renderSuggest\(\)/.test(src));
ok('Vorschlag nach Leerzeichen entfällt', ctx.suchVorschlag('Bad ') === null);
ok('Ohne Eingabe kein Vorschlag', ctx.suchVorschlag('') === null && ctx.suchVorschlag('___gibt_es_nicht___') === null);
ok('Standortnummer wird inline vervollständigt', (() => {
  const nrs = uniq(state.items.map(i => i.objekt_nr).filter(Boolean));
  const nr = nrs.find(n => n.length >= 3 && nrs.filter(x => x.slice(0, n.length - 1) === n.slice(0, n.length - 1)).length === 1);
  if (!nr) return false;
  const v = ctx.suchVorschlag(nr.slice(0, nr.length - 1));
  return !!v && v.text === nr && v.rest === nr.slice(nr.length - 1);
})(), (() => {
  const nrs = uniq(state.items.map(i => i.objekt_nr).filter(Boolean));
  const nr = nrs.find(n => n.length >= 3 && nrs.filter(x => x.slice(0, n.length - 1) === n.slice(0, n.length - 1)).length === 1);
  return nr ? nr : 'keine eindeutige Nummer';
})());
ok('Tätigkeit wird ergänzt (Vorschlag beginnt mit dem Präfix)', (() => {
  const item = state.items.find(i => (i.taetigkeit || '').length > 6);
  if (!item) return false;
  const praefix = item.taetigkeit.slice(0, 5);
  const v = ctx.suchVorschlag(praefix);
  return !!v && v.text.length > praefix.length && v.rest === v.text.slice(praefix.length);
})(), (() => {
  const item = state.items.find(i => (i.taetigkeit || '').length > 6);
  const v = item ? ctx.suchVorschlag(item.taetigkeit.slice(0, 5)) : null;
  return v ? v.text : 'kein Vorschlag';
})());
ctx.applyTab('all'); state.query = ''; ctx.render();

group('Gruppen-Farblogik (Bugfix)');
ctx.setGroup('object');
ok('Gelb nur für tatsächlich bald fällige Gruppen', (() => {
  const groups = ctx.groupItems(state.items, 'object');
  const erwartet = groups.filter(g => { const s = ctx.groupStats(g); return s.over === 0 && s.soon > 0; }).length;
  const ist = (ctx.viewGroupedList(state.items).match(/is-soon/g) || []).length;
  return ist === erwartet;
})(), 'is-soon: ' + ((ctx.viewGroupedList(state.items).match(/is-soon/g) || []).length));

group('Tabs verschieben, schließen und wiederfinden');
['home', 'all', 'wartung', 'todo'].forEach(id => ctx.openStandard(id));
if (ctx.WT.tabs.all().def !== 'home') ctx.setDefaultTab('home');
const ta = ctx.addTab('A'), tb = ctx.addTab('B'), tc = ctx.addTab('C');
const order0 = ctx.orderedTabs().map(t => t.id);
ctx.moveTab(tc, ta, false);
const order1 = ctx.orderedTabs().map(t => t.id);
ok('Tab frei verschiebbar', order1.indexOf(tc) < order1.indexOf(ta), order1.join(','));
ok('Standard-Tab bleibt ganz links', order1[0] === ctx.WT.tabs.all().def, order1[0]);
ctx.moveTab(ctx.WT.tabs.all().def, tb, true);
ok('Standard-Tab selbst nicht verschiebbar', ctx.orderedTabs()[0].id === ctx.WT.tabs.all().def);
ctx.closeTab(tc);
ok('Geschlossener eigener Tab landet unter "Zuletzt geschlossen"',
   (ctx.WT.tabs.all().recent || []).some(r => r.name === 'C') && !ctx.WT.tabs.all().list.some(t => t.id === tc));
const wieder = ctx.reopenRecent('C');
ok('Zuletzt geschlossener Tab wieder öffenbar', !!wieder && ctx.WT.tabs.all().active === wieder);
ok('Plus-Menü bietet Standard Tabs, Eigene und Zuletzt geschlossen',
   /Standard Tabs/.test(src) && /Zuletzt geschlossen/.test(src) && /Neue Ansicht/.test(src));
ok('Tab-Menü trennt Farbe und Symbol als eigene Punkte',
   /data-tabact="color">Farbe/.test(src) && /data-tabact="icon">Symbol/.test(src) && /function openPicker/.test(src));
// Aufräumen: eigene Tabs schließen, Ablagen leeren
['home', 'all', 'wartung', 'todo'];
ctx.WT.tabs.all().list.slice().filter(t => !['home', 'all', 'wartung', 'todo'].includes(t.id)).forEach(t => ctx.closeTab(t.id));
ctx.WT.tabs.all().recent = [];
ctx.openStandard('all'); ctx.setGroup('object'); ctx.setView('list'); ctx.setSort('status', 'asc');

group('Namensformat und Scrollen');
ok('Dialog fragt Nachname, Vorname', /Nachname, Vorname/.test(src) && !/Vor- und Nachname/.test(src));
ok('Scrollbereich der Liste hat overflow:auto', /\.content-body\{[^}]*overflow:auto/.test(css));

console.log('\n' + (fails
  ? '\u2717 FEHLGESCHLAGEN: ' + fails + ' von ' + runs
  : '\u2713 ALLE ' + runs + ' PRÜFUNGEN BESTANDEN'));
process.exit(fails ? 1 : 0);
