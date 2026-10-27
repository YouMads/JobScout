import {lstat,readdir} from 'node:fs/promises';
import path from 'node:path';
export const sourceEntries=['.gitignore','.gitattributes','.env.example','.github','package.json','package-lock.json','config.mjs','countries.mjs','saved-searches.mjs','freshness.mjs','vacancy-check.mjs','feed-cache.mjs','feed-refresh.mjs','local-ai.mjs','workspace.mjs','candidate.mjs','cv.mjs','cv-worker.mjs','server.mjs','scanner.mjs','scan-cache.mjs','scan-control.mjs','watchlist.mjs','duplicates.mjs','sources.mjs','description.mjs','matching.mjs','backup.mjs','lib.mjs','public','scripts','tests','docs','LICENSE','README.md','CONTRIBUTING.md','CODE-GUIDE.md','CHANGELOG.md','Start-JobScout.ps1','Start-JobScout.cmd','Package-Source.ps1'];
export async function sourceFiles(root){
 const files=[];
 async function walk(relative){const target=path.join(root,relative),entry=await lstat(target);if(entry.isSymbolicLink())throw Error('Source entries must not be symbolic links: '+relative);
  if(entry.isDirectory()){for(const child of (await readdir(target)).sort())await walk(relative+'/'+child);}
  else if(entry.isFile()){if(entry.size>2*1024*1024)throw Error('Unexpectedly large source file: '+relative);files.push(relative.replaceAll('\\','/'));}
  else throw Error('Unsupported source entry: '+relative);
 }
 for(const entry of sourceEntries)await walk(entry);return files.sort();
}
