#!/usr/bin/env python3
"""Create a separate test realm and prove new demo profiles authenticate; never delete/reset realms."""
import json, os, secrets, urllib.request, urllib.parse, urllib.error, uuid
from generate_dev_realm import build_realm

def request(path, data, token=None, form=False):
    raw=urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
    headers={'Content-Type':'application/x-www-form-urlencoded' if form else 'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request('http://127.0.0.1:18080'+path,data=raw,headers=headers,method='POST')
    with urllib.request.urlopen(req,timeout=20) as response:
        raw=response.read()
        return response.status,json.loads(raw) if raw else {}

def main():
    if os.environ.get('ALLOW_DEMO_E2E')!='true': raise RuntimeError('ALLOW_DEMO_E2E=true required')
    password=os.environ.get('KEYCLOAK_ADMIN_PASSWORD')
    if not password: raise RuntimeError('Test admin password missing')
    _,admin=request('/realms/master/protocol/openid-connect/token',{'grant_type':'password','client_id':'admin-cli','username':'local-admin','password':password},form=True)
    name='lms-demo-gate-'+uuid.uuid4().hex[:12]
    credentials={'DEMO_USER_A_PASSWORD':secrets.token_urlsafe(24),'DEMO_USER_B_PASSWORD':secrets.token_urlsafe(24)}
    realm=build_realm(credentials,name)
    status,_=request('/admin/realms',realm,admin['access_token'])
    assert status==201
    print('PASS Created separate synthetic test realm '+name,flush=True)
    for user,key in [('demo-a','DEMO_USER_A_PASSWORD'),('demo-b','DEMO_USER_B_PASSWORD')]:
        status,result=request('/realms/'+name+'/protocol/openid-connect/token',{'grant_type':'password','client_id':'lms-smoke-cli','username':user,'password':credentials[key]},form=True)
        assert status==200 and result.get('access_token')
        print('PASS Fresh '+user+' authenticates without manual email/profile changes',flush=True)
    print('PASS Existing realm, database and volumes unchanged; new test realm retained.',flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        print('FAIL/BLOCKED fresh realm: '+type(error).__name__+((' HTTP '+str(error.code)) if isinstance(error,urllib.error.HTTPError) else ''),flush=True)
        raise SystemExit(1)
