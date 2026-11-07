#!/usr/bin/env python3
"""Generate Keycloak realm with ephemeral passwords; test use only."""
from pathlib import Path
import json, os
ROOT=Path(__file__).resolve().parents[1]
def required(name):
    val=os.environ.get(name)
    if not val: raise SystemExit(f'Missing {name}; source infra/.env.test')
    return val
client_mapper = lambda name: {
  'name':name,'protocol':'openid-connect','protocolMapper':'oidc-audience-mapper',
  'consentRequired':False,
  'config':{'included.client.audience':'lms-api','id.token.claim':'false','access.token.claim':'true'}
}
users=[('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','demo-a','DEMO_USER_A_PASSWORD'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','demo-b','DEMO_USER_B_PASSWORD')]
realm={
 'realm':'lms-demo','enabled':True,'sslRequired':'none',
 'registrationAllowed':False,'loginWithEmailAllowed':False,
 'clients':[
    {'clientId':'lms-api','name':'Test backend audience','enabled':True,'protocol':'openid-connect','publicClient':False,'standardFlowEnabled':False,'directAccessGrantsEnabled':False,'serviceAccountsEnabled':False},
    {'clientId':'lms-web','name':'Next BFF browser OIDC PKCE','enabled':True,'protocol':'openid-connect','publicClient':True,'standardFlowEnabled':True,'directAccessGrantsEnabled':False,'serviceAccountsEnabled':False,
     'redirectUris':['http://localhost:3000/api/auth/callback'],'webOrigins':['http://localhost:3000'],'attributes':{'pkce.code.challenge.method':'S256'},'protocolMappers':[client_mapper('audience-for-api-web')]},
    {'clientId':'lms-smoke-cli','name':'Test-only direct grant (never production)','enabled':True,'protocol':'openid-connect','publicClient':True,'standardFlowEnabled':False,'directAccessGrantsEnabled':True,'serviceAccountsEnabled':False,
     'protocolMappers':[client_mapper('audience-for-api-smoke')]}
 ],
 'users':[
  {'id':id,'username':username,'enabled':True,'emailVerified':True,'firstName':username,'lastName':'Synthetic',
   'credentials':[{'type':'password','value':required(env_key),'temporary':False}]}
  for id,username,env_key in users
 ]
}
output=ROOT/'infra'/'keycloak'/'import'/'lms-demo-realm.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(realm,indent=2,ensure_ascii=False)+'\n')
output.chmod(0o600)
print(f'Generated realm import for test-only OIDC: {output}')
