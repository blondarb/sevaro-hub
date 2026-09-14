import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,lstat,symlink,chmod,rm,realpath,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {stageMeetingExport,stageRepliesExport,MAX_ENCODED_BYTES} from '../command-center/stage-meeting-export.mjs';
import {sha256} from '../command-center/context.mjs';

const NOW=Date.parse('2026-09-13T20:00:00Z'),hosts=['app.asana.com'];
async function packet({observed='2026-09-13T19:00:00Z',completed='2026-09-13T19:30:00Z',expires='2026-09-13T21:00:00Z',runId='meeting-1',routine='routine:weekday-afternoon-digest',source='claude:meetings'}={}) {
 const feed={schema_version:1,source_id:source,system:'claude',observed_at:observed,expires_at:expires,status:'partial',failure_code:null,items:[]};
 const run={run_id:runId,routine,started_at:observed,completed_at:completed,outcome:'partial',coverage:'reviewed-sources-only'};
 return {schema_version:2,feed,review:{reviewed_by:'Claude',reviewed_at:completed,policy:'executive-project-context-v1',feed_digest:await sha256(feed),packet_digest:await sha256({feed,run})},run};
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64');
test('reviewed Slack reply survives staging while a changed or unreviewed packet is held',async()=>{
 const path=await root();try{
  const value=await packet({source:'claude:replies',routine:'comms-morning-briefing',runId:'slack-reply'});
  value.feed.items.push({item_id:'slack:synthetic:reply',source_id:'claude:replies',source_revision:'synthetic-1',source_url:'https://sevarohealth.slack.com/archives/C0SYNTHETIC/p1789391165151239',spoken_name:'Synthetic project reply',kind:'response',status:'Reply needed',context:'Synthetic project scheduling request.',recommendation:null,requires_steve:true,due:null,next_event:null,action_state:'none'});
  value.review.feed_digest=await sha256(value.feed);value.review.packet_digest=await sha256({feed:value.feed,run:value.run});
  assert.equal((await stageRepliesExport({root:path,encoded:encode(value),now:NOW})).status,'staged');
  const changed=structuredClone(value);changed.feed.items[0].context='Different content without new review';
  await assert.rejects(stageRepliesExport({root:path,encoded:encode(changed),now:NOW}),/invalid_packet/);
  const unreviewed=structuredClone(value);delete unreviewed.review;
  await assert.rejects(stageRepliesExport({root:path,encoded:encode(unreviewed),now:NOW}),/invalid_packet/);
  assert.equal(JSON.parse(await readFile(join(path,'incoming','claude-replies.json'))).review.packet_digest,value.review.packet_digest);
 }finally{await rm(path,{recursive:true,force:true});}
});
async function root(){const path=await realpath(await mkdtemp(join(tmpdir(),'stage-meeting-')));await chmod(path,0o700);return path;}
async function cli(input,env,script='stage-meeting-export-cli.mjs'){return await new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,[resolve('command-center',script)],{env:{...process.env,...env}});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>resolveRun({code,out,err}));child.stdin.end(input);});}
test('stages canonical reviewed meeting bytes and quietly replays the exact digest',async()=>{
 const path=await root();try{const value=await packet(),first=await stageMeetingExport({root:path,encoded:encode(value),now:NOW,allowedHosts:hosts});assert.equal(first.status,'staged');assert.equal((await lstat(join(path,'incoming'))).mode&0o777,0o700);assert.equal((await lstat(join(path,'incoming','claude-meetings.json'))).mode&0o777,0o600);assert.equal(JSON.parse(await readFile(join(path,'incoming','claude-meetings.json'))).feed.source_id,'claude:meetings');assert.equal((await stageMeetingExport({root:path,encoded:encode(value),now:NOW,allowedHosts:hosts})).status,'unchanged');}finally{await rm(path,{recursive:true,force:true});}
});
test('staging rejects malformed, wrong reviewed packets, regressions, and unsafe existing paths',async()=>{
 const path=await root();try{
  await assert.rejects(stageMeetingExport({root:path,encoded:'%%%%',now:NOW,allowedHosts:hosts}),/invalid_base64/);
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet({source:'claude:replies'})),now:NOW,allowedHosts:hosts}),/invalid_packet/);
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet({expires:'2026-09-13T19:59:00Z'})),now:NOW,allowedHosts:hosts}),/invalid_packet/);
  await stageMeetingExport({root:path,encoded:encode(await packet({observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z',runId:'meeting-2'})),now:NOW,allowedHosts:hosts});
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet()),now:NOW,allowedHosts:hosts}),/stage_conflict/);
  const target=join(path,'incoming','claude-meetings.json');await chmod(target,0o644);
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet({observed:'2026-09-13T19:41:00Z',completed:'2026-09-13T19:50:00Z',runId:'meeting-3'})),now:NOW,allowedHosts:hosts}),/private_file_required/);
  await chmod(target,0o600);await rm(target);await symlink(join(path,'nothing'),target);
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet({observed:'2026-09-13T19:41:00Z',completed:'2026-09-13T19:50:00Z',runId:'meeting-3'})),now:NOW,allowedHosts:hosts}),/private_file_required/);
  await assert.rejects(stageMeetingExport({root:path,encoded:'A'.repeat(MAX_ENCODED_BYTES+4),now:NOW,allowedHosts:hosts}),/invalid_base64/);
 }finally{await rm(path,{recursive:true,force:true});}
});
test('an expired staged packet remains a floor for a newer fresh packet',async()=>{
 const path=await root();try{
  await stageMeetingExport({root:path,encoded:encode(await packet({observed:'2026-09-13T17:00:00Z',completed:'2026-09-13T17:30:00Z',expires:'2026-09-13T19:00:00Z'})),now:Date.parse('2026-09-13T18:00:00Z'),allowedHosts:hosts});
  const next=await stageMeetingExport({root:path,encoded:encode(await packet({observed:'2026-09-13T19:01:00Z',completed:'2026-09-13T19:31:00Z',runId:'meeting-2'})),now:NOW,allowedHosts:hosts});assert.equal(next.status,'staged');
 }finally{await rm(path,{recursive:true,force:true});}
});
test('the private lock rejects concurrent staging and an older packet cannot replace newer bytes',async()=>{
 const path=await root();try{
  await mkdir(join(path,'incoming'),{mode:0o700});const held=await open(join(path,'incoming','.stage-meeting-export.lock'),'wx',0o600);
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet()),now:NOW,allowedHosts:hosts}),/stage_busy/);await held.close();await rm(join(path,'incoming','.stage-meeting-export.lock'));
  const newer=await packet({observed:'2026-09-13T19:31:00Z',completed:'2026-09-13T19:40:00Z',runId:'meeting-2'});await stageMeetingExport({root:path,encoded:encode(newer),now:NOW,allowedHosts:hosts});
  await assert.rejects(stageMeetingExport({root:path,encoded:encode(await packet()),now:NOW,allowedHosts:hosts}),/stage_conflict/);assert.equal(JSON.parse(await readFile(join(path,'incoming','claude-meetings.json'))).run.run_id,'meeting-2');
 }finally{await rm(path,{recursive:true,force:true});}
});
test('the fixed CLI resolves a private ClaudeSync symlink before staging',async()=>{
 const base=await root(),home=join(base,'home'),storage=join(base,'storage','ClaudeSync'),target=join(storage,'handoffs','command-center');try{
  await mkdir(home,{mode:0o700});await mkdir(target,{recursive:true,mode:0o700});await chmod(storage,0o700);await chmod(join(storage,'handoffs'),0o700);await chmod(target,0o700);await symlink(storage,join(home,'ClaudeSync'));
  const clock=Date.now(),value=await packet({observed:new Date(clock-120_000).toISOString(),completed:new Date(clock-60_000).toISOString(),expires:new Date(clock+3_600_000).toISOString()});
  const result=await cli(encode(value),{HOME:home});assert.equal(result.code,0,result.err);assert.deepEqual(JSON.parse(result.out),{status:'staged',digest:value.review.packet_digest});assert.equal(result.err,'');assert.equal((await lstat(join(target,'incoming','claude-meetings.json'))).isFile(),true);
  const reply=await packet({source:'claude:replies',routine:'comms-morning-briefing',runId:'reply-cli',observed:new Date(clock-120_000).toISOString(),completed:new Date(clock-60_000).toISOString(),expires:new Date(clock+3_600_000).toISOString()});
  const stagedReply=await cli(encode(reply),{HOME:home},'stage-claude-replies-export-cli.mjs');assert.equal(stagedReply.code,0,stagedReply.err);assert.equal(JSON.parse(stagedReply.out).digest,reply.review.packet_digest);
  assert.equal(JSON.parse(await readFile(join(target,'incoming','claude-meetings.json'))).review.packet_digest,value.review.packet_digest);
  const wrong=await cli(encode(value),{HOME:home},'stage-claude-replies-export-cli.mjs');assert.equal(wrong.code,1);assert.equal(JSON.parse(wrong.err).error,'invalid_packet');assert.equal(wrong.out,'');
  assert.equal(JSON.parse(await readFile(join(target,'incoming','claude-replies.json'))).review.packet_digest,reply.review.packet_digest);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('retained reply staging accepts only the existing routines and preserves replay/conflict rules',async()=>{
 const path=await root();try{
  const replies=await packet({source:'claude:replies',routine:'comms-afternoon-check',runId:'reply-1'}),args={root:path,encoded:encode(replies),now:NOW,allowedHosts:hosts};
  assert.equal((await stageRepliesExport(args)).status,'staged');assert.equal((await stageRepliesExport(args)).status,'unchanged');
  await assert.rejects(stageRepliesExport({...args,encoded:encode(await packet({source:'claude:meetings'}))}),/invalid_packet/);
  await assert.rejects(stageRepliesExport({...args,encoded:encode(await packet({source:'claude:replies',routine:'routine:weekday-afternoon-digest',runId:'reply-2'}))}),/invalid_packet/);
  await assert.rejects(stageRepliesExport({...args,encoded:encode(await packet({source:'claude:replies',routine:'comms-afternoon-check',runId:'reply-2',expires:'2026-09-13T19:59:00Z'}))}),/invalid_packet/);
  await assert.rejects(stageRepliesExport({...args,encoded:encode(await packet({source:'claude:replies',routine:'comms-afternoon-check',runId:'reply-2',observed:'2026-09-13T17:00:00Z',completed:'2026-09-13T17:30:00Z'}))}),/invalid_packet/);
  await assert.rejects(stageRepliesExport({...args,encoded:encode(await packet({source:'claude:replies',routine:'comms-afternoon-check',runId:'reply-2'}))}),/stage_conflict/);
  assert.equal(JSON.parse(await readFile(join(path,'incoming','claude-replies.json'))).run.run_id,'reply-1');
 }finally{await rm(path,{recursive:true,force:true});}
});
