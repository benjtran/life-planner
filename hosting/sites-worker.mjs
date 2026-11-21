const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'},
});

const empty = () => ({revision: 0, state: {days: {}, tasks: []}, past: [], future: []});
const validState = state => state?.days && typeof state.days === 'object' && !Array.isArray(state.days) && Array.isArray(state.tasks);
const validHistory = entries => Array.isArray(entries) && entries.length <= 25 && entries.every(entry => validState(entry?.state));
const sizeLimit = 1_500_000;

async function readPlanner(db, user) {
  const row = await db.prepare('SELECT revision, payload FROM planners WHERE user_id = ?').bind(user).first();
  return row ? {revision: row.revision, ...JSON.parse(row.payload)} : empty();
}

export function createHostedHandler(assets) {
  return {
    async fetch(request, env) {
      const {pathname} = new URL(request.url);
      // Sites' authenticated ingress supplies this stable ID and enforces the private audience.
      const user = request.headers.get('oai-authenticated-user-id');
      if (!user) return json({error: 'Sign-in required'}, 401);

      if (pathname === '/api/planner') {
        if (request.method === 'GET') return json(await readPlanner(env.DB, user));
        if (request.method !== 'PUT') return json({error: 'Method not allowed'}, 405);
        if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({error: 'Invalid request'}, 403);
        if (Number(request.headers.get('Content-Length')) > sizeLimit) return json({error: 'Planner is too large'}, 413);
        const text = await request.text();
        if (new TextEncoder().encode(text).length > sizeLimit) return json({error: 'Planner is too large'}, 413);
        let payload;
        try { payload = JSON.parse(text); } catch { return json({error: 'Invalid JSON'}, 400); }
        const {revision, state, past, future} = payload || {};
        if (!Number.isSafeInteger(revision) || revision < 0 || !validState(state) || !validHistory(past) || !validHistory(future)) return json({error: 'Invalid planner'}, 400);

        const nextRevision = revision + 1;
        const stored = JSON.stringify({state, past, future});
        const updated = revision === 0
          ? await env.DB.prepare('INSERT INTO planners (user_id, revision, payload) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision').bind(user, nextRevision, stored).first()
          : await env.DB.prepare('UPDATE planners SET revision = ?, payload = ? WHERE user_id = ? AND revision = ? RETURNING revision').bind(nextRevision, stored, user, revision).first();
        return updated ? json(updated) : json(await readPlanner(env.DB, user), 409);
      }

      const asset = assets[pathname === '/' ? '/index.html' : pathname];
      if (!asset || !['GET', 'HEAD'].includes(request.method)) return json({error: 'Not found'}, 404);
      return new Response(request.method === 'HEAD' ? null : asset.body, {headers: {
        'Content-Type': asset.type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'",
      }});
    },
  };
}
