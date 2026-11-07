#!/usr/bin/env python3
"""Create disposable, untracked local testing credentials and app settings."""
from pathlib import Path
import base64, os, secrets
ROOT = Path(__file__).resolve().parents[1]
def secret(): return secrets.token_hex(18)
env = dict(PG_SUPERUSER_PASSWORD=secret(), APP_RUNTIME_PASSWORD=secret(), IDENTITY_READER_PASSWORD=secret(), PLATFORM_OPERATOR_PASSWORD=secret(), KEYCLOAK_ADMIN_PASSWORD=secret(), DEMO_USER_A_PASSWORD=secret(), DEMO_USER_B_PASSWORD=secret())
file = ROOT/'infra'/'.env.test'
if file.exists():
    raise SystemExit(f'Refusing to overwrite existing credentials: {file}. Remove it explicitly to create fresh disposable environment.')
file.write_text(''.join(f'{k}={v}\n' for k,v in env.items()))
file.chmod(0o600)
pg_url = lambda role, password: f'postgresql://{role}:{password}@127.0.0.1:55432/lms_crm_stage01'
backend_env = ROOT/'backend'/'.env'
if backend_env.exists(): raise SystemExit('backend/.env already exists; remove it before regenerating sandbox credentials')
backend_env.write_text(''.join(f'{k}={v}\n' for k,v in {
    'NODE_ENV':'development','PORT':'3001',
    'DATABASE_URL':pg_url('app_runtime',env['APP_RUNTIME_PASSWORD']),
    'IDENTITY_DATABASE_URL':pg_url('identity_reader',env['IDENTITY_READER_PASSWORD']),
    'PROVISIONING_DATABASE_URL':pg_url('platform_operator',env['PLATFORM_OPERATOR_PASSWORD']),
    'OIDC_ISSUER':'http://localhost:18080/realms/lms-demo','OIDC_AUDIENCE':'lms-api',
    'OIDC_JWKS_URL':'http://localhost:18080/realms/lms-demo/protocol/openid-connect/certs',
    'PUBLIC_INTAKE_ENABLED':'false','PUBLIC_FRONTEND_URL':'http://localhost:3000',
    'PLATFORM_ADMIN_SUBJECTS':''}.items()))
backend_env.chmod(0o600)
frontend_env = ROOT/'frontend'/'.env.local'
if frontend_env.exists(): raise SystemExit('frontend/.env.local already exists; remove it before regenerating sandbox credentials')
frontend_env.write_text(''.join(f'{k}={v}\n' for k,v in {
    'BACKEND_URL':'http://localhost:3001',
    'OIDC_ISSUER':'http://localhost:18080/realms/lms-demo',
    'OIDC_CLIENT_ID':'lms-web',
    'SESSION_SECRET_BASE64':base64.b64encode(secrets.token_bytes(32)).decode(),
    'APP_ORIGIN':'http://localhost:3000',
    'PUBLIC_INTAKE_ENABLED':'false'
}.items()))
frontend_env.chmod(0o600)
print('Generated untracked local demo credentials. Never use for production. See infra/.env.test for demo passwords.')
