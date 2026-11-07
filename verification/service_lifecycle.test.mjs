import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { occupied, preflight, verifyExisting, withOwnedServices, root } from './service_lifecycle.mjs';

test('occupied port blocks without stopping the existing server',async()=>{
 const server=http.createServer((req,res)=>res.end('unrelated service'));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;
 try{
  assert.equal(await occupied(port),true);
  await assert.rejects(preflight([port]),/already occupied/);
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(),'unrelated service');
 }finally{server.close();await once(server,'close');}
 assert.equal(await occupied(port),false);
});
test('explicit reuse rejects unrelated HTTP services',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end('{}');});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
 try{await assert.rejects(verifyExisting(url,url),/not recognizable/);}finally{server.close();await once(server,'close');}
});
test('IPv6-only listener is also detected',async t=>{
 const server=http.createServer((req,res)=>res.end('ipv6'));
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'::1',resolve);});}
 catch(error){if(['EAFNOSUPPORT','EADDRNOTAVAIL'].includes(error.code)){t.skip('IPv6 unavailable');return;}throw error;}
 try{assert.equal(await occupied(server.address().port),true);}finally{server.close();await once(server,'close');}
});
test('fresh lifecycle stops only owned services, including on action failure',async()=>{
 const external=http.createServer((req,res)=>res.end('keep-running'));
 external.listen(0,'127.0.0.1');await once(external,'listening');
 const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
 const port=reserve.address().port;reserve.close();await once(reserve,'close');
 const url=`http://127.0.0.1:${port}`;
 try{
  await assert.rejects(withOwnedServices(async()=>{
   assert.equal(await (await fetch(url)).text(),'owned');throw Error('intentional test failure');
  },{ports:[port],services:[{name:'lifecycle-test-owned',cwd:root,args:['-e',`require('node:http').createServer((req,res)=>res.end('owned')).listen(${port},'127.0.0.1')`]}],ready:async()=>{const response=await fetch(url);assert.equal(response.status,200);},timeoutMs:10000}),/intentional test failure/);
  assert.equal(await occupied(port),false);
  assert.equal(await (await fetch(`http://127.0.0.1:${external.address().port}`)).text(),'keep-running');
 }finally{external.close();await once(external,'close');}
});
