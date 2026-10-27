import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export function checkDependencies(root=projectRoot){
 const required=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).dependencies.unpdf;
 let installed='';try{installed=JSON.parse(readFileSync(path.join(root,'node_modules/unpdf/package.json'),'utf8')).version;}catch{}
 return {ok:installed===required,required,installed};
}
export async function getJson(url,timeout=2500){const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!response.ok)throw Error('HTTP '+response.status);return response.json();}
