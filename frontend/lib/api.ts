export class ApiError extends Error {constructor(readonly status:number, message:string){super(message);this.name='ApiError';}}
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  // Client only calls the same-origin API proxy. Never expose access tokens to browser JS.
  if(!path.startsWith('v1/')||path.includes('..'))throw new Error('Invalid API path');
  const res=await fetch(`/api/backend/${path}`,{...options,cache:'no-store',headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const payload=await res.json().catch(()=>null);
  if(!res.ok)throw new ApiError(res.status,payload?.message || `HTTP ${res.status}`);
  return payload as T;
}
export const post = <T>(path:string,data:unknown)=>api<T>(path,{method:'POST',body:JSON.stringify(data)});
export const patch = <T>(path:string,data:unknown)=>api<T>(path,{method:'PATCH',body:JSON.stringify(data)});
export const remove = <T>(path:string)=>api<T>(path,{method:'DELETE'});
export type Tenant={id:string;code:string;displayName:string;legalName?:string;status:string;timezone?:string};
export type Branch={id:string;tenantId:string;code:string;name:string;isActive:boolean;rowVersion:number};
export type PlatformUser={id:string;displayName:string;email?:string;status:string};
export type TenantUser={membershipId:string;memberStatus:string;user:PlatformUser|null};
export type AssignmentRole={id:string;roleId:string;validFrom:string;validTo:string|null;role:{id:string;code:string;name:string;scopeType:string}};
export type AssignmentBranch={id:string;branchId:string;validFrom:string;validTo:string|null;branch:{id:string;code:string;name:string;isActive:boolean}};
export type Membership={id:string;tenantId:string;userId:string;employeeCode?:string;status:string;rowVersion:number;roles?:AssignmentRole[];branchScopes?:AssignmentBranch[]};
export type Role={id:string;code:string;name:string;scopeType:string;systemRole:boolean;rowVersion:number;permissions:{permission:{id:string;code:string;resource:string;action:string}}[]};
export type Permission={id:string;code:string;resource:string;action:string};
export type PermissionSnapshot={tenantId:string;membershipId:string;permissions:Record<string,{tenantWide:boolean;branchIds:string[]}>};
export type AuditLog={id:string;occurredAt:string;actorUserId?:string;action:string;resourceType:string;resourceId:string;beforeData?:unknown;afterData?:unknown};
export function friendlyError(error:unknown){
 if(error instanceof ApiError){if(error.status===403)return 'Bạn không có quyền thực hiện thao tác này.';if(error.status===401)return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';return error.message;}
 return error instanceof Error?error.message:'Đã xảy ra lỗi không xác định';
}
export function uuid(input:string){return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.trim());}
