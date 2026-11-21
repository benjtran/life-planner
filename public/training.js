(function () {
  'use strict';
  const views = window.DaymarkViews = window.DaymarkViews || {};
  const value = x => x == null ? '' : String(x);
  const num = x => x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);

  function workoutView(ctx) {
    const {date, today, esc} = ctx;
    const workout = ctx.workoutFor(date);
    const {title, exercises} = workout;
    const scheduled = Boolean(title || exercises.length);
    const completed = Boolean(ctx.itemsFor(date).find(item => item.kind === 'workout')?.done);

    function exerciseCard(exercise) {
      const id = esc(exercise.id);
      const name = esc(exercise.name || 'Untitled exercise');
      const sets = exercise.sets || [];
      return `<article class="training-exercise">
        <h3>${name}</h3>
        ${exercise.kind === 'cardio'
          ? `<form class="cardio-entry" data-form="save-cardio" data-id="${id}"><label>Duration (min)<input type="number" inputmode="decimal" min="0" step="any" name="minutes" value="${esc(exercise.minutes)}"></label></form>`
          : `${sets.length ? `<div class="set-heading" aria-hidden="true"><span>Set</span><span>Reps</span><span>Weight</span></div>` : ''}
            <div class="sets">${sets.map((set, index) => `<form class="set-row" data-form="save-set" data-id="${id}" data-index="${index}">
              <span class="set-index">${index + 1}</span>
              <input type="number" inputmode="numeric" enterkeyhint="next" min="0" step="any" name="reps" aria-label="${name}, set ${index + 1} reps" value="${esc(set.reps)}">
              <input type="number" inputmode="decimal" min="0" step="any" name="weight" aria-label="${name}, set ${index + 1} weight" value="${esc(set.weight)}">
              <button class="icon-action" type="button" data-action="delete-set" data-id="${id}" data-index="${index}" aria-label="Remove ${name} set ${index + 1}">×</button>
            </form>`).join('')}</div>
            <button class="btn add-set" type="button" data-action="add-set" data-id="${id}" aria-label="Add set for ${name}">+ Add set</button>`}
      </article>`;
    }

    return `<div class="workout-session">
      <div class="session-heading">
        <div><h2>${esc(title || (scheduled ? 'Workout' : 'No workout scheduled'))}</h2>${completed ? '<p class="session-status">✓ Completed</p>' : ''}</div>
        <div class="session-date">
          <label>Session date<input id="training-date" type="date" data-change="workout-date" value="${esc(date)}"></label>
          ${date === today ? '' : '<button class="btn" type="button" data-action="workout-today">Today</button>'}
        </div>
      </div>
      ${exercises.length ? `<div class="exercise-list">${exercises.map(exerciseCard).join('')}</div>` :
        `<div class="training-empty session-empty">${scheduled ? '<p>No exercises scheduled for this workout.</p>' : ''}<button class="btn" type="button" data-action="training-view" data-view="templates">Go to Workout days</button></div>`}
      ${scheduled ? `<div class="workout-actions">
        ${exercises.length ? `<button class="btn" type="button" data-action="save-workout-progress">${completed ? 'Save changes' : 'Save progress'}</button>` : ''}
        ${completed ? '<button class="btn primary" type="button" data-action="view-workout-task">View completed task</button>' :
          '<button class="btn primary" type="button" data-action="finish-workout">Finish workout</button>'}
      </div>` : ''}
    </div>`;
  }

  function templateExerciseRow(esc, templateId, exercise) {
    const name = esc(exercise.name);
    const attributes = `data-id="${esc(templateId)}" data-exercise="${esc(exercise.id)}"`;
    return `<div class="template-exercise">
      <strong>${name}</strong>
      <div class="template-exercise-actions">
        <button class="btn" type="button" data-action="edit-template-exercise" ${attributes} aria-label="Rename ${name}">Rename</button>
        <button class="btn danger-text" type="button" data-action="delete-template-exercise" ${attributes} aria-label="Remove ${name}">Remove</button>
      </div>
      <form class="template-rename" data-form="rename-template-exercise" ${attributes} hidden>
        <label>Exercise name<input name="name" value="${name}" required></label>
        <div class="template-exercise-actions">
          <button class="btn primary" type="submit">Save name</button>
          <button class="btn" type="button" data-action="cancel-exercise-rename">Cancel</button>
        </div>
      </form>
    </div>`;
  }

  const templatesView = function (ctx) {
    const {state, esc} = ctx;
    const templates = state.templates || [];
    const selected = templates.find(t => t.id === ctx.templateId);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdays = selected && Array.isArray(selected.weekdays) ? selected.weekdays : [];
    return `<div class="template-layout"><div><div class="section-heading"><h2>Workout days</h2><span class="exercise-count">${templates.length} SAVED</span></div><div class="template-list">${templates.length ? templates.map(t => `<button type="button" class="template-item" data-action="select-template" data-id="${esc(value(t.id))}" aria-pressed="${t === selected}"><strong>${esc(value(t.title))}</strong><span>${(t.weekdays || []).map(d => days[d]).filter(Boolean).join(' · ') || 'No days assigned'} · ${(t.exercises || []).length} exercises</span></button>`).join('') : '<div class="training-empty"><h3>No workout days yet</h3><p>Create one to reuse throughout the week.</p></div>'}</div><button type="button" class="text-action new-template" data-action="select-template" data-id="">+ New workout day</button></div>
      <div class="panel template-editor"><div class="section-heading"><h2>${selected ? 'Edit workout day' : 'Create a new workout'}</h2>${selected ? `<button type="button" class="text-action" data-action="delete-template" data-id="${esc(value(selected.id))}">Delete</button>` : ''}</div><form data-form="save-template"${selected ? ` data-id="${esc(value(selected.id))}"` : ''}><label>Name<input name="title" required value="${esc(value(selected && selected.title))}" placeholder="e.g. Back Day"></label><fieldset><legend>Repeat on</legend><div class="weekday-picker">${days.map((day, i) => `<label><input type="checkbox" name="weekday" value="${i}"${weekdays.includes(i) ? ' checked' : ''}><span>${day}</span></label>`).join('')}</div></fieldset><button class="btn primary" type="submit">${selected ? 'Save workout' : 'Create workout'}</button></form>${selected ? `<div class="template-exercises"><div class="section-heading"><h2>Exercises</h2><span class="exercise-count">${(selected.exercises || []).length} TOTAL</span></div>${(selected.exercises || []).map(exercise => templateExerciseRow(esc, selected.id, exercise)).join('')}<form class="template-add" data-form="add-template-exercise" data-id="${esc(value(selected.id))}"><label>Exercise name<input name="name" required placeholder="e.g. Lat pulldown"></label><button class="btn" type="submit">+ Add</button></form></div>` : ''}</div></div>`;
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
          <label>Name<input name="title" required enterkeyhint="next" value="${esc(selected?.title)}" placeholder="e.g. Easy run"></label>
          <label>Distance (km)<input name="distance" type="number" inputmode="decimal" enterkeyhint="next" min="0.01" step="any" required value="${esc(selected?.distance)}"></label>
          <fieldset class="run-pace">
            <legend>Pace goal (min/km, optional)</legend>
            ${selected?.pace && !pace ? `<p class="run-pace-current">Saved pace goal · ${esc(selected.pace)} min/km</p>` : ''}
            <div class="run-pace-fields">
              <label>Minutes<input name="paceMinutes" type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" value="${esc(minutes)}" placeholder="0"></label>
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

  const progressMetrics = {weight: 'Weight', reps: 'Reps', volume: 'Volume'};
  const averageNumber = new Intl.NumberFormat('en', {maximumFractionDigits: 2});
  const axisNumber = new Intl.NumberFormat('en', {maximumSignificantDigits: 12});
  const shortProgressDate = new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric'});
  const displayAverage = number => number === null ? '—' : averageNumber.format(number);

  function progressExercises(days) {
    const groups = new Map();
    for (const [date, day] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
      for (const exercise of day.workout?.exercises || []) {
        const name = value(exercise.name).trim();
        if (!name || exercise.kind === 'cardio') continue;
        const key = name.toLocaleLowerCase();
        if (!groups.has(key)) groups.set(key, {name, dates: new Map()});
        const dates = groups.get(key).dates;
        if (!dates.has(date)) dates.set(date, []);
        dates.get(date).push(...(exercise.sets || []));
      }
    }
    return [...groups.values()].flatMap(({name, dates}) => {
      const records = [];
      for (const [date, entries] of dates) {
        const sets = entries.flatMap((set, index) => {
          const weight = num(set.weight);
          const reps = num(set.reps);
          if (weight === null && reps === null) return [];
          const volume = weight === null || reps === null ? null : num(weight * reps);
          return [{index: index + 1, weight, reps, volume}];
        });
        if (sets.length) records.push({date, sets});
      }
      return records.length ? [{name, records}] : [];
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function averageFor(sets, metric) {
    const measured = sets.filter(set => set[metric] !== null);
    return measured.length ? measured.reduce((sum, set) => sum + set[metric] / measured.length, 0) : null;
  }

  function progressAxis(values) {
    const min = values.reduce((lowest, n) => Math.min(lowest, n), Infinity);
    const max = values.reduce((highest, n) => Math.max(highest, n), -Infinity);
    const pad = max === min ? Math.max(Math.abs(max) * .05, 1) : (max - min) * .08;
    const bottom = min >= 0 ? Math.max(0, min - pad) : min - pad;
    const top = max + pad;
    const rawStep = (top - bottom) / 8;
    const power = 10 ** Math.floor(Math.log10(rawStep));
    const step = power * [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(n => n * power >= rawStep);
    const first = Math.floor(bottom / step);
    const last = Math.ceil(top / step);
    const ticks = Array.from({length: last - first + 1}, (_, index) => (first + index) * step);
    return {ticks, y: n => (1 - (n / step - first) / (last - first)) * 100};
  }

  function progressChart(ctx, selection, metric) {
    const {esc, pretty} = ctx;
    const {name, records} = selection;
    const sessions = records.map(record => ({date: record.date, sets: record.sets.filter(set => set[metric] !== null), mean: averageFor(record.sets, metric)}));
    const values = sessions.flatMap(day => day.sets.map(set => set[metric]));
    if (!values.length) {
      const hint = metric === 'volume' ? 'Log both weight and reps in the same set to see volume.' : `No ${progressMetrics[metric].toLowerCase()} logged for ${name}.`;
      return `<p class="chart-empty">${esc(hint)}</p>`;
    }

    const {ticks, y} = progressAxis(values);
    const step = 100 / sessions.length;
    const trend = sessions.flatMap((day, index) => day.mean === null ? [] : [`${(index + .5) * step},${y(day.mean)}`]).join(' ');
    const slotWidth = Math.max(86, ...records.map(day => day.sets.length * 18 + 40));
    const otherMetrics = ['weight', 'reps'].filter(key => key !== metric);
    const point = (date, label, number, mean, offset = 0, set = null) => {
      const dateLabel = pretty(date);
      const reading = mean ? displayAverage(number) : metric === 'volume' ? axisNumber.format(number) : number;
      const readings = [`${progressMetrics[metric]} ${reading}`];
      for (const key of otherMetrics) {
        if (set && set[key] !== null) readings.push(`${progressMetrics[key]} ${set[key]}`);
      }
      const metricValue = readings.join(' · ');
      return `<button type="button" class="chart-point ${mean ? 'chart-point-mean' : 'chart-point-set'}"
        style="--point-y:${y(number)}%; --point-offset:${offset}px" data-chart-point data-point-date="${esc(dateLabel)}"
        data-point-label="${label}" data-point-value="${esc(metricValue)}"
        aria-label="${esc(`${dateLabel}, ${label}, ${metricValue}`)}"></button>`;
    };

    return `<div class="chart-frame">
      <div class="chart-axis" aria-hidden="true"><div class="chart-axis-scale">${ticks.map(tick => `<span style="--tick:${y(tick)}%">${axisNumber.format(tick)}</span>`).join('')}</div></div>
      <div class="chart-scroll" data-chart-exercise="${esc(name)}" tabindex="0" role="region" aria-label="Workout dates">
        <div class="chart-plot" style="--chart-min-width:${sessions.length * slotWidth}px">
          <div class="chart-gridlines" aria-hidden="true">${ticks.map(tick => `<i style="--tick:${y(tick)}%"></i>`).join('')}</div>
          <svg class="chart-trend" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${trend}" vector-effect="non-scaling-stroke"/></svg>
          <div class="chart-sessions">
            ${sessions.map(({date, sets, mean}) => `<div class="chart-session">
              <div class="chart-session-plot">
                ${mean !== null ? point(date, `Daily average · ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`, mean, true) : ''}
                ${sets.map((set, index) => point(date, `Set ${set.index}`, set[metric], false, (index % 2 === 0 ? -1 : 1) * (13 + 18 * Math.floor(index / 2)), set)).join('')}
              </div>
              <time class="chart-date" datetime="${esc(date)}">${esc(shortProgressDate.format(new Date(`${date}T12:00:00`)))}<small>${esc(date.slice(0, 4))}</small></time>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="chart-tooltip" hidden aria-hidden="true"><strong></strong><span></span><b></b></div>
    </div>`;
  }

  function progressHistory(ctx, records, metric) {
    const {esc, pretty} = ctx;
    const showVolume = metric === 'volume';
    return `<section class="progress-history" aria-labelledby="progress-history-title">
      <h2 id="progress-history-title">Session history</h2>
      <div class="history-table-wrap"><table class="history-table">
        <thead><tr><th scope="col">Date</th><th scope="col">Sets</th><th scope="col">Avg. weight</th><th scope="col">Avg. reps</th>${showVolume ? '<th scope="col">Avg. volume</th>' : ''}</tr></thead>
        <tbody>${records.slice().reverse().map(({date, sets}) => `<tr>
          <th scope="row">${esc(pretty(date))}</th>
          <td><details><summary aria-label="${esc(`View ${sets.length} ${sets.length === 1 ? 'set' : 'sets'} on ${pretty(date)}`)}">${sets.length} ${sets.length === 1 ? 'set' : 'sets'}</summary>
            <ul class="history-sets" role="list">${sets.map(set => `<li><strong>Set ${set.index}</strong><span>${set.weight === null ? 'Weight —' : `Weight ${set.weight}`}</span><span>${set.reps === null ? 'Reps —' : `Reps ${set.reps}`}</span></li>`).join('')}</ul>
          </details></td>
          <td>${displayAverage(averageFor(sets, 'weight'))}</td><td>${displayAverage(averageFor(sets, 'reps'))}</td>
          ${showVolume ? `<td>${displayAverage(averageFor(sets, 'volume'))}</td>` : ''}
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }

  function progressView(ctx) {
    const {esc} = ctx;
    const options = progressExercises(ctx.state.days || {});
    const selected = options.find(option => option.name.toLocaleLowerCase() === ctx.progressExercise.toLocaleLowerCase())
      || options.reduce((latest, option) => !latest || option.records.at(-1).date > latest.records.at(-1).date ? option : latest, null);
    if (!selected) return '<div class="training-empty"><h2>No progress yet</h2><p>Log sets for a strength exercise to see your progress.</p></div>';

    const metric = ctx.progressMetric || (selected.records.some(day => day.sets.some(set => set.weight !== null)) ? 'weight' : 'reps');
    const chartNote = metric === 'volume'
      ? 'Set volume is weight × reps. The daily average includes sets with both values recorded.'
      : `Each daily average uses the sets with a ${progressMetrics[metric].toLowerCase()} value recorded that day.`;
    return `<div class="progress-view">
      <div class="progress-intro"><h2>Progress</h2><label class="progress-selector">Exercise<select data-change="progress-exercise">${options.map(option => `<option value="${esc(option.name)}"${option === selected ? ' selected' : ''}>${esc(option.name)}</option>`).join('')}</select></label></div>
      <article class="panel chart-card" aria-labelledby="progress-chart-title">
        <div class="chart-heading">
          <h3 id="progress-chart-title">${esc(selected.name)}</h3>
          <div class="segmented" role="group" aria-label="Chart metric">${Object.entries(progressMetrics).map(([key, label]) => `<button type="button" data-action="progress-metric" data-metric="${key}" aria-pressed="${metric === key}">${label}</button>`).join('')}</div>
        </div>
        <div class="chart-legend"><span><i class="legend-mean"></i>Daily average</span><span><i class="legend-set"></i>Individual sets</span></div>
        ${progressChart(ctx, selected, metric)}
        <p class="history-note">${chartNote}</p>
      </article>
      ${progressHistory(ctx, selected.records, metric)}
    </div>`;
  }

  views.training = function (ctx) {
    const active = ['templates', 'workout', 'running', 'progress'].includes(ctx.trainingView) ? ctx.trainingView : 'workout';
    const labels = {workout: 'Log workout', templates: 'Workout days', running: 'Running', progress: 'Progress'};
    return `<section class="training-view"><h1>Training</h1><nav class="training-tabs" aria-label="Training sections">${Object.entries(labels).map(([key, label]) => `<button type="button" data-action="training-view" data-view="${key}" aria-pressed="${active === key}">${label}</button>`).join('')}</nav>${active === 'templates' ? templatesView(ctx) : active === 'running' ? runningView(ctx) : active === 'progress' ? progressView(ctx) : workoutView(ctx)}</section>`;
  };
})();
