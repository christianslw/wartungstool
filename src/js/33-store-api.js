/* Wartungstool · JS · Store: SQL-Backend (REST) */
const ApiStore = {
  label: 'SQL-Backend',
  url: (p) => CONFIG.apiBase.replace(/\/$/, '') + p,
  async req(path, opts = {}) {
    const res = await fetch(this.url(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error('API ' + res.status + ' ' + res.statusText);
    return res.status === 204 ? null : res.json();
  },
  async load() {
    const items = await this.req('/items');
    return { items: (Array.isArray(items) ? items : []).map(normalize), fresh: false };
  },
  async complete(id, patch) {
    const r = await this.req('/items/' + encodeURIComponent(id) + '/erledigung',
      { method: 'PATCH', body: JSON.stringify(patch) });
    return normalize(r);
  },
  supportsAttachments: true,
  listAttachments(art, id) { return this.req('/' + (art === 'todo' ? 'todos' : 'items') + '/' + encodeURIComponent(id) + '/anhaenge'); },
  uploadAttachment(art, id, file, kommentar) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      fr.onload = () => {
        const daten = String(fr.result).split(',')[1] || '';
        this.req('/' + (art === 'todo' ? 'todos' : 'items') + '/' + encodeURIComponent(id) + '/anhaenge', {
          method: 'POST',
          body: JSON.stringify({ dateiname: file.name, mime: file.type || 'application/octet-stream', daten: daten, kommentar: kommentar || '' })
        }).then(resolve, reject);
      };
      fr.readAsDataURL(file);
    });
  },
  removeAttachment(art, id, anhangId) {
    return this.req('/' + (art === 'todo' ? 'todos' : 'items') + '/' + encodeURIComponent(id) +
      '/anhaenge/' + encodeURIComponent(anhangId), { method: 'DELETE' });
  },
  attachmentUrl(art, id, anhangId) {
    return this.url('/' + (art === 'todo' ? 'todos' : 'items') + '/' + encodeURIComponent(id) +
      '/anhaenge/' + encodeURIComponent(anhangId) + '/datei');
  },
  async loadTodos() {
    const a = await this.req('/todos');
    return (Array.isArray(a) ? a : []).map(normalizeTodo);
  },
  async saveTodo(t) {
    const body = JSON.stringify(t);
    const r = t.id == null
      ? await this.req('/todos', { method: 'POST', body })
      : await this.req('/todos/' + encodeURIComponent(t.id), { method: 'PUT', body });
    return normalizeTodo(r);
  },
  async removeTodo(id) {
    return this.req('/todos/' + encodeURIComponent(id), { method: 'DELETE' });
  }
};
