(() => {
  'use strict';

  const views = window.DaymarkViews ||= {};
  const labels = {overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', later: 'Upcoming', none: 'No date'};

  views.taskRow = function (ctx, task, compact = false) {
    const {esc, pretty, taskTone} = ctx;
    const tone = task.due ? taskTone(task.due) : 'none';
    const date = task.due ? pretty(task.due) : 'No due date';
    return `<li class="task-list-row task-date-${esc(tone)}${task.done ? ' is-done' : ''}${compact ? ' is-compact' : ''}">
      <div class="task-date"><span>${esc(date)}</span>${task.due ? `<small>${esc(task.done ? 'Completed' : labels[tone] || 'Upcoming')}</small>` : ''}</div>
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
