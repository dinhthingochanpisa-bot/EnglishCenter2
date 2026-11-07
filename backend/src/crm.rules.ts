/** Pure, tested domain rules. Keep qualification separate from workflow stage. */
export function normalizedName(input:string){return input.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN');}
export function normalizePhone(value:string|undefined|null):string|null {
 if(!value?.trim())return null;
 const v=value.replace(/[\s().-]/g,'');
 if(!/^\+?[0-9]{9,15}$/.test(v))throw new Error('Invalid phone number: use 9–15 digits, optional +');
 return v.startsWith('+')?v:(v.startsWith('0')&&v.length===10?`+84${v.slice(1)}`:`+${v}`);
}
const transitions:Record<string,readonly string[]> = {
 NEW:['CONTACTING','QUALIFIED','APPOINTMENT','CLOSED_LOST'],
 CONTACTING:['QUALIFIED','APPOINTMENT','CLOSED_LOST'],
 QUALIFIED:['CONTACTING','APPOINTMENT','CONVERTED','CLOSED_LOST'],
 APPOINTMENT:['CONTACTING','CONVERTED','CLOSED_LOST'],
 CLOSED_LOST:['CONTACTING'],
 CONVERTED:[],
};
export function canMoveLead(from:string,to:string,hasPhone:boolean){
 if((to==='QUALIFIED'||to==='APPOINTMENT')&&!hasPhone)return false;
 if(from===to)return true;
 return (transitions[from]??[]).includes(to);
}
export function isQualified(phone:string|null|undefined){return Boolean(phone);}
export function redactPhone(phone:string|null|undefined){if(!phone)return null;return phone.length<=4?'****':`${'*'.repeat(Math.max(4,phone.length-4))}${phone.slice(-4)}`;}
