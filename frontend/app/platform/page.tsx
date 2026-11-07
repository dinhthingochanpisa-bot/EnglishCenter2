'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Building2,Plus,UserPlus} from 'lucide-react';
import {api,post,patch,Tenant,friendlyError,uuid} from '@/lib/api';
import {Shell,Button,Field,FormActions,Modal,Banner,Loading,Empty,SectionHeading,Status,Success} from '@/components/ui';
export default function Platform(){
 const [tenants,setTenants]=useState<Tenant[]>([]);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [dialog,setDialog]=useState<'tenant'|'user'|'bootstrap'|'edit'|null>(null);const [target,setTarget]=useState<Tenant|null>(null);
 const [form,setForm]=useState({code:'',displayName:'',legalName:'',authSubject:'',email:'',userId:'',status:'ACTIVE'});
 const reload=useCallback(async()=>{setLoading(true);try{setTenants(await api<Tenant[]>('v1/platform/tenants'));setError('')}catch(e){setError(friendlyError(e))}finally{setLoading(false)}},[]);
 useEffect(()=>{void reload()},[reload]);
 function open(d:typeof dialog,t?:Tenant){setDialog(d);setTarget(t||null);setForm({code:'',displayName:t?.displayName||'',legalName:t?.legalName||'',authSubject:'',email:'',userId:'',status:t?.status||'ACTIVE'});setError('');setSuccess('')}
 async function submit(e:React.FormEvent){e.preventDefault();if(!dialog)return;setBusy(true);setError('');try{
  if(dialog==='tenant')await post('v1/platform/tenants',{code:form.code,displayName:form.displayName,legalName:form.legalName});
  if(dialog==='user')await post('v1/platform/users',{authSubject:form.authSubject,displayName:form.displayName,...(form.email?{email:form.email}:{})});
  if(dialog==='edit'&&target)await patch(`v1/platform/tenants/${target.id}`,{displayName:form.displayName,legalName:form.legalName||form.displayName,status:form.status});
  if(dialog==='bootstrap'&&target){if(!uuid(form.userId))throw new Error('User ID không hợp lệ');await post(`v1/platform/tenants/${target.id}/bootstrap-admin`,{userId:form.userId});}
  setDialog(null);setSuccess('Thao tác thành công và đã được ghi nhận qua Backend API.');await reload();
 }catch(e){setError(friendlyError(e))}finally{setBusy(false)}}
 return <Shell title="Quản lý tổ chức SaaS" subtitle="Onboarding, quản trị tổ chức và định danh cấp nền tảng." actions={<><Button kind="secondary" onClick={()=>open('user')}><UserPlus size={17}/>Tạo định danh</Button><Button onClick={()=>open('tenant')}><Plus size={17}/>Tạo tổ chức</Button></>}>
 {error&&<Banner message={error} onClose={()=>setError('')}/>} {success&&<Success message={success}/>}
 <section className="panel"><SectionHeading title="Danh sách tổ chức" desc="Dữ liệu thực từ API /v1/platform/tenants"/><div className="table-scroll">{loading?<Loading/>:!tenants.length?<Empty title="Chưa có tổ chức" desc="Tạo tổ chức mới nếu bạn có quyền Platform Admin."/>:<table className="data-table"><thead><tr><th>Tổ chức</th><th>Mã</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td><div className="entity-name"><span className="mini-logo">{t.displayName.slice(0,1).toUpperCase()}</span><span><strong>{t.displayName}</strong><small>{t.id}</small></span></div></td><td><code>{t.code}</code></td><td><Status value={t.status}/></td><td><div className="cell-actions"><Link className="action-link" href={`/t/${t.id}/overview`}>Mở <ArrowRight size={15}/></Link><button className="text-button" onClick={()=>open('edit',t)}>Sửa</button><button className="text-button" onClick={()=>open('bootstrap',t)}>Cấp quản trị viên</button></div></td></tr>)}</tbody></table>}</div></section>
 <div className="help-note"><Building2 size={18}/><div><strong>Ranh giới bảo mật</strong><p>Chỉ người có quyền Platform Admin mới thực hiện được thao tác trên trang này. Frontend không được phép cấp quyền; backend xác thực OIDC và kiểm tra danh sách quản trị viên.</p></div></div>
 {dialog&&<Modal title={dialog==='tenant'?'Tạo tổ chức mới':dialog==='user'?'Tạo định danh người dùng':dialog==='edit'?'Cập nhật tổ chức':'Khởi tạo quản trị viên Tenant'} onClose={()=>setDialog(null)}><form className="stack" onSubmit={submit}>
 {dialog==='tenant'&&<Field label="Mã tổ chức"><input required maxLength={64} value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="VD: foreign-language-01"/></Field>}
 {(dialog==='tenant'||dialog==='edit'||dialog==='user')&&<Field label="Tên hiển thị"><input required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></Field>}
 {(dialog==='tenant'||dialog==='edit')&&<Field label="Tên pháp lý"><input required value={form.legalName} onChange={e=>setForm({...form,legalName:e.target.value})}/></Field>}
 {dialog==='edit'&&<Field label="Trạng thái"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ONBOARDING">Đang khởi tạo</option><option value="ACTIVE">Hoạt động</option><option value="SUSPENDED">Tạm khóa</option><option value="CLOSED">Đã đóng</option></select></Field>}
 {dialog==='user'&&<><Field label="OIDC Subject" hint="Tài khoản phải tồn tại trong hệ thống Identity Provider; đây không phải tạo mật khẩu."><input required value={form.authSubject} onChange={e=>setForm({...form,authSubject:e.target.value})}/></Field><Field label="Email (không bắt buộc)"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field></>}
 {dialog==='bootstrap'&&<><p className="muted">Khởi tạo vai trò quản trị viên đầu tiên. Nghiệp vụ này chỉ được thực hiện một lần bởi Platform Admin.</p><Field label="Platform User ID (UUID)"><input required value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})} placeholder="UUID người dùng đã provision"/></Field></>}
 {error&&<Banner message={error}/>}<FormActions busy={busy} text={dialog==='bootstrap'?'Cấp quản trị viên':'Xác nhận'} onCancel={()=>setDialog(null)}/></form></Modal>}
 </Shell>
}
