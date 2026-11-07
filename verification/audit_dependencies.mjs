import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const module=process.argv[2];
if(!['backend','frontend'].includes(module))throw Error('Expected backend or frontend');
const folder='verification/artifacts';fs.mkdirSync(folder,{recursive:true});
const args=['audit','--json','--audit-level=high','--fetch-retries=0','--fetch-timeout=15000'];
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const result=process.platform==='win32'?spawnSync(process.execPath,[npmCli,...args],{cwd:module,encoding:'utf8',windowsHide:true}):spawnSync('npm',args,{cwd:module,encoding:'utf8'});
let audit;try{audit=JSON.parse(result.stdout);}catch{}
fs.writeFileSync(path.join(folder,`audit-${module}.json`),JSON.stringify(audit??{error:'Audit endpoint/process unavailable'},null,2)+'\n');
if(!audit?.metadata?.vulnerabilities){console.error('BLOCKED audit '+module+': advisory endpoint/process unavailable');process.exitCode=2;}
else{
 console.log(JSON.stringify({module,vulnerabilities:audit.metadata.vulnerabilities}));
 for(const [name,v] of Object.entries(audit.vulnerabilities??{}))console.log(JSON.stringify({package:name,severity:v.severity,range:v.range,nodes:v.nodes,fixAvailable:v.fixAvailable,advisories:v.via}));
 process.exitCode=result.status??2;
}
