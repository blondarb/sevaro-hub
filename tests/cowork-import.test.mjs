import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,chmod,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importCoworkOutputs} from '../command-center/cowork-import.mjs';
import {sha256} from '../command-center/context.mjs';

const NOW=Date.parse('2026-09-13T20:00:00Z'), host=['app.asana.com'];
const account='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',session='local_33333333-3333-4333-8333-333333333333';
async function packet({observed='2026-09-13T19:00:00Z',completed='2026-09-13T19:30:00Z',runId='run-1',routine='routine:comms-morning-briefing',source='claude:replies'}={}) {
 const feed={schema_version:1,source_id:source,system:'claude',observed_at:observed,expires_at:'2026-09-13T21:00:00Z',status:'partial',failure_code:null,items:[]};
 const run={run_id:runId,routine,started_at:observed,completed_at:completed,outcome:'partial',coverage:'reviewed-sources-only'};
 return {schema_version:2,feed,review:{reviewed_by:'Claude',reviewed_at:completed,policy:'executive-project-context-v1',feed_digest:await sha256(feed),packet_digest:await sha256({feed,run})},run};
}
async function setup(){const base=await realpath(await mkdtemp(join(tmpdir(),'cowork-import-'))),root=join(base,'private'),sessions=join(base,'sessions');await mkdir(root,{mode:0o700});await mkdir(join(sessions,account,workspace,session,'outputs'),{recursive:true,mode:0o700});return {base,root,sessions,path:join(sessions,account,workspace,session,'outputs','claude-replies.json')};}
async function put(path,value,mode=0o600){await writeFile(path,JSON.stringify(value),{mode});await chmod(path,mode);}
test('discovers replies and the separate meetings binding, then replays quietly',async()=>{const x=await setup();try{await put(x.path,await packet());const meetings=join(x.sessions,account,workspace,session,'outputs','claude-meetings.json');await put(meetings,await packet({source:'claude:meetings',routine:'routine:weekday-afternoon-digest',runId:'meeting-run'}));let r=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(r.outcomes[0].state,'imported');assert.equal(r.outcomes[1].state,'imported');assert.equal(JSON.parse(await readFile(join(x.root,'claude-replies.json'))).feed.source_id,'claude:replies');assert.equal(JSON.parse(await readFile(join(x.root,'claude-meetings.json'))).feed.source_id,'claude:meetings');r=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(r.outcomes[0].state,'unchanged');}finally{await rm(x.base,{recursive:true,force:true});}});
test('stale, wrong routine/source, and malformed packets do not import',async()=>{const x=await setup();try{await put(x.path,await packet({observed:'2026-09-13T17:00:00Z',completed:'2026-09-13T17:30:00Z'}));assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'missing');await put(x.path,await packet({routine:'routine:other'}));assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');await put(x.path,await packet({source:'claude:other'}));assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');await put(x.path,'{');assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');}finally{await rm(x.base,{recursive:true,force:true});}});
test('symlinks are held and conflicting or regressing packets preserve accepted data',async()=>{const x=await setup();try{await put(x.path,await packet());await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});const original=await readFile(join(x.root,'claude-replies.json'),'utf8');await rm(x.path);await symlink(join(x.root,'claude-replies.json'),x.path);assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');await rm(x.path);await put(x.path,await packet({runId:'run-1',observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z'}));assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');assert.equal(await readFile(join(x.root,'claude-replies.json'),'utf8',),original);}finally{await rm(x.base,{recursive:true,force:true});}});
test('rotation retains one previous packet and a failed write leaves current intact',async()=>{const x=await setup();try{await put(x.path,await packet());await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});const prior=await readFile(join(x.root,'claude-replies.json'),'utf8');await put(x.path,await packet({observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z',runId:'run-2'}));await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(await readFile(join(x.root,'claude-replies.previous.json'),'utf8'),prior);await chmod(x.root,0o500);await put(x.path,await packet({observed:'2026-09-13T19:41:00Z',completed:'2026-09-13T19:50:00Z',runId:'run-3'}));const current=await readFile(join(x.root,'claude-replies.json'),'utf8');assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');assert.equal(await readFile(join(x.root,'claude-replies.json'),'utf8'),current);await chmod(x.root,0o700);}finally{await rm(x.base,{recursive:true,force:true});}});

test('actual Cowork directory modes and routine IDs work without broadening permissions',async()=>{
 const x=await setup();try{
 await chmod(x.sessions,0o755);await chmod(join(x.sessions,account),0o755);
 await put(x.path,await packet({routine:'comms-morning-briefing'}),0o644);
 const r=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(r.outcomes[0].state,'imported');
 await rm(join(x.root,'claude-replies.receipt.json'));
 const replay=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(replay.outcomes[0].state,'unchanged');assert.ok(JSON.parse(await readFile(join(x.root,'claude-replies.receipt.json'))).packet_digest);
 await chmod(join(x.sessions,account,workspace,session),0o755);
 assert.equal((await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host})).outcomes[0].state,'held');
 }finally{await rm(x.base,{recursive:true,force:true});}
});

