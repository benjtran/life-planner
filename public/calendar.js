(() => {
  'use strict';

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dateObj = value => new Date(`${value}T12:00:00`);
  const format = (value, options) => dateObj(value).toLocaleDateString('en', options);
  const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const shortDate = date => format(date, {month: 'short', day: 'numeric'});
  const fullDate = date => format(date, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
  const typeNames = {task: 'Task', workout: 'Lift', run: 'Run'};
  const typeIcons = {
    task: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="m5 8 2 2 4-4"/>',
    workout: '<path d="M1.5 7v2M4 4v8m8-8v8m2.5-5v2M4 8h8"/>',
    run: '<path d="M2 13V6l4-1 2 3 4 1a2 2 0 0 1 2 2v2H2Zm0-2.5h12M7 7 5 8m4 0-1.5 1"/>',
  };
  const typeOrder = new Map(Object.keys(typeNames).map((kind, index) => [kind, index]));
  const byType = (a, b) => (typeOrder.get(a.kind) ?? typeOrder.size) - (typeOrder.get(b.kind) ?? typeOrder.size);
  const typeName = kind => typeNames[kind] || 'Event';
  const typeClass = kind => typeOrder.has(kind) ? ` event-type-${kind}` : '';
  function typeLabel(kind) {
    const icon = typeIcons[kind];
    return `<span class="event-kind${typeClass(kind)}">${icon ? `<svg class="event-kind-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>` : ''}<span>${typeName(kind)}</span></span>`;
  }
  const weekdayOffset = date => (date.getDay() + 6) % 7;

  function monthPreviews(items) {
    if (items.length <= 3) return items;
    const firstByKind = [...new Set(items.map(item => item.kind))].map(kind => items.find(item => item.kind === kind));
    return [...firstByKind, ...items.filter(item => !firstByKind.includes(item))].slice(0, 3).sort(byType);
  }

  function eventList(ctx, items, compact = false) {
    if (!items.length) return '';
    const element = compact ? 'span' : 'li';
    const events = (compact ? monthPreviews(items) : items).map(item => {
      const status = [item.done && 'Done', item.detail].filter(Boolean).join(' · ');
      return `<${element} class="calendar-event${typeClass(item.kind)}${item.done ? ' is-done' : ''}">
        ${typeLabel(item.kind)}
        <span class="event-title">${ctx.esc(item.title)}</span>
        ${!compact && status ? `<span class="event-meta">${ctx.esc(status)}</span>` : ''}
      </${element}>`;
    }).join('');
    if (compact) return `<span class="calendar-events is-compact" aria-hidden="true">${events}${items.length > 3 ? `<span class="event-meta">+${items.length - 3} more</span>` : ''}</span>`;
    return `<ul class="calendar-events" role="list">${events}</ul>`;
  }

  function monthCell(ctx, date, outside) {
    const items = [...ctx.itemsFor(date)].sort(byType);
    const selected = date === ctx.date;
    const description = items.length ? items.map(item => `${typeName(item.kind)}: ${item.title}${item.done ? ', done' : ''}`).join('; ') : 'nothing scheduled';
    const kinds = [...new Set(items.map(item => item.kind))];
    return `<button type="button" class="month-cell${outside ? ' is-outside' : ''}${selected ? ' is-selected' : ''}" data-action="select-date" data-date="${date}" aria-label="${ctx.esc(`${fullDate(date)}: ${description}`)}" ${date === ctx.today ? 'aria-current="date"' : ''}>
      <span class="month-number">${dateObj(date).getDate()}</span>${kinds.length ? `<span class="month-kinds" aria-hidden="true">${kinds.map(typeLabel).join('')}</span>` : ''}${eventList(ctx, items, true)}
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
      <div class="schedule-entries">${eventList(ctx, [...ctx.itemsFor(date)].sort(byType))}</div>
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
      <div class="calendar-views"><div class="segmented" role="group" aria-label="Calendar view">${['week', 'month'].map(option => `<button type="button" data-action="calendar-view" data-view="${option}" aria-pressed="${view === option}">${option[0].toUpperCase() + option.slice(1)}</button>`).join('')}</div></div>
      ${view === 'month' ? monthGrid(ctx) : schedule(ctx, dates)}
    </section>`;
  };
})();
