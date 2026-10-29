/* DANI OS — Finanzas: Ingresos, Gastos, Capital, Deudas. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  const PERIODS = [
    { value: 'day', label: 'Día' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' }, { value: 'all', label: 'Todo' },
  ];

  function periodLabel(period, ref) {
    const r = U.periodRange(period, ref);
    if (period === 'day') return `${U.relDay(ref)} · ${U.fmtDate(ref)}`;
    if (period === 'week') return `${U.fmtDate(r.from)} – ${U.fmtDate(r.to)}`;
    if (period === 'month') return U.fmtMonth(ref);
    if (period === 'year') return ref.slice(0, 4);
    return 'Todo el historial';
  }
  function periodToolbar(prefix, st, extra = '') {
    return `<div class="toolbar">
      ${ui.segmented(`${prefix}-period`, PERIODS, st.period)}
      ${st.period !== 'all' ? `<div class="date-nav">
        <button class="icon-btn" data-action="${prefix}-shift" data-value="-1" aria-label="Anterior">${icon('chevL')}</button>
        <span class="lbl">${esc(periodLabel(st.period, st.ref))}</span>
        <button class="icon-btn" data-action="${prefix}-shift" data-value="1" aria-label="Siguiente">${icon('chevR')}</button>
        ${st.ref !== U.today() ? `<button class="btn btn-ghost sm" data-action="${prefix}-today">Hoy</button>` : ''}
      </div>` : ''}
      <span class="topbar-spacer"></span>
      ${extra}
    </div>`;
  }
  function periodActions(prefix, st) {
    return {
      [`${prefix}-period`]: (el) => { st.period = el.dataset.value; },
      [`${prefix}-shift`]: (el) => { st.ref = U.shiftPeriod(st.period, st.ref, +el.dataset.value); },
      [`${prefix}-today`]: () => { st.ref = U.today(); },
    };
  }
  /** Lista agrupada por fecha con subtotal diario */
  function groupedByDate(rows, itemFn, { dayAction = '' } = {}) {
    const groups = U.groupBy(rows.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))), (r) => r.date);
    return [...groups.entries()].map(([date, items]) => `
      <div class="group-label">${dayAction ? `<a href="#" data-action="${dayAction}" data-value="${date}" class="link-plain">${U.relDay(date)} · ${U.fmtDate(date)} →</a>` : `<span>${U.relDay(date)} · ${U.fmtDate(date)}</span>`}<span class="num">${ui.money(U.sum(items, (x) => x.amount))}</span></div>
      <div class="list">${items.map(itemFn).join('')}</div>`).join('');
  }

  /* ======================= INGRESOS ======================= */
  const incomeState = { period: 'month', ref: U.today(), category: '' };
  const incomeItem = (r) => `
    <div class="list-item clickable" data-action="edit" data-c="income" data-id="${r.id}">
      <div class="icon-tile pos">${icon('income')}</div>
      <div class="grow"><div class="title">${esc(r.concept)} ${ui.demoTag(r)}</div>
      <div class="meta">${[r.source, r.category, r.method].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="amount pos">${ui.money(r.amount, { signed: true })}</div>
    </div>`;

  DOS.views.income = {
    title: 'Ingresos', crumb: 'Finanzas',
    render() {
      const st = incomeState, d = store.data, T = U.today();
      const r = U.periodRange(st.period, st.ref);
      const rows = F.inPeriod(d.income, r.from, r.to).filter((x) => !st.category || x.category === st.category);
      const total = U.sum(rows, (x) => x.amount);
      const w = U.periodRange('week', T), m = U.periodRange('month', T);
      const byCat = F.categoryBreakdown(rows).map((c) => ({ ...c, color: S.colorFor(S.incomeCategories, c.key) }));
      const bySource = U.groupSum(rows, (x) => x.source || 'Sin fuente', (x) => x.amount).slice(0, 5);
      return `
      <div class="page-head">
        <div><h1 class="page-title">Ingresos</h1><div class="page-sub">Dinero que entra por tu actividad. Se suma automáticamente a tu capital disponible.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-income">${icon('plus')}Nuevo ingreso</button></div>
      </div>
      <div class="grid cols-4">
        ${ui.stat({ label: 'Total de ingresos', value: ui.money(U.sum(d.income, (x) => x.amount)), meta: `${d.income.length} registros` })}
        ${ui.stat({ label: 'Hoy', value: ui.money(F.sumPeriod(d.income, T, T)) })}
        ${ui.stat({ label: 'Esta semana', value: ui.money(F.sumPeriod(d.income, w.from, w.to)) })}
        ${ui.stat({ label: 'Este mes', value: ui.money(F.sumPeriod(d.income, m.from, m.to)) })}
      </div>
      <div class="mt-24">${periodToolbar('inc', st, `<select class="select" data-change="inc-category" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>${S.incomeCategories.map((c) => `<option ${c === st.category ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}</div>
      <div class="split">
        <div class="card">${rows.length ? groupedByDate(rows, incomeItem) : ui.empty({ iconName: 'income', title: 'Sin ingresos en este periodo', text: 'Cambia el filtro o registra un ingreso.', action: 'add-income', actionLabel: 'Nuevo ingreso' })}</div>
        <div class="stack">
          <div class="card"><div class="stat-label">Total del periodo</div><div class="stat-value lg pos">${ui.money(total)}</div><div class="stat-meta">${rows.length} ingreso${rows.length === 1 ? '' : 's'} · ${esc(periodLabel(st.period, st.ref))}</div></div>
          <div class="card"><div class="card-head"><h3>Por categoría</h3></div>${byCat.length ? ui.donut(byCat, { centerLabel: 'Periodo' }) : '<p class="muted" style="margin:0">Sin datos.</p>'}</div>
          <div class="card"><div class="card-head"><h3>Principales fuentes</h3></div>${bySource.length ? ui.hbars(bySource) : '<p class="muted" style="margin:0">Sin datos.</p>'}</div>
        </div>
      </div>`;
    },
    actions: { ...periodActions('inc', incomeState) },
    changes: { 'inc-category': (el) => { incomeState.category = el.value; } },
  };

  /* ======================= GASTOS ======================= */
  const expState = { mode: 'day', date: U.today(), period: 'month', ref: U.today(), category: '', necessity: '' };
  const expenseItem = (r) => `
    <div class="list-item clickable" data-action="edit" data-c="expenses" data-id="${r.id}">
      <div class="icon-tile" style="color:${S.colorFor(S.expenseCategories, r.category)}">${icon('expense')}</div>
      <div class="grow"><div class="title">${esc(r.concept)} ${ui.demoTag(r)} ${r.necessary === false ? '<span class="tag warn">No necesario</span>' : ''}</div>
      <div class="meta">${[r.time, r.category, r.method].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="amount">${ui.money(-r.amount)}</div>
    </div>`;

  function expenseDay(st) {
    const d = store.data, T = U.today();
    const a = F.dayAnalysis(d, st.date);
    const isToday = st.date === T;
    const last14From = U.addDays(st.date > T ? T : st.date, -13);
    const series = F.dailySeries(d.expenses, last14From, U.addDays(last14From, 13));
    const hl = series.findIndex((p) => p.date === st.date);
    const cats = a.byCategory.map((c) => ({ ...c, color: S.colorFor(S.expenseCategories, c.key) }));
    const vs = a.vsAvgPct;
    return `
      <div class="toolbar">
        <div class="date-nav">
          <button class="icon-btn" data-action="exp-day" data-value="-1" aria-label="Día anterior">${icon('chevL')}</button>
          <span class="lbl">${esc(U.relDay(st.date))} · ${esc(U.fmtDate(st.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
          <button class="icon-btn" data-action="exp-day" data-value="1" aria-label="Día siguiente">${icon('chevR')}</button>
        </div>
        <input type="date" class="input" style="width:auto;height:34px" value="${st.date}" data-change="exp-date" aria-label="Elegir día">
        ${!isToday ? '<button class="btn btn-ghost sm" data-action="exp-goto-today">Hoy</button>' : ''}
      </div>
      <div class="split">
        <div class="card">
          <div class="card-head"><h3>¿En qué gasté mi dinero ${isToday ? 'hoy' : 'este día'}?</h3><button class="btn btn-secondary sm" data-action="add-expense-on" data-value="${st.date}">${icon('plus')}Añadir</button></div>
          ${a.items.length ? `<div class="timeline">${a.items.map((e) => `
            <div class="tl-item">
              <div class="tl-time">${esc(e.time || '—')}</div>
              <div class="tl-rail"><span class="tl-dot" style="border-color:${S.colorFor(S.expenseCategories, e.category)}"></span></div>
              <div class="tl-body" data-action="edit" data-c="expenses" data-id="${e.id}">
                <div class="title">${esc(e.concept)} ${ui.demoTag(e)} ${e.necessary === false ? '<span class="tag warn">No necesario</span>' : ''}</div>
                <div class="meta">${esc(e.category)} · ${esc(e.method || '')}${e.note ? ' · ' + esc(e.note) : ''}</div>
              </div>
              <div class="tl-amount">${ui.money(e.amount)}</div>
            </div>`).join('')}</div>
            <div class="tl-total"><span class="lbl">Total gastado ${isToday ? 'hoy' : 'este día'}</span><span class="val num">${ui.money(a.total)}</span></div>`
          : ui.empty({ iconName: 'wallet', title: 'Sin gastos registrados', text: isToday ? 'Hoy no has gastado nada todavía.' : 'No hay gastos este día.', action: 'add-expense-on', actionLabel: 'Registrar gasto' }).replace('data-action="add-expense-on"', `data-action="add-expense-on" data-value="${st.date}"`)}
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Indicadores</h3></div>
            <div class="stack" style="gap:8px">
              ${vs === null ? `<div class="insight-line">${icon('info')}<span>Aún no hay suficiente historial para calcular tu promedio diario.</span></div>`
              : `<div class="insight-line">${icon(vs > 0 ? 'trendUp' : 'trendDown', vs > 0 ? 'neg' : 'pos')}<span>Gastaste <strong>${Math.abs(vs).toFixed(0)}% ${vs > 0 ? 'más' : 'menos'}</strong> que tu promedio diario (${ui.money(a.avg)}).</span></div>`}
              ${a.topCategory ? `<div class="insight-line">${icon('pie', 'accent')}<span>Tu categoría con mayor gasto ${isToday ? 'hoy' : 'ese día'} fue <strong>${esc(a.topCategory.key)}</strong> (${ui.money(a.topCategory.value)}).</span></div>` : ''}
              ${a.unnecessary > 0 ? `<div class="insight-line">${icon('alert', 'warn')}<span>${ui.money(a.unnecessary)} en gastos no necesarios.</span></div>` : ''}
            </div>
          </div>
          ${cats.length ? `<div class="card"><div class="card-head"><h3>Por categoría</h3></div>${ui.hbars(cats)}</div>` : ''}
          <div class="card">
            <div class="card-head"><h3>Últimos 14 días</h3><span class="sub">Toca una barra para ver el día</span></div>
            ${ui.chart({ type: 'bars', height: 150, barMax: 18, action: 'exp-pick-day', highlight: hl >= 0 ? hl : undefined, label: 'Gasto diario últimos 14 días', series: [{ name: 'Gasto', color: '#8654D6' }], data: series.map((p) => ({ key: p.date, label: U.fmtDate(p.date, { day: 'numeric' }), title: U.fmtDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' }), values: [p.value] })) })}
          </div>
        </div>
      </div>`;
  }

  function expenseHistory(st) {
    const d = store.data, T = U.today();
    const r = U.periodRange(st.period, st.ref);
    const rows = F.inPeriod(d.expenses, r.from, r.to)
      .filter((x) => !st.category || x.category === st.category)
      .filter((x) => !st.necessity || (st.necessity === 'yes' ? x.necessary !== false : x.necessary === false));
    const total = U.sum(rows, (x) => x.amount);
    const cats = F.categoryBreakdown(rows).map((c) => ({ ...c, color: S.colorFor(S.expenseCategories, c.key) }));
    const unnecessary = U.sum(rows.filter((x) => x.necessary === false), (x) => x.amount);
    const w = U.periodRange('week', T), m = U.periodRange('month', T);
    return `
      <div class="grid cols-4">
        ${ui.stat({ label: 'Hoy', value: ui.money(F.sumPeriod(d.expenses, T, T)) })}
        ${ui.stat({ label: 'Esta semana', value: ui.money(F.sumPeriod(d.expenses, w.from, w.to)) })}
        ${ui.stat({ label: 'Este mes', value: ui.money(F.sumPeriod(d.expenses, m.from, m.to)) })}
        ${ui.stat({ label: 'Promedio diario', value: ui.money(F.avgDailySpend(d, T)), meta: 'Últimos 30 días' })}
      </div>
      <div class="mt-24">${periodToolbar('exp', st, `
        <select class="select" data-change="exp-category" aria-label="Categoría"><option value="">Todas las categorías</option>${S.expenseCategories.map((c) => `<option ${c === st.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <select class="select" data-change="exp-necessity" aria-label="Necesidad"><option value="">Todos</option><option value="yes" ${st.necessity === 'yes' ? 'selected' : ''}>Necesarios</option><option value="no" ${st.necessity === 'no' ? 'selected' : ''}>No necesarios</option></select>`)}</div>
      <div class="split">
        <div class="card">${rows.length ? groupedByDate(rows, expenseItem, { dayAction: 'exp-pick-day' }) : ui.empty({ iconName: 'expense', title: 'Sin gastos en este periodo', action: 'add-expense', actionLabel: 'Nuevo gasto' })}</div>
        <div class="stack">
          <div class="card"><div class="stat-label">Total del periodo</div><div class="stat-value lg">${ui.money(total)}</div>
            <div class="stat-meta">${rows.length} gasto${rows.length === 1 ? '' : 's'}${unnecessary > 0 ? ` · <span class="warn">${ui.money(unnecessary)} no necesarios (${U.fmtPct(U.pct(unnecessary, total))})</span>` : ''}</div></div>
          <div class="card"><div class="card-head"><h3>Por categoría</h3></div>${cats.length ? ui.donut(cats, { centerLabel: 'Periodo' }) : '<p class="muted" style="margin:0">Sin datos.</p>'}</div>
        </div>
      </div>`;
  }

  DOS.views.expenses = {
    title: 'Gastos', crumb: 'Finanzas',
    render(params) {
      if (params.d) { expState.mode = 'day'; expState.date = params.d; }
      return `
      <div class="page-head">
        <div><h1 class="page-title">Gastos</h1><div class="page-sub">Cada gasto se descuenta automáticamente de tu capital disponible.</div></div>
        <div class="page-actions">
          ${ui.segmented('exp-mode', [{ value: 'day', label: 'Por día' }, { value: 'history', label: 'Historial' }], expState.mode)}
          <button class="btn btn-primary" data-action="add-expense">${icon('plus')}Nuevo gasto</button>
        </div>
      </div>
      ${expState.mode === 'day' ? expenseDay(expState) : expenseHistory(expState)}`;
    },
    actions: {
      ...periodActions('exp', expState),
      'exp-mode': (el) => { expState.mode = el.dataset.value; },
      'exp-day': (el) => { expState.date = U.addDays(expState.date, +el.dataset.value); },
      'exp-goto-today': () => { expState.date = U.today(); },
      'exp-pick-day': (el, e) => { e.preventDefault(); expState.mode = 'day'; expState.date = el.dataset.value; DOS.app.scrollTop(); },
      'add-expense-on': (el) => { DOS.forms.expense(null, { date: el.dataset.value || expState.date, time: el.dataset.value === U.today() ? U.nowTime() : '12:00' }); return false; },
    },
    changes: {
      'exp-date': (el) => { if (el.value) expState.date = el.value; },
      'exp-category': (el) => { expState.category = el.value; },
      'exp-necessity': (el) => { expState.necessity = el.value; },
    },
  };

  /* ======================= CAPITAL ======================= */
  const capState = { type: '' };
  const typeMeta = {
    ingreso: ['income', 'pos'], egreso: ['expense', 'neg'], inversion: ['layers', 'accent'], retorno: ['trendUp', 'pos'],
    prestamo: ['user', 'warn'], devolucion: ['check', 'pos'], transferencia: ['refresh', ''],
  };

  DOS.views.capital = {
    title: 'Capital', crumb: 'Finanzas',
    render() {
      const d = store.data, T = U.today();
      const c = F.capitalOverview(d, T);
      const series = F.capitalSeries(d, U.addDays(T, -89), T).map((p) => ({ label: U.fmtDate(p.date), value: p.value }));
      const rows = d.transactions.filter((t) => !capState.type || t.type === capState.type).sort((a, b) => b.date.localeCompare(a.date));
      const counts = U.groupBy(d.transactions, (t) => t.type);
      const sign = (t) => { const e = F.transactionEffect(t); return t.status !== 'completado' ? 0 : e.available; };
      return `
      <div class="page-head">
        <div><h1 class="page-title">Capital</h1><div class="page-sub">Lo que realmente tienes, separado de lo que entra (ingresos) y lo que sale (gastos).</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-transaction">${icon('plus')}Movimiento de capital</button></div>
      </div>
      <div class="grid cols-4">
        <div class="span-2">${ui.stat({ label: 'Capital actual', iconName: 'layers', hero: true, size: 'xl', value: ui.money(c.current), meta: `Disponible + invertido + por cobrar · Patrimonio neto <strong class="num" style="color:#fff">${ui.money(c.netWorth)}</strong>` })}</div>
        ${ui.stat({ label: 'Capital disponible', iconName: 'wallet', value: ui.money(c.available), meta: `Libre: ${ui.money(c.free)}` })}
        ${ui.stat({ label: 'Comprometido', iconName: 'clock', value: ui.money(c.committed), meta: `Deudas ${ui.money(c.committedDebts)} · Planificado ${ui.money(c.committedPlanned)}` })}
        ${ui.stat({ label: 'Invertido', iconName: 'trendUp', value: ui.money(c.invested) })}
        ${ui.stat({ label: 'Por cobrar', iconName: 'user', value: ui.money(c.receivable), meta: 'Préstamos que diste' })}
        ${ui.stat({ label: 'Por devolver', iconName: 'receipt', value: ui.money(c.owed), meta: '<a href="#/deudas" class="accent">Ver deudas →</a>' })}
        ${ui.stat({ label: 'Ganancias / pérdidas', iconName: 'activity', value: `<span class="pos">${ui.money(c.gains)}</span> <span class="faint" style="font-size:18px">/</span> <span class="neg">${ui.money(c.losses)}</span>`, size: 'md' })}
      </div>
      <div class="split mt-16">
        <div class="stack">
          <div class="card"><div class="card-head"><h3>Evolución del capital disponible</h3><span class="sub">90 días</span></div>
            ${ui.chart({ type: 'line', height: 220, data: series, label: 'Capital disponible 90 días' })}</div>
          <div class="card">
            <div class="card-head"><h3>Movimientos de capital</h3></div>
            <div class="chips" style="margin-bottom:12px">
              <button class="chip ${!capState.type ? 'active' : ''}" data-action="cap-type" data-value="">Todos <span class="count">${d.transactions.length}</span></button>
              ${S.transactionTypes.map((t) => `<button class="chip ${capState.type === t.value ? 'active' : ''}" data-action="cap-type" data-value="${t.value}">${t.short} <span class="count">${(counts.get(t.value) || []).length}</span></button>`).join('')}
            </div>
            <div class="list">${rows.length ? rows.map((t) => {
              const [ic, cls] = typeMeta[t.type] || ['info', ''];
              const delta = sign(t);
              const e = F.transactionEffect(t);
              return `<div class="list-item clickable" data-action="edit" data-c="transactions" data-id="${t.id}">
                <div class="icon-tile ${cls}">${icon(ic)}</div>
                <div class="grow"><div class="title">${esc(t.concept)} ${ui.demoTag(t)} ${t.status !== 'completado' ? `<span class="tag ${t.status === 'pendiente' ? 'warn' : ''}">${esc(S.labelOf(S.transactionStatuses, t.status).split(' ')[0])}</span>` : ''}</div>
                <div class="meta">${U.fmtDateFull(t.date)} · ${esc(S.transactionTypes.find((x) => x.value === t.type)?.short || t.type)}${t.counterpart ? ' · ' + esc(t.counterpart) : ''}${t.type === 'retorno' && e.result ? ` · <span class="${e.result > 0 ? 'pos' : 'neg'}">${e.result > 0 ? 'Ganancia' : 'Pérdida'} ${ui.money(Math.abs(e.result))}</span>` : ''}</div></div>
                <div class="amount ${delta > 0 ? 'pos' : delta < 0 ? '' : 'faint'}">${delta ? ui.money(delta, { signed: true }) : ui.money(t.amount)}</div>
              </div>`;
            }).join('') : ui.empty({ iconName: 'layers', title: 'Sin movimientos', text: 'Registra inversiones, retornos, préstamos que das o aportes de capital.', action: 'add-transaction', actionLabel: 'Nuevo movimiento' })}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Cómo se calcula tu disponible</h3></div>
            <div class="formula">
              <div class="fr"><span><span class="op"></span>Saldo inicial</span><span>${ui.money(c.opening)}</span></div>
              <div class="fr"><span><span class="op">+</span>Ingresos</span><span class="pos">${ui.money(c.incomeTotal)}</span></div>
              <div class="fr"><span><span class="op">−</span>Gastos</span><span>${ui.money(c.expenseTotal)}</span></div>
              ${c.debtsIn ? `<div class="fr"><span><span class="op">+</span>Préstamos recibidos</span><span>${ui.money(c.debtsIn)}</span></div>` : ''}
              <div class="fr"><span><span class="op">−</span>Pagos de deudas</span><span>${ui.money(c.debtPaid)}</span></div>
              <div class="fr"><span><span class="op">±</span>Movimientos de capital</span><span class="${c.movementsNet >= 0 ? 'pos' : ''}">${ui.money(c.movementsNet, { signed: true })}</span></div>
              <div class="fr total"><span>Capital disponible</span><span>${ui.money(c.available)}</span></div>
            </div>
            <p class="faint" style="font-size:12px;margin:12px 0 0">El saldo inicial se configura en <a href="#/ajustes" class="accent">Configuración</a>.</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>Capital libre</h3></div>
            <div class="stat-value lg ${c.free < 0 ? 'neg' : ''}">${ui.money(c.free)}</div>
            <div class="stat-meta">Disponible menos lo comprometido en los próximos 30 días.</div>
            <div class="mt-16">${ui.progress(c.available > 0 ? U.pct(Math.max(0, c.free), c.available) : 0)}</div>
          </div>
        </div>
      </div>`;
    },
    actions: { 'cap-type': (el) => { capState.type = el.dataset.value; } },
  };

  /* ======================= DEUDAS ======================= */
  const debtState = { filter: 'all' };

  function debtCard(s) {
    const st = S.debtStatuses[s.status];
    const d = s.debt;
    const T = U.today();
    return `<div class="card debt-card card-hover">
      <div class="debt-top">
        ${ui.avatar(d.name)}
        <div class="grow" style="min-width:0;flex:1">
          <div class="debt-name">${esc(d.name)} ${ui.demoTag(d)}</div>
          <div class="muted" style="font-size:12px">${st.emoji} ${st.label}${s.overdue ? ' · <span class="neg">Fecha límite superada</span>' : ''}</div>
        </div>
        ${ui.rowActions('edit', '', d.id).replace('data-action="edit"', 'data-action="edit" data-c="debts"')}
      </div>
      <div>
        <div class="row between" style="margin-bottom:8px"><span class="muted" style="font-size:12px">Progreso</span><span class="num" style="font-weight:600">${U.fmtPct(s.progress)}</span></div>
        ${ui.progress(s.progress, s.status === 'saldado' ? 'pos' : '')}
      </div>
      <div class="debt-nums">
        <div><div class="k">Original</div><div class="v">${ui.money(s.original)}</div></div>
        <div><div class="k">Devuelto</div><div class="v pos">${ui.money(s.returned)}</div></div>
        <div><div class="k">Pendiente</div><div class="v">${ui.money(s.pending)}</div></div>
      </div>
      <div class="debt-foot">
        <span>${s.lastPayment ? `Último pago ${U.fmtDate(s.lastPayment.date)}` : 'Sin pagos aún'}${s.nextDate ? ` · <span class="${s.nextDate < T ? 'neg' : s.nextDate === T ? 'warn' : ''}">Próximo ${U.relDay(s.nextDate, T).toLowerCase()} ${s.nextAmount ? ui.money(s.nextAmount) : ''}</span>` : ''}${d.due_date && s.status !== 'saldado' ? ` · Límite ${U.fmtDate(d.due_date)}` : ''}</span>
        <span class="row" style="gap:6px">
          <button class="btn btn-ghost sm" data-action="debt-detail" data-id="${d.id}">Historial</button>
          ${s.status !== 'saldado' ? `<button class="btn btn-secondary sm" data-action="pay-debt" data-id="${d.id}">${icon('plus')}Pago</button>` : ''}
        </span>
      </div>
    </div>`;
  }

  DOS.views.debts = {
    title: 'Deudas', crumb: 'Finanzas',
    render() {
      const d = store.data, T = U.today();
      const o = F.debtsOverview(d, T);
      const filters = [
        { value: 'all', label: 'Todas', n: o.stats.length },
        { value: 'pendiente', label: '🔴 Pendientes', n: o.stats.filter((s) => s.status === 'pendiente').length },
        { value: 'en_progreso', label: '🟡 En progreso', n: o.stats.filter((s) => s.status === 'en_progreso').length },
        { value: 'saldado', label: '🟢 Saldadas', n: o.settledPeople },
      ];
      const order = { pendiente: 0, en_progreso: 0, saldado: 1 };
      const list = o.stats.filter((s) => debtState.filter === 'all' || s.status === debtState.filter)
        .sort((a, b) => order[a.status] - order[b.status] || b.pending - a.pending);
      const nameOf = (id) => (store.get('debts', id) || {}).name || '—';
      return `
      <div class="page-head">
        <div><h1 class="page-title">Deudas</h1><div class="page-sub">Capital por devolver. Cada pago reduce el pendiente y tu capital disponible automáticamente.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-debt">${icon('plus')}Nueva deuda</button></div>
      </div>
      <div class="debt-hero">
        <div class="card stat-card hero">
          <div class="stat-label">${icon('receipt')}¿Cuánto debo actualmente?</div>
          <div class="stat-value xl">${ui.money(o.totalPending)}</div>
          <div class="stat-meta">${o.pendingPeople} persona${o.pendingPeople === 1 ? '' : 's'} pendiente${o.pendingPeople === 1 ? '' : 's'} · ${o.settledPeople} saldada${o.settledPeople === 1 ? '' : 's'}</div>
          <div class="mt-16">${ui.progress(o.progress, 'lg')}</div>
          <div class="kv">
            <div><div class="k">Total adeudado</div><div class="v">${ui.money(o.totalOriginal)}</div></div>
            <div><div class="k">Total devuelto</div><div class="v pos">${ui.money(o.totalReturned)}</div></div>
            <div><div class="k">Pendiente</div><div class="v">${ui.money(o.totalPending)}</div></div>
            <div><div class="k">% pagado</div><div class="v">${U.fmtPct(o.progress)}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="stat-label">${icon('check')}¿Cuánto he devuelto este mes?</div>
          <div class="stat-value lg pos">${ui.money(o.returnedThisMonth)}</div>
          <div class="list mt-8">${o.paymentsThisMonth.slice(0, 4).map((p) => `
            <div class="list-item clickable" data-action="debt-detail" data-id="${p.debt_id}"><div class="grow"><div class="title">${esc(nameOf(p.debt_id))}</div><div class="meta">${U.fmtDate(p.date)}</div></div><div class="amount pos">${ui.money(p.amount)}</div></div>`).join('') || '<p class="muted" style="margin:8px 0 0">Aún no has registrado pagos este mes.</p>'}</div>
          ${o.upcoming.length ? `<div class="group-label" style="padding-top:14px"><span>Próximos pagos</span></div>
            <div class="list">${o.upcoming.slice(0, 3).map((s) => `<div class="list-item clickable" data-action="pay-debt" data-id="${s.debt.id}"><div class="grow"><div class="title">${esc(s.debt.name)}</div><div class="meta ${s.nextDate < T ? 'neg' : ''}">${U.relDay(s.nextDate, T)}</div></div><div class="amount">${ui.money(s.nextAmount)}</div></div>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="chips mt-24" style="margin-bottom:14px">${filters.map((f) => `<button class="chip ${debtState.filter === f.value ? 'active' : ''}" data-action="debt-filter" data-value="${f.value}">${f.label} <span class="count">${f.n}</span></button>`).join('')}</div>
      ${list.length ? `<div class="debt-grid">${list.map(debtCard).join('')}</div>`
        : `<div class="card">${ui.empty({ iconName: 'receipt', title: o.stats.length ? 'Nada en este filtro' : 'Sin deudas registradas', text: o.stats.length ? '' : 'Registra a cada persona a la que debes devolver capital.', action: o.stats.length ? '' : 'add-debt', actionLabel: 'Nueva deuda' })}</div>`}`;
    },
    actions: { 'debt-filter': (el) => { debtState.filter = el.dataset.value; } },
  };

  /* ======================= SUSCRIPCIONES ======================= */
  const subState = { filter: 'activa' };
  const SUB_EXAMPLES = [
    { name: 'Claude', category: 'Tecnología' }, { name: 'ChatGPT', category: 'Tecnología' },
    { name: 'CapCut', category: 'Tecnología' }, { name: 'Gimnasio', category: 'Gimnasio' },
    { name: 'Netflix', category: 'Entretenimiento' }, { name: 'Spotify', category: 'Entretenimiento' },
  ];

  function subWhen(st, T) {
    const x = st.sub;
    if (!st.active) return `<span class="faint">${S.subscriptionStatuses[x.status || 'activa'].label}</span>`;
    if (st.overdue) return `<span class="neg">Atrasada · era el ${U.fmtDate(x.next_date)}</span>`;
    if (st.dueToday) return '<span class="warn">Se cobra hoy</span>';
    const rel = U.relDay(x.next_date, T);
    return `<span class="${st.dueSoon ? 'warn' : ''}">${st.daysLeft <= 7 ? rel : `En ${st.daysLeft} días`} · ${U.fmtDate(x.next_date)}</span>`;
  }

  function subCard(st) {
    const x = st.sub, T = U.today(), c = F.subCycle(x);
    const status = S.subscriptionStatuses[x.status || 'activa'];
    return `<div class="card sub-card card-hover ${st.active ? '' : 'inactive'} ${st.overdue ? 'is-late' : st.dueToday || st.dueSoon ? 'is-soon' : ''}">
      <div class="debt-top">
        ${ui.avatar(x.name)}
        <div style="min-width:0;flex:1">
          <div class="debt-name">${esc(x.name)} ${ui.demoTag(x)}</div>
          <div class="muted" style="font-size:12px">${esc(x.category || 'Otros')} · ${esc(x.method || '')}${st.active ? '' : ` · <span class="${status.cls}">${status.label}</span>`}</div>
        </div>
        ${ui.rowActions('edit', '', x.id).replace('data-action="edit"', 'data-action="edit" data-c="subscriptions"')}
      </div>
      <div class="sub-price"><span class="num">${ui.money(x.amount)}</span><span class="muted">/ ${c.per}</span></div>
      <div class="debt-nums">
        <div><div class="k">Próximo cobro</div><div class="v" style="font-size:13px">${subWhen(st, T)}</div></div>
        <div><div class="k">Al mes</div><div class="v">${ui.money(F.subMonthly(x))}</div></div>
        <div><div class="k">Al año</div><div class="v">${ui.money(F.subMonthly(x) * 12)}</div></div>
      </div>
      <div class="debt-foot">
        <span>${x.end_date ? `<span class="${st.ending ? 'warn' : st.ended ? 'neg' : ''}">${st.ended ? 'Terminó' : 'Vence'} ${U.fmtDate(x.end_date)}</span> · ` : ''}Aviso ${x.remind_days === 0 ? 'el mismo día' : `${x.remind_days === undefined ? 3 : x.remind_days} día${x.remind_days === 1 ? '' : 's'} antes`}</span>
        <span class="row" style="gap:6px">
          ${x.url ? `<a class="btn btn-ghost sm" href="${esc(x.url)}" target="_blank" rel="noopener">Gestionar</a>` : ''}
          ${st.active ? `<button class="btn btn-secondary sm" data-action="pay-sub" data-id="${x.id}">${icon('check')}Pagar</button>` : ''}
        </span>
      </div>
    </div>`;
  }

  DOS.views.subscriptions = {
    title: 'Suscripciones', crumb: 'Finanzas',
    render() {
      const T = U.today();
      const o = F.subscriptionsOverview(store.data, T);
      const count = (st) => o.stats.filter((s) => (s.sub.status || 'activa') === st).length;
      const filters = [
        { value: 'activa', label: 'Activas', n: count('activa') },
        { value: 'pausada', label: 'Pausadas', n: count('pausada') },
        { value: 'cancelada', label: 'Canceladas', n: count('cancelada') },
        { value: 'all', label: 'Todas', n: o.stats.length },
      ];
      const list = o.stats.filter((s) => subState.filter === 'all' || (s.sub.status || 'activa') === subState.filter)
        .sort((a, b) => (b.active - a.active) || (a.sub.next_date || '9').localeCompare(b.sub.next_date || '9'));
      const next = o.upcoming.slice(0, 5);
      const top = o.byCategory.slice(0, 3);
      return `
      <div class="page-head">
        <div><h1 class="page-title">Suscripciones</h1><div class="page-sub">Lo que pagas cada mes, cuándo se cobra y cuánto te cuesta al año. Te aviso antes de cada cobro.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="add-sub">${icon('plus')}Nueva suscripción</button></div>
      </div>
      ${o.stats.length ? `
      <div class="debt-hero">
        <div class="card stat-card hero">
          <div class="stat-label">${icon('repeat')}Pagas en suscripciones</div>
          <div class="stat-value xl">${ui.money(o.monthlyTotal)}<span class="sub-per">/ mes</span></div>
          <div class="stat-meta">${o.active.length} activa${o.active.length === 1 ? '' : 's'} · ${ui.money(o.yearlyTotal)} al año</div>
          <div class="kv">
            <div><div class="k">Pagado este mes</div><div class="v">${ui.money(o.paidThisMonth)}</div></div>
            <div><div class="k">Por cobrar este mes</div><div class="v">${ui.money(U.sum(o.upcoming.filter((s) => s.sub.next_date <= U.endOfMonth(T)), (s) => +s.sub.amount || 0))}</div></div>
            ${top.map((c) => `<div><div class="k">${esc(c.key)}</div><div class="v">${ui.money(c.value)}<span class="muted" style="font-size:11px;font-weight:400"> /mes</span></div></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="stat-label">${icon('calendar')}Próximos cobros</div>
          <div class="list mt-8">${next.map((st) => `
            <div class="list-item clickable" data-action="pay-sub" data-id="${st.sub.id}">
              <div class="grow"><div class="title">${esc(st.sub.name)}</div><div class="meta">${subWhen(st, T)}</div></div>
              <div class="amount">${ui.money(st.sub.amount)}</div>
            </div>`).join('') || '<p class="muted" style="margin:8px 0 0">No hay cobros próximos.</p>'}</div>
        </div>
      </div>
      <div class="chips mt-24" style="margin-bottom:14px">${filters.map((f) => `<button class="chip ${subState.filter === f.value ? 'active' : ''}" data-action="sub-filter" data-value="${f.value}">${f.label} <span class="count">${f.n}</span></button>`).join('')}</div>
      ${list.length ? `<div class="debt-grid">${list.map(subCard).join('')}</div>` : `<div class="card">${ui.empty({ iconName: 'repeat', title: 'Nada en este filtro' })}</div>`}`
      : `<div class="card">
          ${ui.empty({ iconName: 'repeat', title: 'Aún no tienes suscripciones', text: 'Agrega lo que pagas cada mes o cada año: te aviso antes de cada cobro y ves cuánto gastas en total.', action: 'add-sub', actionLabel: 'Nueva suscripción' })}
          <div class="chips" style="justify-content:center;margin-top:4px">${SUB_EXAMPLES.map((e) => `<button class="chip" data-action="add-sub-example" data-name="${esc(e.name)}" data-category="${esc(e.category)}">${icon('plus')}${esc(e.name)}</button>`).join('')}</div>
        </div>`}`;
    },
    actions: {
      'sub-filter': (el) => { subState.filter = el.dataset.value; },
      'add-sub-example': (el) => { DOS.forms.subscription(null, { name: el.dataset.name, category: el.dataset.category }); return false; },
    },
  };
})(window);
