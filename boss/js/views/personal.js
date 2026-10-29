/* DANI OS — Hábitos, Objetivos, Insights. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  /* ======================= HÁBITOS ======================= */
  function heatmap(stats, T) {
    const weeks = 18;
    const start = U.addDays(U.startOfWeek(T), -7 * (weeks - 1));
    const cells = U.eachDay(start, U.addDays(start, weeks * 7 - 1)).map((d) =>
      `<i class="${d > T ? 'future' : stats.done.has(d) ? 'on' : ''} ${d === T ? 'today' : ''}" title="${U.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}${d <= T ? (stats.done.has(d) ? ' · hecho' : ' · no') : ''}"></i>`);
    return `<div class="heat" aria-label="Calendario de consistencia">${cells.join('')}</div>`;
  }

  function habitCard(h, T) {
    const s = L.habitStats(h, store.data.habit_logs, T);
    const week = U.eachDay(U.addDays(T, -6), T);
    return `<div class="card habit-card">
      <div class="habit-head">
        <div class="habit-emoji">${esc(h.emoji || '⭐')}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14.5px" class="row">${esc(h.name)} ${ui.demoTag(h)}</div>
          <div class="muted" style="font-size:12px">${s.doneToday ? '<span class="pos">Hecho hoy</span>' : 'Pendiente hoy'}</div></div>
        ${ui.rowActions('edit', 'del', h.id).replace('data-action="edit"', 'data-action="edit" data-c="habits"').replace('data-action="del"', 'data-action="del" data-c="habits"')}
        <button class="btn ${s.doneToday ? 'btn-secondary' : 'btn-primary'} sm" data-action="habit-toggle" data-id="${h.id}" data-value="${T}">${s.doneToday ? icon('check') + 'Hecho' : 'Marcar hoy'}</button>
      </div>
      <div class="habit-stats">
        <div><div class="k">Racha actual</div><div class="v">${s.current} 🔥</div></div>
        <div><div class="k">Mejor racha</div><div class="v">${s.best}</div></div>
        <div><div class="k">Cumplimiento</div><div class="v">${U.fmtPct(s.rate)}</div></div>
      </div>
      <div class="week-toggles">${week.map((d) => `<div class="wt ${d === T ? 'is-today' : ''}">${U.fmtDate(d, { weekday: 'narrow' })}<button class="${s.done.has(d) ? 'on' : ''}" data-action="habit-toggle" data-id="${h.id}" data-value="${d}" aria-label="${U.fmtDate(d)}">${icon('check')}</button></div>`).join('')}</div>
      ${heatmap(s, T)}
    </div>`;
  }

  DOS.views.habits = {
    title: 'Hábitos', crumb: 'Productividad',
    render() {
      const d = store.data, T = U.today();
      const stats = d.habits.map((h) => ({ h, s: L.habitStats(h, d.habit_logs, T) }));
      const doneToday = stats.filter((x) => x.s.doneToday).length;
      const avg = stats.length ? U.sum(stats, (x) => x.s.rate) / stats.length : 0;
      const top = stats.slice().sort((a, b) => b.s.current - a.s.current)[0];
      return `
      <div class="page-head">
        <div><h1 class="page-title">Hábitos</h1><div class="page-sub">La consistencia se construye un día a la vez.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-habit">${icon('plus')}Nuevo hábito</button></div>
      </div>
      <div class="grid cols-3">
        ${ui.stat({ label: 'Hoy', iconName: 'check', value: `${doneToday}<span class="muted" style="font-size:16px"> / ${stats.length}</span>`, meta: stats.length ? `<div style="flex:1">${ui.progress(U.pct(doneToday, stats.length))}</div>` : '' })}
        ${ui.stat({ label: 'Cumplimiento medio', iconName: 'activity', value: U.fmtPct(avg), meta: 'Últimos 30 días' })}
        ${ui.stat({ label: 'Mejor racha activa', iconName: 'flame', value: top ? `${top.s.current} días` : '—', meta: top ? esc(top.h.name) : '' })}
      </div>
      ${stats.length ? `<div class="grid cols-2 mt-16">${d.habits.map((h) => habitCard(h, T)).join('')}</div>`
        : `<div class="card mt-16">${ui.empty({ iconName: 'repeat', title: 'Sin hábitos todavía', text: 'Crea hábitos como gimnasio, leer, beber agua o crear contenido.', action: 'add-habit', actionLabel: 'Nuevo hábito' })}</div>`}`;
    },
  };

  DOS.globalActions = Object.assign(DOS.globalActions || {}, {
    'habit-toggle': (el) => {
      const id = el.dataset.id, date = el.dataset.value;
      const log = store.all('habit_logs').find((l) => l.habit_id === id && l.date === date);
      if (log) store.remove('habit_logs', log.id);
      else { store.insert('habit_logs', { habit_id: id, date }); if (date === U.today()) ui.toast('Hábito completado 🔥'); }
      return false;
    },
  });

  /* ======================= OBJETIVOS ======================= */
  const goalState = { cat: 'all' };
  const fmtGoal = (goal, v) => goal.unit === 'money' ? ui.money(v) : goal.unit === 'percent' ? U.fmtPct(v) : U.fmtNum(v, 1);

  function goalCard(g, T) {
    const p = F.goalProgress(g, store.data, T);
    const daysLeft = g.target_date ? U.daysBetween(T, g.target_date) : null;
    const complete = p.progress >= 100;
    return `<div class="card goal-card card-hover">
      <div class="row between">
        <div class="row" style="gap:6px"><span class="tag">${esc(g.category)}</span>${g.source !== 'manual' ? '<span class="tag accent" title="Se actualiza solo con tus datos">Auto</span>' : ''}${ui.demoTag(g)}</div>
        ${ui.rowActions('edit', '', g.id).replace('data-action="edit"', 'data-action="edit" data-c="goals"')}
      </div>
      <div><div style="font-weight:600;font-size:15px;line-height:1.35">${esc(g.name)}</div>${g.description ? `<div class="muted" style="font-size:12.5px;margin-top:3px">${esc(g.description)}</div>` : ''}</div>
      <div class="row between" style="align-items:flex-end">
        <div class="goal-pct ${complete ? 'pos' : ''}">${U.fmtPct(p.progress)}</div>
        <div class="muted num" style="font-size:12.5px;text-align:right">${fmtGoal(g, p.current)} <span class="faint">de</span> ${fmtGoal(g, p.target)}</div>
      </div>
      ${ui.progress(p.progress, complete ? 'pos' : '')}
      <div class="row between" style="font-size:12px">
        <span class="${daysLeft !== null && daysLeft < 0 && !complete ? 'neg' : 'muted'}">${complete ? '✓ Logrado' : daysLeft === null ? 'Sin fecha' : daysLeft < 0 ? `Venció hace ${-daysLeft} días` : daysLeft === 0 ? 'Vence hoy' : `Quedan ${daysLeft} días`}</span>
        ${g.source === 'manual' ? `<button class="btn btn-ghost sm" data-action="goal-value" data-id="${g.id}">Actualizar</button>` : `<span class="faint">${esc(S.labelOf(S.goalSources, g.source).replace('Automático: ', ''))}</span>`}
      </div>
    </div>`;
  }

  DOS.views.goals = {
    title: 'Objetivos', crumb: 'Productividad',
    render() {
      const d = store.data, T = U.today();
      const all = d.goals.map((g) => ({ g, p: F.goalProgress(g, d, T) }));
      const done = all.filter((x) => x.p.progress >= 100).length;
      const avg = all.length ? U.sum(all, (x) => x.p.progress) / all.length : 0;
      const cats = S.goalCategories.filter((c) => goalState.cat === 'all' || c === goalState.cat);
      const sections = cats.map((c) => {
        const gs = d.goals.filter((g) => g.category === c);
        if (!gs.length) return '';
        return `<div class="group-label" style="padding:22px 0 10px"><span>${c}</span><span>${gs.length}</span></div><div class="grid cols-3">${gs.map((g) => goalCard(g, T)).join('')}</div>`;
      }).join('');
      return `
      <div class="page-head">
        <div><h1 class="page-title">Objetivos</h1><div class="page-sub">Metas medibles en finanzas, trabajo, fitness, vida personal y aprendizaje.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-goal">${icon('plus')}Nuevo objetivo</button></div>
      </div>
      <div class="grid cols-3">
        ${ui.stat({ label: 'Objetivos activos', iconName: 'target', value: String(all.length - done) })}
        ${ui.stat({ label: 'Logrados', iconName: 'check', value: `<span class="pos">${done}</span>` })}
        ${ui.stat({ label: 'Progreso medio', iconName: 'activity', value: U.fmtPct(avg), meta: `<div style="flex:1">${ui.progress(avg)}</div>` })}
      </div>
      <div class="chips mt-24">
        <button class="chip ${goalState.cat === 'all' ? 'active' : ''}" data-action="goal-cat" data-value="all">Todos <span class="count">${d.goals.length}</span></button>
        ${S.goalCategories.map((c) => `<button class="chip ${goalState.cat === c ? 'active' : ''}" data-action="goal-cat" data-value="${c}">${c} <span class="count">${d.goals.filter((g) => g.category === c).length}</span></button>`).join('')}
      </div>
      ${sections || `<div class="card mt-16">${ui.empty({ iconName: 'target', title: 'Sin objetivos aquí', text: 'Ej. “Devolver todo el capital pendiente” se actualiza solo con tus pagos.', action: 'add-goal', actionLabel: 'Nuevo objetivo' })}</div>`}`;
    },
    actions: {
      'goal-cat': (el) => { goalState.cat = el.dataset.value; },
      'goal-value': (el) => { DOS.forms.goalValue(store.get('goals', el.dataset.id)); return false; },
    },
  };

  /* ======================= INSIGHTS ======================= */
  const TONE = { positive: 'pos', negative: 'neg', warning: 'warn', neutral: 'accent' };

  DOS.views.insights = {
    title: 'Insights',
    line(i) {
      return `<a class="insight-line" href="${i.route}" style="align-items:flex-start">${icon(i.icon, TONE[i.tone])}<span><span style="font-weight:500">${esc(i.title)}</span><br><span class="muted" style="font-size:12px">${esc(i.detail)}</span></span></a>`;
    },
    render() {
      const d = store.data, T = U.today();
      const money = (n) => ui.money(n);
      const list = DOS.intelligence.insights(d, money, T);
      const notes = DOS.intelligence.notifications(d, money, T);
      const areas = [...new Set(list.map((i) => i.area))];
      return `
      <div class="page-head">
        <div><h1 class="page-title">Insights</h1><div class="page-sub">Conclusiones automáticas a partir de tus datos. Se calculan en tu navegador; nada sale de tu dispositivo.</div></div>
      </div>
      ${notes.length ? `<div class="card"><div class="card-head"><h3>Recordatorios activos</h3><span class="sub">${notes.length}</span></div>
        <div class="grid cols-2" style="gap:8px">${notes.map((n) => `<a class="notif" href="${n.route}"><div class="icon-tile ${TONE[n.tone]}">${icon(n.icon)}</div><div><div class="t">${esc(n.title)}</div><div class="d">${esc(n.detail)}</div></div></a>`).join('')}</div></div>` : ''}
      ${list.length ? areas.map((a) => `<div class="group-label" style="padding:22px 0 10px"><span>${esc(a)}</span></div>
        <div class="grid cols-2">${list.filter((i) => i.area === a).map((i) => `
          <a class="card card-hover insight-card" href="${i.route}"><div class="icon-tile ${TONE[i.tone]}">${icon(i.icon)}</div><div><div class="t">${esc(i.title)}</div><div class="d">${esc(i.detail)}</div></div></a>`).join('')}</div>`).join('')
        : `<div class="card mt-16">${ui.empty({ iconName: 'sparkles', title: 'Aún no hay suficientes datos', text: 'Registra ingresos, gastos, deudas y entrenamientos para ver conclusiones.' })}</div>`}`;
    },
  };
})(window);
