import { Body,Controller,Get,Patch,Post,Delete,Param,Query,Req,UseGuards,ValidationPipe,ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { AuthGuard,AuthRequest } from './auth';
import { CoreService } from './tenant.service';
import { CreateTenantDto,UpdateTenantDto,CreateUserDto,CreateBranchDto,UpdateBranchDto,AddMembershipDto,UpdateMembershipDto,CreateRoleDto,UpdateRoleDto,AssignRoleDto,AssignBranchDto,AssignPermissionDto,BootstrapTenantDto } from './dto';
const V=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
@ApiTags('platform') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('v1/platform')
export class PlatformController {
 constructor(private readonly svc:CoreService){}
 @Post('tenants') createTenant(@Req() r:AuthRequest,@Body(V) d:CreateTenantDto){return this.svc.createTenant(r.actor,d)}
 @Get('tenants') listTenants(@Req() r:AuthRequest){return this.svc.listTenants(r.actor)}
 @Patch('tenants/:tenantId') updateTenant(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Body(V) d:UpdateTenantDto){return this.svc.updateTenant(t,r.actor,d)}
 @Post('tenants/:tenantId/bootstrap-admin') bootstrap(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Body(V) d:BootstrapTenantDto){return this.svc.bootstrapAdmin(t,r.actor,d.userId)}
 @Post('users') createUser(@Req() r:AuthRequest,@Body(V) d:CreateUserDto){return this.svc.createUser(r.actor,d)}
}
@ApiTags('tenant') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('v1/tenants/:tenantId')
export class TenantController {
 constructor(private readonly svc:CoreService){}
 @Get() getTenant(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.getTenant(t,r.actor)}
 @Get('me/permissions') permissionsForMe(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.myPermissions(t,r.actor)}
 @Get('users') users(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.listUsers(t,r.actor)}
 @Get('branches') branches(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.listBranches(t,r.actor)}
 @Post('branches') branchCreate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Body(V) d:CreateBranchDto){return this.svc.createBranch(t,r.actor,d)}
 @Patch('branches/:id') branchUpdate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:UpdateBranchDto){return this.svc.updateBranch(t,id,r.actor,d)}
 @Get('memberships') memberships(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.listMemberships(t,r.actor)}
 @Post('memberships') membershipCreate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Body(V) d:AddMembershipDto){return this.svc.addMembership(t,r.actor,d)}
 @Patch('memberships/:id') membershipUpdate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:UpdateMembershipDto){return this.svc.updateMembership(t,id,r.actor,d)}
 @Post('memberships/:id/roles') membershipRole(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:AssignRoleDto){return this.svc.assignMembershipRole(t,id,r.actor,d)}
 @Delete('memberships/:id/roles/:assignmentId') membershipRoleRevoke(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Param('assignmentId',ParseUUIDPipe) assignmentId:string){return this.svc.removeMembershipRole(t,id,assignmentId,r.actor)}
 @Post('memberships/:id/branches') membershipBranch(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:AssignBranchDto){return this.svc.assignMembershipBranch(t,id,r.actor,d)}
 @Delete('memberships/:id/branches/:assignmentId') membershipBranchRevoke(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Param('assignmentId',ParseUUIDPipe) assignmentId:string){return this.svc.removeMembershipBranch(t,id,assignmentId,r.actor)}
 @Get('roles') roles(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.listRoles(t,r.actor)}
 @Post('roles') roleCreate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Body(V) d:CreateRoleDto){return this.svc.createRole(t,r.actor,d)}
 @Patch('roles/:id') roleUpdate(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:UpdateRoleDto){return this.svc.updateRole(t,id,r.actor,d)}
 @Get('permissions') permissions(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string){return this.svc.listPermissions(t,r.actor)}
 @Post('roles/:id/permissions') grantPermission(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Body(V) d:AssignPermissionDto){return this.svc.addRolePermission(t,id,r.actor,d)}
 @Delete('roles/:id/permissions/:code') revokePermission(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Param('id',ParseUUIDPipe) id:string,@Param('code') code:string){return this.svc.removeRolePermission(t,id,code,r.actor)}
 @Get('audit-logs') audit(@Req() r:AuthRequest,@Param('tenantId',ParseUUIDPipe) t:string,@Query('limit') limit?:string,@Query('cursor') cursor?:string){return this.svc.audit(t,r.actor,Number(limit||50),cursor)}
}

@ApiTags('identity') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('v1/me')
export class MeController {
 constructor(private readonly svc:CoreService){}
 @Get('tenants') tenants(@Req() r:AuthRequest){return this.svc.myTenants(r.actor)}
}
