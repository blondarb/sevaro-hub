// Host-side controls. Never treat model prose as identity or source evidence.
import {readFile,appendFile,lstat,mkdir,rmdir} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const PREFIX='mcp__claude_ai_Microsoft_365__';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const idTool=PREFIX+'get_me';
export const searchTool=r=>PREFIX+(r.lane==='calendar'?'outlook_calendar_search':'outlook_email_search');
export function permit(request,event,audit) {
  const {tool_name:name,tool_input:input,tool_use_id:id}=event;
  if(typeof id!=='string'||!id||!plain(input)) return 'invalid_tool_call';
  if(audit.some(e=>e.state==='denied'||e.state==='failed')) return 'run_held';
  if(audit.filter(e=>e.state==='permitted').length>=12) return 'call_limit';
  if(audit.some(e=>e.id===id)) return 'duplicate_call';
  if(name==='ToolSearch') return null; // discovery only; every invoked tool is guarded
  if([idTool,PREFIX+'get_granted_scopes'].includes(name)) return Object.keys(input).length?'unexpected_profile_arguments':null;
  if(name!==searchTool(request)) return 'tool_not_allowed';
  if(!audit.some(e=>e.state==='observed'&&e.tool===idTool&&e.owner_match===true)) return 'owner_not_verified';
  const keys=['query','afterDateTime','beforeDateTime','limit'];
  if(Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>!(k in input))) return 'unexpected_search_arguments';
  if(!request.queries.includes(input.query)||input.afterDateTime!==request.after||input.beforeDateTime!==request.before||input.limit!==5) return 'search_scope_mismatch';
  if(audit.some(e=>e.state==='permitted'&&e.tool===name&&e.query===input.query)) return 'query_already_attempted';
  return null;
}

