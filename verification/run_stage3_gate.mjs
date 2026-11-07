// Portable, read-only service probes and local compilation. Does not deploy or seed a DB.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'verification/artifacts/stage3-gate');
fs.mkdirSync(artifacts, { recursive: true });
const results = [];
function redact(value) {
  return value.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1[REDACTED]@')
    .replace(/((?:password|secret|access_token|refresh_token)\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
}
async function run(id, executable, args, cwd = root, timeout = 45000) {
  const result = await new Promise(resolve => {
    let output = '', timedOut = false, settled = false;
    const child = spawn(executable, args, { cwd, windowsHide: true,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1',
        NEXT_SWC_PATH: path.join(artifacts, 'swc-cache') } });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) output += '\n' + error.message;
      fs.writeFileSync(path.join(artifacts, `${id}.log`), redact(output));
      resolve({ id, status: code === 0 && !timedOut ? 'PASS' : 'FAIL', code, timedOut });
    };
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', error => finish(null, error));
    child.on('close', code => finish(code));
  });
  results.push(result);
  console.log(`${result.status} ${id}${result.timedOut ? ' (timeout)' : ''}`);
  return result.status === 'PASS';
}
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
for (const name of ['verify_static', 'verify_logic', 'verify_stage02']) {
  await run(name, process.execPath, [`verification/${name}.mjs`]);
}
await run('backend-typecheck', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], backend);
await run('backend-build', process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], backend);
const compiled = await run('unit-compile', process.execPath,
  ['node_modules/typescript/bin/tsc', '--outDir', '../verification/artifacts/stage3-gate/unit'], backend);
if (compiled) await run('unit-tests', process.execPath, ['--test',
  'verification/artifacts/stage3-gate/unit/test/contracts.test.js',
  'verification/artifacts/stage3-gate/unit/test/crm.rules.test.js']);
await run('frontend-typecheck', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], frontend);
await run('frontend-build', process.execPath, ['node_modules/next/dist/bin/next', 'build'], frontend, 90000);
await run('prisma-validate', process.execPath, ['node_modules/prisma/build/index.js', 'validate'], backend, 20000);
await run('docker-engine', 'docker', ['--config', path.join(artifacts, 'docker-config'), 'info'], root, 15000);
for (const [id, url] of [
  ['backend-health', 'http://localhost:3001/health/live'],
  ['frontend-http', 'http://localhost:3000/'],
  ['oidc-discovery', 'http://localhost:18080/realms/lms-demo/.well-known/openid-configuration']
]) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
    results.push({ id, status: response.ok ? 'PASS' : 'FAIL', httpStatus: response.status });
  } catch (error) { results.push({ id, status: 'FAIL', error: error.cause?.code || error.message }); }
  console.log(`${results.at(-1).status} ${id}`);
}
// Successful probes/compiles do not establish database isolation or full browser login.
const report = { date: new Date().toISOString(), platform: process.platform,
  node: process.version, stage3Ready: false, results,
  remainingAcceptance: ['Live Prisma migration and seed', 'PostgreSQL RLS/FK isolation',
    'Authenticated CRM API lifecycle and negative authorization cases',
    'Browser Authorization Code + PKCE callback and CRM UI',
    'Review all CRM-01 through CRM-20 acceptance cases'] };
fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Stage 3 gate remains CLOSED pending full integration acceptance. See verification/artifacts/stage3-gate/summary.json');
process.exitCode = results.some(result => result.status !== 'PASS') ? 1 : 2;
