/* DANI OS — sincronización en la nube (Supabase).
   Estrategia "offline-first":
   - Caché local por usuario (localStorage) → la app abre al instante, incluso sin conexión.
   - Cada guardado se compara con la última foto conocida; solo se envían filas cambiadas o borradas.
   - Cola de cambios pendientes persistida: si no hay conexión se reintenta sola.
   - Tiempo real: lo que hagas en un dispositivo aparece en el otro sin recargar.
   - Los cambios locales sin subir siempre prevalecen sobre lo que llega del servidor.
   Tabla única `records` (ver supabase/schema.sql). */
(function (root) {
  const DOS = root.DOS;
  const CFG = root.DOS_CONFIG || {};
  const TABLE = 'records';

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  class CloudAdapter {
    constructor(client, userId) {
      this.client = client;
      this.uid = userId;
      this.prefix = `danios.cloud.${userId}.`;
      this.snap = {};
      this.cache = {};
      this.queue = this._ls('__queue') || {};
      this.lastPull = this._ls('__lastPull');
      this.status = 'idle';
      this.listeners = new Set();
      this.store = null;
      this.flushTimer = null;
      this.flushing = false;
    }

    _ls(key, value) {
      try {
        if (value === undefined) return JSON.parse(localStorage.getItem(this.prefix + key) || 'null');
        localStorage.setItem(this.prefix + key, JSON.stringify(value));
      } catch (e) { return null; }
      return null;
    }
    _saveQueue() { this._ls('__queue', this.queue); }
    setStatus(s) { this.status = s; this.listeners.forEach((fn) => fn(s)); }
    pendingCount() { return Object.keys(this.queue).length; }

    /** Descarga todo (since = null) o solo lo cambiado desde una hora del servidor. */
    async fetchAll(since = null) {
      const rows = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        let q = this.client.from(TABLE).select('collection,id,data,deleted,updated_at');
        if (since) q = q.gte('updated_at', since);
        const { data, error } = await q.order('collection').order('id').range(from, from + size - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < size) break;
      }
      this._trackPull(rows);
      return rows;
    }
    _trackPull(rows) {
      rows.forEach((r) => { if (r.updated_at && (!this.lastPull || r.updated_at > this.lastPull)) this.lastPull = r.updated_at; });
      if (this.lastPull) this._ls('__lastPull', this.lastPull);
    }
    /** Margen de 10 s hacia atrás: aplicar dos veces el mismo cambio es inofensivo. */
    _since() {
      if (!this.lastPull) return null;
      return new Date(new Date(this.lastPull).getTime() - 10000).toISOString();
    }

    /** Antes de store.init: caché + descarga del servidor + migración única de los datos locales. */
    async hydrate(collections) {
      collections.forEach((c) => (this.cache[c] = this._ls(c) || []));
      let remote = null;
      try {
        remote = await withTimeout(this.fetchAll(), 12000);
      } catch (e) {
        console.warn('[DANI OS] Sin conexión con la nube; se usa la copia local', e);
        this.setStatus('offline');
      }
      if (remote) {
        const byC = {};
        collections.forEach((c) => (byC[c] = new Map()));
        remote.forEach((r) => { if (!r.deleted && byC[r.collection]) byC[r.collection].set(r.id, r.data); });
        Object.values(this.queue).forEach((q) => {
          if (!byC[q.c]) return;
          if (q.row) byC[q.c].set(q.id, q.row); else byC[q.c].delete(q.id);
        });
        // Primera vez en este dispositivo: sube lo que hubiera en modo local (danios.v1.*).
        // Los datos DEMO solo se suben si la nube está vacía (evita duplicarlos desde un segundo dispositivo).
        if (!this._ls('__migrated')) {
          const remoteHasData = remote.some((r) => !r.deleted && r.collection !== 'users');
          const local = new DOS.storage.LocalStorageAdapter().loadAll(collections);
          collections.forEach((c) => (local[c] || []).forEach((row) => {
            if (!row || !row.id || byC[c].has(row.id)) return;
            if (row.is_demo && remoteHasData) return;
            byC[c].set(row.id, row);
            this.queue[`${c}|${row.id}`] = { c, id: row.id, row };
          }));
          this._ls('__migrated', true);
          this._saveQueue();
        }
        collections.forEach((c) => { this.cache[c] = [...byC[c].values()]; this._ls(c, this.cache[c]); });
      }
      collections.forEach((c) => { this.snap[c] = new Map(this.cache[c].map((r) => [r.id, JSON.stringify(r)])); });
    }

    /* ---- Interfaz de adaptador (la usa DOS.store) ---- */
    loadAll(collections) {
      const out = {};
      collections.forEach((c) => (out[c] = (this.cache[c] || []).slice()));
      return out;
    }
    save(c, rows) {
      const prev = this.snap[c] || new Map();
      const next = new Map();
      rows.forEach((r) => {
        const json = JSON.stringify(r);
        next.set(r.id, json);
        if (prev.get(r.id) !== json) this.queue[`${c}|${r.id}`] = { c, id: r.id, row: r };
      });
      prev.forEach((_, id) => { if (!next.has(id)) this.queue[`${c}|${id}`] = { c, id, row: null }; });
      this.snap[c] = next;
      this.cache[c] = rows;
      this._ls(c, rows);
      this._saveQueue();
      this.scheduleFlush();
    }
    clear(collections) { collections.forEach((c) => this.save(c, [])); }

    /* ---- Subida ---- */
    scheduleFlush(ms = 400) {
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), ms);
    }
    async flush() {
      if (this.flushing) { this.scheduleFlush(800); return; }
      const items = Object.entries(this.queue);
      if (!items.length) { this.setStatus('synced'); return; }
      this.flushing = true;
      this.setStatus('syncing');
      const payload = items.map(([, q]) => ({ user_id: this.uid, collection: q.c, id: q.id, data: q.row, deleted: !q.row }));
      try {
        for (let i = 0; i < payload.length; i += 500) {
          const { error } = await this.client.from(TABLE).upsert(payload.slice(i, i + 500), { onConflict: 'user_id,collection,id' });
          if (error) throw error;
        }
        items.forEach(([k, q]) => { if (this.queue[k] === q) delete this.queue[k]; });
        this._saveQueue();
        if (this.pendingCount()) this.scheduleFlush(100); else this.setStatus('synced');
      } catch (e) {
        console.warn('[DANI OS] No se pudo sincronizar; se reintentará', e);
        this.setStatus(navigator.onLine === false ? 'offline' : 'error');
        this.scheduleFlush(15000);
      } finally {
        this.flushing = false;
      }
    }

    /* ---- Bajada ---- */
    applyRemote(r) {
      const c = r.collection;
      if (!this.snap[c] || this.queue[`${c}|${r.id}`]) return false;
      const row = r.deleted ? null : r.data;
      const changed = this.store.applyRemote(c, r.id, row);
      if (row) this.snap[c].set(r.id, JSON.stringify(row)); else this.snap[c].delete(r.id);
      if (changed) { this.cache[c] = this.store.data[c]; this._ls(c, this.cache[c]); }
      return changed;
    }
    async refresh() {
      if (this.refreshing) return;
      this.refreshing = true;
      try {
        const rows = await this.fetchAll(this._since());
        let changed = false;
        rows.forEach((r) => { if (this.applyRemote(r)) changed = true; });
        if (changed) this.store.emit('*', 'remote');
        if (!this.pendingCount()) this.setStatus('synced');
      } catch (e) {
        this.setStatus(navigator.onLine === false ? 'offline' : 'error');
      } finally {
        this.refreshing = false;
      }
    }

    /** Canal en tiempo real autenticado, con reconexión automática si falla o no termina de conectar. */
    async subscribe() {
      try {
        const { data } = await this.client.auth.getSession();
        if (data.session && this.client.realtime && this.client.realtime.setAuth) this.client.realtime.setAuth(data.session.access_token);
      } catch (e) { /* sin sesión todavía */ }
      if (this.channel) { const old = this.channel; this.channel = null; try { await this.client.removeChannel(old); } catch (e) { /* nada */ } }
      const channel = this.client
        .channel(`records-${this.uid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${this.uid}` }, (p) => {
          if (p.new && p.new.collection) {
            this._trackPull([p.new]);
            if (this.applyRemote(p.new)) this.store.emit(p.new.collection, 'remote');
          }
        });
      this.channel = channel;
      clearTimeout(this.joinTimer);
      this.joinTimer = setTimeout(() => { if (this.channel === channel && channel.state !== 'joined') this.subscribe(); }, 15000);
      channel.subscribe((status) => {
        if (this.channel !== channel) return;
        if (status === 'SUBSCRIBED') { clearTimeout(this.joinTimer); this.refresh(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setTimeout(() => { if (this.channel === channel) this.subscribe(); }, 5000);
      });
    }

    start(store) {
      this.store = store;
      this.subscribe();
      // Red de seguridad: cada 15 s descarga solo lo nuevo (por si el tiempo real se corta).
      setInterval(() => { if (!document.hidden) this.refresh(); }, 15000);
      this.client.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && session && this.client.realtime && this.client.realtime.setAuth) this.client.realtime.setAuth(session.access_token);
      });
      // En iPhone la conexión en tiempo real se duerme en segundo plano: al volver, refrescamos.
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { this.flush(); this.refresh(); } });
      window.addEventListener('online', () => { this.flush(); this.refresh(); });
      window.addEventListener('focus', () => this.refresh());
      this.flush();
    }
  }

  const ERRORS = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Confirma tu correo: revisa tu bandeja de entrada (y spam).',
    'User already registered': 'Ese correo ya tiene cuenta. Inicia sesión.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  };
  const tr = (msg) => ERRORS[msg] || (/fetch|network/i.test(msg || '') ? 'Sin conexión. Revisa tu internet.' : msg || 'Error inesperado.');

  const cloud = {
    CloudAdapter,
    client: null,
    adapter: null,
    user: null,
    enabled() { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); },
    init() {
      if (!root.supabase) throw new Error('No se pudo cargar la librería de sincronización.');
      this.client = root.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'danios.auth' } });
    },
    async session() {
      const { data } = await this.client.auth.getSession();
      return data.session;
    },
    async signOut() {
      try { await this.client.auth.signOut(); } catch (e) { /* sin conexión: igual se cierra localmente */ }
      try { localStorage.removeItem('danios.auth'); } catch (e) { /* nada */ }
      location.reload();
    },

    /** Pantalla de acceso. Resuelve con la sesión cuando el usuario entra. */
    loginScreen() {
      const esc = DOS.utils.esc;
      return new Promise((resolve) => {
        const el = document.createElement('div');
        el.className = 'auth';
        let mode = 'login';
        const draw = (msg = '', type = 'error') => {
          el.innerHTML = `<form class="auth-card" novalidate>
            <img class="auth-photo" src="assets/avatar.png" alt="">
            <h1>DANI BOSS</h1>
            <p class="muted">${mode === 'login' ? 'Inicia sesión para sincronizar tu Mac y tu iPhone.' : 'Crea tu cuenta privada. Solo tú verás tus datos.'}</p>
            <div class="field"><label for="auth-email">Correo</label><input class="input" id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>
            <div class="field"><label for="auth-pass">Contraseña</label><input class="input" id="auth-pass" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="6" required></div>
            ${msg ? `<div class="${type === 'error' ? 'form-error' : 'auth-ok'}">${esc(msg)}</div>` : ''}
            <button class="btn btn-primary block" type="submit" style="height:42px;margin-top:18px">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
            <button class="btn btn-ghost block" type="button" data-switch style="margin-top:8px">${mode === 'login' ? '¿Primera vez? Crear cuenta' : 'Ya tengo cuenta'}</button>
          </form>`;
          el.querySelector('[data-switch]').onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; draw(); };
          el.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const email = e.target.email.value.trim(), password = e.target.password.value;
            if (!email || password.length < 6) return draw('Escribe tu correo y una contraseña de al menos 6 caracteres.');
            const btn = e.target.querySelector('[type=submit]');
            btn.disabled = true; btn.textContent = 'Un momento…';
            try {
              const fn = mode === 'login' ? this.client.auth.signInWithPassword : this.client.auth.signUp;
              const { data, error } = await fn.call(this.client.auth, { email, password });
              if (error) return draw(tr(error.message));
              if (!data.session) { mode = 'login'; return draw('Cuenta creada. Te enviamos un correo: confírmalo y luego inicia sesión aquí.', 'ok'); }
              el.remove();
              resolve(data.session);
            } catch (err) {
              draw(tr(err.message));
            }
          };
        };
        draw();
        document.body.appendChild(el);
        setTimeout(() => { const i = el.querySelector('input'); if (i && window.innerWidth > 860) i.focus(); }, 50);
      });
    },
  };

  DOS.cloud = cloud;
})(window);
