import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,writeFile,mkdir,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privatePaths} from '../private-paths.mjs';
import {privateJson,githubHost,collectSources} from '../collector.mjs';
import {source,row} from './fixtures.mjs';
import {sha256} from '../context.mjs';
const exec=promisify(execFile);
test('collector imports complete and explicitly partial reviewed Claude scopes',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'context-claude-'))),path=join(root,'export.json');
 try {
  const feed=source({source_id:'claude:example',system:'claude',observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600_000).toISOString(),items:[row({source_id:'claude:example',item_id:'claude:example:item'})]});
  const packet={schema_version:1,feed,review:{reviewed_by:'Claude',reviewed_at:new Date().toISOString(),policy:'executive-project-context-v1',feed_digest:await sha256(feed)},run:{run_id:'synthetic-export',routine:'synthetic-review',started_at:feed.observed_at,completed_at:feed.observed_at,outcome:'succeeded',coverage:'complete-allowlist'}};
  const plan={schema_version:1,sources:[{source_id:feed.source_id,system:'claude',private_export_path:path,allowed_hosts:['app.asana.com']}]};
  await writeFile(path,JSON.stringify(packet),{mode:0o600});
  assert.equal((await collectSources(plan)).feeds[0].items.length,1);
  packet.run.outcome='partial';packet.run.coverage='reviewed-sources-only';
  await writeFile(path,JSON.stringify(packet),{mode:0o600});
  const partial=(await collectSources(plan)).feeds[0];assert.equal(partial.status,'partial');assert.equal(partial.items.length,1);
  packet.run.outcome='failed';packet.run.coverage='unavailable';
  await writeFile(path,JSON.stringify(packet),{mode:0o600});
  const rejected=(await collectSources(plan)).feeds[0];assert.equal(rejected.status,'unavailable');assert.deepEqual(rejected.items,[]);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('private inputs reject repository paths, symlink parents and public file permissions',async()=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'context-files-')));
  try {
    await mkdir(join(root,'private'));await writeFile(join(root,'private/input.json'),'{}',{mode:0o600});
    assert.deepEqual(await privateJson(join(root,'private/input.json')),{});
    await symlink(join(root,'private'),join(root,'alias'));
    await assert.rejects(privateJson(join(root,'alias/input.json')),/canonical_private_path_required/);
    await mkdir(join(root,'.git'));
    await assert.rejects(privateJson(join(root,'private/input.json')),/repository_input_forbidden/);
    await rm(join(root,'.git'),{recursive:true});
    await writeFile(join(root,'public.json'),'{}',{mode:0o644});
    await assert.rejects(privateJson(join(root,'public.json')),/private_file_required/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('empty GitHub host scope fails before invoking native authentication',async()=>{
  await assert.rejects(githubHost({repository:'synthetic/example',entries:[]}));
});
test('Site build creates isolated sources and refuses overwrite or repository destinations',async()=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'context-build-'))),build=new URL('../../command-center-proof/build.mjs',import.meta.url).pathname;
  try {
    const destination=join(root,'candidate');await exec(process.execPath,[build,destination]);
    const source=await readFile(join(destination,'dist/server/index.js'),'utf8');assert.match(source,/loadRuntimeSnapshot/);assert.doesNotMatch(source,/asana_pat|githubHost/);
    await assert.rejects(exec(process.execPath,[build,destination]));
    await mkdir(join(root,'.git'));
    await assert.rejects(exec(process.execPath,[build,join(root,'another')]));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('documented root alias resolves once; arbitrary aliases and symlink files stay forbidden',async()=>{
  const temp=await realpath(await mkdtemp(join(tmpdir(),'context-root-')));
  try {
    await mkdir(join(temp,'storage'));await symlink(join(temp,'storage'),join(temp,'configured'));
    const root=join(temp,'configured','handoffs');await mkdir(root,{mode:0o700});
    await writeFile(join(root,'input.json'),'{}',{mode:0o600});
    const paths=await privatePaths(root,join(root,'input.json'),join(root,'proposed-current-context.json'));
    assert.equal(paths.root,join(temp,'storage','handoffs'));assert.deepEqual(await privateJson(paths.input),{});
    await symlink(join(temp,'storage','handoffs'),join(temp,'untrusted'));
    await assert.rejects(privatePaths(root,join(temp,'untrusted','input.json'),join(root,'proposed-current-context.json')));
    await symlink(join(root,'input.json'),join(root,'linked.json'));
    await assert.rejects(privatePaths(root,join(root,'linked.json'),join(root,'proposed-current-context.json')));
  } finally {await rm(temp,{recursive:true,force:true});}
});
