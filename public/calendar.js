(() => {
  'use strict';

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateObj = value => new Date(`${value}T12:00:00`);
  const format = (value, options) => dateObj(value).toLocaleDateString('en', options);
  const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const shortDate = date => format(date, {month: 'short', day: 'numeric'});
  const fullDate = date => format(date, {weekday: 'long', month: 'long', day: 'numeric'});
  function indexByDate(items, field) {
    const byDate = new Map();
    for (const item of items) {
      const date = item[field];
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(item);
    }
    return byDate;
  }

  function movement(ctx, date) {
    const day = ctx.state.days[date];
    const workout = ctx.workoutFor(date);
    const exercises = workout.exercises.map(exercise => ({...exercise, action: 'toggle-exercise'}));
    if (day?.cardio) exercises.push({name: day.cardio, kind: 'cardio', done: day.cardioDone, action: 'toggle-cardio'});
    return {title: workout.title, exercises};
  }

  function checkButton(esc, title, done, action, id = '', date = '') {
    return `<button class="planner-check" type="button" data-action="${action}" data-id="${esc(id)}" data-date="${esc(date)}" aria-label="${done ? 'Restore' : 'Complete'} ${esc(title)}" aria-pressed="${Boolean(done)}"><span aria-hidden="true">${done ? '✓' : ''}</span></button>`;
  }

  function exerciseRow(ctx, exercise, date) {
    const {esc} = ctx;
    const type = exercise.kind === 'cardio' ? 'Cardio' : 'Exercise';
    return `<li class="planner-row planner-exercise ${exercise.done ? 'tone-done' : ''}">
      ${checkButton(esc, exercise.name, exercise.done, exercise.action, exercise.id, date)}
      <div class="planner-row-text"><span>${esc(exercise.name)}</span><small>${type}</small></div>
    </li>`;
  }

  function dayEntries(ctx, date, week = false) {
    const tasks = ctx.tasksByDate.get(date) || [];
    const runs = ctx.runsByDate.get(date) || [];
    const {title, exercises} = movement(ctx, date);
    const list = (html) => `<ul class="planner-entries">${html}</ul>`;
    const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
    return `${tasks.length ? `<ul class="task-list calendar-tasks ${week ? 'week-tasks' : ''}">${sorted.map(task => window.DaymarkViews.taskRow(ctx, task, true)).join('')}</ul>` : ''}
      ${title || exercises.length ? `<div class="planner-movement"><strong>${ctx.esc(title || 'Workout')}</strong></div>` : ''}
      ${exercises.length ? list(exercises.map(exercise => exerciseRow(ctx, exercise, date)).join('')) : ''}
      ${runs.length ? list(runs.map(run => `<li class="planner-row planner-run"><span class="run-mark" aria-hidden="true">✓</span><div class="planner-row-text"><span>${run.intensity === 'high' ? 'High-intensity run' : 'Low-intensity run'}</span><small>${ctx.esc(run.distance)} km</small></div><button class="planner-edit" type="button" data-action="open-running" data-date="${date}" aria-label="Open running log">···</button></li>`).join('')) : ''}
      ${!tasks.length && !title && !exercises.length && !runs.length ? '<p class="planner-empty">Nothing scheduled.</p>' : ''}`;
  }

  function monthCell(ctx, date, outside) {
    const {esc, today} = ctx;
    const tasks = ctx.tasksByDate.get(date) || [];
    const runs = ctx.runsByDate.get(date) || [];
    const {title, exercises} = movement(ctx, date);
    const selected = date === ctx.date;
    const descriptions = [fullDate(date), tasks.length && `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, (title || exercises.length) && 'workout', runs.length && 'run logged'].filter(Boolean);
    return `<button type="button" class="month-cell${outside ? ' is-outside' : ''}${selected ? ' is-selected' : ''}" data-action="select-date" data-date="${date}" aria-label="${esc(descriptions.join(', '))}" aria-pressed="${selected}" ${date === today ? 'aria-current="date"' : ''}>
      <span class="month-number">${dateObj(date).getDate()}</span><span class="month-markers" aria-hidden="true">${tasks.length ? '<i class="marker task-marker"></i>' : ''}${title || exercises.length ? '<i class="marker workout-marker"></i>' : ''}${runs.length ? '<i class="marker running-marker"></i>' : ''}</span>
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
        <div class="schedule-entries">${dayEntries(ctx, date, !singleDay)}</div>
      </article>`;
    }).join('')}</div>`;
  }

  function workoutLink(date) {
    return `<button class="btn workout-link" type="button" data-action="open-workout" data-date="${date}">Log workout</button>`;
  }

  function sidebar(ctx) {
    return `<aside class="panel planner-aside" aria-label="Selected day"><div class="agenda-heading"><h2>${ctx.esc(fullDate(ctx.date))}</h2>${workoutLink(ctx.date)}</div>${dayEntries(ctx, ctx.date)}</aside>`;
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
    const ctx = {...context, tasksByDate: indexByDate(context.state.tasks, 'due'), runsByDate: indexByDate(context.state.runs, 'date')};
    const {date, view, esc, addDays} = ctx;
    const weekStart = addDays(date, -dateObj(date).getDay());
    const dates = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
    const title = {
      day: shortDate(date), week: `${shortDate(weekStart)} – ${shortDate(dates[6])}`,
      month: format(date, {month: 'long', year: 'numeric'}), year: format(date, {year: 'numeric'})
    }[view];
    const content = view === 'year' ? yearGrid(ctx) : view === 'month' ? monthGrid(ctx, date) : schedule(ctx, view === 'week' ? dates : [date]);
    return `<section class="planner-grid ${view === 'week' || view === 'day' ? 'wide-calendar' : ''}">
      <div class="panel planner-calendar">
        <div class="calendar-toolbar"><h2>${esc(title)}</h2><div class="calendar-controls" aria-label="Change dates">
          <button type="button" class="btn" data-action="calendar-today">Today</button>
          <button type="button" class="btn" data-action="calendar-prev" aria-label="Previous ${view}">‹</button>
          <button type="button" class="btn" data-action="calendar-next" aria-label="Next ${view}">›</button>
        </div></div>
        <div class="calendar-views"><div class="segmented" aria-label="Calendar view">${['day', 'week', 'month', 'year'].map(option => `<button type="button" data-action="calendar-view" data-view="${option}" aria-pressed="${view === option}">${option[0].toUpperCase() + option.slice(1)}</button>`).join('')}</div>${view === 'month' || view === 'year' ? '<div class="calendar-key"><span><i class="marker task-marker"></i>Tasks</span><span><i class="marker workout-marker"></i>Workout</span><span><i class="marker running-marker"></i>Run</span></div>' : ''}</div>
        ${content}
      </div>${view === 'day' ? '' : sidebar(ctx)}
    </section>`;
  };
})();
