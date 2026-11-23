import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const window = {};
for (const script of ['schedule', 'calendar', 'tasks', 'training']) {
  runInNewContext(readFileSync(new URL(`../public/${script}.js`, import.meta.url), 'utf8'), {window});
}
const {calendar, tasks, training} = window.DaymarkViews;
const {withDefaults} = window.DaymarkSchedule;
const addDays = (date, offset) => new Date(new Date(`${date}T12:00:00Z`).valueOf() + offset * 86400000).toISOString().slice(0, 10);
const ctx = {today: '2026-11-20', date: '2026-11-20', weekStart: '2026-11-16', pretty: String, esc: value => String(value ?? ''), addDays};
const item = (kind, id, due) => ({kind, id, due, title: id, done: false});

test('month previews and named categories order tasks, lifts and runs even when they overflow', () => {
  const date = ctx.date;
  const items = [item('run', 'Easy run', date), item('task', 'Read paper', date), item('workout', 'Back day', date), item('task', 'Water plants', date)];
  const html = calendar({...ctx, view: 'month', itemsFor: day => day === date ? items : []});
  const cell = html.match(/data-date="2026-11-20"[\s\S]*?<\/button>/)[0];
  assert.match(cell, /Task: Read paper; Task: Water plants; Lift: Back day; Run: Easy run/);
  for (const [kind, name] of [['task', 'Task'], ['workout', 'Lift'], ['run', 'Run']]) {
    assert.match(cell, new RegExp(`class="event-kind event-type-${kind}"><svg[^>]+aria-hidden="true">.*?<\\/svg><span>${name}<\\/span>`));
  }
  assert.match(cell, /<span class="event-title">Read paper<\/span>[\s\S]*<span class="event-title">Back day<\/span>[\s\S]*<span class="event-title">Easy run<\/span>[\s\S]*\+1 more/);
  const withoutRun = calendar({...ctx, view: 'month', itemsFor: day => day === date ? [...items.slice(1), item('task', 'Pay bill', date)] : []});
  assert.match(withoutRun, /<span class="event-title">Read paper<\/span>[\s\S]*<span class="event-title">Water plants<\/span>[\s\S]*<span class="event-title">Back day<\/span>/);
  const week = calendar({...ctx, view: 'week', itemsFor: day => day === date ? items : []});
  assert.match(week, /calendar-event event-type-task[\s\S]*calendar-event event-type-workout[\s\S]*calendar-event event-type-run/);
});

test('All tasks groups rows by date and retains the deadline status and activity sections', () => {
  const items = [item('run', 'Easy run', '2026-11-23'), item('task', 'Pay bill', '2026-11-23'), item('task', 'Call bank', '2026-11-23'), item('task', 'Email Alex', '2026-11-24'), item('task', 'Today task', ctx.today), item('task', 'Unscheduled', '')];
  const html = tasks({...ctx, allItems: items, taskScope: 'all', taskFilter: 'all', taskTone: due => due === ctx.today ? 'today' : 'later'});
  assert.equal((html.match(/<section class="task-day panel"/g) || []).length, 4);
  assert.match(html, /<header class="task-date task-day-date deadline-today">[\s\S]*?Today<\/small>[\s\S]*?<\/header>\s*<div class="task-day-items">/);
  assert.match(html, /<header class="task-date task-day-date">\s*<h2 id="task-day-2026-11-23"/);
  const futureGroup = html.match(/<h2 id="task-day-2026-11-23"[\s\S]*?<\/section>/)[0];
  assert.match(futureGroup, /<h3>Tasks<\/h3>[\s\S]*Pay bill[\s\S]*Call bank[\s\S]*<h3>Runs<\/h3>[\s\S]*Easy run/);
  assert.doesNotMatch(futureGroup, /Email Alex/);
  assert.equal((futureGroup.match(/datetime="2026-11-23"/g) || []).length, 1);
  assert.match(html, /task-day-2026-11-24[\s\S]*task-day-undated[\s\S]*No due date/);
});

test('workout inputs render prior numbers as placeholders with blank submitted values', () => {
  const state = withDefaults({tasks: [], templates: [{id: 'back', title: 'Back day', startDate: '2026-11-19', weekdays: [5], exercises: [{id: 'row', name: 'Row'}]}],
    days: {'2026-11-19': {workout: {title: 'Leg day', exercises: [{id: 'old-id', name: 'Row', sets: [{reps: 10, weight: 40}, {reps: 8, weight: 45}]}]}}}});
  const html = training({...ctx, state, trainingView: 'workout', itemsFor: () => []});
  assert.match(html, /Last logged 2026-11-19 · 2 sets/);
  assert.match(html, /name="reps"[^>]* set 1 reps" value="" placeholder="10"/);
  assert.match(html, /name="weight"[^>]* set 2 weight" value="" placeholder="45"/);
});
