import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
require('reflect-metadata');
const {Authorization}=require('../backend/dist/authorization.js');
const actor={subject:'synthetic',userId:'user-a',platformAdmin:false};
function fixture({membership='ACTIVE',tenant='ACTIVE',roles=[],scope=null}={}){
 const tx={tenantMembership:{findUnique:async()=>membership?{id:'member-a',status:membership}:null},membershipRole:{findMany:async()=>roles},membershipBranchScope:{findFirst:async()=>scope,findMany:async()=>scope?[scope]:[]}};
 const auth=new Authorization({identity:{tenant:{findUnique:async()=>({status:tenant})}}});
 return {auth,tx};
}
const role=scopeType=>({role:{scopeType,permissions:[{permission:{code:'crm.lead.read'}}]}});
test('branch-scoped role cannot read another branch or list tenant-wide',async()=>{
 const {auth,tx}=fixture({roles:[role('ASSIGNED_BRANCHES')]});
 await assert.rejects(auth.require(tx,'tenant-a',actor,'crm.lead.read','branch-b'),/Branch outside assigned scope/);
 await assert.rejects(auth.require(tx,'tenant-a',actor,'crm.lead.read'),/Tenant-wide/);
});
test('matching branch scope succeeds; revocation is checked on next request',async()=>{
 const {auth,tx}=fixture({roles:[role('ASSIGNED_BRANCHES')],scope:{branchId:'branch-a'}});
 assert.equal((await auth.require(tx,'tenant-a',actor,'crm.lead.read','branch-a')).id,'member-a');
 tx.membershipRole.findMany=async()=>[];
 await assert.rejects(auth.require(tx,'tenant-a',actor,'crm.lead.read','branch-a'),/Missing permission/);
});
test('inactive membership and suspended tenant always deny access',async()=>{
 for(const options of [{membership:'SUSPENDED'},{membership:null},{tenant:'SUSPENDED'}]){
  const {auth,tx}=fixture({...options,roles:[role('TENANT')]});
  await assert.rejects(auth.require(tx,'tenant-a',actor,'crm.lead.read','branch-a'));
 }
});
test('platform flag never grants implicit tenant permission',async()=>{
 const {auth,tx}=fixture();
 await assert.rejects(auth.require(tx,'tenant-a',{...actor,platformAdmin:true},'crm.lead.read','branch-a'),/Missing permission/);
});
test('lead read permission cannot grant assignment rights',async()=>{
 const {auth,tx}=fixture({roles:[role('TENANT')]});
 await assert.rejects(auth.require(tx,'tenant-a',actor,'crm.lead.assign','branch-a'),/Missing permission/);
});
test('branch lists remain scoped and empty grants do not become tenant-wide',async()=>{
 const {auth,tx}=fixture({roles:[role('ASSIGNED_BRANCHES')],scope:{branchId:'branch-a'}});
 assert.deepEqual(await auth.allowedBranchIds(tx,'tenant-a',actor,'crm.lead.read'),['branch-a']);
 tx.membershipBranchScope.findMany=async()=>[];
 assert.deepEqual(await auth.allowedBranchIds(tx,'tenant-a',actor,'crm.lead.read'),[]);
});
