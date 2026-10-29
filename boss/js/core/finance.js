/* DANI OS — motor financiero.
   Funciones PURAS: reciben `data` (colecciones) y devuelven resultados.
   Es la única fuente de verdad para cifras; ver ARQUITECTURA.md §2. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;

  const amt = (x) => +x.amount || 0;
  const isDone = (t) => (t.status || 'completado') === 'completado';
  const OUTFLOW_TYPES = ['egreso', 'inversion', 'prestamo'];

  const F = {
    /* ---------- Movimientos de capital ---------- */
    transactionEffect(t) {
      const a = amt(t);
      const e = { available: 0, invested: 0, receivable: 0, result: 0 };
      if (!isDone(t)) return e;
      switch (t.type) {
        case 'ingreso': e.available = a; break;
        case 'egreso': e.available = -a; break;
        case 'inversion': e.available = -a; e.invested = a; break;
        case 'retorno': {
          const principal = t.principal === '' || t.principal == null ? a : +t.principal;
          e.available = a; e.invested = -principal; e.result = U.round2(a - principal);
          break;
        }
        case 'prestamo': e.available = -a; e.receivable = a; break;
        case 'devolucion': e.available = a; e.receivable = -a; break;
        default: break; // transferencia: neutral
      }
      return e;
    },

    /** Lista de deltas {date, amount, source} que afectan al capital disponible. */
    availabilityDeltas(data) {
      const out = [];
      data.income.forEach((r) => out.push({ date: r.date, amount: amt(r), source: 'income' }));
      data.expenses.forEach((r) => out.push({ date: r.date, amount: -amt(r), source: 'expense' }));
      data.debts.forEach((d) => {
        if (d.received_into_capital) out.push({ date: d.start_date, amount: +d.original_amount || 0, source: 'debt_in' });
      });
      data.debt_payments.forEach((p) => out.push({ date: p.date, amount: -amt(p), source: 'debt_payment' }));
      data.transactions.forEach((t) => {
        const e = F.transactionEffect(t);
        if (e.available) out.push({ date: t.date, amount: e.available, source: 'transaction' });
      });
      return out;
    },

    /* ---------- Deudas ---------- */
    debtStats(debt, payments, ref = U.today()) {
      const ps = payments.filter((p) => p.debt_id === debt.id).sort((a, b) => (a.date + (a.created_at || '')).localeCompare(b.date + (b.created_at || '')));
      const original = U.round2(+debt.original_amount || 0);
      const returned = U.sum(ps, amt);
      const pending = U.round2(Math.max(0, original - returned));
      const progress = original > 0 ? U.clamp((returned / original) * 100, 0, 100) : 0;
      const status = original > 0 && pending <= 0 ? 'saldado' : returned > 0 ? 'en_progreso' : 'pendiente';
      const last = ps[ps.length - 1] || null;
      const nextAmount = status === 'saldado' ? 0 : Math.min(+debt.next_payment_amount || 0, pending);
      const nextDate = status === 'saldado' ? null : debt.next_payment_date || null;
      return {
        debt, payments: ps, original, returned, pending, progress, status,
        lastPayment: last,
        nextDate, nextAmount,
        overdue: status !== 'saldado' && !!debt.due_date && debt.due_date < ref,
        nextOverdue: !!nextDate && nextDate < ref,
      };
    },

    debtsOverview(data, ref = U.today()) {
      const stats = data.debts.map((d) => F.debtStats(d, data.debt_payments, ref));
      const month = U.periodRange('month', ref);
      const paymentsThisMonth = data.debt_payments.filter((p) => U.inRange(p.date, month.from, month.to));
      const totalOriginal = U.sum(stats, (s) => s.original);
      const totalReturned = U.sum(stats, (s) => s.returned);
      const totalPending = U.sum(stats, (s) => s.pending);
      return {
        stats,
        totalOriginal, totalReturned, totalPending,
        progress: U.pct(totalReturned, totalOriginal),
        pendingPeople: stats.filter((s) => s.status !== 'saldado').length,
        settledPeople: stats.filter((s) => s.status === 'saldado').length,
        returnedThisMonth: U.sum(paymentsThisMonth, amt),
        paymentsThisMonth: paymentsThisMonth.slice().sort((a, b) => b.date.localeCompare(a.date)),
        upcoming: stats.filter((s) => s.nextDate).sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
      };
    },

    /* ---------- Suscripciones ---------- */
    subCycle(sub) {
      return DOS.schema.subscriptionCycles.find((c) => c.value === sub.cycle) || DOS.schema.subscriptionCycles[0];
    },
    /** Siguiente cobro tras `from`, respetando el día del mes original (31 → 28/29/30 → 31). */
    subAdvance(sub, from = sub.next_date) {
      const c = F.subCycle(sub);
      if (c.days) return U.addDays(from, c.days);
      const next = U.addMonths(from, c.months);
      const day = +sub.anchor_day || +from.slice(8, 10);
      const last = +U.endOfMonth(next).slice(8, 10);
      return `${next.slice(0, 8)}${String(Math.min(day, last)).padStart(2, '0')}`;
    },
    /** Costo equivalente por mes. */
    subMonthly(sub) {
      const c = F.subCycle(sub);
      const a = +sub.amount || 0;
      return U.round2(c.days ? (a * 365) / 7 / 12 : a / c.months);
    },
    subStats(sub, ref = U.today()) {
      const remind = sub.remind_days === undefined || sub.remind_days === '' ? 3 : +sub.remind_days;
      const active = (sub.status || 'activa') === 'activa';
      const daysLeft = sub.next_date ? U.daysBetween(ref, sub.next_date) : null;
      const endsIn = sub.end_date ? U.daysBetween(ref, sub.end_date) : null;
      return {
        sub, active, remind, daysLeft, endsIn,
        monthly: active ? F.subMonthly(sub) : 0,
        overdue: active && daysLeft !== null && daysLeft < 0,
        dueToday: active && daysLeft === 0,
        dueSoon: active && daysLeft !== null && daysLeft > 0 && daysLeft <= Math.max(remind, 0),
        ending: active && endsIn !== null && endsIn >= 0 && endsIn <= 7,
        ended: endsIn !== null && endsIn < 0,
      };
    },
    subscriptionsOverview(data, ref = U.today()) {
      const stats = (data.subscriptions || []).map((x) => F.subStats(x, ref));
      const active = stats.filter((s) => s.active);
      const monthlyTotal = U.round2(U.sum(active, (s) => s.monthly));
      const month = U.periodRange('month', ref);
      const paidThisMonth = (data.expenses || []).filter((e) => e.subscription_id && U.inRange(e.date, month.from, month.to));
      return {
        stats, active,
        monthlyTotal,
        yearlyTotal: U.round2(monthlyTotal * 12),
        paidThisMonth: U.round2(U.sum(paidThisMonth, amt)),
        upcoming: active.filter((s) => s.sub.next_date).sort((a, b) => a.sub.next_date.localeCompare(b.sub.next_date)),
        attention: active.filter((s) => s.overdue || s.dueToday || s.dueSoon || s.ending),
        byCategory: U.groupSum(active, (s) => s.sub.category || 'Otros', (s) => s.monthly),
      };
    },

    /** Valida un pago antes de registrarlo. Devuelve string de error o null. */
    validateDebtPayment(stats, amount) {
      const a = +amount;
      if (!(a > 0)) return 'El pago debe ser mayor que 0.';
      if (stats.status === 'saldado') return 'Esta deuda ya está saldada.';
      if (U.round2(a) > stats.pending) return `El pago supera el capital pendiente (${stats.pending}).`;
      return null;
    },

    /* ---------- Capital ---------- */
    capitalOverview(data, ref = U.today()) {
      const user = data.users[0] || {};
      const opening = +user.opening_balance || 0;
      const incomeTotal = U.sum(data.income, amt);
      const expenseTotal = U.sum(data.expenses, amt);
      const debtsIn = U.sum(data.debts.filter((d) => d.received_into_capital), (d) => d.original_amount);
      const debtPaid = U.sum(data.debt_payments, amt);

      let mvAvailable = 0, invested = 0, receivable = 0, gains = 0, losses = 0;
      data.transactions.forEach((t) => {
        const e = F.transactionEffect(t);
        mvAvailable += e.available; invested += e.invested; receivable += e.receivable;
        if (e.result > 0) gains += e.result; else losses += -e.result;
      });

      const available = U.round2(opening + incomeTotal - expenseTotal + debtsIn - debtPaid + mvAvailable);
      const debts = F.debtsOverview(data, ref);

      const horizon = U.addDays(ref, 30);
      const committedDebts = U.sum(debts.upcoming.filter((s) => s.nextDate <= horizon), (s) => s.nextAmount);
      const committedPlanned = U.sum(data.transactions.filter((t) => t.status === 'pendiente' && OUTFLOW_TYPES.includes(t.type)), amt);
      const committed = U.round2(committedDebts + committedPlanned);

      invested = U.round2(Math.max(0, invested));
      receivable = U.round2(Math.max(0, receivable));
      const current = U.round2(available + invested + receivable);

      return {
        opening, incomeTotal, expenseTotal, debtsIn, debtPaid,
        movementsNet: U.round2(mvAvailable),
        available, committed, committedDebts, committedPlanned,
        free: U.round2(available - committed),
        invested, receivable,
        owed: debts.totalPending,
        gains: U.round2(gains), losses: U.round2(losses),
        current,
        netWorth: U.round2(current - debts.totalPending),
      };
    },

    /** Capital disponible al cierre de cada día [{date, value}] */
    capitalSeries(data, from, to) {
      const opening = +(data.users[0] || {}).opening_balance || 0;
      const deltas = F.availabilityDeltas(data).sort((a, b) => a.date.localeCompare(b.date));
      let i = 0, acc = opening;
      while (i < deltas.length && deltas[i].date < from) acc += deltas[i++].amount;
      return U.eachDay(from, to).map((d) => {
        while (i < deltas.length && deltas[i].date <= d) acc += deltas[i++].amount;
        return { date: d, value: U.round2(acc) };
      });
    },

    /* ---------- Ingresos y gastos ---------- */
    inPeriod(rows, from, to) {
      return rows.filter((r) => U.inRange(r.date, from, to));
    },
    sumPeriod(rows, from, to) {
      return U.sum(F.inPeriod(rows, from, to), amt);
    },
    expensesOn(data, date) {
      return data.expenses.filter((e) => e.date === date).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    },
    /** Promedio diario de gasto en los N días anteriores a `ref` (sin incluir ref). */
    avgDailySpend(data, ref = U.today(), days = 30) {
      const from = U.addDays(ref, -days), to = U.addDays(ref, -1);
      return U.round2(F.sumPeriod(data.expenses, from, to) / days);
    },
    dayAnalysis(data, date) {
      const items = F.expensesOn(data, date);
      const total = U.sum(items, amt);
      const avg = F.avgDailySpend(data, date);
      const byCat = U.groupSum(items, (e) => e.category, amt);
      const unnecessary = U.sum(items.filter((e) => e.necessary === false), amt);
      return {
        items, total, avg,
        vsAvgPct: avg > 0 ? ((total - avg) / avg) * 100 : null,
        topCategory: byCat[0] || null,
        byCategory: byCat,
        unnecessary,
      };
    },
    categoryBreakdown(rows) {
      return U.groupSum(rows, (r) => r.category || 'Otros', amt);
    },
    monthlySeries(data, months = 6, ref = U.today()) {
      const out = [];
      for (let i = months - 1; i >= 0; i--) {
        const m = U.addMonths(U.startOfMonth(ref), -i);
        const from = U.startOfMonth(m), to = U.endOfMonth(m);
        out.push({
          key: m,
          label: U.capitalize(U.fmtDate(m, { month: 'short' })),
          income: F.sumPeriod(data.income, from, to),
          expense: F.sumPeriod(data.expenses, from, to),
        });
      }
      return out;
    },
    dailySeries(rows, from, to) {
      const map = new Map();
      rows.forEach((r) => { if (U.inRange(r.date, from, to)) map.set(r.date, (map.get(r.date) || 0) + amt(r)); });
      return U.eachDay(from, to).map((d) => ({ date: d, value: U.round2(map.get(d) || 0) }));
    },
    /** Variación % entre dos cifras (null si no hay base). */
    change(current, previous) {
      if (!previous) return null;
      return ((current - previous) / previous) * 100;
    },

    /* ---------- Objetivos ---------- */
    goalProgress(goal, data, ref = U.today()) {
      let current = +goal.current_value || 0;
      let target = +goal.target_value || 0;
      if (goal.source === 'debts_returned') {
        const o = F.debtsOverview(data, ref);
        current = o.totalReturned;
        if (!target) target = o.totalOriginal;
      } else if (goal.source === 'capital_available') {
        current = F.capitalOverview(data, ref).available;
      } else if (goal.source === 'workouts_month') {
        const m = U.periodRange('month', ref);
        current = data.workouts.filter((w) => U.inRange(w.date, m.from, m.to)).length;
      }
      return { current: U.round2(current), target, progress: target > 0 ? U.clamp((current / target) * 100, 0, 100) : 0 };
    },
  };

  DOS.finance = F;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
