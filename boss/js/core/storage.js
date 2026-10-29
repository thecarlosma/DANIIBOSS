/* DANI OS — adaptadores de persistencia.
   Interfaz común:
     loadAll(collections) → { [collection]: rows[] }
     save(collection, rows) → void (lanza error si falla)
     clear(collections) → void
   Para migrar a Supabase basta con implementar la misma interfaz (ver SupabaseAdapter). */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const PREFIX = 'danios.v1.';

  class LocalStorageAdapter {
    constructor(storage = root.localStorage) {
      this.storage = storage;
    }
    loadAll(collections) {
      const out = {};
      for (const c of collections) {
        try {
          const raw = this.storage.getItem(PREFIX + c);
          out[c] = raw ? JSON.parse(raw) : [];
        } catch (e) {
          console.warn(`[DANI OS] No se pudo leer "${c}"`, e);
          out[c] = [];
        }
      }
      return out;
    }
    save(collection, rows) {
      this.storage.setItem(PREFIX + collection, JSON.stringify(rows));
    }
    clear(collections) {
      collections.forEach((c) => this.storage.removeItem(PREFIX + c));
    }
  }

  /* Adaptador en memoria: usado por los tests y como respaldo si localStorage no está disponible. */
  class MemoryAdapter {
    constructor() { this.db = {}; }
    loadAll(collections) {
      const out = {};
      collections.forEach((c) => (out[c] = JSON.parse(JSON.stringify(this.db[c] || []))));
      return out;
    }
    save(collection, rows) { this.db[collection] = JSON.parse(JSON.stringify(rows)); }
    clear(collections) { collections.forEach((c) => delete this.db[c]); }
  }

  /* Esqueleto para la fase Supabase (no se usa todavía).
     const adapter = new SupabaseAdapter(createClient(URL, ANON_KEY));
     await adapter.hydrate(DOS.schema.COLLECTIONS) antes de DOS.store.init(adapter). */
  class SupabaseAdapter {
    constructor(client) { this.client = client; this.cache = {}; }
    async hydrate(collections) {
      for (const c of collections) {
        const { data, error } = await this.client.from(c).select('*');
        if (error) throw error;
        this.cache[c] = data || [];
      }
    }
    loadAll(collections) {
      const out = {};
      collections.forEach((c) => (out[c] = this.cache[c] || []));
      return out;
    }
    save(collection, rows) {
      // Estrategia simple: upsert del conjunto. En producción usar operaciones por fila.
      this.cache[collection] = rows;
      this.client.from(collection).upsert(rows).then(({ error }) => error && console.error(error));
    }
    clear() { /* no-op: borrar en servidor requiere confirmación explícita */ }
  }

  DOS.storage = { LocalStorageAdapter, MemoryAdapter, SupabaseAdapter, PREFIX };
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
