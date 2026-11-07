"""Live branch/assignment security against the separate synthetic gate tenant, never admin tokens."""
import os
from api_e2e_smoke import req, check
T='33333333-3333-4333-8333-333333333333'
API='http://127.0.0.1:3001'
def ident(n): return '33333333-0000-4000-8000-'+str(n).zfill(12)
def login(user,key):
    code,body=req('POST','http://127.0.0.1:18080/realms/lms-demo/protocol/openid-connect/token',{'grant_type':'password','client_id':'lms-smoke-cli','username':user,'password':os.environ[key]},encoding='application/x-www-form-urlencoded')
    check('Restricted identity '+user,code,200)
    return body['access_token']
def main():
    if os.environ.get('ALLOW_DEMO_E2E')!='true': raise RuntimeError('Synthetic test opt-in required')
    sales=login('gate-sales','GATE_SALES_PASSWORD');manager=login('gate-manager','GATE_MANAGER_PASSWORD')
    prefix=API+'/v1/tenants/'+T+'/crm'
    status,lead=req('GET',prefix+'/leads/'+ident(31),token=sales);check('Sales reads own branch lead',status,200)
    for suffix in ['/leads/'+ident(32),'/leads?branchId='+ident(2),'/persons/'+ident(22)+'?branchId='+ident(2)]:
        status,_=req('GET',prefix+suffix,token=sales);check('Other branch denied '+suffix.split('?')[0],status,{403,404})
    payload={'rowVersion':lead['lead']['rowVersion'],'assignedMembershipId':ident(12)}
    status,_=req('PATCH',prefix+'/leads/'+ident(31),payload,sales);check('Sales cannot assign without permission',status,403)
    status,_=req('PATCH',prefix+'/leads/'+ident(31),payload,manager);check('Manager cannot assign out-of-branch staff',status,400)
    status,after=req('GET',prefix+'/leads/'+ident(31),token=sales);check('Denied assignments leave rowVersion unchanged',after['lead']['rowVersion'],payload['rowVersion'])
if __name__=='__main__':
    try:main()
    except Exception as error: print('FAIL restricted roles: '+type(error).__name__);raise SystemExit(1)
