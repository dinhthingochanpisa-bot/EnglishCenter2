// Never signal a process unless this runner started it. Existing services require explicit reuse.
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function occupied(port){
 // Windows can permit wildcard binds beside an existing specific-address listener.
 // Probe each loopback family before attempting a bind.
 for(const host of ['127.0.0.1','::1']){
  const listening=await new Promise(resolve=>{
   const socket=net.connect({port,host});
   const done=value=>{socket.destroy();resolve(value);};
   socket.once('connect',()=>done(true));socket.once('error',()=>done(false));
   socket.setTimeout(500,()=>done(true));
  });
  if(listening)return true;
 }
 const attempt=host=>new Promise((resolve,reject)=>{
  const server=net.createServer();
  server.once('error',error=>error.code==='EADDRINUSE'?resolve(true):reject(error));
  server.listen(port,host,()=>server.close(()=>resolve(false)));
 });
 if(await attempt('127.0.0.1'))return true;
 try{return await attempt('::1');}catch(error){if(['EAFNOSUPPORT','EADDRNOTAVAIL'].includes(error.code))return false;throw error;}
}
export async function preflight(ports=[3000,3001]){
 const busy=[];
 for(const port of ports)if(await occupied(port))busy.push(port);
 if(busy.length)throw Error(`BLOCKED: ports ${busy.join(', ')} already occupied. No process was stopped. Use --reuse-services only for verified local demo services.`);
}
async function request(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error(`Readiness HTTP ${response.status}`);
 return response;
}
export async function verifyExisting(backend='http://localhost:3001',frontend='http://localhost:3000'){
 const health=await (await request(backend+'/health/live')).json();
 const schema=await (await request(backend+'/docs-json')).json();
 const session=await (await request(frontend+'/api/auth/session')).json();
 const html=await (await request(frontend+'/')).text();
 if(health.ok!==true||!schema.info?.title?.includes('LMS + CRM')||typeof session.authenticated!=='boolean'||!html.includes('LumaOS'))
  throw Error('BLOCKED: occupied ports are not recognizable LumaOS services');
 console.log('PASS recognizable existing LumaOS services; exact running source revision is not certified');
}
export async function withOwnedServices(action,options={}){
 await preflight(options.ports??[3000,3001]);
 const owned=[],logs=[];
 const folder=path.join(root,'verification/artifacts');fs.mkdirSync(folder,{recursive:true});
 const start=(name,args,cwd)=>{
  const fd=fs.openSync(path.join(folder,name+'.log'),'w');logs.push(fd);
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',fd,fd],windowsHide:true,detached:process.platform!=='win32'});
  child.on('error',()=>{});owned.push(child);return child;
 };
 const stop=()=>{for(const child of owned){if(child.exitCode===null&&child.pid){try{process.platform==='win32'?child.kill('SIGTERM'):process.kill(-child.pid,'SIGTERM');}catch{}}}};
 const interrupt=()=>{stop();process.exitCode=130;};
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{
  const services=options.services??[
   {name:'backend',args:['dist/main.js'],cwd:path.join(root,'backend')},
   {name:'frontend',args:['node_modules/next/dist/bin/next','dev','-p','3000'],cwd:path.join(root,'frontend')}
  ];
  for(const service of services)start(service.name,service.args,service.cwd);
  const deadline=Date.now()+(options.timeoutMs??90000);
  while(true){
   if(owned.some(child=>child.exitCode!==null||!child.pid))throw Error('BLOCKED: owned service exited before readiness; inspect verification/artifacts/backend.log and frontend.log');
   try{
    await (options.ready??verifyExisting)();
    // A different server may have raced the preflight; don't accept its health while our child exits.
    await new Promise(resolve=>setTimeout(resolve,250));
    if(owned.some(child=>child.exitCode!==null||!child.pid))throw Error('Owned service exited');
    break;
   }catch(error){if(Date.now()>=deadline)throw Error('BLOCKED: readiness timeout; inspect owned service logs');}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  await action();
 }finally{
  stop();process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
  await Promise.all(owned.map(child=>child.exitCode!==null?null:new Promise(resolve=>{const timer=setTimeout(resolve,5000);child.once('close',()=>{clearTimeout(timer);resolve();});})));
  for(const fd of logs)fs.closeSync(fd);
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.includes('--preflight')){await preflight();console.log('PASS ports 3000/3001 available');}
  else if(process.argv.includes('--reuse-services'))await verifyExisting();
  else await withOwnedServices(async()=>{
   const python=process.env.PYTHON||'python3';
   const result=spawn(python,['verification/run_live_acceptance.py','--fresh-realm'],{cwd:root,stdio:'inherit',env:process.env,windowsHide:true});
   const code=await new Promise(resolve=>{result.once('error',()=>resolve(2));result.once('close',resolve);});
   if(code!==0)throw Error('FAIL live acceptance; inspect artifacts');
   if(process.env.RUN_BROWSER_E2E==='true'){
    const browser=spawn(process.execPath,['verification/browser_e2e.mjs'],{cwd:root,stdio:'inherit',env:process.env,windowsHide:true});
    const browserCode=await new Promise(resolve=>{browser.once('error',()=>resolve(2));browser.once('close',resolve);});
    if(browserCode!==0)throw Error('FAIL/BLOCKED browser acceptance; inspect artifacts');
   }
  });
 }catch(error){console.error(error.message);process.exitCode=error.message.startsWith('BLOCKED')?2:1;}
}
