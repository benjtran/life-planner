(function () {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateObj = value => new Date(value + 'T12:00:00');
  const key = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  const shift = (value, n) => { const d = dateObj(value); d.setDate(d.getDate() + n); return key(d); };
  const fmt = (value, opts) => dateObj(value).toLocaleDateString('en-US', opts);
  const record = (state, date) => (state.days || {})[date] || {};
  const tasksFor = (state, date) => (state.tasks || []).filter(t => t.due === date);
  const mealsFor = day => Object.values(day.meals || {}).filter(Boolean);
  const hasWorkout = day => !!(day.workout && (day.workout.title || (day.workout.exercises || []).length));

  function indicators(state, date) {
    const day = record(state, date);
    return `<span class="cal-dots" aria-hidden="true">${tasksFor(state, date).length ? '<i class="cal-dot task"></i>' : ''}${hasWorkout(day) || day.cardio ? '<i class="cal-dot workout"></i>' : ''}${mealsFor(day).length ? '<i class="cal-dot meal"></i>' : ''}</span>`;
  }
  function dateButton(ctx, date, extra = '') {
    const {state, today, esc} = ctx;
    const selected = date === ctx.date;
    const day = record(state, date);
    const dateLabel = fmt(date, {weekday:'long', month:'long', day:'numeric', year:'numeric'});
    const plans = [tasksFor(state, date).length && 'tasks', (hasWorkout(day) || day.cardio) && 'movement', mealsFor(day).length && 'meals'].filter(Boolean);
    return `<button type="button" class="cal-date ${extra} ${selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}" data-action="select-date" data-date="${date}" aria-label="${esc([dateLabel, ...plans].join(', '))}" ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}><span>${dateObj(date).getDate()}</span>${indicators(state, date)}</button>`;
  }
  function monthGrid(ctx, anchor, mini = false) {
    const d = dateObj(anchor), first = new Date(d.getFullYear(), d.getMonth(), 1, 12);
    const start = shift(key(first), -first.getDay());
    const dayCount = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const cells = Array.from({length: mini ? 42 : 7 * Math.ceil((dayCount + first.getDay()) / 7)}, (_, i) => {
      const date = shift(start, i);
      if (mini && dateObj(date).getMonth() !== d.getMonth()) return '<span></span>';
      return dateButton(ctx, date, dateObj(date).getMonth() !== d.getMonth() ? 'is-outside' : '');
    }).join('');
    return `<div class="cal-grid ${mini ? 'is-mini' : ''}"><div class="cal-weekdays">${weekdays.map(w => `<span>${mini ? w[0] : w}</span>`).join('')}</div><div class="cal-cells">${cells}</div></div>`;
  }
  function agenda(ctx) {
    const {state, date, esc} = ctx, day = record(state, date), tasks = tasksFor(state, date), meals = day.meals || {};
    const workout = day.workout || {};
    const exercises = (workout.exercises || []).map((exercise) => exercise.name).filter(Boolean).join(' · ');
    return `<aside class="cal-agenda" aria-label="Selected day agenda"><div class="cal-agenda-head"><div><p class="cal-eyebrow">YOUR DAY</p><h3>${esc(fmt(date, {weekday:'long'}))}</h3><p>${esc(fmt(date, {month:'long', day:'numeric', year:'numeric'}))}</p></div><span class="cal-date-badge">${dateObj(date).getDate()}</span></div>
      <div class="cal-agenda-section"><div class="cal-section-head"><h4>Tasks <span>${tasks.length}</span></h4><button type="button" data-action="open-tasks">View all ↗</button></div>${tasks.length ? `<div class="cal-task-list">${tasks.map(t => `<button type="button" class="cal-task ${t.done ? 'is-done' : ''}" data-action="toggle-task" data-id="${esc(String(t.id))}" aria-pressed="${!!t.done}"><span class="cal-check">${t.done ? '✓' : ''}</span><span>${esc(t.title)}</span></button>`).join('')}</div>` : '<p class="cal-empty">A clear schedule. Enjoy the space.</p>'}</div>
      <div class="cal-agenda-section"><div class="cal-section-head"><h4>Movement</h4><button type="button" data-action="open-workout">Edit plan</button></div>${hasWorkout(day) ? `<div class="cal-entry"><span class="cal-entry-icon workout" aria-hidden="true">✳</span><div><strong>${esc(workout.title || 'Workout')}</strong>${exercises ? `<small>${esc(exercises)}</small>` : ''}</div></div>` : day.cardio ? '' : '<p class="cal-empty">No movement planned.</p>'}${day.cardio ? `<div class="cal-entry"><span class="cal-entry-icon workout" aria-hidden="true">↗</span><div><strong>Cardio</strong><small>${esc(day.cardio)}</small></div></div>` : ''}</div>
      <div class="cal-agenda-section"><div class="cal-section-head"><h4>Meals</h4><button type="button" data-action="open-meals">View ↗</button></div>${mealsFor(day).length ? Object.entries(meals).filter(([,v]) => v).map(([name, value]) => `<div class="cal-meal"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('') : '<p class="cal-empty">Nothing logged yet.</p>'}</div></aside>`;
  }
  function week(ctx) {
    const start = shift(ctx.date, -dateObj(ctx.date).getDay());
    return `<div class="cal-week-view">${Array.from({length:7}, (_, i) => { const date = shift(start, i), day = record(ctx.state, date), tasks = tasksFor(ctx.state, date); return `<div class="cal-week-column ${date === ctx.date ? 'is-current' : ''}"><div class="cal-week-heading"><span>${weekdays[i]}</span>${dateButton(ctx, date)}</div><div class="cal-week-items">${tasks.map(t => `<div class="cal-week-item task">${ctx.esc(t.title)}</div>`).join('')}${hasWorkout(day) ? `<div class="cal-week-item workout">${ctx.esc(day.workout.title || 'Workout')}</div>` : ''}${day.cardio ? '<div class="cal-week-item workout">Cardio</div>' : ''}${mealsFor(day).length ? `<div class="cal-week-item meal">${mealsFor(day).length} meals</div>` : ''}</div></div>`; }).join('')}</div>`;
  }
  function dayView(ctx) {
    const day = record(ctx.state, ctx.date), tasks = tasksFor(ctx.state, ctx.date);
    return `<div class="cal-day-view"><p class="cal-eyebrow">A LITTLE SPACE FOR YOURSELF</p><h3>${ctx.esc(fmt(ctx.date, {weekday:'long'}))}</h3><p>${ctx.esc(fmt(ctx.date, {month:'long', day:'numeric', year:'numeric'}))}</p><div class="cal-day-stats"><div><strong>${tasks.length}</strong><span>tasks planned</span></div><div><strong>${hasWorkout(day) || day.cardio ? '1' : '0'}</strong><span>movement plans</span></div><div><strong>${mealsFor(day).length}</strong><span>meals logged</span></div></div><p class="cal-day-note">Make room for what matters today.</p></div>`;
  }
  function year(ctx) {
    const y = dateObj(ctx.date).getFullYear();
    return `<div class="cal-year-grid">${Array.from({length:12}, (_, i) => { const date = `${y}-${String(i + 1).padStart(2,'0')}-01`; return `<section class="cal-mini-month"><h3>${fmt(date, {month:'long'})}</h3>${monthGrid(ctx, date, true)}</section>`; }).join('')}</div>`;
  }
  window.DaymarkViews = window.DaymarkViews || {};
  window.DaymarkViews.calendar = function (ctx) {
    const {date, view, esc} = ctx;
    const title = view === 'year' ? fmt(date,{year:'numeric'}) : view === 'day' ? fmt(date,{month:'long',day:'numeric',year:'numeric'}) : view === 'week' ? `${fmt(shift(date,-dateObj(date).getDay()),{month:'short',day:'numeric'})} – ${fmt(shift(date,6-dateObj(date).getDay()),{month:'short',day:'numeric',year:'numeric'})}` : fmt(date,{month:'long',year:'numeric'});
    return `<section class="cal-dashboard"><div class="cal-main"><div class="cal-toolbar"><div><p class="cal-eyebrow">YOUR TIME, AT A GLANCE</p><h2>${esc(title)}</h2></div><div class="cal-nav"><button type="button" data-action="calendar-today">Today</button><button type="button" data-action="calendar-prev" aria-label="Previous ${esc(view)}">‹</button><button type="button" data-action="calendar-next" aria-label="Next ${esc(view)}">›</button></div></div><div class="cal-subbar"><div class="cal-segments" aria-label="Calendar view">${['day','week','month','year'].map(v => `<button type="button" data-action="calendar-view" data-view="${v}" aria-pressed="${view === v}" class="${view === v ? 'is-active' : ''}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><div class="cal-legend"><span><i class="cal-dot task"></i> Tasks</span><span><i class="cal-dot workout"></i> Movement</span><span><i class="cal-dot meal"></i> Meals</span></div></div>${view === 'year' ? year(ctx) : view === 'week' ? week(ctx) : view === 'day' ? dayView(ctx) : monthGrid(ctx,date)}</div>${agenda(ctx)}</section>`;
  };
})();
