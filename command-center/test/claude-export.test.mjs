import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../context.mjs';
import {reviewedClaudeExport,importableClaudeFeed,CLAUDE_EXPORT_POLICY} from '../claude-export.mjs';
import {NOW,source,row} from './fixtures.mjs';
async function packet(){
  const feed=source({source_id:'claude:coordination',system:'claude',items:[row({item_id:'claude:coordination:example',source_id:'claude:coordination'})]});
  return {schema_version:1,feed,review:{reviewed_by:'Claude',reviewed_at:new Date(NOW).toISOString(),policy:CLAUDE_EXPORT_POLICY,feed_digest:await sha256(feed)},run:{run_id:'synthetic-review-1',routine:'labs-coordination',started_at:feed.observed_at,completed_at:new Date(NOW).toISOString(),outcome:'partial',coverage:'reviewed-sources-only'}};
}
const opts={allowedHosts:['app.asana.com'],now:NOW};
test('Claude receipt preserves original evidence times and partial coverage',async()=>{
 const p=await packet(),r=await reviewedClaudeExport(p,opts);
 assert.deepEqual(r.feed,p.feed);assert.equal(r.receipt.coverage,'reviewed-sources-only');
 assert.equal(r.feed.observed_at,'2026-09-13T19:59:00Z');
});
test('partial exports are retained for review but cannot claim complete available coverage',async()=>{
 const p=await packet(),r=await reviewedClaudeExport(p,opts);
 assert.throws(()=>importableClaudeFeed(r),/incomplete_claude_coverage/);
 p.run.outcome='succeeded';p.run.coverage='complete-allowlist';
 assert.deepEqual(importableClaudeFeed(await reviewedClaudeExport(p,opts)),p.feed);
 p.run.coverage='reviewed-sources-only';await assert.rejects(reviewedClaudeExport(p,opts),/invalid_run_receipt/);
});
test('run cannot predate evidence; later review may preserve older evidence',async()=>{
 const p=await packet();p.run.started_at='2026-09-13T19:57:00Z';p.run.completed_at='2026-09-13T19:58:00Z';
 await assert.rejects(reviewedClaudeExport(p,opts),/invalid_run_receipt/);
 p.run.started_at='2026-09-13T19:59:30Z';p.run.completed_at=new Date(NOW).toISOString();
 assert.equal((await reviewedClaudeExport(p,opts)).feed.observed_at,p.feed.observed_at);
});
test('missing review, changed content, failed run claimed available, and raw fields are rejected',async()=>{
 const p=await packet(); await assert.rejects(reviewedClaudeExport(p.feed,opts));
 for(const change of [v=>v.review.feed_digest='invalid',v=>v.feed.items[0].context='changed',v=>v.run.outcome='failed',v=>v.run.started_at='2026-09-14T20:00:00Z',v=>v.feed.email_body='forbidden',v=>v.review.reviewed_by='Steve']){
  const copy=structuredClone(p);change(copy);await assert.rejects(reviewedClaudeExport(copy,opts));
 }
});
test('stale evidence remains stale even with a new export review time',async()=>{
 const p=await packet();p.review.reviewed_at=new Date(NOW+7200_000).toISOString();p.run.completed_at=p.review.reviewed_at;
 const r=await reviewedClaudeExport(p,{...opts,now:NOW+7200_000});assert.ok(Date.parse(r.feed.expires_at)<NOW+7200_000);
});
