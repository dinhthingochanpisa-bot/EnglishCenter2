import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
require('reflect-metadata');
const {CoreService}=require('../backend/dist/tenant.service.js');
test('discovery returns only active memberships, with tenant context and actor pinned',async()=>{
 const contexts=[];
 const db={identity:{tenant:{findMany:async query=>{
  assert.equal(query.where.status,'ACTIVE');
  return ['a','b','revoked'].map(id=>({id,code:id,displayName:id,status:'ACTIVE'}));
 }}},tenantTx:async(t,u,fn)=>{
  contexts.push([t,u]);
  return fn({tenantMembership:{findUnique:async query=>{
   assert.deepEqual(query.where.tenantId_userId,{tenantId:t,userId:'user-a'});
   return t==='a'?{status:'ACTIVE'}:t==='revoked'?{status:'LEFT'}:null;
  }}});
 }};
 const service=new CoreService(db,{});
 assert.deepEqual((await service.myTenants({userId:'user-a',platformAdmin:true})).map(t=>t.id),['a']);
 assert.deepEqual(contexts,[['a','user-a'],['b','user-a'],['revoked','user-a']]);
});
test('multiple memberships are returned; no memberships returns an empty selector',async()=>{
 for(const active of [true,false]){
  const candidates=['a','b'].map(id=>({id,code:id,displayName:id,status:'ACTIVE'}));
  const db={identity:{tenant:{findMany:async()=>candidates}},tenantTx:async(t,u,fn)=>fn({tenantMembership:{findUnique:async()=>active?{status:'ACTIVE'}:null}})};
  assert.deepEqual(await new CoreService(db,{}).myTenants({userId:'user'}),active?candidates:[]);
 }
});
