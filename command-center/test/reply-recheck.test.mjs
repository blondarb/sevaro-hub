import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,stat,realpath,symlink,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sha256,assemble} from '../context.mjs';
import {prepareReplyRecheck,recheckSummary} from '../reply-recheck.mjs';
import {CLAUDE_EXPORT_POLICY} from '../claude-export.mjs';
import {row,source,NOW} from './fixtures.mjs';
const allowedHosts=['app.asana.com'];
const opts={allowedHosts,now:NOW};
const at=offset=>new Date(NOW+offset).toISOString();
async function packet(ids=['a'],offset=-4*3600_000,overrides={}) {
  const feed=source({source_id:'claude:replies',system:'claude',observed_at:at(offset),expires_at:at(offset+3600_000),
    items:ids.map(id=>row({item_id:'claude:reply:'+id,source_id:'claude:replies',kind:'response',context:'SYNTHETIC PRIVATE TEXT'})),...overrides});
  const run={run_id:'run:'+Math.abs(offset),routine:'routine:comms-afternoon-check',started_at:at(offset-1000),completed_at:at(offset+1000),outcome:feed.status==='unavailable'?'failed':'partial',coverage:feed.status==='unavailable'?'unavailable':'reviewed-sources-only'};
  return {schema_version:2,feed,run,review:{reviewed_by:'Claude',reviewed_at:at(offset+2000),policy:CLAUDE_EXPORT_POLICY,feed_digest:await sha256(feed),packet_digest:await sha256({feed,run})}};
}
test('expired historical references survive recent empty or failed runs without becoming a feed',async()=>{
  const old=await packet(['old','second']),empty=await packet([],-60000);
  const plan=await prepareReplyRecheck([old,empty],opts);
  assert.equal(plan.references.length,2);
  assert.equal(recheckSummary(plan).publishable,false);
  assert.ok(!JSON.stringify(plan).includes('SYNTHETIC PRIVATE TEXT'));
  assert.ok(!JSON.stringify(plan).includes('spoken_name'));
  assert.equal(plan.references[0].last_observed_at,old.feed.observed_at);
  const failed=await packet([],-30000,{status:'unavailable',failure_code:'permission_required'});
  const next=await prepareReplyRecheck([failed],{...opts,prior:plan});
  assert.deepEqual(next.references,plan.references);
  await assert.rejects(assemble([plan],{expectedSources:['claude:replies'],allowedHosts,now:NOW}),/unexpected_fields/);
});
test('exact replay is idempotent and prior plans retain omitted references across multiple cycles',async()=>{
  const old=await packet(['a','b']),newer=await packet(['a'],-60000);
  const once=await prepareReplyRecheck([old,newer],opts);
  const replay=await prepareReplyRecheck([old,newer,newer],opts);
  assert.deepEqual(once,replay);
  const continued=await prepareReplyRecheck([newer],{...opts,prior:once});
  assert.deepEqual(continued,once);
  assert.equal(once.references[0].last_observed_at,newer.feed.observed_at);
  assert.equal(once.references[1].last_observed_at,old.feed.observed_at);
});
test('conflicting same observations/runs and prior rewrites fail closed',async()=>{
  const a=await packet(['a']),b=await packet(['b']);
  await assert.rejects(prepareReplyRecheck([a,b],opts),/source_conflict/);
  const prior=await prepareReplyRecheck([a],opts);
  await assert.rejects(prepareReplyRecheck([b],{...opts,prior}),/source_conflict/);
  prior.references[0].source_revision='changed';
  await assert.rejects(prepareReplyRecheck([a],{...opts,prior}),/invalid_recheck_plan/);
});
test('tampered review, raw fields, V1 and another source/routine are rejected',async()=>{
  const p=await packet();p.feed.items[0].context='tampered';
  await assert.rejects(prepareReplyRecheck([p],opts),/export_review_required/);
  const raw=await packet();raw.feed.items[0].body='RAW_SENTINEL';
  await assert.rejects(prepareReplyRecheck([raw],opts),/unexpected_fields/);
  const v1=await packet();v1.schema_version=1;
  await assert.rejects(prepareReplyRecheck([v1],opts),/export_re_review_required/);
  const wrong=await packet([],undefined,{source_id:'claude:calendar'});
  await assert.rejects(prepareReplyRecheck([wrong],opts),/wrong_recheck_source/);
});
test('bounded plans reject overflow rather than silently dropping old references',async()=>{
  const hundred=await packet(Array.from({length:100},(_,i)=>String(i)));
  await assert.rejects(prepareReplyRecheck([hundred,await packet(['extra'],-60000)],opts),/recheck_limit_exceeded/);
});
test('future observations within collector skew cannot create a non-reusable prior plan',async()=>{
  await assert.rejects(prepareReplyRecheck([await packet(['future'],30000)],opts),/future_recheck_evidence/);
  await assert.rejects(prepareReplyRecheck([await packet(['future-review'],-1000)],opts),/future_recheck_evidence/);
});
test('whole-second source timestamps preserve the exact plan digest on continuation',async()=>{
  const p=await packet(['a'],-4*3600_000,{observed_at:at(-4*3600_000).replace('.000Z','Z')});
  const first=await prepareReplyRecheck([p],opts);
  assert.deepEqual(await prepareReplyRecheck([p],{...opts,prior:first}),first);
});
const run=promisify(execFile),cli=fileURLToPath(new URL('../reply-recheck-cli.mjs',import.meta.url));
test('CLI operates offline, writes privately and will not overwrite or read unsafe files',async t=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'reply-recheck-')));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'input.json'),JSON.stringify(await packet()),{mode:0o600});
  const flags=['--permission','--allow-fs-read='+dirname(dirname(cli)),'--allow-fs-read='+root,'--allow-fs-write='+root];
  for(let p=dirname(root);;p=dirname(p)){flags.push('--allow-fs-read='+join(p,'.git'));if(p===dirname(p))break;}
  const invoke=(name='input.json')=>run(process.execPath,[...flags,cli,root,'output.json','-',name],{env:{PATH:process.env.PATH,HOME:'/no-credentials',TZ:'UTC'}});
  const result=await invoke();assert.equal(JSON.parse(result.stdout).reference_count,1);
  assert.ok(!result.stdout.includes('claude:reply:a'));assert.ok(!result.stdout.includes('SYNTHETIC'));
  assert.equal((await stat(join(root,'output.json'))).mode&0o777,0o600);
  const saved=await readFile(join(root,'output.json'),'utf8');
  await assert.rejects(invoke());assert.equal(await readFile(join(root,'output.json'),'utf8'),saved);
  await symlink(join(root,'input.json'),join(root,'link.json'));
  await assert.rejects(invoke('link.json'),e=>e.stderr.includes('private_file_required')&&!e.stderr.includes('SYNTHETIC'));
  await writeFile(join(root,'public.json'),JSON.stringify(await packet()),{mode:0o644});
  await assert.rejects(invoke('public.json'),e=>e.stderr.includes('private_file_required'));
  await mkdir(join(root,'.git'));
  await assert.rejects(invoke(),e=>e.stderr.includes('repository_input_forbidden'));
});
