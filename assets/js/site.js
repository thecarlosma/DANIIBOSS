/* ============================================================
   DANI BOSS EXPERIENCE 2.0 — interactions
   ============================================================ */
(function () {
  'use strict';
  var C = window.DB_CONTENT || {};
  var root = document.documentElement;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var IO = 'IntersectionObserver' in window;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  function onView(el, cb, opts) {
    if (!el) return;
    if (!IO) { cb(el); return; }
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { cb(e.target); o.unobserve(e.target); } });
    }, opts || { threshold: .2 });
    o.observe(el);
  }
  function whileVisible(el, start, stop) {
    if (!el) return;
    if (!IO) { start(); return; }
    new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: .05 }).observe(el);
  }

  /* ---------- Content bindings ---------- */
  var ct = C.contact || {};
  function wa(text) { return 'https://wa.me/' + ct.whatsapp + '?text=' + encodeURIComponent(text); }
  $$('[data-wa]').forEach(function (a) { a.href = wa((C.waMessages || {})[a.getAttribute('data-wa')] || ''); });
  $$('[data-calendly]').forEach(function (a) { a.href = ct.calendly; });
  $$('[data-ig]').forEach(function (a) { a.href = ct.instagram; });
  $$('[data-wa-display]').forEach(function (e) { e.textContent = 'WhatsApp · ' + ct.whatsappDisplay; });
  $$('[data-price]').forEach(function (e) { var p = (C.prices || {})[e.getAttribute('data-price')]; if (p) e.textContent = p.from; });
  $$('[data-price-note]').forEach(function (e) { var p = (C.prices || {})[e.getAttribute('data-price-note')]; if (p) e.textContent = p.note; });

  var T = C.testimonials || [];
  if (T.length) {
    var box = $('#testis');
    T.forEach(function (t) {
      var f = document.createElement('figure'); f.className = 'testi';
      var q = document.createElement('blockquote'); q.textContent = '“' + t.texto + '”';
      var c = document.createElement('figcaption'); var b = document.createElement('b'); b.textContent = t.nombre;
      var s = document.createElement('span'); s.textContent = t.marca ? ' · ' + t.marca : '';
      c.appendChild(b); c.appendChild(s); f.appendChild(q); f.appendChild(c); box.appendChild(f);
    });
    box.hidden = false;
  }

  /* ---------- Reveal ---------- */
  function startReveals() {
    root.classList.add('ready');
    var els = $$('.rv, .work');
    if (!IO || RM) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { o.observe(e); });
  }

  /* ---------- INTRO ---------- */
  var intro = $('#intro');
  var mode = root.classList.contains('intro-full') ? 'full' : root.classList.contains('intro-short') ? 'short' : 'none';
  var introDone = false;

  function finishIntro(instant) {
    if (introDone) return; introDone = true;
    try { localStorage.setItem('db-intro-seen', '1'); } catch (e) {}
    intro.classList.add('out');
    intro.setAttribute('aria-hidden', 'true');
    var end = function () {
      intro.hidden = true; stopIntroCanvas();
      root.classList.remove('intro-full', 'intro-short'); root.classList.add('intro-done');
    };
    startReveals();
    if (instant || RM) end(); else setTimeout(end, 1150);
  }

  var introRaf = null;
  function stopIntroCanvas() { if (introRaf) cancelAnimationFrame(introRaf); introRaf = null; }

  function runIntroCanvas() {
    var cv = $('#introCanvas'), cx = cv.getContext('2d'), W, H, dpr;
    function rs() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    rs(); addEventListener('resize', rs);
    var N = W < 700 ? 14 : 22, nodes = [], dust = [];
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2, r = Math.max(W, H) * (.55 + Math.random() * .25);
      nodes.push({ a: a, r0: r, r1: 120 + (i % 3) * 46 + Math.random() * 20, s: Math.random() * .6 + .7 });
    }
    for (var j = 0; j < 46; j++) dust.push({ x: Math.random(), y: Math.random(), v: Math.random() * .0004 + .0001, a: Math.random() * .25 + .05 });
    var t0 = performance.now();
    function ease(t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
    function frame(now) {
      var t = (now - t0) / 1000, cxp = W / 2, cyp = H / 2;
      cx.clearRect(0, 0, W, H);
      // dust
      dust.forEach(function (d) { d.y -= d.v; if (d.y < 0) d.y = 1; cx.globalAlpha = d.a; cx.fillStyle = '#8654D6'; cx.fillRect(d.x * W, d.y * H, 1.2, 1.2); });
      // phase 1: signal line
      var l = ease(t / .7) * Math.min(W * .42, 520);
      cx.globalAlpha = .9 * (1 - ease((t - .9) / .45));
      var g = cx.createLinearGradient(cxp - l, 0, cxp + l, 0);
      g.addColorStop(0, 'rgba(134,84,214,0)'); g.addColorStop(.5, 'rgba(184,154,240,.9)'); g.addColorStop(1, 'rgba(134,84,214,0)');
      cx.fillStyle = g; cx.fillRect(cxp - l, cyp - .5, l * 2, 1);
      cx.globalAlpha = 1 - ease((t - .9) / .45); cx.fillStyle = '#B89AF0'; cx.beginPath(); cx.arc(cxp, cyp, 2 + Math.sin(t * 6) * .6, 0, 6.283); cx.fill(); cx.globalAlpha = 1;
      introRaf = requestAnimationFrame(frame);
    }
    introRaf = requestAnimationFrame(frame);
  }

  function startIntro() {
    var clock = $('#introClock');
    if (clock) { var tick = function () { if (introDone) return; var d = new Date(); clock.textContent = d.toTimeString().slice(0, 8); setTimeout(tick, 1000); }; tick(); }
    runIntroCanvas();
    var seq = mode === 'full'
      ? [[60, 'p1'], [500, 'p2'], [1250, 'p3'], [2050, 'p4']]
      : [[40, 'p1'], [60, 'p2'], [80, 'p3']];
    seq.forEach(function (s) { setTimeout(function () { intro.classList.add(s[1]); }, s[0]); });
    setTimeout(function () { finishIntro(); }, mode === 'full' ? 3850 : 1100);
    $('#introSkip').addEventListener('click', function () { finishIntro(); });
    $('#introEnter').addEventListener('click', function () { finishIntro(); });
    var userGo = function (e) {
      if (e.type === 'keydown' && ['Enter', ' ', 'Escape', 'ArrowDown', 'PageDown'].indexOf(e.key) < 0) return;
      finishIntro();
      removeEventListener('wheel', userGo); removeEventListener('touchmove', userGo); removeEventListener('keydown', userGo);
    };
    addEventListener('wheel', userGo, { passive: true }); addEventListener('touchmove', userGo, { passive: true }); addEventListener('keydown', userGo);
    $('#introSkip').focus({ preventScroll: true });
  }

  if (mode === 'none') { intro.hidden = true; introDone = true; root.classList.add('intro-done'); startReveals(); }
  else startIntro();

  /* ---------- Header ---------- */
  var top = $('#top');
  var onScroll = function () { top.classList.toggle('solid', scrollY > 24); };
  onScroll(); addEventListener('scroll', onScroll, { passive: true });
  if (IO) {
    var links = $$('.nav a');
    var map = {}; links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var a = map[e.target.id]; if (a && e.isIntersecting) { links.forEach(function (x) { x.classList.remove('on'); }); a.classList.add('on'); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* ---------- Hero system map ---------- */
  var NODES = [
    ['Captación', 'Atrae a las personas correctas: anuncios, contenido y perfiles que llevan tráfico al sistema.'],
    ['Web', 'Convierte visitas en oportunidades con una página pensada para una sola acción.'],
    ['IA', 'Responde, califica y acompaña a cada contacto, de día o de noche.'],
    ['Conversación', 'Cada chat en WhatsApp o Instagram tiene contexto y un siguiente paso claro.'],
    ['Venta', 'Conecta producto, pedido y confirmación para cerrar con orden.'],
    ['Analítica', 'Mide qué funciona para decidir dónde invertir el siguiente dólar.']
  ];
  (function () {
    var wrap = $('#sysNodes'), linksG = $('#sysLinks');
    if (!wrap) return;
    var ns = 'http://www.w3.org/2000/svg', R = 150, pts = [];
    NODES.forEach(function (n, i) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / NODES.length);
      var x = 200 + Math.cos(a) * R, y = 200 + Math.sin(a) * R; pts.push([x, y]);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'node';
      b.style.left = (x / 4) + '%'; b.style.top = (y / 4) + '%';
      b.innerHTML = '<i>0' + (i + 1) + '</i>' + n[0];
      b.setAttribute('aria-label', n[0] + ': ' + n[1]);
      b.addEventListener('click', function () { stopAuto(); sel(i); });
      b.addEventListener('mouseenter', function () { if (FINE) { stopAuto(); sel(i); } });
      wrap.appendChild(b);
    });
    var paths = [];
    pts.forEach(function (p, i) {
      var q = pts[(i + 1) % pts.length];
      var ring = document.createElementNS(ns, 'path'); ring.setAttribute('d', 'M' + p[0] + ' ' + p[1] + ' L' + q[0] + ' ' + q[1]); ring.setAttribute('class', 'link'); linksG.appendChild(ring);
      var sp = document.createElementNS(ns, 'path'); sp.setAttribute('d', 'M200 200 L' + p[0] + ' ' + p[1]); sp.setAttribute('class', 'link'); sp.style.strokeDasharray = '3 5'; linksG.appendChild(sp);
      paths.push([ring, sp]);
      if (!RM) {
        var dot = document.createElementNS(ns, 'circle'); dot.setAttribute('r', '2.4'); dot.setAttribute('class', 'pulse');
        var am = document.createElementNS(ns, 'animateMotion'); am.setAttribute('dur', '2.6s'); am.setAttribute('begin', (i * .43) + 's'); am.setAttribute('repeatCount', 'indefinite');
        am.setAttribute('path', 'M' + p[0] + ' ' + p[1] + ' L' + q[0] + ' ' + q[1]); dot.appendChild(am); linksG.appendChild(dot);
      }
    });
    var btns = $$('.node', wrap), cur = 0, timer = null;
    function sel(i) {
      cur = i;
      btns.forEach(function (b, k) { b.classList.toggle('on', k === i); });
      paths.forEach(function (p, k) { p[0].classList.toggle('on', k === i); p[1].classList.toggle('on', k === i); });
      $('#sysK').textContent = '0' + (i + 1) + ' / ' + NODES[i][0].toUpperCase();
      $('#sysT').textContent = NODES[i][1];
    }
    function stopAuto() { clearInterval(timer); timer = null; }
    sel(0);
    if (!RM) whileVisible($('#sys'), function () { if (!timer && !stopAuto.used) timer = setInterval(function () { sel((cur + 1) % NODES.length); }, 3200); }, function () { stopAuto(); });
    wrap.addEventListener('pointerdown', function () { stopAuto.used = true; });
    wrap.addEventListener('focusin', function () { stopAuto.used = true; stopAuto(); });
  })();

  /* ---------- Compare toggle ---------- */
  (function () {
    var cmp = $('#cmp'); if (!cmp) return;
    var btns = $$('.switch button', cmp), label = $('#cmpLabel'), touched = false;
    function set(s) {
      cmp.setAttribute('data-state', s);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-s') === s); });
      label.textContent = s === 'b' ? 'Estado: con sistema' : 'Estado: sin sistema';
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { touched = true; set(b.getAttribute('data-s')); }); });
    onView(cmp, function () { setTimeout(function () { if (!touched) set('b'); }, RM ? 0 : 1200); }, { threshold: .5 });
  })();

  /* ---------- Tabs ---------- */
  var tabs = $$('.tab');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    var pane = $('#' + tab.getAttribute('aria-controls')), d = $('.demo', pane);
    if (d && d._auto) d._auto();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') d = -i; if (e.key === 'End') d = tabs.length - 1 - i;
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  // swipe between panes on touch
  (function () {
    var area = $('#disciplinas'), x0 = null, y0 = null;
    if (!area) return;
    area.addEventListener('touchstart', function (e) { if (e.target.closest('.flow,.ec-steps,.tabs,.layers,.seg')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    area.addEventListener('touchend', function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        var i = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
        var n = i + (dx < 0 ? 1 : -1); if (n >= 0 && n < tabs.length) selectTab(tabs[n]);
      }
    }, { passive: true });
  })();

  /* ---------- Stepper demos (IA + E-commerce) ---------- */
  $$('.demo[data-demo="ia"], .demo[data-demo="ec"]').forEach(function (demo) {
    var steps = $$('[data-step]', demo), views = $$('[data-view]', demo), cur = 0, timer = null, played = false;
    function go(i) {
      cur = i;
      steps.forEach(function (s, k) { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); s.setAttribute('aria-pressed', k === i); });
      views.forEach(function (v, k) { v.classList.toggle('on', k === i); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function play() {
      stop(); go(0); if (RM) return;
      timer = setInterval(function () { if (cur >= steps.length - 1) { stop(); return; } go(cur + 1); }, 1900);
    }
    steps.forEach(function (s, k) { s.addEventListener('click', function () { stop(); go(k); }); });
    $('[data-play]', demo).addEventListener('click', play);
    go(0);
    demo._auto = function () { if (!played) { played = true; play(); } };
    whileVisible(demo, function () { if (!demo.closest('[hidden]')) demo._auto(); }, stop);
  });

  /* ---------- Web build demo ---------- */
  (function () {
    var demo = $('.demo[data-demo="web"]'); if (!demo) return;
    var build = $('#build'), lb = $$('.layers button', demo), played = false, t = [];
    function layer(n) { build.setAttribute('data-layer', n); lb.forEach(function (b) { var v = +b.getAttribute('data-layer'); b.classList.toggle('on', v === n); b.setAttribute('aria-pressed', v === n); }); }
    function clear() { t.forEach(clearTimeout); t = []; }
    function auto() { if (played) return; played = true; clear(); if (RM) { layer(4); return; } [1, 2, 3, 4].forEach(function (n, i) { t.push(setTimeout(function () { layer(n); }, 400 + i * 1100)); }); }
    lb.forEach(function (b) { b.addEventListener('click', function () { clear(); played = true; layer(+b.getAttribute('data-layer')); }); });
    $$('.seg button', demo).forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-vw') === 'm'; build.classList.toggle('m', m);
        $$('.seg button', demo).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      });
    });
    layer(0); demo._auto = auto;
    whileVisible(demo, function () { if (!demo.closest('[hidden]')) auto(); }, function () {});
  })();

  /* ---------- Lab cycle ---------- */
  (function () {
    var spans = $$('#cycle span'), i = 0, timer = null;
    if (!spans.length) return;
    function step() { spans.forEach(function (s, k) { s.classList.toggle('on', k === i); }); i = (i + 1) % spans.length; }
    step();
    if (!RM) whileVisible($('#cycle'), function () { if (!timer) timer = setInterval(step, 1400); }, function () { clearInterval(timer); timer = null; });
  })();

  /* ---------- Project viewer ---------- */
  (function () {
    var dlg = $('#viewer'); if (!dlg) return;
    function open(key) {
      var art = $('[data-work="' + key + '"]'), name = $('h3', art).textContent;
      $('#viewerT').textContent = name;
      var d = $('#viewerD'), m = $('#viewerM');
      d.src = 'assets/work/' + key + '.jpg'; d.alt = 'Vista de escritorio de ' + name;
      m.src = 'assets/work/' + key + '-m.jpg'; m.alt = 'Vista móvil de ' + name;
      var go = $('#viewerGo'), url = art.getAttribute('data-url');
      if (go) { if (url) { go.href = url; go.hidden = false; } else go.hidden = true; }
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }
    $$('[data-open]').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-open')); }); });
    $$('.work-img').forEach(function (w) { w.addEventListener('click', function () { open(w.closest('.work').getAttribute('data-work')); }); });
    $('#viewerX').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  })();

  /* ---------- Counters (real data only) ---------- */
  $$('[data-count]').forEach(function (el) {
    var end = +el.getAttribute('data-count');
    onView(el, function () {
      if (RM) return;
      var t0 = null; el.textContent = '0';
      (function tick(n) { if (!t0) t0 = n; var p = Math.min((n - t0) / 1500, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(performance.now());
    }, { threshold: .6 });
  });

  /* ---------- Process progress ---------- */
  (function () {
    var list = $('#steps'); if (!list) return;
    var items = $$('.step', list), ticking = false;
    function upd() {
      ticking = false;
      var r = list.getBoundingClientRect(), vh = innerHeight;
      var p = Math.min(Math.max((vh * .85 - r.top) / (r.height + vh * .35), 0), 1);
      list.style.setProperty('--prog', p.toFixed(3));
      items.forEach(function (it, k) { it.classList.toggle('on', p >= (k + .35) / items.length); });
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  })();

  /* ---------- Closing canvas: lines converging to one point ---------- */
  (function () {
    var cv = $('#closeCanvas'); if (!cv || RM) return;
    var cx = cv.getContext('2d'), W, H, raf = null, lines = [], t0 = 0;
    function rs() { var d = Math.min(devicePixelRatio || 1, 2); W = cv.offsetWidth; H = cv.offsetHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    function seed() { lines = []; for (var i = 0; i < 26; i++) { var a = Math.random() * 6.283; lines.push({ a: a, r: Math.max(W, H) * (.6 + Math.random() * .3), sp: .25 + Math.random() * .4, off: Math.random() }); } }
    function frame(n) {
      if (!t0) t0 = n; var t = (n - t0) / 1000;
      cx.clearRect(0, 0, W, H);
      var px = W < 1000 ? W * .5 : W * .74, py = H * .5;
      lines.forEach(function (l) {
        var k = (t * l.sp + l.off) % 1, x0 = px + Math.cos(l.a) * l.r, y0 = py + Math.sin(l.a) * l.r;
        var hx = x0 + (px - x0) * k, hy = y0 + (py - y0) * k, tx = x0 + (px - x0) * Math.max(k - .18, 0), ty = y0 + (py - y0) * Math.max(k - .18, 0);
        var g = cx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(134,84,214,0)'); g.addColorStop(1, 'rgba(184,154,240,' + (.35 * (1 - k * .5)) + ')');
        cx.strokeStyle = g; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(hx, hy); cx.stroke();
      });
      var pr = 3 + Math.sin(t * 2) * 1;
      var rg = cx.createRadialGradient(px, py, 0, px, py, 80); rg.addColorStop(0, 'rgba(134,84,214,.35)'); rg.addColorStop(1, 'rgba(134,84,214,0)');
      cx.fillStyle = rg; cx.fillRect(px - 80, py - 80, 160, 160);
      cx.fillStyle = '#E7E6EA'; cx.beginPath(); cx.arc(px, py, pr, 0, 6.283); cx.fill();
      raf = requestAnimationFrame(frame);
    }
    rs(); seed();
    addEventListener('resize', function () { rs(); seed(); });
    whileVisible($('#contacto'), function () { if (!raf) raf = requestAnimationFrame(frame); }, function () { cancelAnimationFrame(raf); raf = null; });
  })();

  /* ---------- Form → WhatsApp with preview ---------- */
  (function () {
    var form = $('#form'); if (!form) return;
    var prev = $('#preview'), txt = $('#previewTxt'), go = $('#previewGo');
    $$('[data-service]').forEach(function (a) {
      a.addEventListener('click', function () {
        var v = a.getAttribute('data-service');
        $$('input[name="servicio"]', form).forEach(function (r) { r.checked = r.value === v; });
      });
    });
    function check(id, msgId) {
      var i = $('#' + id), ok = i.value.trim().length >= 2;
      i.closest('.field').classList.toggle('bad', !ok); i.setAttribute('aria-invalid', !ok);
      if (!ok) i.setAttribute('aria-describedby', msgId); else i.removeAttribute('aria-describedby');
      return ok;
    }
    ['f-name', 'f-biz'].forEach(function (id) { $('#' + id).addEventListener('input', function () { if (this.getAttribute('aria-invalid') === 'true') check(id, id === 'f-name' ? 'e-name' : 'e-biz'); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = check('f-name', 'e-name'), b = check('f-biz', 'e-biz');
      if (!a) { $('#f-name').focus(); return; } if (!b) { $('#f-biz').focus(); return; }
      var svc = ($('input[name="servicio"]:checked', form) || {}).value || 'Necesito orientación';
      var desc = form.descripcion.value.trim();
      var msg = 'Hola Dani, soy ' + form.nombre.value.trim() + '.\n' +
        'Marca / negocio: ' + form.negocio.value.trim() + '\n' +
        'Me interesa: ' + svc + (desc ? '\nMi proyecto: ' + desc : '') + '\n\nVi tu web y quiero hablar de mi proyecto.';
      txt.textContent = msg; go.href = wa(msg);
      prev.hidden = false; prev.focus();
      prev.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' });
    });
    $('#previewEdit').addEventListener('click', function () { prev.hidden = true; $('#f-name').focus(); });
  })();

  /* ---------- Floating WhatsApp ---------- */
  (function () {
    var fab = $('#fab'), hero = $('.hero'), close = $('#contacto'), past = false, atClose = false;
    function upd() { fab.classList.toggle('show', past && !atClose); }
    if (!IO) { fab.classList.add('show'); return; }
    new IntersectionObserver(function (es) { past = !es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(hero);
    new IntersectionObserver(function (es) { atClose = es[0].isIntersecting; upd(); }, { threshold: .15 }).observe(close);
  })();

  /* ---------- Soluciones: problema -> solución ---------- */
  (function () {
    var qs = $$('.sol-q'); if (!qs.length) return;
    function sel(i, focus) {
      qs.forEach(function (q, k) {
        var on = k === i;
        q.setAttribute('aria-selected', on); q.tabIndex = on ? 0 : -1;
        $('#' + q.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) q.focus();
      });
    }
    qs.forEach(function (q, i) {
      q.addEventListener('click', function () { sel(i); });
      q.addEventListener('keydown', function (e) {
        var d = /Right|Down/.test(e.key) ? 1 : /Left|Up/.test(e.key) ? -1 : 0;
        if (!d) return; e.preventDefault(); sel((i + d + qs.length) % qs.length, true);
      });
    });
    $$('[data-sol-wa]').forEach(function (a) {
      var p = a.closest('.sol-p');
      a.href = wa('Hola Dani, vi tu web. Mi problema es: ' + p.dataset.q.toLowerCase() + '. Me interesa: ' + p.dataset.sol + '.');
      a.target = '_blank'; a.rel = 'noopener noreferrer';
    });
    sel(0);
  })();

  /* ---------- Philosophy panels ---------- */
  (function () {
    var ps = $$('#panels .panel-i'); if (!ps.length) return;
    var cur = 0, timer = null, touched = false;
    function sel(i) { cur = i; ps.forEach(function (p, k) { p.classList.toggle('on', k === i); p.setAttribute('aria-expanded', k === i); }); }
    ps.forEach(function (p, i) {
      p.addEventListener('click', function () { touched = true; clearInterval(timer); sel(i); });
      p.addEventListener('mouseenter', function () { if (FINE) { touched = true; clearInterval(timer); sel(i); } });
      p.addEventListener('focus', function () { touched = true; clearInterval(timer); sel(i); });
    });
    sel(0);
    if (!RM) whileVisible($('#panels'), function () { if (!touched && !timer) timer = setInterval(function () { sel((cur + 1) % ps.length); }, 3800); }, function () { clearInterval(timer); timer = null; });
  })();

  /* ---------- Cursor (desktop only, native cursor stays) ---------- */
  (function () {
    if (!FINE || RM) return;
    var c = $('#cursor'), x = -100, y = -100, cx = x, cy = y, raf = null;
    addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; c.classList.add('on'); if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
    document.addEventListener('pointerleave', function () { c.classList.remove('on'); });
    function loop() { cx += (x - cx) * .2; cy += (y - cy) * .2; c.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; raf = Math.abs(x - cx) + Math.abs(y - cy) > .3 ? requestAnimationFrame(loop) : null; }
    document.addEventListener('pointerover', function (e) { c.classList.toggle('hot', !!e.target.closest('a,button,[role="tab"],label,.work-img')); });
  })();
})();
