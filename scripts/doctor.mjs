import {readConfig,modelInstalled} from '../config.mjs';
import {projectRoot,checkDependencies,getJson} from './runtime.mjs';
async function main(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Use Node.js 22 or newer.');
 const config=readConfig(projectRoot),dependencies=checkDependencies();
 console.log('Node.js: '+process.versions.node);
 console.log('Dependencies: '+(dependencies.ok?'ready':'run npm ci --ignore-scripts'));
 console.log('Dashboard address: '+config.base);
 console.log('Local model: '+config.model);
 try{const tags=await getJson(config.ollamaUrl+'/api/tags');console.log('Ollama: online');console.log(modelInstalled(tags.models,config.model)?'Model: installed':'Model: not installed; run ollama pull '+config.model);}
 catch{console.log('Ollama: offline. Open Ollama for AI reviews; job feeds and tracking still work.');}
 console.log('No API key is needed. Personal browser profiles are not part of the source repository.');
 if(!dependencies.ok)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
