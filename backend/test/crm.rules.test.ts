import test from 'node:test';
import assert from 'node:assert/strict';
import {canMoveLead,normalizePhone,isQualified,normalizedName,redactPhone} from '../src/crm.rules';
test('Vietnam local / E164 normalize consistently',()=>{
 assert.equal(normalizePhone('0912 345 678'),'+84912345678');
 assert.equal(normalizePhone('+84 912 345 678'),'+84912345678');
 assert.equal(normalizePhone(''),null);
 assert.throws(()=>normalizePhone('abc/123'),/Invalid phone/);
});
test('A lead becomes QL only with contact number',()=>{
 assert.equal(isQualified(normalizePhone('0912345678')),true);
 assert.equal(isQualified(normalizePhone('')),false);
});
test('stages are constrained and never auto-accept missing phone',()=>{
 assert.equal(canMoveLead('NEW','QUALIFIED',false),false);
 assert.equal(canMoveLead('NEW','QUALIFIED',true),true);
 assert.equal(canMoveLead('NEW','CONVERTED',true),false);
 assert.equal(canMoveLead('CONVERTED','NEW',true),false);
 assert.equal(canMoveLead('QUALIFIED','QUALIFIED',false),false);
});
test('person identity does not merge by phone',()=>{
 assert.equal(normalizedName('  Nguyễn   Văn A '),'nguyễn văn a');
 assert.equal(redactPhone('+84912345678'),'********5678');
});
