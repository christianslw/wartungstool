/* Wartungstool · JS · Datenmodell & Export-Mapping */
const DEFAULT_FIELDS = {
  objekt_art: 'Standorte', objekt_nr: '', objekt_name: '', beschreibung: '', taetigkeit: '',
  kommentar: '', intervall: '', ab: '', bis: '', zustaendig: '', erledigt: false, erledigt_am: '',
  erledigt_durch: '', erledigt_notiz: '', external_id: '', hash_key: ''
};

const normalize = (r, idx) => Object.assign({}, DEFAULT_FIELDS, r, {
  id: r.id ?? (idx + 1),
  erledigt: r.erledigt === true || r.erledigt === 1 || r.erledigt === '1' || r.erledigt === 'true'
});

const asRecords = (x) => Array.isArray(x) ? x : (x && Array.isArray(x.records) ? x.records : null);
const isoToDe = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? '').trim());
  return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
};
const intervallText = (monate, typ) => {
  if (!monate) return '';
  const t = monate % 12 === 0 ? (monate / 12) + (monate === 12 ? ' Jahr' : ' Jahre') : monate + ' Monate';
  return 'alle ' + t + (typ === 'fest' ? ' (fest)' : ' (variabel)');
};
/** Verschachtelter Export (site/task/schedule/execution) → flaches Arbeitsmodell. */
function fromExport(r, idx) {
  const site = r.site || {}, task = r.task || {}, sch = r.schedule || {}, ex = r.execution || {};
  const done = String(ex.status || 'OPEN').toUpperCase() !== 'OPEN';
  return normalize({
    id: idx + 1,
    objekt_art: site.type || 'Standorte',
    objekt_nr: site.id || '',
    objekt_name: site.name || '',
    beschreibung: '',
    taetigkeit: task.activity || '',
    kommentar: task.maintenanceComment || '',
    intervall: intervallText(task.intervalMonths, task.intervalType),
    ab: isoToDe(sch.dueDateStart),
    bis: isoToDe(sch.dueDateEnd),
    zustaendig: sch.assignedTo || '',
    erledigt: done,
    erledigt_am: isoToDe(ex.completedAt),
    erledigt_durch: ex.completedBy || '',
    erledigt_notiz: ex.completionComment || '',
    external_id: r.id || '',
    hash_key: r.hashKey || ''
  });
}
