/* Wartungstool · JS · DOM-Helfer, Icons */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const ICON = {
  search : '<path d="M13 4a9 9 0 1 0 5.66 16l6.17 6.17 1.41-1.41L20 18.59A9 9 0 0 0 13 4m0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14"/>',
  close  : '<path d="M24 9.4 22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16z"/>',
  check  : '<path d="M12.6 24 4 15.4l1.7-1.7 6.9 6.9L26.3 6.9 28 8.6z"/>',
  undo   : '<path d="M13 8H8.4l2.3-2.3L9.3 4.3 4.6 9l4.7 4.7 1.4-1.4L8.4 10H13a6 6 0 0 1 0 12H8v2h5a8 8 0 0 0 0-16z"/>',
  chevR  : '<path d="M12 6 10.6 7.4 19.2 16l-8.6 8.6L12 26l10-10z"/>',
  chevD  : '<path d="M16 22.6 5.4 12l1.7-1.7L16 19.2l8.9-8.9 1.7 1.7z"/>',
  sortUp : '<path d="M16 8l8 10H8z"/>',
  sortDn : '<path d="M16 24 8 14h16z"/>',
  notes  : '<path d="M24 4H8v24h9v-2H10V6h12v7h2zM14 10h8v2h-8zm0 4h8v2h-8zm0 4h5v2h-5z"/><path d="M22 18h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/>',
  calendar:'<path d="M26 6h-4V4h-2v2h-8V4h-2v2H6v22h20zm-18 8h16v12H8zm0-6h2v2h2V8h8v2h2V8h2v4H8z"/>',
  edit   : '<path d="M24.6 4.6 27.4 7.4 10 24.8 5.6 26l1.2-4.4zM22 6l4 4"/>',
  download:'<path d="M25 23v3H7v-3H5v5h22v-5zM16 5l7 7h-5v10h-4V12H9z"/>',
  plus   : '<path d="M15 6h2v9h9v2h-9v9h-2v-9H6v-2h9z"/>',
  warn   : '<path d="M16 3 30 27H2zm0 2.3L4.3 25h23.4zM15 11h2v8h-2zm0 10h2v2h-2z"/>',
  info   : '<path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24m0 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20m-1 4h2v2h-2zm0 4h2v8h-2z"/>'
};
const svg = (d, size = 16, cls = '') =>
  '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">' + d + '</svg>';
