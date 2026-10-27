import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {projectRoot} from './runtime.mjs';
import {sourceFiles} from './source-files.mjs';
async function main(){
 const files=await sourceFiles(projectRoot),allowed=new Set(files),problems=[];
 const git=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:projectRoot,encoding:'utf8',windowsHide:true});
 if(git.status===0)for(const file of git.stdout.split('\0').filter(Boolean))if(!allowed.has(file))problems.push('Not part of the reviewed source list: '+file);
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,/[A-Za-z]:[\\/]Users[\\/][^\s/\\]+/];
 for(const file of files){if(/\.(png|jpg|jpeg|webp|ico)$/i.test(file))continue;const content=await readFile(path.join(projectRoot,file),'utf8');if(patterns.some(pattern=>pattern.test(content)))problems.push('Review a possible credential or personal machine path in '+file);}
 if(problems.length)throw Error(problems.join('\n'));
 console.log('Source check passed: '+files.length+' source files. Local settings, runtime data, exports and model weights are excluded.');
 if(git.status!==0)console.log('Git index unavailable; the source archive manifest was checked.');
 const pkg=JSON.parse(await readFile(path.join(projectRoot,'package.json'),'utf8'));
 const license=await readFile(path.join(projectRoot,'LICENSE'),'utf8');
 if(pkg.license!=='AGPL-3.0-only'||!license.includes('GNU AFFERO GENERAL PUBLIC LICENSE'))throw Error('Package and LICENSE must identify AGPL-3.0.');
 console.log('License: AGPL-3.0-only. Automated checks do not guarantee that files contain no private information.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
