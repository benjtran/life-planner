(() => {
  'use strict';

  const defaultRunGoals = {high: 2, low: 4, highDistance: '10–15 km', lowDistance: '5 km'};
  const emptyWorkout = () => ({title: '', exercises: []});
  const blankSet = () => ({reps: null, weight: null});
  const workoutItemId = date => `workout:${date}`;
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

  function workoutCompleted(state, date, workout) {
    const exercises = workout.exercises.filter(exercise => !exercise.removedFromPlan);
    return state.plannedCompletions?.[workoutItemId(date)] ?? (exercises.length > 0 && exercises.every(exercise => exercise.done === true));
  }

  function workoutFor(state, date, today) {
    const day = state.days[date];
    const saved = day?.workout;
    const pinned = saved && ((day.workoutPinned && (saved.title || saved.exercises.length)) || saved.exercises.some(isRecorded));
    if (pinned && (!today || date < today || workoutCompleted(state, date, saved))) return saved;

    const scheduled = scheduledFor(state.templates || [], date);
    if (!scheduled.length) return saved || emptyWorkout();

    const existing = saved?.exercises || [];
    const templateIds = scheduled.map(template => template.id);
    const plannedTitle = [...new Set(scheduled.map(template => template.title).filter(Boolean))].join(' + ');
    if (pinned) {
      const followsPlan = saved.templateIds
        ? saved.templateIds.some(id => templateIds.includes(id))
        : day.workoutPinned && saved.title === plannedTitle;
      if (!followsPlan) return saved;
    }

    const planned = new Map();
    for (const exercise of scheduled.flatMap(template => template.exercises)) {
      if (!planned.has(exercise.id)) planned.set(exercise.id, exercise);
    }
    const fresh = exercise => ({...exercise, exerciseId: exercise.id, kind: 'strength', sets: [blankSet()]});
    if (pinned) {
      const exercises = [];
      for (const exercise of planned.values()) {
        const logged = existing.filter(entry => entry.kind !== 'cardio' && (entry.exerciseId || entry.id) === exercise.id);
        exercises.push(...(logged.length ? logged.map(({removedFromPlan, ...entry}) => entry) : [fresh(exercise)]));
      }
      for (const entry of existing) {
        if (entry.kind === 'cardio') exercises.push(entry);
        else if (!planned.has(entry.exerciseId || entry.id) && isRecorded(entry)) exercises.push({...entry, removedFromPlan: true});
      }
      return {title: plannedTitle, templateIds, exercises};
    }

    const used = new Set(existing.map(exercise => exercise.exerciseId || exercise.id));
    const recurring = [...planned.values()].filter(exercise => !used.has(exercise.id)).map(fresh);
    const titles = [...new Set([saved?.title, ...scheduled.map(template => template.title)].filter(Boolean))];
    return {title: titles.join(' + '), templateIds, exercises: [...existing, ...recurring]};
  }

  function previousWorkoutSets(state, date) {
    const previous = new Map();
    const dates = Object.keys(state.days).filter(day => day < date).sort().reverse();
    for (const day of dates) {
      for (const exercise of state.days[day].workout?.exercises || []) {
        const id = exercise.exerciseId;
        if (!id || exercise.kind === 'cardio' || (previous.has(id) && previous.get(id).date !== day)) continue;
        const sets = (exercise.sets || []).filter(set => hasValue(set.reps) || hasValue(set.weight));
        if (!sets.length) continue;
        if (!previous.has(id)) previous.set(id, {date: day, sets: []});
        previous.get(id).sets.push(...sets);
      }
    }
    return previous;
  }

  const hasValue = value => value != null && value !== '' && Number.isFinite(Number(value));

  function workoutForLogging(state, date, today, previous = previousWorkoutSets(state, date)) {
    const workout = workoutFor(state, date, today);
    const saved = new Set((state.days[date]?.workout?.exercises || []).map(exercise => exercise.id));
    const exercises = workout.exercises.map(exercise => {
      const last = previous.get(exercise.exerciseId);
      return !last || saved.has(exercise.id) ? exercise : {...exercise, sets: last.sets.map(blankSet)};
    });
    return {...workout, exercises};
  }

  function pinWorkout(state, date, today) {
    const workout = workoutForLogging(state, date, today);
    const day = state.days[date] ||= {cardio: ''};
    day.workout = workout;
    day.workoutPinned = true;
    return workout;
  }

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

  function activitiesFor(state, date, today) {
    const items = [];
    const workout = workoutFor(state, date, today);
    const completions = state.plannedCompletions || {};
    const id = workoutItemId(date);
    if (workout.title || workout.exercises.length) {
      const exercises = workout.exercises.filter(exercise => !exercise.removedFromPlan).length;
      items.push({id, due: date, kind: 'workout', title: workout.title || 'Workout', done: workoutCompleted(state, date, workout),
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

  function applyWorkoutInputs(state, date, fields, today) {
    const workout = pinWorkout(state, date, today);
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

  window.DaymarkSchedule = {withDefaults, exerciseNameKey, workoutForLogging, previousWorkoutSets, workoutFor, pinWorkout, emptyWorkout, blankSet, activitiesFor, workoutItemId, formatRunPace, splitRunPace, applyWorkoutInputs};
})();
