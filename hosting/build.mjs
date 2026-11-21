import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = new URL('public/', root);
const output = new URL('dist/server/', root);
const types = {html: 'text/html', js: 'text/javascript', css: 'text/css', webmanifest: 'application/manifest+json', svg: 'image/svg+xml'};
const assets = {};
for (const name of await readdir(files)) {
  const mime = types[name.split('.').pop()];
  if (!mime) continue;
  let body = await readFile(new URL(name, files), 'utf8');
  if (name === 'index.html') body = body.replace('<head>', '<head>\n  <meta name="daymark-hosted" content="true">');
  assets[`/${name}`] = {type: `${mime}; charset=utf-8`, body};
}
const worker = await readFile(new URL('sites-worker.mjs', import.meta.url), 'utf8');
await mkdir(output, {recursive: true});
await writeFile(new URL('index.js', output), `${worker}\nexport default createHostedHandler(${JSON.stringify(assets)});\n`);
