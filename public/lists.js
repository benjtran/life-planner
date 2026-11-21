(function () {
  const views = window.DaymarkViews = window.DaymarkViews || {};

  function dateLabel(value) {
    if (!value) return 'No date';
    const parts = value.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  views.tasks = function (ctx) {
    const { state, taskTone, esc } = ctx;
    const filter = ['open', 'done'].includes(ctx.taskFilter) ? ctx.taskFilter : 'all';
    const tasks = [...(state.tasks || [])].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const open = tasks.filter(task => !task.done);
    const done = tasks.filter(task => task.done);
    const row = task => {
      const tone = task.done ? 'done' : taskTone(task.due);
      const label = tone === 'today' ? 'Today' : tone === 'tomorrow' ? 'Tomorrow' : tone === 'overdue' ? 'Overdue · ' + dateLabel(task.due) : dateLabel(task.due);
      return `<li class="dm-task ${task.done ? 'is-done' : ''}">
        ${ctx.editTask === task.id ? `<form data-form="edit-task" class="dm-edit-form" data-id="${esc(task.id)}"><label>Task<input name="title" required maxlength="200" value="${esc(task.title)}"></label><label>Due date<input name="due" type="date" value="${esc(task.due)}"></label><div><button class="btn primary" type="submit">Save</button> <button class="btn" type="button" data-action="cancel-task-edit">Cancel</button></div></form>` : `
        <button class="dm-check" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? 'Restore' : 'Complete'} ${esc(task.title)}">${task.done ? '✓' : ''}</button>
        <span class="dm-task-title">${esc(task.title)}</span>
        <span class="dm-due dm-due-${tone}">${esc(label)}</span>
        <button class="dm-delete" type="button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="Edit ${esc(task.title)}">✎</button>
        <button class="dm-delete" type="button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="Delete ${esc(task.title)}">×</button>
        `}</li>`;
    };
    const section = (title, items, empty) => `<section class="dm-task-section"><div class="dm-section-heading"><h3>${title}</h3><span>${items.length}</span></div>${items.length ? `<ul class="dm-task-list">${items.map(row).join('')}</ul>` : `<p class="dm-list-empty">${empty}</p>`}</section>`;
    return `<div class="dm-lists dm-tasks-view">
      <div class="dm-list-intro"><div><p class="dm-eyebrow">MAKE SPACE FOR WHAT MATTERS</p><h1>Tasks</h1><p class="muted">A little less to keep in your head.</p></div><div class="dm-count"><strong>${open.length}</strong><span>to do</span></div></div>
      <div class="dm-task-layout"><div class="panel dm-task-panel"><div class="dm-panel-top"><div><h2>Your list</h2><p class="muted">One thing at a time.</p></div><div class="dm-filters" aria-label="Filter tasks">${[['all', 'All'], ['open', 'To do'], ['done', 'Done']].map(([value, label]) => `<button type="button" data-action="task-filter" data-filter="${value}" class="${filter === value ? 'active' : ''}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div></div>
        ${filter !== 'done' ? section('To do', open, 'Nothing on your list yet. Add a task to get started.') : ''}
        ${filter !== 'open' ? section('Completed', done, 'Completed tasks will appear here.') : ''}
      </div><aside class="panel dm-add-panel"><div class="dm-add-icon" aria-hidden="true">＋</div><h2>Add a task</h2><p class="muted">Give your next step a home.</p><form data-form="add-task" class="dm-list-form"><label>Task<input name="title" type="text" placeholder="What needs doing?" required maxlength="200"></label><label>Due date <span class="dm-optional">optional</span><input name="due" type="date"></label><button class="btn primary dm-submit" type="submit">Add to list <span aria-hidden="true">→</span></button></form></aside></div>
    </div>`;
  };

  views.meals = function (ctx) {
    const { state, date, today, esc } = ctx;
    const meals = ((state.days || {})[date] || {}).meals || {};
    const fields = [['breakfast', 'Breakfast', '☀', 'A fresh start'], ['lunch', 'Lunch', '◒', 'Midday pause'], ['dinner', 'Dinner', '◔', 'Wind down'], ['snack', 'Snack', '✳', 'Something in between']];
    const filled = fields.filter(([key]) => String(meals[key] || '').trim()).length;
    const parts = date.split('-').map(Number);
    const readable = new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    return `<div class="dm-lists dm-meals-view"><div class="dm-list-intro"><div><p class="dm-eyebrow">A LITTLE PLANNING GOES A LONG WAY</p><h1>Meals</h1><p class="muted">Make a little room for the meals ahead.</p></div><div class="dm-count"><strong>${filled}<small>/4</small></strong><span>planned</span></div></div>
      <div class="panel dm-meals-panel"><div class="dm-meal-header"><div><p class="dm-eyebrow">YOUR DAY</p><h2>${esc(readable)}${date === today ? ' <span class="dm-today">Today</span>' : ''}</h2><p class="muted">A simple place to note what’s on the menu.</p></div><div class="dm-date-controls"><button type="button" data-action="calendar-prev" aria-label="Previous day">←</button><label class="dm-date-label"><span class="sr-only">Choose date</span><input type="date" data-change="date" value="${esc(date)}"></label><button type="button" data-action="calendar-next" aria-label="Next day">→</button></div></div>
      <form data-form="save-meals"><div class="dm-meal-grid">${fields.map(([key, label, icon, hint]) => `<label class="dm-meal-card"><span class="dm-meal-top"><span class="dm-meal-icon" aria-hidden="true">${icon}</span><span><strong>${label}</strong><small>${hint}</small></span></span><textarea name="${key}" rows="3" placeholder="Add a note...">${esc(meals[key] || '')}</textarea></label>`).join('')}</div><div class="dm-meal-footer"><span class="muted">Your plans, your way.</span><button class="btn primary" type="submit">Save meals <span aria-hidden="true">→</span></button></div></form></div></div>`;
  };
})();
