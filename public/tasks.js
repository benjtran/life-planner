(() => {
  'use strict';

  const views = window.DaymarkViews ||= {};
  const labels = {overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', later: 'Upcoming'};
  const symbols = {
    overdue: '<path d="M8 2 15 14H1L8 2Zm0 4v3m0 2.3v.2" stroke-linecap="round" stroke-linejoin="round"/>',
    today: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>',
    tomorrow: '<path d="m8 1 7 7-7 7-7-7 7-7Z" stroke-linejoin="round"/><path d="m7 5.5 2.5 2.5L7 10.5" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  views.taskRow = function (ctx, task, compact = false) {
    const {esc, pretty, taskTone} = ctx;
    const tone = task.due ? taskTone(task.due) : 'none';
    const date = task.due ? pretty(task.due) : 'No due date';
    const symbol = !task.done && symbols[tone];
    const label = task.done ? 'Completed' : labels[tone];
    return `<li class="task-list-row task-date-${esc(tone)}${symbol ? ' has-deadline-status' : ''}${task.done ? ' is-done' : ''}${compact ? ' is-compact' : ''}">
      <div class="task-date"><span class="task-due-date">${esc(date)}</span>${label ? `<small class="task-status">${symbol ? `<svg class="task-status-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${symbol}</svg>` : ''}${esc(label)}</small>` : ''}</div>
      <div class="task-content">
        <button class="task-check" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? 'Restore' : 'Complete'} ${esc(task.title)}" aria-pressed="${task.done ? 'true' : 'false'}"><span aria-hidden="true">${task.done ? '✓' : ''}</span></button>
        <span class="task-title">${esc(task.title)}</span>
        <button class="task-edit" type="button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="Edit ${esc(task.title)}">···</button>
      </div>
    </li>`;
  };

  views.tasks = function (ctx) {
    const {esc, pretty, addDays} = ctx;
    const scope = ctx.taskScope === 'all' ? 'all' : 'day';
    const filter = ['open', 'all', 'done'].includes(ctx.taskFilter) ? ctx.taskFilter : 'open';
    const items = [...(scope === 'all' ? ctx.allItems : ctx.itemsFor(ctx.date))]
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const visible = items.filter(item => filter === 'all' || (filter === 'done' ? item.done : !item.done));
    const openCount = items.filter(item => !item.done).length;
    const filters = [['open', 'To do', openCount], ['all', 'All', items.length], ['done', 'Completed', items.length - openCount]];
    const itemRow = item => {
      if (item.kind === 'task') return views.taskRow(ctx, item);
      const completed = item.kind === 'run-log' || item.done;
      const type = item.kind === 'workout' ? 'Workout' : 'Run';
      const openAction = item.kind === 'workout' ? 'open-workout' : 'open-running';
      const attrs = `data-date="${esc(item.due)}"${item.sourceId ? ` data-id="${esc(item.sourceId)}"` : ''}`;
      const toggle = item.kind === 'run-log' ? `<span class="task-check planned-log-check" aria-label="Completed">✓</span>` : `<button class="task-check" type="button" data-action="toggle-planned" data-id="${esc(item.id)}" data-date="${esc(item.due)}" aria-label="${completed ? 'Restore' : 'Complete'} ${esc(item.title)}" aria-pressed="${completed}"><span aria-hidden="true">${completed ? '✓' : ''}</span></button>`;
      return `<li class="task-list-row${completed ? ' is-done' : ''}"><div class="task-date"><span class="task-due-date">${esc(item.due ? pretty(item.due) : 'No date')}</span><small class="task-status">${esc(type)}</small></div><div class="task-content">${toggle}<span class="task-title">${esc(item.title)}${item.detail ? `<small class="planned-detail">${esc(item.detail)}</small>` : ''}</span><button class="task-edit" type="button" data-action="${openAction}" ${attrs} aria-label="Open ${esc(item.title)}">›</button></div></li>`;
    };
    return `<section class="tasks-view" aria-label="Tasks">
      <div class="tasks-scope" role="group" aria-label="Task scope"><button type="button" data-action="task-scope" data-scope="day" aria-pressed="${scope === 'day'}">Day</button><button type="button" data-action="task-scope" data-scope="all" aria-pressed="${scope === 'all'}">All tasks</button></div>
      ${scope === 'day' ? `<div class="tasks-day-nav"><button type="button" data-action="task-prev" aria-label="Previous day">‹</button><strong>${esc(pretty(ctx.date))}${ctx.date === ctx.today ? ' · Today' : ''}</strong><button type="button" data-action="task-next" aria-label="Next day">›</button><button type="button" data-action="task-today" class="tasks-today">Today</button></div>` : `<p class="tasks-range">Planned workouts and runs: ${esc(pretty(ctx.weekStart))} – ${esc(pretty(addDays(ctx.weekStart, 6)))}</p>`}
      <div class="tasks-toolbar"><p>${openCount} ${openCount === 1 ? 'item' : 'items'} to do</p><div class="task-filters" role="group" aria-label="Filter tasks">${filters.map(([value, label, count]) => `<button type="button" data-action="task-filter" data-filter="${value}" aria-pressed="${filter === value}">${label} <span>${count}</span></button>`).join('')}</div></div>
      <div class="task-table"><div class="task-table-head" aria-hidden="true"><span>Date</span><span>Item</span></div>
        ${visible.length ? `<ul class="task-list">${visible.map(itemRow).join('')}</ul>` : `<div class="tasks-empty"><strong>${filter === 'done' ? 'Nothing completed' : filter === 'all' ? 'Nothing scheduled' : 'Nothing to do'}</strong></div>`}
      </div>
    </section>`;
  };
})();
