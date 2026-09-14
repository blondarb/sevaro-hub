import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,assemble} from '../context.mjs';
import {reviewedClaudeExport,importableClaudeFeed,CLAUDE_EXPORT_POLICY} from '../claude-export.mjs';
import {NOW,source,row} from './fixtures.mjs';
async function packet(){
  const feed=source({source_id:'claude:coordination',system:'claude',items:[row({item_id:'claude:coordination:example',source_id:'claude:coordination'})]});
  const run={run_id:'synthetic-review-1',routine:'labs-coordination',started_at:feed.observed_at,completed_at:new Date(NOW).toISOString(),outcome:'partial',coverage:'reviewed-sources-only'};
  return {schema_version:2,feed,review:{reviewed_by:'Claude',reviewed_at:new Date(NOW).toISOString(),policy:CLAUDE_EXPORT_POLICY,feed_digest:await sha256(feed),packet_digest:await sha256({feed,run})},run};
}
const opts={allowedHosts:['app.asana.com'],now:NOW};
test('Claude receipt preserves original evidence times and partial coverage',async()=>{
 const p=await packet(),r=await reviewedClaudeExport(p,opts);
 assert.deepEqual(r.feed,p.feed);assert.equal(r.receipt.coverage,'reviewed-sources-only');
 assert.equal(r.feed.observed_at,'2026-09-13T19:59:00Z');
});
test('partial exports retain reviewed items under an explicit partial source state',async()=>{
 const p=await packet(),r=await reviewedClaudeExport(p,opts);
 const partial=importableClaudeFeed(r);assert.equal(partial.status,'partial');assert.deepEqual(partial.items,p.feed.items);
 p.run.outcome='succeeded';p.run.coverage='complete-allowlist';p.review.packet_digest=await sha256({feed:p.feed,run:p.run});
 assert.deepEqual(importableClaudeFeed(await reviewedClaudeExport(p,opts)),p.feed);
 p.run.coverage='reviewed-sources-only';await assert.rejects(reviewedClaudeExport(p,opts),/invalid_run_receipt/);
});
test('run cannot predate evidence; later review may preserve older evidence',async()=>{
 const p=await packet();p.run.started_at='2026-09-13T19:57:00Z';p.run.completed_at='2026-09-13T19:58:00Z';
 await assert.rejects(reviewedClaudeExport(p,opts),/invalid_run_receipt/);
 p.run.started_at='2026-09-13T19:59:30Z';p.run.completed_at=new Date(NOW).toISOString();p.review.packet_digest=await sha256({feed:p.feed,run:p.run});
 assert.equal((await reviewedClaudeExport(p,opts)).feed.observed_at,p.feed.observed_at);
});
test('legacy and unbound run receipts, changed content, and raw fields are rejected',async()=>{
 const p=await packet(); await assert.rejects(reviewedClaudeExport(p.feed,opts));
 const legacy=structuredClone(p);legacy.schema_version=1;delete legacy.review.packet_digest;await assert.rejects(reviewedClaudeExport(legacy,opts),/export_re_review_required/);
 for(const change of [v=>v.review.feed_digest='invalid',v=>v.feed.items[0].context='changed',v=>{v.run.outcome='succeeded';v.run.coverage='complete-allowlist';},v=>v.run.coverage='complete-allowlist',v=>v.run.completed_at='2026-09-13T19:59:30Z',v=>v.feed.email_body='forbidden',v=>v.review.reviewed_by='Steve']){
  const copy=structuredClone(p);change(copy);await assert.rejects(reviewedClaudeExport(copy,opts));
 }
});
test('stale evidence remains stale even with a new export review time',async()=>{
 const p=await packet();p.review.reviewed_at=new Date(NOW+7200_000).toISOString();p.run.completed_at=p.review.reviewed_at;p.review.packet_digest=await sha256({feed:p.feed,run:p.run});
 const r=await reviewedClaudeExport(p,{...opts,now:NOW+7200_000});assert.ok(Date.parse(r.feed.expires_at)<NOW+7200_000);
});
test('old reply evidence is capped at two hours without changing the reviewed packet',async()=>{
 const p=await packet();p.feed.source_id='claude:replies';p.feed.items[0].source_id='claude:replies';p.feed.items[0].item_id='claude:replies:example';p.feed.observed_at='2026-09-13T17:00:00Z';p.feed.expires_at='2026-09-14T17:00:00Z';
 p.run.started_at=p.feed.observed_at;p.run.completed_at=new Date(NOW).toISOString();p.review.reviewed_at=new Date(NOW).toISOString();p.review.feed_digest=await sha256(p.feed);p.review.packet_digest=await sha256({feed:p.feed,run:p.run});
 const reviewed=await reviewedClaudeExport(p,opts),effective=importableClaudeFeed(reviewed);
 assert.equal(reviewed.feed.expires_at,'2026-09-14T17:00:00Z');assert.equal(effective.expires_at,'2026-09-13T19:00:00.000Z');assert.equal(effective.status,'partial');
 const snapshot=await assemble([effective],{expectedSources:['claude:replies'],allowedHosts:['app.asana.com'],now:NOW});
 assert.equal(snapshot.health[0].state,'stale');assert.equal(snapshot.items.length,0);
 const freshCalendar=importableClaudeFeed(await reviewedClaudeExport(await packet(),opts));assert.equal(freshCalendar.expires_at,'2026-09-13T20:59:00Z');
});
