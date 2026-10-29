/* DANI OS — utilidades puras (fechas, números, texto). Sin dependencias de DOM. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const pad = (n) => String(n).padStart(2, '0');
  const LOCALE = 'es-ES';

  const U = {
    pad,

    uid(prefix = 'id') {
      return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    },

    /* ---------- Fechas (siempre ISO local "YYYY-MM-DD") ---------- */
    toISO(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    today() {
      return U.toISO(new Date());
    },
    parse(iso) {
      const [y, m, d] = String(iso).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    },
    addDays(iso, n) {
      const d = U.parse(iso);
      d.setDate(d.getDate() + n);
      return U.toISO(d);
    },
    addMonths(iso, n) {
      const d = U.parse(iso);
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return U.toISO(d);
    },
    /** Lunes = 1 … Domingo = 7 */
    isoWeekday(iso) {
      const wd = U.parse(iso).getDay();
      return wd === 0 ? 7 : wd;
    },
    startOfWeek(iso) {
      return U.addDays(iso, 1 - U.isoWeekday(iso));
    },
    endOfWeek(iso) {
      return U.addDays(U.startOfWeek(iso), 6);
    },
    startOfMonth(iso) {
      return iso.slice(0, 8) + '01';
    },
    endOfMonth(iso) {
      const d = U.parse(iso);
      return U.toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    },
    startOfYear(iso) {
      return iso.slice(0, 4) + '-01-01';
    },
    endOfYear(iso) {
      return iso.slice(0, 4) + '-12-31';
    },
    daysBetween(a, b) {
      return Math.round((U.parse(b) - U.parse(a)) / 864e5);
    },
    /** Rango {from,to} para day|week|month|year|all respecto a una fecha de referencia */
    periodRange(period, ref = U.today()) {
      switch (period) {
        case 'day': return { from: ref, to: ref };
        case 'week': return { from: U.startOfWeek(ref), to: U.endOfWeek(ref) };
        case 'month': return { from: U.startOfMonth(ref), to: U.endOfMonth(ref) };
        case 'year': return { from: U.startOfYear(ref), to: U.endOfYear(ref) };
        default: return { from: '0000-01-01', to: '9999-12-31' };
      }
    },
    shiftPeriod(period, ref, dir) {
      if (period === 'day') return U.addDays(ref, dir);
      if (period === 'week') return U.addDays(ref, 7 * dir);
      if (period === 'month') return U.addMonths(ref, dir);
      if (period === 'year') return U.addMonths(ref, 12 * dir);
      return ref;
    },
    inRange(iso, from, to) {
      return !!iso && iso >= from && iso <= to;
    },
    eachDay(from, to) {
      const out = [];
      for (let d = from; d <= to; d = U.addDays(d, 1)) out.push(d);
      return out;
    },
    nowTime() {
      const d = new Date();
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    toMin(t) {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    },
    fromMin(min) {
      const m = ((Math.round(min) % 1440) + 1440) % 1440;
      return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    },
    fmtDuration(min) {
      min = Math.round(+min || 0);
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60), m = min % 60;
      return m ? `${h} h ${m} min` : `${h} h`;
    },

    fmtDate(iso, opts = { day: 'numeric', month: 'short' }) {
      if (!iso) return '';
      return U.parse(iso).toLocaleDateString(LOCALE, opts).replace('.', '');
    },
    fmtDateLong(iso) {
      return U.fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });
    },
    fmtDateFull(iso) {
      return U.fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fmtMonth(iso) {
      return U.fmtDate(iso, { month: 'long', year: 'numeric' });
    },
    relDay(iso, ref = U.today()) {
      const diff = U.daysBetween(ref, iso);
      if (diff === 0) return 'Hoy';
      if (diff === 1) return 'Mañana';
      if (diff === -1) return 'Ayer';
      if (diff > 1 && diff < 7) return U.capitalize(U.fmtDate(iso, { weekday: 'long' }));
      return U.fmtDate(iso, U.parse(iso).getFullYear() === U.parse(ref).getFullYear()
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' });
    },
    capitalize(s) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    },

    /* ---------- Números ---------- */
    round2(n) {
      return Math.round((+n + Number.EPSILON) * 100) / 100;
    },
    sum(arr, fn = (x) => x) {
      return U.round2(arr.reduce((acc, x) => acc + (+fn(x) || 0), 0));
    },
    pct(part, total) {
      return total > 0 ? (part / total) * 100 : 0;
    },
    clamp(n, a, b) {
      return Math.min(b, Math.max(a, n));
    },
    groupSum(arr, keyFn, valFn) {
      const map = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        map.set(k, U.round2((map.get(k) || 0) + (+valFn(x) || 0)));
      }
      return [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
    },
    groupBy(arr, keyFn) {
      const map = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(x);
      }
      return map;
    },
    fmtPct(n, digits = 0) {
      return `${(+n || 0).toFixed(digits)}%`;
    },
    fmtNum(n, digits = 0) {
      return (+n || 0).toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    },

    /* ---------- Texto ---------- */
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    norm(s) {
      return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    },
    initials(name) {
      return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    },
    debounce(fn, ms = 150) {
      let t;
      return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
    /** PRNG determinista (para datos DEMO reproducibles) */
    seeded(seed = 42) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
  };

  DOS.utils = U;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
