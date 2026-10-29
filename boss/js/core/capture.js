/* DANI OS — captura en lenguaje natural ("gasté 12 en almuerzo con tarjeta").
   Puro y sin dependencias de DOM: lo usan la app (dictado / escritura) y la función de Siri en Supabase.
   parse(texto, data, {today, now}) → acciones
   toChanges(acción, data)           → cambios a aplicar en las colecciones
   summary(acción, money)            → frase de confirmación (la que lee Siri) */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;

  const norm = (s) => U.norm(s).replace(/[¿?¡!"“”]/g, '').replace(/\s+/g, ' ').trim();
  const cap = (s) => { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const titleCase = (s) => String(s || '').trim().split(/\s+/).map(cap).join(' ');

  /* ---------- Números ---------- */
  const WORDS = {
    un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
    sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
    cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900, mil: 1000,
  };
  function parseNumber(tok) {
    const s = tok.replace(/\s/g, '');
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return +s.replace(/[.,]/g, '');
    let m = s.match(/^(\d{1,3}(?:[.,]\d{3})+)[.,](\d{1,2})$/);
    if (m) return +`${m[1].replace(/[.,]/g, '')}.${m[2]}`;
    m = s.match(/^(\d+)[.,](\d{1,2})$/);
    if (m) return +`${m[1]}.${m[2]}`;
    return +s.replace(/[.,]/g, '');
  }
  const AMOUNT_RE = /(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(k\b|mil\b|millones\b|millon\b|lucas\b)?/g;
  /** Todos los importes del texto (ya sin fechas ni horas). */
  function amounts(t) {
    const out = [];
    let m;
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(t))) {
      let v = parseNumber(m[1]);
      const mult = m[2] || '';
      if (/^(k|mil|lucas)$/.test(mult)) v *= 1000;
      if (/^millon/.test(mult)) v *= 1e6;
      if (v > 0) out.push({ value: U.round2(v), index: m.index, raw: m[0] });
    }
    if (!out.length) {
      // Números escritos en letra: "cincuenta", "doscientos mil"
      const words = t.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (WORDS[words[i]] && words[i] !== 'un' && words[i] !== 'una') {
          let v = WORDS[words[i]], j = i + 1;
          while (WORDS[words[j]] && !(words[j] === 'mil')) { v += WORDS[words[j]]; j++; }
          if (words[j] === 'mil') { v *= 1000; j++; }
          out.push({ value: v, index: t.indexOf(words[i]), raw: words.slice(i, j).join(' ') });
          break;
        }
      }
    }
    return out;
  }

  /* ---------- Fechas y horas ---------- */
  const WEEKDAYS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7 };
  const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

  /** Extrae fecha y hora y devuelve el texto sin esas expresiones. */
  function extractWhen(t, today) {
    let date = null, time = null, rest = ` ${t} `;
    const cut = (re) => { rest = rest.replace(re, ' '); };

    let m;
    if (/\bpasado manana\b/.test(rest)) { date = U.addDays(today, 2); cut(/\bpasado manana\b/); }
    else if (/\banteayer\b/.test(rest)) { date = U.addDays(today, -2); cut(/\banteayer\b/); }
    else if (/\bayer\b/.test(rest)) { date = U.addDays(today, -1); cut(/\bayer\b/); }
    else if (/\bmanana\b/.test(rest.replace(/\b(la|por la|en la|de la) manana\b/g, ''))) { date = U.addDays(today, 1); cut(/(?<!\bla )\bmanana\b/); }
    else if (/\bhoy\b/.test(rest)) { date = today; }

    if (!date && (m = rest.match(/\b(?:el |este |proximo |el proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/))) {
      const target = WEEKDAYS[m[1]];
      let diff = (target - U.isoWeekday(today) + 7) % 7;
      if (diff === 0) diff = 7;
      date = U.addDays(today, diff);
      cut(m[0]);
    }
    if (!date && (m = rest.match(/\bel (\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre))?\b/))) {
      const day = +m[1];
      if (day >= 1 && day <= 31) {
        let y = +today.slice(0, 4), mo = m[2] ? MONTHS[m[2]] : +today.slice(5, 7);
        let iso = `${y}-${U.pad(mo)}-${U.pad(day)}`;
        if (iso < today && !m[2]) { const n = U.addMonths(`${y}-${U.pad(mo)}-01`, 1); iso = `${n.slice(0, 8)}${U.pad(day)}`; }
        else if (iso < today && m[2]) iso = `${y + 1}-${U.pad(mo)}-${U.pad(day)}`;
        date = iso;
        cut(m[0]);
      }
    }
    cut(/\bhoy\b/);

    // Horas: "a las 10", "a las 3:30 de la tarde", "10:30", "5pm"
    if ((m = rest.match(/\b(?:a las|a la|para las|sobre las)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?|de la manana|de la tarde|de la noche|y media|y cuarto)?/))
      || (m = rest.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm|de la manana|de la tarde|de la noche)?\b/))
      || (m = rest.match(/\b(\d{1,2})\s*(am|pm)\b()/))) {
      let h = +m[1], min = m[2] && /^\d+$/.test(m[2]) ? +m[2] : 0;
      const q = (m[3] || (m[2] && !/^\d+$/.test(m[2]) ? m[2] : '') || '').replace(/\./g, '');
      if (/y media/.test(q)) min = 30;
      if (/y cuarto/.test(q)) min = 15;
      if (/pm|tarde|noche/.test(q) && h < 12) h += 12;
      if (/am|manana/.test(q) && h === 12) h = 0;
      if (!q && h >= 1 && h <= 7) h += 12; // "a las 3" casi siempre es por la tarde
      if (h <= 23 && min <= 59) { time = `${U.pad(h)}:${U.pad(min)}`; cut(m[0]); }
    }
    cut(/\b(por la|en la|de la) (manana|tarde|noche)\b/);
    return { date, time, rest: rest.replace(/\s+/g, ' ').trim() };
  }

  /* ---------- Clasificación ---------- */
  const EXPENSE_CATEGORIES = [
    ['Alimentación', ['almuerzo', 'comida', 'cena', 'desayuno', 'cafe', 'restaurante', 'supermercado', 'super', 'mercado', 'delivery', 'rappi', 'pizza', 'hamburguesa', 'snack', 'pan', 'frutas', 'helado', 'onces', 'merienda', 'bebida', 'cerveza', 'comer']],
    ['Transporte', ['uber', 'taxi', 'didi', 'cabify', 'indriver', 'metro', 'bus', 'buseta', 'gasolina', 'combustible', 'transporte', 'parqueadero', 'estacionamiento', 'peaje', 'pasaje', 'tren', 'avion', 'vuelo', 'moto']],
    ['Vivienda', ['alquiler', 'arriendo', 'renta', 'luz', 'agua', 'gas', 'internet', 'servicios', 'administracion', 'hipoteca', 'casa']],
    ['Gimnasio', ['gym', 'gimnasio', 'proteina', 'creatina', 'entrenador', 'mensualidad gym']],
    ['Entretenimiento', ['cine', 'netflix', 'spotify', 'fiesta', 'bar', 'concierto', 'juego', 'videojuego', 'salida', 'discoteca', 'disney', 'hbo', 'youtube premium']],
    ['Trabajo', ['software', 'hosting', 'dominio', 'anuncios', 'ads', 'publicidad', 'freelance', 'oficina', 'coworking', 'suscripcion', 'canva', 'claude', 'chatgpt', 'adobe', 'herramienta']],
    ['Tecnología', ['celular', 'telefono', 'cable', 'laptop', 'computador', 'computadora', 'cargador', 'audifonos', 'tablet', 'iphone', 'mac', 'camara', 'microfono', 'disco']],
    ['Compras', ['ropa', 'zapatos', 'tenis', 'camisa', 'pantalon', 'regalo', 'amazon', 'compras', 'mercadolibre', 'perfume', 'reloj']],
    ['Salud', ['farmacia', 'medico', 'doctor', 'medicina', 'medicamento', 'dentista', 'consulta', 'examen', 'terapia', 'vitaminas', 'suplemento']],
    ['Educación', ['curso', 'libro', 'clase', 'universidad', 'colegio', 'mentoria', 'taller', 'masterclass', 'diplomado', 'udemy']],
  ];
  const METHODS = [
    ['Crédito', /\b(con )?(tarjeta( de credito)?|credito)\b/],
    ['Débito', /\b(con )?(debito|tarjeta debito)\b/],
    ['Efectivo', /\b(en |con )?efectivo\b/],
    ['Transferencia', /\b(por |con )?transferencia\b/],
    ['Billetera digital', /\b(con |por )?(nequi|daviplata|yape|plin|paypal|apple pay|bizum|mercado pago)\b/],
  ];
  const STOP = new Set(['en', 'de', 'del', 'por', 'para', 'con', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'a', 'al', 'me', 'mi', 'mis', 'que', 'lo', 'le', 'se', 'su', 'hoy', 'ya']);
  const CURRENCY_WORDS = /\b(dolares|dolar|usd|pesos|peso|euros|euro|soles|sol|bolivares|quetzales|lucas|plata|dinero)\b/g;

  function categoryFor(t) {
    for (const [cat, words] of EXPENSE_CATEGORIES) if (words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return cat;
    return 'Otros';
  }
  function methodFor(t, fallback) {
    for (const [m, re] of METHODS) if (re.test(t)) return m;
    return fallback;
  }
  function stripMethods(t) {
    METHODS.forEach(([, re]) => { t = t.replace(re, ' '); });
    return t.replace(/\b(innecesario|innecesaria|por antojo|antojo|capricho)\b/g, ' ');
  }
  /** Limpia verbos/importes y deja un concepto legible. */
  function conceptFrom(t, verbs) {
    let s = ` ${t} `;
    verbs.forEach((v) => { s = s.replace(new RegExp(`\\b${v}\\b`, 'g'), ' '); });
    s = s.replace(AMOUNT_RE, ' ').replace(CURRENCY_WORDS, ' ').replace(/\$/g, ' ');
    s = s.replace(new RegExp(`\\b(${Object.keys(WORDS).filter((w) => !['un', 'una', 'uno'].includes(w)).join('|')})\\b`, 'g'), ' ');
    s = stripMethods(s);
    const words = s.split(/\s+/).filter(Boolean);
    while (words.length && STOP.has(words[0])) words.shift();
    while (words.length && STOP.has(words[words.length - 1])) words.pop();
    return cap(words.join(' '));
  }

  const EXPENSE_VERBS = ['gaste', 'gastado', 'pague', 'pagado', 'compre', 'comprado', 'gasto', 'me costo', 'costo', 'salio', 'me salio', 'invertí', 'pago de', 'pago'];
  const INCOME_VERBS = ['cobre', 'me pagaron', 'me pago', 'recibi', 'ingreso', 'ingresaron', 'me transfirieron', 'me depositaron', 'me consignaron', 'vendi', 'venta', 'gane', 'facture', 'entraron', 'entro'];
  const PAY_DEBT_VERBS = ['le devolvi', 'devolvi', 'le abone', 'abone', 'abono', 'le pague', 'pague', 'le transferi', 'transferi', 'le di', 'le mande', 'pago a'];
  const TASK_RE = /^(tarea|nueva tarea|agrega(r)? (una )?tarea|anota(r)?|recordar|recuerdame|recordarme|tengo que|debo|hay que|pendiente)\b/;
  const EVENT_RE = /\b(reunion|cita|evento|llamada con|videollamada|junta|meeting|agendar|agenda(r)? (una )?|sesion de fotos|grabacion)\b/;
  const WORKOUT_RE = /\b(entrene|ya entrene|fui al gym|fui al gimnasio|termine (el )?(entreno|entrenamiento)|hice (pecho|pierna|espalda|hombros?|brazos?|full ?body|biceps|triceps))\b/;
  const HABIT_HINT_RE = /\b(ya|hice|complete|cumpli|marca|marcar|habito|termine|logre)\b/;
  const HABIT_SYNONYMS = {
    leer: ['lei', 'leido', 'lectura', 'leer'],
    meditar: ['medite', 'meditacion', 'meditar'],
    agua: ['agua'],
    dormir: ['dormi temprano', 'me dormi temprano', 'me acoste temprano', 'dormir temprano'],
    gimnasio: ['gym', 'gimnasio'],
    contenido: ['contenido', 'grabe', 'publique', 'edite'],
    estudiar: ['estudie', 'estudio', 'estudiar'],
    trabajar: ['trabaje', 'trabajar'],
  };

  function matchDebt(t, debts) {
    let best = null;
    debts.forEach((d) => {
      const name = norm(d.name);
      const first = name.split(' ')[0];
      const score = new RegExp(`\\b${name}\\b`).test(t) ? 2 : first.length >= 3 && new RegExp(`\\b${first}\\b`).test(t) ? 1 : 0;
      if (score && (!best || score > best.score)) best = { debt: d, score };
    });
    return best ? best.debt : null;
  }
  function matchHabits(t, habits) {
    return habits.filter((h) => {
      const name = norm(h.name);
      if (t.includes(name)) return true;
      return Object.entries(HABIT_SYNONYMS).some(([key, syns]) => name.includes(key) && syns.some((s) => new RegExp(`\\b${s}\\b`).test(t)));
    });
  }

  /* ---------- Parser principal ---------- */
  function parseOne(raw, data, ctx, inheritKind = null) {
    const today = ctx.today || U.today();
    const t0 = norm(raw);
    // Mapa palabra-sin-acentos → palabra original, para devolver textos con tildes ("Café", "Martínez")
    const orig = {};
    String(raw || '').replace(/[¿?¡!"“”]/g, ' ').replace(/[.,](?!\d)/g, ' ').split(/\s+/).filter(Boolean).forEach((w) => { orig[U.norm(w)] = w; });
    const keepCase = (w) => (/^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(w) ? w : w.toLowerCase());
    const pretty = (s) => String(s || '').split(' ').map((w) => (orig[w] ? keepCase(orig[w]) : w)).join(' ');
    const capP = (s) => cap(pretty(String(s || '').toLowerCase().replace(/^(un|una|unos|unas|el|la|los|las)\s+/, '')));
    const titleP = (s) => titleCase(pretty(s));
    if (!t0) return { kind: 'unknown', message: 'No escuché nada. Prueba con algo como: gasté 12 en almuerzo.' };
    const when = extractWhen(t0, today);
    const t = when.rest;
    const amts = amounts(t);
    const amount = amts.length ? amts[0].value : null;
    const debtsStats = (data.debts || []).map((d) => DOS.finance.debtStats(d, data.debt_payments || [], today));
    const openDebts = debtsStats.filter((s) => s.status !== 'saldado').map((s) => ({ ...s.debt, _pending: s.pending }));
    const urgent = /\b(urgente|importante|prioridad alta|prioritario)\b/.test(t0);

    // 1. Tareas (tienen prioridad: "tengo que pagar internet" es una tarea, no un gasto)
    if (TASK_RE.test(t) && inheritKind === null) {
      let title = t.replace(TASK_RE, ' ').replace(/\b(urgente|importante|prioridad alta|prioritario)\b/g, ' ').replace(/^\s*(de |que |a )/, ' ').replace(/\s+/g, ' ').trim();
      if (!title) return { kind: 'unknown', message: '¿Cuál es la tarea? Por ejemplo: tarea llamar al contador mañana.' };
      return { kind: 'task', data: { title: capP(title), description: '', date: when.date || today, time: when.time || '', priority: urgent ? 'alta' : 'media', category: 'Personal', status: 'pendiente' } };
    }

    // 2. Eventos
    if (EVENT_RE.test(t) && !amount && inheritKind === null) {
      const title = capP(t.replace(/\b(agendar|agenda|anota|crear|crea|nuevo|nueva|evento|tengo( una)?)\b/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(de |una |un |la |el )/, ''));
      const category = /\b(reunion|junta|meeting|llamada|videollamada)\b/.test(t) ? 'Reunión' : /\b(gym|gimnasio|entreno)\b/.test(t) ? 'Gimnasio' : /\bpago\b/.test(t) ? 'Pago' : /\b(proyecto|grabacion|sesion de fotos|entrega)\b/.test(t) ? 'Proyecto' : 'Personal';
      return { kind: 'event', data: { title: title || 'Evento', date: when.date || today, time: when.time || '09:00', duration: 60, category, priority: urgent ? 'alta' : 'media', notes: '' }, assumedTime: !when.time };
    }

    // 3. Pago de deuda (nombre de una persona a la que debes + verbo de pago)
    const debt = matchDebt(t, openDebts);
    if ((inheritKind === null || inheritKind === 'debt_payment') && debt && (PAY_DEBT_VERBS.some((v) => new RegExp(`\\b${v}\\b`).test(t)) || inheritKind === 'debt_payment')) {
      if (!amount) return { kind: 'unknown', message: `¿Cuánto le devolviste a ${debt.name}?` };
      if (amount > debt._pending + 0.001) return { kind: 'unknown', message: `El pago de ${amount} supera lo que le debes a ${debt.name} (${debt._pending}).` };
      return { kind: 'debt_payment', debt, data: { debt_id: debt.id, date: when.date || today, amount, method: methodFor(t, 'Transferencia'), note: 'Registrado por voz' } };
    }
    if (/\b(le devolvi|devolvi|le abone|abone)\b/.test(t) && inheritKind === null) {
      const who = (t.match(/\ba ([a-zñ]+)/) || [])[1];
      return { kind: 'unknown', message: who ? `No encontré a ${cap(who)} en tus deudas pendientes.` : '¿A quién le devolviste el dinero?' };
    }

    // 4. Nueva deuda: "le debo 500 a Pedro", "Pedro me prestó 300"
    let m;
    if (inheritKind === null && (m = t.match(/\b(?:le )?debo\b.*?\ba ([a-zñ]+(?: [a-zñ]+)?)\s*$/) || t.match(/^([a-zñ]+(?: [a-zñ]+)?) me presto\b/) || t.match(/\bme presto ([a-zñ]+(?: [a-zñ]+)?)\b/))) {
      if (!amount) return { kind: 'unknown', message: '¿Cuánto debes? Por ejemplo: le debo 500 a Pedro.' };
      const name = titleP(m[1].replace(/\b(dolares|pesos|euros|lucas)\b/g, '').trim());
      const lent = /me presto/.test(t);
      return { kind: 'debt', data: { name, original_amount: amount, start_date: when.date || today, due_date: '', next_payment_date: null, next_payment_amount: 0, received_into_capital: lent, notes: 'Registrado por voz' } };
    }

    // 5. Ingresos
    if (inheritKind === 'income' || (inheritKind === null && INCOME_VERBS.some((v) => new RegExp(`\\b${v}\\b`).test(t)))) {
      if (!amount) return { kind: 'unknown', message: '¿Cuánto recibiste? Por ejemplo: cobré 1200 de MAGNA.' };
      const tm = stripMethods(t).replace(/\s+/g, ' ').trim();
      const beforePor = tm.split(/\bpor\b/)[0];
      const src = (beforePor.match(/\b(?:de|del|por parte de)\s+((?:[a-zñ]+\s?){1,3})/) || [])[1];
      let forWhat = (tm.match(/\bpor\s+((?:[a-zñ0-9]+\s?){1,5})/) || [])[1];
      if (forWhat && /\d/.test(forWhat)) forWhat = null;
      const category = /\bmagna\b/.test(t) ? 'MAGNA' : /\b(venta|vendi)\b/.test(t) ? 'Venta' : /\bproyecto\b/.test(t) ? 'Proyecto' : /\b(inversion|dividendo|intereses|rendimiento)\b/.test(t) ? 'Inversión' : /\b(salario|sueldo|nomina|quincena)\b/.test(t) ? 'Salario' : src ? 'Cliente' : 'Otro';
      const srcClean = src ? src.replace(CURRENCY_WORDS, '').replace(/^(un|una|el|la|los|las|mi|mis)\s+/, '').trim() : '';
      const source = srcClean ? (/^(un|una)\s/.test(src) ? cap(pretty(srcClean)) : titleP(srcClean)) : '';
      const concept = forWhat ? capP(forWhat.replace(CURRENCY_WORDS, '').trim()) : source ? `Pago de ${source}` : capP(conceptFrom(tm, INCOME_VERBS).toLowerCase()) || category;
      return { kind: 'income', data: { date: when.date || today, concept, source: /\bmagna\b/.test(t) ? 'MAGNA' : source, category, amount, method: methodFor(t, 'Transferencia'), notes: 'Registrado por voz' } };
    }

    // 6. Entrenamiento
    if (inheritKind === null && WORKOUT_RE.test(t) && !amount) {
      return { kind: 'workout', data: { date: when.date || today } };
    }

    // 7. Hábitos
    if (inheritKind === null && !amount) {
      const hs = matchHabits(t, data.habits || []);
      if (hs.length && (HABIT_HINT_RE.test(t) || hs.length)) return { kind: 'habit', habits: hs, data: { date: when.date || today } };
    }

    // 8. Gastos (por defecto si hay un importe)
    if (amount) {
      const category = categoryFor(t);
      const concept = capP(conceptFrom(t, EXPENSE_VERBS).toLowerCase()) || category;
      return {
        kind: 'expense',
        data: {
          date: when.date || today, time: when.time || (when.date && when.date !== today ? '12:00' : ctx.now || U.nowTime()),
          concept: concept.length > 60 ? concept.slice(0, 60) : concept, category, amount,
          method: methodFor(t, 'Débito'), necessary: !/\b(innecesario|innecesaria|antojo|capricho)\b/.test(t), note: 'Registrado por voz',
        },
      };
    }
    return { kind: 'unknown', message: 'No entendí qué registrar. Prueba: “gasté 12 en almuerzo”, “cobré 300 de un cliente”, “le devolví 100 a Juan” o “tarea llamar al contador mañana”.' };
  }

  /** Divide "gasté 12 en almuerzo y 5 en café" en varias acciones del mismo tipo. */
  function parse(text, data, ctx = {}) {
    const first = parseOne(text, data, ctx);
    if (!['expense', 'income'].includes(first.kind)) return [first];
    const parts = String(text).toLowerCase().split(/\s*(?:,\s+|\s+y\s+(?!media|cuarto)|\s+m[aá]s\s+)\s*/).filter(Boolean);
    const withAmount = parts.filter((p) => amounts(extractWhen(norm(p), ctx.today || U.today()).rest).length);
    if (withAmount.length < 2 || withAmount.length !== parts.filter((p) => /\d/.test(p) || amounts(norm(p)).length).length) return [first];
    // Une fragmentos sin importe al anterior ("12 en uber con tarjeta")
    const segs = [];
    parts.forEach((p) => { if (amounts(norm(p)).length || !segs.length) segs.push(p); else segs[segs.length - 1] += ` ${p}`; });
    const out = segs.map((s, i) => parseOne(i === 0 ? s : s, data, ctx, i === 0 ? null : first.kind));
    // Los siguientes heredan la fecha del primero si no dicen otra
    out.forEach((a, i) => { if (i && a.data && first.data && !extractWhen(norm(segs[i]), ctx.today || U.today()).date) a.data.date = first.data.date; });
    return out.every((a) => a.kind === first.kind) ? out : [first];
  }

  /** Cambios concretos a aplicar. */
  function toChanges(action, data) {
    switch (action.kind) {
      case 'expense': return [{ collection: 'expenses', op: 'insert', row: action.data }];
      case 'income': return [{ collection: 'income', op: 'insert', row: action.data }];
      case 'task': return [{ collection: 'tasks', op: 'insert', row: action.data }];
      case 'event': return [{ collection: 'events', op: 'insert', row: action.data }];
      case 'debt': return [{ collection: 'debts', op: 'insert', row: action.data }];
      case 'debt_payment': {
        const changes = [{ collection: 'debt_payments', op: 'insert', row: action.data }];
        const s = DOS.finance.debtStats(action.debt, data.debt_payments || []);
        if (U.round2(s.pending - action.data.amount) <= 0) changes.push({ collection: 'debts', op: 'update', id: action.debt.id, patch: { next_payment_date: null, next_payment_amount: 0 } });
        return changes;
      }
      case 'habit': {
        return action.habits
          .filter((h) => !(data.habit_logs || []).some((l) => l.habit_id === h.id && l.date === action.data.date))
          .map((h) => ({ collection: 'habit_logs', op: 'insert', row: { habit_id: h.id, date: action.data.date } }));
      }
      case 'workout': {
        const date = action.data.date;
        if ((data.workouts || []).some((w) => w.date === date)) return [];
        const routine = DOS.life.routineFor(data, date);
        const exercises = routine ? DOS.life.exercisesOf(data, routine.id).map((e) => {
          const last = DOS.life.lastSetFor(data, e.name);
          return { name: e.name, sets: e.sets, reps: e.reps, weight: last ? last.weight : e.weight };
        }) : [];
        const changes = [{ collection: 'workouts', op: 'insert', row: { date, routine_id: routine ? routine.id : null, title: routine ? routine.name : 'Entrenamiento', duration: 60, notes: 'Registrado por voz', exercises } }];
        const gym = (data.habits || []).find((h) => /gim|gym/.test(norm(h.name)));
        if (gym && !(data.habit_logs || []).some((l) => l.habit_id === gym.id && l.date === date)) changes.push({ collection: 'habit_logs', op: 'insert', row: { habit_id: gym.id, date } });
        return changes;
      }
      default: return [];
    }
  }

  function summary(action, money, data = {}, today = U.today()) {
    const d = action.data || {};
    const whenTxt = (date) => (date && date !== today ? ` (${U.relDay(date, today).toLowerCase()})` : '');
    switch (action.kind) {
      case 'expense': return `Gasto registrado: ${money(d.amount)} en ${d.concept}, ${d.category}${whenTxt(d.date)}.`;
      case 'income': return `Ingreso registrado: ${money(d.amount)}${d.source ? ` de ${d.source}` : ''}${whenTxt(d.date)}.`;
      case 'debt_payment': {
        const s = DOS.finance.debtStats(action.debt, data.debt_payments || []);
        const left = U.round2(Math.max(0, s.pending - (data.__applied ? 0 : d.amount)));
        return left <= 0 ? `Pago de ${money(d.amount)} a ${action.debt.name}. ¡Deuda saldada!` : `Pago de ${money(d.amount)} a ${action.debt.name}. Te quedan ${money(left)} por devolver.`;
      }
      case 'debt': return `Deuda registrada: le debes ${money(d.original_amount)} a ${d.name}.`;
      case 'task': return `Tarea añadida: ${d.title}${whenTxt(d.date)}${d.time ? ` a las ${d.time}` : ''}.`;
      case 'event': return `Evento agendado: ${d.title}, ${U.relDay(d.date, today).toLowerCase()} a las ${d.time}.`;
      case 'habit': return `Hábito marcado: ${action.habits.map((h) => h.name).join(', ')}${whenTxt(d.date)}.`;
      case 'workout': return `Entrenamiento registrado${whenTxt(d.date)}. ¡Bien hecho!`;
      default: return action.message || 'No entendí.';
    }
  }

  DOS.capture = { parse, toChanges, summary, _amounts: amounts, _when: extractWhen };
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
