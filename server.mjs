import {createServer} from 'node:http';
import {randomInt, timingSafeEqual} from 'node:crypto';
import {readFileSync, renameSync, writeFileSync, mkdirSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const dataPath = resolve(process.env.DAYMARK_DATA_DIR || fileURLToPath(new URL('./.daymark-data/', import.meta.url)));
const dataFile = resolve(dataPath, 'planner.json');
const flags = process.argv.slice(2);
const lan = flags.includes('--lan');
const port = Number(process.env.DAYMARK_PORT || 4173);
const code = String(randomInt(100000, 1000000));
const isPrivate = (address) => /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address);
const interfaces = Object.values(networkInterfaces()).flat().filter(({family, internal, address}) => family === 'IPv4' && !internal && isPrivate(address));
const lanIp = process.env.DAYMARK_LAN_IP || interfaces[0]?.address;
if (lan && !interfaces.some(({address}) => address === lanIp)) throw new Error('No private Wi-Fi address found. Set DAYMARK_LAN_IP to this computer’s private IPv4 address.');
const localUrl = `http://127.0.0.1:${port}/`;
const lanUrl = lan ? `http://${lanIp}:${port}/` : '';
const types = {
  '/index.html':'text/html; charset=utf-8',
  '/app.js':'text/javascript; charset=utf-8', '/appearance.js':'text/javascript; charset=utf-8', '/calendar.js':'text/javascript; charset=utf-8',
  '/training.js':'text/javascript; charset=utf-8', '/tasks.js':'text/javascript; charset=utf-8', '/schedule.js':'text/javascript; charset=utf-8',
  '/style.css':'text/css; charset=utf-8', '/calendar.css':'text/css; charset=utf-8', '/training.css':'text/css; charset=utf-8', '/tasks.css':'text/css; charset=utf-8',
  '/manifest.webmanifest':'application/manifest+json', '/daymark-icon.svg':'image/svg+xml', '/lifesolver-icon-180.png':'image/png',
  '/geist.woff2':'font/woff2', '/geist-OFL.txt':'text/plain; charset=utf-8'
};
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...(lan ? [`${lanIp}:${port}`] : [])]);
const failedCodes = new Map();
let planner = {revision: 0, state: null, past: [], future: []};
try { planner = JSON.parse(readFileSync(dataFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

function send(res, status, type, body) {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
  res.end(body);
}

function json(res, status, body) { send(res, status, 'application/json', JSON.stringify(body)); }

function authorized(req, res) {
  const ip = req.socket.remoteAddress;
  const now = Date.now();
  const window = 60 * 1000;
  if (failedCodes.size > 80) for (const [address, record] of failedCodes) if (now - record.start >= window) failedCodes.delete(address);
  const record = failedCodes.get(ip);
  if (record && now - record.start < window && record.count >= 12) { json(res, 429, {error: 'Try again in a minute'}); return false; }
  const supplied = Buffer.from(req.headers['x-daymark-code'] || '');
  if (supplied.length !== code.length || !timingSafeEqual(supplied, Buffer.from(code))) {
    failedCodes.set(ip, record && now - record.start < window ? {...record, count: record.count + 1} : {start: now, count: 1});
    json(res, 401, {error: 'Pairing required'});
    return false;
  }
  failedCodes.delete(ip);
  return true;
}

function isPlanner(state) {
  return state && typeof state.days === 'object' && state.days !== null && !Array.isArray(state.days) && Array.isArray(state.tasks);
}

async function handle(req, res) {
  try {
    const host = req.headers.host;
    if (!allowedHosts.has(host) || req.headers.origin && req.headers.origin !== `http://${host}`) return json(res, 403, {error:'Invalid origin'});
    const path = new URL(req.url, localUrl).pathname;
    if (path === '/api/config' && req.method === 'GET') {
      const local = req.socket.localAddress === '127.0.0.1' && req.socket.remoteAddress === '127.0.0.1';
      return json(res, 200, local ? {host: true, code, url: lanUrl} : {host: false});
    }
    if (path === '/api/planner') {
      if (!authorized(req, res)) return;
      if (req.method === 'GET') return json(res, 200, planner);
      if (req.method !== 'PUT' || req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res, 405, {error:'Unsupported request'});
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8 * 1024 * 1024) return json(res, 413, {error:'Planner is too large'});
      }
      let requested;
      try { requested = JSON.parse(body); } catch { return json(res, 400, {error:'Invalid JSON'}); }
      if (!isPlanner(requested?.state) || ![requested.past, requested.future].every((entries) => Array.isArray(entries) && entries.length <= 25 && entries.every((entry) => isPlanner(entry.state)))) return json(res, 400, {error:'Invalid planner'});
      if (requested.revision !== planner.revision) return json(res, 409, planner);
      const next = {revision: planner.revision + 1, state: requested.state, past: requested.past, future: requested.future};
      mkdirSync(dataPath, {recursive: true, mode: 0o700});
      writeFileSync(`${dataFile}.tmp`, JSON.stringify(next), {mode: 0o600});
      renameSync(`${dataFile}.tmp`, dataFile);
      planner = next;
      return json(res, 200, {revision: planner.revision});
    }
    const resource = path === '/' ? '/index.html' : path;
    if (req.method !== 'GET' || !Object.hasOwn(types, resource)) return json(res, 404, {error:'Not found'});
    return send(res, 200, types[resource], readFileSync(resolve(publicDirectory, resource.slice(1))));
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) json(res, 500, {error:'Server error'});
  }
}

createServer(handle).listen(port, '127.0.0.1', () => console.log(`Computer: ${localUrl}`));
if (lan) createServer(handle).listen(port, lanIp, () => console.log(`iPhone on this Wi-Fi: ${lanUrl}\nPairing code: open ${localUrl}api/config on this computer.`));
