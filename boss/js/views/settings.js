/* DANI OS — Configuración: perfil, privacidad, datos. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  function storageInfo() {
    const rows = S.COLLECTIONS.reduce((a, c) => a + store.all(c).length, 0);
    let bytes = 0;
    try { Object.keys(localStorage).filter((k) => k.startsWith(DOS.storage.PREFIX)).forEach((k) => (bytes += (localStorage.getItem(k) || '').length * 2)); } catch (e) { /* sin acceso */ }
    return { rows, kb: Math.round(bytes / 1024) };
  }

  function syncCard() {
    const c = DOS.cloud;
    if (!c || !c.adapter) {
      return `<div class="card"><div class="card-head"><h3>Sincronización</h3>${icon('refresh', 'accent')}</div>
        <p class="muted" style="font-size:12.5px;margin:0">Desactivada: tus datos viven solo en este navegador. Para usar DANI BOSS en Mac y iPhone a la vez, configura Supabase en <code>js/config.js</code>.</p></div>`;
    }
    const st = { synced: ['pos', 'Todo sincronizado'], syncing: ['warn', 'Sincronizando…'], offline: ['warn', 'Sin conexión: se subirá al volver'], error: ['neg', 'Error al sincronizar: reintentando'], idle: ['', 'Conectando…'] }[c.adapter.status] || ['', ''];
    const n = c.adapter.pendingCount();
    return `<div class="card"><div class="card-head"><h3>Cuenta y sincronización</h3>${icon('refresh', 'accent')}</div>
      <div class="list-item" style="padding-top:0"><div class="icon-tile accent">${icon('user')}</div><div class="grow"><div class="title">${esc(c.user ? c.user.email : '')}</div>
      <div class="meta"><span class="${st[0]}">${st[1]}</span>${n ? ` · ${n} cambio${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'}` : ''}</div></div></div>
      <p class="muted" style="font-size:12.5px;margin:6px 0 14px">Lo que registres aquí aparece automáticamente en tus otros dispositivos con esta cuenta.</p>
      <div class="row wrap"><button class="btn btn-secondary" data-action="sync-now">${icon('refresh')}Sincronizar ahora</button>
      <button class="btn btn-ghost" data-action="sign-out">Cerrar sesión</button></div></div>`;
  }

  /* ---------- Siri y atajos ---------- */
  const siri = { loaded: 0, keys: [], error: false };
  const SHORTCUT_URL = 'atajo/Modo%20Boss.shortcut';

  let gcalMsg = null;
  const gcalAccount = (url) => { const m = /\/ical\/([^/]+)\//.exec(url || ''); return m ? decodeURIComponent(m[1]) : 'calendario conectado'; };
  function gcalCard() {
    const u = store.user();
    const n = store.all('events').filter((e) => String(e.id).startsWith('gcal_')).length;
    if (!DOS.cloud || !DOS.cloud.enabled()) return '';
    const form = (label) => `
        <form data-gcal-form style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="input" name="ics" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" required placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" style="flex:1;min-width:220px">
          <button class="btn btn-primary" type="submit">${label}</button>
        </form>`;
    const msg = gcalMsg ? `<p style="font-size:12.5px;margin:10px 0 0" class="${gcalMsg.ok ? 'pos' : 'neg'}">${esc(gcalMsg.text)}</p>` : '';
    return `<div class="card">
      <div class="card-head"><h3>Google Calendar y Calendly</h3>${icon('calendar', 'accent')}</div>
      ${u.gcal_ics ? `
        <p style="margin:0 0 4px;font-size:13px"><span class="pos">Conectado:</span> <strong>${esc(gcalAccount(u.gcal_ics))}</strong></p>
        <p class="muted" style="font-size:12.5px;margin:0 0 12px">${n} cita(s) sincronizadas. Se actualiza solo cada 5 minutos.</p>
        <button class="btn btn-secondary" data-action="gcal-sync" style="margin-right:8px">${icon('refresh')}Sincronizar ahora</button>
        <button class="btn btn-ghost" data-action="gcal-off">Desconectar</button>
        ${msg}
        <p class="muted" style="font-size:12.5px;margin:14px 0 8px">¿Otro calendario? Pega aquí su dirección secreta iCal:</p>
        ${form('Cambiar')}
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Las citas vienen de Google: para cambiarlas o borrarlas, hazlo en Google Calendar o Calendly.</p>` : `
        <p style="margin:0 0 10px;font-size:13px">Tus citas de Calendly (y el resto de Google Calendar) aparecen solas en tu calendario y te avisan 5 minutos antes.</p>
        <ol class="steps" style="font-size:12.5px;margin:0 0 12px">
          <li>En la Mac abre <strong>calendar.google.com</strong> → ⚙️ <strong>Configuración</strong>.</li>
          <li>A la izquierda, en <em>Configuración de mis calendarios</em>, elige el calendario donde Calendly guarda las reuniones.</li>
          <li>Baja hasta <strong>Dirección secreta en formato iCal</strong> y cópiala.</li>
          <li>Pégala aquí:</li>
        </ol>
        ${form('Conectar')}
        ${msg}
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Esa dirección es privada: no la compartas con nadie.</p>`}
    </div>`;
  }

  async function gcalSync() {
    try {
      const session = await DOS.cloud.session();
      const r = await fetch(`${window.DOS_CONFIG.supabaseUrl}/functions/v1/calsync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ now: true }) });
      return await r.json();
    } catch (e) { return { ok: false, error: 'Sin conexión.' }; }
  }

  function siriCard() {
    if (!DOS.cloud || !DOS.cloud.adapter) {
      return `<div class="card"><div class="card-head"><h3>Siri y atajos</h3>${icon('mic', 'accent')}</div>
        <p class="muted" style="font-size:12.5px;margin:0">Disponible cuando usas DANI BOSS con tu cuenta en la nube (dani-boss.vercel.app).</p></div>`;
    }
    return `<div class="card"><div class="card-head"><h3>Siri y atajos</h3>${icon('mic', 'accent')}</div>
      <p style="margin:0 0 6px;font-size:13px">Di <strong>“Oye Siri, Modo Boss”</strong> y luego, por ejemplo: <span class="muted">“gasté 12 en almuerzo”, “le devolví 200 a Juan”, “tarea llamar al contador mañana”.</span></p>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px" data-siri-status>Comprobando…</p>
      <div class="row wrap"><button class="btn btn-primary" data-action="siri-setup">${icon('zap')}Activar Siri</button>
      <button class="btn btn-ghost" data-action="siri-revoke" data-siri-revoke hidden>Desactivar</button></div></div>`;
  }
  function drawSiriStatus(rootEl) {
    const el = rootEl.querySelector('[data-siri-status]');
    if (!el) return;
    const rv = rootEl.querySelector('[data-siri-revoke]');
    if (siri.error) { el.textContent = 'No se pudo comprobar el estado (sin conexión).'; return; }
    if (!siri.keys.length) { el.textContent = 'No activado todavía.'; if (rv) rv.hidden = true; return; }
    const used = siri.keys.map((k) => k.last_used_at).filter(Boolean).sort().pop();
    el.innerHTML = `<span class="pos">Activo</span> · ${siri.keys.length} dispositivo${siri.keys.length === 1 ? '' : 's'}${used ? ` · último uso ${U.relDay(used.slice(0, 10)).toLowerCase()} ${new Date(used).toTimeString().slice(0, 5)}` : ' · aún sin usar'}`;
    if (rv) rv.hidden = false;
  }
  async function loadSiri(rootEl, force = false) {
    if (!DOS.cloud || !DOS.cloud.adapter) return;
    if (!force && siri.loaded && Date.now() - siri.loaded < 30000) { drawSiriStatus(rootEl); return; }
    try {
      const { data, error } = await DOS.cloud.client.from('capture_keys').select('created_at,last_used_at,label').order('created_at');
      if (error) throw error;
      siri.keys = data; siri.error = false;
    } catch (e) { siri.error = true; }
    siri.loaded = Date.now();
    drawSiriStatus(rootEl);
  }
  async function newKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Dispositivo';
    const { error } = await DOS.cloud.client.from('capture_keys').insert({ key_hash: hash, label });
    if (error) throw error;
    return key;
  }

  DOS.views.settings = {
    title: 'Configuración',
    render() {
      const u = store.user();
      const info = storageInfo();
      const demoRows = S.COLLECTIONS.reduce((a, c) => a + store.all(c).filter((r) => r.is_demo).length, 0);
      return `
      <div class="page-head"><div><h1 class="page-title">Configuración</h1><div class="page-sub">Perfil, privacidad y gestión de tus datos.</div></div></div>
      <div class="grid cols-2" style="align-items:start">
        <div class="card">
          <div class="card-head"><h3>Perfil y finanzas</h3></div>
          <form data-settings-form class="form-grid">
            ${ui._field({ name: 'name', label: 'Tu nombre', type: 'text', placeholder: 'Cómo quieres que te salude' }, u)}
            ${ui._field({ name: 'currency', label: 'Moneda', type: 'select', options: S.currencies, required: true, half: true }, u)}
            ${ui._field({ name: 'opening_balance', label: 'Saldo inicial', type: 'money', half: true, hint: 'Capital con el que empiezas a usar DANI OS.' }, u)}
            <div class="field"><button class="btn btn-primary" type="submit" style="align-self:flex-start">${icon('check')}Guardar</button></div>
          </form>
        </div>
        <div class="stack">
          ${syncCard()}
          ${gcalCard()}
          ${siriCard()}
          <div class="card">
            <div class="card-head"><h3>Bloqueo con ${DOS.lock.bioName()}</h3>${icon('shield', 'accent')}</div>
            <p style="margin:0 0 6px;font-size:13px">Pide ${DOS.lock.bioName()} cada vez que abres DANI BOSS en este dispositivo, y otra vez si sales más de 1 minuto.</p>
            <p class="muted" style="font-size:12.5px;margin:0 0 12px" data-lock-status>${DOS.lock.enabled() ? '<span class="pos">Activado en este dispositivo</span>' : 'Desactivado en este dispositivo.'}</p>
            ${DOS.lock.enabled() ? `<button class="btn btn-secondary" data-action="lock-off">Desactivar bloqueo</button>` : `<button class="btn btn-primary" data-action="lock-on">${icon('shield')}Activar ${DOS.lock.bioName()}</button>`}
            <p class="muted" style="font-size:12.5px;margin:10px 0 0">Actívalo por separado en el iPhone y en la Mac. Si ${DOS.lock.bioName()} falla, puedes entrar con la contraseña de tu cuenta.</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>Notificaciones</h3>${icon('bell', 'accent')}</div>
            <p style="margin:0 0 6px;font-size:13px">Recibe un aviso <strong>5 minutos antes</strong> de cada tarea o evento que tenga hora, aunque la app esté cerrada. Actívalo en cada dispositivo (iPhone y Mac).</p>
            <p class="muted" style="font-size:12.5px;margin:0 0 12px" data-notif-status>${'Notification' in window ? (Notification.permission === 'granted' ? '<span class="pos">Activadas</span>' : Notification.permission === 'denied' ? '<span class="neg">Bloqueadas</span> — actívalas en Ajustes del navegador/iPhone.' : 'No activadas todavía.') : 'Tu navegador no soporta notificaciones.'}</p>
            ${'Notification' in window && Notification.permission !== 'granted' ? `<button class="btn btn-primary" data-action="enable-notifs">${icon('bell')}Activar notificaciones</button>` : ''}
            ${'Notification' in window && Notification.permission === 'granted' ? `<button class="btn btn-secondary" data-action="enable-notifs" style="margin-right:8px">${icon('bell')}Registrar este dispositivo</button><button class="btn btn-secondary" data-action="test-notif">${icon('zap')}Enviar notificación de prueba</button>` : ''}
            <p style="font-size:12.5px;margin:12px 0 0" data-push-diag class="muted">Comprobando este dispositivo…</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>Privacidad</h3>${icon('shield', 'accent')}</div>
            <label class="toggle"><input type="checkbox" data-change="privacy" ${u.privacy ? 'checked' : ''}><span class="track"></span><span>Ocultar cantidades (modo privacy)</span></label>
            <p class="muted" style="font-size:12.5px;margin:10px 0 0">Sustituye todas las cifras por ••••. Atajo: tecla <kbd>P</kbd> o el icono del ojo arriba.</p>
            <p class="muted" style="font-size:12.5px;margin:8px 0 0">Tus datos se guardan solo en este navegador. DANI OS no envía información a servicios externos.</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>Datos</h3>${icon('database', 'accent')}</div>
            <div class="muted" style="font-size:12.5px;margin-bottom:14px">${info.rows} registros · ${info.kb} KB en almacenamiento local</div>
            <div class="row wrap">
              <button class="btn btn-secondary" data-action="export">${icon('download')}Exportar copia</button>
              <label class="btn btn-secondary" style="cursor:pointer">${icon('upload')}Importar copia<input type="file" accept="application/json,.json" data-change="import" hidden></label>
            </div>
            <div class="group-label" style="padding-top:20px"><span>Datos de demostración</span></div>
            ${demoRows ? `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Hay ${demoRows} registros DEMO. Eliminarlos no afecta a lo que tú hayas creado.</p>
              <button class="btn btn-danger" data-action="clear-demo">${icon('trash')}Eliminar datos DEMO</button>`
              : `<p class="muted" style="font-size:12.5px;margin:0 0 10px">No hay datos DEMO cargados.</p><button class="btn btn-secondary" data-action="load-demo">${icon('refresh')}Cargar datos DEMO</button>`}
            <div class="group-label" style="padding-top:20px"><span>Zona peligrosa</span></div>
            <button class="btn btn-danger-ghost" data-action="reset-all">${icon('trash')}Borrar todos los datos</button>
          </div>
        </div>
      </div>
      <div class="card mt-16">
        <div class="card-head"><h3>Atajos de teclado</h3></div>
        <div class="row wrap" style="gap:22px;font-size:13px" >
          <span><kbd>⌘</kbd> <kbd>K</kbd> Buscar</span><span><kbd>N</kbd> Crear</span><span><kbd>C</kbd> Calculadora</span><span><kbd>V</kbd> Dictar</span><span><kbd>P</kbd> Privacidad</span><span><kbd>Esc</kbd> Cerrar</span>
          <span><kbd>G</kbd> luego <kbd>D</kbd> Dashboard · <kbd>H</kbd> Mi Día · <kbd>G</kbd> Gastos · <kbd>T</kbd> Tareas</span>
        </div>
      </div>
      <p class="faint" style="font-size:12px;margin-top:18px">DANI OS v1.0 · Prototipo local. Arquitectura preparada para Supabase / PostgreSQL (ver ARQUITECTURA.md).</p>`;
    },
    mount(rootEl) {
      loadSiri(rootEl);
      const diag = rootEl.querySelector('[data-push-diag]');
      if (diag && DOS.pushStatus) DOS.pushStatus().then((r) => { diag.innerHTML = `<span class="${r.ok ? 'pos' : 'neg'}">${r.ok ? '✓' : '✗'}</span> ${U.esc(r.text)}`; }).catch((e) => { diag.textContent = 'Error: ' + e.message; });
      const gf = rootEl.querySelector('[data-gcal-form]');
      if (gf) gf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const raw = gf.ics.value.trim();
        const url = raw.replace(/^webcal:\/\//i, 'https://').replace(/^http:\/\//i, 'https://');
        if (!/^https:\/\/\S+$/i.test(url)) { gcalMsg = { ok: false, text: 'Eso no parece una dirección. Copia la "Dirección secreta en formato iCal" completa.' }; DOS.app.render(); return; }
        if (/\/public\/basic\.ics/.test(url)) { gcalMsg = { ok: false, text: 'Esa es la dirección PÚBLICA. Usa la "Dirección secreta en formato iCal" (contiene "private-").' }; DOS.app.render(); return; }
        const btn = gf.querySelector('button'); btn.disabled = true; btn.textContent = 'Conectando…';
        const prev = store.user().gcal_ics || null;
        store.updateUser({ gcal_ics: url });
        try { await DOS.cloud.adapter.flush(); } catch (err) { /* reintenta solo */ }
        await new Promise((r) => setTimeout(r, 1200));
        const r = await gcalSync();
        if (r.ok) gcalMsg = { ok: true, text: r.events ? `✓ Conectado: ${r.events} cita(s) encontradas.` : '✓ Conectado, pero ese calendario no tiene citas en los próximos 60 días. ¿Es el calendario donde Calendly guarda las reuniones?' };
        else { gcalMsg = { ok: false, text: r.error || 'No se pudo leer el calendario.' }; store.updateUser({ gcal_ics: prev }); }
        DOS.app.render();
      });
      const f = rootEl.querySelector('[data-settings-form]');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const ob = f.elements.opening_balance.value;
        store.updateUser({ name: f.elements.name.value.trim(), currency: f.elements.currency.value, opening_balance: ob === '' ? 0 : U.round2(parseFloat(ob)) });
        ui.toast('Configuración guardada');
      });
    },
    actions: {
      'enable-notifs': async () => {
        await DOS.requestNotifications();
        DOS.app.render();
        return false;
      },
      'lock-on': async () => {
        if (!(await DOS.lock.available())) { ui.toast(`Este dispositivo no tiene ${DOS.lock.bioName()} disponible para webs.`, 'error'); return false; }
        try { await DOS.lock.enable(); ui.toast(`Bloqueo con ${DOS.lock.bioName()} activado`, 'success'); }
        catch (e) { ui.toast(e.name === 'NotAllowedError' ? 'Cancelado.' : `No se pudo activar: ${e.message}`, 'error'); }
        DOS.app.render();
        return false;
      },
      'lock-off': async () => {
        try { await DOS.lock.disable(); ui.toast('Bloqueo desactivado'); }
        catch (e) { ui.toast('Necesitas verificar tu identidad para desactivarlo.', 'error'); }
        DOS.app.render();
        return false;
      },
      'gcal-sync': async () => {
        ui.toast('Sincronizando…', 'info');
        const r = await gcalSync();
        gcalMsg = r.ok ? { ok: true, text: `✓ ${r.events} cita(s) en Google · ${r.added} nueva(s), ${r.updated} cambiada(s), ${r.removed} quitada(s)` } : { ok: false, text: r.error || 'No se pudo sincronizar.' };
        DOS.app.render();
        return false;
      },
      'gcal-off': async () => {
        store.updateUser({ gcal_ics: null });
        store.all('events').filter((e) => String(e.id).startsWith('gcal_')).forEach((e) => store.remove('events', e.id));
        gcalMsg = null;
        ui.toast('Google Calendar desconectado');
        DOS.app.render();
        return false;
      },
      'test-notif': async () => {
        await DOS.testNotification();
        DOS.app.render();
        return false;
      },
      'siri-setup': async () => {
        let key;
        try { key = await newKey(); } catch (e) { ui.toast('No se pudo crear la clave. Revisa tu conexión.', 'error'); return false; }
        siri.loaded = 0;
        const isPhone = /iPhone|iPad/.test(navigator.userAgent);
        const m = ui.modal({
          title: 'Activar Siri', size: 'sm',
          subtitle: isPhone ? 'Tres pasos, una sola vez.' : 'Hazlo desde tu iPhone para que Siri funcione allí (también sirve en la Mac).',
          body: `<ol class="steps">
            <li><strong>Copia tu clave personal.</strong> Solo se muestra ahora.
              <div class="row mt-8"><input class="input" value="${esc(key)}" readonly data-key style="font-family:ui-monospace,monospace;font-size:13px"><button class="btn btn-secondary" data-copy>${icon('copy')}Copiar</button></div></li>
            <li><strong>Instala el atajo</strong> y, cuando lo pida, <strong>pega la clave</strong>.
              <div class="mt-8"><a class="btn btn-primary" href="${SHORTCUT_URL}" target="_blank" rel="noopener">${icon('download')}Instalar atajo “Sistema Boss”</a></div></li>
            <li><strong>Listo.</strong> Di <em>“Oye Siri, Modo Boss”</em> y dicta lo que quieras registrar.</li>
          </ol>
          <p class="faint" style="font-size:12px;margin:14px 0 0">Truco: en iPhone puedes asignarlo al <strong>Botón de Acción</strong> o a <strong>Tocar atrás</strong> (Ajustes → Accesibilidad → Tocar → Tocar atrás) para registrar con un toque.</p>
          <div class="modal-actions"><span class="spacer"></span><button class="btn btn-ghost" data-close>Hecho</button></div>`,
          onClose: () => { const c = document.querySelector('#content'); if (c) loadSiri(c, true); },
        });
        m.el.querySelector('[data-copy]').addEventListener('click', async () => {
          const input = m.el.querySelector('[data-key]');
          try { await navigator.clipboard.writeText(key); } catch (e) { input.select(); document.execCommand('copy'); }
          ui.toast('Clave copiada');
        });
        return false;
      },
      'siri-revoke': async () => {
        if (!(await ui.confirm({ title: 'Desactivar Siri', message: 'Las claves dejarán de funcionar en todos tus atajos. Podrás activarlo de nuevo cuando quieras.', confirmLabel: 'Desactivar', danger: true }))) return false;
        const { error } = await DOS.cloud.client.from('capture_keys').delete().eq('user_id', DOS.cloud.user.id);
        if (error) ui.toast('No se pudo desactivar. Revisa tu conexión.', 'error');
        else { ui.toast('Siri desactivado'); siri.keys = []; siri.loaded = 0; loadSiri(document.querySelector('#content'), true); }
        return false;
      },
      'sync-now': async () => {
        const a = DOS.cloud.adapter;
        await a.flush(); await a.refresh();
        ui.toast(a.status === 'synced' ? 'Todo sincronizado' : 'No se pudo sincronizar ahora; se reintentará', a.status === 'synced' ? 'success' : 'error');
      },
      'sign-out': async () => {
        const n = DOS.cloud.adapter.pendingCount();
        if (!(await ui.confirm({ title: 'Cerrar sesión', message: n ? `Hay ${n} cambios sin subir todavía. Si cierras sesión ahora se subirán la próxima vez que entres en este dispositivo.` : 'Tus datos quedan guardados en la nube.', confirmLabel: 'Cerrar sesión' }))) return false;
        DOS.cloud.signOut();
        return false;
      },
      export: () => {
        const blob = new Blob([store.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dani-os-backup-${U.today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        ui.toast('Copia de seguridad descargada');
        return false;
      },
      'clear-demo': async () => {
        if (!(await ui.confirm({ title: 'Eliminar datos DEMO', message: 'Se borrarán todos los registros marcados como DEMO. Tus datos reales se mantienen.', confirmLabel: 'Eliminar DEMO', danger: true }))) return false;
        const n = store.clearDemo();
        ui.toast(`${n} registros DEMO eliminados`);
        return false;
      },
      'load-demo': () => { DOS.demo.seed(store); store.emit('*', 'demo'); ui.toast('Datos DEMO cargados'); return false; },
      'reset-all': async () => {
        if (!(await ui.confirm({ title: 'Borrar todos los datos', message: 'Se eliminará <strong>todo</strong>: finanzas, deudas, tareas, hábitos y entrenamientos. Exporta una copia antes si la necesitas.', confirmLabel: 'Borrar todo', danger: true }))) return false;
        store.resetAll();
        ui.toast('Todos los datos fueron eliminados', 'info');
        return false;
      },
    },
    changes: {
      privacy: (el) => { store.updateUser({ privacy: el.checked }); return false; },
      import: (el) => {
        const file = el.files[0];
        if (!file) return false;
        file.text().then(async (text) => {
          if (!(await ui.confirm({ title: 'Importar copia', message: 'Reemplazará todos los datos actuales por los del archivo.', confirmLabel: 'Importar' }))) return;
          try { store.importJSON(text); ui.toast('Copia importada correctamente'); } catch (err) { ui.toast(err.message || 'Archivo no válido', 'error'); }
        });
        return false;
      },
    },
  };
})(window);
