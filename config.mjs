import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
export function readConfig(root,{env=process.env}={}){
 let file={};try{file=parseEnv(readFileSync(path.join(root,'.env'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Could not read the local .env settings: '+error.message);}
 const setting=(name,fallback)=>Object.hasOwn(env,name)?env[name]:Object.hasOwn(file,name)?file[name]:fallback;
 const rawPort=Object.hasOwn(env,'JOBSCOUT_PORT')?env.JOBSCOUT_PORT:Object.hasOwn(env,'PORT')?env.PORT:file.JOBSCOUT_PORT??file.PORT??'4317';
 if(!/^\d+$/.test(String(rawPort))||Number(rawPort)<1||Number(rawPort)>65535)throw Error('JOBSCOUT_PORT must be a whole number from 1 to 65535.');
 const port=Number(rawPort),model=String(setting('JOBSCOUT_MODEL','qwen3:4b')).trim();
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/.test(model)||model.length>160||/(?:[:/-])cloud(?:$|[-_:])/i.test(model))throw Error('JOBSCOUT_MODEL must name a downloaded local Ollama model, without a cloud suffix.');
 let ollama;try{ollama=new URL(setting('JOBSCOUT_OLLAMA_URL','http://127.0.0.1:11434'));}catch{throw Error('JOBSCOUT_OLLAMA_URL must be a local Ollama http(s) address.');}
 if(!['http:','https:'].includes(ollama.protocol)||!['localhost','127.0.0.1','[::1]'].includes(ollama.hostname)||ollama.username||ollama.password||ollama.pathname!=='/'||ollama.search||ollama.hash)throw Error('JOBSCOUT_OLLAMA_URL must use loopback (127.0.0.1, localhost or ::1), without credentials or a path.');
 if(ollama.hostname==='localhost')ollama.hostname='127.0.0.1';
 const rawData=String(setting('JOBSCOUT_DATA_DIR','data')).trim();if(!rawData)throw Error('JOBSCOUT_DATA_DIR cannot be empty.');
 const ollamaBin=String(setting('JOBSCOUT_OLLAMA_BIN','')).trim();if(/[\0\r\n]/.test(ollamaBin))throw Error('JOBSCOUT_OLLAMA_BIN must be an executable path.');
 return {root:path.resolve(root),port,base:'http://127.0.0.1:'+port,model,ollamaUrl:ollama.origin,dataDir:path.resolve(root,rawData),ollamaBin};
}
export const modelIdentity=name=>String(name||'').includes(':')?String(name):String(name)+':latest';
export const modelInstalled=(models,name)=>Array.isArray(models)&&models.some(item=>modelIdentity(item?.name)===modelIdentity(name));
