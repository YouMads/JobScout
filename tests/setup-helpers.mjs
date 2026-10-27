import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function removeTemporary(dir){const target=path.resolve(dir);assert.equal(path.dirname(target),path.resolve(tmpdir()));assert.match(path.basename(target),/^jobscout-test-/);await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
export async function temporary(t,{cleanup=true}={}){const dir=await mkdtemp(path.join(tmpdir(),'jobscout-test-'));if(cleanup)t.after(()=>removeTemporary(dir));return dir;}
export async function listen(server){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server.address().port;}
export async function freePort(){const server=http.createServer(),port=await listen(server);await new Promise(resolve=>server.close(resolve));return port;}
export function environment(extra={}){return {...Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^JOBSCOUT_|^PORT$/.test(name))),...extra};}
export function launch(file,options={}){
 const child=spawn(process.execPath,[file],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,...options});let output='';
 child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
 const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server readiness timed out: '+output)),15000);child.once('message',message=>{if(message?.type==='ready'){clearTimeout(timer);resolve(message);}});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before readiness: '+output));});});
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal,output}));});
 return {child,ready,done,output:()=>output};
}
export async function stop(running,{viaLauncher=false}={}){
 if(running.child.exitCode!==null||running.child.signalCode!==null)return;
 if(viaLauncher&&running.child.connected)running.child.send({type:'stop'});else running.child.kill();
 let timer;try{await Promise.race([running.done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned test server did not stop')),8000);})]);}finally{clearTimeout(timer);}
}
