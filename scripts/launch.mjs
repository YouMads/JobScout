import {spawn} from 'node:child_process';
import path from 'node:path';
import {readConfig} from '../config.mjs';
import {projectRoot,checkDependencies,getJson} from './runtime.mjs';
const flags=new Set(process.argv.slice(2));
for(const flag of flags)if(!['--open','--start-ollama'].includes(flag)){console.error('Unknown option: '+flag);process.exit(1);}
function detached(command,args,options={}){
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'ignore',detached:true,windowsHide:true,...options});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
}
async function openBrowser(url){
 const target=process.platform==='win32'?['rundll32',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
 try{await detached(...target);}catch{console.log('Open this address in your browser: '+url);}
}
async function startOllama(config){
 try{await getJson(config.ollamaUrl+'/api/tags',1200);return;}catch{}
 if(new URL(config.ollamaUrl).protocol!=='http:'){console.log('A local HTTPS Ollama endpoint is configured; start that endpoint separately.');return;}
 const candidates=config.ollamaBin?[config.ollamaBin]:['ollama',...(process.platform==='win32'&&process.env.LOCALAPPDATA?[path.join(process.env.LOCALAPPDATA,'Programs/Ollama/ollama.exe')]:[])];
 for(let executable of candidates){
  if(/[\\/]/.test(executable)&&!path.isAbsolute(executable))executable=path.resolve(projectRoot,executable);
  try{await detached(executable,['serve'],{env:{...process.env,OLLAMA_HOST:new URL(config.ollamaUrl).host}});console.log('Starting local Ollama. Job feeds also work while AI is offline.');return;}catch{}
 }
 console.log('Ollama was not found. Open Ollama to enable AI, or set JOBSCOUT_OLLAMA_BIN in .env. Searching and tracking are still available.');
}
async function main(){
 const config=readConfig(projectRoot),dependencies=checkDependencies();
 if(!dependencies.ok)throw Error('Dependencies need setup. Run npm ci --ignore-scripts in this folder, then npm start.');
 let existing;try{existing=await getJson(config.base+'/api/health',1000);}catch{}
 if(existing?.app==='jobscout-local'){
  if(existing.model!==config.model)throw Error('JobScout is already running with another model setting. Stop that server before applying .env changes.');
  console.log('JobScout is already running: '+config.base);if(flags.has('--open'))await openBrowser(config.base);return;
 }
 if(flags.has('--start-ollama'))await startOllama(config);
 const child=spawn(process.execPath,[path.join(projectRoot,'server.mjs')],{cwd:projectRoot,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true});
 const stop=()=>{if(!child.killed)child.kill('SIGINT');};const parentMessage=message=>{if(message?.type==='stop')stop();};if(process.send)process.on('message',parentMessage);process.once('SIGINT',stop);process.once('SIGTERM',stop);
 child.once('error',error=>{console.error('Could not start JobScout: '+error.message);process.exitCode=1;});
 child.on('message',message=>{if(message?.type==='ready'){process.send?.({type:'ready',url:config.base});if(flags.has('--open'))openBrowser(config.base);}});
 child.once('exit',code=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);process.removeListener('message',parentMessage);process.exitCode=code??0;});
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
