/* DANI OS — Planificación: Mi Día, Calendario, Tareas. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  const STATUS_NEXT = { pendiente: 'en_progreso', en_progreso: 'completado', completado: 'pendiente' };
  const TASK_NEXT = { pendiente: 'en_progreso', en_progreso: 'completada', completada: 'pendiente' };

  /* ======================= MI DÍA ======================= */
  const dayState = { date: U.today() };
  const blocksOf = (date) => store.where('day_blocks', (b) => b.date === date).sort((a, b) => a.time.localeCompare(b.time));

  /** Reordena bloques conservando la secuencia de horarios: el bloque movido toma la hora del hueco destino. */
  function reorderBlocks(date, fromId, toIndex) {
    const list = blocksOf(date);
    const times = list.map((b) => b.time);
    const from = list.findIndex((b) => b.id === fromId);
    if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return;
    const [moved] = list.splice(from, 1);
    list.splice(toIndex, 0, moved);
    list.forEach((b, i) => { if (b.time !== times[i]) store.update('day_blocks', b.id, { time: times[i] }); });
    ui.toast(`“${moved.title}” movido a las ${times[toIndex]}`);
  }

  function blockRow(b, i, n, isToday, nowMin) {
    const start = U.toMin(b.time), end = start + (+b.duration || 0);
    const isNow = isToday && nowMin >= start && nowMin < end;
    const label = S.labelOf(S.blockStatuses, b.status);
    return `<div class="block ${isNow ? 'now' : ''} ${b.status === 'completado' ? 'is-done' : ''}" draggable="true" data-block="${b.id}" data-index="${i}">
      <div class="grip" title="Arrastra para mover" aria-hidden="true">${icon('grip')}</div>
      <div class="b-time">${esc(b.time)}<small>${U.fromMin(end)}</small></div>
      <div style="min-width:0">
        <div class="b-title"><span>${esc(b.title)}</span> ${ui.demoTag(b)}</div>
        <div class="muted" style="font-size:12px">${S.priorityIcon(b.priority)} ${U.fmtDuration(b.duration)} ${isNow ? '· <span class="now-label">Ahora</span>' : ''}</div>
      </div>
      <div class="b-right">
        ${ui.statusPill(b.status, label, 'block-status', b.id)}
        <button class="icon-btn sm" data-action="block-move" data-id="${b.id}" data-value="${i - 1}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Subir">${icon('arrowUp')}</button>
        <button class="icon-btn sm" data-action="block-move" data-id="${b.id}" data-value="${i + 1}" ${i === n - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Bajar">${icon('arrowDown')}</button>
        <button class="icon-btn sm" data-action="edit" data-c="day_blocks" data-id="${b.id}" aria-label="Editar">${icon('edit')}</button>
      </div>
    </div>`;
  }

  DOS.views.day = {
    title: 'Mi Día',
    render() {
      const d = store.data, T = U.today(), date = dayState.date;
      const isToday = date === T;
      const blocks = blocksOf(date);
      const done = blocks.filter((b) => b.status === 'completado').length;
      const planned = U.sum(blocks, (b) => +b.duration || 0);
      const tasks = L.taskBuckets(d.tasks, date).today.filter((t) => t.date === date || isToday);
      const events = L.eventsOn(d, date);
      const spent = F.dayAnalysis(d, date).total;
      const routine = L.routineFor(d, date);
      const workout = L.workoutOn(d, date);
      const nowMin = U.toMin(U.nowTime());
      return `
      <div class="page-head">
        <div><h1 class="page-title">Mi Día</h1><div class="page-sub">${U.capitalize(U.fmtDateLong(date))}</div></div>
        <div class="page-actions">
          <button class="btn btn-ghost" data-action="day-copy" title="Copiar los bloques del día anterior">${icon('copy')}Copiar día anterior</button>
          <button class="btn btn-primary" data-action="add-block">${icon('plus')}Bloque</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="date-nav">
          <button class="icon-btn" data-action="day-shift" data-value="-1" aria-label="Día anterior">${icon('chevL')}</button>
          <span class="lbl">${esc(U.relDay(date))}</span>
          <button class="icon-btn" data-action="day-shift" data-value="1" aria-label="Día siguiente">${icon('chevR')}</button>
        </div>
        ${!isToday ? '<button class="btn btn-ghost sm" data-action="day-today">Hoy</button>' : ''}
      </div>
      <div class="split">
        <div class="stack">
          <div class="card tight">
            <div class="row between wrap">
              <div class="row" style="gap:18px">
                <div><div class="stat-label">Completado</div><div class="stat-value md">${done}<span class="muted" style="font-size:14px"> / ${blocks.length}</span></div></div>
                <div><div class="stat-label">Planificado</div><div class="stat-value md">${U.fmtDuration(planned)}</div></div>
              </div>
              <div style="flex:1;min-width:160px;max-width:300px">${ui.progress(U.pct(done, blocks.length))}</div>
            </div>
          </div>
          ${blocks.length ? `<div class="blocks" id="blocks">${blocks.map((b, i) => blockRow(b, i, blocks.length, isToday, nowMin)).join('')}</div>
            <p class="faint" style="font-size:12px;margin:0">Arrastra un bloque (o usa las flechas) para intercambiar horarios. Toca el estado para avanzarlo.</p>`
          : `<div class="card">${ui.empty({ iconName: 'sun', title: 'Día sin planificar', text: 'Organiza tu día en bloques horarios.', action: 'add-block', actionLabel: 'Añadir bloque' })}</div>`}
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Tareas</h3><button class="icon-btn sm" data-action="add-task-on" data-value="${date}" aria-label="Nueva tarea">${icon('plus')}</button></div>
            <div class="list">${tasks.length ? tasks.map((t) => DOS.views.tasks.item(t, T, true)).join('') : '<p class="muted" style="margin:0">Sin tareas para este día.</p>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Eventos</h3><button class="icon-btn sm" data-action="add-event-on" data-value="${date}" aria-label="Nuevo evento">${icon('plus')}</button></div>
            <div class="list">${events.length ? events.map((e) => `<div class="list-item clickable" data-action="edit" data-c="events" data-id="${e.id}"><div class="b-time num" style="width:44px">${esc(e.time)}</div><div class="grow"><div class="title">${esc(e.title)}</div><div class="meta">${esc(e.category)} · ${U.fmtDuration(e.duration)}</div></div></div>`).join('') : '<p class="muted" style="margin:0">Sin eventos.</p>'}</div>
          </div>
          <div class="grid cols-2">
            <a class="card card-hover" href="#/gastos?d=${date}"><div class="stat-label">Gastado</div><div class="stat-value md">${ui.money(spent)}</div></a>
            <a class="card card-hover" href="#/entrenamientos"><div class="stat-label">Entreno</div><div class="stat-value md ${workout ? 'pos' : ''}" style="font-size:15px">${workout ? 'Hecho ✓' : routine ? esc(routine.name) : 'Descanso'}</div></a>
          </div>
        </div>
      </div>`;
    },
    mount(rootEl) {
      const list = rootEl.querySelector('#blocks');
      if (!list) return;
      let dragId = null;
      list.addEventListener('dragstart', (e) => {
        const b = e.target.closest('[data-block]');
        if (!b) return;
        dragId = b.dataset.block;
        b.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
      });
      list.addEventListener('dragend', (e) => {
        const b = e.target.closest('[data-block]');
        if (b) b.classList.remove('dragging');
        list.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
      });
      list.addEventListener('dragover', (e) => {
        const b = e.target.closest('[data-block]');
        if (!b || !dragId) return;
        e.preventDefault();
        list.querySelectorAll('.drop-target').forEach((x) => x !== b && x.classList.remove('drop-target'));
        if (b.dataset.block !== dragId) b.classList.add('drop-target');
      });
      list.addEventListener('drop', (e) => {
        const b = e.target.closest('[data-block]');
        if (!b || !dragId) return;
        e.preventDefault();
        reorderBlocks(dayState.date, dragId, +b.dataset.index);
        dragId = null;
      });
    },
    actions: {
      'day-shift': (el) => { dayState.date = U.addDays(dayState.date, +el.dataset.value); },
      'day-today': () => { dayState.date = U.today(); },
      'add-block': () => { DOS.forms.block(null, { date: dayState.date }); return false; },
      'block-status': (el) => { const b = store.get('day_blocks', el.dataset.id); store.update('day_blocks', b.id, { status: STATUS_NEXT[b.status] || 'pendiente' }); return false; },
      'block-move': (el) => { reorderBlocks(dayState.date, el.dataset.id, +el.dataset.value); return false; },
      'add-task-on': (el) => { DOS.forms.task(null, { date: el.dataset.value }); return false; },
      'add-event-on': (el) => { DOS.forms.event(null, { date: el.dataset.value }); return false; },
      'day-copy': async () => {
        const prev = blocksOf(U.addDays(dayState.date, -1));
        if (!prev.length) { ui.toast('El día anterior no tiene bloques', 'info'); return false; }
        const current = blocksOf(dayState.date);
        if (current.length && !(await ui.confirm({ title: 'Copiar día anterior', message: `Se añadirán ${prev.length} bloques a los ${current.length} que ya tienes.`, confirmLabel: 'Copiar' }))) return false;
        prev.forEach((b) => store.insert('day_blocks', { date: dayState.date, time: b.time, duration: b.duration, title: b.title, priority: b.priority, status: 'pendiente' }, { silent: true }));
        store.emit('day_blocks', 'bulk');
        ui.toast(`${prev.length} bloques copiados`);
        return false;
      },
    },
  };

  /* ======================= CALENDARIO ======================= */
  const calState = { mode: 'month', ref: U.today() };

  /** Eventos + elementos derivados (pagos de deuda, entrenos) para una fecha */
  function itemsOn(date, { withTraining = false } = {}) {
    const d = store.data;
    const items = L.eventsOn(d, date).map((e) => ({ kind: 'event', id: e.id, title: e.title, time: e.time, duration: e.duration, color: S.eventColors[e.category] || '#8654D6', meta: e.category, demo: e.is_demo }));
    F.subscriptionsOverview(d).upcoming.filter((s) => s.sub.next_date === date).forEach((s) => items.push({ kind: 'sub', id: s.sub.id, title: `💳 ${s.sub.name}`, time: '', color: S.eventColors['Pago'], meta: ui.money(s.sub.amount), derived: true }));
    F.debtsOverview(d).upcoming.filter((s) => s.nextDate === date).forEach((s) => items.push({ kind: 'debt', id: s.debt.id, title: `Pago a ${s.debt.name}`, time: '', color: S.eventColors['Pago'], meta: ui.money(s.nextAmount), derived: true }));
    if (withTraining) {
      const r = L.routineFor(d, date);
      if (r) items.push({ kind: 'training', id: r.id, title: `🏋️ ${r.name}`, time: r.time || '', duration: 60, color: S.eventColors['Gimnasio'], meta: L.workoutOn(d, date) ? 'Completado' : 'Rutina', derived: true });
    }
    return items.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }
  const itemAction = (it) => it.kind === 'event' ? `data-action="edit" data-c="events" data-id="${it.id}"` : it.kind === 'debt' ? `data-action="pay-debt" data-id="${it.id}"` : it.kind === 'sub' ? `data-action="pay-sub" data-id="${it.id}"` : `data-action="go" data-href="#/entrenamientos"`;

  function calMonth() {
    const T = U.today();
    const first = U.startOfMonth(calState.ref);
    const start = U.startOfWeek(first);
    const end = U.endOfWeek(U.endOfMonth(calState.ref));
    const days = U.eachDay(start, end);
    return `<div class="cal-month">
      ${S.weekdays.map((w) => `<div class="cal-dow">${w.short}</div>`).join('')}
      ${days.map((date) => {
        const items = itemsOn(date);
        const out = date.slice(0, 7) !== first.slice(0, 7);
        return `<div class="cal-cell ${out ? 'out' : ''} ${date === T ? 'today' : ''}" data-action="cal-open-day" data-value="${date}">
          <span class="cal-num">${+date.slice(8)}</span>
          ${items.slice(0, 3).map((it) => `<div class="ev-chip ${it.derived ? 'derived' : ''}" style="--c:${it.color}" ${itemAction(it)} title="${esc(it.title)}">${it.time ? `<span class="faint">${esc(it.time)}</span> ` : ''}${esc(it.title)}</div>`).join('')}
          ${items.length > 3 ? `<span class="ev-more">+${items.length - 3} más</span>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }
  function calWeek() {
    const T = U.today();
    const start = U.startOfWeek(calState.ref);
    return `<div class="cal-week">${U.eachDay(start, U.addDays(start, 6)).map((date) => {
      const items = itemsOn(date, { withTraining: true });
      return `<div class="cal-wcol ${date === T ? 'today' : ''}">
        <div class="cal-whead" data-action="cal-open-day" data-value="${date}"><span class="d">${U.fmtDate(date, { weekday: 'short' })}</span><span class="n ${date === T ? 'accent' : ''}">${+date.slice(8)}</span></div>
        ${items.map((it) => `<div class="ev-card" style="--c:${it.color}" ${itemAction(it)}><div class="t">${esc(it.title)}</div><div class="m">${it.time ? esc(it.time) + ' · ' : ''}${esc(it.meta || '')}</div></div>`).join('')}
        <button class="btn btn-ghost sm" style="margin-top:auto" data-action="add-event-on" data-value="${date}" aria-label="Nuevo evento">${icon('plus')}</button>
      </div>`;
    }).join('')}</div>`;
  }
  function calDay() {
    const date = calState.ref;
    const items = itemsOn(date, { withTraining: true });
    const timed = items.filter((i) => i.time);
    const allDay = items.filter((i) => !i.time);
    const firstHour = Math.min(6, ...timed.map((i) => Math.floor(U.toMin(i.time) / 60)));
    const nowH = date === U.today() ? new Date().getHours() : -1;
    const hours = [];
    for (let h = firstHour; h <= 23; h++) hours.push(h);
    return `<div class="card">
      ${allDay.length ? `<div class="chips" style="margin-bottom:12px">${allDay.map((it) => `<div class="ev-card" style="--c:${it.color}" ${itemAction(it)}><div class="t">${esc(it.title)}</div><div class="m">${esc(it.meta || '')}</div></div>`).join('')}</div>` : ''}
      <div class="cal-day">${hours.map((h) => {
        const inHour = timed.filter((i) => Math.floor(U.toMin(i.time) / 60) === h);
        return `<div class="hour-row ${h === nowH ? 'now-row' : ''}"><div class="h">${U.pad(h)}:00</div>
          <div class="slot" data-action="cal-new-at" data-value="${U.pad(h)}:00">${inHour.map((it) => `<div class="ev-card" style="--c:${it.color}" ${itemAction(it)}><div class="t">${esc(it.title)} ${it.demo ? '<span class="tag demo">DEMO</span>' : ''}</div><div class="m">${esc(it.time)}${it.duration ? ` – ${U.fromMin(U.toMin(it.time) + +it.duration)}` : ''} · ${esc(it.meta || '')}</div></div>`).join('')}</div></div>`;
      }).join('')}</div></div>`;
  }

  DOS.views.calendar = {
    title: 'Calendario',
    render() {
      const r = calState.ref;
      const label = calState.mode === 'month' ? U.fmtMonth(r)
        : calState.mode === 'week' ? `${U.fmtDate(U.startOfWeek(r))} – ${U.fmtDate(U.endOfWeek(r))}`
        : U.fmtDateLong(r);
      return `
      <div class="page-head">
        <div><h1 class="page-title">Calendario</h1><div class="page-sub">Eventos, pagos de deudas y entrenamientos en un solo lugar.</div></div>
        <div class="page-actions">
          ${ui.segmented('cal-mode', [{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' }], calState.mode)}
          <button class="btn btn-primary" data-action="add-event-on" data-value="${calState.mode === 'day' ? r : U.today()}">${icon('plus')}Evento</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="date-nav">
          <button class="icon-btn" data-action="cal-shift" data-value="-1" aria-label="Anterior">${icon('chevL')}</button>
          <span class="lbl">${esc(label)}</span>
          <button class="icon-btn" data-action="cal-shift" data-value="1" aria-label="Siguiente">${icon('chevR')}</button>
        </div>
        <button class="btn btn-ghost sm" data-action="cal-today">Hoy</button>
        <span class="topbar-spacer"></span>
        <div class="chart-legend">${S.eventCategories.map((c) => `<span><i style="background:${S.eventColors[c]};border-radius:50%"></i>${c}</span>`).join('')}</div>
      </div>
      ${calState.mode === 'month' ? calMonth() : calState.mode === 'week' ? calWeek() : calDay()}`;
    },
    actions: {
      'cal-mode': (el) => { calState.mode = el.dataset.value; },
      'cal-shift': (el) => {
        const dir = +el.dataset.value;
        calState.ref = calState.mode === 'month' ? U.addMonths(calState.ref, dir) : U.addDays(calState.ref, (calState.mode === 'week' ? 7 : 1) * dir);
      },
      'cal-today': () => { calState.ref = U.today(); },
      'cal-open-day': (el) => { calState.mode = 'day'; calState.ref = el.dataset.value; },
      'cal-new-at': (el) => { DOS.forms.event(null, { date: calState.ref, time: el.dataset.value }); return false; },
      'add-event-on': (el) => { DOS.forms.event(null, { date: el.dataset.value }); return false; },
    },
  };

  /* ======================= TAREAS ======================= */
  const taskState = { tab: 'today' };

  function taskItem(t, T = U.today(), compact = false) {
    const done = t.status === 'completada';
    const overdue = !done && t.date && t.date < T;
    const when = [t.date ? (t.date === T ? 'Hoy' : U.relDay(t.date, T)) : '', t.time].filter(Boolean).join(' · ');
    return `<div class="list-item" data-task="${t.id}">
      <button class="check ${done ? 'on' : ''}" data-action="task-toggle" data-id="${t.id}" aria-label="${done ? 'Marcar pendiente' : 'Completar'}">${icon('check')}</button>
      <span class="prio" title="Prioridad ${esc(t.priority)}">${S.priorityIcon(t.priority)}</span>
      <div class="grow" data-action="edit" data-c="tasks" data-id="${t.id}" style="cursor:pointer">
        <div class="title ${done ? 'done-text' : ''}">${esc(t.title)} ${ui.demoTag(t)}</div>
        <div class="meta">${overdue ? '<span class="neg">Atrasada</span> · ' : ''}${esc(when)}${!compact && t.category ? ` · ${esc(t.category)}` : ''}${!compact && t.description ? ` · ${esc(t.description)}` : ''}</div>
      </div>
      ${compact ? '' : ui.statusPill(t.status, S.labelOf(S.taskStatuses, t.status), 'task-status', t.id)}
      ${compact ? '' : ui.rowActions('', 'del', t.id).replace('data-action="del"', 'data-action="del" data-c="tasks"')}
    </div>`;
  }

  DOS.views.tasks = {
    title: 'Tareas', crumb: 'Productividad',
    item: taskItem,
    render() {
      const T = U.today();
      const b = L.taskBuckets(store.data.tasks, T);
      const tabs = [
        { value: 'today', label: `Hoy · ${b.today.filter((t) => t.status !== 'completada').length}` },
        { value: 'week', label: `Esta semana · ${b.week.filter((t) => t.status !== 'completada').length}` },
        { value: 'upcoming', label: `Próximamente · ${b.upcoming.length}` },
        { value: 'completed', label: `Completadas · ${b.completed.length}` },
      ];
      const rows = b[taskState.tab];
      const placeholder = { today: 'Añadir tarea para hoy…', week: 'Añadir tarea para mañana…', upcoming: 'Añadir tarea sin fecha…', completed: '' }[taskState.tab];
      let body;
      if (!rows.length) body = ui.empty({ iconName: 'checkSquare', title: taskState.tab === 'completed' ? 'Aún no has completado tareas' : 'Nada por aquí', text: taskState.tab === 'today' ? 'Día despejado. Añade lo importante.' : '' });
      else if (taskState.tab === 'week') {
        body = [...U.groupBy(rows, (t) => t.date).entries()].map(([date, items]) => `<div class="group-label"><span>${U.relDay(date, T)} · ${U.fmtDate(date)}</span><span>${items.length}</span></div><div class="list">${items.map((t) => taskItem(t, T)).join('')}</div>`).join('');
      } else body = `<div class="list">${rows.map((t) => taskItem(t, T)).join('')}</div>`;
      const open = store.data.tasks.filter((t) => t.status !== 'completada');
      return `
      <div class="page-head">
        <div><h1 class="page-title">Tareas</h1><div class="page-sub">${open.length} abiertas · ${open.filter((t) => t.priority === 'alta').length} de alta prioridad</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-task">${icon('plus')}Nueva tarea</button></div>
      </div>
      <div class="toolbar">${ui.segmented('task-tab', tabs, taskState.tab)}</div>
      <div class="card">
        ${placeholder ? `<form class="quick-add" data-quick-task><span class="icon-tile">${icon('plus')}</span><input class="input" name="title" placeholder="${placeholder}" autocomplete="off" aria-label="Nueva tarea rápida"><select class="select" name="priority" aria-label="Prioridad">${S.priorities.map((p) => `<option value="${p.value}" ${p.value === 'media' ? 'selected' : ''}>${p.icon} ${p.label}</option>`).join('')}</select></form>` : ''}
        ${body}
      </div>`;
    },
    mount(rootEl) {
      const f = rootEl.querySelector('[data-quick-task]');
      if (!f) return;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = f.elements.title.value.trim();
        if (!title) return;
        const T = U.today();
        const date = taskState.tab === 'today' ? T : taskState.tab === 'week' ? U.addDays(T, 1) : '';
        store.insert('tasks', { title, description: '', date, time: '', priority: f.elements.priority.value, category: 'Personal', status: 'pendiente' });
        ui.toast('Tarea añadida');
        requestAnimationFrame(() => { const i = document.querySelector('[data-quick-task] input'); if (i) i.focus(); });
      });
    },
    actions: { 'task-tab': (el) => { taskState.tab = el.dataset.value; } },
  };

  // Acciones globales de tareas (se usan en dashboard, Mi Día y Tareas)
  DOS.globalActions = Object.assign(DOS.globalActions || {}, {
    'task-toggle': (el) => {
      const t = store.get('tasks', el.dataset.id);
      if (!t) return false;
      const done = t.status !== 'completada';
      store.update('tasks', t.id, { status: done ? 'completada' : 'pendiente', completed_at: done ? new Date().toISOString() : null });
      if (done) ui.toast('Tarea completada ✓');
      return false;
    },
    'task-status': (el) => {
      const t = store.get('tasks', el.dataset.id);
      const status = TASK_NEXT[t.status] || 'pendiente';
      store.update('tasks', t.id, { status, completed_at: status === 'completada' ? new Date().toISOString() : null });
      return false;
    },
  });
})(window);
