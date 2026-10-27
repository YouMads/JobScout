import {feedKey} from './feed-cache.mjs';
export const RETRY_MS=15*60*1000;
export function feedFresh(source,previous,now=Date.now()){
 if(!previous||previous.formatVersion!==source.formatVersion)return false;
 const stamp=Date.parse(previous.status==='error'?previous.checkedAt:previous.fetchedAt);
 return Number.isFinite(stamp)&&now>=stamp&&now-stamp<(previous.status==='error'?RETRY_MS:(source.ttl||6*3600000));
}
export async function mapLimited(items,limit,fn){
 const result=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;result[index]=await fn(items[index]);}}));
 return result;
}
export async function refreshFeed(source,previous,old,{fetcher=fetch,now=Date.now(),maxBytes=12*1024*1024}={}){
 const checkedAt=new Date(now).toISOString(),base={name:source.name,cacheKey:feedKey(source),formatVersion:source.formatVersion,coverage:source.coverage||'Employer careers feed'};
 try{
  const jobs=[];let validator=null;
  for(let page=1;page<=(source.pages||1);page++){
   const url=new URL(source.url);if(page>1)url.searchParams.set('page',page);
   const reusable=(source.pages||1)===1&&previous?.formatVersion===source.formatVersion&&previous?.validator?.url===url.href;
   const headers={Accept:'application/json'};
   if(reusable&&previous.validator.etag)headers['If-None-Match']=previous.validator.etag;
   else if(reusable&&previous.validator.modified)headers['If-Modified-Since']=previous.validator.modified;
   const response=await fetcher(url,{headers,signal:AbortSignal.timeout(30000)});
   if(response.status===304){
    if(!reusable)throw Error('Unexpected cache validation response');
    return {...base,jobs:old.map(j=>({...j,fetchedAt:checkedAt})),status:'ok',count:old.length,fetchedAt:checkedAt,checkedAt,validator:previous.validator,revalidated:true};
   }
   if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
   const reader=response.body.getReader(),chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Feed exceeds download limit');}chunks.push(value);}
   const batch=source.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
   jobs.push(...batch.map(j=>({...j,cacheKey:feedKey(source),fetchedAt:checkedAt})));
   if((source.pages||1)===1)validator={url:url.href,etag:response.headers.get('etag')||'',modified:response.headers.get('last-modified')||''};
   if(!batch.length)break;
  }
  return {...base,jobs,status:'ok',count:jobs.length,fetchedAt:checkedAt,checkedAt,validator};
 }catch(error){return {...previous,...base,validator:previous?.formatVersion===source.formatVersion?previous?.validator:null,jobs:old,status:'error',count:old.length,error:error.message,checkedAt,fetchedAt:previous?.fetchedAt||null};}
}
