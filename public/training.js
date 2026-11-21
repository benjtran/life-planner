(function () {
  'use strict';
  const views = window.DaymarkViews = window.DaymarkViews || {};
  const value = x => x == null ? '' : String(x);
  const num = x => x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);
  const prettyNum = x => x == null ? '—' : String(x);

  views.training = function (ctx) {
    const {state, date, today, esc, pretty} = ctx;
    const day = (state.days || {})[date] || {};
    const workout = day.workout || {};
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const exerciseCard = (exercise, index) => {
      const id = esc(value(exercise.id));
      const name = esc(value(exercise.name) || 'Untitled exercise');
      const cardio = exercise.kind === 'cardio';
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      return `<article class="training-exercise"><div class="exercise-heading"><div><span class="exercise-number">${String(index + 1).padStart(2, '0')}</span><span class="exercise-type">${cardio ? 'Cardio' : 'Strength'}</span><h3>${name}</h3></div><button class="icon-action" type="button" data-action="delete-exercise" data-id="${id}" aria-label="Delete ${name}">×</button></div>
        ${cardio ? `<form class="cardio-entry" data-form="save-cardio" data-id="${id}"><label>Duration <span class="unit">min</span><input type="number" min="0" step="any" name="minutes" value="${esc(value(exercise.minutes))}" placeholder="—"></label><button class="btn" type="submit">Save</button></form>` : `<div class="set-heading"><span>Set</span><span>Reps</span><span>Weight</span><span></span><span></span></div><div class="sets">${sets.map((set, i) => `<form class="set-row" data-form="save-set" data-id="${id}" data-index="${i}"><span class="set-index">${String(i + 1).padStart(2, '0')}</span><label><span class="sr-only">Set ${i + 1} reps</span><input type="number" min="0" step="any" name="reps" value="${esc(value(set.reps))}" placeholder="—"></label><label><span class="sr-only">Set ${i + 1} weight</span><input type="number" min="0" step="any" name="weight" value="${esc(value(set.weight))}" placeholder="—"></label><button class="save-set" type="submit">Save</button><button class="icon-action" type="button" data-action="delete-set" data-id="${id}" data-index="${i}" aria-label="Delete set ${i + 1}">×</button></form>`).join('')}</div><div class="exercise-footer"><button class="text-action" type="button" data-action="add-set" data-id="${id}">+ Add set</button><button class="text-action" type="button" data-action="progress-exercise" data-exercise="${name}">View progress ↗</button></div>`}
      </article>`;
    };
    return `<section class="training-view"><div class="training-intro"><div><p class="eyebrow">MOVE WITH INTENTION</p><h1>Training</h1><p class="muted">A little stronger, one session at a time.</p></div><div class="training-date"><label for="training-date">SESSION DATE</label><input id="training-date" type="date" data-change="date" value="${esc(date)}" aria-label="Session date"><span>${esc(pretty(date))}${date === today ? ' · Today' : ''}</span></div></div>
      <div class="training-layout"><div class="training-main"><div class="section-heading"><div><p class="eyebrow">YOUR SESSION</p><h2>${exercises.length ? 'The workout' : 'Start your session'}</h2></div><span class="exercise-count">${exercises.length} ${exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</span></div>
      <form class="panel workout-details" data-form="workout-title"><label>Workout name<input name="title" value="${esc(value(workout.title))}" placeholder="e.g. Upper body strength"></label><label>Cardio notes<input name="cardio" value="${esc(value(day.cardio))}" placeholder="e.g. Easy walk, 20 min"></label><button class="btn" type="submit">Save details</button></form>
      <div class="exercise-list">${exercises.length ? exercises.map(exerciseCard).join('') : '<div class="training-empty"><span class="empty-icon">↗</span><h3>Make space to move.</h3><p>Add your first exercise to start building today’s session.</p></div>'}</div></div>
      <aside class="training-aside"><div class="panel add-exercise"><p class="eyebrow">BUILD YOUR SESSION</p><h2>Add an exercise</h2><p class="muted">Log strength work or time spent moving.</p><form data-form="add-exercise"><label>Exercise name<input name="name" required placeholder="e.g. Goblet squat"></label><label>Type<select name="kind"><option value="strength">Strength</option><option value="cardio">Cardio</option></select></label><button class="btn primary" type="submit">+ Add exercise</button></form></div><div class="training-note"><span>✳</span><p>Showing up is progress.<br><strong>Keep your own pace.</strong></p></div></aside></div></section>`;
  };

  views.progress = function (ctx) {
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
    const selected = groups.get(value(ctx.progressExercise).trim().toLocaleLowerCase()) || options[0];
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
    return `<section class="progress-view"><div class="progress-intro"><div><p class="eyebrow">THE LONG GAME</p><h1>Your progress</h1><p class="muted">Small steps add up. Take a look at how far you’ve come.</p></div>${options.length ? `<label class="progress-selector">EXERCISE<select data-change="progress-exercise">${options.map(o => `<option value="${esc(o.name)}"${o === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}</div>
      ${!selected ? '<div class="training-empty progress-empty"><span class="empty-icon">↗</span><h2>Your story starts here.</h2><p>Log a strength exercise in Training to see your progress over time.</p></div>' : `<div class="progress-summary"><div><span>TRACKING</span><strong>${esc(selected.name)}</strong></div><div><span>SESSIONS</span><strong>${records.length}</strong></div><div><span>LATEST MAX WEIGHT</span><strong>${latest ? prettyNum(latest.weight) : '—'}</strong></div><div><span>LATEST MAX REPS</span><strong>${latest ? prettyNum(latest.reps) : '—'}</strong></div></div><div class="chart-grid-wrap"><article class="panel chart-card"><div class="chart-title"><div><p class="eyebrow">GETTING STRONGER</p><h2>Max weight</h2></div><span>PER SESSION</span></div>${chart('weight', 'Max weight', '#bd6248')}</article><article class="panel chart-card"><div class="chart-title"><div><p class="eyebrow">BUILDING MOMENTUM</p><h2>Max reps</h2></div><span>PER SESSION</span></div>${chart('reps', 'Max reps', '#617c6b')}</article></div><div class="history-heading"><div><p class="eyebrow">THE DETAILS</p><h2>Session history</h2></div><span>MAXIMUMS PER DAY</span></div><div class="history-table-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Sets logged</th><th>Max weight</th><th>Max reps</th></tr></thead><tbody>${records.slice().reverse().map(r => `<tr><td>${esc(pretty(r.date))}</td><td>${r.sets.length}</td><td>${prettyNum(r.weight)}</td><td>${prettyNum(r.reps)}</td></tr>`).join('')}</tbody></table></div><p class="history-note">Maximum weight and reps may come from different sets. A dash means no value was logged.</p>`}</section>`;
  };
})();
