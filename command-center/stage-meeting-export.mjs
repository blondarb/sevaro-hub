// Host-only staging of a producer-reviewed meeting export. Staging never imports,
// approves, publishes, or reads any source account.
import {mkdir,lstat,realpath,open,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {canonical,ContextError,instant,requireThat} from './context.mjs';
import {reviewedClaudeExport,importableClaudeFeed} from './claude-export.mjs';
import {LINK_HOSTS} from './release.mjs';
import {SOURCES} from './cowork-import.mjs';

export const MAX_ENCODED_BYTES=192*1024;
const MAX_PACKET_BYTES=128*1024;

function privateDirectory(info) { requireThat(info.isDirectory()&&!info.isSymbolicLink()&&info.uid===process.getuid()&&(info.mode&0o077)===0,'private_directory_required'); }
async function rootDirectory(root) {
  const canonical=await realpath(resolve(root));
  privateDirectory(await lstat(canonical));
  for(let parent=canonical;;parent=dirname(parent)) {
    try { await lstat(join(parent,'.git')); throw new ContextError('repository_output_forbidden'); } catch(error) { if(error.code&&error.code!=='ENOENT')throw error; }
    if(parent===dirname(parent))break;
  }
  return canonical;
}
async function incomingDirectory(root) {
  const path=join(root,'incoming');
  try { await mkdir(path,{mode:0o700}); } catch(error) { if(error.code!=='EEXIST') throw error; }
  const info=await lstat(path); privateDirectory(info);
  requireThat(await realpath(path)===path,'private_directory_required');
  return path;
}
function decode(encoded) {
  requireThat(typeof encoded==='string'&&encoded.length>0&&encoded.length<=MAX_ENCODED_BYTES&&encoded.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(encoded),'invalid_base64');
  const bytes=Buffer.from(encoded,'base64');
  requireThat(bytes.length>0&&bytes.length<=MAX_PACKET_BYTES&&bytes.toString('base64')===encoded,'invalid_base64');
  let parsed; try { parsed=JSON.parse(bytes.toString('utf8')); } catch { throw new ContextError('invalid_packet'); }
  // Store a deterministic encoding after the reviewed packet's strict validation.
  return {packet:parsed,bytes:Buffer.from(canonical(parsed))};
}
async function validate(packet, spec, now, allowedHosts, fresh=true) {
  let reviewed; try { reviewed=await reviewedClaudeExport(packet,{allowedHosts,now}); } catch { throw new ContextError('invalid_packet'); }
  requireThat(reviewed.feed.source_id===spec.source_id&&spec.routines.has(reviewed.receipt.routine),'invalid_packet');
  requireThat(instant(reviewed.receipt.completed_at)<=now&&instant(reviewed.receipt.reviewed_at)<=now&&(!fresh||instant(importableClaudeFeed(reviewed).expires_at)>now),'invalid_packet');
  return {digest:reviewed.receipt.packet_digest,run_id:reviewed.receipt.run_id,observed_at:reviewed.feed.observed_at,completed_at:reviewed.receipt.completed_at};
}
async function existing(path, spec, now, allowedHosts) {
  let handle; try { handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW); } catch(error) { if(error.code==='ENOENT') return null; throw new ContextError('private_file_required'); }
  try {
    const info=await handle.stat(); requireThat(info.isFile()&&info.uid===process.getuid()&&(info.mode&0o777)===0o600&&info.size<=MAX_PACKET_BYTES,'private_file_required');
    let packet; try { packet=JSON.parse((await handle.readFile()).toString('utf8')); } catch { throw new ContextError('invalid_packet'); }
    // An expired reviewed packet is unusable for import but remains a verified
    // monotonic floor for staging a later fresh packet.
    return validate(packet,spec,now,allowedHosts,false);
  } finally { await handle.close(); }
}
async function atomic(path, bytes) {
  const temporary=join(dirname(path),`.${path.split('/').at(-1)}.${process.pid}.${crypto.randomUUID()}.tmp`),handle=await open(temporary,'wx',0o600);
  try { await handle.writeFile(bytes);await handle.sync();await handle.close();await rename(temporary,path); }
  catch(error) { await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error; }
}
async function lock(directory) {
  let handle;try { handle=await open(join(directory,'.stage-meeting-export.lock'),'wx',0o600); } catch(error) { if(error.code==='EEXIST')throw new ContextError('stage_busy');throw error; }
  return async()=>{await handle.close().catch(()=>{});await unlink(join(directory,'.stage-meeting-export.lock')).catch(()=>{});};
}

export async function stageClaudeExport({root,encoded,sourceId,now=Date.now(),allowedHosts=LINK_HOSTS}) {
  const spec=SOURCES.find(row=>row.source_id===sourceId);requireThat(spec,'invalid_stage_source');
  const decoded=decode(encoded),selected=await validate(decoded.packet,spec,now,allowedHosts),directory=await incomingDirectory(await rootDirectory(root)),target=join(directory,spec.file),release=await lock(directory);
  try {
    // Read after acquiring the lock so concurrent older input cannot replace a
    // newer staged artifact between its comparison and atomic rename.
    const prior=await existing(target,spec,now,allowedHosts);
    if(prior) {
      if(prior.digest===selected.digest)return {status:'unchanged',digest:selected.digest};
      requireThat(prior.run_id!==selected.run_id&&prior.observed_at!==selected.observed_at&&instant(selected.observed_at)>instant(prior.observed_at)&&instant(selected.completed_at)>instant(prior.completed_at),'stage_conflict');
    }
    await atomic(target,decoded.bytes);
    return {status:'staged',digest:selected.digest};
  } finally {
    await release();
  }
}
export function stageMeetingExport(options) { return stageClaudeExport({...options,sourceId:'claude:meetings'}); }
export function stageRepliesExport(options) { return stageClaudeExport({...options,sourceId:'claude:replies'}); }
