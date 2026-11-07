#!/usr/bin/env python3
"""Run synthetic local API and OIDC HTTP tests against the already-running stack."""
from pathlib import Path
import json, os, subprocess, sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'verification/artifacts/stage3-gate'

def main():
    env = os.environ.copy()
    for line in (ROOT / 'infra/.env.test').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env[key] = value.strip().strip('\"').strip("'")
    env['ALLOW_DEMO_E2E'] = 'true'
    env['PYTHONIOENCODING'] = 'utf-8'
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    results = []
    tests=[('api-e2e', 'api_e2e_smoke.py'), ('oidc-http', 'oidc_http_smoke.py')]
    if '--fresh-realm' in sys.argv: tests.append(('fresh-realm','fresh_realm_smoke.py'))
    if env.get('INCLUDE_GATE_USERS')=='true': tests.append(('restricted-roles','restricted_roles_smoke.py'))
    for name, script in tests:
        try:
            completed = subprocess.run([sys.executable, str(ROOT / 'verification' / script)],
                cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8', timeout=240)
            output = completed.stdout + completed.stderr
            # Credentials/tokens must never be copied to evidence logs.
            for key, value in env.items():
                if value and any(marker in key.upper() for marker in ('PASSWORD', 'SECRET', 'TOKEN')):
                    output = output.replace(value, '[REDACTED]')
            (ARTIFACTS / (name + '.log')).write_text(output, encoding='utf-8')
            result = {'id': name, 'status': 'PASS' if completed.returncode == 0 else 'FAIL',
                      'exitCode': completed.returncode,
                      'checksPassed': sum(line.startswith('PASS ') and not line.startswith('PASS HTTP OIDC') for line in completed.stdout.splitlines())}
        except subprocess.TimeoutExpired:
            result = {'id': name, 'status': 'FAIL', 'reason': 'timeout'}
        results.append(result)
        print(json.dumps(result), flush=True)
    (ARTIFACTS / 'live-summary.json').write_text(json.dumps({
        'date': datetime.now(timezone.utc).isoformat(), 'results': results,
        'scope': 'Synthetic existing local stack; no database migration replay or visual browser QA',
        'stage3Ready': False}, indent=2) + '\n', encoding='utf-8')
    return 0 if all(result['status'] == 'PASS' for result in results) else 1

if __name__ == '__main__':
    raise SystemExit(main())
