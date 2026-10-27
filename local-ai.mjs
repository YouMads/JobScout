import {modelIdentity} from './config.mjs';
export function localModelName(name){return typeof name==='string'&&name.length<=160&&/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/.test(name)&&!/(?:[:/-])cloud(?:$|[-_:])/i.test(name);}
export function localModels(data){return (Array.isArray(data?.models)?data.models:[]).filter(m=>localModelName(m.name)&&!m.remote_host&&!m.remote_model&&m.details?.format==='gguf'&&m.size>1000000).map(m=>({name:m.name,size:m.size,parameters:String(m.details?.parameter_size||'')}));}
export async function requireLocalModel(name,jsonFetch,base){
 if(!localModelName(name))throw Error('Choose a downloaded local model in Settings. Cloud models are disabled.');
 const models=localModels(await jsonFetch(base+'/api/tags',5000));
 if(!models.some(m=>modelIdentity(m.name)===modelIdentity(name)))throw Error('This local model is unavailable. Open Ollama, then refresh models in Settings.');
 const detail=await jsonFetch(base+'/api/show',10000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:name})});
 if(detail.remote_host||detail.remote_model||detail.details?.format!=='gguf'||!detail.capabilities?.includes('completion'))throw Error('Choose a local text-generation model. Cloud aliases and embedding-only models cannot review jobs.');
 return name;
}
