'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,Building2,Layers3,ShieldCheck,UsersRound} from 'lucide-react';
import {api,friendlyError,Tenant,uuid} from '@/lib/api';
import {Banner,Button,Empty,Loading,Shell,useSession} from '@/components/ui';
export default function Home(){
 const router=useRouter();const session=useSession();const [tenants,setTenants]=useState<Tenant[]>([]);const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');const [tenantId,setTenantId]=useState('');
 useEffect(()=>{if(!session?.authenticated)return;setLoading(true);api<Tenant[]>('v1/platform/tenants').then(setTenants).catch(err=>{if(err.status!==403)setMessage(friendlyError(err));}).finally(()=>setLoading(false));},[session]);
 function open(){if(!uuid(tenantId)){setMessage('Nhập Tenant ID (UUID) hợp lệ được cung cấp bởi quản trị viên.');return;}router.push(`/t/${tenantId}/overview`)}
 return <Shell title="Không gian làm việc" subtitle="Quản lý tập trung, dữ liệu cách ly theo từng tổ chức.">
 <div className="hero"><div><span className="hero-label">SAAS MANAGEMENT PLATFORM</span><h2>Chào mừng đến trung tâm điều hành.</h2><p>Chọn một tổ chức để quản lý cơ sở, nhân viên, vai trò và lịch sử thao tác. Mọi thay đổi đều thông qua API đã phân quyền.</p><Link className="btn btn-primary" href="/platform">Quản lý tổ chức <ArrowRight size={17}/></Link></div><div className="hero-art"><Layers3 size={88}/></div></div>
 <div className="stat-grid"><div className="stat-card"><Building2 size={20}/><div className="stat-label">Tổ chức truy cập được qua Platform API</div><div className="stat-value">{loading?'…':tenants.length||'—'}</div><div className="stat-note">Không hiển thị nếu không có quyền Platform Admin</div></div><div className="stat-card"><UsersRound size={20}/><div className="stat-label">Quản lý nhân sự</div><div className="stat-value">RBAC</div><div className="stat-note">Phạm vi tổ chức và cơ sở</div></div><div className="stat-card"><ShieldCheck size={20}/><div className="stat-label">Kiểm soát truy cập</div><div className="stat-value">RLS</div><div className="stat-note">Backend + PostgreSQL</div></div></div>
 {message&&<Banner message={message} onClose={()=>setMessage('')}/>}
 <div className="grid-two"><section className="panel"><div className="panel-heading"><h2>Truy cập tổ chức</h2><p>Nhập Tenant ID từ đường dẫn mời hoặc quản trị nền tảng.</p></div><div className="panel-body"><label className="field"><span>Tenant ID</span><input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={e=>setTenantId(e.target.value.trim())}/></label><Button onClick={open}>Mở không gian <ArrowRight size={16}/></Button></div></section><section className="panel"><div className="panel-heading"><h2>Tổ chức từ nền tảng</h2><p>Chỉ tài khoản Platform Admin mới thấy danh sách.</p></div><div className="panel-body">{loading?<Loading/>:tenants.length?<div className="quick-list">{tenants.slice(0,5).map(t=><Link key={t.id} href={`/t/${t.id}/overview`}><span className="mini-logo">{t.displayName.slice(0,1)}</span><span><strong>{t.displayName}</strong><small>{t.code}</small></span><ArrowRight size={16}/></Link>)}</div>:<Empty title="Không có danh sách tổ chức" desc="Nếu là quản trị viên trung tâm, hãy nhập Tenant ID ở bên trái."/>}</div></section></div>
 </Shell>
}
