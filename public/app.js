(() => {
  'use strict';

  const key = 'daymark-planner-v1';
  const $ = (id) => document.getElementById(id);
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDate = (value) => new Date(`${value}T12:00:00`);
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDate(value)) === value;
  const addDays = (value, days) => {
    const date = parseDate(value);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  };
  const pretty = (value) => validDate(value) ? new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric', year: 'numeric'}).format(parseDate(value)) : '';
  const today = dateKey(new Date());
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const blankDay = () => ({workout: {title: '', exercises: []}, meals: {}, cardio: ''});
  const taskTone = (due) => !due ? 'none' : due === today ? 'today' : due === addDays(today, 1) ? 'tomorrow' : due < today ? 'overdue' : 'later';
  const blankSet = () => ({reps: null, weight: null});

  function samplePlanner() {
    const data = {days: {}, tasks: []};
    const strength = (name, sets = []) => ({id: id(), name, kind: 'strength', sets: sets.map(([reps, weight]) => ({reps, weight}))});
    const plans = [
      ['Chest & back', ['Dumbbell bench press', 'Lat pulldown'], 'Incline walk · 15 min'],
      ['Arms', ['Dumbbell curl', 'Cable triceps extension'], ''],
      ['Legs', ['Goblet squat', 'Romanian deadlift'], ''],
      ['Upper body', ['Dumbbell bench press', 'Seated row'], ''],
      ['Lower body', ['Goblet squat', 'Leg press'], 'Easy bike · 15 min'],
      ['', [], 'Outdoor walk · 30 min'],
      ['', [], '']
    ];
    const menus = [
      {breakfast: 'Greek yogurt, berries & oats', lunch: 'Chicken or tofu grain bowl', dinner: 'Salmon, rice & greens', snack: 'Apple & peanut butter'},
      {breakfast: 'Eggs & toast', lunch: 'Hummus and vegetable wrap', dinner: 'Pasta with lentil sauce'},
      {breakfast: 'Overnight oats', lunch: 'Leftover grain bowl', dinner: 'Chickpea and vegetable curry'}
    ];
    for (let n = -3; n <= 11; n += 1) {
      const [title, exercises, cardio] = plans[(n + 7) % 7];
      data.days[addDays(today, n)] = {workout: {title, exercises: exercises.map((name) => strength(name, [[null, null]]) )}, meals: {...menus[(n + 3) % menus.length]}, cardio};
    }
    [[-21, 8, 35], [-14, 10, 35], [-7, 8, 40], [-2, 9, 40]].forEach(([offset, reps, weight]) => {
      const day = data.days[addDays(today, offset)] ||= blankDay();
      day.workout.title ||= 'Upper body';
      day.workout.exercises.push(strength('Dumbbell bench press', [[reps, weight], [reps - 1, weight]]));
    });
    data.tasks = [
      ['Wash gym clothes', -1, false], ['Prep lunch for tomorrow', 0, false], ['Log today’s workout', 0, false],
      ['Pick up groceries', 1, false], ['Plan next week’s workouts', 4, false], ['Make a grocery list', 0, true]
    ].map(([title, offset, done]) => ({id: id(), title, due: addDays(today, offset), done}));
    return data;
  }

  function storageRead(name) {
    try { return JSON.parse(localStorage.getItem(name)); } catch { return null; }
  }
  function storageWrite(name, value) {
    try { localStorage.setItem(name, JSON.stringify(value)); } catch { return false; }
    return true;
  }

  const saved = storageRead(key);
  let state = saved?.state || samplePlanner();
  let past = saved?.past || [];
  let future = saved?.future || [];
  let section = 'calendar';
  let date = today;
  let view = 'month';
  let progressExercise = '';
  let taskFilter = 'all';
  let taskDraftDue = '';
  let editTask = '';
  let toastTimer;
  let sync = {available: false, code: '', revision: -1, url: '', host: false, busy: false};
  let revision = saved?.revision ?? -1;
  const sections = {calendar: 'Calendar', tasks: 'Tasks', training: 'Training', meals: 'Meals', progress: 'Progress'};
  const icons = {
    mark: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 5h2m3 0h2m3 0h1"/>',
    tasks: '<path d="m3 7 2 2 3-4m-5 9 2 2 3-4m3-5h10m-10 7h10m-10 5h10"/>',
    training: '<path d="M3 10v4m3-7v10m12-10v10m3-7v4m-15-2h12"/>',
    meals: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 3c-3 2-4 6-4 11h4m0-11v18"/>',
    progress: '<path d="M3 4v16h18M7 16l4-5 4 2 5-7"/>',
    devices: '<rect x="3" y="4" width="14" height="11" rx="2"/><rect x="15" y="10" width="6" height="10" rx="1.5"/><path d="M7 19h4m-2-4v4"/>',
    undo: '<path d="M8 5 3 10l5 5m-5-5h11a5 5 0 0 1 0 10h-2"/>',
    redo: '<path d="m16 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10h2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const icon = (name) => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${icons[name]}</svg>`;
  const brand = (extra = '') => `<div class="brand ${extra}"><span class="brand-mark">${icon('mark')}</span>Daymark</div>`;

  function render() {
    const nav = Object.entries(sections).map(([name, label]) => `<button class="nav-button" type="button" data-action="navigate" data-section="${name}"${section === name ? ' aria-current="page"' : ''}>${icon(name)}<span>${label}</span></button>`).join('');
    $('sidebar').innerHTML = `${brand()}<nav aria-label="Main navigation">${nav}</nav><div class="sidebar-bottom"><button class="nav-button" type="button" data-action="devices">${icon('devices')} Devices</button><small>${sync.code ? 'Shared on Wi‑Fi' : 'Saved on this device'}</small></div>`;
    $('mobile-nav').innerHTML = nav;
    $('topbar').innerHTML = `<div class="breadcrumb">Personal planner / <strong>${sections[section]}</strong></div>${brand('top-brand')}<div class="top-actions"><button type="button" class="btn mobile-devices" data-action="devices" aria-label="Connect devices">${icon('devices')}</button><button type="button" class="btn" data-action="undo" aria-label="Undo" title="Undo (Ctrl or Cmd + Z)" ${past.length && !sync.busy ? '' : 'disabled'}>${icon('undo')}<span class="tool-text">Undo</span></button><button type="button" class="btn icon-button" data-action="redo" aria-label="Redo" title="Redo (Ctrl or Cmd + Shift + Z)" ${future.length && !sync.busy ? '' : 'disabled'}>${icon('redo')}</button></div>`;
    $('heading').innerHTML = section === 'calendar' ? `<div class="page-heading"><div><div class="eyebrow">Personal planner</div><h1>Calendar</h1><p>Workouts, meals, and tasks in one place.</p></div><button type="button" class="btn primary" data-action="new-task">${icon('plus')} Task</button></div>` : '';
    const ctx = {state, date, today, view, esc, pretty, addDays, taskTone, progressExercise, taskFilter, taskDraftDue, editTask};
    $('view').innerHTML = window.DaymarkViews[section](ctx);
    if (section === 'tasks' && taskDraftDue) $('view').querySelector('[data-form="add-task"] [name="due"]').value = taskDraftDue;
  }

  function persist() {
    return storageWrite(key, {state, revision, past: past.slice(-25), future: future.slice(-25)});
  }

  function notify(message, canUndo = false) {
    clearTimeout(toastTimer);
    $('toast').innerHTML = `<span>${esc(message)}</span>${canUndo ? '<button class="btn" type="button" data-action="undo">Undo</button>' : ''}<button class="btn icon-button" type="button" data-action="dismiss-toast" aria-label="Dismiss notification">×</button>`;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5800);
  }

  async function useState(next, nextPast, nextFuture, message, undoable = true) {
    if (sync.busy) return notify('A change is still saving. Try again in a moment.');
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    if (sync.code) {
      sync.busy = true;
      try {
        const response = await fetch('api/planner', {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-Daymark-Code': sync.code}, body: JSON.stringify({revision, state: next, past: nextPast.slice(-25), future: nextFuture.slice(-25)})});
        if (response.status === 409) {
          takeRemote(await response.json());
          return notify('Another device changed the planner. Review it and try your edit again.');
        }
        if (!response.ok) throw new Error('Save failed');
        revision = (await response.json()).revision;
      } catch {
        return notify('Couldn’t save to the computer. Check the Wi‑Fi connection and try again.');
      } finally { sync.busy = false; }
    }
    state = next;
    past = nextPast.slice(-25);
    future = nextFuture.slice(-25);
    const persisted = persist();
    render();
    notify(persisted || sync.code ? message : `${message} Browser storage is unavailable.`, undoable);
  }

  function change(message, apply) {
    const next = copy(state);
    apply(next);
    return useState(next, [...past, {state, message}], [], message);
  }

  function undo() {
    const entry = past.at(-1);
    if (entry) return useState(entry.state, past.slice(0, -1), [...future, {state, message: entry.message}], 'Change undone.', false);
  }

  function redo() {
    const entry = future.at(-1);
    if (entry) return useState(entry.state, [...past, {state, message: entry.message}], future.slice(0, -1), 'Change redone.');
  }

  function takeRemote(result) {
    if (!result.state || revision === result.revision) return;
    state = result.state;
    revision = result.revision;
    past = Array.isArray(result.past) ? result.past.slice(-25) : [];
    future = Array.isArray(result.future) ? result.future.slice(-25) : [];
    persist();
    render();
  }

  async function pair(code) {
    const response = await fetch('api/planner', {headers: {'X-Daymark-Code': code}, cache: 'no-store'});
    if (!response.ok) throw new Error('Pairing failed');
    let remote = await response.json();
    if (!remote.state && sync.host) {
      const initial = await fetch('api/planner', {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-Daymark-Code': code}, body: JSON.stringify({revision: remote.revision, state, past, future})});
      if (!initial.ok && initial.status !== 409) throw new Error('Setup failed');
      remote = await initial.json();
    }
    sync.code = code;
    try { sessionStorage.setItem('daymark-code', code); } catch { /* Pairing lasts until refresh. */ }
    if (revision === remote.revision && remote.state && JSON.stringify(state) !== JSON.stringify(remote.state)) revision = -1;
    if (remote.state) takeRemote(remote);
    else { revision = remote.revision; persist(); }
    render();
  }

  function devices(message = '') {
    const dialog = $('devices');
    const hostDetails = sync.url ? `<p>On your iPhone, open Safari and visit <a href="${esc(sync.url)}">${esc(sync.url)}</a> on the same Wi‑Fi.</p><p>Pairing code <code>${esc(sync.code)}</code></p><p class="sync-label">Use a trusted network and keep this computer and the launcher running.</p>` : `<p>Run the launcher with <code>--lan</code> to connect your iPhone over the same Wi‑Fi.</p>`;
    dialog.innerHTML = `<div class="dialog-title"><h2 id="device-title">Your devices</h2><button class="btn icon-button" type="button" data-action="close-devices" aria-label="Close devices">×</button></div><div class="device-body">${sync.host ? hostDetails : sync.code ? '<p>This device is paired. Changes save to your computer.</p>' : sync.available ? '<p>Enter the pairing code shown under Devices on your computer.</p><form data-form="pair"><label>Pairing code<input name="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button class="btn primary" type="submit">Connect</button></form>' : '<p>The planner saves to this browser. Open it through the launcher to use it across devices.</p>'}${message ? `<p role="alert">${esc(message)}</p>` : ''}${sync.available && !sync.host && !sync.code ? '' : '<p class="sync-label">The prototype opens with example workouts, meals, and tasks.</p>'}<div class="actions"><button type="button" class="btn" data-action="start-empty">Clear planner</button></div></div>`;
    if (!dialog.open) dialog.showModal();
  }

  function navigate(target) {
    if (!(target in sections)) return;
    section = target;
    render();
    window.scrollTo(0, 0);
  }

  function stepDate(direction) {
    const mode = section === 'calendar' ? view : 'day';
    if (mode === 'day' || mode === 'week') return addDays(date, direction * (mode === 'week' ? 7 : 1));
    const current = parseDate(date);
    const next = new Date(current.getFullYear(), current.getMonth() + direction * (mode === 'year' ? 12 : 1), 1, 12);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(last, current.getDate()));
    return dateKey(next);
  }

  const dayFor = (data) => data.days[date] ||= blankDay();
  const exerciseFor = (data, exerciseId) => dayFor(data).workout.exercises.find((exercise) => exercise.id === exerciseId);
  const numberOrBlank = (value) => value === '' ? null : Number(value);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const {action, id: itemId, index, exercise, filter} = button.dataset;
    switch (action) {
      case 'navigate': taskDraftDue = ''; return navigate(button.dataset.section);
      case 'open-tasks': taskDraftDue = ''; return navigate('tasks');
      case 'new-task':
        taskDraftDue = date;
        navigate('tasks');
        return $('view').querySelector('[data-form="add-task"] input').focus();
      case 'open-workout': return navigate('training');
      case 'open-meals': return navigate('meals');
      case 'select-date':
        if (!validDate(button.dataset.date)) return;
        date = button.dataset.date;
        if (view === 'year') view = 'day';
        return render();
      case 'calendar-view': view = button.dataset.view; return render();
      case 'calendar-prev': date = stepDate(-1); return render();
      case 'calendar-next': date = stepDate(1); return render();
      case 'calendar-today': date = today; return render();
      case 'task-filter': taskFilter = filter; editTask = ''; return render();
      case 'edit-task': editTask = itemId; render(); return $('view').querySelector('[data-form="edit-task"] input')?.focus();
      case 'cancel-task-edit': editTask = ''; return render();
      case 'toggle-task': {
        const task = state.tasks.find((item) => item.id === itemId);
        if (task) return change(task.done ? 'Task restored.' : 'Task completed.', (next) => { next.tasks.find((item) => item.id === itemId).done = !task.done; });
        return;
      }
      case 'delete-task': return change('Task deleted.', (next) => { next.tasks = next.tasks.filter((item) => item.id !== itemId); });
      case 'add-set': return change('Set added.', (next) => exerciseFor(next, itemId)?.sets.push(blankSet()));
      case 'delete-set': return change('Set deleted.', (next) => exerciseFor(next, itemId)?.sets.splice(Number(index), 1));
      case 'delete-exercise': return change('Exercise deleted.', (next) => {
        const workout = dayFor(next).workout;
        workout.exercises = workout.exercises.filter((item) => item.id !== itemId);
      });
      case 'progress-exercise': progressExercise = exercise; return navigate('progress');
      case 'clear-meals': return change('Meal plan cleared.', (next) => { dayFor(next).meals = {}; });
      case 'undo': return undo();
      case 'redo': return redo();
      case 'dismiss-toast': $('toast').hidden = true; return;
      case 'devices': return devices();
      case 'close-devices': return $('devices').close();
      case 'start-empty':
        if (!window.confirm('Clear all workouts, meals, and tasks? You can undo this.')) return;
        $('devices').close();
        return change('Planner cleared.', (next) => { next.days = {}; next.tasks = []; });
    }
  });

  document.addEventListener('change', (event) => {
    const field = event.target;
    if (field.dataset.change === 'date' && validDate(field.value)) { date = field.value; render(); }
    if (field.dataset.change === 'progress-exercise') { progressExercise = field.value; render(); $('view').querySelector('[data-change="progress-exercise"]')?.focus(); }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    const {form: action, id: itemId, index} = form.dataset;
    if (!action) return;
    event.preventDefault();
    const data = new FormData(form);
    const get = (name) => String(data.get(name) ?? '').trim();
    switch (action) {
      case 'add-task': {
        if (!get('title')) return;
        const due = get('due');
        taskDraftDue = '';
        if (taskFilter === 'done') taskFilter = 'open';
        return change('Task added.', (next) => next.tasks.push({id: id(), title: get('title'), due: validDate(due) ? due : '', done: false}));
      }
      case 'edit-task': {
        const due = get('due');
        if (get('title')) {
          editTask = '';
          await change('Task updated.', (next) => {
            const task = next.tasks.find((item) => item.id === itemId);
            if (task) Object.assign(task, {title: get('title'), due: validDate(due) ? due : ''});
          });
          if (form.isConnected) render();
        }
        return;
      }
      case 'save-meals': return change('Meal plan saved.', (next) => { dayFor(next).meals = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snack'].map((name) => [name, get(name)])); });
      case 'workout-title': return change('Workout plan saved.', (next) => {
        const day = dayFor(next);
        day.workout.title = get('title');
        day.cardio = get('cardio');
      });
      case 'add-exercise': {
        if (!get('name')) return;
        const kind = get('kind') === 'cardio' ? 'cardio' : 'strength';
        return change('Exercise added.', (next) => dayFor(next).workout.exercises.push({id: id(), name: get('name'), kind, sets: kind === 'strength' ? [blankSet()] : [], minutes: null}));
      }
      case 'save-set': return change('Set saved.', (next) => {
        const entry = exerciseFor(next, itemId)?.sets[Number(index)];
        if (entry) Object.assign(entry, {reps: numberOrBlank(get('reps')), weight: numberOrBlank(get('weight'))});
      });
      case 'save-cardio': return change('Cardio saved.', (next) => {
        const entry = exerciseFor(next, itemId);
        if (entry) entry.minutes = numberOrBlank(get('minutes'));
      });
      case 'pair':
        try { await pair(get('code')); $('devices').close(); notify('Device connected.'); }
        catch { devices('Couldn’t connect. Check the code and try again.'); }
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const char = event.key.toLowerCase();
    if (char === 'z' || char === 'y') {
      event.preventDefault();
      if (event.shiftKey || char === 'y') redo(); else undo();
    }
  });

  async function initConnection() {
    if (!location.protocol.startsWith('http')) return;
    try {
      const response = await fetch('api/config', {cache: 'no-store'});
      if (!response.ok) return;
      const config = await response.json();
      sync = {...sync, available: true, host: config.host, url: config.url};
      const previousCode = config.code || sessionStorage.getItem('daymark-code');
      if (previousCode) {
        try { await pair(previousCode); } catch { if (!sync.host) devices('Enter the computer’s current pairing code.'); }
      } else if (!sync.host) devices();
    } catch { /* The standalone browser version works without the launcher. */ }
    render();
  }

  async function refreshFromHost() {
    if (!sync.code || sync.busy || document.hidden || document.activeElement?.closest('form')) return;
    try {
      const seenRevision = revision;
      const response = await fetch('api/planner', {headers: {'X-Daymark-Code': sync.code}, cache: 'no-store'});
      if (!response.ok) return;
      const remote = await response.json();
      if (!sync.busy && revision === seenRevision && !document.activeElement?.closest('form')) takeRemote(remote);
    } catch { /* Check again on the next interval. */ }
  }

  render();
  persist();
  initConnection();
  setInterval(refreshFromHost, 3000);
})();
