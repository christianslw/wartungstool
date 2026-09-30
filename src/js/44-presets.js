/* Wartungstool · JS · Presets (Gruppieren + Sortieren + Ansicht)
   ---------------------------------------------------------------------------
   Kombinationen aus Gruppierung, Sortierung und Ansicht lassen sich benennen,
   als Standard festlegen und clientseitig (localStorage) speichern. */

const PRESET_KEY = CONFIG.storageKey + '.presets';

function loadPresets() {
  try {
    const p = JSON.parse(localStorage.getItem(PRESET_KEY) || '{}');
    return { list: Array.isArray(p.list) ? p.list : [], def: p.def || '' };
  } catch (e) {
    return { list: [], def: '' };
  }
}

function savePresets(p) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); } catch (e) {}
}

/** Die aktuelle Kombination der drei Schritte. */
function aktuellesPreset() {
  return { group: state.group, view: state.view, sortKey: state.sortKey, sortDir: state.sortDir };
}

/** Preset anwenden (fehlende Felder bleiben unverändert). */
function applyPreset(p) {
  if (!p) return;
  if (p.group) state.group = p.group;
  if (p.view) state.view = p.view;
  if (p.sortKey) state.sortKey = p.sortKey;
  if (p.sortDir) state.sortDir = p.sortDir;
  state.expanded = new Set();
  render();
}

/** Aktuelle Kombination unter einem Namen speichern (überschreibt gleichnamige). */
function saveCurrentPreset(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const p = loadPresets();
  const rec = Object.assign({ name: clean }, aktuellesPreset());
  const i = p.list.findIndex(x => x.name === clean);
  if (i >= 0) p.list[i] = rec; else p.list.push(rec);
  savePresets(p);
  return rec;
}

function deletePreset(name) {
  const p = loadPresets();
  p.list = p.list.filter(x => x.name !== name);
  if (p.def === name) p.def = '';
  savePresets(p);
}

/** Standard setzen/entfernen (gleicher Name schaltet wieder ab). */
function setDefaultPreset(name) {
  const p = loadPresets();
  p.def = (p.def === name) ? '' : name;
  savePresets(p);
  return p.def;
}

/** Beim Start den Standard anwenden, falls vorhanden. */
function applyDefaultPreset() {
  const p = loadPresets();
  if (!p.def) return false;
  const rec = p.list.find(x => x.name === p.def);
  if (!rec) return false;
  applyPreset(rec);
  return true;
}
