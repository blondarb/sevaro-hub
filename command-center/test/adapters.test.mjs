import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAsana, asanaFields, githubMetadataFeed, claudeExportFeed, syncHealthFeed } from '../adapters.mjs';
import { entry,source,NOW } from './fixtures.mjs';
const config={sourceId:'asana:portfolio',projectId:'100',entries:[entry()],stageLabels:{'5':'Validate'},credential:'synthetic-fixture-not-a-credential',now:new Date(NOW).toISOString()};
function data(overrides={}) { return {data:{gid:'101',modified_at:'2026-09-13T19:59:00Z',completed:false,due_on:'2026-09-14',due_at:null,assignee:{gid:'8'},memberships:[{project:{gid:'100'},section:{gid:'5'}}],...overrides}}; }
test('Asana only requests allowlisted scalar metadata and preserves source date and stage',async()=>{
  let count=0;const feed=await collectAsana({...config,fetcher:async(url,init)=>{
    count++;assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(new URL(url).searchParams.get('opt_fields'),asanaFields);assert.doesNotMatch(asanaFields,/name|notes|stories|attachments/);
    return Response.json(data());}});
  assert.equal(count,1);assert.equal(feed.items[0].status,'Validate');assert.equal(feed.items[0].due,'2026-09-14');
});
test('failed and partial reads expose fixed failure codes without raw API content',async()=>{
  for(const status of [401,403,429,500]){
    const result=await collectAsana({...config,fetcher:async()=>new Response('synthetic upstream private body',{status})});
    assert.equal(result.status,'unavailable');assert.equal(result.items.length,0);assert.doesNotMatch(JSON.stringify(result),/private body/);
  }
  let calls=0;const result=await collectAsana({...config,entries:[entry(),entry({target:'102'})],fetcher:async()=>++calls===1?Response.json(data()):new Response('unavailable',{status:500})});
  assert.equal(result.items.length,0);assert.equal(result.status,'unavailable');
});
test('moved tasks and unrecognized stages become conflicts without automatic normalization',async()=>{
  for(const memberships of [[],[{project:{gid:'100'},section:{gid:'unknown'}}]]){
    const result=await collectAsana({...config,fetcher:async()=>Response.json(data({memberships}))});assert.equal(result.failure_code,'source_conflict');
  }
});
test('Github consumes only selected metadata; raw author/body fields are rejected',()=>{
  const config={sourceId:'github:hub',repository:'example/project',entries:[entry()],records:[{number:101,state:'OPEN',isDraft:true,updatedAt:new Date(NOW).toISOString()}],now:new Date(NOW).toISOString()};
  assert.equal(githubMetadataFeed(config).items[0].status,'Draft pull request');
  assert.throws(()=>githubMetadataFeed({...config,records:[{...config.records[0],body:'synthetic forbidden'}]}),/unexpected_fields/);
});
test('Claude input is an exact curated export, not a raw-source ingestion path',()=>{
  const f=source({source_id:'claude:coordination',system:'claude',items:[]});
  assert.equal(claudeExportFeed(f,{allowedHosts:['app.asana.com'],now:NOW}).status,'available');
  assert.throws(()=>claudeExportFeed({...f,transcript:'synthetic forbidden'},{allowedHosts:['app.asana.com'],now:NOW}),/unexpected_fields/);
});
test('sync adapter uses actionable depth, original observation and no raw failure text',()=>{
  const health={observed_at:'2026-09-13T19:00:00+00:00',actionable_queue_depth:0,audit_only_depth:43,oldest_queued_age_hours_approx:0,last_successful_sync_at:null,last_failed_sync_reason:'synthetic arbitrary failure',alert:null,stuck:false};
  const options={sourceId:'asana_sync:delivery',sourceUrl:'https://github.com/example/project',now:new Date(NOW).toISOString()};
  assert.equal(syncHealthFeed(health,options).items.length,0);
  const f=syncHealthFeed({...health,stuck:true,actionable_queue_depth:2,alert:'queue_stuck'},options);
  assert.equal(f.observed_at,'2026-09-13T19:00:00.000Z');assert.match(f.items[0].context,/2 actionable/);assert.doesNotMatch(JSON.stringify(f),/arbitrary failure/);
});
test('empty target sets cannot masquerade as healthy source reads',async()=>{
  await assert.rejects(collectAsana({sourceId:'asana:portfolio',projectId:'100',entries:[],stageLabels:{},credential:'synthetic',fetcher:()=>{throw Error('must not fetch');}}));
  assert.throws(()=>githubMetadataFeed({sourceId:'github:hub',repository:'synthetic/example',entries:[],records:[],now:new Date().toISOString()}));
});
