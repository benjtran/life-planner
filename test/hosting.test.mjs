import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createHostedHandler} from '../hosting/sites-worker.mjs';

const worker = createHostedHandler({'/index.html': {type: 'text/html', body: 'Daymark'}});
const request = (path, user, options = {}) => new Request(`https://daymark.example${path}`, {
  ...options,
  headers: {...options.headers, ...(user ? {'oai-authenticated-user-id': user} : {})},
});

test('hosted pages and planner require a signed-in user', async () => {
  for (const path of ['/', '/api/planner']) assert.equal((await worker.fetch(request(path))).status, 401);
  assert.equal(await (await worker.fetch(request('/', 'owner'))).text(), 'Daymark');
});

test('the hosted store isolates accounts and rejects stale edits', async (t) => {
  let DatabaseSync;
  try { ({DatabaseSync} = await import('node:sqlite')); }
  catch { return t.skip('This Node version has no SQLite module'); }
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../drizzle/0000_planners.sql', import.meta.url), 'utf8'));
  const env = {DB: {prepare: sql => ({bind: (...args) => ({first: async () => db.prepare(sql).get(...args)})})}};
  const get = async user => (await worker.fetch(request('/api/planner', user), env)).json();
  const put = (user, revision) => worker.fetch(request('/api/planner', user, {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({revision, state: {days: {}, tasks: [{id: 'task'}]}, past: [], future: []}),
  }), env);

  assert.equal((await get('owner')).revision, 0);
  const saves = await Promise.all([put('owner', 0), put('owner', 0)]);
  assert.deepEqual(saves.map(response => response.status).sort(), [200, 409]);
  assert.equal((await get('owner')).state.tasks.length, 1);
  assert.equal((await get('other')).state.tasks.length, 0);
  assert.equal((await put('owner', 1)).status, 200);
  assert.equal((await get('owner')).revision, 2);
});
