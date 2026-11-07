import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sameOrigin } from '@/lib/oidc';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function proxy(req:NextRequest,ctx:{params:Promise<{segments:string[]}>}) {
  const method=req.method.toUpperCase();
  if(method!=='GET'&&!sameOrigin(req))return NextResponse.json({message:'Invalid request origin'},{status:403});
  const session=getSession(req);
  if(!session)return NextResponse.json({message:'Phiên đăng nhập hết hạn'},{status:401,headers:{'cache-control':'no-store'}});
  const {segments}=await ctx.params;
  // No arbitrary URL proxying or traversal. All calls are to fixed backend /v1 endpoints.
  if(segments.length<2 || segments[0]!=='v1' || segments.some(s=>!s||s==='.'||s==='..'||!/^[-_a-zA-Z0-9.]+$/.test(s)))return NextResponse.json({message:'Invalid endpoint'},{status:404});
  const root=process.env.BACKEND_URL;
  if(!root) return NextResponse.json({message:'Backend not configured'},{status:503});
  const url=new URL(segments.map(encodeURIComponent).join('/')+req.nextUrl.search,root.replace(/\/$/,'')+'/');
  const headers:Record<string,string>={Authorization:`Bearer ${session.accessToken}`,Accept:'application/json'};
  const contentType=req.headers.get('content-type');
  if(contentType)headers['content-type']=contentType;
  try {
    const upstream=await fetch(url,{method,headers,body:method==='GET'||method==='HEAD'?undefined:await req.text(),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12_000)});
    const responseText=await upstream.text();
    const allowedStatus=upstream.status>=300 && upstream.status<400?502:upstream.status;
    return new NextResponse(responseText,{status:allowedStatus,headers:{'content-type':upstream.headers.get('content-type')?.includes('application/json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  } catch {
    return NextResponse.json({message:'Không kết nối được Backend API. Vui lòng thử lại.'},{status:502,headers:{'cache-control':'no-store'}});
  }
}
export const GET=proxy;export const POST=proxy;export const PATCH=proxy;export const DELETE=proxy;
