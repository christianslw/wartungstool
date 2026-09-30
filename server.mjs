/**
 * Wartungstool – Test-Backend (SQL + REST-API)
 * ----------------------------------------------------------------------------
 *  Start:  node server.mjs            →  http://localhost:8080
 *  Danach das Frontend mit:  index.html?api=http://localhost:8080/api
 *
 *  Ohne jede Abhängigkeit (kein npm install).
 *  Datenbank: SQLite über `node:sqlite` (Node ≥ 22.5).
 *  Ist das Modul nicht verfügbar, fällt der Server automatisch auf eine
 *  JSON-Datei zurück (data/wartung.json) – die API bleibt identisch.
 *
 *  ROLLENTRENNUNG
 *  --------------
 *  Stammdaten (objekt_*, beschreibung, taetigkeit, kommentar, ab, bis,
 *  zustaendig) können ausschließlich über die Administrations-Endpunkte
 *  geändert werden. Der Techniker-Endpunkt
 *      PATCH /api/items/:id/erledigung
 *  akzeptiert nur erledigt, erledigt_am, erledigt_durch und erledigt_notiz.
 *  Das Frontend nutzt ausschließlich diesen Endpunkt.
 *
 *  Schnittstelle
 *  -------------
 *    GET    /api/items                        Liste (Frontend)
 *    PATCH  /api/items/:id/erledigung         Erledigung + Notiz (Frontend)
 *    GET    /api/health                       Statusabfrage
 *    ---- nur Administration ----
 *    POST   /api/admin/items                  Stammdaten anlegen
 *    PUT    /api/admin/items/:id              Stammdaten ändern
 *    DELETE /api/admin/items/:id              Stammdaten löschen
 *    POST   /api/admin/items/import           Bestand ersetzen (Array)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.join(ROOT, 'data');
const JSON_DB = path.join(DATA_DIR, 'wartung.json');
const SQLITE_DB = path.join(DATA_DIR, 'wartung.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------------------------------------------------------- Datenbank */
let db, engine;
try {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(SQLITE_DB);
  db.exec(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));
  engine = 'sqlite (' + SQLITE_DB + ')';
} catch (e) {
  engine = 'json-fallback (' + JSON_DB + ')  –  node:sqlite nicht verfügbar: ' + e.message;
  if (!fs.existsSync(JSON_DB)) fs.writeFileSync(JSON_DB, '[]');
}

const STAMM = ['objekt_art', 'objekt_nr', 'objekt_name', 'beschreibung', 'taetigkeit',
               'kommentar', 'intervall', 'ab', 'bis', 'zustaendig', 'external_id', 'hash_key'];
const ERLEDIGUNG = ['erledigt', 'erledigt_am', 'erledigt_durch', 'erledigt_notiz'];
const COLS = [...STAMM, ...ERLEDIGUNG];

/* --- Datenformate: flaches Arbeitsmodell ODER verschachtelter Export ------ */
const isoToDe = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? '').trim());
  return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
};
const intervallText = (monate, typ) => {
  if (!monate) return '';
  const t = monate % 12 === 0 ? (monate / 12) + (monate === 12 ? ' Jahr' : ' Jahre') : monate + ' Monate';
  return 'alle ' + t + (typ === 'fest' ? ' (fest)' : ' (variabel)');
};

