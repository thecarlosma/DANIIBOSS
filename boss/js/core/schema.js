/* DANI OS — definición de colecciones, enums y etiquetas.
   Mantener sincronizado con supabase/schema.sql. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});

  const C = {
    // Colores de categoría: desaturados para mantener la estética sobria
    palette: ['#8654D6', '#5B8DEF', '#3FB4A8', '#D9A441', '#D9667A', '#5CC98A', '#D9824A', '#4FB3D9', '#C46BB8', '#9BC45A', '#8A8A92'],
  };

  const S = {
    COLLECTIONS: [
      'users', 'income', 'expenses', 'transactions', 'debts', 'debt_payments',
      'events', 'tasks', 'day_blocks', 'habits', 'habit_logs',
      'routines', 'exercises', 'workouts', 'goals', 'subscriptions',
    ],

    defaultUser: {
      id: 'local',
      name: '',
      currency: 'USD',
      opening_balance: 0,
      privacy: false,
      seen_notifications: [],
      demo_seeded: false, // true tras la primera carga DEMO: nunca se vuelve a sembrar sola
    },

    currencies: [
      { value: 'USD', label: 'USD — Dólar' },
      { value: 'EUR', label: 'EUR — Euro' },
      { value: 'COP', label: 'COP — Peso colombiano' },
      { value: 'MXN', label: 'MXN — Peso mexicano' },
      { value: 'PEN', label: 'PEN — Sol peruano' },
      { value: 'ARS', label: 'ARS — Peso argentino' },
      { value: 'CLP', label: 'CLP — Peso chileno' },
    ],

    incomeCategories: ['Cliente', 'MAGNA', 'Proyecto', 'Venta', 'Inversión', 'Salario', 'Otro'],
    incomeMethods: ['Transferencia', 'Efectivo', 'Tarjeta', 'PayPal', 'Billetera digital', 'Otro'],

    expenseCategories: ['Alimentación', 'Transporte', 'Vivienda', 'Gimnasio', 'Entretenimiento', 'Trabajo', 'Tecnología', 'Compras', 'Salud', 'Educación', 'Otros'],
    expenseMethods: ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Billetera digital', 'Otro'],

    transactionTypes: [
      { value: 'ingreso', label: 'Ingreso de capital', short: 'Ingreso', help: 'Suma al capital disponible (aporte, saldo inicial, etc.).' },
      { value: 'egreso', label: 'Egreso de capital', short: 'Egreso', help: 'Resta del capital disponible.' },
      { value: 'inversion', label: 'Inversión', short: 'Inversión', help: 'Sale del disponible y pasa a capital invertido.' },
      { value: 'retorno', label: 'Retorno de inversión', short: 'Retorno', help: 'Entra al disponible. Indica cuánto del principal recuperas para calcular ganancia o pérdida.' },
      { value: 'prestamo', label: 'Préstamo otorgado', short: 'Préstamo', help: 'Prestas dinero: sale del disponible y queda como dinero por cobrar.' },
      { value: 'devolucion', label: 'Devolución recibida', short: 'Devolución', help: 'Te devuelven un préstamo: entra al disponible y baja el dinero por cobrar.' },
      { value: 'transferencia', label: 'Transferencia', short: 'Transferencia', help: 'Movimiento entre tus cuentas. No cambia tu capital.' },
    ],
    transactionStatuses: [
      { value: 'completado', label: 'Completado' },
      { value: 'pendiente', label: 'Pendiente (planificado)' },
      { value: 'cancelado', label: 'Cancelado' },
    ],

    debtStatuses: {
      pendiente: { label: 'Pendiente', emoji: '🔴', cls: 'neg' },
      en_progreso: { label: 'En progreso', emoji: '🟡', cls: 'warn' },
      saldado: { label: 'Saldado', emoji: '🟢', cls: 'pos' },
    },

    subscriptionCycles: [
      { value: 'mensual', label: 'Mensual', months: 1, per: 'mes' },
      { value: 'trimestral', label: 'Trimestral', months: 3, per: 'trimestre' },
      { value: 'semestral', label: 'Semestral', months: 6, per: 'semestre' },
      { value: 'anual', label: 'Anual', months: 12, per: 'año' },
      { value: 'semanal', label: 'Semanal', days: 7, per: 'semana' },
    ],
    subscriptionStatuses: {
      activa: { label: 'Activa', cls: 'pos' },
      pausada: { label: 'Pausada', cls: 'warn' },
      cancelada: { label: 'Cancelada', cls: 'faint' },
    },
    subscriptionReminders: [
      { value: 0, label: 'El mismo día' },
      { value: 1, label: '1 día antes' },
      { value: 3, label: '3 días antes' },
      { value: 7, label: '1 semana antes' },
    ],

    eventCategories: ['Reunión', 'Trabajo', 'Gimnasio', 'Pago', 'Recordatorio', 'Proyecto', 'Personal'],
    eventColors: {
      'Reunión': '#5B8DEF', 'Trabajo': '#8654D6', 'Gimnasio': '#5CC98A', 'Pago': '#D9A441',
      'Recordatorio': '#8A8A92', 'Proyecto': '#C46BB8', 'Personal': '#3FB4A8',
    },

    priorities: [
      { value: 'alta', label: 'Alta', icon: '🔥' },
      { value: 'media', label: 'Media', icon: '⚡' },
      { value: 'baja', label: 'Baja', icon: '○' },
    ],
    taskStatuses: [
      { value: 'pendiente', label: 'Pendiente' },
      { value: 'en_progreso', label: 'En progreso' },
      { value: 'completada', label: 'Completada' },
    ],
    blockStatuses: [
      { value: 'pendiente', label: 'Pendiente' },
      { value: 'en_progreso', label: 'En progreso' },
      { value: 'completado', label: 'Completado' },
    ],
    taskCategories: ['Trabajo', 'Personal', 'MAGNA', 'Contenido', 'Finanzas', 'Salud', 'Estudio', 'Otro'],

    goalCategories: ['Finanzas', 'Trabajo', 'Fitness', 'Personal', 'Aprendizaje'],
    goalUnits: [
      { value: 'money', label: 'Dinero' },
      { value: 'number', label: 'Número' },
      { value: 'percent', label: 'Porcentaje' },
    ],
    goalSources: [
      { value: 'manual', label: 'Manual (yo actualizo el valor)' },
      { value: 'debts_returned', label: 'Automático: capital devuelto de deudas' },
      { value: 'capital_available', label: 'Automático: capital disponible' },
      { value: 'workouts_month', label: 'Automático: entrenamientos este mes' },
    ],

    weekdays: [
      { value: 1, label: 'Lunes', short: 'Lun' },
      { value: 2, label: 'Martes', short: 'Mar' },
      { value: 3, label: 'Miércoles', short: 'Mié' },
      { value: 4, label: 'Jueves', short: 'Jue' },
      { value: 5, label: 'Viernes', short: 'Vie' },
      { value: 6, label: 'Sábado', short: 'Sáb' },
      { value: 7, label: 'Domingo', short: 'Dom' },
    ],

    habitEmojis: ['💪', '📚', '🌙', '💧', '💼', '🧘', '🎓', '🎬', '🏃', '🥗', '✍️', '⭐'],

    colorFor(list, value) {
      const i = list.indexOf(value);
      return C.palette[(i < 0 ? list.length : i) % C.palette.length];
    },
    priorityIcon(p) {
      return (S.priorities.find((x) => x.value === p) || S.priorities[1]).icon;
    },
    labelOf(list, value) {
      const f = list.find((x) => x.value === value);
      return f ? f.label : value;
    },
  };

  DOS.schema = S;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
