#!/usr/bin/env node
// Explicit private inputs only: works in a cloud workspace or locked Mac without
// HOME, Keychain, ClaudeSync, a browser, network requests or provider credentials.
import {open,lstat,realpath,link,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ContextError,requireThat} from './context.mjs';
import {preparePortableRefresh,bindPortableRefresh,portableSummary} from './portable-refresh.mjs';

async function privateRoot(path) {
  const alias=resolve(path),root=await realpath(alias),info=await lstat(alias);
  requireThat(!info.isSymbolicLink()&&info.isDirectory()&&info.uid===process.getuid()&&(info.mode&0o077)===0,'private_directory_required');
  for(let p=root;;p=dirname(p)) {
    try {await lstat(join(p,'.git'));throw new ContextError('repository_output_forbidden');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(p===dirname(p))break;
  }
  return root;
}
function filename(name) {requireThat(typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,110}\.json$/.test(name),'invalid_filename');return name;}
async function privateRead(root,name) {
  const fd=await open(join(root,filename(name)),constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const info=await fd.stat();requireThat(info.isFile()&&info.uid===process.getuid()&&(info.mode&0o077)===0&&info.size<=512000,'private_file_required');
    const data=await fd.readFile();requireThat(data.length<=512000,'input_too_large');return JSON.parse(data.toString('utf8'));
  } finally {await fd.close();}
}
async function privateWrite(root,name,result) {
  const dest=join(root,filename(name)),temp=join(root,'.portable-refresh-'+randomUUID()+'.tmp');
  const fd=await open(temp,'wx',0o600);
  try {await fd.writeFile(JSON.stringify(result)+'\n');await fd.sync();}finally{await fd.close();}
  try {await link(temp,dest);}finally{await unlink(temp);}
  const directory=await open(root,'r');try{await directory.sync();}finally{await directory.close();}
}
try {
  requireThat(typeof process.getuid==='function','posix_runtime_required');
  const args=process.argv.slice(2),[command,rootPath,inputName,grantName,outputName,digest,projectId,versionId,reviewName]=args;
  requireThat(['prepare','bind'].includes(command)&&args.length===(command==='prepare'?8:9),'invalid_options');
  requireThat(/^[a-f0-9]{64}$/.test(digest??''),'refresh_anchor_required');
  requireThat(new Set([inputName,grantName,outputName,...(reviewName?[reviewName]:[])]).size===(reviewName?4:3),'distinct_files_required');
  const root=await privateRoot(rootPath),input=await privateRead(root,inputName),grant=await privateRead(root,grantName);
  const anchor={authorization_digest:digest,site_project_id:projectId,saved_version_id:versionId};
  const result=command==='prepare'?await preparePortableRefresh(input,grant,anchor):await bindPortableRefresh(input,await privateRead(root,reviewName),grant,anchor);
  await privateWrite(root,outputName,result);
  process.stdout.write(JSON.stringify(await portableSummary(command,result))+'\n');
} catch(error) {
  // Never echo payloads, paths, parser diagnostics or provider exceptions.
  process.stderr.write(JSON.stringify({state:'failed',error:error instanceof ContextError?error.code:error.code==='EEXIST'?'output_exists':'private_io_failed'})+'\n');process.exitCode=1;
}
