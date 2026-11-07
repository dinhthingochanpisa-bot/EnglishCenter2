#!/usr/bin/env python3
"""Generate Keycloak realm with ephemeral passwords; test use only."""
from pathlib import Path
import argparse, json, os, re, uuid
ROOT=Path(__file__).resolve().parents[1]
def required(name, env):
    val=env.get(name)
    if not val: raise SystemExit(f'Missing {name}; source infra/.env.test')
    return val
client_mapper = lambda name: {
  'name':name,'protocol':'openid-connect','protocolMapper':'oidc-audience-mapper',
  'consentRequired':False,
  'config':{'included.client.audience':'lms-api','id.token.claim':'false','access.token.claim':'true'}
}
users=[('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','demo-a','DEMO_USER_A_PASSWORD'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','demo-b','DEMO_USER_B_PASSWORD')]
def build_realm(env=None, realm_name='lms-demo'):
 if env is None: env=os.environ
 if not re.fullmatch(r'lms-demo(?:-[a-z0-9-]+)?', realm_name):
  raise ValueError('Only isolated lms-demo test realms are supported')
 return {
 'realm':realm_name,'enabled':True,'sslRequired':'none',
 'registrationAllowed':False,'loginWithEmailAllowed':False,
 'clients':[
    {'clientId':'lms-api','name':'Test backend audience','enabled':True,'protocol':'openid-connect','publicClient':False,'standardFlowEnabled':False,'directAccessGrantsEnabled':False,'serviceAccountsEnabled':False},
    {'clientId':'lms-web','name':'Next BFF browser OIDC PKCE','enabled':True,'protocol':'openid-connect','publicClient':True,'standardFlowEnabled':True,'directAccessGrantsEnabled':False,'serviceAccountsEnabled':False,
     'redirectUris':['http://localhost:3000/api/auth/callback'],'webOrigins':['http://localhost:3000'],'attributes':{'pkce.code.challenge.method':'S256'},'protocolMappers':[client_mapper('audience-for-api-web')]},
    {'clientId':'lms-smoke-cli','name':'Test-only direct grant (never production)','enabled':True,'protocol':'openid-connect','publicClient':True,'standardFlowEnabled':False,'directAccessGrantsEnabled':True,'serviceAccountsEnabled':False,
     'protocolMappers':[client_mapper('audience-for-api-smoke')]}
 ],
 'users':[
  {'id':id if realm_name=='lms-demo' else str(uuid.uuid5(uuid.UUID(id),realm_name)),'username':username,'enabled':True,'email':f'{username}@example.test','emailVerified':True,'firstName':username,'lastName':'Synthetic','requiredActions':[],
   'credentials':[{'type':'password','value':required(env_key,env),'temporary':False}]}
  for id,username,env_key in users+([
   ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','gate-sales','GATE_SALES_PASSWORD'),
   ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','gate-manager','GATE_MANAGER_PASSWORD')
  ] if env.get('INCLUDE_GATE_USERS')=='true' else [])
 ]
}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--realm',default='lms-demo')
 parser.add_argument('--output',type=Path,default=ROOT/'infra'/'keycloak'/'import'/'lms-demo-realm.json')
 args=parser.parse_args()
 realm=build_realm(realm_name=args.realm)
 args.output.parent.mkdir(parents=True,exist_ok=True)
 fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w',encoding='utf-8') as handle:
  handle.write(json.dumps(realm,indent=2,ensure_ascii=False)+'\n')
 args.output.chmod(0o600)
 print('Generated test-only realm import (credentials not logged).')
