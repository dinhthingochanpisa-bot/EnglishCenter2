import test from 'node:test';
import assert from 'node:assert/strict';
import {uuid,UUID_RE,ROLE_SCOPES} from '../src/contracts';
test('UUID validation rejects non UUID and SQL-like data',()=>{
 assert.throws(()=>uuid('1 OR 1=1'));assert.equal(uuid('11111111-1111-4111-8111-111111111111'),'11111111-1111-4111-8111-111111111111');
});
test('role scopes include tenant and branch scopes',()=>{
 assert.ok(ROLE_SCOPES.includes('TENANT'));assert.ok(ROLE_SCOPES.includes('ASSIGNED_BRANCHES'));
});
