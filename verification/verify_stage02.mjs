import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);const ts=require('../backend/node_modules/typescript');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const srcs=[];for(const folder of ['backend/src','backend/test','backend/prisma/seeds','frontend/components','frontend/app','frontend/lib']){
 function visit(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){const name=path.join(p,entry.name);if(entry.isDirectory())visit(name);else if(/\.tsx?$/.test(entry.name))srcs.push(name)}}visit(path.join(root,folder));}
const errors=[];for(const p of srcs){const content=fs.readFileSync(p,'utf8');const file=ts.createSourceFile(p,content,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const error of file.parseDiagnostics)errors.push(`${p}:${file.getLineAndCharacterOfPosition(error.start||0).line+1}: ${ts.flattenDiagnosticMessageText(error.messageText,' ')}`);}
assert.deepEqual(errors,[],`Syntax errors: ${errors.join('\n')}`);
const prisma=fs.readFileSync(path.join(root,'backend/prisma/schema.prisma'),'utf8');const migration=fs.readFileSync(path.join(root,'backend/prisma/migrations/202611060004_stage02_crm/migration.sql'),'utf8');
const models=[...prisma.matchAll(/^model Crm(\w+) \{/gm)].map(m=>m[1]);assert.equal(models.length,14);
const tables=[...migration.matchAll(/CREATE TABLE (crm_[a-z_]+) \(/gm)].map(m=>m[1]);assert.equal(tables.length,14);
for(const t of tables){assert.ok(migration.includes(`ALTER TABLE %I ENABLE ROW LEVEL SECURITY`));assert.ok(migration.includes(`FOREACH t`));assert.ok(prisma.includes(`@@map("${t}")`),`Missing Prisma model for ${t}`);}
assert.match(migration,/FORCE ROW LEVEL SECURITY/);assert.match(migration,/FOREIGN KEY\(tenant_id,person_id\)/);
const backendCode=fs.readFileSync(path.join(root,'backend/src/crm.service.ts'),'utf8');
assert.match(backendCode,/this\.auth\.require/);assert.match(backendCode,/this\.db\.tenantTx/);assert.match(backendCode,/createHash\('sha256'\)/);
const frontend=fs.readFileSync(path.join(root,'frontend/components/crm-console.tsx'),'utf8');assert.ok(!/PrismaClient|DATABASE_URL|\$queryRaw/.test(frontend),'Frontend must not query DB');
const rules=fs.readFileSync(path.join(root,'backend/src/crm.rules.ts'),'utf8');const transpiled=ts.transpileModule(rules,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('exports','module','require',transpiled)(mod.exports,mod,require);
const r=mod.exports;
assert.equal(r.normalizePhone('0912 345 678'),'+84912345678');assert.equal(r.normalizePhone('+84 912 345 678'),'+84912345678');
assert.equal(r.canMoveLead('NEW','QUALIFIED',false),false);assert.equal(r.canMoveLead('NEW','QUALIFIED',true),true);assert.equal(r.canMoveLead('CONVERTED','NEW',true),false);
assert.equal(r.normalizedName('  Nguyễn   Văn A '),'nguyễn văn a');
console.log(`PASS: ${srcs.length} TS/TSX files parsed without syntax errors; ${models.length} models matched SQL tables; RLS/FK guards checked; CRM rules passed.`);
