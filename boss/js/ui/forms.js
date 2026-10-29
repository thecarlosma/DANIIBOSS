/* DANI OS — formularios de alta/edición compartidos por vistas, búsqueda global y botón "+". */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils, S = DOS.schema, F = DOS.finance, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc;

  const priorityOptions = S.priorities.map((p) => ({ value: p.value, label: `${p.icon} ${p.label}` }));
  const available = () => F.capitalOverview(store.data).available;

  /** Inserta o actualiza y muestra feedback. */
  function save(collection, existing, values, msgNew, msgEdit) {
    const rec = existing ? store.update(collection, existing.id, values) : store.insert(collection, values);
    ui.toast(existing ? msgEdit || 'Cambios guardados' : msgNew || 'Guardado');
    return rec;
  }
  /** Elimina con opción de deshacer. */
  function remove(collection, id, label = 'Registro eliminado') {
    const removed = store.remove(collection, id);
    if (removed) ui.toast(label, 'info', { action: { label: 'Deshacer', fn: () => { store.restore(removed); ui.toast('Restaurado'); } } });
  }

  const forms = {
    save, remove,

    /* ---------- Captura rápida por voz o texto ---------- */
    /** Aplica acciones interpretadas y devuelve las frases de confirmación. */
    applyCapture(actions) {
      const msgs = [];
      actions.forEach((a) => {
        msgs.push(DOS.capture.summary(a, (n) => ui.money(n, { privacy: false }), store.data));
        DOS.capture.toChanges(a, store.data).forEach((ch) => {
          if (ch.op === 'insert') store.insert(ch.collection, ch.row, { silent: true });
          else store.update(ch.collection, ch.id, ch.patch);
        });
      });
      store.emit('*', 'capture');
      return msgs;
    },

    capture(initial = '') {
      const KIND = {
        expense: ['expense', 'neg', 'Gasto'], income: ['income', 'pos', 'Ingreso'], debt_payment: ['receipt', 'warn', 'Pago de deuda'],
        debt: ['user', 'warn', 'Nueva deuda'], task: ['checkSquare', 'accent', 'Tarea'], event: ['calendar', 'accent', 'Evento'],
        habit: ['repeat', 'pos', 'Hábito'], workout: ['dumbbell', 'pos', 'Entrenamiento'], unknown: ['info', '', 'Sin entender'],
      };
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const examples = ['gasté 12 en almuerzo con tarjeta', 'cobré 1200 de MAGNA', 'le devolví 200 a Juan', 'tarea llamar al contador mañana', 'reunión el viernes a las 10', 'ya leí hoy'];
      const m = ui.modal({
        title: 'Dime qué registrar',
        subtitle: 'Escribe o dicta en lenguaje normal. Verás qué se va a guardar antes de confirmar.',
        body: `<form novalidate>
          <div class="capture-box">
            <textarea class="textarea" name="text" rows="2" placeholder="Ej. gasté 12 en almuerzo con tarjeta" autocomplete="off" autocapitalize="sentences" aria-label="Qué quieres registrar">${esc(initial)}</textarea>
            ${SR ? `<button type="button" class="mic-btn" data-mic aria-label="Dictar por voz" title="Dictar">${icon('mic')}</button>` : ''}
          </div>
          ${SR ? '' : '<p class="faint" style="font-size:12px;margin:8px 0 0">En iPhone toca el micrófono del teclado para dictar.</p>'}
          <div class="capture-preview" aria-live="polite"></div>
          <div class="chips capture-examples">${examples.map((e) => `<button type="button" class="chip" data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>
          <div class="modal-actions"><span class="spacer"></span>
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary" disabled>${icon('check')}Registrar</button></div>
        </form>`,
      });
      const form = m.el.querySelector('form');
      const ta = form.elements.text;
      const preview = form.querySelector('.capture-preview');
      const submit = form.querySelector('[type=submit]');
      let actions = [];
      const draw = () => {
        const text = ta.value.trim();
        form.querySelector('.capture-examples').hidden = !!text;
        if (!text) { preview.innerHTML = ''; submit.disabled = true; actions = []; return; }
        actions = DOS.capture.parse(text, store.data, { today: U.today(), now: U.nowTime() });
        const ok = actions.every((a) => a.kind !== 'unknown');
        preview.innerHTML = actions.map((a) => {
          const [ic, cls, label] = KIND[a.kind] || KIND.unknown;
          return `<div class="list-item"><div class="icon-tile ${cls}">${icon(ic)}</div><div class="grow"><div class="meta">${label}</div>
            <div style="font-weight:500;white-space:normal">${esc(DOS.capture.summary(a, (n) => ui.money(n, { privacy: false }), store.data).replace(/^(Gasto|Ingreso|Deuda) registrad[oa]:\s*|^Tarea añadida:\s*|^Evento agendado:\s*|^Hábito marcado:\s*/, ''))}</div>
            ${a.kind === 'event' && a.assumedTime ? '<div class="faint" style="font-size:12px">Sin hora: se agenda a las 09:00</div>' : ''}</div></div>`;
        }).join('');
        submit.disabled = !ok;
        submit.innerHTML = `${icon('check')}${ok && actions.length > 1 ? `Registrar ${actions.length}` : 'Registrar'}`;
      };
      ta.addEventListener('input', draw);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
      form.addEventListener('click', (e) => {
        const ex = e.target.closest('[data-example]');
        if (ex) { ta.value = ex.dataset.example; draw(); ta.focus(); }
        if (e.target.closest('[data-mic]')) listen();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!actions.length || actions.some((a) => a.kind === 'unknown')) return;
        const msgs = forms.applyCapture(actions);
        m.close();
        ui.toast(msgs.join(' '), 'success', { duration: 4500 });
      });
      let rec = null;
      function listen() {
        const btn = form.querySelector('[data-mic]');
        if (rec) { rec.stop(); return; }
        rec = new SR();
        rec.lang = /^es/.test(navigator.language) ? navigator.language : 'es-ES';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        btn.classList.add('on');
        rec.onresult = (ev) => { ta.value = [...ev.results].map((r) => r[0].transcript).join(' '); draw(); };
        rec.onerror = (ev) => { if (ev.error === 'not-allowed') ui.toast('Permite el micrófono para dictar', 'error'); };
        rec.onend = () => { btn.classList.remove('on'); rec = null; };
        rec.start();
      }
      draw();
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
      return m;
    },

    /* ---------- Finanzas ---------- */
    expense(existing = null, defaults = {}) {
      const v = existing || { date: U.today(), time: U.nowTime(), category: 'Alimentación', method: 'Débito', necessary: true, ...defaults };
      ui.form({
        title: existing ? 'Editar gasto' : 'Nuevo gasto',
        subtitle: existing ? '' : 'Se descuenta automáticamente de tu capital disponible.',
        values: v,
        fields: [
          { name: 'concept', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej. Almuerzo' },
          { name: 'amount', label: 'Monto', type: 'money', required: true, min: 0, half: true },
          { name: 'category', label: 'Categoría', type: 'select', options: S.expenseCategories, required: true, half: true },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'time', label: 'Hora', type: 'time', half: true },
          { name: 'method', label: 'Método de pago', type: 'select', options: S.expenseMethods, required: true, half: true },
          { name: 'necessary', label: '¿Era necesario?', type: 'segmented', options: [{ value: true, label: 'Necesario' }, { value: false, label: 'No necesario' }], half: true },
          { name: 'note', label: 'Nota', type: 'textarea' },
        ],
        onSubmit: (val) => {
          save('expenses', existing, val);
          if (!existing) ui.toast(`Gasto registrado · Disponible: ${ui.money(available())}`, 'info');
        },
        onDelete: existing ? () => remove('expenses', existing.id, 'Gasto eliminado') : null,
      });
    },

    income(existing = null, defaults = {}) {
      const sources = [...new Set(store.all('income').map((i) => i.source).filter(Boolean))];
      const v = existing || { date: U.today(), category: 'Cliente', method: 'Transferencia', ...defaults };
      ui.form({
        title: existing ? 'Editar ingreso' : 'Nuevo ingreso',
        subtitle: existing ? '' : 'Se suma automáticamente a tu capital disponible.',
        values: v,
        fields: [
          { name: 'concept', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej. Retainer mensual' },
          { name: 'amount', label: 'Monto', type: 'money', required: true, min: 0.01, half: true },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'source', label: 'Fuente', type: 'text', list: sources, placeholder: 'Cliente o empresa', half: true },
          { name: 'category', label: 'Categoría', type: 'select', options: S.incomeCategories, required: true, half: true },
          { name: 'method', label: 'Método de recepción', type: 'select', options: S.incomeMethods, required: true },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
        onSubmit: (val) => {
          save('income', existing, val);
          if (!existing) ui.toast(`Ingreso registrado · Disponible: ${ui.money(available())}`, 'info');
        },
        onDelete: existing ? () => remove('income', existing.id, 'Ingreso eliminado') : null,
      });
    },

    transaction(existing = null, defaults = {}) {
      const v = existing || { date: U.today(), type: 'ingreso', status: 'completado', ...defaults };
      ui.form({
        title: existing ? 'Editar movimiento de capital' : 'Nuevo movimiento de capital',
        subtitle: 'Para inversiones, préstamos que das, retornos y aportes. Tus ingresos y gastos del día a día van en sus secciones.',
        values: v,
        fields: [
          { name: 'type', label: 'Tipo', type: 'select', required: true, options: S.transactionTypes.map((t) => ({ value: t.value, label: t.label })), hint: S.transactionTypes.map((t) => `${t.short}: ${t.help}`).join('  ·  ') },
          { name: 'amount', label: 'Monto', type: 'money', required: true, min: 0.01, half: true },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'principal', label: 'Principal recuperado', type: 'money', min: 0, hint: 'Parte del capital invertido que vuelve. Ganancia = monto − principal.', showIf: (x) => x.type === 'retorno' },
          { name: 'concept', label: 'Concepto', type: 'text', required: true },
          { name: 'counterpart', label: 'Persona / empresa', type: 'text', half: true },
          { name: 'status', label: 'Estado', type: 'select', required: true, options: S.transactionStatuses, half: true, hint: 'Solo los completados afectan tu capital. Los pendientes cuentan como comprometido.' },
          { name: 'note', label: 'Nota', type: 'textarea' },
        ],
        onSubmit: (val) => {
          if (val.type === 'retorno' && val.principal !== '' && +val.principal < 0) return 'El principal no puede ser negativo.';
          save('transactions', existing, val, 'Movimiento registrado');
          ui.toast(`Capital disponible: ${ui.money(available())}`, 'info');
        },
        onDelete: existing ? () => remove('transactions', existing.id, 'Movimiento eliminado') : null,
      });
    },

    debt(existing = null) {
      const stats = existing ? F.debtStats(existing, store.all('debt_payments')) : null;
      const v = existing || { start_date: U.today(), received_into_capital: false };
      ui.form({
        title: existing ? `Editar deuda · ${existing.name}` : 'Nueva deuda',
        subtitle: existing ? '' : 'Registra a una persona a la que debes devolver capital.',
        values: v,
        fields: [
          { name: 'name', label: 'Persona', type: 'text', required: true, placeholder: 'Nombre' },
          { name: 'original_amount', label: 'Capital original', type: 'money', required: true, min: 0.01, half: true },
          { name: 'start_date', label: 'Fecha inicial', type: 'date', required: true, half: true },
          { name: 'due_date', label: 'Fecha límite', type: 'date', half: true },
          { name: 'next_payment_date', label: 'Próximo pago', type: 'date', half: true },
          { name: 'next_payment_amount', label: 'Monto del próximo pago', type: 'money', min: 0 },
          { name: 'received_into_capital', label: 'Este dinero entró a mi capital disponible', type: 'toggle', hint: 'Actívalo si el préstamo es nuevo y el dinero está en tu cuenta. Déjalo apagado para deudas antiguas.' },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
        onSubmit: (val) => {
          if (stats && val.original_amount < stats.returned) return `El capital original no puede ser menor que lo ya devuelto (${ui.money(stats.returned)}).`;
          save('debts', existing, val, `Deuda con ${val.name} registrada`);
        },
        onDelete: existing ? () => remove('debts', existing.id, `Deuda con ${existing.name} eliminada (y sus pagos)`) : null,
      });
    },

    debtPayment(debtId, opts = {}) {
      const debt = store.get('debts', debtId);
      if (!debt) return;
      const s = F.debtStats(debt, store.all('debt_payments'));
      if (s.status === 'saldado') { ui.toast(`La deuda con ${debt.name} ya está saldada`, 'info'); return; }
      const today = U.today();
      const suggestedNext = debt.next_payment_date && debt.next_payment_date > today ? debt.next_payment_date : U.addMonths(debt.next_payment_date || today, 1);
      ui.form({
        title: `Registrar pago · ${debt.name}`,
        subtitle: `Pendiente actual: <strong class="num" style="color:#fff">${ui.money(s.pending)}</strong> de ${ui.money(s.original)}`,
        values: { amount: s.nextAmount || '', date: today, method: 'Transferencia', next_payment_date: suggestedNext, next_payment_amount: debt.next_payment_amount || '' },
        submitLabel: 'Registrar pago',
        fields: [
          { name: 'amount', label: 'Monto pagado', type: 'money', required: true, min: 0.01, half: true, hint: `Máximo ${ui.money(s.pending, { privacy: false })}` },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'method', label: 'Método', type: 'select', options: S.expenseMethods, required: true },
          { name: 'next_payment_date', label: 'Siguiente pago', type: 'date', half: true },
          { name: 'next_payment_amount', label: 'Monto siguiente', type: 'money', min: 0, half: true },
          { name: 'note', label: 'Nota', type: 'textarea' },
        ],
        onSubmit: (val) => {
          const err = F.validateDebtPayment(s, val.amount);
          if (err) return err.replace(String(s.pending), ui.money(s.pending, { privacy: false }));
          store.insert('debt_payments', { debt_id: debt.id, date: val.date, amount: val.amount, method: val.method, note: val.note }, { silent: true });
          const after = F.debtStats(debt, store.all('debt_payments'));
          store.update('debts', debt.id, after.status === 'saldado'
            ? { next_payment_date: null, next_payment_amount: 0 }
            : { next_payment_date: val.next_payment_date || null, next_payment_amount: val.next_payment_amount || 0 });
          if (after.status === 'saldado') ui.toast(`🟢 Deuda con ${debt.name} saldada por completo`);
          else ui.toast(`Pago registrado · Pendiente con ${debt.name}: ${ui.money(after.pending)}`);
          opts.onDone && opts.onDone();
        },
      });
    },

    debtDetail(debtId) {
      const render = () => {
        const debt = store.get('debts', debtId);
        if (!debt) return null;
        const s = F.debtStats(debt, store.all('debt_payments'));
        const st = S.debtStatuses[s.status];
        return `
          <div class="row between wrap" style="margin-bottom:14px">
            <span class="tag ${st.cls}">${st.emoji} ${st.label}</span>
            <span class="muted num">${U.fmtPct(s.progress)} devuelto</span>
          </div>
          ${ui.progress(s.progress, 'lg' + (s.status === 'saldado' ? ' pos' : ''))}
          <div class="kv">
            <div><div class="k">Original</div><div class="v">${ui.money(s.original)}</div></div>
            <div><div class="k">Devuelto</div><div class="v pos">${ui.money(s.returned)}</div></div>
            <div><div class="k">Pendiente</div><div class="v">${ui.money(s.pending)}</div></div>
            <div><div class="k">Fecha límite</div><div class="v">${debt.due_date ? U.fmtDateFull(debt.due_date) : '—'}</div></div>
          </div>
          ${debt.notes ? `<p class="muted" style="margin:16px 0 0">${esc(debt.notes)}</p>` : ''}
          <div class="group-label" style="padding-top:22px"><span>Historial de pagos</span><span>${s.payments.length}</span></div>
          <div class="list">${s.payments.length ? s.payments.slice().reverse().map((p) => `
            <div class="list-item">
              <div class="icon-tile pos">${icon('check')}</div>
              <div class="grow"><div class="title">${ui.money(p.amount)} ${ui.demoTag(p)}</div><div class="meta">${U.fmtDateFull(p.date)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
              <button class="icon-btn sm" data-del-payment="${p.id}" aria-label="Eliminar pago" title="Eliminar pago">${icon('trash')}</button>
            </div>`).join('') : '<p class="muted" style="margin:6px 0">Aún no hay pagos registrados.</p>'}</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-edit-debt>${icon('edit')}Editar</button><span class="spacer"></span>
            ${s.status !== 'saldado' ? `<button class="btn btn-primary" data-pay>${icon('plus')}Registrar pago</button>` : ''}
          </div>`;
      };
      const debt = store.get('debts', debtId);
      if (!debt) return;
      const m = ui.modal({ title: debt.name, subtitle: `Desde ${U.fmtDateFull(debt.start_date)}`, body: render(), size: 'lg' });
      const unsub = store.subscribe(() => { const html = render(); if (html === null) m.close(); else m.body.innerHTML = html; });
      const origClose = m.close;
      m.close = () => { unsub(); origClose(); };
      m.el.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-del-payment]');
        if (del) {
          const ok = await ui.confirm({ title: 'Eliminar pago', message: 'El capital pendiente y tu capital disponible se recalcularán.', confirmLabel: 'Eliminar', danger: true });
          if (ok) remove('debt_payments', del.dataset.delPayment, 'Pago eliminado · deuda recalculada');
        }
        if (e.target.closest('[data-pay]')) forms.debtPayment(debtId);
        if (e.target.closest('[data-edit-debt]')) forms.debt(store.get('debts', debtId));
      });
    },

    /* ---------- Suscripciones ---------- */
    subscription(existing = null, defaults = {}) {
      const v = existing || { cycle: 'mensual', next_date: U.addMonths(U.today(), 1), category: 'Tecnología', method: 'Crédito', status: 'activa', remind_days: 3, ...defaults };
      ui.form({
        title: existing ? 'Editar suscripción' : 'Nueva suscripción',
        subtitle: existing ? '' : 'Te aviso antes de cada cobro para que estés al día.',
        values: v,
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej. Claude, ChatGPT, CapCut, Gimnasio' },
          { name: 'amount', label: 'Monto', type: 'money', required: true, min: 0, half: true },
          { name: 'cycle', label: 'Se cobra', type: 'select', options: S.subscriptionCycles.map((c) => ({ value: c.value, label: c.label })), required: true, half: true },
          { name: 'next_date', label: 'Próximo cobro', type: 'date', required: true, half: true, hint: 'La fecha en que te toca pagar.' },
          { name: 'remind_days', label: 'Avisarme', type: 'select', required: true, options: S.subscriptionReminders.map((r) => ({ value: String(r.value), label: r.label })), half: true },
          { name: 'category', label: 'Categoría', type: 'select', options: S.expenseCategories, required: true, half: true },
          { name: 'method', label: 'Método de pago', type: 'select', options: S.expenseMethods, required: true, half: true },
          { name: 'status', label: 'Estado', type: 'segmented', options: Object.entries(S.subscriptionStatuses).map(([value, x]) => ({ value, label: x.label })) },
          { name: 'end_date', label: 'Vence o termina (opcional)', type: 'date', half: true, hint: 'Fin de la prueba gratis, del plan o de la tarjeta.' },
          { name: 'url', label: 'Enlace para pagar o gestionar (opcional)', type: 'text', half: true, placeholder: 'https://…' },
          { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Cuenta, correo con el que la pagas, qué incluye…' },
        ],
        onSubmit: (val) => {
          val.remind_days = val.remind_days === '' || val.remind_days === undefined ? 3 : +val.remind_days;
          if (val.url && !/^https?:\/\//i.test(val.url)) val.url = `https://${val.url}`;
          if (!existing || existing.next_date !== val.next_date) val.anchor_day = +val.next_date.slice(8, 10);
          save('subscriptions', existing, val, 'Suscripción guardada');
        },
        onDelete: existing ? () => remove('subscriptions', existing.id, 'Suscripción eliminada') : null,
      });
    },

    /** Registra el cobro como gasto y pasa la suscripción a su siguiente fecha. */
    subscriptionPay(id) {
      const sub = store.get('subscriptions', id);
      if (!sub) return;
      const next = F.subAdvance(sub);
      ui.form({
        title: `Pagar ${sub.name}`,
        subtitle: `Se registra como gasto y el próximo cobro pasa al ${U.fmtDateLong(next)}.`,
        values: { amount: sub.amount, date: U.today(), method: sub.method || 'Crédito' },
        submitLabel: 'Registrar pago',
        fields: [
          { name: 'amount', label: 'Monto cobrado', type: 'money', required: true, min: 0, half: true },
          { name: 'date', label: 'Fecha del pago', type: 'date', required: true, half: true },
          { name: 'method', label: 'Método de pago', type: 'select', options: S.expenseMethods, required: true },
        ],
        onSubmit: (val) => {
          store.insert('expenses', { concept: sub.name, amount: val.amount, category: sub.category || 'Tecnología', method: val.method, date: val.date, time: val.date === U.today() ? U.nowTime() : '12:00', necessary: true, subscription_id: sub.id, note: `Suscripción ${F.subCycle(sub).label.toLowerCase()}` });
          const patch = { next_date: next, last_paid: val.date };
          if (!sub.anchor_day) patch.anchor_day = +sub.next_date.slice(8, 10);
          store.update('subscriptions', sub.id, patch);
          ui.toast(`${sub.name} pagada · Próximo cobro ${U.fmtDate(next)}`, 'success');
        },
      });
    },

    /* ---------- Agenda ---------- */
    event(existing = null, defaults = {}) {
      const v = existing || { date: U.today(), time: '10:00', duration: 60, category: 'Reunión', priority: 'media', ...defaults };
      ui.form({
        title: existing ? 'Editar evento' : 'Nuevo evento',
        values: v,
        fields: [
          { name: 'title', label: 'Título', type: 'text', required: true },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'time', label: 'Hora', type: 'time', required: true, half: true },
          { name: 'duration', label: 'Duración (min)', type: 'number', min: 0, step: 5, half: true },
          { name: 'category', label: 'Categoría', type: 'select', options: S.eventCategories, required: true, half: true },
          { name: 'priority', label: 'Prioridad', type: 'segmented', options: priorityOptions },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
        onSubmit: (val) => { save('events', existing, val, 'Evento creado'); },
        onDelete: existing ? () => remove('events', existing.id, 'Evento eliminado') : null,
      });
    },

    task(existing = null, defaults = {}) {
      const v = existing || { date: U.today(), priority: 'media', category: 'Trabajo', status: 'pendiente', ...defaults };
      ui.form({
        title: existing ? 'Editar tarea' : 'Nueva tarea',
        values: v,
        fields: [
          { name: 'title', label: 'Título', type: 'text', required: true },
          { name: 'description', label: 'Descripción', type: 'textarea' },
          { name: 'date', label: 'Fecha', type: 'date', half: true },
          { name: 'time', label: 'Hora', type: 'time', half: true },
          { name: 'priority', label: 'Prioridad', type: 'segmented', options: priorityOptions },
          { name: 'category', label: 'Categoría', type: 'select', options: S.taskCategories, required: true, half: true },
          { name: 'status', label: 'Estado', type: 'select', options: S.taskStatuses, required: true, half: true },
        ],
        onSubmit: (val) => {
          if (val.status === 'completada' && (!existing || existing.status !== 'completada')) val.completed_at = new Date().toISOString();
          save('tasks', existing, val, 'Tarea creada');
        },
        onDelete: existing ? () => remove('tasks', existing.id, 'Tarea eliminada') : null,
      });
    },

    block(existing = null, defaults = {}) {
      const v = existing || { date: U.today(), time: U.fromMin(Math.ceil(U.toMin(U.nowTime()) / 30) * 30), duration: 60, priority: 'media', status: 'pendiente', ...defaults };
      ui.form({
        title: existing ? 'Editar bloque' : 'Nuevo bloque en Mi Día',
        values: v,
        fields: [
          { name: 'title', label: 'Actividad', type: 'text', required: true, placeholder: 'Ej. Trabajo profundo' },
          { name: 'date', label: 'Fecha', type: 'date', required: true, half: true },
          { name: 'time', label: 'Hora', type: 'time', required: true, half: true },
          { name: 'duration', label: 'Duración (min)', type: 'number', min: 5, step: 5, required: true, half: true },
          { name: 'status', label: 'Estado', type: 'select', options: S.blockStatuses, required: true, half: true },
          { name: 'priority', label: 'Prioridad', type: 'segmented', options: priorityOptions },
        ],
        onSubmit: (val) => { save('day_blocks', existing, val, 'Bloque añadido'); },
        onDelete: existing ? () => remove('day_blocks', existing.id, 'Bloque eliminado') : null,
      });
    },

    /* ---------- Hábitos ---------- */
    habit(existing = null) {
      const v = existing || { emoji: '⭐', start_date: U.today() };
      ui.form({
        title: existing ? 'Editar hábito' : 'Nuevo hábito',
        values: v,
        fields: [
          { name: 'name', label: 'Hábito', type: 'text', required: true, placeholder: 'Ej. Leer 20 minutos' },
          { name: 'emoji', label: 'Icono', type: 'emoji', options: S.habitEmojis.map((e) => ({ value: e, label: e })) },
          { name: 'start_date', label: 'Empieza el', type: 'date', required: true },
        ],
        onSubmit: (val) => { save('habits', existing, val, 'Hábito creado'); },
        onDelete: existing ? () => remove('habits', existing.id, 'Hábito eliminado') : null,
      });
    },

    /* ---------- Fitness ---------- */
    routine(existing = null, defaults = {}) {
      const used = store.all('routines').filter((r) => !existing || r.id !== existing.id).map((r) => +r.weekday);
      const v = existing || { weekday: S.weekdays.find((w) => !used.includes(w.value))?.value || 1, time: '07:00', ...defaults };
      ui.form({
        title: existing ? 'Editar rutina' : 'Nueva rutina',
        values: v,
        fields: [
          { name: 'weekday', label: 'Día', type: 'select', required: true, half: true, options: S.weekdays.map((w) => ({ value: w.value, label: w.label + (used.includes(w.value) ? ' (ocupado)' : '') })) },
          { name: 'time', label: 'Hora', type: 'time', half: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej. Pecho + Tríceps' },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
        onSubmit: (val) => {
          val.weekday = +val.weekday;
          if (used.includes(val.weekday)) return 'Ya existe una rutina para ese día. Edítala o elige otro día.';
          save('routines', existing, val, 'Rutina creada');
        },
        onDelete: existing ? () => remove('routines', existing.id, 'Rutina eliminada') : null,
      });
    },

    exercise(existing = null, routineId = null) {
      const rid = existing ? existing.routine_id : routineId;
      const v = existing || { sets: 3, reps: 10, weight: 0, rest: 90 };
      ui.form({
        title: existing ? 'Editar ejercicio' : 'Nuevo ejercicio',
        values: v,
        fields: [
          { name: 'name', label: 'Ejercicio', type: 'text', required: true },
          { name: 'sets', label: 'Series', type: 'number', min: 1, required: true, half: true },
          { name: 'reps', label: 'Repeticiones', type: 'number', min: 1, required: true, half: true },
          { name: 'weight', label: 'Peso (kg)', type: 'number', min: 0, step: 0.5, half: true },
          { name: 'rest', label: 'Descanso (s)', type: 'number', min: 0, step: 15, half: true },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
        onSubmit: (val) => {
          const order = existing ? existing.order : L.exercisesOf(store.data, rid).length;
          save('exercises', existing, { ...val, routine_id: rid, order }, 'Ejercicio añadido');
        },
        onDelete: existing ? () => remove('exercises', existing.id, 'Ejercicio eliminado') : null,
      });
    },

    workoutLog({ routineId = null, date = U.today(), existing = null } = {}) {
      const routine = existing ? store.get('routines', existing.routine_id) : routineId ? store.get('routines', routineId) : null;
      const rows = existing
        ? existing.exercises.map((e) => ({ ...e }))
        : routine
          ? L.exercisesOf(store.data, routine.id).map((e) => {
            const last = L.lastSetFor(store.data, e.name);
            return { name: e.name, sets: e.sets, reps: e.reps, weight: last ? last.weight : e.weight };
          })
          : [];
      const title = existing ? existing.title : routine ? routine.name : 'Entrenamiento libre';
      const rowHTML = (r, i) => `<tr data-row="${i}">
        <td><input class="input" style="text-align:left" name="name" value="${esc(r.name)}" placeholder="Ejercicio" aria-label="Ejercicio"></td>
        <td><input class="input" name="sets" type="number" min="0" value="${esc(r.sets)}" aria-label="Series"></td>
        <td><input class="input" name="reps" type="number" min="0" value="${esc(r.reps)}" aria-label="Repeticiones"></td>
        <td><input class="input" name="weight" type="number" min="0" step="0.5" value="${esc(r.weight)}" aria-label="Peso"></td>
        <td><button type="button" class="icon-btn sm" data-rm-row aria-label="Quitar">${icon('x')}</button></td></tr>`;
      const body = `<form novalidate>
        <div class="form-grid">
          ${ui._field({ name: 'title', label: 'Entrenamiento', type: 'text', required: true }, { title })}
          ${ui._field({ name: 'date', label: 'Fecha', type: 'date', required: true, half: true }, { date: existing ? existing.date : date })}
          ${ui._field({ name: 'duration', label: 'Duración (min)', type: 'number', half: true }, { duration: existing ? existing.duration : 60 })}
        </div>
        <div class="group-label" style="padding-top:20px"><span>Ejercicios</span><span>series · reps · kg</span></div>
        <div style="overflow-x:auto"><table class="log-table"><thead><tr><th style="min-width:150px">Ejercicio</th><th>Series</th><th>Reps</th><th>Peso</th><th></th></tr></thead>
        <tbody>${rows.map(rowHTML).join('')}</tbody></table></div>
        <button type="button" class="btn btn-ghost sm mt-8" data-add-row>${icon('plus')}Añadir ejercicio</button>
        ${ui._field({ name: 'notes', label: 'Notas', type: 'textarea' }, { notes: existing ? existing.notes : '' })}
        <div class="form-error" hidden></div>
        <div class="modal-actions">${existing ? `<button type="button" class="btn btn-danger-ghost" data-delete>${icon('trash')}Eliminar</button>` : ''}<span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check')}${existing ? 'Guardar' : 'Registrar entrenamiento'}</button></div>
      </form>`;
      const m = ui.modal({ title: existing ? 'Editar entrenamiento' : 'Registrar entrenamiento', subtitle: routine ? `Pesos precargados de tu última sesión.` : '', body, size: 'lg' });
      const form = m.el.querySelector('form');
      const tbody = form.querySelector('tbody');
      form.addEventListener('click', async (e) => {
        if (e.target.closest('[data-add-row]')) {
          tbody.insertAdjacentHTML('beforeend', rowHTML({ name: '', sets: 3, reps: 10, weight: 0 }, tbody.children.length));
          tbody.lastElementChild.querySelector('input').focus();
        }
        const rm = e.target.closest('[data-rm-row]');
        if (rm) rm.closest('tr').remove();
        if (e.target.closest('[data-delete]')) {
          const ok = await ui.confirm({ title: 'Eliminar entrenamiento', message: 'Se quitará de tus estadísticas.', confirmLabel: 'Eliminar', danger: true });
          if (ok) { m.close(); remove('workouts', existing.id, 'Entrenamiento eliminado'); }
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const err = form.querySelector('.form-error');
        const exercises = [...tbody.querySelectorAll('tr')].map((tr) => ({
          name: tr.querySelector('[name=name]').value.trim(),
          sets: +tr.querySelector('[name=sets]').value || 0,
          reps: +tr.querySelector('[name=reps]').value || 0,
          weight: +tr.querySelector('[name=weight]').value || 0,
        })).filter((x) => x.name);
        const val = { title: form.elements.title.value.trim(), date: form.elements.date.value, duration: +form.elements.duration.value || 0, notes: form.elements.notes.value.trim() };
        if (!val.title || !val.date) { err.textContent = 'Completa el nombre y la fecha.'; err.hidden = false; return; }
        if (!existing && store.all('workouts').some((w) => w.date === val.date && w.routine_id === (routine ? routine.id : null) && routine)) { err.textContent = 'Ya registraste esta rutina en esa fecha.'; err.hidden = false; return; }
        save('workouts', existing, { ...val, routine_id: routine ? routine.id : null, exercises }, '💪 Entrenamiento registrado');
        m.close();
      });
    },

    /* ---------- Objetivos ---------- */
    goal(existing = null, defaults = {}) {
      const v = existing || { category: 'Finanzas', unit: 'money', source: 'manual', target_date: U.addMonths(U.today(), 3), current_value: 0, ...defaults };
      ui.form({
        title: existing ? 'Editar objetivo' : 'Nuevo objetivo',
        values: v,
        fields: [
          { name: 'name', label: 'Objetivo', type: 'text', required: true },
          { name: 'description', label: 'Descripción', type: 'textarea' },
          { name: 'category', label: 'Área', type: 'select', options: S.goalCategories, required: true, half: true },
          { name: 'target_date', label: 'Fecha objetivo', type: 'date', half: true },
          { name: 'source', label: 'Cómo se mide el progreso', type: 'select', options: S.goalSources, required: true },
          { name: 'unit', label: 'Unidad', type: 'segmented', options: S.goalUnits, showIf: (x) => x.source === 'manual' },
          { name: 'target_value', label: 'Meta', type: 'number', min: 0, step: 0.01, half: true, hint: 'Para deudas puedes dejarlo vacío: usa el total adeudado.', required: false },
          { name: 'current_value', label: 'Valor actual', type: 'number', min: 0, step: 0.01, half: true, showIf: (x) => x.source === 'manual' },
        ],
        onSubmit: (val) => {
          if (val.source !== 'manual') val.unit = val.source === 'workouts_month' ? 'number' : 'money';
          if (val.source !== 'debts_returned' && !(+val.target_value > 0)) return 'Define una meta mayor que 0.';
          save('goals', existing, val, 'Objetivo creado');
        },
        onDelete: existing ? () => remove('goals', existing.id, 'Objetivo eliminado') : null,
      });
    },

    goalValue(goal) {
      ui.form({
        title: 'Actualizar progreso', subtitle: esc(goal.name), size: 'sm',
        values: { current_value: goal.current_value },
        fields: [{ name: 'current_value', label: 'Valor actual', type: 'number', min: 0, step: 0.01, required: true }],
        onSubmit: (val) => { save('goals', goal, val, '', 'Progreso actualizado'); },
      });
    },
  };

  DOS.forms = forms;
})(window);
