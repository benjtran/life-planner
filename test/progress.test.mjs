import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const window = {};
for (const script of ['schedule', 'training']) {
  runInNewContext(readFileSync(new URL(`../public/${script}.js`, import.meta.url), 'utf8'), {window});
}
const training = window.DaymarkViews.training;
const exercises = (...sets) => ({workout: {exercises: [{name: 'Lat pulldown', kind: 'strength', sets}]}});
const render = (days, progressMetric = '') => training({
  state: window.DaymarkSchedule.withDefaults({days}), trainingView: 'progress', progressExercise: '', progressMetric,
  pretty: date => date, esc: String
});

test('progress plots the daily mean and each measured set independently by metric', () => {
  const days = {
    '2026-11-19': exercises({weight: 30, reps: 10}, {weight: 40, reps: null}, {weight: '', reps: 6}, {weight: 0, reps: 8}),
    '2026-11-20': exercises({weight: 40.5, reps: 5}, {weight: 40.5, reps: 5})
  };
  const weight = render(days);
  assert.match(weight, /2026-11-19, Daily average · 3 sets, Weight 23.33/);
  assert.match(weight, /2026-11-19, Set 4, Weight 0 · Reps 8/);
  assert.doesNotMatch(weight, /class="chart-point chart-point-set"[^>]+aria-label="2026-11-19, Set 3,/);
  assert.equal((weight.match(/class="chart-point chart-point-set"/g) || []).length, 5);
  assert.equal((weight.match(/class="chart-point chart-point-mean"/g) || []).length, 2);
  assert.match(weight, /2026-11-20, Daily average · 2 sets, Weight 40.5/);
  assert.ok((weight.match(/<i style="--tick:/g) || []).length > 5);
  const reps = render(days, 'reps');
  assert.match(reps, /2026-11-19, Daily average · 3 sets, Reps 8/);
  assert.match(reps, /2026-11-19, Set 3, Reps 6/);
  assert.match(reps, /2026-11-20, Set 2, Reps 5 · Weight 40.5/);
  assert.doesNotMatch(reps, /class="chart-point chart-point-set"[^>]+aria-label="2026-11-19, Set 2,/);
});

test('progress handles constant values, reps-only exercises, and blank sessions', () => {
  const days = {
    '2026-11-18': exercises({weight: null, reps: null}),
    '2026-11-19': exercises({weight: null, reps: 0}, {weight: null, reps: 0})
  };
  const reps = render(days);
  assert.match(reps, /data-metric="reps" aria-pressed="true"/);
  assert.match(reps, /Daily average · 2 sets, Reps 0/);
  assert.doesNotMatch(reps, /NaN|Infinity|datetime="2026-11-18"/);
  assert.match(render(days, 'weight'), /No weight logged for Lat pulldown/);
  assert.match(render({'2026-11-18': days['2026-11-18']}), /No progress yet/);
});

test('volume averages individual weight × reps products and skips incomplete sets', () => {
  const days = {
    '2026-11-18': exercises({weight: 0, reps: 8}, {weight: 50, reps: 0}),
    '2026-11-19': exercises({weight: 40, reps: 10}, {weight: 80, reps: 5}, {weight: 60, reps: 8}),
    '2026-11-20': exercises({weight: 70, reps: null}, {weight: '', reps: 7})
  };
  const volume = render(days, 'volume');
  assert.match(volume, /data-metric="volume" aria-pressed="true"/);
  assert.match(volume, /2026-11-18, Daily average · 2 sets, Volume 0/);
  assert.match(volume, /2026-11-19, Set 3, Volume 480 · Weight 60 · Reps 8/);
  assert.match(volume, /2026-11-19, Daily average · 3 sets, Volume 426\.67/);
  assert.doesNotMatch(volume, /aria-label="2026-11-20, (Daily average|Set)/);
  assert.match(volume, /<th scope="col">Avg\. volume<\/th>/);
  assert.match(volume, /<td>426\.67<\/td>/);
  assert.match(render({'2026-11-20': days['2026-11-20']}, 'volume'), /Log both weight and reps in the same set/);
});

test('legacy logs from different workouts and multiple rows on one day share one exercise history', () => {
  const days = {
    '2026-11-19': {workout: {title: 'Chest and back', exercises: [
      {id: 'crunch-a', name: 'Crunch machine', sets: [{weight: 35, reps: 10}]},
      {id: 'crunch-b', name: 'crunch machine', sets: [{weight: 45, reps: 8}]},
    ]}},
    '2026-11-20': {workout: {title: 'Leg day', exercises: [
      {id: 'crunch-b', name: ' CRUNCH  MACHINE ', sets: [{weight: 50, reps: 12}]},
    ]}}
  };
  const chart = render(days);
  assert.equal((chart.match(/<option /g) || []).length, 1);
  assert.match(chart, /2026-11-19, Daily average · 2 sets, Weight 40/);
  assert.match(chart, /2026-11-19, Set 2, Weight 45 · Reps 8/);
  assert.match(chart, /2026-11-20, Daily average · 1 set, Weight 50/);
  assert.match(chart, /<span class="muted">Chest and back<\/span>/);
  assert.match(chart, /data-action="edit-session" data-date="2026-11-20"/);
});
