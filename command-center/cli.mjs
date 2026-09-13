#!/usr/bin/env node
// Offline preparation only. No automatic approval, publication or source write command.
import { writeFile, mkdir, realpath, rename, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { privateJson, collectSources } from './collector.mjs';
import { assemble, ContextError, requireThat } from './context.mjs';
import { prepareRelease, LINK_HOSTS } from './release.mjs';
async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  requireThat(['prepare','collect'].includes(command) && inputPath && outputPath, 'usage_prepare_private_input_private_output');
  const privateRoot = resolve(homedir(), 'ClaudeSync/handoffs/command-center');
  await mkdir(privateRoot, {recursive:true,mode:0o700});
  const directory = await lstat(privateRoot);
  requireThat(directory.isDirectory() && !directory.isSymbolicLink() && directory.uid === process.getuid() && (directory.mode & 0o077) === 0, 'private_output_directory_required');
  const destination = resolve(outputPath);
  requireThat(destination === resolve(privateRoot, 'proposed-current-context.json') && dirname(resolve(inputPath)) === privateRoot && dirname(destination) === privateRoot && await realpath(privateRoot) === privateRoot, 'private_output_directory_required');
  const config = await privateJson(inputPath);
  const input = command === 'collect' ? await collectSources(config) : config;
  requireThat(input && Object.keys(input).sort().join(',') === 'expected_sources,feeds', 'unexpected_fields');
  const snapshot = await assemble(input.feeds, {expectedSources:input.expected_sources, allowedHosts:LINK_HOSTS, classification:'executive-pending-review'});
  const release = await prepareRelease(snapshot);
  await mkdir(dirname(destination), {recursive:true,mode:0o700});
  // Fixed current/prior slots; reject existing unsafe paths before bounded rotation.
  const prior = resolve(privateRoot, 'proposed-prior-context.json');
  for (const path of [destination, prior]) {
    try { const info = await lstat(path); requireThat(info.isFile() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o077) === 0, 'private_file_required'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const temporary = resolve(privateRoot, '.proposed-context.tmp');
  await writeFile(temporary, release.payload+'\n', {mode:0o600,flag:'wx'});
  try { await rename(destination, prior); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rename(temporary, destination);
  process.stdout.write(JSON.stringify({status:'review_required',digest:release.digest,expires_at:release.expires_at,item_count:snapshot.items.length})+'\n');
}
main().catch(error=>{ process.stderr.write(JSON.stringify({error:error instanceof ContextError ? error.code : 'preparation_failed'})+'\n');process.exitCode=1; });
