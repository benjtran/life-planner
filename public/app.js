(() => {
  'use strict';

  const key = 'daymark-planner-v1';
  const $ = (id) => document.getElementById(id);
  const hosted = Boolean(document.querySelector('meta[name="daymark-hosted"]'));
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
  const {withDefaults, exerciseNameKey, pinWorkout, emptyWorkout, blankSet, activitiesFor, workoutItemId, formatRunPace, splitRunPace, applyWorkoutInputs} = window.DaymarkSchedule;
  const blankDay = () => ({workout: emptyWorkout(), cardio: ''});
  const taskTone = (due) => !due ? 'none' : due === today ? 'today' : due === addDays(today, 1) ? 'tomorrow' : due < today ? 'overdue' : 'later';
  const mondayOf = (value) => addDays(value, -((parseDate(value).getDay() + 6) % 7));

  function storageRead(name) {
    try { return JSON.parse(localStorage.getItem(name)); } catch { return null; }
  }
  function storageWrite(name, value) {
    try { localStorage.setItem(name, JSON.stringify(value)); } catch { return false; }
    return true;
  }

  const saved = hosted ? null : storageRead(key);
  let state = withDefaults(saved?.state ?? {days: {}, tasks: []});
  let past = saved?.past || [];
  let future = saved?.future || [];
  let section = 'calendar';
  let date = today;
  let workoutDate = today;
  let view = 'month';
  let progressExercise = '';
  let progressMetric = '';
  let chartPoint = null;
  let chartPointPinned = false;
  let taskFilter = 'all';
  let taskScope = 'day';
  let trainingView = 'workout';
  let templateId = '';
  let runTypeId = '';
  let toastTimer;
  let sync = {available: false, code: '', url: '', host: false, busy: false};
  let revision = saved?.revision ?? -1;
  const sections = {calendar: 'Calendar', tasks: 'Tasks', training: 'Training'};
  const icons = {
    mark: '<circle cx="12" cy="12" r="2.5"/><path d="M8 5H7a2 2 0 0 0-2 2v1M19 8V7a2 2 0 0 0-2-2h-1M16 19h1a2 2 0 0 0 2-2v-1M5 16v1a2 2 0 0 0 2 2h1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 5h2m3 0h2m3 0h1"/>',
    tasks: '<path d="m3 7 2 2 3-4m-5 9 2 2 3-4m3-5h10m-10 7h10m-10 5h10"/>',
    training: '<path d="M3 10v4m3-7v10m12-10v10m3-7v4m-15-2h12"/>',
    devices: '<rect x="3" y="4" width="14" height="11" rx="2"/><rect x="15" y="10" width="6" height="10" rx="1.5"/><path d="M7 19h4m-2-4v4"/>',
    undo: '<path d="M8 5 3 10l5 5m-5-5h11a5 5 0 0 1 0 10h-2"/>',
    redo: '<path d="m16 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10h2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const icon = (name) => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${icons[name]}</svg>`;
  const themeIcon = `<svg class="icon theme-icon" aria-hidden="true" viewBox="0 0 24 24">
    <defs>
      <mask id="theme-crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none"/>
        <circle class="theme-cutout" cx="24" cy="0" r="7.1" fill="black" stroke="none"/>
      </mask>
    </defs>
    <g mask="url(#theme-crescent)">
      <circle class="theme-disc" cx="12" cy="12" r="4.75" fill="currentColor" stroke="none"/>
    </g>
    <path class="theme-rays" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19m0-14-1.4 1.4M6.4 17.6 5 19"/>
  </svg>`;
  const brand = (extra = '') => `<div class="brand ${extra}"><span class="brand-mark">${icon('mark')}</span>lifesolver</div>`;
  const manualTask = task => ({...task, kind: 'task'});
  const itemsFor = (value) => [...state.tasks.filter(task => task.due === value).map(manualTask), ...activitiesFor(state, value, today)];

  function render() {
    const focused = document.activeElement;
    const focusRegion = focused?.closest('#sidebar, #mobile-nav, #topbar, #heading, #view');
    const focusData = focused?.matches('button[data-action]') ? Object.entries(focused.dataset) : null;
    const previousWeek = $('view').querySelector('.planner-schedule.is-week');
    const previousWeekDate = previousWeek?.querySelector('.schedule-day.is-selected [data-action="select-date"]')?.dataset.date;
    const previousWeekScroll = previousWeek?.scrollLeft;
    const previousChart = $('view').querySelector('.chart-scroll');
    const openRemovedExercises = $('view').querySelector('.removed-exercises[open]')?.dataset.date;
    const chartExercise = previousChart?.dataset.chartExercise;
    const chartScroll = previousChart?.scrollLeft;
    const chartAtEnd = previousChart && previousChart.scrollWidth - previousChart.clientWidth - chartScroll < 2;
    closeChartPoint();
    const nav = Object.entries(sections).map(([name, label]) => `<button class="nav-button" type="button" data-action="navigate" data-section="${name}"${section === name ? ' aria-current="page"' : ''}>${icon(name)}<span>${label}</span></button>`).join('');
    $('sidebar').innerHTML = `${brand()}<nav aria-label="Main navigation">${nav}</nav>`;
    $('mobile-nav').innerHTML = nav;
    const dark = document.documentElement?.dataset.theme === 'dark';
    const themeToggle = `<button type="button" class="btn icon-button theme-toggle" data-action="toggle-theme" aria-label="Dark theme" title="Switch theme" aria-pressed="${dark}">${themeIcon}</button>`;
    $('topbar').innerHTML = `${brand('top-brand')}<div class="top-actions">${themeToggle}<button type="button" class="btn icon-button" data-action="devices" aria-label="Devices" title="Devices">${icon('devices')}</button><button type="button" class="btn" data-action="undo" aria-label="Undo" title="Undo (Ctrl or Cmd + Z)" ${past.length && !sync.busy ? '' : 'disabled'}>${icon('undo')}<span class="tool-text">Undo</span></button><button type="button" class="btn icon-button" data-action="redo" aria-label="Redo" title="Redo (Ctrl or Cmd + Shift + Z)" ${future.length && !sync.busy ? '' : 'disabled'}>${icon('redo')}</button></div>`;
    $('heading').innerHTML = section === 'training' ? '' : `<div class="page-heading"><h1>${sections[section]}</h1>${section === 'tasks' ? `<button type="button" class="btn primary" data-action="new-task">${icon('plus')} Add task</button>` : ''}</div>`;
    const weekStart = mondayOf(date);
    const allItems = section === 'tasks' && taskScope === 'all' ? [...state.tasks.map(manualTask), ...Array.from({length: 7}, (_, offset) => activitiesFor(state, addDays(weekStart, offset), today)).flat()] : [];
    const ctx = {state, date: section === 'training' ? workoutDate : date, today, view, esc, pretty, addDays, taskTone, taskFilter, taskScope, itemsFor, allItems, weekStart, trainingView, templateId, runTypeId, progressExercise, progressMetric};
    $('view').innerHTML = window.DaymarkViews[section](ctx);
    const removedExercises = $('view').querySelector('.removed-exercises');
    if (removedExercises && removedExercises.dataset.date === openRemovedExercises) removedExercises.open = true;
    const chart = $('view').querySelector('.chart-scroll');
    if (chart) chart.scrollLeft = chart.dataset.chartExercise === chartExercise && !chartAtEnd ? chartScroll : chart.scrollWidth;
    const week = $('view').querySelector('.planner-schedule.is-week');
    if (week) {
      const selected = week.querySelector('.schedule-day.is-selected');
      week.scrollLeft = date === previousWeekDate ? previousWeekScroll : selected?.offsetLeft || 0;
      if (focused === previousWeek) week.focus({preventScroll: true});
    }
    if (focusRegion && focusData) {
      const replacement = Array.from(focusRegion.querySelectorAll('button[data-action]')).find(button => !button.disabled && button.getClientRects().length && focusData.every(([key, value]) => button.dataset[key] === value));
      const fallback = focusRegion === $('view') && focusRegion.querySelector('[data-action="calendar-view"][aria-pressed="true"], [data-action="task-filter"][aria-pressed="true"], [data-action="training-view"][aria-pressed="true"]');
      (replacement || fallback)?.focus?.({preventScroll: true});
    }
  }

  function persist() {
    return hosted || storageWrite(key, {state, revision, past: past.slice(-25), future: future.slice(-25)});
  }

  const plannerHeaders = () => sync.code ? {'X-Daymark-Code': sync.code} : {};

  function notify(message, canUndo = false) {
    clearTimeout(toastTimer);
    $('toast').innerHTML = `<span>${esc(message)}</span>${canUndo ? '<button class="btn" type="button" data-action="undo">Undo</button>' : ''}<button class="btn icon-button" type="button" data-action="dismiss-toast" aria-label="Dismiss notification">×</button>`;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5800);
  }

  async function useState(next, nextPast, nextFuture, message, undoable = true) {
    next = withDefaults(next);
    if (hosted && revision < 0) { notify('lifesolver is still connecting. Try again in a moment.'); return false; }
    if (sync.busy) { notify('A change is still saving. Try again in a moment.'); return false; }
    if (JSON.stringify(next) === JSON.stringify(state)) { notify(message); return true; }
    if (hosted || sync.code) {
      sync.busy = true;
      try {
        const response = await fetch('api/planner', {method: 'PUT', headers: {'Content-Type': 'application/json', ...plannerHeaders()}, body: JSON.stringify({revision, state: next, past: nextPast.slice(-25), future: nextFuture.slice(-25)})});
        if (response.status === 409) {
          takeRemote(await response.json());
          notify('Another device changed the planner. Review it and try your edit again.');
          return false;
        }
        if (!response.ok) throw new Error('Save failed');
        revision = (await response.json()).revision;
      } catch {
        notify(hosted ? 'Couldn’t sync the planner. Check your connection and try again.' : 'Couldn’t save to the computer. Check the Wi‑Fi connection and try again.');
        return false;
      } finally { sync.busy = false; }
    }
    state = next;
    past = nextPast.slice(-25);
    future = nextFuture.slice(-25);
    const persisted = persist();
    render();
    notify(persisted || sync.code ? message : `${message} Browser storage is unavailable.`, undoable);
    return true;
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
    state = withDefaults(result.state);
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
    const hostedDetails = '<p>On iPhone, open this address in Safari. In the Share menu, choose Add to Home Screen and turn on Open as Web App.</p><p>Sign in to your account on each device you use.</p><div class="actions"><a class="btn" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out on this device</a></div>';
    dialog.innerHTML = `<div class="dialog-title"><h2 id="device-title">Your devices</h2><button class="btn icon-button" type="button" data-action="close-devices" aria-label="Close devices">×</button></div><div class="device-body">${hosted ? hostedDetails : sync.host ? hostDetails : sync.code ? '<p>This device is paired. Changes save to your computer.</p>' : sync.available ? '<p>Enter the pairing code shown under Devices on your computer.</p><form data-form="pair"><label>Pairing code<input name="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button class="btn primary" type="submit">Connect</button></form>' : '<p>The planner saves to this browser. Open it through the launcher to use it across devices.</p>'}${message ? `<p role="alert">${esc(message)}</p>` : ''}<div class="actions"><button type="button" class="btn" data-action="start-empty">Clear planner</button></div></div>`;
    if (!dialog.open) dialog.showModal();
  }

  function taskEditor(itemId) {
    const task = itemId ? state.tasks.find((item) => item.id === itemId) : null;
    if (itemId && !task) return;
    const dialog = $('task-editor');
    dialog.innerHTML = `<div class="dialog-title"><h2 id="task-editor-title">${task ? 'Edit task' : 'Add task'}</h2><button class="btn icon-button" type="button" data-action="close-task-editor" aria-label="Close task editor">×</button></div>
      <form class="device-body" data-form="save-task" data-id="${esc(task?.id)}">
        <label>Task<input name="title" value="${esc(task?.title)}" maxlength="200" required autofocus enterkeyhint="next"></label>
        <label>Due date<input name="due" type="date" value="${esc(task?.due ?? (taskScope === 'day' ? date : today))}"></label>
        <div class="actions"><button class="btn primary" type="submit">${task ? 'Save task' : 'Add task'}</button>${task ? `<button class="btn danger-text" type="button" data-action="delete-task" data-id="${esc(task.id)}">Delete task</button>` : ''}</div>
      </form>`;
    dialog.showModal();
  }

  function navigate(target) {
    if (!(target in sections)) return;
    const changed = target !== section;
    section = target;
    render();
    window.scrollTo(0, 0);
    if (changed) {
      const heading = $('workspace').querySelector('h1');
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
    }
  }

  function stepDate(direction) {
    if (view === 'week') return addDays(date, direction * 7);
    const current = parseDate(date);
    const next = new Date(current.getFullYear(), current.getMonth() + direction, 1, 12);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(last, current.getDate()));
    return dateKey(next);
  }

  const workoutForms = () => [...$('view').querySelectorAll('[data-form="save-set"], [data-form="save-cardio"]')];
  const formEdited = form => [...form.querySelectorAll('input')].some(input => input.value !== input.defaultValue || input.validity.badInput);
  const assignedWeekdays = data => [...new Set(data.getAll('weekday').map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))];

  function setExerciseRename(row, editing) {
    const form = row.querySelector('[data-form="rename-template-exercise"]');
    form.hidden = !editing;
    row.classList.toggle('is-renaming', editing);
    if (editing) {
      const input = form.elements.namedItem('name');
      input.focus();
      input.select();
    } else {
      form.reset();
      row.querySelector('[data-action="edit-template-exercise"]').focus();
    }
  }

  async function changeTemplateExercises(message, templateId, update) {
    const editor = $('view').querySelector('[data-form="save-template"]');
    const draft = editor?.dataset.id === templateId ? new FormData(editor) : null;
    const saved = await change(message, next => {
      const template = next.templates.find(entry => entry.id === templateId);
      if (template) update(template, next);
    });
    const current = $('view').querySelector('[data-form="save-template"]');
    if (saved && draft && current?.dataset.id === templateId) {
      current.elements.namedItem('title').value = draft.get('title');
      const weekdays = assignedWeekdays(draft);
      for (const checkbox of current.querySelectorAll('input[name="weekday"]')) {
        checkbox.checked = weekdays.includes(Number(checkbox.value));
      }
    }
    return saved;
  }

  async function addTemplateExercise(templateId, {existingId, name}) {
    const template = state.templates.find(entry => entry.id === templateId);
    if (!template) return;
    const existing = state.exerciseLibrary.find(entry => existingId ? entry.id === existingId : exerciseNameKey(entry.name) === exerciseNameKey(name));
    if (existingId && !existing) return notify('Choose an exercise to add.');
    if (existing && template.exercises.some(entry => entry.id === existing.id)) return notify('This exercise is already on this workout day.');
    const exercise = existing || {id: id(), name};
    const saved = await changeTemplateExercises(existing ? 'Existing exercise added to workout day.' : 'Exercise created and added to workout day.', templateId, (entry, next) => {
      if (!existing) next.exerciseLibrary.push(exercise);
      entry.exercises.push(exercise);
    });
    if (saved) {
      const selector = existingId ? '[data-form="link-template-exercise"] select' : '[data-form="add-template-exercise"] input';
      ($('view').querySelector(selector) || $('view').querySelector('[data-form="add-template-exercise"] input'))?.focus();
    }
  }

  const isEntryField = field => field instanceof HTMLInputElement
    && ['text', 'number', 'date', 'email', 'tel', 'url', 'search', 'password'].includes(field.type)
    && !field.matches(':disabled, [readonly]') && field.getClientRects().length > 0;

  function advanceEntry(event) {
    const field = event.target;
    if (event.key !== 'Enter' || event.isComposing || event.repeat || event.defaultPrevented
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isEntryField(field) || !field.form) return;
    const workout = field.closest('.exercise-list');
    const fields = [...(workout ? workout.querySelectorAll('input') : field.form.elements)].filter(isEntryField);
    const next = fields[fields.indexOf(field) + 1];
    if (!next && !workout) return;
    event.preventDefault();
    if (!field.reportValidity()) return;
    if (next) next.focus();
    else field.form.requestSubmit();
  }

  function changeWorkout(message, update, preserveEntriesOnUndo = false) {
    const forms = workoutForms();
    if (forms.some(form => !form.reportValidity())) return false;
    const inputs = forms.filter(formEdited).map(form => ({...form.dataset, values: Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]))}));
    const next = copy(state);
    const workout = inputs.length ? applyWorkoutInputs(next, workoutDate, inputs, today) : pinWorkout(next, workoutDate, today);
    const before = preserveEntriesOnUndo && inputs.length ? copy(next) : state;
    update(workout, next);
    return useState(next, [...past, {state: before, message}], [], message);
  }

  function saveWorkoutProgress() {
    if (!workoutForms().some(formEdited)) return notify('Workout progress is up to date.');
    return changeWorkout('Workout progress saved.', () => {});
  }

  async function leaveWorkout(onSaved) {
    if (workoutForms().some(formEdited) && !await saveWorkoutProgress()) return false;
    onSaved();
    return true;
  }

  function showWorkoutDate(nextDate, nextView = trainingView) {
    return leaveWorkout(() => {
      workoutDate = nextDate;
      trainingView = nextView;
      render();
      $('training-date')?.focus({preventScroll: true});
    });
  }

  function createWorkoutForm() {
    trainingView = 'templates';
    templateId = '';
    render();
    $('view').querySelector('[data-form="save-template"] input[name="title"]')?.focus();
  }

  function closeChartPoint() {
    if (!chartPoint) return;
    chartPoint.classList.remove('is-inspected');
    chartPoint.closest('.chart-frame').querySelector('.chart-tooltip').hidden = true;
    chartPoint = null;
    chartPointPinned = false;
  }

  function positionChartTooltip() {
    if (!chartPoint) return;
    const anchor = chartPoint.getBoundingClientRect();
    const scroller = chartPoint.closest('.chart-scroll').getBoundingClientRect();
    const center = anchor.left + anchor.width / 2;
    if (center < scroller.left || center > scroller.right || anchor.bottom < 0 || anchor.top > innerHeight) {
      closeChartPoint();
      return;
    }
    const tooltip = chartPoint.closest('.chart-frame').querySelector('.chart-tooltip');
    tooltip.style.left = `${Math.max(8, Math.min(center - tooltip.offsetWidth / 2, innerWidth - tooltip.offsetWidth - 8))}px`;
    const above = anchor.top - tooltip.offsetHeight - 6;
    tooltip.style.top = `${above >= 8 ? above : Math.min(anchor.bottom + 6, innerHeight - tooltip.offsetHeight - 8)}px`;
  }

  function showChartPoint(point, pinned = false) {
    closeChartPoint();
    chartPoint = point;
    chartPointPinned = pinned;
    point.classList.add('is-inspected');
    const tooltip = point.closest('.chart-frame').querySelector('.chart-tooltip');
    const {pointDate, pointLabel, pointValue} = point.dataset;
    const [date, label, value] = tooltip.children;
    date.textContent = pointDate;
    label.textContent = pointLabel;
    value.textContent = pointValue;
    tooltip.hidden = false;
    positionChartTooltip();
  }

  $('view').addEventListener('pointerover', (event) => {
    const point = event.target.closest('[data-chart-point]');
    if (point && point !== chartPoint && event.pointerType !== 'touch') showChartPoint(point);
  });
  $('view').addEventListener('pointerout', (event) => {
    if (chartPoint === event.target && !chartPointPinned && chartPoint !== document.activeElement) closeChartPoint();
  });
  $('view').addEventListener('focusin', (event) => {
    if (event.target.matches('[data-chart-point]') && event.target !== chartPoint) showChartPoint(event.target);
  });
  $('view').addEventListener('focusout', (event) => {
    if (chartPoint === event.target) closeChartPoint();
  });
  window.addEventListener('scroll', positionChartTooltip, {capture: true, passive: true});
  window.addEventListener('resize', positionChartTooltip);

  document.addEventListener('click', (event) => {
    const point = event.target.closest('[data-chart-point]');
    if (point) {
      if (point === chartPoint && chartPointPinned) closeChartPoint();
      else showChartPoint(point, true);
      return;
    }
    closeChartPoint();
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const {action, id: itemId, index, exercise: exerciseId} = button.dataset;
    const actionDate = validDate(button.dataset.date) ? button.dataset.date : date;
    switch (action) {
      case 'navigate': {
        const target = button.dataset.section;
        if (target === section) return;
        return leaveWorkout(() => {
          if (target === 'training' && trainingView === 'workout') workoutDate = today;
          navigate(target);
        });
      }
      case 'new-task': return taskEditor();
      case 'open-workout': workoutDate = actionDate; trainingView = 'workout'; return navigate('training');
      case 'edit-session': return showWorkoutDate(actionDate, 'workout');
      case 'exercise-progress': return leaveWorkout(() => {
        progressExercise = exerciseId;
        progressMetric = '';
        trainingView = 'progress';
        render();
        $('view').querySelector('[data-change="progress-exercise"]')?.focus();
      });
      case 'training-view': {
        const target = button.dataset.view;
        if (target === trainingView) return;
        return leaveWorkout(() => {
          trainingView = target;
          if (target === 'workout') workoutDate = today;
          render();
        });
      }
      case 'task-filter': taskFilter = button.dataset.filter; return render();
      case 'task-scope': taskScope = button.dataset.scope; return render();
      case 'task-prev': date = addDays(date, -1); return render();
      case 'task-next': date = addDays(date, 1); return render();
      case 'task-today': date = today; return render();
      case 'select-template': templateId = itemId; return render();
      case 'delete-template': return change('Workout day deleted.', (next) => { next.templates = next.templates.filter(template => template.id !== itemId); });
      case 'edit-template-exercise': {
        const open = $('view').querySelector('.template-exercise.is-renaming');
        if (open) setExerciseRename(open, false);
        return setExerciseRename(button.closest('.template-exercise'), true);
      }
      case 'cancel-exercise-rename': return setExerciseRename(button.closest('.template-exercise'), false);
      case 'delete-template-exercise': return changeTemplateExercises('Exercise removed from workout day.', itemId, template => {
        template.exercises = template.exercises.filter(entry => entry.id !== exerciseId);
      }).then(saved => {
        if (saved) $('view').querySelector('[data-form="add-template-exercise"] input')?.focus();
      });
      case 'select-run-type':
        runTypeId = itemId;
        render();
        return $('view').querySelector('[data-form="save-run-type"] input[name="title"]')?.focus();
      case 'delete-run-type': return change('Run type deleted.', (next) => { next.runTypes = next.runTypes.filter(run => run.id !== itemId); });
      case 'select-date':
        date = actionDate;
        taskScope = 'day';
        taskFilter = 'all';
        return navigate('tasks');
      case 'calendar-view': view = button.dataset.view; return render();
      case 'calendar-prev': date = stepDate(-1); return render();
      case 'calendar-next': date = stepDate(1); return render();
      case 'calendar-today': date = today; return render();
      case 'edit-task': return taskEditor(itemId);
      case 'close-task-editor': return $('task-editor').close();
      case 'toggle-task': {
        const task = state.tasks.find((item) => item.id === itemId);
        if (task) return change(task.done ? 'Task restored.' : 'Task completed.', (next) => { next.tasks.find((item) => item.id === itemId).done = !task.done; });
        return;
      }
      case 'delete-task': return change('Task deleted.', (next) => { next.tasks = next.tasks.filter((item) => item.id !== itemId); }).then((saved) => { if (saved) $('task-editor').close(); });
      case 'toggle-planned': {
        const item = activitiesFor(state, actionDate, today).find(entry => entry.id === itemId);
        if (item) return change(item.done ? 'Marked as to do.' : 'Marked complete.', (next) => {
          if (item.kind === 'workout' && !item.done) pinWorkout(next, actionDate, today);
          next.plannedCompletions[itemId] = !item.done;
        });
        return;
      }
      case 'workout-today': return showWorkoutDate(today);
      case 'add-set': {
        let nextSet;
        return Promise.resolve(changeWorkout('Set added.', (workout) => {
          const entry = workout.exercises.find(exercise => exercise.id === itemId);
          if (!entry) return;
          const sets = entry.sets ||= [];
          nextSet = sets.length;
          sets.push(blankSet());
        }, true)).then(saved => {
          if (!saved) return;
          workoutForms().find(form => form.dataset.id === itemId && Number(form.dataset.index) === nextSet)?.elements.namedItem('reps')?.focus();
        });
      }
      case 'delete-set': return changeWorkout('Set deleted.', (workout) => workout.exercises.find(entry => entry.id === itemId)?.sets.splice(Number(index), 1), true);
      case 'save-workout-progress': return saveWorkoutProgress();
      case 'progress-metric': progressMetric = button.dataset.metric; return render();
      case 'finish-workout': {
        const session = workoutDate;
        return Promise.resolve(changeWorkout('Workout completed.', (_, next) => {
          next.plannedCompletions[workoutItemId(session)] = true;
        }, true)).then(saved => {
          if (saved && workoutDate === session) $('view').querySelector('[data-action="view-workout-task"]')?.focus({preventScroll: true});
        });
      }
      case 'view-workout-task': return leaveWorkout(() => {
        date = workoutDate;
        taskScope = 'day';
        taskFilter = 'all';
        navigate('tasks');
      });
      case 'toggle-theme': return window.LifesolverAppearance.toggle();
      case 'undo': return undo();
      case 'redo': return redo();
      case 'dismiss-toast': $('toast').hidden = true; return;
      case 'devices': return devices();
      case 'close-devices': return $('devices').close();
      case 'start-empty':
        if (!window.confirm('Clear all workouts, runs, and tasks? You can undo this.')) return;
        $('devices').close();
        return change('Planner cleared.', (next) => {
          next.days = Object.fromEntries(Object.entries(next.days).filter(([, day]) => day.meals).map(([key, day]) => [key, {...blankDay(), meals: day.meals}]));
          next.tasks = [];
          next.templates = [];
          next.runs = [];
          next.runTypes = [];
          next.plannedCompletions = {};
        });
    }
  });

  document.addEventListener('change', async (event) => {
    const field = event.target;
    if (field.dataset.change === 'workout-date') {
      if (!validDate(field.value) || !await showWorkoutDate(field.value)) field.value = workoutDate;
    }
    if (field.dataset.change === 'progress-exercise') { progressExercise = field.value; render(); $('view').querySelector('[data-change="progress-exercise"]')?.focus(); }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    const {form: action, id: itemId, exercise: exerciseId} = form.dataset;
    if (!action) return;
    event.preventDefault();
    const data = new FormData(form);
    const get = (name) => String(data.get(name) ?? '').trim();
    switch (action) {
      case 'save-task': {
        const title = get('title');
        if (!title) return;
        const due = validDate(get('due')) ? get('due') : '';
        const saved = await change(itemId ? 'Task updated.' : 'Task added.', (next) => {
          if (itemId) {
            const task = next.tasks.find((item) => item.id === itemId);
            if (task) Object.assign(task, {title, due});
          } else next.tasks.push({id: id(), title, due, done: false});
        });
        if (saved) {
          $('task-editor').close();
          if (taskScope === 'day' && due) date = due;
          if (!due) taskScope = 'all';
          if (section === 'tasks' && !itemId && taskFilter === 'done') taskFilter = 'open';
          render();
          $('heading').querySelector('[data-action="new-task"]')?.focus({preventScroll: true});
        }
        return;
      }
      case 'save-template': {
        const title = get('title');
        if (!title) return;
        const weekdays = assignedWeekdays(data);
        const entryId = itemId || id();
        const committed = await change(itemId ? 'Workout saved.' : 'Workout created. Add exercises below.', (next) => {
          const entry = next.templates.find(template => template.id === entryId);
          if (entry) Object.assign(entry, {title, weekdays});
          else next.templates.push({id: entryId, title, weekdays, exercises: [], startDate: today});
        });
        if (committed && itemId) createWorkoutForm();
        else if (committed) { templateId = entryId; render(); $('view').querySelector('[data-form="add-template-exercise"] input')?.focus(); }
        return;
      }
      case 'add-template-exercise': {
        const name = get('name');
        if (!name) return notify('Enter an exercise name.');
        return addTemplateExercise(itemId, {name});
      }
      case 'link-template-exercise': {
        const existingId = get('exercise');
        if (!existingId) return notify('Choose an exercise to add.');
        return addTemplateExercise(itemId, {existingId});
      }
      case 'rename-template-exercise': {
        const name = get('name');
        if (!name) return notify('Enter an exercise name.');
        if (state.exerciseLibrary.some(entry => entry.id !== exerciseId && exerciseNameKey(entry.name) === exerciseNameKey(name))) {
          return notify('That name is already used by another exercise.');
        }
        const saved = await changeTemplateExercises('Exercise renamed across workouts and progress.', itemId, (_, next) => {
          const exercise = next.exerciseLibrary.find(entry => entry.id === exerciseId);
          if (exercise) exercise.name = name;
        });
        if (saved) {
          const edit = [...$('view').querySelectorAll('[data-action="edit-template-exercise"]')].find(button => button.dataset.id === itemId && button.dataset.exercise === exerciseId);
          if (edit) {
            const row = edit.closest('.template-exercise');
            if (row.classList.contains('is-renaming')) setExerciseRename(row, false);
            else edit.focus();
          }
        }
        return;
      }
      case 'save-run-type': {
        const title = get('title');
        const distance = Number(get('distance'));
        const pace = formatRunPace(get('paceMinutes'), get('paceSeconds'));
        const intensity = get('intensity');
        const weekdays = assignedWeekdays(data);
        if (!title || !Number.isFinite(distance) || distance <= 0 || !['high', 'low'].includes(intensity)) return;
        if (pace === null) { notify('Enter a pace greater than zero, with seconds between 0 and 59.'); return; }
        if (!weekdays.length) { notify('Select at least one day for this run.'); return; }
        const committed = await change(itemId ? 'Run type saved.' : 'Run scheduled.', (next) => {
          const type = next.runTypes.find(entry => entry.id === itemId);
          const details = {title, distance, pace, intensity, weekdays};
          if (!pace && type?.pace && !splitRunPace(type.pace)) details.pace = type.pace;
          if (type) Object.assign(type, details);
          else next.runTypes.push({id: id(), startDate: today, ...details});
        });
        if (committed) { runTypeId = ''; render(); }
        return;
      }
      case 'save-set':
      case 'save-cardio': return saveWorkoutProgress();
      case 'pair':
        try { await pair(get('code')); $('devices').close(); notify('Device connected.'); }
        catch { devices('Couldn’t connect. Check the code and try again.'); }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeChartPoint();
      const rename = event.target.closest?.('.template-exercise.is-renaming');
      if (rename) setExerciseRename(rename, false);
    }
    advanceEntry(event);
    if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const char = event.key.toLowerCase();
    if (char === 'z' || char === 'y') {
      event.preventDefault();
      if (event.shiftKey || char === 'y') redo(); else undo();
    }
  });

  async function initConnection() {
    if (!location.protocol.startsWith('http')) return;
    if (hosted) return refreshFromHost();
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
    const editing = () => document.activeElement?.closest('form') || workoutForms().some(formEdited);
    if ((!hosted && !sync.code) || sync.busy || document.hidden || (revision >= 0 && editing())) return;
    try {
      const seenRevision = revision;
      const response = await fetch('api/planner', {headers: plannerHeaders(), cache: 'no-store'});
      if (!response.ok) return;
      const remote = await response.json();
      if (!sync.busy && revision === seenRevision && (revision < 0 || !editing())) takeRemote(remote);
    } catch { /* Check again on the next interval. */ }
  }

  render();
  persist();
  initConnection();
  setInterval(refreshFromHost, 3000);
})();