const normalize = (r, keepId = false) => {
  // Verschachteltes Exportformat (schemaVersion 1.0) → flaches Modell
  if (r && r.site && r.task && r.schedule) {
    const site = r.site, task = r.task, sch = r.schedule, ex = r.execution || {};
    const done = String(ex.status || 'OPEN').toUpperCase() !== 'OPEN';
    return {
      id: null,
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
    };
  }
  const n = Number(r.id);
  return {
    id: keepId && Number.isFinite(n) && n > 0 ? n : null,
    objekt_art: r.objekt_art ?? 'Standorte',
    objekt_nr: r.objekt_nr ?? '',
    objekt_name: r.objekt_name ?? '',
    beschreibung: r.beschreibung ?? '',
    taetigkeit: r.taetigkeit ?? '',
    kommentar: r.kommentar ?? '',
    ab: r.ab ?? '',
    bis: r.bis ?? '',
    zustaendig: r.zustaendig ?? '',
    erledigt: !!(r.erledigt === true || r.erledigt === 1 || r.erledigt === '1' || r.erledigt === 'true'),
    erledigt_am: r.erledigt_am ?? '',
    erledigt_durch: r.erledigt_durch ?? '',
    erledigt_notiz: r.erledigt_notiz ?? '',
    intervall: r.intervall ?? '',
    external_id: r.external_id ?? '',
    hash_key: r.hash_key ?? ''
  };
};

const DB = {
  /** Datensatz → SQL-Parameter (SQLite kennt kein JS-Boolean). */
  toRow(rec) { return COLS.map(c => c === 'erledigt' ? (rec[c] ? 1 : 0) : (rec[c] ?? '')); },
  all() {
    // normalize nicht direkt als map-Callback: sonst würde der Index als keepId gelten.
    if (db) return db.prepare('SELECT * FROM wartungspunkte ORDER BY id').all().map(r => normalize(r, true));
    return JSON.parse(fs.readFileSync(JSON_DB, 'utf8')).map(r => normalize(r, true));
  },
  get(id) { return this.all().find(r => r.id === Number(id)) || null; },
  /** Nur die Erledigungsfelder ändern – Stammdaten bleiben unangetastet. */
  patchErledigung(id, patch) {
    const rec = {};
    for (const c of ERLEDIGUNG) if (c in patch) rec[c] = patch[c];
    if (db) {
      const sets = Object.keys(rec);
      if (sets.length) {
        db.prepare(`UPDATE wartungspunkte SET ${sets.map(c => c + '=?').join(',')},
                    geaendert_am=CURRENT_TIMESTAMP WHERE id=?`)
          .run(...sets.map(c => c === 'erledigt' ? (rec[c] ? 1 : 0) : (rec[c] ?? '')), Number(id));
      }
      return this.get(id);
    }
    const rows = this.all(), i = rows.findIndex(r => r.id === Number(id));
    if (i < 0) return null;
    rows[i] = normalize({ ...rows[i], ...rec });
    this.writeJson(rows);
    return rows[i];
  },
  /* ---- Administration ---- */
  insert(rec) {
    const r = normalize(rec);
    if (db) {
      const info = db.prepare(`INSERT INTO wartungspunkte (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`)
        .run(...this.toRow(r));
      return this.get(Number(info.lastInsertRowid));
    }
    const rows = this.all();
    r.id = rows.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    rows.push(r); this.writeJson(rows); return r;
  },
  update(id, rec) {
    const r = normalize(rec);
    if (db) {
      db.prepare(`UPDATE wartungspunkte SET ${COLS.map(c => c + '=?').join(',')}, geaendert_am=CURRENT_TIMESTAMP WHERE id=?`)
        .run(...this.toRow(r), Number(id));
      return this.get(id);
    }
    const rows = this.all(), i = rows.findIndex(x => x.id === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...r, id: Number(id) };
    this.writeJson(rows); return rows[i];
  },
  remove(id) {
    if (db) { db.prepare('DELETE FROM wartungspunkte WHERE id=?').run(Number(id)); return true; }
    this.writeJson(this.all().filter(r => r.id !== Number(id))); return true;
  },
  replaceAll(list) {
    // Mitgelieferte IDs bleiben erhalten, damit Client und Server synchron bleiben.
    if (db) {
      db.exec('DELETE FROM wartungspunkte');
      const st = db.prepare(`INSERT INTO wartungspunkte (id,${COLS.join(',')}) VALUES (?,${COLS.map(() => '?').join(',')})`);
      for (const raw of list) { const r = normalize(raw, true); st.run(r.id, ...this.toRow(r)); }
      return this.all().length;
    }
    this.writeJson(list.map(r => normalize(r, true))); return list.length;
  },
  writeJson(rows) { fs.writeFileSync(JSON_DB, JSON.stringify(rows, null, 2)); }
};

