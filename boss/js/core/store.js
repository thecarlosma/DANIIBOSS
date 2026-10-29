/* DANI OS — store: estado en memoria + CRUD + persistencia + suscripciones.
   Es el ÚNICO punto que escribe datos; las vistas nunca tocan el storage directamente. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;
  const S = DOS.schema;

  const PREFIX_BY_COLLECTION = {
    income: 'inc', expenses: 'exp', transactions: 'trx', debts: 'debt', debt_payments: 'pay',
    events: 'evt', tasks: 'task', day_blocks: 'blk', habits: 'hab', habit_logs: 'hlog',
    routines: 'rtn', exercises: 'exr', workouts: 'wkt', goals: 'goal', subscriptions: 'sub',
  };

  // Relaciones para borrado en cascada
  const CASCADE = {
    debts: [['debt_payments', 'debt_id']],
    habits: [['habit_logs', 'habit_id']],
    routines: [['exercises', 'routine_id']],
  };

  const store = {
    data: {},
    adapter: null,
    listeners: new Set(),
    onError: null,

    init(adapter) {
      this.adapter = adapter;
      const loaded = adapter.loadAll(S.COLLECTIONS);
      S.COLLECTIONS.forEach((c) => (this.data[c] = Array.isArray(loaded[c]) ? loaded[c] : []));
      if (!this.data.users.length) {
        this.data.users.push({ ...S.defaultUser, created_at: new Date().toISOString() });
        this.persist('users');
      }
      return this;
    },

    /* ---------- Lectura ---------- */
    all(c) { return this.data[c] || []; },
    get(c, id) { return this.all(c).find((r) => r.id === id) || null; },
    where(c, pred) { return this.all(c).filter(pred); },
    user() { return { ...S.defaultUser, ...this.data.users[0] }; },
    hasDemo() { return S.COLLECTIONS.some((c) => this.all(c).some((r) => r.is_demo)); },

    /* ---------- Escritura ---------- */
    insert(c, row, { silent = false } = {}) {
      const now = new Date().toISOString();
      const rec = { id: U.uid(PREFIX_BY_COLLECTION[c] || c), user_id: 'local', created_at: now, updated_at: now, ...row };
      this.data[c].push(rec);
      this.persist(c);
      if (!silent) this.emit(c, 'insert', rec);
      return rec;
    },
    insertMany(c, rows) {
      const now = new Date().toISOString();
      const recs = rows.map((row) => ({ id: U.uid(PREFIX_BY_COLLECTION[c] || c), user_id: 'local', created_at: now, updated_at: now, ...row }));
      this.data[c].push(...recs);
      this.persist(c);
      return recs;
    },
    update(c, id, patch) {
      const i = this.data[c].findIndex((r) => r.id === id);
      if (i < 0) return null;
      this.data[c][i] = { ...this.data[c][i], ...patch, id, updated_at: new Date().toISOString() };
      this.persist(c);
      this.emit(c, 'update', this.data[c][i]);
      return this.data[c][i];
    },
    /** Elimina (con cascada) y devuelve lo eliminado para poder deshacer con restore(). */
    remove(c, id) {
      const rec = this.get(c, id);
      if (!rec) return null;
      const removed = { collection: c, rec, children: [] };
      this.data[c] = this.data[c].filter((r) => r.id !== id);
      (CASCADE[c] || []).forEach(([child, fk]) => {
        const rows = this.data[child].filter((r) => r[fk] === id);
        if (!rows.length) return;
        removed.children.push([child, rows]);
        this.data[child] = this.data[child].filter((r) => r[fk] !== id);
        this.persist(child);
      });
      this.persist(c);
      this.emit(c, 'remove', rec);
      return removed;
    },
    restore(removed) {
      if (!removed) return;
      const { collection, rec, children } = removed;
      this.data[collection].push(rec);
      this.persist(collection);
      children.forEach(([child, rows]) => { this.data[child].push(...rows); this.persist(child); });
      this.emit(collection, 'restore', rec);
    },
    removeWhere(c, pred) {
      const before = this.data[c].length;
      this.data[c] = this.data[c].filter((r) => !pred(r));
      if (this.data[c].length !== before) this.persist(c);
      return before - this.data[c].length;
    },
    updateUser(patch) {
      this.data.users[0] = { ...this.user(), ...patch, updated_at: new Date().toISOString() };
      this.persist('users');
      this.emit('users', 'update', this.data.users[0]);
    },

    /** Aplica un cambio llegado de otro dispositivo sin volver a enviarlo. Devuelve true si cambió algo. */
    applyRemote(c, id, row) {
      if (!this.data[c]) return false;
      const i = this.data[c].findIndex((r) => r.id === id);
      if (row) {
        if (i >= 0 && JSON.stringify(this.data[c][i]) === JSON.stringify(row)) return false;
        if (i >= 0) this.data[c][i] = row; else this.data[c].push(row);
      } else {
        if (i < 0) return false;
        this.data[c].splice(i, 1);
      }
      if (c === 'users' && !this.data.users.length) this.data.users.push({ ...S.defaultUser });
      return true;
    },

    /* ---------- Persistencia ---------- */
    persist(c) {
      try {
        this.adapter.save(c, this.data[c]);
      } catch (e) {
        console.error('[DANI OS] Error guardando', c, e);
        if (this.onError) this.onError(e);
      }
    },
    clearDemo() {
      let n = 0;
      S.COLLECTIONS.forEach((c) => { if (c !== 'users') n += this.removeWhere(c, (r) => r.is_demo); });
      this.emit('*', 'clear');
      return n;
    },
    resetAll() {
      this.adapter.clear(S.COLLECTIONS);
      S.COLLECTIONS.forEach((c) => (this.data[c] = []));
      this.data.users.push({ ...S.defaultUser, demo_seeded: true, created_at: new Date().toISOString() });
      this.persist('users');
      this.emit('*', 'reset');
    },
    exportJSON() {
      return JSON.stringify({ app: 'DANI OS', version: 1, exported_at: new Date().toISOString(), data: this.data }, null, 2);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || parsed.app !== 'DANI OS' || !parsed.data) throw new Error('El archivo no es una copia de seguridad de DANI OS.');
      S.COLLECTIONS.forEach((c) => {
        this.data[c] = Array.isArray(parsed.data[c]) ? parsed.data[c] : [];
        this.persist(c);
      });
      if (!this.data.users.length) { this.data.users.push({ ...S.defaultUser }); this.persist('users'); }
      this.emit('*', 'import');
    },

    /* ---------- Suscripciones ---------- */
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit(collection, op, rec) { this.listeners.forEach((fn) => fn({ collection, op, rec })); },
  };

  DOS.store = store;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
