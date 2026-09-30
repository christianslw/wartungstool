/* Wartungstool · JS · Store: lokaler Bestand (localStorage) */
const LocalStore = {
  label: 'Lokaler Testbestand',
  persist(items, sig) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        v: 4, quelle: hasDataFile() ? 'datei' : 'test', sig: sig || '',
        saved: new Date().toISOString(), items
      }));
    } catch (e) {}
  },
  async load() {
    let cached = null;
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.items)) cached = p;
      }
    } catch (e) {}
    const sig = dataSignature();
    // Ohne Stammdatendatei bleibt der Cache massgeblich (reiner Testbestand).
    if (cached && !sig) return { items: cached.items.map(normalize), fresh: false };
    // Daten unveraendert -> Cache verwenden.
    if (cached && cached.sig === sig) return { items: cached.items.map(normalize), fresh: false };
    // Erstbezug oder Datenquelle geaendert -> neu einlesen, Erledigungen retten.
    const items = cached ? carryCompletion(cached.items.map(normalize), seedData()) : seedData();
    this.persist(items, sig);
    return { items, fresh: true };
  },
  async complete(id, patch) {
    const raw = localStorage.getItem(CONFIG.storageKey);
    let p;
    try { p = JSON.parse(raw); } catch { p = null; }
    if (!p || !Array.isArray(p.items)) p = { items: seedData() };
    const it = p.items.find(x => String(x.id) === String(id));
    if (!it) throw new Error('Position nicht gefunden');
    Object.assign(it, patch);
    this.persist(p.items, dataSignature());
    return normalize(it);
  },
  async loadTodos() {
    try {
      const a = JSON.parse(localStorage.getItem(CONFIG.storageKey + '.todos') || '[]');
      if (Array.isArray(a)) return a.map(normalizeTodo);
    } catch (e) {}
    return [];
  },
  async saveTodo(t) {
    const list = await this.loadTodos();
    const i = list.findIndex(x => String(x.id) === String(t.id));
    const rec = Object.assign({}, t);
    if (t.id == null || i < 0) {
      rec.id = list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
      list.push(rec);
    } else {
      list[i] = Object.assign(list[i], rec);
    }
    localStorage.setItem(CONFIG.storageKey + '.todos', JSON.stringify(list));
    return list.find(x => String(x.id) === String(rec.id));
  },
  async removeTodo(id) {
    const list = (await this.loadTodos()).filter(x => String(x.id) !== String(id));
    localStorage.setItem(CONFIG.storageKey + '.todos', JSON.stringify(list));
    return true;
  }
};
