(() => {
  'use strict';

  const defaultRunGoals = {high: 2, low: 4, highDistance: '10–15 km', lowDistance: '5 km'};
  const emptyWorkout = () => ({title: '', exercises: []});
  const blankSet = () => ({reps: null, weight: null});

  function withDefaults(state) {
    return {...state, templates: state.templates || [], runs: state.runs || [], runGoals: {...defaultRunGoals, ...state.runGoals}};
  }

  function isRecorded(exercise) {
    return exercise.done || exercise.minutes != null || exercise.sets?.some(set => set.reps != null || set.weight != null);
  }

  function workoutFor(state, date) {
    const day = state.days[date];
    const saved = day?.workout;
    if (day?.workoutPinned || saved?.exercises.some(isRecorded)) return saved;

    const weekday = new Date(`${date}T12:00:00`).getDay();
    const scheduled = (state.templates || []).filter(template => date >= template.startDate && template.weekdays.includes(weekday));
    if (!scheduled.length) return saved || emptyWorkout();

    const existing = saved?.exercises || [];
    const existingNames = new Set(existing.map(exercise => exercise.name.toLowerCase()));
    const recurring = scheduled.flatMap(template => template.exercises)
      .filter(exercise => !existingNames.has(exercise.name.toLowerCase()))
      .map(exercise => ({...exercise, kind: 'strength', sets: [blankSet()]}));
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

  window.DaymarkSchedule = {withDefaults, workoutFor, pinWorkout, emptyWorkout, blankSet};
})();
