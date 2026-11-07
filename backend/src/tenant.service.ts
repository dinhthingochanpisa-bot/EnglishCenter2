import { BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from './prisma.service';
import { Authorization } from './authorization';
import { Actor,uuid } from './contracts';
import { CreateTenantDto,UpdateTenantDto,CreateBranchDto,UpdateBranchDto,CreateRoleDto,UpdateRoleDto,AddMembershipDto,UpdateMembershipDto,AssignRoleDto,AssignBranchDto,AssignPermissionDto,CreateUserDto } from './dto';
@Injectable() export class CoreService {
 constructor(private readonly db:Db,private readonly auth:Authorization){}
 private log(tx:Prisma.TransactionClient,t:string,a:Actor,action:string,type:string,id:string,before?:unknown,after?:unknown){
  return tx.auditLog.create({data:{tenantId:t,actorUserId:a.userId,action,resourceType:type,resourceId:id,beforeData:before===undefined?undefined:before as Prisma.InputJsonValue,afterData:after===undefined?undefined:after as Prisma.InputJsonValue}});
 }
 private platform(a:Actor){if(!a.platformAdmin)throw new ForbiddenException('Platform operator access required');}
 async createTenant(a:Actor,d:CreateTenantDto){
  this.platform(a);
  // Platform provisioning role is separate from tenant runtime role and is tightly restricted operationally.
  return this.db.provisioning.$transaction(async tx=>{
   const t=await tx.tenant.create({data:d});
   // Tenant rows have RLS FORCE; explicitly pin context for tenant role creation.
   await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t.id}, true)`;
   await tx.auditLog.create({data:{tenantId:t.id,actorUserId:a.userId,action:'tenant.created',resourceType:'tenant',resourceId:t.id,afterData:{code:t.code}}});
   return t;
  });
 }
 async bootstrapAdmin(t:string,a:Actor,userId:string){
  this.platform(a);uuid(t);uuid(userId);
  const baseCodes=['tenant.read','org.branch.read','org.branch.manage','org.membership.read','org.membership.manage','iam.role.read','iam.role.manage','iam.permission.read','iam.permission.assign','audit.read',
   'crm.person.read','crm.person.create','crm.person.update','crm.lead.read','crm.lead.create','crm.lead.update','crm.lead.assign',
   'crm.source.read','crm.source.manage','crm.activity.write','crm.checkin.read','crm.checkin.create','crm.checkin.update','crm.intake.read','crm.intake.manage'];
  return this.db.provisioning.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t}, true)`;
   const tenant=await tx.tenant.findUnique({where:{id:t}});
   const user=await tx.platformUser.findUnique({where:{id:userId}});
   if(!tenant||!user||user.status!=='ACTIVE')throw new NotFoundException('Active tenant and platform user required');
   const existing=await tx.role.findUnique({where:{tenantId_code:{tenantId:t,code:'TENANT_ADMIN'}}});
   if(existing)throw new ConflictException('Tenant already bootstrapped');
   const role=await tx.role.create({data:{tenantId:t,code:'TENANT_ADMIN',name:'Tenant Administrator',systemRole:true,scopeType:'TENANT'}});
   for(const code of baseCodes){
    const p=await tx.permission.findUnique({where:{code}});
    if(!p)throw new ConflictException(`Permission catalog missing: ${code}`);
    await tx.rolePermission.create({data:{tenantId:t,roleId:role.id,permissionId:p.id}});
   }
   const membership=await tx.tenantMembership.create({data:{tenantId:t,userId,status:'ACTIVE',joinedAt:new Date()}});
   await tx.membershipRole.create({data:{tenantId:t,membershipId:membership.id,roleId:role.id,validFrom:new Date()}});
   await this.log(tx,t,a,'tenant.admin.bootstrapped','membership',membership.id,undefined,{userId,roleId:role.id});
   return {tenantId:t,membershipId:membership.id,roleId:role.id};
  });
 }
 async listTenants(a:Actor){this.platform(a);return this.db.provisioning.tenant.findMany({select:{id:true,code:true,displayName:true,status:true},take:100,orderBy:{createdAt:'desc'}});}
 async getTenant(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'tenant.read');
  // Identity read credential may select global tenant, but only after runtime membership is verified.
  return this.db.identity.tenant.findUnique({where:{id:t},select:{id:true,code:true,displayName:true,status:true,timezone:true}});
 });}
 async updateTenant(t:string,a:Actor,d:UpdateTenantDto){this.platform(a);uuid(t);return this.db.provisioning.$transaction(async tx=>{
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t}, true)`;
  const before=await tx.tenant.findUnique({where:{id:t}});if(!before)throw new NotFoundException();
  const after=await tx.tenant.update({where:{id:t},data:d});
  await this.log(tx,t,a,'tenant.updated','tenant',t,{displayName:before.displayName,status:before.status},{displayName:after.displayName,status:after.status});
  return after;
 });}
 async createUser(a:Actor,d:CreateUserDto){this.platform(a);return this.db.provisioning.platformUser.create({data:d,select:{id:true,authSubject:true,email:true,displayName:true,status:true}});}
 async listUsers(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.read');
  const members=await tx.tenantMembership.findMany({where:{tenantId:t},orderBy:{createdAt:'desc'},take:100});
  const users=await this.db.identity.platformUser.findMany({where:{id:{in:members.map(m=>m.userId)}},select:{id:true,displayName:true,email:true,status:true}});
  return members.map(m=>({membershipId:m.id,memberStatus:m.status,user:users.find(u=>u.id===m.userId)||null}));
 });}
 async createBranch(t:string,a:Actor,d:CreateBranchDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.branch.manage');
  const b=await tx.branch.create({data:{...d,tenantId:t}});
  await this.log(tx,t,a,'branch.created','branch',b.id,undefined,{code:b.code,name:b.name});return b;
 });}
 async listBranches(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  const allowed=await this.auth.allowedBranchIds(tx,t,a,'org.branch.read');
  return tx.branch.findMany({where:{tenantId:t,...(allowed?{id:{in:allowed}}:{})},orderBy:{code:'asc'},take:200});
 });}
 async updateBranch(t:string,id:string,a:Actor,d:UpdateBranchDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.branch.manage',id);
  const {rowVersion,...patch}=d;
  const before=await tx.branch.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!before)throw new NotFoundException();
  const updated=await tx.branch.updateMany({where:{tenantId:t,id,rowVersion},data:{...patch,rowVersion:{increment:1},updatedAt:new Date()}});
  if(!updated.count)throw new ConflictException('Stale rowVersion');
  const after=await tx.branch.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id}}});
  await this.log(tx,t,a,'branch.updated','branch',id,{name:before.name,isActive:before.isActive},{name:after.name,isActive:after.isActive});return after;
 });}
 async addMembership(t:string,a:Actor,d:AddMembershipDto){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.manage');
  const user=await this.db.identity.platformUser.findUnique({where:{id:d.userId},select:{id:true,status:true}});
  if(!user||user.status==='DISABLED')throw new BadRequestException('User unknown or disabled');
  const m=await tx.tenantMembership.create({data:{tenantId:t,userId:d.userId,employeeCode:d.employeeCode,status:'INVITED'}});
  await this.log(tx,t,a,'membership.created','membership',m.id,undefined,{userId:m.userId,status:m.status});return m;
 });}
 async listMemberships(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.read');
  return tx.tenantMembership.findMany({where:{tenantId:t},take:200,orderBy:{createdAt:'desc'},include:{roles:{include:{role:{select:{id:true,code:true,name:true,scopeType:true}}}},branchScopes:{include:{branch:{select:{id:true,code:true,name:true,isActive:true}}}}}});
 });}
 async updateMembership(t:string,id:string,a:Actor,d:UpdateMembershipDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.manage');
  const before=await tx.tenantMembership.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!before)throw new NotFoundException();
  if(before.userId===a.userId&&d.status!=='ACTIVE')throw new ForbiddenException('Cannot deactivate own membership');
  const updated=await tx.tenantMembership.updateMany({where:{tenantId:t,id,rowVersion:d.rowVersion},data:{status:d.status,rowVersion:{increment:1},updatedAt:new Date(),...(d.status==='ACTIVE'?{joinedAt:before.joinedAt||new Date()}:{}),...(d.status==='LEFT'?{leftAt:new Date()}:{})}});
  if(!updated.count)throw new ConflictException('Stale rowVersion');
  const after=await tx.tenantMembership.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id}}});
  await this.log(tx,t,a,'membership.updated','membership',id,{status:before.status},{status:after.status});return after;
 });}
 async createRole(t:string,a:Actor,d:CreateRoleDto){uuid(t);if(!['TENANT','ASSIGNED_BRANCHES'].includes(d.scopeType))throw new BadRequestException('Stage 01A only supports TENANT and ASSIGNED_BRANCHES roles');return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.role.manage');
  const r=await tx.role.create({data:{tenantId:t,code:d.code,name:d.name,scopeType:d.scopeType}});
  await this.log(tx,t,a,'role.created','role',r.id,undefined,{code:r.code,scopeType:r.scopeType});return r;
 });}
 async listRoles(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.role.read');return tx.role.findMany({where:{tenantId:t},include:{permissions:{include:{permission:true}}},take:200});
 });}
 async updateRole(t:string,id:string,a:Actor,d:UpdateRoleDto){uuid(t);uuid(id);if(d.scopeType&&!['TENANT','ASSIGNED_BRANCHES'].includes(d.scopeType))throw new BadRequestException('Unsupported scope');return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.role.manage');
  const before=await tx.role.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!before)throw new NotFoundException();
  if(before.systemRole)throw new ForbiddenException('System role immutable');
  const {rowVersion,...patch}=d;
  const n=await tx.role.updateMany({where:{tenantId:t,id,rowVersion},data:{...patch,rowVersion:{increment:1},updatedAt:new Date()}});
  if(!n.count)throw new ConflictException('Stale rowVersion');
  const after=await tx.role.findUniqueOrThrow({where:{tenantId_id:{tenantId:t,id}}});
  await this.log(tx,t,a,'role.updated','role',id,{name:before.name,scopeType:before.scopeType},{name:after.name,scopeType:after.scopeType});return after;
 });}
 async listPermissions(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.permission.read');return tx.permission.findMany({orderBy:{code:'asc'},take:300});
 });}
 async actorCanGrant(tx:Prisma.TransactionClient,t:string,a:Actor,code:string){
  // No actor can delegate a privilege they do not currently possess.
  await this.auth.require(tx,t,a,code);
 }
 async addRolePermission(t:string,roleId:string,a:Actor,d:AssignPermissionDto){uuid(t);uuid(roleId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.permission.assign');
  await this.actorCanGrant(tx,t,a,d.permissionCode);
  const role=await tx.role.findUnique({where:{tenantId_id:{tenantId:t,id:roleId}}});if(!role)throw new NotFoundException('Role');
  if(role.systemRole)throw new ForbiddenException('System role immutable');
  const p=await tx.permission.findUnique({where:{code:d.permissionCode}});if(!p)throw new NotFoundException('Permission');
  const rp=await tx.rolePermission.create({data:{tenantId:t,roleId,permissionId:p.id}});
  await this.log(tx,t,a,'role.permission.granted','role',roleId,undefined,{permissionCode:p.code});return rp;
 });}
 async removeRolePermission(t:string,roleId:string,code:string,a:Actor){uuid(t);uuid(roleId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.permission.assign');
  const role=await tx.role.findUnique({where:{tenantId_id:{tenantId:t,id:roleId}}});if(!role)throw new NotFoundException();
  if(role.systemRole)throw new ForbiddenException('System role immutable');
  const p=await tx.permission.findUnique({where:{code}});if(!p)throw new NotFoundException();
  await tx.rolePermission.delete({where:{tenantId_roleId_permissionId:{tenantId:t,roleId,permissionId:p.id}}});
  await this.log(tx,t,a,'role.permission.revoked','role',roleId,{permissionCode:code});return {ok:true};
 });}
 async myPermissions(t:string,a:Actor){uuid(t);return this.db.tenantTx(t,a.userId,async tx=>this.auth.permissionSnapshot(tx,t,a));}
 async removeMembershipRole(t:string,id:string,assignmentId:string,a:Actor){uuid(t);uuid(id);uuid(assignmentId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.role.manage');
  const membership=await tx.tenantMembership.findUnique({where:{tenantId_id:{tenantId:t,id}}});
  if(!membership)throw new NotFoundException('Membership');
  if(membership.userId===a.userId)throw new ForbiddenException('Cannot remove your own role');
  const assignment=await tx.membershipRole.findFirst({where:{tenantId:t,id:assignmentId,membershipId:id},include:{role:true}});
  if(!assignment)throw new NotFoundException('Role assignment');
  if(assignment.role.systemRole&&assignment.role.code==='TENANT_ADMIN')throw new ForbiddenException('Bootstrap administrator role cannot be revoked via self-service');
  const now=new Date();
  if(assignment.validTo&&assignment.validTo<=now)throw new ConflictException('Role assignment already inactive');
  if(assignment.validFrom>now){await tx.membershipRole.delete({where:{id:assignment.id}});}
  else {await tx.membershipRole.update({where:{id:assignment.id},data:{validTo:now}});}
  await this.log(tx,t,a,'membership.role.revoked','membership',id,undefined,{assignmentId,roleId:assignment.roleId});return {ok:true};
 });}
 async removeMembershipBranch(t:string,id:string,assignmentId:string,a:Actor){uuid(t);uuid(id);uuid(assignmentId);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.manage');
  const assignment=await tx.membershipBranchScope.findFirst({where:{tenantId:t,id:assignmentId,membershipId:id}});
  if(!assignment)throw new NotFoundException('Branch assignment');
  const now=new Date();
  if(assignment.validTo&&assignment.validTo<=now)throw new ConflictException('Branch assignment already inactive');
  if(assignment.validFrom>now)await tx.membershipBranchScope.delete({where:{id:assignment.id}});
  else await tx.membershipBranchScope.update({where:{id:assignment.id},data:{validTo:now}});
  await this.log(tx,t,a,'membership.branch.revoked','membership',id,undefined,{assignmentId,branchId:assignment.branchId});return {ok:true};
 });}
 private dates(from?:string,to?:string){
  const validFrom=from?new Date(from):new Date();const validTo=to?new Date(to):undefined;
  if(Number.isNaN(validFrom.getTime())||(validTo&&Number.isNaN(validTo.getTime()))||(validTo&&validTo<=validFrom))throw new BadRequestException('Invalid effective date range');
  return {validFrom,validTo};
 }
 async assignMembershipRole(t:string,id:string,a:Actor,d:AssignRoleDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'iam.role.manage');
  const m=await tx.tenantMembership.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!m)throw new NotFoundException('Membership');
  if(m.userId===a.userId)throw new ForbiddenException('Self role assignment prohibited');
  const role=await tx.role.findUnique({where:{tenantId_id:{tenantId:t,id:d.roleId}},include:{permissions:{include:{permission:true}}}});if(!role)throw new NotFoundException('Role');
  for(const rp of role.permissions)await this.actorCanGrant(tx,t,a,rp.permission.code);
  const assigned=await tx.membershipRole.create({data:{tenantId:t,membershipId:id,roleId:d.roleId,...this.dates(d.validFrom,d.validTo)}});
  await this.log(tx,t,a,'membership.role.assigned','membership',id,undefined,{roleId:d.roleId});return assigned;
 });}
 async assignMembershipBranch(t:string,id:string,a:Actor,d:AssignBranchDto){uuid(t);uuid(id);return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'org.membership.manage',d.branchId);
  const m=await tx.tenantMembership.findUnique({where:{tenantId_id:{tenantId:t,id}}});if(!m)throw new NotFoundException('Membership');
  const b=await tx.branch.findUnique({where:{tenantId_id:{tenantId:t,id:d.branchId}}});if(!b||!b.isActive)throw new NotFoundException('Active branch');
  const scope=await tx.membershipBranchScope.create({data:{tenantId:t,membershipId:id,branchId:d.branchId,...this.dates(d.validFrom,d.validTo)}});
  await this.log(tx,t,a,'membership.branch.assigned','membership',id,undefined,{branchId:d.branchId});return scope;
 });}
 async audit(t:string,a:Actor,limit:number,cursor?:string){uuid(t);if(cursor)uuid(cursor);if(!Number.isFinite(limit)||!Number.isInteger(limit)||limit<1||limit>100)throw new BadRequestException('limit must be an integer between 1 and 100');return this.db.tenantTx(t,a.userId,async tx=>{
  await this.auth.require(tx,t,a,'audit.read');return tx.auditLog.findMany({where:{tenantId:t},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:Math.min(100,Math.max(1,limit)),...(cursor?{cursor:{id:cursor},skip:1}:{})});
 });}
}
