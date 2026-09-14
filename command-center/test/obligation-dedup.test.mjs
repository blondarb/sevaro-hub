import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble,resolveReference} from '../context.mjs';
import {validateSnapshot} from '../release.mjs';
import {NOW,row,source,options} from './fixtures.mjs';
const opts={...options,expectedSources:['asana:portfolio','claude:replies','claude:meetings'],allowedHosts:['app.asana.com','outlook.office.com']};
const linked=(id,changes={})=>row({item_id:id+':action-1',source_id:id,source_url:'https://outlook.office.com/mail/id/fictional',same_obligation_as:{item_id:row().item_id,source_revision:row().source_revision},...changes});
const feeds=()=>[source(),source({source_id:'claude:replies',system:'claude',items:[linked('claude:replies')]}),source({source_id:'claude:meetings',system:'claude',items:[linked('claude:meetings')]})];
test('one obligation across Asana, email and meeting retains Asana state and both evidence links',async()=>{
 const s=await assemble(feeds(),opts);assert.equal(s.items.length,1);assert.equal(s.items[0].evidence.length,2);
 const {number,evidence,...item}=s.items[0];assert.deepEqual(item,row());assert.equal(number,1);
 await validateSnapshot(s,NOW);assert.deepEqual(await assemble(feeds().reverse(),opts),s);
 assert.deepEqual(resolveReference(s,{snapshot_id:s.snapshot_id,view_id:s.view_id},'number one',NOW).item.evidence,evidence);
});
test('similar names without explicit same-obligation assertions remain distinct',async()=>{
 const fs=feeds();for(const f of fs.slice(1))delete f.items[0].same_obligation_as;
 assert.equal((await assemble(fs,opts)).items.length,3);
});
test('revision, state, due and action disagreements require reconciliation',async()=>{
 for(const change of [{status:'Graduate'},{due:'2026-09-14'},{requires_steve:false},{action_state:'none'},{kind:'response'},{same_obligation_as:{item_id:row().item_id,source_revision:'older'}}]) {
  const fs=feeds();Object.assign(fs[1].items[0],change);await assert.rejects(assemble(fs,opts),/source_conflict/);
 }
});
test('missing, expired and filtered-out authoritative targets cannot hide an obligation',async()=>{
 for(const mutate of [fs=>fs[0].items=[],fs=>fs[0].expires_at=new Date(NOW).toISOString(),fs=>{fs[0].items[0].kind='project';fs[0].items[0].requires_steve=false;}]) {
  const fs=feeds();mutate(fs);await assert.rejects(assemble(fs,opts),/source_conflict/);
 }
});
test('producer cannot inject evidence or target another Claude card',async()=>{
 const fs=feeds();fs[0].items[0].evidence=[{item_id:'claude:fake',source_id:'claude:meetings',source_revision:'1',source_url:'https://outlook.office.com/mail/id/fictional'}];
 await assert.rejects(assemble(fs,opts),/source_conflict/);
 delete fs[0].items[0].evidence;fs[1].items[0].same_obligation_as.item_id='claude:meetings:action-1';
 await assert.rejects(assemble(fs,opts),/source_conflict/);
});
