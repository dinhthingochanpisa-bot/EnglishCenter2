// Execute isolated tests on pure functions imported from actual TypeScript source.
// Not a substitute for Nest/Next/PostgreSQL integration tests.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {randomBytes} from 'node:crypto';
const require=createRequire(import.meta.url);
let ts;for(const source of ['typescript','../backend/node_modules/typescript','../frontend/node_modules/typescript','/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript']){try{ts=require(source);break}catch{}}if(!ts)throw new Error('TypeScript compiler unavailable (run npm install in backend/frontend)');
const root=path.resolve(import.meta.dirname,'..');
function loadTs(relative){
  const raw=fs.readFileSync(path.join(root,relative),'utf8');
  const js=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  new Function('module','exports','require','process','Buffer','fetch',js.replace(/require\(["']server-only["']\);?/g,''))(mod,mod.exports,createRequire(path.join(root,relative)),process,Buffer,globalThis.fetch);
  return mod.exports;
}
let tests=0;function assert(ok,msg){tests++;if(!ok)throw new Error('FAIL '+msg);console.log('PASS '+msg)}
process.env.SESSION_SECRET_BASE64=randomBytes(32).toString('base64');
const session=loadTs('frontend/lib/session.ts');
const plaintext={user:{sub:'abc',name:'Test User'},accessToken:'invisible-to-client',expiresAt:Date.now()+60_000};
const enc=session.seal(plaintext);
assert(!enc.includes(plaintext.accessToken),'Cookie payload does not contain plaintext token');
assert(JSON.stringify(session.open(enc))===JSON.stringify(plaintext),'AES-GCM decrypt roundtrip');
const tampered=enc.slice(0,-2)+'AA';
assert(session.open(tampered)===null,'Modified cookie rejected');
const request={cookies:{get:()=>({value:enc})}};
assert(session.getSession(request)?.user?.sub==='abc','Valid cookie session accepted');
const expired=session.seal({...plaintext,expiresAt:Date.now()-60_000});
assert(session.getSession({cookies:{get:()=>({value:expired})}})===null,'Expired session rejected');
const contracts=loadTs('backend/src/contracts.ts');
assert(contracts.uuid('11111111-1111-4111-8111-111111111111')==='11111111-1111-4111-8111-111111111111','Valid UUID accepted');
let bad=false;try{contracts.uuid('1234');}catch{bad=true}assert(bad,'Invalid UUID rejected');
const api=loadTs('frontend/lib/api.ts');
assert(api.uuid('22222222-2222-4222-8222-222222222222'),'Client-side UUID helper recognizes valid UUID');
assert(!api.uuid('../../other-tenant'),'Client-side UUID helper rejects traversal');
console.log(`\n${tests}/${tests} isolated logic tests passed`);
