/* DANI OS — datos de demostración.
   TODAS las filas llevan is_demo: true → se eliminan desde Configuración sin tocar datos reales.
   Fechas relativas a hoy para que el sistema siempre se vea "vivo". Nombres 100% ficticios. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;

  function seed(store, ref = U.today()) {
    const rnd = U.seeded(20261004);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const money = (min, max) => U.round2(min + rnd() * (max - min));
    const d = (n) => U.addDays(ref, n);
    const demo = (rows) => rows.map((r) => ({ ...r, is_demo: true }));

    /* ---------- Ingresos ---------- */
    store.insertMany('income', demo([
      { date: d(-58), concept: 'Retainer mensual', source: 'MAGNA', category: 'MAGNA', amount: 1200, method: 'Transferencia', notes: '' },
      { date: d(-45), concept: 'Landing page cliente', source: 'Estudio Norte', category: 'Proyecto', amount: 800, method: 'Transferencia', notes: '' },
      { date: d(-38), concept: 'Venta guía digital', source: 'Tienda online', category: 'Venta', amount: 350, method: 'PayPal', notes: '' },
      { date: d(-28), concept: 'Retainer mensual', source: 'MAGNA', category: 'MAGNA', amount: 1200, method: 'Transferencia', notes: '' },
      { date: d(-20), concept: 'Sesión de contenido', source: 'Marca Aurora', category: 'Cliente', amount: 450, method: 'Transferencia', notes: '' },
      { date: d(-12), concept: 'Venta plantillas', source: 'Tienda online', category: 'Venta', amount: 220, method: 'PayPal', notes: '' },
      { date: d(-5), concept: 'Edición de reels', source: 'Marca Aurora', category: 'Cliente', amount: 650, method: 'Transferencia', notes: '' },
      { date: d(-2), concept: 'Retainer mensual', source: 'MAGNA', category: 'MAGNA', amount: 1200, method: 'Transferencia', notes: '' },
      { date: d(0), concept: 'Venta guía digital', source: 'Tienda online', category: 'Venta', amount: 150, method: 'Billetera digital', notes: '' },
    ]));

    /* ---------- Gastos ---------- */
    const expenses = [];
    for (let i = -45; i <= -1; i++) {
      const date = d(i);
      expenses.push({ date, time: `08:${U.pad(10 + Math.floor(rnd() * 40))}`, concept: pick(['Desayuno', 'Café y pan', 'Desayuno fuera']), category: 'Alimentación', amount: money(4, 9), method: pick(['Efectivo', 'Débito']), necessary: true, note: '' });
      if (rnd() < 0.7) expenses.push({ date, time: `1${Math.floor(rnd() * 2)}:${U.pad(Math.floor(rnd() * 59))}`, concept: pick(['Uber', 'Metro', 'Taxi']), category: 'Transporte', amount: money(3, 9), method: 'Billetera digital', necessary: true, note: '' });
      expenses.push({ date, time: `14:${U.pad(Math.floor(rnd() * 40))}`, concept: pick(['Almuerzo', 'Menú del día', 'Almuerzo con cliente']), category: 'Alimentación', amount: money(9, 18), method: 'Débito', necessary: true, note: '' });
      if (rnd() < 0.28) {
        const c = pick(['Entretenimiento', 'Compras', 'Tecnología', 'Salud', 'Educación']);
        const concepts = { Entretenimiento: ['Cine', 'Bar con amigos', 'Concierto'], Compras: ['Ropa', 'Zapatillas', 'Regalo'], Tecnología: ['Cable USB-C', 'App premium', 'Accesorio cámara'], Salud: ['Farmacia', 'Suplementos'], Educación: ['Curso online', 'Libro'] };
        expenses.push({ date, time: `1${7 + Math.floor(rnd() * 3)}:${U.pad(Math.floor(rnd() * 59))}`, concept: pick(concepts[c]), category: c, amount: money(12, 60), method: 'Crédito', necessary: c === 'Salud' || c === 'Educación', note: '' });
      }
      if (rnd() < 0.55) expenses.push({ date, time: `21:${U.pad(Math.floor(rnd() * 50))}`, concept: pick(['Cena', 'Delivery', 'Supermercado']), category: 'Alimentación', amount: money(8, 22), method: 'Débito', necessary: rnd() < 0.6, note: '' });
      const dayOfMonth = +date.slice(8, 10);
      if (dayOfMonth === 1) expenses.push({ date, time: '09:00', concept: 'Alquiler', category: 'Vivienda', amount: 450, method: 'Transferencia', necessary: true, note: '' });
      if (dayOfMonth === 2) expenses.push({ date, time: '07:30', concept: 'Membresía gimnasio', category: 'Gimnasio', amount: 35, method: 'Débito', necessary: true, note: '' });
      if (dayOfMonth === 5) expenses.push({ date, time: '10:00', concept: 'Suscripciones software', category: 'Trabajo', amount: 29, method: 'Crédito', necessary: true, note: '' });
    }
    // Hoy: la línea de tiempo del ejemplo
    expenses.push(
      { date: d(0), time: '08:30', concept: 'Desayuno', category: 'Alimentación', amount: 8, method: 'Efectivo', necessary: true, note: '' },
      { date: d(0), time: '11:20', concept: 'Transporte', category: 'Transporte', amount: 4, method: 'Billetera digital', necessary: true, note: '' },
      { date: d(0), time: '14:00', concept: 'Almuerzo', category: 'Alimentación', amount: 12, method: 'Débito', necessary: true, note: '' },
      { date: d(0), time: '18:30', concept: 'Gimnasio', category: 'Gimnasio', amount: 0, method: 'Débito', necessary: true, note: 'Incluido en la membresía' },
      { date: d(0), time: '21:00', concept: 'Cena', category: 'Alimentación', amount: 10, method: 'Débito', necessary: false, note: '' },
    );
    store.insertMany('expenses', demo(expenses));

    /* ---------- Movimientos de capital ---------- */
    store.insertMany('transactions', demo([
      { date: d(-75), type: 'ingreso', amount: 2500, concept: 'Saldo inicial', counterpart: 'Cuenta principal', status: 'completado', note: 'Capital con el que empieza la demo' },
      { date: d(-50), type: 'inversion', amount: 600, concept: 'Inventario tienda online', counterpart: 'Proveedor', status: 'completado', note: '' },
      { date: d(-15), type: 'retorno', amount: 750, principal: 400, concept: 'Retorno lote 1 de inventario', counterpart: 'Tienda online', status: 'completado', note: '' },
      { date: d(-25), type: 'prestamo', amount: 200, concept: 'Préstamo personal', counterpart: 'Mateo Díaz', status: 'completado', note: '' },
      { date: d(-8), type: 'devolucion', amount: 50, concept: 'Primer abono', counterpart: 'Mateo Díaz', status: 'completado', note: '' },
      { date: d(-6), type: 'transferencia', amount: 300, concept: 'Banco → billetera digital', counterpart: 'Cuentas propias', status: 'completado', note: '' },
      { date: d(10), type: 'egreso', amount: 180, concept: 'Renovación dominio + hosting', counterpart: 'Proveedor web', status: 'pendiente', note: 'Planificado' },
    ]));

    /* ---------- Deudas y pagos ---------- */
    const debts = store.insertMany('debts', demo([
      { name: 'Juan Pérez', original_amount: 1000, start_date: d(-90), due_date: d(60), next_payment_date: d(0), next_payment_amount: 200, received_into_capital: false, notes: 'Préstamo para equipo de grabación' },
      { name: 'Laura Gómez', original_amount: 2000, start_date: d(-120), due_date: d(150), next_payment_date: d(12), next_payment_amount: 250, received_into_capital: false, notes: '' },
      { name: 'Carlos Ruiz', original_amount: 800, start_date: d(-100), due_date: d(-1), next_payment_date: null, next_payment_amount: 0, received_into_capital: false, notes: 'Saldado' },
      { name: 'Andrés Torres', original_amount: 1200, start_date: d(-20), due_date: d(90), next_payment_date: d(20), next_payment_amount: 150, received_into_capital: false, notes: 'Capital para la tienda' },
    ]));
    const [juan, laura, carlos] = debts;
    store.insertMany('debt_payments', demo([
      { debt_id: juan.id, date: d(-40), amount: 250, method: 'Transferencia', note: '' },
      { debt_id: juan.id, date: d(-10), amount: 150, method: 'Transferencia', note: '' },
      { debt_id: laura.id, date: d(-60), amount: 300, method: 'Transferencia', note: '' },
      { debt_id: laura.id, date: d(-3), amount: 200, method: 'Transferencia', note: '' },
      { debt_id: carlos.id, date: d(-70), amount: 400, method: 'Efectivo', note: '' },
      { debt_id: carlos.id, date: d(-2), amount: 400, method: 'Transferencia', note: 'Último pago' },
    ]));

    /* ---------- Calendario ---------- */
    store.insertMany('events', demo([
      { title: 'Reunión semanal MAGNA', date: d(0), time: '10:00', duration: 60, category: 'Reunión', priority: 'alta', notes: '' },
      { title: 'Llamada con proveedor', date: d(0), time: '16:00', duration: 30, category: 'Trabajo', priority: 'media', notes: '' },
      { title: 'Grabación de contenido', date: d(1), time: '09:00', duration: 120, category: 'Proyecto', priority: 'alta', notes: 'Llevar luces' },
      { title: 'Pago tarjeta de crédito', date: d(2), time: '12:00', duration: 15, category: 'Pago', priority: 'alta', notes: '' },
      { title: 'Entrega landing Estudio Norte', date: d(4), time: '18:00', duration: 60, category: 'Proyecto', priority: 'alta', notes: '' },
      { title: 'Cena familiar', date: d(6), time: '20:30', duration: 120, category: 'Personal', priority: 'baja', notes: '' },
      { title: 'Revisión mensual de finanzas', date: d(9), time: '19:00', duration: 45, category: 'Recordatorio', priority: 'media', notes: '' },
      { title: 'Workshop de marca personal', date: d(-2), time: '17:00', duration: 90, category: 'Trabajo', priority: 'media', notes: '' },
      { title: 'Dentista', date: d(15), time: '11:30', duration: 45, category: 'Personal', priority: 'media', notes: '' },
    ]));

    /* ---------- Tareas ---------- */
    store.insertMany('tasks', demo([
      { title: 'Enviar propuesta a MAGNA', description: 'Incluir calendario de contenidos de noviembre', date: d(0), time: '11:00', priority: 'alta', category: 'MAGNA', status: 'en_progreso' },
      { title: 'Editar reel de la semana', description: '', date: d(0), time: '15:00', priority: 'media', category: 'Contenido', status: 'pendiente' },
      { title: 'Revisar gastos de la semana', description: '', date: d(0), time: '', priority: 'baja', category: 'Finanzas', status: 'completada', completed_at: new Date().toISOString() },
      { title: 'Responder correos de clientes', description: '', date: d(-1), time: '', priority: 'alta', category: 'Trabajo', status: 'pendiente' },
      { title: 'Preparar guion de YouTube', description: 'Tema: cómo organizo mi capital', date: d(1), time: '10:00', priority: 'media', category: 'Contenido', status: 'pendiente' },
      { title: 'Pagar internet', description: '', date: d(3), time: '', priority: 'alta', category: 'Finanzas', status: 'pendiente' },
      { title: 'Actualizar landing DANI BOSS', description: '', date: d(10), time: '', priority: 'media', category: 'Trabajo', status: 'pendiente' },
      { title: 'Leer “Psicología del dinero”', description: '', date: '', time: '', priority: 'baja', category: 'Estudio', status: 'pendiente' },
      { title: 'Emitir factura Marca Aurora', description: '', date: d(-2), time: '', priority: 'media', category: 'Finanzas', status: 'completada', completed_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    ]));

    /* ---------- Mi Día (hoy) ---------- */
    const now = U.toMin(U.nowTime());
    const blocks = [
      ['06:30', 30, 'Despertar + agua', 'media'], ['07:00', 90, 'Gimnasio', 'alta'], ['09:00', 210, 'Trabajo profundo', 'alta'],
      ['12:30', 60, 'Almuerzo', 'baja'], ['14:00', 180, 'Proyecto MAGNA', 'alta'], ['18:00', 60, 'Reunión de equipo', 'media'],
      ['21:00', 45, 'Lectura', 'baja'], ['22:30', 30, 'Dormir', 'media'],
    ];
    store.insertMany('day_blocks', demo(blocks.map(([time, duration, title, priority]) => {
      const start = U.toMin(time);
      const status = now >= start + duration ? 'completado' : now >= start ? 'en_progreso' : 'pendiente';
      return { date: ref, time, duration, title, priority, status };
    })));

    /* ---------- Hábitos ---------- */
    const habitDefs = [
      ['Gimnasio', '💪', 0.72], ['Leer', '📚', 0.6], ['Dormir temprano', '🌙', 0.42],
      ['Beber agua', '💧', 0.86], ['Crear contenido', '🎬', 0.55], ['Meditar', '🧘', 0.3],
    ];
    const habits = store.insertMany('habits', demo(habitDefs.map(([name, emoji]) => ({ name, emoji, start_date: d(-84), target_per_week: 7 }))));
    const logs = [];
    habits.forEach((h, idx) => {
      const p = habitDefs[idx][2];
      for (let i = -84; i <= 0; i++) {
        if (i === 0 && idx > 2) continue; // algunos hábitos aún sin marcar hoy
        if (rnd() < p) logs.push({ habit_id: h.id, date: d(i) });
      }
    });
    store.insertMany('habit_logs', demo(logs));

    /* ---------- Rutinas y ejercicios ---------- */
    const plan = [
      [1, 'Pecho + Tríceps', [['Press banca', 4, 8, 70, 120], ['Press inclinado mancuernas', 3, 10, 26, 90], ['Fondos', 3, 12, 0, 90], ['Extensión tríceps polea', 3, 12, 25, 60]]],
      [2, 'Espalda + Bíceps', [['Dominadas', 4, 8, 0, 120], ['Remo con barra', 4, 8, 60, 120], ['Jalón al pecho', 3, 10, 55, 90], ['Curl con barra', 3, 10, 30, 60]]],
      [3, 'Pierna', [['Sentadilla', 4, 6, 90, 150], ['Peso muerto rumano', 3, 8, 80, 120], ['Prensa', 3, 12, 160, 90], ['Elevación de talones', 4, 15, 60, 60]]],
      [4, 'Hombros', [['Press militar', 4, 8, 45, 120], ['Elevaciones laterales', 4, 12, 10, 60], ['Face pull', 3, 15, 20, 60], ['Encogimientos', 3, 12, 30, 60]]],
      [5, 'Full Body', [['Peso muerto', 3, 5, 110, 180], ['Press banca', 3, 8, 70, 120], ['Remo con mancuerna', 3, 10, 30, 90], ['Zancadas', 3, 10, 20, 90]]],
    ];
    const routineExercises = {};
    plan.forEach(([weekday, name, exs]) => {
      const r = store.insertMany('routines', demo([{ weekday, name, time: '07:00', notes: '' }]))[0];
      routineExercises[weekday] = { routine: r, list: exs };
      store.insertMany('exercises', demo(exs.map(([n, sets, reps, weight, rest], i) => ({ routine_id: r.id, order: i, name: n, sets, reps, weight, rest, notes: '' }))));
    });

    /* ---------- Entrenamientos registrados (progresión ligera) ---------- */
    const workouts = [];
    const span = 56;
    for (let i = -span; i <= -1; i++) {
      const date = d(i);
      const plan = routineExercises[U.isoWeekday(date)];
      if (!plan || rnd() > 0.82) continue;
      const progress = (i + span) / span; // 0 → 1
      workouts.push({
        date, routine_id: plan.routine.id, title: plan.routine.name, duration: 55 + Math.floor(rnd() * 30), notes: '',
        exercises: plan.list.map(([name, sets, reps, weight]) => ({
          name, sets, reps,
          weight: weight ? Math.round((weight * (0.88 + 0.12 * progress)) / 2.5) * 2.5 : 0,
        })),
      });
    }
    store.insertMany('workouts', demo(workouts));

    /* ---------- Objetivos ---------- */
    store.insertMany('goals', demo([
      { name: 'Devolver todo el capital pendiente', description: 'Quedar en cero con todas las personas', category: 'Finanzas', target_date: d(150), unit: 'money', target_value: 5000, current_value: 0, source: 'debts_returned' },
      { name: 'Fondo de emergencia', description: '3 meses de gastos fijos', category: 'Finanzas', target_date: d(120), unit: 'money', target_value: 5000, current_value: 3200, source: 'manual' },
      { name: 'Entrenar 16 veces este mes', description: '', category: 'Fitness', target_date: U.endOfMonth(ref), unit: 'number', target_value: 16, current_value: 0, source: 'workouts_month' },
      { name: 'Cerrar 3 clientes nuevos', description: 'Servicios de contenido', category: 'Trabajo', target_date: d(80), unit: 'number', target_value: 3, current_value: 1, source: 'manual' },
      { name: 'Leer 12 libros este año', description: '', category: 'Aprendizaje', target_date: U.endOfYear(ref), unit: 'number', target_value: 12, current_value: 7, source: 'manual' },
      { name: 'Lanzar la nueva web DANI BOSS', description: '', category: 'Personal', target_date: d(30), unit: 'percent', target_value: 100, current_value: 60, source: 'manual' },
    ]));

    store.updateUser({ demo_seeded: true });
  }

  DOS.demo = { seed };
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
