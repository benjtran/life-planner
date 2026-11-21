import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

const project = new URL('../', import.meta.url);

test('browser scripts parse', async () => {
  const publicDirectory = new URL('public/', project);
  const scripts = (await readdir(publicDirectory)).filter((file) => file.endsWith('.js'));
  assert.ok(scripts.length > 0);
  for (const file of scripts) {
    new Script(await readFile(new URL(file, publicDirectory), 'utf8'), {filename: file});
  }
});

test('planner serves the app, requires a code, and persists only current revisions', {timeout: 8000}, async (t) => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const {port} = probe.address();
  await new Promise((resolve) => probe.close(resolve));

  const directory = await mkdtemp(join(tmpdir(), 'daymark-test-'));
  const processArgs = ['server.mjs'];
  const child = spawn(process.execPath, processArgs, {
    cwd: fileURLToPath(project),
    env: {...process.env, DAYMARK_PORT: String(port), DAYMARK_DATA_DIR: directory},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const completed = once(child, 'exit');
  t.after(async () => {
    child.kill();
    await completed;
    await rm(directory, {recursive: true, force: true});
  });
  const [ready] = await Promise.race([
    once(child.stdout, 'data'),
    once(child.stderr, 'data').then(([message]) => { throw new Error(String(message)); }),
    completed.then(([status]) => { throw new Error(`Planner exited with status ${status}`); }),
  ]);
  assert.match(String(ready), /Computer:/);

  const base = `http://127.0.0.1:${port}/`;
  assert.match(await (await fetch(base)).text(), /LifeSolver/);
  const asset = await fetch(`${base}app.js`);
  assert.equal(asset.status, 200);
  await asset.text();
  const endpoint = `${base}api/planner`;
  assert.equal((await fetch(endpoint)).status, 401);

  const {code} = await (await fetch(`${base}api/config`)).json();
  assert.match(code, /^\d{6}$/);
  const headers = {'X-Daymark-Code': code, 'Content-Type': 'application/json'};
  const state = {days: {}, tasks: [{id: 'demo', title: 'Pack lunch', due: '', done: false}]};
  const payload = {revision: 0, state, past: [], future: []};
  const commit = (body) => fetch(endpoint, {method: 'PUT', headers, body: JSON.stringify(body)});
  assert.equal((await commit(payload)).status, 200);
  const submitted = await (await fetch(endpoint, {headers})).json();
  assert.equal(submitted.revision, 1);
  assert.deepEqual(submitted.state, state);
  assert.equal((await commit(payload)).status, 409);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'planner.json'), 'utf8')), submitted);
});
