import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from './contracts';
import { Db } from './prisma.service';
@Injectable() export class Authorization {
 constructor(private readonly db:Db){}
 async ensureMembership(tx:Prisma.TransactionClient,tenantId:string,actor:Actor){
  const m=await tx.tenantMembership.findUnique({where:{tenantId_userId:{tenantId,userId:actor.userId}}});
  if(!m||m.status!=='ACTIVE') throw new ForbiddenException('Active tenant membership required');
  const tenant=await this.db.identity.tenant.findUnique({where:{id:tenantId},select:{status:true}});
  if(!tenant||!['ACTIVE','ONBOARDING'].includes(tenant.status))throw new ForbiddenException('Tenant is not active');
  return m;
 }
 async require(tx:Prisma.TransactionClient,tenantId:string,actor:Actor,permissionCode:string,branchId?:string){
  const m=await this.ensureMembership(tx,tenantId,actor);
  const now=new Date();
  const roles=await tx.membershipRole.findMany({where:{tenantId,membershipId:m.id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{role:{include:{permissions:{include:{permission:true}}}}}});
  const allowedRoles=roles.filter(r=>r.role.permissions.some(p=>p.permission.code===permissionCode));
  if(!allowedRoles.length)throw new ForbiddenException(`Missing permission ${permissionCode}`);
  if(branchId){
   if(allowedRoles.some(r=>r.role.scopeType==='TENANT'))return m;
   if(!allowedRoles.some(r=>r.role.scopeType==='ASSIGNED_BRANCHES'))throw new ForbiddenException('Permission scope cannot access branch');
   const scope=await tx.membershipBranchScope.findFirst({where:{tenantId,membershipId:m.id,branchId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}});
   if(!scope)throw new ForbiddenException('Branch outside assigned scope');
  }else if(!allowedRoles.some(r=>r.role.scopeType==='TENANT')){
   // Prevent listing all tenant data with a branch-scoped privilege.
   throw new ForbiddenException('Tenant-wide operation requires tenant-scoped role');
  }
  return m;
 }
 async permissionSnapshot(tx:Prisma.TransactionClient,tenantId:string,actor:Actor){
  const m=await this.ensureMembership(tx,tenantId,actor);const now=new Date();
  const assignments=await tx.membershipRole.findMany({where:{tenantId,membershipId:m.id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{role:{include:{permissions:{include:{permission:true}}}}}});
  const scopes=await tx.membershipBranchScope.findMany({where:{tenantId,membershipId:m.id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},select:{branchId:true}});
  const permissions:Record<string,{tenantWide:boolean;branchIds:string[]}>= {};
  for(const assignment of assignments){
    for(const p of assignment.role.permissions){
      const code=p.permission.code;const entry=permissions[code]??{tenantWide:false,branchIds:[]};
      if(assignment.role.scopeType==='TENANT')entry.tenantWide=true;
      if(assignment.role.scopeType==='ASSIGNED_BRANCHES')entry.branchIds.push(...scopes.map(s=>s.branchId));
      permissions[code]=entry;
    }
  }
  return {membershipId:m.id,tenantId,permissions:Object.fromEntries(Object.entries(permissions).map(([k,v])=>[k,{tenantWide:v.tenantWide,branchIds:[...new Set(v.branchIds)]}]))};
 }
 async allowedBranchIds(tx:Prisma.TransactionClient,tenantId:string,actor:Actor,permissionCode:string):Promise<string[]|null>{
  const m=await this.ensureMembership(tx,tenantId,actor);
  const now=new Date();
  const roles=await tx.membershipRole.findMany({where:{tenantId,membershipId:m.id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{role:{include:{permissions:{include:{permission:true}}}}}});
  const relevant=roles.filter(r=>r.role.permissions.some(p=>p.permission.code===permissionCode));
  if(!relevant.length)throw new ForbiddenException('Permission denied');
  if(relevant.some(r=>r.role.scopeType==='TENANT'))return null;
  if(!relevant.some(r=>r.role.scopeType==='ASSIGNED_BRANCHES'))throw new ForbiddenException('No supported branch scope');
  const scopes=await tx.membershipBranchScope.findMany({where:{tenantId,membershipId:m.id,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},select:{branchId:true}});
  return scopes.map(s=>s.branchId);
 }
}
