#!/usr/bin/env node
// Offline preparation only. No connectors, subprocesses, raw mail, or publication.
import {readFile,lstat,realpath,open,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {ContextError,requireThat} from './context.mjs';
import {prepareReplyRecheck,recheckSummary} from './reply-recheck.mjs';
import {LINK_HOSTS} from './release.mjs';

async function privateRoot(path) {
  requireThat(process.platform!=='win32','private_posix_host_required');
  const root=resolve(path);
  requireThat(await realpath(root)===root,'canonical_private_path_required');
  const info=await lstat(root);
  requireThat(info.isDirectory() && info.uid===process.getuid() && (info.mode&0o077)===0,'private_root_required');
  for (let parent=root;;parent=dirname(parent)) {
    let tracked=false;
    try {await lstat(join(parent,'.git'));tracked=true;} catch(error) {if(error.code!=='ENOENT')throw error;}
    requireThat(!tracked,'repository_input_forbidden');
    if(parent===dirname(parent))break;
  }
  return root;
}
function filename(value) {
  requireThat(typeof value==='string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(value),'invalid_recheck_filename');
  return value;
}
async function input(root,name) {
  const path=join(root,filename(name)),info=await lstat(path);
  requireThat(info.isFile() && !info.isSymbolicLink() && info.uid===process.getuid() && (info.mode&0o077)===0 && info.size<=128_000,'private_file_required');
  return JSON.parse(await readFile(path,'utf8'));
}
try {
  const [rootArg,output,priorName,...names]=process.argv.slice(2);
  requireThat(rootArg && names.length>0 && names.length<=100,'invalid_recheck_options');
  const root=await privateRoot(rootArg);filename(output);
  requireThat(!names.includes(output) && output!==priorName,'output_collision');
  const packets=[];
  for(const name of names)packets.push(await input(root,name));
  const prior=priorName==='-'?null:await input(root,priorName);
  const plan=await prepareReplyRecheck(packets,{allowedHosts:LINK_HOSTS,prior});
  const path=join(root,output),handle=await open(path,'wx',0o600);
  try {await handle.writeFile(JSON.stringify(plan)+'\n');await handle.sync();}
  catch(error) {await handle.close();await unlink(path);throw error;}
  await handle.close();
  process.stdout.write(JSON.stringify(recheckSummary(plan))+'\n');
} catch(error) {
  process.stderr.write(JSON.stringify({status:'failed',error:error instanceof ContextError?error.code:'recheck_failed'})+'\n');
  process.exitCode=1;
}
