"""Additive synthetic coverage for Stage 02 catalogs, Person, assignment and walk-ins.

Uses the existing local stack; never migrates, seeds, deletes or resets data.
"""
import os
import uuid
from api_e2e_smoke import A, B, API, api, check, login, req, results


def main():
    if os.environ.get('ALLOW_DEMO_E2E') != 'true':
        raise RuntimeError('Synthetic demo opt-in required')
    token = login('demo-a', os.environ['DEMO_USER_A_PASSWORD'])
    other = login('demo-b', os.environ['DEMO_USER_B_PASSWORD'])
    prefix = f'/v1/tenants/{A}/crm'
    branch = api('GET', f'/v1/tenants/{A}/branches', token=token)[0]['id']
    other_branch = api('GET', f'/v1/tenants/{B}/branches', token=other)[0]['id']
    suffix = uuid.uuid4().hex[:10]
    source_data = {'code': 'EXT_' + suffix, 'name': 'Synthetic extended ' + suffix, 'category': 'WALK_IN'}
    source = api('POST', prefix + '/sources', source_data, token, step='Create walk-in source')
    api('POST', prefix + '/sources', source_data, token, expected=409, step='Duplicate source rejected')
    api('POST', prefix + '/sources', {**source_data, 'category': 'INVALID'}, token, expected=400, step='Invalid category rejected')
    campaign = api('POST', prefix + '/campaigns', {'code': 'EXT_' + suffix, 'name': 'Synthetic campaign ' + suffix,
                   'sourceId': source['id']}, token, step='Create campaign')
    campaigns = api('GET', prefix + '/campaigns', token=token, step='List campaigns')
    check('Created campaign retained', any(c['id'] == campaign['id'] for c in campaigns), True)
    api('GET', prefix + '/campaigns', token=other, expected=403, step='Other tenant cannot list campaigns')
    person = api('POST', prefix + '/persons', {'branchId': branch, 'fullName': 'Synthetic extended ' + suffix}, token, step='Create Person')
    pid = person['id']
    api('GET', prefix + f'/persons/{pid}?branchId={other_branch}', token=token, expected=404, step='Person inaccessible in unlinked branch')
    found = api('GET', prefix + '/persons?branchId=' + branch + '&search=' + suffix, token=token, step='Person search')
    check('Person search finds created profile', any(p['id'] == pid for p in found), True)
    api('PATCH', prefix + '/persons/' + pid, {'branchId': branch, 'rowVersion': person['rowVersion'], 'schoolName': 'Synthetic Updated School'},
        token, step='Optimistic Person update')
    api('PATCH', prefix + '/persons/' + pid, {'branchId': branch, 'rowVersion': person['rowVersion'], 'schoolName': 'Stale'},
        token, expected=409, step='Stale Person update rejected')
    profile = api('GET', prefix + f'/persons/{pid}?branchId={branch}', token=token, step='Read updated Person')
    check('Rejected stale update preserves school', profile['schoolName'], 'Synthetic Updated School')
    lead = api('POST', prefix + '/leads', {'branchId': branch, 'personId': pid, 'sourceId': source['id'], 'campaignId': campaign['id']},
               token, step='Lead reuses existing Person')
    check('Lead keeps existing Person identity', lead['personId'], pid)
    assignees = api('GET', prefix + '/assignees?branchId=' + branch, token=token, step='Eligible assignees')
    check('Demo assignee fixture exists', bool(assignees), True)
    updated = api('PATCH', prefix + '/leads/' + lead['id'], {'rowVersion': 1, 'assignedMembershipId': assignees[0]['membershipId']},
                  token, step='Authorized assignment')
    detail = api('GET', prefix + '/leads/' + lead['id'], token=token, step='Assigned Lead detail')
    check('Assignee persisted', detail['lead']['assignedMembershipId'], assignees[0]['membershipId'])
    api('PATCH', prefix + '/leads/' + lead['id'], {'rowVersion': updated['rowVersion'], 'contactPhone': 'invalid'},
        token, expected=400, step='Invalid phone update rejected')
    api('POST', prefix + '/leads/' + lead['id'] + '/activities', {'kind': 'INVALID', 'note': 'Synthetic'},
        token, expected=400, step='Invalid activity rejected')
    api('POST', prefix + '/leads', {'branchId': branch, 'sourceId': source['id']}, token, expected=400, step='Lead requires Person or name')
    # Walk-in creates a second synthetic Person and completes without a linked Lead.
    walkin = api('POST', prefix + '/persons', {'branchId': branch, 'fullName': 'Synthetic walk-in ' + suffix}, token, step='Walk-in Person')
    draft = api('POST', prefix + '/checkins', {'branchId': branch, 'personId': walkin['id'], 'sourceId': source['id']}, token, step='Walk-in draft without Lead')
    completion = {'dateOfBirth': '2013-01-15', 'schoolName': 'Synthetic Walk-in School', 'schoolGrade': '8',
                  'guardianName': 'Synthetic Walk-in Parent', 'guardianPhone': '0912345678'}
    api('POST', prefix + f"/checkins/{draft['id']}/complete", {**completion, 'guardianPhone': 'invalid'}, token, expected=400, step='Invalid guardian phone rejected')
    completed = api('POST', prefix + f"/checkins/{draft['id']}/complete", completion, token, step='Complete walk-in')
    profile = api('GET', prefix + f"/persons/{walkin['id']}?branchId={branch}", token=token, step='Walk-in 360')
    check('Walk-in stable Person', profile['id'], walkin['id'])
    check('Walk-in CUSTOMER status', profile['status'], 'CUSTOMER')
    check('Walk-in has no artificial Lead', len(profile['leads']), 0)
    check('Walk-in student identity matches', profile['studentId'], completed['studentId'])
    api('GET', prefix + '/intake-submissions?branchId=' + branch, token=token, step='Read scoped intake list')
    api('GET', prefix + '/intake-submissions', token=token, expected=400, step='Intake list requires branch')
    status, _ = req('POST', API + f'/v1/public/intake/{A}/' + 'x' * 43,
                    {'consentAccepted': True, 'fullName': 'Synthetic', 'guardianName': 'Synthetic', 'guardianPhone': '0912345678'})
    check('Public intake disabled on direct submission', status, 503)
    print('TEST_COUNT=' + str(len(results)), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('FAIL extended smoke: ' + str(error), flush=True)
        raise SystemExit(1)
