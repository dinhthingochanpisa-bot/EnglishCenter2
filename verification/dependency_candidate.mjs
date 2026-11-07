// CI-only candidate evaluation. Does not commit, push, run audit fix, or change business code.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const file='backend/package.json';
const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
pkg.overrides={...pkg.overrides,
 'body-parser':'^1.20.9','multer':'^2.5.0','js-yaml':'^4.3.2',
 'lodash':'^4.17.24','effect':'^3.20.0','qs':'^6.16.1',
 '@prisma/config':{'deepmerge-ts':'^8.0.0'}
};
fs.writeFileSync(file,JSON.stringify(pkg,null,2)+'\n');
const result=spawnSync('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],{cwd:'backend',stdio:'inherit'});
if(result.status!==0)process.exit(result.status??2);
console.log('CANDIDATE_PACKAGE_BASE64:'+Buffer.from(fs.readFileSync(file)).toString('base64'));
console.log('CANDIDATE_LOCK_BASE64:'+Buffer.from(fs.readFileSync('backend/package-lock.json')).toString('base64'));
