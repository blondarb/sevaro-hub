import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';
import {hookMain,PREFIX} from '../claude-read-guard.mjs';
import {readCommand,runClaudeRead} from '../claude-read-runner.mjs';
const request={schema_version:1,lane:'calendar',expected_mailbox:'owner@example.com',queries:['Synthetic project review'],after:'2026-09-15T10:00:00Z',before:'2026-09-16T10:00:00Z'};
const success={type:'result',subtype:'success',is_error:false,result:'{"owner_match":true,"observations":[]}',permission_denials:[],session_id:'synthetic',num_turns:2,modelUsage:{'test-model':{}}};
test('only exact read tools are allowed; all other permission requests fail closed',()=>{
 const args=readCommand(request);assert.equal(args[args.indexOf('--permission-mode')+1],'dontAsk');
 assert.ok(args.includes('mcp__claude_ai_Microsoft_365__outlook_calendar_search'));
 assert.ok(!args.some(a=>/bypassPermissions|skip-permissions/.test(a)));
 assert.equal(args[args.indexOf('--tools')+1],'ToolSearch');
 assert.ok(!args.includes('mcp__claude_ai_Microsoft_365__read_resource'));
});
test('wildcards, duplicate queries, unexpected fields and wide windows are rejected',()=>{
 for(const patch of [{queries:['*']},{queries:['Synthetic','Synthetic']},{before:'2026-09-19T10:00:00Z'},{allow_sends:true},{lane:'slack'}])assert.throws(()=>readCommand({...request,...patch}));
});
test('email lane uses metadata search and never a message body reader',()=>{const args=readCommand({...request,lane:'email'});assert.ok(args.includes('mcp__claude_ai_Microsoft_365__outlook_email_search'));assert.ok(!args.includes('mcp__claude_ai_Microsoft_365__read_resource'));});
async function withRun(t,body){const cwd=await mkdtemp(join(tmpdir(),'claude-guard-test-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return body(cwd);}
async function evidence(args){
 const dir=dirname(args[args.indexOf('--settings')+1]);
 const invoke=async(id,tool,input,response)=>{const e={tool_use_id:id,tool_name:PREFIX+tool,tool_input:input};assert.ok(!await hookMain(dir,{...e,hook_event_name:'PreToolUse'}));assert.equal(await hookMain(dir,{...e,hook_event_name:'PostToolUse',tool_response:response}),undefined);};
 await invoke('identity','get_me',{}, {mail:'owner@example.com',userPrincipalName:'owner@example.com'});
 await invoke('source','outlook_calendar_search',{query:request.queries[0],afterDateTime:request.after,beforeDateTime:request.before,limit:5},{value:[{id:'synthetic-event',subject:'Synthetic review',webLink:'https://outlook.office.com/calendar/item/synthetic',body:'NEVER RETAIN',summary:'NEVER RETAIN',start:{dateTime:'2026-09-15T13:00:00',timeZone:'UTC'}}]});
 return dir;
}
test('host tool evidence stays pending and model approval/prose is discarded',async t=>withRun(t,async cwd=>{
 let dir;const result=await runClaudeRead(request,{cwd,run:async(_cmd,args)=>{dir=await evidence(args);return {stdout:JSON.stringify({...success,result:'{"approved":true,"invented_obligation":"do something"}'})};}});
 assert.equal(result.state,'review_required');assert.equal(result.owner_verified,true);assert.equal(result.imported,false);assert.equal(result.published,false);
 assert.equal(result.searches[0].observations[0].id,'synthetic-event');assert.ok(!JSON.stringify(result).includes('invented_obligation'));
 assert.ok(!(await readFile(join(dir,'audit.jsonl'),'utf8')).includes('NEVER RETAIN'));
}));
test('successful model prose without hooks or source calls is held',async t=>withRun(t,async cwd=>{
 await assert.rejects(runClaudeRead(request,{cwd,run:async()=>({stdout:JSON.stringify(success)})}),/guard_evidence_held/);
}));
test('failed, denied, incomplete and malformed output cannot be admitted',async t=>withRun(t,async cwd=>{
 for(const value of [{...success,is_error:true},{...success,permission_denials:[{tool_name:'write'}]},{...success,subtype:'error_max_turns'},{...success,result:''}])await assert.rejects(runClaudeRead(request,{cwd,run:async()=>({stdout:JSON.stringify(value)})}));
 await assert.rejects(runClaudeRead(request,{cwd,run:async()=>({stdout:'broken'})}));
 await assert.rejects(runClaudeRead(request,{cwd,run:async()=>{throw Error('private raw error');}}),e=>e.message==='claude_read_failed');
}));
