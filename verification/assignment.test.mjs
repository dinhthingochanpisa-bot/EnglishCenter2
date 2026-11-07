import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));require('reflect-metadata');
const {CrmService}=require('../backend/dist/crm.service.js');
const service=new CrmService({},{});
function tx({status='ACTIVE',roles=[{role:{scopeType:'ASSIGNED_BRANCHES'}}],branch=null}={}){
 return {tenantMembership:{findUnique:async()=>({status})},membershipRole:{findMany:async()=>roles},membershipBranchScope:{findFirst:async()=>branch}};
}
test('assignee must be active and have effective roles',async()=>{
 await assert.rejects(service.member(tx({status:'SUSPENDED'}),'tenant-a','member-a','branch-a'),/must be active/);
 await assert.rejects(service.member(tx({roles:[]}),'tenant-a','member-a','branch-a'),/not scoped/);
});
test('branch-scoped assignee cannot be assigned outside branch',async()=>{
 await assert.rejects(service.member(tx(),'tenant-a','member-a','branch-b'),/not scoped/);
 await service.member(tx({branch:{branchId:'branch-a'}}),'tenant-a','member-a','branch-a');
});