test('a newer foreign workspace cannot supply or replace reviewed exports',async()=>{
 const x=await setup();try{
 await put(x.path,await packet());const foreign=join(x.sessions,account,'99999999-9999-4999-8999-999999999999',session,'outputs');await mkdir(foreign,{recursive:true,mode:0o700});
 await put(join(foreign,'claude-replies.json'),await packet({observed:'2026-09-13T19:40:00Z',completed:'2026-09-13T19:50:00Z',runId:'foreign-run'}));
 const r=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host});assert.equal(r.outcomes[0].state,'imported');assert.equal(JSON.parse(await readFile(join(x.root,'claude-replies.json'))).run.run_id,'run-1');
 const missingBinding=await importCoworkOutputs({root:x.root,sessionsRoot:x.sessions,now:NOW,allowedHosts:host});assert.equal(missingBinding.outcomes[0].code,'invalid_request');
 }finally{await rm(x.base,{recursive:true,force:true});}
});

test('missing current cannot replay behind retained receipt; exact reconstruction succeeds',async()=>{
 const x=await setup();try{
 const args={root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host};
 const first=await packet(),newer=await packet({observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z',runId:'run-2'});
 await put(x.path,first);await importCoworkOutputs(args);await put(x.path,newer);await importCoworkOutputs(args);
 await rm(join(x.root,'claude-replies.json'));await put(x.path,first);
 assert.equal((await importCoworkOutputs(args)).outcomes[0].code,'source_conflict');
 await assert.rejects(readFile(join(x.root,'claude-replies.json')),/ENOENT/);
 await put(x.path,newer);assert.equal((await importCoworkOutputs(args)).outcomes[0].state,'imported');
 assert.equal(JSON.parse(await readFile(join(x.root,'claude-replies.json'))).run.run_id,'run-2');
 }finally{await rm(x.base,{recursive:true,force:true});}
});

test('an export completed after the pinned refresh clock waits until the next run',async()=>{
 const x=await setup();try{
 await put(x.path,await packet({completed:'2026-09-13T20:00:30Z'}));const args={root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,allowedHosts:host};
 assert.equal((await importCoworkOutputs({...args,now:NOW})).outcomes[0].state,'missing');
 assert.equal((await importCoworkOutputs({...args,now:NOW+60_000})).outcomes[0].state,'imported');
 assert.equal((await importCoworkOutputs({...args,now:NOW+60_000})).outcomes[0].state,'unchanged');
 }finally{await rm(x.base,{recursive:true,force:true});}
});

test('an absent staged meeting is harmless and an exact private staged artifact imports',async()=>{
 const x=await setup();try{
  const args={root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host};
  let r=await importCoworkOutputs(args);assert.equal(r.outcomes[1].state,'missing');
  const incoming=join(x.root,'incoming');await mkdir(incoming,{mode:0o700});
  await put(join(incoming,'claude-meetings.json'),await packet({source:'claude:meetings',routine:'routine:weekday-afternoon-digest',runId:'staged-meeting'}));
  r=await importCoworkOutputs(args);assert.equal(r.outcomes[1].state,'imported');
  assert.equal(JSON.parse(await readFile(join(x.root,'claude-meetings.json'))).run.run_id,'staged-meeting');
 }finally{await rm(x.base,{recursive:true,force:true});}
});

test('staged meetings preserve monotonic conflict handling and reject unsafe paths',async()=>{
 const x=await setup();try{
  const args={root:x.root,sessionsRoot:x.sessions,accountId:account,workspaceId:workspace,now:NOW,allowedHosts:host},incoming=join(x.root,'incoming');await mkdir(incoming,{mode:0o700});
  const path=join(incoming,'claude-meetings.json');await put(path,await packet({source:'claude:meetings',routine:'routine:weekday-afternoon-digest',runId:'meeting-1'}));
  await importCoworkOutputs(args);const accepted=await readFile(join(x.root,'claude-meetings.json'),'utf8');
  await put(path,await packet({source:'claude:meetings',routine:'routine:weekday-afternoon-digest',runId:'meeting-1',observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z'}));
  assert.equal((await importCoworkOutputs(args)).outcomes[1].code,'source_conflict');assert.equal(await readFile(join(x.root,'claude-meetings.json'),'utf8'),accepted);
  await chmod(path,0o644);assert.equal((await importCoworkOutputs(args)).outcomes[1].state,'held');
  await chmod(path,0o600);await rm(path);await symlink(join(x.root,'claude-meetings.json'),path);assert.equal((await importCoworkOutputs(args)).outcomes[1].state,'held');
 }finally{await rm(x.base,{recursive:true,force:true});}
});
