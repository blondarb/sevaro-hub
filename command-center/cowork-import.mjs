// Host-only import of already reviewed Cowork session outputs.  This module is
// deliberately not a scheduler, a source reader, or an approval/publish path.
import {readdir,lstat,realpath,open,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {ContextError,instant,exact,identifier} from './context.mjs';
import {reviewedClaudeExport,importableClaudeFeed} from './claude-export.mjs';

const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuid=new RegExp(`^${UUID}$`,'i');
const local=new RegExp(`^local_${UUID}$`,'i');
const SOURCES=Object.freeze([
  {source_id:'claude:replies',file:'claude-replies.json',routines:new Set(['comms-morning-briefing','comms-afternoon-check','routine:comms-morning-briefing','routine:comms-afternoon-check'])},
  // Keep Cowork's meeting digest distinct from Claude Code's leadership-prep
  // calendar export. Cloud-only sessions may simply be absent locally.
  {source_id:'claude:meetings',file:'claude-meetings.json',routines:new Set(['routine:weekday-afternoon-digest'])}
]);

function outcome(source_id,state, code=null, extra={}) { return {source_id,state,code,...extra}; }
function secure(info, directory=false) {
  if (!(directory ? info.isDirectory() : info.isFile()) || info.isSymbolicLink() || info.uid!==process.getuid() || (info.mode&0o077)!==0) throw new ContextError(directory?'private_directory_required':'private_file_required');
}
async function secureDirectory(path, privateOnly=false) { const info=await lstat(path); if(!info.isDirectory() || info.isSymbolicLink() || info.uid!==process.getuid() || (info.mode & (privateOnly?0o077:0o022))!==0)throw new ContextError('private_directory_required');return path; }
async function privateRoot(root) {
  const configured=resolve(root), canonical=await realpath(configured);
  if(configured!==canonical)throw new ContextError('private_directory_required');
  await secureDirectory(canonical,true);
  for(let parent=canonical;;parent=dirname(parent)) {
    try { await lstat(join(parent,'.git')); throw new ContextError('repository_output_forbidden'); } catch(error) { if(error.code && error.code!=='ENOENT') throw error; }
    if(parent===dirname(parent)) return canonical;
  }
}
async function namedDirectories(parent, pattern) {
  await secureDirectory(parent);
  const entries=await readdir(parent,{withFileTypes:true});
  const names=[];
  for(const entry of entries) {
    if(!entry.isDirectory() || !pattern.test(entry.name)) continue;
    const path=join(parent,entry.name); await secureDirectory(path); names.push(path);
  }
  return names.sort();
}
async function candidate(path, spec, allowedHosts, now, retained=false, incoming=false) {
  // Source outputs are often 0644 inside Claude's private 0700 outputs directory.
  // Never change Claude's permissions; destination copies are always 0600.
  await lstat(path); // Missing named exports do not inspect unrelated output folders.
  await secureDirectory(dirname(path),incoming || retained);
  if(!retained && !incoming)await secureDirectory(dirname(dirname(path)),true);
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  let packet,bytes;
  try {
    const info=await handle.stat();
    if(!info.isFile() || info.uid!==process.getuid() || (incoming ? (info.mode&0o777)!==0o600 : (info.mode&0o022)!==0) || info.size>128*1024)throw new ContextError('invalid_packet');
    bytes=await handle.readFile();if(bytes.length>128*1024)throw new ContextError('packet_too_large');
    try { packet=JSON.parse(bytes.toString('utf8')); } catch {throw new ContextError('invalid_packet');}
  } finally {await handle.close();}
  let reviewed;
  try { reviewed=await reviewedClaudeExport(packet,{allowedHosts,now}); } catch { throw new ContextError('invalid_packet'); }
  if(reviewed.feed.source_id!==spec.source_id || !spec.routines.has(reviewed.receipt.routine)) throw new ContextError('invalid_packet');
  const effective=importableClaudeFeed(reviewed);
  // A refresh pins its clock before discovery. A concurrently completed export
  // is picked up on the next run, rather than creating a future import receipt.
  if(instant(reviewed.receipt.completed_at)>now || instant(reviewed.receipt.reviewed_at)>now){if(retained)throw new ContextError('invalid_packet');return null;}
  if(!retained && instant(effective.expires_at)<=now) return null;
  return {packet,bytes,digest:reviewed.receipt.packet_digest,run_id:reviewed.receipt.run_id,observed_at:reviewed.feed.observed_at,completed_at:reviewed.receipt.completed_at};
}
function compare(a,b) { return instant(b.observed_at)-instant(a.observed_at) || instant(b.completed_at)-instant(a.completed_at); }
function conflicting(candidates) {
  for(let i=0;i<candidates.length;i++) for(let j=i+1;j<candidates.length;j++) {
    const a=candidates[i],b=candidates[j];
    if((a.observed_at===b.observed_at || a.run_id===b.run_id) && a.digest!==b.digest) return true;
  }
  return false;
}
async function atomic(path, bytes) {
  const temporary=join(dirname(path),`.${path.split('/').at(-1)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const handle=await open(temporary,'wx',0o600);
  try { await handle.writeFile(bytes); await handle.sync(); await handle.close(); await rename(temporary,path); }
  catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
}
async function receipt(root, spec, selected, now) {
  const data={schema_version:1,source_id:spec.source_id,packet_digest:selected.digest,run_id:selected.run_id,observed_at:selected.observed_at,completed_at:selected.completed_at,imported_at:new Date(now).toISOString()};
  await atomic(join(root,`${spec.file.slice(0,-5)}.receipt.json`),Buffer.from(JSON.stringify(data)));
}
async function accepted(path, spec, allowedHosts, now) {
  try { return await candidate(path,spec,allowedHosts,now,true); } catch(error) { if(error.code==='ENOENT') return null; throw error; }
}
async function monotonicFloor(root,spec,current,allowedHosts,now) {
  let saved=null;
  try {
    const h=await open(join(root,`${spec.file.slice(0,-5)}.receipt.json`),constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
      if((await h.stat()).size>4096)throw new ContextError('invalid_receipt');
      saved=JSON.parse(await h.readFile('utf8'));
    } finally {await h.close();}
    exact(saved,['schema_version','source_id','packet_digest','run_id','observed_at','completed_at','imported_at']);
    identifier(saved.run_id);
    if(saved.schema_version!==1 || saved.source_id!==spec.source_id || !/^[a-f0-9]{64}$/.test(saved.packet_digest) || instant(saved.observed_at)>instant(saved.completed_at) || instant(saved.completed_at)>instant(saved.imported_at) || instant(saved.imported_at)>now)throw new ContextError('invalid_receipt');
    saved={...saved,digest:saved.packet_digest};
  } catch(error) {if(error.code!=='ENOENT')throw new ContextError('invalid_receipt');}
  const previous=!current?await accepted(join(root,`${spec.file.slice(0,-5)}.previous.json`),spec,allowedHosts,now):null;
  const floors=[current,saved,previous].filter(Boolean);
  if(conflicting(floors))throw new ContextError('source_conflict');
  floors.sort(compare);return floors[0]??null;
}

export async function importCoworkOutputs({root,sessionsRoot,accountId,workspaceId,now=Date.now(),allowedHosts}) {
  if(!Array.isArray(allowedHosts)||allowedHosts.length===0||typeof accountId!=='string'||typeof workspaceId!=='string'||!uuid.test(accountId)||!uuid.test(workspaceId)) return {outcomes:SOURCES.map(spec=>outcome(spec.source_id,'held','invalid_request'))};
  try {
    const destinationRoot=await privateRoot(root);
    for(const spec of SOURCES) for(const name of [spec.file,`${spec.file.slice(0,-5)}.previous.json`,`${spec.file.slice(0,-5)}.receipt.json`]) {
      try { await lstat(join(destinationRoot,name)).then(info=>secure(info)); } catch(error) { if(error.code!=='ENOENT') throw error; }
    }
    const sessionRoot=await realpath(resolve(sessionsRoot)); if(sessionRoot!==resolve(sessionsRoot))throw new ContextError('private_directory_required');await secureDirectory(sessionRoot);
    const account=join(sessionRoot,accountId),workspace=join(account,workspaceId),found=[];
    await secureDirectory(account);await secureDirectory(workspace,true);
    let sessionCount=0;
    for(const session of await namedDirectories(workspace,local)) {
      if(++sessionCount>2048) throw new ContextError('session_limit');
      const outputs=join(session,'outputs');
      found.push(outputs);
    }
    const outcomes=[];
    for(const spec of SOURCES) {
      const destination=join(destinationRoot,spec.file), current=await accepted(destination,spec,allowedHosts,now), floor=await monotonicFloor(destinationRoot,spec,current,allowedHosts,now), candidates=[];
      let failure=null;
      for(const output of found) try { const value=await candidate(join(output,spec.file),spec,allowedHosts,now); if(value) candidates.push(value); } catch(error) { if(error.code!=='ENOENT') failure=error.code||'invalid_packet'; }
      // A reviewed cloud artifact is staged only at this exact private path. It is
      // deliberately not treated as a Cowork session or a general discovery root.
      if(spec.source_id==='claude:meetings') try {
        const value=await candidate(join(destinationRoot,'incoming','claude-meetings.json'),spec,allowedHosts,now,false,true);
        if(value) candidates.push(value);
      } catch(error) { if(error.code!=='ENOENT') failure=error.code||'invalid_packet'; }
      if(failure) { outcomes.push(outcome(spec.source_id,'held',failure)); continue; }
      if(conflicting(candidates)) { outcomes.push(outcome(spec.source_id,'held','source_conflict')); continue; }
      candidates.sort(compare); const selected=candidates[0];
      if(!selected) { outcomes.push(outcome(spec.source_id,'missing','missing')); continue; }
      if(floor && floor.digest!==selected.digest && (floor.observed_at===selected.observed_at || floor.run_id===selected.run_id || instant(selected.observed_at)<=instant(floor.observed_at) || instant(selected.completed_at)<=instant(floor.completed_at))) {outcomes.push(outcome(spec.source_id,'held','source_conflict'));continue;}
      if(current) {
        if(current.digest===selected.digest) {
          // Repair a receipt interrupted after the accepted packet's atomic rename.
          let valid=false;try {const h=await open(join(destinationRoot,`${spec.file.slice(0,-5)}.receipt.json`),constants.O_RDONLY|constants.O_NOFOLLOW);try {valid=JSON.parse(await h.readFile('utf8')).packet_digest===selected.digest;}finally{await h.close();}}catch{}
          if(!valid)await receipt(destinationRoot,spec,selected,now);
          outcomes.push(outcome(spec.source_id,'unchanged',null,{observed_at:selected.observed_at,completed_at:selected.completed_at})); continue;
        }
        if(current.observed_at===selected.observed_at || current.run_id===selected.run_id || instant(selected.observed_at)<=instant(current.observed_at) || instant(selected.completed_at)<=instant(current.completed_at)) { outcomes.push(outcome(spec.source_id,'held','source_conflict')); continue; }
        await atomic(join(destinationRoot,`${spec.file.slice(0,-5)}.previous.json`),current.bytes);
      }
      await atomic(destination,selected.bytes); await receipt(destinationRoot,spec,selected,now);
      outcomes.push(outcome(spec.source_id,'imported',null,{observed_at:selected.observed_at,completed_at:selected.completed_at}));
    }
    return {outcomes};
  } catch(error) { const code=['private_directory_required','private_file_required','repository_output_forbidden','session_limit','invalid_packet'].includes(error?.code)?error.code:'import_failed';return {outcomes:SOURCES.map(spec=>outcome(spec.source_id,'held',code))}; }
}
