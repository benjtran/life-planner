(() => {
  'use strict';

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateObj = value => new Date(`${value}T12:00:00`);
  const format = (value, options) => dateObj(value).toLocaleDateString('en', options);
  const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const shortDate = date => format(date, {month: 'short', day: 'numeric'});
  const fullDate = date => format(date, {weekday: 'long', month: 'long', day: 'numeric'});
  const taskLabels = {today: 'Due today', tomorrow: 'Due tomorrow', overdue: 'Overdue'};

  function indexTasks(tasks) {
    const byDate = new Map();
    for (const task of tasks) {
      if (!byDate.has(task.due)) byDate.set(task.due, []);
      byDate.get(task.due).push(task);
    }
    return byDate;
  }

  function movement(ctx, date) {
    const day = ctx.state.days[date];
    const exercises = (day?.workout?.exercises || []).map(exercise => ({...exercise, action: 'toggle-exercise'}));
    if (day?.cardio) exercises.push({name: day.cardio, kind: 'cardio', done: day.cardioDone, action: 'toggle-cardio'});
    return {title: day?.workout?.title, exercises};
  }

  function taskRow(ctx, task) {
    const {esc, taskTone} = ctx;
    const tone = task.done ? 'done' : taskTone(task.due);
    const status = taskLabels[tone];
    const dueDate = task.due ? shortDate(task.due) : 'No due date';
    const detail = tone === 'today' || tone === 'tomorrow' ? status : [status, dueDate].filter(Boolean).join(' · ');
    return `<li class="planner-row planner-task tone-${tone}">
      ${checkButton(esc, task.title, task.done, 'toggle-task', task.id)}
      <div class="planner-row-text"><span>${esc(task.title)}</span><small>${esc(detail)}</small></div>
      <button class="planner-edit" type="button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="Edit ${esc(task.title)}">···</button>
    </li>`;
  }

  function checkButton(esc, title, done, action, id = '', date = '') {
    return `<button class="planner-check" type="button" data-action="${action}" data-id="${esc(id)}" data-date="${esc(date)}" aria-label="${done ? 'Restore' : 'Complete'} ${esc(title)}"><span aria-hidden="true">${done ? '✓' : ''}</span></button>`;
  }

  function exerciseRow(ctx, exercise, date) {
    const {esc} = ctx;
    const type = exercise.kind === 'cardio' ? 'Cardio' : 'Exercise';
    return `<li class="planner-row planner-exercise ${exercise.done ? 'tone-done' : ''}">
      ${checkButton(esc, exercise.name, exercise.done, exercise.action, exercise.id, date)}
      <div class="planner-row-text"><span>${esc(exercise.name)}</span><small>${type}</small></div>
    </li>`;
  }

  function dayEntries(ctx, date) {
    const tasks = ctx.tasksByDate.get(date) || [];
    const {title, exercises} = movement(ctx, date);
    const open = tasks.filter(task => !task.done);
    const done = tasks.filter(task => task.done);
    const list = (html) => `<ul class="planner-entries">${html}</ul>`;
    return `${open.length ? list(open.map(task => taskRow(ctx, task)).join('')) : ''}
      ${title || exercises.length ? `<div class="planner-movement"><strong>${ctx.esc(title || 'Workout')}</strong></div>` : ''}
      ${exercises.length ? list(exercises.map(exercise => exerciseRow(ctx, exercise, date)).join('')) : ''}
      ${done.length ? list(done.map(task => taskRow(ctx, task)).join('')) : ''}
      ${!tasks.length && !title && !exercises.length ? '<p class="planner-empty">No items scheduled.</p>' : ''}`;
  }

  function monthCell(ctx, date, outside) {
    const {esc, today} = ctx;
    const tasks = ctx.tasksByDate.get(date) || [];
    const {title, exercises} = movement(ctx, date);
    const selected = date === ctx.date;
    const descriptions = [fullDate(date), tasks.length && `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, (title || exercises.length) && 'workout'].filter(Boolean);
    return `<button type="button" class="month-cell${outside ? ' is-outside' : ''}${selected ? ' is-selected' : ''}" data-action="select-date" data-date="${date}" aria-label="${esc(descriptions.join(', '))}" aria-pressed="${selected}" ${date === today ? 'aria-current="date"' : ''}>
      <span class="month-number">${dateObj(date).getDate()}</span><span class="month-markers" aria-hidden="true">${tasks.length ? '<i class="marker task-marker"></i>' : ''}${title || exercises.length ? '<i class="marker workout-marker"></i>' : ''}</span>
    </button>`;
  }

  function monthGrid(ctx, anchor, mini = false) {
    const day = dateObj(anchor);
    const first = new Date(day.getFullYear(), day.getMonth(), 1, 12);
    const length = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    const start = ctx.addDays(dateKey(first), -first.getDay());
    const cells = Array.from({length: mini ? 42 : 7 * Math.ceil((length + first.getDay()) / 7)}, (_, i) => {
      const date = ctx.addDays(start, i);
      const outside = dateObj(date).getMonth() !== day.getMonth();
      return mini && outside ? '<span></span>' : monthCell(ctx, date, outside);
    }).join('');
    return `<div class="planner-month${mini ? ' is-mini' : ''}"><div class="month-weekdays">${weekdays.map(day => `<span>${mini ? day[0] : day}</span>`).join('')}</div><div class="month-grid">${cells}</div></div>`;
  }

  function schedule(ctx, dates) {
    const singleDay = dates.length === 1;
    return `<div class="planner-schedule ${singleDay ? 'is-day' : 'is-week'}" role="region" aria-label="${singleDay ? 'Daily schedule' : 'Weekly schedule'}"${singleDay ? '' : ' tabindex="0"'}>${dates.map(date => {
      const selected = date === ctx.date;
      return `<article class="schedule-day${selected ? ' is-selected' : ''}">
        <header class="schedule-date"><h3>${singleDay ? ctx.esc(fullDate(date)) : `<button data-action="select-date" data-date="${date}" type="button" aria-pressed="${selected}" ${date === ctx.today ? 'aria-current="date"' : ''}>${ctx.esc(format(date, {weekday: 'short'}))} <span>${dateObj(date).getDate()}</span></button>`}</h3>${singleDay ? workoutLink(date) : ''}</header>
        <div class="schedule-entries">${dayEntries(ctx, date)}</div>
      </article>`;
    }).join('')}</div>`;
  }

  function workoutLink(date) {
    return `<button class="btn workout-link" type="button" data-action="open-workout" data-date="${date}">Edit workout</button>`;
  }

  function allTasks(ctx) {
    const tasks = [...ctx.state.tasks].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const open = tasks.filter(task => !task.done);
    const done = tasks.filter(task => task.done);
    const list = items => `<ul class="planner-entries">${items.map(task => taskRow(ctx, task)).join('')}</ul>`;
    return `${open.length ? list(open) : '<p class="planner-empty">No open tasks.</p>'}${done.length ? `<details class="planner-completed"><summary>Completed (${done.length})</summary>${list(done)}</details>` : ''}`;
  }

  function sidebar(ctx) {
    const all = ctx.view === 'day' || ctx.agenda === 'all';
    return `<aside class="panel planner-aside" aria-label="${all ? 'All tasks' : 'Selected day'}">
      ${ctx.view === 'day' ? '<h2>All tasks</h2>' : `<div class="segmented agenda-tabs" aria-label="Planner list"><button type="button" data-action="agenda-view" data-view="day" aria-pressed="${!all}">Selected day</button><button type="button" data-action="agenda-view" data-view="all" aria-pressed="${all}">All tasks</button></div>`}
      ${all ? allTasks(ctx) : `<div class="agenda-heading"><h3>${ctx.esc(fullDate(ctx.date))}</h3>${workoutLink(ctx.date)}</div>${dayEntries(ctx, ctx.date)}`}
    </aside>`;
  }

  function yearGrid(ctx) {
    const year = dateObj(ctx.date).getFullYear();
    return `<div class="year-grid">${Array.from({length: 12}, (_, i) => {
      const date = `${year}-${String(i + 1).padStart(2, '0')}-01`;
      return `<section class="year-month"><h3>${format(date, {month: 'long'})}</h3>${monthGrid(ctx, date, true)}</section>`;
    }).join('')}</div>`;
  }

  window.DaymarkViews ||= {};
  window.DaymarkViews.calendar = function (context) {
    const ctx = {...context, tasksByDate: indexTasks(context.state.tasks)};
    const {date, view, esc, addDays} = ctx;
    const weekStart = addDays(date, -dateObj(date).getDay());
    const dates = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
    const title = {
      day: shortDate(date), week: `${shortDate(weekStart)} – ${shortDate(dates[6])}`,
      month: format(date, {month: 'long', year: 'numeric'}), year: format(date, {year: 'numeric'})
    }[view];
    const content = view === 'year' ? yearGrid(ctx) : view === 'month' ? monthGrid(ctx, date) : schedule(ctx, view === 'week' ? dates : [date]);
    return `<section class="planner-grid ${view === 'week' ? 'wide-calendar' : ''}">
      <div class="panel planner-calendar">
        <div class="calendar-toolbar"><h2>${esc(title)}</h2><div class="calendar-controls" aria-label="Change dates">
          <button type="button" class="btn" data-action="calendar-today">Today</button>
          <button type="button" class="btn" data-action="calendar-prev" aria-label="Previous ${view}">‹</button>
          <button type="button" class="btn" data-action="calendar-next" aria-label="Next ${view}">›</button>
        </div></div>
        <div class="calendar-views"><div class="segmented" aria-label="Calendar view">${['day', 'week', 'month', 'year'].map(option => `<button type="button" data-action="calendar-view" data-view="${option}" aria-pressed="${view === option}">${option[0].toUpperCase() + option.slice(1)}</button>`).join('')}</div>${view === 'month' || view === 'year' ? '<div class="calendar-key"><span><i class="marker task-marker"></i>Tasks</span><span><i class="marker workout-marker"></i>Workout</span></div>' : ''}</div>
        ${content}
      </div>${sidebar(ctx)}
    </section>`;
  };
})();