// Only recognized structured envelopes are parsed. Unknown prose is held, not
// searched for a convenient identity string or converted by another model.
export function unwrap(value) {
  if(Array.isArray(value)) return value.length===1?unwrap(value[0]):null;
  if(typeof value==='string') {
    let text=value.trim();
    if(text.startsWith('```json\n')&&text.endsWith('\n```')) text=text.slice(8,-4);
    try{return JSON.parse(text);}catch{return null;}
  }
  if(!plain(value)||value.isError===true) return null;
  if(value.type==='text'&&typeof value.text==='string') return unwrap(value.text);
  if(value.structuredContent) return unwrap(value.structuredContent);
  if(Array.isArray(value.content)) {
    const blocks=value.content.filter(b=>b.type==='text');
    return blocks.length===1?unwrap(blocks[0].text):null;
  }
  return value;
}
export function observe(request,event,pre) {
  if(!pre||pre.state!=='permitted'||pre.tool!==event.tool_name||pre.input_digest!==digest(event.tool_input)) throw Error('unbound_tool_result');
  const base={state:'observed',id:event.tool_use_id,tool:event.tool_name,response_digest:digest(event.tool_response)};
  if(event.tool_name==='ToolSearch') return base;
  const data=unwrap(event.tool_response);
  if(event.tool_name===idTool) {
    if(!data) throw Error('unrecognized_tool_result');
    const profile=plain(data.data)?data.data:data;
    const expected=request.expected_mailbox.toLowerCase();
    if(typeof profile.mail!=='string'||typeof profile.userPrincipalName!=='string'||profile.mail.toLowerCase()!==expected||profile.userPrincipalName.toLowerCase()!==expected) throw Error('owner_mismatch');
    return {...base,owner_match:true}; // Do not retain profile or unrelated attributes.
  }
  if(event.tool_name===PREFIX+'get_granted_scopes') {if(!data)throw Error('unrecognized_tool_result');return base;}
  if(event.tool_name!==searchTool(request)) throw Error('unexpected_tool_result');
  let rows=Array.isArray(data?.value)?data.value:Array.isArray(data?.results)?data.results:null;
  // Native Microsoft 365 MCP returns one JSON text block per row, followed
  // by a JSON totalResultCount block. Do not parse arbitrary natural language.
  const blocks=Array.isArray(event.tool_response)?event.tool_response:event.tool_response?.isError!==true?event.tool_response?.content:null;
  if(!rows&&Array.isArray(blocks)&&blocks.length>0&&blocks.length<=6) {
    const values=blocks.map(unwrap),count=values.at(-1);
    if(plain(count)&&Object.keys(count).length===1&&Number.isSafeInteger(count.totalResultCount)&&count.totalResultCount>=values.length-1&&values.slice(0,-1).every(plain)) rows=values.slice(0,-1);
  }
  if(!rows||rows.length>5) throw Error('unrecognized_search_result');
  const fields=request.lane==='calendar'?['id','subject','webLink','start','end','lastModifiedDateTime']:['id','subject','webLink','receivedDateTime','sentDateTime','lastModifiedDateTime'];
  const observations=rows.map(row=>{
    if(!plain(row)||typeof row.id!=='string'||typeof row.subject!=='string'||typeof row.webLink!=='string') throw Error('missing_source_metadata');
    const url=new URL(row.webLink);
    if(url.protocol!=='https:'||!['outlook.office365.com','outlook.office.com','outlook.live.com'].includes(url.hostname)||url.username||url.password) throw Error('invalid_source_link');
    const out={};
    for(const field of fields) if(row[field]!==undefined) {
      if(['start','end'].includes(field)&&plain(row[field])) {
        const {dateTime,timeZone}=row[field];
        if(typeof dateTime!=='string'||typeof timeZone!=='string'||dateTime.length>60||timeZone.length>100) throw Error('invalid_time_metadata');
        out[field]={dateTime,timeZone};
      } else {
        if(typeof row[field]!=='string'||row[field].length>3000) throw Error('invalid_source_metadata');
        out[field]=row[field];
      }
    }
    return out;
  });
  return {...base,query:pre.query,observations};
}
export function verifyAudit(request,audit) {
  if(!audit.length||audit.some(e=>['failed','denied'].includes(e.state))) throw Error('guard_evidence_held');
  const pres=audit.filter(e=>e.state==='permitted'),posts=audit.filter(e=>e.state==='observed');
  if(pres.length!==posts.length||pres.some(p=>posts.filter(e=>e.id===p.id&&e.tool===p.tool).length!==1)) throw Error('incomplete_tool_evidence');
  if(!posts.some(e=>e.tool===idTool&&e.owner_match===true)) throw Error('owner_evidence_missing');
  const searches=posts.filter(e=>e.tool===searchTool(request));
  if(searches.length!==request.queries.length||request.queries.some(q=>searches.filter(e=>e.query===q).length!==1)) throw Error('source_evidence_missing');
  return searches;
}
export async function hookMain(dir,event) {
  const info=await lstat(dir);
  if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid()||(info.mode&0o077)) throw Error('private_run_required');
  const lock=join(dir,'guard.lock');let acquired=false;
  for(let attempt=0;attempt<80;attempt++) {
    try{await mkdir(lock,{mode:0o700});acquired=true;break;}
    catch(e){if(e.code!=='EEXIST')throw e;await setTimeout(25);}
  }
  if(!acquired) throw Error('guard_busy');
  try {
  const request=JSON.parse(await readFile(join(dir,'request.json'),'utf8'));
  const path=join(dir,'audit.jsonl');
  const audit=(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const common={id:event.tool_use_id,tool:event.tool_name};
  let record,reason;
  if(event.hook_event_name==='PreToolUse') {
    reason=permit(request,event,audit);
    record={...common,state:reason?'denied':'permitted',input_digest:digest(event.tool_input)};
    if(!reason&&event.tool_name===searchTool(request)) record.query=event.tool_input.query;
  } else if(event.hook_event_name==='PostToolUse') {
    try{record=observe(request,event,audit.find(e=>e.id===event.tool_use_id&&e.state==='permitted'));}
    catch{reason='source_evidence_unverified';record={...common,state:'failed'};
      // Format diagnostics contain types/known key names only, never contents.
      const shape=(v,depth=0)=>{
        if(depth>7)return typeof v;
        if(Array.isArray(v))return {type:'array',length:v.length,elements:v.slice(0,5).map(x=>shape(x,depth+1))};
        if(typeof v==='string'&&unwrap(v))return {json:shape(unwrap(v),depth+1)};
        if(!plain(v))return {type:typeof v};
        return Object.fromEntries(Object.keys(v).filter(k=>/^[a-zA-Z_]{1,60}$/.test(k)).slice(0,30).map(k=>[k,shape(v[k],depth+1)]));
      };
      record.response_shape=shape(event.tool_response);
    }
  } else if(event.hook_event_name==='PostToolUseFailure') {reason='source_call_failed';record={...common,state:'failed'};}
  else throw Error('unexpected_hook');
  await appendFile(path,JSON.stringify(record)+'\n',{mode:0o600});
  return reason;
  } finally {await rmdir(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>512_000)throw Error('input_too_large');}
    const event=JSON.parse(raw),reason=await hookMain(process.argv[2],event);
    if(reason){process.stderr.write('Scoped read guard held this call. Do not retry or broaden the request.\n');process.exitCode=2;}
  }catch{process.stderr.write('Scoped read guard unavailable.\n');process.exitCode=2;}
}
