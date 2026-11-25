import {parentPort,workerData} from 'node:worker_threads';
import {getDocumentProxy,extractText} from 'unpdf';
let pdf,result;
try{
 pdf=await getDocumentProxy(new Uint8Array(workerData),{verbosity:0,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,maxImageSize:0});
 if(pdf.numPages>20)throw Error('Use a CV with no more than 20 pages.');
 const extracted=await extractText(pdf,{mergePages:true});
 result={text:extracted.text,totalPages:extracted.totalPages};
}catch(e){result={error:e.message||'PDF extraction failed.'};}
// Finish the whole loading task before notifying the parent, which terminates
// this worker on receipt. Do not race document cleanup against termination.
try{if(pdf)await pdf.loadingTask.destroy();}
catch(e){result={error:e.message||'PDF cleanup failed.'};}
parentPort.postMessage(result);