/* ------------------------------------------------- Beim ersten Start füllen */
/** Liest Datensätze aus wartungen2026.json, daten.js oder dem Seed in index.html. */
function ladeStammdaten() {
  const kandidaten = ['wartungen2026.json', 'daten.js'];
  for (const name of kandidaten) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    try {
      if (name.endsWith('.json')) {
        const d = JSON.parse(txt);
        const recs = Array.isArray(d) ? d : d.records;
        if (Array.isArray(recs)) return { recs, quelle: name };
      } else {
        const m = /window\.WARTUNGSDATEN\s*=\s*([\s\S]*?);\s*$/.exec(txt);
        if (m) {
          const d = JSON.parse(m[1]);
          const recs = Array.isArray(d) ? d : d.records;
          if (Array.isArray(recs)) return { recs, quelle: name };
        }
      }
    } catch (e) { console.warn('  ' + name + ' konnte nicht gelesen werden: ' + e.message); }
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<script type="application\/json" id="seed">([\s\S]*?)<\/script>/.exec(html);
  return m ? { recs: JSON.parse(m[1]), quelle: 'index.html (Testbestand)' } : null;
}

/* Aufruf: node server.mjs --import [datei]  → Bestand neu einlesen */
const importArg = process.argv.indexOf('--import');
if (importArg >= 0) {
  const datei = process.argv[importArg + 1];
  let recs = null, quelle = null;
  if (datei) {
    const d = JSON.parse(fs.readFileSync(datei, 'utf8'));
    recs = Array.isArray(d) ? d : d.records;
    quelle = datei;
  } else {
    const g = ladeStammdaten();
    if (g) { recs = g.recs; quelle = g.quelle; }
  }
  if (!Array.isArray(recs)) {
    console.error('  Keine Datensätze gefunden. Aufruf: node server.mjs --import [datei.json]');
    process.exit(1);
  }
  console.log('  Importiere ' + recs.length + ' Datensätze aus ' + quelle);
  console.log('  Bestand jetzt: ' + DB.replaceAll(recs) + ' Wartungspunkte');
  console.log('  Datenbank: ' + engine);
  process.exit(0);
}

try {
  if (DB.all().length === 0) {
    const g = ladeStammdaten();
    if (g) console.log('  Stammdaten eingespielt: ' + DB.replaceAll(g.recs) + ' Wartungspunkte (' + g.quelle + ')');
  }
} catch (e) {
  console.warn('  Stammdaten konnten nicht eingespielt werden: ' + e.message);
}

/* ------------------------------------------------------------- Zusatzaufgaben
   Getrennt von den Wartungsstammdaten: der Techniker darf hier alles.
   ---------------------------------------------------------------------------- */
const TODO_COLS = ['taetigkeit', 'objekt_nr', 'objekt_name', 'kommentar', 'bis', 'ab',
  'zustaendig', 'erledigt', 'erledigt_am', 'erledigt_durch', 'erledigt_notiz',
  'erstellt_am', 'erstellt_von'];

const normalizeTodo = (r, keepId = false) => {
  const n = Number(r.id);
  return {
    id: keepId && Number.isFinite(n) && n > 0 ? n : null,
    taetigkeit: r.taetigkeit ?? '',
    objekt_nr: r.objekt_nr ?? '',
    objekt_name: r.objekt_name ?? '',
    kommentar: r.kommentar ?? '',
    bis: r.bis ?? '',
    ab: r.ab ?? '',
    zustaendig: r.zustaendig ?? '',
    erledigt: !!(r.erledigt === true || r.erledigt === 1 || r.erledigt === '1' || r.erledigt === 'true'),
    erledigt_am: r.erledigt_am ?? '',
    erledigt_durch: r.erledigt_durch ?? '',
    erledigt_notiz: r.erledigt_notiz ?? '',
    erstellt_am: r.erstellt_am ?? '',
    erstellt_von: r.erstellt_von ?? ''
  };
};

