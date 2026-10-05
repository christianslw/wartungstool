/* Wartungstool · JS · Anwendungszustand & To-Do-Kennzeichen */
const state = {
  items: [], todos: [], abschaltungen: [], user: '', lastNote: '',
  bereich: 'alle', query: '', status: 'alle', art: '', objekt: '', taetigkeit: '', personen: [],
  zeitraumJahr: aktuellesJahr(), zeitraumJahrManual: false, von: '', bis: '',
  mine: false,
  /* Drei Schritte: Gruppieren · Sortieren · Ansicht (siehe 42/43/presets) */
  group: 'object', view: 'list', sortKey: 'status', sortDir: 'asc',
  /* Kalender (siehe 55-kalender.js): Monat, Kategorien, Monats-/Jahresansicht */
  kalJahr: new Date().getFullYear(), kalMonat: new Date().getMonth(),
  kalOver: true, kalSoon: true, kalOpen: true, kalDone: true, kalAbs: true,
  kalView: 'month', kalPicker: false, kalYearMax: 8, kalDayMax: 4,
  expanded: new Set(), collapsed: new Set(), panelId: null, loading: true, online: true, filterOpen: false,
  favorites: []
};

const TODO_MARK = '__toDo';
function markToDo(t) {
  if (t) Object.defineProperty(t, TODO_MARK, { value: true, enumerable: false, writable: true, configurable: true });
  return t;
}
const istToDo = (x) => !!(x && x[TODO_MARK]);
const keyOf = (x) => (istToDo(x) ? 't' : 'w') + ':' + x.id;
function findByKey(key) {
  const s = String(key || ''), id = s.slice(2);
  return s.slice(0, 1) === 't'
    ? state.todos.find(x => String(x.id) === id)
    : state.items.find(x => String(x.id) === id);
}
