/* DANI OS — cálculos de productividad y fitness (hábitos, tareas, agenda, entrenamientos). Funciones puras. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const U = DOS.utils;

  const L = {
    /* ---------- Hábitos ---------- */
    habitDates(habitId, logs) {
      return new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date));
    },
    habitStats(habit, logs, ref = U.today()) {
      const done = L.habitDates(habit.id, logs);
      const doneToday = done.has(ref);
      // Racha actual: termina hoy si está hecho; si no, ayer (hoy aún puede completarse)
      let current = 0;
      for (let d = doneToday ? ref : U.addDays(ref, -1); done.has(d); d = U.addDays(d, -1)) current++;
      // Mejor racha
      let best = 0, run = 0, prev = null;
      [...done].filter((d) => d <= ref).sort().forEach((d) => {
        run = prev && U.daysBetween(prev, d) === 1 ? run + 1 : 1;
        best = Math.max(best, run);
        prev = d;
      });
      // Cumplimiento: últimos 30 días (o desde que existe el hábito si es más reciente)
      const created = (habit.start_date || (habit.created_at || '').slice(0, 10) || ref);
      const from = created > U.addDays(ref, -29) ? created : U.addDays(ref, -29);
      const window = Math.max(1, U.daysBetween(from, ref) + 1);
      let hits = 0;
      for (let d = from; d <= ref; d = U.addDays(d, 1)) if (done.has(d)) hits++;
      return { done, doneToday, current, best, rate: U.clamp((hits / window) * 100, 0, 100), hits, window };
    },

    /* ---------- Tareas ---------- */
    taskBuckets(tasks, ref = U.today()) {
      const weekEnd = U.endOfWeek(ref);
      const open = (t) => t.status !== 'completada';
      const sortFn = (a, b) => {
        const po = { alta: 0, media: 1, baja: 2 };
        return (a.date || '9999').localeCompare(b.date || '9999') || (po[a.priority] ?? 1) - (po[b.priority] ?? 1) || (a.time || '99').localeCompare(b.time || '99');
      };
      return {
        today: tasks.filter((t) => t.date === ref || (open(t) && t.date && t.date < ref)).sort(sortFn),
        week: tasks.filter((t) => t.date && t.date > ref && t.date <= weekEnd).sort(sortFn),
        upcoming: tasks.filter((t) => open(t) && (!t.date || t.date > weekEnd)).sort(sortFn),
        completed: tasks.filter((t) => !open(t)).sort((a, b) => (b.completed_at || b.updated_at || '').localeCompare(a.completed_at || a.updated_at || '')),
      };
    },

    /* ---------- Agenda ---------- */
    eventsOn(data, iso) {
      return data.events.filter((e) => e.date === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    },
    nextEvent(data, ref = U.today(), now = U.nowTime()) {
      return data.events
        .filter((e) => e.date > ref || (e.date === ref && (e.time || '23:59') >= now))
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0] || null;
    },

    /* ---------- Entrenamiento ---------- */
    routineFor(data, iso) {
      const wd = U.isoWeekday(iso);
      return data.routines.find((r) => +r.weekday === wd) || null;
    },
    exercisesOf(data, routineId) {
      return data.exercises.filter((e) => e.routine_id === routineId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    workoutOn(data, iso) {
      return data.workouts.find((w) => w.date === iso) || null;
    },
    nextTraining(data, ref = U.today()) {
      for (let i = 0; i < 8; i++) {
        const date = U.addDays(ref, i);
        const routine = L.routineFor(data, date);
        if (!routine) continue;
        if (i === 0 && L.workoutOn(data, date)) continue;
        return { date, routine, exercises: L.exercisesOf(data, routine.id) };
      }
      return null;
    },
    /** Último registro de un ejercicio (para precargar pesos). */
    lastSetFor(data, name) {
      const n = U.norm(name);
      const ws = data.workouts.slice().sort((a, b) => b.date.localeCompare(a.date));
      for (const w of ws) {
        const e = (w.exercises || []).find((x) => U.norm(x.name) === n);
        if (e) return e;
      }
      return null;
    },
    workoutStats(data, ref = U.today()) {
      const month = U.periodRange('month', ref);
      const monthWorkouts = data.workouts.filter((w) => U.inRange(w.date, month.from, month.to));
      // Sesiones planificadas del mes hasta hoy = días con rutina asignada
      const planned = U.eachDay(month.from, ref).filter((d) => L.routineFor(data, d)).length;
      const doneOnPlanned = monthWorkouts.filter((w) => w.date <= ref && L.routineFor(data, w.date)).length;
      const weeks = [];
      for (let i = 11; i >= 0; i--) {
        const from = U.addDays(U.startOfWeek(ref), -7 * i);
        const to = U.addDays(from, 6);
        weeks.push({ key: from, label: U.fmtDate(from), value: data.workouts.filter((w) => U.inRange(w.date, from, to)).length });
      }
      // Racha de semanas con al menos 1 entrenamiento
      let weekStreak = 0;
      for (let i = weeks.length - 1; i >= 0 && weeks[i].value > 0; i--) weekStreak++;
      const volume = U.sum(monthWorkouts, (w) => (w.exercises || []).reduce((acc, e) => acc + (+e.sets || 0) * (+e.reps || 0) * (+e.weight || 0), 0));
      return {
        total: data.workouts.length,
        month: monthWorkouts.length,
        planned,
        consistency: planned > 0 ? U.clamp((doneOnPlanned / planned) * 100, 0, 100) : 0,
        weeks, weekStreak, volume,
      };
    },
    exerciseNames(data) {
      const names = new Map();
      data.workouts.forEach((w) => (w.exercises || []).forEach((e) => names.set(U.norm(e.name), e.name)));
      return [...names.values()].sort((a, b) => a.localeCompare(b));
    },
    exerciseHistory(data, name) {
      const n = U.norm(name);
      return data.workouts
        .map((w) => {
          const e = (w.exercises || []).find((x) => U.norm(x.name) === n);
          return e ? { date: w.date, value: +e.weight || 0, reps: +e.reps || 0, sets: +e.sets || 0 } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    personalRecords(data) {
      return L.exerciseNames(data).map((name) => {
        const h = L.exerciseHistory(data, name);
        const best = h.reduce((m, x) => (x.value > m.value ? x : m), { value: 0 });
        const first = h[0] ? h[0].value : 0;
        return { name, best: best.value, date: best.date, sessions: h.length, delta: U.round2(best.value - first) };
      }).filter((r) => r.best > 0).sort((a, b) => b.best - a.best);
    },
  };

  DOS.life = L;
  if (typeof module !== 'undefined') module.exports = DOS;
})(typeof window !== 'undefined' ? window : globalThis);
