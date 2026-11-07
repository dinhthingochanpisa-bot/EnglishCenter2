import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { cookieOptions, PENDING_COOKIE, seal, type PendingAuth } from '@/lib/session';
import { oidcMetadata, origin } from '@/lib/oidc';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const m = await oidcMetadata();
    const clientId = process.env.OIDC_CLIENT_ID;
    if (!clientId) throw new Error('OIDC_CLIENT_ID missing');
    const pending: PendingAuth = {
      state: randomBytes(24).toString('base64url'),
      nonce: randomBytes(24).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'),
      createdAt: Date.now()
    };
    const challenge = createHash('sha256').update(pending.verifier).digest('base64url');
    const url = new URL(m.authorization_endpoint);
    for (const [k,v] of Object.entries({client_id:clientId,response_type:'code',redirect_uri:`${origin()}/api/auth/callback`,scope:'openid profile email',state:pending.state,nonce:pending.nonce,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(k,v);
    const response = NextResponse.redirect(url);
    response.cookies.set(PENDING_COOKIE,seal(pending),cookieOptions(600));
    return response;
  } catch { return NextResponse.json({message:'Không thể khởi tạo đăng nhập OIDC. Kiểm tra cấu hình.'},{status:503}); }
}
