// Real Chrome/Chromium + CDP, no extra test dependencies. Synthetic localhost only.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'verification/artifacts/browser');fs.mkdirSync(folder,{recursive:true});
const base='http://localhost:3000',tenant='11111111-1111-4111-8111-111111111111';
const results=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(action,label,timeout=30000){const until=Date.now()+timeout;while(Date.now()<until){try{if(await action())return;}catch{}await pause(100);}throw Error('Timeout: '+label);}
function check(name,value){assert.ok(value,name);results.push({name,status:'PASS'});console.log('PASS '+name);}
class CDP{
 constructor(socket){this.socket=socket;this.id=0;this.pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);const task=this.pending.get(message.id);if(task){this.pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});}
 static async open(url){const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});return new CDP(socket);}
 call(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
 async evaluate(expression){const out=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(out.exceptionDetails)throw Error('Browser evaluation failed');return out.result.value;}
}
let chrome,browser,page,fd;
async function main(){
 const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
 const executable=candidates.find(file=>fs.existsSync(file));
 if(!executable)throw Error('BLOCKED: Chrome unavailable; set CHROME_BIN');
 const settings={};for(const line of fs.readFileSync(path.join(root,'infra/.env.test'),'utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)settings[line.slice(0,i)]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
 const profile=fs.mkdtempSync(path.join(folder,'profile-'));
 fd=fs.openSync(path.join(folder,'chrome.log'),'w');
 chrome=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore',fd,fd],windowsHide:true});
 let launchError;chrome.on('error',error=>{launchError=error;});
 const portFile=path.join(profile,'DevToolsActivePort');
 await waitFor(()=>{if(launchError)throw launchError;return fs.existsSync(portFile);},'isolated Chrome start',15000);
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
 browser=await CDP.open(version.webSocketDebuggerUrl);
 const target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 page=await CDP.open(target.webSocketDebuggerUrl);await page.call('Page.enable');await page.call('Runtime.enable');
 const evaluate=s=>page.evaluate(s);
 const navigate=async url=>{assert.ok(url.startsWith(base)||url.startsWith('http://localhost:18080/'));await page.call('Page.navigate',{url});};
 const click=async(text,scope='document')=>{
  const expression=`(()=>{const button=Array.from(${scope}.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Missing button');button.focus();button.click();return true;})()`;
  await waitFor(()=>evaluate(expression),'button '+text);
 };
 const field=label=>`Array.from(document.querySelectorAll('[role="dialog"] label')).find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)})?.querySelector('input,select,textarea')`;
 const key=async(name,shift=false)=>{const codes={Tab:9,Escape:27,Backspace:8,Enter:13};const params={key:name,code:name,windowsVirtualKeyCode:codes[name],modifiers:shift?8:0};await page.call('Input.dispatchKeyEvent',{type:'keyDown',...params});await page.call('Input.dispatchKeyEvent',{type:'keyUp',...params});};
 const fill=async(label,value,perCharacter=false)=>{
  await evaluate(`(()=>{const el=${field(label)};if(!el)throw Error('Missing field');el.focus();if(el.select)el.select();return true;})()`);
  await key('Backspace');
  for(const text of perCharacter?[...value]:[value]){
   await page.call('Input.insertText',{text});
   if(perCharacter)assert.equal(await evaluate(`document.activeElement===${field(label)}`),true,'focus retained after input');
  }
  assert.equal(await evaluate(`(${field(label)})?.value`),value,'input retains complete text');
 };
 const select=async(label,value)=>evaluate(`(()=>{const el=${field(label)};if(!el)throw Error('Missing select');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));return el.value;})()`);
 const row=()=>`Array.from(document.querySelectorAll('tbody tr')).find(e=>e.textContent.includes(${JSON.stringify(name)}))`;
 const noDialog=()=>evaluate(`!document.querySelector('[role="dialog"]')`);
 const submit=async()=>{await click('Gửi yêu cầu',`document.querySelector('[role="dialog"]')`);await waitFor(noDialog,'successful form commit');};
 const login=async username=>{
  await navigate(base+'/api/auth/login');
  await waitFor(()=>evaluate(`!!document.querySelector('#username')`),'Keycloak login form');
  const password=settings[username==='demo-a'?'DEMO_USER_A_PASSWORD':'DEMO_USER_B_PASSWORD'];assert.ok(password,'local demo password exists');
  await evaluate(`(()=>{document.querySelector('#username').value=${JSON.stringify(username)};document.querySelector('#password').value=${JSON.stringify(password)};document.querySelector('#kc-login').click();return true;})()`);
  await waitFor(()=>evaluate(`location.origin===${JSON.stringify(base)}&&!location.search.includes('auth_error')`),'OIDC callback');
  await waitFor(()=>evaluate(`fetch('/api/auth/session').then(r=>r.json()).then(s=>s.authenticated===true)`),'authenticated session');
 };
 await login('demo-a');check('Real browser Authorization Code + PKCE callback',true);
 await navigate(base+`/t/${tenant}/crm/leads`);
 await waitFor(()=>evaluate(`Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()==='Lead mới')`),'CRM ready');
 await click('Lead mới');await waitFor(()=>evaluate(`document.activeElement===${field('Tên học sinh')}`),'initial input focus');
 check('Modal initially focuses first editable field',true);
 const name='Synthetic Browser '+Date.now();
 await fill('Tên học sinh',name,true);
 await fill('Người liên hệ','Synthetic Parent Name Twenty',true);
 await fill('Số điện thoại (có số hợp lệ sẽ thành QL)','0912 345 678        ',true);
 check('Twenty character input survives controlled rerenders in all three fields',true);
 await evaluate(`document.querySelector('[role="dialog"] .modal-header button').focus()`);await key('Tab',true);
 check('Shift+Tab wraps from first to last control',await evaluate(`document.activeElement===Array.from(document.querySelectorAll('[role="dialog"] button')).at(-1)`));
 await key('Tab');check('Tab wraps from last to first control',await evaluate(`document.activeElement===document.querySelector('[role="dialog"] .modal-header button')`));
 await key('Escape');await waitFor(noDialog,'Escape close');
 check('Escape closes and restores launcher focus',await evaluate(`document.activeElement?.textContent.trim()==='Lead mới'`));
 await click('Lead mới');await fill('Tên học sinh',name);
 await evaluate(`(()=>{const el=${field('Nguồn khách hàng')};el.value=Array.from(el.options).find(o=>o.value)?.value||'';el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 // Real offline failure must preserve input and dialog rather than show fake success.
 await page.call('Network.enable');await page.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await click('Gửi yêu cầu',`document.querySelector('[role="dialog"]')`);
 await waitFor(()=>evaluate(`!!document.querySelector('[role="dialog"] [role="alert"]')`),'offline error visible');
 check('Offline error preserves modal input',await evaluate(`(${field('Tên học sinh')})?.value===${JSON.stringify(name)}`));
 await page.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await submit();await waitFor(()=>evaluate(`!!(${row()})`),'new lead row');
 check('Browser creates NEW lead without phone',await evaluate(`(${row()}).textContent.includes('Lead mới')`));
 await click('Giai đoạn',row());await select('Trạng thái mới','QUALIFIED');await fill('Cập nhật SĐT (để trống nếu không thay đổi)','0912345678');await submit();
 await waitFor(()=>evaluate(`(${row()})?.textContent.includes('QL – Có SĐT')`),'QL persisted');check('Browser qualifies lead through backend',true);
 await click('Chăm sóc',row());await fill('Nội dung','Synthetic browser care history');await submit();await click('Chi tiết',row());
 await waitFor(()=>evaluate(`document.body.textContent.includes('Synthetic browser care history')`),'care history');check('Browser care history persists',true);
 await click('Check-in',row());await submit();
 await navigate(base+`/t/${tenant}/crm/checkins`);await waitFor(()=>evaluate(`!!(${row()})`),'draft check-in');await click('Hoàn tất',row());
 await fill('Họ tên phụ huynh','Synthetic Browser Parent');await fill('Điện thoại phụ huynh','0912345678');
 await evaluate(`(()=>{const el=${field('Ngày sinh học sinh')};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2013-01-15');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await fill('Trường học','Synthetic Browser School');await fill('Lớp học','8');await submit();
 await waitFor(()=>evaluate(`(${row()})?.textContent.includes('COMPLETED')`),'completed check-in');check('Browser completes check-in',true);
 await navigate(base+`/t/${tenant}/crm/persons`);await waitFor(()=>evaluate(`!!(${row()})`),'person profile');await click('Xem 360°',row());
 await waitFor(()=>evaluate(`document.body.textContent.includes('Customer 360°')&&document.body.textContent.includes('Synthetic Browser Parent')`),'Customer 360');
 check('Browser Customer 360 retains same person and guardian history',true);
 const screenshot=await page.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'customer-360.png'),Buffer.from(screenshot.data,'base64'));
 const logout=await evaluate(`fetch('/api/auth/logout',{method:'POST',headers:{Origin:location.origin}}).then(r=>r.status)`);check('Logout accepted',logout===200);
 check('Logout invalidates session',await evaluate(`fetch('/api/auth/session').then(r=>r.json()).then(s=>s.authenticated===false)`));
 await page.call('Network.clearBrowserCookies');await login('demo-b');
 const denied=await evaluate(`fetch('/api/backend/v1/tenants/${tenant}/crm/leads').then(r=>r.status)`);
 check('Tenant B browser session cannot read tenant A CRM',denied===403||denied===404);
}
try{await main();}catch(error){const status=error.message.startsWith('BLOCKED')?'BLOCKED':'FAIL';results.push({name:error.message,status});console.error(status+' '+error.message);process.exitCode=status==='BLOCKED'?2:1;}
finally{
 if(page)page.socket.close();
 if(browser){try{await browser.call('Browser.close');}catch{}browser.socket.close();}
 if(chrome?.pid&&chrome.exitCode===null)chrome.kill('SIGTERM');
 if(fd!==undefined)fs.closeSync(fd);
 fs.writeFileSync(path.join(folder,'summary.json'),JSON.stringify({date:new Date().toISOString(),results,productionReady:false},null,2)+'\n');
}
