import fs from 'node:fs';import path from 'node:path';import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let ts;for(const source of ['typescript','../backend/node_modules/typescript','../frontend/node_modules/typescript','/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript']){try{ts=require(source);break}catch{}}if(!ts)throw new Error('TypeScript compiler unavailable (run npm install in backend/frontend)');
const root=path.resolve(import.meta.dirname,'..');let count=0;let fail=0;
function check(name,passed,detail=''){console.log(`${passed?'PASS':'FAIL'} ${name}${detail?' – '+detail:''}`);count++;if(!passed)fail++;}
function read(f){return fs.readFileSync(path.join(root,f),'utf8')}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?(['node_modules','.next','dist','coverage'].includes(item.name)?[]:walk(path.join(dir,item.name))):([item.name.endsWith('.tsx'),item.name.endsWith('.ts')].some(Boolean)?[path.join(dir,item.name)]:[]));}
let parsed=0,errors=[];
for(const dir of ['backend/src','frontend'])for(const file of walk(path.join(root,dir))){const code=fs.readFileSync(file,'utf8');const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);parsed++;for(const e of source.parseDiagnostics)errors.push(path.relative(root,file)+': '+ts.flattenDiagnosticMessageText(e.messageText,' '));}
check('TypeScript/TSX parser',errors.length===0,`${parsed} files; ${errors.length} syntax errors`);errors.forEach(e=>console.log(e));
const migration1=read('backend/prisma/migrations/202611060001_saas_core/migration.sql');
const migration2=read('backend/prisma/migrations/202611060002_stage01a_security/migration.sql');
const migration3=read('backend/prisma/migrations/202611060003_runtime_grants/migration.sql');
const tables=[...migration1.matchAll(/CREATE TABLE\s+([a-z_]+)/gi)].map(m=>m[1]);
check('Stage01 baseline schema',tables.length===14,`Found ${tables.length} CREATE TABLE statements`);
const tenantTables=['branches','tenant_memberships','roles','role_permissions','membership_roles','membership_branch_scopes','tenant_settings','tenant_subscriptions','support_grants','audit_logs'];
check('Tenant RLS policy coverage',tenantTables.every(t=>migration1.includes(`'${t}'`))&&migration1.includes('FORCE ROW LEVEL SECURITY')&&migration1.includes('WITH CHECK'));
check('Composite tenant foreign keys',migration1.includes('FOREIGN KEY(tenant_id,role_id)')&&migration1.includes('FOREIGN KEY(tenant_id,branch_id)')&&migration1.includes('FOREIGN KEY(tenant_id,membership_id)'));
check('Append-only audit trigger',migration1.includes('forbid_audit_mutation()')&&migration1.includes('audit_immutable'));
check('Runtime role grants migrated',migration3.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON')&&migration3.includes('GRANT SELECT, INSERT ON audit_logs')&&migration3.includes('TO app_runtime'));
const executable=migration3.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const grants=[...executable.matchAll(/\bGRANT\b[\s\S]*?;/gi)].map(x=>x[0]);
check('Global identity not granted to runtime',!grants.some(sql=>/\b(platform_users|tenants)\b/i.test(sql)&&/\bTO\s+app_runtime\b/i.test(sql)));
check('Restricted identity role',migration2.includes('TO identity_reader')&&migration2.includes('platform_users'));
const auth=read('frontend/app/api/auth/callback/route.ts'),session=read('frontend/lib/session.ts'),proxy=read('frontend/app/api/backend/[...segments]/route.ts'),service=read('backend/src/tenant.service.ts'),controller=read('backend/src/controllers.ts');
check('OIDC code + PKCE + nonce',auth.includes('code_verifier')&&auth.includes('payload.nonce!==pending.nonce')&&read('frontend/app/api/auth/login/route.ts').includes("code_challenge_method:'S256'"));
check('Encrypted HttpOnly session',session.includes('aes-256-gcm')&&session.includes('httpOnly: true')&&session.includes("sameSite: 'lax'"));
check('Backend only proxy with Bearer',proxy.includes('getSession(req)')&&proxy.includes('sameOrigin(req)')&&proxy.includes('Authorization:`Bearer ${session.accessToken}`'));
check('No direct database in frontend',!walk(path.join(root,'frontend')).some(f=>/@prisma\/client|new PrismaClient|postgresql:/.test(fs.readFileSync(f,'utf8'))));
check('Permission snapshot endpoint',controller.includes("@Get('me/permissions')")&&service.includes('myPermissions'));
check('Role revocation endpoints',controller.includes("@Delete('memberships/:id/roles/:assignmentId')")&&controller.includes("@Delete('memberships/:id/branches/:assignmentId')"));
check('Audit atomic with transaction',service.includes('await this.log(tx,t,a')&&service.includes('this.db.tenantTx'));
console.log(`\n${count-fail}/${count} static checks passed`);process.exit(fail?1:0);
