/* Wartungstool · JS · Seed, Signatur, Erledigungs-Abgleich */
const seedData = () => {
  const ext = asRecords(globalThis.WARTUNGSDATEN);
  if (ext && ext.length) {
    const nested = !!(ext[0] && ext[0].site && ext[0].task && ext[0].schedule);
    return nested ? ext.map(fromExport) : ext.map(normalize);
  }
  try { return JSON.parse($('#seed').textContent).map(normalize); } catch (e) { return []; }
};
const hasDataFile = () => { const e = asRecords(globalThis.WARTUNGSDATEN); return !!(e && e.length); };

/** Signatur der Stammdaten, um den Cache bei geaenderten Daten zu verwerfen. */
const dataSignature = () => {
  const d = globalThis.WARTUNGSDATEN;
  if (!d || typeof d !== 'object') return '';
  const arr = asRecords(d) || [];
  return [d.exportedAt || '', d.totalRecords || arr.length, arr.length].join('|');
};

/** Schluessel zum Abgleich alter/neuer Datensaetze (Erledigungsstand uebernehmen). */
const matchKey = (r) => {
  if (r.external_id) return 'ext:' + r.external_id;
  if (r.hash_key) return 'hash:' + r.hash_key;
  const k = [r.objekt_nr, r.taetigkeit, r.ab].join('||');
  return k.replace(/\|/g, '') ? 'cmp:' + k : '';
};

/** Nutzerseitige Erledigungen aus dem alten Cache auf die neuen Datensaetze uebertragen. */
function carryCompletion(oldItems, newItems) {
  const byKey = new Map();
  for (const o of oldItems) {
    const k = matchKey(o);
    if (k) byKey.set(k, o);
  }
  for (const n of newItems) {
    const o = byKey.get(matchKey(n));
    if (!o || o.erledigt !== true) continue;
    n.erledigt = true;
    n.erledigt_am = o.erledigt_am || n.erledigt_am;
    n.erledigt_durch = o.erledigt_durch || n.erledigt_durch;
    n.erledigt_notiz = o.erledigt_notiz || n.erledigt_notiz;
  }
  return newItems;
}
