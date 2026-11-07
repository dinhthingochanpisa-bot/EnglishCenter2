'use client';
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowRight, Bell, Building2, ChevronDown, CircleAlert, Command, ContactRound, Fingerprint, LayoutDashboard, LogOut, Menu, Plus, ScrollText, Search, ShieldCheck, UsersRound, X} from 'lucide-react';
import {friendlyError} from '@/lib/api';
export function Status({value}:{value:string}){
  const cls=/ACTIVE|Đang|Hoạt động/.test(value)?'green':/INVITED|ONBOARDING|TRIAL|Chờ/.test(value)?'amber':/SUSPENDED|DISABLED|CLOSED|LEFT|Dừng/.test(value)?'red':'gray';
  const names:Record<string,string>={ACTIVE:'Hoạt động',ONBOARDING:'Đang khởi tạo',SUSPENDED:'Tạm khóa',CLOSED:'Đã đóng',INVITED:'Chờ kích hoạt',LEFT:'Đã nghỉ',DISABLED:'Đã khóa'};
  return <span className={`pill ${cls}`}><span className="pill-dot"/>{names[value]||value}</span>;
}
export function Button({children,kind='primary',...props}:{children:React.ReactNode;kind?:'primary'|'secondary'|'ghost'|'danger'}&React.ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`btn btn-${kind}`} {...props}>{children}</button>}
export function Banner({message,onClose}:{message:string;onClose?:()=>void}){return <div className="banner error" role="alert"><CircleAlert size={18}/><span>{message}</span>{onClose&&<button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={16}/></button>}</div>}
export function Success({message}:{message:string}){return <div className="banner success">✓ {message}</div>}
export function Empty({title,desc}:{title:string;desc:string}){return <div className="empty"><div className="empty-icon"><Search size={22}/></div><strong>{title}</strong><p>{desc}</p></div>}
export function Loading(){return <div className="loading-state"><div className="spinner"/>Đang tải dữ liệu từ API...</div>}
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null);
 // Keep the latest close handler without restarting the focus effect on form updates.
 const onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 useEffect(()=>{
  const before=document.activeElement as HTMLElement|null;
  const dialog=ref.current;
  if(!dialog)return;
  const controls=()=>Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')).filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0);
  const isTop=()=>Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1)===dialog;
  const focusFirst=()=>{const items=controls();(items.find(el=>el.closest('.modal-body'))??items[0]??dialog).focus();};
  focusFirst();
  const handler=(e:KeyboardEvent)=>{
   if(!isTop()||e.defaultPrevented)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCloseRef.current();return;}
   if(e.key!=='Tab')return;
   const items=controls(),first=items[0],last=items.at(-1),active=document.activeElement;
   if(!first){e.preventDefault();dialog.focus();return;}
   if(e.shiftKey&&(active===first||!dialog.contains(active))){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&(active===last||!dialog.contains(active))){e.preventDefault();first.focus();}
  };
  const keepInside=(e:FocusEvent)=>{if(isTop()&&!dialog.contains(e.target as Node))focusFirst();};
  document.addEventListener('keydown',handler,true);
  document.addEventListener('focusin',keepInside);
  return()=>{document.removeEventListener('keydown',handler,true);document.removeEventListener('focusin',keepInside);if(before?.isConnected)before.focus();};
 },[]);
 return <div className="modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-header"><h2>{title}</h2><button type="button" aria-label="Đóng" className="icon-btn" onClick={onClose}><X size={19}/></button></div><div className="modal-body">{children}</div></div></div>
}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function FormActions({onCancel,busy=false,text='Lưu thay đổi'}:{onCancel:()=>void;busy?:boolean;text?:string}){return <div className="form-actions"><Button type="button" kind="secondary" onClick={onCancel}>Hủy</Button><Button type="submit" disabled={busy}>{busy?'Đang xử lý...':text}</Button></div>}
export type SessionInfo={authenticated:boolean;user?:{sub:string;name:string;email?:string};expiresAt?:number};
export function useSession(){const [session,setSession]=useState<SessionInfo|null>(null);useEffect(()=>{fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.json()).then(setSession).catch(()=>setSession({authenticated:false}));},[]);return session}
const crmLinks=[{id:'overview',label:'CRM tổng quan'},{id:'persons',label:'Person Master'},{id:'leads',label:'Lead & QL'},{id:'sources',label:'Nguồn khách hàng'},{id:'checkins',label:'Check-in'},{id:'intakes',label:'Biểu mẫu QR'}];
const sectionLinks=[{id:'overview',label:'Tổng quan',icon:LayoutDashboard},{id:'branches',label:'Cơ sở',icon:Building2},{id:'members',label:'Nhân sự & tài khoản',icon:UsersRound},{id:'roles',label:'Vai trò & phân quyền',icon:ShieldCheck},{id:'audit',label:'Nhật ký hoạt động',icon:ScrollText}];
export function Shell({children,tenantId,tenantName='Không gian tổ chức',title,subtitle,actions}:{children:React.ReactNode;tenantId?:string;tenantName?:string;title:string;subtitle?:string;actions?:React.ReactNode}){
 const pathname=usePathname();const session=useSession();const [menu,setMenu]=useState(false);
 async function logout(){await fetch('/api/auth/logout',{method:'POST',headers:{Origin:window.location.origin}});window.location.href='/'}
 return <div className="app-shell"><aside className={`sidebar ${menu?'sidebar-open':''}`}>
  <Link className="brand" href="/"><span className="brand-mark">L</span><span><strong>LumaOS</strong><small>EDUCATION CLOUD</small></span></Link>
  <div className="workspace-box"><div className="workspace-avatar">{tenantId?'T':'S'}</div><div className="workspace-text"><strong>{tenantName}</strong><small>{tenantId?'Không gian tổ chức':'Quản trị nền tảng'}</small></div><ChevronDown size={15}/></div>
  <nav aria-label="Điều hướng" className="side-nav">
   <p className="nav-heading">KHÔNG GIAN LÀM VIỆC</p>
   {!tenantId?<><Link className={`nav-link ${pathname==='/'?'selected':''}`} href="/"><LayoutDashboard size={18}/>Trang chủ</Link><Link className={`nav-link ${pathname.startsWith('/platform')?'selected':''}`} href="/platform"><Building2 size={18}/>Tổ chức SaaS</Link></>:sectionLinks.map(({id,label,icon:Icon})=><Link key={id} className={`nav-link ${pathname.endsWith('/'+id)?'selected':''}`} href={`/t/${tenantId}/${id}`}><Icon size={18}/>{label}</Link>)}
   {tenantId&&<><div className="nav-heading nav-later">CRM · CUSTOMER 360°</div>{crmLinks.map(l=><Link key={l.id} className={`nav-link ${pathname===`/t/${tenantId}/crm/${l.id}`?'selected':''}`} href={`/t/${tenantId}/crm/${l.id}`}><ContactRound size={17}/>{l.label}</Link>)}</>}<div className="nav-heading nav-later">NỀN TẢNG</div>
   {tenantId?<Link className="nav-link" href="/"><Command size={18}/>Đổi tổ chức</Link>:null}
  </nav>
  <div className="sidebar-foot"><div className="security-caption"><ShieldCheck size={16}/> Bảo vệ theo Tenant & vai trò</div><div className="profile"><div className="avatar">{session?.user?.name?.slice(0,1)?.toUpperCase()||'U'}</div><div className="profile-info"><strong>{session?.user?.name||'Người dùng'}</strong><small>{session?.user?.email||'OIDC account'}</small></div><button className="icon-btn" onClick={logout} title="Đăng xuất"><LogOut size={17}/></button></div></div>
 </aside><main className="main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" aria-label="Mở menu" onClick={()=>setMenu(!menu)}><Menu size={20}/></button><span className="breadcrumb">LumaOS</span><span className="breadcrumb-sep">/</span><span>{title}</span></div><div className="topbar-right"><span className="live-indicator"><span/> API LIVE</span><div className="top-avatar">{session?.user?.name?.slice(0,1)?.toUpperCase()||'U'}</div></div></header><div className="content"><div className="page-header"><div><div className="eyebrow">SAAS CONTROL CENTER</div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</div>{session?.authenticated===false?<div className="auth-notice"><Fingerprint size={24}/><h2>Cần đăng nhập</h2><p>Đăng nhập OIDC để truy cập dữ liệu. Giao diện không lưu access token trong trình duyệt.</p><a href="/api/auth/login" className="btn btn-primary">Đăng nhập</a></div>:children}</div></main>
 </div>
}
export function SectionHeading({title,desc,action}:{title:string;desc?:string;action?:React.ReactNode}){return <div className="section-heading"><div><h2>{title}</h2>{desc&&<p>{desc}</p>}</div>{action}</div>}
export function Stat({icon:Icon,label,value,note}:{icon:React.ComponentType<{size?:number}>;label:string;value:React.ReactNode;note?:string}){return <div className="stat-card"><div className="stat-icon"><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note||'Dữ liệu theo quyền truy cập'}</div></div>}
export function safeDate(input?:string){if(!input)return '—';const d=new Date(input);return Number.isNaN(d.valueOf())?'—':d.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
export {friendlyError};
