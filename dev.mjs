#!/usr/bin/env node
/* ===========================================================================
   Wartungstool · Dev-Server
   ---------------------------------------------------------------------------
   Fuer die Entwicklung: baut index.html aus src/, liefert das Projekt aus und
   laedt den Browser bei jeder Aenderung automatisch neu. Es wird NICHTS in
   index.html eingebaut - der Reload-Client wird nur beim Ausliefern ergaenzt.

       node dev.mjs               http://127.0.0.1:8090
       node dev.mjs --port 9000
       node dev.mjs --open        Browser oeffnen
       node dev.mjs --api         mit dem SQL-Testserver verbinden
                                  (haengt ?api=... an die Adresse)

   Der produktive Testserver (SQLite/REST) bleibt server.mjs auf Port 8080.
   ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(val('--port', process.env.PORT || 8090));
const OPEN = has('--open');
const USE_API = has('--api');
const URL_PATH = USE_API ? '/?api=' + encodeURIComponent('http://localhost:8080/api') : '/';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.woff2': 'font/woff2', '.mjs': 'text/javascript; charset=utf-8', '.sql': 'text/plain; charset=utf-8'
};

const RELOAD = '<script>/* dev */ (() => { try { const s = new EventSource("/__dev/events");' +
  's.onmessage = (e) => { if (e.data === "reload") location.reload(); }; } catch (e) {} })();<' + '/script>';

function build(quiet) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'build.mjs'), quiet ? '--quiet' : '--check'],
      { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('Build fehlgeschlagen (' + c + ')'))));
  });
}

/* ---- Live-Reload ueber Server-Sent Events -------------------------------- */
const clients = new Set();
function broadcast() { for (const res of clients) { try { res.write('data: reload\n\n'); } catch (e) {} } }

/* ---- Statisch ausliefern, index.html mit Reload-Client ------------------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__dev/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': verbunden\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Nicht gefunden: ' + rel);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (ext === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace('</body>', RELOAD + '\n</body>');
    res.end(html);
  } else {
    fs.createReadStream(file).pipe(res);
  }
});

/* ---- Aenderungen beobachten: src/ rekursiv + die Quelldaten -------------- */
function watch() {
  let t = null;
  const trigger = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      try { await build(true); console.log('  neu gebaut -> Reload'); broadcast(); }
      catch (e) { console.error('  ' + e.message); }
    }, 80);
  };
  try { fs.watch(SRC, { recursive: true }, trigger); } catch (e) { console.error('watch src/ nicht moeglich: ' + e.message); }
  for (const f of ['daten.js', 'wartungen2026.json']) {
    try { fs.watch(path.join(ROOT, f), trigger); } catch (e) {}
  }
}

await build(false);
watch();
server.listen(PORT, '127.0.0.1', () => {
  const base = 'http://127.0.0.1:' + PORT + URL_PATH;
  console.log('\nDev-Server laeuft:  ' + base);
  console.log('  (Produktions-Backend separat:  node server.mjs  ->  Port 8080)\n');
  if (OPEN) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', base]]
      : process.platform === 'darwin' ? ['open', [base]] : ['xdg-open', [base]];
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
  }
});
