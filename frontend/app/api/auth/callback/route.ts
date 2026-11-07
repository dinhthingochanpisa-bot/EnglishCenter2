import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PENDING_COOKIE, open, cookieOptions, setSession, type PendingAuth, type UserSession } from '@/lib/session';
import { oidcMetadata, origin } from '@/lib/oidc';
export const runtime = 'nodejs';
export async function GET(req:NextRequest) {
  const failed = (reason:string) => NextResponse.redirect(`${origin()}/?auth_error=${encodeURIComponent(reason)}`);
  try {
    const pending = open<PendingAuth>(req.cookies.get(PENDING_COOKIE)?.value);
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    if (!pending || !code || !state || pending.state!==state || Date.now()-pending.createdAt>600_000) return failed('Phiên đăng nhập không hợp lệ');
    const m=await oidcMetadata();
    const body=new URLSearchParams({grant_type:'authorization_code',code,client_id:process.env.OIDC_CLIENT_ID!,redirect_uri:`${origin()}/api/auth/callback`,code_verifier:pending.verifier});
    if(process.env.OIDC_CLIENT_SECRET)body.set('client_secret',process.env.OIDC_CLIENT_SECRET);
    const tokenResponse=await fetch(m.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,cache:'no-store'});
    if(!tokenResponse.ok)return failed('Không thể đổi mã đăng nhập');
    const tokens=await tokenResponse.json() as {id_token?:string;access_token?:string;expires_in?:number};
    if(!tokens.id_token||!tokens.access_token)return failed('Thiếu thông tin đăng nhập');
    const {payload}=await jwtVerify(tokens.id_token,createRemoteJWKSet(new URL(m.jwks_uri)),{issuer:process.env.OIDC_ISSUER!,audience:process.env.OIDC_CLIENT_ID!,algorithms:['RS256','ES256']});
    if(payload.nonce!==pending.nonce || !payload.sub)return failed('OIDC nonce không hợp lệ');
    const expiresIn=Math.max(30,Math.min(3600,Number(tokens.expires_in)||300));
    const session:UserSession={accessToken:tokens.access_token,expiresAt:Date.now()+expiresIn*1000,user:{sub:payload.sub,name:typeof payload.name==='string'?payload.name:(typeof payload.preferred_username==='string'?payload.preferred_username:'Người dùng'),email:typeof payload.email==='string'?payload.email:undefined}};
    const response=NextResponse.redirect(`${origin()}/`);
    setSession(response,session);
    response.cookies.set(PENDING_COOKIE,'',cookieOptions(0));
    return response;
  } catch {return failed('Đăng nhập thất bại. Vui lòng thử lại.');}
}
