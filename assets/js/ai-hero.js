/* ============================================================
   SÓCRATES AI — busto vivo, partículas, money flow y compositor
   ============================================================ */
(function () {
  'use strict';
  var hero = document.querySelector('.hero-ai'); if (!hero) return;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var C = window.DB_CONTENT || {}, ct = C.contact || {};
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  var stage = $('#aiStage'), bust = $('#aiBust'), ring = $('.ai-ring', bust);
  var cvB = $('#fxBack'), cvF = $('#fxFront'), xB = cvB.getContext('2d'), xF = cvF.getContext('2d');
  var form = $('#composer'), ta = $('#cmpIn'), hint = $('#cmpHint'), rot = $('#aiRot'), pauseBtn = $('#aiPause');

  var diag = ((C.prices || {}).diagnostico || {}).from || '$33';
  var MODES = {
    auto:  { lc: [134, 84, 214], lo: .5,  speed: 1,   sheen: 1,   hint: 'Elijo la mejor ruta para tu negocio', tag: 'Auto (recomiéndame la mejor ruta)' },
    fast:  { lc: [196, 172, 255], lo: .62, speed: 2.2, sheen: 2.8, hint: 'Arrancamos rápido · diagnóstico ' + diag, tag: 'Fast (quiero arrancar rápido)' },
    think: { lc: [92, 38, 196], lo: .74,  speed: .5,  sheen: .45, hint: 'Estrategia profunda · sistema completo', tag: 'Think (quiero una estrategia completa)' }
  };

  /* ---------- state ---------- */
  var S = {
    mode: 'auto', lc: MODES.auto.lc.slice(), e: 0, eT: 0, pulse: 0, burst: 0,
    mx: 0, my: 0, cx: 0, cy: 0, px: -9999, py: -9999, t: 0, sx: 120,
    typing: false, visible: true, paused: false, running: false, last: 0
  };
  try { S.paused = localStorage.getItem('db-ai-paused') === '1'; } catch (e) {}

  /* ---------- canvas + geometry ---------- */
  var W = 0, H = 0, DPR = 1, small = false, BC = { x: 0, y: 0, w: 0, h: 0 }, CMP = { x: 0, y: 0 };
  function measure() {
    var r = stage.getBoundingClientRect(), b = bust.getBoundingClientRect(), f = form.getBoundingClientRect();
    small = r.width < 760;
    DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = r.width; H = r.height;
    [cvB, cvF].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    [xB, xF].forEach(function (x) { x.setTransform(DPR, 0, 0, DPR, 0, 0); });
    // the bust is 3D-transformed; its rect is close enough for the orbit centre
    BC = { x: b.left - r.left + b.width * .55, y: b.top - r.top + b.height * .3, w: b.width, h: b.height };
    CMP = { x: f.left - r.left + f.width * .5, y: f.top - r.top + 10 };
    seed();
  }

  /* glow sprites (pre-rendered once, drawn scaled) */
  function sprite(rgb) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(' + rgb + ',.95)');
    gr.addColorStop(.45, 'rgba(' + rgb + ',.28)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  var SPR = { v: sprite('150,104,230'), l: sprite('196,176,255'), g: sprite('212,175,55') };

  /* ---------- particles ---------- */
  var orb = [], dust = [], cash = [];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function seed() {
    var nO = small ? 34 : 86, nD = small ? 16 : 42, nC = small ? 6 : 15;
    orb = []; dust = []; cash = [];
    for (var i = 0; i < nO; i++) orb.push({
      a: rnd(0, Math.PI * 2), r: rnd(.5, 1.18), sp: rnd(.00012, .00034),
      yo: rnd(-.32, .3), tl: rnd(-.14, .14), s: rnd(1.4, 4.2), k: Math.random() < .16 ? 'g' : (Math.random() < .45 ? 'l' : 'v'), tw: rnd(0, 6.28)
    });
    for (var j = 0; j < nD; j++) dust.push({ x: rnd(0, W), y: rnd(0, H), vy: rnd(-5, -14), s: rnd(.6, 1.8), tw: rnd(0, 6.28) });
    for (var k = 0; k < nC; k++) cash.push(newCash(true));
  }
  function newCash(anywhere) {
    var z = rnd(.25, 1), ch = Math.random(), wide = W >= 1040;
    // keep capital away from the text column on desktop
    var x = wide ? rnd(W * .44, W * .98) : rnd(W * .04, W * .96);
    return {
      ch: ch < .6 ? '$' : ch < .8 ? '€' : '₿', z: z, x: x, y: anywhere ? rnd(H * .2, H * .9) : rnd(H * .55, H * .95),
      vx: 0, vy: 0, dy: -rnd(5, 13) * (.6 + z * .5), size: 14 + z * (small ? 26 : 40), life: anywhere ? rnd(0, 6) : 0,
      max: rnd(7, 13), gold: Math.random() < .55, pull: Math.random() < .35, flash: 0
    };
  }

  /* ---------- frame ---------- */
  function lerp(a, b, k) { return a + (b - a) * k; }
  function frame(now, instant) {
    var dt = S.last ? Math.min(now - S.last, 50) : 16; S.last = now; S.t += dt;
    var m = MODES[S.mode], t = S.t, k6 = instant ? 1 : .06;

    S.e = lerp(S.e, S.eT, .05); S.pulse *= .93; S.burst *= .965;
    S.cx = lerp(S.cx, S.mx, k6); S.cy = lerp(S.cy, S.my, k6);
    for (var c = 0; c < 3; c++) S.lc[c] = lerp(S.lc[c], m.lc[c], k6);

    var br = (Math.sin(t * .0011 * (S.mode === 'think' ? .6 : S.mode === 'fast' ? 1.8 : 1)) + 1) / 2;
    var bs = bust.style;
    bs.setProperty('--ry', (Math.sin(t * .00042) * 2.4 + S.cx * 6).toFixed(2));
    bs.setProperty('--rx', (Math.sin(t * .0003) * .9 - S.cy * 3.2).toFixed(2));
    bs.setProperty('--tx', (S.cx * -12).toFixed(1));
    bs.setProperty('--ty', (S.cy * -7 + Math.sin(t * .0006) * 5).toFixed(1));
    bs.setProperty('--sc', (1 + br * .008 + S.pulse * .012).toFixed(4));
    bs.setProperty('--lx', (45 + S.cx * 30 + Math.sin(t * .0005) * 8).toFixed(1) + '%');
    bs.setProperty('--ly', (22 + S.cy * 18).toFixed(1) + '%');
    // the laptop screen glows with the visitor's typing
    bs.setProperty('--so', Math.min(1, .28 + br * .12 + S.e * .55 + S.pulse * .5 + S.burst * .6 + (Math.random() < .04 ? .06 : 0)).toFixed(3));
    bs.setProperty('--lo', Math.min(1, m.lo * (.6 + br * .4) + S.e * .35 + S.pulse * .4 + S.burst * .5).toFixed(3));
    S.sx -= dt * .012 * m.sheen * (1 + S.e); if (S.sx < -60) S.sx = 160;
    bs.setProperty('--sx', S.sx.toFixed(1) + '%');
    var lcs = S.lc.map(Math.round).join(',');
    if (lcs !== S.lcs) { S.lcs = lcs; hero.style.setProperty('--lc', lcs); }
    stage.style.setProperty('--e', (S.e + S.pulse * .5).toFixed(3));
    form.style.setProperty('--e', (S.e + S.pulse * .6).toFixed(3));

    draw(dt, m);
  }

  function draw(dt, m) {
    xB.clearRect(0, 0, W, H); xF.clearRect(0, 0, W, H);
    var t = S.t, spd = m.speed * (1 + S.e * .9 + S.pulse * 2 + S.burst * 3);
    var R = Math.max(BC.w * .62, BC.h * .36), ox = S.cx * -14, oy = S.cy * -8;

    /* ambient dust */
    xB.globalCompositeOperation = 'lighter';
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i]; d.y += d.vy * dt / 1000 * m.speed; if (d.y < -10) { d.y = H + 10; d.x = rnd(0, W); }
      var a = .18 + .22 * Math.sin(t * .002 + d.tw);
      xB.globalAlpha = a; xB.drawImage(SPR.v, d.x + ox * .3 - d.s * 2, d.y + oy * .3 - d.s * 2, d.s * 4, d.s * 4);
    }

    /* orbit around the bust (back half behind it, front half over it) */
    for (var j = 0; j < orb.length; j++) {
      var p = orb[j]; p.a += p.sp * dt * spd;
      var rr = p.r * (1 + S.burst * .55), ca = Math.cos(p.a), sa = Math.sin(p.a);
      var x = BC.x + ca * R * rr + ox, y = BC.y + p.yo * BC.h + sa * R * rr * .22 + ca * p.tl * R + oy;
      var z = sa, sz = p.s * (1 + z * .35) * (1 + S.pulse * .5);
      var al = (.28 + .5 * (z + 1) / 2) * (.75 + .25 * Math.sin(t * .003 + p.tw)) * (.85 + S.e * .3);
      var ctx = z > 0 ? xF : xB; ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, al); ctx.drawImage(SPR[p.k], x - sz * 2, y - sz * 2, sz * 4, sz * 4);
    }

    /* money flow — translucent, slow, secondary */
    xB.globalCompositeOperation = 'source-over';
    xB.textAlign = 'center'; xB.textBaseline = 'middle';
    for (var k = 0; k < cash.length; k++) {
      var q = cash[k]; q.life += dt / 1000; q.flash *= .95;
      if (q.life > q.max) { cash[k] = newCash(false); continue; }
      // velocities in px/s: slow base drift + pull towards the composer + pointer repel
      if (S.typing && q.pull) { q.vx += (CMP.x - q.x) * .0004 * dt; q.vy += (CMP.y - q.y) * .0004 * dt; }
      if (FINE) {
        var dx = q.x - S.px, dy = q.y - S.py, dd = dx * dx + dy * dy;
        if (dd < 22500) { var f = (1 - dd / 22500) * .5 * dt; dd = Math.sqrt(dd) || 1; q.vx += dx / dd * f; q.vy += dy / dd * f; }
      }
      q.vx *= .97; q.vy *= .97;
      q.x += q.vx * dt / 1000; q.y += (q.dy * (S.typing && q.pull ? .3 : 1) + q.vy) * dt / 1000;
      if (S.typing && q.pull && Math.abs(q.x - CMP.x) < 70 && Math.abs(q.y - CMP.y) < 50) q.life = Math.max(q.life, q.max - .6);
      var fade = Math.min(1, q.life / 1.6, (q.max - q.life) / 1.6);
      var px = q.x + S.cx * -34 * q.z, py = q.y + S.cy * -20 * q.z;
      // fade out under the fixed header
      var alpha = fade * Math.max(0, Math.min(1, (py - 110) / 90)) * (.07 + q.z * .12 + S.e * .06 + q.flash * .5);
      xB.font = '700 ' + q.size.toFixed(0) + 'px "Inter Tight", Inter, system-ui, sans-serif';
      xB.globalAlpha = alpha;
      xB.fillStyle = q.gold ? 'rgb(212,175,55)' : 'rgb(' + S.lcs + ')';
      xB.fillText(q.ch, px, py);
      xB.globalAlpha = Math.min(1, alpha * 1.8); xB.lineWidth = 1;
      xB.strokeStyle = q.gold ? 'rgba(243,226,166,.55)' : 'rgba(184,154,240,.55)';
      xB.strokeText(q.ch, px, py);
    }
    xB.globalAlpha = 1; xF.globalAlpha = 1;
  }

  /* ---------- loop control ---------- */
  function loop(now) { if (!S.running) return; frame(now); requestAnimationFrame(loop); }
  function update() {
    var go = S.visible && !document.hidden && !S.paused && !RM;
    hero.classList.toggle('paused', S.paused || RM);
    if (go && !S.running) { S.running = true; S.last = 0; requestAnimationFrame(loop); }
    else if (!go && S.running) S.running = false;
    if (!go) frame(performance.now(), true); // one calm, static frame
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { S.visible = es[0].isIntersecting; update(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', update);
  var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { measure(); if (!S.running) frame(performance.now(), true); }, 150); }, { passive: true });

  if (FINE) addEventListener('pointermove', function (e) {
    if (!S.running) return;
    S.mx = (e.clientX / innerWidth - .5) * 2; S.my = (e.clientY / innerHeight - .5) * 2;
    var r = stage.getBoundingClientRect(); S.px = e.clientX - r.left; S.py = e.clientY - r.top;
  }, { passive: true });

  pauseBtn.setAttribute('aria-pressed', S.paused);
  pauseBtn.textContent = S.paused ? 'Reanudar animación' : 'Pausar animación';
  pauseBtn.addEventListener('click', function () {
    S.paused = !S.paused;
    pauseBtn.setAttribute('aria-pressed', S.paused);
    pauseBtn.textContent = S.paused ? 'Reanudar animación' : 'Pausar animación';
    try { localStorage.setItem('db-ai-paused', S.paused ? '1' : '0'); } catch (e) {}
    if (S.paused) stopRotation(); else if (!S.typing) startRotation();
    update();
  });
  if (RM) pauseBtn.hidden = true;

  /* ---------- rotating headline ---------- */
  var PH = [
    'Construyo sistemas que hacen *crecer* marcas.',
    'El conocimiento transforma el *futuro*.',
    'Las grandes ideas comienzan con una *pregunta*.',
    'Piensa diferente. Construye algo *extraordinario*.',
    'Tu inteligencia artificial está *lista*.',
    'Convierte ideas en *posibilidades*.',
    'El futuro pertenece a quienes *construyen*.',
    '¿Qué vamos a *crear* hoy?'
  ];
  var ASK = PH.length - 1, cur = 0, rTimer = null;
  function paint(i) {
    rot.textContent = ''; rot.className = 'ai-rot';
    PH[i].split(' ').forEach(function (w, n, all) {
      var s = document.createElement('span'), key = /^\*.*\*[.?]?$/.test(w);
      s.className = 'w' + (key ? ' k' : ''); s.style.setProperty('--i', n);
      s.textContent = w.replace(/\*/g, '') + (n < all.length - 1 ? ' ' : '');
      rot.appendChild(s);
    });
    cur = i;
    requestAnimationFrame(function () { requestAnimationFrame(function () { rot.classList.add('in'); }); });
  }
  function swapTo(i, cb) {
    if (i === cur && rot.classList.contains('in')) { if (cb) cb(); return; }
    rot.classList.remove('in'); rot.classList.add('out');
    setTimeout(function () { paint(i); if (cb) cb(); }, RM ? 0 : 560);
  }
  function startRotation() {
    stopRotation(); if (RM || S.paused) return;
    rTimer = setInterval(function () { if (!document.hidden && S.visible) swapTo((cur + 1) % PH.length); }, 4400);
  }
  function stopRotation() { clearInterval(rTimer); rTimer = null; }
  function whenReady(cb) {
    if (root.classList.contains('ready')) return cb();
    var mo = new MutationObserver(function () { if (root.classList.contains('ready')) { mo.disconnect(); cb(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  paint(0); rot.classList.remove('in');
  whenReady(function () { setTimeout(function () { rot.classList.add('in'); startRotation(); }, 250); measure(); update(); });

  /* ---------- composer ---------- */
  function autosize() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 168) + 'px'; }
  function setHint(txt) {
    hint.classList.add('swap');
    setTimeout(function () { hint.textContent = txt; hint.classList.remove('swap'); }, 180);
  }
  function syncTyping() {
    var has = ta.value.trim().length > 0;
    form.classList.toggle('has', has);
    if (has && !S.typing) { S.typing = true; stopRotation(); swapTo(ASK); }
    if (!has && S.typing && document.activeElement !== ta) { S.typing = false; startRotation(); }
    S.eT = has ? .62 : (document.activeElement === ta ? .3 : 0);
  }
  ta.addEventListener('focus', function () { form.classList.add('focus'); S.eT = Math.max(S.eT, .3); });
  ta.addEventListener('blur', function () { form.classList.remove('focus'); syncTyping(); });
  ta.addEventListener('input', function () { autosize(); S.pulse = Math.min(1, S.pulse + .22); syncTyping(); });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(e); }
  });

  /* modes: radiogroup with arrow keys */
  var modeBtns = $$('.cps-modes button', form);
  function setMode(name, focus) {
    S.mode = name; hero.setAttribute('data-mode', name);
    modeBtns.forEach(function (b) {
      var on = b.getAttribute('data-mode') === name;
      b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus();
    });
    S.pulse = Math.min(1, S.pulse + .6); setHint(MODES[name].hint);
    if (!S.running) frame(performance.now(), true);
  }
  modeBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return; e.preventDefault();
      setMode(modeBtns[(i + d + modeBtns.length) % modeBtns.length].getAttribute('data-mode'), true);
    });
  });
  setMode('auto'); S.pulse = 0;

  $$('.cps-chips button').forEach(function (b) {
    b.addEventListener('click', function () {
      ta.value = b.textContent; autosize(); ta.focus(); S.pulse = 1; syncTyping();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  });

  /* ⌘K / Ctrl+K or "/" focuses the composer */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase(), typingField = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typingField)) {
      if (!S.visible) hero.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
      e.preventDefault(); ta.focus();
    }
  });

  function submit(e) {
    if (e) e.preventDefault();
    var v = ta.value.trim();
    if (!v) {
      form.classList.remove('nudge'); void form.offsetWidth; form.classList.add('nudge');
      setHint('Escribe tu idea o elige una de abajo'); ta.focus(); return;
    }
    var msg = 'Hola Dani, vengo de tu web.\nModo: ' + MODES[S.mode].tag + '\nQuiero construir: ' + v;
    var url = 'https://wa.me/' + ct.whatsapp + '?text=' + encodeURIComponent(msg);
    // open synchronously inside the user gesture so popup blockers allow it
    var w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;
    S.burst = 1; S.pulse = 1;
    cash.forEach(function (q) {
      q.flash = 1; var dx = q.x - CMP.x, dy = q.y - CMP.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      q.vx += dx / d * 220; q.vy -= 160;
    });
    ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
    setHint('Listo · te llevo a mi WhatsApp ✓');
    if (!S.running) frame(performance.now());
  }
  form.addEventListener('submit', submit);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); });
  measure(); update();
})();
