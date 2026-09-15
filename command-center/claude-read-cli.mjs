#!/usr/bin/env node
import {realpath,lstat,open,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';import {join,resolve,dirname,basename} from 'node:path';
import {privateJson} from './collector.mjs';import {requireThat} from './context.mjs';
import {runClaudeRead} from './claude-read-runner.mjs';
let lock,lockPath;
try {
  const [requestPath,outputName,...extra]=process.argv.slice(2);
  requireThat(requestPath&&outputName&&!extra.length&&/^claude-read-[a-z0-9-]+\.json$/.test(outputName),'invalid_arguments');
  const root=await realpath(join(homedir(),'ClaudeSync/handoffs/command-center'));
  const info=await lstat(root);requireThat(info.isDirectory()&&info.uid===process.getuid()&&(info.mode&0o077)===0,'private_directory_required');
  const input=await realpath(requestPath);requireThat(dirname(input)===root,'private_input_required');
  const request=await privateJson(input);
  requireThat(['calendar','email'].includes(request.lane),'invalid_read_request');
  lockPath=join(root,'.claude-read-'+request.lane+'.lock');
  lock=await open(lockPath,'wx',0o600);
  // Exclusive output reservation prevents repeating a completed logical run.
  const output=await open(join(root,basename(outputName)),'wx',0o600);
  try {
    const result=await runClaudeRead(request,{cwd:root});
    await output.writeFile(JSON.stringify(result)+'\n');await output.sync();
    process.stdout.write(JSON.stringify({state:result.state,lane:result.lane,started_at:result.started_at,completed_at:result.completed_at,output:outputName,imported:false,published:false})+'\n');
  } finally {await output.close();}
} catch {process.stderr.write(JSON.stringify({state:'held',reason:'read_not_completed',imported:false,published:false})+'\n');process.exitCode=1;}
finally {if(lock){await lock.close();await unlink(lockPath);}}
