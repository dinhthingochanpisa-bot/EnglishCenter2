/** DEMO ONLY: synthetic organizations/users; never execute against production. */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const roleCodes = ['TENANT_ADMIN','EXECUTIVE','BRANCH_MANAGER','MARKETING','SALES','CUSTOMER_SUCCESS','ACADEMIC_MANAGER','TEACHER','ACCOUNTANT','PARENT_STUDENT'];
const permCodes = [
'org.branch.manage','org.membership.manage','iam.role.manage','iam.permission.assign',
'crm.lead.read','crm.lead.create','crm.lead.update','crm.lead.assign','crm.checkin.create','crm.checkin.read','crm.checkin.update','crm.source.read','crm.source.manage','crm.activity.write','crm.intake.read','crm.intake.manage','crm.person.create',
'crm.person.read','crm.person.update','pii.read_sensitive','pii.export',
'pricing.policy.draft','pricing.policy.approve','pricing.quote.create','pricing.quote.approve',
'finance.payment.record','finance.payment.confirm','finance.refund.submit','finance.refund.approve','finance.refund.disburse',
'academic.class.manage','academic.attendance.write','academic.attendance.confirm','academic.entitlement.read',
'academic.reservation.submit','academic.reservation.approve_academic','academic.reservation.approve_finance','academic.reservation.approve_manager',
'academic.exit.submit','academic.exit.approve','academic.class_transfer.submit','academic.class_transfer.execute',
'cskh.happy_call.write','cskh.renewal.manage','bi.dashboard.read','audit.read'];
async function main() {
 if (process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Set ALLOW_DEMO_SEED=true ONLY on a throwaway local database');
 if (process.env.NODE_ENV === 'production') throw new Error('Demo seed cannot run in production');
 // Global tables seeded via migration/admin account, never from app_runtime.
 await prisma.subscriptionPlan.upsert({where:{planCode:'DEMO'},create:{planCode:'DEMO',name:'Demo Evaluation',features:{crm:true,lms:true},limits:{branches:5,users:30}},update:{}});
 for (const code of permCodes) {
  const last = code.lastIndexOf('.');
  await prisma.permission.upsert({where:{code},create:{code,resource:code.slice(0,last),action:code.slice(last+1)},update:{}});
 }
 for(const [id,code,name] of [[A,'demo-a','Trung tâm minh họa A'],[B,'demo-b','Trung tâm minh họa B']] as const) {
  await prisma.tenant.upsert({where:{id},create:{id,code,legalName:name,displayName:name,status:'ACTIVE'},update:{}});
 }
 for(const [id,sub,name] of [[U1,U1,'Nhân viên demo A'],[U2,U2,'Nhân viên demo B']] as const) {
  await prisma.platformUser.upsert({where:{id},create:{id,authSubject:sub,displayName:name,status:'ACTIVE'},update:{}});
 }
 // All tenant writes use SET LOCAL in a single connection transaction.
 for (const [tenantId,userId,branchCode] of [[A,U1,'BRANCH-A'],[B,U2,'BRANCH-B']] as const) {
  await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
   const branch = await tx.branch.upsert({where:{tenantId_code:{tenantId,code:branchCode}},create:{tenantId,code:branchCode,name:'Cơ sở demo'},update:{}});
   const membership = await tx.tenantMembership.upsert({where:{tenantId_userId:{tenantId,userId}},create:{tenantId,userId,status:'ACTIVE',joinedAt:new Date()},update:{}});
   for(const code of roleCodes) await tx.role.upsert({where:{tenantId_code:{tenantId,code}},create:{tenantId,code,name:code,systemRole:true,scopeType:code==='TENANT_ADMIN'?'TENANT':'ASSIGNED_BRANCHES'},update:{}});
   const admin = await tx.role.findUniqueOrThrow({where:{tenantId_code:{tenantId,code:'TENANT_ADMIN'}}});
   const now=new Date('2026-01-01T00:00:00.000Z');
   if(!(await tx.membershipRole.findFirst({where:{tenantId,membershipId:membership.id,roleId:admin.id}})))
    await tx.membershipRole.create({data:{tenantId,membershipId:membership.id,roleId:admin.id,validFrom:now}});
   if(!(await tx.membershipBranchScope.findFirst({where:{tenantId,membershipId:membership.id,branchId:branch.id}})))
    await tx.membershipBranchScope.create({data:{tenantId,membershipId:membership.id,branchId:branch.id,validFrom:now}});
   const adminPermissionCodes=[
    'tenant.read','org.branch.read','org.branch.manage','org.membership.read','org.membership.manage',
    'iam.role.read','iam.role.manage','iam.permission.read','iam.permission.assign','audit.read',
    'crm.person.read','crm.person.create','crm.person.update','crm.lead.read','crm.lead.create','crm.lead.update','crm.lead.assign',
    'crm.source.read','crm.source.manage','crm.activity.write','crm.checkin.read','crm.checkin.create','crm.checkin.update',
    'crm.intake.read','crm.intake.manage'];
   for(const code of adminPermissionCodes){
    const p=await tx.permission.findUniqueOrThrow({where:{code}});
    await tx.rolePermission.upsert({where:{tenantId_roleId_permissionId:{tenantId,roleId:admin.id,permissionId:p.id}},create:{tenantId,roleId:admin.id,permissionId:p.id},update:{}});
   }
  });
 }
 console.log('Synthetic seed: 2 tenants, 2 users, 2 branches; restricted permissions (NOT production role template).');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
