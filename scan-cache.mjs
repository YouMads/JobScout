import {createHash,randomUUID} from 'node:crypto';
import {scanUrl} from './scanner.mjs';

// Public-page results and pasted text stay in bounded process memory only.
export function scanCacheKey({url,pastedText=''}){
 return createHash('sha256').update(scanUrl(url).href+'\n'+String(pastedText).trim()).digest('hex');
}
export function createScanCache({now=Date.now,maxEntries=4,ttlMs=20*60000,reuseMs=5*60000}={}){
 const entries=new Map();
 function prune(){for(const [id,record] of entries)if(now()-record.created>=ttlMs)entries.delete(id);}
 return {
  get(id){prune();const record=entries.get(id);if(!record)throw Error('This scan expired. Read the website again.');return record;},
  find(key){prune();return [...entries.values()].reverse().find(record=>record.key===key&&now()-record.created<reuseMs)||null;},
  put(key,scan){prune();while(entries.size>=maxEntries)entries.delete(entries.keys().next().value);const record={id:randomUUID(),key,scan,created:now(),result:null};entries.set(record.id,record);return record;},
  complete(id,result){prune();const record=entries.get(id);if(record)record.result=result;},
  get size(){prune();return entries.size;}
 };
}
