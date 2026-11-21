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
    const filter = ['open', 'all', 'done'].includes(ctx.taskFilter) ? ctx.taskFilter : 'open';
    const tasks = [...ctx.state.tasks].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const visible = tasks.filter(task => filter === 'all' || (filter === 'done' ? task.done : !task.done));
    const openCount = tasks.filter(task => !task.done).length;
    const doneCount = tasks.length - openCount;
    const filters = [['open', 'To do', openCount], ['all', 'All', tasks.length], ['done', 'Completed', doneCount]];
    return `<section class="tasks-view" aria-label="Tasks">
      <div class="tasks-toolbar"><p>${openCount} ${openCount === 1 ? 'task' : 'tasks'} to do</p><div class="task-filters" role="group" aria-label="Filter tasks">${filters.map(([value, label, count]) => `<button type="button" data-action="task-filter" data-filter="${value}" aria-pressed="${filter === value}">${label} <span>${count}</span></button>`).join('')}</div></div>
      <div class="task-table"><div class="task-table-head" aria-hidden="true"><span>Due date</span><span>Task</span></div>
        ${visible.length ? `<ul class="task-list">${visible.map(task => views.taskRow(ctx, task)).join('')}</ul>` : `<div class="tasks-empty"><strong>${filter === 'done' ? 'No completed tasks' : filter === 'all' ? 'No tasks yet' : 'No tasks to do'}</strong></div>`}
      </div>
    </section>`;
  };
})();