const TODO = {
  all() {
    if (db) return db.prepare('SELECT * FROM wartung_todos ORDER BY id').all().map(r => normalizeTodo(r, true));
    return (JSON.parse(fs.readFileSync(JSON_DB, 'utf8')).todos || []).map(r => normalizeTodo(r, true));
  },
  get(id) { return this.all().find(r => r.id === Number(id)) || null; },
  toRow(t) { return TODO_COLS.map(c => c === 'erledigt' ? (t[c] ? 1 : 0) : (t[c] ?? '')); },
  insert(t) {
    const rec = normalizeTodo(t);
    if (db) {
      const info = db.prepare(`INSERT INTO wartung_todos (${TODO_COLS.join(',')}) VALUES (${TODO_COLS.map(() => '?').join(',')})`)
        .run(...this.toRow(rec));
      return this.get(Number(info.lastInsertRowid));
    }
    const rows = this.all();
    rec.id = rows.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    rows.push(rec); this.writeTodos(rows); return rec;
  },
  update(id, t) {
    const rec = normalizeTodo(t);
    if (db) {
      db.prepare(`UPDATE wartung_todos SET ${TODO_COLS.map(c => c + '=?').join(',')}, geaendert_am=CURRENT_TIMESTAMP WHERE id=?`)
        .run(...this.toRow(rec), Number(id));
      return this.get(id);
    }
    const rows = this.all(), i = rows.findIndex(x => x.id === Number(id));
    if (i < 0) return null;
    rows[i] = Object.assign(rows[i], rec, { id: Number(id) });
    this.writeTodos(rows); return rows[i];
  },
  remove(id) {
    if (db) { db.prepare('DELETE FROM wartung_todos WHERE id=?').run(Number(id)); return true; }
    this.writeTodos(this.all().filter(r => r.id !== Number(id))); return true;
  },
  writeTodos(rows) {
    const p = JSON.parse(fs.readFileSync(JSON_DB, 'utf8') || '{}');
    const arr = Array.isArray(p) ? { items: p, todos: [] } : p;
    arr.todos = rows;
    fs.writeFileSync(JSON_DB, JSON.stringify(arr, null, 2));
  }
};

/* ------------------------------------------------------------------ Anhänge */
const MAX_UPLOAD = 10 * 1024 * 1024;
const ANH_DIR = path.join(DATA_DIR, 'anhaenge');
const ANH_COLS = ['bezug_art', 'bezug_id', 'dateiname', 'mime', 'groesse', 'pfad', 'kommentar',
  'hochgeladen_am', 'hochgeladen_von'];

/* Kleine Migration: ältere Datenbanken hatten keine bezug_art/kommentar-Spalten */
if (db) {
  try {
    const cols = db.prepare('PRAGMA table_info(wartung_anhaenge)').all().map(c => c.name);
    if (!cols.includes('bezug_art')) db.exec("ALTER TABLE wartung_anhaenge ADD COLUMN bezug_art TEXT NOT NULL DEFAULT 'wartung'");
    if (!cols.includes('bezug_id') && cols.includes('wartung_id')) {
      db.exec('ALTER TABLE wartung_anhaenge ADD COLUMN bezug_id INTEGER NOT NULL DEFAULT 0');
      db.exec('UPDATE wartung_anhaenge SET bezug_id = wartung_id');
    }
    if (!cols.includes('kommentar')) db.exec("ALTER TABLE wartung_anhaenge ADD COLUMN kommentar TEXT NOT NULL DEFAULT ''");
  } catch (e) { console.warn('  Anhang-Migration: ' + e.message); }
}

