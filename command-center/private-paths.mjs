import {mkdir,realpath,lstat} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {requireThat} from './context.mjs';
export async function privatePaths(configuredRoot,inputPath,outputPath) {
  const alias=resolve(configuredRoot);
  await mkdir(alias,{recursive:true,mode:0o700});
  const root=await realpath(alias),directory=await lstat(alias);
  requireThat(directory.isDirectory() && !directory.isSymbolicLink() && directory.uid===process.getuid() && (directory.mode & 0o077)===0,'private_output_directory_required');
  // Trust only the existing configured root alias and its resolved location, not arbitrary links.
  for(const path of [inputPath,outputPath])requireThat([alias,root].includes(dirname(resolve(path))),'private_output_directory_required');
  const inputInfo=await lstat(inputPath);
  requireThat(inputInfo.isFile() && !inputInfo.isSymbolicLink(),'private_file_required');
  const input=await realpath(inputPath);
  requireThat(dirname(input)===root && basename(outputPath)==='proposed-current-context.json','private_output_directory_required');
  return {root,input,destination:resolve(root,'proposed-current-context.json')};
}
