(function () {
  'use strict';
  const views = window.DaymarkViews = window.DaymarkViews || {};
  const value = x => x == null ? '' : String(x);
  const num = x => x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);
  const prettyNum = x => x == null ? '—' : String(x);

  const workoutView = function (ctx) {
    const {state, date, today, esc, pretty} = ctx;
    const day = (state.days || {})[date] || {};
    const workout = ctx.workoutFor(date) || {};
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const exerciseCard = (exercise, index) => {
      const id = esc(value(exercise.id));
      const name = esc(value(exercise.name) || 'Untitled exercise');
      const cardio = exercise.kind === 'cardio';
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      return `<article class="training-exercise"><div class="exercise-heading"><div><span class="exercise-number">${String(index + 1).padStart(2, '0')}</span><span class="exercise-type">${cardio ? 'Cardio' : 'Strength'}${exercise.done ? ' · Completed' : ''}</span><h3>${name}</h3></div><button class="icon-action" type="button" data-action="delete-exercise" data-id="${id}" aria-label="Delete ${name}">×</button></div>
        ${cardio ? `<form class="cardio-entry" data-form="save-cardio" data-id="${id}"><label>Duration <span class="unit">min</span><input type="number" min="0" step="any" name="minutes" value="${esc(value(exercise.minutes))}" placeholder="—"></label><button class="btn" type="submit">Save</button></form>` : `<div class="set-heading"><span>Set</span><span>Reps</span><span>Weight</span><span></span><span></span></div><div class="sets">${sets.map((set, i) => `<form class="set-row" data-form="save-set" data-id="${id}" data-index="${i}"><span class="set-index">${String(i + 1).padStart(2, '0')}</span><label><span class="sr-only">Set ${i + 1} reps</span><input type="number" min="0" step="any" name="reps" value="${esc(value(set.reps))}" placeholder="—"></label><label><span class="sr-only">Set ${i + 1} weight</span><input type="number" min="0" step="any" name="weight" value="${esc(value(set.weight))}" placeholder="—"></label><button class="save-set" type="submit">Save</button><button class="icon-action" type="button" data-action="delete-set" data-id="${id}" data-index="${i}" aria-label="Delete set ${i + 1}">×</button></form>`).join('')}</div><div class="exercise-footer"><button class="text-action" type="button" data-action="add-set" data-id="${id}">+ Add set</button><button class="text-action" type="button" data-action="progress-exercise" data-exercise="${name}">View progress ↗</button></div>`}
      </article>`;
    };
    return `<div class="training-intro"><div class="training-date"><label for="training-date">Session date</label><input id="training-date" type="date" data-change="date" value="${esc(date)}" aria-label="Session date"><span>${esc(pretty(date))}${date === today ? ' · Today' : ''}</span></div></div>
      <div class="training-layout"><div class="training-main"><div class="section-heading"><h2>Workout</h2><span class="exercise-count">${exercises.length} ${exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</span></div>
      <form class="panel workout-details" data-form="workout-title"><label>Workout name<input name="title" value="${esc(value(workout.title))}" placeholder="e.g. Upper body strength"></label><label>Other activity notes<input name="cardio" value="${esc(value(day.cardio))}" placeholder="e.g. Bike warm-up"></label><button class="btn" type="submit">Save details</button></form>
      <div class="exercise-list">${exercises.length ? exercises.map(exerciseCard).join('') : '<div class="training-empty"><h3>No exercises yet</h3><p>Add an exercise to this workout.</p></div>'}</div><button class="btn primary finish-workout" type="button" data-action="finish-workout">Save workout</button></div>
      <aside class="training-aside"><div class="panel add-exercise"><h2>Add an exercise</h2><form data-form="add-exercise"><label>Exercise name<input name="name" required placeholder="e.g. Goblet squat"></label><label>Type<select name="kind"><option value="strength">Strength</option><option value="cardio">Cardio</option></select></label><button class="btn primary" type="submit">+ Add exercise</button></form></div></aside></div>`;
  };

  const templatesView = function (ctx) {
    const {state, esc} = ctx;
    const templates = state.templates || [];
    const selected = templates.find(t => t.id === ctx.templateId);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdays = selected && Array.isArray(selected.weekdays) ? selected.weekdays : [];
    return `<div class="template-layout"><div><div class="section-heading"><h2>Workout days</h2><span class="exercise-count">${templates.length} SAVED</span></div><div class="template-list">${templates.length ? templates.map(t => `<button type="button" class="template-item" data-action="select-template" data-id="${esc(value(t.id))}" aria-pressed="${t === selected}"><strong>${esc(value(t.title))}</strong><span>${(t.weekdays || []).map(d => days[d]).filter(Boolean).join(' · ') || 'No days assigned'} · ${(t.exercises || []).length} exercises</span></button>`).join('') : '<div class="training-empty"><h3>No workout days yet</h3><p>Create one to reuse throughout the week.</p></div>'}</div><button type="button" class="text-action new-template" data-action="select-template" data-id="">+ New workout day</button></div>
      <div class="panel template-editor"><div class="section-heading"><h2>${selected ? 'Edit workout day' : 'Create a new workout'}</h2>${selected ? `<button type="button" class="text-action" data-action="delete-template" data-id="${esc(value(selected.id))}">Delete</button>` : ''}</div><form data-form="save-template"${selected ? ` data-id="${esc(value(selected.id))}"` : ''}><label>Name<input name="title" required value="${esc(value(selected && selected.title))}" placeholder="e.g. Back Day"></label><fieldset><legend>Repeat on</legend><div class="weekday-picker">${days.map((day, i) => `<label><input type="checkbox" name="weekday" value="${i}"${weekdays.includes(i) ? ' checked' : ''}><span>${day}</span></label>`).join('')}</div></fieldset><button class="btn primary" type="submit">${selected ? 'Save workout' : 'Create workout'}</button></form>${selected ? `<div class="template-exercises"><div class="section-heading"><h2>Exercises</h2><span class="exercise-count">${(selected.exercises || []).length} TOTAL</span></div>${(selected.exercises || []).map(ex => `<div class="template-exercise"><strong>${esc(value(ex.name))}</strong><button type="button" class="icon-action" data-action="delete-template-exercise" data-id="${esc(value(selected.id))}" data-exercise="${esc(value(ex.id))}" aria-label="Remove ${esc(value(ex.name))}">×</button></div>`).join('')}<form class="template-add" data-form="add-template-exercise" data-id="${esc(value(selected.id))}"><label>Exercise name<input name="name" required placeholder="e.g. Lat pulldown"></label><button class="btn" type="submit">+ Add</button></form></div>` : ''}</div></div>`;
  };

  const runningView = function (ctx) {
    const {state, esc} = ctx;
    const {splitRunPace} = window.DaymarkSchedule;
    const types = state.runTypes || [];
    const selected = types.find(type => type.id === ctx.runTypeId);
    const pace = splitRunPace(selected?.pace);
    const [minutes, seconds] = pace || ['', ''];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdays = selected?.weekdays || [];
    const label = intensity => intensity === 'high' ? 'High intensity' : 'Low intensity';
    const runSummary = type => [
      (type.weekdays || []).map(day => days[day]).filter(Boolean).join(' · ') || 'No days assigned',
      `${type.distance} km`,
      type.pace && `${type.pace} min/km`,
      label(type.intensity)
    ].filter(Boolean).join(' · ');
    return `<div class="template-layout">
      <div>
        <div class="section-heading"><h2>Run types</h2></div>
        <div class="template-list">${types.length ? types.map(type => `<button type="button" class="template-item" data-action="select-run-type" data-id="${esc(type.id)}" aria-pressed="${type === selected}"><strong>${esc(type.title)}</strong><span>${esc(runSummary(type))}</span></button>`).join('') : '<div class="training-empty"><h3>No run types yet</h3><p>Create a run type to schedule it each week.</p></div>'}</div>
        ${selected ? '<button type="button" class="text-action new-template" data-action="select-run-type" data-id="">+ New run type</button>' : ''}
      </div>
      <div class="panel template-editor">
        <div class="section-heading"><h2>${selected ? 'Edit run type' : 'Create a run type'}</h2>${selected ? `<button type="button" class="text-action" data-action="delete-run-type" data-id="${esc(selected.id)}">Delete</button>` : ''}</div>
        <form data-form="save-run-type"${selected ? ` data-id="${esc(selected.id)}"` : ''}>
          <label>Name<input name="title" required value="${esc(selected?.title)}" placeholder="e.g. Easy run"></label>
          <label>Distance (km)<input name="distance" type="number" inputmode="decimal" min="0.01" step="any" required value="${esc(selected?.distance)}"></label>
          <fieldset class="run-pace">
            <legend>Pace goal (min/km, optional)</legend>
            ${selected?.pace && !pace ? `<p class="run-pace-current">Saved pace goal · ${esc(selected.pace)} min/km</p>` : ''}
            <div class="run-pace-fields">
              <label>Minutes<input name="paceMinutes" type="number" min="0" step="1" inputmode="numeric" value="${esc(minutes)}" placeholder="0"></label>
              <label>Seconds<input name="paceSeconds" type="number" min="0" max="59" step="1" inputmode="numeric" value="${esc(seconds)}" placeholder="00"></label>
            </div>
          </fieldset>
          <label>Intensity<select name="intensity"><option value="low">Low intensity</option><option value="high"${selected?.intensity === 'high' ? ' selected' : ''}>High intensity</option></select></label>
          <fieldset><legend>Repeat on</legend><div class="weekday-picker">${days.map((day, i) => `<label><input type="checkbox" name="weekday" value="${i}"${weekdays.includes(i) ? ' checked' : ''}><span>${day}</span></label>`).join('')}</div></fieldset>
          <button class="btn primary" type="submit">${selected ? 'Save run type' : 'Create run type'}</button>
        </form>
      </div>
    </div>`;
  };

  const progressView = function (ctx) {
    const {state, esc, pretty} = ctx;
    const groups = new Map();
    Object.entries(state.days || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, day]) => {
      ((day.workout || {}).exercises || []).forEach(ex => {
        const name = value(ex.name).trim();
        if (!name || ex.kind === 'cardio') return;
        const key = name.toLocaleLowerCase();
        if (!groups.has(key)) groups.set(key, {name, dates: new Map()});
        const group = groups.get(key);
        if (!group.dates.has(date)) group.dates.set(date, []);
        (ex.sets || []).forEach(set => group.dates.get(date).push(set));
      });
    });
    const options = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
    const recent = options.slice().sort((a, b) => {
      const latest = group => Array.from(group.dates).filter(([, sets]) => sets.some(set => num(set.weight) !== null || num(set.reps) !== null)).map(([date]) => date).sort().at(-1) || '';
      return latest(b).localeCompare(latest(a));
    });
    const selected = groups.get(value(ctx.progressExercise).trim().toLocaleLowerCase()) || recent[0];
    const records = selected ? Array.from(selected.dates, ([date, sets]) => {
      const weights = sets.map(s => num(s.weight)).filter(n => n !== null);
      const reps = sets.map(s => num(s.reps)).filter(n => n !== null);
      return {date, weight: weights.length ? Math.max(...weights) : null, reps: reps.length ? Math.max(...reps) : null, sets: sets.filter(set => num(set.weight) !== null || num(set.reps) !== null)};
    }).filter(record => record.sets.length) : [];
    const chart = (key, label, color) => {
      const points = records.filter(r => r[key] !== null);
      if (!points.length) return `<div class="chart-empty">No ${label.toLowerCase()} logged yet.</div>`;
      const max = Math.ceil(Math.max(1, ...points.map(r => r[key])) / 2) * 2;
      const timestamp = (date) => Date.parse(`${date}T00:00:00Z`);
      const start = timestamp(points[0].date);
      const end = timestamp(points.at(-1).date);
      const x = date => start === end ? 315 : 48 + (timestamp(date) - start) * 522 / (end - start);
      const y = v => 150 - (v / max) * 115;
      const coords = points.map(p => `${x(p.date)},${y(p[key])}`).join(' ');
      const ticks = [0, max / 2, max].map(tick => `<line x1="48" y1="${y(tick)}" x2="570" y2="${y(tick)}" class="chart-grid"/><text x="39" y="${y(tick) + 5}" text-anchor="end" fill="var(--muted)" font-size="16">${tick}</text>`).join('');
      return `<svg class="progress-chart" viewBox="0 0 600 175" role="img" aria-label="${label} over ${points.length} recorded ${points.length === 1 ? 'day' : 'days'}">${ticks}<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${points.map(p => `<circle cx="${x(p.date)}" cy="${y(p[key])}" r="6" fill="${color}"><title>${esc(pretty(p.date))}: ${p[key]}</title></circle>`).join('')}</svg><div class="chart-dates"><span>${esc(pretty(points[0].date))}</span><span>${points.length > 1 ? esc(pretty(points.at(-1).date)) : ''}</span></div>`;
    };
    const latest = records.slice().reverse().find(r => r.weight !== null || r.reps !== null);
    return `<div class="progress-view"><div class="progress-intro"><h2>Progress</h2>${options.length ? `<label class="progress-selector">Exercise<select data-change="progress-exercise">${options.map(o => `<option value="${esc(o.name)}"${o === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}</div>
      ${!selected ? '<div class="training-empty progress-empty"><h2>No progress yet</h2><p>Log sets for a strength exercise to see your progress.</p></div>' : `<div class="progress-summary"><div><span>TRACKING</span><strong>${esc(selected.name)}</strong></div><div><span>SESSIONS</span><strong>${records.length}</strong></div><div><span>LATEST MAX WEIGHT</span><strong>${latest ? prettyNum(latest.weight) : '—'}</strong></div><div><span>LATEST MAX REPS</span><strong>${latest ? prettyNum(latest.reps) : '—'}</strong></div></div><div class="chart-grid-wrap"><article class="panel chart-card"><div class="chart-title"><h2>Max weight</h2><span>PER SESSION</span></div>${chart('weight', 'Max weight', '#bd6248')}</article><article class="panel chart-card"><div class="chart-title"><h2>Max reps</h2><span>PER SESSION</span></div>${chart('reps', 'Max reps', '#617c6b')}</article></div><div class="history-heading"><h2>Session history</h2><span>MAXIMUMS PER DAY</span></div><div class="history-table-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Sets logged</th><th>Max weight</th><th>Max reps</th></tr></thead><tbody>${records.slice().reverse().map(r => `<tr><td>${esc(pretty(r.date))}</td><td>${r.sets.length}</td><td>${prettyNum(r.weight)}</td><td>${prettyNum(r.reps)}</td></tr>`).join('')}</tbody></table></div><p class="history-note">Maximum weight and reps may come from different sets. A dash means no value was logged.</p>`}</div>`;
  };

  views.training = function (ctx) {
    const active = ['templates', 'workout', 'running', 'progress'].includes(ctx.trainingView) ? ctx.trainingView : 'workout';
    const labels = {templates: 'Workout days', workout: 'Log workout', running: 'Running', progress: 'Progress'};
    return `<section class="training-view"><h1>Training</h1><nav class="training-tabs" aria-label="Training sections">${Object.entries(labels).map(([key, label]) => `<button type="button" data-action="training-view" data-view="${key}" aria-pressed="${active === key}">${label}</button>`).join('')}</nav>${active === 'templates' ? templatesView(ctx) : active === 'running' ? runningView(ctx) : active === 'progress' ? progressView(ctx) : workoutView(ctx)}</section>`;
  };
})();
