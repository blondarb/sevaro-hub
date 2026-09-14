#!/usr/bin/env node
// Existing routines may call this preparation hook. It never publishes or writes upstream.
import {homedir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {realpath,lstat} from 'node:fs/promises';
import {privateJson} from './collector.mjs';
import {requireThat,ContextError,exact} from './context.mjs';
import {refreshOnce} from './refresh.mjs';
import {importCoworkOutputs} from './cowork-import.mjs';
import {LINK_HOSTS} from './release.mjs';
try {
  const [planPath,...flags]=process.argv.slice(2);
  requireThat(planPath && flags.every(f=>['--include-portfolio','--review-hours=2'].includes(f)) && new Set(flags).size===flags.length,'invalid_refresh_options');
  const alias=resolve(homedir(),'ClaudeSync/handoffs/command-center'),root=await realpath(alias);
  requireThat([alias,root].includes(dirname(resolve(planPath))),'private_output_directory_required');
  const info=await lstat(planPath);requireThat(info.isFile()&&!info.isSymbolicLink(),'private_file_required');
  const canonicalPlan=await realpath(planPath);requireThat(dirname(canonicalPlan)===root,'private_output_directory_required');
  const sessionsRoot=resolve(homedir(),'Library/Application Support/Claude/local-agent-mode-sessions');
  const importExports=async({root,now})=>{
    try {const config=await privateJson(resolve(root,'cowork-import-config.json'));exact(config,['account_id','workspace_id']);return await importCoworkOutputs({root,sessionsRoot,accountId:config.account_id,workspaceId:config.workspace_id,now,allowedHosts:LINK_HOSTS});}
    catch {return {outcomes:['claude:replies','claude:meetings'].map(source_id=>({source_id,state:'held',code:'import_configuration_required'}))};}
  };
  const result=await refreshOnce({root,plan:await privateJson(canonicalPlan),importExports,includePortfolio:flags.includes('--include-portfolio'),ttlMs:flags.includes('--review-hours=2')?7200_000:900_000});
  if(result.notify)process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.ok)process.exitCode=1;
} catch(error) {
  process.stderr.write(JSON.stringify({status:'failed',error:error instanceof ContextError?error.code:'refresh_failed'})+'\n');process.exitCode=1;
}
