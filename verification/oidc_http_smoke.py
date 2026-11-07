#!/usr/bin/env python3
"""Real HTTP cookie/code+PKCE callback test. Does not claim browser rendering QA."""
from pathlib import Path
from html.parser import HTMLParser
from http.cookiejar import CookieJar, DefaultCookiePolicy
import json, re, urllib.error, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://localhost:3000'
TENANT = '11111111-1111-4111-8111-111111111111'

class LocalTestCookiePolicy(DefaultCookiePolicy):
    def return_ok_secure(self, cookie, request):
        # Python's cookie jar otherwise drops Keycloak's Secure cookies on localhost.
        # Confine this test-client exception to the disposable identity provider.
        url = urllib.parse.urlparse(request.full_url)
        if url.scheme == 'http' and url.hostname == 'localhost' and url.port == 18080:
            return True
        return super().return_ok_secure(cookie, request)

class LoginForm(HTMLParser):
    def __init__(self):
        super().__init__()
        self.action = None
        self.fields = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'form' and attrs.get('id') == 'kc-form-login':
            self.action = attrs.get('action')
        if tag == 'input' and attrs.get('type') == 'hidden' and attrs.get('name'):
            self.fields[attrs['name']] = attrs.get('value', '')

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    print('PASS ' + name, flush=True)

def main():
    settings = {}
    for line in (ROOT / 'infra/.env.test').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            settings[key] = value.strip().strip('\"').strip("'")
    jar = CookieJar(policy=LocalTestCookiePolicy())
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    def get(url):
        return opener.open(url, timeout=30)
    with get(BASE + '/api/auth/session') as response:
        check('Fresh session is anonymous', not json.load(response)['authenticated'])
    with get(BASE + '/api/auth/login') as response:
        check('Login redirects to local Keycloak', response.url.startswith('http://localhost:18080/'))
        query = urllib.parse.parse_qs(urllib.parse.urlparse(response.url).query)
        check('Authorization Code requested', query.get('response_type') == ['code'])
        check('PKCE S256 requested', query.get('code_challenge_method') == ['S256'])
        check('Explicit credentials requested despite prior SSO', query.get('prompt') == ['login'])
        parser = LoginForm()
        parser.feed(response.read().decode())
    check('Keycloak login form available', bool(parser.action))
    pending = next((cookie for cookie in jar if cookie.name == 'lms_saas_oidc_pending'), None)
    check('Pending auth cookie is HttpOnly', pending is not None and pending.has_nonstandard_attr('HttpOnly'))
    # Only submit credentials to the expected local test identity provider.
    check('Login form stays on test issuer', parser.action.startswith('http://localhost:18080/realms/lms-demo/'))
    parser.fields.update(username='demo-a', password=settings['DEMO_USER_A_PASSWORD'], credentialId='')
    request = urllib.request.Request(parser.action,
        data=urllib.parse.urlencode(parser.fields).encode(),
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with opener.open(request, timeout=30) as response:
        check('OIDC callback returns to application without error',
              response.url == BASE + '/' and response.status == 200)
    with get(BASE + '/api/auth/session') as response:
        session = json.load(response)
        check('Callback creates authenticated session', session.get('authenticated') is True)
        check('Session API never exposes access token', 'accessToken' not in session)
    cookie = next((item for item in jar if item.name == 'lms_saas_session'), None)
    check('Session cookie is HttpOnly', cookie is not None and cookie.has_nonstandard_attr('HttpOnly'))
    with get(BASE + '/api/backend/v1/tenants/' + TENANT + '/crm/leads') as response:
        check('Session authenticates CRM BFF request', response.status == 200 and isinstance(json.load(response), list))
    with get(BASE + '/t/' + TENANT + '/crm/leads') as response:
        check('CRM route serves HTML', response.status == 200 and 'text/html' in response.headers.get('content-type', ''))
    print('PASS HTTP OIDC flow; visual/browser interaction remains unverified.', flush=True)

if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        body = error.read().decode(errors='replace')
        title = re.search(r'<title>(.*?)</title>', body, re.S)
        print('FAIL HTTP ' + str(error.code) + ' at ' + urllib.parse.urlparse(error.url).path,
              'page=' + (title.group(1).strip() if title else 'unknown'), flush=True)
        for message in re.findall(r'<(?:span|p)[^>]*class="[^"]*(?:feedback-text|instruction)[^"]*"[^>]*>(.*?)</(?:span|p)>', body, re.S):
            print('Identity provider message: ' + re.sub(r'<[^>]+>', '', message).strip(), flush=True)
        raise SystemExit(1)
    except Exception as error:
        # Avoid logging URLs that could contain authorization codes or state.
        print('FAIL ' + (str(error) if isinstance(error, AssertionError) else type(error).__name__), flush=True)
        raise SystemExit(1)
