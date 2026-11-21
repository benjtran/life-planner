import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const window = {};
runInNewContext(readFileSync(new URL('../public/schedule.js', import.meta.url), 'utf8'), {window});
const {withDefaults, workoutFor, workoutForLogging, previousWorkoutSets, pinWorkout, blankSet, activitiesFor, applyWorkoutInputs, formatRunPace, splitRunPace} = window.DaymarkSchedule;

function planner() {
  return withDefaults({days: {}, tasks: [], templates: [{
    id: 'back', title: 'Back Day', weekdays: [1], startDate: '2026-11-23',
    exercises: [{id: 'lat', name: 'Lat pulldown'}],
  }]});
}

test('reusable workout days repeat on assigned weekdays from their start date', () => {
  const state = planner();
  for (const date of ['2026-11-16', '2026-11-24']) assert.equal(workoutFor(state, date).exercises.length, 0);
  for (const date of ['2026-11-23', '2026-11-30']) assert.equal(workoutFor(state, date).exercises[0].name, 'Lat pulldown');
  assert.equal(Object.keys(state.days).length, 0, 'reading a recurring workout does not save an empty session');
});

test('workouts on the same date schedule a shared exercise once and keep sets isolated by date', () => {
  const state = withDefaults({...planner(), templates: [
    ...planner().templates,
    {id: 'legs', title: 'Leg day', weekdays: [1, 2], startDate: '2026-11-23', exercises: [{id: 'old-copy', name: ' LAT  PULLDOWN '}]}
  ]});
  assert.equal(state.exerciseLibrary.length, 1);
  const monday = pinWorkout(state, '2026-11-23').exercises;
  const tuesday = pinWorkout(state, '2026-11-24').exercises;
  assert.equal(monday.length, 1);
  assert.equal(tuesday.length, 1);
  assert.equal(monday[0].exerciseId, tuesday[0].exerciseId);
  monday[0].sets[0].reps = 9;
  assert.equal(tuesday[0].sets[0].reps, null);
});

test('an empty session saved before a workout was assigned still shows the scheduled exercises', () => {
  const state = planner();
  const date = '2026-11-23';
  state.days[date] = {workoutPinned: true, workout: {title: '', exercises: []}};
  assert.equal(workoutFor(state, date).title, 'Back Day');
  assert.equal(workoutFor(state, date).exercises[0].name, 'Lat pulldown');
});

test('logging a dated session preserves its sets through edits to the recurring plan', () => {
  const state = planner();
  const session = pinWorkout(state, '2026-11-23');
  session.exercises[0].sets[0] = {reps: 8, weight: 70};
  state.templates[0].exercises = [{id: 'row', name: 'Barbell row'}];
  assert.equal(workoutFor(state, '2026-11-23').exercises[0].sets[0].reps, 8);
  assert.equal(workoutFor(state, '2026-11-23').exercises[0].sets[0].weight, 70);
  assert.equal(workoutFor(state, '2026-11-30').exercises[0].name, 'Barbell row');
});

test('upgrading old planner data preserves tasks and completed dated workouts', () => {
  const legacy = {tasks: [{id: 'homework'}], days: {'2026-11-23': {workout: {title: 'One-off', exercises: [{id: 'raise', name: 'Lateral raise', done: true, sets: []}]}}}};
  const state = withDefaults({...legacy, templates: planner().templates});
  assert.equal(state.tasks, legacy.tasks);
  assert.equal(workoutFor(state, '2026-11-23').title, 'One-off');
  assert.equal(state.runGoals.high, 2);
  assert.equal(state.runGoals.low, 4);
});

test('appending a set preserves typed reps and weight in the earlier set and its undo snapshot', () => {
  const state = planner();
  const date = '2026-11-23';
  const workout = applyWorkoutInputs(state, date, [{form: 'save-set', id: 'lat', index: 0, values: {reps: '10', weight: '60'}}]);
  const beforeAdd = structuredClone(state);
  workout.exercises[0].sets.push(blankSet());
  assert.equal(state.days[date].workout.exercises[0].sets.length, 2);
  for (const snapshot of [state, beforeAdd]) {
    const first = workoutFor(snapshot, date).exercises[0].sets[0];
    assert.equal(first.reps, 10);
    assert.equal(first.weight, 60);
  }
  assert.equal(workoutFor(beforeAdd, date).exercises[0].sets.length, 1);
});

