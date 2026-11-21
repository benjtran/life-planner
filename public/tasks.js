(() => {
  'use strict';

  const views = window.DaymarkViews ||= {};
  const sections = [
    {id: 'tasks', title: 'Tasks', kinds: ['task']},
    {id: 'lifts', title: 'Lifts', kinds: ['workout']},
    {id: 'runs', title: 'Runs', kinds: ['run']},
  ];
  const labels = {overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', later: 'Upcoming'};
  const symbols = {
    overdue: '<path d="M8 2 15 14H1L8 2Zm0 4v3m0 2.3v.2" stroke-linecap="round" stroke-linejoin="round"/>',
    today: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>',
    tomorrow: '<path d="m8 1 7 7-7 7-7-7 7-7Z" stroke-linejoin="round"/><path d="m7 5.5 2.5 2.5L7 10.5" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  function statusLabel(label, symbol) {
    return label ? `<small class="task-status">${symbol ? `<svg class="task-status-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${symbol}</svg>` : ''}${label}</small>` : '';
  }

  function taskRow(ctx, task, showDate) {
    const {esc, pretty, taskTone} = ctx;
    const tone = task.due ? taskTone(task.due) : 'none';
    const date = task.due ? pretty(task.due) : 'No due date';
    const symbol = !task.done && symbols[tone];
    const label = task.done ? 'Completed' : labels[tone];
    return `<li class="task-list-row${showDate ? ` task-date-${esc(tone)}${symbol ? ' has-deadline-status' : ''}` : ''}${task.done ? ' is-done' : ''}">
      ${showDate ? `<div class="task-date"><span class="task-due-date">${esc(date)}</span>${statusLabel(label, symbol)}</div>` : ''}
      <div class="task-content">
        <button class="task-check" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? 'Restore' : 'Complete'} ${esc(task.title)}" aria-pressed="${task.done ? 'true' : 'false'}"><span aria-hidden="true">${task.done ? '✓' : ''}</span></button>
        <span class="task-title"><span class="task-name">${esc(task.title)}</span></span>
        <button class="task-edit" type="button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="Edit ${esc(task.title)}">···</button>
      </div>
    </li>`;
  }

  function tasksByDate(ctx, items, row) {
    const dates = new Map();
    for (const item of items) {
      const due = item.due || '';
      if (!dates.has(due)) dates.set(due, []);
      dates.get(due).push(item);
    }
    return [...dates].map(([due, entries]) => {
      const tone = entries.some(item => item.kind === 'task' && !item.done) ? ctx.taskTone(due) : 'none';
      const status = symbols[tone];
      const groups = sections.map(({id, title, kinds}) => {
        const matching = entries.filter(item => kinds.includes(item.kind));
        if (!matching.length) return '';
        const showKind = id !== 'tasks' || matching.length !== entries.length;
        return `<div class="task-day-kind">${showKind ? `<h3>${title}</h3>` : ''}<ul class="task-list" role="list">${matching.map(row).join('')}</ul></div>`;
      }).join('');
      return `<section class="task-day panel" aria-labelledby="task-day-${ctx.esc(due || 'undated')}">
        <header class="task-day-header${status ? ` deadline-${ctx.esc(tone)}` : ''}">
          <h2 id="task-day-${ctx.esc(due || 'undated')}">${due ? `<time datetime="${ctx.esc(due)}">${ctx.esc(ctx.pretty(due))}</time>` : 'No due date'}</h2>
          ${status ? statusLabel(labels[tone], status) : ''}
        </header>
        ${groups}
      </section>`;
    }).join('');
  }

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
      if (item.kind === 'task') return taskRow(ctx, item, scope === 'day');
      const completed = item.done;
      const toggle = `<button class="task-check" type="button" data-action="toggle-planned" data-id="${esc(item.id)}" data-date="${esc(item.due)}" aria-label="${completed ? 'Restore' : 'Complete'} ${esc(item.title)}" aria-pressed="${completed}"><span aria-hidden="true">${completed ? '✓' : ''}</span></button>`;
      const open = item.kind === 'workout' ? `<button class="task-edit" type="button" data-action="open-workout" data-date="${esc(item.due)}" aria-label="Open ${esc(item.title)}">›</button>` : '';
      const date = scope === 'day' ? `<div class="task-date"><span class="task-due-date">${esc(item.due ? pretty(item.due) : 'No date')}</span>${completed ? statusLabel('Completed') : ''}</div>` : '';
      return `<li class="task-list-row${completed ? ' is-done' : ''}">${date}<div class="task-content">${toggle}<span class="task-title"><span class="task-name">${esc(item.title)}</span>${item.detail ? `<small class="planned-detail">${esc(item.detail)}</small>` : ''}</span>${open}</div></li>`;
    };
    const groups = scope === 'all' ? tasksByDate(ctx, visible, itemRow) : sections.map(({id, title, kinds}) => {
      const entries = visible.filter(item => kinds.includes(item.kind));
      if (!entries.length) return '';
      return `<section class="task-group" aria-labelledby="task-group-${id}">
        <h2 id="task-group-${id}">${title}</h2>
        <ul class="task-list" role="list">${entries.map(itemRow).join('')}</ul>
      </section>`;
    }).join('');
    return `<div class="tasks-view">
      <div class="tasks-scope" role="group" aria-label="Task scope"><button type="button" data-action="task-scope" data-scope="day" aria-pressed="${scope === 'day'}">Day</button><button type="button" data-action="task-scope" data-scope="all" aria-pressed="${scope === 'all'}">All tasks</button></div>
      <div class="tasks-toolbar">
        ${scope === 'day' ? `<div class="tasks-day-nav"><button type="button" data-action="task-prev" aria-label="Previous day">‹</button><strong>${esc(pretty(ctx.date))}${ctx.date === ctx.today ? ' · Today' : ''}</strong><button type="button" data-action="task-next" aria-label="Next day">›</button><button type="button" data-action="task-today" class="tasks-today">Today</button></div>` : `<p class="tasks-range">Planned workouts and runs: ${esc(pretty(ctx.weekStart))} – ${esc(pretty(addDays(ctx.weekStart, 6)))}</p>`}
        <div class="task-filters" role="group" aria-label="Filter items">${filters.map(([value, label, count]) => `<button type="button" data-action="task-filter" data-filter="${value}" aria-pressed="${filter === value}">${label} <span>${count}</span></button>`).join('')}</div>
      </div>
      ${groups ? `<div class="task-groups">${groups}</div>` : `<div class="panel tasks-empty"><strong>${filter === 'done' ? 'Nothing completed' : filter === 'all' ? 'Nothing scheduled' : 'Nothing to do'}</strong></div>`}
    </div>`;
  };
})();