const ANH = {
  all() {
    if (db) return db.prepare('SELECT * FROM wartung_anhaenge ORDER BY id').all();
    const p = JSON.parse(fs.readFileSync(JSON_DB, 'utf8') || '{}');
    return Array.isArray(p) ? [] : (p.anhaenge || []);
  },
  list(art, id) {
    return this.all()
      .filter(a => (a.bezug_art || 'wartung') === art && Number(a.bezug_id) === Number(id))
      .map(a => ({ id: a.id, dateiname: a.dateiname, mime: a.mime, groesse: a.groesse,
                   kommentar: a.kommentar || '', hochgeladen_am: a.hochgeladen_am,
                   hochgeladen_von: a.hochgeladen_von }));
  },
  get(id) { return this.all().find(a => Number(a.id) === Number(id)) || null; },
  add(art, id, name, mime, buf, user) {
    fs.mkdirSync(ANH_DIR, { recursive: true });
    const safe = String(name).replace(/[^\w.\-() ]+/g, '_').slice(-120) || 'anhang';
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const rel = path.join('anhaenge', art + id + '_' + stamp + '_' + safe);
    fs.writeFileSync(path.join(DATA_DIR, rel), buf);
    const now = new Date();
    const rec = {
      bezug_art: art, bezug_id: Number(id), dateiname: String(name).slice(0, 200), mime: mime,
      groesse: buf.length, pfad: rel, kommentar: '',
      hochgeladen_am: p2(now.getDate()) + '.' + p2(now.getMonth() + 1) + '.' + now.getFullYear() +
        ' ' + p2(now.getHours()) + ':' + p2(now.getMinutes()),
      hochgeladen_von: user || ''
    };
    if (db) {
      const info = db.prepare(`INSERT INTO wartung_anhaenge (${ANH_COLS.join(',')}) VALUES (${ANH_COLS.map(() => '?').join(',')})`)
        .run(...ANH_COLS.map(c => rec[c]));
      return Object.assign({ id: Number(info.lastInsertRowid) }, rec);
    }
    const rows = this.all();
    rec.id = rows.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
    rows.push(rec); this.write(rows);
    return rec;
  },
  /** Kommentar zu einem Anhang ändern */
  setKommentar(id, text) {
    if (db) {
      db.prepare('UPDATE wartung_anhaenge SET kommentar=? WHERE id=?').run(String(text || ''), Number(id));
      return this.get(id);
    }
    const rows = this.all(), i = rows.findIndex(a => Number(a.id) === Number(id));
    if (i < 0) return null;
    rows[i].kommentar = String(text || '');
    this.write(rows);
    return rows[i];
  },
  remove(id) {
    const rec = this.get(id);
    if (rec && rec.pfad) { try { fs.unlinkSync(path.join(DATA_DIR, rec.pfad)); } catch { /* egal */ } }
    if (db) { db.prepare('DELETE FROM wartung_anhaenge WHERE id=?').run(Number(id)); return true; }
    this.write(this.all().filter(a => Number(a.id) !== Number(id))); return true;
  },
  write(rows) {
    const p = JSON.parse(fs.readFileSync(JSON_DB, 'utf8') || '{}');
    const arr = Array.isArray(p) ? { items: p, todos: [], anhaenge: [] } : p;
    arr.anhaenge = rows;
    fs.writeFileSync(JSON_DB, JSON.stringify(arr, null, 2));
  }
};

/* ------------------------------------------------------------------ Helfer */
const p2 = (n) => String(n).padStart(2, '0');
/** Datensätze aus Array ODER Export-Objekt ({records:[…]}) */
const asRecords = (x) => Array.isArray(x) ? x : (x && Array.isArray(x.records) ? x.records : null);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.sql': 'text/plain; charset=utf-8' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 5e7) req.destroy(); });
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : null); } catch (e) { reject(e); } });
  req.on('error', reject);
});

