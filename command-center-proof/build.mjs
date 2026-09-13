import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const destination = process.argv[2];
if (!destination) throw new Error('Pass an isolated Site staging directory');
const root = new URL('.', import.meta.url);
const [context, page, worker, browser] = await Promise.all(['context.mjs', 'page.mjs', 'worker.mjs', 'browser.mjs'].map(f => readFile(new URL(f, root), 'utf8')));
// Explicit source allowlist. Never copy Hub routes, fixtures, env files or data.
const bundle = context.replace(/export /g, '') + '\n' + page.replace('export ', '') + '\n' +
  'const browserSource = ' + JSON.stringify(browser) + ';\n' +
  worker.replace(/^import .*\n/gm, '').replaceAll("env.PROOF_BROWSER_SOURCE", 'browserSource');
await mkdir(resolve(destination, 'dist/server'), { recursive: true });
await writeFile(resolve(destination, 'dist/server/index.js'), bundle);
await writeFile(resolve(destination, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
console.log('Built synthetic Worker only; owner binding remains required.');
