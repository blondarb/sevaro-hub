#!/usr/bin/env node
// Fixed-target stdin adapter for the retained reviewed communications routines.
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {realpath} from 'node:fs/promises';
import {ContextError} from './context.mjs';
import {MAX_ENCODED_BYTES,stageRepliesExport} from './stage-meeting-export.mjs';

async function stdinBase64() {
  let size=0,parts=[];
  for await (const chunk of process.stdin) {
    size+=chunk.length;
    if(size>MAX_ENCODED_BYTES)throw new ContextError('input_too_large');
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8').trim();
}
try {
  if(process.argv.length!==2)throw new ContextError('invalid_stage_options');
  const root=await realpath(resolve(homedir(),'ClaudeSync/handoffs/command-center'));
  process.stdout.write(JSON.stringify(await stageRepliesExport({root,encoded:await stdinBase64()}))+'\n');
} catch(error) {
  process.stderr.write(JSON.stringify({status:'failed',error:error instanceof ContextError?error.code:'stage_failed'})+'\n');
  process.exitCode=1;
}
