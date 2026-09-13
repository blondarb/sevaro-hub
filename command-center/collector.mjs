// Host-only collection. Never bundle this file or its credentials into Sites.
import { readFile, stat, lstat, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collectAsana, githubMetadataFeed, syncHealthFeed } from './adapters.mjs';
import { requireThat, ContextError } from './context.mjs';
import { reviewedClaudeExport, importableClaudeFeed } from './claude-export.mjs';
const execute = promisify(execFile);
export async function privateJson(path) {
  requireThat(await realpath(path) === resolve(path), 'canonical_private_path_required');
  for (let parent = dirname(resolve(path)); ; parent = dirname(parent)) {
    let tracked = false; try { await lstat(join(parent, '.git')); tracked = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    requireThat(!tracked, 'repository_input_forbidden');
    if (parent === dirname(parent)) break;
  }
  const info = await lstat(path);
  requireThat(info.isFile() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o077) === 0 && info.size <= 512_000, 'private_file_required');
  return JSON.parse(await readFile(path, 'utf8'));
}
export async function asanaHost(config) {
  let credential;
  try {
    const file = join(homedir(), '.config/sevaro/asana_pat');
    const info = await stat(file); requireThat((info.mode & 0o077) === 0, 'private_credential_required');
    credential = (await readFile(file, 'utf8')).trim(); requireThat(credential.length > 0);
  } catch { throw new ContextError('permission_required'); }
  return collectAsana({ ...config, credential });
}
export async function githubHost(config) {
  requireThat(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository), 'invalid_target');
  const [owner, name] = config.repository.split('/'), records = [];
  requireThat(Array.isArray(config.entries) && config.entries.length > 0 && config.entries.length <= 50);
  for (const e of config.entries) {
    requireThat(/^[1-9]\d*$/.test(e.target), 'invalid_target');
    try {
      // Native gh authentication remains on the host. Deliberately omit title/body/author/log fields.
      const query = 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){number state isDraft updatedAt}}}';
      const {stdout} = await execute('gh', ['api','graphql','-f','query='+query,'-f','owner='+owner,'-f','name='+name,'-F','number='+e.target], { timeout: 15_000, maxBuffer: 128_000 });
      const result = JSON.parse(stdout); requireThat(!result.errors && result.data?.repository?.pullRequest, 'source_unavailable'); records.push(result.data.repository.pullRequest);
    } catch { throw new ContextError('source_unavailable'); }
  }
  return githubMetadataFeed({ ...config, records, now: new Date().toISOString() });
}
export async function claudeHost(path, options) {
  // A plain feed's self-declared status is insufficient. Require Claude's exact
  // review and actual run receipt; final Site publication still needs Steve.
  return importableClaudeFeed(await reviewedClaudeExport(await privateJson(path),options));
}
export async function healthHost(path, options) { return syncHealthFeed(await privateJson(path), options); }
export async function collectSources(plan) {
  requireThat(plan && Object.keys(plan).sort().join(',') === 'schema_version,sources' && plan.schema_version === 1 && Array.isArray(plan.sources) && plan.sources.length > 0 && plan.sources.length <= 50, 'invalid_plan');
  const allowed = {asana:['source_id','system','project_id','entries','stage_labels'],github:['source_id','system','repository','entries'],claude:['source_id','system','private_export_path','allowed_hosts'],asana_sync:['source_id','system','private_health_path','source_url']};
  const expectedSources=[],feeds=[];
  for(const spec of plan.sources) {
    requireThat(allowed[spec.system] && Object.keys(spec).length === allowed[spec.system].length && Object.keys(spec).every(k=>allowed[spec.system].includes(k)), 'invalid_plan');
    requireThat(/^[a-zA-Z0-9:_./-]{1,160}$/.test(spec.source_id) && !expectedSources.includes(spec.source_id),'invalid_plan'); expectedSources.push(spec.source_id);
    try {
      let feed;
      if(spec.system==='asana') feed=await asanaHost({sourceId:spec.source_id,projectId:spec.project_id,entries:spec.entries,stageLabels:spec.stage_labels});
      if(spec.system==='github') feed=await githubHost({sourceId:spec.source_id,repository:spec.repository,entries:spec.entries});
      if(spec.system==='claude') feed=await claudeHost(spec.private_export_path,{allowedHosts:spec.allowed_hosts});
      if(spec.system==='asana_sync') feed=await healthHost(spec.private_health_path,{sourceId:spec.source_id,sourceUrl:spec.source_url});
      requireThat(feed.source_id===spec.source_id,'wrong_source');feeds.push(feed);
    } catch(error) {
      const now=Date.now(); feeds.push({schema_version:1,source_id:spec.source_id,system:spec.system,observed_at:new Date(now).toISOString(),expires_at:new Date(now+3600_000).toISOString(),status:'unavailable',failure_code:error.code==='permission_required'?'permission_required':'source_unavailable',items:[]});
    }
  }
  return {expected_sources:expectedSources,feeds};
}