test('a new session suggests the latest recorded sets across workout days without logging the hints', () => {
  const state = planner();
  const record = (date, title, sets) => {
    state.days[date] = {workout: {title, exercises: [{id: 'lat', exerciseId: 'lat', name: 'Lat pulldown', sets}]}};
  };
  record('2026-11-18', 'Leg day', [{reps: 1, weight: 45}]);
  record('2026-11-20', 'Upper day', [{reps: 10, weight: 60}, {reps: 8, weight: 0}, {reps: null, weight: null}]);
  record('2026-11-21', 'Leg day', [{reps: null, weight: null}]);
  record('2026-11-25', 'Upper day', [{reps: 12, weight: 80}]);
  const date = '2026-11-23';
  const last = previousWorkoutSets(state, date).get('lat');
  assert.equal(last.date, '2026-11-20');
  assert.equal(last.sets.length, 2);
  assert.equal(last.sets[1].weight, 0);
  const workout = workoutForLogging(state, date);
  assert.equal(state.days[date], undefined);
  assert.equal(workout.exercises[0].sets.length, 2);
  assert.ok(workout.exercises[0].sets.every(set => set.reps === null && set.weight === null));
  const saved = applyWorkoutInputs(state, date, [{form: 'save-set', id: 'lat', index: 1, values: {reps: '9', weight: ''}}]);
  assert.equal(saved.exercises[0].sets[1].reps, 9);
  assert.ok(saved.exercises[0].sets.every(set => set.weight === null));
  saved.exercises[0].sets.splice(0, 1);
  assert.equal(workoutForLogging(state, date).exercises[0].sets.length, 1, 'deleted rows stay deleted');
});

test('activities show a single workout and put scheduled runs on their weekday only', () => {
  const state = planner();
  state.runTypes.push({id: 'easy', title: 'Easy run', distance: 5, pace: '6:30', weekdays: [1], startDate: '2026-11-23'});
  const items = activitiesFor(state, '2026-11-23');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Back Day');
  assert.equal(items[1].detail, '5 km · 6:30 min/km');
  assert.equal(activitiesFor(state, '2026-11-24').length, 0);
  state.runs.push({id: 'record', runTypeId: 'easy', date: '2026-11-23', distance: 5, intensity: 'low'});
  assert.equal(activitiesFor(state, '2026-11-23').length, 2);
  assert.equal(activitiesFor(state, '2026-11-23')[1].done, true);
  assert.equal(activitiesFor(state, '2026-11-30')[1].done, false);
});

test('old run logs stay visible as completed runs and accept checklist changes', () => {
  const state = planner();
  const date = '2026-11-23';
  state.runs.push({id: 'old', date, distance: 5, intensity: 'low'});
  const run = activitiesFor(state, date).find(item => item.kind === 'run');
  assert.equal(run.title, 'Low-intensity run');
  assert.equal(run.done, true);
  state.plannedCompletions[run.id] = false;
  assert.equal(activitiesFor(state, date).find(item => item.id === run.id).done, false);
  assert.equal(state.runs.length, 1);
});

test('whole-minute and minute-second pace goals round-trip through numeric fields', () => {
  assert.equal(formatRunPace('6', '5'), '6:05');
  assert.equal(formatRunPace('6', ''), '6:00');
  assert.equal(formatRunPace('', '45'), '0:45');
  assert.equal(formatRunPace('', ''), '');
  assert.equal(formatRunPace('6', '60'), null);
  assert.equal(formatRunPace('6.5', '0'), null);
  assert.equal(formatRunPace('0', '0'), null);
  for (const [saved, normalized] of [['6', '6:00'], ['6:5', '6:05'], ['6:30', '6:30']]) {
    assert.equal(formatRunPace(...splitRunPace(saved)), normalized);
  }
  assert.equal(splitRunPace('6:30–7:00'), null);
});
