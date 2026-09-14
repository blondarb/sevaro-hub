import { readFile, mkdir, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const destination = process.argv[2];
if (!destination) throw new Error('Pass an isolated Site staging directory');
const root = new URL('.', import.meta.url);
const exclusiveWrite = (path, value) => writeFile(path, value, {flag:'wx',mode:0o600});
// Refuse existing destinations and any repository ancestor, including symlink aliases.
const parent = await realpath(dirname(resolve(destination)));
for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
  let tracked = false; try { await lstat(resolve(ancestor, '.git')); tracked = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (tracked) throw new Error('Site staging must be outside a repository');
  if (ancestor === dirname(ancestor)) break;
}
await mkdir(resolve(parent, destination.split('/').at(-1)), {mode:0o700});
const dir = resolve(destination, 'dist/server');
await mkdir(dir, {recursive:true});
// Exact source allowlist. Host collectors, credentials, fixtures and private snapshots are never bundled.
for (const [input, output] of [['context.mjs','context.mjs'],['page.mjs','page.mjs'],['../command-center/context.mjs','shared-context.mjs'],['../command-center/source-links.mjs','source-links.mjs'],['../command-center/refresh-grant.mjs','refresh-grant.mjs'],['../command-center/release.mjs','release.mjs']]) {
  const source = await readFile(new URL(input,root),'utf8');
  await exclusiveWrite(resolve(dir,output),['release.mjs','refresh-grant.mjs'].includes(output) ? source.replace("'./context.mjs'", "'./shared-context.mjs'") : source);
}
const browser = await readFile(new URL('browser.mjs',root),'utf8');
const worker = await readFile(new URL('worker.mjs',root),'utf8');
await exclusiveWrite(resolve(dir,'index.js'), 'const browserSource = '+JSON.stringify(browser)+';\n'+worker.replace("'../command-center/release.mjs'", "'./release.mjs'").replace("'../command-center/context.mjs'", "'./shared-context.mjs'").replaceAll('env.PROOF_BROWSER_SOURCE','browserSource'));
await exclusiveWrite(resolve(destination,'package.json'),JSON.stringify({private:true,type:'module'})+'\n');
console.log('Built allowlisted Worker sources only; no context payload or credentials included.');
