#!/usr/bin/env node
// Validate an export Claude already reviewed. No conversion, approval or publication.
import {homedir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {realpath,lstat} from 'node:fs/promises';
import {privateJson} from './collector.mjs';
import {requireThat,ContextError} from './context.mjs';
import {reviewedClaudeExport,importableClaudeFeed} from './claude-export.mjs';
import {LINK_HOSTS} from './release.mjs';
try {
 const [path,...extra]=process.argv.slice(2);
 requireThat(path && extra.length===0,'invalid_export_options');
 const alias=resolve(homedir(),'ClaudeSync/handoffs/command-center'),root=await realpath(alias);
 requireThat([alias,root].includes(dirname(resolve(path))),'private_output_directory_required');
 const info=await lstat(path);requireThat(info.isFile()&&!info.isSymbolicLink(),'private_file_required');
 const actual=await realpath(path);requireThat(dirname(actual)===root,'private_output_directory_required');
 const now=Date.now(),reviewed=await reviewedClaudeExport(await privateJson(actual),{allowedHosts:LINK_HOSTS,now}),feed=importableClaudeFeed(reviewed),receipt=reviewed.receipt,fresh=Date.parse(feed.expires_at)>now;
 process.stdout.write(JSON.stringify({valid:true,importable:true,fresh,usable_for_snapshot:fresh,source_state:feed.status,source_id:feed.source_id,item_count:feed.items.length,source_observed_at:feed.observed_at,source_expires_at:reviewed.feed.expires_at,effective_expires_at:feed.expires_at,outcome:receipt.outcome,coverage:receipt.coverage,requires_steve_approval:true})+'\n');
} catch(error) {
 process.stderr.write(JSON.stringify({valid:false,error:error instanceof ContextError?error.code:'export_validation_failed'})+'\n');process.exitCode=1;
}
