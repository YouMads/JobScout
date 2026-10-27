import {Worker} from 'node:worker_threads';
export const MAX_CV_BYTES=6*1024*1024;
export async function extractCv(bytes){
 if(!bytes.length||bytes.length>MAX_CV_BYTES)throw Error('Choose a PDF or UTF-8 text CV smaller than 6 MB.');
 const isPdf=Buffer.from(bytes).subarray(0,1024).includes(Buffer.from('%PDF-'));
 let result;
 if(isPdf){
  result=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./cv-worker.mjs',import.meta.url),{workerData:new Uint8Array(bytes),resourceLimits:{maxOldGenerationSizeMb:192}});
   let settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>finish(Error('PDF extraction timed out. Paste the CV text instead.')),20000);
   worker.once('message',v=>finish(v.error?Error('Could not read this PDF. Use an unlocked text PDF or paste its text. '+(v.error.includes('20 pages')?'Maximum 20 pages.':'')):null,v));
   worker.once('error',()=>finish(Error('PDF extraction could not finish. Paste the CV text instead.')));
   worker.once('exit',()=>{if(!settled)finish(Error('PDF extraction stopped. Paste the CV text instead.'));});
  });
 }else{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(text.includes('\0')||/^\s*(?:PK\x03\x04|<html)/i.test(text))throw Error('Use PDF, plain text, or Markdown. For Word documents, paste the text.');
  result={text,totalPages:null};
 }
 const full=String(result.text||'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
 if(full.replace(/\s/g,'').length<20)throw Error('No readable CV text found. Scanned PDFs need OCR; paste their text instead.');
 return {text:full.slice(0,16000),totalPages:result.totalPages,truncated:full.length>16000};
}
