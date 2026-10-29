/* DANI BOSS — motor de la calculadora. Evalúa expresiones sin eval():
   + − × ÷ ^ paréntesis y %. Como en el celular: "200 + 10%" = 220 y "200 × 10%" = 20. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});

  function tokenize(src) {
    const s = String(src).replace(/[×x*]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
    const out = [];
    for (let i = 0; i < s.length;) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (m) { out.push({ t: 'n', v: parseFloat(m[1]) }); i += m[1].length; continue; }
      if ('+-*/^%()'.includes(s[i])) { out.push({ t: s[i] }); i++; continue; }
      throw new Error('Carácter no válido');
    }
    return out;
  }

  function evaluate(src) {
    const tk = tokenize(src);
    if (!tk.length) return null;
    let i = 0;
    const peek = () => tk[i] && tk[i].t;
    const take = (t) => { if (peek() !== t) throw new Error('Expresión incompleta'); i++; };

    function primary() {
      if (peek() === 'n') return tk[i++].v;
      if (peek() === '(') { i++; const v = expr(); if (peek() === ')') i++; return v; } // paréntesis sin cerrar: se cierra solo
      throw new Error('Expresión incompleta');
    }
    function postfix() {
      let v = primary(), pct = false;
      while (peek() === '%') { i++; v /= 100; pct = true; }
      return { v, pct };
    }
    function unary() {
      if (peek() === '-') { i++; const r = unary(); return { v: -r.v, pct: r.pct }; }
      if (peek() === '+') { i++; return unary(); }
      return postfix();
    }
    function power() {
      const b = unary();
      if (peek() === '^') { i++; const e = power(); return { v: Math.pow(b.v, e.v), pct: false }; }
      return b;
    }
    function term() {
      let l = power();
      while (peek() === '*' || peek() === '/') {
        const op = tk[i++].t, r = power();
        if (op === '/' && r.v === 0) throw new Error('No se puede dividir entre 0');
        l = { v: op === '*' ? l.v * r.v : l.v / r.v, pct: false };
      }
      return l;
    }
    function expr() {
      let v = term().v;
      while (peek() === '+' || peek() === '-') {
        const op = tk[i++].t, r = term();
        const delta = r.pct ? v * r.v : r.v; // "a + b%" = a + a·b/100
        v = op === '+' ? v + delta : v - delta;
      }
      return v;
    }

    const v = expr();
    if (i < tk.length) take('fin');
    if (!Number.isFinite(v)) throw new Error('Resultado fuera de rango');
    return Math.round(v * 1e10) / 1e10;
  }

  /** Igual que evaluate pero sin lanzar: null si la expresión no es válida. */
  function tryEval(src) { try { return evaluate(src); } catch (e) { return null; } }

  const num = (x) => { const n = parseFloat(String(x).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const r2 = (n) => Math.round(n * 100) / 100;

  // Herramientas rápidas: reciben números y devuelven { value, detail } o null si faltan datos
  const tools = {
    pctOf(p, x) { p = num(p); x = num(x); return p === null || x === null ? null : { value: r2((x * p) / 100) }; },
    whatPct(a, b) { a = num(a); b = num(b); return a === null || !b ? null : { value: r2((a / b) * 100), unit: '%' }; },
    addPct(x, p) { x = num(x); p = num(p); return x === null || p === null ? null : { value: r2(x * (1 + p / 100)), detail: r2((x * p) / 100) }; },
    subPct(x, p) { x = num(x); p = num(p); return x === null || p === null ? null : { value: r2(x * (1 - p / 100)), detail: r2((x * p) / 100) }; },
    change(a, b) { a = num(a); b = num(b); return a === null || b === null || a === 0 ? null : { value: r2(((b - a) / Math.abs(a)) * 100), unit: '%', detail: r2(b - a) }; },
    withTax(x, rate) { x = num(x); rate = num(rate); return x === null || rate === null ? null : { value: r2(x * (1 + rate / 100)), detail: r2((x * rate) / 100) }; },
    withoutTax(x, rate) { x = num(x); rate = num(rate); return x === null || rate === null ? null : { value: r2(x / (1 + rate / 100)), detail: r2(x - x / (1 + rate / 100)) }; },
    margin(cost, price) { cost = num(cost); price = num(price); return cost === null || !price ? null : { value: r2(price - cost), pct: r2(((price - cost) / price) * 100), markup: cost ? r2(((price - cost) / cost) * 100) : null }; },
    split(total, people, tipPct) { total = num(total); people = num(people); tipPct = num(tipPct) || 0; return total === null || !people || people < 1 ? null : { value: r2((total * (1 + tipPct / 100)) / people), detail: r2(total * (1 + tipPct / 100)) }; },
  };

  /* ---------- Cuentas dichas en voz ---------- */
  const NUM_WORDS = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
    ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
    cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
  };

  // "ciento cincuenta y cinco mil" → "155000"; "ocho punto cinco" → "8.5"
  function wordsToDigits(s) {
    const tk = s.split(' ');
    const out = [];
    for (let i = 0; i < tk.length;) {
      // "un/una" son artículo salvo en "un mil", "un millón"; "cada uno" no es un número
      const article = (tk[i] === 'un' || tk[i] === 'una') && !/^(mil|millon|millones)$/.test(tk[i + 1] || '');
      const eachOne = tk[i] === 'uno' && tk[i - 1] === 'cada';
      if ((!(tk[i] in NUM_WORDS) && tk[i] !== 'mil') || article || eachOne) { out.push(tk[i]); i++; continue; }
      let total = 0, cur = 0, j = i, any = false;
      while (j < tk.length) {
        const w = tk[j];
        if (w in NUM_WORDS) { cur += NUM_WORDS[w]; any = true; j++; }
        else if (w === 'mil') { total += (cur || 1) * 1000; cur = 0; any = true; j++; }
        else if (/^(millon|millones)$/.test(w)) { total = (total + (cur || 1)) * 1e6; cur = 0; j++; }
        else if (w === 'y' && any && (NUM_WORDS[tk[j + 1]] || 0) > 0 && NUM_WORDS[tk[j + 1]] < 10 && cur % 10 === 0 && cur >= 30) j++;
        else break;
      }
      out.push(String(total + cur));
      i = j;
    }
    return out.join(' ').replace(/(\d)\s+(?:punto|coma)\s+(\d)/g, '$1.$2');
  }

  /** Convierte una frase ("cuánto es 50 por 50", "150 entre 5 personas") en { expr, kind, people }. */
  function fromSpeech(text) {
    let s = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[¿?¡!]/g, ' ').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)\.(\d{3})\b/g, '$1$2').replace(/\s+/g, ' ').trim();
    // Símbolos que escribe el dictado: "2x2", "2*2", "10/2", "5-3", "2×2"
    s = s.replace(/(\d)\s*[x*×]\s*(?=\d)/g, '$1 × ').replace(/(\d)\s*[/÷]\s*(?=\d)/g, '$1 ÷ ')
      .replace(/(\d)\s*[-–−]\s*(?=\d)/g, '$1 − ').replace(/(\d)\s*\+\s*(?=\d)/g, '$1 + ').replace(/(\d)\s*%/g, '$1 %');
    s = s.replace(/\b(por ciento|porciento)\b/g, ' % ').replace(/\s+/g, ' ');
    s = wordsToDigits(s);
    s = s.replace(/\$\s*/g, '').replace(/\b(dolares|dolar|usd|pesos|euros|soles)\b/g, ' ');

    // Dividir entre personas: "150 entre 5 personas", "dividir 150 para 5", "reparte 150 en 5"
    const N = '(\\d+(?:\\.\\d+)?)', SEP = '(?:entre|para|en|por)', UNIT = '(personas|persona|amigos|partes|panas|cuotas|meses)';
    let m = s.match(new RegExp(`${N}(?:\\s+\\S+){0,4}?\\s+${SEP}\\s+${N}\\s*${UNIT}\\b`));
    if (!m) m = s.match(new RegExp(`\\b(?:divid\\w*|repart\\w*|part[ei]\\w*)\\b(?:\\s+\\S+){0,3}?\\s+${N}(?:\\s+\\S+){0,2}?\\s+${SEP}\\s+${N}`));
    if (!m) m = s.match(new RegExp(`${N}(?:\\s+\\S+){0,3}?\\s+(?:divid\\w*|repart\\w*)\\s+${SEP}\\s+${N}`));
    // Frases sueltas: "somos 5 y la cuenta es 150", "cuánto paga cada uno si son 150 y somos 5"
    if (!m && /\b(somos|cada uno|cada una|cada quien|por persona|por cabeza|le toca|toca a|divid\w*|repart\w*|personas|amigos|panas)\b/.test(s)) {
      const nums = s.match(/\d+(?:\.\d+)?/g) || [];
      const pm = s.match(/\bsomos\s+(\d+)\b/) || s.match(/\b(\d+)\s*(?:personas|persona|amigos|panas|partes)\b/) || s.match(/\b(?:entre|para|en)\s+(\d+)\b/);
      if (pm && nums.length === 2) {
        const people = pm[1], amount = nums[0] === people ? nums[1] : nums[0];
        if (+people > 0) return { expr: `${amount}÷${people}`, kind: 'split', people: +people, unit: 'personas' };
      }
    }
    if (m) return { expr: `${m[1]}÷${m[2]}`, kind: 'split', people: +m[2], unit: m[3] || 'personas' };

    // "el 15 por ciento de 80", "15% de 80"
    m = s.match(/(\d+(?:\.\d+)?)\s*(?:%|por ciento|porciento)\s*(?:de|del)\s+(\d+(?:\.\d+)?)/);
    if (m && !/(mas|menos|\+|-)\s*(el\s+)?\d+(\.\d+)?\s*(%|por ciento)/.test(s)) return { expr: `${m[2]}×${m[1]}%`, kind: 'pct' };

    s = s
      .replace(/\b(por ciento|porciento)\b/g, '%')
      .replace(/\b(al cuadrado)\b/g, '^2').replace(/\b(al cubo)\b/g, '^3')
      .replace(/\belevado a(?: la)?\b/g, '^')
      .replace(/\b(multiplicado por|multiplicado|por|veces|x)\b/g, '×')
      .replace(/\b(dividido entre|dividido para|dividido por|dividido|entre|sobre|para)\b/g, '÷')
      .replace(/\b(mas|sumado a|sumale|suma|y)\b/g, '+')
      .replace(/\b(menos|restale|resta)\b/g, '−')
      .replace(/\babre parentesis\b/g, '(').replace(/\bcierra parentesis\b/g, ')');
    // Solo números y operadores; dos números seguidos sin operador = no se entendió (mejor que inventar "22")
    const tokens = s.match(/\d+(?:\.\d+)?|[+−×÷%^()]/g) || [];
    for (let k = 1; k < tokens.length; k++) if (/\d/.test(tokens[k]) && /\d/.test(tokens[k - 1])) return null;
    const expr = tokens.join('').replace(/^[+×÷^]+|[+−×÷^]+$/g, '');
    if (!/\d/.test(expr) || tryEval(expr) === null) return null;
    return { expr, kind: /[+−×÷%^]/.test(expr) ? 'expr' : 'number' };
  }

  DOS.calc = { evaluate, tryEval, tools, fromSpeech };
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
