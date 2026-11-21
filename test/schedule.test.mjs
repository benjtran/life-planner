import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const window = {};
runInNewContext(readFileSync(new URL('../public/schedule.js', import.meta.url), 'utf8'), {window});
const {withDefaults, workoutFor, pinWorkout} = window.DaymarkSchedule;

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
