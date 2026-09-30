/**
 * End-to-End: Wartungen, To-Dos und Anhänge (inkl. Kommentare) gegen SQLite.
 * Aufruf: node tests/api.mjs   (Server vorher starten)
 */
const BASE = process.env.BASE || 'http://localhost:8080';
let fails = 0, runs = 0;
const ok = (n, c, e = '') => { runs++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (e ? '  -> ' + e : '')); if (!c) fails++; };
const http = async (p, o = {}) => {
  const r = await fetch(BASE + p, { headers: { 'Content-Type': 'application/json' }, ...o });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body };
};
const group = (t) => console.log('\n== ' + t + ' ==');

group('Stammdaten (echte Daten)');
const all = await http('/api/items');
ok('Wartungspunkte geladen', all.body.length > 0, all.body.length);
ok('Felder inkl. intervall/external_id/hash_key', ['intervall', 'external_id', 'hash_key'].every(f => f in all.body[0]));
ok('Fristen als TT.MM.JJJJ', /^\d{2}\.\d{2}\.\d{4}$/.test(all.body[0].bis), all.body[0].bis);

group('Schreibschutz der Stammdaten');
ok('PUT abgewiesen', (await http('/api/items/1', { method: 'PUT', body: '{}' })).status === 405);
ok('DELETE abgewiesen', (await http('/api/items/1', { method: 'DELETE' })).status === 405);
ok('POST abgewiesen', (await http('/api/items', { method: 'POST', body: '{}' })).status === 405);
ok('PATCH nur Erledigungsfelder', (await http('/api/items/1/erledigung', { method: 'PATCH', body: JSON.stringify({ taetigkeit: 'X' }) })).status === 400);

group('Erledigung mit Abschlusskommentar');
const d = await http('/api/items/1/erledigung', { method: 'PATCH', body: JSON.stringify({
  erledigt: true, erledigt_am: '30.09.2026', erledigt_durch: 'Salwa, Christian',
  erledigt_notiz: 'Prüfung abgeschlossen, Protokoll abgelegt' }) });
ok('Kommentar gespeichert', d.body.erledigt_notiz.startsWith('Prüfung abgeschlossen'));
await http('/api/items/1/erledigung', { method: 'PATCH', body: JSON.stringify({ erledigt: false, erledigt_am: '', erledigt_durch: '' }) });

group('Eigene To-Dos');
const neu = await http('/api/todos', { method: 'POST', body: JSON.stringify({
  taetigkeit: 'Blitzschutzableiter erneuern', bis: '15.10.2026',
  zustaendig: 'Salwa, Christian', objekt_nr: '9200', objekt_name: 'Bad Mergentheim' }) });
ok('To-Do anlegen', neu.status === 201 && neu.body.id > 0);
ok('To-Do getrennt von den Wartungen', (await http('/api/items')).body.length === all.body.length);
await http('/api/todos/' + neu.body.id, { method: 'PUT', body: JSON.stringify({
  ...neu.body, erledigt: true, erledigt_am: '01.10.2026', erledigt_durch: 'Salwa, Christian' }) });
ok('To-Do ändern', (await http('/api/todos/' + neu.body.id)).body.erledigt === true);

group('Anhänge am To-Do (mit Kommentar)');
const b64 = Buffer.from('Foto-Inhalt Test').toString('base64');
const up = await http('/api/todos/' + neu.body.id + '/anhaenge', { method: 'POST',
  body: JSON.stringify({ dateiname: 'ableiter.jpg', mime: 'image/jpeg', daten: b64, kommentar: 'Zustand vor Austausch' }) });
ok('Bild am To-Do gespeichert', up.status === 201 && up.body.id > 0, up.body && up.body.dateiname);
ok('Kommentar am Anhang', up.body.kommentar === 'Zustand vor Austausch', up.body.kommentar);
ok('MIME und Größe erfasst', up.body.mime === 'image/jpeg' && up.body.groesse > 0);
const liste = await http('/api/todos/' + neu.body.id + '/anhaenge');
ok('Anhang am To-Do gelistet', liste.body.length === 1 && liste.body[0].dateiname === 'ableiter.jpg');
ok('Anhang mit Kommentar gelistet', liste.body[0].kommentar === 'Zustand vor Austausch');
const datei = await fetch(BASE + '/api/todos/' + neu.body.id + '/anhaenge/' + up.body.id + '/datei');
ok('Datei abrufbar', datei.status === 200 && (await datei.text()).includes('Foto-Inhalt'));
const kom = await http('/api/anhaenge/' + up.body.id, { method: 'PATCH', body: JSON.stringify({ kommentar: 'Ersetzt am 02.10.' }) });
ok('Anhang-Kommentar nachträglich änderbar', kom.status === 200 && kom.body.kommentar === 'Ersetzt am 02.10.', kom.body.kommentar);
ok('Anhang am To-Do löschbar', (await http('/api/todos/' + neu.body.id + '/anhaenge/' + up.body.id, { method: 'DELETE' })).status === 204);
ok('Liste wieder leer', (await http('/api/todos/' + neu.body.id + '/anhaenge')).body.length === 0);

group('Anhänge an einer Wartungsposition');
const b64b = Buffer.from('Protokoll').toString('base64');
const up2 = await http('/api/items/2/anhaenge', { method: 'POST',
  body: JSON.stringify({ dateiname: 'protokoll.pdf', mime: 'application/pdf', daten: b64b }) });
ok('Anhang an Wartung gespeichert', up2.status === 201 && up2.body.id > 0);
ok('Anhang wird gelistet', (await http('/api/items/2/anhaenge')).body.length === 1);
ok('Ohne Kommentar bleibt leer', up2.body.kommentar === '');
await http('/api/items/2/anhaenge/' + up2.body.id, { method: 'DELETE' });

group('Aufräumen');
ok('To-Do löschen', (await http('/api/todos/' + neu.body.id, { method: 'DELETE' })).status === 204);
ok('To-Do-Liste leer', (await http('/api/todos')).body.length === 0);
ok('Unbekannter Bezug → 404', (await http('/api/todos/999999/anhaenge')).status === 404);

console.log('\n' + (fails ? 'FEHLGESCHLAGEN: ' + fails + ' von ' + runs : 'ALLE ' + runs + ' PRÜFUNGEN BESTANDEN'));
process.exit(fails ? 1 : 0);
