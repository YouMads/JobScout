// Country-specific feed variants must never share jobs or freshness timestamps.
export const feedKey=s=>s.cacheKey||(s.name==='Himalayas'?'Himalayas:CY':s.name);
export const jobFeedKey=j=>j.cacheKey||(j.source==='Himalayas'?'Himalayas:CY':j.source);
export function mergeFeedCache(cache,results,updated=new Date().toISOString()){
 const keys=new Set(results.map(feedKey)),rows=[...cache.sources.filter(s=>!keys.has(feedKey(s))),...results.map(({jobs,...s})=>s)];
 const variants=rows.filter(s=>s.name==='Himalayas').sort((a,b)=>String(b.fetchedAt).localeCompare(String(a.fetchedAt))),keep=new Set(variants.slice(0,12).map(feedKey));
 const sources=rows.filter(s=>s.name!=='Himalayas'||keep.has(feedKey(s))),allowed=new Set(sources.map(feedKey));
 return {jobs:[...cache.jobs.filter(j=>!keys.has(jobFeedKey(j))),...results.flatMap(r=>r.jobs)].filter(j=>allowed.has(jobFeedKey(j))),sources,updated};
}
