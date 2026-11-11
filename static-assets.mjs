import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Revalidate on every load so local edits and upgrades never get stuck in cache.
// Only public, explicitly allowlisted assets reach this helper; API data stays no-store.
export async function serveAsset(req,res,file,type){
 const content=await readFile(file);
 const etag='"'+createHash('sha256').update(content).digest('hex')+'"';
 const headers={'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
 const candidates=String(req.headers['if-none-match']||'').split(',').map(value=>value.trim().replace(/^W\//,''));
 if(candidates.includes(etag)||candidates.includes('*')){res.writeHead(304,headers);res.end();return;}
 res.writeHead(200,headers);res.end(content);
}
