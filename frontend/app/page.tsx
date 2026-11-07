'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {api,friendlyError,Tenant} from '@/lib/api';
import {Banner,Empty,Loading,Shell,useSession} from '@/components/ui';
export default function Home(){
 const router=useRouter(),session=useSession();
 const [tenants,setTenants]=useState<Tenant[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  if(!session?.authenticated)return;
  let active=true;
  api<Tenant[]>('v1/me/tenants').then(items=>{
   if(!active)return;
   setTenants(items);
   if(items.length===1)router.replace('/t/'+items[0].id+'/crm/overview');
  }).catch(e=>{if(active)setError(friendlyError(e))}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[session,router]);
 return <Shell title="Không gian làm việc" subtitle="Chọn tổ chức của bạn">
  {error&&<Banner message={error}/>}
  {loading?<Loading/>:<section className="panel"><div className="panel-body">
   {tenants.length?<div className="quick-list">{tenants.map(t=><Link key={t.id} href={'/t/'+t.id+'/crm/overview'}><strong>{t.displayName}</strong><small>{t.code}</small></Link>)}</div>:!error&&<Empty title="Chưa có tổ chức được cấp quyền" desc="Liên hệ quản trị viên để kích hoạt tư cách thành viên. Quản trị nền tảng có thể mở trang Tổ chức SaaS."/>}
  </div></section>}
 </Shell>
}
