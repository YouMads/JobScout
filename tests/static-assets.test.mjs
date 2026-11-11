import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {serveAsset} from '../static-assets.mjs';
test('public assets revalidate unchanged content and refresh changed content',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'jobscout-assets-')),file=path.join(dir,'app.js');
 const request=async validator=>{const result={};await serveAsset({headers:{'if-none-match':validator}},{writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=body;}},file,'text/javascript');return result;};
 try{
  await writeFile(file,'first');const first=await request();assert.equal(first.status,200);assert.equal(first.body.toString(),'first');assert.equal(first.headers['Cache-Control'],'no-cache');
  for(const tag of [first.headers.ETag,'W/'+first.headers.ETag,'"other", '+first.headers.ETag,'*']){const cached=await request(tag);assert.equal(cached.status,304);assert.equal(cached.body,undefined);assert.equal(cached.headers['Content-Security-Policy'],first.headers['Content-Security-Policy']);}
  await writeFile(file,'second');const updated=await request(first.headers.ETag);assert.equal(updated.status,200);assert.equal(updated.body.toString(),'second');assert.notEqual(updated.headers.ETag,first.headers.ETag);
 }finally{await rm(dir,{recursive:true,force:true});}
});
