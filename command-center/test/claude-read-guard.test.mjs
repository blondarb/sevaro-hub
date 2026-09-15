import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {permit,observe,verifyAudit,hookMain,PREFIX,searchTool} from '../claude-read-guard.mjs';
const request={lane:'calendar',expected_mailbox:'owner@example.com',queries:['Synthetic project review'],after:'2026-09-15T10:00:00Z',before:'2026-09-16T10:00:00Z'};
const input={query:request.queries[0],afterDateTime:request.after,beforeDateTime:request.before,limit:5};
const event={tool_name:searchTool(request),tool_use_id:'search-1',tool_input:input};
const owner={state:'observed',tool:PREFIX+'get_me',owner_match:true};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const pre=e=>({state:'permitted',id:e.tool_use_id,tool:e.tool_name,input_digest:digest(e.tool_input),query:e.tool_input.query});
test('search requires actual earlier owner evidence, not model text',()=>{
 assert.equal(permit(request,event,[]),'owner_not_verified');
 assert.equal(permit(request,event,[{owner_match:true}]),'owner_not_verified');
 assert.equal(permit(request,event,[owner]),null);
});
test('source call cannot broaden query, timeframe, count or mailbox',()=>{
 for(const patch of [{query:'*'},{query:'Different project'},{beforeDateTime:'2026-09-19T10:00:00Z'},{limit:25},{offset:5},{cursor:'synthetic'},{mailboxOwnerEmail:'other@example.com'},{calendarOwnerEmail:'other@example.com'},{attendee:'someone@example.com'}]) assert.ok(permit(request,{...event,tool_input:{...input,...patch}},[owner]));
});
test('undeclared write, raw read and other source tools are denied',()=>{
 for(const tool_name of ['Bash','Read','Write',PREFIX+'read_resource',PREFIX+'outlook_email_search','mcp__fyxer__get_recording']) assert.equal(permit(request,{...event,tool_name},[owner]),'tool_not_allowed');
});
test('a query cannot be retried and any held call stops subsequent reads',()=>{
 assert.equal(permit(request,{...event,tool_use_id:'retry'},[owner,pre(event)]),'query_already_attempted');
 assert.equal(permit(request,event,[owner,{state:'denied'}]),'run_held');
 assert.equal(permit(request,event,[owner,{state:'failed'}]),'run_held');
});
test('profile tool response must contain matching mail and UPN',()=>{
 const e={tool_name:PREFIX+'get_me',tool_input:{},tool_use_id:'owner'};
 for(const response of [{mail:'other@example.com',userPrincipalName:'other@example.com'},{mail:'owner@example.com'},'owner_match: true'])assert.throws(()=>observe(request,{...e,tool_response:response},pre(e)));
 assert.equal(observe(request,{...e,tool_response:{content:[{type:'text',text:JSON.stringify({mail:'owner@example.com',userPrincipalName:'owner@example.com'})}]}},pre(e)).owner_match,true);
});
test('changed tool input and unbound results are rejected',()=>{
 assert.throws(()=>observe(request,{...event,tool_response:{value:[]}},undefined));
 assert.throws(()=>observe(request,{...event,tool_input:{...input,limit:25},tool_response:{value:[]}},pre(event)));
});
test('unrecognized result/error is held; structured empty result has limited meaning',()=>{
 for(const tool_response of [{isError:true,content:[]},{text:'No results'},null,{}])assert.throws(()=>observe(request,{...event,tool_response},pre(event)));
 const result=observe(request,{...event,tool_response:{value:[]}},pre(event));assert.deepEqual(result.observations,[]);assert.equal(result.closed,undefined);
});
test('unknown fields, bodies, previews, attendees and arbitrary links never persist',()=>{
 const row={id:'synthetic',subject:'Synthetic meeting',webLink:'https://outlook.office.com/calendar/item/test',body:'PRIVATE SYNTHETIC BODY',summary:'PRIVATE SYNTHETIC SUMMARY',attendees:['private@example.com']};
 const result=observe(request,{...event,tool_response:{value:[row]}},pre(event));
 assert.deepEqual(result.observations,[{id:row.id,subject:row.subject,webLink:row.webLink}]);
 for(const link of ['https://evil.example/item','https://outlook.office.com.evil.example/item','https://u:p@outlook.office.com/item'])assert.throws(()=>observe(request,{...event,tool_response:{value:[{...row,webLink:link}]}},pre(event)));
});
test('native MCP calendar blocks retain source fields and reject malformed trailers',()=>{
 const block=x=>({type:'text',text:JSON.stringify(x)});
 const row={id:'synthetic-event',uri:'synthetic://event',subject:'Synthetic meeting',webLink:'https://outlook.office365.com/owa/?itemid=synthetic',summary:'DO NOT RETAIN',attendees:['private@example.com'],start:{dateTime:'2026-09-15T13:00:00',timeZone:'UTC'},end:{dateTime:'2026-09-15T14:00:00',timeZone:'UTC'}};
 const result=observe(request,{...event,tool_response:[block(row),block({totalResultCount:1})]},pre(event));
 assert.equal(result.observations[0].id,'synthetic-event');assert.ok(!JSON.stringify(result).includes('DO NOT RETAIN'));
 assert.deepEqual(observe(request,{...event,tool_response:[block({totalResultCount:0})]},pre(event)).observations,[]);
 for(const response of [[block(row)],[block(row),block({totalResultCount:0})],[block(row),block({totalResultCount:1,extra:true})]])assert.throws(()=>observe(request,{...event,tool_response:response},pre(event)));
});
test('owner match alone and incomplete source trace never pass final verification',()=>{
 for(const audit of [[],[owner],[owner,pre(event)],[owner,{state:'failed'}]])assert.throws(()=>verifyAudit(request,audit));
});
test('concurrent duplicate calls reserve at most one search in the real audit',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'claude-guard-concurrent-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await writeFile(join(dir,'request.json'),JSON.stringify(request),{mode:0o600});await writeFile(join(dir,'audit.jsonl'),JSON.stringify(owner)+'\n',{mode:0o600});
 const results=await Promise.all(['a','b'].map(tool_use_id=>hookMain(dir,{...event,tool_use_id,hook_event_name:'PreToolUse'})));
 assert.equal(results.filter(r=>!r).length,1);assert.equal(results.filter(Boolean).length,1);
 const audit=(await readFile(join(dir,'audit.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(audit.filter(r=>r.state==='permitted').length,1);
});
