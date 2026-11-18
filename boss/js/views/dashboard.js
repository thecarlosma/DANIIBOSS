/* DANI OS — Dashboard: la cabina del día. Un dial con tus bloques, lo que toca ahora y lo esencial. */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, S = DOS.schema, F = DOS.finance, L = DOS.life;
  const store = DOS.store, ui = DOS.ui, icon = DOS.icon, esc = U.esc, e3d = DOS.e3d, e3dFor = DOS.e3dFor;
  DOS.views = DOS.views || {};

  /* Estado de la vista: sobrevive al refresco de cada minuto y a la sincronización */
  const dial = { scrub: null, dragging: false, timer: 0, anim: 0 };
  const player = { id: null };
  const week = { sel: null };
  let mode = 'all';

  const MODES = [
    { value: 'all', label: 'Todo', emoji: '✨' },
    { value: 'money', label: 'Dinero', emoji: '💰' },
    { value: 'day', label: 'Día', emoji: '📅' },
    { value: 'body', label: 'Cuerpo', emoji: '💪' },
  ];

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  const nowMin = () => U.toMin(U.nowTime());
  const timeline = () => L.dayTimeline(store.data, U.today());
  const emojiOf = (it) => e3dFor(it.title, it.category);
  const hhmm = (min) => U.fromMin(Math.min(1439, min));

  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  /* ---------- Dial: mediodía arriba, medianoche abajo, como el recorrido del sol ---------- */
  const SIZE = 400, C = SIZE / 2, R = 149;
  const toXY = (min, r) => {
    const a = ((min - 720) / 1440) * Math.PI * 2;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  function arc(start, end, r) {
    const span = Math.min(1439, end - start);
    const [x0, y0] = toXY(start, r), [x1, y1] = toXY(start + span, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${span > 720 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function coreBody(min, isNow) {
    const items = timeline();
    const it = L.timelineAt(items, min);
    const next = L.timelineNext(items, min);
    if (it) {
      const sub = isNow ? `Quedan ${U.fmtDuration(it.end - min)}` : `${hhmm(it.start)} – ${hhmm(it.end)}`;
      return `${e3d(emojiOf(it), { size: 84, play: true })}<b class="num">${hhmm(min)}</b><span>${esc(it.title)}</span><small>${esc(sub)}</small>`;
    }
    if (!items.length) return `${e3d('🌅', { size: 84, play: true })}<b class="num">${hhmm(min)}</b><span>Planifica tu día</span><small>Toca para crear un bloque</small>`;
    const night = min >= 1200 || min < 360;
    const sub = isNow ? (next ? `Lo siguiente a las ${hhmm(next.start)}` : 'Nada más por hoy') : 'Toca para planificar';
    return `${e3d(night ? '🌙' : '☕', { size: 84, play: true })}<b class="num">${hhmm(min)}</b><span>Tiempo libre</span><small>${esc(sub)}</small>`;
  }

  function dialMarkup(items, now) {
    const segs = items.filter((i) => i.kind === 'block').map((b, i) => {
      const gap = b.end - b.start > 14 ? 4 : 1;
      const cls = b.done ? 'done' : now >= b.start && now < b.end ? 'now' : b.end <= now ? 'past' : '';
      const d = arc(b.start + gap, b.end - gap, R);
      return `<path class="seg ${cls}" pathLength="1" d="${d}" style="--d:${i * 70}ms"/><path class="seg-hi ${cls}" pathLength="1" d="${d}" style="--d:${i * 70}ms"/>`;
    }).join('');
    const events = items.filter((i) => i.kind === 'event').map((e) => {
      const [x, y] = toXY(e.start, 128);
      return `<circle class="ev" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`;
    }).join('');
    const label = (min, text) => { const [x, y] = toXY(min, 118); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${text}</text>`; };
    return `<div class="dial" data-dial>
      <div class="dial-halo" aria-hidden="true"></div>
      <img class="dial-bezel" src="assets/r3d/bezel.webp" width="1000" height="1000" alt="" draggable="false">
      <svg class="dial-svg" viewBox="0 0 ${SIZE} ${SIZE}" role="slider" tabindex="0" aria-label="Hora del día. Muévelo para ver qué tienes a cada hora." aria-valuemin="0" aria-valuemax="1439">
        <path class="elapsed" d="${arc(0, Math.max(1, now), R)}"/>
        ${segs}${events}
        <g class="hours" aria-hidden="true">${label(360, '6')}${label(1080, '18')}</g>
        <circle class="hit" cx="${C}" cy="${C}" r="${R}"/>
        <g class="knob" data-knob aria-hidden="true"><circle class="knob-halo" r="17"/><image href="assets/r3d/ball.webp" x="-15" y="-15" width="30" height="30"/></g>
      </svg>
      <span class="dial-sun" aria-hidden="true">${e3d('☀️', { size: 30, eager: true })}</span>
      <span class="dial-moon" aria-hidden="true">${e3d('🌙', { size: 28, eager: true })}</span>
      <button class="dial-core" data-action="dial-core" data-core aria-live="polite"></button>
    </div>`;
  }

  function paintDial(scope) {
    const wrap = scope.querySelector('[data-dial]');
    if (!wrap) return;
    const now = nowMin();
    const min = dial.scrub === null ? now : dial.scrub;
    const [x, y] = toXY(min, R);
    wrap.querySelector('[data-knob]').setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const svg = wrap.querySelector('.dial-svg');
    svg.setAttribute('aria-valuenow', min);
    svg.setAttribute('aria-valuetext', hhmm(min));
    wrap.querySelector('[data-core]').innerHTML = coreBody(min, dial.scrub === null);
    const back = scope.querySelector('[data-dial-back]');
    if (back) back.hidden = dial.scrub === null;
  }

  function paintPlayer(scope) {
    const host = scope.querySelector('[data-player]');
    if (host) host.innerHTML = playerBody();
  }

  /** Mueve la perilla por el aro, no en línea recta. */
  function glideTo(scope, target) {
    cancelAnimationFrame(dial.anim);
    const from = dial.scrub === null ? nowMin() : dial.scrub;
    if (reducedMotion() || target === null) { dial.scrub = target; paintDial(scope); return; }
    const t0 = performance.now(), dur = 420;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      dial.scrub = Math.round(from + (target - from) * e);
      paintDial(scope);
      if (k < 1) dial.anim = requestAnimationFrame(step);
    };
    dial.anim = requestAnimationFrame(step);
  }

  function armReturn(scope) {
    clearTimeout(dial.timer);
    dial.timer = setTimeout(() => {
      if (dial.dragging) return;
      dial.scrub = null; player.id = null;
      paintDial(scope); paintPlayer(scope);
    }, 12000);
  }

  function bindDial(scope) {
    const wrap = scope.querySelector('[data-dial]');
    if (!wrap) return;
    const svg = wrap.querySelector('.dial-svg'), hit = wrap.querySelector('.hit');
    const minAt = (e) => {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const a = Math.atan2(dx, -dy);
      const m = ((a / (Math.PI * 2)) * 1440 + 720 + 1440) % 1440;
      return Math.round(m / 5) * 5 % 1440;
    };
    const follow = () => {
      const it = L.timelineAt(timeline(), dial.scrub);
      player.id = it ? it.id : null;
      paintPlayer(scope);
      armReturn(scope);
    };
    // En iPhone touch-action no basta sobre elementos SVG: el gesto se reclama aquí para que no desplace la página
    hit.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    hit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hit.setPointerCapture(e.pointerId);
      dial.dragging = true;
      wrap.classList.add('drag');
      clearTimeout(dial.timer);
      dial.scrub = minAt(e);
      paintDial(scope);
    });
    hit.addEventListener('pointermove', (e) => {
      if (!dial.dragging) return;
      const m = minAt(e);
      if (m === dial.scrub) return;
      dial.scrub = m;
      paintDial(scope);
    });
    const end = () => {
      if (!dial.dragging) return;
      dial.dragging = false;
      wrap.classList.remove('drag');
      follow();
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      const delta = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 }[e.key];
      if (!delta) return;
      e.preventDefault();
      const base = dial.scrub === null ? nowMin() : dial.scrub;
      dial.scrub = (base + delta + 1440) % 1440;
      paintDial(scope);
      follow();
    });
  }

  /* ---------- Ahora: tu bloque actual, como un reproductor ---------- */
  function playerBody() {
    const items = timeline(), now = nowMin();
    if (!items.length) {
      return `<div class="pl-empty">${e3d('🌅', { size: 96, play: true })}<div><h3>Sin bloques hoy</h3><p>Dale forma a tu día en un minuto.</p></div>
        <button class="btn btn-primary" data-action="dial-add">${icon('plus')}Crear bloque</button></div>`;
    }
    const it = items.find((i) => i.id === player.id) || L.timelineAt(items, now) || L.timelineNext(items, now) || items[items.length - 1];
    const idx = items.indexOf(it);
    const isNow = now >= it.start && now < it.end;
    const state = isNow ? 'Ahora' : it.start > now ? `En ${U.fmtDuration(it.start - now)}` : 'Antes';
    const pct = it.done || it.end <= now ? 100 : isNow ? ((now - it.start) / (it.end - it.start)) * 100 : 0;
    const editC = it.kind === 'event' ? 'events' : 'day_blocks';
    const main = it.kind === 'event'
      ? `<button class="pl-main" data-action="edit" data-c="events" data-id="${it.id}" aria-label="Ver evento">${icon('edit')}</button>`
      : `<button class="pl-main ${it.done ? 'on' : ''}" data-action="dash-done" data-id="${it.id}" aria-pressed="${it.done}" aria-label="${it.done ? 'Marcar pendiente' : 'Completar bloque'}">${icon('check')}</button>`;
    return `<div class="pl-top" data-action="edit" data-c="${editC}" data-id="${it.id}">
        <div class="pl-art">${e3d(emojiOf(it), { size: 104, play: true })}</div>
        <div class="pl-info"><span class="pl-state ${isNow ? 'live' : ''}">${isNow ? '<i></i>' : ''}${esc(state)}</span><h3>${esc(it.title)}</h3><small>${it.kind === 'event' ? esc(it.category) : `${idx + 1} de ${items.length} hoy`}</small></div>
      </div>
      <div class="pl-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="pl-times num"><span>${hhmm(it.start)}</span><span>${hhmm(it.end)}</span></div>
      <div class="pl-ctrl">
        <button class="pl-nav" data-action="dash-step" data-value="-1" aria-label="Anterior" ${idx === 0 ? 'disabled' : ''}>${icon('chevL')}</button>
        ${main}
        <button class="pl-nav" data-action="dash-step" data-value="1" aria-label="Siguiente" ${idx === items.length - 1 ? 'disabled' : ''}>${icon('chevR')}</button>
      </div>`;
  }

  /* ---------- Tu semana: curva de gastos ---------- */
  function curve(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }

  function weekBody(d, T) {
    const days = F.dailySeries(d.expenses, U.addDays(T, -6), T);
    const max = Math.max(1, ...days.map((x) => x.value));
    const pts = days.map((x, i) => [4 + (i / 6) * 92, 84 - (x.value / max) * 70]);
    const line = curve(pts);
    const sel = days.find((x) => x.date === week.sel) || days[days.length - 1];
    const total = U.sum(days, (x) => x.value);
    return `<div class="tile-head"><span class="tile-k">${e3d('📈', { size: 38 })}Tu semana</span><span class="eq-read"><span>${esc(U.capitalize(U.relDay(sel.date, T)))}</span><b class="num" data-eq-val>${ui.money(sel.value)}</b></span></div>
      <div class="eq-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pts.map((p) => `<line class="eq-grid" x1="${p[0]}" x2="${p[0]}" y1="0" y2="100"/>`).join('')}<defs><linearGradient id="eqFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8E6EED" stop-opacity=".42"/><stop offset="1" stop-color="#8E6EED" stop-opacity="0"/></linearGradient></defs>
          <path d="${line}L96 100L4 100Z" fill="url(#eqFill)"/><path class="eq-line" d="${line}"/></svg>
        ${days.map((x, i) => `<button class="eq-node ${x.date === sel.date ? 'on' : ''}" style="left:${pts[i][0]}%;top:${pts[i][1]}%" data-action="dash-day" data-value="${x.date}" aria-pressed="${x.date === sel.date}" aria-label="${esc(U.fmtDate(x.date))}: ${esc(ui.money(x.value))}"><i></i></button>`).join('')}
      </div>
      <div class="eq-days">${days.map((x, i) => `<span class="${x.date === sel.date ? 'on' : ''}" style="left:${pts[i][0]}%">${esc(U.capitalize(U.fmtDate(x.date, { weekday: 'short' })).replace('.', ''))}</span>`).join('')}</div>
      <p class="tile-foot">Gastaste <b class="num">${ui.money(total)}</b> en 7 días</p>`;
  }

  /* ---------- Piezas pequeñas ---------- */
  const tileAttrs = (group, span, extra = '') => `class="tile ${extra}" data-g="${group}" data-tilt style="--s:${span}"${mode !== 'all' && mode !== group ? ' hidden' : ''}`;

  function taskRow(t) {
    const done = t.status === 'completada';
    return `<div class="tk">
      <button class="check round ${done ? 'on' : ''}" data-action="task-toggle" data-id="${t.id}" aria-label="${done ? 'Marcar pendiente' : 'Completar'}">${icon('check')}</button>
      <span class="tk-t ${done ? 'done-text' : ''}" data-action="edit" data-c="tasks" data-id="${t.id}">${esc(t.title)}</span>
      ${t.priority === 'alta' && !done ? '<i class="hot" title="Prioridad alta"></i>' : ''}
    </div>`;
  }

  function ring(pct, big, small, label) {
    return `<div class="ring" style="--p:${U.clamp(pct, 0, 100).toFixed(1)}" role="img" aria-label="${esc(label)}"><div class="ring-in"><b class="num">${big}</b><small>${esc(small)}</small></div></div>`;
  }

  function countUp(el) {
    const n = el.querySelector('[data-count]');
    if (!n || ui.isPrivate() || reducedMotion()) return;
    const target = +n.dataset.count || 0, t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      n.textContent = ui.money(k === 1 ? target : Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Las tarjetas se inclinan hacia el cursor y el emoji sale de ellas. */
  function bindTilt(scope) {
    if (!fineHover() || reducedMotion()) return;
    let cur = null;
    const reset = (c) => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); };
    scope.addEventListener('pointermove', (e) => {
      const card = e.target.closest('[data-tilt]');
      if (cur && cur !== card) reset(cur);
      cur = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      const amt = Math.min(1, 320 / r.width);
      card.style.setProperty('--rx', `${(-y * 7 * amt).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(x * 7 * amt).toFixed(2)}deg`);
    }, { passive: true });
    scope.addEventListener('pointerleave', () => { if (cur) reset(cur); cur = null; });
  }

  /** Los objetos cobran vida de uno en uno: hay movimiento sin que nada compita por la atención. */
  let ambient = 0;
  function bindLife(scope) {
    clearInterval(ambient);
    scope.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const host = e.target.closest('.tile, .quick button, .modes button');
      if (host) DOS.e3dWake(host.querySelector('img[data-a]'));
    });
    scope.addEventListener('click', (e) => {
      const host = e.target.closest('.tile, .quick button, .modes button, .hab');
      if (host) DOS.e3dWake(host.querySelector('img[data-a]'));
    });
    ambient = setInterval(() => {
      if (!document.contains(scope)) { clearInterval(ambient); return; }
      if (document.hidden) return;
      const list = [...scope.querySelectorAll('img[data-a]:not([data-on])')].filter((i) => {
        const r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && i.offsetParent;
      });
      if (list.length) DOS.e3dWake(list[Math.floor(Math.random() * list.length)]);
    }, 2400);
  }

  /** Deja ver la animación del control antes de que la vista se refresque. */
  function animated(el, on, fn) {
    el.classList.toggle('on', on);
    el.classList.add('pop');
    setTimeout(fn, 200);
    return false;
  }

  DOS.views.dashboard = {
    title: 'Dashboard',
    busy: () => dial.dragging,

    render() {
      const d = store.data, T = U.today(), now = nowMin();
      const user = store.user();
      const cap = F.capitalOverview(d, T);
      const debts = F.debtsOverview(d, T);
      const day = F.dayAnalysis(d, T);
      const incToday = F.sumPeriod(d.income, T, T);
      const items = timeline();
      const blocks = items.filter((i) => i.kind === 'block');
      const doneBlocks = blocks.filter((b) => b.done).length;
      const planned = U.sum(blocks, (b) => b.end - b.start);
      const tasks = L.taskBuckets(d.tasks, T).today;
      const tasksOpen = tasks.filter((t) => t.status !== 'completada');
      const eventsToday = L.eventsOn(d, T);
      const nextEvt = L.nextEvent(d, T, U.nowTime());
      const train = L.nextTraining(d, T);
      const trainedToday = L.workoutOn(d, T);
      const habits = d.habits.map((h) => ({ h, s: L.habitStats(h, d.habit_logs, T) }));
      const insight = DOS.intelligence.insights(d, (n) => ui.money(n), T)[0];
      const subs = F.subscriptionsOverview(d, T).upcoming.filter((s) => s.daysLeft <= 7);
      const last14 = Array.from({ length: 14 }, (_, i) => U.addDays(T, i - 13));
      const sessions = last14.filter((x) => L.workoutOn(d, x)).length;

      const parts = [];
      if (tasksOpen.length) parts.push(plural(tasksOpen.length, 'tarea', 'tareas'));
      if (eventsToday.length) parts.push(plural(eventsToday.length, 'evento', 'eventos'));
      const summary = parts.length ? `Hoy tienes ${parts.join(' y ')}.` : 'Tu día está despejado.';

      return `<div class="cab" data-mode="${mode}">
      <div class="cab-orbs" aria-hidden="true"><i></i><i></i></div>

      <header class="cab-head">
        <div>
          <p class="cab-date"><i></i>${esc(U.capitalize(U.fmtDateLong(T)))}</p>
          <h1>${greeting()}${user.name ? `, <em>${esc(user.name)}</em>` : ''}</h1>
          <p class="cab-sub">${summary}</p>
        </div>
        <button class="orb-btn" data-action="capture" aria-label="Dictar o escribir un registro" title="Dictar o escribir (V)">${icon('mic')}</button>
      </header>

      <section class="vault" aria-label="Saldo disponible">
        <a class="tile-link" href="#/capital" aria-label="Ver capital"></a>
        <div class="vault-main">
          <span class="vault-art">${e3d('💰', { size: 96, play: true })}</span>
          <div class="vault-num">
            <span class="vault-k">Saldo disponible</span>
            <div class="vault-v num" data-count="${cap.available}">${ui.money(cap.available)}</div>
          </div>
        </div>
        <div class="vault-side">
          <div><span>Libre tras compromisos</span><b class="num">${ui.money(cap.free)}</b></div>
          <div><span>Patrimonio neto</span><b class="num">${ui.money(cap.netWorth)}</b></div>
        </div>
        <button class="icon-btn vault-eye" data-action="privacy" aria-label="${ui.isPrivate() ? 'Mostrar cantidades' : 'Ocultar cantidades'}" title="${ui.isPrivate() ? 'Mostrar cantidades' : 'Ocultar cantidades'}">${icon(ui.isPrivate() ? 'eyeOff' : 'eye')}</button>
      </section>

      <section class="cockpit" aria-label="Tu día">
        <div class="deck deck-dial" data-tilt-off>
          <div class="deck-side">
            <div class="stat"><b class="num">${doneBlocks}<small>/${blocks.length}</small></b><span>Bloques</span></div>
            <div class="stat"><b class="num">${planned ? U.fmtDuration(planned) : '—'}</b><span>Planificado</span></div>
          </div>
          ${dialMarkup(items, now)}
          <div class="deck-btns">
            <button class="orb-btn sm" data-action="dial-add" aria-label="Nuevo bloque" title="Nuevo bloque">${icon('plus')}</button>
            <a class="orb-btn sm" href="#/dia" aria-label="Abrir Mi Día" title="Abrir Mi Día">${icon('sun')}</a>
            <a class="orb-btn sm" href="#/calendario" aria-label="Abrir calendario" title="Abrir calendario">${icon('calendar')}</a>
          </div>
          <button class="dial-back" data-action="dial-now" data-dial-back hidden>${icon('clock')}Volver a ahora</button>
        </div>

        <div class="cockpit-side">
          <div class="deck deck-player" data-player>${playerBody()}</div>
          <div class="quick">
            <button data-action="add-expense"><span>${e3d('💸', { size: 46 })}</span>Gasto</button>
            <button data-action="add-income"><span>${e3d('💰', { size: 46 })}</span>Ingreso</button>
            <button data-action="add-task"><span>${e3d('✅', { size: 46 })}</span>Tarea</button>
            <button data-action="add-event"><span>${e3d('📅', { size: 46 })}</span>Evento</button>
          </div>
        </div>
      </section>

      <div class="modes" role="group" aria-label="Filtrar tarjetas">
        ${MODES.map((m) => `<button class="${m.value === mode ? 'on' : ''}" aria-pressed="${m.value === mode}" data-action="dash-mode" data-value="${m.value}">${e3d(m.emoji, { size: 26 })}${m.label}</button>`).join('')}
      </div>

      <div class="tiles" data-tiles>
        <div ${tileAttrs('money', 6, 'half')}>
          <a class="tile-link" href="#/gastos" aria-label="Ver gastos"></a>
          <div class="tile-head"><span class="tile-k">${e3d('💸', { size: 38 })}Gastado hoy</span></div>
          <div class="tile-v num">${ui.money(day.total)}</div>
          <p class="tile-foot">${day.vsAvgPct === null ? 'Sin promedio aún' : `${ui.trend(day.vsAvgPct, { invert: true })} vs promedio`}${incToday > 0 ? ` · <span class="pos num">+${ui.money(incToday)}</span>` : ''}</p>
        </div>

        <div ${tileAttrs('money', 6, 'half')}>
          <a class="tile-link" href="#/deudas" aria-label="Ver deudas"></a>
          <div class="tile-head"><span class="tile-k">${e3d('🤝', { size: 38 })}Deudas</span></div>
          <div class="tile-v num">${ui.money(debts.totalPending)}</div>
          <div class="tile-meter">${ui.progress(debts.progress)}<span class="num">${U.fmtPct(debts.progress)}</span></div>
        </div>

        <div ${tileAttrs('money', subs.length ? 8 : 12, 'tile-eq')} data-week>${weekBody(d, T)}</div>

        ${subs.length ? `<div ${tileAttrs('money', 4)}>
          <div class="tile-head"><span class="tile-k">${e3d('💳', { size: 38 })}Próximo cobro</span></div>
          <div class="tile-v sm">${esc(subs[0].sub.name)}</div>
          <p class="tile-foot"><b class="num">${ui.money(subs[0].sub.amount)}</b> · ${esc(U.relDay(subs[0].sub.next_date, T))}</p>
          <button class="btn btn-secondary sm tile-cta" data-action="pay-sub" data-id="${subs[0].sub.id}">Pagar</button>
        </div>` : ''}

        <div ${tileAttrs('day', 6)}>
          <div class="tile-head"><span class="tile-k">${e3d('✅', { size: 38 })}Tareas de hoy</span><button class="icon-btn sm" data-action="add-task" aria-label="Nueva tarea">${icon('plus')}</button></div>
          <div class="tile-split">
            ${ring(U.pct(tasks.length - tasksOpen.length, tasks.length), tasks.length - tasksOpen.length, `de ${tasks.length}`, `${tasks.length - tasksOpen.length} de ${tasks.length} tareas completadas`)}
            <div class="tk-list">${tasks.length ? tasks.slice(0, 4).map(taskRow).join('') : '<p class="muted">Nada pendiente hoy.</p>'}${tasks.length > 4 ? `<a class="tile-more" href="#/tareas">Ver ${tasks.length - 4} más →</a>` : ''}</div>
          </div>
        </div>

        <div ${tileAttrs('day', 6)}>
          <div class="tile-head"><span class="tile-k">${e3d('📅', { size: 38 })}Agenda</span><button class="icon-btn sm" data-action="add-event" aria-label="Nuevo evento">${icon('plus')}</button></div>
          <div class="ev-list">${eventsToday.length ? eventsToday.slice(0, 3).map((e) => `
            <button class="ev-row" data-action="edit" data-c="events" data-id="${e.id}">${e3d(e3dFor(e.title, e.category), { size: 36 })}<span class="ev-t"><b>${esc(e.title)}</b><small>${esc(e.time || '')} · ${U.fmtDuration(e.duration)}</small></span></button>`).join('')
            : nextEvt ? `<a class="ev-row" href="#/calendario">${e3d(e3dFor(nextEvt.title, nextEvt.category), { size: 36 })}<span class="ev-t"><b>${esc(nextEvt.title)}</b><small>${esc(U.relDay(nextEvt.date, T))} · ${esc(nextEvt.time || '')}</small></span></a>` : '<p class="muted">Tu agenda está libre.</p>'}</div>
        </div>

        <div ${tileAttrs('body', 5)}>
          <a class="tile-link" href="#/entrenamientos" aria-label="Ver entrenamientos"></a>
          <div class="tile-head"><span class="tile-k">${e3d('🏋️', { size: 38 })}Entrenamiento</span></div>
          ${trainedToday ? `<div class="tile-v sm pos">Completado hoy</div><p class="tile-foot">${esc(trainedToday.title)}</p>`
            : train ? `<div class="tile-v sm">${esc(train.routine.name)}</div><p class="tile-foot">${esc(U.relDay(train.date, T))}${train.routine.time ? ` · ${esc(train.routine.time)}` : ''} · ${plural(train.exercises.length, 'ejercicio', 'ejercicios')}</p>`
            : '<div class="tile-v sm muted">Sin rutina</div><p class="tile-foot">Crea tus rutinas semanales</p>'}
          <div class="dots-wrap"><div class="dots" aria-hidden="true">${last14.map((x) => `<i class="${L.workoutOn(d, x) ? 'on' : ''}"></i>`).join('')}</div><small>${plural(sessions, 'sesión', 'sesiones')} en 14 días</small></div>
        </div>

        <div ${tileAttrs('body', 7)}>
          <div class="tile-head"><span class="tile-k">${e3d('🔥', { size: 38 })}Hábitos</span><span class="tile-note num">${habits.filter((x) => x.s.doneToday).length} de ${habits.length}</span></div>
          ${habits.length ? `<div class="habs">${habits.slice(0, 6).map(({ h, s }) => `
            <button class="hab ${s.doneToday ? 'on' : ''}" role="switch" aria-checked="${s.doneToday}" data-action="habit-toggle" data-id="${h.id}" data-value="${T}">
              ${e3d(h.emoji || '⭐', { size: 34 })}<span class="hab-t">${esc(h.name)}</span><span class="sw" aria-hidden="true"><i></i></span>
            </button>`).join('')}</div>` : '<p class="muted">Crea tu primer hábito para verlo aquí.</p>'}
        </div>

        ${insight ? `<a ${tileAttrs('all', 12, 'tile-insight')} href="${insight.route}">${e3d('💡', { size: 44 })}<span><b>${esc(insight.title)}</b><small>${esc(insight.detail)}</small></span>${icon('chevR')}</a>` : ''}
      </div>
      </div>`;
    },

    mount(el, params, ctx = {}) {
      const scope = el.querySelector('.cab');
      if (!scope) return;
      paintDial(scope);
      bindDial(scope);
      bindTilt(scope);
      bindLife(scope);
      if (ctx.entered) {
        scope.classList.add('entered');
        countUp(el);
      }
    },

    actions: {
      'dial-now': (el) => {
        const scope = el.closest('.cab');
        clearTimeout(dial.timer);
        player.id = null;
        dial.scrub = null;
        paintDial(scope); paintPlayer(scope);
        return false;
      },
      'dial-add': () => {
        DOS.forms.block(null, dial.scrub === null ? {} : { time: hhmm(dial.scrub) });
        return false;
      },
      'dial-core': () => {
        const min = dial.scrub === null ? nowMin() : dial.scrub;
        const it = L.timelineAt(timeline(), min);
        if (!it) { DOS.forms.block(null, dial.scrub === null ? {} : { time: hhmm(min) }); return false; }
        const row = store.get(it.kind === 'event' ? 'events' : 'day_blocks', it.id);
        if (row) (it.kind === 'event' ? DOS.forms.event(row) : DOS.forms.block(row));
        return false;
      },
      'dash-step': (el) => {
        const scope = el.closest('.cab');
        const items = timeline(), now = nowMin();
        const cur = items.find((i) => i.id === player.id) || L.timelineAt(items, now) || L.timelineNext(items, now) || items[0];
        const to = items[items.indexOf(cur) + +el.dataset.value];
        if (!to) return false;
        player.id = to.id;
        paintPlayer(scope);
        const live = now >= to.start && now < to.end;
        glideTo(scope, live ? now : to.start);
        if (live) dial.scrub = null;
        armReturn(scope);
        return false;
      },
      'dash-done': (el) => {
        const b = store.get('day_blocks', el.dataset.id);
        if (!b) return false;
        const done = b.status !== 'completado';
        return animated(el, done, () => {
          store.update('day_blocks', b.id, { status: done ? 'completado' : 'pendiente' });
          if (done) ui.toast('Bloque completado');
        });
      },
      'dash-mode': (el) => {
        mode = el.dataset.value;
        const scope = el.closest('.cab');
        scope.dataset.mode = mode;
        scope.querySelectorAll('.modes button').forEach((b) => {
          const on = b.dataset.value === mode;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        });
        const grid = scope.querySelector('[data-tiles]');
        grid.querySelectorAll('[data-g]').forEach((t) => { t.hidden = mode !== 'all' && t.dataset.g !== mode && t.dataset.g !== 'all'; });
        grid.classList.remove('flip'); void grid.offsetWidth; grid.classList.add('flip');
        return false;
      },
      'dash-day': (el) => {
        week.sel = el.dataset.value;
        const host = el.closest('[data-week]');
        host.innerHTML = weekBody(store.data, U.today());
        return false;
      },
      'task-toggle': (el) => {
        const t = store.get('tasks', el.dataset.id);
        return animated(el, !!t && t.status !== 'completada', () => DOS.globalActions['task-toggle'](el));
      },
      'habit-toggle': (el) => {
        el.setAttribute('aria-checked', !el.classList.contains('on'));
        return animated(el, !el.classList.contains('on'), () => DOS.globalActions['habit-toggle'](el));
      },
    },
  };
})(window);
