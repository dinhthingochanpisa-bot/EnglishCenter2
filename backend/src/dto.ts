import { IsBoolean,IsEmail,IsEnum,IsInt,IsNotEmpty,IsOptional,IsString,IsUUID,Max,MaxLength,Min } from 'class-validator';
export class CreateTenantDto { @IsString() @IsNotEmpty() @MaxLength(64) code!:string; @IsString() @IsNotEmpty() legalName!:string; @IsString() @IsNotEmpty() displayName!:string; }
export class UpdateTenantDto { @IsOptional() @IsString() @IsNotEmpty() displayName?:string; @IsOptional() @IsString() @IsNotEmpty() legalName?:string; @IsOptional() @IsEnum(['ONBOARDING','ACTIVE','SUSPENDED','CLOSED']) status?:string; }
export class CreateBranchDto { @IsString() @IsNotEmpty() @MaxLength(64) code!:string; @IsString() @IsNotEmpty() name!:string; }
export class UpdateBranchDto { @IsOptional() @IsString() @IsNotEmpty() name?:string; @IsOptional() @IsBoolean() isActive?:boolean; @IsInt() @Min(1) rowVersion!:number; }
export class CreateUserDto { @IsString() @IsNotEmpty() authSubject!:string; @IsString() @IsNotEmpty() displayName!:string; @IsOptional() @IsEmail() email?:string; }
export class AddMembershipDto { @IsUUID() userId!:string; @IsOptional() @IsString() @MaxLength(64) employeeCode?:string; }
export class UpdateMembershipDto { @IsEnum(['INVITED','ACTIVE','SUSPENDED','LEFT']) status!:'INVITED'|'ACTIVE'|'SUSPENDED'|'LEFT'; @IsInt() @Min(1) rowVersion!:number; }
export class CreateRoleDto { @IsString() @IsNotEmpty() @MaxLength(80) code!:string; @IsString() @IsNotEmpty() name!:string; @IsEnum(['SELF','OWNED_OR_ASSIGNED','ASSIGNED_STUDENTS','ASSIGNED_CLASSES','ASSIGNED_BRANCHES','TENANT']) scopeType!:string; }
export class UpdateRoleDto { @IsOptional() @IsString() @IsNotEmpty() name?:string; @IsOptional() @IsEnum(['SELF','OWNED_OR_ASSIGNED','ASSIGNED_STUDENTS','ASSIGNED_CLASSES','ASSIGNED_BRANCHES','TENANT']) scopeType?:string; @IsInt() @Min(1) rowVersion!:number; }
export class AssignPermissionDto { @IsString() @IsNotEmpty() permissionCode!:string; }
export class AssignRoleDto { @IsUUID() roleId!:string; @IsOptional() @IsString() validFrom?:string; @IsOptional() @IsString() validTo?:string; }
export class AssignBranchDto { @IsUUID() branchId!:string; @IsOptional() @IsString() validFrom?:string; @IsOptional() @IsString() validTo?:string; }

export class BootstrapTenantDto { @IsUUID() userId!:string; }
