import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,writeFile,mkdir,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privateJson,githubHost} from '../collector.mjs';
const exec=promisify(execFile);
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
