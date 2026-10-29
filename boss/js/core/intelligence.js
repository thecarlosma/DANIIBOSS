/* DANI OS — inteligencia: insights y recordatorios derivados de los datos.
   Puro: recibe data + función de formato de dinero. Nada sale del navegador. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;
  const F = DOS.finance;
  const L = DOS.life;

  const I = {
    /**
     * @returns {Array<{id, tone:'positive'|'negative'|'warning'|'neutral', icon, area, title, detail, route}>}
     */
    insights(data, money, ref = U.today()) {
      const out = [];
      const push = (x) => out.push(x);

      // 1. Gasto semanal vs semana anterior (mismo número de días transcurridos)
      const wFrom = U.startOfWeek(ref);
      const elapsed = U.daysBetween(wFrom, ref);
      const thisWeek = F.sumPeriod(data.expenses, wFrom, ref);
      const lastWeek = F.sumPeriod(data.expenses, U.addDays(wFrom, -7), U.addDays(wFrom, -7 + elapsed));
      const wChange = F.change(thisWeek, lastWeek);
      if (wChange !== null && Math.abs(wChange) >= 1) {
        const up = wChange > 0;
        push({
          id: 'week-spend', area: 'Gastos', icon: up ? 'trendUp' : 'trendDown', tone: up ? 'negative' : 'positive', route: '#/gastos',
          title: `Tus gastos ${up ? 'aumentaron' : 'disminuyeron'} ${Math.abs(wChange).toFixed(0)}% esta semana.`,
          detail: `${money(thisWeek)} frente a ${money(lastWeek)} en el mismo tramo de la semana pasada.`,
        });
      }

      // 2. Categoría principal del mes
      const m = U.periodRange('month', ref);
      const monthExp = F.inPeriod(data.expenses, m.from, m.to);
      const monthExpTotal = U.sum(monthExp, (e) => e.amount);
      const cats = F.categoryBreakdown(monthExp);
      if (cats[0]) {
        push({
          id: 'top-cat', area: 'Gastos', icon: 'pie', tone: 'neutral', route: '#/gastos',
          title: `Tu mayor categoría de gasto este mes es ${cats[0].key}.`,
          detail: `${money(cats[0].value)} · ${U.fmtPct(U.pct(cats[0].value, monthExpTotal))} del total del mes.`,
        });
      }

      // 3. Gastos innecesarios
      const unnecessary = U.sum(monthExp.filter((e) => e.necessary === false), (e) => e.amount);
      if (unnecessary > 0) {
        push({
          id: 'unnecessary', area: 'Gastos', icon: 'alert', tone: 'warning', route: '#/gastos',
          title: `Tus gastos innecesarios suman ${money(unnecessary)} este mes.`,
          detail: `Representan el ${U.fmtPct(U.pct(unnecessary, monthExpTotal))} de lo que has gastado.`,
        });
      }

      // 4. Balance del mes
      const monthInc = F.sumPeriod(data.income, m.from, m.to);
      if (monthInc > 0 || monthExpTotal > 0) {
        const net = U.round2(monthInc - monthExpTotal);
        push({
          id: 'month-net', area: 'Finanzas', icon: net >= 0 ? 'wallet' : 'alert', tone: net >= 0 ? 'positive' : 'negative', route: '#/ingresos',
          title: net >= 0 ? `Este mes llevas un balance positivo de ${money(net)}.` : `Este mes gastas ${money(-net)} más de lo que ingresas.`,
          detail: monthInc > 0 ? `Tasa de ahorro: ${U.fmtPct(U.pct(net, monthInc))} de tus ingresos.` : 'Aún no registras ingresos este mes.',
        });
      }

      // 5. Deudas
      const d = F.debtsOverview(data, ref);
      if (d.returnedThisMonth > 0) {
        push({
          id: 'debt-month', area: 'Deudas', icon: 'check', tone: 'positive', route: '#/deudas',
          title: `Este mes has devuelto ${money(d.returnedThisMonth)} de capital.`,
          detail: `${d.paymentsThisMonth.length} pago${d.paymentsThisMonth.length === 1 ? '' : 's'} registrado${d.paymentsThisMonth.length === 1 ? '' : 's'}.`,
        });
      }
      if (d.totalPending > 0) {
        push({
          id: 'debt-left', area: 'Deudas', icon: 'receipt', tone: 'warning', route: '#/deudas',
          title: `Te faltan ${money(d.totalPending)} para quedar al día con tus deudas.`,
          detail: `Llevas ${U.fmtPct(d.progress)} devuelto · ${d.pendingPeople} persona${d.pendingPeople === 1 ? '' : 's'} pendiente${d.pendingPeople === 1 ? '' : 's'}.`,
        });
      } else if (d.stats.length) {
        push({ id: 'debt-free', area: 'Deudas', icon: 'check', tone: 'positive', route: '#/deudas', title: 'Estás al día: no tienes capital pendiente de devolver.', detail: `${d.settledPeople} deuda${d.settledPeople === 1 ? '' : 's'} saldada${d.settledPeople === 1 ? '' : 's'}.` });
      }
      const overdue = d.stats.filter((s) => s.overdue);
      if (overdue.length) {
        push({
          id: 'debt-overdue', area: 'Deudas', icon: 'alert', tone: 'negative', route: '#/deudas',
          title: `${overdue.length} deuda${overdue.length === 1 ? '' : 's'} superó su fecha límite.`,
          detail: overdue.map((s) => s.debt.name).join(', '),
        });
      }

      // 6. Entrenamientos
      const w = L.workoutStats(data, ref);
      if (w.planned > 0) {
        push({
          id: 'workouts', area: 'Fitness', icon: 'dumbbell', tone: w.consistency >= 70 ? 'positive' : 'warning', route: '#/entrenamientos',
          title: `Has completado el ${U.fmtPct(w.consistency)} de tus entrenamientos este mes.`,
          detail: `${w.month} sesión${w.month === 1 ? '' : 'es'} de ${w.planned} planificada${w.planned === 1 ? '' : 's'} hasta hoy.`,
        });
      }

      // 7. Hábitos
      const hs = data.habits.map((h) => ({ h, s: L.habitStats(h, data.habit_logs, ref) }));
      if (hs.length) {
        const best = hs.slice().sort((a, b) => b.s.rate - a.s.rate)[0];
        const worst = hs.slice().sort((a, b) => a.s.rate - b.s.rate)[0];
        push({ id: 'habit-best', area: 'Hábitos', icon: 'flame', tone: 'positive', route: '#/habitos', title: `Tu hábito más constante es “${best.h.name}”.`, detail: `${U.fmtPct(best.s.rate)} de cumplimiento en 30 días · racha de ${best.s.current} día${best.s.current === 1 ? '' : 's'}.` });
        if (worst.h.id !== best.h.id && worst.s.rate < 50) {
          push({ id: 'habit-worst', area: 'Hábitos', icon: 'repeat', tone: 'warning', route: '#/habitos', title: `“${worst.h.name}” necesita atención.`, detail: `Solo ${U.fmtPct(worst.s.rate)} de cumplimiento en los últimos 30 días.` });
        }
      }

      // 8. Tareas
      const tb = L.taskBuckets(data.tasks, ref);
      const overdueTasks = tb.today.filter((t) => t.status !== 'completada' && t.date < ref);
      if (overdueTasks.length) {
        push({ id: 'tasks-overdue', area: 'Tareas', icon: 'clock', tone: 'warning', route: '#/tareas', title: `Tienes ${overdueTasks.length} tarea${overdueTasks.length === 1 ? '' : 's'} atrasada${overdueTasks.length === 1 ? '' : 's'}.`, detail: overdueTasks.slice(0, 3).map((t) => t.title).join(' · ') });
      }
      return out;
    },

    /** Recordatorios accionables para el centro de notificaciones. */
    notifications(data, money, ref = U.today(), now = U.nowTime()) {
      const out = [];
      const d = F.debtsOverview(data, ref);
      d.upcoming.forEach((s) => {
        if (s.nextDate === ref) out.push({ id: `pay-${s.debt.id}-${ref}`, icon: 'receipt', tone: 'warning', route: '#/deudas', title: 'Hoy tienes un pago pendiente.', detail: `${s.debt.name} · ${money(s.nextAmount)}` });
        else if (s.nextDate < ref) out.push({ id: `late-${s.debt.id}-${s.nextDate}`, icon: 'alert', tone: 'negative', route: '#/deudas', title: `Pago atrasado a ${s.debt.name}.`, detail: `Programado el ${U.fmtDate(s.nextDate)} · ${money(s.nextAmount)}` });
      });

      F.subscriptionsOverview(data, ref).attention.forEach((st) => {
        const x = st.sub;
        if (st.overdue) out.push({ id: `sub-late-${x.id}-${x.next_date}`, icon: 'card', tone: 'negative', route: '#/suscripciones', title: `${x.name}: cobro atrasado.`, detail: `Era el ${U.fmtDate(x.next_date)} · ${money(x.amount)}` });
        else if (st.dueToday) out.push({ id: `sub-today-${x.id}-${x.next_date}`, icon: 'card', tone: 'warning', route: '#/suscripciones', title: `Hoy se cobra ${x.name}.`, detail: `${money(x.amount)} · ${x.method || ''}` });
        else if (st.dueSoon) out.push({ id: `sub-soon-${x.id}-${x.next_date}`, icon: 'card', tone: 'neutral', route: '#/suscripciones', title: `${x.name} se cobra en ${st.daysLeft} día${st.daysLeft === 1 ? '' : 's'}.`, detail: `${U.fmtDate(x.next_date)} · ${money(x.amount)}` });
        if (st.ending) out.push({ id: `sub-end-${x.id}-${x.end_date}`, icon: 'alert', tone: 'warning', route: '#/suscripciones', title: `${x.name} vence ${st.endsIn === 0 ? 'hoy' : `en ${st.endsIn} día${st.endsIn === 1 ? '' : 's'}`}.`, detail: `Fecha: ${U.fmtDate(x.end_date)}. Renueva o cancela a tiempo.` });
      });

      const tr = L.nextTraining(data, ref);
      if (tr && tr.date === ref && tr.routine.time) {
        const diff = U.toMin(tr.routine.time) - U.toMin(now);
        if (diff > 0 && diff <= 30) out.push({ id: `train-soon-${ref}`, icon: 'dumbbell', tone: 'positive', route: '#/entrenamientos', title: `Tu entrenamiento empieza en ${diff} minutos.`, detail: tr.routine.name });
        else if (diff > 30) out.push({ id: `train-${ref}`, icon: 'dumbbell', tone: 'neutral', route: '#/entrenamientos', title: `Hoy entrenas a las ${tr.routine.time}.`, detail: tr.routine.name });
      }

      L.eventsOn(data, ref).forEach((e) => {
        const diff = U.toMin(e.time) - U.toMin(now);
        if (e.time && diff > 0 && diff <= 60) out.push({ id: `evt-${e.id}`, icon: 'calendar', tone: 'neutral', route: '#/calendario', title: `${e.title} en ${diff} min.`, detail: `${e.time} · ${e.category}` });
      });

      const day = F.dayAnalysis(data, ref);
      if (day.avg > 0 && day.total > day.avg) out.push({ id: `spend-${ref}`, icon: 'trendUp', tone: 'negative', route: '#/gastos', title: 'Has gastado más de tu promedio diario.', detail: `${money(day.total)} hoy · promedio ${money(day.avg)}` });

      if (d.totalPending > 0) out.push({ id: `owed-${ref}`, icon: 'wallet', tone: 'neutral', route: '#/deudas', title: `Tienes ${money(d.totalPending)} pendientes de devolver.`, detail: `${d.pendingPeople} persona${d.pendingPeople === 1 ? '' : 's'} pendiente${d.pendingPeople === 1 ? '' : 's'}.` });

      const important = L.taskBuckets(data.tasks, ref).today.filter((t) => t.status !== 'completada' && t.priority === 'alta');
      if (important.length) out.push({ id: `tasks-${ref}-${important.length}`, icon: 'checkSquare', tone: 'warning', route: '#/tareas', title: `Hoy tienes ${important.length} tarea${important.length === 1 ? '' : 's'} importante${important.length === 1 ? '' : 's'}.`, detail: important.slice(0, 2).map((t) => t.title).join(' · ') });
      return out;
    },
  };

  DOS.intelligence = I;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
