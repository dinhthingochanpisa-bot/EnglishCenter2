export type Actor = { subject:string; userId:string; platformAdmin:boolean };
export type Scope='TENANT'|'ASSIGNED_BRANCHES'|'SELF';
export const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(id:string):string { if(!UUID_RE.test(id)) throw new Error('Invalid UUID'); return id; }
export const ROLE_SCOPES=['SELF','OWNED_OR_ASSIGNED','ASSIGNED_STUDENTS','ASSIGNED_CLASSES','ASSIGNED_BRANCHES','TENANT'] as const;
export const PERMISSIONS={
 'tenant.read':'tenant.read','tenant.manage':'tenant.manage','org.branch.read':'org.branch.read',
 'org.branch.manage':'org.branch.manage','org.membership.read':'org.membership.read',
 'org.membership.manage':'org.membership.manage','iam.role.read':'iam.role.read',
 'iam.role.manage':'iam.role.manage','iam.permission.read':'iam.permission.read',
 'iam.permission.assign':'iam.permission.assign','audit.read':'audit.read'
} as const;
