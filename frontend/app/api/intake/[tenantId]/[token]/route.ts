import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:Promise<{tenantId:string;token:string}>}){
 const {tenantId,token}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(tenantId)||!/^[A-Za-z0-9_-]{40,80}$/.test(token))return NextResponse.json({message:'Invalid invitation'},{status:404});
 const length=Number(req.headers.get('content-length')||0);
 if(length>7000)return NextResponse.json({message:'Form too large'},{status:413});
 const root=process.env.BACKEND_URL;
 if(!root)return NextResponse.json({message:'Form service unavailable'},{status:503});
 const body=await req.text();if(body.length>7000)return NextResponse.json({message:'Form too large'},{status:413});
 try{
  const upstream=await fetch(`${root.replace(/\/$/,'')}/v1/public/intake/${tenantId}/${token}`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body,cache:'no-store',signal:AbortSignal.timeout(8000)});
  const raw=await upstream.text();return new NextResponse(raw,{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'}});
 }catch{return NextResponse.json({message:'Hệ thống chưa kết nối. Vui lòng thử lại.'},{status:503})}
}
