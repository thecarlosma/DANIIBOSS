/* DANI OS — shell de la aplicación: router, navegación, búsqueda global, notificaciones, atajos. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance;
  const store = DOS.store, ui = DOS.ui, forms = DOS.forms, icon = DOS.icon, esc = U.esc;

  /* ---------- Navegación ---------- */
  const NAV = [
    { items: [
      { route: 'dashboard', label: 'Dashboard', icon: 'home' },
      { route: 'calculadora', label: 'Calculadora', icon: 'calculator' },
      { route: 'dia', label: 'Mi Día', icon: 'sun' },
    ] },
    { label: 'Finanzas', items: [
      { route: 'capital', label: 'Capital', icon: 'layers' },
      { route: 'ingresos', label: 'Ingresos', icon: 'income' },
      { route: 'gastos', label: 'Gastos', icon: 'expense' },
      { route: 'suscripciones', label: 'Suscripciones', icon: 'card', count: () => F.subscriptionsOverview(store.data).attention.length || '' },
      { route: 'deudas', label: 'Deudas', icon: 'receipt', count: () => F.debtsOverview(store.data).pendingPeople || '' },
    ] },
    { label: 'Productividad', items: [
      { route: 'calendario', label: 'Calendario', icon: 'calendar' },
      { route: 'tareas', label: 'Tareas', icon: 'checkSquare', count: () => DOS.life.taskBuckets(store.data.tasks).today.filter((t) => t.status !== 'completada').length || '' },
      { route: 'habitos', label: 'Hábitos', icon: 'repeat' },
      { route: 'objetivos', label: 'Objetivos', icon: 'target' },
    ] },
    { label: 'Fitness', items: [
      { route: 'entrenamientos', label: 'Entrenamientos', icon: 'dumbbell' },
      { route: 'rutinas', label: 'Rutinas', icon: 'list' },
      { route: 'progreso', label: 'Progreso', icon: 'trendUp' },
    ] },
    { label: 'Sistema', items: [
      { route: 'insights', label: 'Insights', icon: 'sparkles' },
      { route: 'ajustes', label: 'Configuración', icon: 'settings' },
    ] },
  ];
  const ROUTES = {
    dashboard: 'dashboard', dia: 'day', calendario: 'calendar', ingresos: 'income', gastos: 'expenses', capital: 'capital',
    deudas: 'debts', tareas: 'tasks', habitos: 'habits', objetivos: 'goals', entrenamientos: 'workouts', rutinas: 'routines',
    progreso: 'progress', insights: 'insights', ajustes: 'settings', suscripciones: 'subscriptions', calculadora: 'calculator',
  };
  const ALL_NAV = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

  /* ---------- Formularios por colección (editar genérico) ---------- */
  const EDITORS = {
    expenses: (r) => forms.expense(r), income: (r) => forms.income(r), transactions: (r) => forms.transaction(r),
    debts: (r) => forms.debt(r), events: (r) => forms.event(r), tasks: (r) => forms.task(r), day_blocks: (r) => forms.block(r),
    habits: (r) => forms.habit(r), routines: (r) => forms.routine(r), exercises: (r) => forms.exercise(r),
    workouts: (r) => forms.workoutLog({ existing: r }), goals: (r) => forms.goal(r), subscriptions: (r) => forms.subscription(r),
  };
  const LABELS = { subscriptions: 'Suscripción', tasks: 'Tarea', habits: 'Hábito', routines: 'Rutina', expenses: 'Gasto', income: 'Ingreso' };

  const QUICK_ADD = [
    { label: 'Dictar o escribir', desc: '“gasté 12 en almuerzo”, “tarea…”, “le devolví…”', icon: 'mic', cls: 'accent', key: 'V', fn: () => forms.capture() },
    { label: 'Gasto', desc: 'Registrar en qué gastaste', icon: 'expense', cls: 'neg', key: 'G', fn: () => forms.expense() },
    { label: 'Ingreso', desc: 'Dinero que entra', icon: 'income', cls: 'pos', key: 'I', fn: () => forms.income() },
    { label: 'Pago de deuda', desc: 'Devolver capital a alguien', icon: 'receipt', cls: 'warn', key: 'D', fn: () => pickDebtForPayment() },
    { label: 'Suscripción', desc: 'Claude, ChatGPT, gimnasio…', icon: 'card', cls: '', key: 'S', fn: () => forms.subscription() },
    { label: 'Tarea', desc: 'Algo por hacer', icon: 'checkSquare', cls: 'accent', key: 'T', fn: () => forms.task() },
    { label: 'Evento', desc: 'Reunión, pago, recordatorio…', icon: 'calendar', cls: 'accent', key: 'E', fn: () => forms.event() },
    { label: 'Bloque en Mi Día', desc: 'Planificar una hora', icon: 'sun', cls: '', key: 'B', fn: () => forms.block() },
    { label: 'Movimiento de capital', desc: 'Inversión, retorno, préstamo…', icon: 'layers', cls: '', key: 'C', fn: () => forms.transaction() },
    { label: 'Entrenamiento', desc: 'Registrar una sesión', icon: 'dumbbell', cls: 'pos', key: 'W', fn: () => { const r = DOS.life.routineFor(store.data, U.today()); forms.workoutLog({ routineId: r && !DOS.life.workoutOn(store.data, U.today()) ? r.id : null }); } },
  ];

  function pickDebtForPayment() {
    const open = F.debtsOverview(store.data).stats.filter((s) => s.status !== 'saldado');
    if (!open.length) { ui.toast('No tienes deudas pendientes', 'info'); return; }
    if (open.length === 1) { forms.debtPayment(open[0].debt.id); return; }
    const m = ui.modal({
      title: '¿A quién vas a pagar?', size: 'sm',
      body: `<div class="list">${open.map((s) => `<button class="menu-item" data-pick="${s.debt.id}">${ui.avatar(s.debt.name)}<div style="flex:1"><div class="t">${esc(s.debt.name)}</div><div class="d">Pendiente ${ui.money(s.pending)}</div></div>${icon('chevR')}</button>`).join('')}</div>`,
    });
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { m.close(); forms.debtPayment(b.dataset.pick); } });
  }

  /* ---------- Acciones globales ---------- */
  const globalActions = Object.assign(DOS.globalActions || {}, {
    go: (el) => { location.hash = el.dataset.href; return false; },
    edit: (el) => { const r = store.get(el.dataset.c, el.dataset.id); if (r && EDITORS[el.dataset.c]) EDITORS[el.dataset.c](r); return false; },
    del: async (el) => {
      const c = el.dataset.c, id = el.dataset.id;
      const ok = await ui.confirm({ title: `Eliminar ${(LABELS[c] || 'registro').toLowerCase()}`, message: 'Podrás deshacerlo desde la notificación.', confirmLabel: 'Eliminar', danger: true });
      if (ok) forms.remove(c, id, `${LABELS[c] || 'Registro'} eliminado`);
      return false;
    },
    'add-expense': () => { forms.expense(); return false; },
    'add-income': () => { forms.income(); return false; },
    'add-transaction': () => { forms.transaction(); return false; },
    'add-debt': () => { forms.debt(); return false; },
    'pay-debt': (el) => { forms.debtPayment(el.dataset.id); return false; },
    'debt-detail': (el) => { forms.debtDetail(el.dataset.id); return false; },
    'add-sub': () => { forms.subscription(); return false; },
    'pay-sub': (el) => { forms.subscriptionPay(el.dataset.id); return false; },
    'add-task': () => { forms.task(); return false; },
    'add-event': () => { forms.event(); return false; },
    'add-habit': () => { forms.habit(); return false; },
    'add-goal': () => { forms.goal(); return false; },
    'add-routine': () => { forms.routine(); return false; },
    capture: () => { forms.capture(); return false; },
  });

  /* ---------- Router ---------- */
  const state = { route: null, view: null, params: {} };
  const main = () => document.getElementById('content');

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => (params[k] = v));
    return { route: ROUTES[path] ? path : 'dashboard', params };
  }

  function render({ transition = false } = {}) {
    const { route, params } = parseHash();
    const routeChanged = route !== state.route;
    const viewKey = ROUTES[route];
    const view = DOS.views[viewKey];
    state.route = route; state.view = view; state.params = params;

    const el = main();
    const scroll = window.scrollY;
    ui.resetCharts();
    try {
      el.innerHTML = view.render(params);
    } catch (err) {
      console.error(err);
      el.innerHTML = `<div class="card">${ui.empty({ iconName: 'alert', title: 'Algo salió mal al mostrar esta sección', text: err.message })}</div>`;
    }
    if (routeChanged || transition) {
      el.classList.remove('view-enter'); void el.offsetWidth; el.classList.add('view-enter');
      window.scrollTo(0, 0);
    } else window.scrollTo(0, scroll);
    ui.drawCharts(el);
    if (view.mount) view.mount(el, params);
    // Los parámetros de entrada (ej. ?d=fecha) solo se aplican una vez
    if (Object.keys(params).length && routeChanged) history.replaceState(null, '', `#/${route}`);
    // Enlace directo de captura (lo usa el atajo de Siri): #/dashboard?capturar=gasté 12 en almuerzo
    if (params.capturar !== undefined && routeChanged) setTimeout(() => forms.capture(params.capturar), 50);

    const item = ALL_NAV.find((i) => i.route === route);
    document.title = `${item ? item.label : 'Dashboard'} · DANI BOSS`;
    document.getElementById('topbar-title').innerHTML = `${item && item.group && item.group !== 'Sistema' ? `<span class="crumb">${esc(item.group)} /</span>` : ''}<span>${esc(item ? item.label : 'Dashboard')}</span>`;
    renderNav();
    renderChrome();
  }
  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map((g) => `${g.label ? `<div class="nav-group-label">${g.label}</div>` : ''}${g.items.map((i) => {
      const count = i.count ? i.count() : '';
      return `<a class="nav-item ${state.route === i.route ? 'active' : ''}" href="#/${i.route}" ${state.route === i.route ? 'aria-current="page"' : ''}>${icon(i.icon)}<span>${i.label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</a>`;
    }).join('')}`).join('');
    const mobile = document.getElementById('mobile-nav');
    const fin = ['ingresos', 'gastos', 'capital', 'deudas', 'suscripciones'].includes(state.route);
    mobile.innerHTML = `
      <a href="#/dashboard" class="${state.route === 'dashboard' ? 'active' : ''}">${icon('home')}Inicio</a>
      <a href="#/dia" class="${state.route === 'dia' ? 'active' : ''}">${icon('sun')}Mi Día</a>
      <button class="fab" data-action="quick-add" aria-label="Crear">${icon('plus')}</button>
      <a href="#/gastos" class="${fin ? 'active' : ''}">${icon('wallet')}Finanzas</a>
      <button data-action="drawer" aria-label="Menú">${icon('menu')}Menú</button>`;
  }

  function renderChrome() {
    const u = store.user();
    const priv = document.getElementById('privacy-btn');
    priv.classList.toggle('on', !!u.privacy);
    priv.innerHTML = icon(u.privacy ? 'eyeOff' : 'eye');
    priv.title = u.privacy ? 'Mostrar cantidades (P)' : 'Ocultar cantidades (P)';
    const notes = notifications();
    const unseen = notes.filter((n) => !(u.seen_notifications || []).includes(n.id)).length;
    document.getElementById('bell-badge').innerHTML = unseen ? `<span class="badge-dot">${unseen}</span>` : '';
    document.getElementById('demo-chip').hidden = !store.hasDemo();
  }

  const notifications = () => DOS.intelligence.notifications(store.data, (n) => ui.money(n));

  /* ---------- Popovers ---------- */
  let popover = null;
  function closePopover() { if (popover) { popover.remove(); popover = null; return true; } return false; }
  function openPopover(anchor, html) {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'popover';
    popover.innerHTML = html;
    document.body.appendChild(popover);
    const r = anchor.getBoundingClientRect();
    const w = popover.offsetWidth;
    if (window.innerWidth <= 860) { popover.style.bottom = '84px'; popover.style.top = 'auto'; }
    else { popover.style.top = `${r.bottom + 8}px`; popover.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w))}px`; }
    return popover;
  }

  function openNotifications(anchor) {
    const notes = notifications();
    const TONE = { positive: 'pos', negative: 'neg', warning: 'warn', neutral: 'accent' };
    const p = openPopover(anchor, `<div class="popover-head"><strong>Recordatorios</strong><span class="muted" style="font-size:12px">${notes.length}</span></div>
      <div class="popover-body">${notes.length ? notes.map((n) => `<a class="notif" href="${n.route}"><div class="icon-tile ${TONE[n.tone]}">${icon(n.icon)}</div><div><div class="t">${esc(n.title)}</div><div class="d">${esc(n.detail)}</div></div></a>`).join('')
        : `<div class="empty"><div class="icon-tile">${icon('bell')}</div><strong>Todo al día</strong><p>No tienes recordatorios pendientes.</p></div>`}</div>`);
    p.addEventListener('click', (e) => { if (e.target.closest('a')) closePopover(); });
    const seen = [...new Set([...(store.user().seen_notifications || []), ...notes.map((n) => n.id)])].slice(-200);
    store.data.users[0].seen_notifications = seen;
    store.persist('users');
    renderChrome();
  }

  function openQuickAdd(anchor) {
    const p = openPopover(anchor, `<div class="popover-head"><strong>Crear</strong><span class="muted" style="font-size:12px">Atajo <kbd>N</kbd></span></div>
      <div class="popover-body">${QUICK_ADD.map((q, i) => `<button class="menu-item" data-q="${i}"><div class="icon-tile ${q.cls}">${icon(q.icon)}</div><div style="flex:1"><div class="t">${q.label}</div><div class="d">${q.desc}</div></div><kbd>${q.key}</kbd></button>`).join('')}</div>`);
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) { closePopover(); QUICK_ADD[+b.dataset.q].fn(); } });
    p.dataset.kind = 'quick';
  }

  /* ---------- Búsqueda global ---------- */
  function searchIndex() {
    const d = store.data;
    const T = U.today();
    const items = [];
    const add = (group, ic, title, sub, hay, open) => items.push({ group, icon: ic, title, sub, hay: U.norm(`${title} ${sub} ${hay || ''} ${group}`), open });
    ALL_NAV.forEach((n) => add('Secciones', n.icon, n.label, n.group || 'Ir a', '', () => (location.hash = `#/${n.route}`)));
    (d.subscriptions || []).forEach((x) => add('Suscripciones', 'card', x.name, `${ui.money(x.amount)} · ${F.subCycle(x).label.toLowerCase()} · próximo ${x.next_date ? U.fmtDate(x.next_date) : '—'}`, `${x.category || ''} ${x.notes || ''} ${x.amount}`, () => forms.subscription(x)));
    d.debts.forEach((x) => { const s = F.debtStats(x, d.debt_payments); add('Personas y deudas', 'user', x.name, `${S.debtStatuses[s.status].label} · pendiente ${ui.money(s.pending)}`, `${x.notes || ''} ${s.pending} ${x.original_amount}`, () => forms.debtDetail(x.id)); });
    d.expenses.forEach((x) => add('Gastos', 'expense', x.concept, `${U.fmtDate(x.date)} · ${x.category} · ${ui.money(x.amount)}`, `${x.note || ''} ${x.method} ${x.amount}`, () => forms.expense(x)));
    d.income.forEach((x) => add('Ingresos', 'income', x.concept, `${U.fmtDate(x.date)} · ${x.source || x.category} · ${ui.money(x.amount)}`, `${x.category} ${x.notes || ''} ${x.amount}`, () => forms.income(x)));
    d.transactions.forEach((x) => add('Capital', 'layers', x.concept, `${U.fmtDate(x.date)} · ${x.type} · ${ui.money(x.amount)}`, `${x.counterpart || ''} ${x.amount}`, () => forms.transaction(x)));
    d.tasks.forEach((x) => add('Tareas', 'checkSquare', x.title, `${x.date ? U.relDay(x.date, T) : 'Sin fecha'} · ${S.labelOf(S.taskStatuses, x.status)}`, `${x.description || ''} ${x.category}`, () => forms.task(x)));
    d.events.forEach((x) => add('Eventos', 'calendar', x.title, `${U.relDay(x.date, T)} · ${x.time} · ${x.category}`, x.notes, () => forms.event(x)));
    d.workouts.forEach((x) => add('Entrenamientos', 'dumbbell', x.title, `${U.relDay(x.date, T)} · ${(x.exercises || []).length} ejercicios`, (x.exercises || []).map((e) => e.name).join(' '), () => forms.workoutLog({ existing: x })));
    d.routines.forEach((x) => add('Entrenamientos', 'list', `Rutina: ${x.name}`, S.weekdays.find((w) => w.value === +x.weekday)?.label || '', '', () => (location.hash = '#/rutinas')));
    d.goals.forEach((x) => add('Objetivos', 'target', x.name, `${x.category} · ${U.fmtPct(F.goalProgress(x, d).progress)}`, x.description, () => forms.goal(x)));
    d.habits.forEach((x) => add('Hábitos', 'repeat', x.name, 'Hábito', '', () => (location.hash = '#/habitos')));
    return items;
  }

  function openPalette() {
    if (document.querySelector('.palette')) return;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="palette" role="dialog" aria-label="Búsqueda global">
      <div class="palette-input">${icon('search')}<input placeholder="Buscar gastos, personas, tareas, eventos…" aria-label="Buscar" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="palette-results"></div>
      <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span>Busca también por importe</span></div></div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    const results = overlay.querySelector('.palette-results');
    const index = searchIndex();
    let current = [], sel = 0;
    const api = { close: () => { overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 150); ui._modals = ui._modals.filter((m) => m !== api); } };
    ui._modals.push(api);

    const highlight = (text, q) => {
      const t = esc(text);
      if (!q) return t;
      const i = U.norm(text).indexOf(U.norm(q.split(/\s+/)[0]));
      if (i < 0) return t;
      const len = q.split(/\s+/)[0].length;
      return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + len))}</mark>${esc(text.slice(i + len))}`;
    };
    const draw = () => {
      const q = input.value.trim();
      const tokens = U.norm(q).split(/\s+/).filter(Boolean);
      let found = tokens.length ? index.filter((it) => tokens.every((t) => it.hay.includes(t))) : index.filter((it) => it.group === 'Secciones');
      const groups = U.groupBy(found, (x) => x.group);
      current = [];
      let html = '';
      groups.forEach((list, g) => {
        const top = list.slice(0, tokens.length ? 6 : 20);
        html += `<div class="palette-group">${esc(g)}${list.length > top.length ? ` · ${list.length}` : ''}</div>`;
        top.forEach((it) => { html += `<button class="menu-item ${current.length === sel ? 'sel' : ''}" data-i="${current.length}"><div class="icon-tile">${icon(it.icon)}</div><div style="flex:1;min-width:0"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(it.title, q)}</div><div class="d">${esc(it.sub)}</div></div></button>`; current.push(it); });
      });
      results.innerHTML = html || `<div class="empty"><strong>Sin resultados</strong><p>Prueba con otra palabra o un importe.</p></div>`;
    };
    const choose = (i) => { const it = current[i]; if (!it) return; api.close(); setTimeout(() => it.open(), 10); };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(current.length - 1, sel + 1); draw(); results.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); results.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    });
    results.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) choose(+b.dataset.i); });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) api.close(); });
    draw();
    input.focus();
  }

  /* ---------- Eventos globales ---------- */
  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  async function runHandler(handler, el, e) {
    const result = await handler(el, e);
    if (result !== false) scheduleRender();
  }

  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      if (popover && !e.target.closest('.popover') && !e.target.closest('[data-action="quick-add"],[data-action="bell"]')) closePopover();
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      if (el.closest('.overlay') && !el.closest('.modal')) return;
      const name = el.dataset.action;
      if (name === 'quick-add') { e.preventDefault(); if (popover && popover.dataset.kind === 'quick') closePopover(); else openQuickAdd(el); return; }
      if (name === 'bell') { e.preventDefault(); if (popover && !popover.dataset.kind) closePopover(); else openNotifications(el); return; }
      if (name === 'search') { e.preventDefault(); openPalette(); return; }
      if (name === 'privacy') { togglePrivacy(); return; }
      if (name === 'drawer') { toggleDrawer(); return; }
      const handler = (state.view && state.view.actions && state.view.actions[name]) || globalActions[name];
      if (!handler) return;
      if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
      e.stopPropagation();
      runHandler(handler, el, e);
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const handler = state.view && state.view.changes && state.view.changes[el.dataset.change];
      if (handler) runHandler(handler, el, e);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (closePopover()) return;
        if (ui.closeTopModal()) return;
        if (document.querySelector('.app.drawer-open')) return toggleDrawer(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || ui._modals.length) return;
      // Menú rápido abierto → letra elige opción
      if (popover && popover.dataset.kind === 'quick') {
        const q = QUICK_ADD.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (q) { e.preventDefault(); closePopover(); q.fn(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (gPending) {
        gPending = false;
        const map = { d: 'dashboard', h: 'dia', c: 'calendario', i: 'ingresos', g: 'gastos', k: 'capital', u: 'deudas', t: 'tareas', a: 'habitos', o: 'objetivos', e: 'entrenamientos', s: 'ajustes' };
        if (map[k]) { location.hash = `#/${map[k]}`; e.preventDefault(); }
        return;
      }
      if (k === '/') { e.preventDefault(); openPalette(); }
      else if (k === 'p') togglePrivacy();
      else if (k === 'c') { e.preventDefault(); location.hash = '#/calculadora'; }
      else if (k === 'v') { e.preventDefault(); forms.capture(); }
      else if (k === 'n') { e.preventDefault(); openQuickAdd(document.getElementById('quick-btn').offsetParent ? document.getElementById('quick-btn') : document.querySelector('.mobile-nav .fab')); }
      else if (k === 'g') { gPending = true; setTimeout(() => (gPending = false), 1200); }
    });
    window.addEventListener('hashchange', () => { toggleDrawer(false); closePopover(); render(); });
    window.addEventListener('resize', U.debounce(() => ui.drawCharts(main()), 150));
    document.getElementById('drawer-backdrop').addEventListener('click', () => toggleDrawer(false));
  }
  let gPending = false;

  function togglePrivacy() {
    const on = !store.user().privacy;
    store.updateUser({ privacy: on });
    ui.toast(on ? 'Modo privacidad activado' : 'Cantidades visibles', 'info');
  }
  function toggleDrawer(force) {
    const app = document.querySelector('.app');
    app.classList.toggle('drawer-open', force === undefined ? !app.classList.contains('drawer-open') : force);
  }

  /* ---------- Arranque ---------- */
  /* ---------- Estado de sincronización (pie del menú) ---------- */
  const SYNC_LABELS = {
    synced: ['Sincronizado', 'ok'], syncing: ['Sincronizando…', 'busy'], offline: ['Sin conexión · guardado en el dispositivo', 'warn'],
    error: ['Error al sincronizar · reintentando', 'err'], idle: ['Conectando…', 'busy'],
  };
  function renderSyncStatus() {
    const el = document.querySelector('.sidebar-footer');
    if (!el) return;
    const a = DOS.cloud.adapter;
    if (!a) { el.innerHTML = '<span class="dot-live"></span>Datos guardados en este dispositivo'; return; }
    const [label, cls] = SYNC_LABELS[a.status] || SYNC_LABELS.idle;
    const n = a.pendingCount();
    el.innerHTML = `<span class="dot-live ${cls}"></span><span>${label}${n && a.status !== 'syncing' ? ` · ${n} pendiente${n === 1 ? '' : 's'}` : ''}</span>`;
    el.title = DOS.cloud.user ? DOS.cloud.user.email : '';
  }

  /* ---------- Arranque ---------- */
  async function connectCloud() {
    DOS.cloud.init();
    let session = await DOS.cloud.session();
    if (!session) session = await DOS.cloud.loginScreen();
    DOS.cloud.user = session.user;
    DOS.cloud.client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') location.reload(); });
    const adapter = new DOS.cloud.CloudAdapter(DOS.cloud.client, session.user.id);
    adapter.listeners.add(renderSyncStatus);
    await adapter.hydrate(S.COLLECTIONS);
    DOS.cloud.adapter = adapter;
    return adapter;
  }

  function localAdapter() {
    try {
      const adapter = new DOS.storage.LocalStorageAdapter();
      localStorage.setItem('danios.v1.__probe', '1');
      localStorage.removeItem('danios.v1.__probe');
      return adapter;
    } catch (e) {
      setTimeout(() => ui.toast('El navegador bloquea el almacenamiento local: los datos no se guardarán al recargar.', 'error', { duration: 8000 }), 400);
      return new DOS.storage.MemoryAdapter();
    }
  }

  async function boot() {
    await DOS.lock.gate();
    const cloudMode = DOS.cloud && DOS.cloud.enabled();
    let adapter;
    if (cloudMode) {
      try {
        adapter = await connectCloud();
      } catch (e) {
        console.error(e);
        document.getElementById('content').innerHTML = `<div class="card">${ui.empty({ iconName: 'alert', title: 'No se pudo iniciar la sincronización', text: e.message })}</div>`;
        return;
      }
    } else adapter = localAdapter();

    store.init(adapter);
    // Zona horaria del dispositivo: la usa la función de Siri para saber qué es "hoy" y "mañana"
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && store.user().timezone !== tz) store.updateUser({ timezone: tz });
    } catch (e) { /* sin Intl */ }
    store.onError = () => ui.toast('No se pudo guardar. Revisa el espacio del navegador.', 'error');
    if (cloudMode) adapter.start(store);

    // Los datos DEMO solo se siembran en modo local, la primera vez
    const empty = S.COLLECTIONS.filter((c) => c !== 'users').every((c) => !store.all(c).length);
    if (!cloudMode && empty && !store.user().demo_seeded) DOS.demo.seed(store);

    store.subscribe(scheduleRender);
    bindGlobalEvents();
    document.getElementById('boot').remove();
    render({ transition: true });
    renderSyncStatus();
    initNotifications();

    // Refresco suave cada minuto para indicadores "ahora" y recordatorios
    setInterval(() => {
      if (document.hidden || ui._modals.length || popover) return;
      if (isTyping({ target: document.activeElement })) return;
      render();
    }, 60000);
  }

  /* ---------- Notificaciones push (las envía el servidor aunque la app esté cerrada) ---------- */
  let swReg = null;
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  async function initNotifications() {
    if (!pushSupported()) return;
    try { swReg = await navigator.serviceWorker.register('sw.js'); } catch (e) { return; }
    if (Notification.permission === 'granted') saveSubscription().catch(() => {});
  }

  const b64ToBytes = (b64) => {
    const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };

  async function saveSubscription() {
    if (!DOS.cloud.client || !DOS.cloud.user) throw new Error('Inicia sesión para activar las notificaciones.');
    const reg = swReg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(window.DOS_CONFIG.vapidPublicKey) });
    const json = sub.toJSON();
    const label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Otro';
    const { error } = await DOS.cloud.client.from('push_subscriptions').upsert({ endpoint: json.endpoint, subscription: json, label }, { onConflict: 'endpoint' });
    if (error) throw error;
    return true;
  }

  async function requestNotifications() {
    if (!pushSupported()) { ui.toast('En iPhone, abre DANI BOSS desde el icono de la pantalla de inicio para activar notificaciones.', 'error'); return false; }
    if (Notification.permission === 'denied') { ui.toast('Las notificaciones están bloqueadas. Actívalas en Ajustes del iPhone/navegador.', 'error'); return false; }
    const result = await Notification.requestPermission();
    if (result !== 'granted') return false;
    try { await saveSubscription(); DOS.pushError = null; ui.toast('Notificaciones activadas en este dispositivo', 'success'); return true; }
    catch (e) { DOS.pushError = `${e.name || 'Error'}: ${e.message || e}`; ui.toast('No se pudieron activar las notificaciones.', 'error'); return false; }
  }

  async function pushStatus() {
    const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    if (ios && !standalone) return { ok: false, text: 'Estás en Safari. Abre DANI BOSS desde el icono de la pantalla de inicio.' };
    if (!pushSupported()) return { ok: false, text: ios ? 'Tu iPhone no soporta notificaciones web (necesita iOS 16.4 o superior).' : 'Este navegador no soporta notificaciones push.' };
    if (Notification.permission === 'denied') return { ok: false, text: ios ? 'Bloqueadas. Ve a Ajustes del iPhone → Notificaciones → DANI BOSS y actívalas.' : 'Bloqueadas en el navegador.' };
    if (Notification.permission !== 'granted') return { ok: false, text: 'Falta dar permiso: toca "Activar notificaciones".' };
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (!sub) return { ok: false, text: 'Permiso dado, pero este dispositivo no está registrado: toca "Registrar este dispositivo".' + (DOS.pushError ? ` (${DOS.pushError})` : '') };
    const { data, error } = await DOS.cloud.client.from('push_subscriptions').select('endpoint').eq('endpoint', sub.endpoint);
    if (error) return { ok: false, text: `No se pudo comprobar con el servidor: ${error.message}` };
    if (!data.length) return { ok: false, text: 'El servidor no conoce este dispositivo: toca "Registrar este dispositivo".' };
    return { ok: true, text: 'Este dispositivo está registrado y recibirá los avisos.' };
  }
  DOS.pushStatus = pushStatus;

  async function testNotification() {
    try {
      await saveSubscription();
      const session = await DOS.cloud.session();
      const r = await fetch(`${window.DOS_CONFIG.supabaseUrl}/functions/v1/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ test: true }) });
      const d = await r.json();
      ui.toast(d.ok ? `Prueba enviada a ${d.sent} dispositivo(s)` : 'No se pudo enviar la prueba.', d.ok ? 'success' : 'error');
    } catch (e) { DOS.pushError = `${e.name || 'Error'}: ${e.message || e}`; ui.toast('No se pudo enviar la prueba.', 'error'); }
  }
  DOS.testNotification = testNotification;
  DOS.requestNotifications = requestNotifications;

  DOS.app = { render, scheduleRender, scrollTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }), openPalette };
  document.addEventListener('DOMContentLoaded', boot);
})(window);
