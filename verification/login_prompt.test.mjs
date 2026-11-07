import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const backendRequire=createRequire(path.join(root,'backend/package.json'));
const ts=backendRequire('typescript');
function load(relative){
 const file=path.join(root,relative),require=createRequire(file);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 const resolve=name=>name==='server-only'?{}:name.startsWith('@/')?load('frontend/'+name.slice(2)+'.ts'):require(name);
 new Function('module','exports','require',js)(module,module.exports,resolve);
 return module.exports;
}

test('explicit OIDC login asks for credentials without selecting a demo account',async()=>{
 const env={OIDC_ISSUER:'https://identity.example.test/realms/test',OIDC_CLIENT_ID:'test-web',APP_ORIGIN:'http://localhost:3000',NODE_ENV:'test',SESSION_SECRET_BASE64:randomBytes(32).toString('base64')};
 const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 try{
  Object.assign(process.env,env);
  // The only external boundary is discovery; exercise the real route and cookie encryption.
  globalThis.fetch=async url=>{
   assert.equal(url,env.OIDC_ISSUER+'/.well-known/openid-configuration');
   return Response.json({issuer:env.OIDC_ISSUER,authorization_endpoint:env.OIDC_ISSUER+'/auth',token_endpoint:env.OIDC_ISSUER+'/token',jwks_uri:env.OIDC_ISSUER+'/certs'});
  };
  const route=load('frontend/app/api/auth/login/route.ts');
  const first=await route.GET(),second=await route.GET();
  assert.equal(first.status,307);
  const url=new URL(first.headers.get('location'));
  assert.equal(url.searchParams.get('prompt'),'login');
  assert.equal(url.searchParams.has('login_hint'),false);
  assert.equal(url.searchParams.has('username'),false);
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/api/auth/callback');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.ok(url.searchParams.get('nonce'));
  assert.notEqual(url.searchParams.get('state'),new URL(second.headers.get('location')).searchParams.get('state'));
  assert.match(first.headers.get('set-cookie'),/HttpOnly/i);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
