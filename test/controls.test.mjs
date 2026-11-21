import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createContext, runInContext} from 'node:vm';

const script = name => readFileSync(new URL(`../public/${name}.js`, import.meta.url), 'utf8');

class Input {
  constructor(type = 'text') { this.type = type; }
  matches() { return this.disabled || this.readOnly; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  reportValidity() { return !this.invalid; }
  closest(selector) { return selector === '.exercise-list' ? this.workout : null; }
  focus() { this.focused = true; }
}

function app(state) {
  const events = new Map();
  const elements = new Map();
  let saved = {state};
  const context = createContext({
    document: {
      querySelector: () => null,
      addEventListener: (type, listener) => events.set(type, listener),
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: () => {}
        });
        return elements.get(id);
      }
    },
    window: {DaymarkViews: {calendar: () => ''}, addEventListener: () => {}},
    HTMLInputElement: Input,
    FormData: class { constructor(form) { return new Map(Object.entries(form.values)); } },
    localStorage: {getItem: () => JSON.stringify(saved), setItem: (_, data) => { saved = JSON.parse(data); }},
    location: {protocol: 'file:'},
    setInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {}
  });
  runInContext(script('schedule'), context);
  runInContext(script('app'), context);
  return {events, snapshot: () => saved};
}

const exercise = {id: 'lat', name: 'Lat pulldown'};
const historyDate = '2026-11-20';
const planner = () => ({
  tasks: [],
  templates: [{id: 'back', title: 'Back day', weekdays: [5], exercises: [exercise, {id: 'row', name: 'Row'}]}],
  days: {[historyDate]: {workout: {title: 'Back day', exercises: [{...exercise, sets: [{reps: 9, weight: 55}]}]}}}
});

test('Remove targets the requested exercise and Undo restores it', async () => {
  const {events, snapshot} = app(planner());
  const click = dataset => events.get('click')({target: {
    closest: selector => selector === 'button[data-action]' ? {dataset} : null
  }});
  await click({action: 'delete-template-exercise', id: 'back', exercise: 'lat'});
  assert.deepEqual(snapshot().state.templates[0].exercises.map(item => item.id), ['row']);
  assert.equal(snapshot().state.days[historyDate].workout.exercises[0].name, 'Lat pulldown');
  await click({action: 'undo'});
  assert.deepEqual(snapshot().state.templates[0].exercises.map(item => item.id), ['lat', 'row']);
});

test('Renaming keeps the exercise ID and its previously logged sets', async () => {
  const {events, snapshot} = app(planner());
  await events.get('submit')({
    target: {dataset: {form: 'rename-template-exercise', id: 'back', exercise: 'lat'}, values: {name: ' Wide-grip pulldown '}},
    preventDefault() {}
  });
  assert.deepEqual(snapshot().state.templates[0].exercises[0], {id: 'lat', name: 'Wide-grip pulldown'});
  assert.deepEqual(snapshot().state.days[historyDate].workout.exercises[0], {
    id: 'lat', exerciseId: 'lat', name: 'Wide-grip pulldown', sets: [{reps: 9, weight: 55}]
  });
});

test('adding a shared exercise, renaming it, and undoing work across workout days', async () => {
  const state = planner();
  state.templates.push({id: 'legs', title: 'Leg day', weekdays: [2], exercises: []});
  const {events, snapshot} = app(state);
  const submit = (form, data, exercise) => events.get('submit')({
    target: {dataset: {form, id: 'legs', exercise}, values: data}, preventDefault() {}
  });
  await submit('link-template-exercise', {exercise: 'lat'});
  await submit('add-template-exercise', {name: ' LAT   PULLDOWN '});
  await submit('rename-template-exercise', {name: 'Row'}, 'lat');
  assert.deepEqual(snapshot().state.templates[1].exercises, [exercise]);
  await submit('rename-template-exercise', {name: 'Cable pulldown'}, 'lat');
  assert.deepEqual(snapshot().state.templates.map(template => template.exercises[0].name), ['Cable pulldown', 'Cable pulldown']);
  assert.deepEqual(snapshot().state.days[historyDate].workout.exercises[0].sets, [{reps: 9, weight: 55}]);
  await events.get('click')({target: {closest: selector => selector === 'button[data-action]' ? {dataset: {action: 'undo'}} : null}});
  assert.deepEqual(snapshot().state.templates.map(template => template.exercises[0].name), ['Lat pulldown', 'Lat pulldown']);
});

test('Enter advances between valid entry fields, including across workout sets', () => {
  const {events} = app(planner());
  const enter = (target, options) => {
    const event = {key: 'Enter', target, ...options, preventDefault() { this.defaultPrevented = true; }};
    events.get('keydown')(event);
    return event.defaultPrevented;
  };
  const name = new Input();
  const disabled = Object.assign(new Input('number'), {disabled: true});
  const distance = new Input('number');
  const minutes = new Input('number');
  const seconds = new Input('number');
  const form = {elements: [name, disabled, distance, minutes, seconds]};
  for (const field of form.elements) field.form = form;
  name.invalid = true;
  assert.equal(enter(name), true);
  assert.equal(distance.focused, undefined);
  name.invalid = false;
  assert.equal(enter(name, {isComposing: true}), undefined);
  assert.equal(enter(name), true);
  assert.equal(distance.focused, true);
  assert.equal(enter(minutes), true);
  assert.equal(seconds.focused, true);
  assert.equal(enter(seconds), undefined, 'the last regular field keeps native submission');

  const workoutFields = Array.from({length: 4}, () => new Input('number'));
  let submitted = 0;
  for (const field of workoutFields) Object.assign(field, {
    workout: {querySelectorAll: () => workoutFields}, form: {requestSubmit: () => { submitted++; }}
  });
  for (let index = 0; index < workoutFields.length - 1; index++) {
    assert.equal(enter(workoutFields[index]), true);
    assert.equal(workoutFields[index + 1].focused, true);
  }
  assert.equal(enter(workoutFields.at(-1)), true);
  assert.equal(submitted, 1);
});
