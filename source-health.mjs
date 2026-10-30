// Display-only feed health. Missing timestamps never imply a successful check.
export function sourceHealth(source,now=Date.now()){
 const parsed=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 const failed=source.status!=='ok',checked=parsed(source.checkedAt||source.fetchedAt),success=parsed(source.fetchedAt);
 const interval=failed?15*60000:source.name==='Himalayas'?24*3600000:6*3600000;
 const next=checked===null?null:checked+interval;
 const count=Number.isFinite(source.count)&&source.count>0?Math.floor(source.count):0;
 return {failed,count,label:failed?(count?'Cached results available':'No results available'):'Feed available',checkedAt:checked===null?null:new Date(checked).toISOString(),lastSuccessAt:success===null?null:new Date(success).toISOString(),ready:next===null||now>=next,minutes:next===null?0:Math.max(0,Math.ceil((next-now)/60000))};
}
