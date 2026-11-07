import unittest
from generate_dev_realm import build_realm

class RealmGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.env={'DEMO_USER_A_PASSWORD':'synthetic-test-a','DEMO_USER_B_PASSWORD':'synthetic-test-b'}
        self.realm=build_realm(self.env)
    def test_complete_profiles_and_stable_subjects(self):
        self.assertEqual([u['id'] for u in self.realm['users']], ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])
        for user in self.realm['users']:
            self.assertEqual(user['email'],user['username']+'@example.test')
            self.assertTrue(user['firstName'] and user['lastName'])
            self.assertEqual(user['requiredActions'],[])
            self.assertFalse(user['credentials'][0]['temporary'])
    def test_browser_uses_pkce_not_password_grant(self):
        web=next(c for c in self.realm['clients'] if c['clientId']=='lms-web')
        self.assertTrue(web['standardFlowEnabled'])
        self.assertFalse(web['directAccessGrantsEnabled'])
        self.assertEqual(web['attributes']['pkce.code.challenge.method'],'S256')
    def test_test_client_only_and_missing_credentials_fail(self):
        self.assertTrue(next(c for c in self.realm['clients'] if c['clientId']=='lms-smoke-cli')['directAccessGrantsEnabled'])
        with self.assertRaises(SystemExit): build_realm({})
    def test_only_test_realms_allowed(self):
        with self.assertRaises(ValueError): build_realm(self.env,'production')
        self.assertEqual(build_realm(self.env,'lms-demo-gate-example')['realm'],'lms-demo-gate-example')
    def test_separate_realms_have_unique_but_deterministic_subjects(self):
        other=build_realm(self.env,'lms-demo-gate-example')
        self.assertNotEqual(other['users'][0]['id'],self.realm['users'][0]['id'])
        self.assertEqual(other['users'][0]['id'],build_realm(self.env,'lms-demo-gate-example')['users'][0]['id'])

if __name__=='__main__': unittest.main()
