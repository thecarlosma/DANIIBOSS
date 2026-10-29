/* DANI OS — Dashboard: visión general en segundos. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function mini(label, value, sub = '', href = '') {
    const tag = href ? 'a' : 'div';
    return `<${tag} class="mini" ${href ? `href="${href}"` : ''}><div class="k">${esc(label)}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</${tag}>`;
  }

  function subsCard(d, T) {
    const o = F.subscriptionsOverview(d, T);
    const soon = o.upcoming.filter((s) => s.daysLeft <= 7);
    if (!soon.length) return '';
    return `<div class="card">
      <div class="card-head"><h3>Cobros de suscripciones</h3><a class="link muted" href="#/suscripciones" style="font-size:12.5px">${ui.money(o.monthlyTotal)}/mes →</a></div>
      <div class="list">${soon.slice(0, 4).map((s) => `
        <div class="list-item clickable" data-action="pay-sub" data-id="${s.sub.id}">
          <div class="grow"><div class="title">${esc(s.sub.name)}</div><div class="meta ${s.overdue ? 'neg' : s.dueToday || s.dueSoon ? 'warn' : ''}">${s.overdue ? `Atrasada · ${U.fmtDate(s.sub.next_date)}` : `${U.relDay(s.sub.next_date, T)} · ${U.fmtDate(s.sub.next_date)}`}</div></div>
          <div class="amount">${ui.money(s.sub.amount)}</div>
        </div>`).join('')}</div>
    </div>`;
  }

  DOS.views.dashboard = {
    title: 'Dashboard',
    render() {
      const d = store.data, T = U.today(), now = U.nowTime();
      const user = store.user();
      const cap = F.capitalOverview(d, T);
      const debts = F.debtsOverview(d, T);
      const m = U.periodRange('month', T);
      const elapsed = U.daysBetween(m.from, T);
      const pm = { from: U.addMonths(m.from, -1) };
      pm.to = U.addDays(pm.from, elapsed) > U.endOfMonth(pm.from) ? U.endOfMonth(pm.from) : U.addDays(pm.from, elapsed);
      const incMonth = F.sumPeriod(d.income, m.from, m.to), expMonth = F.sumPeriod(d.expenses, m.from, m.to);
      const incPrev = F.sumPeriod(d.income, pm.from, pm.to), expPrev = F.sumPeriod(d.expenses, pm.from, pm.to);
      const day = F.dayAnalysis(d, T);
      const incToday = F.sumPeriod(d.income, T, T);
      const tasks = L.taskBuckets(d.tasks, T).today;
      const tasksOpen = tasks.filter((t) => t.status !== 'completada');
      const eventsToday = L.eventsOn(d, T);
      const nextEvt = L.nextEvent(d, T, now);
      const train = L.nextTraining(d, T);
      const trainedToday = L.workoutOn(d, T);
      const habitsDone = d.habits.filter((h) => L.habitStats(h, d.habit_logs, T).doneToday).length;
      const insights = DOS.intelligence.insights(d, (n) => ui.money(n), T).slice(0, 3);

      const capFrom = U.addDays(T, -29);
      const capSeries = F.capitalSeries(d, capFrom, T).map((p) => ({ label: U.fmtDate(p.date), title: U.fmtDate(p.date), value: p.value }));
      const months = F.monthlySeries(d, 6, T);
      const cats = F.categoryBreakdown(F.inPeriod(d.expenses, m.from, m.to)).map((c) => ({ ...c, color: S.colorFor(S.expenseCategories, c.key) }));
      const debtRows = debts.stats.slice().sort((a, b) => b.pending - a.pending);

      return `
      <div class="page-head">
        <div>
          <h1 class="page-title">${greeting()}${user.name ? `, ${esc(user.name)}` : ''}</h1>
          <div class="page-sub">${U.capitalize(U.fmtDateLong(T))} · tu centro de control</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="add-income">${icon('income')}Ingreso</button>
          <button class="btn btn-primary" data-action="add-expense">${icon('plus')}Gasto</button>
        </div>
      </div>

      <button class="capture-bar" data-action="capture" aria-label="Dictar o escribir un registro">
        <span class="icon-tile accent">${icon('mic')}</span>
        <span class="grow">Dime qué registrar… <span class="faint">“gasté 12 en almuerzo”</span></span>
        <kbd class="desktop-only">V</kbd>
      </button>

      <div class="grid cols-4">
        <div class="span-2">${ui.stat({ label: 'Saldo disponible', iconName: 'wallet', hero: true, size: 'xl', href: '#/capital', value: ui.money(cap.available),
          meta: `<span>Libre tras compromisos: <strong class="num" style="color:#fff">${ui.money(cap.free)}</strong></span><span class="faint">·</span><span>Patrimonio neto ${ui.money(cap.netWorth)}</span>`, title: 'Ver capital' })}</div>
        ${ui.stat({ label: 'Ingresos del mes', iconName: 'income', value: ui.money(incMonth), meta: `${ui.trend(F.change(incMonth, incPrev))}<span>vs mismo periodo del mes anterior</span>` })}
        ${ui.stat({ label: 'Gastos del mes', iconName: 'expense', value: ui.money(expMonth), meta: `${ui.trend(F.change(expMonth, expPrev), { invert: true })}<span>vs mismo periodo del mes anterior</span>` })}
      </div>

      <div class="grid cols-3 mt-16">
        ${ui.stat({ label: 'Capital comprometido', iconName: 'layers', value: ui.money(cap.committed), meta: 'Pagos de deuda (30 días) + salidas planificadas' })}
        ${ui.stat({ label: 'Deuda total pendiente', iconName: 'receipt', value: ui.money(debts.totalPending), meta: `<div style="flex:1">${ui.progress(debts.progress)}</div><span class="num">${U.fmtPct(debts.progress)}</span>` })}
        ${ui.stat({ label: 'Devuelto este mes', iconName: 'check', value: `<span class="${debts.returnedThisMonth > 0 ? 'pos' : ''}">${ui.money(debts.returnedThisMonth)}</span>`, meta: `${debts.paymentsThisMonth.length} pago${debts.paymentsThisMonth.length === 1 ? '' : 's'} · ${debts.pendingPeople} persona${debts.pendingPeople === 1 ? '' : 's'} pendiente${debts.pendingPeople === 1 ? '' : 's'}` })}
      </div>

      <div class="grid cols-3 mt-16">
        <a class="card card-hover glance" href="#/tareas">
          <div class="stat-label">${icon('checkSquare')}Tareas de hoy</div>
          <div class="stat-value md">${tasksOpen.length} <span class="muted" style="font-size:14px;font-weight:500">pendiente${tasksOpen.length === 1 ? '' : 's'}</span></div>
          <div class="stat-meta">${tasks.length - tasksOpen.length} de ${tasks.length} completadas</div>
        </a>
        <a class="card card-hover glance" href="#/calendario">
          <div class="stat-label">${icon('calendar')}Próximo evento</div>
          ${nextEvt ? `<div class="stat-value md" title="${esc(nextEvt.title)}">${esc(nextEvt.title)}</div>
            <div class="stat-meta">${U.relDay(nextEvt.date, T)} · ${esc(nextEvt.time || '')} <span class="tag"><span class="sw" style="background:${S.eventColors[nextEvt.category] || '#8654D6'}"></span>${esc(nextEvt.category)}</span></div>`
          : '<div class="stat-value md muted">Sin eventos</div><div class="stat-meta">Tu agenda está libre</div>'}
        </a>
        <a class="card card-hover glance" href="#/entrenamientos">
          <div class="stat-label">${icon('dumbbell')}Próximo entrenamiento</div>
          ${trainedToday ? `<div class="stat-value md pos">Completado hoy</div><div class="stat-meta">${esc(trainedToday.title)}${train ? ` · Siguiente: ${U.relDay(train.date, T)}` : ''}</div>`
          : train ? `<div class="stat-value md">${esc(train.routine.name)}</div><div class="stat-meta">${U.relDay(train.date, T)}${train.routine.time ? ` · ${esc(train.routine.time)}` : ''} · ${train.exercises.length} ejercicios</div>`
          : '<div class="stat-value md muted">Sin rutina</div><div class="stat-meta">Crea tus rutinas semanales</div>'}
        </a>
      </div>

      <div class="split mt-16">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Resumen de hoy</h3><a class="link muted" href="#/dia" style="font-size:12.5px">Abrir Mi Día →</a></div>
            <div class="today-grid">
              ${mini('Gastado hoy', ui.money(day.total), day.vsAvgPct === null ? 'Sin promedio aún' : `${ui.trend(day.vsAvgPct, { invert: true })} vs promedio`, '#/gastos')}
              ${mini('Ingresos hoy', `<span class="${incToday > 0 ? 'pos' : ''}">${ui.money(incToday)}</span>`, '', '#/ingresos')}
              ${mini('Tareas pendientes', `${tasksOpen.length}<span class="muted" style="font-size:13px"> / ${tasks.length}</span>`, tasksOpen.filter((t) => t.priority === 'alta').length ? `🔥 ${tasksOpen.filter((t) => t.priority === 'alta').length} prioritarias` : '', '#/tareas')}
              ${mini('Entrenamiento', trainedToday ? '<span class="pos">Hecho</span>' : L.routineFor(d, T) ? esc(L.routineFor(d, T).name) : 'Descanso', trainedToday ? esc(trainedToday.title) : L.routineFor(d, T) && L.routineFor(d, T).time ? `A las ${esc(L.routineFor(d, T).time)}` : '', '#/entrenamientos')}
              ${mini('Eventos', String(eventsToday.length), eventsToday[0] ? `${esc(eventsToday[0].time)} · ${esc(eventsToday[0].title)}` : 'Nada agendado', '#/calendario')}
              ${mini('Hábitos', `${habitsDone}<span class="muted" style="font-size:13px"> / ${d.habits.length}</span>`, d.habits.length ? ui.progress(U.pct(habitsDone, d.habits.length), 'sm') : '', '#/habitos')}
            </div>
          </div>
          ${subsCard(d, T)}

          <div class="grid cols-2">
            <div class="card">
              <div class="card-head"><h3>Ingresos vs gastos</h3><div class="chart-legend"><span><i style="background:#8654D6"></i>Ingresos</span><span><i style="background:#3A3A42"></i>Gastos</span></div></div>
              ${ui.chart({ type: 'bars', height: 190, label: 'Ingresos vs gastos últimos 6 meses', series: [{ name: 'Ingresos', color: '#8654D6' }, { name: 'Gastos', color: '#3A3A42' }], data: months.map((x) => ({ key: x.key, label: x.label, title: U.capitalize(U.fmtMonth(x.key)), values: [x.income, x.expense] })) })}
            </div>
            <div class="card">
              <div class="card-head"><h3>Evolución del capital</h3><span class="sub">30 días</span></div>
              ${ui.chart({ type: 'line', height: 190, label: 'Capital disponible últimos 30 días', data: capSeries })}
            </div>
            <div class="card">
              <div class="card-head"><h3>Gastos por categoría</h3><span class="sub">${U.capitalize(U.fmtMonth(T))}</span></div>
              ${cats.length ? ui.donut(cats, { centerLabel: 'Este mes' }) : ui.empty({ iconName: 'pie', title: 'Sin gastos este mes' })}
            </div>
            <div class="card">
              <div class="card-head"><h3>Progreso de deudas</h3><a class="link muted" href="#/deudas" style="font-size:12.5px">Ver →</a></div>
              ${debtRows.length ? `<div class="hbar">${debtRows.slice(0, 5).map((s) => `
                <div class="hbar-row"><div class="top"><span class="n">${S.debtStatuses[s.status].emoji} ${esc(s.debt.name)}</span><span class="num muted">${ui.money(s.returned)} / ${ui.money(s.original)}</span></div>
                ${ui.progress(s.progress, 'sm' + (s.status === 'saldado' ? ' pos' : ''))}</div>`).join('')}</div>`
              : ui.empty({ iconName: 'receipt', title: 'Sin deudas registradas' })}
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Tareas de hoy</h3><button class="icon-btn sm" data-action="add-task" aria-label="Nueva tarea" title="Nueva tarea">${icon('plus')}</button></div>
            <div class="list">${tasks.length ? tasks.slice(0, 7).map((t) => DOS.views.tasks.item(t, T, true)).join('') : ui.empty({ iconName: 'checkSquare', title: 'Nada pendiente hoy', text: 'Añade una tarea para empezar.' })}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Agenda de hoy</h3><button class="icon-btn sm" data-action="add-event" aria-label="Nuevo evento" title="Nuevo evento">${icon('plus')}</button></div>
            <div class="list">${eventsToday.length ? eventsToday.map((e) => `
              <div class="list-item clickable" data-action="edit" data-c="events" data-id="${e.id}">
                <div class="b-time num" style="width:44px">${esc(e.time || '—')}</div>
                <div class="grow"><div class="title">${esc(e.title)} ${ui.demoTag(e)}</div><div class="meta">${U.fmtDuration(e.duration)} · ${esc(e.category)}</div></div>
                <span class="tag"><span class="sw" style="background:${S.eventColors[e.category] || '#8654D6'}"></span>${S.priorityIcon(e.priority)}</span>
              </div>`).join('') : '<p class="muted" style="margin:0">Sin eventos hoy.</p>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Insights</h3><a class="link muted" href="#/insights" style="font-size:12.5px">Ver todos →</a></div>
            <div class="stack" style="gap:8px">${insights.length ? insights.map((i) => DOS.views.insights.line(i)).join('') : '<p class="muted" style="margin:0">Registra movimientos para generar insights.</p>'}</div>
          </div>
        </div>
      </div>`;
    },
  };
})(window);
