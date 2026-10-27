// Closing a scan request cancels its HTTP reader or Ollama request.
export function scanCancellation(response,timeoutMs){
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)]);
 const close=()=>{if(!response.writableEnded)controller.abort(new Error('Scan cancelled by the client.'));};
 response.once('close',close);
 return {signal,dispose:()=>response.off('close',close)};
}
