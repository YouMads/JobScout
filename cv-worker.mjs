import {parentPort,workerData} from 'node:worker_threads';
import {getDocumentProxy,extractText} from 'unpdf';
let pdf;
try{
 pdf=await getDocumentProxy(new Uint8Array(workerData),{verbosity:0,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,maxImageSize:0});
 if(pdf.numPages>20)throw Error('Use a CV with no more than 20 pages.');
 const result=await extractText(pdf,{mergePages:true});
 parentPort.postMessage({text:result.text,totalPages:result.totalPages});
}catch(e){parentPort.postMessage({error:e.message});}
finally{if(pdf)await pdf.destroy();}
