(() => {
  'use strict';

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dateObj = value => new Date(`${value}T12:00:00`);
  const format = (value, options) => dateObj(value).toLocaleDateString('en', options);
  const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const shortDate = date => format(date, {month: 'short', day: 'numeric'});
  const fullDate = date => format(date, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
  const typeName = kind => ({task: 'Task', workout: 'Workout', run: 'Run', 'run-log': 'Run'})[kind] || 'Event';
  const typeClass = kind => kind === 'run-log' ? 'run' : kind;
  const weekdayOffset = date => (date.getDay() + 6) % 7;

  function eventList(ctx, items, compact = false) {
    if (!items.length) return compact ? '' : '<p class="planner-empty">Nothing scheduled.</p>';
    if (compact) return `<span class="calendar-events is-compact" aria-hidden="true">${items.slice(0, 3).map(item => `<span class="calendar-event event-${typeClass(item.kind)}${item.done ? ' is-done' : ''}"><span class="event-title">${ctx.esc(item.title)}</span></span>`).join('')}${items.length > 3 ? `<span class="event-meta">+${items.length - 3} more</span>` : ''}</span>`;
    return `<ul class="calendar-events">${items.map(item => `<li class="calendar-event event-${typeClass(item.kind)}${item.done ? ' is-done' : ''}"><span class="event-title">${ctx.esc(item.title)}</span><span class="event-meta">${ctx.esc(typeName(item.kind))}${item.done ? ' · Done' : ''}${item.detail ? ` · ${ctx.esc(item.detail)}` : ''}</span></li>`).join('')}</ul>`;
  }

  function monthCell(ctx, date, outside) {
    const items = ctx.itemsFor(date);
    const selected = date === ctx.date;
    const description = items.length ? items.map(item => `${typeName(item.kind)}: ${item.title}${item.done ? ', done' : ''}`).join('; ') : 'nothing scheduled';
    const kinds = [...new Set(items.map(item => typeClass(item.kind)))];
    return `<button type="button" class="month-cell${outside ? ' is-outside' : ''}${selected ? ' is-selected' : ''}" data-action="select-date" data-date="${date}" aria-label="${ctx.esc(`${fullDate(date)}: ${description}`)}" ${date === ctx.today ? 'aria-current="date"' : ''}>
      <span class="month-number">${dateObj(date).getDate()}</span><span class="month-markers" aria-hidden="true">${kinds.map(kind => `<i class="marker ${kind}-marker"></i>`).join('')}</span>${eventList(ctx, items, true)}
    </button>`;
  }

  function monthGrid(ctx) {
    const day = dateObj(ctx.date);
    const first = new Date(day.getFullYear(), day.getMonth(), 1, 12);
    const length = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    const offset = weekdayOffset(first);
    const start = ctx.addDays(dateKey(first), -offset);
    const cells = Array.from({length: 7 * Math.ceil((length + offset) / 7)}, (_, i) => {
      const date = ctx.addDays(start, i);
      return monthCell(ctx, date, dateObj(date).getMonth() !== day.getMonth());
    }).join('');
    return `<div class="planner-month"><div class="month-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="month-grid">${cells}</div></div>`;
  }

  function schedule(ctx, dates) {
    return `<div class="planner-schedule is-week" role="region" aria-label="Weekly schedule" tabindex="0">${dates.map(date => `<article class="schedule-day${date === ctx.date ? ' is-selected' : ''}">
      <header class="schedule-date"><h3><button data-action="select-date" data-date="${date}" type="button" aria-label="${ctx.esc(fullDate(date))}" ${date === ctx.today ? 'aria-current="date"' : ''}>${ctx.esc(format(date, {weekday: 'short'}))} <span>${dateObj(date).getDate()}</span></button></h3></header>
      <div class="schedule-entries">${eventList(ctx, ctx.itemsFor(date))}</div>
    </article>`).join('')}</div>`;
  }

  window.DaymarkViews ||= {};
  window.DaymarkViews.calendar = function (ctx) {
    const {date, esc, addDays} = ctx;
    const view = ctx.view === 'month' ? 'month' : 'week';
    const weekStart = addDays(date, -weekdayOffset(dateObj(date)));
    const dates = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
    const title = view === 'month' ? format(date, {month: 'long', year: 'numeric'}) : `${shortDate(weekStart)} – ${shortDate(dates[6])}`;
    return `<section class="panel planner-calendar">
      <div class="calendar-toolbar"><h2>${esc(title)}</h2><div class="calendar-controls" aria-label="Change dates">
        <button type="button" class="btn" data-action="calendar-today">Today</button>
        <button type="button" class="btn" data-action="calendar-prev" aria-label="Previous ${view}">‹</button>
        <button type="button" class="btn" data-action="calendar-next" aria-label="Next ${view}">›</button>
      </div></div>
      <div class="calendar-views"><div class="segmented" role="group" aria-label="Calendar view">${['week', 'month'].map(option => `<button type="button" data-action="calendar-view" data-view="${option}" aria-pressed="${view === option}">${option[0].toUpperCase() + option.slice(1)}</button>`).join('')}</div><div class="calendar-key"><span><i class="marker task-marker"></i>Task</span><span><i class="marker workout-marker"></i>Workout</span><span><i class="marker run-marker"></i>Run</span></div></div>
      ${view === 'month' ? monthGrid(ctx) : schedule(ctx, dates)}
    </section>`;
  };
})();
