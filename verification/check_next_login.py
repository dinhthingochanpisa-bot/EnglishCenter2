#!/usr/bin/env python3
from pathlib import Path
import sys
if len(sys.argv)!=2:raise SystemExit('Usage: check_next_login.py HEADERS.txt')
data=Path(sys.argv[1]).read_text().lower()
for required in ('location: http://localhost:18080/realms/lms-demo/','code_challenge_method=s256','httponly','samesite=lax'):
    if required not in data:raise SystemExit(f'FAIL: OIDC code/PKCE check missing {required}')
print('PASS: Next OIDC Authorization Code + PKCE initiation and HttpOnly state cookie')
