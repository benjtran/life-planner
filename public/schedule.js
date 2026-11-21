(() => {
  'use strict';

  const defaultRunGoals = {high: 2, low: 4, highDistance: '10–15 km', lowDistance: '5 km'};
  const emptyWorkout = () => ({title: '', exercises: []});
  const blankSet = () => ({reps: null, weight: null});
  const exerciseNameKey = name => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

  function withDefaults(state) {
    const library = new Map((state.exerciseLibrary || []).map(exercise => [exercise.id, exercise]));
    const names = new Map([...library.values()].map(exercise => [exerciseNameKey(exercise.name), exercise]));
    const aliases = new Map();

    // Older workout days made a new ID for each exercise. Match their names
    // when there is no library reference, and retain each saved session row.
    function register(entry) {
      const reference = entry.exerciseId || entry.id;
      const key = exerciseNameKey(entry.name);
      let exercise = library.get(reference) || aliases.get(reference) || names.get(key);
      if (!exercise && key) {
        exercise = {id: reference || `legacy-exercise:${key}`, name: entry.name.trim()};
        library.set(exercise.id, exercise);
        names.set(key, exercise);
      }
      if (reference && exercise) aliases.set(reference, exercise);
      return exercise;
    }

    const templates = (state.templates || []).map(template => {
      const exercises = new Map();
      for (const entry of template.exercises || []) {
        const exercise = register(entry);
        if (exercise && !exercises.has(exercise.id)) exercises.set(exercise.id, {...entry, ...exercise});
      }
      return {...template, exercises: [...exercises.values()]};
    });
    const days = Object.fromEntries(Object.entries(state.days || {}).map(([date, day]) => {
      if (!day.workout?.exercises) return [date, day];
      const exercises = day.workout.exercises.map((entry, index) => {
        const exercise = entry.kind !== 'cardio' && register(entry);
        return exercise ? {...entry, id: entry.id || `legacy-session-row:${index}`, exerciseId: exercise.id, name: exercise.name} : entry;
      });
      return [date, {...day, workout: {...day.workout, exercises}}];
    }));
    return {...state, days, templates, exerciseLibrary: [...library.values()], runs: state.runs || [], runTypes: state.runTypes || [], plannedCompletions: state.plannedCompletions || {}, runGoals: {...defaultRunGoals, ...state.runGoals}};
  }

  const scheduledFor = (items, date) => {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return items.filter(item => date >= item.startDate && item.weekdays.includes(weekday));
  };

  function isRecorded(exercise) {
    return exercise.done || exercise.minutes != null || exercise.sets?.some(set => set.reps != null || set.weight != null);
  }

  function workoutFor(state, date) {
    const day = state.days[date];
    const saved = day?.workout;
    if (saved && ((day.workoutPinned && (saved.title || saved.exercises.length)) || saved.exercises.some(isRecorded))) return saved;

    const scheduled = scheduledFor(state.templates || [], date);
    if (!scheduled.length) return saved || emptyWorkout();

    const existing = saved?.exercises || [];
    const used = new Set(existing.map(exercise => exercise.exerciseId || exercise.id));
    const recurring = [];
    for (const exercise of scheduled.flatMap(template => template.exercises)) {
      if (used.has(exercise.id)) continue;
      used.add(exercise.id);
      recurring.push({...exercise, exerciseId: exercise.id, kind: 'strength', sets: [blankSet()]});
    }
    const titles = [...new Set([saved?.title, ...scheduled.map(template => template.title)].filter(Boolean))];
    return {title: titles.join(' + '), exercises: [...existing, ...recurring]};
  }

  function pinWorkout(state, date) {
    const workout = workoutFor(state, date);
    const day = state.days[date] ||= {cardio: ''};
    day.workout = workout;
    day.workoutPinned = true;
    return workout;
  }

  const workoutItemId = date => `workout:${date}`;
  const runItemId = (date, typeId) => `run:${date}:${typeId}`;

  function formatRunPace(minutes, seconds) {
    if (!minutes && !seconds) return '';
    if (!/^\d*$/.test(minutes) || !/^\d*$/.test(seconds)) return null;
    const min = Number(minutes);
    const sec = Number(seconds);
    if (!Number.isSafeInteger(min) || sec > 59 || min + sec === 0) return null;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  function splitRunPace(pace) {
    const parts = /^(\d+)(?::(\d{1,2}))?$/.exec(String(pace ?? '').trim());
    const normalized = parts && formatRunPace(parts[1], parts[2] ?? '');
    return normalized ? normalized.split(':') : null;
  }

  function activitiesFor(state, date) {
    const items = [];
    const workout = workoutFor(state, date);
    const completions = state.plannedCompletions || {};
    const id = workoutItemId(date);
    if (workout.title || workout.exercises.length) {
      const exercises = workout.exercises.length;
      items.push({id, due: date, kind: 'workout', title: workout.title || 'Workout', done: completions[id] ?? (exercises > 0 && workout.exercises.every(exercise => exercise.done === true)),
        detail: exercises ? `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}` : ''});
    }

    const scheduled = scheduledFor(state.runTypes || [], date);
    const runs = (state.runs || []).filter(run => run.date === date);
    for (const type of scheduled) {
      const id = runItemId(date, type.id);
      const linked = runs.some(run => run.runTypeId === type.id);
      items.push({id, due: date, kind: 'run', title: type.title, done: completions[id] ?? linked,
        detail: [`${type.distance} km`, type.pace && `${type.pace} min/km`].filter(Boolean).join(' · ')});
    }
    for (const run of runs) {
      if (scheduled.some(type => type.id === run.runTypeId)) continue;
      const id = `run-log:${run.id}`;
      items.push({id, due: date, kind: 'run',
        title: run.typeName || `${run.intensity === 'high' ? 'High' : 'Low'}-intensity run`, done: completions[id] ?? true, detail: `${run.distance} km`});
    }
    return items;
  }

  function applyWorkoutInputs(state, date, fields) {
    const workout = pinWorkout(state, date);
    for (const {form, id, index, values} of fields) {
      const exercise = workout.exercises.find(entry => entry.id === id);
      if (!exercise) continue;
      const numberOrBlank = value => value === '' ? null : Number(value);
      if (form === 'save-cardio') exercise.minutes = numberOrBlank(values.minutes);
      if (form === 'save-set' && exercise.sets?.[index]) {
        Object.assign(exercise.sets[index], {reps: numberOrBlank(values.reps), weight: numberOrBlank(values.weight)});
      }
    }
    return workout;
  }

  window.DaymarkSchedule = {withDefaults, exerciseNameKey, workoutFor, pinWorkout, emptyWorkout, blankSet, activitiesFor, workoutItemId, formatRunPace, splitRunPace, applyWorkoutInputs};
})();
