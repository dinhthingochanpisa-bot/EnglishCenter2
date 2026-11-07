import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
require('reflect-metadata');
const {CrmService}=require('../backend/dist/crm.service.js');
const {uuid}=require('../backend/dist/contracts.js');
const tenant='11111111-1111-4111-8111-111111111111';
const id='11111111-0000-4000-8000-000000000001';
const actor={userId:id};

test('missing and malformed UUIDs are client errors, never generic server errors',()=>{
 for(const value of [undefined,null,'','not-a-uuid','1 OR 1=1',[],[tenant]]){
  assert.throws(()=>uuid(value),error=>error.getStatus?.()===400);
 }
 assert.equal(uuid(tenant),tenant);
});

test('Person detail rejects absent branch before opening a tenant transaction',async()=>{
 let opened=false;
 const service=new CrmService({tenantTx:async()=>{opened=true;}},{});
 await assert.rejects(service.getPerson(tenant,id,actor,undefined),error=>error.getStatus?.()===400);
 assert.equal(opened,false);
});

for(const phone of [null,'+84912345678'])for(const sensitive of [false,true]){
 test(`Lead detail qualification agrees with normalized phone and preserves masking (${!!phone}, ${sensitive})`,async()=>{
  const lead={id,tenantId:tenant,branchId:id,personId:id,contactPhone:phone,contactPhoneNormalized:phone,
   qualifiedAt:new Date('2026-01-01T00:00:00Z'),status:phone?'QUALIFIED':'NEW'};
  const tx={crmLead:{findUnique:async()=>lead},crmPerson:{findUniqueOrThrow:async()=>({id,fullName:'Synthetic detail fixture'})},
   crmLeadActivity:{findMany:async()=>[]},crmLeadTouch:{findMany:async()=>[]},crmLeadEvent:{findMany:async()=>[]}};
  let authorized=false;
  const service=new CrmService({tenantTx:async(t,u,fn)=>{assert.equal(t,tenant);assert.equal(u,actor.userId);return fn(tx)}},
   {require:async(t,tId,a,permission,branch)=>{assert.equal(permission,'crm.lead.read');assert.equal(branch,id);authorized=true},
    permissionSnapshot:async()=>({permissions:sensitive?{'pii.read_sensitive':{tenantWide:true}}:{}})});
  const result=await service.getLead(tenant,id,actor);
  assert.equal(authorized,true);
  assert.equal(result.lead.isQualified,!!phone);
  assert.equal(result.lead.contactPhoneNormalized,undefined);
  assert.equal(result.lead.contactPhone,phone?(sensitive?phone:'********5678'):null);
  assert.equal(result.lead.qualifiedAt,lead.qualifiedAt);
 });
}

test('Lead detail does not bypass backend authorization',async()=>{
 const denied=new Error('denied');let readPerson=false;
 const service=new CrmService({tenantTx:async(t,u,fn)=>fn({crmLead:{findUnique:async()=>({branchId:id})},
  crmPerson:{findUniqueOrThrow:async()=>{readPerson=true}}})},{require:async()=>{throw denied}});
 await assert.rejects(service.getLead(tenant,id,actor),error=>error===denied);
 assert.equal(readPerson,false);
});
