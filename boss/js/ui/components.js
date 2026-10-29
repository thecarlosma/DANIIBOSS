/* DANI OS — componentes de UI reutilizables. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;
  const icon = DOS.icon;
  const esc = U.esc;

  const LOCALES = { USD: 'en-US', EUR: 'es-ES', COP: 'es-CO', MXN: 'es-MX', PEN: 'es-PE', ARS: 'es-AR', CLP: 'es-CL' };
  const NO_DECIMALS = ['COP', 'CLP', 'ARS'];
  const MASK = '••••';

  const ui = {
    /* ---------- Dinero (respeta modo privacidad) ---------- */
    isPrivate() { return !!DOS.store.user().privacy; },
    currency() { return DOS.store.user().currency || 'USD'; },
    money(n, { signed = false, privacy = true } = {}) {
      if (privacy && ui.isPrivate()) return MASK;
      const cur = ui.currency();
      const v = +n || 0;
      const decimals = NO_DECIMALS.includes(cur) || Number.isInteger(U.round2(v)) ? 0 : 2;
      const s = new Intl.NumberFormat(LOCALES[cur] || 'en-US', { style: 'currency', currency: cur, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(v));
      if (v < 0) return `−${s}`;
      return signed && v > 0 ? `+${s}` : s;
    },
    moneyShort(n) {
      if (ui.isPrivate()) return '';
      const v = Math.abs(+n || 0);
      const sign = n < 0 ? '−' : '';
      const sym = ui.currencySymbol();
      if (v >= 1e6) return `${sign}${sym}${U.fmtNum(v / 1e6, 1)}M`;
      if (v >= 1e3) return `${sign}${sym}${U.fmtNum(v / 1e3, 1)}k`;
      return `${sign}${sym}${U.fmtNum(v, 0)}`;
    },
    currencySymbol() {
      const parts = new Intl.NumberFormat(LOCALES[ui.currency()] || 'en-US', { style: 'currency', currency: ui.currency() }).formatToParts(0);
      return (parts.find((p) => p.type === 'currency') || { value: '$' }).value;
    },

    /* ---------- Piezas pequeñas ---------- */
    demoTag(row) { return row && row.is_demo ? '<span class="tag demo" title="Dato de demostración">DEMO</span>' : ''; },
    progress(pct, cls = '') { return `<div class="progress ${cls}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${U.clamp(pct, 0, 100).toFixed(1)}%"></span></div>`; },
    /** Píldora de tendencia. invert=true cuando subir es malo (gastos). */
    trend(pct, { invert = false, suffix = '' } = {}) {
      if (pct === null || pct === undefined || !isFinite(pct)) return '';
      const up = pct > 0.5, down = pct < -0.5;
      const good = invert ? down : up;
      const cls = !up && !down ? 'flat' : good ? 'up' : 'down';
      return `<span class="trend ${cls}">${icon(up ? 'arrowUp' : down ? 'arrowDown' : 'arrowR')}${Math.abs(pct).toFixed(0)}%</span>${suffix ? `<span>${suffix}</span>` : ''}`;
    },
    stat({ label, value, meta = '', iconName, hero = false, size = '', href = '', title = '' }) {
      const tag = href ? 'a' : 'div';
      return `<${tag} class="card stat-card ${hero ? 'hero' : ''} card-hover"${href ? ` href="${href}"` : ''}${title ? ` title="${esc(title)}"` : ''} style="display:block">
        <div class="stat-label">${iconName ? icon(iconName) : ''}${esc(label)}</div>
        <div class="stat-value ${size}">${value}</div>
        ${meta ? `<div class="stat-meta">${meta}</div>` : ''}
      </${tag}>`;
    },
    empty({ iconName = 'info', title, text = '', action = '', actionLabel = '' }) {
      return `<div class="empty"><div class="icon-tile">${icon(iconName)}</div><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}${action ? `<button class="btn btn-secondary sm" data-action="${action}">${icon('plus')}${esc(actionLabel)}</button>` : ''}</div>`;
    },
    segmented(action, options, active) {
      return `<div class="segmented" role="tablist">${options.map((o) => `<button role="tab" aria-selected="${o.value === active}" class="${o.value === active ? 'active' : ''}" data-action="${action}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div>`;
    },
    statusPill(status, label, action = '', id = '') {
      const tag = action ? 'button' : 'span';
      return `<${tag} class="status-pill ${status}" ${action ? `data-action="${action}" data-id="${id}" title="Cambiar estado"` : ''}>${esc(label)}</${tag}>`;
    },
    sectionTitle(title, link = '', linkLabel = 'Ver todo') {
      return `<div class="section-title"><h3>${esc(title)}</h3>${link ? `<a class="link" href="${link}">${esc(linkLabel)}${icon('chevR')}</a>` : ''}</div>`;
    },
    rowActions(editAction, deleteAction, id) {
      return `<div class="row-actions">
        ${editAction ? `<button class="icon-btn sm" data-action="${editAction}" data-id="${id}" aria-label="Editar" title="Editar">${icon('edit')}</button>` : ''}
        ${deleteAction ? `<button class="icon-btn sm" data-action="${deleteAction}" data-id="${id}" aria-label="Eliminar" title="Eliminar">${icon('trash')}</button>` : ''}
      </div>`;
    },
    avatar(name) {
      const hue = [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
      return `<div class="avatar" style="background:hsl(${hue} 22% 18%);color:hsl(${hue} 50% 78%)">${esc(U.initials(name))}</div>`;
    },

    /* ---------- Modal ---------- */
    _modals: [],
    modal({ title, subtitle = '', body, size = '', onClose }) {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
        <button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
        <div class="modal-body">${body}</div></div>`;
      const prevFocus = document.activeElement;
      document.body.appendChild(overlay);
      let closed = false;
      const api = {
        el: overlay,
        body: overlay.querySelector('.modal-body'),
        close() {
          if (closed) return;
          closed = true;
          ui._modals = ui._modals.filter((m) => m !== api);
          overlay.classList.add('closing');
          setTimeout(() => overlay.remove(), 150);
          if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
          onClose && onClose();
        },
      };
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) api.close(); });
      overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
      ui._modals.push(api);
      requestAnimationFrame(() => {
        const first = overlay.querySelector('[autofocus], .modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea, .modal-body button');
        if (first && window.innerWidth > 860) first.focus({ preventScroll: true });
      });
      return api;
    },
    closeTopModal() {
      const top = ui._modals[ui._modals.length - 1];
      if (top) { top.close(); return true; }
      return false;
    },
    confirm({ title = '¿Seguro?', message = '', confirmLabel = 'Confirmar', danger = false } = {}) {
      return new Promise((resolve) => {
        let answered = false;
        const m = ui.modal({
          title, size: 'sm',
          body: `<p class="muted" style="margin:0">${message}</p>
            <div class="modal-actions"><span class="spacer"></span>
            <button class="btn btn-ghost" data-close>Cancelar</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok autofocus>${esc(confirmLabel)}</button></div>`,
          onClose: () => { if (!answered) resolve(false); },
        });
        m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); m.close(); });
        setTimeout(() => m.el.querySelector('[data-ok]').focus(), 30);
      });
    },

    /* ---------- Toast ---------- */
    toast(message, type = 'success', { action, duration = 3200 } = {}) {
      let host = document.querySelector('.toasts');
      if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      const ic = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
      el.innerHTML = `${icon(ic)}<span style="flex:1">${esc(message)}</span>${action ? `<button class="btn btn-ghost sm" data-undo>${esc(action.label)}</button>` : ''}`;
      host.appendChild(el);
      const remove = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); };
      const t = setTimeout(remove, action ? duration + 2500 : duration);
      if (action) el.querySelector('[data-undo]').addEventListener('click', () => { clearTimeout(t); action.fn(); remove(); });
    },

    /* ---------- Formularios ---------- */
    /**
     * fields: [{ name, label, type, options, required, half, placeholder, hint, min, max, step, showIf(values) }]
     * type: text | number | money | date | time | select | textarea | toggle | segmented | emoji
     * onSubmit(values) → string (error) | void
     */
    form({ title, subtitle = '', fields, values = {}, submitLabel = 'Guardar', onSubmit, onDelete, size = '', extra = '' }) {
      const body = `<form class="form" novalidate>
        <div class="form-grid">${fields.map((f) => ui._field(f, values)).join('')}</div>
        ${extra}
        <div class="form-error" hidden></div>
        <div class="modal-actions">
          ${onDelete ? `<button type="button" class="btn btn-danger-ghost" data-delete>${icon('trash')}Eliminar</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check')}${esc(submitLabel)}</button>
        </div></form>`;
      const m = ui.modal({ title, subtitle, body, size });
      const form = m.el.querySelector('form');
      const errBox = form.querySelector('.form-error');

      const read = () => {
        const out = {};
        fields.forEach((f) => {
          const el = form.elements[f.name];
          if (!el) return;
          if (f.type === 'toggle') out[f.name] = el.checked;
          else if (f.type === 'segmented' || f.type === 'emoji') out[f.name] = el.value === '' ? null : JSON.parse(el.value);
          else if (f.type === 'number' || f.type === 'money') out[f.name] = el.value === '' ? '' : U.round2(parseFloat(el.value));
          else out[f.name] = el.value.trim();
        });
        return out;
      };
      const applyVisibility = () => {
        const v = read();
        fields.forEach((f) => {
          if (!f.showIf) return;
          const wrap = form.querySelector(`[data-field="${f.name}"]`);
          if (wrap) wrap.classList.toggle('hidden', !f.showIf(v));
        });
      };
      form.addEventListener('click', (e) => {
        const seg = e.target.closest('[data-seg]');
        if (!seg) return;
        const wrap = seg.closest('.segmented');
        wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === seg));
        form.elements[seg.dataset.seg].value = seg.dataset.v;
        applyVisibility();
      });
      form.addEventListener('input', applyVisibility);
      form.addEventListener('change', applyVisibility);
      applyVisibility();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = read();
        form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
        const missing = fields.filter((f) => {
          const wrap = form.querySelector(`[data-field="${f.name}"]`);
          if (wrap && wrap.classList.contains('hidden')) return false;
          const val = v[f.name];
          const empty = val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val));
          const belowMin = f.min !== undefined && val !== '' && +val < f.min;
          return (f.required && empty) || belowMin;
        });
        if (missing.length) {
          missing.forEach((f) => form.elements[f.name] && form.elements[f.name].classList && form.elements[f.name].classList.add('invalid'));
          errBox.textContent = missing.some((f) => f.min !== undefined && v[f.name] !== '' && +v[f.name] < f.min)
            ? 'Revisa los importes: deben ser positivos.'
            : 'Completa los campos obligatorios.';
          errBox.hidden = false;
          return;
        }
        // Campos ocultos por showIf no se guardan con valores residuales
        fields.forEach((f) => { const w = form.querySelector(`[data-field="${f.name}"]`); if (w && w.classList.contains('hidden')) v[f.name] = f.type === 'toggle' ? false : ''; });
        const err = onSubmit(v);
        if (typeof err === 'string' && err) { errBox.textContent = err; errBox.hidden = false; return; }
        m.close();
      });
      if (onDelete) {
        form.querySelector('[data-delete]').addEventListener('click', async () => {
          const ok = await ui.confirm({ title: 'Eliminar registro', message: 'Esta acción no se puede deshacer desde aquí.', confirmLabel: 'Eliminar', danger: true });
          if (ok) { m.close(); onDelete(); }
        });
      }
      return m;
    },

    _field(f, values) {
      const v = values[f.name] !== undefined ? values[f.name] : f.value !== undefined ? f.value : '';
      const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`;
      const req = f.required ? ' required' : '';
      const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
      const opts = (f.options || []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
      let control = '';
      switch (f.type) {
        case 'textarea':
          control = `<textarea class="textarea" id="${id}" name="${f.name}"${ph}>${esc(v)}</textarea>`; break;
        case 'select':
          control = `<select class="select" id="${id}" name="${f.name}"${req}>${f.required ? '' : '<option value="">—</option>'}${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
        case 'toggle':
          return `<div class="field ${f.half ? 'half' : ''}" data-field="${f.name}"><label class="toggle"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}><span class="track"></span><span>${esc(f.label)}</span></label>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
        case 'segmented':
        case 'emoji': {
          const cur = opts.find((o) => o.value === v) || opts[0];
          control = `<input type="hidden" name="${f.name}" value='${esc(JSON.stringify(cur ? cur.value : null))}'>
            <div class="segmented" ${f.type === 'emoji' ? 'style="flex-wrap:wrap"' : ''}>${opts.map((o) => `<button type="button" data-seg="${f.name}" data-v='${esc(JSON.stringify(o.value))}' class="${cur && o.value === cur.value ? 'active' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
          break;
        }
        case 'money':
          control = `<div class="input-money"><span class="prefix">${esc(ui.currencySymbol())}</span><input class="input" id="${id}" name="${f.name}" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(v)}"${ph}${req}></div>`; break;
        default: {
          const type = f.type || 'text';
          const extra = `${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''}${f.step ? ` step="${f.step}"` : ''}${type === 'number' ? ' inputmode="decimal"' : ''}${f.list ? ` list="${id}_list"` : ''}`;
          control = `<input class="input" id="${id}" name="${f.name}" type="${type}" value="${esc(v)}"${ph}${req}${extra} autocomplete="off">`;
          if (f.list) control += `<datalist id="${id}_list">${f.list.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
        }
      }
      return `<div class="field ${f.half ? 'half' : ''}" data-field="${f.name}">
        <label for="${id}">${esc(f.label)}${f.required ? '' : ' <span class="faint">(opcional)</span>'}</label>
        ${control}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
    },

    /* ---------- Gráficos (SVG medido al ancho real del contenedor) ---------- */
    _charts: {},
    _chartSeq: 0,
    resetCharts() { ui._charts = {}; },
    chart(spec) {
      const id = `c${++ui._chartSeq}`;
      ui._charts[id] = spec;
      return `<div class="chart-host" data-chart="${id}" style="height:${spec.height || 200}px"></div>`;
    },
    drawCharts(rootEl = document) {
      rootEl.querySelectorAll('[data-chart]').forEach((el) => {
        const spec = ui._charts[el.dataset.chart];
        if (!spec) return;
        const w = Math.max(200, el.clientWidth || 400);
        el.innerHTML = spec.type === 'line' ? ui._line(spec, w) : ui._bars(spec, w);
      });
    },
    _niceMax(v) {
      if (v <= 0) return 1;
      const exp = Math.pow(10, Math.floor(Math.log10(v)));
      const f = v / exp;
      return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
    },
    _bars(s, W) {
      const H = s.height || 200;
      const fmt = s.fmt || ui.moneyShort;
      const full = s.fmtFull || ((v) => ui.money(v));
      const hideAxis = s.axis === false || (!s.fmt && ui.isPrivate());
      const padL = hideAxis ? 6 : 46, padR = 6, padT = 10, padB = 24;
      const iw = W - padL - padR, ih = H - padT - padB;
      const all = s.data.flatMap((d) => d.values);
      const max = ui._niceMax(Math.max(...all, 0));
      const n = s.series.length;
      const gw = iw / Math.max(1, s.data.length);
      const bw = Math.max(3, Math.min(s.barMax || 26, (gw * 0.7 - (n - 1) * 3) / n));
      const every = Math.max(1, Math.ceil(s.data.length / Math.max(1, Math.floor(iw / 46))));
      let g = '';
      [0, 0.5, 1].forEach((t) => {
        const y = padT + ih - t * ih;
        g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
        if (padL > 10) g += `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end">${esc(fmt(max * t))}</text>`;
      });
      s.data.forEach((d, i) => {
        const x0 = padL + i * gw + (gw - (bw * n + (n - 1) * 3)) / 2;
        d.values.forEach((v, j) => {
          const h = v > 0 ? Math.max(2, (v / max) * ih) : 0;
          const dim = s.highlight !== undefined && s.highlight !== i ? ' opacity="0.4"' : '';
          const act = s.action ? ` data-action="${s.action}" data-value="${esc(d.key)}" style="cursor:pointer"` : '';
          g += `<rect class="bar" x="${x0 + j * (bw + 3)}" y="${padT + ih - h}" width="${bw}" height="${h}" rx="${Math.min(4, bw / 2)}" fill="${s.series[j].color}"${dim}${act}><title>${esc(d.title || d.label)} · ${esc(s.series[j].name)}: ${esc(full(v))}</title></rect>`;
          if (s.action) g += `<rect x="${padL + i * gw}" y="${padT}" width="${gw}" height="${ih}" fill="transparent" data-action="${s.action}" data-value="${esc(d.key)}" style="cursor:pointer"><title>${esc(d.title || d.label)}: ${esc(full(v))}</title></rect>`;
        });
        if (i % every === 0) g += `<text x="${padL + i * gw + gw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
      });
      return `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label || 'Gráfico de barras')}">${g}</svg>`;
    },
    _line(s, W) {
      const H = s.height || 200;
      const color = s.color || '#8654D6';
      const fmt = s.fmt || ui.moneyShort;
      const full = s.fmtFull || ((v) => ui.money(v));
      const padL = !s.fmt && ui.isPrivate() ? 6 : 50, padR = 10, padT = 12, padB = 24;
      const iw = W - padL - padR, ih = H - padT - padB;
      const vals = s.data.map((d) => d.value);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
      const allPositive = lo >= 0;
      lo -= pad; hi += pad;
      if (allPositive) lo = Math.max(0, lo);
      const x = (i) => padL + (s.data.length === 1 ? iw / 2 : (i / (s.data.length - 1)) * iw);
      const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
      const gid = `g${Math.random().toString(36).slice(2, 7)}`;
      const pts = s.data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
      let g = `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
      [0, 0.5, 1].forEach((t) => {
        const v = lo + t * (hi - lo);
        const yy = y(v);
        g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`;
        if (padL > 10) g += `<text x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${esc(fmt(v))}</text>`;
      });
      g += `<path d="M${pts[0]} L${pts.join(' L')} L${x(s.data.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z" fill="url(#${gid})"/>`;
      g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = s.data.length - 1;
      g += `<circle cx="${x(last)}" cy="${y(s.data[last].value)}" r="4" fill="${color}" stroke="#111112" stroke-width="2"/>`;
      const every = Math.max(1, Math.ceil(s.data.length / Math.max(1, Math.floor(iw / 70))));
      const step = s.data.length > 1 ? iw / (s.data.length - 1) : iw;
      s.data.forEach((d, i) => {
        if (i % every === 0 || i === last) {
          if (i !== last && last - i < every / 2) return;
          g += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === last ? 'end' : 'middle'}">${esc(d.label)}</text>`;
        }
        g += `<rect x="${x(i) - step / 2}" y="${padT}" width="${step}" height="${ih}" fill="transparent"><title>${esc(d.title || d.label)}: ${esc(full(d.value))}</title></rect>`;
      });
      return `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label || 'Gráfico de línea')}">${g}</svg>`;
    },
    /** Donut + leyenda (tamaño fijo, no necesita medición) */
    donut(items, { total, centerLabel = 'Total', max = 6 } = {}) {
      if (!items.length) return '';
      const top = items.slice(0, max);
      const rest = items.slice(max);
      if (rest.length) top.push({ key: 'Otros', value: U.sum(rest, (r) => r.value), color: '#55555C' });
      const sum = total ?? U.sum(top, (x) => x.value);
      const r = 52, C = 2 * Math.PI * r;
      let off = 0;
      const segs = top.map((it) => {
        const len = sum > 0 ? (it.value / sum) * C : 0;
        const gap = top.length > 1 ? Math.min(2, len / 3) : 0;
        const seg = `<circle r="${r}" cx="66" cy="66" fill="none" stroke="${it.color}" stroke-width="14" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"><title>${esc(it.key)}: ${esc(ui.money(it.value))}</title></circle>`;
        off += len;
        return seg;
      }).join('');
      return `<div class="donut-host"><div class="donut-wrap">
        <svg class="chart" viewBox="0 0 132 132" role="img" aria-label="Distribución">
          <circle r="${r}" cx="66" cy="66" fill="none" stroke="#1D1D20" stroke-width="14"/>${segs}
          <text x="66" y="62" text-anchor="middle" style="font-size:10px;fill:#9A9AA0">${esc(centerLabel)}</text>
          <text x="66" y="80" text-anchor="middle" style="font-size:15px;font-weight:650;fill:#fff">${esc(ui.isPrivate() ? '••••' : ui.moneyShort(sum))}</text>
        </svg>
        <div class="donut-legend">${top.map((it) => `<div class="lrow"><i style="background:${it.color}"></i><span class="n">${esc(it.key)}</span><span class="num">${ui.money(it.value)}</span><span class="faint num pct">${U.fmtPct(U.pct(it.value, sum))}</span></div>`).join('')}</div>
      </div></div>`;
    },
    hbars(items, { fmt = (v) => ui.money(v), max } = {}) {
      const m = max ?? Math.max(...items.map((i) => i.value), 0);
      return `<div class="hbar">${items.map((it) => `<div class="hbar-row"><div class="top"><span class="n">${it.color ? `<i style="background:${it.color}"></i>` : ''}${esc(it.key)}</span><span class="num">${fmt(it.value)}</span></div>
        <div class="progress sm"><span style="width:${m > 0 ? (it.value / m) * 100 : 0}%;${it.color ? `background:${it.color}` : ''}"></span></div></div>`).join('')}</div>`;
    },
  };

  DOS.ui = ui;
})(window);
