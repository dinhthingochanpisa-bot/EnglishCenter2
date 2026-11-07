import { BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash,randomBytes } from 'node:crypto';
import { Db } from './prisma.service';
import { Authorization } from './authorization';
import { Actor,uuid } from './contracts';
import { CreatePersonDto,UpdatePersonDto,CreateSourceDto,CreateCampaignDto,CreateLeadDto,UpdateLeadDto,CreateActivityDto,CreateTouchDto,CreateCheckinDto,CompleteCheckinDto,CreateIntakeInviteDto,SubmitIntakeDto,ReviewIntakeDto } from './crm.dto';
import { canMoveLead,normalizedName,normalizePhone,redactPhone } from './crm.rules';

type Tx=Prisma.TransactionClient;
@Injectable() export class CrmService {
 constructor(private readonly db:Db,private readonly auth:Authorization){}
 private async log(tx:Tx,t:string,a:Actor|null,action:string,resourceType:string,resourceId:string,after?:Record<string,unknown>){
  await tx.auditLog.create({data:{tenantId:t,actorUserId:a?.userId??null,action,resourceType,resourceId,afterData:after as Prisma.InputJsonValue|undefined}});
 }
 private async branch(tx:Tx,t:string,id:string){
  const branch=await tx.branch.findUnique({where:{tenantId_id:{tenantId:t,id}}});
  if(!branch?.isActive)throw new BadRequestException('Active branch required');return branch;
 }
 private async source(tx:Tx,t:string,id:string){
  const s=await tx.crmMarketingSource.findUnique({where:{tenantId_id:{tenantId:t,id}}});
  if(!s?.isActive)throw new BadRequestException('Active source required');return s;
 }
 private async campaign(tx:Tx,t:string,id:string|undefined,sourceId:string){
  if(!id)return;
  const c=await tx.crmCampaign.findUnique({where:{tenantId_id:{tenantId:t,id}}});
  if(!c||c.sourceId&&c.sourceId!==sourceId)throw new BadRequestException('Campaign/source mismatch');
 }
 private async member(tx:Tx,t:string,id:string|undefined,branchId:string){
  if(!id)return;
  const m=await tx.tenantMembership.findUnique({where:{tenantId_id:{tenantId:t,id}}});
  if(!m||m.status!=='ACTIVE')throw new BadRequestException('Assigned membership must be active');
  const now=new Date();
  const roles=await tx.membershipRole.findMany({where:{tenantId:t,membershipId:id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{role:true}});
  const tenantWide=roles.some(r=>r.role.scopeType==='TENANT');
  const branch=await tx.membershipBranchScope.findFirst({where:{tenantId:t,membershipId:id,branchId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}});
  if(!roles.length||!tenantWide&&!branch)throw new BadRequestException('Assignee is not scoped to this branch');
 }
 private async personInBranch(tx:Tx,t:string,p:string,b:string){
  const linked=await tx.crmPersonBranch.findUnique({where:{tenantId_personId_branchId:{tenantId:t,personId:p,branchId:b}}});
  if(!linked)throw new NotFoundException('Person not accessible in this branch');
  return tx.crmPerson.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id:p}}});
 }
 private async createPersonTx(tx:Tx,t:string,branchId:string,d:{fullName:string;dateOfBirth?:string;schoolName?:string;schoolGrade?:string;gender?:string;address?:string}){
  const person=await tx.crmPerson.create({data:{tenantId:t,fullName:d.fullName.trim(),normalizedName:normalizedName(d.fullName),dateOfBirth:d.dateOfBirth?new Date(d.dateOfBirth):undefined,schoolName:d.schoolName,schoolGrade:d.schoolGrade,gender:d.gender,address:d.address}});
  await tx.crmPersonBranch.create({data:{tenantId:t,personId:person.id,branchId}});
  return person;
 }
 async listPersons(t:string,a:Actor,branchId:string|undefined,search:string|undefined){uuid(t);if(branchId)uuid(branchId);
  return this.db.tenantTx(t,a.userId,async tx=>{
   const allowed=await this.auth.allowedBranchIds(tx,t,a,'crm.person.read');
   const scope=branchId?[branchId]:allowed;
   if(branchId&&allowed&&!allowed.includes(branchId))throw new ForbiddenException('Branch outside scope');
   const query=search?.trim().slice(0,120);
   const results=await tx.crmPerson.findMany({where:{tenantId:t,...(scope?{id:{in:(await tx.crmPersonBranch.findMany({where:{tenantId:t,branchId:{in:scope}},select:{personId:true},take:5000})).map(p=>p.personId)}}:{}),...(query?{normalizedName:{contains:normalizedName(query)}}:{})},select:{id:true,fullName:true,schoolName:true,schoolGrade:true,status:true,createdAt:true,rowVersion:true},take:100,orderBy:{createdAt:'desc'}});
   return results;
  });
 }
 async getPerson(t:string,id:string,a:Actor,branchId:string){uuid(t);uuid(id);uuid(branchId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.person.read',branchId);
  const p=await this.personInBranch(tx,t,id,branchId);
  const canSensitive=await this.auth.permissionSnapshot(tx,t,a).then(x=>Boolean(x.permissions['pii.read_sensitive']?.tenantWide||x.permissions['pii.read_sensitive']?.branchIds.includes(branchId)));
  const contacts=canSensitive?await tx.crmPersonContact.findMany({where:{tenantId:t,personId:id},select:{id:true,kind:true,rawValue:true,isPrimary:true}}):[];
  const student=await tx.crmStudent.findUnique({where:{tenantId_personId:{tenantId:t,personId:id}}});
  const guardianLinks=student?await tx.crmStudentGuardian.findMany({where:{tenantId:t,studentId:student.id}}):[];
  const guardians=[];
  for(const link of guardianLinks){const person=await tx.crmPerson.findUnique({where:{tenantId_id:{tenantId:t,id:link.guardianPersonId}},select:{id:true,fullName:true}});
   const phone=canSensitive?await tx.crmPersonContact.findFirst({where:{tenantId:t,personId:link.guardianPersonId,kind:'PHONE'},select:{rawValue:true}}):null;
   if(person)guardians.push({...person,relationship:link.relationType,isPrimary:link.isPrimary,phone:phone?.rawValue??null});}
  const leads=await tx.crmLead.findMany({where:{tenantId:t,personId:id,branchId},select:{id:true,status:true,qualifiedAt:true,createdAt:true},take:50,orderBy:{createdAt:'desc'}});
  const checkins=await tx.crmCheckin.findMany({where:{tenantId:t,personId:id,branchId},select:{id:true,status:true,checkedInAt:true},take:50,orderBy:{checkedInAt:'desc'}});
  return {id:p.id,fullName:p.fullName,schoolName:p.schoolName,schoolGrade:p.schoolGrade,dateOfBirth:p.dateOfBirth,status:p.status,rowVersion:p.rowVersion,studentId:student?.id??null,guardians,contacts,leads,checkins};
 });}
 async createPerson(t:string,a:Actor,d:CreatePersonDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.person.create',d.branchId);await this.branch(tx,t,d.branchId);
  const p=await this.createPersonTx(tx,t,d.branchId,d);
  await this.log(tx,t,a,'crm.person.created','crm.person',p.id,{branchId:d.branchId});return p;
 });}
 async updatePerson(t:string,id:string,a:Actor,d:UpdatePersonDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.person.update',d.branchId);await this.personInBranch(tx,t,id,d.branchId);
  const {branchId,rowVersion,fullName,...patch}=d;
  const update=await tx.crmPerson.updateMany({where:{tenantId:t,id,rowVersion},data:{...patch,...(fullName?{fullName:fullName.trim(),normalizedName:normalizedName(fullName)}:{}),rowVersion:{increment:1},updatedAt:new Date()}});
  if(!update.count)throw new ConflictException('Stale version');
  await this.log(tx,t,a,'crm.person.updated','crm.person',id,{branchId});
  return tx.crmPerson.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id}}});
 });}
 async listSources(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.allowedBranchIds(tx,t,a,'crm.source.read');return tx.crmMarketingSource.findMany({where:{tenantId:t},orderBy:{code:'asc'},take:200});
 });}
 async createSource(t:string,a:Actor,d:CreateSourceDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.source.manage');const s=await tx.crmMarketingSource.create({data:{tenantId:t,...d}});
  await this.log(tx,t,a,'crm.source.created','crm.source',s.id,{code:s.code});return s;
 });}
 async listCampaigns(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.allowedBranchIds(tx,t,a,'crm.source.read');return tx.crmCampaign.findMany({where:{tenantId:t},take:200,orderBy:{name:'asc'}});
 });}
 async createCampaign(t:string,a:Actor,d:CreateCampaignDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.source.manage');if(d.sourceId)await this.source(tx,t,d.sourceId);
  const c=await tx.crmCampaign.create({data:{tenantId:t,code:d.code,name:d.name,sourceId:d.sourceId,startAt:d.startAt?new Date(d.startAt):undefined,endAt:d.endAt?new Date(d.endAt):undefined}});
  await this.log(tx,t,a,'crm.campaign.created','crm.campaign',c.id,{code:c.code});return c;
 });}
 async listAssignees(t:string,a:Actor,branchId:string){uuid(t);uuid(branchId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.lead.assign',branchId);
  const members=await tx.tenantMembership.findMany({where:{tenantId:t,status:'ACTIVE'},select:{id:true,userId:true},take:1000});
  const now=new Date();
  const assignments=await tx.membershipRole.findMany({where:{tenantId:t,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{role:{select:{scopeType:true}}}});
  const branchAssignments=await tx.membershipBranchScope.findMany({where:{tenantId:t,branchId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},select:{membershipId:true}});
  const scoped=new Set(branchAssignments.map(b=>b.membershipId));
  const eligible=new Set(assignments.filter(r=>r.role.scopeType==='TENANT'||scoped.has(r.membershipId)).map(r=>r.membershipId));
  const allowed=members.filter(m=>eligible.has(m.id));
  const people=await this.db.identity.platformUser.findMany({where:{id:{in:allowed.map(m=>m.userId)}},select:{id:true,displayName:true}});
  return allowed.map(m=>({membershipId:m.id,name:people.find(u=>u.id===m.userId)?.displayName||'Tài khoản'}));
 });}
 async listLeads(t:string,a:Actor,branchId?:string,search?:string,status?:string){uuid(t);if(branchId)uuid(branchId);
  return this.db.tenantTx(t,a.userId,async tx=>{
   const allowed=await this.auth.allowedBranchIds(tx,t,a,'crm.lead.read');if(branchId&&allowed&&!allowed.includes(branchId))throw new ForbiddenException('Branch outside scope');
   const branches=branchId?[branchId]:allowed;
   const leads=await tx.crmLead.findMany({where:{tenantId:t,...(branches?{branchId:{in:branches}}:{}),...(status?{status}:{}),...(search?{OR:[{contactName:{contains:search,mode:'insensitive'}},{contactPhoneNormalized:{contains:search}}]}:{})},take:100,orderBy:{createdAt:'desc'}});
   const people=await tx.crmPerson.findMany({where:{tenantId:t,id:{in:leads.map(l=>l.personId)}},select:{id:true,fullName:true}});
   const names=new Map(people.map(p=>[p.id,p.fullName]));
   const rights=await this.auth.permissionSnapshot(tx,t,a);
   return leads.map(l=>({id:l.id,branchId:l.branchId,personId:l.personId,fullName:names.get(l.personId)??'',sourceId:l.sourceId,assignedMembershipId:l.assignedMembershipId,status:l.status,isQualified:!!l.contactPhoneNormalized,everQualified:!!l.qualifiedAt,qualifiedAt:l.qualifiedAt,contactName:l.contactName,contactPhone:rights.permissions['pii.read_sensitive']?.tenantWide||rights.permissions['pii.read_sensitive']?.branchIds.includes(l.branchId)?l.contactPhone:redactPhone(l.contactPhone),nextFollowupAt:l.nextFollowupAt,rowVersion:l.rowVersion,createdAt:l.createdAt}));
  });
 }
 async getLead(t:string,id:string,a:Actor){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  const lead=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!lead)throw new NotFoundException();
  await this.auth.require(tx,t,a,'crm.lead.read',lead.branchId);
  const person=await tx.crmPerson.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id:lead.personId}},select:{id:true,fullName:true,schoolName:true,schoolGrade:true}});
  const activities=await tx.crmLeadActivity.findMany({where:{tenantId:t,leadId:id},orderBy:{occurredAt:'desc'},take:100});
  const touches=await tx.crmLeadTouch.findMany({where:{tenantId:t,leadId:id},orderBy:{occurredAt:'asc'},take:100});
  const events=await tx.crmLeadEvent.findMany({where:{tenantId:t,leadId:id},orderBy:{occurredAt:'asc'},take:100});
  const rights=await this.auth.permissionSnapshot(tx,t,a);
  const canPhone=Boolean(rights.permissions['pii.read_sensitive']?.tenantWide||rights.permissions['pii.read_sensitive']?.branchIds.includes(lead.branchId));
  return {lead:{...lead,isQualified:!!lead.contactPhoneNormalized,contactPhone:canPhone?lead.contactPhone:redactPhone(lead.contactPhone),contactPhoneNormalized:undefined},person,activities,touches,events};
 });}
 async createLead(t:string,a:Actor,d:CreateLeadDto){uuid(t);if(!d.personId&&!d.studentName)throw new BadRequestException('personId or studentName required');
  let phone:string|null;
  try{phone=normalizePhone(d.contactPhone);}catch{throw new BadRequestException('Invalid contact phone');}
  return this.db.tenantTx(t,a.userId,async tx=>{
   await this.auth.require(tx,t,a,'crm.lead.create',d.branchId);await this.branch(tx,t,d.branchId);await this.source(tx,t,d.sourceId);await this.campaign(tx,t,d.campaignId,d.sourceId);await this.member(tx,t,d.assignedMembershipId,d.branchId);
   if(d.personId)await this.personInBranch(tx,t,d.personId,d.branchId);
   const p=d.personId?{id:d.personId}:await this.createPersonTx(tx,t,d.branchId,{fullName:d.studentName!});
   const lead=await tx.crmLead.create({data:{tenantId:t,personId:p.id,branchId:d.branchId,sourceId:d.sourceId,campaignId:d.campaignId,assignedMembershipId:d.assignedMembershipId,contactName:d.contactName,contactPhone:d.contactPhone,contactPhoneNormalized:phone,qualifiedAt:phone?new Date():undefined,status:phone?'QUALIFIED':'NEW'}});
   await tx.crmLeadEvent.create({data:{tenantId:t,leadId:lead.id,eventType:'CREATED',toStatus:lead.status,actorUserId:a.userId}});
   if(phone)await tx.crmLeadEvent.create({data:{tenantId:t,leadId:lead.id,eventType:'QUALIFIED',toStatus:'QUALIFIED',actorUserId:a.userId}});
   await tx.crmLeadTouch.create({data:{tenantId:t,leadId:lead.id,sourceId:d.sourceId,campaignId:d.campaignId,touchType:'FIRST_TOUCH'}});
   await this.log(tx,t,a,'crm.lead.created','crm.lead',lead.id,{branchId:d.branchId,sourceId:d.sourceId,qualified:Boolean(phone)});
   const duplicates=phone?await tx.crmLead.count({where:{tenantId:t,branchId:d.branchId,contactPhoneNormalized:phone,id:{not:lead.id}}}):0;
   return {id:lead.id,personId:p.id,status:lead.status,isQualified:Boolean(phone),possiblePhoneMatches:duplicates};
  });}
 async updateLead(t:string,id:string,a:Actor,d:UpdateLeadDto){uuid(t);uuid(id);let normalized:string|null|undefined;
  if(d.contactPhone!==undefined){try{normalized=normalizePhone(d.contactPhone)}catch{throw new BadRequestException('Invalid contact phone')}}
  return this.db.tenantTx(t,a.userId,async tx=>{
   const before=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!before)throw new NotFoundException();
   await this.auth.require(tx,t,a,'crm.lead.update',before.branchId);
   if(d.assignedMembershipId!==undefined){await this.auth.require(tx,t,a,'crm.lead.assign',before.branchId);await this.member(tx,t,d.assignedMembershipId,before.branchId)}
   const phone=normalized===undefined?before.contactPhoneNormalized:normalized;
   const newStatus=d.status??before.status;
   if(!canMoveLead(before.status,newStatus,!!phone))throw new BadRequestException('Invalid lead stage transition');
   if(newStatus==='CONVERTED'&&!(await tx.crmCheckin.findFirst({where:{tenantId:t,leadId:id,status:'COMPLETED'}})))throw new BadRequestException('Completed check-in required before conversion');
   const updated=await tx.crmLead.updateMany({where:{tenantId:t,id,rowVersion:d.rowVersion},data:{...(d.contactPhone!==undefined?{contactPhone:d.contactPhone,contactPhoneNormalized:phone}:{}),...(d.status?{status:d.status}:{}),...(d.assignedMembershipId?{assignedMembershipId:d.assignedMembershipId}:{}),...(d.nextFollowupAt?{nextFollowupAt:new Date(d.nextFollowupAt)}:{}),...(!before.qualifiedAt&&phone?{qualifiedAt:new Date()}:{}),updatedAt:new Date(),rowVersion:{increment:1}}});
   if(!updated.count)throw new ConflictException('Stale lead rowVersion');
   if(newStatus!==before.status)await tx.crmLeadEvent.create({data:{tenantId:t,leadId:id,eventType:'STAGE_CHANGED',fromStatus:before.status,toStatus:newStatus,actorUserId:a.userId}});
   if(!before.qualifiedAt&&phone)await tx.crmLeadEvent.create({data:{tenantId:t,leadId:id,eventType:'QUALIFIED',actorUserId:a.userId}});
   await this.log(tx,t,a,'crm.lead.updated','crm.lead',id,{status:newStatus,assignmentChanged:d.assignedMembershipId!==undefined});
   return {id,status:newStatus,rowVersion:d.rowVersion+1};
  });}
 async addActivity(t:string,id:string,a:Actor,d:CreateActivityDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  const lead=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!lead)throw new NotFoundException();
  await this.auth.require(tx,t,a,'crm.activity.write',lead.branchId);
  const activity=await tx.crmLeadActivity.create({data:{tenantId:t,leadId:id,actorUserId:a.userId,kind:d.kind,note:d.note,outcome:d.outcome,followupAt:d.followupAt?new Date(d.followupAt):undefined}});
  if(d.followupAt)await tx.crmLead.update({where:{tenantId_id:{tenantId:t,id}},data:{nextFollowupAt:new Date(d.followupAt)}});
  await this.log(tx,t,a,'crm.lead.activity.created','crm.lead.activity',activity.id,{leadId:id,kind:d.kind});return activity;
 });}
 async addTouch(t:string,id:string,a:Actor,d:CreateTouchDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  const lead=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!lead)throw new NotFoundException();
  await this.auth.require(tx,t,a,'crm.lead.update',lead.branchId);await this.source(tx,t,d.sourceId);await this.campaign(tx,t,d.campaignId,d.sourceId);
  const touch=await tx.crmLeadTouch.create({data:{tenantId:t,leadId:id,sourceId:d.sourceId,campaignId:d.campaignId,touchType:d.touchType}});
  await this.log(tx,t,a,'crm.lead.touch.created','crm.lead.touch',touch.id,{leadId:id,sourceId:d.sourceId});return touch;
 });}
 async listCheckins(t:string,a:Actor,branchId?:string){uuid(t);if(branchId)uuid(branchId);return this.db.tenantTx(t,a.userId,async tx=>{
  const allowed=await this.auth.allowedBranchIds(tx,t,a,'crm.checkin.read');if(branchId&&allowed&&!allowed.includes(branchId))throw new ForbiddenException('Branch outside scope');
  return tx.crmCheckin.findMany({where:{tenantId:t,...(branchId?{branchId}:allowed?{branchId:{in:allowed}}:{})},select:{id:true,personId:true,leadId:true,branchId:true,status:true,checkedInAt:true,completedAt:true,purpose:true},take:100,orderBy:{checkedInAt:'desc'}});
 });}
 async createCheckin(t:string,a:Actor,d:CreateCheckinDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.checkin.create',d.branchId);await this.branch(tx,t,d.branchId);await this.personInBranch(tx,t,d.personId,d.branchId);await this.source(tx,t,d.sourceId);
  if(d.leadId){const l=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id:d.leadId}}});if(!l||l.branchId!==d.branchId||l.personId!==d.personId)throw new BadRequestException('Lead/person/branch mismatch');}
  const c=await tx.crmCheckin.create({data:{tenantId:t,personId:d.personId,branchId:d.branchId,leadId:d.leadId,sourceId:d.sourceId,purpose:d.purpose,receivedByUserId:a.userId}});
  await this.log(tx,t,a,'crm.checkin.created','crm.checkin',c.id,{branchId:c.branchId,leadId:c.leadId});return c;
 });}
 async completeCheckin(t:string,id:string,a:Actor,d:CompleteCheckinDto){uuid(t);uuid(id);
  return this.db.tenantTx(t,a.userId,async tx=>{
   const c=await tx.crmCheckin.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!c)throw new NotFoundException();
   await this.auth.require(tx,t,a,'crm.checkin.update',c.branchId);
   const linkedSubmission=d.intakeSubmissionId?await tx.crmIntakeSubmission.findUnique({where:{tenantId_id:{tenantId:t,id:d.intakeSubmissionId}}}):null;
   if(d.intakeSubmissionId&&(!linkedSubmission||linkedSubmission.status!=='CONFIRMED'||linkedSubmission.checkinId!==c.id))throw new BadRequestException('Intake submission does not match check-in');
   const guardianName=linkedSubmission?.guardianName??d.guardianName;
   const guardianPhone=linkedSubmission?.guardianPhone??d.guardianPhone;
   if(!guardianName?.trim())throw new BadRequestException('Guardian name required');
   let phone:string;try{phone=normalizePhone(guardianPhone)!;if(!phone)throw Error()}catch{throw new BadRequestException('Valid guardian phone required')}
   if(c.status!=='DRAFT')throw new ConflictException('Check-in already finalized');
   const claimed=await tx.crmCheckin.updateMany({where:{tenantId:t,id,status:'DRAFT'},data:{status:'COMPLETED',completedAt:new Date()}});
   if(claimed.count!==1)throw new ConflictException('Concurrent check-in completion');
   const person=await this.personInBranch(tx,t,c.personId,c.branchId);if(!person.fullName.trim())throw new BadRequestException('Student name required');
   if(!d.dateOfBirth||!d.schoolName?.trim()||!d.schoolGrade?.trim())throw new BadRequestException('Date of birth, school and grade required for completed check-in');
   await tx.crmPerson.update({where:{tenantId_id:{tenantId:t,id:c.personId}},data:{dateOfBirth:new Date(d.dateOfBirth),schoolName:d.schoolName.trim(),schoolGrade:d.schoolGrade.trim()}});
   const s=await tx.crmStudent.upsert({where:{tenantId_personId:{tenantId:t,personId:c.personId}},create:{tenantId:t,personId:c.personId},update:{}});
   const existingLinks=await tx.crmStudentGuardian.findMany({where:{tenantId:t,studentId:s.id}});
   let alreadyLinked=false;
   for(const link of existingLinks){
    const g=await tx.crmPerson.findUnique({where:{tenantId_id:{tenantId:t,id:link.guardianPersonId}}});
    const contact=await tx.crmPersonContact.findFirst({where:{tenantId:t,personId:link.guardianPersonId,kind:'PHONE',normalizedValue:phone}});
    if(g&&normalizedName(g.fullName)===normalizedName(guardianName)&&contact){alreadyLinked=true;break;}
   }
   if(!alreadyLinked){
    // Never merge guardians using phone alone: a phone may belong to several family members.
    const guardian=await this.createPersonTx(tx,t,c.branchId,{fullName:guardianName});
    await tx.crmPersonContact.create({data:{tenantId:t,personId:guardian.id,kind:'PHONE',rawValue:guardianPhone!,normalizedValue:phone,isPrimary:true}});
    await tx.crmStudentGuardian.create({data:{tenantId:t,studentId:s.id,guardianPersonId:guardian.id,relationType:d.guardianRelation||'PARENT',isPrimary:existingLinks.length===0}});
   }
   const updated=await tx.crmCheckin.update({where:{tenantId_id:{tenantId:t,id}},data:{studentId:s.id}});
   await tx.crmPerson.update({where:{tenantId_id:{tenantId:t,id:c.personId}},data:{status:'CUSTOMER'}});
   if(c.leadId){const lead=await tx.crmLead.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id:c.leadId}}});await tx.crmLead.update({where:{tenantId_id:{tenantId:t,id:c.leadId}},data:{status:'CONVERTED',rowVersion:{increment:1}}});await tx.crmLeadEvent.create({data:{tenantId:t,leadId:c.leadId,eventType:'CHECKIN_COMPLETED',fromStatus:lead.status,toStatus:'CONVERTED',actorUserId:a.userId}});}
   await this.log(tx,t,a,'crm.checkin.completed','crm.checkin',id,{studentId:s.id,branchId:c.branchId});return {id:updated.id,studentId:s.id,status:updated.status};
  });}
 async createIntakeInvite(t:string,a:Actor,d:CreateIntakeInviteDto){
  if(process.env.PUBLIC_INTAKE_ENABLED!=='true')throw new ServiceUnavailableException('QR intake requires public intake to be enabled securely');
  uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.intake.manage',d.branchId);await this.branch(tx,t,d.branchId);
  if(d.leadId){const l=await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id:d.leadId}}});if(!l||l.branchId!==d.branchId)throw new BadRequestException('Lead/branch mismatch')}
  const token=randomBytes(32).toString('base64url');const hash=createHash('sha256').update(token).digest('hex');const expires=new Date(Date.now()+(d.expiresMinutes??30)*60000);
  const invite=await tx.crmIntakeInvite.create({data:{tenantId:t,branchId:d.branchId,leadId:d.leadId,tokenHash:hash,expiresAt:expires,createdByUserId:a.userId}});
  await this.log(tx,t,a,'crm.intake.invite.created','crm.intake.invite',invite.id,{branchId:d.branchId,expiresAt:expires.toISOString()});
  const root=(process.env.PUBLIC_FRONTEND_URL||'').replace(/\/$/,'');
  return {inviteId:invite.id,url:root?`${root}/intake/${t}/${token}`:null,token:root?undefined:token,expiresAt:expires};
 });}
 async submitIntake(t:string,token:string,d:SubmitIntakeDto){
  if(process.env.PUBLIC_INTAKE_ENABLED!=='true')throw new ServiceUnavailableException('Public QR intake is not enabled');
  uuid(t);if(!/^[\w-]{40,80}$/.test(token))throw new NotFoundException();const hash=createHash('sha256').update(token).digest('hex');
  try{if(!normalizePhone(d.guardianPhone))throw Error()}catch{throw new BadRequestException('Valid guardian phone required')}
  return this.db.tenantTx(t,'public-intake',async tx=>{
   // Tenant RLS is set, but authority comes from the single-use secret, never from the URL tenantId alone.
   const invite=await tx.crmIntakeInvite.findFirst({where:{tenantId:t,tokenHash:hash,redeemedAt:null,expiresAt:{gt:new Date()}}});
   if(!invite)throw new NotFoundException('Invalid or expired invitation');
   const lock=await tx.crmIntakeInvite.updateMany({where:{tenantId:t,id:invite.id,redeemedAt:null,expiresAt:{gt:new Date()}},data:{redeemedAt:new Date()}});
   if(lock.count!==1)throw new ConflictException('Already submitted');
   const sub=await tx.crmIntakeSubmission.create({data:{tenantId:t,inviteId:invite.id,fullName:d.fullName.trim(),guardianName:d.guardianName.trim(),guardianPhone:d.guardianPhone,consentedAt:new Date(),dateOfBirth:d.dateOfBirth?new Date(d.dateOfBirth):undefined,schoolName:d.schoolName,schoolGrade:d.schoolGrade}});
   await this.log(tx,t,null,'crm.intake.submitted','crm.intake.submission',sub.id,{branchId:invite.branchId});
   return {submissionId:sub.id,status:'RECEIVED'};
  });}
 async listIntakeSubmissions(t:string,a:Actor,branchId:string){uuid(t);uuid(branchId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'crm.intake.read',branchId);
  const invites=await tx.crmIntakeInvite.findMany({where:{tenantId:t,branchId},select:{id:true},take:5000});
  const submissions=await tx.crmIntakeSubmission.findMany({where:{tenantId:t,inviteId:{in:invites.map(i=>i.id)}},take:100,orderBy:{createdAt:'desc'}});
  const rights=await this.auth.permissionSnapshot(tx,t,a);
  const sensitive=Boolean(rights.permissions['pii.read_sensitive']?.tenantWide||rights.permissions['pii.read_sensitive']?.branchIds.includes(branchId));
  return submissions.map(s=>({...s,guardianPhone:sensitive?s.guardianPhone:redactPhone(s.guardianPhone)}));
 });}
 async reviewIntake(t:string,id:string,a:Actor,d:ReviewIntakeDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  const sub=await tx.crmIntakeSubmission.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!sub)throw new NotFoundException();
  const invite=await tx.crmIntakeInvite.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id:sub.inviteId}}});
  await this.auth.require(tx,t,a,'crm.intake.manage',invite.branchId);
  if(sub.status!=='RECEIVED')throw new ConflictException('Already reviewed');
  if(d.decision==='REJECTED'){
   await tx.crmIntakeSubmission.update({where:{tenantId_id:{tenantId:t,id}},data:{status:'REJECTED',reviewedAt:new Date(),reviewedByUserId:a.userId}});
   await this.log(tx,t,a,'crm.intake.rejected','crm.intake.submission',id);return {id,status:'REJECTED'};
  }
  const linkedLead=invite.leadId?await tx.crmLead.findUnique({where:{tenantId_id:{tenantId:t,id:invite.leadId}}}):null;
  if(invite.leadId&&!linkedLead)throw new BadRequestException('Linked lead no longer exists');
  if(d.existingPersonId)await this.personInBranch(tx,t,d.existingPersonId,invite.branchId);
  if(linkedLead&&d.existingPersonId&&d.existingPersonId!==linkedLead.personId)throw new BadRequestException('Lead is linked to a different person');
  if(linkedLead){const original=await tx.crmPerson.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id:linkedLead.personId}}});
   if(normalizedName(original.fullName)!==normalizedName(sub.fullName))throw new BadRequestException('Name differs from the linked Lead. Review identity manually before confirming');}
  // For a QR sent from a lead, always reuse that person's stable identity. Never create a second customer.
  const chosenPersonId=d.existingPersonId??linkedLead?.personId;
  const p=chosenPersonId?{id:chosenPersonId}:await this.createPersonTx(tx,t,invite.branchId,{fullName:sub.fullName,schoolName:sub.schoolName??undefined,schoolGrade:sub.schoolGrade??undefined,dateOfBirth:sub.dateOfBirth?.toISOString().slice(0,10)});
  const sourceId=linkedLead?.sourceId??(await tx.crmMarketingSource.findFirst({where:{tenantId:t,category:'WALK_IN',isActive:true}}))?.id;
  if(!sourceId)throw new BadRequestException('Configure active WALK_IN source before confirming QR check-in');
  const c=await tx.crmCheckin.create({data:{tenantId:t,branchId:invite.branchId,personId:p.id,leadId:invite.leadId,sourceId,receivedByUserId:a.userId,status:'DRAFT'}});
  await tx.crmIntakeSubmission.update({where:{tenantId_id:{tenantId:t,id}},data:{status:'CONFIRMED',reviewedAt:new Date(),reviewedByUserId:a.userId,checkinId:c.id}});
  await this.log(tx,t,a,'crm.intake.confirmed','crm.intake.submission',id,{personId:p.id,checkinId:c.id});
  return {id,status:'CONFIRMED',personId:p.id,checkinId:c.id};
 });}
}