/* ------------------------------------------------------------------ Server */
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  try {
    /* ---------------------------------------------- Techniker-Schnittstelle */
    if (p === '/api/health') return send(res, 200, { ok: true, engine, count: DB.all().length });

    if (p === '/api/items' && req.method === 'GET') return send(res, 200, DB.all());

    const done = /^\/api\/items\/(\d+)\/erledigung$/.exec(p);
    if (done && req.method === 'PATCH') {
      const body = await readBody(req) || {};
      const patch = {};
      for (const c of ERLEDIGUNG) if (c in body) patch[c] = body[c];
      if (!Object.keys(patch).length)
        return send(res, 400, { error: 'Es dürfen nur Erledigungsfelder geändert werden: ' + ERLEDIGUNG.join(', ') });
      if (patch.erledigt && !patch.erledigt_am) patch.erledigt_am = '';   // Datum setzt der Client
      const r = DB.patchErledigung(done[1], patch);
      return r ? send(res, 200, r) : send(res, 404, { error: 'Position nicht gefunden' });
    }

    if (p === '/api/items' || /^\/api\/items\/\d+$/.test(p)) {
      // Klare Auskunft statt stiller Änderung: Stammdaten sind hier schreibgeschützt.
      if (req.method !== 'GET')
        return send(res, 405, {
          error: 'Stammdaten sind schreibgeschützt. Erledigung über PATCH /api/items/:id/erledigung, ' +
                 'Pflege über /api/admin/items.',
          allow: 'GET, PATCH /api/items/:id/erledigung'
        });
      const m = /^\/api\/items\/(\d+)$/.exec(p);
      if (m) { const r = DB.get(m[1]); return r ? send(res, 200, r) : send(res, 404, { error: 'Position nicht gefunden' }); }
    }

    /* -------------------------------------------------------- Administration */
    if (p === '/api/admin/items' && req.method === 'POST')
      return send(res, 201, DB.insert(await readBody(req) || {}));

    if (p === '/api/admin/items/import' && req.method === 'POST') {
      // Akzeptiert sowohl ein Array als auch das Export-Objekt ({"records":[…]})
      const arr = asRecords(await readBody(req));
      if (!Array.isArray(arr)) return send(res, 400, { error: 'Array oder Export-Objekt mit "records" erwartet' });
      return send(res, 200, { imported: DB.replaceAll(arr) });
    }

    const adm = /^\/api\/admin\/items\/(\d+)$/.exec(p);
    if (adm) {
      if (req.method === 'PUT')    { const r = DB.update(adm[1], await readBody(req) || {}); return r ? send(res, 200, r) : send(res, 404, { error: 'Position nicht gefunden' }); }
      if (req.method === 'DELETE') { DB.remove(adm[1]); return send(res, 204, ''); }
      if (req.method === 'GET')    { const r = DB.get(adm[1]); return r ? send(res, 200, r) : send(res, 404, { error: 'Position nicht gefunden' }); }
    }

    /* ------------------------------------- Zusatzaufgaben (Techniker, volle Rechte) */
    if (p === '/api/todos') {
      if (req.method === 'GET')  return send(res, 200, TODO.all());
      if (req.method === 'POST') return send(res, 201, TODO.insert(await readBody(req) || {}));
      return send(res, 405, { error: 'Nur GET und POST auf /api/todos' });
    }
    const tdm = /^\/api\/todos\/(\d+)$/.exec(p);
    if (tdm) {
      if (req.method === 'PUT')    { const r = TODO.update(tdm[1], await readBody(req) || {}); return r ? send(res, 200, r) : send(res, 404, { error: 'Aufgabe nicht gefunden' }); }
      if (req.method === 'DELETE') { TODO.remove(tdm[1]); return send(res, 204, ''); }
      if (req.method === 'GET')    { const r = TODO.get(tdm[1]); return r ? send(res, 200, r) : send(res, 404, { error: 'Aufgabe nicht gefunden' }); }
    }

    /* ------------------------------------------------------------- Anhänge
       Gilt für Wartungspositionen und eigene To-Dos gleichermaßen. */
    const attBase = /^\/api\/(items|todos)\/(\d+)\/anhaenge$/.exec(p);
    if (attBase) {
      const art = attBase[1] === 'todos' ? 'todo' : 'wartung';
      const id = attBase[2];
      const vorhanden = art === 'todo' ? TODO.get(id) : DB.get(id);
      if (!vorhanden) return send(res, 404, { error: 'Bezug nicht gefunden' });
      if (req.method === 'GET')  return send(res, 200, ANH.list(art, id));
      if (req.method === 'POST') {
        const b = await readBody(req) || {};
        if (!b.daten) return send(res, 400, { error: 'Feld "daten" (Base64) fehlt' });
        const buf = Buffer.from(String(b.daten), 'base64');
        if (buf.length > MAX_UPLOAD) return send(res, 413, { error: 'Datei zu groß (max. ' + (MAX_UPLOAD / 1048576) + ' MB)' });
        const rec = ANH.add(art, id, b.dateiname || 'anhang', b.mime || 'application/octet-stream', buf, b.benutzer || '');
        if (b.kommentar) ANH.setKommentar(rec.id, b.kommentar);
        return send(res, 201, Object.assign({}, rec, { kommentar: b.kommentar || '' }));
      }
      return send(res, 405, { error: 'Nur GET und POST' });
    }
    const attItem = /^\/api\/(?:items|todos)\/\d+\/anhaenge\/(\d+)$/.exec(p);
    if (attItem) {
      if (req.method === 'DELETE') { ANH.remove(attItem[1]); return send(res, 204, ''); }
      return send(res, 405, { error: 'Nur DELETE' });
    }
    /* Kommentar zu einem Anhang setzen */
    const attKom = /^\/api\/anhaenge\/(\d+)$/.exec(p);
    if (attKom && req.method === 'PATCH') {
      const b = await readBody(req) || {};
      const r = ANH.setKommentar(attKom[1], b.kommentar || '');
      return r ? send(res, 200, r) : send(res, 404, { error: 'Anhang nicht gefunden' });
    }
    const attFile = /^\/api\/(?:items|todos)\/\d+\/anhaenge\/(\d+)\/datei$/.exec(p);
    if (attFile && req.method === 'GET') {
      const rec = ANH.get(attFile[1]);
      if (!rec) return send(res, 404, { error: 'Anhang nicht gefunden' });
      const full = path.join(DATA_DIR, rec.pfad);
      if (!fs.existsSync(full)) return send(res, 404, { error: 'Datei fehlt im Ablageverzeichnis' });
      return send(res, 200, fs.readFileSync(full), rec.mime || 'application/octet-stream');
    }

    if (p === '/api' || p.startsWith('/api/')) return send(res, 404, { error: 'Unbekannter Endpunkt: ' + p });

    /* ------------------------------------------------ Statische Dateien */
    const file = p === '/' ? '/index.html' : decodeURIComponent(p);
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory())
      return send(res, 404, 'Nicht gefunden: ' + file, 'text/plain; charset=utf-8');
    return send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || 'application/octet-stream');
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  const url = 'http://localhost:' + PORT;
  console.log('\n  Wartungstool-Testserver läuft');
  console.log('  ────────────────────────────────────────────');
  console.log('  Frontend : ' + url + '/?api=' + url + '/api');
  console.log('  Lesen    : GET   ' + url + '/api/items');
  console.log('  Erledigen: PATCH ' + url + '/api/items/:id/erledigung');
  console.log('  Admin    : POST/PUT/DELETE ' + url + '/api/admin/items');
  console.log('  Datenbank: ' + engine + '\n');
});
