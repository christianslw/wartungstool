#!/usr/bin/env node
/* ===========================================================================
   Wartungstool · Build
   ---------------------------------------------------------------------------
   Setzt die eine ausgelieferte index.html aus den Schnipseln in src/ zusammen.
   Es entstehen KEINE zusaetzlichen Dateien: index.html bleibt eigenstaendig
   (Doppelklick, file://, ohne Build-Tool nutzbar).

       node build.mjs            baut index.html
       node build.mjs --check    baut und prueft zusaetzlich (Syntax, Marker)
       node build.mjs --watch    baut bei jeder Aenderung in src/ neu
       node build.mjs --quiet    ohne Ausgabe (fuer Skripte)

   Reihenfolge = Dateiname. Numerische Praefixe steuern die Sortierung:
       src/styles/10-appbar.css  vor  src/styles/20-toolbar.css
   Neue Schnipsel einfach mit passender Nummer ablegen - hier ist nichts
   anzupassen.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

const argv = new Set(process.argv.slice(2));
const QUIET = argv.has('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const list = (dir, ext) => {
  const abs = path.join(SRC, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith(ext)).sort()
    .map((f) => ({ name: f, rel: 'src/' + dir + '/' + f, body: read('src/' + dir + '/' + f).replace(/\s+$/, '') }));
};

function build() {
  const styles = list('styles', '.css');
  const markup = list('markup', '.html');
  const scripts = list('js', '.js');
  const seed = read('src/data/seed.json').replace(/\s+$/, '');
  let template = read('src/index.template.html');

  const styleBlock = '<style>\n' + styles.map((s) => s.body).join('\n\n') + '\n</style>';
  const markupBlock = markup.map((m) => m.body).join('\n\n');
  const seedBlock = '<script type="application/json" id="seed">\n' + seed + '\n</script>';

  // Jedes Modul bleibt ein eigenes <script>: DevTools zeigt es dank
  // //# sourceURL als getrennte Quelle - die Auslieferung bleibt eine Datei.
  const scriptBlock = scripts.map((s) =>
    '<script>\n' + "'use strict';\n" + s.body + '\n//# sourceURL=' + s.rel + '\n</script>'
  ).join('\n\n');

  const missing = [];
  const sub = (marker, value) => {
    if (!template.includes(marker)) { missing.push(marker); return; }
    // Funktion als Ersatz: sonst deutet String.replace() $-Sequenzen im
    // Ersatztext (z. B. das "$$" der DOM-Helfer) als Rueckverweise.
    template = template.replace(marker, () => value);
  };
  sub('<!-- @styles -->', styleBlock);
  sub('<!-- @markup -->', markupBlock);
  sub('<!-- @seed -->', seedBlock);
  sub('<!-- @scripts -->', scriptBlock);
  if (missing.length) throw new Error('Marker im Template fehlen: ' + missing.join(', '));

  const inputText = [...styles, ...markup, ...scripts,
    { rel: 'src/index.template.html', body: template }, { rel: 'src/data/seed.json', body: seed }]
    .map((i) => i.rel + '\u0000' + i.body).join('\u0001');
  const hash = crypto.createHash('sha1').update(inputText).digest('hex').slice(0, 8);

  const banner =
    '<!-- ==========================================================================\n' +
    '     GENERIERTE DATEI - NICHT DIREKT BEARBEITEN.\n' +
    '     Quelle: src/   Bauen: node build.mjs   (Build ' + hash + ')\n' +
    '     ========================================================================== -->';
  const html = template.replace('<!doctype html>', '<!doctype html>\n' + banner);

  fs.writeFileSync(OUT, html, 'utf8');
  return { styles, markup, scripts, html, hash };
}

function check(styles, scripts, html) {
  let fails = 0;
  const fail = (m) => { console.error('  FEHLER  ' + m); fails++; };

  // Alle JS-Module zusammen muessen syntaktisch gueltig sein (auch die
  // Reihenfolge: eine Referenz auf eine zu spaet deklarierte const faellt hier
  // noch nicht auf, aber Syntaxfehler und doppelte Deklarationen).
  try {
    new vm.Script(scripts.map((s) => s.body).join('\n'), { filename: 'kombiniert.js' });
  } catch (e) { fail('JS-Syntax: ' + e.message); }

  const seen = new Set();
  for (const s of scripts) {
    if (seen.has(s.name)) fail('doppelter Modulname: ' + s.name);
    seen.add(s.name);
  }
  for (const s of styles) {
    const open = (s.body.match(/{/g) || []).length;
    const close = (s.body.match(/}/g) || []).length;
    if (open !== close) fail(s.rel + ': { ' + open + ' / } ' + close);
  }
  for (const m of ['<!-- @styles -->', '<!-- @markup -->', '<!-- @seed -->', '<!-- @scripts -->'])
    if (html.includes(m)) fail('unersetzter Marker: ' + m);
  if (!html.includes('id="seed"')) fail('Seed-Block fehlt');

  try { JSON.parse(read('src/data/seed.json')); } catch (e) { fail('seed.json: ' + e.message); }

  // Die gebaute Datei muss syntaktisch wohlgeformt sein (grobe HTML-Bilanz).
  const balance = (re) => (html.match(re) || []).length;
  if (balance(/<script\b/g) !== balance(/<\/script>/g)) fail('script-Tags unausgeglichen');
  if (balance(/<style\b/g) !== balance(/<\/style>/g)) fail('style-Tags unausgeglichen');

  log(fails ? '  ' + fails + ' Pruefung(en) fehlgeschlagen' : '  Pruefungen OK');
  return fails;
}

function run() {
  const { styles, scripts, html, hash } = build();
  log('Build ' + hash + '  ->  index.html');
  log('  styles: ' + styles.length + '   js: ' + scripts.length + '   Groesse: ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB');
  if (argv.has('--check') && check(styles, scripts, html)) process.exit(1);
}

run();

if (argv.has('--watch')) {
  log('  beobachte src/ ... (Strg+C beendet)');
  let t = null;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      try { run(); } catch (e) { console.error('Build-Fehler: ' + e.message); }
    }, 60);
  });
}
