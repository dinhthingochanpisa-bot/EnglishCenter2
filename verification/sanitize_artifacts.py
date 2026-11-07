"""Copy only approved evidence files; never copy a browser profile, env or raw headers."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'verification/artifacts'
secrets=[]
for file in (ROOT/'infra/.env.test',ROOT/'backend/.env',ROOT/'frontend/.env.local'):
    if file.exists():
        for line in file.read_text().splitlines():
            if '=' not in line: continue
            key,value=line.split('=',1)
            if re.search('PASSWORD|SECRET|TOKEN',key,re.I) and len(value.strip())>=8:
                secrets.append(value.strip().strip('"\''))
target=ART/'sanitized'
target.mkdir(parents=True,exist_ok=True)
allowed=['backend.log','frontend.log','stage3-gate/api-e2e.log','stage3-gate/oidc-http.log',
         'stage3-gate/fresh-realm.log','stage3-gate/live-summary.json','browser/summary.json']
for name in allowed:
    file=ART/name
    if not file.exists(): continue
    text=file.read_text(encoding='utf-8',errors='replace')
    for secret in secrets: text=text.replace(secret,'[REDACTED]')
    text=re.sub(r'(postgres(?:ql)?://[^:\s]+:)[^@\s]+@',r'\1[REDACTED]@',text)
    text=re.sub(r'Bearer\s+[A-Za-z0-9._-]+','Bearer [REDACTED]',text)
    text=re.sub(r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[REDACTED JWT]',text)
    (target/name.replace('/','-')).write_text(text,encoding='utf-8')
print('Selected evidence sanitized; profiles, credentials and cookies excluded.')
