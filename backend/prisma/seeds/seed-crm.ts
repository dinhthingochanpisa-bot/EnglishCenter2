/** Stage 02 DEMO ONLY: stable synthetic leads for two independent tenants. */
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
const tenants=[
 {tenantId:'11111111-1111-4111-8111-111111111111',personId:'11111111-aaaa-4aaa-8aaa-111111111111',leadId:'11111111-bbbb-4bbb-8bbb-111111111111',student:'Học sinh Demo A',phone:'0912000001'},
 {tenantId:'22222222-2222-4222-8222-222222222222',personId:'22222222-aaaa-4aaa-8aaa-222222222222',leadId:'22222222-bbbb-4bbb-8bbb-222222222222',student:'Học sinh Demo B',phone:'0912000002'},
];
const groups:[string,string,string][]=[
 ['EVENT','Sự kiện','EVENT'],['SCHOOL','Trường học','SCHOOL'],['PAGE','Fanpage Facebook','PAGE'],['ZALO_OA','Zalo OA','ZALO_OA'],
 ['GOOGLE_ADS','Google Ads','GOOGLE_ADS'],['REFERRAL','Khách hàng giới thiệu','REFERRAL'],['COLLABORATOR','Cộng tác viên','COLLABORATOR'],['WALK_IN','Khách vãng lai','WALK_IN']
];
async function main(){
 if(process.env.ALLOW_DEMO_SEED!=='true'||process.env.NODE_ENV==='production')throw Error('DEMO seed only; requires ALLOW_DEMO_SEED=true outside production');
 for(const demo of tenants){
  await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.tenant_id', ${demo.tenantId}, true)`;
   const branch=await tx.branch.findFirstOrThrow({where:{tenantId:demo.tenantId,isActive:true}});
   for(const [code,name,category] of groups)await tx.crmMarketingSource.upsert({where:{tenantId_code:{tenantId:demo.tenantId,code}},create:{tenantId:demo.tenantId,code,name,category},update:{}});
   await tx.crmPerson.upsert({where:{tenantId_id:{tenantId:demo.tenantId,id:demo.personId}},create:{id:demo.personId,tenantId:demo.tenantId,fullName:demo.student,normalizedName:demo.student.toLocaleLowerCase('vi-VN')},update:{}});
   await tx.crmPersonBranch.upsert({where:{tenantId_personId_branchId:{tenantId:demo.tenantId,personId:demo.personId,branchId:branch.id}},create:{tenantId:demo.tenantId,personId:demo.personId,branchId:branch.id},update:{}});
   const page=await tx.crmMarketingSource.findUniqueOrThrow({where:{tenantId_code:{tenantId:demo.tenantId,code:'PAGE'}}});
   await tx.crmLead.upsert({where:{tenantId_id:{tenantId:demo.tenantId,id:demo.leadId}},create:{id:demo.leadId,tenantId:demo.tenantId,personId:demo.personId,branchId:branch.id,sourceId:page.id,contactName:'Phụ huynh demo',contactPhone:demo.phone,contactPhoneNormalized:'+84'+demo.phone.slice(1),qualifiedAt:new Date(),status:'QUALIFIED'},update:{}});
   const touch=await tx.crmLeadTouch.findFirst({where:{tenantId:demo.tenantId,leadId:demo.leadId}});
   if(!touch)await tx.crmLeadTouch.create({data:{tenantId:demo.tenantId,leadId:demo.leadId,sourceId:page.id,touchType:'FIRST_TOUCH'}});
  });
 }
 console.log('CRM demo data: 2 tenants, 16 sources, 2 synthetic persons and qualified leads');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
