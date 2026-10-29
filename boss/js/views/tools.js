/* DANI BOSS — Calculadora y cálculos rápidos (porcentajes, IVA, margen, dividir cuenta). */
(function (root) {
  const DOS = root.DOS;
  const U = DOS.utils, C = DOS.calc;
  const ui = DOS.ui, icon = DOS.icon, esc = U.esc;
  DOS.views = DOS.views || {};

  const HKEY = 'danios.calc.history';
  const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } };
  const saveHistory = (h) => { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 20))); } catch (e) { /* sin almacenamiento */ } };

  const SKEY = 'danios.calc.speak';
  const readSpeak = () => { try { return localStorage.getItem(SKEY) !== '0'; } catch (e) { return true; } };
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;

  // Voz: se prefiere una voz femenina natural (Premium/Mejorada o Google) y con acento latino
  const VKEY = 'danios.calc.voice';
  const FEMALE = ['paulina', 'monica', 'marisol', 'isabela', 'helena', 'laura', 'paloma', 'sabina', 'elvira', 'dalia', 'soledad', 'luciana', 'angelica', 'francisca', 'lucia', 'esperanza', 'google español', 'samantha'];
  const AVOID = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'jorge', 'juan', 'diego', 'carlos', 'alvaro', 'pablo', 'raul', 'jacques', 'bells', 'boing', 'bubbles', 'cellos', 'wobble', 'zarvox', 'trinoids', 'whisper', 'albert', 'bad news', 'good news', 'organ', 'superstar', 'jester', 'fred', 'ralph', 'junior', 'bahh'];
  const plain = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function voiceScore(v) {
    const n = plain(v.name);
    let sc = 0;
    if (/premium|enhanced|mejorad|neural|natural/.test(n)) sc += 50;
    if (FEMALE.some((f) => n.includes(f))) sc += 30;
    if (/google/.test(n)) sc += 15;
    if (/^es-(mx|us|419|co|ec|ar|cl|pe)/i.test(v.lang)) sc += 8;
    if (AVOID.some((f) => n.includes(f))) sc -= 100;
    return sc;
  }
  const spanishVoices = () => { try { return (root.speechSynthesis ? root.speechSynthesis.getVoices() : []).filter((v) => /^es/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a)); } catch (e) { return []; } };
  function pickVoice() {
    const vs = spanishVoices();
    let saved = ''; try { saved = localStorage.getItem(VKEY) || ''; } catch (e) { /* sin almacenamiento */ }
    return vs.find((v) => v.name === saved) || vs[0] || null;
  }
  const st = { expr: '', done: false, error: '', history: loadHistory(), vals: { 'tax.rate': '15', 'split.tip': '0' }, said: '', answer: '', answerOk: true, speak: readSpeak() };
  const fmt = (n, d = 10) => (n === null || n === undefined ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));

  const KEYS = [
    ['C', 'clear', 'fn'], ['⌫', 'back', 'fn'], ['(', '(', 'fn'], [')', ')', 'fn'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷', 'op'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×', 'op'],
    ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−', 'op'],
    ['%', '%', 'fn'], ['0', '0'], ['.', '.'], ['+', '+', 'op'],
  ];

  // Cada herramienta: campos, cálculo y cómo se lee el resultado
  const TOOLS = [
    { id: 'pctOf', title: '¿Cuánto es el % de…?', fields: [['p', '%', 'Ej. 15'], ['x', 'de', 'Ej. 80']],
      run: (v) => C.tools.pctOf(v.p, v.x), show: (r, v) => `${fmt(v.p)}% de ${fmt(v.x)} = <b>${fmt(r.value, 2)}</b>` },
    { id: 'whatPct', title: '¿Qué % es…?', fields: [['a', 'Cantidad', 'Ej. 30'], ['b', 'del total', 'Ej. 120']],
      run: (v) => C.tools.whatPct(v.a, v.b), show: (r, v) => `${fmt(v.a)} es el <b>${fmt(r.value, 2)}%</b> de ${fmt(v.b)}` },
    { id: 'addPct', title: 'Sumar o restar %', fields: [['x', 'Valor', 'Ej. 100'], ['p', '%', 'Ej. 20']],
      run: (v) => { const a = C.tools.addPct(v.x, v.p), s = C.tools.subPct(v.x, v.p); return a && s ? { a, s } : null; },
      show: (r) => `+ % = <b>${fmt(r.a.value, 2)}</b><br>− % = <b>${fmt(r.s.value, 2)}</b> <span class="faint">(diferencia ${fmt(r.a.detail, 2)})</span>` },
    { id: 'change', title: 'Subió o bajó (%)', fields: [['a', 'Antes', 'Ej. 50'], ['b', 'Ahora', 'Ej. 65']],
      run: (v) => C.tools.change(v.a, v.b), show: (r) => `<b class="${r.value >= 0 ? 'pos' : 'neg'}">${r.value >= 0 ? '+' : ''}${fmt(r.value, 2)}%</b> <span class="faint">(${r.detail >= 0 ? '+' : ''}${fmt(r.detail, 2)})</span>` },
    { id: 'tax', title: 'IVA', fields: [['x', 'Monto', 'Ej. 100'], ['rate', 'IVA %', '15']],
      run: (v) => { const w = C.tools.withTax(v.x, v.rate), o = C.tools.withoutTax(v.x, v.rate); return w && o ? { w, o } : null; },
      show: (r) => `Con IVA: <b>${fmt(r.w.value, 2)}</b> <span class="faint">(+${fmt(r.w.detail, 2)})</span><br>Sin IVA: <b>${fmt(r.o.value, 2)}</b> <span class="faint">(IVA ${fmt(r.o.detail, 2)})</span>` },
    { id: 'margin', title: 'Ganancia y margen', fields: [['cost', 'Costo', 'Ej. 12'], ['price', 'Precio de venta', 'Ej. 30']],
      run: (v) => C.tools.margin(v.cost, v.price), show: (r) => `Ganas <b class="${r.value >= 0 ? 'pos' : 'neg'}">${fmt(r.value, 2)}</b> por unidad<br>Margen <b>${fmt(r.pct, 1)}%</b>${r.markup !== null ? ` · sobre el costo <b>${fmt(r.markup, 1)}%</b>` : ''}` },
    { id: 'split', title: 'Dividir una cuenta', fields: [['total', 'Total', 'Ej. 90'], ['people', 'Personas', 'Ej. 3'], ['tip', 'Propina %', '0']],
      run: (v) => C.tools.split(v.total, v.people, v.tip), show: (r) => `Cada uno paga <b>${fmt(r.value, 2)}</b><br><span class="faint">Total con propina ${fmt(r.detail, 2)}</span>` },
  ];

  function toolResult(t) {
    const v = Object.fromEntries(t.fields.map(([k]) => [k, st.vals[`${t.id}.${k}`] ?? '']));
    const r = t.run(v);
    return r ? t.show(r, v) : '<span class="faint">Escribe los valores</span>';
  }

  function historyHtml() {
    if (!st.history.length) return '<p class="muted" style="margin:0;font-size:13px">Aquí verás tus últimos cálculos.</p>';
    return `<div class="calc-history">${st.history.map((h, i) => `
      <button type="button" class="calc-h" data-calc-hist="${i}" title="Usar este resultado"><span class="e">${esc(h.expr)} =</span><span class="r num">${esc(fmt(h.result))}</span></button>`).join('')}</div>`;
  }

  DOS.views.calculator = {
    title: 'Calculadora',
    render() {
      const preview = st.expr && !st.done ? C.tryEval(st.expr) : null;
      return `
      <div class="page-head">
        <div><h1 class="page-title">Calculadora</h1><div class="page-sub">Dime la cuenta en voz alta, usa los botones o escribe y pulsa Enter.</div></div>
      </div>
      <div class="calc-layout">
        <div class="card calc-card">
          <form class="calc-voice" data-calc-voice autocomplete="off">
            <input class="input" id="calc-say" name="say" value="${esc(st.said)}" placeholder="Dime la cuenta: 150 entre 5 personas" enterkeyhint="go" autocapitalize="off" aria-label="Di o escribe la cuenta">
            ${SR ? `<button type="button" class="mic-btn" data-calc-mic aria-label="Hablar" title="Hablar">${icon('mic')}</button>` : ''}
            <button type="button" class="icon-btn ${st.speak ? 'on' : ''}" data-calc-speak aria-label="${st.speak ? 'Silenciar respuesta' : 'Leer respuesta en voz alta'}" title="${st.speak ? 'Te leo el resultado en voz alta' : 'Sin voz'}">${icon(st.speak ? 'volume' : 'volumeOff')}</button>
          </form>
          <label class="calc-voice-pick" ${st.speak && root.speechSynthesis ? '' : 'hidden'}><span>Voz</span><select class="select" id="calc-voice-sel" aria-label="Voz de la respuesta"></select></label>
          <div class="calc-answer ${st.answerOk ? '' : 'neg'}" data-calc-answer>${st.answer ? esc(st.answer) : `<span class="faint">${SR ? 'Toca el micrófono y di: «cuánto es 50 por 50» o «150 entre 5 personas».' : 'Escribe o usa el micrófono del teclado: «50 por 50», «150 entre 5 personas».'}</span>`}</div>
          <div class="calc-screen">
            <input class="calc-input num" id="calc-expr" value="${esc(st.expr)}" placeholder="0" autocomplete="off" spellcheck="false" inputmode="${/iPhone|iPad|Android/.test(navigator.userAgent) ? 'none' : 'decimal'}" aria-label="Operación">
            <div class="calc-out num" data-calc-out>${st.error ? `<span class="neg">${esc(st.error)}</span>` : preview !== null ? `= ${esc(fmt(preview))}` : '&nbsp;'}</div>
          </div>
          <div class="calc-keys">
            ${KEYS.map(([label, key, kind]) => `<button type="button" class="calc-key ${kind || ''}" data-calc-key="${esc(key)}" aria-label="${esc(label)}">${esc(label)}</button>`).join('')}
            <button type="button" class="calc-key eq" data-calc-key="=" aria-label="Igual">=</button>
          </div>
          <div class="calc-foot">
            <div class="row between" style="margin-bottom:8px"><span class="group-label" style="padding:0">Historial</span>${st.history.length ? '<button type="button" class="btn btn-ghost sm" data-calc-clear-hist>Borrar</button>' : ''}</div>
            <div data-calc-hist-wrap>${historyHtml()}</div>
          </div>
        </div>
        <div class="calc-tools">
          ${TOOLS.map((t) => `
          <div class="card calc-tool">
            <div class="calc-tool-title">${esc(t.title)}</div>
            <div class="calc-fields">${t.fields.map(([k, label, ph]) => `
              <label class="calc-field"><span>${esc(label)}</span><input class="input num" type="text" inputmode="decimal" data-tool="${t.id}" data-f="${k}" id="t_${t.id}_${k}" value="${esc(st.vals[`${t.id}.${k}`] ?? '')}" placeholder="${esc(ph)}" autocomplete="off"></label>`).join('')}
            </div>
            <div class="calc-tool-out" data-tool-out="${t.id}">${toolResult(t)}</div>
          </div>`).join('')}
        </div>
      </div>`;
    },

    mount(rootEl) {
      const input = rootEl.querySelector('#calc-expr');
      const out = rootEl.querySelector('[data-calc-out]');
      const histWrap = rootEl.querySelector('[data-calc-hist-wrap]');
      const sync = () => {
        input.value = st.expr;
        const p = st.expr && !st.done ? C.tryEval(st.expr) : null;
        out.innerHTML = st.error ? `<span class="neg">${esc(st.error)}</span>` : p !== null ? `= ${esc(fmt(p))}` : '&nbsp;';
      };
      const equals = () => {
        if (!st.expr) return;
        try {
          const r = C.evaluate(st.expr);
          if (r === null) return;
          st.history.unshift({ expr: st.expr, result: r });
          st.history = st.history.slice(0, 20);
          saveHistory(st.history);
          st.expr = String(r); st.done = true; st.error = '';
          histWrap.innerHTML = historyHtml();
          const clr = rootEl.querySelector('[data-calc-clear-hist]');
          if (!clr) DOS.app.render();
        } catch (e) { st.error = e.message; }
        sync();
      };
      const press = (k) => {
        st.error = '';
        if (k === '=') return equals();
        if (k === 'clear') { st.expr = ''; st.done = false; return sync(); }
        if (k === 'back') { st.expr = st.done ? '' : st.expr.slice(0, -1); st.done = false; return sync(); }
        const isOp = '+−×÷%'.includes(k) || k === ')';
        if (st.done && !isOp) st.expr = ''; // tras "=", un número empieza de nuevo; un operador sigue con el resultado
        st.done = false;
        st.expr += k;
        sync();
      };

      // Cuenta dicha o escrita en lenguaje normal
      const vform = rootEl.querySelector('[data-calc-voice]');
      const say = vform.elements.say;
      const answerEl = rootEl.querySelector('[data-calc-answer]');
      const speakOut = (text) => {
        if (!st.speak || !root.speechSynthesis) return;
        try {
          root.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          const v = pickVoice();
          if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
          u.rate = 0.95; u.pitch = 1;
          root.speechSynthesis.speak(u);
        } catch (e) { /* sin voz */ }
      };
      const sayNum = (n) => fmt(n, 2).replace(/,/g, '');
      const solve = () => {
        st.said = say.value.trim();
        if (!st.said) return;
        const r = C.fromSpeech(st.said);
        const v = r ? C.tryEval(r.expr) : null;
        if (!r || v === null) {
          st.answerOk = false; st.answer = 'No entendí la cuenta. Prueba: «50 por 50» o «150 entre 5 personas».';
          answerEl.className = 'calc-answer neg'; answerEl.textContent = st.answer;
          return speakOut('No entendí la cuenta');
        }
        const each = { personas: 'Cada persona paga', persona: 'Cada persona paga', amigos: 'Cada uno paga', panas: 'Cada uno paga', partes: 'Cada parte es', cuotas: 'Cada cuota es', meses: 'Cada mes son' }[r.unit] || 'Cada uno paga';
        st.answer = r.kind === 'split' ? `${each} ${fmt(v, 2)}` : r.kind === 'pct' ? `${r.expr.split('×')[1].replace('%', '')}% de ${fmt(r.expr.split('×')[0])} = ${fmt(v, 2)}` : `${r.expr} = ${fmt(v)}`;
        st.answerOk = true;
        answerEl.className = 'calc-answer'; answerEl.textContent = st.answer;
        st.expr = r.expr; st.done = false;
        equals();
        speakOut(r.kind === 'split' ? `${each} ${sayNum(v)}` : `Son ${sayNum(v)}`);
      };
      vform.addEventListener('submit', (e) => { e.preventDefault(); solve(); });
      say.addEventListener('input', () => { st.said = say.value; });
      const vsel = rootEl.querySelector('#calc-voice-sel');
      const fillVoices = () => {
        const vs = spanishVoices(), cur = pickVoice();
        vsel.innerHTML = vs.length ? vs.map((v) => `<option value="${esc(v.name)}" ${cur && v.name === cur.name ? 'selected' : ''}>${esc(v.name.replace(/\s*\(.*\)$/, ''))} · ${esc(v.lang)}${voiceScore(v) >= 30 ? ' ★' : ''}</option>`).join('') : '<option>Voz del sistema</option>';
      };
      if (root.speechSynthesis) {
        fillVoices();
        root.speechSynthesis.onvoiceschanged = fillVoices; // Chrome carga las voces después
        vsel.addEventListener('change', () => {
          try { localStorage.setItem(VKEY, vsel.value); } catch (e) { /* sin almacenamiento */ }
          speakOut('Hola, soy tu calculadora. ¿Qué cuenta hacemos?');
        });
      }
      rootEl.querySelector('[data-calc-speak]').addEventListener('click', () => {
        st.speak = !st.speak;
        try { localStorage.setItem(SKEY, st.speak ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
        if (st.speak) speakOut('Listo, te digo los resultados');
        DOS.app.render();
      });
      const mic = rootEl.querySelector('[data-calc-mic]');
      let rec = null, misses = 0;
      const hint = (html) => { answerEl.className = 'calc-answer'; answerEl.innerHTML = `<span class="faint">${html}</span>`; };
      // iPhone a veces repite la frase en cada resultado ("2x2 2x2"): se toma el texto más completo
      const transcript = (results) => {
        const parts = [...results].map((x) => x[0].transcript.trim()).filter(Boolean);
        if (!parts.length) return '';
        const last = parts[parts.length - 1];
        return parts.every((p) => last.includes(p)) ? last : parts.join(' ');
      };
      const keyboardTip = 'Si no te escucha, toca el campo de texto y usa el <b>micrófono del teclado</b>, luego pulsa <b>Ir</b>.';
      if (mic) mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) { /* sin voz */ }
        rec = new SR();
        rec.lang = /^es/.test(navigator.language) ? navigator.language : 'es-ES';
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        let text = '', solved = false, failed = '', quiet = null;
        const finish = () => { if (!solved && text) { solved = true; misses = 0; solve(); } };
        const stop = () => { try { rec && rec.stop(); } catch (e) { /* ya terminó */ } };
        const timer = setTimeout(stop, 15000);
        mic.classList.add('on');
        say.value = ''; hint('Te escucho… di la cuenta, por ejemplo «2 por 2».');
        // Espera a que termines: si la frase ya es una cuenta completa corta antes; si no, aguanta las pausas
        rec.onresult = (ev) => {
          text = transcript(ev.results);
          say.value = text;
          const r = C.fromSpeech(text);
          const complete = r && r.kind !== 'number';
          clearTimeout(quiet);
          quiet = setTimeout(stop, complete ? 900 : 2200);
        };
        rec.onerror = (ev) => { failed = ev.error; };
        rec.onend = () => {
          clearTimeout(timer); clearTimeout(quiet);
          mic.classList.remove('on'); rec = null;
          if (text) return finish();
          misses++;
          if (failed === 'not-allowed' || failed === 'service-not-allowed') hint(`El micrófono está bloqueado para la app. En iPhone revisa <b>Ajustes → General → Teclado → Dictado</b> y permite el micrófono. ${keyboardTip}`);
          else if (failed === 'audio-capture') hint(`Otra app está usando el micrófono. Ciérrala e inténtalo otra vez. ${keyboardTip}`);
          else hint(misses >= 2 ? `No te escuché. ${keyboardTip}` : 'No te escuché. Toca el micrófono y habla apenas se ponga rojo.');
        };
        try { rec.start(); } catch (e) { mic.classList.remove('on'); rec = null; hint(`No se pudo usar el micrófono. ${keyboardTip}`); }
      });

      rootEl.querySelector('.calc-keys').addEventListener('click', (e) => {
        const b = e.target.closest('[data-calc-key]');
        if (b) press(b.dataset.calcKey);
      });
      input.addEventListener('input', () => { st.expr = input.value; st.done = false; st.error = ''; sync(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
        if (e.key === 'Escape') { e.stopPropagation(); press('clear'); }
      });
      histWrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-calc-hist]');
        if (!b) return;
        const h = st.history[+b.dataset.calcHist];
        st.expr = String(h.result); st.done = true; st.error = '';
        sync();
        try { navigator.clipboard.writeText(String(h.result)).then(() => ui.toast(`Copiado: ${fmt(h.result)}`), () => {}); } catch (err) { /* sin portapapeles */ }
      });
      const clr = rootEl.querySelector('[data-calc-clear-hist]');
      if (clr) clr.addEventListener('click', () => { st.history = []; saveHistory([]); DOS.app.render(); });

      rootEl.querySelector('.calc-tools').addEventListener('input', (e) => {
        const f = e.target.closest('[data-tool]');
        if (!f) return;
        st.vals[`${f.dataset.tool}.${f.dataset.f}`] = f.value;
        const t = TOOLS.find((x) => x.id === f.dataset.tool);
        rootEl.querySelector(`[data-tool-out="${t.id}"]`).innerHTML = toolResult(t);
      });
      // En computadora el cursor queda listo para escribir
      if (!/iPhone|iPad|Android/.test(navigator.userAgent) && !document.activeElement.closest?.('.calc-tools, .calc-voice')) input.focus();
    },
  };
})(window);
