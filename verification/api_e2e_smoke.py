#!/usr/bin/env python3
"""Real API smoke: Keycloak JWT -> Nest RBAC -> PostgreSQL RLS -> Stage 02 CRM lifecycle.
Test-only, destructive to demo db. Requires seeded 2 tenants and 2 demo OIDC users.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor
API=os.environ.get('API_URL','http://localhost:3001').rstrip('/')
ISSUER=os.environ.get('OIDC_ISSUER','http://localhost:18080/realms/lms-demo').rstrip('/')
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
results=[]
def req(method,url,body=None,token=None,encoding='application/json'):
    if body is not None and encoding=='application/json': data=json.dumps(body).encode('utf-8')
    elif body is not None: data=urllib.parse.urlencode(body).encode('utf-8')
    else: data=None
    headers={'Accept':'application/json'}
    if data is not None: headers['Content-Type']=encoding
    if token: headers['Authorization']='Bearer '+token
    request=urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request,timeout=20) as response:
            raw=response.read().decode();return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: parsed=json.loads(raw)
        except Exception: parsed={'raw':raw[:200]}
        return e.code,parsed

def check(name,actual,expected):
    ok=actual in expected if isinstance(expected,set) else actual==expected
    results.append((name,'PASS' if ok else 'FAIL',actual))
    print(f"{'PASS' if ok else 'FAIL'} {name} ({actual})",flush=True)
    if not ok: raise AssertionError(f'{name}: expected {expected}, observed {actual}')

def api(method,path,body=None,token=None,expected=200,step='API'):
    status,out=req(method,API+path,body,token)
    check(step,status,expected if isinstance(expected,set) else {expected,201} if expected==200 else expected)
    return out

def login(username,password):
    code,obj=req('POST',ISSUER+'/protocol/openid-connect/token',{'grant_type':'password','client_id':'lms-smoke-cli','username':username,'password':password},encoding='application/x-www-form-urlencoded')
    check('OIDC authenticates '+username,code,200)
    token=obj.get('access_token','')
    if not token:raise AssertionError('No OIDC access token')
    # inspect signed token claims for correct issuer/audience; backend still verifies signature with JWKS
    import base64
    payload=token.split('.')[1]; payload=payload+'='*(-len(payload)%4)
    claims=json.loads(base64.urlsafe_b64decode(payload))
    check('OIDC issuer '+username,claims.get('iss'),ISSUER)
    aud=claims.get('aud',[]); aud=[aud] if isinstance(aud,str) else aud
    check('OIDC audience '+username,'lms-api' in aud,True)
    return token

def main():
    if os.environ.get('ALLOW_DEMO_E2E')!='true': raise SystemExit('ALLOW_DEMO_E2E=true required (destructive, synthetic only)')
    pwd_a=os.environ.get('DEMO_USER_A_PASSWORD');pwd_b=os.environ.get('DEMO_USER_B_PASSWORD')
    if not pwd_a or not pwd_b: raise SystemExit('Source infra/.env.test to supply demo credentials')
    code,_=req('GET',API+'/health/live');check('NestJS health',code,200)
    token_a=login('demo-a',pwd_a);token_b=login('demo-b',pwd_b)
    api('GET','/v1/me/tenants',expected=401,step='Unauthenticated tenant discovery denied')
    for token,tenant,label in [(token_a,A,'A'),(token_b,B,'B')]:
        accessible=api('GET','/v1/me/tenants',token=token,step='Discover own tenants '+label)
        check('Only own tenant returned '+label,[item['id'] for item in accessible],[tenant])
        check('Tenant has friendly identity '+label,all(item['code'] and item['displayName'] for item in accessible),True)
    # unauthorized request (security enforcement in backend, not just UI)
    api('GET',f'/v1/tenants/{A}/crm/leads',expected=401,step='Unauthenticated CRM denied')
    api('GET',f'/v1/tenants/{A}/crm/leads',token='invalid.token.signature',expected=401,step='Invalid JWT denied')
    api('GET',f'/v1/tenants/{B}/crm/leads',token=token_a,expected=403,step='Tenant A cannot read Tenant B')
    api('GET',f'/v1/tenants/{A}/crm/leads',token=token_b,expected=403,step='Tenant B cannot read Tenant A')
    branches=api('GET',f'/v1/tenants/{A}/branches',token=token_a,step='Authorized branch listing')
    check('Branch A demo exists',bool(branches),True)
    bid=branches[0]['id']
    branches_b=api('GET',f'/v1/tenants/{B}/branches',token=token_b,step='Authorized Branch B listing')
    b_bid=branches_b[0]['id']
    sources=api('GET',f'/v1/tenants/{A}/crm/sources',token=token_a,step='List initial sources')
    check('Sources seeded',any(s['category']=='PAGE' for s in sources),True)
    suffix=str(uuid.uuid4())[:8]
    # Create new source for this run, then NEW Lead without phone
    source=api('POST',f'/v1/tenants/{A}/crm/sources',{'code':f'SMOKE_{suffix}','name':'Test source '+suffix,'category':'EVENT'},token_a,step='Create source')
    lead=api('POST',f'/v1/tenants/{A}/crm/leads',{'branchId':bid,'studentName':'Student Runtime '+suffix,'contactName':'Parent Runtime','sourceId':source['id']},token_a,step='Create NEW lead')
    check('Lead initially NEW',lead['status'],'NEW')
    lead_id=lead['id'];person_id=lead['personId']
    detail=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='Read lead details')
    rv=detail['lead']['rowVersion']
    # New lead can't jump to converted ahead of completed Check-in.
    api('PATCH',f'/v1/tenants/{A}/crm/leads/{lead_id}',{'rowVersion':rv,'status':'CONVERTED'},token_a,expected=400,step='Reject unauthorized stage transition')
    updated=api('PATCH',f'/v1/tenants/{A}/crm/leads/{lead_id}',{'rowVersion':rv,'status':'QUALIFIED','contactPhone':'0912 345 678'},token_a,step='Lead to QL with valid phone')
    check('QL status',updated['status'],'QUALIFIED')
    detail=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='QL persisted')
    check('QL has qualified_at',bool(detail['lead'].get('qualifiedAt')),True)
    visible_phone=detail['lead'].get('contactPhone') or ''
    check('Sensitive phone redacted',visible_phone.startswith('*') and sum(c.isdigit() for c in visible_phone)<=4 and 'contactPhoneNormalized' not in detail['lead'],True)
    api('PATCH',f'/v1/tenants/{A}/crm/leads/{lead_id}',{'rowVersion':rv,'status':'QUALIFIED'},token_a,expected=409,step='Reject stale lead rowVersion')
    qualified_at=detail['lead']['qualifiedAt']
    api('PATCH',f'/v1/tenants/{A}/crm/leads/{lead_id}',{'rowVersion':detail['lead']['rowVersion'],'status':'QUALIFIED'},token_a,step='Update qualified lead with current version')
    detail=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='Read first qualification timestamp')
    check('First qualification timestamp is immutable',detail['lead']['qualifiedAt'],qualified_at)
    sibling=api('POST',f'/v1/tenants/{A}/crm/leads',{'branchId':bid,'studentName':'Sibling Runtime '+suffix,'contactName':'Parent Runtime','contactPhone':'0912345678','sourceId':source['id']},token_a,step='Create sibling with same guardian phone')
    check('Shared guardian phone never merges persons',sibling['personId']!=person_id,True)
    followup_source=api('POST',f'/v1/tenants/{A}/crm/sources',{'code':f'TOUCH_{suffix}','name':'Synthetic follow-up '+suffix,'category':'SCHOOL'},token_a,step='Create follow-up attribution source')
    api('POST',f'/v1/tenants/{A}/crm/leads/{lead_id}/touches',{'sourceId':followup_source['id'],'touchType':'FOLLOWUP'},token_a,step='Append attribution touch')
    attribution=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='Read attribution history')
    check('Original lead source remains unchanged',attribution['lead']['sourceId'],source['id'])
    check('First and follow-up source touches retained',any(x['sourceId']==source['id'] and x['touchType']=='FIRST_TOUCH' for x in attribution['touches']) and any(x['sourceId']==followup_source['id'] for x in attribution['touches']),True)
    api('POST',f'/v1/tenants/{A}/crm/checkins',{'branchId':bid,'personId':sibling['personId'],'leadId':lead_id,'sourceId':source['id']},token_a,expected=400,step='Mismatched lead/person check-in rejected')
    activity=api('POST',f'/v1/tenants/{A}/crm/leads/{lead_id}/activities',{'kind':'CALL','note':'Synthetic pre-sales care / follow-up','outcome':'CONNECTED'},token_a,step='Record customer care')
    detail=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='Care history visible')
    check('Care activity persisted',any(a['note'].startswith('Synthetic pre-sales care') for a in detail['activities']),True)
    checkin=api('POST',f'/v1/tenants/{A}/crm/checkins',{'branchId':bid,'personId':person_id,'leadId':lead_id,'sourceId':source['id'],'purpose':'Trial placement test'},token_a,step='Create check-in draft')
    check('Draft status',checkin['status'],'DRAFT')
    api('POST',f"/v1/tenants/{A}/crm/checkins/{checkin['id']}/complete",{},token_a,expected=400,step='Incomplete check-in cannot complete')
    completion={'dateOfBirth':'2013-01-15','schoolName':'Synthetic School','schoolGrade':'8','guardianName':'Synthetic Parent','guardianPhone':'0912345678','guardianRelation':'MOTHER'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls=list(pool.map(lambda _:req('POST',API+f"/v1/tenants/{A}/crm/checkins/{checkin['id']}/complete",completion,token_a),range(2)))
    check('Concurrent completion has one success',sum(status in (200,201) for status,_ in calls),1)
    check('Concurrent completion rejects other writer',sum(status==409 for status,_ in calls),1)
    completed=next(body for status,body in calls if status in (200,201))
    check('Student identity generated',bool(completed.get('studentId')),True)
    check('Check-in completed',completed['status'],'COMPLETED')
    detail=api('GET',f'/v1/tenants/{A}/crm/leads/{lead_id}',token=token_a,step='Lead after Check-in')
    check('Lead converted by Check-in',detail['lead']['status'],'CONVERTED')
    profile=api('GET',f'/v1/tenants/{A}/crm/persons/{person_id}?branchId={bid}',token=token_a,step='Customer 360 profile')
    check('Stable person ID',profile['id'],person_id)
    check('Student link matches',profile['studentId'],completed['studentId'])
    check('Customer status vs formal student',profile['status'],'CUSTOMER')
    check('Parent link persisted',len(profile['guardians'])>0,True)
    check('Check-in in 360 profile',any(x['id']==checkin['id'] for x in profile['checkins']),True)
    check('Lead in 360 profile',any(x['id']==lead_id for x in profile['leads']),True)
    check('Only one completed check-in after concurrent writes',sum(x['id']==checkin['id'] and x['status']=='COMPLETED' for x in profile['checkins']),1)
    check('Only one guardian relationship created',len(profile['guardians']),1)
    check('Guardian phone is masked',all(not g.get('phone') or g['phone'].startswith('*') for g in profile['guardians']),True)
    audit_a=api('GET',f'/v1/tenants/{A}/audit-logs?limit=100',token=token_a,step='Read tenant A audit trail')
    check('Check-in completion is audited once',sum(x.get('resourceId')==checkin['id'] and x['action']=='crm.checkin.completed' for x in audit_a),1)
    audit_b=api('GET',f'/v1/tenants/{B}/audit-logs?limit=100',token=token_b,step='Read tenant B audit trail')
    check('Tenant A audit never appears in B',not any(x.get('resourceId') in (lead_id,person_id,checkin['id'],source['id']) for x in audit_b),True)
    api('GET',f'/v1/tenants/{B}/audit-logs',token=token_a,expected=403,step='Cross-tenant audit access denied')
    # Cross-tenant direct read/write; also non-tenant IDs with valid tokens.
    api('GET',f'/v1/tenants/{B}/crm/persons/{person_id}?branchId={b_bid}',token=token_b,expected=404,step='Tenant B cannot read A person ID')
    api('POST',f'/v1/tenants/{A}/crm/leads',{'branchId':b_bid,'studentName':'Cross Tenant','sourceId':source['id']},token_a,expected={400,403,404},step='Cross-tenant Branch rejected')
    api('POST',f'/v1/tenants/{A}/crm/checkins/{checkin["id"]}/complete',{'dateOfBirth':'2013-01-15','schoolName':'X','schoolGrade':'8','guardianName':'X','guardianPhone':'0912345678'},token_a,expected=409,step='Repeated check-in completion rejected')
    api('POST',f'/v1/tenants/{A}/crm/intake-invites',{'branchId':bid},token_a,expected=503,step='Public QR intake disabled by default')
    print('\nPASS: authenticated OIDC JWT, tenant isolation, Lead→QL→Care→Check-in→Customer 360, and negative cases',flush=True)
    print(f'TEST_COUNT={len(results)}',flush=True)

if __name__=='__main__':
    try:main()
    except Exception as ex:
        print('FAIL: '+str(ex),file=sys.stderr);sys.exit(1)
