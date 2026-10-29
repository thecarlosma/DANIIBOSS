/* DANI OS — Fitness: Entrenamientos, Rutinas, Progreso. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  const exMeta = (e) => `${e.sets}×${e.reps}${+e.weight ? ` · ${U.fmtNum(e.weight, 1)} kg` : ''}${e.rest ? ` · ${e.rest}s` : ''}`;

  /* ======================= ENTRENAMIENTOS ======================= */
  const wState = { month: U.startOfMonth(U.today()) };

  function trainingCalendar(d, T) {
    const first = wState.month;
    const start = U.startOfWeek(first), end = U.endOfWeek(U.endOfMonth(first));
    return `<div class="mini-cal">${S.weekdays.map((w) => `<div class="dow">${w.short.slice(0, 2)}</div>`).join('')}
      ${U.eachDay(start, end).map((date) => {
        if (date.slice(0, 7) !== first.slice(0, 7)) return '<div class="d out"></div>';
        const done = L.workoutOn(d, date);
        const planned = L.routineFor(d, date);
        const cls = done ? 'done' : planned && date < T ? 'missed' : planned ? 'planned' : '';
        return `<div class="d ${cls} ${date === T ? 'today' : ''}" title="${U.fmtDate(date)}${done ? ' · ' + esc(done.title) : planned ? ' · ' + esc(planned.name) : ''}">${+date.slice(8)}</div>`;
      }).join('')}</div>
      <div class="chart-legend mt-16"><span><i style="background:#8654D6"></i>Completado</span><span><i style="box-shadow:inset 0 0 0 1px rgba(134,84,214,.6)"></i>Planificado</span><span><i style="box-shadow:inset 0 0 0 1px rgba(229,103,122,.5)"></i>No realizado</span></div>`;
  }

  DOS.views.workouts = {
    title: 'Entrenamientos', crumb: 'Fitness',
    render() {
      const d = store.data, T = U.today();
      const st = L.workoutStats(d, T);
      const routine = L.routineFor(d, T);
      const doneToday = L.workoutOn(d, T);
      const next = L.nextTraining(d, U.addDays(T, 1));
      const history = d.workouts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
      const today = doneToday
        ? `<div class="row between wrap"><div><div class="stat-label">${icon('check')}Hoy</div><div class="stat-value md pos">${esc(doneToday.title)} · completado</div><div class="stat-meta">${doneToday.exercises.length} ejercicios · ${U.fmtDuration(doneToday.duration)}</div></div>
           <button class="btn btn-secondary" data-action="edit" data-c="workouts" data-id="${doneToday.id}">${icon('edit')}Ver registro</button></div>`
        : routine
          ? `<div class="row between wrap" style="align-items:flex-start"><div><div class="stat-label">${icon('dumbbell')}Hoy toca</div><div class="stat-value md">${esc(routine.name)}</div><div class="stat-meta">${routine.time ? `A las ${esc(routine.time)} · ` : ''}${L.exercisesOf(d, routine.id).length} ejercicios</div></div>
             <button class="btn btn-primary" data-action="log-workout" data-id="${routine.id}">${icon('play')}Registrar entrenamiento</button></div>
             <div class="mt-16">${L.exercisesOf(d, routine.id).map((e) => `<div class="ex-row"><span class="n">${esc(e.name)}</span><span class="m">${exMeta(e)}</span></div>`).join('')}</div>`
          : `<div class="row between wrap"><div><div class="stat-label">${icon('sun')}Hoy</div><div class="stat-value md">Descanso</div><div class="stat-meta">${next ? `Próximo: ${esc(next.routine.name)} · ${U.relDay(next.date, T)}` : 'Crea tus rutinas para planificar la semana.'}</div></div>
             <button class="btn btn-secondary" data-action="log-workout">${icon('plus')}Entrenamiento libre</button></div>`;
      return `
      <div class="page-head">
        <div><h1 class="page-title">Entrenamientos</h1><div class="page-sub">Registra cada sesión y mira tu consistencia.</div></div>
        <div class="page-actions"><a class="btn btn-ghost" href="#/rutinas">${icon('list')}Rutinas</a><button class="btn btn-primary" data-action="log-workout" ${routine && !doneToday ? `data-id="${routine.id}"` : ''}>${icon('plus')}Registrar</button></div>
      </div>
      <div class="card stat-card hero">${today}</div>
      <div class="grid cols-4 mt-16">
        ${ui.stat({ label: 'Realizados', iconName: 'dumbbell', value: String(st.total), meta: 'Total histórico' })}
        ${ui.stat({ label: 'Este mes', iconName: 'calendar', value: String(st.month), meta: `${st.planned} planificados hasta hoy` })}
        ${ui.stat({ label: 'Consistencia', iconName: 'activity', value: U.fmtPct(st.consistency), meta: `<div style="flex:1">${ui.progress(st.consistency)}</div>` })}
        ${ui.stat({ label: 'Racha', iconName: 'flame', value: `${st.weekStreak} sem`, meta: 'Semanas seguidas entrenando' })}
      </div>
      <div class="split mt-16">
        <div class="card">
          <div class="card-head"><h3>Historial</h3><span class="sub">${d.workouts.length} sesiones</span></div>
          <div class="list">${history.length ? history.map((w) => `
            <div class="list-item clickable" data-action="edit" data-c="workouts" data-id="${w.id}">
              <div class="icon-tile accent">${icon('dumbbell')}</div>
              <div class="grow"><div class="title">${esc(w.title)} ${ui.demoTag(w)}</div><div class="meta">${U.relDay(w.date, T)} · ${(w.exercises || []).length} ejercicios · ${U.fmtDuration(w.duration)}</div></div>
              <div class="faint num" style="font-size:12px">${U.fmtNum((w.exercises || []).reduce((a, e) => a + e.sets * e.reps * e.weight, 0))} kg vol.</div>
            </div>`).join('') : ui.empty({ iconName: 'dumbbell', title: 'Sin entrenamientos registrados', action: 'log-workout', actionLabel: 'Registrar' })}</div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3 style="text-transform:capitalize">${esc(U.fmtMonth(wState.month))}</h3>
              <div class="row" style="gap:2px"><button class="icon-btn sm" data-action="w-month" data-value="-1" aria-label="Mes anterior">${icon('chevL')}</button><button class="icon-btn sm" data-action="w-month" data-value="1" aria-label="Mes siguiente">${icon('chevR')}</button></div></div>
            ${trainingCalendar(d, T)}
          </div>
          <div class="card"><div class="card-head"><h3>Sesiones por semana</h3><span class="sub">12 semanas</span></div>
            ${ui.chart({ type: 'bars', height: 150, barMax: 16, fmt: (v) => U.fmtNum(v), fmtFull: (v) => `${v} sesiones`, series: [{ name: 'Sesiones', color: '#8654D6' }], data: st.weeks.map((w) => ({ key: w.key, label: U.fmtDate(w.key, { day: 'numeric', month: 'numeric' }), title: `Semana del ${w.label}`, values: [w.value] })) })}
          </div>
        </div>
      </div>`;
    },
    actions: {
      'w-month': (el) => { wState.month = U.addMonths(wState.month, +el.dataset.value); },
    },
  };

  DOS.globalActions = Object.assign(DOS.globalActions || {}, {
    'log-workout': (el) => { DOS.forms.workoutLog({ routineId: el.dataset.id || null }); return false; },
  });

  /* ======================= RUTINAS ======================= */
  DOS.views.routines = {
    title: 'Rutinas', crumb: 'Fitness',
    render() {
      const d = store.data;
      const todayWd = U.isoWeekday(U.today());
      return `
      <div class="page-head">
        <div><h1 class="page-title">Rutinas</h1><div class="page-sub">Tu plan semanal. Cada día puede tener una rutina con sus ejercicios.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-routine">${icon('plus')}Nueva rutina</button></div>
      </div>
      <div class="grid cols-3">${S.weekdays.map((w) => {
        const r = d.routines.find((x) => +x.weekday === w.value);
        if (!r) return `<div class="card routine-day" style="border-style:dashed">
          <div class="dow ${w.value === todayWd ? 'accent' : ''}">${w.label}${w.value === todayWd ? ' · hoy' : ''}</div>
          <div class="muted">Descanso</div>
          <button class="btn btn-ghost sm" style="align-self:flex-start" data-action="add-routine-on" data-value="${w.value}">${icon('plus')}Crear rutina</button></div>`;
        const exs = L.exercisesOf(d, r.id);
        return `<div class="card routine-day card-hover" ${w.value === todayWd ? 'style="border-color:rgba(134,84,214,.35)"' : ''}>
          <div class="row between"><div class="dow ${w.value === todayWd ? 'accent' : ''}">${w.label}${w.value === todayWd ? ' · hoy' : ''}</div>
            ${ui.rowActions('edit', 'del', r.id).replace('data-action="edit"', 'data-action="edit" data-c="routines"').replace('data-action="del"', 'data-action="del" data-c="routines"')}</div>
          <div><div style="font-weight:620;font-size:16px;font-family:var(--font-display)">${esc(r.name)} ${ui.demoTag(r)}</div><div class="muted" style="font-size:12px">${r.time ? esc(r.time) + ' · ' : ''}${exs.length} ejercicios</div></div>
          <div>${exs.map((e) => `<div class="ex-row clickable" data-action="edit" data-c="exercises" data-id="${e.id}" style="cursor:pointer"><span class="n">${esc(e.name)}</span><span class="m">${exMeta(e)}</span></div>`).join('')}</div>
          <div class="row" style="gap:6px"><button class="btn btn-ghost sm" data-action="add-exercise" data-id="${r.id}">${icon('plus')}Ejercicio</button>
          <button class="btn btn-secondary sm" data-action="log-workout" data-id="${r.id}">${icon('play')}Registrar</button></div>
        </div>`;
      }).join('')}</div>`;
    },
    actions: {
      'add-routine-on': (el) => { DOS.forms.routine(null, { weekday: +el.dataset.value }); return false; },
      'add-exercise': (el) => { DOS.forms.exercise(null, el.dataset.id); return false; },
    },
  };

  /* ======================= PROGRESO ======================= */
  const pState = { exercise: '' };

  DOS.views.progress = {
    title: 'Progreso', crumb: 'Fitness',
    render() {
      const d = store.data, T = U.today();
      const names = L.exerciseNames(d);
      const prs = L.personalRecords(d);
      if (!pState.exercise || !names.includes(pState.exercise)) pState.exercise = (prs[0] || {}).name || names[0] || '';
      const hist = pState.exercise ? L.exerciseHistory(d, pState.exercise) : [];
      const st = L.workoutStats(d, T);
      const first = hist[0], last = hist[hist.length - 1];
      return `
      <div class="page-head">
        <div><h1 class="page-title">Progreso</h1><div class="page-sub">Evolución de tus cargas, volumen y consistencia.</div></div>
      </div>
      <div class="grid cols-4">
        ${ui.stat({ label: 'Volumen del mes', iconName: 'activity', value: `${U.fmtNum(st.volume)} kg`, meta: 'Series × reps × peso' })}
        ${ui.stat({ label: 'Sesiones del mes', iconName: 'calendar', value: String(st.month) })}
        ${ui.stat({ label: 'Consistencia', iconName: 'check', value: U.fmtPct(st.consistency) })}
        ${ui.stat({ label: 'Récords', iconName: 'trendUp', value: String(prs.length), meta: 'Ejercicios con progreso medido' })}
      </div>
      <div class="split mt-16">
        <div class="card">
          <div class="card-head"><h3>Peso por sesión</h3>
            ${names.length ? `<select class="select" style="width:auto;height:32px" data-change="p-exercise" aria-label="Ejercicio">${names.map((n) => `<option ${n === pState.exercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}</div>
          ${hist.filter((h) => h.value > 0).length > 1
            ? `${ui.chart({ type: 'line', height: 240, fmt: (v) => `${U.fmtNum(v, 1)} kg`, fmtFull: (v) => `${U.fmtNum(v, 1)} kg`, label: `Progreso ${pState.exercise}`, data: hist.map((h) => ({ label: U.fmtDate(h.date), value: h.value, title: `${U.fmtDate(h.date)} · ${h.sets}×${h.reps}` })) })}
               <div class="stat-meta mt-8">De ${U.fmtNum(first.value, 1)} kg a ${U.fmtNum(last.value, 1)} kg ${ui.trend(first.value ? ((last.value - first.value) / first.value) * 100 : null)} en ${hist.length} sesiones</div>`
            : ui.empty({ iconName: 'trendUp', title: 'Sin suficientes datos', text: 'Registra al menos dos sesiones con peso para ver la evolución.' })}
        </div>
        <div class="card">
          <div class="card-head"><h3>Mejores marcas</h3></div>
          <div class="list">${prs.length ? prs.map((p) => `
            <div class="list-item clickable" data-action="p-pick" data-value="${esc(p.name)}">
              <div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">${p.sessions} sesiones · ${U.fmtDate(p.date)}</div></div>
              <div style="text-align:right"><div class="amount">${U.fmtNum(p.best, 1)} kg</div>${p.delta > 0 ? `<div class="pos" style="font-size:11.5px">+${U.fmtNum(p.delta, 1)} kg</div>` : ''}</div>
            </div>`).join('') : '<p class="muted" style="margin:0">Registra entrenamientos con peso.</p>'}</div>
        </div>
      </div>`;
    },
    actions: { 'p-pick': (el) => { pState.exercise = el.dataset.value; } },
    changes: { 'p-exercise': (el) => { pState.exercise = el.value; } },
  };
})(window);
