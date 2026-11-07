/** Additive, synthetic gate fixtures in a separate tenant. Never reset existing tenants. */
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
const T='33333333-3333-4333-8333-333333333333';
const id=(n:number)=>`33333333-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function main(){
 if(process.env.ALLOW_GATE_SEED!=='true'||process.env.NODE_ENV!=='test')throw Error('Explicit synthetic gate seed opt-in required');
 const existing=await db.tenant.findUnique({where:{id:T}});
 if(existing&&existing.code!=='stage02-gate')throw Error('Reserved gate tenant ID belongs to unrelated data; refusing to seed');
 await db.tenant.upsert({where:{id:T},create:{id:T,code:'stage02-gate',legalName:'Synthetic Gate',displayName:'Synthetic Gate',status:'ACTIVE'},update:{}});
 const users=['cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
 for(const [i,u] of users.entries())await db.platformUser.upsert({where:{id:u},create:{id:u,authSubject:u,displayName:'Synthetic Gate '+i,status:'ACTIVE'},update:{}});
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${T}, true)`;
  for(const n of [1,2])await tx.branch.upsert({where:{tenantId_id:{tenantId:T,id:id(n)}},create:{id:id(n),tenantId:T,code:'GATE-'+n,name:'Synthetic Gate Branch '+n},update:{}});
  for(const [i,u] of users.entries()){
   const member=id(10+i),role=id(50+i);
   await tx.tenantMembership.upsert({where:{tenantId_userId:{tenantId:T,userId:u}},create:{id:member,tenantId:T,userId:u,status:'ACTIVE'},update:{}});
   await tx.role.upsert({where:{tenantId_code:{tenantId:T,code:'GATE-'+i}},create:{id:role,tenantId:T,code:'GATE-'+i,name:'Synthetic Gate Role',scopeType:'ASSIGNED_BRANCHES'},update:{}});
   const codes=['crm.lead.read','crm.lead.update','crm.person.read',...(i===1?['crm.lead.assign']:[])];
   for(const code of codes){const p=await tx.permission.findUniqueOrThrow({where:{code}});await tx.rolePermission.upsert({where:{tenantId_roleId_permissionId:{tenantId:T,roleId:role,permissionId:p.id}},create:{tenantId:T,roleId:role,permissionId:p.id},update:{}});}
   const from=new Date('2026-01-01T00:00:00Z');
   if(!await tx.membershipRole.findFirst({where:{tenantId:T,membershipId:member,roleId:role}}))await tx.membershipRole.create({data:{tenantId:T,membershipId:member,roleId:role,validFrom:from}});
   const branchId=id(i===2?2:1);
   if(!await tx.membershipBranchScope.findFirst({where:{tenantId:T,membershipId:member,branchId}}))await tx.membershipBranchScope.create({data:{tenantId:T,membershipId:member,branchId,validFrom:from}});
  }
  await tx.crmMarketingSource.upsert({where:{tenantId_id:{tenantId:T,id:id(41)}},create:{tenantId:T,id:id(41),code:'GATE',name:'Synthetic Gate Source',category:'EVENT'},update:{}});
  for(const n of [1,2]){
   const personId=id(20+n),branchId=id(n);
   await tx.crmPerson.upsert({where:{tenantId_id:{tenantId:T,id:personId}},create:{tenantId:T,id:personId,fullName:'Synthetic Gate Person '+n,normalizedName:'synthetic gate person '+n},update:{}});
   await tx.crmPersonBranch.upsert({where:{tenantId_personId_branchId:{tenantId:T,personId,branchId}},create:{tenantId:T,personId,branchId},update:{}});
   await tx.crmLead.upsert({where:{tenantId_id:{tenantId:T,id:id(30+n)}},create:{tenantId:T,id:id(30+n),personId,branchId,sourceId:id(41),status:'NEW'},update:{}});
  }
 });
 console.log('PASS additive isolated gate fixtures; existing tenants unchanged');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
