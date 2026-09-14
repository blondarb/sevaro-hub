import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,stat,mkdir,symlink,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sha256,assemble} from '../context.mjs';
import {loadRuntimeSnapshot} from '../release.mjs';
import {preparePortableRefresh,bindPortableRefresh} from '../portable-refresh.mjs';
import {source} from './fixtures.mjs';
const run=promisify(execFile),cli=fileURLToPath(new URL('../portable-refresh-cli.mjs',import.meta.url));
async function setup(now=Date.now()) {
  const at=n=>new Date(now+n).toISOString();
  const authorization={schema_version:1,approved_by:'Steve',approved_at:at(-60000),expires_at:at(3600000),site_project_id:'appgprj_example',scope:'reviewed-executive-metadata-owner-only-read-only-refresh',sources:['asana:portfolio','claude:replies'],constraints:['no PHI, raw bodies or transcripts','preserve source observation and expiry','review content before each release','exact snapshot digest and expiry bound receipt per release','no source writes, sends, assignments, stage decisions or automatic merge','owner-only audience unchanged'],remaining_access_limits:['synthetic acceptance'],credential_exception:'spent',automatic_refresh_installed:false,credential_exception_consumed:true,refresh_mechanism:'Existing task',automatic_refresh_note:'No unattended publication'};
  const anchor={authorization_digest:await sha256(authorization),site_project_id:authorization.site_project_id,saved_version_id:'appgprj_example~appgver_existing'};
  const input={schema_version:1,feeds:[source({observed_at:at(-10000),expires_at:at(7200000)})],claude_exports:[]};
  return {now,at,input,grant:{authorization,anchor},anchor};
}
async function review(candidate,at){return {candidate_digest:await sha256(candidate),reviewed_by:'Codex',reviewed_at:at,policy:'executive-project-context-v1'};}
test('portable preparation preserves missing coverage and binds through the existing runtime contract',async()=>{
  const s=await setup(),candidate=await preparePortableRefresh(s.input,s.grant,s.anchor,s.now);
  assert.equal(candidate.classification,'executive-pending-review');
  assert.equal(candidate.health.find(h=>h.source_id==='claude:replies').state,'unavailable');
  const bound=await bindPortableRefresh(candidate,await review(candidate,s.at(0)),s.grant,s.anchor,s.now);
  assert.equal(bound.snapshot.expires_at,s.grant.authorization.expires_at);
  assert.deepEqual(await loadRuntimeSnapshot(bound.runtime_values,s.now),bound.snapshot);
  assert.equal(bound.runtime_values.CONTEXT_SNAPSHOT_CHUNK_15,'');
  for(const key of ['PROOF_OWNER_SITE_USER_ID','APPROVAL_CATALOG','APPROVAL_CATALOG_ENABLED','CLAUDE_DELIVERY_READY'])assert.equal(bound.runtime_values[key],undefined);
});
test('independent anchor, source/system identity, duplicate feed and bare Claude substitution fail closed',async()=>{
  const s=await setup();
  const changed=structuredClone(s.grant);changed.authorization.sources=['asana:portfolio'];changed.anchor.authorization_digest=await sha256(changed.authorization);
  await assert.rejects(preparePortableRefresh(s.input,changed,s.anchor,s.now),/refresh_anchor_changed/);
  for(const change of [x=>x.feeds.push(x.feeds[0]),x=>x.feeds[0].system='github',x=>{x.feeds[0].source_id='claude:replies';x.feeds[0].system='claude';},x=>x.feeds[0].source_id='asana:other']){
    const input=structuredClone(s.input);change(input);await assert.rejects(preparePortableRefresh(input,s.grant,s.anchor,s.now));
  }
});
test('reviewed stale Claude evidence cannot become fresh from a new run time',async()=>{
  const s=await setup(),feed={...s.input.feeds[0],source_id:'claude:replies',system:'claude',items:[],observed_at:s.at(-10800000),expires_at:s.at(-1000),status:'partial'};
  const run={run_id:'synthetic-run',routine:'comms-morning-briefing',started_at:s.at(-1000),completed_at:s.at(0),outcome:'partial',coverage:'reviewed-sources-only'};
  const packet={schema_version:2,feed,run,review:{reviewed_by:'Claude',reviewed_at:s.at(0),policy:'executive-project-context-v1',feed_digest:await sha256(feed),packet_digest:await sha256({feed,run})}};
  s.input.claude_exports=[packet];
  await assert.rejects(preparePortableRefresh(s.input,s.grant,s.anchor,s.now),/authenticated_claude_delivery_required/);
  await assert.rejects(preparePortableRefresh(s.input,s.grant,s.anchor,s.now,{verifyClaudeOrigin:async()=>false}),/authenticated_claude_delivery_required/);
  // Synthetic fixture verifier only. No real connector verifier is installed.
  const candidate=await preparePortableRefresh(s.input,s.grant,s.anchor,s.now,{verifyClaudeOrigin:async r=>r.packet_digest===packet.review.packet_digest});
  assert.equal(candidate.health.find(h=>h.source_id==='claude:replies').state,'stale');
  packet.feed.email_body='forbidden';await assert.rejects(preparePortableRefresh(s.input,s.grant,s.anchor,s.now));
});
test('changed review payload, expired grant and changed saved version cannot be bound',async()=>{
  const s=await setup(),candidate=structuredClone(await preparePortableRefresh(s.input,s.grant,s.anchor,s.now)),r=await review(candidate,s.at(0));
  candidate.items[0].context='Edited after review';
  await assert.rejects(bindPortableRefresh(candidate,r,s.grant,s.anchor,s.now));
  await assert.rejects(preparePortableRefresh(s.input,s.grant,s.anchor,s.now+3600000),/expired/);
  await assert.rejects(preparePortableRefresh(s.input,s.grant,{...s.anchor,saved_version_id:'appgprj_example~appgver_changed'},s.now),/anchor_changed/);
});
async function files() {
  const s=await setup(),root=await mkdtemp(join(tmpdir(),'portable-refresh-test-'));
  for(const [name,value] of [['input.json',s.input],['grant.json',s.grant]])await writeFile(join(root,name),JSON.stringify(value),{mode:0o600});
  return {...s,root,args:[s.anchor.authorization_digest,s.anchor.site_project_id,s.anchor.saved_version_id]};
}
const environment={PATH:process.env.PATH,HOME:'/no-desktop-or-provider-cache',TZ:'UTC'};
test('CLI prepares and binds with network, child processes and home access denied',async()=>{
  const s=await files();
  s.root=await realpath(s.root);
  const permissions=['--permission','--allow-fs-read='+dirname(dirname(cli)),'--allow-fs-read='+s.root,'--allow-fs-write='+s.root];
  for(let p=dirname(s.root);;p=dirname(p)){permissions.push('--allow-fs-read='+join(p,'.git'));if(p===dirname(p))break;}
  const prepared=await run(process.execPath,[...permissions,cli,'prepare',s.root,'input.json','grant.json','candidate.json',...s.args],{env:environment});
  assert.equal(JSON.parse(prepared.stdout).state,'review_required');assert.ok(!prepared.stdout.includes('Fictional'));
  const candidate=JSON.parse(await readFile(join(s.root,'candidate.json'),'utf8'));
  await writeFile(join(s.root,'review.json'),JSON.stringify(await review(candidate,new Date().toISOString())),{mode:0o600});
  const bound=await run(process.execPath,[...permissions,cli,'bind',s.root,'candidate.json','grant.json','bound.json',...s.args,'review.json'],{env:environment});
  assert.equal(JSON.parse(bound.stdout).state,'bound_not_published');
  assert.equal((await stat(join(s.root,'bound.json'))).mode&0o777,0o600);
  const data=JSON.parse(await readFile(join(s.root,'bound.json'),'utf8'));await loadRuntimeSnapshot(data.runtime_values);
  const before=await readFile(join(s.root,'bound.json'));
  await assert.rejects(run(process.execPath,[cli,'bind',s.root,'candidate.json','grant.json','bound.json',...s.args,'review.json'],{env:environment}),e=>e.stderr.includes('output_exists'));
  assert.deepEqual(await readFile(join(s.root,'bound.json')),before);
});
test('CLI refuses symlink inputs, repository outputs and permissive private inputs without exposing contents',async()=>{
  const s=await files();await symlink(join(s.root,'input.json'),join(s.root,'linked.json'));
  const invoke=name=>run(process.execPath,[cli,'prepare',s.root,name,'grant.json','candidate.json',...s.args],{env:environment});
  await assert.rejects(invoke('linked.json'),e=>e.stderr.includes('private_io_failed')&&!e.stderr.includes(s.root));
  await writeFile(join(s.root,'public.json'),JSON.stringify(s.input),{mode:0o644});await assert.rejects(invoke('public.json'),e=>e.stderr.includes('private_file_required'));
  await mkdir(join(s.root,'.git'));await assert.rejects(invoke('input.json'),e=>e.stderr.includes('repository_output_forbidden'));
});
test('CLI bind refuses a digest-valid fabricated Claude candidate and review without origin verification',async()=>{
  const s=await files(),claude={...s.input.feeds[0],source_id:'claude:replies',system:'claude',items:[]};
  const candidate=await assemble([...s.input.feeds,claude],{expectedSources:s.grant.authorization.sources,allowedHosts:['app.asana.com'],classification:'executive-pending-review',now:s.now});
  await writeFile(join(s.root,'candidate.json'),JSON.stringify(candidate),{mode:0o600});
  await writeFile(join(s.root,'review.json'),JSON.stringify(await review(candidate,new Date().toISOString())),{mode:0o600});
  await assert.rejects(run(process.execPath,[cli,'bind',s.root,'candidate.json','grant.json','bound.json',...s.args,'review.json'],{env:environment}),e=>e.stderr.includes('authenticated_claude_delivery_required'));
});
