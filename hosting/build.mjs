import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = new URL('public/', root);
const output = new URL('dist/server/', root);
const types = {html: 'text/html', js: 'text/javascript', css: 'text/css', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', txt: 'text/plain', woff2: 'font/woff2', png: 'image/png'};
const binaryTypes = new Set(['png', 'woff2']);
const assets = {};
for (const name of await readdir(files)) {
  const extension = name.split('.').pop();
  const mime = types[extension];
  if (!mime) continue;
  if (binaryTypes.has(extension)) {
    assets[`/${name}`] = {type: mime, base64: await readFile(new URL(name, files), 'base64')};
    continue;
  }
  let body = await readFile(new URL(name, files), 'utf8');
  if (name === 'index.html') body = body.replace('<head>', '<head>\n  <meta name="daymark-hosted" content="true">');
  assets[`/${name}`] = {type: `${mime}; charset=utf-8`, body};
}
const worker = await readFile(new URL('sites-worker.mjs', import.meta.url), 'utf8');
await mkdir(output, {recursive: true});
await writeFile(new URL('index.js', output), `${worker}\nexport default createHostedHandler(${JSON.stringify(assets)});\n`);
